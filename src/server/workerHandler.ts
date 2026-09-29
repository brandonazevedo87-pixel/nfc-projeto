/**
 * Handler Universal para Cloudflare Workers & Runtime Edge
 * Implementado 100% com APIs Web Padrão (Fetch API, Request, Response, Headers)
 * Compatível nativamente com Cloudflare Workers e Cloudflare D1.
 */

import {
  DatabaseDriver,
  QRCodeItem,
  QRCodeHistory,
  Customer,
  User,
  Setting,
  isValidUrl,
  generateUniquePublicCode
} from './db.ts';
import {
  verifyPassword,
  hashPassword,
  createSessionToken,
  verifySessionToken,
  setRuntimeSecret,
  SessionPayload
} from './crypto.ts';
import { renderNotFoundPage, renderDeactivatedPage } from './publicPages.ts';

export interface Env {
  DB?: any; // Cloudflare D1 Database binding
  ASSETS?: any; // Cloudflare Static Assets binding para o frontend Vite
  SESSION_SECRET?: string;
  APP_URL?: string;
  ADMIN_EMAIL?: string;
  ADMIN_INITIAL_PASSWORD?: string;
  [key: string]: any;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException?(): void;
}

/**
 * Cria o driver de banco de dados compatível com a API Cloudflare D1
 */
export function createD1Driver(d1: any): DatabaseDriver {
  return {
    async queryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
      const stmt = d1.prepare(sql).bind(...params);
      const res = await stmt.all();
      return (res.results || []) as T[];
    },
    async queryFirst<T = any>(sql: string, params: any[] = []): Promise<T | null> {
      const stmt = d1.prepare(sql).bind(...params);
      const res = await stmt.first();
      return (res || null) as T | null;
    },
    async run(sql: string, params: any[] = []): Promise<{ changes: number }> {
      const stmt = d1.prepare(sql).bind(...params);
      const res = await stmt.run();
      return { changes: res.meta?.changes || 0 };
    },
    async exec(sql: string): Promise<void> {
      await d1.exec(sql);
    },
    async exportData(): Promise<Uint8Array> {
      return new Uint8Array();
    }
  };
}

let isDbBootstrapped = false;

/**
 * Garante que as tabelas essenciais e o administrador inicial existam no D1
 */
export async function bootstrapD1Database(db: DatabaseDriver, env: Env): Promise<void> {
  if (isDbBootstrapped) return;

  try {
    // Garante criação das tabelas no D1 se ainda não foram migradas
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'ativo',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS qr_codes (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        customer_id TEXT NOT NULL,
        title TEXT,
        destination_url TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ativo',
        scan_count INTEGER NOT NULL DEFAULT 0,
        last_scanned_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
      );

      CREATE TABLE IF NOT EXISTS qr_code_history (
        id TEXT PRIMARY KEY,
        qr_code_id TEXT NOT NULL,
        old_destination_url TEXT NOT NULL,
        new_destination_url TEXT NOT NULL,
        changed_by TEXT NOT NULL,
        changed_at TEXT NOT NULL,
        reason TEXT,
        FOREIGN KEY (qr_code_id) REFERENCES qr_codes(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_qr_codes_code ON qr_codes(code);
      CREATE INDEX IF NOT EXISTS idx_qr_codes_customer_id ON qr_codes(customer_id);
      CREATE INDEX IF NOT EXISTS idx_qr_codes_status ON qr_codes(status);
      CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
      CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
      CREATE INDEX IF NOT EXISTS idx_qr_history_qr_id ON qr_code_history(qr_code_id);
    `);

    // Verifica se administrador existe no D1
    const adminUser = await db.queryFirst<User>('SELECT id FROM users LIMIT 1');
    if (!adminUser) {
      const email = (env.ADMIN_EMAIL || 'admin@qrplacas.com').trim().toLowerCase();
      const rawPassword = env.ADMIN_INITIAL_PASSWORD || 'admin123456';
      const hash = await hashPassword(rawPassword);
      const now = new Date().toISOString();

      await db.run(
        `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          'usr_' + crypto.randomUUID().slice(0, 8),
          'Administrador QR Placas',
          email,
          hash,
          'superadmin',
          now,
          now
        ]
      );

      // Configuração inicial de domínio
      if (env.APP_URL) {
        await db.run(
          `INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`,
          ['custom_domain', env.APP_URL.trim().replace(/\/+$/, ''), now]
        );
      }

      console.log(`[Cloudflare D1] Administrador inicial provisionado: ${email}`);
    }

    isDbBootstrapped = true;
  } catch (err) {
    console.error('[Cloudflare D1] Erro na inicialização do banco:', err);
  }
}

