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
  ArrowRight,
  Layers,
  Pencil,
  GraduationCap,
  Baby,
  HeartHandshake,
  Sparkles,
  BookOpen,
  Compass,
  UserPlus,
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
  notaConcepto?: string | null;
  mesColegiatura?: string | null;
  fechaVencimiento?: string | null;
  fechaConfirmado: string | null;
  createdAt: string;
}

interface UserStudent {
  id: string;
  nombre: string;
  usuario: string;
  passwordPlain: string;
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

// 1 Semana (7 días) para la etiqueta de Nuevo Ingreso, exclusivamente para registros creados desde el panel de administración
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isNuevoIngreso(user: { role?: string; createdAt?: string; creadoEnAdmin?: boolean }): boolean {
  if (user.role && user.role !== 'ALUMNO') return false;
  if (!user.creadoEnAdmin) return false;
  if (!user.createdAt) return false;
  const created = new Date(user.createdAt);
  if (isNaN(created.getTime())) return false;

  const diffMs = Date.now() - created.getTime();
  return diffMs >= 0 && diffMs <= ONE_WEEK_MS;
}

function formatFechaIngreso(createdAtStr?: string): string {
  if (!createdAtStr) return '';
  const d = new Date(createdAtStr);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function getDiasRestantesNuevoIngreso(createdAtStr?: string): number {
  if (!createdAtStr) return 0;
  const created = new Date(createdAtStr);
  if (isNaN(created.getTime())) return 0;
  const diffMs = created.getTime() + ONE_WEEK_MS - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function isNoAplicaNivel(nivel?: string | null): boolean {
  if (!nivel) return false;
  const n = nivel.trim().toLowerCase();
  return n.includes('no aplica');
}

function isSupervisorNivel(nivel?: string | null): boolean {
  if (!nivel) return false;
  const n = nivel.trim().toLowerCase();
  return n.includes('supervisor');
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserStudent[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string; nombre: string } | null>(null);
  const isSupervisor = currentUser?.role === 'SUPERVISOR';
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
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showNuevoIngresoModal, setShowNuevoIngresoModal] = useState(false);
  const [nuevoIngresoSearch, setNuevoIngresoSearch] = useState('');
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
  const [notaConcepto, setNotaConcepto] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [customFechaConfirmado, setCustomFechaConfirmado] = useState('');

  // Excel import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const [savingUser, setSavingUser] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Ciclo Escolar state
  const [cicloEscolarInput, setCicloEscolarInput] = useState('2026 - 2027');
  const [savingCiclo, setSavingCiclo] = useState(false);

  // Custom Groups state from DB
  const [customGroups, setCustomGroups] = useState<Array<{ nivelEscolar: string; grado: string; grupo: string; name: string }>>([]);

  // Migration to next cycle state (Only active from July)
  // JavaScript getMonth(): 0 = January, 6 = July, 7 = August...
  const isJulyOrLater = new Date().getMonth() >= 6;
  const [showMigrateModal, setShowMigrateModal] = useState(false);
  const [migratingCycle, setMigratingCycle] = useState(false);
  const [migrateNewCiclo, setMigrateNewCiclo] = useState('');

  // Delete Graduates state
  const [showDeleteGraduatesModal, setShowDeleteGraduatesModal] = useState(false);
  const [deletingGraduates, setDeletingGraduates] = useState(false);

  // Edit Group Modal state
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [editingGroupData, setEditingGroupData] = useState<{
    oldGroupKey: string;
    newGrado: string;
    newGrupo: string;
    newNivelEscolar?: string;
  }>({ oldGroupKey: '', newGrado: '', newGrupo: '', newNivelEscolar: '' });
  const [savingGroup, setSavingGroup] = useState(false);

  // Add Group Modal state
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [newGroupData, setNewGroupData] = useState<{
    nivelEscolar: string;
    grado: string;
    grupo: string;
  }>({ nivelEscolar: 'Primaria', grado: '1', grupo: 'A' });
  const [addingGroup, setAddingGroup] = useState(false);

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

  const fetchCustomGroups = async () => {
    try {
      const res = await fetch('/api/admin/groups');
      const data = await res.json();
      if (data.customGroups) {
        setCustomGroups(data.customGroups);
      }
    } catch (err) {
      console.error('Error fetching custom groups:', err);
    }
  };

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setCurrentUser(data.user);
          if (data.user.role === 'SUPERVISOR') {
            setActiveTabSection((prev) => (prev === 'gestion' || prev === 'importacion' ? 'dashboard' : prev));
          }
        }
      })
      .catch((err) => console.error('Error loading current user:', err));
    fetchUsers();
    fetchCustomGroups();
    fetch('/api/settings/ciclo-escolar')
      .then((res) => res.json())
      .then((data) => {
        if (data.cicloEscolar) setCicloEscolarInput(data.cicloEscolar);
      })
      .catch((err) => console.error('Error loading ciclo escolar setting:', err));
  }, []);

  const getNextCicloEscolar = (curr: string) => {
    const years = curr.match(/\d{4}/g);
    if (years && years.length >= 2) {
      const y1 = parseInt(years[0], 10) + 1;
      const y2 = parseInt(years[1], 10) + 1;
      return `${y1} - ${y2}`;
    }
    return curr;
  };

  const openMigrateModal = () => {
    setMigrateNewCiclo(getNextCicloEscolar(cicloEscolarInput));
    setShowMigrateModal(true);
  };

  const handleMigrateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    setMigratingCycle(true);
    try {
      const res = await fetch('/api/admin/migrate-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newCicloEscolar: migrateNewCiclo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al ejecutar la migración');

      if (data.cicloEscolar) {
        setCicloEscolarInput(data.cicloEscolar);
      }
      setFeedback({
        type: 'success',
        text: `Migración completada exitosamente. Se promovieron los alumnos y ${data.graduatesCount} alumnos pasaron a la pestaña Egresados.`,
      });
      setShowMigrateModal(false);
      fetchUsers();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setMigratingCycle(false);
    }
  };

  const handleDeleteGraduates = async () => {
    setDeletingGraduates(true);
    try {
      const res = await fetch('/api/admin/students/graduates', {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar egresados');

      setFeedback({
        type: 'success',
        text: `Se eliminaron exitosamente ${data.deletedCount} alumnos de la lista de Egresados.`,
      });
      setShowDeleteGraduatesModal(false);
      setSelectedGroupTab('Administración');
      fetchUsers();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setDeletingGraduates(false);
    }
  };

  const openEditGroup = (groupName: string) => {
    // Try to parse grade and group from groupName
    const match = groupName.match(/^([a-zA-Z0-9]+?)([a-zA-Z])$/);
    const detectedGrado = match ? match[1] : groupName;
    const detectedGrupo = match ? match[2] : '';

    // Detect level based on grade
    let lvl = 'Primaria';
    const gUpper = detectedGrado.toUpperCase();
    if (gUpper === 'N1') lvl = 'Pre - Maternal';
    else if (gUpper === 'N2') lvl = 'Maternal';
    else if (['K1', 'K2', 'K3'].includes(gUpper)) lvl = 'Kinder';
    else if (['1', '2', '3', '4', '5', '6'].includes(gUpper)) lvl = 'Primaria';
    else if (['7', '8', '9'].includes(gUpper)) lvl = 'Secundaria';
    else if (['10', '11', '12'].includes(gUpper)) lvl = 'Preparatoria';

    setEditingGroupData({
      oldGroupKey: groupName,
      newGrado: detectedGrado,
      newGrupo: detectedGrupo,
      newNivelEscolar: lvl,
    });
    setShowEditGroupModal(true);
  };

  const handleRenameGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGroup(true);
    try {
      const res = await fetch('/api/admin/groups/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingGroupData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al renombrar el grupo');

      setFeedback({
        type: 'success',
        text: data.message || 'Grupo renombrado correctamente.',
      });
      setShowEditGroupModal(false);
      if (selectedGroupTab === editingGroupData.oldGroupKey && data.newGroupKey) {
        setSelectedGroupTab(data.newGroupKey);
      }
      fetchUsers();
      fetchCustomGroups();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSavingGroup(false);
    }
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingGroup(true);
    try {
      const res = await fetch('/api/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGroupData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al agregar el grupo');

      const createdName = data.newGroup?.name || `${newGroupData.grado}${newGroupData.grupo}`;
      setFeedback({
        type: 'success',
        text: `Pestaña de grupo "${createdName}" creada exitosamente.`,
      });
      setShowAddGroupModal(false);
      setSelectedGroupTab(createdName);
      setNewGroupData({ nivelEscolar: 'Primaria', grado: '1', grupo: 'A' });
      fetchCustomGroups();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setAddingGroup(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const handleSaveCicloEscolar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cicloEscolarInput.trim()) return;

    setSavingCiclo(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/admin/settings/ciclo-escolar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cicloEscolar: cicloEscolarInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar ciclo escolar');

      setCicloEscolarInput(data.cicloEscolar);
      setFeedback({
        type: 'success',
        text: `Ciclo escolar actualizado correctamente a "${data.cicloEscolar}". Visible en Login y Usuarios.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSavingCiclo(false);
    }
  };

  // Selected status filter from Dashboard breakdown cards
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'TODOS' | 'Confirmado' | 'En Revisión' | 'Pendiente' | 'Requiere Aclaración'>('TODOS');
  const [statusDateFilter, setStatusDateFilter] = useState<string | null>(null);

  // Helper para normalizar y extraer YYYY-MM-DD sin desfase de zona horaria
  const getLocalDateString = (dateInput: string | Date | null | undefined): string | null => {
    if (!dateInput) return null;
    if (typeof dateInput === 'string') {
      if (dateInput.includes('T00:00:00')) {
        return dateInput.split('T')[0];
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        return dateInput;
      }
    }
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper para comparar fechas con string ISO (YYYY-MM-DD)
  const isSameDayString = (dateInput: string | Date | null | undefined, targetISO: string): boolean => {
    const localDate = getLocalDateString(dateInput);
    if (!localDate) return false;
    return localDate === targetISO;
  };

  // Cambiar de pestaña: al cambiar a Dashboard, Gestión o Importación, se quita el filtrado
  const handleTabChange = (section: 'dashboard' | 'verificacion' | 'gestion' | 'importacion') => {
    if (isSupervisor && (section === 'gestion' || section === 'importacion')) {
      return;
    }
    setActiveTabSection(section);
    if (section !== 'verificacion') {
      setSelectedStatusFilter('TODOS');
      setStatusDateFilter(null);
    }
  };

  // Clic en el logotipo: regresa al Dashboard inicial y quita todos los filtros
  const handleLogoClick = () => {
    setActiveTabSection('dashboard');
    setSelectedStatusFilter('TODOS');
    setStatusDateFilter(null);
    setSearchQuery('');
    setStartDateFilter(thirtyDaysAgo);
    setEndDateFilter(todayStr);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Prevenir que el botón "Atrás" del navegador cierre la sesión
  useEffect(() => {
    window.history.pushState({ page: 'admin', tab: activeTabSection }, '', window.location.href);

    const handlePopState = () => {
      if (activeTabSection !== 'dashboard') {
        setActiveTabSection('dashboard');
        setSelectedStatusFilter('TODOS');
        setStatusDateFilter(null);
        window.history.pushState({ page: 'admin', tab: 'dashboard' }, '', window.location.href);
      } else {
        window.history.pushState({ page: 'admin', tab: 'dashboard' }, '', window.location.href);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTabSection]);

  const handleStatusCardClick = (
    status: 'Confirmado' | 'En Revisión' | 'Pendiente' | 'Requiere Aclaración',
    filterDate?: string
  ) => {
    setSelectedStatusFilter(status);
    setStatusDateFilter(filterDate || null);
    if (filterDate) {
      setStartDateFilter(filterDate);
      setEndDateFilter(filterDate);
    }
    setActiveTabSection('verificacion');

    // Switch to first student group tab if on Administración
    if (selectedGroupTab === 'Administración' && groupTabsMap.length > 1) {
      const firstStudentGroup = groupTabsMap.find(([name]) => name !== 'Administración');
      if (firstStudentGroup) {
        setSelectedGroupTab(firstStudentGroup[0]);
      }
    }
  };

  // Group Tabs Calculation (SIN "TODOS", "Administración" PRIMERA opción, "Egresados", grupos dinámicos y grupos personalizados)
  const groupTabsMap = useMemo(() => {
    const map = new Map<string, number>();

    // Administración as mandatory first tab
    const adminCount = users.filter((u) => isNoAplicaNivel(u.nivelEscolar) || u.role === 'ADMIN' || u.role === 'SUPERVISOR').length;
    map.set('Administración', adminCount);

    // Egresados tab
    const egresadosCount = users.filter(
      (u) => u.role === 'ALUMNO' && (u.nivelEscolar === 'Egresados' || u.grado === 'Egresados')
    ).length;
    map.set('Egresados', egresadosCount);

    // Dynamic groups detected from users/Excel
    users.forEach((u) => {
      if (isNoAplicaNivel(u.nivelEscolar) || u.role === 'ADMIN' || u.role === 'SUPERVISOR') return;
      if (u.nivelEscolar === 'Egresados' || u.grado === 'Egresados') return;

      // If status filter is active, check if student has matching pagos
      if (selectedStatusFilter !== 'TODOS') {
        const hasMatchingPago = u.pagos.some((p) => {
          if (p.estado !== selectedStatusFilter) return false;
          if (statusDateFilter) {
            if (!p.fechaConfirmado) return false;
            return isSameDayString(p.fechaConfirmado, statusDateFilter);
          }
          return true;
        });
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

    // Custom empty groups from DB
    customGroups.forEach((cg) => {
      const gKey = cg.name || `${cg.grado}${cg.grupo}`;
      if (!map.has(gKey)) {
        map.set(gKey, 0);
      }
    });

    return Array.from(map.entries());
  }, [users, selectedStatusFilter, statusDateFilter, customGroups]);

  // Pestañas agrupadas y ordenadas por nivel escolar estricto:
  // 1. Pre - Maternal N1, 2. Maternal N2, 3. Kinder K1..K3, 4. Primaria 1..6, 5. Secundaria 7..9, 6. Preparatoria 10..12, 7. Egresados, 8. Administración
  const leveledGroupTabs = useMemo(() => {
    const levelOrder = [
      { key: 'n1', title: 'Pre - Maternal (N1)', order: 1, icon: Baby, color: 'text-amber-400 border-amber-500/30' },
      { key: 'n2', title: 'Maternal (N2)', order: 2, icon: HeartHandshake, color: 'text-orange-400 border-orange-500/30' },
      { key: 'kinder', title: 'Kinder (K1, K2, K3)', order: 3, icon: Sparkles, color: 'text-yellow-400 border-yellow-500/30' },
      { key: 'primaria', title: 'Primaria (1, 2, 3, 4, 5, 6)', order: 4, icon: BookOpen, color: 'text-cyan-400 border-cyan-500/30' },
      { key: 'secundaria', title: 'Secundaria (7, 8, 9)', order: 5, icon: Compass, color: 'text-indigo-400 border-indigo-500/30' },
      { key: 'preparatoria', title: 'Preparatoria (10, 11, 12)', order: 6, icon: GraduationCap, color: 'text-purple-400 border-purple-500/30' },
      { key: 'egresados', title: 'Egresados', order: 7, icon: GraduationCap, color: 'text-rose-400 border-rose-500/30' },
      { key: 'admin', title: 'Administración', order: 8, icon: ShieldCheck, color: 'text-emerald-400 border-emerald-500/30' },
      { key: 'otros', title: 'Otros Grupos', order: 9, icon: Layers, color: 'text-slate-400 border-slate-500/30' },
    ];

    const mapByLevel = new Map<string, Array<[string, number]>>();
    levelOrder.forEach((l) => mapByLevel.set(l.key, []));

    groupTabsMap.forEach(([groupName, count]) => {
      let targetKey = 'otros';
      if (groupName === 'Administración') {
        targetKey = 'admin';
      } else if (groupName === 'Egresados') {
        targetKey = 'egresados';
      } else {
        const g = groupName.toUpperCase().trim();
        if (g.startsWith('N1') || g.includes('PRE - MATERNAL') || g.includes('PRE-MATERNAL')) {
          targetKey = 'n1';
        } else if (g.startsWith('N2') || g.includes('MATERNAL')) {
          targetKey = 'n2';
        } else if (g.startsWith('K1') || g.startsWith('K2') || g.startsWith('K3') || g.includes('KINDER')) {
          targetKey = 'kinder';
        } else if (
          ((g.startsWith('1') || g.startsWith('2') || g.startsWith('3') || g.startsWith('4') || g.startsWith('5') || g.startsWith('6')) &&
            !g.startsWith('10') &&
            !g.startsWith('11') &&
            !g.startsWith('12')) ||
          g.includes('PRIMARIA')
        ) {
          targetKey = 'primaria';
        } else if (g.startsWith('7') || g.startsWith('8') || g.startsWith('9') || g.includes('SECUNDARIA')) {
          targetKey = 'secundaria';
        } else if (g.startsWith('10') || g.startsWith('11') || g.startsWith('12') || g.includes('PREPA')) {
          targetKey = 'preparatoria';
        }
      }

      mapByLevel.get(targetKey)?.push([groupName, count]);
    });

    return levelOrder
      .map((level) => {
        const groups = mapByLevel.get(level.key) || [];
        groups.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }));
        return {
          ...level,
          groups,
        };
      })
      .filter((level) => level.groups.length > 0);
  }, [groupTabsMap]);

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
      if (isNoAplicaNivel(u.nivelEscolar) || u.role === 'ADMIN' || u.role === 'SUPERVISOR') {
        groupKey = 'Administración';
      } else if (u.nivelEscolar === 'Egresados' || u.grado === 'Egresados') {
        groupKey = 'Egresados';
      } else if (u.grado && u.grupo) {
        groupKey = `${u.grado}${u.grupo}`;
      } else if (u.nivelEscolar) {
        groupKey = u.nivelEscolar;
      }

      if (groupKey !== selectedGroupTab) return false;

      // Status filter matching
      if (selectedStatusFilter !== 'TODOS') {
        const hasMatchingPago = u.pagos.some((p) => {
          if (p.estado !== selectedStatusFilter) return false;
          if (statusDateFilter) {
            if (!p.fechaConfirmado) return false;
            return isSameDayString(p.fechaConfirmado, statusDateFilter);
          }
          return true;
        });
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
  }, [users, selectedGroupTab, searchQuery, selectedStatusFilter, statusDateFilter]);

  // Alumnos Nuevo Ingreso (registrados en el último mes)
  const nuevoIngresoStudents = useMemo(() => {
    return users.filter((u) => isNuevoIngreso(u));
  }, [users]);

  const filteredNuevoIngresoStudents = useMemo(() => {
    if (!nuevoIngresoSearch.trim()) return nuevoIngresoStudents;
    const q = nuevoIngresoSearch.toLowerCase().trim();
    return nuevoIngresoStudents.filter(
      (s) =>
        s.nombre.toLowerCase().includes(q) ||
        s.usuario.toLowerCase().includes(q) ||
        s.nivelEscolar.toLowerCase().includes(q) ||
        (s.grado && s.grado.toLowerCase().includes(q)) ||
        (s.grupo && s.grupo.toLowerCase().includes(q))
    );
  }, [nuevoIngresoStudents, nuevoIngresoSearch]);

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

    // Calculate Today and Yesterday confirmed counts
    const now = new Date();
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);

    const getISO = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const todayISO = getISO(now);
    const yesterdayISO = getISO(yesterdayDate);

    const todayConfirmedCount = confirmedPagos.filter((p) =>
      p.fechaConfirmado && isSameDayString(p.fechaConfirmado, todayISO)
    ).length;

    const yesterdayConfirmedCount = confirmedPagos.filter((p) =>
      p.fechaConfirmado && isSameDayString(p.fechaConfirmado, yesterdayISO)
    ).length;

    const formatDayDisplay = (d: Date) => {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const todayFormatted = formatDayDisplay(now);
    const yesterdayFormatted = formatDayDisplay(yesterdayDate);

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
      todayConfirmedCount,
      yesterdayConfirmedCount,
      todayFormatted,
      yesterdayFormatted,
      todayISO,
      yesterdayISO,
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
      createdAt?: string;
      creadoEnAdmin?: boolean;
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
              createdAt: u.createdAt,
              creadoEnAdmin: u.creadoEnAdmin,
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

    return confirmedPaymentsList.filter((item) => {
      if (!item.fechaConfirmado) return false;
      const ymd = getLocalDateString(item.fechaConfirmado);
      if (!ymd) return false;
      if (startDateFilter && ymd < startDateFilter) return false;
      if (endDateFilter && ymd > endDateFilter) return false;
      return true;
    });
  }, [confirmedPaymentsList, startDateFilter, endDateFilter]);

  // User Create / Edit Handlers
  const openCreateUserModal = () => {
    setEditingUser(null);

    // Pre-populate with currently selected tab if it is a student group
    let initialNivel = 'Primaria';
    let initialGrado = '1';
    let initialGrupo = 'A';

    if (selectedGroupTab === 'Administración') {
      initialNivel = 'No Aplica (Admin)';
      initialGrado = '';
      initialGrupo = '';
    } else if (selectedGroupTab && selectedGroupTab !== 'Administración' && selectedGroupTab !== 'Egresados') {
      const match = selectedGroupTab.match(/^([a-zA-Z0-9]+?)([a-zA-Z])$/);
      if (match) {
        initialGrado = match[1];
        initialGrupo = match[2];
        const gUpper = initialGrado.toUpperCase();
        if (gUpper === 'N1') initialNivel = 'Pre - Maternal';
        else if (gUpper === 'N2') initialNivel = 'Maternal';
        else if (['K1', 'K2', 'K3'].includes(gUpper)) initialNivel = 'Kinder';
        else if (['1', '2', '3', '4', '5', '6'].includes(gUpper)) initialNivel = 'Primaria';
        else if (['7', '8', '9'].includes(gUpper)) initialNivel = 'Secundaria';
        else if (['10', '11', '12'].includes(gUpper)) initialNivel = 'Preparatoria';
      }
    } else if (selectedGroupTab === 'Egresados') {
      initialNivel = 'Egresados';
      initialGrado = '12';
      initialGrupo = 'A';
    }

    setFormData({
      nombre: '',
      usuario: '',
      password: '',
      nivelEscolar: initialNivel,
      grado: initialGrado,
      grupo: initialGrupo,
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
    let initialNivel = user.nivelEscolar;
    if (user.role === 'SUPERVISOR' || isSupervisorNivel(user.nivelEscolar)) {
      initialNivel = 'No Aplica Supervisor';
    } else if (user.role === 'ADMIN' || isNoAplicaNivel(user.nivelEscolar)) {
      initialNivel = 'No Aplica (Admin)';
    }

    setFormData({
      nombre: user.nombre,
      usuario: user.usuario,
      password: user.passwordPlain,
      nivelEscolar: initialNivel,
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
    const isNoAplica = isNoAplicaNivel(val);
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
      const isSupervisor = isSupervisorNivel(formData.nivelEscolar);
      const isNoAplica = isNoAplicaNivel(formData.nivelEscolar);
      const computedRole = isSupervisor ? 'SUPERVISOR' : isNoAplica ? 'ADMIN' : 'ALUMNO';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: formData.nombre,
          usuario: formData.usuario,
          password: finalPasswordToSubmit,
          nivelEscolar: formData.nivelEscolar,
          grado: isNoAplica ? null : formData.grado,
          grupo: isNoAplica ? null : formData.grupo,
          estado: formData.estado,
          role: computedRole,
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
    if (isSupervisor) return;
    setEditingPago(pago);
    setEditingStudentName(studentName);
    setPagoStatus(pago.estado);
    setMotivoAclaracion(pago.motivoAclaracion || '');
    setComentarioAdmin(pago.comentarioAdmin || '');
    setNotaConcepto(pago.notaConcepto || '');

    if (pago.fechaVencimiento) {
      const dV = new Date(pago.fechaVencimiento);
      setFechaVencimiento(dV.toISOString().split('T')[0]);
    } else {
      setFechaVencimiento('');
    }

    let defaultDateStr = '';
    if (pago.fechaConfirmado) {
      defaultDateStr = getLocalDateString(pago.fechaConfirmado) || '';
    } else {
      defaultDateStr = getLocalDateString(new Date()) || '';
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
          notaConcepto: notaConcepto.trim() || null,
          fechaVencimiento: fechaVencimiento ? fechaVencimiento : null,
          fechaConfirmado: pagoStatus === 'Confirmado' ? customFechaConfirmado : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al actualizar pago');
      }

      setFeedback({
        type: 'success',
        text: `Estatus, notas y vencimiento del concepto "${editingPago.concepto}" guardados correctamente.`,
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
    const ymd = getLocalDateString(dateString);
    if (!ymd) return null;
    const [year, month, day] = ymd.split('-').map(Number);
    const d = new Date(year, month - 1, day, 12, 0, 0);
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
          <button
            type="button"
            onClick={handleLogoClick}
            className="flex items-center gap-3 text-left cursor-pointer group hover:opacity-90 transition-opacity"
            title="Ir al inicio del Administrador y quitar filtros"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2 group-hover:text-cyan-200 transition-colors">
                Pagos<span className="text-cyan-400">CM</span>
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">
                Portal de registro de pagos de Plataformas del Colegio Mexicano
              </p>
            </div>
          </button>

          <div className="flex items-center gap-4">
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
              onClick={() => handleTabChange('dashboard')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                activeTabSection === 'dashboard'
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Dashboard / Métricas</span>
            </button>

            <button
              onClick={() => handleTabChange('verificacion')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                activeTabSection === 'verificacion'
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Panel de Verificación de Pagos</span>
            </button>

            {!isSupervisor && (
              <>
                <button
                  onClick={() => handleTabChange('gestion')}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                    activeTabSection === 'gestion'
                      ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                      : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Gestión de Alumnos</span>
                </button>

                <button
                  onClick={() => handleTabChange('importacion')}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                    activeTabSection === 'importacion'
                      ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                      : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Importación Masiva Excel</span>
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {!isSupervisor && activeTabSection === 'gestion' && (
              <button
                onClick={openCreateUserModal}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-cyan-500/20 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Alumno / Usuario</span>
              </button>
            )}
          </div>
        </div>

        {/* SECTION 1: DASHBOARD Y MÉTRICAS */}
        {activeTabSection === 'dashboard' && (
          <div className="space-y-6 animate-fade-in">
            {/* CONFIGURACIÓN DEL CICLO ESCOLAR */}
            {!isSupervisor && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-cyan-400" />
                      <span>Configuración del Ciclo Escolar Actual</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Este texto se mostrará públicamente en la pantalla de inicio de sesión (Login) y en el panel de cada alumno.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={openMigrateModal}
                    disabled={!isJulyOrLater}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                      isJulyOrLater
                        ? 'bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/30 cursor-pointer'
                        : 'bg-slate-800/60 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60'
                    }`}
                    title={isJulyOrLater ? 'Iniciar migración de grado escolar' : 'Disponible a partir del mes de Julio'}
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Migrar al Siguiente Ciclo</span>
                    {!isJulyOrLater && <span className="text-[10px] text-amber-400">(Julio)</span>}
                  </button>
                </div>

                <form onSubmit={handleSaveCicloEscolar} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={cicloEscolarInput}
                      onChange={(e) => setCicloEscolarInput(e.target.value)}
                      placeholder="Ej. 2026 - 2027"
                      required
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs font-bold font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingCiclo}
                    className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                  >
                    {savingCiclo ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <span>Guardar Ciclo Escolar</span>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* KPI Summary Cards */}
            {!isSupervisor && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Total Alumnos Activos */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                  <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Alumnos Activos</div>
                  <div className="text-3xl font-extrabold text-white mt-2">{metrics.activeStudents}</div>
                  <div className="text-[11px] text-slate-500 mt-1">Registrados en plataforma</div>
                </div>

                {/* Alumnos Nuevo Ingreso (CLICKABLE) */}
                <button
                  type="button"
                  onClick={() => setShowNuevoIngresoModal(true)}
                  className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-5 shadow-xl relative overflow-hidden text-left transition-all hover:scale-[1.02] cursor-pointer group"
                  title="Haz clic para ver la lista de alumnos de nuevo ingreso registrados esta semana"
                >
                  <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 group-hover:scale-110 transition-all">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="text-xs font-bold text-slate-400 group-hover:text-emerald-300 transition-colors uppercase tracking-wider flex items-center gap-1.5">
                    <span>Alumnos Nuevo Ingreso</span>
                  </div>
                  <div className="text-3xl font-extrabold text-emerald-400 mt-2">
                    {nuevoIngresoStudents.length}
                  </div>
                  <div className="text-[11px] text-emerald-400/80 mt-1 flex items-center gap-1 font-semibold">
                    <span>Última semana · Ver lista</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

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
            )}

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

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs pt-2">
                  {/* Total Confirmados */}
                  <button
                    type="button"
                    onClick={() => handleStatusCardClick('Confirmado')}
                    className="bg-slate-950 p-3.5 rounded-xl border border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-500/10 text-left transition-all group cursor-pointer shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold truncate">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 group-hover:scale-125 transition-transform" />
                        <span className="truncate">Confirmados</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-colors shrink-0" />
                    </div>
                    <div className="text-2xl font-extrabold text-white mt-2">{metrics.confirmedCount}</div>
                    <div className="text-[10px] text-slate-400 mt-1 font-medium group-hover:text-emerald-300 truncate">
                      Total acumulado &rarr;
                    </div>
                  </button>

                  {/* Confirmados HOY */}
                  <button
                    type="button"
                    onClick={() => handleStatusCardClick('Confirmado', metrics.todayISO)}
                    className="bg-slate-950 p-3.5 rounded-xl border border-teal-500/40 hover:border-teal-400 hover:bg-teal-500/10 text-left transition-all group cursor-pointer shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-teal-300 font-bold truncate">
                        <span className="w-2.5 h-2.5 rounded-full bg-teal-400 shrink-0 group-hover:scale-125 transition-transform" />
                        <span className="truncate">Confirmados Hoy</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-teal-400 transition-colors shrink-0" />
                    </div>
                    <div className="text-2xl font-extrabold text-teal-300 mt-2">{metrics.todayConfirmedCount}</div>
                    <div className="text-[10px] text-teal-400/90 mt-1 font-semibold truncate flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-teal-400 inline shrink-0" />
                      <span className="truncate">{metrics.todayFormatted}</span>
                    </div>
                  </button>

                  {/* Confirmados AYER */}
                  <button
                    type="button"
                    onClick={() => handleStatusCardClick('Confirmado', metrics.yesterdayISO)}
                    className="bg-slate-950 p-3.5 rounded-xl border border-indigo-500/40 hover:border-indigo-400 hover:bg-indigo-500/10 text-left transition-all group cursor-pointer shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-indigo-300 font-bold truncate">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 shrink-0 group-hover:scale-125 transition-transform" />
                        <span className="truncate">Confirmados Ayer</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors shrink-0" />
                    </div>
                    <div className="text-2xl font-extrabold text-indigo-300 mt-2">{metrics.yesterdayConfirmedCount}</div>
                    <div className="text-[10px] text-indigo-400/90 mt-1 font-semibold truncate flex items-center gap-1">
                      <CalendarDays className="w-3 h-3 text-indigo-400 inline shrink-0" />
                      <span className="truncate">{metrics.yesterdayFormatted}</span>
                    </div>
                  </button>

                  {/* En Revisión */}
                  <button
                    type="button"
                    onClick={() => handleStatusCardClick('En Revisión')}
                    className="bg-slate-950 p-3.5 rounded-xl border border-blue-500/30 hover:border-blue-400 hover:bg-blue-500/10 text-left transition-all group cursor-pointer shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-blue-400 font-bold truncate">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 group-hover:scale-125 transition-transform" />
                        <span className="truncate">En Revisión</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors shrink-0" />
                    </div>
                    <div className="text-2xl font-extrabold text-white mt-2">{metrics.inReviewCount}</div>
                    <div className="text-[10px] text-slate-400 mt-1 font-medium group-hover:text-blue-300 truncate">
                      Ver en grupos &rarr;
                    </div>
                  </button>

                  {/* Pendientes */}
                  <button
                    type="button"
                    onClick={() => handleStatusCardClick('Pendiente')}
                    className="bg-slate-950 p-3.5 rounded-xl border border-amber-500/30 hover:border-amber-400 hover:bg-amber-500/10 text-left transition-all group cursor-pointer shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-amber-400 font-bold truncate">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 group-hover:scale-125 transition-transform" />
                        <span className="truncate">Pendientes</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition-colors shrink-0" />
                    </div>
                    <div className="text-2xl font-extrabold text-white mt-2">{metrics.pendingCount}</div>
                    <div className="text-[10px] text-slate-400 mt-1 font-medium group-hover:text-amber-300 truncate">
                      Ver en grupos &rarr;
                    </div>
                  </button>

                  {/* Aclaraciones */}
                  <button
                    type="button"
                    onClick={() => handleStatusCardClick('Requiere Aclaración')}
                    className="bg-slate-950 p-3.5 rounded-xl border border-red-500/30 hover:border-red-400 hover:bg-red-500/10 text-left transition-all group cursor-pointer shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-red-400 font-bold truncate">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 group-hover:scale-125 transition-transform" />
                        <span className="truncate">Aclaraciones</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-red-400 transition-colors shrink-0" />
                    </div>
                    <div className="text-2xl font-extrabold text-white mt-2">{metrics.clarifyCount}</div>
                    <div className="text-[10px] text-slate-400 mt-1 font-medium group-hover:text-red-300 truncate">
                      Ver en grupos &rarr;
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* QUIÉNES PAGARON POR FECHA TABLE SECTION (CON SELECTOR DE RANGO DE FECHAS) */}
            {!isSupervisor && (
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
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredConfirmedPaymentsByRange.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-500 font-medium">
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
                              <div className="flex items-center gap-2 flex-wrap">
                                <span>{item.studentName}</span>
                                {isNuevoIngreso({ role: 'ALUMNO', createdAt: (item as any).createdAt, creadoEnAdmin: (item as any).creadoEnAdmin }) && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 whitespace-nowrap shadow-sm shadow-emerald-500/10">
                                    <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                                    (Nuevo Ingreso - {formatFechaIngreso((item as any).createdAt)})
                                  </span>
                                )}
                              </div>
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
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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

            {/* GROUP TABS CONTAINER (SEPARADAS POR NIVELES ESCOLARES) */}
            <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>Pestañas de Grupo Asignadas por Nivel ({groupTabsMap.length} Pestañas en Total):</span>
                </span>

                {!isSupervisor && (
                  <button
                    type="button"
                    onClick={() => setShowAddGroupModal(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm self-start sm:self-auto"
                    title="Crear una nueva pestaña de grupo"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Pestaña</span>
                  </button>
                )}
              </div>

              {/* Leveled Groups Sections (Orden: Pre - Maternal N1, Maternal N2, Kinder K1..K3, Primaria 1..6, Secundaria 7..9, Preparatoria 10..12, Egresados, Administración) */}
              <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1 divide-y divide-slate-800/40">
                {leveledGroupTabs.map((level) => {
                  const LevelIcon = level.icon;
                  return (
                    <div key={level.key} className="pt-3 first:pt-0 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                        <LevelIcon className={`w-3.5 h-3.5 ${level.color.split(' ')[0]}`} />
                        <span className="tracking-wide uppercase text-[11px] text-slate-300 font-extrabold">{level.title}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({level.groups.length} grupos)</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {level.groups.map(([groupName, count]) => {
                          const isSelected = selectedGroupTab === groupName;
                          const isSpecial = groupName === 'Administración' || groupName === 'Egresados';
                          return (
                            <div
                              key={groupName}
                              className={`group relative inline-flex items-center rounded-full text-xs font-extrabold transition-all border ${
                                isSelected
                                  ? 'bg-emerald-400 text-slate-950 border-emerald-300 shadow-lg shadow-emerald-500/25 scale-105 z-10'
                                  : 'bg-slate-900/90 text-emerald-400 border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-500/10'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => setSelectedGroupTab(groupName)}
                                className="px-3 py-1.5 flex items-center gap-1.5 cursor-pointer"
                              >
                                <span>{groupName}</span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                                    isSelected ? 'bg-slate-950 text-emerald-400' : 'bg-emerald-500/20 text-emerald-300'
                                  }`}
                                >
                                  {count}
                                </span>
                              </button>

                              {!isSpecial && !isSupervisor && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditGroup(groupName);
                                  }}
                                  title={`Editar nombre de pestaña (${groupName})`}
                                  className={`pr-2.5 pl-0.5 py-1.5 transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'text-slate-800 hover:text-slate-950'
                                      : 'text-emerald-500/50 hover:text-white'
                                  }`}
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
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

            {/* Banner exclusivo para Egresados con botón de eliminar la lista */}
            {selectedGroupTab === 'Egresados' && (
              <div className="p-4 bg-rose-950/20 border-b border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center gap-2.5 text-xs text-rose-300">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-rose-200 text-sm">Pestaña de Alumnos Egresados</div>
                    <div className="text-[11px] text-rose-300/80">
                      Aquí se muestran los alumnos graduados de 12º de Preparatoria que completaron su ciclo.
                    </div>
                  </div>
                </div>

                {!isSupervisor && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteGraduatesModal(true)}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-rose-600/25 cursor-pointer shrink-0"
                    title="Eliminar permanentemente todos los alumnos egresados"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar Lista de Egresados</span>
                  </button>
                )}
              </div>
            )}

            {/* Banner de filtro activo */}
            {selectedStatusFilter !== 'TODOS' && (
              <div className="px-4 py-2.5 bg-cyan-500/10 border-b border-cyan-500/20 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span className="text-slate-400 font-medium">Filtrado activo:</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${
                    selectedStatusFilter === 'Confirmado'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : selectedStatusFilter === 'En Revisión'
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      : selectedStatusFilter === 'Pendiente'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-red-500/20 text-red-300 border-red-500/40'
                  }`}>
                    {selectedStatusFilter}
                    {statusDateFilter === metrics.todayISO
                      ? ' · Solo Hoy'
                      : statusDateFilter === metrics.yesterdayISO
                      ? ' · Solo Ayer'
                      : statusDateFilter
                      ? ` · ${statusDateFilter}`
                      : ''}
                  </span>
                  {statusDateFilter && (
                    <span className="text-[11px] text-emerald-400 font-medium">
                      (Mostrando únicamente los conceptos confirmados en esta fecha)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStatusFilter('TODOS');
                    setStatusDateFilter(null);
                  }}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold cursor-pointer px-2 py-1 rounded-lg hover:bg-cyan-500/10 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Quitar filtro y ver todos los conceptos
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 text-slate-300 font-bold uppercase border-b border-slate-800">
                    <th className="p-3.5 min-w-[200px]">Nombre del Alumno</th>
                    <th className="p-3.5">Nivel / Grupo</th>
                    {isSupervisor ? (
                      <>
                        <th className="p-3.5">Licencia Knotion</th>
                        <th className="p-3.5">Cuota de Tecnología</th>
                        <th className="p-3.5">Cuota de Lypro</th>
                      </>
                    ) : (
                      <>
                        <th className="p-3.5">Inscripción / Reinscripción</th>
                        <th className="p-3.5">Cuota Tecnología</th>
                        <th className="p-3.5">Cuota Material</th>
                        <th className="p-3.5">Cuota Escolar</th>
                        <th className="p-3.5">Pago Knotion</th>
                        <th className="p-3.5">Pago Lypro</th>
                        <th className="p-3.5">Colegiatura</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.filter(u => u.role === 'ALUMNO').length === 0 ? (
                    <tr>
                      <td colSpan={isSupervisor ? 5 : 9} className="p-8 text-center text-slate-500 font-medium">
                        No hay alumnos con pagos en este criterio en el grupo "{selectedGroupTab}".
                      </td>
                    </tr>
                  ) : (
                    filteredUsers
                      .filter((u) => u.role === 'ALUMNO')
                      .map((student) => {
                        const getPagoByConceptName = (keyword: string) => {
                          if (statusDateFilter) {
                            return student.pagos.find(
                              (p) =>
                                p.concepto.toLowerCase().includes(keyword.toLowerCase()) &&
                                p.estado === 'Confirmado' &&
                                p.fechaConfirmado &&
                                isSameDayString(p.fechaConfirmado, statusDateFilter)
                            );
                          }
                          if (selectedStatusFilter !== 'TODOS') {
                            const matchStatus = student.pagos.find(
                              (p) =>
                                p.concepto.toLowerCase().includes(keyword.toLowerCase()) &&
                                p.estado === selectedStatusFilter
                            );
                            if (matchStatus) return matchStatus;
                          }
                          return student.pagos.find((p) => p.concepto.toLowerCase().includes(keyword.toLowerCase()));
                        };

                        const inscripcionPago = getPagoByConceptName('inscripci');
                        const techPago = getPagoByConceptName('tecnolog');
                        const materialPago = getPagoByConceptName('material') || getPagoByConceptName('materia');
                        const escolarPago = getPagoByConceptName('escolar');
                        const knotionPago = getPagoByConceptName('knotion');
                        const lyproPago = getPagoByConceptName('lypro');

                        // Si hay filtro por fecha (Hoy/Ayer), solo seleccionar colegiatura confirmada en esa fecha
                        const colegiaturaPago =
                          statusDateFilter
                            ? student.pagos.find(
                                (p) =>
                                  (p.tipo === 'MENSUAL' || p.concepto.toLowerCase().includes('colegiatura')) &&
                                  p.estado === 'Confirmado' &&
                                  p.fechaConfirmado &&
                                  isSameDayString(p.fechaConfirmado, statusDateFilter)
                              )
                            : selectedStatusFilter !== 'TODOS'
                            ? student.pagos.find(
                                (p) =>
                                  (p.tipo === 'MENSUAL' || p.concepto.toLowerCase().includes('colegiatura')) &&
                                  p.estado === selectedStatusFilter
                              ) || student.pagos.find(
                                (p) =>
                                  (p.tipo === 'MENSUAL' || p.concepto.toLowerCase().includes('colegiatura'))
                              )
                            : student.pagos.find(
                                (p) =>
                                  (p.tipo === 'MENSUAL' || p.concepto.toLowerCase().includes('colegiatura'))
                              );

                        const renderStatusBadgeCell = (pago?: Pago) => {
                          if (!pago) {
                            return <span className="text-slate-700 font-mono text-center block">-</span>;
                          }

                          // Si hay filtro por fecha (Confirmados Hoy / Confirmados Ayer), SOLO mostrar si se confirmó en esa fecha
                          if (statusDateFilter) {
                            if (!pago.fechaConfirmado || pago.estado !== 'Confirmado') {
                              return <span className="text-slate-700 font-mono text-center block">-</span>;
                            }
                            const matchesDate = isSameDayString(pago.fechaConfirmado, statusDateFilter);
                            if (!matchesDate) {
                              return <span className="text-slate-700 font-mono text-center block">-</span>;
                            }
                          } else if (selectedStatusFilter !== 'TODOS') {
                            // Si se filtró por un estatus específico (ej. Confirmado, En Revisión, etc.)
                            // NO mostrar nada si el pago corresponde a otro estatus
                            if (pago.estado !== selectedStatusFilter) {
                              return <span className="text-slate-700 font-mono text-center block">-</span>;
                            }
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

                          if (isSupervisor) {
                            return (
                              <div className="flex flex-col items-start gap-1">
                                <span
                                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 cursor-default select-none ${badgeColor}`}
                                  title={`${pago.concepto}${pago.mesColegiatura ? ` (${pago.mesColegiatura})` : ''}`}
                                >
                                  <span>{label}</span>
                                  {pago.tipo === 'MENSUAL' && pago.mesColegiatura && (
                                    <span className="text-[9px] opacity-75 font-mono">({pago.mesColegiatura.slice(0, 3)})</span>
                                  )}
                                </span>

                                {pago.estado === 'Confirmado' && (
                                  <span className="text-[10px] font-mono text-emerald-400/90 font-medium pl-0.5">
                                    {formattedDate || 'Fecha N/A'}
                                  </span>
                                )}
                              </div>
                            );
                          }

                          return (
                            <div className="flex flex-col items-start gap-1">
                              <button
                                onClick={() => openEditPagoModal(pago, student.nombre)}
                                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 hover:scale-105 transition-transform cursor-pointer ${badgeColor}`}
                                title={`Editar ${pago.concepto}${pago.mesColegiatura ? ` (${pago.mesColegiatura})` : ''}`}
                              >
                                <span>{label}</span>
                                {pago.tipo === 'MENSUAL' && pago.mesColegiatura && (
                                  <span className="text-[9px] opacity-75 font-mono">({pago.mesColegiatura.slice(0, 3)})</span>
                                )}
                              </button>

                              {pago.estado === 'Confirmado' && (
                                <span className="text-[10px] font-mono text-emerald-400/90 font-medium pl-0.5">
                                  {formattedDate || 'Fecha N/A'}
                                </span>
                              )}
                            </div>
                          );
                        };

                        return (
                          <tr key={student.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3.5 font-bold text-slate-100 flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-xs">
                                {student.nombre.charAt(0)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span>{student.nombre}</span>
                                  {isNuevoIngreso(student) && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 whitespace-nowrap shadow-sm shadow-emerald-500/10">
                                      <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                                      (Nuevo Ingreso - {formatFechaIngreso(student.createdAt)})
                                    </span>
                                  )}
                                </div>
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
                            {isSupervisor ? (
                              <>
                                <td className="p-3.5">{renderStatusBadgeCell(knotionPago)}</td>
                                <td className="p-3.5">{renderStatusBadgeCell(techPago)}</td>
                                <td className="p-3.5">{renderStatusBadgeCell(lyproPago)}</td>
                              </>
                            ) : (
                              <>
                                <td className="p-3.5">{renderStatusBadgeCell(inscripcionPago)}</td>
                                <td className="p-3.5">{renderStatusBadgeCell(techPago)}</td>
                                <td className="p-3.5">{renderStatusBadgeCell(materialPago)}</td>
                                <td className="p-3.5">{renderStatusBadgeCell(escolarPago)}</td>
                                <td className="p-3.5">{renderStatusBadgeCell(knotionPago)}</td>
                                <td className="p-3.5">{renderStatusBadgeCell(lyproPago)}</td>
                                <td className="p-3.5">{renderStatusBadgeCell(colegiaturaPago)}</td>
                              </>
                            )}
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

            {/* Banner exclusivo para Egresados con botón de eliminar la lista */}
            {selectedGroupTab === 'Egresados' && (
              <div className="p-4 bg-rose-950/20 border-b border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center gap-2.5 text-xs text-rose-300">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-rose-200 text-sm">Lista de Alumnos Egresados</div>
                    <div className="text-[11px] text-rose-300/80">
                      Alumnos graduados de 12º de Preparatoria. Puede gestionar sus cuentas o vaciar la lista completa.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDeleteGraduatesModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-rose-600/25 cursor-pointer shrink-0"
                  title="Eliminar permanentemente todos los alumnos egresados"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar Lista de Egresados</span>
                </button>
              </div>
            )}

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
                                : u.role === 'SUPERVISOR'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            }`}
                          >
                            {u.role === 'ADMIN' ? 'AD' : u.role === 'SUPERVISOR' ? 'SP' : u.nombre.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>{u.nombre}</span>
                              {isNuevoIngreso(u) && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 whitespace-nowrap shadow-sm shadow-emerald-500/10">
                                  <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                                  (Nuevo Ingreso - {formatFechaIngreso(u.createdAt)})
                                </span>
                              )}
                            </div>
                            {u.role === 'ADMIN' && (
                              <span className="text-[10px] font-bold text-indigo-400">ADMINISTRADOR</span>
                            )}
                            {u.role === 'SUPERVISOR' && (
                              <span className="text-[10px] font-bold text-amber-400">SUPERVISOR</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 font-mono text-cyan-300">{u.usuario}</td>
                        <td className="p-3.5 font-mono text-slate-300 bg-slate-950/40 px-2 py-1 rounded max-w-[140px] truncate">
                          {u.passwordPlain}
                        </td>
                        <td className="p-3.5 font-medium text-slate-200">{u.nivelEscolar}</td>
                        <td className="p-3.5 text-slate-300">
                          {isNoAplicaNivel(u.nivelEscolar) || u.role === 'ADMIN' || u.role === 'SUPERVISOR' ? (
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

              {/* Modal Tabs: Alumno / Pestaña Administración */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    if (isNoAplicaNivel(formData.nivelEscolar)) {
                      setFormData((prev) => ({
                        ...prev,
                        nivelEscolar: 'Primaria',
                        grado: '1',
                        grupo: 'A',
                      }));
                    }
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    !isNoAplicaNivel(formData.nivelEscolar)
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Alumno</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!isNoAplicaNivel(formData.nivelEscolar)) {
                      setFormData((prev) => ({
                        ...prev,
                        nivelEscolar: 'No Aplica (Admin)',
                        grado: '',
                        grupo: '',
                      }));
                    }
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isNoAplicaNivel(formData.nivelEscolar)
                      ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Pestaña Administración</span>
                </button>
              </div>

              {/* Quick Group Assignment Selector */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
                <label className="block font-semibold text-emerald-400 uppercase tracking-wider text-[11px] flex items-center justify-between">
                  <span>Asignar a Pestaña de Grupo</span>
                  <span className="text-[10px] text-slate-500 font-normal">Auto-asigna nivel, grado y grupo</span>
                </label>
                <select
                  value={
                    isNoAplicaNivel(formData.nivelEscolar)
                      ? 'Administración'
                      : groupTabsMap.some(([name]) => name === `${formData.grado}${formData.grupo}`)
                      ? `${formData.grado}${formData.grupo}`
                      : ''
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    if (val === 'Administración') {
                      setFormData((prev) => ({
                        ...prev,
                        nivelEscolar: isSupervisorNivel(prev.nivelEscolar)
                          ? 'No Aplica Supervisor'
                          : 'No Aplica (Admin)',
                        grado: '',
                        grupo: '',
                      }));
                      return;
                    }
                    if (val === 'Egresados') {
                      setFormData((prev) => ({
                        ...prev,
                        nivelEscolar: 'Egresados',
                        grado: '12',
                        grupo: 'A',
                      }));
                      return;
                    }
                    const match = val.match(/^([a-zA-Z0-9]+?)([a-zA-Z])$/);
                    if (match) {
                      const g = match[1];
                      const gr = match[2];
                      let lvl = formData.nivelEscolar;
                      const gUpper = g.toUpperCase();
                      if (gUpper === 'N1') lvl = 'Pre - Maternal';
                      else if (gUpper === 'N2') lvl = 'Maternal';
                      else if (['K1', 'K2', 'K3'].includes(gUpper)) lvl = 'Kinder';
                      else if (['1', '2', '3', '4', '5', '6'].includes(gUpper)) lvl = 'Primaria';
                      else if (['7', '8', '9'].includes(gUpper)) lvl = 'Secundaria';
                      else if (['10', '11', '12'].includes(gUpper)) lvl = 'Preparatoria';
                      setFormData((prev) => ({
                        ...prev,
                        nivelEscolar: lvl,
                        grado: g,
                        grupo: gr,
                      }));
                    }
                  }}
                  className="w-full p-2.5 bg-slate-900 border border-emerald-500/30 rounded-lg text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-semibold cursor-pointer"
                >
                  <option value="">-- Seleccionar pestaña de grupo --</option>
                  <option value="Administración">Pestaña Administración (Admin / Supervisor)</option>
                  {groupTabsMap
                    .filter(([name]) => name !== 'Administración' && name !== 'Egresados')
                    .map(([name, count]) => (
                      <option key={name} value={name}>
                        Grupo {name} ({count} alumnos)
                      </option>
                    ))}
                  <option value="Egresados">Pestaña Egresados</option>
                </select>
              </div>

              {/* Nivel Escolar dropdown with "No aplica" */}
              <div>
                <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Nivel Escolar Asignado
                </label>
                <select
                  value={
                    formData.nivelEscolar === 'No aplica'
                      ? 'No Aplica (Admin)'
                      : formData.nivelEscolar === 'No aplica (Supervisor)'
                      ? 'No Aplica Supervisor'
                      : formData.nivelEscolar
                  }
                  onChange={handleNivelChange}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-semibold"
                >
                  <optgroup label="Pestaña Administración">
                    <option value="No Aplica (Admin)">No Aplica (Admin)</option>
                    <option value="No Aplica Supervisor">No Aplica Supervisor</option>
                  </optgroup>
                  <optgroup label="Niveles Escolares (Alumnos)">
                    <option value="Pre - Maternal">Pre - Maternal (N1)</option>
                    <option value="Maternal">Maternal (N2)</option>
                    <option value="Kinder">Kinder (K1, K2, K3)</option>
                    <option value="Primaria">Primaria (1º a 6º)</option>
                    <option value="Secundaria">Secundaria (7º a 9º)</option>
                    <option value="Preparatoria">Preparatoria (10º a 12º)</option>
                    <option value="Egresados">Egresados</option>
                  </optgroup>
                </select>
              </div>

              {/* Grado & Grupo - Disabled if "No aplica" */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-300 uppercase tracking-wider">
                      Grado
                    </label>
                    {!isNoAplicaNivel(formData.nivelEscolar) && (
                      <span className="text-[10px] text-slate-400">Sugerencias</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={isNoAplicaNivel(formData.nivelEscolar) ? (isSupervisorNivel(formData.nivelEscolar) ? 'N/A (Supervisor)' : 'N/A (Admin)') : formData.grado}
                    disabled={isNoAplicaNivel(formData.nivelEscolar)}
                    onChange={(e) => setFormData({ ...formData, grado: e.target.value })}
                    placeholder="Ej. 1"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  />
                  {/* Quick Grade Suggestions */}
                  {!isNoAplicaNivel(formData.nivelEscolar) && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {formData.nivelEscolar === 'Pre - Maternal' && (
                        <button type="button" onClick={() => setFormData({ ...formData, grado: 'N1' })} className="px-2 py-0.5 rounded bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 text-[10px] font-mono">N1</button>
                      )}
                      {formData.nivelEscolar === 'Maternal' && (
                        <button type="button" onClick={() => setFormData({ ...formData, grado: 'N2' })} className="px-2 py-0.5 rounded bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 text-[10px] font-mono">N2</button>
                      )}
                      {formData.nivelEscolar === 'Kinder' && ['K1', 'K2', 'K3'].map(k => (
                        <button key={k} type="button" onClick={() => setFormData({ ...formData, grado: k })} className="px-2 py-0.5 rounded bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 text-[10px] font-mono">{k}</button>
                      ))}
                      {formData.nivelEscolar === 'Primaria' && ['1', '2', '3', '4', '5', '6'].map(k => (
                        <button key={k} type="button" onClick={() => setFormData({ ...formData, grado: k })} className="px-2 py-0.5 rounded bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 text-[10px] font-mono">{k}º</button>
                      ))}
                      {formData.nivelEscolar === 'Secundaria' && ['7', '8', '9'].map(k => (
                        <button key={k} type="button" onClick={() => setFormData({ ...formData, grado: k })} className="px-2 py-0.5 rounded bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 text-[10px] font-mono">{k}º</button>
                      ))}
                      {formData.nivelEscolar === 'Preparatoria' && ['10', '11', '12'].map(k => (
                        <button key={k} type="button" onClick={() => setFormData({ ...formData, grado: k })} className="px-2 py-0.5 rounded bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 text-[10px] font-mono">{k}º</button>
                      ))}
                      {formData.nivelEscolar === 'Egresados' && (
                        <button type="button" onClick={() => setFormData({ ...formData, grado: '12' })} className="px-2 py-0.5 rounded bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 text-[10px] font-mono">12</button>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-300 uppercase tracking-wider">
                      Grupo
                    </label>
                    {!isNoAplicaNivel(formData.nivelEscolar) && (
                      <span className="text-[10px] text-slate-400">Letras</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={isNoAplicaNivel(formData.nivelEscolar) ? (isSupervisorNivel(formData.nivelEscolar) ? 'N/A (Supervisor)' : 'N/A (Admin)') : formData.grupo}
                    disabled={isNoAplicaNivel(formData.nivelEscolar)}
                    onChange={(e) => setFormData({ ...formData, grupo: e.target.value })}
                    placeholder="Ej. A"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  />
                  {!isNoAplicaNivel(formData.nivelEscolar) && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {['A', 'B', 'C', 'D', 'E'].map(grp => (
                        <button key={grp} type="button" onClick={() => setFormData({ ...formData, grupo: grp })} className="px-2 py-0.5 rounded bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 text-[10px] font-mono">{grp}</button>
                      ))}
                    </div>
                  )}
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
                <label className="block font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  Texto / Nota Debajo del Concepto (Visible para el Alumno)
                </label>
                <textarea
                  value={notaConcepto}
                  onChange={(e) => setNotaConcepto(e.target.value)}
                  placeholder="Escriba texto explicativo o instrucciones que aparecerán justo debajo de este concepto..."
                  rows={2}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>


              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                  Escribir Comentario de la Administración
                </label>
                <textarea
                  value={comentarioAdmin}
                  onChange={(e) => setComentarioAdmin(e.target.value)}
                  placeholder="Escriba aquí observaciones del pago, número de lote bancario o notas internas..."
                  rows={2}
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

      {/* MODAL DE CONFIRMACIÓN DE MIGRACIÓN DE CICLO ESCOLAR */}
      {showMigrateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Migración a Nuevo Ciclo Escolar</h3>
                  <p className="text-xs text-emerald-400 font-semibold">Promoción general de alumnos de grado</p>
                </div>
              </div>
              <button
                onClick={() => setShowMigrateModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl text-xs text-slate-200 space-y-2">
              <div className="font-bold text-white text-sm">
                ¿Está seguro de hacer la migración de alumnos al siguiente grado escolar?
              </div>
              <p className="text-slate-400">
                Al confirmar la migración de ciclo escolar, se aplicarán las siguientes promociones automáticas:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px] text-slate-300 font-medium">
                <div>• Pre - Maternal (N1) → <strong>Maternal (N2)</strong></div>
                <div>• Maternal (N2) → <strong>Kinder (K1)</strong></div>
                <div>• Kinder (K1 → K2 → K3)</div>
                <div>• Kinder K3 → <strong>1º Primaria</strong></div>
                <div>• Primaria (1º a 5º → 2º a 6º)</div>
                <div>• Primaria 6º → <strong>7º Secundaria</strong></div>
                <div>• Secundaria (7º y 8º → 8º y 9º)</div>
                <div>• Secundaria 9º → <strong>10º Preparatoria</strong></div>
                <div>• Preparatoria (10º y 11º → 11º y 12º)</div>
                <div className="text-rose-400 font-bold">• 12º Preparatoria → <strong>Pestaña Egresados</strong></div>
              </div>
              <p className="text-[11px] text-emerald-300/80 pt-1">
                * Los conceptos de pago de todos los alumnos activos se reiniciarán en 'Pendiente' con los conceptos del nuevo ciclo escolar.
              </p>
            </div>

            <form onSubmit={handleMigrateCycle} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Nombre del Nuevo Ciclo Escolar
                </label>
                <input
                  type="text"
                  value={migrateNewCiclo}
                  onChange={(e) => setMigrateNewCiclo(e.target.value)}
                  placeholder="Ej. 2027 - 2028"
                  required
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold font-mono"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMigrateModal(false)}
                  disabled={migratingCycle}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={migratingCycle}
                  className="flex-1 py-2.5 rounded-xl text-xs font-extrabold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 transition-all shadow-lg shadow-emerald-500/25 cursor-pointer flex items-center justify-center gap-2"
                >
                  {migratingCycle ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Migrando alumnos...</span>
                    </>
                  ) : (
                    <span>Sí, Realizar Migración</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA ELIMINAR LISTA DE EGRESADOS */}
      {showDeleteGraduatesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center space-y-5">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-inner">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-white">¿Eliminar Lista de Egresados?</h3>
              <p className="text-xs text-slate-400 mt-1">
                ¿Está seguro de eliminar a todos los alumnos que se encuentran en la pestaña de Egresados? Esta acción eliminará permanentemente sus cuentas de la plataforma y no se puede deshacer.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteGraduatesModal(false)}
                disabled={deletingGraduates}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteGraduates}
                disabled={deletingGraduates}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-lg shadow-rose-600/25 border border-rose-500 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {deletingGraduates ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <span>Sí, Eliminar Lista</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA EDITAR NOMBRE DE PESTAÑA / GRUPO (LÁPIZ) */}
      {showEditGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Editar Pestaña de Grupo</h3>
                  <p className="text-xs text-slate-400">Pestaña actual: <strong className="text-cyan-400">{editingGroupData.oldGroupKey}</strong></p>
                </div>
              </div>
              <button
                onClick={() => setShowEditGroupModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRenameGroup} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Grado
                  </label>
                  <input
                    type="text"
                    value={editingGroupData.newGrado}
                    onChange={(e) => setEditingGroupData({ ...editingGroupData, newGrado: e.target.value })}
                    placeholder="Ej. 1"
                    required
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:ring-2 focus:ring-cyan-500 text-sm font-bold font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Grupo
                  </label>
                  <input
                    type="text"
                    value={editingGroupData.newGrupo}
                    onChange={(e) => setEditingGroupData({ ...editingGroupData, newGrupo: e.target.value })}
                    placeholder="Ej. A"
                    required
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:ring-2 focus:ring-cyan-500 text-sm font-bold font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400">
                Nuevo nombre resultante: <strong className="text-cyan-300 font-mono text-xs">{editingGroupData.newGrado}{editingGroupData.newGrupo}</strong>. Todos los alumnos registrados en este grupo serán actualizados automáticamente.
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditGroupModal(false)}
                  disabled={savingGroup}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingGroup}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-cyan-500 hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/25 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {savingGroup ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>Guardar Nombre</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA AGREGAR NUEVA PESTAÑA DE GRUPO */}
      {showAddGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Agregar Nueva Pestaña</h3>
                  <p className="text-xs text-slate-400">Cree un grupo asignable a alumnos</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddGroupModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddGroup} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Nivel Escolar
                </label>
                <select
                  value={newGroupData.nivelEscolar}
                  onChange={(e) => {
                    const lvl = e.target.value;
                    let defGrado = '1';
                    if (lvl === 'Pre - Maternal') defGrado = 'N1';
                    else if (lvl === 'Maternal') defGrado = 'N2';
                    else if (lvl === 'Kinder') defGrado = 'K1';
                    else if (lvl === 'Primaria') defGrado = '1';
                    else if (lvl === 'Secundaria') defGrado = '7';
                    else if (lvl === 'Preparatoria') defGrado = '10';
                    setNewGroupData({ ...newGroupData, nivelEscolar: lvl, grado: defGrado });
                  }}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:ring-2 focus:ring-emerald-500 text-xs font-semibold"
                >
                  <option value="Pre - Maternal">Pre - Maternal (N1)</option>
                  <option value="Maternal">Maternal (N2)</option>
                  <option value="Kinder">Kinder (K1, K2, K3)</option>
                  <option value="Primaria">Primaria (1º a 6º)</option>
                  <option value="Secundaria">Secundaria (7º a 9º)</option>
                  <option value="Preparatoria">Preparatoria (10º a 12º)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Grado
                  </label>
                  <input
                    type="text"
                    value={newGroupData.grado}
                    onChange={(e) => setNewGroupData({ ...newGroupData, grado: e.target.value })}
                    placeholder="Ej. 1 o K1"
                    required
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:ring-2 focus:ring-emerald-500 text-sm font-bold font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Grupo
                  </label>
                  <input
                    type="text"
                    value={newGroupData.grupo}
                    onChange={(e) => setNewGroupData({ ...newGroupData, grupo: e.target.value })}
                    placeholder="Ej. A"
                    required
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:ring-2 focus:ring-emerald-500 text-sm font-bold font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400">
                Pestaña resultante: <strong className="text-emerald-400 font-mono text-xs">{newGroupData.grado}{newGroupData.grupo}</strong>. Aparecerá en el nivel <strong className="text-slate-200">{newGroupData.nivelEscolar}</strong> y podrá asignarle alumnos inmediatamente.
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddGroupModal(false)}
                  disabled={addingGroup}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addingGroup}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-colors shadow-lg shadow-emerald-500/25 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {addingGroup ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creando...</span>
                    </>
                  ) : (
                    <span>Crear Pestaña</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ALUMNOS NUEVO INGRESO */}
      {showNuevoIngresoModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-5 relative max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">Alumnos de Nuevo Ingreso</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      {nuevoIngresoStudents.length} {nuevoIngresoStudents.length === 1 ? 'Alumno esta semana' : 'Alumnos esta semana'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Alumnos registrados desde el panel de administración en Gestión de Alumnos / Nuevo Alumno. La etiqueta permanece activa durante 1 semana (7 días).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNuevoIngresoModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search filter */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nombre, usuario, nivel escolar, grado o grupo..."
                value={nuevoIngresoSearch}
                onChange={(e) => setNuevoIngresoSearch(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
              />
              {nuevoIngresoSearch && (
                <button
                  type="button"
                  onClick={() => setNuevoIngresoSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* List / Table */}
            <div className="flex-1 overflow-y-auto space-y-2 border border-slate-800/80 rounded-2xl bg-slate-950/50 p-2">
              {filteredNuevoIngresoStudents.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs space-y-2">
                  <Users className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                  <p className="font-semibold text-slate-400">
                    {nuevoIngresoSearch
                      ? 'No se encontraron alumnos con el criterio de búsqueda.'
                      : 'No hay alumnos registrados en el último mes.'}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Cuando un administrador registre a un alumno, aparecerá aquí durante 30 días con la etiqueta activa.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/60">
                  {filteredNuevoIngresoStudents.map((st) => {
                    const diasRestantes = getDiasRestantesNuevoIngreso(st.createdAt);
                    const totalConceptos = st.pagos.length;
                    const confirmados = st.pagos.filter((p) => p.estado === 'Confirmado').length;

                    return (
                      <div
                        key={st.id}
                        className="p-3.5 hover:bg-slate-900/80 rounded-xl transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-sm shrink-0">
                            {st.nombre.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-100 text-sm">{st.nombre}</span>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/10">
                                <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                                (Nuevo Ingreso - {formatFechaIngreso(st.createdAt)})
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
                              <span className="font-mono text-cyan-400 font-medium">@{st.usuario}</span>
                              <span>•</span>
                              <span className="text-slate-300 font-semibold">{st.nivelEscolar}</span>
                              {st.grado && st.grupo && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-400 font-mono">
                                    {st.grado}º "{st.grupo}"
                                  </span>
                                </>
                              )}
                              <span>•</span>
                              <span className="text-emerald-400/90 text-[11px] font-medium">
                                {diasRestantes > 0 ? `${diasRestantes} de 7 días restantes con etiqueta` : 'Último día con etiqueta'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 sm:self-center self-end shrink-0">
                          {/* Payment mini summary */}
                          <div className="text-right">
                            <div className="text-[11px] text-slate-400 font-medium">
                              Conceptos: <strong className="text-white">{confirmados}</strong>/{totalConceptos}
                            </div>
                            <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all"
                                style={{
                                  width: `${(confirmados / (totalConceptos || 1)) * 100}%`,
                                }}
                              />
                            </div>
                          </div>

                          {/* Jump to Verificación button */}
                          <button
                            type="button"
                            onClick={() => {
                              setShowNuevoIngresoModal(false);
                              setActiveTabSection('verificacion');
                              if (st.grado && st.grupo) {
                                setSelectedGroupTab(`${st.grado}${st.grupo}`);
                              }
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 text-xs font-bold transition-all border border-slate-700 hover:border-cyan-400 flex items-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <span>Ver Pagos</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <span className="text-slate-500">
                Mostrando {filteredNuevoIngresoStudents.length} de {nuevoIngresoStudents.length} alumnos de nuevo ingreso
              </span>
              <button
                type="button"
                onClick={() => setShowNuevoIngresoModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
