import { PrismaClient } from '@prisma/client';
import { PrismaNeonHttp } from '@prisma/adapter-neon';

const FALLBACK_DATABASE_URL =
  'postgresql://neondb_owner:npg_MY1RQZa0bIJB@ep-rapid-unit-b4bdxgsg-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require';

function getConnectionString(): string {
  try {
    if (typeof process !== 'undefined' && process.env && process.env.DATABASE_URL) {
      const envUrl = String(process.env.DATABASE_URL).trim();
      if ((envUrl.startsWith('postgresql://') || envUrl.startsWith('postgres://')) && !envUrl.includes('undefined')) {
        return envUrl;
      }
    }
  } catch (e) {
    // Ignore env error
  }
  return FALLBACK_DATABASE_URL;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const connectionString = getConnectionString();
const adapter = new PrismaNeonHttp(connectionString, {});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
