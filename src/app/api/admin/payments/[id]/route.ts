export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const paymentUpdateSchema = z.object({
  estado: z.enum(['Pendiente', 'En Revisión', 'Confirmado', 'Requiere Aclaración']),
  motivoAclaracion: z.string().nullable().optional(),
  comentarioAdmin: z.string().nullable().optional(),
  notaConcepto: z.string().nullable().optional(),
  mesColegiatura: z.string().nullable().optional(),
  fechaVencimiento: z.string().nullable().optional(),
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

    const { estado, motivoAclaracion, comentarioAdmin, notaConcepto, mesColegiatura, fechaVencimiento, fechaConfirmado } = parsed.data;

    const existingPago = await prisma.pago.findUnique({ where: { id } });

    let finalFechaConfirmado: Date | null = null;
    if (estado === 'Confirmado') {
      if (fechaConfirmado && typeof fechaConfirmado === 'string' && fechaConfirmado.trim().length > 0) {
        const iso = fechaConfirmado.includes('T') ? fechaConfirmado : `${fechaConfirmado.trim()}T12:00:00`;
        const d = new Date(iso);
        finalFechaConfirmado = isNaN(d.getTime()) ? new Date() : d;
      } else if (existingPago?.fechaConfirmado) {
        finalFechaConfirmado = existingPago.fechaConfirmado;
      } else {
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
        notaConcepto: notaConcepto !== undefined ? notaConcepto?.trim() || null : existingPago?.notaConcepto,
        mesColegiatura: mesColegiatura !== undefined ? mesColegiatura?.trim() || null : existingPago?.mesColegiatura,
        fechaVencimiento: fechaVencimiento !== undefined ? (fechaVencimiento ? new Date(fechaVencimiento.includes('T') ? fechaVencimiento : `${fechaVencimiento}T12:00:00`) : null) : existingPago?.fechaVencimiento,
        fechaConfirmado: finalFechaConfirmado,
      },
    });

    return NextResponse.json(
      { success: true, pago: updated },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Update payment error:', error);
    return NextResponse.json(
      { error: 'Error al actualizar el estado del pago' },
      { status: 500 }
    );
  }
}
