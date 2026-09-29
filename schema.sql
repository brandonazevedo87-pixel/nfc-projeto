-- QR Placas - Schema do Banco de Dados Cloudflare D1 / SQLite
-- Plataforma de Gerenciamento de QR Codes Dinâmicos para Placas Físicas e NFC

-- 1. Tabela de Usuários Administradores
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 2. Tabela de Clientes
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'ativo', -- 'ativo', 'arquivado', 'desativado'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 3. Tabela de QR Codes Dinâmicos
CREATE TABLE IF NOT EXISTS qr_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL, -- Ex: A7K92X (permanente, gravado na placa)
  customer_id TEXT NOT NULL,
  title TEXT, -- Título descritivo da placa (ex: "Placa Balcão Loja Centro")
  destination_url TEXT NOT NULL, -- Destino atual dinâmico
  status TEXT NOT NULL DEFAULT 'ativo', -- 'ativo', 'desativado'
  scan_count INTEGER NOT NULL DEFAULT 0,
  last_scanned_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
);

-- 4. Tabela de Histórico de Alterações de Destino
CREATE TABLE IF NOT EXISTS qr_code_history (
  id TEXT PRIMARY KEY,
  qr_code_id TEXT NOT NULL,
  old_destination_url TEXT NOT NULL,
  new_destination_url TEXT NOT NULL,
  changed_by TEXT NOT NULL, -- Nome ou ID do administrador
  changed_at TEXT NOT NULL,
  reason TEXT,
  FOREIGN KEY (qr_code_id) REFERENCES qr_codes(id) ON DELETE CASCADE
);

-- 5. Tabela de Configurações do Sistema
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_qr_codes_code ON qr_codes(code);
CREATE INDEX IF NOT EXISTS idx_qr_codes_customer_id ON qr_codes(customer_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_status ON qr_codes(status);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_qr_history_qr_id ON qr_code_history(qr_code_id);
CREATE INDEX IF NOT EXISTS idx_qr_history_changed_at ON qr_code_history(changed_at);
