import { PrismaClient } from '@prisma/client';
import { Pool } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const createPrismaClient = () => {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://neondb_owner:npg_MY1RQZa0bIJB@ep-rapid-unit-b4bdxgsg-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require';

  try {
    const pool = new Pool({ connectionString });
    const adapter = new PrismaNeon(pool as any);
    return new PrismaClient({ adapter });
  } catch (e) {
    console.error('Prisma initialization error:', e);
    return new PrismaClient();
  }
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
