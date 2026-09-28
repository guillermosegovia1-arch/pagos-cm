export const NIVELES_ESCOLARES = [
  'Pre-Maternal y Maternal',
  'Kínder 1',
  'Kínder 2',
  'Kínder 3',
  'Primaria',
  'Secundaria',
  'Preparatoria',
  'No aplica',
] as const;

export type NivelEscolar = (typeof NIVELES_ESCOLARES)[number];

export interface ConceptDefinition {
  concepto: string;
  tipo: 'ANUAL' | 'MENSUAL';
}

export function getConceptosForNivel(nivel: string): ConceptDefinition[] {
  if (!nivel || nivel === 'No aplica') {
    return [];
  }

  const result: ConceptDefinition[] = [];

  const isPreMaternalMaternal = nivel === 'Pre-Maternal y Maternal';
  const isKinder = nivel.startsWith('Kínder');
  const isPrimaria = nivel === 'Primaria';
  const isSecundaria = nivel === 'Secundaria';
  const isPreparatoria = nivel === 'Preparatoria';

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
