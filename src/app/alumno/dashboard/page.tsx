'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  LogOut,
  Send,
  Loader2,
  ShieldCheck,
  User,
  GraduationCap,
  BookOpen,
  Laptop,
  Layers,
  FileCheck,
  X,
  PlayCircle,
  FileText,
  Calendar
} from 'lucide-react';

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

const getCurrentMonthName = () => {
  const now = new Date();
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
};

const getPlatformLinkForConcept = (concepto: string) => {
  const norm = concepto.toLowerCase();
  if (norm.includes('knotion')) {
    return { name: 'Knotion', url: 'https://dep.knotion.com/login', colorClass: 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10' };
  }
  if (norm.includes('lypro')) {
    return { name: 'Lypro', url: 'https://lyprocolegiomexicano.appssolution.net/', colorClass: 'border-purple-500/40 text-purple-300 hover:bg-purple-500/10' };
  }
  return { name: 'SchoolCloud', url: 'https://erp.schoolcloud.net/campus/cm', colorClass: 'border-blue-500/40 text-blue-300 hover:bg-blue-500/10' };
};

const formatVencimiento = (fechaStr?: string | null) => {
  if (!fechaStr) return null;
  const d = new Date(fechaStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const formatted = `${day}/${month}/${year}`;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const isExpired = d < todayStart;

  return { formatted, isExpired };
};

export default function StudentDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modal states
  const [selectedPago, setSelectedPago] = useState<Pago | null>(null);
  const [confirmNumber, setConfirmNumber] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);

  const [clarifyPago, setClarifyPago] = useState<Pago | null>(null);
  const [clarifyResponse, setClarifyResponse] = useState('');
  const [showClarifyModal, setShowClarifyModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [selectedConceptTab, setSelectedConceptTab] = useState<'ANUAL' | 'MENSUAL'>('ANUAL');

  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/student/dashboard');
      if (res.status === 401 || res.status === 403) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        setPagos(data.pagos || []);
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
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
      const currentMonthName = getCurrentMonthName();
      const res = await fetch('/api/student/report-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pagoId: selectedPago.id,
          numeroConfirmacion: confirmNumber.trim(),
          mesColegiatura: selectedPago.tipo === 'MENSUAL' ? (selectedPago.mesColegiatura || currentMonthName) : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al reportar pago');
      }

      setFeedbackMsg({
        type: 'success',
        text: 'En Revisión: El colegio está verificando el reporte recibido. (Espere de 1 a 3 días)',
      });

      setShowReportModal(false);
      setConfirmNumber('');
      fetchDashboard();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
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
        body: JSON.stringify({
          pagoId: clarifyPago.id,
          respuestaAlumno: clarifyResponse.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al enviar la respuesta');
      }

      setFeedbackMsg({
        type: 'success',
        text: 'Respuesta enviada correctamente. El colegio revisará los datos.',
      });

      setShowClarifyModal(false);
      setClarifyResponse('');
      fetchDashboard();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
        <p className="text-sm font-medium">Cargando portal de pagos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Navigation Topbar */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                Pagos<span className="text-cyan-400">CM</span>
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">
                Portal de registro de pagos de Plataformas del Colegio Mexicano
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTutorialModal(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 transition-all shadow-sm"
            >
              <HelpCircle className="w-4 h-4 text-cyan-400" />
              <span>Tutorial de Pago</span>
            </button>

            <button
              onClick={() => setShowLogoutModal(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Feedback Alert */}
        {feedbackMsg && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between text-sm animate-fade-in ${
              feedbackMsg.type === 'success'
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            <span>{feedbackMsg.text}</span>
            <button
              onClick={() => setFeedbackMsg(null)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Student Profile Summary Card */}
        <section className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold">
                <GraduationCap className="w-3.5 h-3.5" />
                <span>{user?.nivelEscolar}</span>
                {user?.grado && user?.grupo && (
                  <span className="text-cyan-300">• {user.grado}º "{user.grupo}"</span>
                )}
              </div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight">{user?.nombre}</h2>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>Usuario: <strong className="text-slate-200 font-mono">{user?.usuario}</strong></span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-center min-w-[120px]">
                <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Estatus General</div>
                <div className="text-sm font-extrabold text-emerald-400 mt-0.5 flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Alumno Activo</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Platform Direct Access Links (Botones de Plataformas) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Plataformas del Colegio Mexicano</span>
            </h3>
            <span className="text-xs text-slate-400">Acceso directo para padres y alumnos</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* SchoolCloud */}
            <a
              href="https://erp.schoolcloud.net/campus/cm"
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-4 transition-all duration-200 hover:shadow-lg hover:shadow-cyan-500/10 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-100 group-hover:text-cyan-400 transition-colors">SchoolCloud</div>
                  <div className="text-xs text-slate-400">Control Escolar y Pagos</div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
            </a>

            {/* Knotion */}
            <a
              href="https://dep.knotion.com/login"
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-4 transition-all duration-200 hover:shadow-lg hover:shadow-cyan-500/10 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-100 group-hover:text-cyan-400 transition-colors">Knotion</div>
                  <div className="text-xs text-slate-400">Ecosistema de Aprendizaje</div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
            </a>

            {/* Lypro */}
            <a
              href="https://lyprocolegiomexicano.appssolution.net/"
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-4 transition-all duration-200 hover:shadow-lg hover:shadow-cyan-500/10 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-100 group-hover:text-cyan-400 transition-colors">Lypro</div>
                  <div className="text-xs text-slate-400">Plataforma Educativa</div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
            </a>
          </div>
        </section>

        {/* Payments List Section */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>Estado de Conceptos de Pago</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Seleccione la pestaña para consultar sus pagos anuales o colegiatura mensual
              </p>
            </div>

            {/* Pestañas: Pago Anual y Pago Mensual */}
            <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedConceptTab('ANUAL')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 border cursor-pointer ${
                  selectedConceptTab === 'ANUAL'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Pago Anual</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-950/60 font-mono">
                  {pagos.filter((p) => p.tipo === 'ANUAL').length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedConceptTab('MENSUAL')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 border cursor-pointer ${
                  selectedConceptTab === 'MENSUAL'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Pago Mensual</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-950/60 font-mono">
                  {pagos.filter((p) => p.tipo === 'MENSUAL').length}
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {pagos.filter((p) => p.tipo === selectedConceptTab).length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
                No hay conceptos de {selectedConceptTab === 'ANUAL' ? 'Pago Anual' : 'Pago Mensual'} registrados para su nivel escolar.
              </div>
            ) : (
              pagos
                .filter((pago) => pago.tipo === selectedConceptTab)
                .map((pago) => {
                  const isPending = pago.estado === 'Pendiente';
                  const isReview = pago.estado === 'En Revisión';
                  const isConfirmed = pago.estado === 'Confirmado';
                  const isClarification = pago.estado === 'Requiere Aclaración';

                  const currentMonthName = getCurrentMonthName();
                  const displayConceptoName =
                    pago.tipo === 'MENSUAL'
                      ? `Colegiatura Mensual (${pago.mesColegiatura || currentMonthName})`
                      : pago.concepto;

                  const platformInfo = getPlatformLinkForConcept(pago.concepto);
                  const vencimientoInfo = formatVencimiento(pago.fechaVencimiento);

                  return (
                    <div
                      key={pago.id}
                      className={`bg-slate-900 border rounded-xl p-5 transition-all space-y-4 ${
                        isConfirmed
                          ? 'border-emerald-500/30 shadow-md shadow-emerald-500/5'
                          : isReview
                          ? 'border-blue-500/30'
                          : isClarification
                          ? 'border-red-500/50 bg-red-950/10'
                          : 'border-amber-500/30'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-base font-bold text-white">{displayConceptoName}</h4>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              {pago.tipo}
                            </span>
                          </div>

                          {/* Fecha de Vencimiento */}
                          {vencimientoInfo && (
                            <div className="flex items-center gap-2 pt-0.5">
                              <span
                                className={`text-xs px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1.5 ${
                                  vencimientoInfo.isExpired && !isConfirmed
                                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                    : 'bg-slate-950 border-slate-800 text-slate-300'
                                }`}
                              >
                                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                                <span>Vencimiento: {vencimientoInfo.formatted}</span>
                                {vencimientoInfo.isExpired && !isConfirmed && (
                                  <span className="text-[10px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded uppercase">
                                    Vencido
                                  </span>
                                )}
                              </span>
                            </div>
                          )}

                          {pago.numeroConfirmacion && (
                            <p className="text-xs text-slate-400 pt-0.5">
                              No. Confirmación reportado:{' '}
                              <strong className="text-slate-200 font-mono">{pago.numeroConfirmacion}</strong>
                            </p>
                          )}
                        </div>

                        {/* Enlace directo a Plataforma correspondiente */}
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={platformInfo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${platformInfo.colorClass}`}
                            title={`Ir a la plataforma ${platformInfo.name} para realizar el pago`}
                          >
                            <span>Ir a {platformInfo.name}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>

                      {/* Texto / Nota del Administrador debajo del concepto */}
                      {pago.notaConcepto && (
                        <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200 space-y-1 animate-fade-in">
                          <div className="font-bold text-amber-400 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5" />
                            <span>Nota del Colegio / Instrucciones de Pago:</span>
                          </div>
                          <p className="text-slate-200 leading-relaxed pl-5">{pago.notaConcepto}</p>
                        </div>
                      )}

                      {/* Status Badges & Action Buttons */}
                      <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                        <div>
                          {isConfirmed && (
                            <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Confirmado</span>
                            </div>
                          )}

                          {isReview && (
                            <div className="px-3.5 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-semibold flex items-center gap-1.5 max-w-sm">
                              <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                              <span>En Revisión: El colegio está verificando el reporte recibido. (Espere de 1 a 3 días)</span>
                            </div>
                          )}

                          {isClarification && (
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                              <div className="px-3.5 py-1.5 rounded-xl bg-red-500/10 border border-red-500/40 text-red-400 text-xs font-bold flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4" />
                                <span>Requiere Aclaración</span>
                              </div>
                              <button
                                onClick={() => openClarifyModal(pago)}
                                className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all flex items-center gap-1 shadow-md shadow-red-500/20 cursor-pointer"
                              >
                                <span>Responder Aclaración</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {isPending && (
                          <button
                            onClick={() => openReportModal(pago)}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-cyan-500/20 flex items-center gap-1.5 active:scale-95 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Reportar Pago</span>
                          </button>
                        )}
                      </div>

                      {/* Clarification reason notice if present */}
                      {isClarification && (
                        <div className="mt-3 p-4 rounded-xl bg-red-950/30 border border-red-500/30 space-y-2">
                          <div className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Motivo de Aclaración señalado por la administración:</span>
                          </div>
                          <p className="text-xs text-slate-200 italic bg-slate-950/60 p-2.5 rounded-lg border border-red-500/20">
                            "{pago.motivoAclaracion || 'Por favor revise su folio de pago con la coordinación.'}"
                          </p>

                          {pago.respuestaAlumno && (
                            <div className="text-xs text-slate-300 pt-1">
                              <span className="font-semibold text-cyan-400">Su última respuesta enviada:</span>{' '}
                              <span className="text-slate-200 font-mono">{pago.respuestaAlumno}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        </section>
      </main>

      {/* Report Payment Modal */}
      {showReportModal && selectedPago && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6 relative animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-cyan-400" />
                <span>Reportar Pago</span>
              </h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Concepto seleccionado</div>
              <div className="text-sm font-bold text-cyan-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
                {selectedPago.concepto}
              </div>
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
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Ingrese el folio o número de autorización emitido por su banco o por la plataforma correspondiente.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-500/20"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Registrando...</span>
                    </>
                  ) : (
                    <span>Confirmar Reporte</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clarification Response Modal */}
      {showClarifyModal && clarifyPago && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <span>Responder Aclaración</span>
              </h3>
              <button
                onClick={() => setShowClarifyModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 bg-red-950/20 p-3.5 rounded-xl border border-red-500/30">
              <div className="text-xs font-bold text-red-400">Observación del Colegio:</div>
              <p className="text-xs text-slate-200 italic">
                "{clarifyPago.motivoAclaracion || 'Por favor proporcione información adicional del pago.'}"
              </p>
            </div>

            <form onSubmit={handleClarifySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Escriba su respuesta o nuevo número de confirmación
                </label>
                <textarea
                  value={clarifyResponse}
                  onChange={(e) => setClarifyResponse(e.target.value)}
                  placeholder="Escriba aquí los detalles solicitados o la aclaración correspondiente..."
                  rows={4}
                  required
                  autoFocus
                  className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowClarifyModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-red-500/20"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <span>Enviar Respuesta</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tutorial Modal (Video / Document walkthrough) */}
      {showTutorialModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <PlayCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Guía Tutorial: Registro y Confirmación de Pagos</h3>
                  <p className="text-xs text-slate-400">Pasos para verificar y reportar sus pagos de plataformas escolar</p>
                </div>
              </div>
              <button
                onClick={() => setShowTutorialModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Placeholder / Banner */}
            <div className="relative rounded-xl bg-slate-950 border border-slate-800 aspect-video flex flex-col items-center justify-center text-center p-6 space-y-3 group overflow-hidden">
              <div className="w-16 h-16 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                <PlayCircle className="w-10 h-10" />
              </div>
              <div>
                <h4 className="font-bold text-slate-200">Video Explicativo del Proceso de Pago</h4>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  Aprenda cómo localizar su número de autorización bancaria y registrarlo en las plataformas institucionales.
                </p>
              </div>
            </div>

            {/* Step-by-step document guide */}
            <div className="space-y-4 text-xs text-slate-300">
              <h4 className="font-bold text-sm text-cyan-300 uppercase tracking-wider">Pasos para reportar su pago:</h4>
              <ol className="space-y-3 list-decimal list-inside pl-1 leading-relaxed">
                <li className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <strong className="text-white">Realice su pago:</strong> Ingrese a la plataforma correspondiente (SchoolCloud, Knotion o Lypro) utilizando los botones superiores de acceso directo.
                </li>
                <li className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <strong className="text-white">Copie el Folio de Confirmación:</strong> Guarde el número de autorización o folio otorgado por la plataforma o transferencia bancaria.
                </li>
                <li className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <strong className="text-white">Presione "Reportar Pago":</strong> En la lista de conceptos de este portal, ubique el concepto pendiente y haga clic en el botón correspondiente.
                </li>
                <li className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <strong className="text-white">Verificación:</strong> El estado cambiará a <em>"En Revisión"</em> mientras el departamento de administración del colegio valida la transacción (duración estimada de 1 a 3 días hábiles).
                </li>
              </ol>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowTutorialModal(false)}
                className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
              >
                Entendido, cerrar guía
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE CERRAR SESIÓN */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center space-y-5">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-inner">
              <LogOut className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-white">¿Cerrar Sesión?</h3>
              <p className="text-xs text-slate-400 mt-1">
                ¿Estás seguro de que deseas salir de la plataforma?
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-lg shadow-rose-600/25 border border-rose-500 cursor-pointer"
              >
                Sí, Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
