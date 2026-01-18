/**
 * Static Analysis Engine for Fastify Routes
 * Uses TypeScript AST and code analysis to extract route information
 */

import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import { OpenAI } from 'openai'
import { generatePrompt } from './prompt'
import { getValidJsonFromGPT } from './plugin'

interface RouteInfo {
  method: string
  route: string
  handlerCode: string
  handlerName?: string
  filePath: string
  schema?: any
  params?: string[]
  queryParams?: string[]
  bodyParams?: string[]
  responseType?: string
  requiresAuth?: boolean
}

interface CacheEntry {
  route: string
  method: string
  schema: any
  timestamp: number
}

/**
 * Static analysis using TypeScript Compiler API
 */
export class RouteAnalyzer {
  private program: ts.Program
  private checker: ts.TypeChecker

  constructor(tsConfigPath?: string) {
    const configPath = tsConfigPath || path.join(process.cwd(), 'tsconfig.json')
    const config = this.loadTsConfig(configPath)
    
    this.program = ts.createProgram(
      config.fileNames,
      config.options
    )
    this.checker = this.program.getTypeChecker()
  }

  private loadTsConfig(configPath: string): ts.ParsedCommandLine {
    if (fs.existsSync(configPath)) {
      const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
      return ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(configPath)
      )
    }
    
    // Default config
    return {
      fileNames: [],
      options: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        strict: true,
        esModuleInterop: true
      },
      errors: []
    }
  }

  /**
   * Extract route information from a file using AST
   */
  analyzeFile(filePath: string): RouteInfo[] {
    const sourceFile = this.program.getSourceFile(filePath)
    if (!sourceFile) return []

    const routes: RouteInfo[] = []

    const visit = (node: ts.Node) => {
      // Look for fastify.get/post/put/delete/patch calls
      if (ts.isCallExpression(node)) {
        const routeInfo = this.extractRouteFromCall(node, filePath)
        if (routeInfo) {
          routes.push(routeInfo)
        }
      }

      ts.forEachChild(node, visit)
    }

    visit(sourceFile)
    return routes
  }

  private extractRouteFromCall(node: ts.CallExpression, filePath: string): RouteInfo | null {
    const expression = node.expression

    // Check if it's fastify.get/post/put/delete/patch
    if (!ts.isPropertyAccessExpression(expression)) {
      return null
    }

    const method = expression.name.text.toLowerCase()
    if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
      return null
    }

    // Extract route path (first argument)
    if (node.arguments.length < 2) return null

    const routeArg = node.arguments[0]
    let route = ''
    
    if (ts.isStringLiteral(routeArg) || ts.isTemplateExpression(routeArg)) {
      route = routeArg.getText().replace(/['"`]/g, '')
    }

    // Extract handler (second argument)
    const handlerArg = node.arguments[1]
    let handlerName = ''
    let handlerCode = ''

    if (ts.isPropertyAccessExpression(handlerArg)) {
      // fastify.handlerName
      handlerName = handlerArg.name.text
    } else if (ts.isIdentifier(handlerArg)) {
      handlerName = handlerArg.text
    } else if (ts.isArrowFunction(handlerArg) || ts.isFunctionExpression(handlerArg)) {
      // Inline handler
      handlerCode = handlerArg.getText()
    }

    // Extract parameters from route
    const params = this.extractParamsFromRoute(route)

    // Try to extract schema from decorators or comments
    const schema = this.extractSchema(node)

    return {
      method,
      route,
      handlerCode,
      handlerName,
      filePath,
      params,
      schema
    }
  }

  private extractParamsFromRoute(route: string): string[] {
    const params: string[] = []
    const paramRegex = /:(\w+)|{(\w+)}/g
    let match

    while ((match = paramRegex.exec(route)) !== null) {
      params.push(match[1] || match[2])
    }

    return params
  }

  private extractSchema(node: ts.Node): any {
    // Look for @fastify.schema decorator in comments or nearby nodes
    const sourceFile = node.getSourceFile()
    const text = sourceFile.getFullText()
    const nodePos = node.getFullStart()

    // Search for schema decorator before this node
    const beforeText = text.substring(Math.max(0, nodePos - 500), nodePos)
    const schemaMatch = beforeText.match(/@fastify\.schema\s*\(([\s\S]*?)\)/m)

    if (schemaMatch) {
      try {
        // Try to parse as JSON
        return JSON.parse(schemaMatch[1])
      } catch {
        // If not valid JSON, return null
        return null
      }
    }

    return null
  }

  /**
   * Analyze handler code to extract more information
   */
  analyzeHandler(handlerCode: string, routeInfo: RouteInfo): RouteInfo {
    // Extract query parameters
    const queryParams = this.extractQueryParams(handlerCode)
    routeInfo.queryParams = queryParams

    // Extract body parameters
    const bodyParams = this.extractBodyParams(handlerCode)
    routeInfo.bodyParams = bodyParams

    // Check for authentication
    routeInfo.requiresAuth = this.checkAuth(handlerCode)

    // Extract response type
    routeInfo.responseType = this.extractResponseType(handlerCode)

    return routeInfo
  }

  private extractQueryParams(code: string): string[] {
    const params: string[] = []
    const regex = /request\.query\.(\w+)/g
    let match

    while ((match = regex.exec(code)) !== null) {
      if (!params.includes(match[1])) {
        params.push(match[1])
      }
    }

    return params
  }

  private extractBodyParams(code: string): string[] {
    const params: string[] = []
    const regex = /request\.body\.(\w+)/g
    let match

    while ((match = regex.exec(code)) !== null) {
      if (!params.includes(match[1])) {
        params.push(match[1])
      }
    }

    return params
  }

  private checkAuth(code: string): boolean {
    return /request\.headers\.authorization|authorization|bearer|jwt|token/i.test(code)
  }

  private extractResponseType(code: string): string {
    // Try to find return statements and infer type
    const returnMatch = code.match(/return\s+reply\.send\(([^)]+)\)|return\s+([^;]+)/)
    if (returnMatch) {
      return returnMatch[1] || returnMatch[2]
    }
    return 'object'
  }
}

