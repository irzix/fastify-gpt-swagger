# Fastify GPT Swagger

[![npm version](https://img.shields.io/npm/v/fastify-gpt-swagger.svg)](https://www.npmjs.com/package/fastify-gpt-swagger)
[![license](https://img.shields.io/npm/l/fastify-gpt-swagger.svg)](LICENSE)
[![downloads](https://img.shields.io/npm/dm/fastify-gpt-swagger.svg)](https://www.npmjs.com/package/fastify-gpt-swagger)
[![Fastify Ecosystem](https://img.shields.io/badge/fastify-ecosystem-brightgreen.svg)](https://www.fastify.io/ecosystem/)

A Fastify tool for automatically generating Swagger documentation using static analysis (TypeScript AST) with optional GPT enhancement.

## Features

- **Static Analysis First**: Uses TypeScript Compiler API for reliable, fast analysis
- **Optional GPT Enhancement**: Improve documentation with AI (optional, not required)
- **Smart Caching**: Cache GPT results to reduce costs
- **CLI Tool**: Standalone CLI tool for generating documentation
- **Auto-detection**: Automatically detects routes, parameters, query params, body params
- **Auth Detection**: Automatically detects authentication requirements
- **Fast**: No API calls needed in static analysis mode
- **Cost-effective**: GPT is optional, not required

## Why This Approach?

The original version relied entirely on GPT, which had issues:
- Inconsistent results
- High API costs
- Slow performance
- Required API key

The new approach:
- Static analysis provides reliable, consistent results
- GPT is optional for enhancement only
- Much faster (no API calls in normal mode)
- Works without API key
- Cache mechanism reduces costs

## Installation

```bash
npm install fastify-gpt-swagger
# or globally
npm install -g fastify-gpt-swagger
```

## Usage

Generate Swagger documentation using static analysis (no API key needed):

```bash
# Basic usage (static analysis only - free and fast)
fastify-swagger-gen \
  --routes ./routes \
  --plugins ./plugins \
  --output ./swagger/swagger.json
```

With GPT enhancement (optional):

```bash
export OPENAI_API_KEY=your-key-here

fastify-swagger-gen \
  --routes ./routes \
  --plugins ./plugins \
  --output ./swagger/swagger.json \
  --use-gpt \
  --gpt-model gpt-4 \
  --cache
```

## CLI Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-r, --routes <dir>` | `string` | `./routes` | Path to routes directory |
| `-p, --plugins <dir>` | `string` | `./plugins` | Path to plugins directory |
| `-o, --output <file>` | `string` | `./swagger/swagger.json` | Output file path |
| `--use-gpt` | `boolean` | `false` | Enable GPT enhancement (requires OPENAI_API_KEY) |
| `--gpt-model <model>` | `string` | `gpt-4` | GPT model to use |
| `--openai-endpoint <url>` | `string` | - | OpenAI API endpoint |
| `--cache` | `boolean` | `true` | Enable caching |
| `--cache-dir <dir>` | `string` | `./.swagger-cache` | Cache directory |

## How It Works

1. **Static Analysis**: Uses TypeScript Compiler API to analyze your code
   - Extracts route definitions
   - Detects path parameters (`:id`, `{id}`)
   - Finds query parameters (`request.query.*`)
   - Identifies body parameters (`request.body.*`)
   - Detects authentication requirements
   - Infers response types

2. **GPT Enhancement** (Optional): If enabled, GPT improves the documentation
   - Adds better descriptions
   - Enhances response schemas
   - Improves parameter descriptions
   - Results are cached for 24 hours

3. **Output**: Generates OpenAPI 3.0 Swagger JSON file


## Examples

### Example Route

```typescript
// routes/cart/index.ts
import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.get('/:id', fastify.cartsGet)
  fastify.get('/', fastify.cartsGetAll)
}
```

### Generated Swagger

The tool automatically generates:

```json
{
  "paths": {
    "/cart/:id": {
      "get": {
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": { "type": "string" }
          },
          {
            "name": "user",
            "in": "query",
            "schema": { "type": "string" }
          }
        ],
        "responses": {
          "200": { "description": "Successful response" },
          "401": { "description": "Unauthorized" }
        },
        "security": [{ "bearerAuth": [] }]
      }
    }
  }
}
```

## Integration with Fastify

After generating the Swagger documentation, use it with `@fastify/swagger`:

```bash
# Generate documentation
fastify-swagger-gen --routes ./routes --plugins ./plugins

# Use in your Fastify app
```

```typescript
import fastify from 'fastify'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'

const app = fastify()

await app.register(swagger, {
  mode: 'static',
  specification: {
    path: './swagger/swagger.json'
  }
})

await app.register(swaggerUi, {
  routePrefix: '/docs'
})

await app.listen({ port: 3000 })
```

## Performance

- **Static Analysis Only**: ~1-2 seconds for 50 routes
- **With GPT**: ~5-10 seconds per route (first time), then cached
- **Cache Hit**: Instant (no API call)

## Contributing

Contributions are welcome!  
Feel free to open an issue or submit a pull request.

Please make sure to run tests before submitting changes.

## Related

- [Fastify](https://fastify.io/)
- [OpenAI API](https://platform.openai.com/)
- [TypeScript Compiler API](https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API)

## License

MIT

## Changelog

### v2.0.0
- Added static analysis using TypeScript Compiler API
- Added CLI tool
- Made GPT optional (not required)
- Added caching mechanism
- Much faster performance
- Reduced costs (GPT is optional)
