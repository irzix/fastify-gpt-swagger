import { FastifyInstance, FastifyPluginOptions } from 'fastify'
import fs from 'fs'
import JSON5 from 'json5'
import { OpenAI } from 'openai'
import path from 'path'
import { FastifyGptSwagger, PluginOptions } from './types'


declare module 'fastify' {
  interface FastifyInstance {
    generateSwaggerFromRoutes(routesDir: string, openaiApiKey: string, openaiEndpoint?: string): Promise<any>;
  }
}

function extractOpenAPISpec(text: string) {
  // ۱. پیدا کردن اولین بلوک {...}
  const match = text.match(/\{[\s\S]*\}$/m) || text.match(/\{[\s\S]*?\}/m);
  if (!match) {
    throw new Error('No JSON object found in the input text.');
  }
  const jsonString = match[0];

  // ۲. تلاش برای پارس با JSON.parse
  let obj;
  try {
    obj = JSON.parse(jsonString);
  } catch (e) {
    // ۳. اگر شکست خورد، با JSON5 سعی کن
    try {
      obj = JSON5.parse(jsonString);
    } catch (e2) {
      throw new Error('Failed to parse JSON (and JSON5) – invalid format.');
    }
  }

  // ۴. استخراج فیلدهای مدنظر
  const { requestBody, parameters, responses } = obj;
  return { requestBody, parameters, responses };
}

async function getValidJsonFromGPT(openai: OpenAI, prompt: string, maxRetries: number = 3, gptModel: string = 'gpt-4'): Promise<any> {
  let retries = 0;
  let lastError = null;

  while (retries < maxRetries) {
    try {
      const completion = await openai.chat.completions.create({
        model: gptModel,
        messages: [{ role: 'user', content: prompt }]
      });

      const result = extractOpenAPISpec(completion.choices[0].message.content || '');
      if (result) {
        return result;
      }

      throw new Error('Invalid JSON format');
    } catch (error) {
      lastError = error;
      retries++;
      console.log(`🔄 Retry ${retries}/${maxRetries} for generating valid JSON`);

      if (retries < maxRetries) {
        // اضافه کردن دستورالعمل‌های بیشتر برای GPT
        prompt += '\n\nلطفاً دقت کنید که خروجی باید یک JSON معتبر باشد. از کاماهای درست استفاده کنید و از کوتیشن دوتایی برای کلیدها استفاده کنید.';
        await new Promise(resolve => setTimeout(resolve, 1000)); // کمی صبر کن
      }
    }
  }

  throw lastError;
}

