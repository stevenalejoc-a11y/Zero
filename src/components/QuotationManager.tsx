import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { 
  FileText, Plus, Trash2, CheckCircle, Clock, Download, 
  ChevronRight, Package, Edit3, Sparkles, Building2, Layers,
  Calendar, CreditCard, ShieldCheck, Copy
} from 'lucide-react';
import { Quotation, QuotationItem, Project } from '../types';
import ChileanQuotationEditorModal from './ChileanQuotationEditorModal';
import { formatCLP } from '../lib/pdfExport';
import { getLocalQuotations, deleteLocalQuotation, saveLocalQuotation } from '../lib/quotationStorage';

interface QuotationManagerProps {
  project: Project;
  onGeneratePDF: (quotationId?: string) => void; 
}

export default function QuotationManager({ project, onGeneratePDF }: QuotationManagerProps) {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [quotationToEdit, setQuotationToEdit] = useState<Quotation | null>(null);
  const [quotationToDelete, setQuotationToDelete] = useState<Quotation | null>(null);

  useEffect(() => {
    // 1. Initial load from local storage (with default seeding if needed)
    const localDocs = getLocalQuotations(project.id!);
    setQuotations(localDocs);
    if (localDocs.length > 0) {
      setSelectedQuotation(prev => prev ? (localDocs.find(x => x.id === prev.id) || localDocs[0]) : localDocs[0]);
    }

    // 2. Listen to Firestore
    try {
      const q = query(collection(db, 'quotations'), where('projectId', '==', project.id));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const firestoreDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quotation));
        
        // Merge Firestore docs and local storage docs (deduplicate by id)
        const mergedMap = new Map<string, Quotation>();
        
        // Add local first
        localDocs.forEach(d => {
          if (d.id) mergedMap.set(d.id, d);
        });

        // Override with firestore docs
        firestoreDocs.forEach(d => {
          if (d.id) mergedMap.set(d.id, d);
        });

        const mergedList = Array.from(mergedMap.values());
        if (mergedList.length > 0) {
          setQuotations(mergedList);
          setSelectedQuotation(prev => prev ? (mergedList.find(d => d.id === prev.id) || mergedList[0]) : mergedList[0]);
        }
      }, (error) => {
        console.warn('Firestore onSnapshot error, falling back to local storage:', error);
      });

      return unsubscribe;
    } catch (err) {
      console.warn('Firestore subscription error:', err);
    }
  }, [project.id]);

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
      const savedCopy = saveLocalQuotation(project.id!, copyData);
      
      setQuotations(prev => [savedCopy, ...prev.filter(x => x.id !== savedCopy.id)]);
      setSelectedQuotation(savedCopy);
    } catch (err) {
      console.error('Error duplicating quotation:', err);
      alert('Error al duplicar la cotización.');
    }
  };

  const handleDeleteQuotation = async () => {
    if (!quotationToDelete?.id) return;
    const qId = quotationToDelete.id;
    try {
      if (!qId.startsWith('local-')) {
        try {
          await deleteDoc(doc(db, 'quotations', qId));
        } catch (e) {
          console.warn('Firestore delete failed, deleting locally:', e);
        }
      }
      deleteLocalQuotation(project.id!, qId);
      
      setQuotations(prev => {
        const filtered = prev.filter(q => q.id !== qId);
        if (selectedQuotation?.id === qId) {
          setSelectedQuotation(filtered[0] || null);
        }
        return filtered;
      });

      setQuotationToDelete(null);
    } catch (error) {
      console.error("Error deleting quotation:", error);
      deleteLocalQuotation(project.id!, qId);
      setQuotations(prev => prev.filter(q => q.id !== qId));
      setQuotationToDelete(null);
    }
  };

  // Helper to group items by chapter if chapters array is empty
  const getGroupedChapters = (quotation: Quotation) => {
    if (quotation.chapters && quotation.chapters.length > 0) {
      return quotation.chapters;
    }

    const map = new Map<number, { number: number; title: string; items: QuotationItem[] }>();
    (quotation.items || []).forEach((it, idx) => {
      let chNum = it.chapterNumber || 1;
      let chTitle = it.chapterTitle || 'PARTIDA GENERAL';

      if (it.itemNumber && it.itemNumber.includes('.')) {
        const parsed = parseInt(it.itemNumber.split('.')[0], 10);
        if (!isNaN(parsed)) chNum = parsed;
      }

      if (!map.has(chNum)) {
        map.set(chNum, {
          number: chNum,
          title: chTitle,
          items: []
        });
      }
      map.get(chNum)!.items.push(it);
    });

    if (map.size === 0) {
      return [{
        number: 1,
        title: 'PARTIDAS GENERALES',
        items: quotation.items || []
      }];
    }

    return Array.from(map.values()).sort((a, b) => a.number - b.number);
  };

  return (
    <div className="space-y-6">
      
      {/* TOP BANNER WITH CHILEAN STANDARD HIGHLIGHT */}
      <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-blue-800/40">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full text-xs font-black uppercase tracking-wider">
              Estándar Viña Construcciones & Estructuras SpA • Licitaciones & Municipal
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Cotizaciones y Presupuestos Oficiales
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Genera propuestas técnicas estructuradas por capítulos (Techumbre, Baños, Gimnasio), con membrete de empresa, datos del mandante/DOM, plazo de entrega y datos bancarios.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2.5 shadow-lg shadow-blue-600/30 hover:scale-[1.02] transition-all cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Nueva Cotización Oficial
        </button>
      </div>

      {/* MAIN GRID: LIST + DETAIL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LIST SIDE */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-blue-600" />
              Cotizaciones Registradas ({quotations.length})
            </h3>
            <button 
              onClick={handleOpenCreateModal}
              className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
              title="Crear nueva cotización"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {quotations.map(q => (
              <div 
                key={q.id}
                onClick={() => setSelectedQuotation(q)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer group ${selectedQuotation?.id === q.id ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 shadow-md shadow-blue-600/5' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${q.status === 'approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'}`}>
                    {q.status === 'approved' ? 'Aprobada' : 'Borrador'}
                  </span>
                  
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mr-1">
                      <Clock className="w-3 h-3" />
                      {new Date(q.date).toLocaleDateString('es-CL')}
                    </span>
                    <button
                      type="button"
                      title="Editar en formato oficial"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditModal(q);
                      }}
                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-100/50 dark:hover:bg-blue-900/40 rounded transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Descargar PDF"
                      onClick={(e) => {
                        e.stopPropagation();
                        onGeneratePDF(q.id);
                      }}
                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-100/50 dark:hover:bg-blue-900/40 rounded transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Eliminar cotización"
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuotationToDelete(q);
                      }}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1 group-hover:text-blue-600 transition-colors">
                  {q.name}
                </h4>

                {q.clientName && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 truncate">
                    Mandante: <strong>{q.clientName}</strong>
                  </p>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Costo Total</span>
                    <p className="text-base font-black text-blue-600 dark:text-blue-400">
                      {formatCLP(q.totalNet ? Math.round(q.totalNet * 1.19) : 0)}
                    </p>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform ${selectedQuotation?.id === q.id ? 'translate-x-1 text-blue-500' : 'text-slate-300'}`} />
                </div>
              </div>
            ))}

            {quotations.length === 0 && (
              <div className="py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-6 bg-slate-50/50 dark:bg-slate-900/40">
                <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Sin cotizaciones aún</p>
                <p className="text-xs text-slate-400 mb-4">Crea una cotización oficial con formato contratista chileno.</p>
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Crear Cotización
                </button>
              </div>
            )}
          </div>
        </div>

        {/* DETAIL SIDE */}
        <div className="lg:col-span-2">
          {selectedQuotation ? (
            <div id="quotation-detail" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
              
              {/* DETAIL HEADER */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/60 dark:bg-slate-800/40">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-full text-[10px] font-black uppercase">
                      COTIZACIÓN OFICIAL
                    </span>
                    <span className="text-xs text-slate-400">
                      Fecha: {new Date(selectedQuotation.date).toLocaleDateString('es-CL')}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    {selectedQuotation.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Proyecto: <strong>{project.name}</strong> • Dirección: {selectedQuotation.clientAddress || project.address}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleDuplicateQuotation(selectedQuotation)}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                    title="Duplicar cotización"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Duplicar
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(selectedQuotation)}
                    className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Editar en Modal
                  </button>

                  <button 
                    type="button"
                    onClick={() => onGeneratePDF(selectedQuotation.id)}
                    className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    Exportar PDF
                  </button>
                </div>
              </div>

              {/* METADATA BANNER (MANDANTE & CONDICIONES) */}
              <div className="p-5 bg-blue-50/40 dark:bg-blue-950/20 border-b border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Mandante / Cliente</span>
                  <p className="font-bold text-slate-900 dark:text-white uppercase">{selectedQuotation.clientName || 'I. MUNICIPALIDAD DE NOGALES'}</p>
                  <p className="text-slate-500 text-[11px]">RUT: {selectedQuotation.clientRut || '69.060.600-3'}</p>
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Plazo de Entrega</span>
                  <span className="inline-block px-2.5 py-1 bg-yellow-100 dark:bg-yellow-950/60 text-yellow-900 dark:text-yellow-200 font-black rounded-lg text-xs border border-yellow-300 dark:border-yellow-800">
                    {selectedQuotation.deliveryDays || '20 DIAS'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Representante Legal</span>
                  <p className="font-bold text-slate-900 dark:text-white text-xs uppercase">{selectedQuotation.legalRepresentative || 'ANGELINA DEL CARMEN LEPE RUIZ'}</p>
                  <p className="text-slate-500 text-[10px]">Aprobación SpA</p>
                </div>
              </div>

              {/* CHAPTERS & ITEMS BREAKDOWN */}
              <div className="p-6 space-y-6">
                {getGroupedChapters(selectedQuotation).map((chapter, chIdx) => (
                  <div key={chapter.number || chIdx} className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    {/* CHAPTER HEADER ROW (SKY BLUE ACCENT) */}
                    <div className="px-4 py-2.5 bg-blue-100/70 dark:bg-blue-950/60 border-b border-blue-200 dark:border-blue-900/40 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-blue-600 text-white rounded-md text-xs font-black flex items-center justify-center">
                          {chapter.number}
                        </span>
                        <h4 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white uppercase tracking-wide">
                          {chapter.title}
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300">
                        {chapter.items.length} {chapter.items.length === 1 ? 'partida' : 'partidas'}
                      </span>
                    </div>

                    {/* ITEMS TABLE */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/60 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700">
                            <th className="py-2.5 px-3 w-14 text-center">Ítem</th>
                            <th className="py-2.5 px-3">Descripción de la Partida</th>
                            <th className="py-2.5 px-3 w-20 text-center">Unidad</th>
                            <th className="py-2.5 px-3 w-16 text-center">Cant.</th>
                            <th className="py-2.5 px-3 w-28 text-right">Precio Unit.</th>
                            <th className="py-2.5 px-3 w-28 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {chapter.items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="py-2.5 px-3 text-center font-bold text-blue-600 dark:text-blue-400">
                                {item.itemNumber || `${chapter.number}.${idx + 1}`}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                                {item.name}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-slate-600 dark:text-slate-400 uppercase text-[11px]">
                                {item.unit || 'GL'}
                              </td>
                              <td className="py-2.5 px-3 text-center font-black text-slate-900 dark:text-white">
                                {item.quantity}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400 font-medium">
                                {formatCLP(item.price)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white">
                                {formatCLP(item.total || (item.quantity * item.price))}
                              </td>
                            </tr>
                          ))}
                          {chapter.items.length === 0 && (
                            <tr>
                              <td colSpan={6} className="py-4 text-center text-slate-400 text-xs">
                                Sin partidas asignadas a este capítulo.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                {(!selectedQuotation.items || selectedQuotation.items.length === 0) && (
                  <div className="py-10 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    <p className="text-slate-400 text-sm mb-3">Esta cotización aún no tiene partidas.</p>
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(selectedQuotation)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
                    >
                      Añadir Partidas
                    </button>
                  </div>
                )}

                {/* TOTALS & FINANCIAL RECAP BOX */}
                <div className="p-6 bg-slate-900 text-white rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-6 shadow-lg">
                  <div className="space-y-1 w-full sm:w-auto">
                    <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">
                      Valores Oficiales en CLP
                    </span>
                    <div className="flex flex-col sm:flex-row gap-4 text-xs text-slate-300">
                      <div>
                        Costo Directo Neto: <strong className="text-white text-sm">{formatCLP(selectedQuotation.totalNet || 0)}</strong>
                      </div>
                      <div>
                        IVA (19%): <strong className="text-blue-300 text-sm">{formatCLP(Math.round((selectedQuotation.totalNet || 0) * 0.19))}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="text-right w-full sm:w-auto border-t sm:border-t-0 border-slate-800 pt-3 sm:pt-0">
                    <span className="text-[10px] font-black uppercase text-blue-400 block">Total con IVA</span>
                    <span className="text-2xl font-black text-emerald-400">
                      {formatCLP(Math.round((selectedQuotation.totalNet || 0) * 1.19))}
                    </span>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 bg-slate-50/50 dark:bg-slate-800/20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-center min-h-[380px]">
              <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Selecciona una cotización</h3>
              <p className="text-xs text-slate-500 max-w-xs mb-4">Haz clic en una cotización del listado o crea una nueva con el estándar chileno.</p>
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                + Crear Cotización Oficial
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CHILEAN QUOTATION EDITOR MODAL */}
      <ChileanQuotationEditorModal
        isOpen={isEditorModalOpen}
        onClose={() => setIsEditorModalOpen(false)}
        project={project}
        quotationToEdit={quotationToEdit}
        onSaved={(savedQ) => {
          setSelectedQuotation(savedQ);
          setQuotations(prev => {
            const idx = prev.findIndex(q => q.id === savedQ.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = savedQ;
              return updated;
            }
            return [savedQ, ...prev];
          });
        }}
      />

      {/* CONFIRM DELETE MODAL */}
      {quotationToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-red-100 dark:border-red-900/30">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              ¿Eliminar Cotización "{quotationToDelete.name}"?
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              Esta acción eliminará la cotización de la base de datos de manera permanente.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setQuotationToDelete(null)}
                className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteQuotation}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-sm transition-colors text-sm"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
