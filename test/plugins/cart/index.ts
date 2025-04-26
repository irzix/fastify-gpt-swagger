'use strict'

import { FastifyRequest } from 'fastify';
import { FastifyReply } from 'fastify';
import fp from 'fastify-plugin';


declare module "fastify" {
    export interface FastifyInstance {
        cartsGet: (request: FastifyRequest, reply: FastifyReply) => any;
        cartsGetAll: (request: FastifyRequest, reply: FastifyReply) => any;
    }
}

export default fp(async (fastify, opts) => {

    fastify.decorate('cartsGet', cartsGetFunction);
    fastify.decorate('cartsGetAll', cartsGetAll);

    async function cartsGetFunction(request: any, reply: any) {
        try {

            if (!request.headers.authorization) {
                return {
                    status: false,
                    message: 'Unauthorized'
                };
            }


            const _id = request.params.id
            const user = request.query.user

            if (!request.query.user) {
                return reply.status(400).send({
                    status: false,
                    message: 'user is required'
                });
            }


            const cart = {
                _id: _id,
                user: user,
                name: 'test',
                price: 100000
            }
            return reply.send({
                status: true,
                result: cart
            });
        } catch (err) {
            return reply.send({
                status: false,
                message: 'error'
            });
        }

    }

    async function cartsGetAll(request: any, reply: any) {
        try {
            const cart = {
                _id: '1',
                name: 'test',
                price: 100000
            }
            return reply.send({
                status: true,
                result: [cart]
            });
        } catch (err) {
            return reply.send({
                status: false,
                message: 'error'
            });
        }

    }

})