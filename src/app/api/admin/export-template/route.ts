export const runtime = 'edge';

import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET() {
  const templateData = [
    {
      'Nombre': 'Juan Carlos Perez Garmendia',
      'Usuario': 'cme.juanperez',
      'Contraseña': '1234',
      'Nivel escolar': 'Pre - Maternal',
      'Rol': 'Alumno',
      'Grado': 'N1',
      'Grupo': 'A',
    },
    {
      'Nombre': 'Maria Jose Hernandez Lopez',
      'Usuario': 'cme.mariahernandez',
      'Contraseña': '1234',
      'Nivel escolar': 'Maternal',
      'Rol': 'Alumno',
      'Grado': 'N2',
      'Grupo': 'B',
    },
    {
      'Nombre': 'Carlos Eduardo Ramirez',
      'Usuario': 'cme.carlosramirez',
      'Contraseña': '1234',
      'Nivel escolar': 'Primaria',
      'Rol': 'Alumno',
      'Grado': '1',
      'Grupo': 'A',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Alumnos');

  const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="Plantilla_Importacion_Alumnos_PagosCM.xlsx"',
    },
  });
}
