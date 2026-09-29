/**
 * Servidor de Desenvolvimento Local (QR Placas)
 * Executa o handler universal com Vite SPA middleware para emulação local do Cloudflare Workers & D1.
 * Em produção na Cloudflare, a aplicação é executada via worker.ts diretamente no Edge.
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getDb, initDatabase } from './src/server/db.ts';
import { handleAppRequest } from './src/server/workerHandler.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  // Parser JSON e formulários com limite expandido para backups
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Inicializa o banco de dados e seed do administrador no ambiente local
  let db: any = null;
  try {
    db = await getDb();
    await initDatabase(db);
    console.log('[QR Placas] Banco de dados SQLite inicializado.');
  } catch (err) {
    console.error('[QR Placas] Erro ao inicializar banco de dados local:', err);
  }

  // Intercepta rotas de API e redirecionamentos públicos usando o mesmo handler do Cloudflare Worker
  app.use(async (req, res, next) => {
    if (req.path.startsWith('/q/') || req.path.startsWith('/api/')) {
      try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const headers = new Headers();
        for (const [key, val] of Object.entries(req.headers)) {
          if (val) {
            if (Array.isArray(val)) {
              val.forEach(v => headers.append(key, v));
            } else {
              headers.set(key, val);
            }
          }
        }

        let bodyInit: BodyInit | undefined = undefined;
        if (!['GET', 'HEAD'].includes(req.method.toUpperCase())) {
          bodyInit = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
        }

        const webRequest = new Request(fullUrl, {
          method: req.method,
          headers,
          body: bodyInit
        });

        const env = {
          APP_URL: process.env.APP_URL || `${req.protocol}://${req.get('host')}`,
          ADMIN_EMAIL: process.env.ADMIN_EMAIL,
          ADMIN_INITIAL_PASSWORD: process.env.ADMIN_INITIAL_PASSWORD,
          SESSION_SECRET: process.env.SESSION_SECRET
        };

        const webResponse = await handleAppRequest(webRequest, env, db);

        res.status(webResponse.status);
        webResponse.headers.forEach((value, name) => {
          res.setHeader(name, value);
        });

        const arrayBuffer = await webResponse.arrayBuffer();
        return res.end(Buffer.from(arrayBuffer));
      } catch (err) {
        console.error('[QR Placas] Erro no processamento da requisição:', err);
        return res.status(500).json({ error: 'Erro interno no processamento da requisição.' });
      }
    }

    next();
  });

  // Em modo de desenvolvimento, monta os middlewares do Vite
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Em produção estática local, serve os arquivos estáticos compilados do frontend
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[QR Placas] Servidor local operacional em http://0.0.0.0:${PORT}`);
    console.log(`[QR Placas] Rota pública: http://localhost:${PORT}/q/:code`);
    console.log(`[QR Placas] Painel administrativo: http://localhost:${PORT}/admin/login`);
  });
}

startServer().catch(err => {
  console.error('[QR Placas] Falha fatal ao iniciar servidor:', err);
  process.exit(1);
});
