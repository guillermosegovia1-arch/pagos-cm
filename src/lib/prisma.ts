import { PrismaClient } from '@prisma/client';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';

const DEFAULT_NEON_URL =
  'postgresql://neondb_owner:npg_MY1RQZa0bIJB@ep-rapid-unit-b4bdxgsg-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require';

function getValidConnectionString(): string {
  const envUrl = typeof process !== 'undefined' && process.env ? process.env.DATABASE_URL : undefined;
  if (envUrl && typeof envUrl === 'string') {
    const trimmed = envUrl.trim();
    if ((trimmed.startsWith('postgresql://') || trimmed.startsWith('postgres://')) && !trimmed.includes('undefined')) {
      return trimmed;
    }
  }
  return DEFAULT_NEON_URL;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const createPrismaClient = () => {
  const connectionString = getValidConnectionString();

  if (typeof WebSocket !== 'undefined') {
    neonConfig.webSocketConstructor = WebSocket;
  }

  try {
    const pool = new Pool({ connectionString });
    const adapter = new PrismaNeon(pool as any);
    return new PrismaClient({ adapter });
  } catch (e) {
    console.error('Prisma pool error:', e);
    const pool = new Pool({ connectionString: DEFAULT_NEON_URL });
    const adapter = new PrismaNeon(pool as any);
    return new PrismaClient({ adapter });
  }
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

