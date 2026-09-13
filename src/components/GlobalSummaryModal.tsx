import React, { useState, useEffect, useRef } from 'react';
import { Project, Invoice, Expense, Quotation } from '../types';
import { db, collection, query, where, getDocs } from '../lib/firebase';
import { User } from 'firebase/auth';
import { 
  X, Download, FileText, Briefcase, CheckCircle, 
  Loader2, Eye, Building2, Layers, DollarSign, Package,
  SlidersHorizontal, Check, RefreshCw
} from 'lucide-react';
import { 
  createGlobalSummaryReportHTML, 
  generatePDFFromElement, 
  formatCLP 
} from '../lib/pdfExport';

interface GlobalSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  projects: Project[];
}

export default function GlobalSummaryModal({
  isOpen,
  onClose,
  user,
  projects
}: GlobalSummaryModalProps) {
  const [filterScope, setFilterScope] = useState<'active' | 'all'>('active');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  
  const previewRef = useRef<HTMLDivElement>(null);

  // Load all user's financial documents across all projects
  useEffect(() => {
    if (!isOpen || !user?.uid) return;

    let isMounted = true;
    const fetchAllData = async () => {
      setIsLoadingData(true);
      try {
        const invQuery = query(collection(db, 'invoices'), where('ownerId', '==', user.uid));
        const expQuery = query(collection(db, 'expenses'), where('ownerId', '==', user.uid));
        const quotQuery = query(collection(db, 'quotations'), where('ownerId', '==', user.uid));

        const [invSnap, expSnap, quotSnap] = await Promise.all([
          getDocs(invQuery),
          getDocs(expQuery),
          getDocs(quotQuery)
        ]);

        if (isMounted) {
          setInvoices(invSnap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice)));
          setExpenses(expSnap.docs.map(d => ({ id: d.id, ...d.data() } as Expense)));
          setQuotations(quotSnap.docs.map(d => ({ id: d.id, ...d.data() } as Quotation)));
        }
      } catch (error) {
        console.error('Error fetching global project data:', error);
      } finally {
        if (isMounted) setIsLoadingData(false);
      }
    };

    fetchAllData();
    return () => {
      isMounted = false;
    };
  }, [isOpen, user.uid]);

  // Determine target projects based on filter scope
  const targetProjects = projects.filter(p => filterScope === 'all' || p.status === 'active');
  const targetProjectIds = new Set(targetProjects.map(p => p.id).filter(Boolean));

  const filteredInvoices = invoices.filter(i => targetProjectIds.has(i.projectId));
  const filteredExpenses = expenses.filter(e => targetProjectIds.has(e.projectId));
  const filteredQuotations = quotations.filter(q => targetProjectIds.has(q.projectId));

  // Compute high-level quick statistics
  const totalBudget = targetProjects.reduce((sum, p) => sum + (p.budget || 0), 0);
  const totalInvoicedNet = filteredInvoices.reduce((sum, i) => sum + (i.netAmount || 0), 0);
  const totalOtherExp = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalSpent = totalInvoicedNet + totalOtherExp;
  const remaining = totalBudget - totalSpent;
  const totalItemsCount = filteredQuotations.reduce((sum, q) => sum + (q.items?.length || 0), 0);

  // Update Live Preview when selections change
  useEffect(() => {
    if (!previewRef.current || !isOpen || isLoadingData) return;

    previewRef.current.innerHTML = '';
    const htmlElement = createGlobalSummaryReportHTML(
      targetProjects,
      filteredInvoices,
      filteredExpenses,
      filteredQuotations
    );
    previewRef.current.appendChild(htmlElement);
  }, [isOpen, isLoadingData, filterScope, targetProjects, filteredInvoices, filteredExpenses, filteredQuotations]);

  const handleExportPDF = async () => {
    if (targetProjects.length === 0) {
      alert('No hay proyectos para exportar.');
      return;
    }

    setIsGenerating(true);
    setStatusMessage('Inicializando compilación de proyectos...');

    try {
      const htmlElement = createGlobalSummaryReportHTML(
        targetProjects,
        filteredInvoices,
        filteredExpenses,
        filteredQuotations
      );

      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `Resumen_Global_Obras_Activas_${timestamp}.pdf`;

      await generatePDFFromElement(htmlElement, filename, (msg) => {
        setStatusMessage(msg);
      });
    } catch (error) {
      console.error('Error generating global PDF summary:', error);
      alert('Ocurrió un error al generar el PDF. Por favor intenta de nuevo.');
    } finally {
      setIsGenerating(false);
      setStatusMessage('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-black rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-zinc-900 text-white dark:bg-white dark:text-black rounded-xl flex items-center justify-center border border-zinc-200 dark:border-zinc-800">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-zinc-900 dark:text-white text-base sm:text-lg uppercase tracking-tight">
                  Exportar Resumen Global del Sistema
                </h3>
                <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 text-[10px] font-bold uppercase rounded border border-zinc-200 dark:border-zinc-800">
                  PDF Ejecutivo
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Consolidado de todas las obras activas, gastos, facturas y totales de materiales del sistema.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
          
          {/* LEFT CONTROLS PANEL (4 cols) */}
          <div className="lg:col-span-4 p-5 sm:p-6 overflow-y-auto border-r border-zinc-200 dark:border-zinc-800 flex flex-col justify-between space-y-6 bg-white dark:bg-black">
            
            <div className="space-y-5">
              {/* Scope Selector */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400 tracking-wider mb-2.5 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
                  1. Alcance de Obras a Incluir
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterScope('active')}
                    className={`py-3 px-3 rounded-xl border text-xs font-semibold text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                      filterScope === 'active'
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-black border-zinc-900 dark:border-white shadow-xs'
                        : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      {filterScope === 'active' && <Check className="w-3.5 h-3.5" />}
                      Obras Activas
                    </span>
                    <span className="text-[10px] opacity-70">
                      ({projects.filter(p => p.status === 'active').length} en marcha)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterScope('all')}
                    className={`py-3 px-3 rounded-xl border text-xs font-semibold text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                      filterScope === 'all'
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-black border-zinc-900 dark:border-white shadow-xs'
                        : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      {filterScope === 'all' && <Check className="w-3.5 h-3.5" />}
                      Todas las Obras
                    </span>
                    <span className="text-[10px] opacity-70">
                      ({projects.length} en total)
                    </span>
                  </button>
                </div>
              </div>

              {/* Data Summary Card */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                  Resumen de Datos Consolidados
                </span>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-300">
                    <span className="flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-zinc-500" />
                      Proyectos Seleccionados:
                    </span>
                    <strong className="text-zinc-900 dark:text-white font-bold">{targetProjects.length} obras</strong>
                  </div>

                  <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-300">
                    <span className="flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                      Presupuesto Total OC:
                    </span>
                    <strong className="text-zinc-900 dark:text-white font-bold">{formatCLP(totalBudget)}</strong>
                  </div>

                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-500" />
                      Facturas Proveedores:
                    </span>
                    <strong className="text-blue-600 dark:text-blue-400 font-bold">{formatCLP(totalInvoicedNet)}</strong>
                  </div>

                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-500" />
                      Gastos Operativos Faena:
                    </span>
                    <strong className="text-amber-600 dark:text-amber-400 font-bold">{formatCLP(totalOtherExp)}</strong>
                  </div>

                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-indigo-500" />
                      Materiales Cotizados:
                    </span>
                    <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{totalItemsCount} ítems</strong>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700 text-sm font-black">
                    <span className="text-slate-700 dark:text-slate-300">Saldo Disponible:</span>
                    <span className={remaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                      {formatCLP(remaining)}
                    </span>
                  </div>
                </div>
              </div>

              {/* What will be included in the PDF */}
              <div className="p-3.5 bg-blue-50/70 dark:bg-indigo-950/30 rounded-2xl border border-blue-100 dark:border-indigo-900/40 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
                <p className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  El documento PDF incluye:
                </p>
                <ul className="list-disc list-inside text-[11px] space-y-1 text-slate-600 dark:text-slate-400 pl-1">
                  <li>Encabezado empresarial y RUT chileno</li>
                  <li>Tabla de estado financiero por obra activa</li>
                  <li>Desglose de gastos (Mano de obra, combustible, herramientas)</li>
                  <li>Consolidado total de materiales de construcción</li>
                  <li>Top proveedores facturados en el sistema</li>
                  <li>Cláusula de respaldo tributario IVA 19% y firmas</li>
                </ul>
              </div>
            </div>

            {/* ACTION BUTTON */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleExportPDF}
                disabled={isGenerating || isLoadingData || targetProjects.length === 0}
                className="w-full py-4 px-5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{statusMessage || 'Compilando PDF...'}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>Descargar PDF Consolidado</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT PREVIEW PANEL (8 cols) */}
          <div className="lg:col-span-8 bg-slate-200 dark:bg-slate-950 p-4 sm:p-6 overflow-y-auto flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-3 text-xs text-slate-600 dark:text-slate-400 max-w-[850px]">
              <span className="font-bold flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-600" />
                Vista Previa del Documento Ejecutivo (A4)
              </span>
              <span className="bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-300 dark:border-slate-700 shadow-xs font-bold text-[11px] text-indigo-600 dark:text-indigo-400">
                {targetProjects.length} Proyectos Incluidos
              </span>
            </div>

            {/* RENDERED PREVIEW CONTAINER */}
            <div className="w-full max-w-[850px] bg-white shadow-2xl rounded-sm border border-slate-300 overflow-hidden transform origin-top transition-all">
              {isLoadingData ? (
                <div className="py-32 flex flex-col items-center justify-center text-slate-400 space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                  <p className="text-xs font-bold">Cargando datos y generando vista previa...</p>
                </div>
              ) : (
                <div ref={previewRef} className="preview-container text-slate-900" />
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
