import { FastifyInstance, FastifyPluginOptions } from 'fastify'
import fs from 'fs'
import JSON5 from 'json5'
import { OpenAI } from 'openai'
import path from 'path'
import { generatePrompt } from './prompt'
import { swaggerHtml } from './swagger'
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

// تابع ولیدیشن برای چک کردن توکن
function validateToken(request: any): string[] {
    const errors: string[] = []
    const authHeader = request.headers.authorization

    if (!authHeader) {
        errors.push('Authorization header is required')
        return errors
    }
    
    // اینجا می‌تونیم ولیدیشن‌های بیشتری اضافه کنیم
    // مثلاً چک کردن فرمت توکن یا اعتبارسنجی آن

    return errors
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
    console.log('🔍 Searching for handler:', handlerName)
    let searchCount = 0
    const maxSearches = 5

    // If handlerName starts with fastify., remove it
    const realHandlerName = handlerName.replace(/^fastify\./, '').trim()

    while (searchCount < maxSearches) {
        searchCount++
        console.log(`🔄 Search attempt ${searchCount}/${maxSearches}`)

        // First search in plugins directory
        if (fs.existsSync(pluginsDir)) {
            const files = await getAllFiles(pluginsDir)
            console.log('🔍 Searching in plugins directory:', pluginsDir)

            for (const file of files) {
                const content = fs.readFileSync(file, 'utf-8')

                // Look for decorated handlers in plugins
                const decoratedMatch = content.match(new RegExp(`fastify\\.decorate\\s*\\(\\s*['"]${realHandlerName}['"]\\s*,\\s*([^,)]+)\\s*\\)`))
                if (decoratedMatch) {
                    const [_, functionName] = decoratedMatch
                    const cleanFunctionName = functionName.trim()
                    console.log('✅ Found decorator for:', realHandlerName, 'with function name:', cleanFunctionName)

                    // Now search for the function definition
                    const functionStart = content.indexOf(`async function ${cleanFunctionName}`)
                    if (functionStart === -1) {
                        console.log('⚠️ Could not find function definition for:', cleanFunctionName)
                        continue
                    }

                    // Find the end of the function
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
                        console.log('✅ Found function definition for:', cleanFunctionName)
                        return functionCode
                    }
                }
            }
        } else {
            console.warn('⚠️ Plugins directory not found:', pluginsDir)
        }

        // If not found in plugins, search in the base directory
        const files = await getAllFiles(baseDir)
        console.log('🔍 Searching in base directory:', baseDir)

        for (const file of files) {
            const content = fs.readFileSync(file, 'utf-8')

            // Look for inline handlers
            const inlineHandlerMatch = content.match(new RegExp(`async\\s+function\\s+${realHandlerName}\\s*\\([^)]*\\)\\s*\\{`))
            if (inlineHandlerMatch && inlineHandlerMatch.index !== undefined) {
                console.log('✅ Found inline handler in:', file)

                // Find the start and end of the function
                const functionStart = inlineHandlerMatch.index
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
                    console.log('✅ Found function definition for:', realHandlerName)
                    return functionCode
                }
            }
        }

        // If not found, wait a bit before trying again
        await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.warn('⚠️ Handler not found after', maxSearches, 'attempts:', realHandlerName)
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
  async function scanDirectory(dir: string, rootDir: string = routesDir, scannedFiles: Set<string> = new Set()) {
    const files = fs.readdirSync(dir)

    for (const file of files) {
      const fullPath = path.join(dir, file)
      const stat = fs.statSync(fullPath)

      if (stat.isDirectory()) {
        // اگر پوشه است، بازگشتی اسکن کن
        await scanDirectory(fullPath, rootDir, scannedFiles)
      } else if (file.endsWith('.ts') || file.endsWith('.js')) {
        // اگر فایل قبلاً اسکن شده، ازش رد شو
        if (scannedFiles.has(fullPath)) {
          console.log('⏩ Skipping already scanned file:', fullPath)
          continue
        }
        scannedFiles.add(fullPath)

        // اگر فایل است، روت‌ها رو استخراج کن
        const content = fs.readFileSync(fullPath, 'utf-8')

        // پیدا کردن روت‌ها و دکوریشن‌ها
        const routeMatches = content.matchAll(/(?:fastify\.|\.)(get|post|put|delete|patch)(?:<.*?>)?\(['\"`](.*?)['\"`],\s*(?:async\s*)?(?:\(.*?\)\s*=>\s*\{[\s\S]*?\}|([^,)]+)\))/g)

        for (const match of routeMatches) {
          const [_, method, route, handlerName] = match

          if(match.input.includes(`// fastify.${method}('${route}', ${handlerName})`) || match.input.includes(`// fastify.${method}('${route}',${handlerName})`)) {
            console.log('🔍 Skipping route:', { method, route, handlerName })
            continue;
          }

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

          // محاسبه مسیر نسبی از rootDir
          const relativePath = path.relative(rootDir, dir)
          const fullRoute = path.join(relativePath, route).replace(/\\/g, '/')
          const finalRoute = fullRoute.startsWith('/') ? fullRoute : '/' + fullRoute

          // اضافه کردن روت به لیست
          endpoints.push({
            method,
            route: finalRoute,
            handlerCode: finalHandlerCode,
            schema
          })
        }
      }
    }
  }

  // شروع اسکن از پوشه اصلی
  await scanDirectory(routesDir, routesDir)


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
          ...(swaggerPaths[route] || {}),
          [method]: {
            ...schema,
            summary: `Auto-generated from ${route}`
          }
        }
        continue
      }

      const prompt = generatePrompt(handlerCode)
      let result = await getValidJsonFromGPT(openai, prompt, 3, gptModel);


      if (result.responses['401'] || result.responses['403']) {
        result = {
          ...result,
          security: [
            {
              bearerAuth: []
            }
          ]
        }
        // اضافه کردن ولیدیشن توکن
        validators[route] = {
          ...validators[route],
          [method]: (request: any) => validateToken(request)
        }
      }

      swaggerPaths[route] = {
        ...(swaggerPaths[route] || {}),
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
      schemas: {},
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Authorization token'
        }
      }
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
      const swaggerPath = path.join(process.cwd(), 'swagger', 'swagger.json');

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
      const htmlContent = swaggerHtml;
      return reply.type('text/html').send(htmlContent)
    } catch (error) {
      console.error('❌ Error reading swagger.html:', error)
      return reply.code(500).send({
        error: 'Failed to read swagger UI'
      })
    }
  })

  console.log(`📚 Fastify GPT Swagger documentation is available at: ${swaggerUiPath}`)
}

export default fastifyGptSwagger
