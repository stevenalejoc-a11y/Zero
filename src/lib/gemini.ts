import { Material, SupplierSuggestion, SupplierFilterParams } from '../types';
import { CONSTRUCTION_MATERIALS } from '../data/materials';

export const searchMaterialsAI = async (
  queryText: string, 
  searchMode: 'material' | 'project' = 'material'
): Promise<Material[]> => {
  if (!queryText.trim()) return [];

  try {
    const response = await fetch('/api/materials/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        projectName: searchMode === 'project' ? queryText : '', 
        description: queryText,
        searchMode 
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((item, index) => ({
          id: `ai-mat-${Date.now()}-${index}`,
          name: item.name,
          category: item.category || 'General',
          unit: item.unit || 'Unidad',
          estimatedPrice: Number(item.estimatedPrice) || 0,
          description: item.description || '',
          suppliers: item.suppliers || ['Sodimac', 'Imperial', 'Construmart'],
          isAIGenerated: true,
        }));
      }
    }
  } catch (error) {
    console.warn("API AI call encountered error, using smart fallback:", error);
  }

  // Smart Chilean construction fallback if offline or server busy
  const lower = queryText.toLowerCase();
  const matched = CONSTRUCTION_MATERIALS.filter(m => 
    m.name.toLowerCase().includes(lower) || 
    m.category.toLowerCase().includes(lower) ||
    (m.description && m.description.toLowerCase().includes(lower))
  );

  if (matched.length > 0) {
    return matched.map((m, idx) => ({
      ...m,
      id: m.id || `fb-${idx}`,
      suppliers: m.suppliers || ['Sodimac', 'Construmart', 'Imperial', 'Easy'],
      isAIGenerated: false,
    }));
  }

  return [];
};

export const getMaterialSuggestions = async (
  projectName: string, 
  description: string, 
  searchMode: 'material' | 'project' = 'project'
): Promise<Material[]> => {
  return searchMaterialsAI(description || projectName, searchMode);
};

