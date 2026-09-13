import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Standard health check routes for Cloud Run container probes
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Lazy Gemini Initialization
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || "",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Multi-model list for resilience against high-demand spikes (503 / 429)
// Ordered by speed, reliability and current capacity
const CANDIDATE_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.7-flash",
  "gemini-flash-latest"
];

async function generateWithFallback(options: {
  contents: any;
  config?: any;
  maxAttempts?: number;
}): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const ai = getAI();
  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: options.config,
      });
      if (response && response.text) {
        return response;
      }
    } catch (err: any) {
      lastError = err;
      const statusCode = err?.status || err?.error?.code || err?.code;
      // If 503 (Overloaded) or 429 (Rate limited), retry with small backoff before next model
      if (statusCode === 503 || statusCode === 429) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  }

  throw lastError || new Error("All candidate models currently unavailable");
}

// Chilean Construction Knowledge Fallback for Materials
function getFallbackMaterials(query: string, searchMode: string) {
  const lower = query.toLowerCase();
  
  if (lower.includes('cemento') || lower.includes('radier') || lower.includes('hormigon') || lower.includes('piso')) {
    return [
      { name: "Cemento Bío Bío Especial 25kg", category: "Obra Gruesa", unit: "Saco 25kg", estimatedPrice: 4390, description: "Cemento de alta resistencia para fundaciones, radieres y albañilería.", suppliers: ["Sodimac", "Construmart", "Ferreterías MTS"] },
      { name: "Malla Acma C-92 (2.6x4.8m)", category: "Obra Gruesa", unit: "Plancha", estimatedPrice: 33500, description: "Armadura electrosoldada estándar para radier y losas.", suppliers: ["Salomon Sack", "Sodimac Constructor", "Construmart"] },
      { name: "Grava 3/4 Chancada", category: "Obra Gruesa", unit: "m3", estimatedPrice: 29500, description: "Árido grueso para dosificación de hormigón H20/H25.", suppliers: ["Áridos Santiago / Canteras", "Construmart"] },
      { name: "Arena Gruesa Lavada", category: "Obra Gruesa", unit: "m3", estimatedPrice: 24900, description: "Arena limpia libre de sales para mezclas estructurales.", suppliers: ["Construmart", "Sodimac"] },
      { name: "Polietileno 0.20mm (Barrera de Humedad)", category: "Aislación", unit: "Rollo 100m2", estimatedPrice: 26000, description: "Film plástico aislante contra humedad de terreno.", suppliers: ["Sodimac", "Imperial"] }
    ];
  }

  if (lower.includes('fierro') || lower.includes('acero') || lower.includes('armadura')) {
    return [
      { name: "Fierro Estriado 10mm A630-420H", category: "Obra Gruesa", unit: "Tira 6m", estimatedPrice: 8990, description: "Barra de acero estructural con resaltes según norma NCh204.", suppliers: ["Salomon Sack", "Sodimac Constructor", "Oximet"] },
      { name: "Fierro Estriado 12mm A630-420H", category: "Obra Gruesa", unit: "Tira 6m", estimatedPrice: 12800, description: "Acero de refuerzo para pilares y cadenas principales.", suppliers: ["Salomon Sack", "Construmart"] },
      { name: "Fierro Estriado 8mm A630-420H", category: "Obra Gruesa", unit: "Tira 6m", estimatedPrice: 6200, description: "Acero para estribos de confinamiento.", suppliers: ["Salomon Sack", "Sodimac"] },
      { name: "Alambre Negro Recocido N°18", category: "Fijaciones", unit: "kg", estimatedPrice: 2490, description: "Para amarras de enfierradura en faena.", suppliers: ["Sodimac", "Construmart", "MTS"] }
    ];
  }

  if (lower.includes('volcanita') || lower.includes('tabique') || lower.includes('metalcon') || lower.includes('yeso')) {
    return [
      { name: "Plancha Volcanita Standard 10mm (1.2x2.4m)", category: "Tabiquería", unit: "Plancha", estimatedPrice: 8990, description: "Plancha de yeso-cartón para tabiques y cielos interiores secos.", suppliers: ["Imperial", "Sodimac", "Construmart"] },
      { name: "Plancha Volcanita RH Hidrófuga 12.5mm", category: "Tabiquería", unit: "Plancha", estimatedPrice: 13500, description: "Resistente a la humedad para baños y cocinas.", suppliers: ["Imperial", "Sodimac Constructor"] },
      { name: "Perfil Montante Metalcon 60x38x0.85mm", category: "Tabiquería", unit: "Tira 3m", estimatedPrice: 5200, description: "Perfil estructural de acero galvanizado para muros.", suppliers: ["Imperial", "Construmart"] },
      { name: "Perfil Canal Metalcon 62x25x0.85mm", category: "Tabiquería", unit: "Tira 3m", estimatedPrice: 4600, description: "Solera superior e inferior para encintado de tabiques.", suppliers: ["Imperial", "Sodimac"] },
      { name: "Tornillos Autoperforantes Cabeza Lenteja 8x1/2\"", category: "Fijaciones", unit: "Caja 1000u", estimatedPrice: 9900, description: "Para unión de estructura Metalcon.", suppliers: ["Imperial", "Sodimac"] }
    ];
  }

  if (lower.includes('madera') || lower.includes('pino') || lower.includes('viga') || lower.includes('terciado')) {
    return [
      { name: "Pino Insigne Seco 2x4\" x 3.2m", category: "Maderas", unit: "Tira 3.2m", estimatedPrice: 7490, description: "Madera estructural seca en cámara KD < 18% humedad.", suppliers: ["Imperial", "Maderas Arauco", "Sodimac"] },
      { name: "Pino Insigne Seco 2x3\" x 3.2m", category: "Maderas", unit: "Tira 3.2m", estimatedPrice: 5890, description: "Para pie derecho de tabiques y envigados.", suppliers: ["Imperial", "Sodimac"] },
      { name: "Plancha Terciado Estructural 15mm (1.22x2.44m)", category: "Maderas", unit: "Plancha", estimatedPrice: 24900, description: "Tablero fenólico de alta resistencia para pisos y muros.", suppliers: ["Imperial", "Construmart"] },
      { name: "Plancha OSB 9.5mm APA", category: "Tabiquería", unit: "Plancha", estimatedPrice: 15400, description: "Tablero de virutas orientadas para rigidización de tabiquería.", suppliers: ["Imperial", "Sodimac", "Construmart"] }
    ];
  }

  // Generic comprehensive response
  return [
    { name: `${query.charAt(0).toUpperCase() + query.slice(1)} Estándar Chile`, category: "Materiales", unit: "Unidad", estimatedPrice: 12500, description: `Material certificado para especificación: ${query}.`, suppliers: ["Sodimac Constructor", "Imperial", "Construmart"] },
    { name: "Fijaciones y Anclajes Complementarios", category: "Fijaciones", unit: "Caja 100u", estimatedPrice: 5900, description: "Tornillería y tarugos técnicos para instalación.", suppliers: ["Sodimac", "Easy", "Imperial"] },
    { name: "Adhesivo / Sellador de Faena", category: "Terminaciones", unit: "Cartucho 300ml", estimatedPrice: 6800, description: "Sellante elástico de poliuretano para juntas.", suppliers: ["Sodimac Constructor", "Construmart"] }
  ];
}

