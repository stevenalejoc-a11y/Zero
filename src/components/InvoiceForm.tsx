import React, { useState } from 'react';
import { db, collection, addDoc, auth } from '../lib/firebase';
import { X, Loader2, AlertCircle, Plus, Trash2, ShoppingCart, Receipt, ShieldCheck } from 'lucide-react';
import { InvoiceItemDetail } from '../types';

interface InvoiceFormProps {
  projectId: string;
  onClose: () => void;
}

export default function InvoiceForm({ projectId, onClose }: InvoiceFormProps) {
  const [formData, setFormData] = useState({
    invoiceNumber: '',
    provider: '',
    totalAmount: '',
    ivaRate: 19,
    extractionMethod: 'dte_included' as 'dte_included' | 'direct_percentage',
    date: new Date().toISOString().split('T')[0]
  });

  const [details, setDetails] = useState<InvoiceItemDetail[]>([]);
  const [newDetail, setNewDetail] = useState({
    description: '',
    quantity: '1',
    unitPrice: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-calculated fields
  const hasDetails = details.length > 0;
  
  // Calculate total amount based on details if present, otherwise manual input
  const calculatedTotal = hasDetails 
    ? details.reduce((sum, item) => sum + item.total, 0)
    : Math.max(0, Number(formData.totalAmount) || 0);

  // Extract IVA from the total amount (El IVA NO se suma, se resta del total)
  let calculatedIva = 0;
  let calculatedNet = 0;

  if (formData.extractionMethod === 'dte_included') {
    // Estándar oficial SII: El total de la factura ya tiene el IVA incluido.
    // Neto = Total / (1 + ivaRate/100), IVA = Total - Neto
    const divisor = 1 + (formData.ivaRate / 100);
    calculatedNet = divisor > 0 ? Math.round(calculatedTotal / divisor) : calculatedTotal;
    calculatedIva = Math.max(0, calculatedTotal - calculatedNet);
  } else {
    // Deducción directa porcentual: IVA = 19% del total, Neto = Total - IVA
    calculatedIva = Math.round(calculatedTotal * (formData.ivaRate / 100));
    calculatedNet = Math.max(0, calculatedTotal - calculatedIva);
  }

  // Add detail item to list
  const handleAddDetail = () => {
    if (!newDetail.description.trim()) return;
    const qty = Math.max(1, Number(newDetail.quantity) || 1);
    const price = Math.max(0, Number(newDetail.unitPrice) || 0);
    const lineTotal = qty * price;

    const item: InvoiceItemDetail = {
      description: newDetail.description.trim(),
      quantity: qty,
      unitPrice: price,
      total: lineTotal
    };

    setDetails([...details, item]);
    setNewDetail({
      description: '',
      quantity: '1',
      unitPrice: ''
    });

    // Sync total amount
    setFormData(prev => ({
      ...prev,
      totalAmount: String(calculatedTotal + lineTotal)
    }));
  };

  // Remove detail item
  const handleRemoveDetail = (index: number) => {
    const updated = details.filter((_, i) => i !== index);
    setDetails(updated);
    
    const newTotal = updated.reduce((sum, item) => sum + item.total, 0);
    setFormData(prev => ({
      ...prev,
      totalAmount: updated.length > 0 ? String(newTotal) : ''
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.invoiceNumber.trim()) {
      setErrorMessage('Por favor ingresa el número de factura.');
      return;
    }
    if (!formData.provider.trim()) {
      setErrorMessage('Por favor ingresa el nombre del proveedor.');
      return;
    }
    if (calculatedTotal <= 0) {
      setErrorMessage('El valor total de la factura debe ser mayor a $0.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'invoices'), {
        projectId,
        invoiceNumber: formData.invoiceNumber.trim(),
        provider: formData.provider.trim(),
        totalAmount: calculatedTotal,
        iva: calculatedIva,
        netAmount: calculatedNet,
        ivaRate: Number(formData.ivaRate) || 19,
        extractionMethod: formData.extractionMethod,
        date: formData.date || new Date().toISOString().split('T')[0],
        ownerId: auth.currentUser?.uid || 'user',
        details: hasDetails ? details : null,
        createdAt: new Date().toISOString()
      });
      onClose();
    } catch (error: any) {
      console.error("Error adding invoice:", error);
      setErrorMessage(error?.message || 'Error al guardar la factura. Por favor verifica los permisos o la conexión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 my-8">
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Registrar Factura DTE</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Ingreso por Valor Total con desglose de IVA Crédito Fiscal restado</p>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            disabled={isSubmitting}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="flex-1 font-medium">{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Header invoice info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Número de Factura DTE *
              </label>
              <input 
                type="text" 
                required
                placeholder="Ej: 10452"
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white text-xs"
                value={formData.invoiceNumber}
                onChange={e => setFormData({...formData, invoiceNumber: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Proveedor / Empresa *
              </label>
              <input 
                type="text" 
                required
                placeholder="Ej: Sodimac Constructor, Cbb Cemento, etc."
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white text-xs"
                value={formData.provider}
                onChange={e => setFormData({...formData, provider: e.target.value})}
              />
            </div>
          </div>

          {/* PARTADO DE DETALLES (ITEMIZED LINES) */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-tight">Detalles de Factura (Opcional)</h3>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {details.length} {details.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {/* Form inputs for new line */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
              <div className="sm:col-span-6">
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">Descripción / Material</label>
                <input 
                  type="text" 
                  placeholder="Ej: Saco Cemento Melón 25kg"
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  value={newDetail.description}
                  onChange={e => setNewDetail({ ...newDetail, description: e.target.value })}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">Cant.</label>
                <input 
                  type="number" 
                  min="1"
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-center outline-none focus:ring-2 focus:ring-blue-500"
                  value={newDetail.quantity}
                  onChange={e => setNewDetail({ ...newDetail, quantity: e.target.value })}
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">P. Unitario ($)</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">$</span>
                  <input 
                    type="number" 
                    placeholder="0"
                    className="w-full pl-5 pr-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    value={newDetail.unitPrice}
                    onChange={e => setNewDetail({ ...newDetail, unitPrice: e.target.value })}
                  />
                </div>
              </div>

              <div className="sm:col-span-1">
                <button
                  type="button"
                  onClick={handleAddDetail}
                  className="w-full p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all flex items-center justify-center cursor-pointer font-bold"
                  title="Agregar item"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List of details */}
            {hasDetails ? (
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-950 max-h-40 overflow-y-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-900 text-[9px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <th className="px-3 py-2">Descripción</th>
                      <th className="px-3 py-2 text-center">Cant.</th>
                      <th className="px-3 py-2 text-right">P. Unitario</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-2 py-2 text-center w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                    {details.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                        <td className="px-3 py-1.5 font-medium text-slate-800 dark:text-slate-200">{item.description}</td>
                        <td className="px-3 py-1.5 text-center text-slate-600 dark:text-slate-400 font-mono">{item.quantity}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-600 dark:text-slate-400">${item.unitPrice.toLocaleString('es-CL')}</td>
                        <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-900 dark:text-white">${item.total.toLocaleString('es-CL')}</td>
                        <td className="px-2 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveDetail(index)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 italic text-center py-2">
                Sin items especificados. Puedes ingresar el valor total del documento directamente abajo.
              </p>
            )}
          </div>

          {/* Modo de extracción y cálculo de IVA */}
          <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Método de Extracción de IVA (Resta del Total):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label 
                className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                  formData.extractionMethod === 'dte_included' 
                    ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-400 text-blue-950 dark:text-blue-100 font-semibold' 
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <input 
                  type="radio" 
                  name="extractionMethod" 
                  value="dte_included"
                  checked={formData.extractionMethod === 'dte_included'}
                  onChange={() => setFormData({...formData, extractionMethod: 'dte_included'})}
                  className="mt-0.5 text-blue-600"
                />
                <div>
                  <span className="block font-bold leading-tight">DTE Oficial (IVA Incluido)</span>
                  <span className="text-[10px] opacity-75 leading-tight block">Neto = Total / 1.19 | IVA = Total - Neto</span>
                </div>
              </label>

              <label 
                className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                  formData.extractionMethod === 'direct_percentage' 
                    ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-400 text-blue-950 dark:text-blue-100 font-semibold' 
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <input 
                  type="radio" 
                  name="extractionMethod" 
                  value="direct_percentage"
                  checked={formData.extractionMethod === 'direct_percentage'}
                  onChange={() => setFormData({...formData, extractionMethod: 'direct_percentage'})}
                  className="mt-0.5 text-blue-600"
                />
                <div>
                  <span className="block font-bold leading-tight">Deducción Directa 19%</span>
                  <span className="text-[10px] opacity-75 leading-tight block">IVA = 19% del Total | Neto = Total - IVA</span>
                </div>
              </label>
            </div>
          </div>

          {/* Financial Calculation Fields: Total & Tasa */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Valor Total de la Factura (CLP) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                <input 
                  type="number" 
                  required
                  disabled={hasDetails}
                  placeholder="0"
                  className={`w-full pl-8 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white text-sm font-bold ${
                    hasDetails ? 'bg-slate-100 dark:bg-slate-850 cursor-not-allowed opacity-80' : ''
                  }`}
                  value={calculatedTotal || ''}
                  onChange={e => setFormData({...formData, totalAmount: e.target.value})}
                />
              </div>
              {hasDetails ? (
                <p className="text-[9px] text-blue-600 dark:text-blue-400 font-medium mt-1 leading-none">
                  * Auto-calculado a partir de la suma de los items de detalle
                </p>
              ) : (
                <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-1 leading-none">
                  Ingresa el valor total del documento emitido por el proveedor
                </p>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Tasa IVA
              </label>
              <div className="relative">
                <input 
                  type="number" 
                  required
                  min="0"
                  max="100"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white text-xs pr-7 text-center font-bold"
                  value={formData.ivaRate}
                  onChange={e => setFormData({...formData, ivaRate: parseInt(e.target.value) || 0})}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">%</span>
              </div>
            </div>
          </div>
          
          {/* Card de Desglose Matemático donde el IVA se resta, no se suma */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-2.5 animate-in fade-in">
            <div className="flex justify-between items-center text-xs text-slate-700 dark:text-slate-300 font-bold pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-blue-600" />
                Valor Total Factura:
              </span>
              <span className="font-mono text-base text-slate-900 dark:text-white font-black">
                ${calculatedTotal.toLocaleString('es-CL')}
              </span>
            </div>
            
            <div className="flex justify-between text-xs text-amber-700 dark:text-amber-400 font-semibold">
              <span>(-) IVA Crédito Fiscal ({formData.ivaRate}% extraído del total):</span>
              <span className="font-mono">-${calculatedIva.toLocaleString('es-CL')}</span>
            </div>

            <div className="flex justify-between text-xs text-emerald-700 dark:text-emerald-400 font-bold pt-1.5 border-t border-slate-200 dark:border-slate-800">
              <span>(=) Monto Neto Resultante (Total - IVA):</span>
              <span className="font-mono">${calculatedNet.toLocaleString('es-CL')}</span>
            </div>

            <div className="text-[10px] text-slate-500 dark:text-slate-400 pt-1.5 flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800/40">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                El valor total de la factura queda exactamente en <strong>${calculatedTotal.toLocaleString('es-CL')}</strong> (el IVA se extrae y resta del valor total, sin sumarlo de nuevo).
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Fecha de Emisión *
              </label>
              <input 
                type="date" 
                required
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white text-xs font-semibold"
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button 
              type="button"
              onClick={onClose} 
              disabled={isSubmitting}
              className="flex-1 py-2 px-4 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs disabled:opacity-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-600/20 text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando Factura...</span>
                </>
              ) : (
                <span>Guardar Factura DTE</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

