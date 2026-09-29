import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'pagos-cm-super-secret-key-2026-cole-mex'
);

export interface UserSessionPayload {
  id: string;
  nombre: string;
  usuario: string;
  role: string;
  nivelEscolar: string;
  grado?: string | null;
  grupo?: string | null;
}

export async function hashPassword(password: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password.trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return password.trim();
  }
}

export async function comparePassword(password: string, hash: string, plain?: string): Promise<boolean> {
  const pTrim = password.trim();
  if (plain && pTrim === plain.trim()) return true;
  if (hash && pTrim === hash.trim()) return true;

  try {
    const sha = await hashPassword(pTrim);
    if (sha === hash.trim()) return true;
  } catch {}

  try {
    return await bcrypt.compare(pTrim, hash);
  } catch {
    return false;
  }
}

export async function createSessionToken(payload: UserSessionPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<UserSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as UserSessionPayload;
  } catch {
    return null;
  }
}