// Chilean Construction Knowledge Fallback for Suppliers
function getFallbackSuppliers(query: string, region: string = 'Todas', priceCriterion: string = 'all', availabilityFilter: string = 'all') {
  const lower = query.toLowerCase();

  const regName = region === 'Todas' ? 'Región Metropolitana y Regiones' : region;

  if (lower.includes('fierro') || lower.includes('acero') || lower.includes('malla') || lower.includes('perfil')) {
    return [
      {
        materialName: "Fierro Estriado A630-420H y Mallas Electrosoldadas Acma",
        category: "Estructura y Acero",
        suggestedSuppliers: ["Salomon Sack", "Oximet / Gerdau AZA", "Sodimac Constructor", "Construmart"],
        bestOption: "Salomon Sack: Venta directa mayorista con certificación de calidad de fábrica y ahorro de hasta 18% por atado cerrado o tonelada.",
        averagePriceRange: "$6.200 - $34.000 CLP",
        minPrice: 6200,
        maxPrice: 34000,
        priceLevel: "Mayorista",
        tips: "Solicitar doblado computarizado en fábrica o distribuidor para reducir despuntes en obra a cero. Verificar sello A630-420H.",
        availability: "Stock Inmediato en Patio Constructor y Despacho 24h",
        availabilityStatus: "Inmediata",
        geographicCoverage: [regName, "Región Metropolitana", "Valparaíso", "Biobío", "Cobertura Nacional"],
        nearestBranches: "Sucursales industriales en Quilicura, San Bernardo, Maipú, Viña del Mar y Concepción",
        deliveryOptions: ["Despacho con Camión Grúa / Pluma", "Retiro en Patio Mayorista", "Despacho a Faena 24-48h"],
        detailedSuppliers: [
          {
            name: "Salomon Sack",
            brandOrChain: "Distribuidor Mayorista Siderúrgico",
            priceEstimateClp: 6200,
            priceFormatted: "$6.200 por barra 10mm (x6m)",
            priceLevel: "Mayorista",
            availability: "Inmediata",
            regions: [regName, "Región Metropolitana", "Biobío", "Valparaíso"],
            locationsOrBranches: "Quilicura, San Bernardo, Concepción",
            deliveryOptions: ["Camión Pluma a Obra", "Retiro Inmediato"],
            discountOrPerk: "Descuento por compras sobre $1.500.000 CLP o atado cerrado.",
            rating: 4.8
          },
          {
            name: "Sodimac Constructor",
            brandOrChain: "Falabella / Sodimac",
            priceEstimateClp: 6890,
            priceFormatted: "$6.890 por barra 10mm",
            priceLevel: "Medio",
            availability: "Inmediata",
            regions: ["Todas las Regiones"],
            locationsOrBranches: "Presente en todas las comunas con patio constructor",
            deliveryOptions: ["Despacho Express", "Camión Grúa", "Retiro en Patio"],
            discountOrPerk: "Acumulación CMR Puntos y Círculo Especialistas (hasta 5% cashback/crédito).",
            rating: 4.7
          },
          {
            name: "Construmart",
            brandOrChain: "Construmart Chile",
            priceEstimateClp: 6490,
            priceFormatted: "$6.490 por barra 10mm",
            priceLevel: "Económico",
            availability: "Inmediata",
            regions: ["Región Metropolitana", "V Región", "VIII Región", "Otras"],
            locationsOrBranches: "Centros de distribución y tiendas a nivel nacional",
            deliveryOptions: ["Despacho Programado", "Retiro en Tienda"],
            discountOrPerk: "Precios especiales con RUT empresa y convenios contratistas.",
            rating: 4.5
          }
        ]
      }
    ];
  }

  if (lower.includes('madera') || lower.includes('pino') || lower.includes('terciado') || lower.includes('osb') || lower.includes('tablero')) {
    return [
      {
        materialName: "Maderas Aserradas (Pino Seco KD) y Tableros Estructurales (OSB / Terciado)",
        category: "Maderas y Tableros",
        suggestedSuppliers: ["Imperial", "Sodimac Constructor", "Maderas Arauco / CMPC", "Easy"],
        bestOption: "Imperial: Especialista líder con servicio de dimensionado computarizado exacto, empaquetado por partida y stock permanente de pino seco cámara.",
        averagePriceRange: "$5.800 - $28.500 CLP por pieza / plancha",
        minPrice: 5800,
        maxPrice: 28500,
        priceLevel: "Económico",
        tips: "Exigir siempre madera seca en cámara (KD) con humedad menor al 18% para evitar torsiones posteriores en tabiques y techos.",
        availability: "Stock Permanente con Retiro y Despacho Inmediato",
        availabilityStatus: "Inmediata",
        geographicCoverage: [regName, "Región Metropolitana", "Valparaíso", "O'Higgins", "Biobío", "Los Lagos"],
        nearestBranches: "Sucursales Imperial en Santiago (10+ locales), Viña del Mar, Rancagua, Talca, Concepción y Temuco",
        deliveryOptions: ["Despacho a Obra con Pluma", "Retiro en Bodega / Patio", "Corte y Dimensionado en Tienda"],
        detailedSuppliers: [
          {
            name: "Imperial",
            brandOrChain: "Especialista en Maderas y Mueblería",
            priceEstimateClp: 5800,
            priceFormatted: "$5.800 (Pino 2x4 3.2m seco) / $13.990 (OSB 9.5mm)",
            priceLevel: "Económico",
            availability: "Inmediata",
            regions: ["RM", "V Región", "VI", "VII", "VIII", "IX", "X"],
            locationsOrBranches: "San Joaquín, La Florida, Quilicura, Viña del Mar, Concepción",
            deliveryOptions: ["Despacho a Faena", "Dimensionado Gratis por volumen"],
            discountOrPerk: "Descuento Maestro Imperial y listas de cubicación integradas.",
            rating: 4.9
          },
          {
            name: "Sodimac Constructor",
            brandOrChain: "Sodimac Constructor",
            priceEstimateClp: 6290,
            priceFormatted: "$6.290 (Pino 2x4) / $14.490 (OSB 9.5mm)",
            priceLevel: "Medio",
            availability: "Inmediata",
            regions: ["Todas las Regiones de Chile"],
            locationsOrBranches: "Patio Constructor en más de 60 tiendas en todo Chile",
            deliveryOptions: ["Camión Pluma", "Flete Express a Obra"],
            discountOrPerk: "Crédito 30 días con RUT empresa.",
            rating: 4.6
          }
        ]
      }
    ];
  }

  if (lower.includes('cemento') || lower.includes('hormigon') || lower.includes('arido') || lower.includes('grava') || lower.includes('arena') || lower.includes('radier')) {
    return [
      {
        materialName: "Cementos Especiales (Melón / Polpaico / Bío Bío) y Áridos Lavados",
        category: "Obra Gruesa",
        suggestedSuppliers: ["Construmart", "Sodimac Constructor", "Ferreterías Red MTS", "Chilemat"],
        bestOption: "Construmart & Sodimac Constructor: Mejor precio garantizado por pallet cerrado (40 sacos) con descarga de camión pluma a pie de obra.",
        averagePriceRange: "$4.190 - $4.890 CLP por saco de 25kg",
        minPrice: 4190,
        maxPrice: 4890,
        priceLevel: "Mayorista",
        tips: "Almacenar sobre tarimas aisladas del terreno y cubiertas con polietileno. Para más de 3.5m3 de hormigón, evaluar mixer premezclado.",
        availability: "Stock Permanente en Tienda y Despacho Masivo",
        availabilityStatus: "Inmediata",
        geographicCoverage: [regName, "Región Metropolitana", "Norte", "Centro", "Sur de Chile"],
        nearestBranches: "Patios constructores en todas las comunas urbanas e intercomunales",
        deliveryOptions: ["Camión Pluma Descarga a Obra", "Retiro en Patio", "Tolva para Áridos"],
        detailedSuppliers: [
          {
            name: "Construmart",
            brandOrChain: "Construmart",
            priceEstimateClp: 4190,
            priceFormatted: "$4.190 por saco (en pallet)",
            priceLevel: "Mayorista",
            availability: "Inmediata",
            regions: ["Arica a Puerto Montt"],
            locationsOrBranches: "Centros de distribución comunales",
            deliveryOptions: ["Camión Pluma", "Retiro Patio"],
            discountOrPerk: "Precio pallet mayorista y flete consolidado de obra gruesa.",
            rating: 4.7
          },
          {
            name: "Sodimac Constructor",
            brandOrChain: "Sodimac Constructor",
            priceEstimateClp: 4390,
            priceFormatted: "$4.390 por saco unitario",
            priceLevel: "Medio",
            availability: "Inmediata",
            regions: ["Nacional"],
            locationsOrBranches: "Red nacional de patios constructores",
            deliveryOptions: ["Despacho Camión Pluma", "Retiro Express"],
            discountOrPerk: "Círculo Especialista y convenio empresas.",
            rating: 4.8
          },
          {
            name: "Ferreterías Red MTS / Chilemat",
            brandOrChain: "Red Ferretera Local",
            priceEstimateClp: 4450,
            priceFormatted: "$4.450 por saco",
            priceLevel: "Medio",
            availability: "Inmediata",
            regions: ["Todas las comunas y provincias"],
            locationsOrBranches: "Ferreterías locales en cada barrio/comuna",
            deliveryOptions: ["Flete Local Inmediato", "Retiro Directo"],
            discountOrPerk: "Atención directa de dueños y despacho ágil para imprevistos.",
            rating: 4.6
          }
        ]
      }
    ];
  }

  return [
    {
      materialName: query,
      category: "Materiales y Soluciones Constructivas",
      suggestedSuppliers: ["Sodimac Constructor", "Imperial", "Construmart", "Red MTS / Chilemat", "Easy"],
      bestOption: "Sodimac Constructor & Imperial: Mayor profundidad de catálogo con stock garantizado en tienda física, crédito a empresas y despacho con camión pluma.",
      averagePriceRange: "$4.500 - $28.000 CLP según especificación",
      minPrice: 4500,
      maxPrice: 28000,
      priceLevel: "Económico",
      tips: "Cotiza con RUT de empresa o carnet de contratista para acceder al programa de socios con descuentos preferenciales.",
      availability: "Alta Disponibilidad en Tiendas y Despacho 24-48h",
      availabilityStatus: "Inmediata",
      geographicCoverage: [regName, "Cobertura Nacional"],
      nearestBranches: "Red de sucursales en Santiago, Valparaíso, Concepción y principales capitales provinciales",
      deliveryOptions: ["Despacho a Obra con Grúa", "Retiro Inmediato en Tienda", "Despacho Express"],
      detailedSuppliers: [
        {
          name: "Sodimac Constructor",
          brandOrChain: "Sodimac",
          priceEstimateClp: 8900,
          priceFormatted: "Precio Referencial Mercado",
          priceLevel: "Medio",
          availability: "Inmediata",
          regions: [regName, "Nacional"],
          locationsOrBranches: "Locales en todas las ciudades principales de Chile",
          deliveryOptions: ["Camión Pluma", "Retiro Patio"],
          discountOrPerk: "Crédito empresas y Círculo Especialistas.",
          rating: 4.7
        },
        {
          name: "Imperial",
          brandOrChain: "Imperial",
          priceEstimateClp: 8500,
          priceFormatted: "Precio Especial Contratista",
          priceLevel: "Económico",
          availability: "Inmediata",
          regions: ["RM", "V", "VIII", "Regiones"],
          locationsOrBranches: "Puntos de venta especializados en construcción",
          deliveryOptions: ["Despacho Obra", "Retiro"],
          discountOrPerk: "Precios por volumen y convenios de abastecimiento.",
          rating: 4.8
        }
      ]
    }
  ];
} 