/**
 * Generate Swagger spec from route info using static analysis
 */
function generateSwaggerFromStaticAnalysis(routeInfo: RouteInfo): any {
  const parameters: any[] = []

  // Path parameters
  if (routeInfo.params) {
    routeInfo.params.forEach(param => {
      parameters.push({
        name: param,
        in: 'path',
        required: true,
        schema: {
          type: 'string',
          description: `${param} identifier`
        }
      })
    })
  }

  // Query parameters
  if (routeInfo.queryParams) {
    routeInfo.queryParams.forEach(param => {
      parameters.push({
        name: param,
        in: 'query',
        required: false,
        schema: {
          type: 'string',
          description: `${param} query parameter`
        }
      })
    })
  }

  // Request body
  let requestBody: any = null
  if (routeInfo.bodyParams && routeInfo.bodyParams.length > 0) {
    const properties: Record<string, any> = {}
    routeInfo.bodyParams.forEach(param => {
      properties[param] = {
        type: 'string',
        description: `${param} field`
      }
    })

    requestBody = {
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties,
            required: routeInfo.bodyParams
          }
        }
      }
    }
  }

  // Responses
  const responses: Record<string, any> = {
    '200': {
      description: 'Successful response',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              status: { type: 'boolean' },
              result: { type: 'object' }
            }
          }
        }
      }
    }
  }

  if (routeInfo.requiresAuth) {
    responses['401'] = {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              status: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    }
  }

  const spec: any = {
    summary: `Auto-generated from ${routeInfo.route}`,
    parameters,
    responses
  }

  if (requestBody) {
    spec.requestBody = requestBody
  }

  if (routeInfo.requiresAuth) {
    spec.security = [{ bearerAuth: [] }]
  }

  return spec
}

/**
 * Load cache
 */
function loadCache(cacheDir: string): Map<string, CacheEntry> {
  const cache = new Map<string, CacheEntry>()
  const cacheFile = path.join(cacheDir, 'cache.json')

  if (fs.existsSync(cacheFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'))
      Object.entries(data).forEach(([key, value]) => {
        cache.set(key, value as CacheEntry)
      })
    } catch (error) {
      console.warn('Could not load cache:', error)
    }
  }

  return cache
}

/**
 * Save cache
 */
function saveCache(cache: Map<string, CacheEntry>, cacheDir: string) {
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true })
  }

  const cacheFile = path.join(cacheDir, 'cache.json')
  const data: Record<string, CacheEntry> = {}

  cache.forEach((value, key) => {
    data[key] = value
  })

  fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2))
}

/**
 * Get cache key
 */
function getCacheKey(route: string, method: string, handlerCode: string): string {
  // Simple hash of route + method + handler code
  return `${route}:${method}:${Buffer.from(handlerCode).toString('base64').substring(0, 50)}`
}

/**
 * Main function to scan routes and generate Swagger
 */
