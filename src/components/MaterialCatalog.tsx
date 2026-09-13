import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Package, 
  Sparkles, 
  Filter, 
  Info, 
  Plus, 
  Check, 
  X, 
  Building2, 
  ShoppingCart, 
  DollarSign, 
  Tag, 
  Store, 
  ShieldCheck, 
  Layers, 
  Edit3, 
  Trash2, 
  RotateCcw, 
  Save,
  AlertTriangle
} from 'lucide-react';
import { searchMaterialsAI } from '../lib/gemini';
import { Material, Quotation } from '../types';
import { CONSTRUCTION_MATERIALS, INITIAL_CATEGORIES } from '../data/materials';
import { db, collection, query, where, onSnapshot, setDoc, deleteDoc, doc } from '../lib/firebase';

interface MaterialCatalogProps {
  onAddToQuotation?: (material: Material, quotationId?: string) => void;
  onNavigateToSuppliers?: (materialName: string) => void;
  projectId?: string;
}

const STORAGE_KEY = 'chilebuild_custom_materials_v1';

export default function MaterialCatalog({ onAddToQuotation, onNavigateToSuppliers, projectId }: MaterialCatalogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  
  // Load materials from localStorage or initial list
  const [materials, setMaterials] = useState<Material[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error loading materials from localStorage:', e);
    }
    return CONSTRUCTION_MATERIALS;
  });

  const [isSuggesting, setIsSuggesting] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'material' | 'project'>('material');
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  
  // Modals state
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState<Material | null>(null);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  
  // Form State for Manual Editing / Creation
  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    category: string;
    unit: string;
    estimatedPrice: number;
    description: string;
    brand: string;
    suppliersText: string;
  }>({
    name: '',
    category: 'Cementos y Áridos',
    unit: 'Unidad',
    estimatedPrice: 0,
    description: '',
    brand: '',
    suppliersText: 'Sodimac Constructor, Imperial, Construmart'
  });

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [selectedQuotationId, setSelectedQuotationId] = useState<string>('');
  const [aiSearchSuccess, setAiSearchSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(materials));
    } catch (e) {
      console.error('Error saving materials to localStorage:', e);
    }
  }, [materials]);

  // Firestore quotations listener
  useEffect(() => {
    if (projectId) {
      const q = query(collection(db, 'quotations'), where('projectId', '==', projectId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quotation));
        setQuotations(docs);
        if (docs.length > 0 && !selectedQuotationId) {
          setSelectedQuotationId(docs[0].id!);
        }
      });
      return unsubscribe;
    }
  }, [projectId, selectedQuotationId]);

  const showNotification = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = 
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      m.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = 
      selectedCategory === 'Todos' || 
      m.category.toLowerCase() === selectedCategory.toLowerCase() ||
      m.category.toLowerCase().includes(selectedCategory.toLowerCase());

    return matchesSearch && matchesCategory;
  });

  const handleAISearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiQuery.trim()) return;

    setIsSuggesting(true);
    setAiSearchSuccess(false);

    try {
      const results = await searchMaterialsAI(aiQuery, searchMode);
      if (results && results.length > 0) {
        setMaterials(prev => {
          const existingNames = new Set(prev.map(p => p.name.toLowerCase()));
          const newItems = results.filter(r => !existingNames.has(r.name.toLowerCase()));
          return [...newItems, ...prev];
        });
        setAiSearchSuccess(true);
        setSearchTerm('');
        showNotification(`Se cargaron ${results.length} materiales desde IA`);
        setTimeout(() => setAiSearchSuccess(false), 4000);
      }
    } catch (error) {
      console.error("Error in AI material search:", error);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleAdd = (material: Material) => {
    if (onAddToQuotation && material.id) {
      if (quotations.length > 0 && !selectedQuotationId) {
        alert('Por favor selecciona una cotización de destino.');
        return;
      }
      onAddToQuotation(material, selectedQuotationId);
      setAddedItems(prev => new Set(prev).add(material.id!));
      showNotification(`"${material.name}" agregado a la cotización`);
      setTimeout(() => {
        setAddedItems(prev => {
          const next = new Set(prev);
          next.delete(material.id!);
          return next;
        });
      }, 2000);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (material: Material, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingMaterial(material);
    setIsCreatingNew(false);
    setFormData({
      id: material.id,
      name: material.name,
      category: material.category,
      unit: material.unit,
      estimatedPrice: material.estimatedPrice || 0,
      description: material.description || '',
      brand: material.brand || '',
      suppliersText: (material.suppliers || ['Sodimac Constructor', 'Imperial', 'Construmart']).join(', ')
    });
  };

  // Open Create New Modal
  const handleOpenCreate = () => {
    setIsCreatingNew(true);
    setEditingMaterial(null);
    setFormData({
      name: '',
      category: selectedCategory !== 'Todos' ? selectedCategory : 'Cementos y Áridos',
      unit: 'Unidad',
      estimatedPrice: 5000,
      description: '',
      brand: '',
      suppliersText: 'Sodimac Constructor, Imperial, Construmart'
    });
  };

  // Save manual edit or new creation
  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('El nombre del material es obligatorio');
      return;
    }

    const suppliersList = formData.suppliersText
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (isCreatingNew) {
      const matId = `custom-mat-${Date.now()}`;
      const newMaterial: Material = {
        id: matId,
        name: formData.name.trim(),
        category: formData.category,
        unit: formData.unit.trim() || 'Unidad',
        estimatedPrice: Number(formData.estimatedPrice) || 0,
        description: formData.description.trim(),
        brand: formData.brand.trim() || undefined,
        suppliers: suppliersList.length > 0 ? suppliersList : ['Sodimac Constructor', 'Imperial', 'Construmart']
      };
      setMaterials(prev => [newMaterial, ...prev]);

      // Save to Firestore database
      try {
        await setDoc(doc(db, 'materials', matId), newMaterial);
      } catch (err) {
        console.warn('Error saving material to Firestore:', err);
      }

      showNotification(`Material "${newMaterial.name}" creado con éxito`);
      setIsCreatingNew(false);
    } else if (editingMaterial) {
      const matId = editingMaterial.id || `custom-mat-${Date.now()}`;
      const updatedMaterial: Material = {
        ...editingMaterial,
        id: matId,
        name: formData.name.trim(),
        category: formData.category,
        unit: formData.unit.trim() || 'Unidad',
        estimatedPrice: Number(formData.estimatedPrice) || 0,
        description: formData.description.trim(),
        brand: formData.brand.trim() || undefined,
        suppliers: suppliersList.length > 0 ? suppliersList : editingMaterial.suppliers
      };

      setMaterials(prev => prev.map(m => {
        if (m.id && m.id === matId) return updatedMaterial;
        if (m.name.toLowerCase() === editingMaterial.name.toLowerCase()) return updatedMaterial;
        return m;
      }));
      
      // Update selectedMaterial if modal is open
      if (selectedMaterial && (selectedMaterial.id === matId || selectedMaterial.name.toLowerCase() === editingMaterial.name.toLowerCase())) {
        setSelectedMaterial(updatedMaterial);
      }

      // Update in Firestore database
      try {
        await setDoc(doc(db, 'materials', matId), updatedMaterial);
      } catch (err) {
        console.warn('Error updating material in Firestore:', err);
      }
      
      showNotification(`Material "${updatedMaterial.name}" actualizado`);
      setEditingMaterial(null);
    }
  };

  // Open custom delete dialog
  const handleDeleteMaterial = (materialTarget: Material | string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    let targetObj: Material | null = null;
    if (typeof materialTarget === 'string') {
      targetObj = materials.find(m => (m.id && m.id === materialTarget) || m.name.toLowerCase() === materialTarget.toLowerCase()) || null;
      if (!targetObj) {
        targetObj = { name: materialTarget, category: '', unit: '', estimatedPrice: 0, id: materialTarget };
      }
    } else {
      targetObj = materialTarget;
    }

    if (targetObj) {
      setMaterialToDelete(targetObj);
    }
  };

  // Perform actual deletion when user confirms in modal
  const confirmDeleteMaterial = async (target: Material) => {
    if (!target) return;
    const targetId = target.id;
    const targetName = target.name;

    const isMatch = (m: Material) => {
      if (m === target) return true;
      if (targetId && m.id && m.id === targetId) return true;
      if (targetName && m.name && m.name.toLowerCase() === targetName.toLowerCase()) return true;
      return false;
    };

    // 1. Remove from local state and update localStorage immediately
    setMaterials(prev => {
      const nextList = prev.filter(m => !isMatch(m));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
      } catch (err) {
        console.error('Error saving updated materials to localStorage:', err);
      }
      return nextList;
    });

    if (selectedMaterial && isMatch(selectedMaterial)) {
      setSelectedMaterial(null);
    }
    if (editingMaterial && isMatch(editingMaterial)) {
      setEditingMaterial(null);
    }

    setMaterialToDelete(null);

    // 2. Remove from Firestore database if targetId exists
    if (targetId) {
      try {
        await deleteDoc(doc(db, 'materials', targetId));
      } catch (err) {
        console.warn('Document not in Firestore or offline delete:', err);
      }
    }

    showNotification(`Material "${targetName}" eliminado del catálogo`);
  };

  // Trigger custom reset modal
  const handleResetDefaults = () => {
    setIsConfirmingReset(true);
  };

  const confirmResetDefaults = () => {
    setMaterials(CONSTRUCTION_MATERIALS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error(e);
    }
    setIsConfirmingReset(false);
    showNotification('Catálogo restaurado a valores por defecto');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Toast Notification */}
      {statusMessage && (
        <div className="fixed bottom-6 right-6 z-[120] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 text-sm font-bold flex items-center gap-2 animate-in slide-in-from-bottom-5">
          <Check className="w-4 h-4 text-emerald-400" />
          {statusMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Mercado Chileno Vigente
            </span>
            <span className="text-xs text-slate-400 font-bold">
              • {materials.length} Insumos en Catálogo
            </span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Buscador y Catálogo de Materiales</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
            Precios referenciales editables en CLP (Sodimac Constructor, Imperial, Construmart, Salomon Sack, Easy, MTS)
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {projectId && quotations.length > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-3.5 py-2.5 rounded-xl border border-blue-100 dark:border-blue-800">
              <ShoppingCart className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Cotización Destino</span>
                <select 
                  value={selectedQuotationId}
                  onChange={(e) => setSelectedQuotationId(e.target.value)}
                  className="bg-transparent text-sm font-bold text-slate-800 dark:text-white outline-none cursor-pointer"
                >
                  {quotations.map(q => (
                    <option key={q.id} value={q.id} className="dark:bg-slate-900">{q.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Action Buttons: Add Custom & Reset */}
          <button
            onClick={handleOpenCreate}
            className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-wider text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nuevo Insumo
          </button>

          <button
            onClick={handleResetDefaults}
            title="Restaurar a los precios predeterminados de fábrica"
            className="p-3 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 rounded-xl transition-all shadow-sm"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="relative group min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Filtrar catálogo rápido..."
              className="pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none w-full transition-all dark:text-white shadow-sm text-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* AI Material & Project Search Engine */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 sm:p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden border border-slate-800">
        <div className="relative z-10 max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2.5 rounded-2xl shadow-lg shadow-blue-600/30">
                <Sparkles className="w-6 h-6 text-white animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                  Buscador Inteligente con IA
                  <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-md font-bold uppercase tracking-widest border border-blue-400/30">Gemini</span>
                </h2>
                <p className="text-xs text-slate-400 font-medium">Calcula especificaciones técnicas, unidades estándar y precios en CLP.</p>
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="flex bg-white/10 p-1 rounded-xl border border-white/10 text-xs font-bold">
              <button
                type="button"
                onClick={() => setSearchMode('material')}
                className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${searchMode === 'material' ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}
              >
                <Package className="w-3.5 h-3.5" />
                Por Material Específico
              </button>
              <button
                type="button"
                onClick={() => setSearchMode('project')}
                className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${searchMode === 'project' ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:text-white'}`}
              >
                <Layers className="w-3.5 h-3.5" />
                Por Cubicación de Obra
              </button>
            </div>
          </div>

          <form onSubmit={handleAISearch} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder={searchMode === 'material' 
                    ? "Ej: Cemento Melón Especial, Tornillo 8x1/2 lenteja, Metalcon 60x38, Volcanita 12.5mm..." 
                    : "Ej: Radier de 4x5m e=10cm, Muro tabique Metalcon 15m2, Techumbre zinc 40m2..."
                  }
                  className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/15 rounded-2xl text-white placeholder:text-slate-400 focus:bg-white/15 outline-none transition-all focus:border-blue-400 shadow-inner text-sm font-medium"
                  value={aiQuery}
                  onChange={e => setAiQuery(e.target.value)}
                />
              </div>
              <button 
                type="submit"
                disabled={isSuggesting || !aiQuery.trim()}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-xl shadow-blue-600/30 disabled:opacity-50 flex items-center justify-center gap-2.5 min-w-[170px]"
              >
                {isSuggesting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Buscando con IA...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {searchMode === 'material' ? 'Buscar Insumo' : 'Calcular Obra'}
                  </>
                )}
              </button>
            </div>

            {/* Suggestions shortcuts */}
            <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
              <span className="text-slate-400 font-medium">Búsquedas rápidas:</span>
              {(searchMode === 'material' 
                ? ['Cemento Melón Especial 25kg', 'Metalcon Montante 60x38', 'Tornillo Autoperforante Lenteja 8x1/2', 'Volcanita RH 12.5mm', 'Fierro 10mm estriado', 'Pino 2x4 seco']
                : ['Radier 3x4m con malla acma', 'Tabique Metalcon 12m2', 'Techumbre zinc 35m2', 'Muro albañilería ladrillo 10m2']
              ).map(suggestion => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => { setAiQuery(suggestion); }}
                  className="px-2.5 py-1 bg-white/5 hover:bg-white/15 border border-white/10 rounded-lg text-slate-300 hover:text-white transition-colors text-[11px]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </form>

          {aiSearchSuccess && (
            <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-400/40 rounded-xl text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-300">
              <Check className="w-4 h-4 text-emerald-400" />
              ¡Resultados técnicos actualizados e incorporados a tu catálogo!
            </div>
          )}
        </div>

        <div className="absolute -top-12 -right-12 opacity-5 pointer-events-none">
          <Building2 className="w-80 h-80" />
        </div>
      </div>

      {/* Category Pills Filter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" /> Categorías de Construcción
          </span>
          <span className="text-xs text-slate-400 font-medium">
            Mostrando {filteredMaterials.length} de {materials.length} materiales
          </span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {INITIAL_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5 ${
                selectedCategory === cat 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 ring-2 ring-blue-500/30' 
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Material Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredMaterials.map((material, idx) => (
          <div 
            key={material.id || idx} 
            className={`bg-white dark:bg-slate-900 p-6 rounded-2xl border transition-all group flex flex-col h-full relative ${
              material.isAIGenerated 
                ? 'border-blue-200 dark:border-blue-800/80 shadow-sm hover:shadow-xl hover:border-blue-400 dark:hover:border-blue-600' 
                : 'border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-3 gap-2">
              <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-widest truncate max-w-[150px]">
                {material.category}
              </span>
              
              <div className="flex items-center gap-1 ml-auto">
                {material.isAIGenerated && (
                  <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded text-[9px] font-black uppercase tracking-wider flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" /> IA
                  </span>
                )}

                {/* Delete Button */}
                <button 
                  type="button"
                  onClick={(e) => handleDeleteMaterial(material, e)}
                  title="Eliminar este insumo del catálogo"
                  className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                {/* Edit Button */}
                <button 
                  onClick={(e) => handleOpenEdit(material, e)}
                  title="Editar datos y precio manualmente"
                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>

                {/* Info Button */}
                <button 
                  onClick={() => setSelectedMaterial(material)}
                  title="Ver ficha técnica completa"
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>

                {/* Add to Quotation */}
                {onAddToQuotation && (
                  <button 
                    onClick={() => handleAdd(material)}
                    title="Agregar a cotización"
                    className={`p-2 rounded-xl transition-all shadow-sm ${addedItems.has(material.id || '') ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                  >
                    {addedItems.has(material.id || '') ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>

            <h3 
              onClick={() => setSelectedMaterial(material)}
              className="font-black text-slate-900 dark:text-white mb-2 leading-snug text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors cursor-pointer"
            >
              {material.name}
            </h3>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 line-clamp-2 flex-1 font-medium leading-relaxed">
              {material.description || 'Material certificado para construcción y obras en Chile.'}
            </p>

            {/* Suppliers tags */}
            <div className="mb-4 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <Store className="w-3 h-3 text-indigo-500" /> Distribuidores
              </p>
              <div className="flex flex-wrap gap-1">
                {(material.suppliers || ['Sodimac Constructor', 'Imperial', 'Construmart']).slice(0, 3).map((sup, sIdx) => (
                  <span key={sIdx} className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-md text-[9px] font-bold text-slate-600 dark:text-slate-400">
                    {sup}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="flex items-end justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <div>
                <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5 flex items-center gap-1">
                  Precio Ref. CLP
                  <button 
                    onClick={(e) => handleOpenEdit(material, e)}
                    className="text-slate-400 hover:text-amber-500 text-[10px]"
                    title="Editar precio"
                  >
                    ✏️
                  </button>
                </p>
                <p className="text-xl font-black text-slate-900 dark:text-white">
                  ${(material.estimatedPrice || 0).toLocaleString('es-CL')}
                </p>
              </div>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                {material.unit}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Manual Editing & Creation Modal */}
      {(editingMaterial || isCreatingNew) && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => { setEditingMaterial(null); setIsCreatingNew(false); }}
          ></div>
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600 text-white rounded-xl">
                  {isCreatingNew ? <Plus className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    {isCreatingNew ? 'Crear Nuevo Insumo' : 'Editar Datos del Material'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isCreatingNew ? 'Ingresa los campos técnicos y precio referencial en Chile' : 'Modifica los valores manualmente según tus cotizaciones'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { setEditingMaterial(null); setIsCreatingNew(false); }}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMaterial} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Nombre del Insumo / Material *
                </label>
                <input 
                  type="text"
                  required
                  placeholder="Ej: Cemento Melón Especial 25kg, Metalcon 60x38x0.85..."
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Categoría de Construcción *
                  </label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                  >
                    {INITIAL_CATEGORIES.filter(c => c !== 'Todos').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Unidad de Medida / Venta *
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="Ej: Saco 25kg, Tira 3m, Plancha, m3, kg, Caja 1000u..."
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Precio Estimado de Referencia (CLP $) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                    <input 
                      type="number"
                      required
                      min="0"
                      step="10"
                      placeholder="Ej: 4390"
                      className="w-full pl-8 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.estimatedPrice}
                      onChange={e => setFormData({ ...formData, estimatedPrice: Number(e.target.value) })}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Precio neto o con IVA según tu criterio contable.</p>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Marca / Fabricante (Opcional)
                  </label>
                  <input 
                    type="text"
                    placeholder="Ej: Melón, Bío Bío, Cintac, Volcán, Sika..."
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.brand}
                    onChange={e => setFormData({ ...formData, brand: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Descripción y Especificaciones Técnicas
                </label>
                <textarea 
                  rows={3}
                  placeholder="Detalles sobre uso, dosificación, norma chilena o rendimiento..."
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Tiendas y Distribuidores (Separados por coma)
                </label>
                <input 
                  type="text"
                  placeholder="Ej: Sodimac Constructor, Imperial, Construmart, Salomon Sack"
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.suppliersText}
                  onChange={e => setFormData({ ...formData, suppliersText: e.target.value })}
                />
              </div>

              <div className="pt-4 flex items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800">
                {!isCreatingNew && editingMaterial && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteMaterial(editingMaterial, e)}
                    className="px-4 py-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-xl font-black text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar
                  </button>
                )}

                <div className="flex items-center gap-3 ml-auto">
                  <button
                    type="button"
                    onClick={() => { setEditingMaterial(null); setIsCreatingNew(false); }}
                    className="px-5 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {isCreatingNew ? 'Crear Insumo' : 'Guardar Cambios'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Material Detail Modal */}
      {selectedMaterial && !editingMaterial && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={() => setSelectedMaterial(null)}></div>
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300">
            <div className="relative h-44 bg-gradient-to-br from-blue-900 to-slate-900 flex items-center justify-center overflow-hidden">
              <Package className="w-20 h-20 text-white/20" />
              
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <button 
                  onClick={() => handleOpenEdit(selectedMaterial)}
                  className="p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors backdrop-blur-md"
                  title="Editar este material"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setSelectedMaterial(null)}
                  className="p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors backdrop-blur-md"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
                <span className="px-3 py-1 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full">
                  {selectedMaterial.category}
                </span>
                {selectedMaterial.isAIGenerated && (
                  <span className="px-2.5 py-1 bg-white/20 text-white text-[10px] font-bold rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-300" /> Verificado IA
                  </span>
                )}
              </div>
            </div>
            
            <div className="p-8">
              <div className="flex items-start justify-between gap-4 mb-2">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight uppercase tracking-tighter">
                  {selectedMaterial.name}
                </h2>
              </div>

              <p className="text-slate-600 dark:text-slate-300 mb-6 font-medium leading-relaxed text-sm">
                {selectedMaterial.description || 'Material estándar para obras y proyectos en Chile.'}
              </p>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Precio Ref. CLP</p>
                    </div>
                    <button 
                      onClick={() => handleOpenEdit(selectedMaterial)}
                      className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline"
                    >
                      Editar
                    </button>
                  </div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">
                    ${(selectedMaterial.estimatedPrice || 0).toLocaleString('es-CL')}
                  </p>
                  <p className="text-[9px] text-slate-400 mt-0.5">Precio de referencia editable</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-1">
                    <Tag className="w-4 h-4 text-blue-600" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidad de Venta</p>
                  </div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{selectedMaterial.unit}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">Comercial estándar</p>
                </div>
              </div>

              <div className="space-y-3 mb-8">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiendas y Distribuidores Recomendados</p>
                <div className="flex flex-wrap gap-2">
                  {(selectedMaterial.suppliers || ['Sodimac Constructor', 'Imperial', 'Construmart', 'Easy', 'Ferreterías MTS']).map(p => (
                    <span key={p} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300">
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                {onAddToQuotation && (
                  <button 
                    onClick={() => { handleAdd(selectedMaterial); setSelectedMaterial(null); }}
                    className="flex-1 py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar a Cotización
                  </button>
                )}
                {onNavigateToSuppliers && (
                  <button 
                    onClick={() => { 
                      const matName = selectedMaterial.name;
                      setSelectedMaterial(null);
                      onNavigateToSuppliers(matName);
                    }}
                    className="py-4 px-6 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 font-black uppercase tracking-widest text-xs rounded-2xl transition-all border border-indigo-200 dark:border-indigo-800 flex items-center justify-center gap-2"
                  >
                    <Store className="w-4 h-4" />
                    Ver Proveedores IA
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {filteredMaterials.length === 0 && (
        <div className="py-20 text-center bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-8">
          <Package className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
          <p className="text-slate-700 dark:text-slate-300 font-black uppercase tracking-widest text-lg">No se encontraron insumos en esta categoría</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto mb-6">
            Puedes agregar un material personalizado manualmente o buscarlo con el motor de IA.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleOpenCreate}
              className="px-5 py-3 bg-blue-600 text-white font-black uppercase tracking-wider text-xs rounded-xl hover:bg-blue-500 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Crear Insumo Manualmente
            </button>
            <button
              onClick={() => setSelectedCategory('Todos')}
              className="px-5 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
            >
              Ver Todas las Categorías
            </button>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {materialToDelete && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setMaterialToDelete(null)}
          ></div>
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-4">
              <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">¿Eliminar Insumo del Catálogo?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            
            <p className="text-sm text-slate-600 dark:text-slate-300 font-medium mb-6 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
              ¿Confirma que desea eliminar el material <strong className="text-slate-900 dark:text-white font-bold">"{materialToDelete.name}"</strong>?
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setMaterialToDelete(null)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteMaterial(materialToDelete)}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-md shadow-red-600/30 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Reset Confirmation Modal */}
      {isConfirmingReset && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setIsConfirmingReset(false)}
          ></div>
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 mb-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Restaurar Catálogo Predeterminado</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Restablece la lista inicial del mercado chileno.</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 font-medium mb-6">
              Se revertirán todos los insumos a los valores y precios base por defecto.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsConfirmingReset(false)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmResetDefaults}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
              >
                Restaurar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
