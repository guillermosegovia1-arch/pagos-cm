'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  LogOut,
  Send,
  Loader2,
  User,
  GraduationCap,
  X,
  PlayCircle,
  FileText,
  Calendar,
  TrendingUp,
  BarChart3,
  AlertCircle,
  ChevronRight,
  BookOpen,
  Info,
  Youtube,
  Bell,
  CheckCheck,
  Trash2,
} from 'lucide-react';
import { getConceptosForNivel } from '@/lib/concepts';

interface Notificacion {
  id: string;
  pagoId?: string;
  titulo: string;
  mensaje: string;
  tipo: 'confirmado' | 'revision' | 'aclaracion';
  pagoTipo?: 'ANUAL' | 'MENSUAL';
  mesColegiatura?: string | null;
  concepto: string;
  estado: string;
  fechaActualizacion: string;
}

interface Pago {
  id: string;
  concepto: string;
  tipo: string;
  estado: 'Pendiente' | 'En Revisión' | 'Confirmado' | 'Requiere Aclaración';
  numeroConfirmacion: string | null;
  motivoAclaracion: string | null;
  respuestaAlumno: string | null;
  notaConcepto?: string | null;
  mesColegiatura?: string | null;
  fechaVencimiento?: string | null;
  fechaReportado: string | null;
}

interface UserProfile {
  id: string;
  nombre: string;
  usuario: string;
  nivelEscolar: string;
  grado?: string | null;
  grupo?: string | null;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const getCurrentMonthName = () => {
  const now = new Date();
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
};

const isPreparatoria = (nivel: string) =>
  nivel?.toLowerCase().includes('preparatoria') ||
  nivel?.toLowerCase().includes('prepa') ||
  nivel?.toLowerCase().includes('bachiller');

/** Meses del ciclo escolar según nivel */
const getMesesCiclo = (nivel: string) => {
  if (isPreparatoria(nivel)) {
    return ['Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio'];
  }
  return ['Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'];
};

/** Fecha de vencimiento de cada concepto según nivel */
const getVencimientoConcepto = (concepto: string, nivel: string): { label: string; nota?: string } | null => {
  const n = concepto.toLowerCase();
  const esPrepa = isPreparatoria(nivel);

  if (n.includes('knotion')) {
    return {
      label: '31 de Agosto',
      nota: 'Precio especial hasta el 31 de Agosto. A partir del 1° de Septiembre el costo incrementa.',
    };
  }
  if (n.includes('lypro')) {
    return { label: '30 de Septiembre' };
  }
  if (n.includes('inscripci') || n.includes('reinscripci')) {
    if (esPrepa) {
      return { label: '10 de Julio / 10 de Enero', nota: 'Preparatoria tiene dos fechas de vencimiento: 10 de Julio y 10 de Enero.' };
    }
    return { label: '10 de Agosto' };
  }
  if (n.includes('tecnolog') || n.includes('materia') || n.includes('escolar')) {
    return { label: '10 de Agosto' };
  }
  return null;
};

const formatVencimiento = (fechaStr?: string | null) => {
  if (!fechaStr) return null;
  const d = new Date(fechaStr + 'T12:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const formatted = `${day}/${month}/${year}`;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const isExpired = d < todayStart;

  return { formatted, isExpired };
};

/** Calcula el estado del vencimiento mensual (día 10 de cada mes) */
const getMensualDueInfo = () => {
  const today = new Date();
  const day = today.getDate();
  const hasRecargo = day > 10;
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  const monthName = monthNames[today.getMonth()];
  return { hasRecargo, day, monthName };
};

const getPlatformInfo = (concepto: string) => {
  const norm = concepto.toLowerCase();
  if (norm.includes('knotion')) {
    return {
      name: 'Knotion',
      url: 'https://dep.knotion.com/login',
      logo: '/logos/knotion.png',
      bg: 'bg-teal-500/10',
      border: 'border-teal-500/30',
      text: 'text-teal-300',
      hover: 'hover:border-teal-400/60 hover:bg-teal-500/15',
    };
  }
  if (norm.includes('lypro')) {
    return {
      name: 'Lypro',
      url: 'https://lyprocolegiomexicano.appssolution.net/',
      logo: '/logos/lypro.png',
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      text: 'text-red-300',
      hover: 'hover:border-red-400/60 hover:bg-red-500/15',
    };
  }
  return {
    name: 'SchoolCloud',
    url: 'https://erp.schoolcloud.net/campus/cm',
    logo: '/logos/schoolcloud.png',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    text: 'text-sky-300',
    hover: 'hover:border-sky-400/60 hover:bg-sky-500/15',
  };
};

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: 'blue' | 'amber' | 'green' | 'red';
  progress: number; // 0-100
  sublabel?: string;
  onClick?: () => void;
}

const colorMap = {
  blue: {
    ring: 'ring-blue-500/30',
    icon: 'bg-blue-500/15 text-blue-400',
    bar: 'bg-blue-500',
    track: 'bg-blue-500/15',
    value: 'text-blue-300',
    badge: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
  },
  amber: {
    ring: 'ring-amber-500/30',
    icon: 'bg-amber-500/15 text-amber-400',
    bar: 'bg-amber-500',
    track: 'bg-amber-500/15',
    value: 'text-amber-300',
    badge: 'bg-amber-500/20 border-amber-500/30 text-amber-400',
  },
  green: {
    ring: 'ring-emerald-500/30',
    icon: 'bg-emerald-500/15 text-emerald-400',
    bar: 'bg-emerald-500',
    track: 'bg-emerald-500/15',
    value: 'text-emerald-300',
    badge: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
  },
  red: {
    ring: 'ring-red-500/30',
    icon: 'bg-red-500/15 text-red-400',
    bar: 'bg-red-500',
    track: 'bg-red-500/15',
    value: 'text-red-300',
    badge: 'bg-red-500/20 border-red-500/30 text-red-400',
  },
};

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, progress, sublabel, onClick }) => {
  const c = colorMap[color];
  return (
    <div
      onClick={onClick}
      className={`relative bg-slate-900/80 border border-slate-800 rounded-2xl p-5 ring-1 ${c.ring} overflow-hidden group hover:scale-[1.02] transition-transform duration-200 ${onClick ? 'cursor-pointer hover:border-slate-600' : 'cursor-default'}`}
    >
      {/* glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `radial-gradient(circle at 60% 40%, ${color === 'blue' ? 'rgba(59,130,246,0.07)' : color === 'amber' ? 'rgba(245,158,11,0.07)' : color === 'green' ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)'} 0%, transparent 70%)` }}
      />

      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.icon} text-sm`}>
          {icon}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-2xl font-black tracking-tight ${c.value}`}>{value}</span>
          {onClick && (
            <span className="text-[10px] text-slate-500 group-hover:text-slate-300 transition-colors flex items-center gap-0.5 font-medium">
              Ver detalle
              <ChevronRight className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>

      <p className="text-xs font-semibold text-slate-300 leading-tight">{label}</p>
      {sublabel && <p className="text-[10px] text-slate-500 mt-0.5">{sublabel}</p>}

      {/* progress bar */}
      <div className={`mt-3 h-1.5 rounded-full ${c.track}`}>
        <div
          className={`h-full rounded-full ${c.bar} transition-all duration-700`}
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
    </div>
  );
};

