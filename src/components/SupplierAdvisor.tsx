import React, { useState, useEffect, useMemo } from 'react';
import { 
  Store, Search, Sparkles, MapPin, Tag, Lightbulb, ChevronRight, CheckCircle2, 
  DollarSign, Building2, Truck, ShieldAlert, Award, SlidersHorizontal, 
  RotateCcw, Clock, ArrowUpDown, Filter, ChevronDown, Check, Phone, ExternalLink,
  PackageCheck, HelpCircle, Layers
} from 'lucide-react';
import { getSupplierSuggestions } from '../lib/gemini';
import { SupplierSuggestion, SupplierDetail, SupplierFilterParams } from '../types';

interface SupplierAdvisorProps {
  initialQuery?: string;
}

const CHILEAN_REGIONS = [
  { id: 'Todas', name: 'Todas las Regiones (Nacional)' },
  { id: 'Región Metropolitana', name: 'Región Metropolitana (Santiago)' },
  { id: 'Valparaíso', name: 'V Región de Valparaíso (Viña / Valparaíso / Quillota)' },
  { id: 'Biobío', name: 'VIII Región del Biobío (Concepción / Talcahuano / Los Ángeles)' },
  { id: 'Coquimbo', name: 'IV Región de Coquimbo (La Serena / Coquimbo / Ovalle)' },
  { id: 'O\'Higgins', name: 'VI Región de O\'Higgins (Rancagua / San Fernando)' },
  { id: 'Maule', name: 'VII Región del Maule (Talca / Curicó / Linares)' },
  { id: 'Araucanía', name: 'IX Región de la Araucanía (Temuco / Padre Las Casas)' },
  { id: 'Los Lagos', name: 'X Región de Los Lagos (Puerto Montt / Osorno / Chiloé)' },
  { id: 'Antofagasta', name: 'II Región de Antofagasta (Antofagasta / Calama)' },
  { id: 'Norte Grande', name: 'Norte de Chile (Arica / Iquique / Copiapó)' },
  { id: 'Sur Austral', name: 'Zona Austral (Valdivia / Coyhaique / Punta Arenas)' }
];

const CHILEAN_SUPPLIERS = [
  { 
    name: 'Sodimac Constructor', 
    badge: 'Gran Cobertura',
    category: 'Obra Gruesa & General',
    focus: 'Obra gruesa, tabiquería, techumbres, pinturas, herramientas y fijaciones.', 
    advantage: 'Despacho directo con camión grúa/pluma a obra, crédito empresa con RUT, amplio stock inmediato a nivel nacional.',
    branches: 'Más de 60 patios constructores en todo Chile',
    perk: 'Círculo Especialistas (hasta 5% beneficio) + Factura con RUT'
  },
  { 
    name: 'Imperial', 
    badge: 'Especialista Maderas & Tableros',
    category: 'Maderas & Mueblería',
    focus: 'Maderas secas en cámara, terciados, tableros OSB, melaminas, metalcon y quincallería.', 
    advantage: 'Servicio de dimensionado computarizado exacto, mejores precios por volumen en tableros y tabiquería.',
    branches: 'Santiago (10+ tiendas), Viña del Mar, Concepción, Temuco, Puerto Montt',
    perk: 'Dimensionado computarizado + Lista de cortes para obra'
  },
  { 
    name: 'Construmart', 
    badge: 'Precios Mayoristas',
    category: 'Obra Gruesa & Áridos',
    focus: 'Cementos, áridos, fierros, aislación y materiales pesados de construcción.', 
    advantage: 'Precios altamente competitivos por pallet cerrado y despacho coordinado para obras en ejecución.',
    branches: 'Red nacional de centros de distribución de Arica a Puerto Montt',
    perk: 'Descuento contratista por pallet de cemento y fierro'
  },
  { 
    name: 'Salomon Sack', 
    badge: 'Líder en Acero',
    category: 'Acero Estructural',
    focus: 'Fierro estriado A630/420H, mallas acma electrosoldadas, perfiles tubulares, vigas y ángulos.', 
    advantage: 'Distribuidor mayorista directo con certificación estructural de fábrica y ahorro en compras por tonelada o atado.',
    branches: 'Quilicura, San Bernardo, Maipú, Viña del Mar, Concepción',
    perk: 'Precios mayoristas por tonelada con certificado de calidad NCh'
  },
  { 
    name: 'Red MTS & Chilemat', 
    badge: 'Ferretería Local',
    category: 'Ferretería & Red Comunal',
    focus: 'Ferretería general, gasfitería, electricidad, adhesivos y obra gruesa.', 
    advantage: 'Presencia en todas las comunas, atención personalizada y despacho ágil para imprevistos en faena.',
    branches: 'Más de 350 ferreterías asociadas en todas las comunas de Chile',
    perk: 'Atención personalizada y despacho express de cercanía'
  },
  { 
    name: 'Yolito & Easy', 
    badge: 'Terminaciones',
    category: 'Terminaciones & Hogar',
    focus: 'Griferías, cerámicas, porcelanatos, pisos flotantes, cerraduras y herramientas profesionales.', 
    advantage: 'Gran catálogo en sala de ventas para selección de terminaciones con el cliente final.',
    branches: 'Presencia en centros urbanos y centros comerciales',
    perk: 'Variedad en salas de exhibición de terminaciones'
  }
];

