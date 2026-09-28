export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const reportSchema = z.object({
  pagoId: z.string().min(1, 'El ID del pago es requerido'),
  numeroConfirmacion: z.string().min(1, 'El número de confirmación es obligatorio'),
});

export async function POST(request: NextRequest) {
  const token = request.cookies.get('pagos_cm_session')?.value;
  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const payload = await verifySessionToken(token);
  if (!payload || payload.role !== 'ALUMNO') {
    return NextResponse.json({ error: 'Acceso no permitido' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = reportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'El número de confirmación es obligatorio' },
        { status: 400 }
      );
    }

    const { pagoId, numeroConfirmacion } = parsed.data;

    const pago = await prisma.pago.findUnique({
      where: { id: pagoId },
    });

    if (!pago || pago.userId !== payload.id) {
      return NextResponse.json(
        { error: 'Concepto de pago no encontrado' },
        { status: 404 }
      );
    }

    const updated = await prisma.pago.update({
      where: { id: pagoId },
      data: {
        estado: 'En Revisión',
        numeroConfirmacion: numeroConfirmacion.trim(),
        fechaReportado: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      pago: updated,
      message: 'En Revisión: El colegio está verificando el reporte recibido. (Espere de 1 a 3 días)',
    });
  } catch (error) {
    console.error('Report payment error:', error);
    return NextResponse.json(
      { error: 'Error al registrar el reporte de pago' },
      { status: 500 }
    );
  }
}
