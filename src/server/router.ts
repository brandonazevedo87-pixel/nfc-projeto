/**
 * Router e Handlers de API e Redirecionamento Público
 * Contém toda a lógica de negócio, autenticação e validação segura.
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  getDb,
  isValidUrl,
  generateUniquePublicCode,
  QRCodeItem,
  QRCodeHistory,
  Customer,
  User,
  Setting
} from './db.ts';
import { verifyPassword, hashPassword, createSessionToken, verifySessionToken, SessionPayload } from './crypto.ts';
import { renderNotFoundPage, renderDeactivatedPage } from './publicPages.ts';

// Extensão de tipos do Express para usuário autenticado
export interface AuthenticatedRequest extends Request {
  user?: SessionPayload;
}

export function createApiRouter(): Router {
  const router = Router();

  // ==========================================
  // MIDDLEWARE DE AUTENTICAÇÃO ADMINISTRATIVA
  // ==========================================
  const requireAdminAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      let token = '';

      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if (req.headers['x-access-token']) {
        token = req.headers['x-access-token'] as string;
      }

      if (!token) {
        return res.status(401).json({
          error: 'Acesso não autorizado. Token de sessão ausente.'
        });
      }

      const payload = await verifySessionToken(token);
      if (!payload) {
        return res.status(401).json({
          error: 'Sessão expirada ou inválida. Efetue login novamente.'
        });
      }

      req.user = payload;
      next();
    } catch (err) {
      return res.status(401).json({
        error: 'Falha na validação de credenciais de acesso.'
      });
    }
  };

  // ==========================================
  // ROTAS PÚBLICAS DO QR CODE
  // ==========================================

  /**
   * ROTA DE REDIRECIONAMENTO PÚBLICO: /q/:code
   * 1. Recebe o código público impresso na placa (ex: A7K92X)
   * 2. Localiza no banco de dados
   * 3. Verifica se o QR Code está ativo
   * 4. Obtém o destino atual
   * 5. Redireciona imediatamente
   *
   * SEGURANÇA: Não aceita nenhum parâmetro ?url= ou override externo.
   * O destino vem 100% exclusivamente do banco.
   */
  router.get('/q/:code', async (req: Request, res: Response) => {
    try {
      const code = (req.params.code || '').trim().toUpperCase();
      if (!code) {
        return res.status(400).send('Código de placa inválido.');
      }

      const db = await getDb();
      const qrCode = await db.queryFirst<QRCodeItem>(
        'SELECT * FROM qr_codes WHERE UPPER(code) = ?',
        [code]
      );

      const baseUrl = `${req.protocol}://${req.get('host')}`;

      // 1. QR Code inexistente
      if (!qrCode) {
        res.status(404);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(renderNotFoundPage(code, baseUrl));
      }

      // 2. QR Code desativado / pausado
      if (qrCode.status !== 'ativo') {
        res.status(403);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(renderDeactivatedPage(code, baseUrl));
      }

      // 3. Atualiza contador de escaneamentos em segundo plano
      const now = new Date().toISOString();
      db.run(
        'UPDATE qr_codes SET scan_count = scan_count + 1, last_scanned_at = ? WHERE id = ?',
        [now, qrCode.id]
      ).catch(e => console.error('Erro ao registrar scan:', e));

      // 4. Redirecionamento seguro para o destino configurado no banco
      const redirectType = 302; // Redirecionamento temporário HTTP 302 (não faz cache no navegador do visitante)
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      return res.redirect(redirectType, qrCode.destination_url);
    } catch (error) {
      console.error('Erro no redirecionamento público:', error);
      return res.status(500).send('Erro interno ao processar QR Code.');
    }
  });

  /**
   * API Pública para consulta de integridade sem expor dados administrativos
   */
  router.get('/api/public/qr/:code', async (req: Request, res: Response) => {
    try {
      const code = (req.params.code || '').trim().toUpperCase();
      const db = await getDb();
      const qrCode = await db.queryFirst<QRCodeItem>(
        'SELECT id, code, status, title FROM qr_codes WHERE UPPER(code) = ?',
        [code]
      );

      if (!qrCode) {
        return res.status(404).json({ exists: false, message: 'QR Code não encontrado.' });
      }

      return res.json({
        exists: true,
        code: qrCode.code,
        status: qrCode.status,
        title: qrCode.title || 'Placa Dinâmica'
      });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao consultar QR Code.' });
    }
  });

  /**
   * API Pública de configurações do sistema (domínio, branding)
   */
  router.get('/api/public/config', async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      const domainSetting = await db.queryFirst<Setting>(
        'SELECT value FROM settings WHERE key = ?',
        ['custom_domain']
      );

      const detectedOrigin = `${req.protocol}://${req.get('host')}`;
      const effectiveBaseUrl = (domainSetting?.value || '').trim() || detectedOrigin;

      return res.json({
        baseUrl: effectiveBaseUrl,
        appName: 'QR Placas - Gerenciador de QR Codes Dinâmicos'
      });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao carregar configurações públicas.' });
    }
  });

  // ==========================================
  // AUTENTICAÇÃO ADMINISTRATIVA
  // ==========================================

  router.post('/api/admin/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const db = await getDb();
      const user = await db.queryFirst<User>(
        'SELECT * FROM users WHERE email = ?',
        [cleanEmail]
      );

      if (!user) {
        return res.status(401).json({ error: 'Credenciais de acesso incorretas.' });
      }

      const match = await verifyPassword(password, user.password_hash);
      if (!match) {
        return res.status(401).json({ error: 'Credenciais de acesso incorretas.' });
      }

      const token = await createSessionToken({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      });

      return res.json({
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (err) {
      console.error('Erro no login:', err);
      return res.status(500).json({ error: 'Falha interna durante a autenticação.' });
    }
  });

  router.get('/api/admin/auth/me', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = await getDb();
      const user = await db.queryFirst<User>(
        'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
        [req.user!.userId]
      );
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }
      return res.json({ user });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao buscar dados do usuário.' });
    }
  });

  router.put('/api/admin/auth/password', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body || {};
      if (!currentPassword || !newPassword || newPassword.length < 6) {
        return res.status(400).json({
          error: 'A nova senha deve possuir pelo menos 6 caracteres.'
        });
      }

      const db = await getDb();
      const user = await db.queryFirst<User>(
        'SELECT * FROM users WHERE id = ?',
        [req.user!.userId]
      );

      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      const isCurrentValid = await verifyPassword(currentPassword, user.password_hash);
      if (!isCurrentValid) {
        return res.status(400).json({ error: 'Senha atual incorreta.' });
      }

      const newHash = await hashPassword(newPassword);
      const now = new Date().toISOString();
      await db.run(
        'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
        [newHash, now, user.id]
      );

      return res.json({ success: true, message: 'Senha alterada com sucesso.' });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao atualizar senha.' });
    }
  });

  router.post('/api/admin/auth/logout', (req: Request, res: Response) => {
    return res.json({ success: true, message: 'Sessão encerrada com sucesso.' });
  });

  // ==========================================
  // DASHBOARD ADMINISTRATIVO
  // ==========================================

  router.get('/api/admin/dashboard', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = await getDb();

      // Estatísticas gerais
      const customerCount = await db.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM customers WHERE status != "arquivado"'
      );
      const qrTotalCount = await db.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM qr_codes'
      );
      const qrActiveCount = await db.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM qr_codes WHERE status = "ativo"'
      );
      const qrInactiveCount = await db.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM qr_codes WHERE status = "desativado"'
      );
      const scansSum = await db.queryFirst<{ sum: number }>(
        'SELECT SUM(scan_count) as sum FROM qr_codes'
      );

      // Últimas alterações de destino (Histórico recente)
      const recentChanges = await db.queryAll<any>(`
        SELECT
          h.id,
          h.qr_code_id,
          h.old_destination_url,
          h.new_destination_url,
          h.changed_by,
          h.changed_at,
          h.reason,
          q.code as qr_code,
          q.title as qr_title,
          c.name as customer_name
        FROM qr_code_history h
        JOIN qr_codes q ON q.id = h.qr_code_id
        LEFT JOIN customers c ON c.id = q.customer_id
        ORDER BY h.changed_at DESC
        LIMIT 6
      `);

      // Últimos clientes
      const recentCustomers = await db.queryAll<Customer>(`
        SELECT
          c.*,
          (SELECT COUNT(*) FROM qr_codes WHERE customer_id = c.id) as qr_code_count
        FROM customers c
        WHERE c.status != 'arquivado'
        ORDER BY c.created_at DESC
        LIMIT 5
      `);

      // Últimos QR Codes
      const recentQRCodes = await db.queryAll<any>(`
        SELECT
          q.*,
          c.name as customer_name
        FROM qr_codes q
        LEFT JOIN customers c ON c.id = q.customer_id
        ORDER BY q.created_at DESC
        LIMIT 5
      `);

      return res.json({
        metrics: {
          totalCustomers: customerCount?.count || 0,
          totalQRCodes: qrTotalCount?.count || 0,
          activeQRCodes: qrActiveCount?.count || 0,
          inactiveQRCodes: qrInactiveCount?.count || 0,
          totalScans: scansSum?.sum || 0
        },
        recentChanges,
        recentCustomers,
        recentQRCodes
      });
    } catch (err) {
      console.error('Erro no dashboard:', err);
      return res.status(500).json({ error: 'Erro ao carregar métricas do dashboard.' });
    }
  });

  // ==========================================
  // GERENCIAMENTO DE CLIENTES
  // ==========================================

  router.get('/api/admin/customers', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = await getDb();
      const search = ((req.query.search as string) || '').trim();
      const status = ((req.query.status as string) || '').trim();

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
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      sql += ' ORDER BY c.created_at DESC';

      const customers = await db.queryAll<Customer>(sql, params);
      return res.json({ customers });
    } catch (err) {
      console.error('Erro ao listar clientes:', err);
      return res.status(500).json({ error: 'Erro ao buscar lista de clientes.' });
    }
  });

  router.get('/api/admin/customers/:id', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = await getDb();
      const id = req.params.id;

      const customer = await db.queryFirst<Customer>(
        'SELECT * FROM customers WHERE id = ?',
        [id]
      );

      if (!customer) {
        return res.status(404).json({ error: 'Cliente não encontrado.' });
      }

      const qrCodes = await db.queryAll<QRCodeItem>(
        'SELECT * FROM qr_codes WHERE customer_id = ? ORDER BY created_at DESC',
        [id]
      );

      return res.json({ customer, qrCodes });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao buscar dados do cliente.' });
    }
  });

  router.post('/api/admin/customers', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, phone, email, notes, status } = req.body || {};
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'O nome do cliente é obrigatório.' });
      }

      const db = await getDb();
      const id = 'cust_' + crypto.randomUUID().slice(0, 8);
      const now = new Date().toISOString();

      await db.run(
        `INSERT INTO customers (id, name, phone, email, notes, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          name.trim(),
          phone ? phone.trim() : null,
          email ? email.trim() : null,
          notes ? notes.trim() : null,
          status || 'ativo',
          now,
          now
        ]
      );

      const customer = await db.queryFirst<Customer>('SELECT * FROM customers WHERE id = ?', [id]);
      return res.status(201).json({ customer });
    } catch (err) {
      console.error('Erro ao criar cliente:', err);
      return res.status(500).json({ error: 'Erro ao cadastrar cliente.' });
    }
  });

  router.put('/api/admin/customers/:id', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id;
      const { name, phone, email, notes, status } = req.body || {};
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'O nome do cliente é obrigatório.' });
      }

      const db = await getDb();
      const existing = await db.queryFirst<Customer>('SELECT * FROM customers WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Cliente não encontrado.' });
      }

      const now = new Date().toISOString();
      await db.run(
        `UPDATE customers
         SET name = ?, phone = ?, email = ?, notes = ?, status = ?, updated_at = ?
         WHERE id = ?`,
        [
          name.trim(),
          phone ? phone.trim() : null,
          email ? email.trim() : null,
          notes ? notes.trim() : null,
          status || existing.status,
          now,
          id
        ]
      );

      const updated = await db.queryFirst<Customer>('SELECT * FROM customers WHERE id = ?', [id]);
      return res.json({ customer: updated });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao atualizar dados do cliente.' });
    }
  });

  router.patch('/api/admin/customers/:id/status', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id;
      const { status } = req.body || {};
      if (!['ativo', 'arquivado', 'desativado'].includes(status)) {
        return res.status(400).json({ error: 'Status inválido fornecido.' });
      }

      const db = await getDb();
      const now = new Date().toISOString();
      await db.run('UPDATE customers SET status = ?, updated_at = ? WHERE id = ?', [status, now, id]);

      return res.json({ success: true, message: `Status alterado para ${status}.` });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao alterar status do cliente.' });
    }
  });

  router.delete('/api/admin/customers/:id', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id;
      const db = await getDb();

      // Verifica se o cliente tem QR codes cadastrados
      const qrCodes = await db.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM qr_codes WHERE customer_id = ?',
        [id]
      );

      if (qrCodes && qrCodes.count > 0) {
        return res.status(400).json({
          error: `Este cliente possui ${qrCodes.count} placa(s) cadastrada(s). Remova ou reatribua os QR Codes antes de excluir o cliente, ou altere o status para 'arquivado'.`
        });
      }

      await db.run('DELETE FROM customers WHERE id = ?', [id]);
      return res.json({ success: true, message: 'Cliente excluído com sucesso.' });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao excluir cliente.' });
    }
  });

  // ==========================================
  // GERENCIAMENTO DE QR CODES
  // ==========================================

  router.get('/api/admin/qr-codes', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = await getDb();
      const search = ((req.query.search as string) || '').trim();
      const status = ((req.query.status as string) || '').trim();
      const customerId = ((req.query.customer_id as string) || '').trim();

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
        const pattern = `%${search}%`;
        params.push(pattern, pattern, pattern, pattern);
      }

      sql += ' ORDER BY q.created_at DESC';

      const qrCodes = await db.queryAll<QRCodeItem>(sql, params);
      return res.json({ qrCodes });
    } catch (err) {
      console.error('Erro ao listar QR Codes:', err);
      return res.status(500).json({ error: 'Erro ao buscar QR Codes.' });
    }
  });

  router.get('/api/admin/qr-codes/:id', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = await getDb();
      const id = req.params.id;

      const qrCode = await db.queryFirst<any>(`
        SELECT
          q.*,
          c.name as customer_name,
          c.phone as customer_phone,
          c.email as customer_email
        FROM qr_codes q
        LEFT JOIN customers c ON c.id = q.customer_id
        WHERE q.id = ?
      `, [id]);

      if (!qrCode) {
        return res.status(404).json({ error: 'QR Code não encontrado.' });
      }

      const history = await db.queryAll<QRCodeHistory>(
        'SELECT * FROM qr_code_history WHERE qr_code_id = ? ORDER BY changed_at DESC',
        [id]
      );

      return res.json({ qrCode, history });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao buscar detalhes do QR Code.' });
    }
  });

  /**
   * CRIAÇÃO DE QR CODE DINÂMICO
   * Gera código aleatório único e permanente (ex: A7K92X)
   * O código jamais mudará após a placa física ser impressa.
   */
  router.post('/api/admin/qr-codes', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { customer_id, title, destination_url, status } = req.body || {};

      if (!customer_id) {
        return res.status(400).json({ error: 'Selecione o cliente proprietário da placa.' });
      }

      if (!destination_url || !isValidUrl(destination_url)) {
        return res.status(400).json({
          error: 'URL de destino inválida. Deve começar com http:// ou https://'
        });
      }

      const db = await getDb();

      // Confirma cliente existente
      const customer = await db.queryFirst<Customer>('SELECT id, name FROM customers WHERE id = ?', [customer_id]);
      if (!customer) {
        return res.status(400).json({ error: 'Cliente especificado não existe.' });
      }

      // Gera código público exclusivo e imprevisível (ex: A7K92X)
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

      // Registra a criação inicial no histórico
      const historyId = 'hist_' + crypto.randomUUID().slice(0, 8);
      await db.run(
        `INSERT INTO qr_code_history (id, qr_code_id, old_destination_url, new_destination_url, changed_by, changed_at, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          historyId,
          id,
          '-- CRIAÇÃO INICIAL --',
          destination_url.trim(),
          req.user?.name || 'Administrador',
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

      return res.status(201).json({ qrCode: created });
    } catch (err) {
      console.error('Erro ao cadastrar QR Code:', err);
      return res.status(500).json({ error: 'Erro ao gerar novo QR Code dinâmico.' });
    }
  });

  /**
   * ALTERAÇÃO DE DESTINO DINÂMICO
   * O código público (A7K92X), a URL pública e o QR Code físico permanecem IDÊNTICOS.
   * Somente o destino no banco de dados é atualizado e registrado no histórico.
   */
  router.patch('/api/admin/qr-codes/:id/destination', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id;
      const { new_destination_url, reason } = req.body || {};

      if (!new_destination_url || !isValidUrl(new_destination_url)) {
        return res.status(400).json({
          error: 'URL de destino inválida. Certifique-se de incluir http:// ou https://'
        });
      }

      const db = await getDb();
      const current = await db.queryFirst<QRCodeItem>('SELECT * FROM qr_codes WHERE id = ?', [id]);
      if (!current) {
        return res.status(404).json({ error: 'QR Code não encontrado.' });
      }

      const trimmedNewDestination = new_destination_url.trim();

      // Não faz nada se a URL for exatamente a mesma
      if (current.destination_url === trimmedNewDestination) {
        return res.status(400).json({ error: 'A nova URL é idêntica ao destino atual da placa.' });
      }

      const now = new Date().toISOString();

      // 1. Atualiza destino no banco mantendo o código (ex: A7K92X) intacto
      await db.run(
        'UPDATE qr_codes SET destination_url = ?, updated_at = ? WHERE id = ?',
        [trimmedNewDestination, now, id]
      );

      // 2. Registra a alteração completa no histórico com autor e horário
      const historyId = 'hist_' + crypto.randomUUID().slice(0, 8);
      await db.run(
        `INSERT INTO qr_code_history (id, qr_code_id, old_destination_url, new_destination_url, changed_by, changed_at, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          historyId,
          id,
          current.destination_url,
          trimmedNewDestination,
          req.user?.name || 'Administrador',
          now,
          reason ? reason.trim() : 'Alteração solicitada pelo cliente'
        ]
      );

      const updated = await db.queryFirst<any>(`
        SELECT q.*, c.name as customer_name
        FROM qr_codes q
        LEFT JOIN customers c ON c.id = q.customer_id
        WHERE q.id = ?
      `, [id]);

      return res.json({
        success: true,
        message: 'Destino atualizado com sucesso! A placa física já está direcionando para o novo link.',
        qrCode: updated
      });
    } catch (err) {
      console.error('Erro ao alterar destino:', err);
      return res.status(500).json({ error: 'Erro ao atualizar o destino do QR Code.' });
    }
  });

  /**
   * ATIVAÇÃO / DESATIVAÇÃO DE QR CODE
   */
  router.patch('/api/admin/qr-codes/:id/status', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id;
      const { status } = req.body || {};
      if (!['ativo', 'desativado'].includes(status)) {
        return res.status(400).json({ error: 'Status deve ser "ativo" ou "desativado".' });
      }

      const db = await getDb();
      const now = new Date().toISOString();
      await db.run('UPDATE qr_codes SET status = ?, updated_at = ? WHERE id = ?', [status, now, id]);

      return res.json({
        success: true,
        message: `Placa ${status === 'ativo' ? 'ativada' : 'desativada'} com sucesso.`
      });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao alterar status do QR Code.' });
    }
  });

  /**
   * EDIÇÃO DE METADADOS DO QR CODE (Título / Cliente)
   */
  router.put('/api/admin/qr-codes/:id', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id;
      const { title, customer_id } = req.body || {};

      const db = await getDb();
      const existing = await db.queryFirst<QRCodeItem>('SELECT * FROM qr_codes WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'QR Code não encontrado.' });
      }

      if (customer_id) {
        const cust = await db.queryFirst<Customer>('SELECT id FROM customers WHERE id = ?', [customer_id]);
        if (!cust) {
          return res.status(400).json({ error: 'Cliente especificado não existe.' });
        }
      }

      const now = new Date().toISOString();
      await db.run(
        'UPDATE qr_codes SET title = ?, customer_id = ?, updated_at = ? WHERE id = ?',
        [
          title ? title.trim() : existing.title,
          customer_id || existing.customer_id,
          now,
          id
        ]
      );

      const updated = await db.queryFirst<any>(`
        SELECT q.*, c.name as customer_name
        FROM qr_codes q
        LEFT JOIN customers c ON c.id = q.customer_id
        WHERE q.id = ?
      `, [id]);

      return res.json({ qrCode: updated });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao editar QR Code.' });
    }
  });

  /**
   * HISTÓRICO DE UM QR CODE ESPECÍFICO
   */
  router.get('/api/admin/qr-codes/:id/history', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id;
      const db = await getDb();

      const qrCode = await db.queryFirst<any>(`
        SELECT q.*, c.name as customer_name
        FROM qr_codes q
        LEFT JOIN customers c ON c.id = q.customer_id
        WHERE q.id = ?
      `, [id]);

      if (!qrCode) {
        return res.status(404).json({ error: 'QR Code não encontrado.' });
      }

      const history = await db.queryAll<QRCodeHistory>(
        'SELECT * FROM qr_code_history WHERE qr_code_id = ? ORDER BY changed_at DESC',
        [id]
      );

      return res.json({ qrCode, history });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao buscar histórico do QR Code.' });
    }
  });

  /**
   * EXCLUSÃO DE QR CODE
   */
  router.delete('/api/admin/qr-codes/:id', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id;
      const db = await getDb();

      await db.run('DELETE FROM qr_code_history WHERE qr_code_id = ?', [id]);
      await db.run('DELETE FROM qr_codes WHERE id = ?', [id]);

      return res.json({ success: true, message: 'QR Code e histórico removidos com sucesso.' });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao excluir QR Code.' });
    }
  });

  // ==========================================
  // CONFIGURAÇÕES E BACKUP DO SISTEMA
  // ==========================================

  router.get('/api/admin/settings', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = await getDb();
      const rows = await db.queryAll<Setting>('SELECT * FROM settings');
      const settingsMap: Record<string, string> = {};
      for (const r of rows) {
        settingsMap[r.key] = r.value;
      }

      // Adiciona hostname detectado se não configurado
      const detectedOrigin = `${req.protocol}://${req.get('host')}`;
      if (!settingsMap.custom_domain) {
        settingsMap.custom_domain = detectedOrigin;
      }

      return res.json({ settings: settingsMap, detectedOrigin });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao carregar configurações.' });
    }
  });

  router.put('/api/admin/settings', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { custom_domain, redirect_type } = req.body || {};
      const db = await getDb();
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

      return res.json({ success: true, message: 'Configurações atualizadas com sucesso.' });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao salvar configurações.' });
    }
  });

  /**
   * BACKUP DO BANCO EM JSON COMPLETO (Cloudflare D1 / SQLite)
   */
  router.get('/api/admin/backup/export', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = await getDb();
      const users = await db.queryAll('SELECT id, name, email, role, created_at, updated_at FROM users');
      const customers = await db.queryAll('SELECT * FROM customers');
      const qrCodes = await db.queryAll('SELECT * FROM qr_codes');
      const history = await db.queryAll('SELECT * FROM qr_code_history');
      const settings = await db.queryAll('SELECT * FROM settings');

      const backup = {
        app: 'QR Placas Dinâmicas',
        version: '1.0.0',
        exported_at: new Date().toISOString(),
        exported_by: req.user?.email,
        data: {
          users,
          customers,
          qrCodes,
          history,
          settings
        }
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="qr_placas_backup_${new Date().toISOString().slice(0, 10)}.json"`
      );
      return res.send(JSON.stringify(backup, null, 2));
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao exportar backup.' });
    }
  });

  /**
   * RESTAURAÇÃO DE BACKUP A PARTIR DE ARQUIVO JSON
   */
  router.post('/api/admin/backup/import', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { data } = req.body || {};
      if (!data || (!data.customers && !data.qrCodes)) {
        return res.status(400).json({ error: 'Formato de arquivo de backup inválido.' });
      }

      const db = await getDb();

      // Insere clientes restaurados
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

      // Insere QR Codes restaurados
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

      // Insere histórico
      if (Array.isArray(data.history)) {
        for (const h of data.history) {
          await db.run(
            `INSERT OR IGNORE INTO qr_code_history (id, qr_code_id, old_destination_url, new_destination_url, changed_by, changed_at, reason)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [h.id, h.qr_code_id, h.old_destination_url, h.new_destination_url, h.changed_by, h.changed_at, h.reason]
          );
        }
      }

      return res.json({ success: true, message: 'Dados restaurados com sucesso!' });
    } catch (err) {
      console.error('Erro na importação de backup:', err);
      return res.status(500).json({ error: 'Erro ao restaurar backup.' });
    }
  });

  return router;
}
