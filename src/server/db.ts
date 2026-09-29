/**
 * Camada de Abstração do Banco de Dados SQLite / Cloudflare D1
 * Suporta execução local com WebAssembly SQLite (sql.js) e Cloudflare D1 em produção.
 */

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { hashPassword } from './crypto.ts';

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: 'ativo' | 'arquivado' | 'desativado';
  created_at: string;
  updated_at: string;
  qr_code_count?: number;
}

export interface QRCodeItem {
  id: string;
  code: string;
  customer_id: string;
  customer_name?: string;
  title: string | null;
  destination_url: string;
  status: 'ativo' | 'desativado';
  scan_count: number;
  last_scanned_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QRCodeHistory {
  id: string;
  qr_code_id: string;
  old_destination_url: string;
  new_destination_url: string;
  changed_by: string;
  changed_at: string;
  reason: string | null;
}

export interface Setting {
  key: string;
  value: string;
  updated_at: string;
}

// Interface compatível com Cloudflare D1
export interface DatabaseDriver {
  queryAll<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryFirst<T = any>(sql: string, params?: any[]): Promise<T | null>;
  run(sql: string, params?: any[]): Promise<{ changes: number }>;
  exec(sql: string): Promise<void>;
  exportData?(): Promise<Uint8Array>;
}

let localDbInstance: SqlJsDatabase | null = null;
let isInitialized = false;

const DB_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DB_DIR, 'qr_placas.sqlite');

/**
 * Salva o banco SQLite em disco no ambiente local
 */
function persistLocalDb(): void {
  if (!localDbInstance) return;
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    const data = localDbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Erro ao persistir banco SQLite local:', err);
  }
}

/**
 * Cria o driver SQLite para ambiente Node.js / Express
 */
async function getLocalDatabase(): Promise<DatabaseDriver> {
  if (localDbInstance) {
    return createDriver(localDbInstance);
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      localDbInstance = new SQL.Database(fileBuffer);
    } catch (err) {
      console.warn('Banco existente corrompido ou inacessível, iniciando novo:', err);
      localDbInstance = new SQL.Database();
    }
  } else {
    localDbInstance = new SQL.Database();
  }

  return createDriver(localDbInstance);
}

function createDriver(db: SqlJsDatabase): DatabaseDriver {
  return {
    async queryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
      const stmt = db.prepare(sql);
      try {
        stmt.bind(params);
        const results: T[] = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject() as unknown as T);
        }
        return results;
      } finally {
        stmt.free();
      }
    },

    async queryFirst<T = any>(sql: string, params: any[] = []): Promise<T | null> {
      const results = await this.queryAll<T>(sql, params);
      return results.length > 0 ? results[0] : null;
    },

    async run(sql: string, params: any[] = []): Promise<{ changes: number }> {
      db.run(sql, params);
      const changes = db.getRowsModified();
      persistLocalDb();
      return { changes };
    },

    async exec(sql: string): Promise<void> {
      db.exec(sql);
      persistLocalDb();
    },

    async exportData(): Promise<Uint8Array> {
      return db.export();
    }
  };
}

let activeDriver: DatabaseDriver | null = null;

export async function getDb(): Promise<DatabaseDriver> {
  if (!activeDriver) {
    activeDriver = await getLocalDatabase();
  }
  return activeDriver;
}

/**
 * Permite injetar driver (por exemplo, Cloudflare D1 em worker.ts)
 */
export function setDbDriver(driver: DatabaseDriver) {
  activeDriver = driver;
  isInitialized = true;
}

/**
 * Validação rigorosa de URL para segurança do QR Code
 */
export function isValidUrl(urlString: string): boolean {
  try {
    const trimmed = urlString.trim();
    if (!trimmed) return false;
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Gera código público seguro de 6 caracteres (A-Z, 2-9) sem ambiguidades
 * Ex: A7K92X, K8P3LM, XQ72AB
 */
export async function generateUniquePublicCode(db: DatabaseDriver): Promise<string> {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let attempts = 0;

  while (attempts < 50) {
    let code = '';
    const randomBytes = crypto.getRandomValues(new Uint8Array(6));
    for (let i = 0; i < 6; i++) {
      code += chars[randomBytes[i] % chars.length];
    }

    const existing = await db.queryFirst('SELECT id FROM qr_codes WHERE code = ?', [code]);
    if (!existing) {
      return code;
    }
    attempts++;
  }

  // Fallback caso raro de colisão repetida
  return 'QR' + Date.now().toString(36).toUpperCase().slice(-4);
}

/**
 * Inicializa as tabelas do banco de dados e cria o administrador padrão se não existir
 */
export async function initDatabase(db: DatabaseDriver): Promise<void> {
  if (isInitialized) return;

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
    CREATE INDEX IF NOT EXISTS idx_qr_history_changed_at ON qr_code_history(changed_at);
  `);

  // Verifica se existe algum administrador cadastrado
  const adminExists = await db.queryFirst<User>('SELECT id FROM users LIMIT 1');
  if (!adminExists) {
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@qrplacas.com').trim().toLowerCase();
    const adminInitialPass = process.env.ADMIN_INITIAL_PASSWORD || 'admin123456';
    const passwordHash = await hashPassword(adminInitialPass);
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'usr_' + crypto.randomUUID().slice(0, 8),
        'Administrador QR Placas',
        adminEmail,
        passwordHash,
        'superadmin',
        now,
        now
      ]
    );

    // Configurações padrão
    await db.run(
      `INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`,
      ['custom_domain', process.env.APP_URL || '', now]
    );
    await db.run(
      `INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`,
      ['redirect_type', '302', now]
    );

    console.log(`[QR Placas] Administrador inicial configurado: ${adminEmail}`);
  }

  isInitialized = true;
}
