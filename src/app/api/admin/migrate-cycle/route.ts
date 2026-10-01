export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const token = request.cookies.get('pagos_cm_session')?.value;
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const payload = await verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Acceso no permitido' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const newCicloEscolar = body.newCicloEscolar ? String(body.newCicloEscolar).trim() : null;

    // 1. Advance students in reverse order so no grade is promoted twice:
    // 12th Preparatoria -> Egresados
    await prisma.$executeRawUnsafe(`
      UPDATE "User"
      SET "nivelEscolar" = 'Egresados', "grado" = '12'
      WHERE "role" = 'ALUMNO' AND "nivelEscolar" = 'Preparatoria' AND "grado" = '12'
    `);

    // 11th Preparatoria -> 12th Preparatoria
    await prisma.$executeRawUnsafe(`
      UPDATE "User"
      SET "grado" = '12'
      WHERE "role" = 'ALUMNO' AND "nivelEscolar" = 'Preparatoria' AND "grado" = '11'
    `);

    // 10th Preparatoria -> 11th Preparatoria
    await prisma.$executeRawUnsafe(`
      UPDATE "User"
      SET "grado" = '11'
      WHERE "role" = 'ALUMNO' AND "nivelEscolar" = 'Preparatoria' AND "grado" = '10'
    `);

    // 9th Secundaria -> 10th Preparatoria
    await prisma.$executeRawUnsafe(`
      UPDATE "User"
      SET "nivelEscolar" = 'Preparatoria', "grado" = '10'
      WHERE "role" = 'ALUMNO' AND "nivelEscolar" = 'Secundaria' AND "grado" = '9'
    `);

    // 8th Secundaria -> 9th Secundaria
    await prisma.$executeRawUnsafe(`
      UPDATE "User"
      SET "grado" = '9'
      WHERE "role" = 'ALUMNO' AND "nivelEscolar" = 'Secundaria' AND "grado" = '8'
    `);

    // 7th Secundaria -> 8th Secundaria
    await prisma.$executeRawUnsafe(`
      UPDATE "User"
      SET "grado" = '8'
      WHERE "role" = 'ALUMNO' AND "nivelEscolar" = 'Secundaria' AND "grado" = '7'
    `);

    // 6th Primaria -> 7th Secundaria
    await prisma.$executeRawUnsafe(`
      UPDATE "User"
      SET "nivelEscolar" = 'Secundaria', "grado" = '7'
      WHERE "role" = 'ALUMNO' AND "nivelEscolar" = 'Primaria' AND "grado" = '6'
    `);

    // 5th Primaria -> 6th Primaria
    await prisma.$executeRawUnsafe(`
      UPDATE "User"
      SET "grado" = '6'
      WHERE "role" = 'ALUMNO' AND "nivelEscolar" = 'Primaria' AND "grado" = '5'
    `);

    // 4th Primaria -> 5th Primaria
    await prisma.$executeRawUnsafe(`
      UPDATE "User"
      SET "grado" = '5'
      WHERE "role" = 'ALUMNO' AND "nivelEscolar" = 'Primaria' AND "grado" = '4'
    `);

    // 3rd Primaria -> 4th Primaria
    await prisma.$executeRawUnsafe(`
      UPDATE "User"
      SET "grado" = '4'
      WHERE "role" = 'ALUMNO' AND "nivelEscolar" = 'Primaria' AND "grado" = '3'
    `);

    // 2nd Primaria -> 3rd Primaria
    await prisma.$executeRawUnsafe(`
      UPDATE "User"
      SET "grado" = '3'
      WHERE "role" = 'ALUMNO' AND "nivelEscolar" = 'Primaria' AND "grado" = '2'
    `);

    // 1st Primaria -> 2nd Primaria
    await prisma.$executeRawUnsafe(`
      UPDATE "User"
      SET "grado" = '2'
      WHERE "role" = 'ALUMNO' AND "nivelEscolar" = 'Primaria' AND "grado" = '1'
    `);

    // K3 Kinder -> 1st Primaria
    await prisma.$executeRawUnsafe(`
      UPDATE "User"
      SET "nivelEscolar" = 'Primaria', "grado" = '1'
      WHERE "role" = 'ALUMNO' AND "nivelEscolar" = 'Kinder' AND ("grado" = 'K3' OR "grado" = '3')
    `);

    // K2 Kinder -> K3 Kinder
    await prisma.$executeRawUnsafe(`
      UPDATE "User"
      SET "grado" = 'K3'
      WHERE "role" = 'ALUMNO' AND "nivelEscolar" = 'Kinder' AND ("grado" = 'K2' OR "grado" = '2')
    `);

    // K1 Kinder -> K2 Kinder
    await prisma.$executeRawUnsafe(`
      UPDATE "User"
      SET "grado" = 'K2'
      WHERE "role" = 'ALUMNO' AND "nivelEscolar" = 'Kinder' AND ("grado" = 'K1' OR "grado" = '1')
    `);

    // N2 Maternal -> K1 Kinder
    await prisma.$executeRawUnsafe(`
      UPDATE "User"
      SET "nivelEscolar" = 'Kinder', "grado" = 'K1'
      WHERE "role" = 'ALUMNO' AND "nivelEscolar" = 'Maternal' AND ("grado" = 'N2' OR "grado" = '2')
    `);

    // N1 Pre - Maternal -> N2 Maternal
    await prisma.$executeRawUnsafe(`
      UPDATE "User"
      SET "nivelEscolar" = 'Maternal', "grado" = 'N2'
      WHERE "role" = 'ALUMNO' AND ("nivelEscolar" = 'Pre - Maternal' OR "nivelEscolar" = 'Pre-Maternal') AND ("grado" = 'N1' OR "grado" = '1')
    `);

    // 2. Refresh payment concepts for the new cycle
    // Delete previous payments for all student accounts
    await prisma.$executeRawUnsafe(`
      DELETE FROM "Pago"
      WHERE "userId" IN (SELECT "id" FROM "User" WHERE "role" = 'ALUMNO')
    `);

    // Re-create concept rows for active students (excluding Egresados and No aplica)
    // 1) Lypro (Anual) - all active levels
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Pago" ("id", "userId", "concepto", "tipo", "estado", "createdAt", "updatedAt")
      SELECT gen_random_uuid(), "id", 'Lypro (Anual)', 'ANUAL', 'Pendiente', NOW(), NOW()
      FROM "User"
      WHERE "role" = 'ALUMNO' AND "nivelEscolar" NOT IN ('No aplica', 'Egresados')
    `);

    // 2) Cuota escolar (Anual) - all active levels
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Pago" ("id", "userId", "concepto", "tipo", "estado", "createdAt", "updatedAt")
      SELECT gen_random_uuid(), "id", 'Cuota escolar (Anual)', 'ANUAL', 'Pendiente', NOW(), NOW()
      FROM "User"
      WHERE "role" = 'ALUMNO' AND "nivelEscolar" NOT IN ('No aplica', 'Egresados')
    `);

    // 3) Inscripción o reinscripción (Anual) - all active levels
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Pago" ("id", "userId", "concepto", "tipo", "estado", "createdAt", "updatedAt")
      SELECT gen_random_uuid(), "id", 'Inscripción o reinscripción (Anual)', 'ANUAL', 'Pendiente', NOW(), NOW()
      FROM "User"
      WHERE "role" = 'ALUMNO' AND "nivelEscolar" NOT IN ('No aplica', 'Egresados')
    `);

    // 4) Colegiatura (Mensual) - all active levels
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Pago" ("id", "userId", "concepto", "tipo", "estado", "createdAt", "updatedAt")
      SELECT gen_random_uuid(), "id", 'Colegiatura (Mensual)', 'MENSUAL', 'Pendiente', NOW(), NOW()
      FROM "User"
      WHERE "role" = 'ALUMNO' AND "nivelEscolar" NOT IN ('No aplica', 'Egresados')
    `);

    // 5) Cuota de tecnología (Anual) - Kinder, Primaria, Secundaria, Preparatoria
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Pago" ("id", "userId", "concepto", "tipo", "estado", "createdAt", "updatedAt")
      SELECT gen_random_uuid(), "id", 'Cuota de tecnología (Anual)', 'ANUAL', 'Pendiente', NOW(), NOW()
      FROM "User"
      WHERE "role" = 'ALUMNO' AND "nivelEscolar" IN ('Kinder', 'Kínder 1', 'Kínder 2', 'Kínder 3', 'Primaria', 'Secundaria', 'Preparatoria')
    `);

    // 6) Knotion (Anual) - Kinder, Primaria, Secundaria
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Pago" ("id", "userId", "concepto", "tipo", "estado", "createdAt", "updatedAt")
      SELECT gen_random_uuid(), "id", 'Knotion (Anual)', 'ANUAL', 'Pendiente', NOW(), NOW()
      FROM "User"
      WHERE "role" = 'ALUMNO' AND "nivelEscolar" IN ('Kinder', 'Kínder 1', 'Kínder 2', 'Kínder 3', 'Primaria', 'Secundaria')
    `);

    // 7) Cuota de material (Anual) - Pre - Maternal, Maternal, Kinder
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Pago" ("id", "userId", "concepto", "tipo", "estado", "createdAt", "updatedAt")
      SELECT gen_random_uuid(), "id", 'Cuota de material (Anual)', 'ANUAL', 'Pendiente', NOW(), NOW()
      FROM "User"
      WHERE "role" = 'ALUMNO' AND "nivelEscolar" IN ('Pre - Maternal', 'Pre-Maternal', 'Maternal', 'Pre-Maternal y Maternal', 'Kinder', 'Kínder 1', 'Kínder 2', 'Kínder 3')
    `);

    // 3. Update Ciclo Escolar setting if provided
    if (newCicloEscolar) {
      await prisma.systemSetting.upsert({
        where: { key: 'cicloEscolar' },
        update: { value: newCicloEscolar },
        create: { key: 'cicloEscolar', value: newCicloEscolar },
      });
    }

    // Count graduates and total active students
    const graduatesCount = await prisma.user.count({
      where: { OR: [{ nivelEscolar: 'Egresados' }, { grado: 'Egresados' }] },
    });
    const totalStudents = await prisma.user.count({
      where: { role: 'ALUMNO' },
    });

    return NextResponse.json({
      success: true,
      graduatesCount,
      totalStudents,
      cicloEscolar: newCicloEscolar,
      message: 'Migración de ciclo escolar completada exitosamente.',
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Error al ejecutar la migración de ciclo escolar' },
      { status: 500 }
    );
  }
}
