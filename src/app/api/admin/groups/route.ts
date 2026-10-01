export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const addGroupSchema = z.object({
  nivelEscolar: z.string().min(1, 'El nivel escolar es requerido'),
  grado: z.string().min(1, 'El grado es requerido'),
  grupo: z.string().min(1, 'El grupo es requerido'),
  name: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const token = request.cookies.get('pagos_cm_session')?.value;
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const payload = await verifySessionToken(token);
  if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'SUPERVISOR')) {
    return NextResponse.json({ error: 'Acceso no permitido' }, { status: 403 });
  }

  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'custom_groups' },
    });

    let customGroups: Array<{ nivelEscolar: string; grado: string; grupo: string; name: string }> = [];
    if (setting?.value) {
      try {
        customGroups = JSON.parse(setting.value);
      } catch (e) {
        customGroups = [];
      }
    }

    return NextResponse.json({ customGroups });
  } catch (error) {
    console.error('Error fetching custom groups:', error);
    return NextResponse.json({ error: 'Error al obtener los grupos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get('pagos_cm_session')?.value;
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const payload = await verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Acceso no permitido' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = addGroupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos de grupo inválidos', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { nivelEscolar, grado, grupo, name } = parsed.data;
    const cleanGrado = grado.trim();
    const cleanGrupo = grupo.trim();
    const groupName = name ? name.trim() : `${cleanGrado}${cleanGrupo}`;

    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'custom_groups' },
    });

    let customGroups: Array<{ nivelEscolar: string; grado: string; grupo: string; name: string }> = [];
    if (setting?.value) {
      try {
        customGroups = JSON.parse(setting.value);
      } catch (e) {
        customGroups = [];
      }
    }

    const alreadyExists = customGroups.some(
      (g) => g.grado.toLowerCase() === cleanGrado.toLowerCase() && g.grupo.toLowerCase() === cleanGrupo.toLowerCase()
    );

    if (!alreadyExists) {
      customGroups.push({
        nivelEscolar: nivelEscolar.trim(),
        grado: cleanGrado,
        grupo: cleanGrupo,
        name: groupName,
      });

      await prisma.systemSetting.upsert({
        where: { key: 'custom_groups' },
        update: { value: JSON.stringify(customGroups) },
        create: { key: 'custom_groups', value: JSON.stringify(customGroups) },
      });
    }

    return NextResponse.json({ success: true, customGroups, newGroup: { nivelEscolar, grado: cleanGrado, grupo: cleanGrupo, name: groupName } });
  } catch (error) {
    console.error('Error adding custom group:', error);
    return NextResponse.json({ error: 'Error al agregar el grupo' }, { status: 500 });
  }
}