export async function scanRoutesAndGenerateSwagger({
  routesDir,
  pluginsDir,
  useGpt = false,
  gptModel = 'gpt-4',
  openaiApiKey = '',
  openaiEndpoint,
  useCache = true,
  cacheDir = './.swagger-cache'
}: {
  routesDir: string
  pluginsDir: string
  useGpt?: boolean
  gptModel?: string
  openaiApiKey?: string
  openaiEndpoint?: string
  useCache?: boolean
  cacheDir?: string
}): Promise<any> {
  if (!fs.existsSync(routesDir)) {
    throw new Error(`Routes directory not found: ${routesDir}`)
  }

  const analyzer = new RouteAnalyzer()
  const cache = useCache ? loadCache(cacheDir) : new Map<string, CacheEntry>()
  const openai = useGpt ? new OpenAI({
    apiKey: openaiApiKey,
    baseURL: openaiEndpoint
  }) : null

  // Find all route files
  async function getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = []

    async function scan(currentDir: string) {
      const items = fs.readdirSync(currentDir)

      for (const item of items) {
        const fullPath = path.join(currentDir, item)
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

  // Find handler function
  async function findHandler(handlerName: string, baseDir: string, pluginsDir: string): Promise<string | null> {
    const realHandlerName = handlerName.replace(/^fastify\./, '').trim()

    // Search in plugins directory
    if (fs.existsSync(pluginsDir)) {
      const files = await getAllFiles(pluginsDir)
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8')
        const decoratedMatch = content.match(new RegExp(`fastify\\.decorate\\s*\\(\\s*['"]${realHandlerName}['"]\\s*,\\s*([^,)]+)\\s*\\)`))
        
        if (decoratedMatch) {
          const [_, functionName] = decoratedMatch
          const cleanFunctionName = functionName.trim()
          const functionStart = content.indexOf(`async function ${cleanFunctionName}`)
          
          if (functionStart !== -1) {
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
              return content.slice(functionStart, functionEnd)
            }
          }
        }
      }
    }

    return null
  }

  const files = await getAllFiles(routesDir)
  const allRoutes: RouteInfo[] = []

  // Analyze all files
  for (const file of files) {
    try {
      const routes = analyzer.analyzeFile(file)
      
      for (const route of routes) {
        // If handler name exists, try to find the handler code
        if (route.handlerName && !route.handlerCode) {
          const handlerCode = await findHandler(route.handlerName, routesDir, pluginsDir)
          if (handlerCode) {
            route.handlerCode = handlerCode
            analyzer.analyzeHandler(handlerCode, route)
          }
        } else if (route.handlerCode) {
          analyzer.analyzeHandler(route.handlerCode, route)
        }

        // Calculate full route path
        const relativePath = path.relative(routesDir, path.dirname(file))
        const fullRoute = path.join(relativePath, route.route).replace(/\\/g, '/')
        route.route = fullRoute.startsWith('/') ? fullRoute : '/' + fullRoute

        allRoutes.push(route)
      }
    } catch (error) {
      console.warn(`Error analyzing file ${file}:`, error)
    }
  }

  // Generate Swagger paths
  const swaggerPaths: Record<string, any> = {}

  for (const routeInfo of allRoutes) {
    const cacheKey = getCacheKey(routeInfo.route, routeInfo.method, routeInfo.handlerCode)
    let spec: any

    // Check cache first
    if (useCache && cache.has(cacheKey)) {
      const cached = cache.get(cacheKey)!
      // Check if cache is still valid (24 hours)
      if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
        spec = cached.schema
        console.log(`Using cached schema for ${routeInfo.method} ${routeInfo.route}`)
      } else {
        cache.delete(cacheKey)
      }
    }

    // If not in cache or expired, generate new
    if (!spec) {
      // Use static analysis first
      spec = generateSwaggerFromStaticAnalysis(routeInfo)

      // If GPT is enabled and handler code exists, enhance with GPT
      if (useGpt && openai && routeInfo.handlerCode) {
        try {
          console.log(`Enhancing ${routeInfo.method} ${routeInfo.route} with GPT...`)
          const prompt = generatePrompt(routeInfo.handlerCode)
          
          // Use getValidJsonFromGPT from plugin
          const gptResult = await getValidJsonFromGPT(openai, prompt, 3, gptModel)
          
          // Merge GPT results with static analysis (GPT takes precedence)
          spec = {
            ...spec,
            ...gptResult,
            summary: spec.summary
          }

          // Cache the result
          if (useCache) {
            cache.set(cacheKey, {
              route: routeInfo.route,
              method: routeInfo.method,
              schema: spec,
              timestamp: Date.now()
            })
          }
        } catch (error) {
          console.warn(`GPT enhancement failed for ${routeInfo.route}, using static analysis only:`, error)
        }
      } else {
        // Cache static analysis result
        if (useCache) {
          cache.set(cacheKey, {
            route: routeInfo.route,
            method: routeInfo.method,
            schema: spec,
            timestamp: Date.now()
          })
        }
      }
    }

    // Use schema from decorator if available
    if (routeInfo.schema) {
      spec = {
        ...routeInfo.schema,
        summary: spec.summary
      }
    }

    swaggerPaths[routeInfo.route] = {
      ...(swaggerPaths[routeInfo.route] || {}),
      [routeInfo.method]: spec
    }
  }

  // Save cache
  if (useCache) {
    saveCache(cache, cacheDir)
  }

  return {
    openapi: '3.0.0',
    info: {
      title: 'Auto-generated Swagger',
      version: '1.0.0',
      description: useGpt 
        ? 'API documentation automatically generated using static analysis and GPT'
        : 'API documentation automatically generated using static analysis'
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
    }
  }
}
