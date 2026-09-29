/**
 * Criptografia e Autenticação Segura compatível com Node.js e Cloudflare Workers (Web Crypto API)
 */

const SESSION_SECRET_DEFAULT = 'qr-placas-production-secret-change-in-env-cf-d1-secure-key';

let runtimeSecret: string | null = null;

export function setRuntimeSecret(secret?: string | null): void {
  if (secret) {
    runtimeSecret = secret;
  }
}

function getSecretKey(): string {
  if (runtimeSecret) {
    return runtimeSecret;
  }
  return (typeof process !== 'undefined' && process.env?.SESSION_SECRET) || SESSION_SECRET_DEFAULT;
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function base64UrlEncode(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf-8').toString('base64url');
  }
  const b64 = btoa(str);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'base64').toString('utf-8');
  }
  return atob(str);
}

/**
 * Cria hash seguro de senha utilizando PBKDF2 com HMAC-SHA256 e Salt aleatório de 16 bytes.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const iterations = 100000;
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  const saltHex = bufferToHex(salt.buffer);
  const hashHex = bufferToHex(derivedBits);

  return `pbkdf2:${iterations}:${saltHex}:${hashHex}`;
}

/**
 * Verifica se a senha corresponde ao hash seguro armazenado.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split(':');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
      return false;
    }

    const iterations = parseInt(parts[1], 10);
    const salt = hexToBuffer(parts[2]);
    const expectedHashHex = parts[3];

    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt as any,
        iterations: iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );

    const actualHashHex = bufferToHex(derivedBits);
    return actualHashHex === expectedHashHex;
  } catch (error) {
    console.error('Erro ao verificar senha:', error);
    return false;
  }
}

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
  exp: number;
}

/**
 * Gera um token de sessão assinado (JWT HMAC-SHA256)
 */
export async function createSessionToken(
  user: { id: string; email: string; name: string; role: string },
  expiresInSeconds = 7 * 24 * 60 * 60
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    exp
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${headerB64}.${payloadB64}`;

  const enc = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(getSecretKey()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', secretKey, enc.encode(dataToSign));
  const signatureB64 = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));

  return `${dataToSign}.${signatureB64}`;
}

/**
 * Valida o token de sessão e retorna o payload se for válido
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const dataToSign = `${headerB64}.${payloadB64}`;

    const enc = new TextEncoder();
    const secretKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(getSecretKey()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigRaw = base64UrlDecode(signatureB64);
    const sigBytes = new Uint8Array(sigRaw.length);
    for (let i = 0; i < sigRaw.length; i++) {
      sigBytes[i] = sigRaw.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify('HMAC', secretKey, sigBytes, enc.encode(dataToSign));
    if (!isValid) return null;

    const payload: SessionPayload = JSON.parse(base64UrlDecode(payloadB64));
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expirado
    }

    return payload;
  } catch (err) {
    return null;
  }
}
