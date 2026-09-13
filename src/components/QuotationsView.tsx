import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { 
  collection, query, onSnapshot, deleteDoc, doc, addDoc 
} from 'firebase/firestore';
import { 
  FileText, Plus, Search, Filter, Download, Trash2, Edit3, 
  Copy, CheckCircle, Clock, Building2, Layers, DollarSign,
  ArrowRight, ShieldCheck, ChevronRight, AlertCircle, Loader2,
  Calendar, RefreshCw
} from 'lucide-react';
import { Quotation, Project } from '../types';
import ChileanQuotationEditorModal from './ChileanQuotationEditorModal';
import { 
  createChileanStandardQuotationReportHTML, 
  generatePDFFromElement, 
  formatCLP 
} from '../lib/pdfExport';
import { 
  getLocalQuotations, 
  saveLocalQuotation, 
  deleteLocalQuotation 
} from '../lib/quotationStorage';

interface QuotationsViewProps {
  onSelectProject?: (project: Project) => void;
}

export default function QuotationsView({ onSelectProject }: QuotationsViewProps) {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'draft'>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');

  // Modals & Actions
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [quotationToEdit, setQuotationToEdit] = useState<Quotation | null>(null);
  const [quotationToDelete, setQuotationToDelete] = useState<Quotation | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfGeneratingId, setPdfGeneratingId] = useState<string | null>(null);
  const [pdfStatusMessage, setPdfStatusMessage] = useState('');

  // 1. Fetch Projects for linking & filtering
  useEffect(() => {
    try {
      const q = query(collection(db, 'projects'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const projs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
        setProjects(projs);
      }, (err) => {
        console.warn('Projects onSnapshot error in QuotationsView:', err);
      });
      return unsubscribe;
    } catch (e) {
      console.warn('Error subscribing to projects:', e);
    }
  }, []);

  // 2. Fetch Quotations (Local Storage + Firestore Real-time)
  useEffect(() => {
    // Initial local read
    const localDocs = getLocalQuotations();
    setQuotations(localDocs);
    setLoading(false);

    try {
      const q = query(collection(db, 'quotations'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const firestoreDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Quotation));

        // Merge keeping local and firestore
        const map = new Map<string, Quotation>();
        localDocs.forEach(d => {
          if (d.id) map.set(d.id, d);
        });
        firestoreDocs.forEach(d => {
          if (d.id) map.set(d.id, d);
        });

        const merged = Array.from(map.values()).sort((a, b) => {
          const dateA = new Date(a.date || 0).getTime();
          const dateB = new Date(b.date || 0).getTime();
          return dateB - dateA;
        });

        setQuotations(merged);
      }, (err) => {
        console.warn('Firestore quotations onSnapshot error:', err);
      });

      return unsubscribe;
    } catch (e) {
      console.warn('Quotations subscription error:', e);
    }
  }, []);

  // Filtered quotations
  const filteredQuotations = quotations.filter((q) => {
    // Text search
    const textMatch = 
      q.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.clientName && q.clientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (q.clientRut && q.clientRut.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (q.projectGlosa && q.projectGlosa.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!textMatch) return false;

    // Status filter
    if (statusFilter !== 'all' && q.status !== statusFilter) {
      return false;
    }

    // Project filter
    if (projectFilter !== 'all') {
      if (projectFilter === 'unassigned') {
        if (q.projectId && q.projectId !== 'general' && q.projectId !== 'unassigned') return false;
      } else {
        if (q.projectId !== projectFilter) return false;
      }
    }

    return true;
  });

  // Calculate high-level financial metrics
  const totalQuotationsCount = quotations.length;
  const approvedQuotations = quotations.filter(q => q.status === 'approved');
  const draftQuotations = quotations.filter(q => q.status === 'draft');

  const totalNetClp = quotations.reduce((sum, q) => sum + (q.totalNet || 0), 0);
  const totalGrossClp = Math.round(totalNetClp * 1.19);
  const totalApprovedGrossClp = Math.round(approvedQuotations.reduce((sum, q) => sum + (q.totalNet || 0), 0) * 1.19);

  // Handlers
  const handleOpenCreateModal = () => {
    setQuotationToEdit(null);
    setIsEditorModalOpen(true);
  };

  const handleOpenEditModal = (quotation: Quotation) => {
    setQuotationToEdit(quotation);
    setIsEditorModalOpen(true);
  };

  const handleDuplicateQuotation = async (q: Quotation) => {
    try {
      const copyData: Quotation = {
        ...q,
        name: `${q.name} (Copia)`,
        date: new Date().toISOString(),
        status: 'draft' as const
      };
      delete (copyData as any).id;

      let newId = `local-${Date.now()}`;
      try {
        const docRef = await addDoc(collection(db, 'quotations'), {
          ...copyData,
          createdAt: new Date().toISOString()
        });
        newId = docRef.id;
      } catch (e) {
        console.warn('Firestore addDoc failed on duplicate, saving locally:', e);
      }

      copyData.id = newId;
      const savedCopy = saveLocalQuotation(q.projectId || 'general', copyData);
      setQuotations(prev => [savedCopy, ...prev.filter(x => x.id !== savedCopy.id)]);
    } catch (err) {
      console.error('Error duplicating quotation:', err);
      alert('Error al duplicar la cotización.');
    }
  };

  const handleDeleteQuotation = async () => {
    if (!quotationToDelete?.id) return;
    const qId = quotationToDelete.id;
    const pId = quotationToDelete.projectId || 'general';

    try {
      if (!qId.startsWith('local-')) {
        try {
          await deleteDoc(doc(db, 'quotations', qId));
        } catch (e) {
          console.warn('Firestore delete failed, deleting locally:', e);
        }
      }
      deleteLocalQuotation(pId, qId);
      setQuotations(prev => prev.filter(q => q.id !== qId));
      setQuotationToDelete(null);
    } catch (error) {
      console.error("Error deleting quotation:", error);
      deleteLocalQuotation(pId, qId);
      setQuotations(prev => prev.filter(q => q.id !== qId));
      setQuotationToDelete(null);
    }
  };

  const handleDownloadPDF = async (quotation: Quotation) => {
    setIsGeneratingPDF(true);
    setPdfGeneratingId(quotation.id || 'current');
    setPdfStatusMessage('Iniciando exportación oficial...');

    try {
      const associatedProject = projects.find(p => p.id === quotation.projectId) || {
        id: quotation.projectId || 'general',
        name: quotation.name,
        address: quotation.clientAddress || 'Región de Valparaíso',
        description: quotation.projectGlosa || 'Cotización de Obras',
        budget: quotation.totalNet || 0,
        totalNetInvoices: 0,
        totalIvaInvoices: 0,
        totalExpenses: 0,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
        ownerId: auth.currentUser?.uid || 'user'
      };

      const htmlElement = createChileanStandardQuotationReportHTML(
        associatedProject,
        quotation
      );

      const fileName = `Cotizacion_${(quotation.clientName || 'Cliente').replace(/\s+/g, '_')}_${quotation.name.replace(/\s+/g, '_')}.pdf`;
      await generatePDFFromElement(htmlElement, fileName, (msg) => {
        setPdfStatusMessage(msg);
      });
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Hubo un problema generando el PDF. Por favor reintenta.');
    } finally {
      setIsGeneratingPDF(false);
      setPdfGeneratingId(null);
      setPdfStatusMessage('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Executive */}
      <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-slate-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-blue-800/40">
        <div className="space-y-2 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full text-xs font-black uppercase tracking-wider">
              Módulo Unitario Oficial • Viña Construcciones SpA
            </span>
            <span className="px-2.5 py-0.5 bg-white/10 text-white/90 rounded-full text-[11px] font-mono">
              RUT 78.447.669-3
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase">
            Cotizaciones y Presupuestos
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Administración centralizada de propuestas técnicas, presupuestos por capítulos para licitaciones DOM y mandantes privados con cálculo automático de IVA y membrete legal.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="px-5 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center gap-2.5 shadow-lg shadow-blue-600/30 hover:scale-[1.02] transition-all cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Nueva Cotización Oficial
        </button>
      </div>

      {/* Financial KPIs (Bento Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Propuestas</span>
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-zinc-900 dark:text-white font-mono">{totalQuotationsCount}</p>
          <p className="text-[11px] text-zinc-500 mt-1">Registradas en el sistema</p>
        </div>

        <div className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Cotizado (Bruto)</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-zinc-900 dark:text-white font-mono">{formatCLP(totalGrossClp)}</p>
          <p className="text-[11px] text-zinc-500 mt-1">Neto: {formatCLP(totalNetClp)} + 19% IVA</p>
        </div>

        <div className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Aprobadas / Obras</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {approvedQuotations.length}
          </p>
          <p className="text-[11px] text-zinc-500 mt-1">{formatCLP(totalApprovedGrossClp)} en ejecución</p>
        </div>

        <div className="bg-white dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">En Negociación</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {draftQuotations.length}
          </p>
          <p className="text-[11px] text-zinc-500 mt-1">Borradores de licitación</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input 
            type="text"
            placeholder="Buscar por cotización, mandante, RUT o glosa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter pills */}
          <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'all' 
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs' 
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Todas ({quotations.length})
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'approved' 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'text-zinc-500 hover:text-emerald-600'
              }`}
            >
              Aprobadas ({approvedQuotations.length})
            </button>
            <button
              onClick={() => setStatusFilter('draft')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'draft' 
                  ? 'bg-amber-600 text-white shadow-xs' 
                  : 'text-zinc-500 hover:text-amber-600'
              }`}
            >
              Borrador ({draftQuotations.length})
            </button>
          </div>

          {/* Project Filter Selector */}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">Todas las Obras</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                Obra: {p.name}
              </option>
            ))}
            <option value="unassigned">Propuestas Generales / Sin obra</option>
          </select>
        </div>
      </div>

      {/* Quotations List */}
      {filteredQuotations.length === 0 ? (
        <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mx-auto text-zinc-400">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">No se encontraron cotizaciones</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'all' || projectFilter !== 'all'
              ? 'Prueba modificando tus filtros o término de búsqueda.'
              : 'Aún no tienes cotizaciones registradas. Crea tu primera propuesta oficial con el botón superior.'}
          </p>
          {(searchQuery || statusFilter !== 'all' || projectFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setProjectFilter('all');
              }}
              className="mt-2 text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
            >
              Limpiar todos los filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredQuotations.map((q) => {
            const netAmount = q.totalNet || 0;
            const ivaAmount = Math.round(netAmount * 0.19);
            const grossAmount = netAmount + ivaAmount;

            const linkedProject = projects.find(p => p.id === q.projectId);
            const totalChapters = q.chapters?.length || (q.items?.length ? 1 : 0);
            const totalItemsCount = q.chapters?.reduce((sum, ch) => sum + (ch.items?.length || 0), 0) || (q.items?.length || 0);

            const isThisPdfGenerating = isGeneratingPDF && pdfGeneratingId === q.id;

            return (
              <div 
                key={q.id}
                className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs hover:border-blue-400/60 transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top card row: Status & Date */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      q.status === 'approved' 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' 
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}>
                      {q.status === 'approved' ? (
                        <>
                          <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          Aprobada
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          Borrador
                        </>
                      )}
                    </span>

                    <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(q.date).toLocaleDateString('es-CL', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>

                  {/* Title & Glosa */}
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white uppercase leading-snug mb-1">
                    {q.name}
                  </h3>

                  {/* Client info */}
                  <div className="space-y-0.5 mb-3">
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="truncate">{q.clientName || 'Cliente Particular'}</span>
                    </p>
                    {q.clientRut && (
                      <p className="text-[11px] font-mono text-zinc-500 pl-5">
                        RUT: {q.clientRut}
                      </p>
                    )}
                  </div>

                  {/* Associated project badge */}
                  <div className="mb-4">
                    {linkedProject ? (
                      <div 
                        onClick={() => onSelectProject?.(linkedProject)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-[11px] font-medium text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer border border-zinc-200 dark:border-zinc-800"
                        title="Ver obra asociada"
                      >
                        <Building2 className="w-3 h-3 text-blue-600" />
                        <span>Obra: <strong>{linkedProject.name}</strong></span>
                        <ChevronRight className="w-3 h-3 text-zinc-400" />
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-zinc-50 dark:bg-zinc-900/60 rounded-md text-[10px] text-zinc-500 border border-zinc-200 dark:border-zinc-800">
                        Propuesta General / Licitación
                      </span>
                    )}
                  </div>

                  {/* Structure counts */}
                  <div className="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400 mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-850">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-zinc-400" />
                      <strong>{totalChapters}</strong> {totalChapters === 1 ? 'Capítulo' : 'Capítulos'}
                    </span>
                    <span>•</span>
                    <span>
                      <strong>{totalItemsCount}</strong> {totalItemsCount === 1 ? 'Partida' : 'Partidas'}
                    </span>
                  </div>
                </div>

                <div>
                  {/* Financial Total Box */}
                  <div className="bg-zinc-50 dark:bg-zinc-900/70 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 mb-4 space-y-1">
                    <div className="flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span>Monto Neto:</span>
                      <span className="font-mono font-medium">{formatCLP(netAmount)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span>IVA (19%):</span>
                      <span className="font-mono font-medium">{formatCLP(ivaAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-zinc-900 dark:text-white pt-1 border-t border-zinc-200 dark:border-zinc-800">
                      <span>Total Presupuesto (Bruto):</span>
                      <span className="font-mono text-sm font-black text-blue-600 dark:text-blue-400">
                        {formatCLP(grossAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-850">
                    <button
                      type="button"
                      disabled={isThisPdfGenerating}
                      onClick={() => handleDownloadPDF(q)}
                      className="flex-1 py-2 px-3 bg-zinc-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-950 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                      title="Descargar PDF Oficial con membrete de la empresa"
                    >
                      {isThisPdfGenerating ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span className="text-[10px]">{pdfStatusMessage || 'Generando...'}</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>Descargar PDF</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(q)}
                      className="p-2 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                      title="Editar cotización oficial"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDuplicateQuotation(q)}
                      className="p-2 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                      title="Duplicar como nuevo borrador"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setQuotationToDelete(q)}
                      className="p-2 border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer"
                      title="Eliminar cotización"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor Modal */}
      {isEditorModalOpen && (
        <ChileanQuotationEditorModal
          isOpen={isEditorModalOpen}
          onClose={() => setIsEditorModalOpen(false)}
          project={projects.find(p => p.id === quotationToEdit?.projectId) || projects[0] || null}
          projects={projects}
          quotationToEdit={quotationToEdit}
          onSaved={(saved) => {
            setQuotations(prev => {
              const idx = prev.findIndex(x => x.id === saved.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = saved;
                return next;
              }
              return [saved, ...prev];
            });
            setIsEditorModalOpen(false);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {quotationToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-4">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">¿Eliminar cotización oficial?</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Estás a punto de eliminar la cotización <strong>"{quotationToDelete.name}"</strong> de <strong>{quotationToDelete.clientName || 'Cliente'}</strong>. Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setQuotationToDelete(null)}
                className="flex-1 py-2 px-4 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteQuotation}
                className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
