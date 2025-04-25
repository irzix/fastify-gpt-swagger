import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.get('/:id', fastify.cartsGet);
  fastify.get('/', fastify.cartsGetAll);
}