export const getSupplierSuggestions = async (
  materials: string[],
  query?: string,
  filters?: SupplierFilterParams
): Promise<SupplierSuggestion[]> => {
  const searchQuery = query || materials.join(', ');
  if (!searchQuery.trim()) return [];

  try {
    const response = await fetch('/api/suppliers/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        materials, 
        query: searchQuery,
        region: filters?.region || 'Todas',
        priceCriterion: filters?.priceCriterion || 'all',
        availabilityFilter: filters?.availabilityFilter || 'all',
        deliveryMode: filters?.deliveryMode || 'all'
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (error) {
    console.warn("API Supplier AI call encountered error, applying fallback:", error);
  }

  // Fallback Chilean suppliers logic
  const items = materials.length > 0 ? materials : [searchQuery];
  return items.map(mat => {
    const lower = mat.toLowerCase();
    let suggested = ['Sodimac Constructor', 'Construmart', 'Easy'];
    let best = 'Sodimac Constructor: Crédito empresa RUT y despacho con camión grúa a obra.';
    let priceRange = '$4.500 - $18.900 CLP';
    let minPrice = 4500;
    let maxPrice = 18900;
    let category = 'Obra Gruesa';
    let tips = 'Consulta precios por pallet completo o compra directa con RUT de empresa para acceder a descuentos contratista.';
    let availabilityStatus: 'Inmediata' | '24-48h' | 'Por Pedido' = 'Inmediata';

    if (lower.includes('fierro') || lower.includes('acero') || lower.includes('malla')) {
      suggested = ['Salomon Sack', 'Oximet / Gerdau AZA', 'Sodimac Constructor', 'Construmart'];
      best = 'Salomon Sack: Venta directa mayorista con certificación estructural y hasta 18% ahorro por tonelada.';
      priceRange = '$6.200 - $34.000 CLP';
      minPrice = 6200;
      maxPrice = 34000;
      category = 'Estructura y Acero';
      tips = 'Comprar en barras estándar de 6 metros y solicitar corte en distribuidor mayorista para optimizar traslapes y evitar despuntes.';
      availabilityStatus = 'Inmediata';
    } else if (lower.includes('madera') || lower.includes('pino') || lower.includes('terciado') || lower.includes('osb') || lower.includes('mdf')) {
      suggested = ['Imperial', 'Sodimac Constructor', 'Maderas Arauco', 'Easy'];
      best = 'Imperial: Especialista líder en tableros y maderas con dimensionado computarizado exacto.';
      priceRange = '$5.800 - $28.500 CLP';
      minPrice = 5800;
      maxPrice = 28500;
      category = 'Maderas y Tableros';
      tips = 'Verificar siempre que la madera sea seca en cámara (KD) con humedad < 18% para evitar deformaciones en obra.';
      availabilityStatus = 'Inmediata';
    } else if (lower.includes('cemento') || lower.includes('hormigon') || lower.includes('arido') || lower.includes('grava') || lower.includes('arena')) {
      suggested = ['Polpaico / Melón', 'Construmart', 'Sodimac Constructor', 'Ferreterías MTS'];
      best = 'Construmart / Sodimac Constructor: Mejor disponibilidad por pallet de 40 sacos de 25kg con camión pluma.';
      priceRange = '$4.190 - $4.890 CLP por saco';
      minPrice = 4190;
      maxPrice = 4890;
      category = 'Obra Gruesa';
      tips = 'Para más de 3.5m3 de hormigón conviene evaluar camión mixer premezclado para ahorrar tiempo y mano de obra.';
      availabilityStatus = 'Inmediata';
    } else if (lower.includes('volcanita') || lower.includes('metalcon') || lower.includes('perfil') || lower.includes('tabique')) {
      suggested = ['Imperial', 'Volcán / Romeral', 'Sodimac Constructor', 'Construmart'];
      best = 'Imperial: Gran surtido en perfiles estructurales galvanizados y tabiquería seca.';
      priceRange = '$4.200 - $14.500 CLP';
      minPrice = 4200;
      maxPrice = 14500;
      category = 'Tabiquería';
      tips = 'Usa planchas RH (resistentes a la humedad) en zonas húmedas como baños y cocinas.';
      availabilityStatus = 'Inmediata';
    } else if (lower.includes('pintura') || lower.includes('esmalte') || lower.includes('latex') || lower.includes('pasta')) {
      suggested = ['Ceresita / Tricolor', 'Sodimac Constructor', 'Easy', 'Imperial'];
      best = 'Sodimac: Gran variedad de tintometría computarizada y marcas profesionales.';
      priceRange = '$22.000 - $68.000 CLP por tineta';
      minPrice = 22000;
      maxPrice = 68000;
      category = 'Terminaciones';
      tips = 'Comprar tineta de 5 galones rinde hasta un 35% más económico que galones sueltos.';
      availabilityStatus = 'Inmediata';
    }

    return {
      materialName: mat,
      category,
      suggestedSuppliers: suggested,
      bestOption: best,
      averagePriceRange: priceRange,
      minPrice,
      maxPrice,
      priceLevel: 'Económico',
      tips,
      availability: 'Alta en Santiago y Regiones',
      availabilityStatus,
      geographicCoverage: ['Región Metropolitana', 'Valparaíso', 'Biobío', 'Nacional'],
      nearestBranches: 'Sucursales en las principales capitales regionales y patios constructores',
      deliveryOptions: ['Despacho a Obra con Pluma', 'Retiro en Patio Constructor', 'Despacho Express'],
      detailedSuppliers: suggested.map((s, idx) => ({
        name: s,
        brandOrChain: 'Cadena Nacional de Construcción',
        priceFormatted: priceRange,
        priceLevel: idx === 0 ? 'Mayorista' : 'Económico',
        availability: 'Inmediata',
        regions: ['Nacional', 'Región Metropolitana'],
        deliveryOptions: ['Camión Pluma', 'Retiro en Patio'],
        discountOrPerk: 'Descuento RUT empresa y convenios contratista.',
        rating: 4.7
      }))
    };
  });
};

export const analyzeProjectBudget = async (projectData: any) => {
  try {
    const response = await fetch('/api/analysis/project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectData }),
    });
    if (!response.ok) throw new Error('Failed to fetch analysis');
    const data = await response.json();
    return data.analysis;
  } catch (error) {
    console.error("Error analyzing budget:", error);
    return "No se pudo generar el análisis en este momento.";
  }
};

export const summarizeNotes = async (notes: string[]) => {
  try {
    const response = await fetch('/api/notes/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    if (!response.ok) throw new Error('Failed to fetch summary');
    const data = await response.json();
    return data.summary;
  } catch (error) {
    console.error("Error summarizing notes:", error);
    return "No se pudo generar el resumen de las notas.";
  }
};

