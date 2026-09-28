import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const paymentUpdateSchema = z.object({
  estado: z.enum(['Pendiente', 'En Revisión', 'Confirmado', 'Requiere Aclaración']),
  motivoAclaracion: z.string().nullable().optional(),
  comentarioAdmin: z.string().nullable().optional(),
  fechaConfirmado: z.string().nullable().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get('pagos_cm_session')?.value;
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const payload = await verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Acceso no permitido' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = paymentUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos de pago inválidos', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { estado, motivoAclaracion, comentarioAdmin, fechaConfirmado } = parsed.data;

    // Check existing payment to decide fechaConfirmado
    const existingPago = await prisma.pago.findUnique({ where: { id } });

    let finalFechaConfirmado = existingPago?.fechaConfirmado;
    if (estado === 'Confirmado') {
      if (fechaConfirmado) {
        finalFechaConfirmado = new Date(fechaConfirmado);
      } else if (!existingPago?.fechaConfirmado) {
        finalFechaConfirmado = new Date();
      }
    } else {
      finalFechaConfirmado = null;
    }

    const updated = await prisma.pago.update({
      where: { id },
      data: {
        estado,
        motivoAclaracion: estado === 'Requiere Aclaración' ? motivoAclaracion?.trim() || 'Aclaración requerida por el colegio.' : null,
        comentarioAdmin: comentarioAdmin !== undefined ? comentarioAdmin?.trim() || null : existingPago?.comentarioAdmin,
        fechaConfirmado: finalFechaConfirmado,
      },
    });

    return NextResponse.json({ success: true, pago: updated });
  } catch (error) {
    console.error('Update payment error:', error);
    return NextResponse.json(
      { error: 'Error al actualizar el estado del pago' },
      { status: 500 }
    );
  }
}
