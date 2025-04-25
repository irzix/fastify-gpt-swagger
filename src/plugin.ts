import fs from 'fs'
import path from 'path'
import { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { OpenAI } from 'openai'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import Ajv from 'ajv'

interface PluginOptions {
  openaiApiKey: string
  routesDir?: string
  autoGenerate?: boolean
  swaggerUiPath?: string
  enableValidation?: boolean
}

interface ValidationSchema {
  body?: any
  params?: any
  query?: any
}

function extractJsonFromText(text: string): any | null {
  const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
  if (!jsonMatch) return null
  
  try {
    return JSON.parse(jsonMatch[0])
  } catch (e) {
    return null
  }
}

function createValidator(schema: ValidationSchema) {
  const ajv = new Ajv({ allErrors: true })
  const validators = {
    body: schema.body ? ajv.compile(schema.body) : null,
    params: schema.params ? ajv.compile(schema.params) : null,
    query: schema.query ? ajv.compile(schema.query) : null
  }

  return (request: any) => {
    const errors: string[] = []

    if (validators.body && request.body) {
      const valid = validators.body(request.body)
      if (!valid) {
        errors.push(`Body validation failed: ${ajv.errorsText(validators.body.errors)}`)
      }
    }

    if (validators.params && request.params) {
      const valid = validators.params(request.params)
      if (!valid) {
        errors.push(`Params validation failed: ${ajv.errorsText(validators.params.errors)}`)
      }
    }

    if (validators.query && request.query) {
      const valid = validators.query(request.query)
      if (!valid) {
        errors.push(`Query validation failed: ${ajv.errorsText(validators.query.errors)}`)
      }
    }

    return errors
  }
}

async function scanRoutesAndGenerateSwagger({ routesDir, openaiApiKey }: { routesDir: string, openaiApiKey: string }) {
  if (!fs.existsSync(routesDir)) {
    throw new Error(`مسیر روت‌ها یافت نشد: ${routesDir}`)
  }

  const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts') || f.endsWith('.js'))
  const endpoints: { method: string, route: string, handlerCode: string }[] = []

  for (const file of files) {
    const content = fs.readFileSync(path.join(routesDir, file), 'utf-8')
    const matchRoutes = content.matchAll(/fastify\.(get|post|put|delete|patch)\(['\"`](.*?)['\"`],\s*(async\s*\(.*?\)\s*=>\s*\{[\s\S]*?\})/g)

    for (const match of matchRoutes) {
      const [_, method, route, handlerCode] = match
      endpoints.push({ method, route, handlerCode })
    }
  }

  const openai = new OpenAI({ apiKey: openaiApiKey })
  const swaggerPaths: Record<string, any> = {}
  const validators: Record<string, Record<string, (request: any) => string[]>> = {}

  for (const { method, route, handlerCode } of endpoints) {
    const prompt = `
این یک فانکشن روت از فریمورک Fastify است. لطفاً براساس آن، یک JSON Schema برای درخواست (query, body, params) و پاسخ خروجی بنویس.
لطفاً برای هر فیلد، نوع داده، توضیحات و قوانین ولیدیشن (مثل required، minLength و غیره) را مشخص کنید:

${handlerCode}
    `

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }]
      })

      const result = extractJsonFromText(completion.choices[0].message.content || '')
      if (!result) {
        console.warn(`❗ نتوانستم JSON را از پاسخ برای روت ${route} استخراج کنم`)
        continue
      }

      const schema = {
        body: result.requestBody?.content?.['application/json']?.schema,
        params: result.parameters?.reduce((acc: any, param: any) => {
          if (param.in === 'path') {
            acc[param.name] = param.schema
          }
          return acc
        }, {}),
        query: result.parameters?.reduce((acc: any, param: any) => {
          if (param.in === 'query') {
            acc[param.name] = param.schema
          }
          return acc
        }, {})
      }

      if (!validators[route]) {
        validators[route] = {}
      }
      validators[route][method] = createValidator(schema)

      swaggerPaths[route] = {
        [method]: {
          summary: `Auto-generated from ${route}`,
          requestBody: result.requestBody || {},
          parameters: result.parameters || [],
          responses: result.responses || {
            200: {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: result.responseSchema || {}
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`❌ خطا در پردازش روت ${route}:`, error)
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

async function fastifyGptSwagger(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions & PluginOptions
) {
  const {
    openaiApiKey,
    routesDir = path.join(process.cwd(), 'routes'),
    autoGenerate = false,
    swaggerUiPath = '/docs',
    enableValidation = true
  } = opts

  if (!openaiApiKey) {
    throw new Error('کلید API OpenAI الزامی است')
  }

  let swaggerJson: any = null
  let validators: any = null

  // رجیستر کردن پلاگین‌های Swagger
  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Auto-generated Swagger',
        version: '1.0.0'
      }
    }
  })

  await fastify.register(fastifySwaggerUi, {
    routePrefix: swaggerUiPath,
    uiConfig: {
      docExpansion: 'full',
      deepLinking: true
    },
    staticCSP: true
  })

  if (autoGenerate) {
    setImmediate(async () => {
      try {
        const result = await scanRoutesAndGenerateSwagger({ routesDir, openaiApiKey })
        swaggerJson = result
        validators = result.validators
        console.log('✅ مستندات Swagger با موفقیت تولید شد')
      } catch (error) {
        console.error('❌ خطا در تولید خودکار مستندات:', error)
      }
    })
  }

  fastify.decorate('generateSwaggerFromRoutes', async () => {
    try {
      const result = await scanRoutesAndGenerateSwagger({ routesDir, openaiApiKey })
      swaggerJson = result
      validators = result.validators
      console.log('✅ مستندات Swagger با موفقیت تولید شد')
      return swaggerJson
    } catch (error) {
      console.error('❌ خطا در تولید مستندات:', error)
      throw error
    }
  })

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

  fastify.get('/docs/json', async (request, reply) => {
    if (!swaggerJson) {
      return reply.code(503).send({ 
        error: 'مستندات آماده نیست. لطفاً generateSwaggerFromRoutes() را اجرا کنید یا منتظر تولید خودکار بمانید.' 
      })
    }
    return swaggerJson
  })
}

export default fastifyGptSwagger
