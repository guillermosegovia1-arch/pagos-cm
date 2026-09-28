export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getConceptosForNivel } from '@/lib/concepts';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('pagos_cm_session')?.value;
  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const payload = await verifySessionToken(token);
  if (!payload || payload.role !== 'ALUMNO') {
    return NextResponse.json({ error: 'Acceso no permitido' }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    include: {
      pagos: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  const requiredConcepts = getConceptosForNivel(user.nivelEscolar);
  const existingConceptNames = new Set(user.pagos.map((p) => p.concepto));

  const missingConcepts = requiredConcepts.filter((c) => !existingConceptNames.has(c.concepto));

  if (missingConcepts.length > 0) {
    for (const mc of missingConcepts) {
      await prisma.pago.create({
        data: {
          userId: user.id,
          concepto: mc.concepto,
          tipo: mc.tipo,
          estado: 'Pendiente',
        },
      });
    }

    const updatedUser = await prisma.user.findUnique({
      where: { id: payload.id },
      include: {
        pagos: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return NextResponse.json({
      user: {
        id: updatedUser?.id,
        nombre: updatedUser?.nombre,
        usuario: updatedUser?.usuario,
        nivelEscolar: updatedUser?.nivelEscolar,
        grado: updatedUser?.grado,
        grupo: updatedUser?.grupo,
      },
      pagos: updatedUser?.pagos || [],
    });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      nombre: user.nombre,
      usuario: user.usuario,
      nivelEscolar: user.nivelEscolar,
      grado: user.grado,
      grupo: user.grupo,
    },
    pagos: user.pagos,
  });
}
