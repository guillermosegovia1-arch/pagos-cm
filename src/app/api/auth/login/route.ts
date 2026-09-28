export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { comparePassword, createSessionToken } from '@/lib/auth';

const loginSchema = z.object({
  usuario: z.string().min(1, 'El usuario es obligatorio'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos de inicio de sesión inválidos', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { usuario, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { usuario: usuario.trim() },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      );
    }

    if (user.estado === 'Baja') {
      return NextResponse.json(
        { error: 'El usuario se encuentra dado de baja. Contacte al administrador.' },
        { status: 403 }
      );
    }

    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      );
    }

    const sessionData = {
      id: user.id,
      nombre: user.nombre,
      usuario: user.usuario,
      role: user.role,
      nivelEscolar: user.nivelEscolar,
      grado: user.grado,
      grupo: user.grupo,
    };

    const token = await createSessionToken(sessionData);

    const response = NextResponse.json({
      success: true,
      user: sessionData,
    });

    response.cookies.set('pagos_cm_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al iniciar sesión' },
      { status: 500 }
    );
  }
}
