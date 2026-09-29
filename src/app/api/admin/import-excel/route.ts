export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { verifySessionToken, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getConceptosForNivel } from '@/lib/concepts';

function getRowValue(row: Record<string, any>, possibleKeys: string[]): any {
  for (const k of possibleKeys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
      return row[k];
    }
  }
  const rowKeys = Object.keys(row);
  for (const k of possibleKeys) {
    const foundKey = rowKeys.find((rk) => rk.trim().toLowerCase() === k.trim().toLowerCase());
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
      return row[foundKey];
    }
  }
  return undefined;
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get('pagos_cm_session')?.value;
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const payload = await verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Acceso no permitido' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Debe seleccionar un archivo Excel (.xlsx o .xls)' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(bytes, { type: 'array' });

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

    if (!rawData || rawData.length === 0) {
      return NextResponse.json(
        { error: 'El archivo Excel no contiene datos o está vacío' },
        { status: 400 }
      );
    }

    // Cache password hashes to maximize performance
    const passwordHashCache = new Map<string, string>();
    const getHashedPassword = async (pass: string) => {
      if (passwordHashCache.has(pass)) {
        return passwordHashCache.get(pass)!;
      }
      const hashed = await hashPassword(pass);
      passwordHashCache.set(pass, hashed);
      return hashed;
    };

    // Pre-fetch all existing users and pagos in 2 fast queries
    const allUsers = await prisma.user.findMany({
      select: { id: true, usuario: true },
    });
    const userMap = new Map(allUsers.map((u) => [u.usuario.toLowerCase().trim(), u.id]));

    const allPagos = await prisma.pago.findMany({
      select: { userId: true, concepto: true },
    });
    const existingPagoSet = new Set(allPagos.map((p) => `${p.userId}_${p.concepto}`));

    let createdCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    const newUsersToCreate: Array<{
      id: string;
      nombre: string;
      usuario: string;
      password: string;
      passwordPlain: string;
      role: string;
      nivelEscolar: string;
      grado: string | null;
      grupo: string | null;
      estado: string;
    }> = [];

    const usersToUpdate: Array<{
      id: string;
      nombre: string;
      password: string;
      passwordPlain: string;
      role: string;
      nivelEscolar: string;
      grado: string | null;
      grupo: string | null;
      estado: string;
    }> = [];

    const processedUsers: Array<{
      userId: string;
      nivelEscolar: string;
      role: string;
    }> = [];

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];

      const nombre = getRowValue(row, ['Nombre', 'nombre', 'Nombre Completo', 'Alumno', 'alumno']);
      const usuario = getRowValue(row, ['Usuario', 'usuario', 'User', 'user', 'Usuario / Matrícula', 'Matrícula', 'Matricula']);
      const password = getRowValue(row, ['Contraseña', 'contraseña', 'Contrasena', 'Password', 'password', 'Clave', 'clave']) || '1234';
      const nivelEscolar = getRowValue(row, ['Nivel escolar', 'Nivel Escolar', 'nivel escolar', 'Nivel', 'nivel', 'nivelEscolar']) || 'Primaria';
      const rolRaw = getRowValue(row, ['Rol', 'rol', 'Role', 'role']);
      const gradoRaw = getRowValue(row, ['Grado', 'grado']);
      const grupoRaw = getRowValue(row, ['Grupo', 'grupo']);

      if (!nombre || !usuario) {
        errors.push(`Fila ${i + 2}: Nombre y Usuario son obligatorios.`);
        continue;
      }

      const strUsuario = String(usuario).trim();
      const strNombre = String(nombre).trim();
      const strPassword = String(password).trim();
      const strNivel = String(nivelEscolar).trim();
      const strGrado = gradoRaw !== undefined && gradoRaw !== null ? String(gradoRaw).trim() : null;
      const strGrupo = grupoRaw !== undefined && grupoRaw !== null ? String(grupoRaw).trim() : null;

      const isNoAplica = strNivel.toLowerCase() === 'no aplica';

      let finalRole = isNoAplica ? 'ADMIN' : 'ALUMNO';
      if (rolRaw) {
        const rolClean = String(rolRaw).trim().toUpperCase();
        if (rolClean === 'ADMIN' || rolClean === 'ADMINISTRADOR') {
          finalRole = 'ADMIN';
        } else if (rolClean === 'ALUMNO') {
          finalRole = 'ALUMNO';
        }
      }

      const finalGrado = isNoAplica ? null : strGrado;
      const finalGrupo = isNoAplica ? null : strGrupo;

      const hashedPassword = await getHashedPassword(strPassword);
      const existingUserId = userMap.get(strUsuario.toLowerCase());

      if (existingUserId) {
        usersToUpdate.push({
          id: existingUserId,
          nombre: strNombre,
          password: hashedPassword,
          passwordPlain: strPassword,
          role: finalRole,
          nivelEscolar: strNivel,
          grado: finalGrado,
          grupo: finalGrupo,
          estado: 'Alta',
        });
        processedUsers.push({
          userId: existingUserId,
          nivelEscolar: strNivel,
          role: finalRole,
        });
      } else {
        const newId = crypto.randomUUID();
        newUsersToCreate.push({
          id: newId,
          nombre: strNombre,
          usuario: strUsuario,
          password: hashedPassword,
          passwordPlain: strPassword,
          role: finalRole,
          nivelEscolar: strNivel,
          grado: finalGrado,
          grupo: finalGrupo,
          estado: 'Alta',
        });
        userMap.set(strUsuario.toLowerCase(), newId);
        processedUsers.push({
          userId: newId,
          nivelEscolar: strNivel,
          role: finalRole,
        });
      }
    }

    // 1. Create new users in parallel batches of 25 (No transactions needed for HTTP mode)
    if (newUsersToCreate.length > 0) {
      const userBatchSize = 25;
      for (let i = 0; i < newUsersToCreate.length; i += userBatchSize) {
        const batch = newUsersToCreate.slice(i, i + userBatchSize);
        await Promise.all(
          batch.map((u) =>
            prisma.user.create({
              data: u,
            })
          )
        );
      }
      createdCount = newUsersToCreate.length;
    }

    // 2. Update existing users in parallel batches of 15 (No transactions needed for HTTP mode)
    if (usersToUpdate.length > 0) {
      const updateBatchSize = 15;
      for (let i = 0; i < usersToUpdate.length; i += updateBatchSize) {
        const batch = usersToUpdate.slice(i, i + updateBatchSize);
        await Promise.all(
          batch.map((u) =>
            prisma.user.update({
              where: { id: u.id },
              data: {
                nombre: u.nombre,
                password: u.password,
                passwordPlain: u.passwordPlain,
                role: u.role,
                nivelEscolar: u.nivelEscolar,
                grado: u.grado,
                grupo: u.grupo,
                estado: u.estado,
              },
            })
          )
        );
      }
      updatedCount = usersToUpdate.length;
    }

    // 3. Create missing payment concepts in parallel batches of 50 (No transactions needed for HTTP mode)
    const newPagosToCreate: Array<{
      id: string;
      userId: string;
      concepto: string;
      tipo: string;
      estado: string;
    }> = [];

    for (const item of processedUsers) {
      if (item.role === 'ALUMNO' && item.nivelEscolar.toLowerCase() !== 'no aplica') {
        const reqConcepts = getConceptosForNivel(item.nivelEscolar);
        for (const rc of reqConcepts) {
          const key = `${item.userId}_${rc.concepto}`;
          if (!existingPagoSet.has(key)) {
            newPagosToCreate.push({
              id: crypto.randomUUID(),
              userId: item.userId,
              concepto: rc.concepto,
              tipo: rc.tipo,
              estado: 'Pendiente',
            });
            existingPagoSet.add(key);
          }
        }
      }
    }

    if (newPagosToCreate.length > 0) {
      const pagoBatchSize = 50;
      for (let i = 0; i < newPagosToCreate.length; i += pagoBatchSize) {
        const batch = newPagosToCreate.slice(i, i + pagoBatchSize);
        await Promise.all(
          batch.map((p) =>
            prisma.pago.create({
              data: p,
            })
          )
        );
      }
    }

    return NextResponse.json({
      success: true,
      createdCount,
      updatedCount,
      totalProcessed: rawData.length,
      errors,
      message: `Importación completada: ${createdCount} creados, ${updatedCount} actualizados.`,
    });
  } catch (error: any) {
    console.error('Excel import error:', error);
    return NextResponse.json(
      { error: `Error al procesar el archivo Excel: ${error.message || 'Verifique el formato de los datos'}` },
      { status: 500 }
    );
  }
}
