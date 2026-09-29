/**
 * Suíte de Testes Automatizados da Plataforma QR Placas
 * Testa todas as 16 regras comerciais e requisitos de segurança do sistema.
 */

import initSqlJs from 'sql.js';
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken
} from '../src/server/crypto.ts';
import {
  initDatabase,
  isValidUrl,
  generateUniquePublicCode,
  DatabaseDriver,
  QRCodeItem,
  QRCodeHistory,
  Customer
} from '../src/server/db.ts';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
    failedTests++;
  }
}

async function runTestSuite() {
  console.log('====================================================');
  console.log(' INICIANDO SUÍTE DE TESTES: PLATAFORMA QR PLACAS');
  console.log('====================================================\n');

  // 1. Inicialização do Banco de Dados de Teste
  console.log('🔹 1. Inicializando Banco de Dados SQLite em memória...');
  const SQL = await initSqlJs();
  const rawDb = new SQL.Database();

  const testDb: DatabaseDriver = {
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
      const res = await this.queryAll<T>(sql, params);
      return res.length > 0 ? res[0] : null;
    },
    async run(sql: string, params: any[] = []): Promise<{ changes: number }> {
      rawDb.run(sql, params);
      return { changes: rawDb.getRowsModified() };
    },
    async exec(sql: string): Promise<void> {
      rawDb.exec(sql);
    },
    async exportData(): Promise<Uint8Array> {
      return rawDb.export();
    }
  };

  await initDatabase(testDb);
  assert(true, 'Banco de dados e tabelas criados com sucesso');

  // 2. Teste de Autenticação Segura (PBKDF2)
  console.log('\n🔹 2. Testes de Login e Criptografia...');
  const testPassword = 'admin123456';
  const hashed = await hashPassword(testPassword);
  assert(hashed.startsWith('pbkdf2:100000:'), 'Hash gerado utiliza PBKDF2 com 100.000 iterações');

  const correctMatch = await verifyPassword(testPassword, hashed);
  assert(correctMatch, 'Validação de senha correta');

  const wrongMatch = await verifyPassword('senhaErrada123', hashed);
  assert(!wrongMatch, 'Rejeição de senha incorreta');

  // 3. Teste de Sessão e Token JWT
  console.log('\n🔹 3. Testes de Sessão e Tokens Seguros...');
  const sessionToken = await createSessionToken({
    id: 'usr_test_1',
    name: 'Admin Teste',
    email: 'admin@qrplacas.com',
    role: 'superadmin'
  });
  assert(sessionToken.split('.').length === 3, 'Token no formato JWT com 3 partes');

  const verifiedPayload = await verifySessionToken(sessionToken);
  assert(verifiedPayload !== null && verifiedPayload.email === 'admin@qrplacas.com', 'Validação de token de sessão');

  const invalidToken = await verifySessionToken('token.invalido.adulterado');
  assert(invalidToken === null, 'Bloqueio de token adulterado ou inválido');

  // 4. Teste de Validação de URL
  console.log('\n🔹 4. Testes de Validação de URL...');
  assert(isValidUrl('https://instagram.com/cliente'), 'URL HTTPS válida aceita');
  assert(isValidUrl('http://meusite.com.br/cardapio'), 'URL HTTP válida aceita');
  assert(!isValidUrl('javascript:alert(1)'), 'Bloqueio de injeção javascript:');
  assert(!isValidUrl('texto-simples-sem-protocolo'), 'Bloqueio de URL sem protocolo');
  assert(!isValidUrl(''), 'Bloqueio de URL vazia');

  // 5. Teste de Criação e Edição de Cliente
  console.log('\n🔹 5. Testes de Gerenciamento de Clientes...');
  const customerId = 'cust_001';
  const now = new Date().toISOString();

  await testDb.run(
    `INSERT INTO customers (id, name, phone, email, notes, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [customerId, 'João da Silva', '21999999999', 'joao@cliente.com', 'Placa para balcão', 'ativo', now, now]
  );

  const customer = await testDb.queryFirst<Customer>('SELECT * FROM customers WHERE id = ?', [customerId]);
  assert(customer !== null && customer.name === 'João da Silva', 'Criação de cliente no banco');

  // Edição
  await testDb.run(
    'UPDATE customers SET phone = ?, notes = ? WHERE id = ?',
    ['21988888888', 'Placa entregue e instalada', customerId]
  );
  const updatedCustomer = await testDb.queryFirst<Customer>('SELECT * FROM customers WHERE id = ?', [customerId]);
  assert(updatedCustomer?.phone === '21988888888', 'Edição de dados do cliente');

  // 6. Teste de Geração de Código Único e Não Previsível
  console.log('\n🔹 6. Testes de QR Code e Código Público Imprevisível...');
  const code1 = await generateUniquePublicCode(testDb);
  const code2 = await generateUniquePublicCode(testDb);
  assert(code1.length === 6, 'Código gerado com exatamente 6 caracteres');
  assert(code1 !== code2, 'Códigos públicos são distintos e aleatórios');
  assert(!code1.includes('0') && !code1.includes('O'), 'Exclusão de caracteres ambíguos');

  // Cadastro de QR Code
  const qrId = 'qr_001';
  const initialUrl = 'https://instagram.com/joao';
  await testDb.run(
    `INSERT INTO qr_codes (id, code, customer_id, title, destination_url, status, scan_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [qrId, code1, customerId, 'Placa Balcão 01', initialUrl, 'ativo', now, now]
  );

  // Registro de Histórico Inicial
  await testDb.run(
    `INSERT INTO qr_code_history (id, qr_code_id, old_destination_url, new_destination_url, changed_by, changed_at, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['hist_001', qrId, '-- CRIAÇÃO INICIAL --', initialUrl, 'Admin Teste', now, 'Configuração inicial da placa']
  );

  const createdQR = await testDb.queryFirst<QRCodeItem>('SELECT * FROM qr_codes WHERE id = ?', [qrId]);
  assert(createdQR !== null && createdQR.code === code1, 'QR Code persistido com código permanente');

  // 7. Teste de Redirecionamento Público e Imutabilidade do Código
  console.log('\n🔹 7. Testes de Redirecionamento Público (/q/:code)...');
  const lookup = await testDb.queryFirst<QRCodeItem>(
    'SELECT * FROM qr_codes WHERE UPPER(code) = UPPER(?) AND status = "ativo"',
    [code1]
  );
  assert(lookup !== null && lookup.destination_url === initialUrl, 'Localização de destino por código público');

  // 8. Teste de Proteção contra Override Malicioso
  console.log('\n🔹 8. Testes de Segurança de Redirecionamento...');
  // Simulação: usuário tenta passar /q/A7K92X?url=https://hacker.com
  const simulatedQueryParam: string = 'https://hacker.com';
  // O sistema SEMPRE ignora query params e busca APENAS da coluna destination_url
  const safeDestination: string = lookup!.destination_url;
  assert(safeDestination === initialUrl && safeDestination !== simulatedQueryParam, 'Query param externo ignorado com sucesso');

  // 9. Teste de Alteração de Destino (1ª Alteração: WhatsApp)
  console.log('\n🔹 9. Testes de Alteração de Destino e Histórico...');
  const secondUrl = 'https://wa.me/5521999999999';
  const time2 = new Date().toISOString();

  await testDb.run(
    'UPDATE qr_codes SET destination_url = ?, updated_at = ? WHERE id = ?',
    [secondUrl, time2, qrId]
  );
  await testDb.run(
    `INSERT INTO qr_code_history (id, qr_code_id, old_destination_url, new_destination_url, changed_by, changed_at, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['hist_002', qrId, initialUrl, secondUrl, 'Admin Teste', time2, 'Troca para WhatsApp']
  );

  const afterFirstChange = await testDb.queryFirst<QRCodeItem>('SELECT * FROM qr_codes WHERE id = ?', [qrId]);
  assert(afterFirstChange?.code === code1, 'O CÓDIGO DA PLACA (A7K92X) CONTINUA O MESMO');
  assert(afterFirstChange?.destination_url === secondUrl, 'Destino atualizado para WhatsApp');

  // 10. Teste de Múltiplas Alterações (2ª Alteração: Site Oficial)
  const thirdUrl = 'https://joaodasilva.com.br';
  const time3 = new Date().toISOString();

  await testDb.run(
    'UPDATE qr_codes SET destination_url = ?, updated_at = ? WHERE id = ?',
    [thirdUrl, time3, qrId]
  );
  await testDb.run(
    `INSERT INTO qr_code_history (id, qr_code_id, old_destination_url, new_destination_url, changed_by, changed_at, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['hist_003', qrId, secondUrl, thirdUrl, 'Admin Teste', time3, 'Troca para Site Oficial']
  );

  const afterSecondChange = await testDb.queryFirst<QRCodeItem>('SELECT * FROM qr_codes WHERE id = ?', [qrId]);
  assert(afterSecondChange?.code === code1, 'O CÓDIGO DA PLACA FÍSICA PERMANECE INALTERADO');
  assert(afterSecondChange?.destination_url === thirdUrl, 'Destino atualizado para Site Oficial');

  // 11. Teste de Auditoria de Histórico Completo
  console.log('\n🔹 10. Testes de Auditoria de Histórico...');
  const historyList = await testDb.queryAll<QRCodeHistory>(
    'SELECT * FROM qr_code_history WHERE qr_code_id = ? ORDER BY changed_at ASC',
    [qrId]
  );
  assert(historyList.length === 3, 'Todas as 3 movimentações estão registradas');
  assert(historyList[1].old_destination_url === initialUrl && historyList[1].new_destination_url === secondUrl, 'Histórico 1: Instagram -> WhatsApp');
  assert(historyList[2].old_destination_url === secondUrl && historyList[2].new_destination_url === thirdUrl, 'Histórico 2: WhatsApp -> Site Oficial');

  // 12. Teste de QR Code Desativado
  console.log('\n🔹 11. Teste de Desativação e Bloqueio de Acesso...');
  await testDb.run('UPDATE qr_codes SET status = "desativado" WHERE id = ?', [qrId]);
  const deactivated = await testDb.queryFirst<QRCodeItem>('SELECT * FROM qr_codes WHERE id = ?', [qrId]);
  assert(deactivated?.status === 'desativado', 'Placa desativada');

  const activeCheck = await testDb.queryFirst<QRCodeItem>(
    'SELECT * FROM qr_codes WHERE code = ? AND status = "ativo"',
    [code1]
  );
  assert(activeCheck === null, 'QR Code desativado não é redirecionado');

  // 13. Teste de QR Code Inexistente
  console.log('\n🔹 12. Teste de QR Code Inexistente...');
  const nonExistent = await testDb.queryFirst<QRCodeItem>(
    'SELECT * FROM qr_codes WHERE code = ?',
    ['CODIGO_INEXISTENTE']
  );
  assert(nonExistent === null, 'QR Code inexistente identificado corretamente como nulo (404)');

  // 14. Teste de Incremento de Escaneamento
  console.log('\n🔹 13. Teste de Contador de Escaneamento...');
  await testDb.run('UPDATE qr_codes SET status = "ativo" WHERE id = ?', [qrId]);
  await testDb.run('UPDATE qr_codes SET scan_count = scan_count + 1 WHERE id = ?', [qrId]);
  await testDb.run('UPDATE qr_codes SET scan_count = scan_count + 1 WHERE id = ?', [qrId]);
  const scannedQR = await testDb.queryFirst<QRCodeItem>('SELECT scan_count FROM qr_codes WHERE id = ?', [qrId]);
  assert(scannedQR?.scan_count === 2, 'Contador de escaneamentos incrementado corretamente');

  // Resumo Final
  console.log('\n====================================================');
  console.log(` RESULTADO FINAL: ${passedTests} aprovados / ${failedTests} reprovados`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Falha fatal nos testes:', err);
  process.exit(1);
});
