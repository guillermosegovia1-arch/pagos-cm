export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const settingSchema = z.object({
  cicloEscolar: z.string().min(1, 'El ciclo escolar es requerido'),
});

export async function PUT(request: NextRequest) {
  const token = request.cookies.get('pagos_cm_session')?.value;
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const payload = await verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Acceso no permitido' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = settingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'El ciclo escolar es requerido' }, { status: 400 });
    }

    const value = parsed.data.cicloEscolar.trim();

    const setting = await prisma.systemSetting.upsert({
      where: { key: 'cicloEscolar' },
      update: { value },
      create: { key: 'cicloEscolar', value },
    });

    return NextResponse.json({ success: true, cicloEscolar: setting.value });
  } catch (err) {
    console.error('Error updating ciclo escolar:', err);
    return NextResponse.json({ error: 'Error al actualizar el ciclo escolar' }, { status: 500 });
  }
}
