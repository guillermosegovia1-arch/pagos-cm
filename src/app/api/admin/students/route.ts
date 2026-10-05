export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifySessionToken, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getConceptosForNivel } from '@/lib/concepts';

const userCreateSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  usuario: z.string().min(1, 'El usuario es requerido'),
  password: z.string().min(1, 'La contraseña es requerida'),
  nivelEscolar: z.string().min(1, 'El nivel escolar es requerido'),
  grado: z.string().nullable().optional(),
  grupo: z.string().nullable().optional(),
  estado: z.enum(['Alta', 'Baja']).default('Alta'),
  role: z.enum(['ADMIN', 'ALUMNO', 'SUPERVISOR']).optional(),
});

export async function GET(request: NextRequest) {
  const token = request.cookies.get('pagos_cm_session')?.value;
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const payload = await verifySessionToken(token);
  if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'SUPERVISOR')) {
    return NextResponse.json({ error: 'Acceso no permitido' }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    include: {
      pagos: {
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: [{ nivelEscolar: 'asc' }, { grado: 'asc' }, { grupo: 'asc' }, { nombre: 'asc' }],
  });

  return NextResponse.json(
    { users },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    }
  );
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
    const parsed = userCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos de usuario inválidos', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const existing = await prisma.user.findFirst({
      where: {
        usuario: {
          equals: data.usuario.trim(),
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: `Usuario existente: El usuario "${data.usuario.trim()}" ya se encuentra registrado para ${existing.nombre}.`,
          code: 'USER_EXISTS',
        },
        { status: 400 }
      );
    }

    const isSupervisor = data.nivelEscolar.toLowerCase().includes('supervisor') || data.role === 'SUPERVISOR';
    const isNoAplica = data.nivelEscolar.toLowerCase().includes('no aplica') || isSupervisor;
    const computedRole = data.role || (isSupervisor ? 'SUPERVISOR' : isNoAplica ? 'ADMIN' : 'ALUMNO');
    const finalGrado = isNoAplica ? null : data.grado ? data.grado.trim() : null;
    const finalGrupo = isNoAplica ? null : data.grupo ? data.grupo.trim() : null;

    const hashedPassword = await hashPassword(data.password);

    const newUser = await prisma.user.create({
      data: {
        nombre: data.nombre.trim(),
        usuario: data.usuario.trim(),
        password: hashedPassword,
        passwordPlain: data.password.trim(),
        role: computedRole,
        nivelEscolar: data.nivelEscolar,
        grado: finalGrado,
        grupo: finalGrupo,
        estado: data.estado,
        creadoEnAdmin: true,
      },
    });

    if (computedRole === 'ALUMNO' && !isNoAplica) {
      const concepts = getConceptosForNivel(data.nivelEscolar);
      for (const c of concepts) {
        await prisma.pago.create({
          data: {
            userId: newUser.id,
            concepto: c.concepto,
            tipo: c.tipo,
            estado: 'Pendiente',
          },
        });
      }
    }

    const createdWithPagos = await prisma.user.findUnique({
      where: { id: newUser.id },
      include: { pagos: true },
    });

    return NextResponse.json({ success: true, user: createdWithPagos });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: 'Error al crear el usuario en la base de datos' },
      { status: 500 }
    );
  }
}
