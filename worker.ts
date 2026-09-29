/**
 * Cloudflare Worker Entry Point (Produção na Cloudflare)
 * Executa redirecionamento ultra-rápido no Edge (< 15ms), APIs REST e serve os Assets SPA com Cloudflare D1.
 */

import { Env, ExecutionContext, createD1Driver, handleAppRequest } from './src/server/workerHandler.ts';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Validação de integridade do Cloudflare D1
    if (!env.DB) {
      return new Response(
        'Erro de configuração na Cloudflare: O binding do banco de dados D1 ("DB") não foi encontrado no wrangler.jsonc.',
        {
          status: 500,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        }
      );
    }

    // Inicializa o driver nativo do Cloudflare D1
    const db = createD1Driver(env.DB);

    // Executa o processador universal de requisições
    return await handleAppRequest(request, env, db, ctx);
  }
};
