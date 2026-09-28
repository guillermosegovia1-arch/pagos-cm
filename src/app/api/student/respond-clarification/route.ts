export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const respondSchema = z.object({
  pagoId: z.string().min(1),
  respuestaAlumno: z.string().min(1, 'La respuesta es obligatoria'),
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
    const parsed = respondSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Debe ingresar una respuesta o número aclaratorio' },
        { status: 400 }
      );
    }

    const { pagoId, respuestaAlumno } = parsed.data;

    const pago = await prisma.pago.findUnique({
      where: { id: pagoId },
    });

    if (!pago || pago.userId !== payload.id) {
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
    }

    const updated = await prisma.pago.update({
      where: { id: pagoId },
      data: {
        respuestaAlumno: respuestaAlumno.trim(),
        estado: 'En Revisión',
        fechaReportado: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      pago: updated,
      message: 'Respuesta enviada. El colegio revisará la aclaración.',
    });
  } catch (error) {
    console.error('Clarification response error:', error);
    return NextResponse.json(
      { error: 'Error al enviar la respuesta de aclaración' },
      { status: 500 }
    );
  }
}
