export const runtime = 'edge';

import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET() {
  const templateData = [
    {
      'Nombre': 'Juan Carlos Perez Garmendia',
      'Usuario': 'juan.perez',
      'Contraseña': 'alumnoPassword123',
      'Nivel Escolar': 'Primaria',
      'Grado': '1',
      'Grupo': 'A',
    },
    {
      'Nombre': 'Maria Jose Hernandez Lopez',
      'Usuario': 'maria.hernandez',
      'Contraseña': 'alumnoPassword456',
      'Nivel Escolar': 'Secundaria',
      'Grado': '2',
      'Grupo': 'B',
    },
    {
      'Nombre': 'Carlos Eduardo Ramirez',
      'Usuario': 'carlos.ramirez',
      'Contraseña': 'alumnoPassword789',
      'Nivel Escolar': 'Kínder 1',
      'Grado': 'K1',
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
