import React, { useState, useEffect, useMemo } from 'react';
import { db, collection, query, where, onSnapshot, addDoc, serverTimestamp } from '../lib/firebase';
import { doc, deleteDoc, getDocs } from 'firebase/firestore';
import { Project } from '../types';
import { User } from 'firebase/auth';
import { 
  Plus, Briefcase, MapPin, Calendar, TrendingUp, BarChart3, 
  Trash2, AlertTriangle, FileText, Download, Layers, DollarSign,
  Search, Filter, LayoutGrid, Table as TableIcon, ChevronRight,
  ShieldCheck, ArrowUpRight, Receipt, CheckCircle2, Clock
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import GlobalSummaryModal from './GlobalSummaryModal';
import ProfitCostTrendChart from './ProfitCostTrendChart';
import { formatCLP } from '../lib/pdfExport';

interface DashboardProps {
  onSelectProject: (project: Project) => void;
  user: User;
}

export default function Dashboard({ onSelectProject, user }: DashboardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showGlobalSummaryModal, setShowGlobalSummaryModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [dashboardTab, setDashboardTab] = useState<'projects' | 'iva'>('projects');

  const [newProject, setNewProject] = useState({
    name: '',
    address: '',
    description: '',
    budget: 0,
    hasIva: false
  });

  useEffect(() => {
    const q = query(collection(db, 'projects'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      setProjects(projectsList);
    });
    return unsubscribe;
  }, [user.uid]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = 
        statusFilter === 'all' ? true :
        statusFilter === 'active' ? (p.status === 'active' || !p.status) :
        p.status === 'completed';

      return matchesSearch && matchesStatus;
    });
  }, [projects, searchTerm, statusFilter]);

  const activeProjects = projects.filter(p => p.status === 'active' || !p.status);
  const completedProjects = projects.filter(p => p.status === 'completed');

  const totalGlobalBudget = activeProjects.reduce((sum, p) => sum + (p.budget || 0), 0);
  const totalGlobalInvoiced = activeProjects.reduce((sum, p) => sum + (p.totalNetInvoices || 0), 0);
  const totalGlobalExpenses = activeProjects.reduce((sum, p) => sum + (p.totalExpenses || 0), 0);
  const totalGlobalSpent = totalGlobalInvoiced + totalGlobalExpenses;
  const totalGlobalRemaining = totalGlobalBudget - totalGlobalSpent;
  const globalBurnRate = totalGlobalBudget > 0 ? (totalGlobalSpent / totalGlobalBudget) * 100 : 0;

  const chartData = projects.map(p => ({
    name: p.name.length > 14 ? p.name.substring(0, 12) + '..' : p.name,
    Presupuesto: p.budget,
    Facturado: p.totalNetInvoices || 0,
    Gastos: p.totalExpenses || 0,
  }));

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const budgetValue = Number(newProject.budget) || 0;
      const hasIva = !!newProject.hasIva;
      const ivaAmount = hasIva ? Math.round(budgetValue * 0.19) : 0;
      const totalBudgetBruto = budgetValue + ivaAmount;

      await addDoc(collection(db, 'projects'), {
        name: newProject.name,
        address: newProject.address,
        description: newProject.description,
        budget: budgetValue,
        hasIva,
        ivaAmount,
        totalBudgetBruto,
        ownerId: user.uid,
        status: 'active',
        totalNetInvoices: 0,
        totalIvaInvoices: 0,
        totalExpenses: 0,
        createdAt: serverTimestamp()
      });
      setShowNewModal(false);
      setNewProject({ name: '', address: '', description: '', budget: 0, hasIva: false });
    } catch (error) {
      console.error("Error creating project:", error);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete?.id) return;
    setIsDeleting(true);
    try {
      // Invoices
      const invQuery = query(collection(db, 'invoices'), where('projectId', '==', projectToDelete.id));
      const invSnapshot = await getDocs(invQuery);
      for (const invDoc of invSnapshot.docs) await deleteDoc(invDoc.ref);

      // Expenses
      const expQuery = query(collection(db, 'expenses'), where('projectId', '==', projectToDelete.id));
      const expSnapshot = await getDocs(expQuery);
      for (const expDoc of expSnapshot.docs) await deleteDoc(expDoc.ref);

      // Quotations
      const quotQuery = query(collection(db, 'quotations'), where('projectId', '==', projectToDelete.id));
      const quotSnapshot = await getDocs(quotQuery);
      for (const quotDoc of quotSnapshot.docs) await deleteDoc(quotDoc.ref);

      // Notes
      const notesQuery = query(collection(db, 'notes'), where('projectId', '==', projectToDelete.id));
      const notesSnapshot = await getDocs(notesQuery);
      for (const noteDoc of notesSnapshot.docs) await deleteDoc(noteDoc.ref);

      // Project itself
      await deleteDoc(doc(db, 'projects', projectToDelete.id));
      setProjectToDelete(null);
    } catch (error) {
      console.error("Error deleting project:", error);
      alert("Hubo un error al eliminar el proyecto. Por favor intenta nuevamente.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* EXECUTIVE HEADER & TOP ACTIONS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 uppercase tracking-wider border border-zinc-200 dark:border-zinc-800">
              Viña Construcciones & Estructuras SpA
            </span>
            <span className="text-zinc-400">•</span>
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Panel Central de Obras</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight uppercase">
            Gestión de Obras & Control Financiero
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Control de Órdenes de Compra, Facturación DTE, Rendición de Gastos y Cotizaciones Oficiales DOM.
          </p>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <button 
            type="button"
            onClick={() => setShowGlobalSummaryModal(true)}
            className="px-3.5 py-2 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-xl flex items-center gap-2 transition-all text-xs font-semibold shadow-xs cursor-pointer"
            title="Exportar Resumen Consolidado de Gastos y Materiales en PDF"
          >
            <FileText className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            <span>Resumen Global</span>
            <span className="px-1.5 py-0.2 bg-zinc-100 dark:bg-zinc-900 text-[10px] font-bold rounded text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800">
              PDF
            </span>
          </button>

          <button 
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 bg-zinc-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-950 text-white rounded-xl flex items-center gap-2 transition-all text-xs font-semibold shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Obra</span>
          </button>
        </div>
      </div>

      {/* TABS SELECTOR SYSTEM */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-1 mt-2">
        <button
          onClick={() => setDashboardTab('projects')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            dashboardTab === 'projects'
              ? 'border-zinc-900 text-zinc-900 dark:border-white dark:text-white font-black'
              : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
          }`}
        >
          <Briefcase className="w-4 h-4 text-zinc-500" />
          <span>Obras en Ejecución</span>
          <span className="ml-1 px-1.5 py-0.5 text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-full font-bold">
            {projects.length}
          </span>
        </button>

        <button
          onClick={() => setDashboardTab('iva')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            dashboardTab === 'iva'
              ? 'border-zinc-900 text-zinc-900 dark:border-white dark:text-white font-black'
              : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
          }`}
        >
          <Receipt className="w-4 h-4 text-emerald-600" />
          <span>Control Central de IVA & F29</span>
          <span className="ml-1 px-1.5 py-0.5 text-[9px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-full font-bold">
            Consolidado
          </span>
        </button>
      </div>

      {/* PROJECTS TAB CONTENT */}
      {dashboardTab === 'projects' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* EXECUTIVE BENTO KPI METRICS */}
          {projects.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Active Works */}
          <div className="bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">Obras en Ejecución</span>
              <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white flex items-center justify-center border border-zinc-200 dark:border-zinc-800">
                <Briefcase className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-zinc-900 dark:text-white">{activeProjects.length}</span>
                <span className="text-xs text-zinc-500 font-medium">de {projects.length} totales</span>
              </div>
              <div className="mt-2.5 w-full bg-zinc-100 dark:bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-zinc-900 dark:bg-white h-full rounded-full transition-all"
                  style={{ width: `${projects.length > 0 ? (activeProjects.length / projects.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Global Budget */}
          <div className="bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">Presupuesto OC Neto</span>
              <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white flex items-center justify-center border border-zinc-200 dark:border-zinc-800">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-xl font-bold text-zinc-900 dark:text-white font-mono">
                {formatCLP(totalGlobalBudget)}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                Contratos y Órdenes activas
              </p>
            </div>
          </div>

          {/* Card 3: Total Spent */}
          <div className="bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">Total Ejecutado</span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/60 dark:border-amber-900/40">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400 font-mono">
                {formatCLP(totalGlobalSpent)}
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                <span>{globalBurnRate.toFixed(1)}% consumido</span>
                <span className="text-[10px]">Facturas + Gastos</span>
              </div>
            </div>
          </div>

          {/* Card 4: Remaining Margin */}
          <div className="bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">Saldo Disponible</span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${totalGlobalRemaining >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/40' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200/60 dark:border-rose-900/40'}`}>
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className={`text-xl font-bold font-mono ${totalGlobalRemaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {formatCLP(totalGlobalRemaining)}
              </div>
              <p className={`text-[11px] font-medium mt-1 ${totalGlobalRemaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {totalGlobalRemaining >= 0 ? '✓ Margen positivo de obra' : '⚠ Sobregiro en ejecución'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* OPERATIONS TOOLBAR: SEARCH, FILTERS & VIEW MODE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-950 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre de obra, dirección o cliente..."
            className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition-all"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl shrink-0 border border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === 'all' 
                ? 'bg-white dark:bg-black text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 shadow-xs' 
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Todas ({projects.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === 'active' 
                ? 'bg-white dark:bg-black text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 shadow-xs' 
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            En Marcha ({activeProjects.length})
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === 'completed' 
                ? 'bg-white dark:bg-black text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 shadow-xs' 
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Finalizadas ({completedProjects.length})
          </button>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-800 pl-2 shrink-0">
          <button
            onClick={() => setViewMode('grid')}
            title="Vista de Tarjetas"
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              viewMode === 'grid' 
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black' 
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            title="Vista de Matriz / Tabla Ejecutiva"
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              viewMode === 'table' 
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black' 
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
          >
            <TableIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: GRID CARDS */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => {
            const spent = (project.totalNetInvoices || 0) + (project.totalExpenses || 0);
            const remaining = project.budget - spent;
            const percent = project.budget > 0 ? Math.min((spent / project.budget) * 100, 100) : 0;
            const isNearOverbudget = percent >= 85;

            return (
              <div 
                key={project.id}
                onClick={() => onSelectProject(project)}
                className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="w-9 h-9 bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 rounded-xl flex items-center justify-center group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-colors shrink-0 border border-zinc-200 dark:border-zinc-800">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                        project.status === 'completed' 
                          ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800' 
                          : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60'
                      }`}>
                        {project.status === 'completed' ? 'Finalizado' : 'En Marcha'}
                      </span>
                      <button
                        type="button"
                        title="Eliminar proyecto"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProjectToDelete(project);
                        }}
                        className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title and Address */}
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                    {project.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-xs mb-4 line-clamp-1">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                    <span>{project.address || 'Sin dirección registrada'}</span>
                  </div>

                  {/* Progress & Financial mini-breakdown */}
                  <div className="space-y-2.5 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 mb-4">
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                        {project.hasIva ? "Presupuesto Bruto OC" : "Presupuesto Neto OC"}
                      </span>
                      <span className="font-bold text-zinc-900 dark:text-white font-mono">
                        {formatCLP(project.hasIva ? (project.totalBudgetBruto || Math.round(project.budget * 1.19)) : project.budget)}
                      </span>
                    </div>

                    <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          isNearOverbudget ? 'bg-rose-500' : 'bg-zinc-900 dark:bg-white'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-zinc-500 dark:text-zinc-400">
                        Gastado: <strong className="text-zinc-800 dark:text-zinc-200 font-mono">{formatCLP(spent)}</strong>
                      </span>
                      <span className={`font-bold ${isNearOverbudget ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-900 dark:text-white'}`}>
                        {Math.round(percent)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <div className="text-zinc-500 dark:text-zinc-400">
                    Saldo: <span className={`font-bold font-mono ${remaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{formatCLP(remaining)}</span>
                  </div>
                  <div className="inline-flex items-center gap-1 font-semibold text-zinc-900 dark:text-white group-hover:translate-x-0.5 transition-transform">
                    <span>Ficha de Obra</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}

          {filteredProjects.length === 0 && (
            <div className="col-span-full py-12 text-center bg-white dark:bg-zinc-950 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
              <Briefcase className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
              <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">No se encontraron obras</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Ajusta los filtros de búsqueda o registra un nuevo proyecto.</p>
              <button
                onClick={() => setShowNewModal(true)}
                className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold rounded-xl text-xs inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Crear Proyecto
              </button>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: EXECUTIVE TABLE */}
      {viewMode === 'table' && (
        <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-semibold border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-5 py-3.5">Obra / Proyecto</th>
                  <th className="px-4 py-3.5">Ubicación</th>
                  <th className="px-4 py-3.5">Estado</th>
                  <th className="px-4 py-3.5 text-right">Presupuesto OC</th>
                  <th className="px-4 py-3.5 text-right">Facturado DTE</th>
                  <th className="px-4 py-3.5 text-right">Otros Gastos</th>
                  <th className="px-4 py-3.5 text-right">Saldo Disponible</th>
                  <th className="px-4 py-3.5 text-center">% Avance</th>
                  <th className="px-4 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {filteredProjects.map((project) => {
                  const spent = (project.totalNetInvoices || 0) + (project.totalExpenses || 0);
                  const remaining = project.budget - spent;
                  const percent = project.budget > 0 ? (spent / project.budget) * 100 : 0;

                  return (
                    <tr 
                      key={project.id}
                      onClick={() => onSelectProject(project)}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-4 font-semibold text-zinc-900 dark:text-white group-hover:text-blue-600 transition-colors">
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-zinc-600 dark:text-zinc-400 shrink-0" />
                          <span className="font-semibold">{project.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-zinc-500 dark:text-zinc-400 max-w-[200px] truncate">
                        {project.address || '—'}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          project.status === 'completed' 
                            ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400' 
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                        }`}>
                          {project.status === 'completed' ? 'Finalizado' : 'En Marcha'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-bold text-zinc-900 dark:text-white">
                        {project.hasIva ? (
                          <div className="flex flex-col items-end">
                            <span>{formatCLP(project.totalBudgetBruto || Math.round(project.budget * 1.19))}</span>
                            <span className="text-[9px] text-zinc-500 font-normal">Bruto (+19% IVA)</span>
                          </div>
                        ) : (
                          <span>{formatCLP(project.budget)}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-zinc-600 dark:text-zinc-300">
                        {formatCLP(project.totalNetInvoices || 0)}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-zinc-600 dark:text-zinc-300">
                        {formatCLP(project.totalExpenses || 0)}
                      </td>
                      <td className={`px-4 py-4 text-right font-mono font-bold ${remaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {formatCLP(remaining)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          percent > 90 ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400' :
                          percent > 70 ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400' :
                          'bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200'
                        }`}>
                          {Math.round(percent)}%
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onSelectProject(project)}
                            className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-black text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-zinc-200 dark:border-zinc-800"
                          >
                            Abrir
                          </button>
                          <button
                            type="button"
                            title="Eliminar proyecto"
                            onClick={() => setProjectToDelete(project)}
                            className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredProjects.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-zinc-400 dark:text-zinc-500 text-xs">
                      No hay proyectos que coincidan con la búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISUAL DASHBOARD: PROFIT VS ESTIMATED COSTS TRENDS (RECHARTS) */}
      {projects.length > 0 && (
        <ProfitCostTrendChart projects={projects} userId={user.uid} />
      )}

      {/* FINANCIAL HEALTH COMPARISON CHART */}
      {projects.length > 0 && (
        <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Comparativa de Presupuesto vs Ejecución Real
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Balance consolidado por cada obra en cartera</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-600"></span> Presupuesto OC</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span> Facturado DTE</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span> Otros Gastos</span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 11 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: '1px solid rgba(148, 163, 184, 0.2)', 
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff',
                    color: document.documentElement.classList.contains('dark') ? '#ffffff' : '#0f172a',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString('es-CL')}`, '']}
                />
                <Bar dataKey="Presupuesto" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={28} />
                <Bar dataKey="Facturado" fill="#10b981" radius={[4, 4, 0, 0]} barSize={28} />
                <Bar dataKey="Gastos" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
        </div>
      )}

      {/* IVA CENTRAL TABS CONTENT */}
      {dashboardTab === 'iva' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* TOP IVA OVERVIEW CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: Total IVA Débito */}
            <div className="bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Total IVA Débito (OC/Ventas)</span>
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-900/40">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400 font-mono">
                  {formatCLP(projects.reduce((sum, p) => sum + (p.hasIva ? (p.ivaAmount || Math.round((p.budget || 0) * 0.19)) : 0), 0))}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                  Generado por contratos afectos a IVA
                </p>
              </div>
            </div>

            {/* Card 2: Total IVA Crédito */}
            <div className="bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">Total IVA Crédito (Compras)</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-900/40">
                  <Receipt className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {formatCLP(projects.reduce((sum, p) => sum + (p.totalIvaInvoices || 0), 0))}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                  Crédito acumulado por facturas DTE
                </p>
              </div>
            </div>

            {/* Card 3: Estado de Pago F29 */}
            {(() => {
              const debito = projects.reduce((sum, p) => sum + (p.hasIva ? (p.ivaAmount || Math.round((p.budget || 0) * 0.19)) : 0), 0);
              const credito = projects.reduce((sum, p) => sum + (p.totalIvaInvoices || 0), 0);
              const balance = debito - credito;
              const hasRemanente = balance < 0;

              return (
                <div className="bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between sm:col-span-2">
                  <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Balanza de IVA Estimada (Formulario 29)</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      hasRemanente 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' 
                        : 'bg-amber-50 text-amber-700 border-amber-200/60'
                    }`}>
                      {hasRemanente ? 'Remanente A Favor' : 'Diferencia a Pagar'}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-1">
                    <div>
                      <div className={`text-2xl font-black font-mono ${hasRemanente ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {formatCLP(Math.abs(balance))}
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-sm mt-0.5">
                        {hasRemanente 
                          ? 'Excelente. Tienes crédito fiscal de IVA acumulado disponible para compensar futuros períodos.' 
                          : 'Estimación de IVA Neto a declarar en el próximo ciclo F29 ante el SII.'
                        }
                      </p>
                    </div>

                    <div className="text-right flex flex-col justify-end text-xs font-semibold text-zinc-600 dark:text-zinc-400 w-full sm:w-auto">
                      <div className="flex justify-between gap-4">
                        <span>Débito Fiscal total:</span>
                        <span className="font-mono">{formatCLP(debito)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span>Crédito Fiscal total:</span>
                        <span className="font-mono text-emerald-600">-{formatCLP(credito)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* DETAILED GENERAL TABLE FOR ALL WORKS */}
          <div className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-tight">
                Matriz de IVA Consolidada por Obra
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Resumen tributario global para cada una de las obras registradas.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Nombre de la Obra</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Presupuesto Neto (OC)</th>
                    <th className="py-3 px-4 text-center">Aplica IVA</th>
                    <th className="py-3 px-4 text-right">IVA Débito (OC)</th>
                    <th className="py-3 px-4 text-right">Neto Compras</th>
                    <th className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">IVA Crédito (Compras)</th>
                    <th className="py-3 px-4 text-right font-bold text-zinc-900 dark:text-white">Balance IVA Neto</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                  {projects.map((p) => {
                    const budgetNet = p.budget || 0;
                    const debitoVal = p.hasIva ? (p.ivaAmount || Math.round(budgetNet * 0.19)) : 0;
                    const creditoVal = p.totalIvaInvoices || 0;
                    const balanceVal = debitoVal - creditoVal;
                    const purchasesNet = p.totalNetInvoices || 0;

                    return (
                      <tr 
                        key={p.id}
                        className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors font-medium text-zinc-800 dark:text-zinc-200"
                      >
                        <td className="py-3 px-4">
                          <div className="font-bold text-zinc-900 dark:text-white">{p.name}</div>
                          <div className="text-[10px] text-zinc-400">{p.address}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            p.status === 'completed' 
                              ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-400' 
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                          }`}>
                            {p.status === 'completed' ? 'Finalizada' : 'En Marcha'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold">
                          {formatCLP(budgetNet)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {p.hasIva ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Sí (19%)</span>
                          ) : (
                            <span className="text-zinc-400">Exento</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                          {formatCLP(debitoVal)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {formatCLP(purchasesNet)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                          {formatCLP(creditoVal)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black">
                          {balanceVal === 0 ? (
                            <span className="text-zinc-400">$0</span>
                          ) : balanceVal < 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400" title="Saldo a Favor (Crédito Fiscal)">
                              -{formatCLP(Math.abs(balanceVal))}
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400" title="Saldo a Pagar (Débito Fiscal)">
                              {formatCLP(balanceVal)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => onSelectProject(p)}
                            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 rounded-lg transition-all"
                            title="Ingresar a la Ficha de la Obra"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {projects.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-zinc-400 font-medium">
                        No hay obras registradas en el sistema.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* EXPLANATORY TRIBUTARY NOTE */}
          <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-start gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider mb-1">
                ¿Cómo funciona el cálculo consolidado de IVA para la F29?
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                El <strong>IVA Débito Fiscal</strong> representa el impuesto derivado de tus contratos de obra afectos a IVA (19% de la Orden de Compra/Presupuesto). 
                El <strong>IVA Crédito Fiscal</strong> es el impuesto acumulado por facturas DTE de proveedores cargadas en tus obras o ingresadas de forma general. 
                Este panel central consolida todas tus obras vigentes para entregarte un balance instantáneo del IVA por compensar o pagar en el mes corriente, ayudándote a planificar el pago del Formulario 29 antes del vencimiento mensual.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CREATE PROJECT MODAL */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Nueva Obra o Proyecto</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Registra los datos iniciales y el valor de Orden de Compra.</p>
              </div>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Nombre de la Obra / Mandante
                </label>
                <input 
                  type="text" 
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all text-sm dark:text-white"
                  value={newProject.name}
                  onChange={e => setNewProject({...newProject, name: e.target.value})}
                  placeholder="Ej: Licitación Pintura DOM Nogales"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Dirección o Emplazamiento
                </label>
                <input 
                  type="text" 
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all text-sm dark:text-white"
                  value={newProject.address}
                  onChange={e => setNewProject({...newProject, address: e.target.value})}
                  placeholder="Ej: Calle Principal #120, Nogales, Valparaíso"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Descripción Técnica o Glosa
                </label>
                <textarea 
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all text-sm dark:text-white"
                  value={newProject.description}
                  onChange={e => setNewProject({...newProject, description: e.target.value})}
                  placeholder="Detalles de partidas, especificaciones técnicas y plazos..."
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Monto Orden de Compra (Neto en CLP)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                  <input 
                    type="number" 
                    required
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all font-mono font-bold text-sm dark:text-white"
                    value={newProject.budget}
                    onChange={e => setNewProject({...newProject, budget: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 rounded-xl space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 transition-colors cursor-pointer"
                    checked={newProject.hasIva}
                    onChange={e => setNewProject({...newProject, hasIva: e.target.checked})}
                  />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Aplicar IVA (19%) sobre el presupuesto
                  </span>
                </label>

                {newProject.hasIva && (
                  <div className="text-[11px] space-y-1 pt-1.5 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between text-slate-500">
                      <span>Monto Neto:</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">${(newProject.budget || 0).toLocaleString('es-CL')}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>IVA Crédito Fiscal (19%):</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">${Math.round((newProject.budget || 0) * 0.19).toLocaleString('es-CL')}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200 text-xs border-t border-dotted border-slate-200 dark:border-slate-700 pt-1">
                      <span>Total Presupuesto Bruto:</span>
                      <span className="font-mono text-blue-600 dark:text-blue-400 font-black">${Math.round((newProject.budget || 0) * 1.19).toLocaleString('es-CL')}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm text-sm"
                >
                  Crear Obra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE PROJECT MODAL */}
      {projectToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-red-100 dark:border-red-900/30">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              ¿Eliminar Obra "{projectToDelete.name}"?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              Esta acción eliminará de forma permanente la obra junto con todas sus facturas DTE, gastos de faena, cotizaciones y notas asociadas.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setProjectToDelete(null)}
                className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteProject}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm transition-colors text-sm"
              >
                {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL SUMMARY PDF EXPORT MODAL */}
      <GlobalSummaryModal
        isOpen={showGlobalSummaryModal}
        onClose={() => setShowGlobalSummaryModal(false)}
        user={user}
        projects={projects}
      />
    </div>
  );
}
