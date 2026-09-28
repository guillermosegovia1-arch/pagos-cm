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
    return await bcrypt.hash(password, 10);
  } catch {
    return password;
  }
}

export async function comparePassword(password: string, hash: string, plain?: string): Promise<boolean> {
  if (plain && password.trim() === plain.trim()) return true;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return plain ? password.trim() === plain.trim() : false;
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
