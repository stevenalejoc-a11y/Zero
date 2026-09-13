import React, { useState } from 'react';
import { db, collection, addDoc, auth } from '../lib/firebase';
import { X, Loader2, AlertCircle } from 'lucide-react';

interface ExpenseFormProps {
  projectId: string;
  onClose: () => void;
}

export default function ExpenseForm({ projectId, onClose }: ExpenseFormProps) {
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'labor' as 'labor' | 'fuel' | 'tools' | 'other',
    date: new Date().toISOString().split('T')[0]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const numericAmount = Math.max(0, Number(formData.amount) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.description.trim()) {
      setErrorMessage('Por favor ingresa una descripción para el gasto.');
      return;
    }
    if (numericAmount <= 0) {
      setErrorMessage('El monto debe ser mayor a $0.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'expenses'), {
        projectId,
        description: formData.description.trim(),
        amount: numericAmount,
        category: formData.category,
        date: formData.date || new Date().toISOString().split('T')[0],
        ownerId: auth.currentUser?.uid || 'user',
        createdAt: new Date().toISOString()
      });
      onClose();
    } catch (error: any) {
      console.error("Error adding expense:", error);
      setErrorMessage(error?.message || 'Error al registrar el gasto. Por favor verifica los permisos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Registrar Gasto</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Gastos operacionales y compras directas de faena</p>
          </div>
          <button 
            onClick={onClose} 
            disabled={isSubmitting}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="flex-1 font-medium">{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              Descripción del Gasto *
            </label>
            <input 
              type="text" 
              required
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-slate-900 dark:text-white text-sm"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              placeholder="Ej: Pago jornaleros semana 3, flete arena, etc."
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              Categoría
            </label>
            <select 
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-slate-900 dark:text-white text-sm"
              value={formData.category}
              onChange={e => setFormData({...formData, category: e.target.value as any})}
            >
              <option value="labor" className="dark:bg-slate-900">Mano de Obra</option>
              <option value="fuel" className="dark:bg-slate-900">Combustible / Fletes</option>
              <option value="tools" className="dark:bg-slate-900">Herramientas / Arriendos</option>
              <option value="other" className="dark:bg-slate-900">Otros Gastos</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              Monto Pagado (CLP) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
              <input 
                type="number" 
                required
                min="1"
                placeholder="0"
                className="w-full pl-8 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-slate-900 dark:text-white text-sm font-semibold"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              Fecha del Gasto *
            </label>
            <input 
              type="date" 
              required
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-slate-900 dark:text-white text-sm"
              value={formData.date}
              onChange={e => setFormData({...formData, date: e.target.value})}
            />
          </div>

          <div className="flex gap-3 pt-3">
            <button 
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm disabled:opacity-50"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-md shadow-amber-600/20 text-sm flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <span>Guardar Gasto</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
