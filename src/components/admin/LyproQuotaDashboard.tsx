'use client';

import React, { useState, useMemo } from 'react';
import {
  Users,
  CheckCircle2,
  Calendar,
  CalendarDays,
  Clock,
  AlertTriangle,
  UserX,
  Sparkles,
  ArrowRight,
  Search,
  X,
  Download,
  Copy,
  Check,
  Filter,
  GraduationCap,
  BookOpen,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

export interface Pago {
  id: string;
  concepto: string;
  tipo: string;
  estado: 'Pendiente' | 'En Revisión' | 'Confirmado' | 'Requiere Aclaración';
  numeroConfirmacion: string | null;
  motivoAclaracion: string | null;
  comentarioAdmin: string | null;
  respuestaAlumno: string | null;
  notaConcepto?: string | null;
  mesColegiatura?: string | null;
  fechaVencimiento?: string | null;
  fechaReportado?: string | null;
  fechaConfirmado: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface UserStudent {
  id: string;
  nombre: string;
  usuario: string;
  passwordPlain?: string;
  role: 'ADMIN' | 'ALUMNO' | 'SUPERVISOR';
  nivelEscolar: string;
  grado: string | null;
  grupo: string | null;
  estado: 'Alta' | 'Baja';
  creadoEnAdmin?: boolean;
  createdAt?: string;
  updatedAt?: string;
  pagos: Pago[];
}

export type MetricType =
  | 'todos'
  | 'confirmados'
  | 'confirmados_hoy'
  | 'confirmados_ayer'
  | 'en_revision'
  | 'pendientes'
  | 'bajas'
  | 'nuevo_ingreso';

interface LyproQuotaDashboardProps {
  sectionType: 'innovatiq' | 'progrentis';
  users: UserStudent[];
  isSupervisor: boolean;
  todayISO: string;
  yesterdayISO: string;
  formatDateDisplay: (dateInput: string | Date | null | undefined) => string | null | undefined;
  isSameDayString: (dateInput: string | Date | null | undefined, targetISO: string) => boolean;
  isNuevoIngreso: (user: { role?: string; createdAt?: string; creadoEnAdmin?: boolean; estado?: string }) => boolean;
  onOpenEditPago?: (pago: Pago, studentName: string) => void;
}

export function isInnovatiqStudent(u: UserStudent): boolean {
  if (u.role !== 'ALUMNO') return false;
  const nivel = (u.nivelEscolar || '').toLowerCase().trim();
  const grado = (u.grado || '').trim();

  // Exclusiones estrictas
  if (
    nivel.includes('maternal') ||
    nivel.includes('egresado') ||
    nivel.includes('no aplica') ||
    grado === 'N1' ||
    grado === 'N2' ||
    grado === 'Egresados'
  ) {
    return false;
  }

  // Kínder (K1, K2, K3)
  if (nivel.includes('kinder') || grado.toUpperCase().startsWith('K')) {
    return true;
  }

  // Primaria (1 a 6)
  if (nivel.includes('primaria')) {
    return true;
  }

  // Secundaria (7 a 9)
  if (nivel.includes('secundaria')) {
    return true;
  }

  // Preparatoria (10 a 12)
  if (nivel.includes('preparatoria') || nivel.includes('prepa')) {
    return true;
  }

  // Fallback numérico
  const gNum = parseInt(grado.replace(/\D/g, ''), 10);
  if (!isNaN(gNum) && gNum >= 1 && gNum <= 12) {
    return true;
  }

  return false;
}

export function isProgrentisStudent(u: UserStudent): boolean {
  if (!isInnovatiqStudent(u)) return false;
  const nivel = (u.nivelEscolar || '').toLowerCase().trim();
  const grado = (u.grado || '').trim();

  // Excluir Kínder
  if (nivel.includes('kinder') || grado.toUpperCase().startsWith('K')) {
    return false;
  }

  // Excluir 1º de Primaria
  if (nivel.includes('primaria') && (grado === '1' || grado === '1º' || grado.toLowerCase() === '1ro')) {
    return false;
  }

  const gNum = parseInt(grado.replace(/\D/g, ''), 10);
  if (!isNaN(gNum) && gNum === 1 && nivel.includes('primaria')) {
    return false;
  }

  return true;
}

export function getLyproPago(student: UserStudent): Pago | undefined {
  return student.pagos.find((p) => p.concepto.toLowerCase().includes('lypro'));
}

export default function LyproQuotaDashboard({
  sectionType,
  users,
  isSupervisor,
  todayISO,
  yesterdayISO,
  formatDateDisplay,
  isSameDayString,
  isNuevoIngreso,
  onOpenEditPago,
}: LyproQuotaDashboardProps) {
  // Modal State
  const [modalMetric, setModalMetric] = useState<MetricType | null>(null);
  const [modalSearch, setModalSearch] = useState('');
  const [modalNivelFilter, setModalNivelFilter] = useState<string>('TODOS');
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // In-page Table Filter State
  const [tableFilter, setTableFilter] = useState<MetricType>('todos');
  const [tableSearch, setTableSearch] = useState('');
  const [tableNivelFilter, setTableNivelFilter] = useState<string>('TODOS');
  const [tablePage, setTablePage] = useState(1);
  const pageSize = 25;

  // Filtrado de universo de alumnos según sección (Innovatiq: K1 a 12 | Progrentis: 2º Primaria a 12)
  // Incluye todos los alumnos (Altas y Bajas) registrados en la base de datos
  const scopedStudents = useMemo(() => {
    if (sectionType === 'innovatiq') {
      return users.filter(isInnovatiqStudent);
    } else {
      return users.filter(isProgrentisStudent);
    }
  }, [sectionType, users]);

  // Map de alumnos con su pago de Lypro
  const studentsWithLypro = useMemo(() => {
    return scopedStudents.map((student) => {
      const lypro = getLyproPago(student);
      const isNuevo = isNuevoIngreso(student) || student.estado?.toLowerCase().includes('nuevo');
      return {
        student,
        lypro,
        isNuevo,
      };
    });
  }, [scopedStudents, isNuevoIngreso]);

  // Métricas calculadas
  const metricsData = useMemo(() => {
    const total = studentsWithLypro.length;
    const confirmados = studentsWithLypro.filter((item) => item.lypro?.estado === 'Confirmado');
    const confirmadosHoy = confirmados.filter(
      (item) => item.lypro?.fechaConfirmado && isSameDayString(item.lypro.fechaConfirmado, todayISO)
    );
    const confirmadosAyer = confirmados.filter(
      (item) => item.lypro?.fechaConfirmado && isSameDayString(item.lypro.fechaConfirmado, yesterdayISO)
    );
    const enRevision = studentsWithLypro.filter((item) => item.lypro?.estado === 'En Revisión');
    const pendientes = studentsWithLypro.filter(
      (item) => !item.lypro || item.lypro.estado === 'Pendiente'
    );
    const bajas = studentsWithLypro.filter((item) => item.student.estado === 'Baja');
    const altas = studentsWithLypro.filter((item) => item.student.estado === 'Alta');
    const nuevoIngreso = studentsWithLypro.filter((item) => item.isNuevo);

    const completionRate = total > 0 ? Math.round((confirmados.length / total) * 100) : 0;

    return {
      total,
      altas,
      confirmados,
      confirmadosHoy,
      confirmadosAyer,
      enRevision,
      pendientes,
      bajas,
      nuevoIngreso,
      completionRate,
    };
  }, [studentsWithLypro, isSameDayString, todayISO, yesterdayISO]);

  // Helper para obtener la lista de alumnos según la métrica seleccionada
  const getStudentsForMetric = (metric: MetricType) => {
    switch (metric) {
      case 'confirmados':
        return metricsData.confirmados;
      case 'confirmados_hoy':
        return metricsData.confirmadosHoy;
      case 'confirmados_ayer':
        return metricsData.confirmadosAyer;
      case 'en_revision':
        return metricsData.enRevision;
      case 'pendientes':
        return metricsData.pendientes;
      case 'bajas':
        return metricsData.bajas;
      case 'nuevo_ingreso':
        return metricsData.nuevoIngreso;
      case 'todos':
      default:
        return studentsWithLypro;
    }
  };

  const getMetricTitle = (metric: MetricType) => {
    switch (metric) {
      case 'confirmados':
        return 'Alumnos con Cuota de Lypro Confirmada (Total)';
      case 'confirmados_hoy':
        return 'Alumnos con Cuota de Lypro Confirmada Hoy';
      case 'confirmados_ayer':
        return 'Alumnos con Cuota de Lypro Confirmada Ayer';
      case 'en_revision':
        return 'Alumnos con Cuota de Lypro En Revisión';
      case 'pendientes':
        return 'Alumnos con Cuota de Lypro Pendiente';
      case 'bajas':
        return 'Alumnos Dados de Baja';
      case 'nuevo_ingreso':
        return 'Alumnos de Nuevo Ingreso';
      case 'todos':
      default:
        return 'Total de Alumnos Registrados';
    }
  };

  // Alumnos filtrados dentro del Modal
  const modalStudentsList = useMemo(() => {
    if (!modalMetric) return [];
    const baseList = getStudentsForMetric(modalMetric);

    return baseList.filter(({ student }) => {
      // Filtro por nivel
      if (modalNivelFilter !== 'TODOS') {
        const nivel = (student.nivelEscolar || '').toLowerCase();
        if (modalNivelFilter === 'KINDER' && !nivel.includes('kinder')) return false;
        if (modalNivelFilter === 'PRIMARIA' && !nivel.includes('primaria')) return false;
        if (modalNivelFilter === 'SECUNDARIA' && !nivel.includes('secundaria')) return false;
        if (modalNivelFilter === 'PREPARATORIA' && !nivel.includes('prepa')) return false;
      }

      // Filtro por búsqueda de texto
      if (modalSearch.trim()) {
        const q = modalSearch.toLowerCase().trim();
        const matchName = student.nombre.toLowerCase().includes(q);
        const matchMatricula = student.usuario.toLowerCase().includes(q);
        const matchGrado = (student.grado || '').toLowerCase().includes(q);
        const matchGrupo = (student.grupo || '').toLowerCase().includes(q);
        return matchName || matchMatricula || matchGrado || matchGrupo;
      }

      return true;
    });
  }, [modalMetric, modalNivelFilter, modalSearch, metricsData]);

  // Alumnos filtrados para la tabla en la página
  const tableStudentsList = useMemo(() => {
    const baseList = getStudentsForMetric(tableFilter);

    return baseList.filter(({ student }) => {
      // Filtro por nivel
      if (tableNivelFilter !== 'TODOS') {
        const nivel = (student.nivelEscolar || '').toLowerCase();
        if (tableNivelFilter === 'KINDER' && !nivel.includes('kinder')) return false;
        if (tableNivelFilter === 'PRIMARIA' && !nivel.includes('primaria')) return false;
        if (tableNivelFilter === 'SECUNDARIA' && !nivel.includes('secundaria')) return false;
        if (tableNivelFilter === 'PREPARATORIA' && !nivel.includes('prepa')) return false;
      }

      // Filtro por búsqueda
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase().trim();
        const matchName = student.nombre.toLowerCase().includes(q);
        const matchMatricula = student.usuario.toLowerCase().includes(q);
        const matchGrado = (student.grado || '').toLowerCase().includes(q);
        const matchGrupo = (student.grupo || '').toLowerCase().includes(q);
        return matchName || matchMatricula || matchGrado || matchGrupo;
      }

      return true;
    });
  }, [tableFilter, tableNivelFilter, tableSearch, metricsData]);

  // Paginación de la tabla
  const totalPages = Math.ceil(tableStudentsList.length / pageSize) || 1;
  const paginatedTableStudents = useMemo(() => {
    const start = (tablePage - 1) * pageSize;
    return tableStudentsList.slice(start, start + pageSize);
  }, [tableStudentsList, tablePage, pageSize]);

  // Handler para abrir modal al hacer clic en tarjeta
  const handleCardClick = (metric: MetricType) => {
    setModalMetric(metric);
    setModalSearch('');
    setModalNivelFilter('TODOS');
    setCopiedSuccess(false);
  };

  // Copiar nombres al portapapeles
  const handleCopyNames = (students: Array<{ student: UserStudent; lypro?: Pago }>) => {
    const names = students
      .map((item, idx) => `${idx + 1}. ${item.student.nombre} (${item.student.nivelEscolar} ${item.student.grado || ''}º "${item.student.grupo || ''}") - Matrícula: ${item.student.usuario}`)
      .join('\n');
    navigator.clipboard.writeText(names);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  // Exportar a CSV
  const handleExportCSV = (students: Array<{ student: UserStudent; lypro?: Pago }>, fileName: string) => {
    const headers = ['Matrícula', 'Nombre del Alumno', 'Nivel Escolar', 'Grado', 'Grupo', 'Estatus Alumno', 'Estatus Pago Lypro', 'Fecha Confirmado'];
    const rows = students.map((item) => [
      `"${item.student.usuario}"`,
      `"${item.student.nombre}"`,
      `"${item.student.nivelEscolar}"`,
      `"${item.student.grado || ''}"`,
      `"${item.student.grupo || ''}"`,
      `"${item.student.estado}"`,
      `"${item.lypro?.estado || 'Pendiente'}"`,
      `"${item.lypro?.fechaConfirmado ? formatDateDisplay(item.lypro.fechaConfirmado) : 'N/A'}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${fileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Formato para mostrar fechas amigables
  const todayFormatted = useMemo(() => formatDateDisplay(todayISO), [formatDateDisplay, todayISO]);
  const yesterdayFormatted = useMemo(() => formatDateDisplay(yesterdayISO), [formatDateDisplay, yesterdayISO]);

  const isInnovatiq = sectionType === 'innovatiq';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider ${
                isInnovatiq
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                  : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
              }`}>
                {isSupervisor ? 'Panel de Supervisión' : 'Administración'} · Cuota de Lypro
              </span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-slate-400 font-medium">
                {isInnovatiq ? 'Kínder 1 a 12º Preparatoria' : '2º de Primaria a 12º Preparatoria'}
              </span>
            </div>
            <h2 className="text-2xl font-black text-white mt-1.5 flex items-center gap-3">
              {isInnovatiq ? (
                <>
                  <Sparkles className="w-6 h-6 text-cyan-400" />
                  <span>Dashboard Innovatiq</span>
                </>
              ) : (
                <>
                  <BookOpen className="w-6 h-6 text-indigo-400" />
                  <span>Dashboard Progrentis</span>
                </>
              )}
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {isInnovatiq
                ? 'Monitoreo exclusivo de la Cuota de Lypro para los niveles Kínder 1 a 12º de Preparatoria. Haga clic en cualquiera de las métricas para consultar la lista detallada con los nombres de los alumnos.'
                : 'Supervisión de alumnos con cuota de Lypro cubierta abarcando desde 2º de Primaria hasta 12º de Preparatoria. Haga clic en cualquiera de las métricas para ver los alumnos correspondientes.'}
            </p>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 flex items-center gap-3">
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-slate-400">Avance Lypro</div>
                <div className="text-lg font-extrabold text-emerald-400">{metricsData.completionRate}%</div>
              </div>
              <div className="w-10 h-10 rounded-full border-2 border-slate-800 flex items-center justify-center font-bold text-xs text-white bg-slate-900">
                {metricsData.confirmados.length}/{metricsData.total}
              </div>
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="mt-5 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>Confirmados: {metricsData.confirmados.length}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
              <span>En Revisión: {metricsData.enRevision.length}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              <span>Pendientes: {metricsData.pendientes.length}</span>
            </span>
            <span>Total: {metricsData.total} Alumnos</span>
          </div>

          <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800 p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => handleCardClick('confirmados')}
              style={{ width: `${(metricsData.confirmados.length / (metricsData.total || 1)) * 100}%` }}
              className="bg-emerald-500 h-full rounded-l transition-all hover:brightness-125 cursor-pointer"
              title="Confirmados (Haz clic para ver lista de alumnos)"
            />
            <button
              type="button"
              onClick={() => handleCardClick('en_revision')}
              style={{ width: `${(metricsData.enRevision.length / (metricsData.total || 1)) * 100}%` }}
              className="bg-blue-500 h-full transition-all hover:brightness-125 cursor-pointer"
              title="En Revisión (Haz clic para ver lista de alumnos)"
            />
            <button
              type="button"
              onClick={() => handleCardClick('pendientes')}
              style={{ width: `${(metricsData.pendientes.length / (metricsData.total || 1)) * 100}%` }}
              className="bg-amber-500 h-full rounded-r transition-all hover:brightness-125 cursor-pointer"
              title="Pendientes (Haz clic para ver lista de alumnos)"
            />
          </div>
        </div>
      </div>

      {/* 8 KPI METRIC CARDS - ALL CLICKABLE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Cantidad de Alumnos */}
        <button
          type="button"
          onClick={() => handleCardClick('todos')}
          className="bg-slate-900 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900/90 rounded-2xl p-5 shadow-xl relative overflow-hidden text-left transition-all hover:scale-[1.02] cursor-pointer group"
          title="Haz clic para ver el listado de todos los alumnos de esta sección (Altas y Bajas)"
        >
          <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500/20 group-hover:scale-110 transition-all">
            <Users className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="text-xs font-bold text-slate-400 group-hover:text-cyan-300 transition-colors uppercase tracking-wider">
            Cantidad de Alumnos
          </div>
          <div className="text-3xl font-extrabold text-white mt-2">{metricsData.total}</div>
          <div className="text-[11px] text-cyan-400/90 mt-1 font-semibold flex items-center justify-between">
            <span>{metricsData.altas.length} activos · {metricsData.bajas.length} bajas</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* 2. Confirmados en Total */}
        <button
          type="button"
          onClick={() => handleCardClick('confirmados')}
          className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900/90 rounded-2xl p-5 shadow-xl relative overflow-hidden text-left transition-all hover:scale-[1.02] cursor-pointer group"
          title="Haz clic para ver todos los alumnos con Cuota de Lypro confirmada"
        >
          <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 group-hover:scale-110 transition-all">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-xs font-bold text-slate-400 group-hover:text-emerald-300 transition-colors uppercase tracking-wider">
            Confirmados en Total
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 mt-2">{metricsData.confirmados.length}</div>
          <div className="text-[11px] text-emerald-400/90 mt-1 font-semibold flex items-center gap-1">
            <span>{metricsData.completionRate}% del total · Ver alumnos</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* 3. Confirmados Hoy */}
        <button
          type="button"
          onClick={() => handleCardClick('confirmados_hoy')}
          className="bg-slate-900 border border-slate-800 hover:border-teal-500/50 hover:bg-slate-900/90 rounded-2xl p-5 shadow-xl relative overflow-hidden text-left transition-all hover:scale-[1.02] cursor-pointer group"
          title="Haz clic para ver los alumnos con Cuota de Lypro confirmada hoy"
        >
          <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 group-hover:bg-teal-500/20 group-hover:scale-110 transition-all">
            <Calendar className="w-5 h-5 text-teal-400" />
          </div>
          <div className="text-xs font-bold text-slate-400 group-hover:text-teal-300 transition-colors uppercase tracking-wider">
            Confirmados Hoy
          </div>
          <div className="text-3xl font-extrabold text-teal-300 mt-2">{metricsData.confirmadosHoy.length}</div>
          <div className="text-[11px] text-teal-400/90 mt-1 font-semibold flex items-center gap-1 truncate">
            <span>Hoy ({todayFormatted}) · Ver lista</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform shrink-0" />
          </div>
        </button>

        {/* 4. Confirmados Ayer */}
        <button
          type="button"
          onClick={() => handleCardClick('confirmados_ayer')}
          className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/90 rounded-2xl p-5 shadow-xl relative overflow-hidden text-left transition-all hover:scale-[1.02] cursor-pointer group"
          title="Haz clic para ver los alumnos con Cuota de Lypro confirmada ayer"
        >
          <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20 group-hover:scale-110 transition-all">
            <CalendarDays className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-xs font-bold text-slate-400 group-hover:text-indigo-300 transition-colors uppercase tracking-wider">
            Confirmados Ayer
          </div>
          <div className="text-3xl font-extrabold text-indigo-300 mt-2">{metricsData.confirmadosAyer.length}</div>
          <div className="text-[11px] text-indigo-400/90 mt-1 font-semibold flex items-center gap-1 truncate">
            <span>Ayer ({yesterdayFormatted}) · Ver lista</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform shrink-0" />
          </div>
        </button>

        {/* 5. En Revisión */}
        <button
          type="button"
          onClick={() => handleCardClick('en_revision')}
          className="bg-slate-900 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-900/90 rounded-2xl p-5 shadow-xl relative overflow-hidden text-left transition-all hover:scale-[1.02] cursor-pointer group"
          title="Haz clic para ver los alumnos con Cuota de Lypro en revisión"
        >
          <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20 group-hover:scale-110 transition-all">
            <Clock className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-xs font-bold text-slate-400 group-hover:text-blue-300 transition-colors uppercase tracking-wider">
            En Revisión
          </div>
          <div className="text-3xl font-extrabold text-blue-400 mt-2">{metricsData.enRevision.length}</div>
          <div className="text-[11px] text-blue-400/90 mt-1 font-semibold flex items-center gap-1">
            <span>Comprobante enviado · Ver alumnos</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* 6. Pendientes */}
        <button
          type="button"
          onClick={() => handleCardClick('pendientes')}
          className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-900/90 rounded-2xl p-5 shadow-xl relative overflow-hidden text-left transition-all hover:scale-[1.02] cursor-pointer group"
          title="Haz clic para ver los alumnos con Cuota de Lypro pendiente"
        >
          <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/20 group-hover:scale-110 transition-all">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-xs font-bold text-slate-400 group-hover:text-amber-300 transition-colors uppercase tracking-wider">
            Pendientes
          </div>
          <div className="text-3xl font-extrabold text-amber-400 mt-2">{metricsData.pendientes.length}</div>
          <div className="text-[11px] text-amber-400/90 mt-1 font-semibold flex items-center gap-1">
            <span>Sin reporte registrado · Ver alumnos</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* 7. Baja */}
        <button
          type="button"
          onClick={() => handleCardClick('bajas')}
          className="bg-slate-900 border border-slate-800 hover:border-red-500/50 hover:bg-slate-900/90 rounded-2xl p-5 shadow-xl relative overflow-hidden text-left transition-all hover:scale-[1.02] cursor-pointer group"
          title="Haz clic para ver los alumnos dados de baja en este rango"
        >
          <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 group-hover:bg-red-500/20 group-hover:scale-110 transition-all">
            <UserX className="w-5 h-5 text-red-400" />
          </div>
          <div className="text-xs font-bold text-slate-400 group-hover:text-red-300 transition-colors uppercase tracking-wider">
            Baja
          </div>
          <div className="text-3xl font-extrabold text-red-400 mt-2">{metricsData.bajas.length}</div>
          <div className="text-[11px] text-red-400/90 mt-1 font-semibold flex items-center gap-1">
            <span>Inactivos en colegio · Ver lista</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* 8. Nuevo Ingreso */}
        <button
          type="button"
          onClick={() => handleCardClick('nuevo_ingreso')}
          className="bg-slate-900 border border-slate-800 hover:border-violet-500/50 hover:bg-slate-900/90 rounded-2xl p-5 shadow-xl relative overflow-hidden text-left transition-all hover:scale-[1.02] cursor-pointer group"
          title="Haz clic para ver los alumnos de nuevo ingreso en este rango"
        >
          <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400 group-hover:bg-violet-500/20 group-hover:scale-110 transition-all">
            <Sparkles className="w-5 h-5 text-violet-400" />
          </div>
          <div className="text-xs font-bold text-slate-400 group-hover:text-violet-300 transition-colors uppercase tracking-wider">
            Nuevo Ingreso
          </div>
          <div className="text-3xl font-extrabold text-violet-300 mt-2">{metricsData.nuevoIngreso.length}</div>
          <div className="text-[11px] text-violet-400/90 mt-1 font-semibold flex items-center gap-1">
            <span>Alumnos recientes · Ver lista</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
      </div>

      {/* DETAILED IN-PAGE STUDENT TABLE SECTION */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-4">
        {/* Table Controls Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>Alumnos y Estado de Cuota Lypro</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Mostrando {tableStudentsList.length} de {scopedStudents.length} alumnos según los filtros activos.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopyNames(tableStudentsList)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Copiar lista de nombres filtrados"
              >
                {copiedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSuccess ? '¡Copiado!' : 'Copiar Nombres'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportCSV(tableStudentsList, `${sectionType}_lypro_alumnos`)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Descargar tabla en formato CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar CSV</span>
              </button>
            </div>
          </div>

          {/* Filter Pills Row (Synchronized with 8 Metrics) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] text-slate-500 font-semibold px-1 shrink-0 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              <span>Filtro:</span>
            </span>

            {[
              { key: 'todos' as MetricType, label: 'Todos', count: metricsData.total },
              { key: 'confirmados' as MetricType, label: 'Confirmados', count: metricsData.confirmados.length },
              { key: 'confirmados_hoy' as MetricType, label: 'Confirmados Hoy', count: metricsData.confirmadosHoy.length },
              { key: 'confirmados_ayer' as MetricType, label: 'Confirmados Ayer', count: metricsData.confirmadosAyer.length },
              { key: 'en_revision' as MetricType, label: 'En Revisión', count: metricsData.enRevision.length },
              { key: 'pendientes' as MetricType, label: 'Pendientes', count: metricsData.pendientes.length },
              { key: 'bajas' as MetricType, label: 'Bajas', count: metricsData.bajas.length },
              { key: 'nuevo_ingreso' as MetricType, label: 'Nuevo Ingreso', count: metricsData.nuevoIngreso.length },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  setTableFilter(f.key);
                  setTablePage(1);
                }}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                  tableFilter === f.key
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
                }`}
              >
                <span>{f.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  tableFilter === f.key ? 'bg-slate-950/30 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search & Nivel Filters Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => {
                  setTableSearch(e.target.value);
                  setTablePage(1);
                }}
                placeholder="Buscar por nombre, matrícula, grado o grupo..."
                className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              {tableSearch && (
                <button
                  type="button"
                  onClick={() => setTableSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Nivel selector buttons */}
            <div className="flex items-center gap-1 text-xs overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => {
                  setTableNivelFilter('TODOS');
                  setTablePage(1);
                }}
                className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  tableNivelFilter === 'TODOS'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos los Niveles
              </button>
              {isInnovatiq && (
                <button
                  type="button"
                  onClick={() => {
                    setTableNivelFilter('KINDER');
                    setTablePage(1);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                    tableNivelFilter === 'KINDER'
                      ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Kínder
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setTableNivelFilter('PRIMARIA');
                  setTablePage(1);
                }}
                className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  tableNivelFilter === 'PRIMARIA'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Primaria
              </button>
              <button
                type="button"
                onClick={() => {
                  setTableNivelFilter('SECUNDARIA');
                  setTablePage(1);
                }}
                className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  tableNivelFilter === 'SECUNDARIA'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Secundaria
              </button>
              <button
                type="button"
                onClick={() => {
                  setTableNivelFilter('PREPARATORIA');
                  setTablePage(1);
                }}
                className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  tableNivelFilter === 'PREPARATORIA'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Preparatoria
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/80 text-slate-300 font-bold uppercase border-b border-slate-800">
                <th className="p-3.5 w-12 text-center text-slate-500">#</th>
                <th className="p-3.5 min-w-[240px]">Nombre del Alumno</th>
                <th className="p-3.5">Matrícula / Usuario</th>
                <th className="p-3.5">Nivel Escolar</th>
                <th className="p-3.5">Grado / Grupo</th>
                <th className="p-3.5">Estatus Lypro</th>
                <th className="p-3.5">Fecha Confirmado</th>
                <th className="p-3.5 text-center">Estatus Alumno</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {tableStudentsList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-500 font-medium">
                    No se encontraron alumnos con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                paginatedTableStudents.map(({ student, lypro, isNuevo }, idx) => {
                  const globalIdx = (tablePage - 1) * pageSize + idx + 1;
                  const lyproEstado = lypro?.estado || 'Pendiente';

                  return (
                    <tr key={student.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 text-center text-slate-500 font-mono text-[11px]">
                        {globalIdx}
                      </td>

                      {/* Nombre del Alumno */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-cyan-400 shrink-0">
                            {student.nombre.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs hover:text-cyan-400 transition-colors">
                              {student.nombre}
                            </div>
                            {isNuevo && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-violet-400 mt-0.5 bg-violet-500/10 px-1.5 py-0.2 rounded border border-violet-500/20">
                                <Sparkles className="w-2.5 h-2.5" />
                                <span>Nuevo Ingreso</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Matrícula */}
                      <td className="p-3.5 font-mono text-slate-300 font-medium">
                        {student.usuario}
                      </td>

                      {/* Nivel Escolar */}
                      <td className="p-3.5 text-slate-300 font-medium">
                        {student.nivelEscolar}
                      </td>

                      {/* Grado / Grupo */}
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/60 font-semibold text-slate-300 text-[11px]">
                          {student.grado ? `${student.grado}º` : ''} "{student.grupo || 'Sin grupo'}"
                        </span>
                      </td>

                      {/* Estatus Pago Lypro */}
                      <td className="p-3.5">
                        {isSupervisor || !onOpenEditPago || !lypro ? (
                          <span className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1.5 ${
                            lyproEstado === 'Confirmado'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40'
                              : lyproEstado === 'En Revisión'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/40'
                              : lyproEstado === 'Requiere Aclaración'
                              ? 'bg-red-500/10 text-red-400 border-red-500/40'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/40'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            <span>{lyproEstado}</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onOpenEditPago(lypro, student.nombre)}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1.5 hover:scale-105 transition-transform cursor-pointer ${
                              lyproEstado === 'Confirmado'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40'
                                : lyproEstado === 'En Revisión'
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/40'
                                : lyproEstado === 'Requiere Aclaración'
                                ? 'bg-red-500/10 text-red-400 border-red-500/40'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/40'
                            }`}
                            title="Editar estado de pago"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            <span>{lyproEstado}</span>
                          </button>
                        )}
                      </td>

                      {/* Fecha Confirmado */}
                      <td className="p-3.5 font-mono text-[11px] text-slate-400">
                        {lypro?.fechaConfirmado ? (
                          <span className="text-emerald-400 font-medium">
                            {formatDateDisplay(lypro.fechaConfirmado)}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Estatus Alumno */}
                      <td className="p-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          student.estado === 'Alta'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}>
                          {student.estado}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Página <span className="font-bold text-white">{tablePage}</span> de{' '}
              <span className="font-bold text-white">{totalPages}</span> ({tableStudentsList.length} alumnos en total)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                disabled={tablePage === 1}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-300"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}
                disabled={tablePage === totalPages}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-300"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: LISTADO COMPLETO DE ALUMNOS AL HACER CLIC EN CUALQUIER TARJETA */}
      {modalMetric && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">
                      {getMetricTitle(modalMetric)}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                      {modalStudentsList.length} {modalStudentsList.length === 1 ? 'Alumno' : 'Alumnos'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isInnovatiq ? 'Innovatiq (K1 a 12º)' : 'Progrentis (2º a 12º)'} · Estatus de Cuota de Lypro
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalMetric(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search & Filters */}
            <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Buscar alumno por nombre, matrícula o grupo..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Nivel filter chips inside modal */}
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setModalNivelFilter('TODOS')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                    modalNivelFilter === 'TODOS' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  Todos
                </button>
                {isInnovatiq && (
                  <button
                    type="button"
                    onClick={() => setModalNivelFilter('KINDER')}
                    className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                      modalNivelFilter === 'KINDER' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    Kínder
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setModalNivelFilter('PRIMARIA')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                    modalNivelFilter === 'PRIMARIA' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  Primaria
                </button>
                <button
                  type="button"
                  onClick={() => setModalNivelFilter('SECUNDARIA')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                    modalNivelFilter === 'SECUNDARIA' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  Secundaria
                </button>
                <button
                  type="button"
                  onClick={() => setModalNivelFilter('PREPARATORIA')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                    modalNivelFilter === 'PREPARATORIA' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  Preparatoria
                </button>
              </div>
            </div>

            {/* Modal List of Students */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-slate-800/40">
              {modalStudentsList.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  No hay alumnos en este criterio.
                </div>
              ) : (
                <div className="space-y-2">
                  {modalStudentsList.map(({ student, lypro, isNuevo }, idx) => {
                    const lyproEstado = lypro?.estado || 'Pendiente';
                    return (
                      <div
                        key={student.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/70 hover:border-cyan-500/40 hover:bg-slate-950 transition-all gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-xs text-cyan-400 shrink-0">
                            {idx + 1}
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs flex items-center gap-2">
                              <span>{student.nombre}</span>
                              {isNuevo && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-violet-400 bg-violet-500/10 px-1.5 py-0.2 rounded border border-violet-500/20">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  <span>Nuevo</span>
                                </span>
                              )}
                              {student.estado === 'Baja' && (
                                <span className="text-[9px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.2 rounded border border-red-500/20">
                                  Baja
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 font-medium">
                              <span className="font-mono text-cyan-400/90">{student.usuario}</span>
                              <span>•</span>
                              <span>{student.nivelEscolar} {student.grado ? `${student.grado}º` : ''} "{student.grupo || ''}"</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          {lypro?.fechaConfirmado && (
                            <div className="text-right text-[10px] text-slate-400 font-mono hidden md:block">
                              <span className="text-slate-500 block">Confirmado</span>
                              <span className="text-emerald-400 font-semibold">{formatDateDisplay(lypro.fechaConfirmado)}</span>
                            </div>
                          )}

                          <span className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1.5 ${
                            lyproEstado === 'Confirmado'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40'
                              : lyproEstado === 'En Revisión'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/40'
                              : lyproEstado === 'Requiere Aclaración'
                              ? 'bg-red-500/10 text-red-400 border-red-500/40'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/40'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            <span>{lyproEstado}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer with Actions */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-400">
                Mostrando <strong className="text-white">{modalStudentsList.length}</strong> alumnos
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleCopyNames(modalStudentsList)}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  {copiedSuccess ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedSuccess ? '¡Nombres Copiados!' : 'Copiar Nombres'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportCSV(modalStudentsList, `${sectionType}_${modalMetric}_alumnos`)}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Lista</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
