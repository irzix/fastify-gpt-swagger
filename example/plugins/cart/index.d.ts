import { FastifyRequest } from 'fastify';
import { FastifyReply } from 'fastify';
declare module "fastify" {
    interface FastifyInstance {
        cartsGet: (request: FastifyRequest, reply: FastifyReply) => any;
        cartsGetAll: (request: FastifyRequest, reply: FastifyReply) => any;
    }
}
declare const _default: (fastify: import("fastify").FastifyInstance<import("fastify").RawServerDefault, import("http").IncomingMessage, import("http").ServerResponse<import("http").IncomingMessage>, import("fastify").FastifyBaseLogger, import("fastify").FastifyTypeProviderDefault>, opts: Record<never, never>) => Promise<void>;
export default _default;
//# sourceMappingURL=index.d.ts.map