async function scanRoutesAndGenerateSwagger({
  routesDir,
  pluginsDir,
  gptModel,
  openaiApiKey,
  openaiEndpoint
}: {
  routesDir: string;
  pluginsDir: string;
  gptModel: string;
  openaiApiKey: string;
  openaiEndpoint?: string
}) {
  if (!fs.existsSync(routesDir)) {
    throw new Error(`Routes directory not found: ${routesDir}`)
  }

  const endpoints: { method: string, route: string, handlerCode: string, schema?: any }[] = []

  // تابع برای پیدا کردن handler از کدبیس
  async function findHandler(handlerName: string, baseDir: string): Promise<string | null> {
    // اول در پوشه plugins جستجو کن
    console.log('🔍 Searching in plugins directory:', pluginsDir)

    if (fs.existsSync(pluginsDir)) {
      const files = await getAllFiles(pluginsDir)

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8')

        // جستجو برای فانکشن‌های دکوریت شده در پلاگین‌ها
        const decoratedMatch = content.match(new RegExp(`fastify\\.decorate\\s*\\(\\s*['"]${handlerName}['"]\\s*,\\s*(${handlerName})\\s*\\)`))
        if (decoratedMatch) {
          console.log('✅ Found decorated handler in:', file)

          // پیدا کردن شروع فانکشن
          const functionStart = content.indexOf(`async function ${handlerName}`)
          if (functionStart === -1) continue

          // پیدا کردن پایان فانکشن
          let braceCount = 0
          let functionEnd = functionStart

          for (let i = functionStart; i < content.length; i++) {
            if (content[i] === '{') braceCount++
            if (content[i] === '}') {
              braceCount--
              if (braceCount === 0) {
                functionEnd = i + 1
                break
              }
            }
          }

          if (functionEnd > functionStart) {
            const functionCode = content.slice(functionStart, functionEnd)
            console.log('✅ Found function definition for:', handlerName)
            return functionCode
          }
        }
      }
    } else {
      console.warn('⚠️ Plugins directory not found:', pluginsDir)
    }

    // اگر در پلاگین‌ها پیدا نشد، در روت مشخص شده جستجو کن
    const files = await getAllFiles(baseDir)

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8')

      // پیدا کردن شروع فانکشن
      const functionStart = content.indexOf(`async function ${handlerName}`)
      if (functionStart === -1) continue

      // پیدا کردن پایان فانکشن
      let braceCount = 0
      let functionEnd = functionStart

      for (let i = functionStart; i < content.length; i++) {
        if (content[i] === '{') braceCount++
        if (content[i] === '}') {
          braceCount--
          if (braceCount === 0) {
            functionEnd = i + 1
            break
          }
        }
      }

      if (functionEnd > functionStart) {
        const functionCode = content.slice(functionStart, functionEnd)
        console.log('✅ Found handler in route file:', file)
        return functionCode
      }
    }

    console.warn('⚠️ Handler not found:', handlerName)
    return null
  }

  // تابع برای پیدا کردن همه فایل‌ها
  async function getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = []

    async function scan(dir: string) {
      const items = fs.readdirSync(dir)

      for (const item of items) {
        const fullPath = path.join(dir, item)
        const stat = fs.statSync(fullPath)

        if (stat.isDirectory()) {
          await scan(fullPath)
        } else if (item.endsWith('.ts') || item.endsWith('.js')) {
          files.push(fullPath)
        }
      }
    }

    await scan(dir)
    return files
  }

  // تابع بازگشتی برای اسکن پوشه‌ها
  async function scanDirectory(dir: string, baseRoute: string = '') {
    const files = fs.readdirSync(dir)

    for (const file of files) {
      const fullPath = path.join(dir, file)
      const stat = fs.statSync(fullPath)

      if (stat.isDirectory()) {
        // اگر پوشه است، بازگشتی اسکن کن
        const newBaseRoute = path.join(baseRoute, file)
        await scanDirectory(fullPath, newBaseRoute)
      } else if (file.endsWith('.ts') || file.endsWith('.js')) {
        // اگر فایل است، روت‌ها رو استخراج کن
        const content = fs.readFileSync(fullPath, 'utf-8')

        // پیدا کردن روت‌ها و دکوریشن‌ها
        const routeMatches = content.matchAll(/(?:fastify\.|\.)(get|post|put|delete|patch)(?:<.*?>)?\(['\"`](.*?)['\"`],\s*(?:async\s*)?(?:\(.*?\)\s*=>\s*\{[\s\S]*?\}|([^,)]+)\))/g)

        for (const match of routeMatches) {
          const [_, method, route, handlerName] = match
          console.log('🔍 Found route:', { method, route, handlerName })

          // اگر handlerName وجود داشت، سعی کن handler رو پیدا کنی
          let finalHandlerCode = ''
          if (handlerName) {
            // استخراج نام واقعی هندلر از fastify.cartsGet
            const realHandlerName = handlerName.replace(/^fastify\./, '').trim()

            // اول در پلاگین‌ها جستجو کن
            const foundHandler = await findHandler(realHandlerName, dir)
            if (foundHandler) {
              finalHandlerCode = foundHandler
            } else {
              // اگر هندلر رو پیدا نکردی، لاگ کن
              console.warn(`⚠️ Could not find handler for route ${route}: ${realHandlerName}`)
              continue
            }
          }

          // پیدا کردن اسکیما از دکوریشن‌ها
          const schemaMatch = content.match(/@fastify\.schema\(([\s\S]*?)\)/m)
          let schema = null
          if (schemaMatch) {
            try {
              schema = JSON5.parse(schemaMatch[1])
            } catch (e) {
              console.warn(`⚠️ Could not parse schema for route ${route}:`, e)
            }
          }

          // اضافه کردن روت به لیست
          endpoints.push({
            method,
            route: '/' + path.join(baseRoute, route).replace(/\\/g, '/'),
            handlerCode: finalHandlerCode,
            schema
          })
        }
      }
    }
  }

  // شروع اسکن از پوشه اصلی
  await scanDirectory(routesDir)


  const openai = new OpenAI({
    apiKey: openaiApiKey,
    baseURL: openaiEndpoint
  })

  const swaggerPaths: Record<string, any> = {}
  const validators: Record<string, Record<string, (request: any) => string[]>> = {}

  for (const { method, route, handlerCode, schema } of endpoints) {
    try {
      // اگر اسکیما از دکوریشن موجود بود، از اون استفاده کن
      if (schema) {
        swaggerPaths[route] = {
          [method]: {
            ...schema,
            summary: `Auto-generated from ${route}`
          }
        }
        continue
      }

      // در غیر این صورت از GPT استفاده کن
      const prompt = `
این یک فانکشن روت از فریمورک Fastify است. لطفاً براساس آن، یک JSON Schema برای درخواست (query, body, params) و پاسخ خروجی بنویس.

مهم: لطفاً فقط یک JSON object برگردانید، بدون هیچ توضیح اضافی. فرمت JSON باید دقیقاً به این شکل باشد:

{
  "requestBody": {
    "content": {
      "application/json": {
        "schema": {
          "type": "object",
          "properties": {},
          "required": []
        }
      }
    }
  },
  "parameters": [
    {
      "name": "paramName",
      "in": "path",
      "schema": {
        "type": "string",
        "description": "توضیحات پارامتر"
      },
      "required": true
    }
  ],
  "responses": {
    "200": {
      "description": "پاسخ موفق",
      "content": {
        "application/json": {
          "schema": {
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": false
          }
        }
      }
    }
  }
}

نکات مهم:
1. فقط JSON برگردانید، بدون هیچ متن اضافی
2. از $id استفاده نکنید، از id استفاده کنید
3. از type به جای format استفاده کنید
4. از additionalProperties: false استفاده کنید
5. از کاماهای درست استفاده کنید
6. از کوتیشن دوتایی برای کلیدها استفاده کنید
7. برای تشخیص پارامترها:
   - به دنبال متغیرهایی در مسیر URL بگردید (مثل :id یا {id})
   - به دنبال متغیرهایی در query parameters بگردید
   - به دنبال متغیرهایی در body بگردید
   - به دنبال متغیرهایی که در کد استفاده شده‌اند بگردید
8. برای هر پارامتر:
   - نام دقیق پارامتر را از کد استخراج کنید
   - نوع داده مناسب را تعیین کنید
   - توضیحات مناسب را بر اساس استفاده در کد بنویسید
9. برای پاسخ‌ها:
   - به دنبال return یا reply در کد بگردید
   - ساختار داده برگشتی را تحلیل کنید
   - فیلدهای اجباری و اختیاری را مشخص کنید

کد روت:
${handlerCode}
      `

      const result = await getValidJsonFromGPT(openai, prompt, 3, gptModel);
      swaggerPaths[route] = {
        [method]: {
          ...result,
          summary: `Auto-generated from ${route}`
        }
      }

    } catch (error) {
      console.error(`❌ Error processing route ${route} after all retries:`, error)
      continue
    }
  }

  return {
    openapi: '3.0.0',
    info: {
      title: 'Auto-generated Swagger',
      version: '1.0.0',
      description: 'API documentation automatically generated using OpenAI GPT'
    },
    paths: swaggerPaths,
    components: {
      schemas: {}
    },
    validators
  }
}

async function saveSwaggerJson(swaggerJson: any, outputDir: string = './swagger') {
  try {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Save the JSON file
    const outputPath = path.join(outputDir, 'swagger.json')
    fs.writeFileSync(outputPath, JSON.stringify(swaggerJson, null, 2))
    console.log(`✅ Swagger JSON saved to ${outputPath}`)
  } catch (error) {
    console.error('❌ Error saving Swagger JSON:', error)
  }
}

const fastifyGptSwagger: FastifyGptSwagger = async function (
  fastify: FastifyInstance,
  opts: FastifyPluginOptions & PluginOptions
) {
  const {
    openaiApiKey,
    routesDir,
    pluginsDir,
    gptModel = 'gpt-4',
    autoGenerate = false,
    swaggerUiPath = '/docs',
    enableValidation = true,
    openaiEndpoint
  } = opts

  if (!openaiApiKey) {
    throw new Error('OpenAI API key is required')
  }

  let swaggerJson: any = null
  let validators: any = null

  // Auto-generate documentation if enabled
  if (autoGenerate) {
    console.log('🚀 Auto-generating Swagger documentation...')
    setImmediate(async () => {
      try {
        const result = await scanRoutesAndGenerateSwagger({
          routesDir,
          pluginsDir,
          gptModel,
          openaiApiKey,
          openaiEndpoint
        })
        swaggerJson = result
        validators = result.validators
        console.log('✅ Swagger documentation generated successfully')

        // Save the generated JSON
        await saveSwaggerJson(swaggerJson)

      } catch (error) {
        console.error('❌ Error in auto-generating documentation:', error)
      }
    })
  }

  // اضافه کردن هوک برای ولیدیشن
  if (enableValidation) {
    fastify.addHook('preHandler', async (request, reply) => {
      if (!validators) return

      const route = request.url.split('?')[0]
      const method = request.method.toLowerCase()
      const validator = validators[route]?.[method]

      if (validator) {
        const errors = validator(request)
        if (errors.length > 0) {
          return reply.code(400).send({
            error: 'Validation failed',
            details: errors
          })
        }
      }
    })
  }

  // روت برای دریافت JSON Swagger
  fastify.get(`/swagger-gpt-docs/json`, async (request, reply) => {
    try {
      const swaggerPath = path.join(process.cwd(), 'swagger', 'swagger.json')
      if (!fs.existsSync(swaggerPath)) {
        if (autoGenerate) {
          return reply.code(503).send({
            message: 'Swagger documentation is being generated, please try again in a few seconds'
          })
        }
        return reply.code(404).send({
          error: 'Swagger documentation not found'
        })
      }

      const swaggerContent = fs.readFileSync(swaggerPath, 'utf-8')
      return reply.type('application/json').send(swaggerContent)
    } catch (error) {
      console.error('❌ Error reading swagger.json:', error)
      return reply.code(500).send({
        error: 'Failed to read swagger documentation'
      })
    }
  })

  // روت برای نمایش Swagger UI
  fastify.get(swaggerUiPath, async (request, reply) => {
    try {
      const htmlPath = path.join(process.cwd(), 'swagger', 'swagger.html')
      if (!fs.existsSync(htmlPath)) {
        return reply.code(404).send({
          error: 'Swagger UI not found'
        })
      }

      const htmlContent = fs.readFileSync(htmlPath, 'utf-8')
      return reply.type('text/html').send(htmlContent)
    } catch (error) {
      console.error('❌ Error reading swagger.html:', error)
      return reply.code(500).send({
        error: 'Failed to read swagger UI'
      })
    }
  })

  console.log(`📚 Fastify GPT Swagger documentation is available at: http://localhost:3000${swaggerUiPath}`)
}

export default fastifyGptSwagger
