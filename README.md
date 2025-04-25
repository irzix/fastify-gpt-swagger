# Fastify GPT Swagger

A Fastify plugin that automatically generates Swagger documentation and applies automatic validation using OpenAI GPT.

## Features

- Automatic Swagger documentation generation from Fastify routes
- AI-powered code analysis and schema generation
- Automatic request validation based on generated schemas
- TypeScript support
- Automatic or manual documentation generation
- Swagger UI interface
- Detailed and helpful error messages

## Installation

```bash
npm install fastify-gpt-swagger
```

## Usage

```typescript
import fastify from 'fastify'
import fastifyGptSwagger from 'fastify-gpt-swagger'

const app = fastify()

// Register the plugin
app.register(fastifyGptSwagger, {
  openaiApiKey: 'your-openai-api-key',
  openaiEndpoint: 'https://your-custom-endpoint.com/v1',
  routesDir: './routes', // Path to routes directory (optional)
  autoGenerate: true, // Auto-generate documentation (optional)
  enableValidation: true // Enable automatic validation (optional)
})

// Your routes
app.post('/users', async (request, reply) => {
  const { name, age } = request.body
  return { success: true }
})

// Access documentation
// GET /docs/json - Get documentation as JSON
// GET /docs - View documentation in Swagger UI

app.listen({ port: 3000 })
```

## Configuration

| Option | Type | Default | Description |
|-------|-----|---------|----------|
| openaiApiKey | string | - | OpenAI API key (required) |
| routesDir | string | './routes' | Path to routes directory |
| autoGenerate | boolean | false | Auto-generate documentation at runtime |
| swaggerUiPath | string | '/docs' | Path to Swagger UI |
| enableValidation | boolean | true | Enable automatic validation |
| openaiEndpoint | string | undefined | Custom OpenAI API endpoint URL |

## Manual Documentation Generation

```typescript
// Manual documentation generation
const swaggerJson = await app.generateSwaggerFromRoutes()
```

## Automatic Validation

This plugin automatically detects and applies validation rules for each route. For example:

```typescript
// Route with automatic validation
app.post('/users', async (request, reply) => {
  const { name, age } = request.body
  return { success: true }
})

// Invalid request:
// POST /users
// { "name": "John" } // Error: age field is required
// Response:
// {
//   "error": "Validation failed",
//   "details": [
//     "Body validation failed: must have required property 'age'"
//   ]
// }

// Valid request:
// POST /users
// { "name": "John", "age": 25 } // Success
```

## How Validation Works

1. The plugin analyzes route code
2. Uses GPT to generate schemas and validation rules
3. Creates a dedicated validator for each route
4. Validates requests before execution
5. Returns 400 error with details if validation fails

## License

MIT 