// ── Monthly Calendar ──────────────────────────────────────────────────────────

const MonthlyCalendar: React.FC<{
  pagos: Pago[];
  nivel: string;
  onMonthClick?: (mes: string) => void;
}> = ({ pagos, nivel, onMonthClick }) => {
  const meses = getMesesCiclo(nivel);
  const totalMeses = meses.length;

  const pagosMensuales = pagos.filter((p) => p.tipo === 'MENSUAL');

  // Map month name -> payment state
  const monthState: Record<string, Pago['estado'] | 'sin-pago'> = {};
  meses.forEach((m) => {
    const found = pagosMensuales.find((p) => {
      const mes = (p.mesColegiatura || '').toLowerCase();
      return mes.includes(m.toLowerCase());
    });
    monthState[m] = found ? found.estado : 'sin-pago';
  });

  const confirmedCount = Object.values(monthState).filter((s) => s === 'Confirmado').length;
  const reviewCount = Object.values(monthState).filter((s) => s === 'En Revisión').length;
  const pendingCount = totalMeses - confirmedCount - reviewCount;

  const currentMonth = new Date().toLocaleString('es-MX', { month: 'long' });
  const currentMonthCap = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <Calendar className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Colegiaturas del Ciclo Escolar</h3>
            <p className="text-[10px] text-slate-500">
              {totalMeses} meses · {isPreparatoria(nivel) ? 'Agosto – Julio' : 'Agosto – Junio'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs text-emerald-400 font-bold">{confirmedCount}/{totalMeses}</span>
          <p className="text-[10px] text-slate-500">confirmados</p>
        </div>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {meses.map((mes) => {
          const state = monthState[mes];
          const isCurrent = mes === currentMonthCap || currentMonthCap.startsWith(mes.slice(0, 3));

          let bg = 'bg-slate-800/60 border-slate-700/60 text-slate-500';
          let dot = 'bg-slate-600';
          let label = '';

          if (state === 'Confirmado') {
            bg = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
            dot = 'bg-emerald-400';
            label = '✓';
          } else if (state === 'En Revisión') {
            bg = 'bg-blue-500/10 border-blue-500/30 text-blue-300';
            dot = 'bg-blue-400';
            label = '…';
          } else if (state === 'Requiere Aclaración') {
            bg = 'bg-red-500/10 border-red-500/30 text-red-300';
            dot = 'bg-red-400';
            label = '!';
          }

          return (
            <button
              key={mes}
              type="button"
              onClick={() => onMonthClick?.(mes)}
              title={
                isCurrent
                  ? `Mes actual (${mes}) · Clic para ir a Colegiaturas`
                  : `Colegiatura de ${mes} · Clic para ver`
              }
              className={`relative rounded-xl border px-2 py-2.5 text-center transition-all cursor-pointer group ${bg} ${
                isCurrent
                  ? 'ring-2 ring-cyan-400 bg-cyan-500/15 text-cyan-200 shadow-md shadow-cyan-500/20 hover:bg-cyan-500/25 hover:scale-105 active:scale-95'
                  : 'hover:bg-slate-800 hover:text-slate-300 hover:scale-105 active:scale-95'
              }`}
            >
              {isCurrent && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 ring-2 ring-slate-900 animate-pulse" />
              )}
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  isCurrent && state === 'sin-pago' ? 'bg-cyan-400' : dot
                } mx-auto mb-1`}
              />
              <p
                className={`text-[10px] font-bold leading-none ${
                  isCurrent ? 'text-cyan-100 group-hover:text-white' : ''
                }`}
              >
                {mes.slice(0, 3)}
              </p>
              {label ? (
                <p className="text-[9px] mt-0.5 opacity-80">{label}</p>
              ) : isCurrent ? (
                <p className="text-[8px] mt-0.5 text-cyan-400 font-extrabold tracking-tight">Actual</p>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 pt-1 border-t border-slate-800 items-center">
        {[
          { color: 'bg-emerald-400', label: 'Confirmado' },
          { color: 'bg-blue-400', label: 'En Revisión' },
          { color: 'bg-red-400', label: 'Aclaración' },
          { color: 'bg-slate-600', label: 'Pendiente' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <div className={`w-2 h-2 rounded-full ${item.color}`} />
            <span>{item.label}</span>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onMonthClick?.(currentMonthCap)}
          title="Ver colegiatura del mes actual"
          className="flex items-center gap-1.5 text-[10px] text-cyan-400 hover:text-cyan-300 ml-auto cursor-pointer transition-colors"
        >
          <div className="w-2.5 h-2.5 rounded-full ring-1 ring-cyan-400 bg-cyan-400/20" />
          <span>Mes actual (clic para ir)</span>
        </button>
      </div>
    </div>
  );
};

// ── Due Dates Info Panel ──────────────────────────────────────────────────────

const DueDatesPanel: React.FC<{
  nivel: string;
  onConceptClick: (keyword: string, tab: 'ANUAL' | 'MENSUAL') => void;
}> = ({ nivel, onConceptClick }) => {
  const esPrepa = isPreparatoria(nivel);

  const items: {
    concepto: string;
    keyword: string;
    tab: 'ANUAL' | 'MENSUAL';
    vencimiento: string;
    nota?: string;
    color: string;
    hoverColor: string;
    icon: string;
  }[] = [
    {
      concepto: 'Inscripción / Reinscripción',
      keyword: 'inscripci',
      tab: 'ANUAL',
      vencimiento: esPrepa ? '10 de Julio · 10 de Enero' : '10 de Agosto',
      nota: esPrepa ? 'Dos periodos para Preparatoria' : undefined,
      color: 'border-sky-500/30 bg-sky-500/5 text-sky-300',
      hoverColor: 'hover:border-sky-400/60 hover:bg-sky-500/10',
      icon: '📋',
    },
    {
      concepto: 'Cuota de Tecnología',
      keyword: 'tecnolog',
      tab: 'ANUAL',
      vencimiento: '10 de Agosto',
      color: 'border-sky-500/30 bg-sky-500/5 text-sky-300',
      hoverColor: 'hover:border-sky-400/60 hover:bg-sky-500/10',
      icon: '💻',
    },
    {
      concepto: 'Cuota de Materia',
      keyword: 'materia',
      tab: 'ANUAL',
      vencimiento: '10 de Agosto',
      color: 'border-sky-500/30 bg-sky-500/5 text-sky-300',
      hoverColor: 'hover:border-sky-400/60 hover:bg-sky-500/10',
      icon: '📚',
    },
    {
      concepto: 'Cuota Escolar Anual',
      keyword: 'escolar',
      tab: 'ANUAL',
      vencimiento: '10 de Agosto',
      color: 'border-sky-500/30 bg-sky-500/5 text-sky-300',
      hoverColor: 'hover:border-sky-400/60 hover:bg-sky-500/10',
      icon: '🏫',
    },
    {
      concepto: 'Knotion',
      keyword: 'knotion',
      tab: 'ANUAL',
      vencimiento: '31 de Agosto',
      nota: 'Precio especial hasta el 31 Ago. Incrementa a partir del 1° Sep.',
      color: 'border-teal-500/30 bg-teal-500/5 text-teal-300',
      hoverColor: 'hover:border-teal-400/60 hover:bg-teal-500/10',
      icon: '🖥️',
    },
    {
      concepto: 'Lypro',
      keyword: 'lypro',
      tab: 'ANUAL',
      vencimiento: '30 de Septiembre',
      color: 'border-rose-500/30 bg-rose-500/5 text-rose-300',
      hoverColor: 'hover:border-rose-400/60 hover:bg-rose-500/10',
      icon: '📖',
    },
    {
      concepto: 'Colegiatura Mensual',
      keyword: 'colegiatura',
      tab: 'MENSUAL',
      vencimiento: 'Día 10 de cada mes',
      nota: 'A partir del día 11 se aplican recargos por pago extemporáneo.',
      color: 'border-amber-500/30 bg-amber-500/5 text-amber-300',
      hoverColor: 'hover:border-amber-400/60 hover:bg-amber-500/10',
      icon: '📅',
    },
  ];

  const nivelConcepts = getConceptosForNivel(nivel);
  const visibleItems = items.filter((item) =>
    nivelConcepts.some((nc) =>
      nc.concepto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .includes(
          item.keyword
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
        )
    )
  );
  const itemsToRender = visibleItems.length > 0 ? visibleItems : items;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center">
          <AlertCircle className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Fechas de Vencimiento de Conceptos</h3>
          <p className="text-[10px] text-slate-500">Haz click en un concepto para ver su estado de pago</p>
        </div>
      </div>

      <div className="space-y-2">
        {itemsToRender.map((item) => (
          <button
            key={item.concepto}
            type="button"
            onClick={() => onConceptClick(item.keyword, item.tab)}
            className={`w-full flex items-start gap-3 p-3 rounded-xl border ${item.color} ${item.hoverColor} transition-all cursor-pointer group text-left`}
          >
            <span className="text-base mt-0.5 flex-shrink-0">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">{item.concepto}</span>
                <span className="text-xs font-black whitespace-nowrap">{item.vencimiento}</span>
              </div>
              {item.nota && (
                <p className="text-[10px] text-slate-400 mt-0.5 flex items-start gap-1">
                  <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  {item.nota}
                </p>
              )}
            </div>
            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-600 group-hover:text-slate-300 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
};

// ── Platform Logo Card ─────────────────────────────────────────────────────────

const PlatformCard: React.FC<{
  name: string;
  url: string;
  logo: string;
  desc: string;
  bg: string;
  border: string;
  hover: string;
}> = ({ name, url, logo, desc, bg, border, hover }) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    className={`group flex flex-col items-center gap-3 p-4 rounded-2xl border ${bg} ${border} ${hover} transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer`}
  >
    <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-white/90 p-1 shadow-sm group-hover:scale-105 transition-transform duration-200">
      <Image src={logo} alt={name} fill className="object-contain p-0.5" sizes="56px" />
    </div>
    <div className="text-center">
      <p className="text-xs font-bold text-slate-100 group-hover:text-white">{name}</p>
      <p className="text-[10px] text-slate-500">{desc}</p>
    </div>
    <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-slate-300 transition-colors" />
  </a>
);

// ── Main Component ────────────────────────────────────────────────────────────

export default function StudentDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Ref para scroll a la sección de pagos
  const paymentsRef = React.useRef<HTMLElement>(null);

  const scrollToPayments = (tab: 'ANUAL' | 'MENSUAL', filter?: string | null) => {
    setSelectedConceptTab(tab);
    setStatusFilter(filter ?? null);
    setConceptFilter(null);
    setTimeout(() => {
      paymentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const scrollToConcepto = (keyword: string, tab: 'ANUAL' | 'MENSUAL') => {
    setSelectedConceptTab(tab);
    setStatusFilter(null);
    setConceptFilter(keyword);
    setTimeout(() => {
      paymentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const scrollToMonthly = (mes?: string) => {
    setSelectedConceptTab('MENSUAL');
    setStatusFilter(null);
    setConceptFilter(null);

    const matchedPago = mes
      ? pagos.find(
          (p) =>
            p.tipo === 'MENSUAL' &&
            p.mesColegiatura?.toLowerCase().trim().startsWith(mes.toLowerCase().trim().slice(0, 3))
        )
      : pagos.find((p) => p.tipo === 'MENSUAL');

    if (matchedPago) {
      setHighlightedPagoId(matchedPago.id);
      setTimeout(() => {
        const el = document.getElementById(`pago-card-${matchedPago.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          paymentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);

      setTimeout(() => {
        setHighlightedPagoId((prev) => (prev === matchedPago.id ? null : prev));
      }, 4000);
    } else {
      setTimeout(() => {
        paymentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  };

  const [highlightedPagoId, setHighlightedPagoId] = useState<string | null>(null);

  const handleNotificationClick = (notif: Notificacion) => {
    setShowNotifPanel(false);

    // Encontrar pago coincidente si existe
    const matchedPago =
      pagos.find((p) => (notif.pagoId && p.id === notif.pagoId) || p.id === notif.id) ||
      pagos.find((p) => p.concepto.toLowerCase().trim() === notif.concepto.toLowerCase().trim());

    const targetTab: 'ANUAL' | 'MENSUAL' =
      matchedPago?.tipo === 'MENSUAL' || notif.pagoTipo === 'MENSUAL' || notif.concepto.toLowerCase().includes('colegiatura')
        ? 'MENSUAL'
        : 'ANUAL';

    setSelectedConceptTab(targetTab);
    setStatusFilter(null);
    setConceptFilter(null);

    const targetId = matchedPago ? matchedPago.id : (notif.pagoId || notif.id);
    setHighlightedPagoId(targetId);

    setTimeout(() => {
      const el = document.getElementById(`pago-card-${targetId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        paymentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);

    setTimeout(() => {
      setHighlightedPagoId((prev) => (prev === targetId ? null : prev));
    }, 4500);
  };

  const [selectedPago, setSelectedPago] = useState<Pago | null>(null);
  const [confirmNumber, setConfirmNumber] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);

  const [clarifyPago, setClarifyPago] = useState<Pago | null>(null);
  const [clarifyResponse, setClarifyResponse] = useState('');
  const [showClarifyModal, setShowClarifyModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Evitar salir de la sesión al presionar botón Atrás en el navegador
  useEffect(() => {
    window.history.pushState({ page: 'alumno' }, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState({ page: 'alumno' }, '', window.location.href);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLogoClick = () => {
    setSelectedConceptTab('ANUAL');
    setStatusFilter(null);
    setConceptFilter(null);
    setHighlightedPagoId(null);
    setShowNotifPanel(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [selectedConceptTab, setSelectedConceptTab] = useState<'ANUAL' | 'MENSUAL'>('ANUAL');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [conceptFilter, setConceptFilter] = useState<string | null>(null);
  const [cicloEscolar, setCicloEscolar] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Notificaciones
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [deletedNotifIds, setDeletedNotifIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('pagos_cm_deleted_notifs');
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [lastSeenTs, setLastSeenTs] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pagos_cm_notif_seen') || '1970-01-01T00:00:00.000Z';
    }
    return '1970-01-01T00:00:00.000Z';
  });

  const visibleNotificaciones = notificaciones.filter(
    (n) => !deletedNotifIds.includes(n.id)
  );

  const unreadCount = visibleNotificaciones.filter(
    (n) => new Date(n.fechaActualizacion) > new Date(lastSeenTs)
  ).length;

  const markAllRead = () => {
    const now = new Date().toISOString();
    setLastSeenTs(now);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pagos_cm_notif_seen', now);
    }
  };

  const openNotifPanel = () => {
    setShowNotifPanel(true);
    markAllRead();
  };

  const handleDeleteNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = [...deletedNotifIds, id];
    setDeletedNotifIds(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pagos_cm_deleted_notifs', JSON.stringify(next));
    }
  };

  const handleClearAllNotifications = (e: React.MouseEvent) => {
    e.stopPropagation();
    const allIds = notificaciones.map((n) => n.id);
    const next = Array.from(new Set([...deletedNotifIds, ...allIds]));
    setDeletedNotifIds(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pagos_cm_deleted_notifs', JSON.stringify(next));
    }
  };

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/student/dashboard');
      if (res.status === 401 || res.status === 403) { router.push('/login'); return; }
      const data = await res.json();
      if (data.user) { setUser(data.user); setPagos(data.pagos || []); }
    } catch (err) {
      console.error('Error fetching dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetch('/api/settings/ciclo-escolar')
      .then((r) => r.json())
      .then((d) => { if (d.cicloEscolar) setCicloEscolar(d.cicloEscolar); })
      .catch((e) => console.error(e));
    // Cargar notificaciones
    fetch('/api/student/notifications')
      .then((r) => r.json())
      .then((d) => { if (d.notificaciones) setNotificaciones(d.notificaciones); })
      .catch((e) => console.error(e));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const openReportModal = (pago: Pago) => {
    setSelectedPago(pago);
    setConfirmNumber(pago.numeroConfirmacion || '');
    setShowReportModal(true);
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPago || !confirmNumber.trim()) return;
    setSubmitting(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/student/report-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pagoId: selectedPago.id,
          numeroConfirmacion: confirmNumber.trim(),
          mesColegiatura: selectedPago.tipo === 'MENSUAL' ? (selectedPago.mesColegiatura || getCurrentMonthName()) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al reportar pago');
      setFeedbackMsg({ type: 'success', text: 'En Revisión: El colegio está verificando el reporte recibido. (Espere de 1 a 3 días)' });
      setShowReportModal(false);
      setConfirmNumber('');
      fetchDashboard();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setFeedbackMsg({ type: 'error', text: message });
    } finally {
      setSubmitting(false);
    }
  };

  const openClarifyModal = (pago: Pago) => {
    setClarifyPago(pago);
    setClarifyResponse(pago.respuestaAlumno || '');
    setShowClarifyModal(true);
  };

  const handleClarifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clarifyPago || !clarifyResponse.trim()) return;
    setSubmitting(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/student/respond-clarification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pagoId: clarifyPago.id, respuestaAlumno: clarifyResponse.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar la respuesta');
      setFeedbackMsg({ type: 'success', text: 'Respuesta enviada correctamente. El colegio revisará los datos.' });
      setShowClarifyModal(false);
      setClarifyResponse('');
      fetchDashboard();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setFeedbackMsg({ type: 'error', text: message });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived stats ─────────────────────────────────────────────────────────

  const pagosAnuales = pagos.filter((p) => p.tipo === 'ANUAL');
  const totalAnual = pagosAnuales.length;
  const confirmadosAnual = pagosAnuales.filter((p) => p.estado === 'Confirmado').length;
  const enRevisionAnual = pagosAnuales.filter((p) => p.estado === 'En Revisión').length;
  const pendientesAnual = pagosAnuales.filter((p) => p.estado === 'Pendiente').length;

  const pagosMensuales = pagos.filter((p) => p.tipo === 'MENSUAL');
  const totalMeses = user ? getMesesCiclo(user.nivelEscolar).length : 11;
  const confirmadosMensual = pagosMensuales.filter((p) => p.estado === 'Confirmado').length;

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080c14] flex flex-col items-center justify-center text-slate-400 gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-indigo-600/20 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-300">Cargando panel de pagos...</p>
          <p className="text-xs text-slate-500 mt-1">Portal del Alumno · Colegio Mexicano</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── TOP NAV ────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#080c14]/90 backdrop-blur-xl border-b border-slate-800/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

          {/* Brand interactivo */}
          <button
            type="button"
            onClick={handleLogoClick}
            className="flex items-center gap-3 text-left cursor-pointer group hover:opacity-90 transition-opacity"
            title="Ir al inicio del Alumno y quitar filtros"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 flex-shrink-0 group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-black text-white tracking-tight group-hover:text-cyan-200 transition-colors">
                Pagos<span className="text-cyan-400">CM</span>
              </h1>
              <p className="text-[10px] text-slate-500 leading-none">Portal de Plataformas · Colegio Mexicano</p>
            </div>
          </button>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTutorialModal(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border border-cyan-500/20 hover:border-cyan-500/40 transition-all"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">¿Cómo pagar?</span>
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={openNotifPanel}
                className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 hover:border-slate-600 transition-all"
                title="Notificaciones"
              >
                <Bell className="w-4 h-4 text-slate-300" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center ring-2 ring-[#080c14] animate-bounce">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications dropdown panel */}
              {showNotifPanel && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowNotifPanel(false)}
                  />
                  {/* Panel */}
                  <div className="absolute right-0 top-11 z-50 w-80 sm:w-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/60">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm font-bold text-white">Notificaciones</span>
                        {visibleNotificaciones.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-400 font-mono">
                            {visibleNotificaciones.length}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {visibleNotificaciones.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearAllNotifications}
                            className="text-[11px] font-semibold text-slate-400 hover:text-red-400 transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-slate-800"
                            title="Eliminar todas las notificaciones"
                          >
                            Limpiar todo
                          </button>
                        )}
                        <button
                          onClick={() => setShowNotifPanel(false)}
                          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* List */}
                    <div className="max-h-[420px] overflow-y-auto">
                      {visibleNotificaciones.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 px-4 text-center space-y-3">
                          <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center">
                            <Bell className="w-6 h-6 text-slate-500" />
                          </div>
                          <p className="text-sm text-slate-400">Sin notificaciones por ahora</p>
                          <p className="text-xs text-slate-600">Cuando el colegio realice cambios en tus pagos, aparecerán aquí.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-800/80">
                          {visibleNotificaciones.map((notif) => {
                            const isNew = new Date(notif.fechaActualizacion) > new Date(lastSeenTs);
                            const fecha = new Date(notif.fechaActualizacion);
                            const fechaStr = fecha.toLocaleDateString('es-MX', {
                              day: '2-digit', month: 'short', year: 'numeric',
                            });
                            const horaStr = fecha.toLocaleTimeString('es-MX', {
                              hour: '2-digit', minute: '2-digit',
                            });

                            const iconColor =
                              notif.tipo === 'confirmado'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : notif.tipo === 'aclaracion'
                                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                                : 'bg-blue-500/15 text-blue-400 border-blue-500/30';

                            const Icon =
                              notif.tipo === 'confirmado'
                                ? CheckCircle2
                                : notif.tipo === 'aclaracion'
                                ? AlertTriangle
                                : Clock;

                            return (
                              <div
                                key={notif.id}
                                className={`w-full text-left flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer group hover:bg-slate-800/60 ${
                                  isNew ? 'bg-cyan-500/5' : ''
                                }`}
                                onClick={() => handleNotificationClick(notif)}
                              >
                                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 mt-0.5 ${iconColor}`}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors leading-tight">
                                      {notif.titulo}
                                    </p>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      {isNew && (
                                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                                      )}
                                      <button
                                        type="button"
                                        onClick={(e) => handleDeleteNotification(notif.id, e)}
                                        className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                                        title="Eliminar esta notificación"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                      <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                                    </div>
                                  </div>
                                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
                                    {notif.mensaje}
                                  </p>
                                  <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-500">
                                    <span>{fechaStr} · {horaStr}</span>
                                    <span className="text-cyan-400 font-semibold group-hover:text-cyan-300 flex items-center gap-0.5">
                                      Ver concepto →
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setShowLogoutModal(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN ───────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Feedback */}
        {feedbackMsg && (
          <div className={`p-4 rounded-2xl border flex items-center justify-between text-sm ${feedbackMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
            <span>{feedbackMsg.text}</span>
            <button onClick={() => setFeedbackMsg(null)} className="ml-4 text-slate-400 hover:text-white flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── HERO PROFILE ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-[#0f1729] to-[#080c14] border border-slate-800 p-6 sm:p-8 shadow-2xl">
          {/* Background glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-start gap-6 justify-between">
            {/* Left: user info */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold">
                  <GraduationCap className="w-3.5 h-3.5" />
                  {user?.nivelEscolar}
                  {user?.grado && user?.grupo && <span className="text-cyan-300">· {user.grado}° &quot;{user.grupo}&quot;</span>}
                </span>

                {cicloEscolar && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
                    <Calendar className="w-3 h-3" />
                    Ciclo {cicloEscolar}
                  </span>
                )}

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                  <CheckCircle2 className="w-3 h-3" />
                  Alumno Activo
                </span>
              </div>

              <div>
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">{user?.nombre}</h2>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                  <User className="w-3 h-3 text-slate-500" />
                  Usuario: <strong className="text-slate-200 font-mono ml-0.5">{user?.usuario}</strong>
                </p>
              </div>
            </div>

            {/* Right: platform logos */}
            <div className="flex-shrink-0">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2 text-center sm:text-right">Acceso a Plataformas</p>
              <div className="flex items-center gap-2">
                <PlatformCard
                  name="SchoolCloud"
                  url="https://erp.schoolcloud.net/campus/cm"
                  logo="/logos/schoolcloud.png"
                  desc="Control Escolar"
                  bg="bg-slate-800/50"
                  border="border-slate-700/60"
                  hover="hover:border-sky-400/50 hover:bg-sky-500/10"
                />
                <PlatformCard
                  name="Knotion"
                  url="https://dep.knotion.com/login"
                  logo="/logos/knotion.png"
                  desc="Aprendizaje"
                  bg="bg-slate-800/50"
                  border="border-slate-700/60"
                  hover="hover:border-teal-400/50 hover:bg-teal-500/10"
                />
                <PlatformCard
                  name="Lypro"
                  url="https://lyprocolegiomexicano.appssolution.net/"
                  logo="/logos/lypro.png"
                  desc="Material Didáctico"
                  bg="bg-slate-800/50"
                  border="border-slate-700/60"
                  hover="hover:border-red-400/50 hover:bg-red-500/10"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── DASHBOARD STATS ──────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Resumen de Pagos</h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              label="Pagos Anuales en Revisión"
              value={`${enRevisionAnual}/${totalAnual}`}
              icon={<Clock className="w-5 h-5" />}
              color="blue"
              progress={totalAnual > 0 ? (enRevisionAnual / totalAnual) * 100 : 0}
              sublabel="El colegio está verificando"
              onClick={() => scrollToPayments('ANUAL', 'En Revisión')}
            />
            <StatCard
              label="Pagos Anuales Confirmados"
              value={`${confirmadosAnual}/${totalAnual}`}
              icon={<CheckCircle2 className="w-5 h-5" />}
              color="green"
              progress={totalAnual > 0 ? (confirmadosAnual / totalAnual) * 100 : 0}
              sublabel="Validados por administración"
              onClick={() => scrollToPayments('ANUAL', 'Confirmado')}
            />
            <StatCard
              label="Pagos Anuales Pendientes"
              value={`${pendientesAnual}/${totalAnual}`}
              icon={<AlertTriangle className="w-5 h-5" />}
              color="amber"
              progress={totalAnual > 0 ? (pendientesAnual / totalAnual) * 100 : 0}
              sublabel="Sin reportar aún"
              onClick={() => scrollToPayments('ANUAL', 'Pendiente')}
            />
            <StatCard
              label="Colegiaturas del Ciclo"
              value={`${confirmadosMensual}/${totalMeses}`}
              icon={<TrendingUp className="w-5 h-5" />}
              color="red"
              progress={(confirmadosMensual / totalMeses) * 100}
              sublabel={`${totalMeses} meses en el ciclo`}
              onClick={() => scrollToPayments('MENSUAL', null)}
            />
          </div>
        </section>

        {/* ── MONTHLY CALENDAR + DUE DATES ─────────────────────────── */}
        {user && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MonthlyCalendar pagos={pagos} nivel={user.nivelEscolar} onMonthClick={scrollToMonthly} />
            <DueDatesPanel nivel={user.nivelEscolar} onConceptClick={scrollToConcepto} />
          </div>
        )}

        {/* ── PAYMENTS LIST ────────────────────────────────────────── */}
        <section ref={paymentsRef} className="space-y-4 scroll-mt-20">
          {/* Tab header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Estado de Conceptos</h2>
              </div>

              {/* Filtro por concepto activo */}
              {conceptFilter && (
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-cyan-500/15 border-cyan-500/30 text-cyan-300">
                    📌 {conceptFilter.charAt(0).toUpperCase() + conceptFilter.slice(1)}
                  </span>
                  <button
                    onClick={() => setConceptFilter(null)}
                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors border border-slate-700/60"
                  >
                    <X className="w-3 h-3" />
                    Ver todos
                  </button>
                </div>
              )}

              {/* Filtro por estado activo */}
              {statusFilter && (
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                    statusFilter === 'En Revisión'
                      ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                      : statusFilter === 'Confirmado'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : statusFilter === 'Pendiente'
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                      : 'bg-red-500/15 border-red-500/30 text-red-300'
                  }`}>
                    Filtro: {statusFilter}
                  </span>
                  <button
                    onClick={() => setStatusFilter(null)}
                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors border border-slate-700/60"
                  >
                    <X className="w-3 h-3" />
                    Ver todos
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 bg-slate-900/80 p-1 rounded-2xl border border-slate-800 w-fit">
              {(['ANUAL', 'MENSUAL'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { setSelectedConceptTab(tab); setStatusFilter(null); setConceptFilter(null); }}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer border ${
                    selectedConceptTab === tab
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                      : 'bg-transparent text-slate-400 border-transparent hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {tab === 'ANUAL' ? <Calendar className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  {tab === 'ANUAL' ? 'Pagos Anuales' : 'Colegiaturas'}
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-950/50 font-mono">
                    {pagos.filter((p) => p.tipo === tab).length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Cards */}
          <div className="space-y-3">
            {(() => {
              const filteredPagos = pagos
                .filter((p) => p.tipo === selectedConceptTab)
                .filter((p) => !statusFilter || p.estado === statusFilter)
                .filter((p) => !conceptFilter || p.concepto.toLowerCase().includes(conceptFilter.toLowerCase()) || (selectedConceptTab === 'MENSUAL' && conceptFilter === 'colegiatura'));

              if (filteredPagos.length === 0) {
                return (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 mx-auto flex items-center justify-center">
                      <FileText className="w-6 h-6 text-slate-500" />
                    </div>
                    <p className="text-slate-400 text-sm">
                      {statusFilter
                        ? `No hay pagos con estado "${statusFilter}" en esta categoría.`
                        : conceptFilter
                        ? `No se encontraron conceptos para "${conceptFilter}".`
                        : `No hay conceptos de ${selectedConceptTab === 'ANUAL' ? 'Pago Anual' : 'Colegiatura Mensual'} registrados.`}
                    </p>
                    {(statusFilter || conceptFilter) && (
                      <button
                        onClick={() => { setStatusFilter(null); setConceptFilter(null); }}
                        className="mx-auto flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 px-3 py-1.5 rounded-xl border border-cyan-500/30 hover:bg-cyan-500/10 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        Quitar filtros y ver todos
                      </button>
                    )}
                  </div>
                );
              }

              return filteredPagos.map((pago) => {
                  const isPending = pago.estado === 'Pendiente';
                  const isReview = pago.estado === 'En Revisión';
                  const isConfirmed = pago.estado === 'Confirmado';
                  const isClarification = pago.estado === 'Requiere Aclaración';

                  const displayName =
                    pago.tipo === 'MENSUAL'
                      ? `Colegiatura Mensual (${pago.mesColegiatura || getCurrentMonthName()})`
                      : pago.concepto;

                  const platformInfo = getPlatformInfo(pago.concepto);
                  const vencimientoInfo = formatVencimiento(pago.fechaVencimiento);
                  const vencConcepto = getVencimientoConcepto(pago.concepto, user?.nivelEscolar || '');

                  const borderClass = isConfirmed
                    ? 'border-emerald-500/50'
                    : isReview
                    ? 'border-blue-500/30'
                    : isClarification
                    ? 'border-red-500/40'
                    : 'border-amber-500/25';

                  const cardBgClass = isConfirmed
                    ? 'bg-gradient-to-br from-emerald-950/70 via-emerald-900/40 to-[#052317] border-emerald-500/50 shadow-md shadow-emerald-950/40'
                    : 'bg-slate-900/80';

                  const statusDot = isConfirmed
                    ? 'bg-emerald-400'
                    : isReview
                    ? 'bg-blue-400 animate-pulse'
                    : isClarification
                    ? 'bg-red-400'
                    : 'bg-amber-400';

                  const isHighlighted = highlightedPagoId === pago.id;

                  return (
                    <div
                      id={`pago-card-${pago.id}`}
                      key={pago.id}
                      className={`${cardBgClass} border ${
                        isHighlighted
                          ? 'border-cyan-400 ring-4 ring-cyan-400/40 shadow-2xl shadow-cyan-500/30 scale-[1.01]'
                          : borderClass
                      } rounded-2xl overflow-hidden transition-all duration-500 hover:shadow-lg scroll-mt-24`}
                    >
                      {/* Card header */}
                      <div className="flex items-start gap-4 p-5">
                        {/* Platform logo */}
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-white/90 p-1 flex-shrink-0 shadow-sm">
                          <Image src={platformInfo.logo} alt={platformInfo.name} fill className="object-contain p-0.5" sizes="48px" />
                        </div>

                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot}`} />
                            <h4 className="text-sm font-bold text-white truncate">{displayName}</h4>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              isConfirmed
                                ? 'bg-emerald-900/50 text-emerald-300 border-emerald-600/40'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}>
                              {pago.tipo}
                            </span>
                            {isConfirmed && (
                              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/50 flex items-center gap-1 shadow-sm">
                                <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                                CONFIRMADO
                              </span>
                            )}
                            {isHighlighted && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 animate-pulse flex items-center gap-1">
                                <Bell className="w-2.5 h-2.5" />
                                Concepto seleccionado
                              </span>
                            )}
                          </div>

                          {/* Date from DB */}
                          {vencimientoInfo && (
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1.5 ${
                                isConfirmed
                                  ? 'bg-emerald-900/50 border-emerald-500/40 text-emerald-200'
                                  : vencimientoInfo.isExpired
                                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                  : 'bg-slate-800/60 border-slate-700/60 text-slate-300'
                              }`}>
                                <Calendar className="w-3 h-3 text-cyan-400" />
                                Vence: {vencimientoInfo.formatted}
                                {isConfirmed ? (
                                  <span className="text-[9px] font-black bg-emerald-500/30 text-emerald-200 px-1.5 py-0.5 rounded uppercase ml-1">Cubierto ✓</span>
                                ) : vencimientoInfo.isExpired ? (
                                  <span className="text-[9px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded uppercase ml-1">Vencido</span>
                                ) : null}
                              </span>
                            </div>
                          )}

                          {/* Static due date from concept logic */}
                          {!vencimientoInfo && vencConcepto && (
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1.5 ${
                                isConfirmed
                                  ? 'bg-emerald-900/50 border-emerald-500/40 text-emerald-200'
                                  : 'bg-slate-800/60 border-slate-700/60 text-slate-300'
                              }`}>
                                <Calendar className="w-3 h-3 text-cyan-400" />
                                Vence: {vencConcepto.label}
                                {isConfirmed && (
                                  <span className="text-[9px] font-black bg-emerald-500/30 text-emerald-200 px-1.5 py-0.5 rounded uppercase ml-1">Cubierto ✓</span>
                                )}
                              </span>
                            </div>
                          )}

                          {/* Colegiatura mensual: vencimiento día 10 */}
                          {pago.tipo === 'MENSUAL' && !isConfirmed && (() => {
                            const { hasRecargo, monthName } = getMensualDueInfo();
                            return (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-xs px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1.5 ${
                                  hasRecargo
                                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                                }`}>
                                  <Calendar className="w-3 h-3" />
                                  Vence: día 10 de {monthName}
                                  {hasRecargo && (
                                    <span className="text-[9px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded uppercase ml-1">Con recargo</span>
                                  )}
                                </span>
                              </div>
                            );
                          })()}

                          {pago.numeroConfirmacion && (
                            <p className="text-xs text-slate-400">
                              Folio: <strong className="text-slate-200 font-mono">{pago.numeroConfirmacion}</strong>
                            </p>
                          )}
                        </div>

                        {/* Platform link */}
                        <a
                          href={platformInfo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex-shrink-0 px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                            isConfirmed
                              ? 'bg-emerald-900/30 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                              : `${platformInfo.bg} ${platformInfo.border} ${platformInfo.text} ${platformInfo.hover}`
                          }`}
                          title={`Ir a ${platformInfo.name}`}
                        >
                          <span className="hidden sm:inline">Ir a {platformInfo.name}</span>
                          <span className="sm:hidden">Ir</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      {/* Concept note */}
                      {pago.notaConcepto && (
                        <div className="mx-5 mb-3 p-3 rounded-xl bg-amber-950/20 border border-amber-500/25 text-xs space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-amber-400">
                            <FileText className="w-3.5 h-3.5" />
                            Nota del Colegio:
                          </div>
                          <p className="text-slate-200 pl-5">{pago.notaConcepto}</p>
                        </div>
                      )}

                      {/* Colegiatura mensual: alerta de recargo */}
                      {pago.tipo === 'MENSUAL' && !isConfirmed && getMensualDueInfo().hasRecargo && (
                        <div className="mx-5 mb-3 p-3 rounded-xl bg-red-950/30 border border-red-500/40 text-xs flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-red-300">¡Pago con recargo!</p>
                            <p className="text-red-200/80 mt-0.5">
                              El vencimiento de la colegiatura mensual es el <strong>día 10</strong>. A partir del día 11 se aplican recargos por pago extemporáneo. Regularice su situación a la brevedad.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Knotion special note */}
                      {!vencimientoInfo && vencConcepto?.nota && !pago.notaConcepto && (
                        <div className="mx-5 mb-3 p-3 rounded-xl bg-teal-950/20 border border-teal-500/20 text-xs flex items-start gap-2">
                          <Info className="w-3.5 h-3.5 text-teal-400 flex-shrink-0 mt-0.5" />
                          <p className="text-teal-200">{vencConcepto.nota}</p>
                        </div>
                      )}

                      {/* Knotion video tutorials */}
                      {platformInfo.name === 'Knotion' && (
                        <div className="mx-5 mb-3 rounded-xl border border-teal-500/25 overflow-hidden">
                          <div className="flex items-center gap-2 px-4 py-2.5 bg-teal-500/10 border-b border-teal-500/20">
                            <Youtube className="w-4 h-4 text-red-400 flex-shrink-0" />
                            <span className="text-xs font-bold text-teal-200">Videos Tutorial de Knotion</span>
                            <span className="ml-auto text-[10px] text-teal-400/70 font-medium">¿Cómo realizar tu pago?</span>
                          </div>
                          <div className="divide-y divide-teal-500/10 bg-slate-950/40">
                            {[
                              { label: 'Pago de Knotion — Nuevo Ingreso', url: 'https://youtu.be/TEbc-QFv_zA' },
                              { label: 'Proceso para Asociar otro Alumno', url: 'https://youtu.be/IZlRnAxl9KE' },
                              { label: 'Proceso para Padres que ya tienen Usuario', url: 'https://youtu.be/Cz9QvNV2PQs' },
                            ].map((video) => (
                              <a
                                key={video.url}
                                href={video.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 px-4 py-2.5 group hover:bg-teal-500/10 transition-colors"
                              >
                                <div className="w-7 h-7 rounded-lg bg-red-500/15 border border-red-500/25 flex items-center justify-center flex-shrink-0 group-hover:bg-red-500/25 transition-colors">
                                  <PlayCircle className="w-4 h-4 text-red-400" />
                                </div>
                                <span className="text-xs text-slate-300 group-hover:text-white transition-colors flex-1">{video.label}</span>
                                <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-teal-400 transition-colors flex-shrink-0" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Clarification detail */}
                      {isClarification && (
                        <div className="mx-5 mb-3 p-4 rounded-xl bg-red-950/25 border border-red-500/25 space-y-2">
                          <div className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Motivo indicado por la administración:
                          </div>
                          <p className="text-xs text-slate-200 italic bg-slate-950/50 p-2 rounded-lg border border-red-500/15">
                            &quot;{pago.motivoAclaracion || 'Por favor revise su folio con la coordinación.'}&quot;
                          </p>
                          {pago.respuestaAlumno && (
                            <p className="text-xs text-slate-300 pt-1">
                              <span className="text-cyan-400 font-semibold">Su última respuesta:</span>{' '}
                              <span className="font-mono">{pago.respuestaAlumno}</span>
                            </p>
                          )}
                        </div>
                      )}

                      {/* Action bar */}
                      <div className={`flex items-center justify-between gap-3 px-5 py-3 border-t ${
                        isConfirmed
                          ? 'border-emerald-800/60 bg-emerald-950/60'
                          : 'border-slate-800/80 bg-slate-950/30'
                      }`}>
                        <div>
                          {isConfirmed && (
                            <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                              <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              </div>
                              <div>
                                <span>Pago Confirmado</span>
                                <span className="hidden sm:inline text-emerald-400/70 text-[11px] font-normal ml-1.5">· Validado por la administración</span>
                              </div>
                            </div>
                          )}
                          {isReview && (
                            <div className="flex items-center gap-1.5 text-xs text-blue-300">
                              <Clock className="w-4 h-4 text-blue-400 animate-pulse" />
                              En Revisión · Espere de 1 a 3 días hábiles
                            </div>
                          )}
                          {isClarification && (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-red-400">
                              <AlertTriangle className="w-4 h-4" />
                              Requiere Aclaración
                            </div>
                          )}
                          {isPending && (
                            <div className="flex items-center gap-1.5 text-xs text-amber-400">
                              <Clock className="w-4 h-4" />
                              Pago pendiente de reportar
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {isClarification && (
                            <button
                              onClick={() => openClarifyModal(pago)}
                              className="px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-red-500/20 cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Responder
                            </button>
                          )}
                          {isPending && (
                            <button
                              onClick={() => openReportModal(pago)}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-cyan-500/20 flex items-center gap-1.5 active:scale-95 cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Reportar Pago
                            </button>
                          )}
                          {isReview && (
                            <button
                              onClick={() => openReportModal(pago)}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-slate-700"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                              Actualizar folio
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                });
            })()}
          </div>
        </section>
      </main>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800/60 py-4 mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-slate-600">
          <span>Portal de Pagos · Colegio Mexicano © {new Date().getFullYear()}</span>
          <span>Los pagos son verificados por el departamento de administración.</span>
        </div>
      </footer>

      {/* ── MODALS ─────────────────────────────────────────────────────── */}

      {/* Report Payment */}
      {showReportModal && selectedPago && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center">
                  <Send className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Reportar Pago</h3>
                  <p className="text-[10px] text-slate-400">Ingrese el folio de confirmación</p>
                </div>
              </div>
              <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Concepto seleccionado</div>
            <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-white/90 p-1 flex-shrink-0">
                <Image src={getPlatformInfo(selectedPago.concepto).logo} alt="Logo" fill className="object-contain p-0.5" sizes="40px" />
              </div>
              <span className="text-sm font-bold text-cyan-300">{selectedPago.concepto}</span>
            </div>

            <form onSubmit={handleReportSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Número de Confirmación / Folio
                </label>
                <input
                  type="text"
                  value={confirmNumber}
                  onChange={(e) => setConfirmNumber(e.target.value)}
                  placeholder="Ej. CONF-12345678"
                  required
                  autoFocus
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-sm font-mono"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Ingrese el folio emitido por su banco o por la plataforma correspondiente.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowReportModal(false)} className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-500/20 disabled:opacity-60"
                >
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Registrando...</span></> : <span>Confirmar Reporte</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clarification */}
      {showClarifyModal && clarifyPago && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Responder Aclaración</h3>
                  <p className="text-[10px] text-slate-400">{clarifyPago.concepto}</p>
                </div>
              </div>
              <button onClick={() => setShowClarifyModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-red-950/20 border border-red-500/25">
              <div className="text-xs font-bold text-red-400 mb-1">Observación del Colegio:</div>
              <p className="text-xs text-slate-200 italic">&quot;{clarifyPago.motivoAclaracion || 'Por favor proporcione información adicional del pago.'}&quot;</p>
            </div>

            <form onSubmit={handleClarifySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Su respuesta
                </label>
                <textarea
                  value={clarifyResponse}
                  onChange={(e) => setClarifyResponse(e.target.value)}
                  placeholder="Escriba aquí los detalles solicitados..."
                  rows={4}
                  required
                  autoFocus
                  className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowClarifyModal(false)} className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-red-500/20 disabled:opacity-60">
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Enviando...</span></> : <span>Enviar Respuesta</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tutorial */}
      {showTutorialModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center">
                  <PlayCircle className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Guía de Registro de Pagos</h3>
                  <p className="text-[10px] text-slate-400">Colegio Mexicano · Portal de Plataformas</p>
                </div>
              </div>
              <button onClick={() => setShowTutorialModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Platform logos row */}
            <div className="flex items-center justify-center gap-4 py-2">
              {[
                { logo: '/logos/schoolcloud.png', name: 'SchoolCloud' },
                { logo: '/logos/knotion.png', name: 'Knotion' },
                { logo: '/logos/lypro.png', name: 'Lypro' },
              ].map((p) => (
                <div key={p.name} className="flex flex-col items-center gap-1">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-white/90 p-1 shadow-sm">
                    <Image src={p.logo} alt={p.name} fill className="object-contain p-0.5" sizes="48px" />
                  </div>
                  <span className="text-[10px] text-slate-400">{p.name}</span>
                </div>
              ))}
            </div>

            <ol className="space-y-3 text-xs text-slate-300">
              {[
                { n: 1, title: 'Realice su pago en la plataforma', desc: 'Use los accesos directos de la tarjeta de perfil (SchoolCloud, Knotion o Lypro) para realizar su pago en línea.' },
                { n: 2, title: 'Copie el Folio de Confirmación', desc: 'Guarde el número de autorización o folio otorgado por la plataforma o por su banco (transferencia bancaria).' },
                { n: 3, title: 'Presione "Reportar Pago"', desc: 'En la lista de conceptos pendientes, haga clic en el botón azul "Reportar Pago" del concepto correspondiente.' },
                { n: 4, title: 'Espere la verificación', desc: 'El estado cambiará a "En Revisión". El departamento de administración validará la transacción en 1 a 3 días hábiles.' },
              ].map((step) => (
                <li key={step.n} className="flex gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{step.n}</span>
                  <div>
                    <p className="font-bold text-white">{step.title}</p>
                    <p className="text-slate-400 mt-0.5">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button onClick={() => setShowTutorialModal(false)} className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all">
                ¡Entendido!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout confirm */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center space-y-5">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <LogOut className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-white">¿Cerrar Sesión?</h3>
              <p className="text-xs text-slate-400 mt-1">¿Estás seguro de que deseas salir del portal?</p>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setShowLogoutModal(false)} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700 cursor-pointer">
                Cancelar
              </button>
              <button type="button" onClick={handleLogout} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-lg shadow-rose-600/25 border border-rose-500 cursor-pointer">
                Sí, Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
