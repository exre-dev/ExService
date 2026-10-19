import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { registerDocsTransport } from './transport.js'

/**
 * Docs API 传输层。
 *
 * 依赖 `http-foundation`：统一错误出口必须先安装，Docs 才能在注册路由时捕获它，
 * 把解析期的 413/415 分类后委托出去，而不是另建第二份全局 handler。
 */
const plugin = async (app: FastifyInstance): Promise<void> => {
  app.getDecorator('docsServices')
  app.getDecorator('authServices')
  // 统一出口接收任意异常；这里只保存引用，不注册第二份全局 handler。
  const unifiedErrorHandler = app.errorHandler as unknown as (
    error: unknown,
    request: FastifyRequest,
    reply: FastifyReply,
  ) => void
  registerDocsTransport(app, { unifiedErrorHandler })
}

export default fp(plugin, {
  name: 'api-docs',
  fastify: '5.x',
  dependencies: ['http-foundation', 'business-docs', 'api-auth'],
  decorators: { fastify: ['docsServices', 'authServices'], request: ['authSession'] },
})
