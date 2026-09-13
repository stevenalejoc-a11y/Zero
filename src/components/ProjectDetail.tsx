import React, { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot, updateDoc, doc, getDoc, deleteDoc, getDocs } from '../lib/firebase';
import { Project, Invoice, Expense, Note, InventoryItem } from '../types';
import { 
  ArrowLeft, Plus, Receipt, DollarSign, PieChart, 
  ChevronRight, AlertCircle, FileText, Download,
  TrendingUp, Trash2, Building2, TriangleAlert, Package, ShoppingCart, X,
  Briefcase, Info, Factory, Printer, AlertTriangle, Sparkles, CheckCircle2,
  Calendar, Layers, MapPin, Clock, Edit, Check
} from 'lucide-react';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import InvoiceForm from './InvoiceForm';
import ExpenseForm from './ExpenseForm';
import ProjectNotes from './ProjectNotes';
import InventoryManager from './InventoryManager';
import PDFExportModal, { ReportType } from './PDFExportModal';
import { analyzeProjectBudget } from '../lib/gemini';
import { formatCLP } from '../lib/pdfExport';

interface ProjectDetailProps {
  project: Project;
  onBack: () => void;
}

export default function ProjectDetail({ project, onBack }: ProjectDetailProps) {
  const [currentProject, setCurrentProject] = useState<Project>(project);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'expenses' | 'notes' | 'inventory'>('overview');

  // Edit Project State
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [editProjectForm, setEditProjectForm] = useState({
    name: '',
    address: '',
    description: '',
    budget: 0,
    hasIva: false,
    totalNetInvoices: 0,
    totalIvaInvoices: 0,
    totalExpenses: 0
  });

  const handleOpenEditProject = () => {
    setEditProjectForm({
      name: currentProject.name || '',
      address: currentProject.address || '',
      description: currentProject.description || '',
      budget: currentProject.budget || 0,
      hasIva: !!currentProject.hasIva,
      totalNetInvoices: currentProject.totalNetInvoices || 0,
      totalIvaInvoices: currentProject.totalIvaInvoices || 0,
      totalExpenses: currentProject.totalExpenses || 0
    });
    setShowEditProjectModal(true);
  };
  
  // Deletion modals state
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // PDF Export Modal State
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [pdfReportType, setPdfReportType] = useState<ReportType>('general');
  const [pdfQuotationId, setPdfQuotationId] = useState<string | null>(null);
  const [pdfInvoiceId, setPdfInvoiceId] = useState<string | null>(null);
  const [pdfExpenseId, setPdfExpenseId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentProject(project);
  }, [project]);

  useEffect(() => {
    if (!project.id) return;
    
    const unsubProject = onSnapshot(doc(db, 'projects', project.id), (docSnap) => {
      if (docSnap.exists()) {
        setCurrentProject({ id: docSnap.id, ...docSnap.data() } as Project);
      }
    });

    const qInvoices = query(collection(db, 'invoices'), where('projectId', '==', project.id));
    const unsubInvoices = onSnapshot(qInvoices, (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Invoice[]);
    });

    const qExpenses = query(collection(db, 'expenses'), where('projectId', '==', project.id));
    const unsubExpenses = onSnapshot(qExpenses, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Expense[]);
    });

    const qNotes = query(collection(db, 'notes'), where('projectId', '==', project.id));
    const unsubNotes = onSnapshot(qNotes, (snapshot) => {
      setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Note[]);
    });

    const qInventory = query(collection(db, 'inventory'), where('projectId', '==', project.id));
    const unsubInventory = onSnapshot(qInventory, (snapshot) => {
      setInventoryItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InventoryItem[]);
    });

    return () => {
      unsubProject();
      unsubInvoices();
      unsubExpenses();
      unsubNotes();
      unsubInventory();
    };
  }, [project.id]);

  const totalInvoicedGross = invoices.length > 0 
    ? invoices.reduce((sum, inv) => sum + (inv.totalAmount || (inv.netAmount + (inv.iva || 0))), 0) 
    : ((currentProject.totalNetInvoices || 0) + (currentProject.totalIvaInvoices || 0));

  const totalInvoicedIva = invoices.length > 0 
    ? invoices.reduce((sum, inv) => sum + (inv.iva || 0), 0) 
    : (currentProject.totalIvaInvoices || 0);

  const totalInvoicedNet = invoices.length > 0 
    ? invoices.reduce((sum, inv) => sum + (inv.netAmount || Math.max(0, (inv.totalAmount || 0) - (inv.iva || 0))), 0) 
    : (currentProject.totalNetInvoices || 0);

  const totalOtherExpenses = expenses.length > 0 
    ? expenses.reduce((sum, exp) => sum + exp.amount, 0) 
    : (currentProject.totalExpenses || 0);

  const totalSpent = totalInvoicedNet + totalOtherExpenses;
  const remainingBudget = currentProject.budget - totalSpent;
  const burnPercent = currentProject.budget > 0 ? (totalSpent / currentProject.budget) * 100 : 0;
  const marginPercent = currentProject.budget > 0 ? ((currentProject.budget - totalSpent) / currentProject.budget) * 100 : 0;

  useEffect(() => {
    if (currentProject.id && invoices.length > 0 && (currentProject.totalNetInvoices !== totalInvoicedNet || currentProject.totalExpenses !== totalOtherExpenses)) {
      updateDoc(doc(db, 'projects', currentProject.id), {
        totalNetInvoices: totalInvoicedNet,
        totalIvaInvoices: totalInvoicedIva,
        totalExpenses: totalOtherExpenses
      });
    }
  }, [totalInvoicedNet, totalOtherExpenses, currentProject.id, totalInvoicedIva, currentProject.totalNetInvoices, currentProject.totalExpenses, invoices.length]);

  const monthlyIvaData = React.useMemo(() => {
    const groups: { [key: string]: { net: number; iva: number; count: number } } = {};
    invoices.forEach(inv => {
      if (!inv.date) return;
      const dateParts = inv.date.split('-');
      if (dateParts.length < 2) return;
      const monthKey = `${dateParts[0]}-${dateParts[1]}`; // e.g. "2026-09"
      if (!groups[monthKey]) {
        groups[monthKey] = { net: 0, iva: 0, count: 0 };
      }
      groups[monthKey].net += inv.netAmount;
      groups[monthKey].iva += inv.iva;
      groups[monthKey].count += 1;
    });

    return Object.entries(groups).map(([month, data]) => {
      const [year, m] = month.split('-');
      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ];
      const monthIndex = parseInt(m) - 1;
      const label = `${monthNames[monthIndex] || 'Mes'} ${year}`;
      return {
        monthKey: month,
        label,
        net: data.net,
        iva: data.iva,
        count: data.count
      };
    }).sort((a, b) => b.monthKey.localeCompare(a.monthKey)); // newest first
  }, [invoices]);

  const chartData = [
    { name: 'Facturado Neto', value: totalInvoicedNet, color: '#2563eb' },
    { name: 'Gastos de Faena', value: totalOtherExpenses, color: '#f59e0b' },
    { name: 'Saldo Disponible', value: Math.max(0, remainingBudget), color: '#10b981' },
  ].filter(d => d.value > 0);

  const handleAIAnalysis = async () => {
    setIsAnalyzing(true);
    const analysis = await analyzeProjectBudget({
      projectName: currentProject.name,
      budget: currentProject.budget,
      spent: totalSpent,
      invoices: invoices.length,
      expenses: expenses.length,
      categories: {
        labor: expenses.filter(e => e.category === 'labor').reduce((s, e) => s + e.amount, 0),
        fuel: expenses.filter(e => e.category === 'fuel').reduce((s, e) => s + e.amount, 0),
        tools: expenses.filter(e => e.category === 'tools').reduce((s, e) => s + e.amount, 0),
      }
    });
    setAiAnalysis(analysis);
    setIsAnalyzing(false);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject.id) return;

    setIsSavingProject(true);
    try {
      const budgetValue = Number(editProjectForm.budget) || 0;
      const hasIva = !!editProjectForm.hasIva;
      const ivaAmount = hasIva ? Math.round(budgetValue * 0.19) : 0;
      const totalBudgetBruto = budgetValue + ivaAmount;

      const updatedFields = {
        name: editProjectForm.name.trim(),
        address: editProjectForm.address.trim(),
        description: editProjectForm.description.trim(),
        budget: budgetValue,
        hasIva,
        ivaAmount,
        totalBudgetBruto,
        totalNetInvoices: Number(editProjectForm.totalNetInvoices) || 0,
        totalIvaInvoices: Number(editProjectForm.totalIvaInvoices) || 0,
        totalExpenses: Number(editProjectForm.totalExpenses) || 0
      };

      await updateDoc(doc(db, 'projects', currentProject.id), updatedFields);
      
      setCurrentProject(prev => ({
        ...prev,
        ...updatedFields
      }));

      setShowEditProjectModal(false);
    } catch (error) {
      console.error("Error saving project:", error);
      alert("Error al actualizar la obra.");
    } finally {
      setIsSavingProject(false);
    }
  };

  const openExportModal = (
    type: ReportType = 'general', 
    quoteId: string | null = null, 
    invoiceId: string | null = null,
    expenseId: string | null = null
  ) => {
    setPdfReportType(type);
    setPdfQuotationId(quoteId);
    setPdfInvoiceId(invoiceId);
    setPdfExpenseId(expenseId);
    setShowPDFModal(true);
  };

  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete?.id) return;
    try {
      await deleteDoc(doc(db, 'invoices', invoiceToDelete.id));
      setInvoiceToDelete(null);
    } catch (error) {
      console.error("Error deleting invoice:", error);
      alert("Error al eliminar la factura.");
    }
  };

  const handleDeleteExpense = async () => {
    if (!expenseToDelete?.id) return;
    try {
      await deleteDoc(doc(db, 'expenses', expenseToDelete.id));
      setExpenseToDelete(null);
    } catch (error) {
      console.error("Error deleting expense:", error);
      alert("Error al eliminar el gasto.");
    }
  };

  const handleDeleteEntireProject = async () => {
    if (!project?.id) return;
    setIsDeleting(true);
    try {
      // Invoices
      const invQuery = query(collection(db, 'invoices'), where('projectId', '==', project.id));
      const invSnap = await getDocs(invQuery);
      for (const d of invSnap.docs) await deleteDoc(d.ref);

      // Expenses
      const expQuery = query(collection(db, 'expenses'), where('projectId', '==', project.id));
      const expSnap = await getDocs(expQuery);
      for (const d of expSnap.docs) await deleteDoc(d.ref);

      // Quotations
      const quotQuery = query(collection(db, 'quotations'), where('projectId', '==', project.id));
      const quotSnap = await getDocs(quotQuery);
      for (const d of quotSnap.docs) await deleteDoc(d.ref);

      // Notes
      const notesQuery = query(collection(db, 'notes'), where('projectId', '==', project.id));
      const notesSnap = await getDocs(notesQuery);
      for (const d of notesSnap.docs) await deleteDoc(d.ref);

      // Project doc
      await deleteDoc(doc(db, 'projects', project.id));
      onBack();
    } catch (error) {
      console.error("Error deleting project:", error);
      alert("Error al eliminar el proyecto.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleProjectStatus = async () => {
    if (!currentProject.id) return;
    const newStatus = currentProject.status === 'completed' ? 'active' : 'completed';
    try {
      await updateDoc(doc(db, 'projects', currentProject.id), {
        status: newStatus
      });
    } catch (error) {
      console.error("Error updating project status:", error);
      alert("Hubo un error al cambiar el estado de la obra.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ARCHITECTURAL HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-start gap-3.5">
          <button 
            onClick={onBack}
            className="p-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-all shadow-xs cursor-pointer shrink-0 mt-0.5"
            title="Volver al panel principal"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Ficha Técnica de Obra
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                currentProject.status === 'completed' 
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' 
                  : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40'
              }`}>
                {currentProject.status === 'completed' ? 'Finalizada' : 'En Ejecución'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
              {currentProject.name}
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{currentProject.address || 'Sin dirección registrada'}</span>
            </div>
          </div>
        </div>
        
        {/* ACTION TOOLBAR */}
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={handleToggleProjectStatus}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all text-xs font-bold shadow-xs cursor-pointer border ${
              currentProject.status === 'completed'
                ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:hover:bg-amber-900/30 dark:border-amber-900/50 dark:text-amber-400'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'
            }`}
          >
            {currentProject.status === 'completed' ? (
              <>
                <Clock className="w-4 h-4" />
                <span>Reabrir Obra</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Finalizar Obra</span>
              </>
            )}
          </button>

          <button 
            onClick={handleOpenEditProject}
            className="px-3.5 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl flex items-center gap-2 transition-all text-xs font-bold shadow-xs cursor-pointer"
          >
            <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Editar Obra</span>
          </button>

          <button 
            onClick={() => openExportModal(activeTab === 'invoices' ? 'invoices' : activeTab === 'expenses' ? 'expenses' : 'general')}
            className="px-3.5 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl flex items-center gap-2 transition-all text-xs font-bold shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Exportar PDF</span>
          </button>

          {activeTab === 'invoices' && (
            <button 
              onClick={() => setShowInvoiceForm(true)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2 transition-all text-xs font-bold shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar DTE</span>
            </button>
          )}

          {activeTab === 'expenses' && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => openExportModal('expenses')}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl flex items-center gap-2 transition-all text-xs font-bold shadow-xs cursor-pointer border border-slate-700 dark:border-slate-700"
              >
                <Download className="w-4 h-4 text-amber-400" />
                <span>Informe Gastos PDF</span>
              </button>
              <button 
                onClick={() => setShowExpenseForm(true)}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl flex items-center gap-2 transition-all text-xs font-bold shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Rendir Gasto</span>
              </button>
            </div>
          )}

          <button
            onClick={() => setShowDeleteProjectModal(true)}
            title="Eliminar esta obra"
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200/60 dark:border-slate-800/60">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'overview' 
              ? 'bg-blue-600 text-white shadow-xs' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Resumen Ejecutivo</span>
        </button>

        <button 
          onClick={() => setActiveTab('invoices')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'invoices' 
              ? 'bg-blue-600 text-white shadow-xs' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Facturas DTE</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
            activeTab === 'invoices' ? 'bg-blue-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}>
            {invoices.length}
          </span>
        </button>

        <button 
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'expenses' 
              ? 'bg-blue-600 text-white shadow-xs' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Gastos de Faena</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
            activeTab === 'expenses' ? 'bg-blue-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}>
            {expenses.length}
          </span>
        </button>

        <button 
          onClick={() => setActiveTab('notes')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'notes' 
              ? 'bg-blue-600 text-white shadow-xs' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Bitácora de Terreno</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
            activeTab === 'notes' ? 'bg-blue-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}>
            {notes.length}
          </span>
        </button>

        <button 
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'inventory' 
              ? 'bg-blue-600 text-white shadow-xs' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Inventario de Bodega</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
            activeTab === 'inventory' ? 'bg-blue-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}>
            {inventoryItems.length}
          </span>
        </button>
      </div>

      {/* TAB CONTENT: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 4 BENTO FINANCIAL CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Card 1: Presupuesto OC */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  {currentProject.hasIva ? "Presupuesto OC (Bruto)" : "Presupuesto OC Neto"}
                </span>
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div>
                {currentProject.hasIva ? (
                  <div className="space-y-1.5">
                    <p className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                      {formatCLP(currentProject.totalBudgetBruto || 0)}
                    </p>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400">
                      <span>Neto: {formatCLP(currentProject.budget)}</span>
                      <span>IVA: {formatCLP(currentProject.ivaAmount || 0)}</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">{formatCLP(currentProject.budget)}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Monto contratado de obra</p>
                  </>
                )}
              </div>
            </div>

            {/* Card 2: Total Facturado DTE */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Facturado (DTE Neto)</span>
                <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">{formatCLP(totalInvoicedNet)}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{invoices.length} facturas vinculadas</p>
              </div>
            </div>

            {/* Card 3: Total Otros Gastos */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Gastos de Faena</span>
                <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">{formatCLP(totalOtherExpenses)}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{expenses.length} rendiciones registradas</p>
              </div>
            </div>

            {/* Card 4: Margen y Saldo */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Saldo Disponible</span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${remainingBudget >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'}`}>
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className={`text-2xl font-black font-mono ${remainingBudget >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {formatCLP(remainingBudget)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Margen: <strong className={remainingBudget >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{marginPercent.toFixed(1)}%</strong> ({burnPercent.toFixed(1)}% gastado)
                </p>
              </div>
            </div>
          </div>

          {/* SPLIT: CHART & AI ASSISTANT */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Expense Breakdown Pie */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Estructura de Costos de la Obra</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Distribución porcentual entre compras formales DTE, gastos de campo y saldo</p>
                </div>
              </div>

              <div className="h-64 w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
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
                      <Legend />
                    </RePieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                    Sin datos registrados todavía.
                  </div>
                )}
              </div>
            </div>

            {/* AI Financial Auditor / Gemini Insights */}
            <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Auditor Presupuestario IA</span>
                  </h3>
                  <button 
                    onClick={handleAIAnalysis}
                    disabled={isAnalyzing}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 cursor-pointer"
                  >
                    {isAnalyzing ? 'Auditando...' : 'Generar'}
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Diagnóstico en tiempo real sobre riesgos de sobregiro y optimización de partidas.
                </p>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed overflow-y-auto max-h-[200px]">
                  {aiAnalysis ? (
                    <div className="whitespace-pre-wrap">{aiAnalysis}</div>
                  ) : (
                    <div className="text-center py-6 text-slate-400">
                      <Sparkles className="w-6 h-6 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                      <p>Haz clic en "Generar" para auditar el presupuesto con Gemini.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                <span>Algoritmo: Gemini Pro</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">✓ En línea</span>
              </div>
            </div>
          </div>

          {/* SECCIÓN: CONTROL DE IVA GENERAL MENSUAL POR PROYECTO */}
          <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span>IVA General Mensual & Crédito Fiscal</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Control de IVA Crédito Fiscal de facturas cargadas versus IVA Débito estimado mensual</p>
              </div>
              <div className="px-3 py-1 bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-semibold self-start sm:self-center font-mono">
                Total IVA Acumulado: {formatCLP(totalInvoicedIva)}
              </div>
            </div>

            {monthlyIvaData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <th className="px-4 py-3">Período Mensual</th>
                      <th className="px-4 py-3 text-center">Facturas DTE</th>
                      <th className="px-4 py-3 text-right">Monto Neto Mensual</th>
                      <th className="px-4 py-3 text-right text-blue-600 dark:text-blue-400">IVA Crédito (19%)</th>
                      {currentProject.hasIva && (
                        <th className="px-4 py-3 text-right text-indigo-600 dark:text-indigo-400">IVA Débito Proporcional OC</th>
                      )}
                      <th className="px-4 py-3 text-right font-bold">Estado F29</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {monthlyIvaData.map((row) => {
                      const proportionalDebit = currentProject.hasIva 
                        ? Math.round(row.net * 0.19) 
                        : 0;
                      
                      return (
                        <tr key={row.monthKey} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            {row.label}
                          </td>
                          <td className="px-4 py-3.5 text-center font-mono text-slate-600 dark:text-slate-400 font-semibold">
                            {row.count} {row.count === 1 ? 'doc' : 'docs'}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono">
                            {formatCLP(row.net)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                            +{formatCLP(row.iva)}
                          </td>
                          {currentProject.hasIva && (
                            <td className="px-4 py-3.5 text-right font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                              {formatCLP(proportionalDebit)}
                            </td>
                          )}
                          <td className="px-4 py-3.5 text-right">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                              Crédito Disponible
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 italic text-xs">
                No hay facturas registradas en este proyecto para calcular el IVA mensual. Ingresa facturas de proveedores para ver los saldos mensuales de IVA Crédito Fiscal.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: INVOICES (FACTURAS DTE) */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          {/* Summary sub-bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Facturas (Valor Documentos)</span>
              <p className="text-lg font-bold font-mono text-slate-900 dark:text-white">{formatCLP(totalInvoicedGross)}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">IVA Crédito Extraído (-)</span>
              <p className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400">-{formatCLP(totalInvoicedIva)}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Monto Neto Resultante (Total - IVA)</span>
              <p className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">{formatCLP(totalInvoicedNet)}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold border-b border-slate-200/80 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">N° Factura DTE</th>
                    <th className="px-4 py-3.5">RUT / Proveedor</th>
                    <th className="px-4 py-3.5 text-right">Valor Total Factura</th>
                    <th className="px-4 py-3.5 text-right">IVA Extraído (19%)</th>
                    <th className="px-4 py-3.5 text-right">Monto Neto (Total - IVA)</th>
                    <th className="px-4 py-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                        #{inv.invoiceNumber}
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-900 dark:text-white">
                        {inv.provider}
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatCLP(inv.totalAmount)}
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-medium text-amber-600 dark:text-amber-400">
                        -{formatCLP(inv.iva)}
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                        {formatCLP(inv.netAmount)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Descargar comprobante DTE en PDF"
                            onClick={() => openExportModal('single-invoice', null, inv.id)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors cursor-pointer"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title="Eliminar factura"
                            onClick={() => setInvoiceToDelete(inv)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {invoices.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-xs">
                        No hay facturas registradas en esta obra. Haz clic en "Registrar DTE" para añadir una.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: EXPENSES (GASTOS DE FAENA) */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold border-b border-slate-200/80 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Glosa / Descripción</th>
                    <th className="px-4 py-3.5">Categoría Operacional</th>
                    <th className="px-4 py-3.5 text-right">Monto Rendido</th>
                    <th className="px-4 py-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-4 font-medium text-slate-900 dark:text-white">
                        {exp.description}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          exp.category === 'labor' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                          exp.category === 'fuel' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                          exp.category === 'tools' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' :
                          'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400'
                        }`}>
                          {exp.category === 'labor' ? 'Mano de Obra' :
                           exp.category === 'fuel' ? 'Combustible / Flete' :
                           exp.category === 'tools' ? 'Herramientas / Arriendo' : 'Imprevistos'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatCLP(exp.amount)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Descargar comprobante en PDF"
                            onClick={() => openExportModal('single-expense', null, null, exp.id)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors cursor-pointer"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title="Eliminar gasto"
                            onClick={() => setExpenseToDelete(exp)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {expenses.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-xs">
                        No hay gastos de faena registrados. Haz clic en "Rendir Gasto" para agregar rendiciones.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: BITÁCORA NOTES */}
      {activeTab === 'notes' && (
        <div className="h-[600px]">
          <ProjectNotes projectId={project.id!} />
        </div>
      )}

      {/* TAB CONTENT: INVENTORY BODEGA */}
      {activeTab === 'inventory' && (
        <div className="min-h-[400px]">
          <InventoryManager projectId={currentProject.id!} />
        </div>
      )}

      {/* MODAL FORM: INVOICE */}
      {showInvoiceForm && (
        <InvoiceForm 
          projectId={project.id!} 
          onClose={() => setShowInvoiceForm(false)} 
        />
      )}

      {/* MODAL FORM: EXPENSE */}
      {showExpenseForm && (
        <ExpenseForm 
          projectId={project.id!} 
          onClose={() => setShowExpenseForm(false)} 
        />
      )}

      {/* MODAL: PDF EXPORT */}
      <PDFExportModal
        isOpen={showPDFModal}
        onClose={() => setShowPDFModal(false)}
        project={currentProject}
        invoices={invoices}
        expenses={expenses}
        quotations={[]}
        notes={notes}
        aiAnalysis={aiAnalysis}
        initialReportType={pdfReportType}
        initialQuotationId={pdfQuotationId}
        initialInvoiceId={pdfInvoiceId}
        initialExpenseId={pdfExpenseId}
      />

      {/* MODAL CONFIRM: DELETE INVOICE */}
      {invoiceToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-red-100 dark:border-red-900/30">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              ¿Eliminar Factura #{invoiceToDelete.invoiceNumber}?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              Proveedor: <strong className="text-slate-900 dark:text-white">{invoiceToDelete.provider}</strong><br />
              Total Bruto: <strong className="text-slate-900 dark:text-white font-mono">{formatCLP(invoiceToDelete.totalAmount)}</strong>
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setInvoiceToDelete(null)}
                className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteInvoice}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-sm transition-colors text-xs"
              >
                Eliminar Factura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRM: DELETE EXPENSE */}
      {expenseToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-red-100 dark:border-red-900/30">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              ¿Eliminar Gasto de Faena?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              Glosa: <strong className="text-slate-900 dark:text-white">{expenseToDelete.description}</strong><br />
              Monto: <strong className="text-slate-900 dark:text-white font-mono">{formatCLP(expenseToDelete.amount)}</strong>
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteExpense}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-sm transition-colors text-xs"
              >
                Eliminar Gasto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRM: DELETE PROJECT */}
      {showDeleteProjectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-red-100 dark:border-red-900/30">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              ¿Eliminar Obra "{project.name}"?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              Esta acción eliminará de forma permanente todas las facturas DTE, rendiciones, cotizaciones oficiales y notas de terreno.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteProjectModal(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteEntireProject}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm transition-colors text-xs"
              >
                {isDeleting ? 'Eliminando...' : 'Sí, Eliminar Obra'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT PROJECT */}
      {showEditProjectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Editar Datos de la Obra
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowEditProjectModal(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-4">
              {/* Basic Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Nombre de la Obra
                  </label>
                  <input 
                    type="text"
                    required
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold"
                    value={editProjectForm.name}
                    onChange={e => setEditProjectForm({...editProjectForm, name: e.target.value})}
                    placeholder="Ej. Reparación Techumbre Gimnasio"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Dirección de la Obra
                  </label>
                  <input 
                    type="text"
                    required
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={editProjectForm.address}
                    onChange={e => setEditProjectForm({...editProjectForm, address: e.target.value})}
                    placeholder="Ej. Calle Prat 123, Nogales"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Descripción / Glosa Principal
                  </label>
                  <textarea 
                    rows={2}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all leading-relaxed"
                    value={editProjectForm.description}
                    onChange={e => setEditProjectForm({...editProjectForm, description: e.target.value})}
                    placeholder="Ej. Trabajos de retiro de asbesto y reposición de paneles solares..."
                  />
                </div>
              </div>

              {/* Presupuesto y Opción IVA */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Presupuesto Neto de la Obra (OC)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2 text-slate-400 text-xs font-mono">$</span>
                      <input 
                        type="number"
                        required
                        min="0"
                        className="w-full pl-7 pr-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono font-bold"
                        value={editProjectForm.budget}
                        onChange={e => setEditProjectForm({...editProjectForm, budget: parseInt(e.target.value, 10) || 0})}
                      />
                    </div>
                  </div>

                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 transition-colors cursor-pointer"
                        checked={editProjectForm.hasIva}
                        onChange={e => setEditProjectForm({...editProjectForm, hasIva: e.target.checked})}
                      />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Aplicar IVA (19%) sobre el presupuesto
                      </span>
                    </label>
                  </div>
                </div>

                <div className="text-[11px] space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between text-slate-500">
                    <span>Presupuesto Neto:</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">${(editProjectForm.budget || 0).toLocaleString('es-CL')}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>IVA Crédito Fiscal (19%):</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">${Math.round((editProjectForm.budget || 0) * (editProjectForm.hasIva ? 0.19 : 0)).toLocaleString('es-CL')}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200 text-xs border-t border-dotted border-slate-200 dark:border-slate-700 pt-1.5">
                    <span>Total Presupuesto Bruto:</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400 font-black">${Math.round((editProjectForm.budget || 0) * (editProjectForm.hasIva ? 1.19 : 1)).toLocaleString('es-CL')}</span>
                  </div>
                </div>
              </div>

              {/* General Project-Level Tax & Expense Inputs */}
              <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/80 dark:border-indigo-900/40 rounded-2xl space-y-3">
                <div className="flex items-center gap-1.5 border-b border-indigo-100/50 dark:border-indigo-900/20 pb-2">
                  <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <h4 className="text-xs font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-wide">
                    Saldos y Totales de IVA Generales de la Obra
                  </h4>
                </div>
                
                <p className="text-[10px] text-indigo-700/80 dark:text-indigo-400/80 leading-relaxed">
                  Si prefieres un control rápido por obra sin cargar facturas DTE individuales, puedes digitar directamente los totales consolidados aquí:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-950 dark:text-indigo-200 mb-1">
                      Monto Neto Compras
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-slate-400 text-[11px] font-mono">$</span>
                      <input 
                        type="number"
                        min="0"
                        className="w-full pl-5 pr-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-slate-900 dark:text-white text-xs font-mono font-bold"
                        value={editProjectForm.totalNetInvoices}
                        onChange={e => setEditProjectForm({...editProjectForm, totalNetInvoices: parseInt(e.target.value, 10) || 0})}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-indigo-950 dark:text-indigo-200 mb-1">
                      IVA Crédito Acumulado
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-slate-400 text-[11px] font-mono">$</span>
                      <input 
                        type="number"
                        min="0"
                        className="w-full pl-5 pr-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-slate-900 dark:text-white text-xs font-mono font-bold"
                        value={editProjectForm.totalIvaInvoices}
                        onChange={e => setEditProjectForm({...editProjectForm, totalIvaInvoices: parseInt(e.target.value, 10) || 0})}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-indigo-950 dark:text-indigo-200 mb-1">
                      Rendición Gastos Faena
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-slate-400 text-[11px] font-mono">$</span>
                      <input 
                        type="number"
                        min="0"
                        className="w-full pl-5 pr-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-slate-900 dark:text-white text-xs font-mono font-bold"
                        value={editProjectForm.totalExpenses}
                        onChange={e => setEditProjectForm({...editProjectForm, totalExpenses: parseInt(e.target.value, 10) || 0})}
                      />
                    </div>
                  </div>
                </div>

                {invoices.length > 0 && (
                  <div className="mt-2 text-[10px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/20 p-2 rounded-lg flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      Nota: Al existir {invoices.length} facturas DTE registradas en este proyecto, se usarán los totales dinámicos de esas facturas para los gráficos y listados.
                    </span>
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button 
                  type="button"
                  onClick={() => setShowEditProjectModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSavingProject}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black rounded-xl shadow-md transition-colors text-xs flex items-center justify-center gap-1.5"
                >
                  {isSavingProject ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

