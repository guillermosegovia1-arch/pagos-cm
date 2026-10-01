export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifySessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const renameGroupSchema = z.object({
  oldGroupKey: z.string().min(1, 'El grupo actual es requerido'),
  newGrado: z.string().min(1, 'El nuevo grado es requerido'),
  newGrupo: z.string().min(1, 'El nuevo grupo es requerido'),
  newNivelEscolar: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const token = request.cookies.get('pagos_cm_session')?.value;
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const payload = await verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Acceso no permitido' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = renameGroupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos para renombrar el grupo', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { oldGroupKey, newGrado, newGrupo, newNivelEscolar } = parsed.data;
    const cleanNewGrado = newGrado.trim();
    const cleanNewGrupo = newGrupo.trim();

    // Find all users belonging to oldGroupKey
    const allUsers = await prisma.user.findMany({
      where: { role: 'ALUMNO' },
      select: { id: true, grado: true, grupo: true, nivelEscolar: true },
    });

    const matchingUserIds = allUsers
      .filter((u) => {
        const studentKey = `${u.grado || ''}${u.grupo || ''}`;
        return (
          studentKey.toLowerCase() === oldGroupKey.toLowerCase() ||
          (u.nivelEscolar && u.nivelEscolar.toLowerCase() === oldGroupKey.toLowerCase())
        );
      })
      .map((u) => u.id);

    if (matchingUserIds.length > 0) {
      const updateData: any = {
        grado: cleanNewGrado,
        grupo: cleanNewGrupo,
      };
      if (newNivelEscolar && newNivelEscolar.trim()) {
        updateData.nivelEscolar = newNivelEscolar.trim();
      }

      await prisma.user.updateMany({
        where: { id: { in: matchingUserIds } },
        data: updateData,
      });
    }

    // Also update in SystemSetting custom_groups if present
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'custom_groups' },
    });

    if (setting?.value) {
      try {
        let customGroups: Array<{ nivelEscolar: string; grado: string; grupo: string; name: string }> = JSON.parse(setting.value);
        let changed = false;

        customGroups = customGroups.map((g) => {
          const gKey = `${g.grado}${g.grupo}`;
          if (gKey.toLowerCase() === oldGroupKey.toLowerCase() || g.name?.toLowerCase() === oldGroupKey.toLowerCase()) {
            changed = true;
            return {
              ...g,
              grado: cleanNewGrado,
              grupo: cleanNewGrupo,
              name: `${cleanNewGrado}${cleanNewGrupo}`,
              nivelEscolar: newNivelEscolar ? newNivelEscolar.trim() : g.nivelEscolar,
            };
          }
          return g;
        });

        if (changed) {
          await prisma.systemSetting.update({
            where: { key: 'custom_groups' },
            data: { value: JSON.stringify(customGroups) },
          });
        }
      } catch (e) {
        console.error('Error updating custom_groups setting during rename:', e);
      }
    }

    const newGroupKey = `${cleanNewGrado}${cleanNewGrupo}`;
    return NextResponse.json({
      success: true,
      updatedStudents: matchingUserIds.length,
      newGroupKey,
      message: `Grupo renombrado a ${newGroupKey} (${matchingUserIds.length} alumnos actualizados).`,
    });
  } catch (error) {
    console.error('Error renaming group:', error);
    return NextResponse.json({ error: 'Error al renombrar el grupo' }, { status: 500 });
  }
}
