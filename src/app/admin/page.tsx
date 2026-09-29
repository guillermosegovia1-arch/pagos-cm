'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  Plus,
  Trash2,
  Download,
  Upload,
  LogOut,
  Search,
  Filter,
  X,
  Key,
  Loader2,
  UserCheck,
  UserX,
  MessageSquare,
  BarChart3,
  Calendar,
  TrendingUp,
  PieChart,
  CalendarDays,
  FileText,
  ArrowRight
} from 'lucide-react';

interface Pago {
  id: string;
  concepto: string;
  tipo: string;
  estado: 'Pendiente' | 'En Revisión' | 'Confirmado' | 'Requiere Aclaración';
  numeroConfirmacion: string | null;
  motivoAclaracion: string | null;
  comentarioAdmin: string | null;
  respuestaAlumno: string | null;
  fechaConfirmado: string | null;
  createdAt: string;
}

interface UserStudent {
  id: string;
  nombre: string;
  usuario: string;
  passwordPlain: string;
  role: 'ADMIN' | 'ALUMNO';
  nivelEscolar: string;
  grado: string | null;
  grupo: string | null;
  estado: 'Alta' | 'Baja';
  pagos: Pago[];
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTabSection, setActiveTabSection] = useState<'dashboard' | 'verificacion' | 'gestion' | 'importacion'>('dashboard');
  
  // Default selected group tab is 'Administración' (Sin 'TODOS')
  const [selectedGroupTab, setSelectedGroupTab] = useState<string>('Administración');
  const [searchQuery, setSearchQuery] = useState('');

  // Date Range Filter state for "Reporte de alumnos que pagaron por fecha"
  const todayStr = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [startDateFilter, setStartDateFilter] = useState<string>(thirtyDaysAgo);
  const [endDateFilter, setEndDateFilter] = useState<string>(todayStr);

  // Modals state
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserStudent | null>(null);

  // Form state for Create / Edit user
  const [formData, setFormData] = useState({
    nombre: '',
    usuario: '',
    password: '',
    nivelEscolar: 'Primaria',
    grado: '1',
    grupo: 'A',
    estado: 'Alta' as 'Alta' | 'Baja',
  });

  // Password reset fields in modal
  const [showPasswordChangeFields, setShowPasswordChangeFields] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Payment status & comment edit modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPago, setEditingPago] = useState<Pago | null>(null);
  const [editingStudentName, setEditingStudentName] = useState('');
  const [pagoStatus, setPagoStatus] = useState<'Pendiente' | 'En Revisión' | 'Confirmado' | 'Requiere Aclaración'>('Pendiente');
  const [motivoAclaracion, setMotivoAclaracion] = useState('');
  const [comentarioAdmin, setComentarioAdmin] = useState('');
  const [customFechaConfirmado, setCustomFechaConfirmado] = useState('');

  // Excel import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const [savingUser, setSavingUser] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/students');
      if (res.status === 401 || res.status === 403) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  // Selected status filter from Dashboard breakdown cards
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'TODOS' | 'Confirmado' | 'En Revisión' | 'Pendiente' | 'Requiere Aclaración'>('TODOS');

  const handleStatusCardClick = (status: 'Confirmado' | 'En Revisión' | 'Pendiente' | 'Requiere Aclaración') => {
    setSelectedStatusFilter(status);
    setActiveTabSection('verificacion');

    // Switch to first student group tab if on Administración
    if (selectedGroupTab === 'Administración' && groupTabsMap.length > 1) {
      const firstStudentGroup = groupTabsMap.find(([name]) => name !== 'Administración');
      if (firstStudentGroup) {
        setSelectedGroupTab(firstStudentGroup[0]);
      }
    }
  };

  // Group Tabs Calculation (SIN "TODOS", "Administración" PRIMERA opción)
  const groupTabsMap = useMemo(() => {
    const map = new Map<string, number>();

    // Administración as mandatory first tab
    const adminCount = users.filter((u) => u.nivelEscolar === 'No aplica' || u.role === 'ADMIN').length;
    map.set('Administración', adminCount);

    // Dynamic groups detected from users/Excel
    users.forEach((u) => {
      if (u.nivelEscolar === 'No aplica' || u.role === 'ADMIN') return;

      // If status filter is active, check if student has matching pagos
      if (selectedStatusFilter !== 'TODOS') {
        const hasMatchingPago = u.pagos.some((p) => p.estado === selectedStatusFilter);
        if (!hasMatchingPago) return;
      }

      let groupKey = 'Sin Grupo';
      if (u.grado && u.grupo) {
        groupKey = `${u.grado}${u.grupo}`;
      } else if (u.nivelEscolar) {
        groupKey = u.nivelEscolar;
      }

      map.set(groupKey, (map.get(groupKey) || 0) + 1);
    });

    return Array.from(map.entries());
  }, [users, selectedStatusFilter]);

  // Set default group tab if current selected group is not in list
  useEffect(() => {
    if (groupTabsMap.length > 0) {
      const exists = groupTabsMap.some(([name]) => name === selectedGroupTab);
      if (!exists) {
        setSelectedGroupTab(groupTabsMap[0][0]);
      }
    }
  }, [groupTabsMap, selectedGroupTab]);

  // Filtered Users for Verification / Management
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Group filter (Strict matching)
      let groupKey = 'Sin Grupo';
      if (u.nivelEscolar === 'No aplica' || u.role === 'ADMIN') {
        groupKey = 'Administración';
      } else if (u.grado && u.grupo) {
        groupKey = `${u.grado}${u.grupo}`;
      } else if (u.nivelEscolar) {
        groupKey = u.nivelEscolar;
      }

      if (groupKey !== selectedGroupTab) return false;

      // Status filter matching
      if (selectedStatusFilter !== 'TODOS') {
        const hasMatchingPago = u.pagos.some((p) => p.estado === selectedStatusFilter);
        if (!hasMatchingPago) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          u.nombre.toLowerCase().includes(q) ||
          u.usuario.toLowerCase().includes(q) ||
          u.nivelEscolar.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [users, selectedGroupTab, searchQuery, selectedStatusFilter]);

  // Metric Calculation for Dashboard
  const metrics = useMemo(() => {
    const studentsOnly = users.filter((u) => u.role === 'ALUMNO');
    const totalStudents = studentsOnly.length;
    const activeStudents = studentsOnly.filter((u) => u.estado === 'Alta').length;
    const bajasStudents = studentsOnly.filter((u) => u.estado === 'Baja').length;

    // Confirmed payments count
    const allPagos = studentsOnly.flatMap((u) => u.pagos);
    const confirmedPagos = allPagos.filter((p) => p.estado === 'Confirmado');
    const inReviewPagos = allPagos.filter((p) => p.estado === 'En Revisión');
    const pendingPagos = allPagos.filter((p) => p.estado === 'Pendiente');
    const clarifyPagos = allPagos.filter((p) => p.estado === 'Requiere Aclaración');

    // Students with at least 1 confirmed payment
    const studentsWhoPaidCount = studentsOnly.filter((u) =>
      u.pagos.some((p) => p.estado === 'Confirmado')
    ).length;

    return {
      totalStudents,
      activeStudents,
      bajasStudents,
      studentsWhoPaidCount,
      totalPagos: allPagos.length,
      confirmedCount: confirmedPagos.length,
      inReviewCount: inReviewPagos.length,
      pendingCount: pendingPagos.length,
      clarifyCount: clarifyPagos.length,
      completionPercentage: allPagos.length > 0 ? Math.round((confirmedPagos.length / allPagos.length) * 100) : 0,
    };
  }, [users]);

  // Confirmed Payments List for Dashboard ("Quiénes pagaron por fecha")
  const confirmedPaymentsList = useMemo(() => {
    const list: Array<{
      pagoId: string;
      studentName: string;
      usuario: string;
      nivelEscolar: string;
      grado: string | null;
      grupo: string | null;
      concepto: string;
      numeroConfirmacion: string | null;
      fechaConfirmado: string | null;
      comentarioAdmin: string | null;
    }> = [];

    users
      .filter((u) => u.role === 'ALUMNO')
      .forEach((u) => {
        u.pagos.forEach((p) => {
          if (p.estado === 'Confirmado') {
            list.push({
              pagoId: p.id,
              studentName: u.nombre,
              usuario: u.usuario,
              nivelEscolar: u.nivelEscolar,
              grado: u.grado,
              grupo: u.grupo,
              concepto: p.concepto,
              numeroConfirmacion: p.numeroConfirmacion,
              fechaConfirmado: p.fechaConfirmado,
              comentarioAdmin: p.comentarioAdmin,
            });
          }
        });
      });

    // Sort by fechaConfirmado descending
    return list.sort((a, b) => {
      const dateA = a.fechaConfirmado ? new Date(a.fechaConfirmado).getTime() : 0;
      const dateB = b.fechaConfirmado ? new Date(b.fechaConfirmado).getTime() : 0;
      return dateB - dateA;
    });
  }, [users]);

  // Filtered confirmed payments strictly by DATE RANGE CALENDAR
  const filteredConfirmedPaymentsByRange = useMemo(() => {
    if (!startDateFilter && !endDateFilter) return confirmedPaymentsList;

    const start = startDateFilter ? new Date(`${startDateFilter}T00:00:00`) : new Date(0);
    const end = endDateFilter ? new Date(`${endDateFilter}T23:59:59`) : new Date();

    return confirmedPaymentsList.filter((item) => {
      if (!item.fechaConfirmado) return false;
      const confirmDate = new Date(item.fechaConfirmado);
      return confirmDate >= start && confirmDate <= end;
    });
  }, [confirmedPaymentsList, startDateFilter, endDateFilter]);

  // User Create / Edit Handlers
  const openCreateUserModal = () => {
    setEditingUser(null);
    setFormData({
      nombre: '',
      usuario: '',
      password: '',
      nivelEscolar: 'Primaria',
      grado: '1',
      grupo: 'A',
      estado: 'Alta',
    });
    setShowPasswordChangeFields(false);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setShowUserModal(true);
  };

  const openEditUserModal = (user: UserStudent) => {
    setEditingUser(user);
    setFormData({
      nombre: user.nombre,
      usuario: user.usuario,
      password: user.passwordPlain,
      nivelEscolar: user.nivelEscolar,
      grado: user.grado || '',
      grupo: user.grupo || '',
      estado: user.estado,
    });
    setShowPasswordChangeFields(false);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setShowUserModal(true);
  };

  const handleNivelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const isNoAplica = val === 'No aplica';
    setFormData((prev) => ({
      ...prev,
      nivelEscolar: val,
      grado: isNoAplica ? '' : prev.grado || '1',
      grupo: isNoAplica ? '' : prev.grupo || 'A',
    }));
  };

  const handleSaveUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    let finalPasswordToSubmit = formData.password;

    if (showPasswordChangeFields) {
      if (!newPassword || newPassword.length < 4) {
        setPasswordError('La nueva contraseña debe tener al menos 4 caracteres.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordError('Las contraseñas no coinciden.');
        return;
      }
      finalPasswordToSubmit = newPassword;
    }

    setSavingUser(true);
    setFeedback(null);

    try {
      const isEdit = !!editingUser;
      const url = isEdit ? `/api/admin/students/${editingUser.id}` : '/api/admin/students';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: formData.nombre,
          usuario: formData.usuario,
          password: finalPasswordToSubmit,
          nivelEscolar: formData.nivelEscolar,
          grado: formData.nivelEscolar === 'No aplica' ? null : formData.grado,
          grupo: formData.nivelEscolar === 'No aplica' ? null : formData.grupo,
          estado: formData.estado,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar el usuario');
      }

      setFeedback({
        type: 'success',
        text: isEdit ? 'Usuario actualizado correctamente.' : 'Usuario registrado exitosamente.',
      });

      setShowUserModal(false);
      fetchUsers();
    } catch (err: any) {
      setPasswordError(err.message);
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`¿Está seguro de eliminar al usuario "${name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/students/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar usuario');
      setFeedback({ type: 'success', text: `Usuario ${name} eliminado.` });
      fetchUsers();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  // Payment Quick Edit & Comment Modal Handler
  const openEditPagoModal = (pago: Pago, studentName: string) => {
    setEditingPago(pago);
    setEditingStudentName(studentName);
    setPagoStatus(pago.estado);
    setMotivoAclaracion(pago.motivoAclaracion || '');
    setComentarioAdmin(pago.comentarioAdmin || '');

    let defaultDateStr = '';
    if (pago.fechaConfirmado) {
      const d = new Date(pago.fechaConfirmado);
      defaultDateStr = d.toISOString().split('T')[0];
    } else {
      defaultDateStr = new Date().toISOString().split('T')[0];
    }
    setCustomFechaConfirmado(defaultDateStr);

    setShowPaymentModal(true);
  };

  const handleSavePagoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPago) return;

    setSavingUser(true);

    try {
      const res = await fetch(`/api/admin/payments/${editingPago.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: pagoStatus,
          motivoAclaracion: pagoStatus === 'Requiere Aclaración' ? motivoAclaracion : null,
          comentarioAdmin: comentarioAdmin.trim() || null,
          fechaConfirmado: pagoStatus === 'Confirmado' ? customFechaConfirmado : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al actualizar pago');
      }

      setFeedback({
        type: 'success',
        text: `Estatus y comentarios del concepto "${editingPago.concepto}" guardados correctamente.`,
      });

      setShowPaymentModal(false);
      fetchUsers();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSavingUser(false);
    }
  };

  // Excel Import Handler
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;

    setImporting(true);
    setImportResult(null);

    const data = new FormData();
    data.append('file', importFile);

    try {
      const res = await fetch('/api/admin/import-excel', {
        method: 'POST',
        body: data,
      });

      const rawText = await res.text();
      let result: any;
      try {
        result = JSON.parse(rawText);
      } catch (parseErr) {
        throw new Error('El servidor devolvió una respuesta no válida o la conexión expiró. Por favor intente de nuevo.');
      }

      if (!res.ok) {
        throw new Error(result.error || 'Error al procesar el archivo');
      }

      setImportResult(result);
      setFeedback({
        type: 'success',
        text: `Importación completada: ${result.createdCount} alumnos creados, ${result.updatedCount} actualizados.`,
      });

      // Switch to Verification panel to display new Excel groups automatically
      setActiveTabSection('verificacion');
      fetchUsers();
    } catch (err: any) {
      setImportResult({ error: err.message });
    } finally {
      setImporting(false);
    }
  };

  // Helper date formatter
  const formatDateDisplay = (dateString?: string | null) => {
    if (!dateString) return null;
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return null;

    return d.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
        <p className="text-sm font-medium">Cargando Panel Administrativo...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Pagos<span className="text-cyan-400">CM</span>
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">
                Portal de registro de pagos de Plataformas del Colegio Mexicano
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Feedback alert */}
        {feedback && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between text-sm animate-fade-in ${
              feedback.type === 'success'
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            <span>{feedback.text}</span>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Section Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 overflow-x-auto gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTabSection('dashboard')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                activeTabSection === 'dashboard'
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Dashboard / Métricas</span>
            </button>

            <button
              onClick={() => setActiveTabSection('verificacion')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                activeTabSection === 'verificacion'
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Panel de Verificación de Pagos</span>
            </button>

            <button
              onClick={() => setActiveTabSection('gestion')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                activeTabSection === 'gestion'
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Gestión de Alumnos</span>
            </button>

            <button
              onClick={() => setActiveTabSection('importacion')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                activeTabSection === 'importacion'
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Importación Masiva Excel</span>
            </button>
          </div>

          {activeTabSection === 'gestion' && (
            <button
              onClick={openCreateUserModal}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-cyan-500/20 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Alumno / Usuario</span>
            </button>
          )}
        </div>

        {/* SECTION 1: DASHBOARD Y MÉTRICAS */}
        {activeTabSection === 'dashboard' && (
          <div className="space-y-6 animate-fade-in">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Alumnos Activos */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Users className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Alumnos Activos</div>
                <div className="text-3xl font-extrabold text-white mt-2">{metrics.activeStudents}</div>
                <div className="text-[11px] text-slate-500 mt-1">Registrados en plataforma</div>
              </div>

              {/* Cuántos han pagado */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Alumnos que Pagaron</div>
                <div className="text-3xl font-extrabold text-emerald-400 mt-2">{metrics.studentsWhoPaidCount}</div>
                <div className="text-[11px] text-emerald-400/80 mt-1 font-semibold">
                  {metrics.confirmedCount} conceptos confirmados en total
                </div>
              </div>

              {/* Cuántas bajas */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                  <UserX className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Alumnos Dados de Baja</div>
                <div className="text-3xl font-extrabold text-red-400 mt-2">{metrics.bajasStudents}</div>
                <div className="text-[11px] text-slate-500 mt-1">Estatus inactivo en el colegio</div>
              </div>

              {/* Tasa de Cumplimiento */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tasa de Confirmación</div>
                <div className="text-3xl font-extrabold text-indigo-300 mt-2">{metrics.completionPercentage}%</div>
                <div className="text-[11px] text-slate-500 mt-1">{metrics.confirmedCount} de {metrics.totalPagos} conceptos</div>
              </div>
            </div>

            {/* Visual Charts Row */}
            <div className="grid grid-cols-1 gap-6">
              {/* Estatus General de Pagos Breakdown (Full Width & Clickable) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-cyan-400" />
                      <span>Distribución por Estatus de Pago</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Haga clic en cualquier recuadro para filtrar y consultar los resultados en las pestañas de grupos
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 font-semibold shrink-0">
                    {metrics.totalPagos} Conceptos Asignados
                  </span>
                </div>

                <div className="h-5 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800 p-0.5 gap-0.5">
                  <button
                    type="button"
                    onClick={() => handleStatusCardClick('Confirmado')}
                    style={{ width: `${(metrics.confirmedCount / (metrics.totalPagos || 1)) * 100}%` }}
                    className="bg-emerald-500 h-full rounded-l transition-all hover:brightness-125 cursor-pointer"
                    title="Confirmados (Haz clic para ver por grupos)"
                  />
                  <button
                    type="button"
                    onClick={() => handleStatusCardClick('En Revisión')}
                    style={{ width: `${(metrics.inReviewCount / (metrics.totalPagos || 1)) * 100}%` }}
                    className="bg-blue-500 h-full transition-all hover:brightness-125 cursor-pointer"
                    title="En Revisión (Haz clic para ver por grupos)"
                  />
                  <button
                    type="button"
                    onClick={() => handleStatusCardClick('Pendiente')}
                    style={{ width: `${(metrics.pendingCount / (metrics.totalPagos || 1)) * 100}%` }}
                    className="bg-amber-500 h-full transition-all hover:brightness-125 cursor-pointer"
                    title="Pendientes (Haz clic para ver por grupos)"
                  />
                  <button
                    type="button"
                    onClick={() => handleStatusCardClick('Requiere Aclaración')}
                    style={{ width: `${(metrics.clarifyCount / (metrics.totalPagos || 1)) * 100}%` }}
                    className="bg-red-500 h-full rounded-r transition-all hover:brightness-125 cursor-pointer"
                    title="Requiere Aclaración (Haz clic para ver por grupos)"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2">
                  <button
                    type="button"
                    onClick={() => handleStatusCardClick('Confirmado')}
                    className="bg-slate-950 p-4 rounded-xl border border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-500/10 text-left transition-all group cursor-pointer shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 group-hover:scale-125 transition-transform" />
                        <span>Confirmados</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                    </div>
                    <div className="text-2xl font-extrabold text-white mt-2">{metrics.confirmedCount}</div>
                    <div className="text-[10px] text-slate-400 mt-1 font-medium group-hover:text-emerald-300">
                      Ver en grupos &rarr;
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusCardClick('En Revisión')}
                    className="bg-slate-950 p-4 rounded-xl border border-blue-500/30 hover:border-blue-400 hover:bg-blue-500/10 text-left transition-all group cursor-pointer shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-blue-400 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 group-hover:scale-125 transition-transform" />
                        <span>En Revisión</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
                    </div>
                    <div className="text-2xl font-extrabold text-white mt-2">{metrics.inReviewCount}</div>
                    <div className="text-[10px] text-slate-400 mt-1 font-medium group-hover:text-blue-300">
                      Ver en grupos &rarr;
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusCardClick('Pendiente')}
                    className="bg-slate-950 p-4 rounded-xl border border-amber-500/30 hover:border-amber-400 hover:bg-amber-500/10 text-left transition-all group cursor-pointer shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 group-hover:scale-125 transition-transform" />
                        <span>Pendientes</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
                    </div>
                    <div className="text-2xl font-extrabold text-white mt-2">{metrics.pendingCount}</div>
                    <div className="text-[10px] text-slate-400 mt-1 font-medium group-hover:text-amber-300">
                      Ver en grupos &rarr;
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusCardClick('Requiere Aclaración')}
                    className="bg-slate-950 p-4 rounded-xl border border-red-500/30 hover:border-red-400 hover:bg-red-500/10 text-left transition-all group cursor-pointer shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-red-400 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 group-hover:scale-125 transition-transform" />
                        <span>Aclaraciones</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-red-400 transition-colors" />
                    </div>
                    <div className="text-2xl font-extrabold text-white mt-2">{metrics.clarifyCount}</div>
                    <div className="text-[10px] text-slate-400 mt-1 font-medium group-hover:text-red-300">
                      Ver en grupos &rarr;
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* QUIÉNES PAGARON POR FECHA TABLE SECTION (CON SELECTOR DE RANGO DE FECHAS) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-4">
              <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-cyan-400" />
                    <span>Reporte de Alumnos que Pagaron por Fecha</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Seleccione el rango de fechas para consultar las confirmaciones realizadas.
                  </p>
                </div>

                {/* Date Range Selector (Rango de fechas entre Inicio y Fin) */}
                <div className="flex flex-wrap items-center gap-3 bg-slate-900 p-2 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs text-slate-300">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="font-semibold">Desde:</span>
                    <input
                      type="date"
                      value={startDateFilter}
                      onChange={(e) => setStartDateFilter(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-cyan-300 font-mono focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-300">
                    <span className="font-semibold">Hasta:</span>
                    <input
                      type="date"
                      value={endDateFilter}
                      onChange={(e) => setEndDateFilter(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-cyan-300 font-mono focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950/80 text-slate-300 font-bold uppercase border-b border-slate-800">
                      <th className="p-3.5">Fecha Confirmación</th>
                      <th className="p-3.5">Alumno</th>
                      <th className="p-3.5">Nivel / Grupo</th>
                      <th className="p-3.5">Concepto Confirmado</th>
                      <th className="p-3.5">No. Confirmación / Folio</th>
                      <th className="p-3.5">Comentarios del Colegio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredConfirmedPaymentsByRange.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">
                          No se encontraron pagos confirmados entre las fechas seleccionadas.
                        </td>
                      </tr>
                    ) : (
                      filteredConfirmedPaymentsByRange.map((item) => (
                        <tr key={item.pagoId} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 font-mono text-cyan-300 font-bold">
                            {formatDateDisplay(item.fechaConfirmado) || 'Sin Fecha'}
                          </td>
                          <td className="p-3.5 font-bold text-slate-100">
                            <div>{item.studentName}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{item.usuario}</div>
                          </td>
                          <td className="p-3.5 text-slate-300">
                            <span className="font-semibold text-slate-200">{item.nivelEscolar}</span>
                            {item.grado && item.grupo && (
                              <span className="block text-[11px] text-slate-400">
                                {item.grado}º "{item.grupo}"
                              </span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold inline-flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{item.concepto}</span>
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-slate-200">
                            {item.numeroConfirmacion || <span className="text-slate-500 italic">No proporcionado</span>}
                          </td>
                          <td className="p-3.5 text-slate-300 italic max-w-xs truncate">
                            {item.comentarioAdmin || <span className="text-slate-600">Sin comentarios</span>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* GROUP TABS SYSTEM (Administración como PRIMERA opción, Detección dinámica de grupos) */}
        {activeTabSection !== 'importacion' && activeTabSection !== 'dashboard' && (
          <div className="space-y-4">
            {selectedStatusFilter !== 'TODOS' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-cyan-500/10 border border-cyan-500/30 p-3.5 rounded-2xl text-xs text-cyan-300 shadow-lg animate-fade-in">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    Filtrando por estatus de pago: <strong className="text-white font-extrabold underline decoration-cyan-400">{selectedStatusFilter}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter('TODOS')}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 font-bold flex items-center justify-center gap-1.5 transition-all text-xs shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Mostrar todos los estatus</span>
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-2 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                Grupos:
              </span>

              {groupTabsMap.map(([groupName, count]) => {
                const isSelected = selectedGroupTab === groupName;
                return (
                  <button
                    key={groupName}
                    onClick={() => setSelectedGroupTab(groupName)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <span>{groupName}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                        isSelected ? 'bg-white text-indigo-950' : 'bg-slate-800 text-cyan-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Box */}
            <div className="relative max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar alumno por nombre, usuario o nivel..."
                className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
        )}

        {/* SECTION A: PANEL DE VERIFICACIÓN DE PAGOS */}
        {activeTabSection === 'verificacion' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                  <span>Matriz de Pagos por Grupo</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Grupo seleccionado: <strong className="text-cyan-400">{selectedGroupTab}</strong>
                </p>
              </div>
              <div className="text-xs text-slate-400">
                Mostrando <strong className="text-cyan-400">{filteredUsers.filter(u => u.role === 'ALUMNO').length}</strong> alumnos
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 text-slate-300 font-bold uppercase border-b border-slate-800">
                    <th className="p-3.5 min-w-[200px]">Nombre del Alumno</th>
                    <th className="p-3.5">Nivel / Grupo</th>
                    <th className="p-3.5">Pago Knotion</th>
                    <th className="p-3.5">Cuota Tecnología</th>
                    <th className="p-3.5">Pago Lypro</th>
                    <th className="p-3.5">Cuota Escolar</th>
                    <th className="p-3.5">Colegiatura</th>
                    <th className="p-3.5 text-center">Comentarios</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.filter(u => u.role === 'ALUMNO').length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500 font-medium">
                        No hay alumnos registrados en el grupo "{selectedGroupTab}". Suba su archivo Excel para generar los grupos automáticamente.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers
                      .filter((u) => u.role === 'ALUMNO')
                      .map((student) => {
                        const getPagoByConceptName = (keyword: string) => {
                          return student.pagos.find((p) => p.concepto.toLowerCase().includes(keyword.toLowerCase()));
                        };

                        const knotionPago = getPagoByConceptName('Knotion');
                        const techPago = getPagoByConceptName('tecnología');
                        const lyproPago = getPagoByConceptName('Lypro');
                        const escolarPago = getPagoByConceptName('escolar');
                        const colegiaturaPago = getPagoByConceptName('Colegiatura');

                        const renderStatusBadgeCell = (pago?: Pago) => {
                          if (!pago) {
                            return <span className="text-slate-600 italic">No Aplica</span>;
                          }

                          let badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
                          let label = 'Pendiente';

                          if (pago.estado === 'Confirmado') {
                            badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
                            label = 'Confirmado';
                          } else if (pago.estado === 'En Revisión') {
                            badgeColor = 'bg-blue-500/10 text-blue-300 border-blue-500/30';
                            label = 'En Revisión';
                          } else if (pago.estado === 'Requiere Aclaración') {
                            badgeColor = 'bg-red-500/10 text-red-400 border-red-500/40';
                            label = 'Aclaración';
                          }

                          const formattedDate = formatDateDisplay(pago.fechaConfirmado);

                          return (
                            <div className="flex flex-col items-start gap-1">
                              <button
                                onClick={() => openEditPagoModal(pago, student.nombre)}
                                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 hover:scale-105 transition-transform ${badgeColor}`}
                                title={`Editar ${pago.concepto}`}
                              >
                                <span>{label}</span>
                              </button>

                              {pago.estado === 'Confirmado' && (
                                <span className="text-[10px] font-mono text-emerald-400/90 font-medium pl-0.5">
                                  {formattedDate || 'Fecha N/A'}
                                </span>
                              )}
                            </div>
                          );
                        };

                        const totalCommentsCount = student.pagos.filter(p => p.comentarioAdmin).length;

                        return (
                          <tr key={student.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3.5 font-bold text-slate-100 flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-xs">
                                {student.nombre.charAt(0)}
                              </div>
                              <div>
                                <div>{student.nombre}</div>
                                <div className="text-[11px] text-slate-400 font-mono">{student.usuario}</div>
                              </div>
                            </td>
                            <td className="p-3.5 text-slate-300">
                              <span className="font-semibold text-slate-200">{student.nivelEscolar}</span>
                              {student.grado && student.grupo && (
                                <span className="block text-[11px] text-slate-400">
                                  {student.grado}º "{student.grupo}"
                                </span>
                              )}
                            </td>
                            <td className="p-3.5">{renderStatusBadgeCell(knotionPago)}</td>
                            <td className="p-3.5">{renderStatusBadgeCell(techPago)}</td>
                            <td className="p-3.5">{renderStatusBadgeCell(lyproPago)}</td>
                            <td className="p-3.5">{renderStatusBadgeCell(escolarPago)}</td>
                            <td className="p-3.5">{renderStatusBadgeCell(colegiaturaPago)}</td>
                            
                            <td className="p-3.5 text-center">
                              <button
                                onClick={() => {
                                  const firstPago = student.pagos[0];
                                  if (firstPago) openEditPagoModal(firstPago, student.nombre);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-200 text-xs font-semibold transition-all inline-flex items-center gap-1.5 border border-slate-700 hover:border-cyan-400"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                                <span>Comentarios</span>
                                {totalCommentsCount > 0 && (
                                  <span className="px-1.5 py-0.2 rounded-full bg-cyan-500 text-slate-950 text-[10px] font-extrabold ml-0.5">
                                    {totalCommentsCount}
                                  </span>
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECTION B: GESTIÓN DE ALUMNOS */}
        {activeTabSection === 'gestion' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span>Catálogo de Usuarios y Alumnos</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Administre usuarios, niveles escolares, contraseñas y estatus de alta/baja.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 text-slate-300 font-bold uppercase border-b border-slate-800">
                    <th className="p-3.5">Alumno / Admin</th>
                    <th className="p-3.5">Usuario</th>
                    <th className="p-3.5">Contraseña Actual</th>
                    <th className="p-3.5">Nivel Escolar</th>
                    <th className="p-3.5">Grado / Grupo</th>
                    <th className="p-3.5">Estado</th>
                    <th className="p-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500 font-medium">
                        No hay usuarios registrados en el grupo "{selectedGroupTab}".
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 font-bold text-slate-100 flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                              u.role === 'ADMIN'
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            }`}
                          >
                            {u.role === 'ADMIN' ? 'AD' : u.nombre.charAt(0)}
                          </div>
                          <div>
                            <div>{u.nombre}</div>
                            {u.role === 'ADMIN' && (
                              <span className="text-[10px] font-bold text-indigo-400">ADMINISTRADOR</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 font-mono text-cyan-300">{u.usuario}</td>
                        <td className="p-3.5 font-mono text-slate-300 bg-slate-950/40 px-2 py-1 rounded max-w-[140px] truncate">
                          {u.passwordPlain}
                        </td>
                        <td className="p-3.5 font-medium text-slate-200">{u.nivelEscolar}</td>
                        <td className="p-3.5 text-slate-300">
                          {u.nivelEscolar === 'No aplica' ? (
                            <span className="text-slate-500 italic">No aplica</span>
                          ) : (
                            <span>
                              {u.grado || '-'}º "{u.grupo || '-'}"
                            </span>
                          )}
                        </td>
                        <td className="p-3.5">
                          {u.estado === 'Alta' ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold text-[11px] inline-flex items-center gap-1">
                              <UserCheck className="w-3 h-3" />
                              <span>Alta</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 font-bold text-[11px] inline-flex items-center gap-1">
                              <UserX className="w-3 h-3" />
                              <span>Baja</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditUserModal(u)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-200 text-xs font-semibold transition-all flex items-center gap-1"
                            >
                              <span>Editar</span>
                            </button>
                            {u.role !== 'ADMIN' && (
                              <button
                                onClick={() => handleDeleteUser(u.id, u.nombre)}
                                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white transition-all"
                                title="Eliminar Alumno"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECTION C: IMPORTACIÓN MASIVA EXCEL (Detección automática de grupos) */}
        {activeTabSection === 'importacion' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Upload className="w-5 h-5 text-cyan-400" />
                  <span>Carga Masiva de Alumnos vía Excel</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Suba la base de datos completa a Neon.tech. Al importar, se detectarán automáticamente todos los grupos del archivo Excel y se crearán las pestañas de grupos.
                </p>
              </div>

              <form onSubmit={handleImportSubmit} className="space-y-4">
                <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-xl p-8 text-center bg-slate-950/50 transition-all cursor-pointer relative">
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <FileSpreadsheet className="w-12 h-12 text-cyan-400 mx-auto mb-3" />
                  {importFile ? (
                    <div>
                      <p className="text-sm font-bold text-white">{importFile.name}</p>
                      <p className="text-xs text-slate-400">{(importFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-bold text-slate-200">Haga clic o arrastre el archivo Excel aquí</p>
                      <p className="text-xs text-slate-500 mt-1">Formatos soportados: .xlsx, .xls</p>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={importing || !importFile}
                  className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Procesando Importación a Neon.tech...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Importar a Base de Datos Neon.tech</span>
                    </>
                  )}
                </button>
              </form>

              {/* Import Result Notification */}
              {importResult && (
                <div
                  className={`p-4 rounded-xl text-xs space-y-2 border ${
                    importResult.error
                      ? 'bg-red-500/10 border-red-500/30 text-red-300'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  }`}
                >
                  {importResult.error ? (
                    <p>{importResult.error}</p>
                  ) : (
                    <div>
                      <p className="font-bold text-sm">{importResult.message}</p>
                      <ul className="mt-2 space-y-1 text-slate-300">
                        <li>• Registros procesados: {importResult.totalProcessed}</li>
                        <li>• Nuevos creados: {importResult.createdCount}</li>
                        <li>• Actualizados: {importResult.updatedCount}</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Template Download & Column Structure Info */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Download className="w-5 h-5 text-indigo-400" />
                  <span>Estructura del Archivo Excel</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  El archivo Excel debe contener exactamente las siguientes columnas en la primera fila:
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs space-y-2">
                <div className="text-cyan-400 font-bold">Columnas requeridas:</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-300">
                  <div>• Nombre</div>
                  <div>• Usuario</div>
                  <div>• Contraseña</div>
                  <div>• Nivel escolar</div>
                  <div>• Rol</div>
                  <div>• Grado</div>
                  <div>• Grupo</div>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href="/api/admin/export-template"
                  download
                  className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Plantilla de Ejemplo (.xlsx)</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* CREATE / EDIT USER MODAL */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                <span>{editingUser ? 'Editar Datos del Usuario' : 'Registrar Nuevo Alumno / Admin'}</span>
              </h3>
              <button
                onClick={() => setShowUserModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {passwordError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                {passwordError}
              </div>
            )}

            <form onSubmit={handleSaveUserSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej. Sofia López Ramírez"
                  required
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Usuario
                </label>
                <input
                  type="text"
                  value={formData.usuario}
                  onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
                  placeholder="Ej. sofial"
                  required
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-mono"
                />
              </div>

              {/* Password display & Nueva contraseña button */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block font-semibold text-slate-400 uppercase tracking-wider text-[11px]">
                      Contraseña Actual
                    </span>
                    <span className="text-sm font-bold font-mono text-cyan-300">
                      {formData.password || 'Sin contraseña'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowPasswordChangeFields(!showPasswordChangeFields)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 font-bold text-xs transition-all flex items-center gap-1.5"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>{showPasswordChangeFields ? 'Cancelar Cambio' : 'Nueva Contraseña'}</span>
                  </button>
                </div>

                {showPasswordChangeFields && (
                  <div className="pt-3 border-t border-slate-800 space-y-3 animate-fade-in">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Escribir nueva contraseña</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Nueva clave..."
                        className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 focus:ring-2 focus:ring-cyan-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Confirmar contraseña</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirmar clave..."
                        className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 focus:ring-2 focus:ring-cyan-500 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Nivel Escolar dropdown with "No aplica" */}
              <div>
                <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Nivel Escolar Asignado
                </label>
                <select
                  value={formData.nivelEscolar}
                  onChange={handleNivelChange}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                >
                  <option value="Pre-Maternal y Maternal">Pre-Maternal y Maternal</option>
                  <option value="Kínder 1">Kínder 1</option>
                  <option value="Kínder 2">Kínder 2</option>
                  <option value="Kínder 3">Kínder 3</option>
                  <option value="Primaria">Primaria</option>
                  <option value="Secundaria">Secundaria</option>
                  <option value="Preparatoria">Preparatoria</option>
                  <option value="No aplica">No aplica (Admin)</option>
                </select>
              </div>

              {/* Grado & Grupo - Disabled if "No aplica" */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Grado
                  </label>
                  <input
                    type="text"
                    value={formData.grado}
                    disabled={formData.nivelEscolar === 'No aplica'}
                    onChange={(e) => setFormData({ ...formData, grado: e.target.value })}
                    placeholder="Ej. 1"
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Grupo
                  </label>
                  <input
                    type="text"
                    value={formData.grupo}
                    disabled={formData.nivelEscolar === 'No aplica'}
                    onChange={(e) => setFormData({ ...formData, grupo: e.target.value })}
                    placeholder="Ej. A"
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Estado del Alumno */}
              <div>
                <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Estado del Alumno
                </label>
                <select
                  value={formData.estado}
                  onChange={(e) => setFormData({ ...formData, estado: e.target.value as 'Alta' | 'Baja' })}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                >
                  <option value="Alta">Alta (Activo)</option>
                  <option value="Baja">Baja (Inactivo)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20"
                >
                  {savingUser ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>Guardar Cambios</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK PAYMENT STATUS & COMENTARIOS MODAL */}
      {showPaymentModal && editingPago && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  <span>Editar Estado y Comentarios</span>
                </h3>
                <p className="text-xs text-cyan-400 font-semibold">{editingStudentName}</p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
              <div className="text-slate-400 uppercase font-semibold">Concepto</div>
              <div className="font-bold text-white text-sm">{editingPago.concepto}</div>
              {editingPago.numeroConfirmacion && (
                <div className="text-slate-300 pt-1">
                  No. Confirmación: <strong className="font-mono text-cyan-300">{editingPago.numeroConfirmacion}</strong>
                </div>
              )}
              {editingPago.respuestaAlumno && (
                <div className="text-indigo-300 pt-1 border-t border-slate-800/80 mt-1">
                  Respuesta del Alumno: <strong className="text-slate-200">{editingPago.respuestaAlumno}</strong>
                </div>
              )}
            </div>

            <form onSubmit={handleSavePagoSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Seleccionar Estatus del Pago
                </label>
                <select
                  value={pagoStatus}
                  onChange={(e) => setPagoStatus(e.target.value as any)}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-semibold"
                >
                  <option value="Pendiente">Pendiente</option>
                  <option value="En Revisión">En Revisión</option>
                  <option value="Confirmado">Confirmado (Verde)</option>
                  <option value="Requiere Aclaración">Requiere Aclaración (Rojo)</option>
                </select>
              </div>

              {pagoStatus === 'Confirmado' && (
                <div className="space-y-1.5 animate-fade-in bg-emerald-950/20 p-3 rounded-xl border border-emerald-500/30">
                  <label className="block font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Fecha de Confirmación del Colegio
                  </label>
                  <input
                    type="date"
                    value={customFechaConfirmado}
                    onChange={(e) => setCustomFechaConfirmado(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:ring-2 focus:ring-emerald-500 text-xs font-mono"
                  />
                  <p className="text-[11px] text-slate-400">
                    Esta fecha se mostrará debajo del badge 'Confirmado' en la matriz.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                  Escribir Comentario de la Administración
                </label>
                <textarea
                  value={comentarioAdmin}
                  onChange={(e) => setComentarioAdmin(e.target.value)}
                  placeholder="Escriba aquí observaciones del pago, número de lote bancario o notas internas..."
                  rows={3}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs"
                />
              </div>

              {pagoStatus === 'Requiere Aclaración' && (
                <div className="space-y-1.5 animate-fade-in">
                  <label className="block font-semibold text-red-400 uppercase tracking-wider">
                    Motivo de Aclaración (Visible para el Alumno)
                  </label>
                  <textarea
                    value={motivoAclaracion}
                    onChange={(e) => setMotivoAclaracion(e.target.value)}
                    placeholder="Escriba la razón (ej. comprobante borroso, folio incorrecto...)"
                    rows={3}
                    required
                    className="w-full p-3 bg-slate-950 border border-red-500/40 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500 text-xs"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20"
                >
                  {savingUser ? 'Guardando...' : 'Guardar Estatus y Comentario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