// API Routes

// 1. Buscador y calculista de materiales con IA (por material específico o cubicación de proyecto)
app.post('/api/materials/suggest', async (req, res) => {
  const { projectName, description, searchMode = 'general' } = req.body;
  const queryText = (description || projectName || '').trim();

  if (!queryText) {
    return res.json([]);
  }

  try {
    let promptInstruction = '';

    if (searchMode === 'material') {
      promptInstruction = `Eres un experto cotizador y especialista en materiales de construcción en Chile.
El usuario está buscando información confiable del material: "${queryText}".

Devuelve una lista de 4 a 8 variantes o productos exactos relacionados disponibles en el mercado chileno (ej: marcas Melón, Polpaico, Bío Bío, Gerdau AZA, Volcán, Romeral, Vinilit, Sika, Topex, Imperial, etc.).
Para cada material proporciona:
- Nombre técnico y comercial en Chile
- Categoría constructiva precisa (Obra Gruesa, Maderas, Tabiquería, Techumbre, Terminaciones, Fijaciones, Electricidad, Gasfitería, Aislación o Herramientas)
- Unidad de venta estándar en Chile (Saco 25kg, Tira 6m, Plancha 1.2x2.4m, m2, m3, Tineta 5gal, Rollo, kg, Caja 100u, etc.)
- Precio estimado realista en pesos chilenos (CLP) con IVA incluido
- Descripción con especificación técnica, resistencia o rendimiento
- Principales tiendas/distribuidores en Chile donde se adquiere (ej: Sodimac, Construmart, Imperial, Easy, MTS, Salomon Sack, Yolito, etc.)`;
    } else {
      promptInstruction = `Eres un experto constructor y calculista en Chile.
Requerimiento de obra o proyecto: "${projectName ? `${projectName}: ` : ''}${queryText}".

Genera una lista técnica y completa de los materiales necesarios para ejecutar este trabajo en Chile (desde fijaciones menores como clavos/tornillos hasta obra gruesa y terminaciones).
Para cada material calcula:
- Nombre técnico y comercial en Chile
- Categoría constructiva (Obra Gruesa, Maderas, Tabiquería, Techumbre, Terminaciones, Fijaciones, Electricidad, Gasfitería, Aislación o Herramientas)
- Unidad de medida estándar (Saco 25kg, Tira 6m, Plancha, m2, m3, Tineta 5gal, etc.)
- Precio estimado de mercado chileno en CLP
- Descripción con uso específico y recomendación de rendimiento
- Proveedores recomendados en Chile (Sodimac, Imperial, Construmart, Easy, MTS, Salomon Sack, etc.)`;
    }

    const response = await generateWithFallback({
      contents: promptInstruction,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Nombre técnico y comercial del material en Chile" },
              category: { type: Type.STRING, description: "Categoría de construcción" },
              unit: { type: Type.STRING, description: "Unidad comercial de venta en Chile" },
              estimatedPrice: { type: Type.NUMBER, description: "Precio estimado en CLP con IVA" },
              description: { type: Type.STRING, description: "Uso específico, especificación técnica o rendimiento" },
              suppliers: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Tiendas y distribuidores en Chile"
              }
            },
            required: ["name", "category", "unit", "estimatedPrice", "description"]
          }
        }
      }
    });
    
    const text = response.text || "[]";
    const data = JSON.parse(text);
    res.json(Array.isArray(data) ? data : getFallbackMaterials(queryText, searchMode));
  } catch (error) {
    console.warn("AI generation temporarily unavailable, using Chilean construction fallback for materials:", error);
    res.json(getFallbackMaterials(queryText, searchMode));
  }
});

