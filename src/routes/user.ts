import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.get<{ Querystring: { id: string } }>('/user', async (req, reply) => {
    const user = { id: req.query.id, name: 'Ali' }
    return { user }
  })
}
