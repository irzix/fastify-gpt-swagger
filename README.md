# Fastify GPT Swagger

A Fastify plugin for automatically generating Swagger documentation using GPT

## Features

- Automatic Swagger documentation generation from code
- Support for plugins and routes
- Swagger UI interface
- Support for different GPT models
- JSON error retry mechanism
- Automatic parameter validation

## Installation

```bash
npm install fastify-gpt-swagger
```

## Usage

```typescript
import fastify from 'fastify'
import fastifyGptSwagger from 'fastify-gpt-swagger'

const app = fastify()

await app.register(fastifyGptSwagger, {
  openaiApiKey: 'your-api-key',
  routesDir: './routes', // Path to routes directory
  pluginsDir: './src/plugins', // Path to plugins directory
  gptModel: 'gpt-4', // GPT model to use
  autoGenerate: true, // Auto-generate documentation
  swaggerUiPath: '/docs', // Swagger UI path
  enableValidation: true, // Enable validation
  openaiEndpoint: 'https://api.openai.com/v1' // OpenAI API endpoint
})

// Start server
await app.listen({ port: 3000 })
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `openaiApiKey` | `string` | - | OpenAI API key (required) |
| `routesDir` | `string` | `./routes` | Path to routes directory |
| `pluginsDir` | `string` | `./src/plugins` | Path to plugins directory |
| `gptModel` | `string` | `gpt-4` | GPT model to use |
| `autoGenerate` | `boolean` | `false` | Auto-generate documentation |
| `swaggerUiPath` | `string` | `/docs` | Swagger UI path |
| `enableValidation` | `boolean` | `true` | Enable validation |
| `openaiEndpoint` | `string` | - | OpenAI API endpoint |

## Example

```typescript
// routes/user.ts
export default async function (fastify) {
  fastify.get('/user/:id', async (request, reply) => {
    const { id } = request.params
    return { id, name: 'John Doe' }
  })
}
```

## License

MIT 