/**
 * Função utilitária para respostas JSON com cabeçalhos CORS
 */
function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-access-token',
    }
  });
}

/**
 * Roteador Principal para Cloudflare Workers
 */
export async function handleAppRequest(
  request: Request,
  env: Env,
  db: DatabaseDriver,
  ctx?: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method.toUpperCase();

  // Injeta segredo de sessão da Cloudflare se configurado nos secrets
  if (env.SESSION_SECRET) {
    setRuntimeSecret(env.SESSION_SECRET);
  }

  // CORS Preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-access-token',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  // Garante inicialização do D1 na primeira requisição
  await bootstrapD1Database(db, env);

  // ==========================================
  // 1. ÁREA PÚBLICA: REDIRECIONAMENTO /q/:code
  // ==========================================
  if (pathname.startsWith('/q/')) {
    const code = pathname.substring(3).trim().toUpperCase();
    if (!code) {
      return new Response('Código de placa inválido', { status: 400 });
    }

    const qrCode = await db.queryFirst<QRCodeItem>(
      'SELECT * FROM qr_codes WHERE UPPER(code) = ?',
      [code]
    );

    const baseUrl = `${url.protocol}//${url.host}`;

    // 1. QR Code inexistente (404)
    if (!qrCode) {
      return new Response(renderNotFoundPage(code, baseUrl), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // 2. QR Code desativado / pausado (403)
    if (qrCode.status !== 'ativo') {
      return new Response(renderDeactivatedPage(code, baseUrl), {
        status: 403,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // 3. Incremento de escaneamentos em segundo plano (não bloqueia redirecionamento)
    const now = new Date().toISOString();
    const updatePromise = db.run(
      'UPDATE qr_codes SET scan_count = scan_count + 1, last_scanned_at = ? WHERE id = ?',
      [now, qrCode.id]
    ).catch(e => console.error('Erro ao registrar scan:', e));

    if (ctx?.waitUntil) {
      ctx.waitUntil(updatePromise);
    }

    // 4. Redirecionamento HTTP 302 direto para a URL do banco
    return new Response(null, {
      status: 302,
      headers: {
        'Location': qrCode.destination_url,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  }

  // ==========================================
  // 2. ROTAS PÚBLICAS DE API
  // ==========================================
  if (pathname.startsWith('/api/public/qr/')) {
    const code = pathname.substring('/api/public/qr/'.length).trim().toUpperCase();
    const qr = await db.queryFirst<QRCodeItem>(
      'SELECT id, code, status, title FROM qr_codes WHERE UPPER(code) = ?',
      [code]
    );
    if (!qr) {
      return json({ exists: false, message: 'QR Code não encontrado.' }, 404);
    }
    return json({
      exists: true,
      code: qr.code,
      status: qr.status,
      title: qr.title || 'Placa Dinâmica'
    });
  }

  if (pathname === '/api/public/config' && method === 'GET') {
    const domainSetting = await db.queryFirst<Setting>(
      'SELECT value FROM settings WHERE key = ?',
      ['custom_domain']
    );
    const origin = `${url.protocol}//${url.host}`;
    return json({
      baseUrl: (domainSetting?.value || '').trim() || origin,
      appName: 'QR Placas - Gerenciador de QR Codes Dinâmicos'
    });
  }

  // ==========================================
  // 3. AUTENTICAÇÃO ADMINISTRATIVA
  // ==========================================
  if ((pathname === '/api/admin/auth/login' || pathname === '/api/admin/login') && method === 'POST') {
    try {
      const body: any = await request.json().catch(() => ({}));
      const email = (body.email || '').trim().toLowerCase();
      const password = body.password || '';

      if (!email || !password) {
        return json({ error: 'E-mail e senha são obrigatórios.' }, 400);
      }

      const user = await db.queryFirst<User>('SELECT * FROM users WHERE email = ?', [email]);
      if (!user) {
        return json({ error: 'Credenciais de acesso incorretas.' }, 401);
      }

      const isPasswordValid = await verifyPassword(password, user.password_hash);
      if (!isPasswordValid) {
        return json({ error: 'Credenciais de acesso incorretas.' }, 401);
      }

      const token = await createSessionToken({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      });

      const responseHeaders = new Headers({
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': `qr_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-access-token',
      });

      return new Response(JSON.stringify({
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }), {
        status: 200,
        headers: responseHeaders
      });
    } catch (err) {
      console.error('Erro no login:', err);
      return json({ error: 'Falha durante o login.' }, 500);
    }
  }

  if ((pathname === '/api/admin/auth/logout' || pathname === '/api/admin/logout') && method === 'POST') {
    return new Response(JSON.stringify({ success: true, message: 'Sessão encerrada com sucesso.' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': 'qr_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // Helper de Verificação de Autenticação para Rotas Privadas (Headers ou Cookies)
  const getAuthUser = async (): Promise<SessionPayload | null> => {
    let token: string | null = null;

    const authHeader = request.headers.get('Authorization') || request.headers.get('x-access-token');
    if (authHeader) {
      token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    } else {
      const cookieHeader = request.headers.get('Cookie') || '';
      const match = cookieHeader.match(/(?:^|;\s*)qr_session=([^;]+)/);
      if (match) {
        token = match[1];
      }
    }

    if (!token) return null;
    return await verifySessionToken(token);
  };

  // ==========================================
  // 4. ROTAS PROTEGIDAS /api/admin/*
  // ==========================================
  if (pathname.startsWith('/api/admin/')) {
    const authUser = await getAuthUser();
    if (!authUser) {
      return json({ error: 'Acesso não autorizado. Efetue login novamente.' }, 401);
    }

    // Perfil do Usuário
    if ((pathname === '/api/admin/auth/me' || pathname === '/api/admin/me') && method === 'GET') {
      const user = await db.queryFirst<User>(
        'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
        [authUser.userId]
      );
      if (!user) return json({ error: 'Usuário não encontrado.' }, 404);
      return json({ user });
    }

    // Troca de Senha
    if (pathname === '/api/admin/auth/password' && method === 'PUT') {
      const body: any = await request.json().catch(() => ({}));
      const { currentPassword, newPassword } = body;

      if (!currentPassword || !newPassword || newPassword.length < 6) {
        return json({ error: 'A nova senha deve possuir pelo menos 6 caracteres.' }, 400);
      }

      const user = await db.queryFirst<User>('SELECT * FROM users WHERE id = ?', [authUser.userId]);
      if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
        return json({ error: 'Senha atual incorreta.' }, 400);
      }

      const newHash = await hashPassword(newPassword);
      const now = new Date().toISOString();
      await db.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [newHash, now, user.id]);

      return json({ success: true, message: 'Senha atualizada com sucesso.' });
    }

    // Dashboard
    if (pathname === '/api/admin/dashboard' && method === 'GET') {
      const cCount = await db.queryFirst<{ count: number }>('SELECT COUNT(*) as count FROM customers WHERE status != "arquivado"');
      const qTotal = await db.queryFirst<{ count: number }>('SELECT COUNT(*) as count FROM qr_codes');
      const qActive = await db.queryFirst<{ count: number }>('SELECT COUNT(*) as count FROM qr_codes WHERE status = "ativo"');
      const qInactive = await db.queryFirst<{ count: number }>('SELECT COUNT(*) as count FROM qr_codes WHERE status = "desativado"');
      const sSum = await db.queryFirst<{ sum: number }>('SELECT SUM(scan_count) as sum FROM qr_codes');

      const recentChanges = await db.queryAll<any>(`
        SELECT
          h.*,
          q.code as qr_code,
          q.title as qr_title,
          c.name as customer_name
        FROM qr_code_history h
        JOIN qr_codes q ON q.id = h.qr_code_id
        LEFT JOIN customers c ON c.id = q.customer_id
        ORDER BY h.changed_at DESC
        LIMIT 6
      `);

      const recentCustomers = await db.queryAll<Customer>(`
        SELECT
          c.*,
          (SELECT COUNT(*) FROM qr_codes WHERE customer_id = c.id) as qr_code_count
        FROM customers c
        WHERE c.status != 'arquivado'
        ORDER BY c.created_at DESC
        LIMIT 5
      `);

      const recentQRCodes = await db.queryAll<any>(`
        SELECT
          q.*,
          c.name as customer_name
        FROM qr_codes q
        LEFT JOIN customers c ON c.id = q.customer_id
        ORDER BY q.created_at DESC
        LIMIT 5
      `);

      return json({
        metrics: {
          totalCustomers: cCount?.count || 0,
          totalQRCodes: qTotal?.count || 0,
          activeQRCodes: qActive?.count || 0,
          inactiveQRCodes: qInactive?.count || 0,
          totalScans: sSum?.sum || 0
        },
        recentChanges,
        recentCustomers,
        recentQRCodes
      });
    }

    // Clientes - Listagem e Criação
    if (pathname === '/api/admin/customers') {
      if (method === 'GET') {
        const search = url.searchParams.get('search') || '';
        const status = url.searchParams.get('status') || '';

        let sql = `
          SELECT
            c.*,
            (SELECT COUNT(*) FROM qr_codes WHERE customer_id = c.id) as qr_code_count
          FROM customers c
          WHERE 1=1
        `;
        const params: any[] = [];

        if (status && status !== 'todos') {
          sql += ' AND c.status = ?';
          params.push(status);
        }

        if (search) {
          sql += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.notes LIKE ?)';
          const p = `%${search}%`;
          params.push(p, p, p, p);
        }

        sql += ' ORDER BY c.created_at DESC';
        const customers = await db.queryAll<Customer>(sql, params);
        return json({ customers });
      }

      if (method === 'POST') {
        const body: any = await request.json().catch(() => ({}));
        if (!body.name || !body.name.trim()) {
          return json({ error: 'O nome do cliente é obrigatório.' }, 400);
        }

        const id = 'cust_' + crypto.randomUUID().slice(0, 8);
        const now = new Date().toISOString();

        await db.run(
          `INSERT INTO customers (id, name, phone, email, notes, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            body.name.trim(),
            body.phone ? body.phone.trim() : null,
            body.email ? body.email.trim() : null,
            body.notes ? body.notes.trim() : null,
            body.status || 'ativo',
            now,
            now
          ]
        );

        const customer = await db.queryFirst<Customer>('SELECT * FROM customers WHERE id = ?', [id]);
        return json({ customer }, 201);
      }
    }

    // Cliente por ID
    const custIdMatch = pathname.match(/^\/api\/admin\/customers\/([^/]+)$/);
    if (custIdMatch) {
      const customerId = custIdMatch[1];

      if (method === 'GET') {
        const customer = await db.queryFirst<Customer>('SELECT * FROM customers WHERE id = ?', [customerId]);
        if (!customer) return json({ error: 'Cliente não encontrado.' }, 404);

        const qrCodes = await db.queryAll<QRCodeItem>(
          'SELECT * FROM qr_codes WHERE customer_id = ? ORDER BY created_at DESC',
          [customerId]
        );
        return json({ customer, qrCodes });
      }

      if (method === 'PUT') {
        const body: any = await request.json().catch(() => ({}));
        if (!body.name || !body.name.trim()) {
          return json({ error: 'O nome do cliente é obrigatório.' }, 400);
        }

        const now = new Date().toISOString();
        await db.run(
          `UPDATE customers
           SET name = ?, phone = ?, email = ?, notes = ?, status = ?, updated_at = ?
           WHERE id = ?`,
          [
            body.name.trim(),
            body.phone ? body.phone.trim() : null,
            body.email ? body.email.trim() : null,
            body.notes ? body.notes.trim() : null,
            body.status || 'ativo',
            now,
            customerId
          ]
        );

        const updated = await db.queryFirst<Customer>('SELECT * FROM customers WHERE id = ?', [customerId]);
        return json({ customer: updated });
      }

      if (method === 'DELETE') {
        const qrCount = await db.queryFirst<{ count: number }>(
          'SELECT COUNT(*) as count FROM qr_codes WHERE customer_id = ?',
          [customerId]
        );

        if (qrCount && qrCount.count > 0) {
          return json({
            error: `Este cliente possui ${qrCount.count} placa(s) cadastrada(s). Remova ou reatribua as placas antes de excluir.`
          }, 400);
        }

        await db.run('DELETE FROM customers WHERE id = ?', [customerId]);
        return json({ success: true, message: 'Cliente excluído com sucesso.' });
      }
    }

    // Status do Cliente
    const custStatusMatch = pathname.match(/^\/api\/admin\/customers\/([^/]+)\/status$/);
    if (custStatusMatch && method === 'PATCH') {
      const customerId = custStatusMatch[1];
      const body: any = await request.json().catch(() => ({}));
      const { status } = body;

      if (!['ativo', 'arquivado', 'desativado'].includes(status)) {
        return json({ error: 'Status inválido.' }, 400);
      }

      const now = new Date().toISOString();
      await db.run('UPDATE customers SET status = ?, updated_at = ? WHERE id = ?', [status, now, customerId]);
      return json({ success: true, message: `Status alterado para ${status}.` });
    }

    // QR Codes - Listagem e Criação
    if (pathname === '/api/admin/qr-codes') {
      if (method === 'GET') {
        const search = url.searchParams.get('search') || '';
        const status = url.searchParams.get('status') || '';
        const customerId = url.searchParams.get('customer_id') || '';

        let sql = `
          SELECT
            q.*,
            c.name as customer_name
          FROM qr_codes q
          LEFT JOIN customers c ON c.id = q.customer_id
          WHERE 1=1
        `;
        const params: any[] = [];

        if (status && status !== 'todos') {
          sql += ' AND q.status = ?';
          params.push(status);
        }

        if (customerId) {
          sql += ' AND q.customer_id = ?';
          params.push(customerId);
        }

        if (search) {
          sql += ' AND (q.code LIKE ? OR q.title LIKE ? OR q.destination_url LIKE ? OR c.name LIKE ?)';
          const p = `%${search}%`;
          params.push(p, p, p, p);
        }

        sql += ' ORDER BY q.created_at DESC';
        const qrCodes = await db.queryAll<QRCodeItem>(sql, params);
        return json({ qrCodes });
      }

      if (method === 'POST') {
        const body: any = await request.json().catch(() => ({}));
        const { customer_id, title, destination_url, status } = body;

        if (!customer_id) {
          return json({ error: 'Selecione o cliente proprietário da placa.' }, 400);
        }

        if (!destination_url || !isValidUrl(destination_url)) {
          return json({ error: 'URL de destino inválida. Deve iniciar com http:// ou https://' }, 400);
        }

        const customer = await db.queryFirst<Customer>('SELECT id, name FROM customers WHERE id = ?', [customer_id]);
        if (!customer) {
          return json({ error: 'Cliente especificado não existe.' }, 400);
        }

        const code = await generateUniquePublicCode(db);
        const id = 'qr_' + crypto.randomUUID().slice(0, 8);
        const now = new Date().toISOString();
        const qrStatus = status === 'desativado' ? 'desativado' : 'ativo';

        await db.run(
          `INSERT INTO qr_codes (id, code, customer_id, title, destination_url, status, scan_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
          [
            id,
            code,
            customer_id,
            title ? title.trim() : `Placa ${code}`,
            destination_url.trim(),
            qrStatus,
            now,
            now
          ]
        );

        // Registro de criação no histórico
        const historyId = 'hist_' + crypto.randomUUID().slice(0, 8);
        await db.run(
          `INSERT INTO qr_code_history (id, qr_code_id, old_destination_url, new_destination_url, changed_by, changed_at, reason)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            historyId,
            id,
            '-- CRIAÇÃO INICIAL --',
            destination_url.trim(),
            authUser.name || 'Administrador',
            now,
            'Configuração inicial da placa física'
          ]
        );

        const created = await db.queryFirst<any>(`
          SELECT q.*, c.name as customer_name
          FROM qr_codes q
          LEFT JOIN customers c ON c.id = q.customer_id
          WHERE q.id = ?
        `, [id]);

        return json({ qrCode: created }, 201);
      }
    }

    // QR Code por ID
    const qrIdMatch = pathname.match(/^\/api\/admin\/qr-codes\/([^/]+)$/);
    if (qrIdMatch) {
      const qrId = qrIdMatch[1];

      if (method === 'GET') {
        const qrCode = await db.queryFirst<any>(`
          SELECT
            q.*,
            c.name as customer_name,
            c.phone as customer_phone,
            c.email as customer_email
          FROM qr_codes q
          LEFT JOIN customers c ON c.id = q.customer_id
          WHERE q.id = ?
        `, [qrId]);

        if (!qrCode) return json({ error: 'QR Code não encontrado.' }, 404);

        const history = await db.queryAll<QRCodeHistory>(
          'SELECT * FROM qr_code_history WHERE qr_code_id = ? ORDER BY changed_at DESC',
          [qrId]
        );

        return json({ qrCode, history });
      }

      if (method === 'PUT') {
        const body: any = await request.json().catch(() => ({}));
        const { title, customer_id } = body;
        const now = new Date().toISOString();

        await db.run(
          'UPDATE qr_codes SET title = ?, customer_id = ?, updated_at = ? WHERE id = ?',
          [title ? title.trim() : null, customer_id, now, qrId]
        );

        const updated = await db.queryFirst<any>(`
          SELECT q.*, c.name as customer_name
          FROM qr_codes q
          LEFT JOIN customers c ON c.id = q.customer_id
          WHERE q.id = ?
        `, [qrId]);

        return json({ qrCode: updated });
      }

      if (method === 'DELETE') {
        await db.run('DELETE FROM qr_code_history WHERE qr_code_id = ?', [qrId]);
        await db.run('DELETE FROM qr_codes WHERE id = ?', [qrId]);
        return json({ success: true, message: 'QR Code excluído com sucesso.' });
      }
    }

    // Alteração de Destino Dinâmico
    const destMatch = pathname.match(/^\/api\/admin\/qr-codes\/([^/]+)\/destination$/);
    if (destMatch && method === 'PATCH') {
      const qrId = destMatch[1];
      const body: any = await request.json().catch(() => ({}));
      const new_destination_url = body.new_destination_url || body.newDestination;
      const reason = body.reason;

      if (!new_destination_url || !isValidUrl(new_destination_url)) {
        return json({ error: 'URL de destino inválida. Deve iniciar com http:// ou https://' }, 400);
      }

      const current = await db.queryFirst<QRCodeItem>('SELECT * FROM qr_codes WHERE id = ?', [qrId]);
      if (!current) return json({ error: 'QR Code não encontrado.' }, 404);

      const trimmedNewUrl = new_destination_url.trim();
      if (current.destination_url === trimmedNewUrl) {
        return json({ error: 'A nova URL é idêntica ao destino atual da placa.' }, 400);
      }

      const now = new Date().toISOString();

      // 1. Atualiza destino no banco mantendo o código (ex: A7K92X) intacto
      await db.run(
        'UPDATE qr_codes SET destination_url = ?, updated_at = ? WHERE id = ?',
        [trimmedNewUrl, now, qrId]
      );

      // 2. Registra a alteração completa no histórico com auditoria
      const historyId = 'hist_' + crypto.randomUUID().slice(0, 8);
      await db.run(
        `INSERT INTO qr_code_history (id, qr_code_id, old_destination_url, new_destination_url, changed_by, changed_at, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          historyId,
          qrId,
          current.destination_url,
          trimmedNewUrl,
          authUser.name || 'Administrador',
          now,
          reason ? reason.trim() : 'Alteração solicitada pelo cliente'
        ]
      );

      const updated = await db.queryFirst<any>(`
        SELECT q.*, c.name as customer_name
        FROM qr_codes q
        LEFT JOIN customers c ON c.id = q.customer_id
        WHERE q.id = ?
      `, [qrId]);

      return json({
        success: true,
        message: 'Destino atualizado com sucesso! A placa física já está direcionando para o novo link.',
        qrCode: updated
      });
    }

    // Status da Placa
    const qrStatusMatch = pathname.match(/^\/api\/admin\/qr-codes\/([^/]+)\/status$/);
    if (qrStatusMatch && method === 'PATCH') {
      const qrId = qrStatusMatch[1];
      const body: any = await request.json().catch(() => ({}));
      const { status } = body;

      if (!['ativo', 'desativado'].includes(status)) {
        return json({ error: 'Status deve ser "ativo" ou "desativado".' }, 400);
      }

      const now = new Date().toISOString();
      await db.run('UPDATE qr_codes SET status = ?, updated_at = ? WHERE id = ?', [status, now, qrId]);
      return json({ success: true, message: `Placa ${status === 'ativo' ? 'ativada' : 'desativada'} com sucesso.` });
    }

    // Histórico de um QR Code
    const historyMatch = pathname.match(/^\/api\/admin\/qr-codes\/([^/]+)\/history$/);
    if (historyMatch && method === 'GET') {
      const qrId = historyMatch[1];
      const qrCode = await db.queryFirst<any>(`
        SELECT q.*, c.name as customer_name
        FROM qr_codes q
        LEFT JOIN customers c ON c.id = q.customer_id
        WHERE q.id = ?
      `, [qrId]);

      if (!qrCode) return json({ error: 'QR Code não encontrado.' }, 404);

      const history = await db.queryAll<QRCodeHistory>(
        'SELECT * FROM qr_code_history WHERE qr_code_id = ? ORDER BY changed_at DESC',
        [qrId]
      );

      return json({ qrCode, history });
    }

    // Configurações
    if (pathname === '/api/admin/settings') {
      if (method === 'GET') {
        const rows = await db.queryAll<Setting>('SELECT * FROM settings');
        const map: Record<string, string> = {};
        for (const r of rows) map[r.key] = r.value;

        const origin = `${url.protocol}//${url.host}`;
        if (!map.custom_domain) map.custom_domain = origin;

        return json({ settings: map, detectedOrigin: origin });
      }

      if (method === 'PUT') {
        const body: any = await request.json().catch(() => ({}));
        const { custom_domain, redirect_type } = body;
        const now = new Date().toISOString();

        if (custom_domain !== undefined) {
          await db.run(
            `INSERT INTO settings (key, value, updated_at) VALUES ('custom_domain', ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
            [custom_domain.trim().replace(/\/+$/, ''), now]
          );
        }

        if (redirect_type !== undefined) {
          await db.run(
            `INSERT INTO settings (key, value, updated_at) VALUES ('redirect_type', ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
            [redirect_type, now]
          );
        }

        return json({ success: true, message: 'Configurações atualizadas.' });
      }
    }

    // Backup: Exportar
    if (pathname === '/api/admin/backup/export' && method === 'GET') {
      const users = await db.queryAll('SELECT id, name, email, role, created_at, updated_at FROM users');
      const customers = await db.queryAll('SELECT * FROM customers');
      const qrCodes = await db.queryAll('SELECT * FROM qr_codes');
      const history = await db.queryAll('SELECT * FROM qr_code_history');
      const settings = await db.queryAll('SELECT * FROM settings');

      const backup = {
        app: 'QR Placas Dinâmicas',
        version: '1.0.0',
        exported_at: new Date().toISOString(),
        exported_by: authUser.email,
        data: { users, customers, qrCodes, history, settings }
      };

      return new Response(JSON.stringify(backup, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="qr_placas_backup_${new Date().toISOString().slice(0, 10)}.json"`
        }
      });
    }

    // Backup: Importar / Restaurar
    if (pathname === '/api/admin/backup/import' && method === 'POST') {
      const body: any = await request.json().catch(() => ({}));
      const { data } = body;

      if (!data || (!data.customers && !data.qrCodes)) {
        return json({ error: 'Arquivo de backup inválido.' }, 400);
      }

      if (Array.isArray(data.customers)) {
        for (const c of data.customers) {
          await db.run(
            `INSERT INTO customers (id, name, phone, email, notes, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET name=excluded.name, phone=excluded.phone, email=excluded.email, notes=excluded.notes, status=excluded.status, updated_at=excluded.updated_at`,
            [c.id, c.name, c.phone, c.email, c.notes, c.status || 'ativo', c.created_at, c.updated_at]
          );
        }
      }

      if (Array.isArray(data.qrCodes)) {
        for (const q of data.qrCodes) {
          await db.run(
            `INSERT INTO qr_codes (id, code, customer_id, title, destination_url, status, scan_count, last_scanned_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET code=excluded.code, customer_id=excluded.customer_id, title=excluded.title, destination_url=excluded.destination_url, status=excluded.status, scan_count=excluded.scan_count, updated_at=excluded.updated_at`,
            [q.id, q.code, q.customer_id, q.title, q.destination_url, q.status || 'ativo', q.scan_count || 0, q.last_scanned_at, q.created_at, q.updated_at]
          );
        }
      }

      if (Array.isArray(data.history)) {
        for (const h of data.history) {
          await db.run(
            `INSERT OR IGNORE INTO qr_code_history (id, qr_code_id, old_destination_url, new_destination_url, changed_by, changed_at, reason)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [h.id, h.qr_code_id, h.old_destination_url, h.new_destination_url, h.changed_by, h.changed_at, h.reason]
          );
        }
      }

      return json({ success: true, message: 'Backup restaurado com sucesso!' });
    }

    return json({ error: 'Endpoint administrativo não encontrado.' }, 404);
  }

  // ==========================================
  // 5. ASSETS ESTÁTICOS / FRONTEND SPA (Cloudflare Workers Assets)
  // ==========================================
  if (env.ASSETS) {
    // Tenta servir asset estático do frontend compilado
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    // Se for rota de página SPA (ex: /admin/login, /admin/dashboard, /admin/clientes)
    // serve o index.html para o React Router/SPA gerenciar no navegador
    const indexRequest = new Request(new URL('/index.html', request.url), request);
    return await env.ASSETS.fetch(indexRequest);
  }

  return new Response('QR Placas Worker em execução.', { status: 200 });
}
