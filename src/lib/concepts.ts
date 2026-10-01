export const NIVELES_ESCOLARES = [
  'Pre - Maternal',
  'Maternal',
  'Pre-Maternal y Maternal',
  'Kínder 1',
  'Kínder 2',
  'Kínder 3',
  'Primaria',
  'Secundaria',
  'Preparatoria',
  'Egresados',
  'No aplica',
  'No aplica (Supervisor)',
  'No Aplica (Admin)',
  'No Aplica Supervisor',
] as const;

export type NivelEscolar = (typeof NIVELES_ESCOLARES)[number];

export interface ConceptDefinition {
  concepto: string;
  tipo: 'ANUAL' | 'MENSUAL';
}

export function getConceptosForNivel(nivel: string): ConceptDefinition[] {
  if (
    !nivel ||
    nivel.trim().toLowerCase().includes('no aplica') ||
    nivel.trim().toLowerCase() === 'egresados'
  ) {
    return [];
  }

  const normalized = nivel
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const isPreMaternalMaternal =
    normalized.includes('maternal') ||
    normalized.includes('pre-maternal') ||
    normalized.includes('pre maternal');

  const isKinder = normalized.includes('kinder');
  const isPrimaria = normalized.includes('primaria');
  const isSecundaria = normalized.includes('secundaria');
  const isPreparatoria = normalized.includes('preparatoria') || normalized.includes('prepa');

  const result: ConceptDefinition[] = [];

  // Knotion (Anual): Kínder 1 a 3, Primaria, Secundaria.
  if (isKinder || isPrimaria || isSecundaria) {
    result.push({ concepto: 'Knotion (Anual)', tipo: 'ANUAL' });
  }

  // Lypro (Anual): Pre-Maternal y Maternal, Kínder 1 a 3, Primaria, Secundaria, Preparatoria.
  if (isPreMaternalMaternal || isKinder || isPrimaria || isSecundaria || isPreparatoria) {
    result.push({ concepto: 'Lypro (Anual)', tipo: 'ANUAL' });
  }

  // Cuota de tecnología (Anual): Kínder 1 a 3, Primaria, Secundaria, Preparatoria.
  if (isKinder || isPrimaria || isSecundaria || isPreparatoria) {
    result.push({ concepto: 'Cuota de tecnología (Anual)', tipo: 'ANUAL' });
  }

  // Cuota escolar (Anual): Pre-Maternal y Maternal, Kínder 1 a 3, Primaria, Secundaria, Preparatoria.
  if (isPreMaternalMaternal || isKinder || isPrimaria || isSecundaria || isPreparatoria) {
    result.push({ concepto: 'Cuota escolar (Anual)', tipo: 'ANUAL' });
  }

  // Inscripción o reinscripción (Anual): Pre-Maternal y Maternal, Kínder 1 a 3, Primaria, Secundaria, Preparatoria.
  if (isPreMaternalMaternal || isKinder || isPrimaria || isSecundaria || isPreparatoria) {
    result.push({ concepto: 'Inscripción o reinscripción (Anual)', tipo: 'ANUAL' });
  }

  // Cuota de material (Anual): Pre-Maternal y Maternal, Kínder 1 a 3.
  if (isPreMaternalMaternal || isKinder) {
    result.push({ concepto: 'Cuota de material (Anual)', tipo: 'ANUAL' });
  }

  // Colegiatura (Mensual): Todos los niveles escolares.
  if (isPreMaternalMaternal || isKinder || isPrimaria || isSecundaria || isPreparatoria) {
    result.push({ concepto: 'Colegiatura (Mensual)', tipo: 'MENSUAL' });
  }

  return result;
}
