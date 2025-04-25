'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
exports.default = (0, fastify_plugin_1.default)(async (fastify, opts) => {
    fastify.decorate('cartsGet', cartsGet);
    fastify.decorate('cartsGetAll', cartsGetAll);
    async function cartsGet(request, reply) {
        try {
            const _id = request.params.id;
            const user = request.query.user;
            if (!request.query.user) {
                return reply.code(400).send({
                    status: false,
                    message: 'user is required'
                });
            }
            const cart = {
                _id: _id,
                user: user,
                name: 'test',
                price: 100000
            };
            return reply.send({
                status: true,
                result: cart
            });
        }
        catch (err) {
            return reply.send({
                status: false,
                message: 'error'
            });
        }
    }
    async function cartsGetAll(request, reply) {
        try {
            const cart = {
                _id: '1',
                name: 'test',
                price: 100000
            };
            return reply.send({
                status: true,
                result: [cart]
            });
        }
        catch (err) {
            return reply.send({
                status: false,
                message: 'error'
            });
        }
    }
});
//# sourceMappingURL=index.js.map