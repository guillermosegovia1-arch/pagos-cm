export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get('pagos_cm_session')?.value;
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const payload = await verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Acceso no permitido' }, { status: 403 });
  }

  try {
    // Delete payments belonging to graduates
    await prisma.pago.deleteMany({
      where: {
        user: {
          OR: [
            { nivelEscolar: 'Egresados' },
            { grado: 'Egresados' },
          ],
        },
      },
    });

    // Delete graduate user records
    const res = await prisma.user.deleteMany({
      where: {
        OR: [
          { nivelEscolar: 'Egresados' },
          { grado: 'Egresados' },
        ],
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: res.count,
      message: `Se eliminaron ${res.count} alumnos de la lista de Egresados.`,
    });
  } catch (error) {
    console.error('Error deleting graduates:', error);
    return NextResponse.json(
      { error: 'Error al eliminar la lista de alumnos egresados' },
      { status: 500 }
    );
  }
}
