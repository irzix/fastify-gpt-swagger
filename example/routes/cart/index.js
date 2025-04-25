"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
async function default_1(fastify) {
    fastify.get('/:id', fastify.cartsGet);
    fastify.get('/', fastify.cartsGetAll);
}
//# sourceMappingURL=index.js.map