const POPULAR_SEARCHES = [
  'Cemento Melón / Polpaico 25kg',
  'Fierro de construcción 10mm y 12mm',
  'Planchas de Volcanita ST y RH 12.5mm',
  'Pino Insigne Seco 2x4 y Terciado Estructural',
  'Perfiles Metalcon Estructural y Tabique',
  'Pintura Esmalte al Agua y Pasta Muro'
];

export default function SupplierAdvisor({ initialQuery = '' }: SupplierAdvisorProps) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<SupplierSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Structured Filter States
  const [selectedRegion, setSelectedRegion] = useState<string>('Todas');
  const [priceCriterion, setPriceCriterion] = useState<'all' | 'economic' | 'wholesale' | 'quality'>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'immediate' | '24h' | 'order'>('all');
  const [deliveryMode, setDeliveryMode] = useState<'all' | 'crane_truck' | 'store_pickup' | 'express'>('all');
  const [showFilterPanel, setShowFilterPanel] = useState<boolean>(true);
  
  // Sort State
  const [sortBy, setSortBy] = useState<'recommended' | 'price_low' | 'availability' | 'region'>('recommended');

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      executeSearch(initialQuery);
    }
  }, [initialQuery]);

  const executeSearch = async (
    searchTerm: string, 
    overrideFilters?: Partial<SupplierFilterParams>
  ) => {
    if (!searchTerm.trim()) return;
    setIsLoading(true);
    try {
      const materials = searchTerm.split(',').map(m => m.trim()).filter(Boolean);
      const filters: SupplierFilterParams = {
        query: searchTerm,
        materials,
        region: overrideFilters?.region !== undefined ? overrideFilters.region : selectedRegion,
        priceCriterion: overrideFilters?.priceCriterion !== undefined ? overrideFilters.priceCriterion : priceCriterion,
        availabilityFilter: overrideFilters?.availabilityFilter !== undefined ? overrideFilters.availabilityFilter : availabilityFilter,
        deliveryMode: overrideFilters?.deliveryMode !== undefined ? overrideFilters.deliveryMode : deliveryMode,
      };

      const data = await getSupplierSuggestions(materials, searchTerm, filters);
      if (data && Array.isArray(data)) {
        setSuggestions(data);
      }
    } catch (error) {
      console.error("Error getting structured supplier advice:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetAdvice = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    executeSearch(query);
  };

  const handleFilterChange = (updates: Partial<SupplierFilterParams>) => {
    if (updates.region !== undefined) setSelectedRegion(updates.region);
    if (updates.priceCriterion !== undefined) setPriceCriterion(updates.priceCriterion);
    if (updates.availabilityFilter !== undefined) setAvailabilityFilter(updates.availabilityFilter);
    if (updates.deliveryMode !== undefined) setDeliveryMode(updates.deliveryMode);

    if (query.trim()) {
      executeSearch(query, updates);
    }
  };

  const handleResetFilters = () => {
    setSelectedRegion('Todas');
    setPriceCriterion('all');
    setAvailabilityFilter('all');
    setDeliveryMode('all');
    setSortBy('recommended');
    if (query.trim()) {
      executeSearch(query, {
        region: 'Todas',
        priceCriterion: 'all',
        availabilityFilter: 'all',
        deliveryMode: 'all'
      });
    }
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedRegion !== 'Todas') count++;
    if (priceCriterion !== 'all') count++;
    if (availabilityFilter !== 'all') count++;
    if (deliveryMode !== 'all') count++;
    return count;
  }, [selectedRegion, priceCriterion, availabilityFilter, deliveryMode]);

  // Dynamic sorting
  const sortedSuggestions = useMemo(() => {
    if (!suggestions || suggestions.length === 0) return [];
    const cloned = [...suggestions];

    if (sortBy === 'price_low') {
      cloned.sort((a, b) => (a.minPrice || 0) - (b.minPrice || 0));
    } else if (sortBy === 'availability') {
      cloned.sort((a, b) => {
        const order = { 'Inmediata': 1, '24-48h': 2, 'Alta': 3, 'Por Pedido': 4 };
        const valA = order[a.availabilityStatus as keyof typeof order] || 5;
        const valB = order[b.availabilityStatus as keyof typeof order] || 5;
        return valA - valB;
      });
    }
    return cloned;
  }, [suggestions, sortBy]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Top Banner & Header */}
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20 flex-shrink-0">
              <Store className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full text-[10px] font-black uppercase tracking-wider">
                  Motor de Abastecimiento & Precios Chile
                </span>
                {activeFilterCount > 0 && (
                  <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 rounded-full text-[10px] font-black">
                    {activeFilterCount} filtros activos
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mt-1">
                Buscador & Asesor de Proveedores Chilenos
              </h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-xs sm:text-sm mt-0.5">
                Consultas estructuradas con filtrado por precio, cercanía geográfica (región/comuna) y disponibilidad de stock.
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleGetAdvice} className="space-y-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Busca por material o partida (ej: Cemento Melón 25kg, Fierro 10mm, Volcanita ST 12.5, Pino 2x4...)"
                className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white shadow-inner text-sm font-medium"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <button 
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-8 py-4 bg-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center gap-2.5 min-w-[200px]"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Consultando IA...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Consultar Proveedores
                </>
              )}
            </button>
          </div>

          {/* Quick Search Chips */}
          <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
            <span className="text-slate-400 font-medium">Búsquedas sugeridas:</span>
            {POPULAR_SEARCHES.map(item => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setQuery(item);
                  executeSearch(item);
                }}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-semibold transition-colors text-xs"
              >
                {item}
              </button>
            ))}
          </div>
        </form>

        {/* STRUCTURED FILTERS PANEL */}
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-5 mb-8">
          <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Filtros Estructurados de Búsqueda
              </span>
            </div>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-bold text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Limpiar filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Cercanía Geográfica / Región */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                Cercanía Geográfica / Región
              </label>
              <select
                value={selectedRegion}
                onChange={e => handleFilterChange({ region: e.target.value })}
                className="w-full py-2.5 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer"
              >
                {CHILEAN_REGIONS.map(reg => (
                  <option key={reg.id} value={reg.id}>
                    {reg.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Criterio de Precio */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                Filtro de Precio & Escala
              </label>
              <select
                value={priceCriterion}
                onChange={e => handleFilterChange({ priceCriterion: e.target.value as any })}
                className="w-full py-2.5 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer"
              >
                <option value="all">Todos los Niveles de Precio</option>
                <option value="economic">Más Económico / Ofertas de Faena</option>
                <option value="wholesale">Mayorista / Por Pallet o Tonelada</option>
                <option value="quality">Marcas Certificadas (NCh)</option>
              </select>
            </div>

            {/* 3. Disponibilidad de Materiales */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                <PackageCheck className="w-3.5 h-3.5 text-blue-500" />
                Disponibilidad de Stock
              </label>
              <select
                value={availabilityFilter}
                onChange={e => handleFilterChange({ availabilityFilter: e.target.value as any })}
                className="w-full py-2.5 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer"
              >
                <option value="all">Cualquier Disponibilidad</option>
                <option value="immediate">Stock Inmediato en Tienda / Patio</option>
                <option value="24h">Despacho Rápido (24 - 48 hrs)</option>
                <option value="order">Por Pedido / A Medida / Corte</option>
              </select>
            </div>

            {/* 4. Modalidad de Despacho */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-amber-500" />
                Logística & Despacho
              </label>
              <select
                value={deliveryMode}
                onChange={e => handleFilterChange({ deliveryMode: e.target.value as any })}
                className="w-full py-2.5 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer"
              >
                <option value="all">Todas las Modalidades</option>
                <option value="crane_truck">Camión Pluma / Grúa a Obra</option>
                <option value="store_pickup">Retiro en Patio Constructor</option>
                <option value="express">Despacho Express Mismo Día</option>
              </select>
            </div>
          </div>

          {/* Quick Active Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
            <span className="text-[10px] font-black uppercase text-slate-400">Contexto Aplicado:</span>
            <span className="px-2.5 py-1 bg-indigo-100/70 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 rounded-lg font-bold flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {CHILEAN_REGIONS.find(r => r.id === selectedRegion)?.name || selectedRegion}
            </span>
            {priceCriterion !== 'all' && (
              <span className="px-2.5 py-1 bg-emerald-100/70 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 rounded-lg font-bold flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                {priceCriterion === 'economic' ? 'Económico' : priceCriterion === 'wholesale' ? 'Mayorista' : 'Calidad Certificada'}
              </span>
            )}
            {availabilityFilter !== 'all' && (
              <span className="px-2.5 py-1 bg-blue-100/70 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded-lg font-bold flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {availabilityFilter === 'immediate' ? 'Stock Inmediato' : availabilityFilter === '24h' ? 'Despacho 24-48h' : 'Por Pedido'}
              </span>
            )}
            {deliveryMode !== 'all' && (
              <span className="px-2.5 py-1 bg-amber-100/70 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 rounded-lg font-bold flex items-center gap-1">
                <Truck className="w-3 h-3" />
                {deliveryMode === 'crane_truck' ? 'Camión Pluma' : deliveryMode === 'store_pickup' ? 'Retiro en Patio' : 'Despacho Express'}
              </span>
            )}
          </div>
        </div>

        {/* RESULTS SECTION */}
        {sortedSuggestions.length > 0 && (
          <div className="space-y-6">
            {/* Results Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Comparativa de Proveedores ({sortedSuggestions.length} material{sortedSuggestions.length > 1 ? 'es' : ''})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Precios estimados en Chile con IVA (19%) y disponibilidad según zona seleccionada.
                </p>
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Ordenar:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="py-1.5 px-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                >
                  <option value="recommended">Recomendado IA</option>
                  <option value="price_low">Menor Precio</option>
                  <option value="availability">Mayor Disponibilidad</option>
                </select>
              </div>
            </div>

            {/* Results Cards */}
            {sortedSuggestions.map((item, idx) => (
              <div 
                key={idx} 
                className="bg-white dark:bg-slate-900 border-2 border-indigo-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all shadow-md space-y-6"
              >
                {/* Header Row */}
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                        <Tag className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                          {item.category || 'Material de Construcción'}
                        </span>
                        <h3 className="font-black text-slate-900 dark:text-white text-xl sm:text-2xl uppercase tracking-tight">
                          {item.materialName}
                        </h3>
                      </div>
                    </div>

                    {/* Best Option Highlight */}
                    {item.bestOption && (
                      <div className="mt-3 inline-flex items-start sm:items-center gap-2.5 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200 rounded-2xl text-xs font-bold">
                        <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5 sm:mt-0" />
                        <span><strong>Recomendación Principal:</strong> {item.bestOption}</span>
                      </div>
                    )}
                  </div>

                  {/* Price & Availability Summary Box */}
                  <div className="bg-slate-50 dark:bg-slate-800/90 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 min-w-[280px] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rango Estimado Chile</span>
                        {item.priceLevel && (
                          <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded text-[9px] font-black uppercase">
                            {item.priceLevel}
                          </span>
                        )}
                      </div>
                      <p className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 leading-tight">
                        {item.averagePriceRange}
                      </p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-1.5">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-black flex items-center gap-1 ${
                        item.availabilityStatus === 'Inmediata' 
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'
                          : item.availabilityStatus === '24-48h'
                          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300'
                          : 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'
                      }`}>
                        <Clock className="w-3 h-3" />
                        Disponibilidad: {item.availabilityStatus || item.availability || 'Alta'}
                      </span>
                      {item.geographicCoverage && item.geographicCoverage.length > 0 && (
                        <span className="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-[10px] font-bold flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-indigo-500" />
                          {item.geographicCoverage[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* DETAILED SUPPLIERS COMPARISON (Structured Database Results) */}
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    Comparativa Estructurada por Tienda y Distribuidor:
                  </h4>

                  {item.detailedSuppliers && item.detailedSuppliers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {item.detailedSuppliers.map((sup, sIdx) => (
                        <div 
                          key={sIdx} 
                          className="bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col justify-between hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors shadow-sm"
                        >
                          <div>
                            {/* Supplier Name & Badge */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <h5 className="font-black text-slate-900 dark:text-white text-sm uppercase">
                                  {sup.name}
                                </h5>
                                {sup.brandOrChain && (
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                    {sup.brandOrChain}
                                  </p>
                                )}
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                sup.priceLevel === 'Mayorista'
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                                  : sup.priceLevel === 'Económico'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                  : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300'
                              }`}>
                                {sup.priceLevel}
                              </span>
                            </div>

                            {/* Price formatted */}
                            <div className="my-2 py-2 px-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/60">
                              <span className="text-[9px] font-black uppercase text-slate-400 block">Precio Estimado:</span>
                              <span className="text-base font-black text-slate-900 dark:text-white">
                                {sup.priceFormatted || `$${sup.priceEstimateClp?.toLocaleString('es-CL') || item.averagePriceRange}`}
                              </span>
                            </div>

                            {/* Proximity & Locations */}
                            {sup.locationsOrBranches && (
                              <div className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1.5 mb-2">
                                <MapPin className="w-3.5 h-3.5 text-indigo-500 mt-0.5 flex-shrink-0" />
                                <span className="text-[11px] leading-tight"><strong>Ubicación:</strong> {sup.locationsOrBranches}</span>
                              </div>
                            )}

                            {/* Delivery Options */}
                            {sup.deliveryOptions && sup.deliveryOptions.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {sup.deliveryOptions.map((del, dIdx) => (
                                  <span key={dIdx} className="px-2 py-0.5 bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 rounded text-[9px] font-bold flex items-center gap-1">
                                    <Truck className="w-2.5 h-2.5 text-slate-500" />
                                    {del}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Contractor Perk */}
                            {sup.discountOrPerk && (
                              <div className="mt-2 text-[11px] text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg font-medium border border-emerald-200/60 dark:border-emerald-900/40">
                                🎁 {sup.discountOrPerk}
                              </div>
                            )}
                          </div>

                          {/* Availability Pill */}
                          <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                            <span className="text-[10px] font-bold text-slate-400">Stock:</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px] flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-500" />
                              {sup.availability || 'Inmediata'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Basic Supplier Pills if detailed not provided */
                    <div className="flex flex-wrap gap-2">
                      {item.suggestedSuppliers.map((s, i) => (
                        <span key={i} className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 shadow-sm">
                          <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Branches and Logistics Details */}
                {(item.nearestBranches || (item.deliveryOptions && item.deliveryOptions.length > 0)) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                    {item.nearestBranches && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <strong className="text-slate-900 dark:text-white block uppercase text-[10px] tracking-wider">Cercanía y Sucursales:</strong>
                          <span className="text-slate-600 dark:text-slate-300">{item.nearestBranches}</span>
                        </div>
                      </div>
                    )}
                    {item.deliveryOptions && item.deliveryOptions.length > 0 && (
                      <div className="flex items-start gap-2">
                        <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <strong className="text-slate-900 dark:text-white block uppercase text-[10px] tracking-wider">Modalidades de Despacho:</strong>
                          <span className="text-slate-600 dark:text-slate-300">{item.deliveryOptions.join(' • ')}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Strategy & Contractor Tips */}
                <div className="flex items-start gap-3 bg-blue-50/70 dark:bg-indigo-950/20 p-5 rounded-2xl border border-blue-100 dark:border-indigo-900/40">
                  <Lightbulb className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    <span className="font-black text-indigo-900 dark:text-indigo-300 uppercase text-[10px] tracking-widest block mb-1">
                      Estrategia de Compra & Ahorro para Obras en Chile:
                    </span> 
                    {item.tips}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Directory of Chilean Stores (Empty State) */}
        {sortedSuggestions.length === 0 && !isLoading && (
          <div className="space-y-8">
            <div className="py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-6">
              <Store className="w-14 h-14 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-slate-700 dark:text-slate-300 font-black uppercase tracking-widest text-base">
                Directorio y Base de Datos de Proveedores en Chile
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Ingresa cualquier material arriba o selecciona los filtros de tu región, precio y disponibilidad para obtener comparativas y cotizaciones inmediatas.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  Principales Cadenas de Distribución y Especialistas
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {CHILEAN_SUPPLIERS.map((s, i) => (
                  <div key={i} className="p-6 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-sm flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-base">
                          {s.name}
                        </h4>
                        <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded text-[9px] font-black uppercase">
                          {s.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 font-bold mb-2">{s.focus}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">{s.advantage}</p>
                      
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
                        <MapPin className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                        <span>{s.branches}</span>
                      </div>
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg font-medium">
                        ⭐ {s.perk}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setQuery(s.name);
                        executeSearch(s.name);
                      }}
                      className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center justify-between"
                    >
                      <span>Consultar catálogo y precios</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


