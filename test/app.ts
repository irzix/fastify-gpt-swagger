import fastify from 'fastify'
import fastifyGptSwagger from '../src/plugin'
import dotenv from 'dotenv'
import { join } from 'path'
import AutoLoad from '@fastify/autoload'

dotenv.config()

const app = fastify()

// Register the plugin
app.register(fastifyGptSwagger, {
    openaiApiKey: process.env.OPENAI_KEY || '',
    openaiEndpoint: process.env.OPENAI_ENDPOINT,
    routesDir: 'test/routes',
    pluginsDir: 'test/plugins',
    autoGenerate: false, // to enable Ai generate, set to true
    enableValidation: true,
    swaggerUiPath: '/test-docs',
    gptModel: 'gpt-4.1-nano'
})

void app.register(AutoLoad, {
    dir: join(__dirname, 'plugins'),
    options: {},
})
void app.register(AutoLoad, {
    dir: join(__dirname, 'routes'),
    options: {},
})


// Start the server
app.listen({ port: 3000 }, (err, address) => {
    if (err) {
        console.error(err)
        process.exit(1)
    }
    console.log(`Server is running at ${address}`)
}) 