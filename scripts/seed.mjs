import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Neon.tech database with initial Admin user only...');

  // Clean out existing data
  await prisma.pago.deleteMany();
  await prisma.user.deleteMany();

  const adminPasswordHash = await bcrypt.hash('admin123', 10);

  // 1. Create initial Admin user
  const admin = await prisma.user.create({
    data: {
      nombre: 'Administrador General CM',
      usuario: 'adminCM',
      password: adminPasswordHash,
      passwordPlain: 'admin123',
      role: 'ADMIN',
      nivelEscolar: 'No aplica',
      grado: null,
      grupo: null,
      estado: 'Alta',
    },
  });

  console.log('Created Admin user successfully:', admin.usuario);
  console.log('Database cleaned and ready for Excel import.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
