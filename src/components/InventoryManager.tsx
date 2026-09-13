import React, { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, auth } from '../lib/firebase';
import { InventoryItem, Project } from '../types';
import { 
  Package, Plus, Search, Filter, Trash2, Edit2, Check, X, 
  ChevronRight, AlertTriangle, ArrowUpDown, CornerDownRight, 
  MapPin, ShieldCheck, User, RefreshCw, Calendar, Minus, Building2
} from 'lucide-react';
import { formatCLP } from '../lib/pdfExport';

interface InventoryManagerProps {
  projectId?: string;
}

const CATEGORIES = [
  { id: 'all', label: 'Todos los Items' },
  { id: 'materials', label: 'Materiales' },
  { id: 'tools', label: 'Herramientas y Equipos' },
  { id: 'safety', label: 'Seguridad (EPP)' },
  { id: 'consumibles', label: 'Consumibles y Clavos' },
  { id: 'other', label: 'Otros' }
];

const PRESET_UNITS = [
  'UN', 'C/U', 'SACOS', 'KG', 'TON', 'M', 'ML', 'M2', 'M3', 'LT', 'GAL', 'TIRAS', 'PLC', 'RLL', 'CAJA', 'PAR', 'JGO'
];

export default function InventoryManager({ projectId }: InventoryManagerProps) {
  const isGlobal = !projectId || projectId === 'global';
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: 'materials' as 'materials' | 'tools' | 'safety' | 'consumibles' | 'other',
    quantity: 1,
    unit: 'UN',
    location: '',
    status: 'available' as 'available' | 'in-use' | 'low-stock' | 'out-of-stock',
    responsible: '',
    notes: '',
    itemProjectId: 'global'
  });

  // Edit State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<InventoryItem['status']>('available');

  // Load Projects for Global Reference
  useEffect(() => {
    const qProjects = query(collection(db, 'projects'));
    const unsubscribe = onSnapshot(qProjects, (snapshot) => {
      const list = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Project[];
      setProjects(list);
    });
    return unsubscribe;
  }, []);

  // Load Inventory Items
  useEffect(() => {
    let q;
    if (projectId && projectId !== 'global') {
      q = query(collection(db, 'inventory'), where('projectId', '==', projectId));
    } else {
      q = query(collection(db, 'inventory'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as InventoryItem[];
      setItems(list);
    });

    return unsubscribe;
  }, [projectId]);

  // Filters
  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.location && item.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.responsible && item.responsible.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    
    // Project filter (only applicable in global mode)
    const matchesProject = !isGlobal || selectedProjectFilter === 'all' || 
      (selectedProjectFilter === 'global' && (!item.projectId || item.projectId === 'global')) ||
      (item.projectId === selectedProjectFilter);

    return matchesSearch && matchesCategory && matchesProject;
  });

  // Form Submission
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      const resolvedProjectId = isGlobal ? formData.itemProjectId : (projectId || 'global');
      await addDoc(collection(db, 'inventory'), {
        projectId: resolvedProjectId,
        name: formData.name.trim(),
        category: formData.category,
        quantity: Math.max(0, formData.quantity),
        unit: formData.unit,
        location: formData.location.trim() || 'Bodega Central',
        status: formData.status,
        responsible: formData.responsible.trim() || '',
        lastUpdated: new Date().toISOString(),
        ownerId: auth.currentUser?.uid || 'user',
        notes: formData.notes.trim()
      });

      setShowAddModal(false);
      setFormData({
        name: '',
        category: 'materials',
        quantity: 1,
        unit: 'UN',
        location: '',
        status: 'available',
        responsible: '',
        notes: '',
        itemProjectId: 'global'
      });
    } catch (error) {
      console.error("Error creating inventory item:", error);
      alert("Hubo un error al registrar el artículo en bodega.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick updates
  const handleUpdateQuantity = async (itemId: string, newQty: number) => {
    const targetItem = items.find(i => i.id === itemId);
    if (!targetItem) return;
    
    const quantity = Math.max(0, newQty);
    let status = targetItem.status;
    
    if (quantity === 0) {
      status = 'out-of-stock';
    } else if (quantity < 5 && status === 'available') {
      status = 'low-stock';
    } else if (quantity >= 5 && status === 'low-stock') {
      status = 'available';
    }

    try {
      await updateDoc(doc(db, 'inventory', itemId), {
        quantity,
        status,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error updating quantity:", error);
    }
  };

  const handleUpdateStatus = async (itemId: string, status: InventoryItem['status']) => {
    try {
      await updateDoc(doc(db, 'inventory', itemId), {
        status,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete?.id) return;
    try {
      await deleteDoc(doc(db, 'inventory', itemToDelete.id));
      setItemToDelete(null);
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("Hubo un error al eliminar el artículo.");
    }
  };

  // Stats
  const totalItemsCount = items.length;
  const lowStockCount = items.filter(i => i.status === 'low-stock').length;
  const outOfStockCount = items.filter(i => i.status === 'out-of-stock').length;
  const toolsInUseCount = items.filter(i => i.category === 'tools' && i.status === 'in-use').length;

  return (
    <div className="space-y-6">
      {/* HEADER WIDGETS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Total Artículos</p>
          <div className="flex items-center justify-between">
            <h4 className="text-2xl font-black text-zinc-900 dark:text-white">{totalItemsCount}</h4>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">{isGlobal ? 'Registrados globalmente' : 'Registrados en esta obra'}</p>
        </div>

        <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Bajo Stock</p>
          <div className="flex items-center justify-between">
            <h4 className="text-2xl font-black text-amber-600 dark:text-amber-400">{lowStockCount}</h4>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">Requieren reposición pronto</p>
        </div>

        <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Agotados</p>
          <div className="flex items-center justify-between">
            <h4 className="text-2xl font-black text-red-600 dark:text-red-400">{outOfStockCount}</h4>
            <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400">
              <X className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">Stock en cero en bodega</p>
        </div>

        <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Herramientas en Terreno</p>
          <div className="flex items-center justify-between">
            <h4 className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{toolsInUseCount}</h4>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400">
              <User className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">Asignados a personal</p>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* Search & Project Filter combo */}
        <div className="flex flex-col sm:flex-row gap-3 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
            <input 
              type="text"
              className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Buscar material, herramienta, responsable..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {isGlobal && (
            <div className="relative w-full sm:w-64">
              <Building2 className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
              <select
                className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                value={selectedProjectFilter}
                onChange={e => setSelectedProjectFilter(e.target.value)}
              >
                <option value="all">Filtrar por Obra: Todas</option>
                <option value="global">Inventario General (Sin Obra)</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 xl:pb-0 scrollbar-none">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Add Button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center gap-2 transition-all text-xs font-bold shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Ingresar Bodega</span>
        </button>
      </div>

      {/* INVENTORY TABLE/GRID */}
      <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                <th className="px-5 py-3.5">Artículo / Recurso</th>
                {isGlobal && <th className="px-5 py-3.5">Obra / Proyecto</th>}
                <th className="px-5 py-3.5">Categoría</th>
                <th className="px-5 py-3.5 text-center">Stock</th>
                <th className="px-5 py-3.5">Ubicación Estantería</th>
                <th className="px-5 py-3.5">Estado</th>
                <th className="px-5 py-3.5">Responsable / Uso</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 text-xs text-zinc-700 dark:text-zinc-300">
              {filteredItems.map(item => {
                const isEditing = editingItemId === item.id;
                const catLabel = CATEGORIES.find(c => c.id === item.category)?.label || item.category;
                
                const statusStyles = {
                  available: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30',
                  'in-use': 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-100 dark:border-blue-900/30',
                  'low-stock': 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-100 dark:border-amber-900/30',
                  'out-of-stock': 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-red-100 dark:border-red-900/30',
                };

                const statusText = {
                  available: 'Disponible',
                  'in-use': 'En Uso / Terreno',
                  'low-stock': 'Bajo Stock',
                  'out-of-stock': 'Agotado',
                };

                const matchedProject = projects.find(p => p.id === item.projectId);

                return (
                  <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                    {/* Name */}
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-2.5">
                        <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-zinc-500 shrink-0">
                          <Package className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-zinc-900 dark:text-white truncate">{item.name}</p>
                          {item.notes && <p className="text-[10px] text-zinc-400 dark:text-zinc-500 italic mt-0.5 max-w-xs truncate">{item.notes}</p>}
                        </div>
                      </div>
                    </td>

                    {/* Project Column if Global */}
                    {isGlobal && (
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          !item.projectId || item.projectId === 'global'
                            ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                            : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-100 dark:border-blue-900/30'
                        }`}>
                          <Building2 className="w-3 h-3" />
                          <span className="truncate max-w-[150px]">{matchedProject ? matchedProject.name : 'Inventario General'}</span>
                        </span>
                      </td>
                    )}

                    {/* Category */}
                    <td className="px-5 py-4">
                      <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded-md uppercase">
                        {catLabel}
                      </span>
                    </td>

                    {/* Quantity */}
                    <td className="px-5 py-4 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setEditQuantity(Math.max(0, editQuantity - 1))}
                            className="p-1 rounded bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 text-zinc-600 cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input 
                            type="number"
                            className="w-12 text-center py-0.5 border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 rounded font-mono text-xs font-bold"
                            value={editQuantity}
                            onChange={e => setEditQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                          />
                          <button
                            onClick={() => setEditQuantity(editQuantity + 1)}
                            className="p-1 rounded bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 text-zinc-600 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center">
                          <span className="font-mono font-black text-sm text-zinc-900 dark:text-white">
                            {item.quantity}
                          </span>
                          <span className="text-[9px] text-zinc-400 font-bold uppercase">{item.unit}</span>
                        </div>
                      )}
                    </td>

                    {/* Location */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                        <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="truncate max-w-[140px]">{item.location || 'Bodega Central'}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      {isEditing ? (
                        <select
                          className="px-2 py-1 text-xs border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 rounded outline-none"
                          value={editStatus}
                          onChange={e => setEditStatus(e.target.value as any)}
                        >
                          <option value="available">Disponible</option>
                          <option value="in-use">En Uso</option>
                          <option value="low-stock">Bajo Stock</option>
                          <option value="out-of-stock">Agotado</option>
                        </select>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusStyles[item.status]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            item.status === 'available' ? 'bg-emerald-500' :
                            item.status === 'in-use' ? 'bg-blue-500' :
                            item.status === 'low-stock' ? 'bg-amber-500' : 'bg-red-500'
                          }`}></span>
                          {statusText[item.status]}
                        </span>
                      )}
                    </td>

                    {/* Responsible */}
                    <td className="px-5 py-4">
                      {item.responsible ? (
                        <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                          <div className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-900 text-[10px] flex items-center justify-center font-bold text-zinc-500 border border-zinc-200 dark:border-zinc-800">
                            {item.responsible[0].toUpperCase()}
                          </div>
                          <span className="font-semibold truncate max-w-[120px]">{item.responsible}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-500 italic text-[11px]">No asignado</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isEditing ? (
                          <>
                            <button
                              onClick={async () => {
                                try {
                                  await updateDoc(doc(db, 'inventory', item.id!), {
                                    quantity: editQuantity,
                                    status: editStatus,
                                    lastUpdated: new Date().toISOString()
                                  });
                                  setEditingItemId(null);
                                } catch (error) {
                                  console.error("Error saving edits:", error);
                                }
                              }}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-all cursor-pointer"
                              title="Guardar cambios"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingItemId(null)}
                              className="p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition-all cursor-pointer"
                              title="Cancelar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEditingItemId(item.id!);
                                setEditQuantity(item.quantity);
                                setEditStatus(item.status);
                              }}
                              className="p-1.5 text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition-all cursor-pointer"
                              title="Editar stock rápido"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setItemToDelete(item)}
                              className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all cursor-pointer"
                              title="Eliminar de bodega"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={isGlobal ? 8 : 7} className="px-5 py-12 text-center text-zinc-400 dark:text-zinc-500 italic">
                    {items.length === 0 
                      ? 'No hay insumos registrados en el inventario. Comienza ingresando materiales, herramientas o EPP para llevar el control.'
                      : 'Ningún artículo coincide con los filtros aplicados.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ADD TO INVENTORY */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-white uppercase tracking-tight text-sm">Registrar Insumo en Bodega</h3>
                <p className="text-xs text-zinc-500">Registra materiales, herramientas o equipos en bodega</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors cursor-pointer">
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-4">
              {/* Project Assignment Selector inside Form (Only in global mode) */}
              {isGlobal && (
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1.5 tracking-wider">Asignar a Obra / Destino</label>
                  <select
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none text-xs text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    value={formData.itemProjectId}
                    onChange={e => setFormData({ ...formData, itemProjectId: e.target.value })}
                  >
                    <option value="global">Inventario General (Sin Obra)</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1.5 tracking-wider">Nombre del Recurso / Artículo *</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none text-xs text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Pala Punta Huevo Tramontina, Casco Seguridad, Clavos"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1.5 tracking-wider">Categoría</label>
                  <select
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none text-xs text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value as any })}
                  >
                    <option value="materials">Materiales</option>
                    <option value="tools">Herramientas/Equipos</option>
                    <option value="safety">Seguridad (EPP)</option>
                    <option value="consumibles">Consumibles/Otros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1.5 tracking-wider">Estado Inicial</label>
                  <select
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none text-xs text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                  >
                    <option value="available">Disponible</option>
                    <option value="in-use">En Uso</option>
                    <option value="low-stock">Bajo Stock</option>
                    <option value="out-of-stock">Agotado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1.5 tracking-wider">Cantidad Inicial *</label>
                  <input 
                    type="number" 
                    required
                    min={0}
                    className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none text-xs text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    value={formData.quantity}
                    onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1.5 tracking-wider">Unidad</label>
                  <select
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none text-xs text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                  >
                    {PRESET_UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1.5 tracking-wider">Estante / Ubicación</label>
                  <input 
                    type="text" 
                    className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none text-xs text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Estante B-3, Patio Fierros"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1.5 tracking-wider">Responsable asignado</label>
                  <input 
                    type="text" 
                    className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none text-xs text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Capataz Pedro Reyes"
                    value={formData.responsible}
                    onChange={e => setFormData({ ...formData, responsible: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1.5 tracking-wider">Glosa de Notas o Especificaciones</label>
                <textarea 
                  className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none text-xs text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 h-16 resize-none"
                  placeholder="Ej: Con certificado CESMEC, de marca Stanley, etc."
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold text-xs cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Registrar Artículo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-red-100 dark:border-red-900/30">
            <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 rounded-xl w-fit mb-4">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-zinc-900 dark:text-white text-sm uppercase tracking-tight">¿Eliminar de la Bodega?</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
              Estás a punto de eliminar el artículo <strong className="text-zinc-800 dark:text-white">"{itemToDelete.name}"</strong> de los registros de esta bodega. Esta operación no se puede deshacer.
            </p>
            <div className="flex items-center gap-2 mt-5 justify-end">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-3 py-2 text-xs font-bold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteItem}
                className="px-3 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl cursor-pointer shadow-sm"
              >
                Eliminar Registro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
