import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.post('/', fastify.warehousesCreate);
    fastify.delete('/:id', fastify.warehousesDelete);
    fastify.get('/:id', fastify.warehousesGet);
    fastify.post('/:id', fastify.warehousesUpdate);
    fastify.get('/', fastify.warehousesGetAll);
}