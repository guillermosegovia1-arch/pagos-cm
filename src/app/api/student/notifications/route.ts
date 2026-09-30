export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Deriva notificaciones del historial de pagos del alumno.
 * Detecta cualquier pago cuyo estado sea: Confirmado, Requiere Aclaración,
 * o En Revisión y lo devuelve como notificación ordenada por updatedAt desc.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get('pagos_cm_session')?.value;
  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const payload = await verifySessionToken(token);
  if (!payload || payload.role !== 'ALUMNO') {
    return NextResponse.json({ error: 'Acceso no permitido' }, { status: 403 });
  }

  // Obtenemos los pagos con actividad administrativa (no "Pendiente" puro)
  const pagos = await prisma.pago.findMany({
    where: {
      userId: payload.id,
      estado: { not: 'Pendiente' },
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });

  const notificaciones = pagos.map((p) => {
    let titulo = '';
    let mensaje = '';
    let tipo: 'confirmado' | 'revision' | 'aclaracion' = 'revision';

    if (p.estado === 'Confirmado') {
      titulo = 'Pago confirmado ✓';
      mensaje = `Tu pago de "${p.concepto}" fue verificado y confirmado por el colegio.`;
      tipo = 'confirmado';
    } else if (p.estado === 'En Revisión') {
      titulo = 'Pago en revisión';
      mensaje = `Tu reporte de pago de "${p.concepto}" está siendo revisado por el colegio.`;
      tipo = 'revision';
    } else if (p.estado === 'Requiere Aclaración') {
      titulo = 'Se requiere aclaración ⚠️';
      mensaje = `El colegio solicitó una aclaración sobre tu pago de "${p.concepto}".${p.motivoAclaracion ? ` Motivo: ${p.motivoAclaracion}` : ''}`;
      tipo = 'aclaracion';
    }

    return {
      id: p.id,
      pagoId: p.id,
      titulo,
      mensaje,
      tipo,
      pagoTipo: p.tipo,
      mesColegiatura: p.mesColegiatura,
      concepto: p.concepto,
      estado: p.estado,
      fechaActualizacion: p.updatedAt.toISOString(),
    };
  });

  return NextResponse.json({ notificaciones });
}
