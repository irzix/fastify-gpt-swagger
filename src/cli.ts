#!/usr/bin/env node

/**
 * CLI Tool for generating Swagger documentation from Fastify routes
 * This tool uses static analysis first, then optionally uses GPT for enhancement
 */

import { Command } from 'commander'
import * as fs from 'fs'
import * as path from 'path'
import { scanRoutesAndGenerateSwagger } from './analyzer'
import { saveSwaggerJson } from './plugin'

const program = new Command()

program
  .name('fastify-swagger-gen')
  .description('Generate Swagger documentation from Fastify routes')
  .version('2.0.0')

program
  .option('-r, --routes <dir>', 'Routes directory', './routes')
  .option('-p, --plugins <dir>', 'Plugins directory', './plugins')
  .option('-o, --output <file>', 'Output file', './swagger/swagger.json')
  .option('--use-gpt', 'Use GPT for enhancement (requires OPENAI_API_KEY)')
  .option('--gpt-model <model>', 'GPT model to use', 'gpt-4')
  .option('--openai-endpoint <url>', 'OpenAI API endpoint')
  .option('--cache', 'Use cache for GPT results', true)
  .option('--cache-dir <dir>', 'Cache directory', './.swagger-cache')

program.parse(process.argv)

const options = program.opts()

async function main() {
  console.log('Fastify Swagger Generator')
  console.log('========================\n')

  const openaiApiKey = process.env.OPENAI_API_KEY

  if (options.useGpt && !openaiApiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required when using --use-gpt')
    process.exit(1)
  }

  if (!fs.existsSync(options.routes)) {
    console.error(`Error: Routes directory not found: ${options.routes}`)
    process.exit(1)
  }

  try {
    const result = await scanRoutesAndGenerateSwagger({
      routesDir: options.routes,
      pluginsDir: options.plugins,
      useGpt: options.useGpt || false,
      gptModel: options.gptModel,
      openaiApiKey: openaiApiKey || '',
      openaiEndpoint: options.openaiEndpoint,
      useCache: options.cache,
      cacheDir: options.cacheDir
    })

    const outputDir = path.dirname(options.output)
    await saveSwaggerJson(result, outputDir)

    console.log(`\nSwagger documentation generated successfully`)
    console.log(`Output: ${options.output}`)
    console.log(`Total endpoints: ${Object.keys(result.paths || {}).length}`)
  } catch (error) {
    console.error('Error generating Swagger documentation:', error)
    process.exit(1)
  }
}

main()
