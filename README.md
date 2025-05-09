# Fastify GPT Swagger

[![npm version](https://img.shields.io/npm/v/fastify-gpt-swagger.svg)](https://www.npmjs.com/package/fastify-gpt-swagger)
[![license](https://img.shields.io/npm/l/fastify-gpt-swagger.svg)](LICENSE)
[![downloads](https://img.shields.io/npm/dm/fastify-gpt-swagger.svg)](https://www.npmjs.com/package/fastify-gpt-swagger)
[![Fastify Ecosystem](https://img.shields.io/badge/fastify-ecosystem-brightgreen.svg)](https://www.fastify.io/ecosystem/)


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
  pluginsDir: './plugins', // Path to plugins directory
  gptModel: 'gpt-4.1-nano', // GPT model to use (optional)
  autoGenerate: true, // Auto-generate documentation
  swaggerUiPath: '/docs', // Swagger UI path (optional)
  enableValidation: true, // Enable validation (optional)
  openaiEndpoint: 'https://api.openai.com/v1' // OpenAI API endpoint (optional)
})

// Start server
await app.listen({ port: 3000 })
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `routesDir` | `string` | `./routes` | Path to routes directory |
| `pluginsDir` | `string` | `./src/plugins` | Path to plugins directory |
| `autoGenerate` | `boolean` | `false` | Auto-generate documentation |
| `swaggerUiPath` | `string` | `/fastify-docs` | Swagger UI path |
| `enableValidation` | `boolean` | `true` | Enable validation |
| `openaiApiKey` | `string` | - | OpenAI API key (required) |
| `openaiEndpoint` | `string` | - | OpenAI API endpoint |
| `gptModel` | `string` | `gpt-4` | GPT model to use |


## Contributing

Contributions are welcome!  
Feel free to open an issue or submit a pull request.

Please make sure to run tests before submitting changes.

## Related

- [Fastify](https://fastify.io/)
- [OpenAI API](https://platform.openai.com/)

## License

MIT 