// 2. Buscador y asesor estructurado de proveedores con IA (por material, zona geográfica, precio y disponibilidad)
app.post('/api/suppliers/suggest', async (req, res) => {
  const { 
    materials, 
    query, 
    region = 'Todas', 
    priceCriterion = 'all', 
    availabilityFilter = 'all', 
    deliveryMode = 'all' 
  } = req.body;
  const searchQuery = (query || (Array.isArray(materials) ? materials.join(', ') : '')).trim();

  if (!searchQuery) {
    return res.json([]);
  }

  try {
    const regionContext = region && region !== 'Todas' ? `Región/Zona de Chile preferida: "${region}".` : 'Cobertura: Todas las regiones de Chile (con foco en Región Metropolitana, Valparaíso, Biobío y capitales regionales).';
    const priceContext = priceCriterion === 'economic' 
      ? 'Prioridad de precio: Buscar las opciones MÁS ECONÓMICAS y de mejor oferta/descuento.' 
      : priceCriterion === 'wholesale' 
      ? 'Prioridad de precio: Proveedores MAYORISTAS por pallet cerrado, atado o compra sobre volumen con crédito empresa.'
      : priceCriterion === 'quality'
      ? 'Prioridad: Materiales de primera marca con certificación estructural (NCh).'
      : 'Criterio de precio: Comparativa completa de mercado (Económico, Medio y Mayorista).';

    const availabilityContext = availabilityFilter === 'immediate'
      ? 'Disponibilidad requerida: Stock inmediato garantizado en tienda física / patio constructor para retiro en el día.'
      : availabilityFilter === '24h'
      ? 'Disponibilidad requerida: Despacho rápido a obra en 24 a 48 horas.'
      : availabilityFilter === 'order'
      ? 'Disponibilidad: Pedidos a medida, dimensionados o partidas especiales.'
      : 'Disponibilidad: Evaluar tanto stock inmediato como despacho a obra.';

    const deliveryContext = deliveryMode === 'crane_truck'
      ? 'Modalidad logística: Priorizar proveedores con despacho con camión grúa / pluma a pie de obra.'
      : deliveryMode === 'store_pickup'
      ? 'Modalidad logística: Priorizar retiro inmediato en patio constructor / sucursal cercana.'
      : deliveryMode === 'express'
      ? 'Modalidad logística: Despacho express en el mismo día / flete rápido de faena.'
      : 'Modalidad logística: Incluir despacho a faena y retiro en patio constructor.';

    const prompt = `Eres un sistema experto y motor de consulta estructurada a la base de datos de proveedores de construcción en Chile.
El usuario solicita cotización y análisis de proveedores para: "${searchQuery}".
Contexto de filtrado:
- ${regionContext}
- ${priceContext}
- ${availabilityContext}
- ${deliveryContext}

Analiza las mejores opciones de proveedores reales en Chile (Sodimac Constructor, Imperial, Construmart, Salomon Sack, Ferreterías Red MTS, Chilemat, Easy, Yolito, Melón Hormigones, Cintac, Romeral, Volcán, Vinilit, Sika, etc.).

Para cada material devuelto, estructura la respuesta con:
1. materialName: Nombre específico del material.
2. category: Categoría constructiva (Estructura y Acero, Maderas y Tableros, Obra Gruesa, Tabiquería, Techumbre, Terminaciones, Electricidad, Gasfitería, Fijaciones).
3. suggestedSuppliers: Lista de distribuidores recomendados.
4. bestOption: Recomendación destacada indicando proveedor y beneficio concreto.
5. averagePriceRange: Rango de precios en CLP con IVA (ej: "$4.190 - $4.890 CLP por saco 25kg").
6. minPrice y maxPrice: Valores numéricos en pesos chilenos.
7. priceLevel: 'Económico', 'Medio', 'Mayorista' o 'Premium'.
8. tips: Consejos prácticos de compra para contratistas en Chile (ahorro por volumen, RUT empresa, cubicación).
9. availability: Descripción de disponibilidad en Chile.
10. availabilityStatus: 'Inmediata', '24-48h' o 'Por Pedido'.
11. geographicCoverage: Regiones o zonas de cobertura.
12. nearestBranches: Ubicaciones o sucursales de referencia (ej: Santiago, Quilicura, San Bernardo, Viña del Mar, Concepción).
13. deliveryOptions: Opciones de despacho (Camión Pluma, Retiro en Patio, Despacho Express).
14. detailedSuppliers: Lista de 2 a 4 proveedores detallados con su precio estimado en CLP, nivel de precio, disponibilidad, opciones de entrega y beneficios comerciales (descuentos RUT empresa, círculo especialista, etc.).`;

    const response = await generateWithFallback({
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              materialName: { type: Type.STRING, description: "Nombre del material analizado" },
              category: { type: Type.STRING, description: "Categoría de material" },
              suggestedSuppliers: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Tiendas y distribuidores en Chile"
              },
              bestOption: { type: Type.STRING, description: "Proveedor más recomendado y por qué" },
              averagePriceRange: { type: Type.STRING, description: "Rango de precio en CLP" },
              minPrice: { type: Type.NUMBER, description: "Precio mínimo estimado en CLP" },
              maxPrice: { type: Type.NUMBER, description: "Precio máximo estimado en CLP" },
              priceLevel: { type: Type.STRING, description: "Nivel de precio (Económico, Medio, Mayorista, Premium)" },
              tips: { type: Type.STRING, description: "Consejo táctico de ahorro y compra" },
              availability: { type: Type.STRING, description: "Disponibilidad de stock" },
              availabilityStatus: { type: Type.STRING, description: "Inmediata, 24-48h o Por Pedido" },
              geographicCoverage: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Zonas y regiones de Chile cubiertas"
              },
              nearestBranches: { type: Type.STRING, description: "Sucursales o comunas con cobertura" },
              deliveryOptions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Modalidades de despacho a obra o retiro"
              },
              detailedSuppliers: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, description: "Nombre de la tienda o distribuidor" },
                    brandOrChain: { type: Type.STRING, description: "Cadena o tipo de distribuidor" },
                    priceEstimateClp: { type: Type.NUMBER, description: "Precio estimado en CLP" },
                    priceFormatted: { type: Type.STRING, description: "Precio con unidad legible en CLP" },
                    priceLevel: { type: Type.STRING, description: "Económico, Medio, Mayorista o Premium" },
                    availability: { type: Type.STRING, description: "Inmediata, 24-48h o Por Pedido" },
                    regions: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    },
                    locationsOrBranches: { type: Type.STRING, description: "Sucursales y comunas" },
                    deliveryOptions: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    },
                    discountOrPerk: { type: Type.STRING, description: "Beneficio contratista, RUT o crédito" },
                    rating: { type: Type.NUMBER, description: "Calificación 1 a 5" }
                  },
                  required: ["name", "priceFormatted", "priceLevel", "availability"]
                }
              }
            },
            required: ["materialName", "suggestedSuppliers", "averagePriceRange", "tips"]
          }
        }
      }
    });
    
    const text = response.text || "[]";
    const data = JSON.parse(text);
    res.json(Array.isArray(data) && data.length > 0 ? data : getFallbackSuppliers(searchQuery, region, priceCriterion, availabilityFilter));
  } catch (error) {
    console.warn("AI generation temporarily unavailable, using Chilean construction fallback for suppliers:", error);
    res.json(getFallbackSuppliers(searchQuery, region, priceCriterion, availabilityFilter));
  }
});

