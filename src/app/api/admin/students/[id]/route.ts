export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifySessionToken, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getConceptosForNivel } from '@/lib/concepts';

const userUpdateSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  usuario: z.string().min(1, 'El usuario es requerido'),
  password: z.string().optional(),
  nivelEscolar: z.string().min(1, 'El nivel escolar es requerido'),
  grado: z.string().nullable().optional(),
  grupo: z.string().nullable().optional(),
  estado: z.enum(['Alta', 'Baja']),
  role: z.enum(['ADMIN', 'ALUMNO', 'SUPERVISOR']).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('pagos_cm_session')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifySessionToken(token);
    if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'SUPERVISOR')) {
      return NextResponse.json({ error: 'Acceso no permitido' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'ID de usuario no proporcionado' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = userUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos de actualización inválidos', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: { pagos: true },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Verificar si el nuevo usuario ya pertenece a otra cuenta (comparación insensible a mayúsculas)
    if (data.usuario.trim().toLowerCase() !== existingUser.usuario.trim().toLowerCase()) {
      const duplicateUser = await prisma.user.findFirst({
        where: {
          usuario: {
            equals: data.usuario.trim(),
            mode: 'insensitive',
          },
          id: { not: id },
        },
      });

      if (duplicateUser) {
        return NextResponse.json(
          {
            error: `Usuario existente: El usuario "${data.usuario.trim()}" ya está registrado para otro alumno (${duplicateUser.nombre}).`,
            code: 'USER_EXISTS',
          },
          { status: 400 }
        );
      }
    }

    const isSupervisor = data.nivelEscolar ? data.nivelEscolar.toLowerCase().includes('supervisor') : false;
    const isNoAplica = data.nivelEscolar ? (data.nivelEscolar.toLowerCase().includes('no aplica') || isSupervisor) : false;
    const computedRole = data.role || (isSupervisor ? 'SUPERVISOR' : isNoAplica ? 'ADMIN' : (existingUser.role === 'ADMIN' || existingUser.role === 'SUPERVISOR') ? 'ALUMNO' : existingUser.role);
    const finalGrado = isNoAplica ? null : data.grado ? data.grado.trim() : null;
    const finalGrupo = isNoAplica ? null : data.grupo ? data.grupo.trim() : null;

    let updatedPasswordHash = existingUser.password;
    let updatedPasswordPlain = existingUser.passwordPlain;

    if (data.password && data.password.trim().length > 0) {
      updatedPasswordHash = await hashPassword(data.password.trim());
      updatedPasswordPlain = data.password.trim();
    }

    await prisma.user.update({
      where: { id },
      data: {
        nombre: data.nombre.trim(),
        usuario: data.usuario.trim(),
        password: updatedPasswordHash,
        passwordPlain: updatedPasswordPlain,
        role: computedRole,
        nivelEscolar: data.nivelEscolar,
        grado: finalGrado,
        grupo: finalGrupo,
        estado: data.estado,
      },
    });

    // Si cambió el nivel escolar, sincronizar los conceptos correspondientes
    if (data.nivelEscolar !== existingUser.nivelEscolar) {
      if (isNoAplica) {
        await prisma.pago.deleteMany({ where: { userId: id } });
      } else {
        const requiredConcepts = getConceptosForNivel(data.nivelEscolar);
        const existingConceptsMap = new Map(existingUser.pagos.map((p) => [p.concepto, p]));

        for (const req of requiredConcepts) {
          if (!existingConceptsMap.has(req.concepto)) {
            await prisma.pago.create({
              data: {
                userId: id,
                concepto: req.concepto,
                tipo: req.tipo,
                estado: 'Pendiente',
              },
            });
          }
        }

        const reqConceptNames = new Set(requiredConcepts.map((r) => r.concepto));
        for (const existingPago of existingUser.pagos) {
          if (!reqConceptNames.has(existingPago.concepto)) {
            await prisma.pago.delete({ where: { id: existingPago.id } });
          }
        }
      }
    }

    const finalUser = await prisma.user.findUnique({
      where: { id },
      include: { pagos: true },
    });

    return NextResponse.json({ success: true, user: finalUser });
  } catch (error: any) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: error?.message || 'Error al actualizar la información del usuario' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('pagos_cm_session')?.value;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const payload = await verifySessionToken(token);
    if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'SUPERVISOR')) {
      return NextResponse.json({ error: 'Acceso no permitido' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'ID de usuario no proporcionado' }, { status: 400 });
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Usuario eliminado' });
  } catch (error: any) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: error?.message || 'Error al eliminar el usuario' },
      { status: 500 }
    );
  }
}
