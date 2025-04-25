import { FastifyPluginCallback } from 'fastify'

export interface PluginOptions {
  openaiApiKey: string
  routesDir?: string
  autoGenerate?: boolean
  swaggerUiPath?: string
  enableValidation?: boolean
  openaiEndpoint?: string
}

declare module 'fastify' {
  interface FastifyInstance {
    generateSwaggerFromRoutes(): Promise<any>
  }
}

export type FastifyGptSwagger = FastifyPluginCallback<PluginOptions>

declare const fastifyGptSwagger: FastifyGptSwagger
export default fastifyGptSwagger 