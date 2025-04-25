import { FastifyPluginAsync } from 'fastify'

export interface PluginOptions {
    openaiApiKey: string
    routesDir: string
    pluginsDir: string
    autoGenerate?: boolean
    swaggerUiPath?: string
    enableValidation?: boolean
    openaiEndpoint?: string
}

export type FastifyGptSwagger = FastifyPluginAsync<PluginOptions>

declare const fastifyGptSwagger: FastifyGptSwagger
export default fastifyGptSwagger 