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

    // Cache password hashes
    const passwordHashCache = new Map<string, string>();
    const getHashedPassword = async (pass: string) => {
      if (passwordHashCache.has(pass)) {
        return passwordHashCache.get(pass)!;
      }
      const hashed = await hashPassword(pass);
      passwordHashCache.set(pass, hashed);
      return hashed;
    };

    // Subrequest 1: Fetch existing users
    const existingUsers = await prisma.user.findMany({
      select: { id: true, usuario: true },
    });
    const existingUserMap = new Map(existingUsers.map((u) => [u.usuario.toLowerCase().trim(), u.id]));

    let createdCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    const userRecordsToUpsert: Array<{
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

    const processedUsersForPagos: Array<{
      usuario: string;
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
      const existingId = existingUserMap.get(strUsuario.toLowerCase());

      if (existingId) {
        updatedCount++;
        userRecordsToUpsert.push({
          id: existingId,
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
      } else {
        createdCount++;
        const newId = crypto.randomUUID();
        existingUserMap.set(strUsuario.toLowerCase(), newId);
        userRecordsToUpsert.push({
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
      }

      processedUsersForPagos.push({
        usuario: strUsuario.toLowerCase(),
        nivelEscolar: strNivel,
        role: finalRole,
      });
    }

    // Subrequests 2..N: Multi-row SQL UPSERT for Users in chunks of 150 rows (~7 subrequests total for 989 users)
    if (userRecordsToUpsert.length > 0) {
      const userChunkSize = 150;
      for (let i = 0; i < userRecordsToUpsert.length; i += userChunkSize) {
        const chunk = userRecordsToUpsert.slice(i, i + userChunkSize);
        const valueClauses: string[] = [];
        const params: any[] = [];
        let pIdx = 1;

        for (const u of chunk) {
          valueClauses.push(
            `($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, $${pIdx + 6}, $${pIdx + 7}, $${pIdx + 8}, $${pIdx + 9}, NOW(), NOW())`
          );
          params.push(
            u.id,
            u.nombre,
            u.usuario,
            u.password,
            u.passwordPlain,
            u.role,
            u.nivelEscolar,
            u.grado,
            u.grupo,
            u.estado
          );
          pIdx += 10;
        }

        const sql = `
          INSERT INTO "User" ("id", "nombre", "usuario", "password", "passwordPlain", "role", "nivelEscolar", "grado", "grupo", "estado", "createdAt", "updatedAt")
          VALUES ${valueClauses.join(', ')}
          ON CONFLICT ("usuario") DO UPDATE SET
            "nombre" = EXCLUDED."nombre",
            "password" = EXCLUDED."password",
            "passwordPlain" = EXCLUDED."passwordPlain",
            "role" = EXCLUDED."role",
            "nivelEscolar" = EXCLUDED."nivelEscolar",
            "grado" = EXCLUDED."grado",
            "grupo" = EXCLUDED."grupo",
            "estado" = EXCLUDED."estado",
            "updatedAt" = NOW();
        `;

        await prisma.$executeRawUnsafe(sql, ...params);
      }
    }

    // Subrequest N+1: Fetch existing pagos to prevent duplicate concepts
    const allPagos = await prisma.pago.findMany({
      select: { userId: true, concepto: true },
    });
    const existingPagoSet = new Set(allPagos.map((p) => `${p.userId}_${p.concepto}`));

    // Build Pago records
    const pagoRecordsToInsert: Array<{
      id: string;
      userId: string;
      concepto: string;
      tipo: string;
      estado: string;
    }> = [];

    for (const item of processedUsersForPagos) {
      const uId = existingUserMap.get(item.usuario);
      if (uId && item.role === 'ALUMNO' && item.nivelEscolar.toLowerCase() !== 'no aplica') {
        const reqConcepts = getConceptosForNivel(item.nivelEscolar);
        for (const rc of reqConcepts) {
          const key = `${uId}_${rc.concepto}`;
          if (!existingPagoSet.has(key)) {
            pagoRecordsToInsert.push({
              id: crypto.randomUUID(),
              userId: uId,
              concepto: rc.concepto,
              tipo: rc.tipo,
              estado: 'Pendiente',
            });
            existingPagoSet.add(key);
          }
        }
      }
    }

    // Subrequests N+2..M: Multi-row SQL INSERT for Pagos in chunks of 400 rows (~15 subrequests total for 6,000 pagos)
    if (pagoRecordsToInsert.length > 0) {
      const pagoChunkSize = 400;
      for (let i = 0; i < pagoRecordsToInsert.length; i += pagoChunkSize) {
        const chunk = pagoRecordsToInsert.slice(i, i + pagoChunkSize);
        const valueClauses: string[] = [];
        const params: any[] = [];
        let pIdx = 1;

        for (const p of chunk) {
          valueClauses.push(
            `($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, NOW(), NOW())`
          );
          params.push(p.id, p.userId, p.concepto, p.tipo, p.estado);
          pIdx += 5;
        }

        const sql = `
          INSERT INTO "Pago" ("id", "userId", "concepto", "tipo", "estado", "createdAt", "updatedAt")
          VALUES ${valueClauses.join(', ')}
          ON CONFLICT DO NOTHING;
        `;

        await prisma.$executeRawUnsafe(sql, ...params);
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
