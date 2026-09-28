import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { verifySessionToken, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getConceptosForNivel } from '@/lib/concepts';

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
    const buffer = Buffer.from(bytes);
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

    if (!rawData || rawData.length === 0) {
      return NextResponse.json(
        { error: 'El archivo Excel no contiene datos o está vacío' },
        { status: 400 }
      );
    }

    let createdCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];

      // Normalize row keys
      const nombre = row['Nombre'] || row['nombre'] || row['Nombre Completo'] || row['Alumno'];
      const usuario = row['Usuario'] || row['usuario'] || row['User'] || row['Usuario / Matrícula'];
      const password = row['Contraseña'] || row['Password'] || row['password'] || row['Clave'] || 'cm123456';
      const nivelEscolar = row['Nivel Escolar'] || row['Nivel'] || row['nivelEscolar'] || 'Primaria';
      const grado = row['Grado'] || row['grado'] ? String(row['Grado'] || row['grado']) : null;
      const grupo = row['Grupo'] || row['grupo'] ? String(row['Grupo'] || row['grupo']) : null;

      if (!nombre || !usuario) {
        errors.push(`Fila ${i + 2}: Nombre y Usuario son obligatorios.`);
        continue;
      }

      const strUsuario = String(usuario).trim();
      const strNombre = String(nombre).trim();
      const strPassword = String(password).trim();
      const strNivel = String(nivelEscolar).trim();

      const isNoAplica = strNivel === 'No aplica';
      const finalRole = isNoAplica ? 'ADMIN' : 'ALUMNO';
      const finalGrado = isNoAplica ? null : grado;
      const finalGrupo = isNoAplica ? null : grupo;

      const hashedPassword = await hashPassword(strPassword);

      const existingUser = await prisma.user.findUnique({
        where: { usuario: strUsuario },
      });

      let userId = '';

      if (existingUser) {
        const updated = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            nombre: strNombre,
            password: hashedPassword,
            passwordPlain: strPassword,
            role: finalRole,
            nivelEscolar: strNivel,
            grado: finalGrado,
            grupo: finalGrupo,
            estado: 'Alta',
          },
        });
        userId = updated.id;
        updatedCount++;
      } else {
        const created = await prisma.user.create({
          data: {
            nombre: strNombre,
            usuario: strUsuario,
            password: hashedPassword,
            passwordPlain: strPassword,
            role: finalRole,
            nivelEscolar: strNivel,
            grado: finalGrado,
            grupo: finalGrupo,
            estado: 'Alta',
          },
        });
        userId = created.id;
        createdCount++;
      }

      // Automatically generate or update payment concepts
      if (finalRole === 'ALUMNO' && !isNoAplica) {
        const reqConcepts = getConceptosForNivel(strNivel);
        const existingPagos = await prisma.pago.findMany({ where: { userId } });
        const existingMap = new Map(existingPagos.map((p) => [p.concepto, p]));

        for (const rc of reqConcepts) {
          if (!existingMap.has(rc.concepto)) {
            await prisma.pago.create({
              data: {
                userId,
                concepto: rc.concepto,
                tipo: rc.tipo,
                estado: 'Pendiente',
              },
            });
          }
        }
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
  } catch (error) {
    console.error('Excel import error:', error);
    return NextResponse.json(
      { error: 'Error al procesar el archivo Excel. Verifique el formato de los datos.' },
      { status: 500 }
    );
  }
}
