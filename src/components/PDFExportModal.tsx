import React, { useState, useEffect, useRef } from 'react';
import { Project, Invoice, Expense, Quotation, Note } from '../types';
import { 
  X, Download, FileText, Receipt, Briefcase, 
  CheckCircle, Loader2, Eye, Building2, HardHat, DollarSign
} from 'lucide-react';
import { 
  createGeneralReportHTML, 
  createInvoicesReportHTML, 
  createSingleInvoiceReportHTML,
  createQuotationReportHTML, 
  createExpensesReportHTML,
  createSingleExpenseReportHTML,
  generatePDFFromElement,
  formatCLP 
} from '../lib/pdfExport';

export type ReportType = 'general' | 'invoices' | 'single-invoice' | 'quotation' | 'expenses' | 'single-expense' | 'factories';

interface PDFExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  invoices: Invoice[];
  expenses: Expense[];
  quotations: Quotation[];
  notes?: Note[];
  aiAnalysis?: string | null;
  initialReportType?: ReportType;
  initialQuotationId?: string | null;
  initialInvoiceId?: string | null;
  initialExpenseId?: string | null;
}

export default function PDFExportModal({
  isOpen,
  onClose,
  project,
  invoices,
  expenses,
  quotations,
  notes = [],
  aiAnalysis,
  initialReportType = 'general',
  initialQuotationId,
  initialInvoiceId,
  initialExpenseId
}: PDFExportModalProps) {
  // Normalize initialReportType: if 'factories', convert to 'invoices'
  const normalizedInitialType = initialReportType === 'factories' ? 'invoices' : initialReportType;
  const [reportType, setReportType] = useState<ReportType>(normalizedInitialType);
  const [selectedQuotationId, setSelectedQuotationId] = useState<string>(
    initialQuotationId || (quotations[0]?.id || '')
  );
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(
    initialInvoiceId || (invoices[0]?.id || '')
  );
  const [selectedExpenseId, setSelectedExpenseId] = useState<string>(
    initialExpenseId || (expenses[0]?.id || '')
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [includeAIAnalysis, setIncludeAIAnalysis] = useState(Boolean(aiAnalysis));
  
  const previewRef = useRef<HTMLDivElement>(null);

  // Synchronize when initial props change
  useEffect(() => {
    if (initialReportType) {
      setReportType(initialReportType === 'factories' ? 'invoices' : initialReportType);
    }
    if (initialQuotationId) setSelectedQuotationId(initialQuotationId);
    if (initialInvoiceId) setSelectedInvoiceId(initialInvoiceId);
    if (initialExpenseId) setSelectedExpenseId(initialExpenseId);
  }, [initialReportType, initialQuotationId, initialInvoiceId, initialExpenseId]);

  // If items change and none selected, select first
  useEffect(() => {
    if (!selectedQuotationId && quotations.length > 0) {
      setSelectedQuotationId(quotations[0].id || '');
    }
    if (!selectedInvoiceId && invoices.length > 0) {
      setSelectedInvoiceId(invoices[0].id || '');
    }
    if (!selectedExpenseId && expenses.length > 0) {
      setSelectedExpenseId(expenses[0].id || '');
    }
  }, [quotations, invoices, expenses, selectedQuotationId, selectedInvoiceId, selectedExpenseId]);

  // Update preview content when selections change
  useEffect(() => {
    if (!previewRef.current || !isOpen) return;

    previewRef.current.innerHTML = '';
    let htmlElement: HTMLElement;

    if (reportType === 'general') {
      htmlElement = createGeneralReportHTML(project, invoices, expenses, notes, {
        aiAnalysis: includeAIAnalysis ? (aiAnalysis || undefined) : undefined
      });
    } else if (reportType === 'invoices' || reportType === 'factories') {
      htmlElement = createInvoicesReportHTML(project, invoices);
    } else if (reportType === 'single-invoice') {
      const selectedInvoice = invoices.find(inv => inv.id === selectedInvoiceId) || invoices[0];
      if (selectedInvoice) {
        htmlElement = createSingleInvoiceReportHTML(project, selectedInvoice);
      } else {
        const placeholder = document.createElement('div');
        placeholder.style.padding = '40px';
        placeholder.style.textAlign = 'center';
        placeholder.style.color = '#64748b';
        placeholder.innerHTML = '<p>No hay facturas seleccionadas para exportar.</p>';
        htmlElement = placeholder;
      }
    } else if (reportType === 'expenses') {
      htmlElement = createExpensesReportHTML(project, expenses);
    } else if (reportType === 'single-expense') {
      const selectedExp = expenses.find(e => e.id === selectedExpenseId) || expenses[0];
      if (selectedExp) {
        htmlElement = createSingleExpenseReportHTML(project, selectedExp);
      } else {
        const placeholder = document.createElement('div');
        placeholder.style.padding = '40px';
        placeholder.style.textAlign = 'center';
        placeholder.style.color = '#64748b';
        placeholder.innerHTML = '<p>No hay gastos de faena registrados para exportar.</p>';
        htmlElement = placeholder;
      }
    } else {
      const selectedQuotation = quotations.find(q => q.id === selectedQuotationId) || quotations[0];
      if (selectedQuotation) {
        htmlElement = createQuotationReportHTML(project, selectedQuotation);
      } else {
        const placeholder = document.createElement('div');
        placeholder.style.padding = '40px';
        placeholder.style.textAlign = 'center';
        placeholder.style.color = '#64748b';
        placeholder.innerHTML = '<p>No hay cotizaciones disponibles para exportar.</p>';
        htmlElement = placeholder;
      }
    }

    previewRef.current.appendChild(htmlElement);
  }, [reportType, selectedQuotationId, selectedInvoiceId, selectedExpenseId, includeAIAnalysis, project, invoices, expenses, quotations, notes, aiAnalysis, isOpen]);

  if (!isOpen) return null;

  const handleExportPDF = async () => {
    setIsGenerating(true);
    setStatusMessage('Generando reporte PDF...');

    try {
      let targetElement: HTMLElement;
      let filename = '';

      if (reportType === 'general') {
        targetElement = createGeneralReportHTML(project, invoices, expenses, notes, {
          aiAnalysis: includeAIAnalysis ? (aiAnalysis || undefined) : undefined
        });
        filename = `Reporte_General_${project.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      } else if (reportType === 'invoices' || reportType === 'factories') {
        targetElement = createInvoicesReportHTML(project, invoices);
        filename = `Reporte_Facturas_${project.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      } else if (reportType === 'single-invoice') {
        const inv = invoices.find(item => item.id === selectedInvoiceId) || invoices[0];
        if (!inv) {
          alert('Por favor selecciona una factura para exportar.');
          setIsGenerating(false);
          return;
        }
        targetElement = createSingleInvoiceReportHTML(project, inv);
        filename = `Factura_${inv.invoiceNumber}_${(inv.provider || 'Proveedor').replace(/\s+/g, '_')}.pdf`;
      } else if (reportType === 'expenses') {
        targetElement = createExpensesReportHTML(project, expenses);
        filename = `Informe_Gastos_Faena_${project.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      } else if (reportType === 'single-expense') {
        const exp = expenses.find(item => item.id === selectedExpenseId) || expenses[0];
        if (!exp) {
          alert('Por favor selecciona un gasto para exportar.');
          setIsGenerating(false);
          return;
        }
        targetElement = createSingleExpenseReportHTML(project, exp);
        filename = `Comprobante_Gasto_${(exp.description || 'Faena').slice(0, 20).replace(/\s+/g, '_')}.pdf`;
      } else {
        const q = quotations.find(item => item.id === selectedQuotationId) || quotations[0];
        if (!q) {
          alert('Por favor selecciona una cotización para exportar.');
          setIsGenerating(false);
          return;
        }
        targetElement = createQuotationReportHTML(project, q);
        filename = `Cotizacion_${q.name.replace(/\s+/g, '_')}_${project.name.replace(/\s+/g, '_')}.pdf`;
      }

      await generatePDFFromElement(targetElement, filename, (msg) => {
        setStatusMessage(msg);
      });

      setStatusMessage('¡Descarga completada!');
      setTimeout(() => {
        setIsGenerating(false);
        setStatusMessage('');
      }, 1200);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Hubo un error al exportar el archivo PDF. Por favor reintenta.');
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-6xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Centro de Exportación de Documentos y Reportes PDF
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Descarga facturas individuales, cotizaciones o reportes consolidados en formato A4
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          
          {/* LEFT CONTROLS PANEL (5 cols) */}
          <div className="lg:col-span-4 p-6 border-r border-slate-200 dark:border-slate-800 overflow-y-auto space-y-6 bg-slate-50/50 dark:bg-slate-900/50">
            <div>
              <label className="block text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-3">
                1. Selecciona el Tipo de Documento
              </label>

              <div className="space-y-2">
                {/* OPTION 1: RESUMEN GENERAL */}
                <button
                  type="button"
                  onClick={() => setReportType('general')}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                    reportType === 'general'
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-600 dark:border-blue-500 ring-2 ring-blue-600/20'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${reportType === 'general' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">Resumen General</h4>
                      {reportType === 'general' && <CheckCircle className="w-4 h-4 text-blue-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Consolidado: Presupuesto, Facturas, Gastos y Balance.
                    </p>
                  </div>
                </button>

                {/* OPTION 2: FACTURA INDIVIDUAL */}
                <button
                  type="button"
                  onClick={() => setReportType('single-invoice')}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                    reportType === 'single-invoice'
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-600 dark:border-blue-500 ring-2 ring-blue-600/20'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${reportType === 'single-invoice' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">Factura Individual</h4>
                      {reportType === 'single-invoice' && <CheckCircle className="w-4 h-4 text-blue-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Comprobante tributario y desglose de una sola factura específica.
                    </p>
                  </div>
                </button>

                {/* OPTION 3: REPORTE COMPLETO DE FACTURAS */}
                <button
                  type="button"
                  onClick={() => setReportType('invoices')}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                    reportType === 'invoices' || reportType === 'factories'
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-600 dark:border-blue-500 ring-2 ring-blue-600/20'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${reportType === 'invoices' || reportType === 'factories' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">Todas las Facturas</h4>
                      {(reportType === 'invoices' || reportType === 'factories') && <CheckCircle className="w-4 h-4 text-blue-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Listado acumulado de facturas y crédito fiscal IVA 19% ({invoices.length} docs).
                    </p>
                  </div>
                </button>

                {/* OPTION 4: COTIZACIONES */}
                <button
                  type="button"
                  onClick={() => setReportType('quotation')}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                    reportType === 'quotation'
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-600 dark:border-blue-500 ring-2 ring-blue-600/20'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${reportType === 'quotation' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">Cotización Técnica</h4>
                      {reportType === 'quotation' && <CheckCircle className="w-4 h-4 text-blue-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Propuesta de materiales, precios unitarios y condiciones para clientes.
                    </p>
                  </div>
                </button>

                {/* OPTION 5: GASTOS DE FAENA CONSOLIDADO */}
                <button
                  type="button"
                  onClick={() => setReportType('expenses')}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                    reportType === 'expenses'
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-600 dark:border-blue-500 ring-2 ring-blue-600/20'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${reportType === 'expenses' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                    <HardHat className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">Gastos de Faena</h4>
                      {reportType === 'expenses' && <CheckCircle className="w-4 h-4 text-blue-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Informe consolidado de mano de obra, combustible, fletes y herramientas ({expenses.length} ítems).
                    </p>
                  </div>
                </button>

                {/* OPTION 6: COMPROBANTE GASTO INDIVIDUAL */}
                <button
                  type="button"
                  onClick={() => setReportType('single-expense')}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                    reportType === 'single-expense'
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-600 dark:border-blue-500 ring-2 ring-blue-600/20'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${reportType === 'single-expense' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">Comprobante de Gasto</h4>
                      {reportType === 'single-expense' && <CheckCircle className="w-4 h-4 text-blue-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Voucher individual de rendición de mano de obra o gasto de faena.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* CONDITIONAL CONTROLS: SINGLE EXPENSE SELECTOR */}
            {reportType === 'single-expense' && (
              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <label className="block text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                  2. Selecciona el Gasto de Faena
                </label>
                {expenses.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {expenses.map(exp => (
                      <div
                        key={exp.id}
                        onClick={() => setSelectedExpenseId(exp.id || '')}
                        className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                          selectedExpenseId === exp.id
                            ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-500 font-bold'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-900 dark:text-white truncate">{exp.description}</span>
                          <span className="text-blue-600 dark:text-blue-400 font-black ml-2">{formatCLP(exp.amount)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span className="capitalize">
                            {exp.category === 'labor' ? 'Mano de Obra' : exp.category === 'fuel' ? 'Combustible / Flete' : exp.category === 'tools' ? 'Herramientas' : 'Varios'}
                          </span>
                          <span>{exp.date ? new Date(exp.date).toLocaleDateString() : ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300">
                    <p className="font-bold mb-1">No hay gastos de faena registrados</p>
                    Registra empleados, combustible u otros gastos en la pestaña "Gastos de Faena".
                  </div>
                )}
              </div>
            )}

            {/* CONDITIONAL CONTROLS: SINGLE INVOICE SELECTOR */}
            {reportType === 'single-invoice' && (
              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <label className="block text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                  2. Selecciona la Factura
                </label>
                {invoices.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {invoices.map(inv => (
                      <div
                        key={inv.id}
                        onClick={() => setSelectedInvoiceId(inv.id || '')}
                        className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                          selectedInvoiceId === inv.id
                            ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-500 font-bold'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-900 dark:text-white">#{inv.invoiceNumber} • {inv.provider}</span>
                          <span className="text-blue-600 dark:text-blue-400 font-black">{formatCLP(inv.totalAmount)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>Neto: {formatCLP(inv.netAmount)}</span>
                          <span>IVA: {formatCLP(inv.iva)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300">
                    <p className="font-bold mb-1">No hay facturas registradas</p>
                    Registra facturas en la pestaña "Facturas" para exportar comprobantes individuales.
                  </div>
                )}
              </div>
            )}

            {/* CONDITIONAL CONTROLS: QUOTATION SELECTOR */}
            {reportType === 'quotation' && (
              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <label className="block text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                  2. Selecciona la Cotización
                </label>
                {quotations.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {quotations.map(q => (
                      <div
                        key={q.id}
                        onClick={() => setSelectedQuotationId(q.id || '')}
                        className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                          selectedQuotationId === q.id
                            ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-500 font-bold'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-900 dark:text-white">{q.name}</span>
                          <span className="text-blue-600 dark:text-blue-400 font-black">{formatCLP(q.totalNet)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>{q.items?.length || 0} ítems</span>
                          <span>{new Date(q.date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300">
                    <p className="font-bold mb-1">No hay cotizaciones creadas</p>
                    Crea una cotización en la pestaña "Cotizaciones" para exportar su informe técnico.
                  </div>
                )}
              </div>
            )}

            {reportType === 'general' && aiAnalysis && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeAIAnalysis}
                    onChange={e => setIncludeAIAnalysis(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Incluir sección de Análisis & Consejos IA
                  </span>
                </label>
              </div>
            )}

            {/* PROJECT SUMMARY SUMMARY */}
            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
              <div className="flex justify-between text-slate-500">
                <span>Proyecto:</span>
                <strong className="text-slate-900 dark:text-white font-bold">{project.name}</strong>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Presupuesto OC:</span>
                <strong className="text-blue-600 dark:text-blue-400 font-bold">{formatCLP(project.budget)}</strong>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Facturas Registradas:</span>
                <strong className="text-slate-900 dark:text-white font-bold">{invoices.length} documentos</strong>
              </div>
            </div>

            {/* ACTION BUTTON */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleExportPDF}
                disabled={
                  isGenerating || 
                  (reportType === 'quotation' && quotations.length === 0) ||
                  (reportType === 'single-invoice' && invoices.length === 0)
                }
                className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{statusMessage || 'Procesando PDF...'}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>Descargar PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT PREVIEW PANEL (8 cols) */}
          <div className="lg:col-span-8 bg-slate-200 dark:bg-slate-950 p-6 overflow-y-auto flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-4 text-xs text-slate-600 dark:text-slate-400 max-w-[850px]">
              <span className="font-bold flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-500" />
                Vista Previa del Documento (Formato A4)
              </span>
              <span className="bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-300 dark:border-slate-700 shadow-xs font-semibold">
                {reportType === 'general' ? 'Resumen General' : 
                 reportType === 'single-invoice' ? 'Comprobante de Factura' :
                 (reportType === 'invoices' || reportType === 'factories') ? 'Reporte de Facturas' : 'Cotización'}
              </span>
            </div>

            {/* RENDERED PREVIEW CONTAINER */}
            <div className="w-full max-w-[850px] bg-white shadow-2xl rounded-sm border border-slate-300 overflow-hidden transform origin-top transition-all">
              <div ref={previewRef} className="preview-container text-slate-900" />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