// 3. Análisis financiero de proyectos
app.post('/api/analysis/project', async (req, res) => {
  const { projectData } = req.body;
  try {
    const response = await generateWithFallback({
      contents: `Analiza financieramente este proyecto de construcción en Chile: ${JSON.stringify(projectData)}.
      Calcula rentabilidad, identifica desviaciones de presupuesto y da 3 consejos específicos para ahorrar en materiales o mano de obra en el contexto chileno actual. Responde en Markdown.`
    });
    res.json({ analysis: response.text });
  } catch (error) {
    console.warn("AI analysis temporarily unavailable, returning standard construction financial advice:", error);
    res.json({ 
      analysis: `### 📊 Diagnóstico Financiero de Obra (Chile)
- **Monitoreo de Partidas**: Mantén un control estricto del porcentaje de avance en Obra Gruesa, donde suele concentrarse el 50-60% del gasto de materiales.
- **Estrategia de Compra**: Adquiere cemento y áridos por volumen cerrado para negociar fletes unificados.
- **Flujo de Caja**: Asegura que las cuotas de clientes coincidan con los hitos de entrega de partidas críticas para evitar sobrecostos financieros.` 
    });
  }
});

// 4. Resumen de bitácoras
app.post('/api/notes/summarize', async (req, res) => {
  const { notes } = req.body;
  try {
    const response = await generateWithFallback({
      contents: `Resume estas bitácoras de obra: ${JSON.stringify(notes)}. Destaca avances clave y alertas críticas en español. Máximo 150 palabras.`
    });
    res.json({ summary: response.text });
  } catch (error) {
    console.warn("AI summary fallback:", error);
    const summaryText = Array.isArray(notes) 
      ? notes.map((n: any) => `• ${n.title || n.content || ''}`).join('\n')
      : "Bitácoras registradas correctamente.";
    res.json({ summary: summaryText });
  }
});

// Setup Vite middleware or static serving
async function start() {
  const isProduction = process.env.NODE_ENV === "production";
  const distPath = path.join(process.cwd(), 'dist');

  if (isProduction) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Not Found');
      }
    });
  } else {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.warn("Vite middleware failed to load, falling back to static:", err);
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        const indexFile = path.join(distPath, 'index.html');
        if (fs.existsSync(indexFile)) {
          res.sendFile(indexFile);
        } else {
          res.status(404).send('Not Found');
        }
      });
    }
  }

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled API error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

// Global safety error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

start();

