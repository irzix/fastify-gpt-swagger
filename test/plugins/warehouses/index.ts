'use strict'

import { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';


declare module "fastify" {
    export interface FastifyInstance {
        warehousesGet: (request: FastifyRequest, reply: FastifyReply) => any;
        warehousesGetAll: (request: FastifyRequest, reply: FastifyReply) => any;
        warehousesCreate: (request: FastifyRequest, reply: FastifyReply) => any;
        warehousesDelete: (request: FastifyRequest, reply: FastifyReply) => any;
        warehousesUpdate: (request: FastifyRequest, reply: FastifyReply) => any;
    }
}

export default fp(async (fastify, opts) => {

    fastify.decorate('warehousesGet', warehousesGet);
    fastify.decorate('warehousesGetAll', warehousesGetAll);
    fastify.decorate('warehousesCreate', warehousesCreate);
    fastify.decorate('warehousesDelete', warehousesDelete);
    fastify.decorate('warehousesUpdate', warehousesUpdate);


    async function warehousesGet(request: any, reply: any) {
        return {
            status: true,
            message: 'Warehouse get successfully'
        }
    }

    async function warehousesGetAll(request: any, reply: any) {
        return {
            status: true,
            message: 'Warehouse get all successfully'
        }
    }

    async function warehousesCreate(request: any, reply: any) {
        return {
            status: true,
            message: 'Warehouse create successfully'
        }
    }

    async function warehousesDelete(request: any, reply: any) {
        return {
            status: true,
            message: 'Warehouse delete successfully'
        }
    }

    async function warehousesUpdate(request: any, reply: any) {
        return {
            status: true,
            message: 'Warehouse update successfully'
        }
    }

})