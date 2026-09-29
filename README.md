# QR Placas - Plataforma Profissional de QR Codes Dinâmicos & NFC

Plataforma completa, independente e pronta para produção para gerenciamento de **QR Codes Dinâmicos** destinados a placas físicas, acrílicos, displays de balcão e etiquetas NFC.

O QR Code é gravado fisicamente na placa **uma única vez** com um código permanente (ex: `A7K92X`). O cliente pode alterar o link de destino quantas vezes desejar através do painel administrativo, mantendo a placa física e a URL pública permanentemente inalteradas.

---

## Índice

1. [Visão Geral e Arquitetura](#1-visão-geral-e-arquitetura)
2. [Requisitos de Sistema](#2-requisitos-de-sistema)
3. [Instalação Local](#3-instalação-local)
4. [Configuração de Variáveis de Ambiente](#4-configuração-de-variáveis-de-ambiente)
5. [Banco de Dados & Migrations (Cloudflare D1 / SQLite)](#5-banco-de-dados--migrations)
6. [Criação e Gestão do Administrador Inicial](#6-criação-e-gestão-do-administrador-inicial)
7. [Execução Local](#7-execução-local)
8. [Testes Automatizados](#8-testes-automatizados)
9. [Build de Produção](#9-build-de-produção)
10. [Configuração na Cloudflare](#10-configuração-na-cloudflare)
11. [Configuração do Cloudflare D1](#11-configuração-do-cloudflare-d1)
12. [Configuração dos Secrets da Cloudflare](#12-configuração-dos-secrets)
13. [Configuração do Domínio Personalizado (ex: `qr.meudominio.com.br`)](#13-configuração-do-domínio-personalizado)
14. [Deploy na Cloudflare](#14-deploy-na-cloudflare)
15. [Atualização do Sistema em Produção](#15-atualização-do-sistema)
16. [Backup & Restauração](#16-backup--restauração)
17. [Solução de Problemas (Troubleshooting)](#17-solução-de-problemas)

---

## 1. Visão Geral e Arquitetura

### Fluxo Operacional:
```
PLACA FÍSICA (Acrílico / Inox / NFC)
       ↓
https://qr.meudominio.com.br/q/A7K92X
       ↓
CLOUDFLARE WORKER (Edge < 15ms) / EXPRESS
       ↓
CLOUDFLARE D1 (SQLite)
       ↓
DESTINO ATUAL DO CLIENTE (Instagram → WhatsApp → Site)
       ↓
REDIRECIONAMENTO HTTP 302 INSTANTÂNEO
```

### Componentes:
- **Área Pública (`/q/:code`)**:
  - Consulta rápida no banco de dados.
  - Redireciona com HTTP 302 direto para a URL ativa.
  - Incrementa contador de escaneamentos.
  - Bloqueio rigoroso: parâmetros de consulta (como `?url=...`) são completamente ignorados. O destino vem 100% exclusivamente do banco de dados.
  - Páginas públicas personalizadas para código não encontrado (404) ou placa pausada (403).
- **Área Administrativa (`/admin/*`)**:
  - Autenticação com senhas criptografadas em PBKDF2 (100.000 iterações com salt seguro).
  - Gerenciamento de clientes com contatos e placas vinculadas.
  - Gerenciamento de placas com geração de código aleatório permanente de 6 caracteres (sem caracteres ambíguos como `0`, `O`, `1`, `I`).
  - Módulo de troca de link de destino com auditoria cronológica (quem alterou, quando e por qual motivo).
  - Gerador de arquivos para fabricação: download de PNG em ultra-alta resolução (2000px, 300 DPI) e SVG vetorial para corte a laser / impressão UV.
  - Backup e restauração com exportação de JSON e dump SQL.

---

## 2. Requisitos de Sistema

- **Node.js**: v18.0.0 ou superior (recomendado v20 LTS ou v22)
- **Gerenciador de Pacotes**: npm, pnpm ou bun
- **Cloudflare Wrangler CLI**: v3.x (instalado automaticamente via devDependencies)

---

## 3. Instalação Local

1. Clone ou extraia os arquivos do projeto em seu ambiente:
```bash
git clone <seu-repositorio> qr-placas
cd qr-placas
```

2. Instale as dependências:
```bash
npm install
```

---

## 4. Configuração de Variáveis de Ambiente

Crie o arquivo `.env` na raiz do projeto com base no modelo `.env.example`:

```bash
cp .env.example .env
```

Conteúdo recomendado para o `.env`:
```ini
# Porta do servidor local
PORT=3000

# Segredo criptográfico para assinatura das sessões JWT
SESSION_SECRET="sua_chave_secreta_longa_e_aleatoria_com_mais_de_32_caracteres"

# Domínio público das placas
APP_URL="http://localhost:3000"

# Administrador inicial automático
ADMIN_EMAIL="admin@qrplacas.com"
ADMIN_INITIAL_PASSWORD="sua_senha_segura_aqui"
```

---

## 5. Banco de Dados & Migrations

A plataforma utiliza **SQLite** nativo e é 100% compatível com **Cloudflare D1**.

- **Schema Principal**: `schema.sql`
- **Diretório de Migrations**: `migrations/0001_initial.sql`

Tabelas estruturadas:
- `users`: Administradores com senha em PBKDF2
- `customers`: Clientes com telefones, notas e status
- `qr_codes`: Placas com código público permanente (ex: `A7K92X`), destino e contadores
- `qr_code_history`: Histórico de todas as alterações de destino
- `settings`: Configurações de domínio e redirecionamento

---

## 6. Criação e Gestão do Administrador Inicial

Na primeira execução, o sistema verifica automaticamente se existe algum administrador cadastrado. Se a tabela estiver vazia, ele cria o usuário inicial utilizando as variáveis `ADMIN_EMAIL` e `ADMIN_INITIAL_PASSWORD`.

- **E-mail padrão**: `admin@qrplacas.com`
- **Senha padrão**: `admin123456`

> **Importante**: Logo após o primeiro login, acesse `/admin/configuracoes` para alterar a sua senha de acesso.

---

## 7. Execução Local

Para iniciar o servidor de desenvolvimento full-stack com suporte a API e hot-reload:

```bash
npm run dev
```

Acesse:
- **Painel Administrativo**: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)
- **Redirecionamento Público**: `http://localhost:3000/q/CODIGO`

---

## 8. Testes Automatizados

A plataforma inclui uma suíte completa com 31 verificações automáticas que testam login, criptografia, criação de placas, imutabilidade do código físico, bloqueio contra injeções, histórico de auditoria e persistência.

Para executar os testes:
```bash
npm test
```

---

## 9. Build de Produção

Para compilar a interface React e gerar os assets estáticos otimizados:

```bash
npm run build
```

Os arquivos finais serão gerados na pasta `./dist`.

---

## 10. Configuração na Cloudflare

O projeto possui o arquivo `wrangler.jsonc` pronto para deploy no **Cloudflare Workers**:

```jsonc
{
  "name": "qr-placas",
  "main": "worker.ts",
  "compatibility_date": "2024-09-23",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "qr-placas-db",
      "database_id": "SEU_DATABASE_ID_AQUI"
    }
  ]
}
```

---

## 11. Configuração do Cloudflare D1

1. Faça login na sua conta Cloudflare via terminal:
```bash
npx wrangler login
```

2. Crie o banco de dados D1:
```bash
npx wrangler d1 create qr-placas-db
```

O comando retornará uma saída com o `database_id`. Copie esse ID e cole no seu `wrangler.jsonc`:
```jsonc
"database_id": "c7a8b92d-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

3. Execute as migrations para criar as tabelas no D1 remoto:
```bash
npx wrangler d1 execute qr-placas-db --remote --file=./schema.sql
```

---

## 12. Configuração dos Secrets

Para não expor dados sensíveis no repositório, configure os segredos diretamente na Cloudflare:

```bash
# Define o segredo de assinatura de sessão
npx wrangler secret put SESSION_SECRET

# Define o e-mail do admin inicial
npx wrangler secret put ADMIN_EMAIL

# Define a senha do admin inicial
npx wrangler secret put ADMIN_INITIAL_PASSWORD
```

---

## 13. Configuração do Domínio Personalizado

Para usar seu próprio domínio (ex: `qr.meudominio.com.br`):

1. No painel da Cloudflare, vá em **Workers & Pages** > selecione `qr-placas`.
2. Acesse a aba **Settings** > **Triggers** > **Custom Domains**.
3. Clique em **Add Custom Domain** e digite `qr.meudominio.com.br`.
4. A Cloudflare configurará o DNS e o certificado SSL/HTTPS automaticamente em poucos minutos.
5. No painel administrativo da plataforma (`/admin/configuracoes`), atualize o campo **Domínio Personalizado** para `https://qr.meudominio.com.br`. Todas as novas placas e links copiados refletirão esse domínio.

---

## 14. Deploy na Cloudflare

Com o frontend compilado e o D1 criado, execute o deploy:

```bash
# 1. Compila os arquivos estáticos do frontend
npm run build

# 2. Envia o Worker e o frontend para a infraestrutura global da Cloudflare
npx wrangler deploy
```

Sua plataforma estará online globalmente com latência de redirecionamento inferior a 15ms no Edge.

---

## 15. Atualização do Sistema

Quando fizer melhorias no código:

1. Atualize os arquivos locais.
2. Execute os testes: `npm test`
3. Se houver alterações no banco de dados, adicione um novo arquivo em `migrations/` e execute:
```bash
npx wrangler d1 execute qr-placas-db --remote --file=./migrations/NOVA_MIGRATION.sql
```
4. Recompile e publique:
```bash
npm run build && npx wrangler deploy
```

---

## 16. Backup & Restauração

### Pelo Painel Administrativo:
1. Acesse `/admin/configuracoes`.
2. Na seção **Backup & Restauração**, clique em **Baixar Backup JSON**.
3. Um arquivo com timestamp contendo todos os clientes, QR codes e histórico será baixado.
4. Para restaurar, basta clicar em **Selecionar Arquivo de Backup** e escolher o arquivo JSON.

### Pelo Terminal (Cloudflare D1):
Para fazer backup direto do banco de dados D1:
```bash
# Exportar dump SQL completo do banco D1
npx wrangler d1 export qr-placas-db --remote --output=backup_$(date +%F).sql

# Restaurar dump SQL no banco D1
npx wrangler d1 execute qr-placas-db --remote --file=./backup_2026-09-29.sql
```

---

## 17. Solução de Problemas

- **Esqueci a senha do administrador**:
  - No ambiente local: delete o arquivo `.data/qr_placas.sqlite` para recriar o banco, ou gere um novo hash de senha via `test/run-tests.ts`.
  - No Cloudflare D1: execute uma instrução SQL direta via terminal:
  ```bash
  npx wrangler d1 execute qr-placas-db --remote --command="UPDATE users SET password_hash = 'NOVO_HASH' WHERE email = 'admin@qrplacas.com'"
  ```

- **O QR Code físico não redireciona**:
  - Verifique no painel se a placa está com o status **Ativo**.
  - Certifique-se de que a URL de destino inclui `https://` ou `http://`.
  - Verifique se o código escaneado corresponde com exatidão ao cadastrado (ex: `A7K92X`).

- **Erro de CORS em requisições de API**:
  - O `worker.ts` e o `server.ts` já incluem cabeçalhos CORS completos para `GET, POST, PUT, PATCH, DELETE`.

- **A placa foi danificada ou riscada**:
  - O QR Code gerado utiliza **nível de correção de erro H (High - 30%)**, garantindo legibilidade mesmo se até 30% da área impressa for arranhada ou coberta.
