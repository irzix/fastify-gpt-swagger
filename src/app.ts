import fastify from 'fastify'
import path from 'path'
import fastifyGptSwagger from './plugin'
import userRoutes from './routes/user'

const app = fastify()

app.register(fastifyGptSwagger, {
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  routesDir: path.join(__dirname, 'routes'),
  autoGenerate: true
})

app.register(userRoutes)

app.listen({ port: 3000 }, err => {
  if (err) console.error(err)
  else console.log('🚀 Server ready on http://localhost:3000')
})
