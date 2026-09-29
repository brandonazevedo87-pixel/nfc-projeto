/**
 * Testes Automatizados Específicos para o Cloudflare Worker Handler
 * Valida a execução com Web Standard Request / Response, cookies, redirects e D1.
 */

import initSqlJs from 'sql.js';
import { DatabaseDriver, initDatabase } from '../src/server/db.ts';
import { handleAppRequest, Env } from '../src/server/workerHandler.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

async function runWorkerSuite() {
  console.log('\n====================================================');
  console.log(' TESTES AUTOMATIZADOS: CLOUDFLARE WORKER WEB HANDLER');
  console.log('====================================================\n');

  const SQL = await initSqlJs();
  const rawDb = new SQL.Database();

  const db: DatabaseDriver = {
    async queryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
      const stmt = rawDb.prepare(sql);
      try {
        stmt.bind(params);
        const res: T[] = [];
        while (stmt.step()) {
          res.push(stmt.getAsObject() as unknown as T);
        }
        return res;
      } finally {
        stmt.free();
      }
    },
    async queryFirst<T = any>(sql: string, params: any[] = []): Promise<T | null> {
      const results = await this.queryAll<T>(sql, params);
      return results.length > 0 ? results[0] : null;
    },
    async run(sql: string, params: any[] = []): Promise<{ changes: number }> {
      rawDb.run(sql, params);
      return { changes: rawDb.getRowsModified() };
    },
    async exec(sql: string): Promise<void> {
      rawDb.exec(sql);
    }
  };

  await initDatabase(db);

  const env: Env = {
    ADMIN_EMAIL: 'admin@qrplacas.com',
    ADMIN_INITIAL_PASSWORD: 'admin123456',
    SESSION_SECRET: 'test-cf-secret-xyz'
  };

  // 1. Teste de Redirecionamento Público no Worker (/q/CFTEST)
  console.log('🔹 1. Testando Redirecionamento Público no Worker...');
  await db.run('INSERT INTO customers (id, name, phone, email, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
    'cust-cf-1', 'Cliente Teste Worker', '11999999999', 'worker@teste.com', 'ativo', new Date().toISOString(), new Date().toISOString()
  ]);
  await db.run('INSERT INTO qr_codes (id, code, customer_id, title, destination_url, status, scan_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)', [
    'qr-cf-1', 'CFTEST', 'cust-cf-1', 'Placa Cloudflare', 'https://instagram.com/cliente_cf', 'ativo', new Date().toISOString(), new Date().toISOString()
  ]);

  const req1 = new Request('https://meudominio.com/q/CFTEST');
  const res1 = await handleAppRequest(req1, env, db);

  assert(res1.status === 302, 'Status do redirecionamento público deve ser 302');
  assert(res1.headers.get('Location') === 'https://instagram.com/cliente_cf', 'Location header aponta para o destino no D1');
  assert(res1.headers.get('Cache-Control')?.includes('no-store') === true, 'Cache-Control impede cache de destino');

  // Verificar se o contador de escaneamentos foi incrementado
  const qrRow = await db.queryFirst<{ scan_count: number }>('SELECT scan_count FROM qr_codes WHERE code = ?', ['CFTEST']);
  assert(qrRow?.scan_count === 1, 'Contador de scan incrementado no D1');

  // 2. Teste de Blindagem contra override por query param
  console.log('🔹 2. Testando Blindagem contra Query Params...');
  const req2 = new Request('https://meudominio.com/q/CFTEST?url=https://malicious.com&redirect=https://evil.com');
  const res2 = await handleAppRequest(req2, env, db);
  assert(res2.headers.get('Location') === 'https://instagram.com/cliente_cf', 'Query param ignorado, destino permanece do banco');

  // 3. Teste de Código Inexistente (404)
  console.log('🔹 3. Testando QR Code Inexistente...');
  const req3 = new Request('https://meudominio.com/q/NAOEXISTE');
  const res3 = await handleAppRequest(req3, env, db);
  assert(res3.status === 404, 'Código inexistente retorna HTTP 404');
  const text3 = await res3.text();
  assert(text3.toLowerCase().includes('qr code não encontrado'), 'Página pública de 404 exibida amigavelmente');

  // 4. Teste de QR Code Desativado (403)
  console.log('🔹 4. Testando QR Code Desativado...');
  await db.run('UPDATE qr_codes SET status = ? WHERE code = ?', ['desativado', 'CFTEST']);
  const req4 = new Request('https://meudominio.com/q/CFTEST');
  const res4 = await handleAppRequest(req4, env, db);
  assert(res4.status === 403, 'Código desativado retorna HTTP 403');
  const text4 = await res4.text();
  assert(text4.includes('Temporariamente Indisponível'), 'Página pública de indisponibilidade exibida');

  // 5. Teste de Login de Administrador no Worker
  console.log('🔹 5. Testando Autenticação Administrativa no Worker...');
  const reqLogin = new Request('https://meudominio.com/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@qrplacas.com', password: 'admin123456' })
  });
  const resLogin = await handleAppRequest(reqLogin, env, db);
  assert(resLogin.status === 200, 'Login bem-sucedido retorna 200');
  const cookie = resLogin.headers.get('Set-Cookie');
  assert(!!cookie && cookie.includes('qr_session='), 'Set-Cookie gerado com qr_session');
  assert(Boolean(cookie && cookie.includes('HttpOnly')), 'Cookie possui flag HttpOnly');
  assert(Boolean(cookie && cookie.includes('SameSite=Lax')), 'Cookie possui flag SameSite=Lax');

  // Extrair token do cookie
  const tokenMatch = cookie?.match(/qr_session=([^;]+)/);
  const sessionCookieHeader = `qr_session=${tokenMatch ? tokenMatch[1] : ''}`;

  // 6. Teste de Rota Protegida com Sessão Válida
  console.log('🔹 6. Testando Acesso a APIs Protegidas...');
  const reqMe = new Request('https://meudominio.com/api/admin/me', {
    headers: { 'Cookie': sessionCookieHeader }
  });
  const resMe = await handleAppRequest(reqMe, env, db);
  assert(resMe.status === 200, '/api/admin/me retorna 200 com cookie autenticado');
  const meData = await resMe.json() as any;
  assert(meData.user?.email === 'admin@qrplacas.com', 'Usuário retornado corresponde ao admin autenticado');

  // 7. Teste de Bloqueio sem Autenticação
  console.log('🔹 7. Testando Bloqueio de Acesso Não Autenticado...');
  const reqUnauth = new Request('https://meudominio.com/api/admin/dashboard', {
    headers: {}
  });
  const resUnauth = await handleAppRequest(reqUnauth, env, db);
  assert(resUnauth.status === 401, 'Requisição sem sessão bloqueada com 401');

  // 8. Teste de Alteração de Destino com Registro no Histórico D1
  console.log('🔹 8. Testando Alteração de Destino via API do Worker...');
  // Reativar qr-cf-1
  await db.run('UPDATE qr_codes SET status = ? WHERE id = ?', ['ativo', 'qr-cf-1']);
  const reqDest = new Request('https://meudominio.com/api/admin/qr-codes/qr-cf-1/destination', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookieHeader
    },
    body: JSON.stringify({
      new_destination_url: 'https://wa.me/5511999999999',
      reason: 'Cliente solicitou troca para WhatsApp'
    })
  });
  const resDest = await handleAppRequest(reqDest, env, db);
  assert(resDest.status === 200, 'Atualização de destino retorna 200');

  // Checar histórico
  const hist = await db.queryAll<any>('SELECT * FROM qr_code_history WHERE qr_code_id = ? ORDER BY changed_at DESC', ['qr-cf-1']);
  assert(hist.length === 1, 'Registro de histórico gravado com sucesso no D1');
  assert(hist[0].new_destination_url === 'https://wa.me/5511999999999', 'Novo destino registrado no histórico');
  assert(hist[0].old_destination_url === 'https://instagram.com/cliente_cf', 'Destino anterior registrado no histórico');
  assert(hist[0].reason === 'Cliente solicitou troca para WhatsApp', 'Motivo registrado no histórico');

  // 9. Verificar se o QR Code público agora redireciona para o WhatsApp imediatamente
  const reqUpdated = new Request('https://meudominio.com/q/CFTEST');
  const resUpdated = await handleAppRequest(reqUpdated, env, db);
  assert(resUpdated.headers.get('Location') === 'https://wa.me/5511999999999', 'Redirecionamento público atualizado instantaneamente para WhatsApp');

  console.log('\n====================================================');
  console.log(` RESULTADO WORKER: ${passed} aprovados / ${failed} reprovados`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runWorkerSuite().catch(err => {
  console.error('Erro na execução dos testes do worker:', err);
  process.exit(1);
});
