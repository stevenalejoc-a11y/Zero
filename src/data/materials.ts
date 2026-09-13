import { Material } from '../types';

export const INITIAL_CATEGORIES = [
  'Todos',
  'Cementos y Áridos',
  'Perfiles Metálicos y Acero',
  'Tornillería y Fijaciones',
  'Maderas y Tableros',
  'Tabiquería y Cielos',
  'Techumbre e Impermeabilización',
  'Aislación Térmica y Acústica',
  'Terminaciones y Pinturas',
  'Electricidad y Canalización',
  'Gasfitería y Alcantarillado',
  'Herramientas y Seguridad'
];

export const CONSTRUCTION_MATERIALS: Material[] = [
  // 1. Cementos y Áridos
  { 
    id: 'mat-cem-01', 
    name: 'Cemento Melón Especial 25kg', 
    category: 'Cementos y Áridos', 
    unit: 'Saco 25kg', 
    estimatedPrice: 4390, 
    description: 'Cemento Portland puzolánico de alta resistencia inicial para hormigones y albañilería.',
    suppliers: ['Sodimac Constructor', 'Construmart', 'Red MTS', 'Chilemat']
  },
  { 
    id: 'mat-cem-02', 
    name: 'Cemento Bío Bío Especial 25kg', 
    category: 'Cementos y Áridos', 
    unit: 'Saco 25kg', 
    estimatedPrice: 4290, 
    description: 'Cemento para uso general en radieres, fundaciones, pilares y morteros de pega.',
    suppliers: ['Sodimac Constructor', 'Imperial', 'Construmart']
  },
  { 
    id: 'mat-cem-03', 
    name: 'Cemento Polpaico 25kg', 
    category: 'Cementos y Áridos', 
    unit: 'Saco 25kg', 
    estimatedPrice: 4350, 
    description: 'Cemento hidráulico de alta durabilidad y excelente trabajabilidad.',
    suppliers: ['Construmart', 'Salomon Sack', 'Easy']
  },
  { 
    id: 'mat-cem-04', 
    name: 'Arena Gruesa Lavada', 
    category: 'Cementos y Áridos', 
    unit: 'm3', 
    estimatedPrice: 24500, 
    description: 'Árido fino lavado libre de arcillas y sales para mezclas de hormigón estructural.',
    suppliers: ['Áridos San Vicente / Canteras', 'Sodimac', 'Construmart']
  },
  { 
    id: 'mat-cem-05', 
    name: 'Grava 3/4 Chancada', 
    category: 'Cementos y Áridos', 
    unit: 'm3', 
    estimatedPrice: 28900, 
    description: 'Árido grueso seleccionado para dosificación de hormigones H20 y H25.',
    suppliers: ['Áridos San Bernardo', 'Construmart', 'Sodimac']
  },
  { 
    id: 'mat-cem-06', 
    name: 'Gravilla 3/8 para Emboquillado', 
    category: 'Cementos y Áridos', 
    unit: 'm3', 
    estimatedPrice: 29500, 
    description: 'Árido de menor tamaño para elementos densamente armados o losetas.',
    suppliers: ['Canteras Locales', 'Construmart']
  },
  { 
    id: 'mat-cem-07', 
    name: 'Mortero Predosificado 25kg Topex / Bío Bío', 
    category: 'Cementos y Áridos', 
    unit: 'Saco 25kg', 
    estimatedPrice: 3890, 
    description: 'Mezcla seca lista para usar sólo agregando agua para pegado y afinado de pisos.',
    suppliers: ['Sodimac Constructor', 'Imperial', 'Construmart']
  },
  { 
    id: 'mat-cem-08', 
    name: 'Aditivo Plastificante SikaCem 1L', 
    category: 'Cementos y Áridos', 
    unit: 'Unidad 1L', 
    estimatedPrice: 6200, 
    description: 'Mejora la trabajabilidad, fluidez y resistencia del hormigón.',
    suppliers: ['Sodimac Constructor', 'Imperial', 'Construmart']
  },

  // 2. Perfiles Metálicos y Acero
  { 
    id: 'mat-perf-01', 
    name: 'Perfil Metalcon Montante 60x38x0.85mm x 3m', 
    category: 'Perfiles Metálicos y Acero', 
    unit: 'Tira 3m', 
    estimatedPrice: 5190, 
    description: 'Perfil estructural C de acero galvanizado para pies derechos de tabiquería y muros soportantes.',
    suppliers: ['Imperial', 'Sodimac Constructor', 'Construmart', 'Cintac']
  },
  { 
    id: 'mat-perf-02', 
    name: 'Perfil Metalcon Canal 62x25x0.85mm x 3m', 
    category: 'Perfiles Metálicos y Acero', 
    unit: 'Tira 3m', 
    estimatedPrice: 4690, 
    description: 'Perfil U para soleras inferiores y superiores de anclaje de tabiques.',
    suppliers: ['Imperial', 'Sodimac Constructor', 'Construmart']
  },
  { 
    id: 'mat-perf-03', 
    name: 'Perfil Metalcon Montante 90x38x0.85mm x 3m', 
    category: 'Perfiles Metálicos y Acero', 
    unit: 'Tira 3m', 
    estimatedPrice: 7200, 
    description: 'Para tabiques perimetrales de mayor altura o con mayor aislamiento acústico.',
    suppliers: ['Imperial', 'Sodimac Constructor', 'Cintac']
  },
  { 
    id: 'mat-perf-04', 
    name: 'Perfil Metalcon Canal 92x25x0.85mm x 3m', 
    category: 'Perfiles Metálicos y Acero', 
    unit: 'Tira 3m', 
    estimatedPrice: 6490, 
    description: 'Solera estructural para muro de 90mm.',
    suppliers: ['Imperial', 'Sodimac Constructor']
  },
  { 
    id: 'mat-perf-05', 
    name: 'Fierro Estriado 10mm A630-420H (6m)', 
    category: 'Perfiles Metálicos y Acero', 
    unit: 'Tira 6m', 
    estimatedPrice: 8990, 
    description: 'Barra de acero con resaltes para armaduras de hormigón armado según NCh204.',
    suppliers: ['Salomon Sack', 'Sodimac Constructor', 'Oximet', 'Construmart']
  },
  { 
    id: 'mat-perf-06', 
    name: 'Fierro Estriado 12mm A630-420H (6m)', 
    category: 'Perfiles Metálicos y Acero', 
    unit: 'Tira 6m', 
    estimatedPrice: 12800, 
    description: 'Acero de refuerzo estructural para vigas, pilares y fundaciones principales.',
    suppliers: ['Salomon Sack', 'Sodimac Constructor', 'Construmart']
  },
  { 
    id: 'mat-perf-07', 
    name: 'Fierro Estriado 8mm A630-420H (6m)', 
    category: 'Perfiles Metálicos y Acero', 
    unit: 'Tira 6m', 
    estimatedPrice: 6200, 
    description: 'Para estribos y confinamiento de pilares y cadenas.',
    suppliers: ['Salomon Sack', 'Sodimac', 'Construmart']
  },
  { 
    id: 'mat-perf-08', 
    name: 'Malla Acma C-92 (2.6x4.8m)', 
    category: 'Perfiles Metálicos y Acero', 
    unit: 'Plancha', 
    estimatedPrice: 33500, 
    description: 'Malla electrosoldada de alambre trefilado para control de fisuración en radieres.',
    suppliers: ['Salomon Sack', 'Sodimac Constructor', 'Construmart']
  },
  { 
    id: 'mat-perf-09', 
    name: 'Perfil Tubular Cuadrado 40x40x2mm x 6m', 
    category: 'Perfiles Metálicos y Acero', 
    unit: 'Tira 6m', 
    estimatedPrice: 16900, 
    description: 'Perfil de acero laminado en caliente/frío para rejas, cobertizos y pilares metálicos.',
    suppliers: ['Salomon Sack', 'Sodimac Constructor', 'Construmart']
  },
  { 
    id: 'mat-perf-10', 
    name: 'Perfil Costanera 100x50x2mm x 6m', 
    category: 'Perfiles Metálicos y Acero', 
    unit: 'Tira 6m', 
    estimatedPrice: 21900, 
    description: 'Viga tipo C para apoyo de cubiertas de techumbres industriales y residenciales.',
    suppliers: ['Salomon Sack', 'Sodimac Constructor', 'Cintac']
  },
  { 
    id: 'mat-perf-11', 
    name: 'Perfil Ángulo 30x30x3mm x 6m', 
    category: 'Perfiles Metálicos y Acero', 
    unit: 'Tira 6m', 
    estimatedPrice: 11500, 
    description: 'Ángulo laminado en L para refuerzos, marcos de puertas y cerrajería.',
    suppliers: ['Salomon Sack', 'Sodimac Constructor']
  },

  // 3. Tornillería y Fijaciones
  { 
    id: 'mat-torn-01', 
    name: 'Tornillo Autoperforante Cabeza Lenteja 8x1/2" Punta Broca', 
    category: 'Tornillería y Fijaciones', 
    unit: 'Caja 1000u', 
    estimatedPrice: 9900, 
    description: 'Fijación de perfiles Metalcon estructura a estructura sin perforación previa.',
    suppliers: ['Imperial', 'Sodimac Constructor', 'Fijaciones Mamut']
  },
  { 
    id: 'mat-torn-02', 
    name: 'Tornillo Yeso-Cartón CRS 6x1 1/4" Rosca Fina', 
    category: 'Tornillería y Fijaciones', 
    unit: 'Caja 1000u', 
    estimatedPrice: 8500, 
    description: 'Tornillo fosfatado negro con cabeza trompeta para fijar planchas de Volcanita a perfiles de acero.',
    suppliers: ['Imperial', 'Sodimac Constructor', 'Construmart']
  },
  { 
    id: 'mat-torn-03', 
    name: 'Tornillo Madera Turbo 2 1/2" Zincado', 
    category: 'Tornillería y Fijaciones', 
    unit: 'Caja 100u', 
    estimatedPrice: 4200, 
    description: 'Tornillo autopenetrante para ensambles de madera estructural y muebles.',
    suppliers: ['Imperial', 'Sodimac', 'Easy']
  },
  { 
    id: 'mat-torn-04', 
    name: 'Tornillo Autoperforante Hexagonal con Golilla 10x3/4"', 
    category: 'Tornillería y Fijaciones', 
    unit: 'Caja 100u', 
    estimatedPrice: 6500, 
    description: 'Para unión de perfiles metálicos gruesos y estructuras pesadas.',
    suppliers: ['Sodimac Constructor', 'Imperial']
  },
  { 
    id: 'mat-torn-05', 
    name: 'Perno Coche 3/8 x 4" con Tuerca y Golilla', 
    category: 'Tornillería y Fijaciones', 
    unit: 'Unidad', 
    estimatedPrice: 590, 
    description: 'Perno de cabeza redonda lisa y cuello cuadrado para fijaciones de vigas y postes de madera.',
    suppliers: ['Sodimac Constructor', 'Imperial', 'Construmart']
  },
  { 
    id: 'mat-torn-06', 
    name: 'Clavo Techo con Golilla Neoprén 2 1/2"', 
    category: 'Tornillería y Fijaciones', 
    unit: 'Bolsa 100u', 
    estimatedPrice: 4800, 
    description: 'Clavo galvanizado helicoidal con sello impermeable para cubiertas de zinc y fibrocemento.',
    suppliers: ['Sodimac', 'Construmart', 'MTS']
  },
  { 
    id: 'mat-torn-07', 
    name: 'Clavo Corriente 3" Acero Dulce', 
    category: 'Tornillería y Fijaciones', 
    unit: 'kg', 
    estimatedPrice: 2290, 
    description: 'Clavo estándar para encofrados, moldajes y clavado de madera en bruto.',
    suppliers: ['Sodimac Constructor', 'Construmart', 'Red MTS']
  },
  { 
    id: 'mat-torn-08', 
    name: 'Tarugo Nylon 8mm Fischer SX con Tornillo', 
    category: 'Tornillería y Fijaciones', 
    unit: 'Bolsa 50u', 
    estimatedPrice: 4900, 
    description: 'Anclaje universal de 4 vías de expansión para hormigón, ladrillo y hormigón celular.',
    suppliers: ['Sodimac', 'Imperial', 'Easy']
  },
  { 
    id: 'mat-torn-09', 
    name: 'Anclaje Perno de Expansión HILTI / Mamut 3/8 x 3"', 
    category: 'Tornillería y Fijaciones', 
    unit: 'Unidad', 
    estimatedPrice: 1250, 
    description: 'Fijación de alto tonelaje para bases de pilares y soleras a radier de hormigón.',
    suppliers: ['Salomon Sack', 'Sodimac Constructor', 'Imperial']
  },
  { 
    id: 'mat-torn-10', 
    name: 'Alambre Negro Recocido N°18', 
    category: 'Tornillería y Fijaciones', 
    unit: 'kg', 
    estimatedPrice: 2490, 
    description: 'Alambre flexible para amarras de enfierraduras y estribos en faena.',
    suppliers: ['Salomon Sack', 'Sodimac Constructor', 'Construmart']
  },

  // 4. Maderas y Tableros
  { 
    id: 'mat-mad-01', 
    name: 'Pino Insigne Seco 2x4" x 3.2m (Bruto)', 
    category: 'Maderas y Tableros', 
    unit: 'Tira 3.2m', 
    estimatedPrice: 7490, 
    description: 'Madera estructural seca en cámara KD < 18% para vigas, pilares y tabiques.',
    suppliers: ['Imperial', 'Maderas Arauco', 'Sodimac Constructor']
  },
  { 
    id: 'mat-mad-02', 
    name: 'Pino Insigne Seco Cepillado 2x3" x 3.2m', 
    category: 'Maderas y Tableros', 
    unit: 'Tira 3.2m', 
    estimatedPrice: 6200, 
    description: 'Madera calibrada para tabiquería interior fina y estructuras vistas.',
    suppliers: ['Imperial', 'Sodimac Constructor', 'Easy']
  },
  { 
    id: 'mat-mad-03', 
    name: 'Plancha Terciado Estructural 15mm (1.22x2.44m)', 
    category: 'Maderas y Tableros', 
    unit: 'Plancha', 
    estimatedPrice: 24900, 
    description: 'Tablero fenólico contrachapado de pino para bases de piso, entrepisos y muros diafragma.',
    suppliers: ['Imperial', 'Sodimac Constructor', 'Construmart']
  },
  { 
    id: 'mat-mad-04', 
    name: 'Plancha OSB Estructural 9.5mm APA (1.22x2.44m)', 
    category: 'Maderas y Tableros', 
    unit: 'Plancha', 
    estimatedPrice: 14900, 
    description: 'Tablero de virutas orientadas para rigidización de tabiques perimetrales y cubiertas.',
    suppliers: ['Imperial', 'Sodimac Constructor', 'Construmart', 'LP Building']
  },
  { 
    id: 'mat-mad-05', 
    name: 'Plancha Terciado Ranurado 9mm Decorativo', 
    category: 'Maderas y Tableros', 
    unit: 'Plancha', 
    estimatedPrice: 19800, 
    description: 'Revestimiento interior cálido con ranuras verticales simulando entablado.',
    suppliers: ['Imperial', 'Sodimac', 'Easy']
  },
  { 
    id: 'mat-mad-06', 
    name: 'Tabla Tinglado Pino Insigne 1x4" x 3.2m Seco', 
    category: 'Maderas y Tableros', 
    unit: 'Tira 3.2m', 
    estimatedPrice: 4200, 
    description: 'Revestimiento exterior machihembrado tipo traslapo para fachadas de cabañas.',
    suppliers: ['Imperial', 'Sodimac', 'MTS']
  },

  // 5. Tabiquería y Cielos
  { 
    id: 'mat-tab-01', 
    name: 'Plancha Volcanita Standard ST 10mm (1.2x2.4m)', 
    category: 'Tabiquería y Cielos', 
    unit: 'Plancha', 
    estimatedPrice: 8990, 
    description: 'Plancha de yeso-cartón estándar con borde rebajado para cielos y tabiques interiores secos.',
    suppliers: ['Imperial', 'Sodimac Constructor', 'Construmart', 'Knauf']
  },
  { 
    id: 'mat-tab-02', 
    name: 'Plancha Volcanita RH Hidrófuga 12.5mm (1.2x2.4m)', 
    category: 'Tabiquería y Cielos', 
    unit: 'Plancha', 
    estimatedPrice: 13500, 
    description: 'Plancha verde tratada con aditivos hidrófugos de silicona para baños, cocinas y lavaderos.',
    suppliers: ['Imperial', 'Sodimac Constructor', 'Construmart']
  },
  { 
    id: 'mat-tab-03', 
    name: 'Plancha Volcanita RF Cortafuego 12.5mm (1.2x2.4m)', 
    category: 'Tabiquería y Cielos', 
    unit: 'Plancha', 
    estimatedPrice: 14800, 
    description: 'Plancha roja con fibra de vidrio incorporada para resistencia al fuego F60/F120.',
    suppliers: ['Imperial', 'Sodimac Constructor']
  },
  { 
    id: 'mat-tab-04', 
    name: 'Masilla Base Junta Proplac 20kg', 
    category: 'Tabiquería y Cielos', 
    unit: 'Balde 20kg', 
    estimatedPrice: 16900, 
    description: 'Compuesto para pegado de cinta y tratamiento de junturas invisibles en yeso-cartón.',
    suppliers: ['Imperial', 'Sodimac Constructor', 'Construmart']
  },
  { 
    id: 'mat-tab-05', 
    name: 'Cinta Junta de Papel Microperforada 50m', 
    category: 'Tabiquería y Cielos', 
    unit: 'Rollo 50m', 
    estimatedPrice: 3800, 
    description: 'Cinta de papel kraft con estría central para juntas planas y esquinas de tabiques.',
    suppliers: ['Imperial', 'Sodimac', 'Construmart']
  },
  { 
    id: 'mat-tab-06', 
    name: 'Plancha Fibrocemento Permanit 6mm (1.2x2.4m)', 
    category: 'Tabiquería y Cielos', 
    unit: 'Plancha', 
    estimatedPrice: 15400, 
    description: 'Plancha cementicia resistente al agua, hongos y termitas para exteriores y zonas húmedas.',
    suppliers: ['Imperial', 'Sodimac Constructor', 'Construmart']
  },

  // 6. Techumbre e Impermeabilización
  { 
    id: 'mat-tech-01', 
    name: 'Plancha Zinc-Alum Ondulada 0.35mm x 3.66m', 
    category: 'Techumbre e Impermeabilización', 
    unit: 'Plancha', 
    estimatedPrice: 14500, 
    description: 'Cubierta metálica de acero con recubrimiento de aluminio y zinc de larga duración.',
    suppliers: ['Sodimac Constructor', 'Construmart', 'Salomon Sack', 'MTS']
  },
  { 
    id: 'mat-tech-02', 
    name: 'Plancha Zinc-Alum 5V Trapezoidal 0.40mm x 3.66m', 
    category: 'Techumbre e Impermeabilización', 
    unit: 'Plancha', 
    estimatedPrice: 17800, 
    description: 'Perfil trapezoidal de mayor rigidez estructural para galpones y viviendas.',
    suppliers: ['Sodimac Constructor', 'Construmart', 'Cintac']
  },
  { 
    id: 'mat-tech-03', 
    name: 'Caballete Zinc-Alum 0.40mm x 3m', 
    category: 'Techumbre e Impermeabilización', 
    unit: 'Tira 3m', 
    estimatedPrice: 8900, 
    description: 'Remate superior cumbrera para unión de aguas en techumbres.',
    suppliers: ['Sodimac Constructor', 'Construmart']
  },
  { 
    id: 'mat-tech-04', 
    name: 'Fieltro Asfáltico 15 Libras (40m2)', 
    category: 'Techumbre e Impermeabilización', 
    unit: 'Rollo 40m2', 
    estimatedPrice: 14900, 
    description: 'Membrana impermeable de base asfáltica bajo tejas y zinc.',
    suppliers: ['Sodimac Constructor', 'Imperial', 'Construmart']
  },
  { 
    id: 'mat-tech-05', 
    name: 'Teja Asfáltica 3 Lengüetas Tabaco (3m2)', 
    category: 'Techumbre e Impermeabilización', 
    unit: 'Paquete 3m2', 
    estimatedPrice: 34900, 
    description: 'Teja decorativa e impermeable de fibra de vidrio con acabado granítico.',
    suppliers: ['Sodimac Constructor', 'Imperial', 'Easy']
  },
  { 
    id: 'mat-tech-06', 
    name: 'Membrana Asfáltica con Gravilla 4mm', 
    category: 'Techumbre e Impermeabilización', 
    unit: 'Rollo 10m2', 
    estimatedPrice: 39500, 
    description: 'Impermeabilización pesada termosoldable con soplete para losas y terrazas.',
    suppliers: ['Sodimac Constructor', 'Sika Center', 'Imperial']
  },

  // 7. Aislación Térmica y Acústica
  { 
    id: 'mat-ais-01', 
    name: 'Lana de Vidrio Rollo R-122 (50mm x 12m2)', 
    category: 'Aislación Térmica y Acústica', 
    unit: 'Rollo 12m2', 
    estimatedPrice: 18900, 
    description: 'Aislante térmico y acústico incombustible para tabiques, entretechos y mansardas.',
    suppliers: ['Sodimac Constructor', 'Imperial', 'Construmart', 'Volcán']
  },
  { 
    id: 'mat-ais-02', 
    name: 'Lana Mineral Rollo 50mm (10m2)', 
    category: 'Aislación Térmica y Acústica', 
    unit: 'Rollo 10m2', 
    estimatedPrice: 24500, 
    description: 'Alta resistencia al fuego y aislación acústica de rango superior para muros divisorios.',
    suppliers: ['Imperial', 'Sodimac Constructor']
  },
  { 
    id: 'mat-ais-03', 
    name: 'Plancha Poliestireno Expandido Aislapol 50mm (1x1m)', 
    category: 'Aislación Térmica y Acústica', 
    unit: 'Plancha', 
    estimatedPrice: 3200, 
    description: 'Aislante de EPS de densidad 10kg/m3 para sistema EIFS y sobre-losas.',
    suppliers: ['Sodimac Constructor', 'Imperial', 'Aislapol Chile']
  },
  { 
    id: 'mat-ais-04', 
    name: 'Polietileno 0.20mm Barrera de Humedad (100m2)', 
    category: 'Aislación Térmica y Acústica', 
    unit: 'Rollo 100m2', 
    estimatedPrice: 26500, 
    description: 'Film de polietileno grueso para colocar bajo radier antes del vertido de hormigón.',
    suppliers: ['Sodimac Constructor', 'Imperial', 'Construmart']
  },

  // 8. Terminaciones y Pinturas
  { 
    id: 'mat-term-01', 
    name: 'Esmalte al Agua Satinado Blanco Extra Duración', 
    category: 'Terminaciones y Pinturas', 
    unit: 'Tineta 5gal', 
    estimatedPrice: 68900, 
    description: 'Pintura lavable de alta resistencia a la intemperie y humedad con protección antihongos.',
    suppliers: ['Sodimac', 'Imperial', 'Construmart', 'Ceresita']
  },
  { 
    id: 'mat-term-02', 
    name: 'Látex Extracubriente Muros Interiores', 
    category: 'Terminaciones y Pinturas', 
    unit: 'Tineta 5gal', 
    estimatedPrice: 46900, 
    description: 'Pintura al agua de terminación mate con excelente poder cubridor para cielo y muros.',
    suppliers: ['Sodimac', 'Imperial', 'Tricolor', 'Sipa']
  },
  { 
    id: 'mat-term-03', 
    name: 'Pasta Muro Interior 5 Galones', 
    category: 'Terminaciones y Pinturas', 
    unit: 'Tineta 5gal', 
    estimatedPrice: 22900, 
    description: 'Pasta base acuosa para alisar y preparar muros estucados o de yeso antes de pintar.',
    suppliers: ['Sodimac Constructor', 'Imperial', 'Construmart']
  },
  { 
    id: 'mat-term-04', 
    name: 'Cerámica Piso/Muro Gris 33x33cm', 
    category: 'Terminaciones y Pinturas', 
    unit: 'm2', 
    estimatedPrice: 7990, 
    description: 'Revestimiento cerámico esmaltado de tráfico residencial medio para baños y cocinas.',
    suppliers: ['Cordillera', 'Sodimac', 'Construmart', 'Easy']
  },
  { 
    id: 'mat-term-05', 
    name: 'Porcelanato Rectificado 60x60cm Pulido / Mate', 
    category: 'Terminaciones y Pinturas', 
    unit: 'm2', 
    estimatedPrice: 14900, 
    description: 'Piso de porcelana de alta dureza y absorción de agua casi nula para alto tráfico.',
    suppliers: ['Sodimac', 'MK', 'Imperial', 'Construmart']
  },
  { 
    id: 'mat-term-06', 
    name: 'Adhesivo Cerámico Bekron DA Pasta 25kg', 
    category: 'Terminaciones y Pinturas', 
    unit: 'Balde 25kg', 
    estimatedPrice: 19800, 
    description: 'Pegamento de alta adherencia y elasticidad para cerámicas y porcelanatos sobre yeso o madera.',
    suppliers: ['Sodimac Constructor', 'Imperial', 'Construmart', 'Bekron']
  },
  { 
    id: 'mat-term-07', 
    name: 'Frague Impermeable con Antimicótico 5kg', 
    category: 'Terminaciones y Pinturas', 
    unit: 'Bolsa 5kg', 
    estimatedPrice: 6500, 
    description: 'Mortero de rejuntado para sellar juntas entre cerámicas y piedras.',
    suppliers: ['Sodimac', 'Imperial', 'Construmart']
  },

  // 9. Electricidad y Canalización
  { 
    id: 'mat-elec-01', 
    name: 'Tubo Conduit PVC 20mm x 3m', 
    category: 'Electricidad y Canalización', 
    unit: 'Tira 3m', 
    estimatedPrice: 2190, 
    description: 'Canalización rígida autoextinguible para embutir circuitos eléctricos domiciliarios.',
    suppliers: ['Sodimac Constructor', 'Imperial', 'Dartel', 'Electrocom']
  },
  { 
    id: 'mat-elec-02', 
    name: 'Cable Eléctrico EVA Libre de Halógenos 2.5mm2 (100m)', 
    category: 'Electricidad y Canalización', 
    unit: 'Rollo 100m', 
    estimatedPrice: 64900, 
    description: 'Conductor de cobre según norma RIC SEC para enchufes y circuitos de fuerza.',
    suppliers: ['Dartel', 'Sodimac Constructor', 'Electrocom', 'Covisa']
  },
  { 
    id: 'mat-elec-03', 
    name: 'Cable Eléctrico EVA Libre de Halógenos 1.5mm2 (100m)', 
    category: 'Electricidad y Canalización', 
    unit: 'Rollo 100m', 
    estimatedPrice: 42900, 
    description: 'Conductor para circuitos de iluminación domiciliaria.',
    suppliers: ['Dartel', 'Sodimac Constructor', 'Electrocom']
  },
  { 
    id: 'mat-elec-04', 
    name: 'Tablero Eléctrico Embutido 12 Módulos Legrand / Bticino', 
    category: 'Electricidad y Canalización', 
    unit: 'Unidad', 
    estimatedPrice: 18900, 
    description: 'Gabinete plástico ignífugo para distribución de disyuntores.',
    suppliers: ['Dartel', 'Sodimac', 'Imperial']
  },
  { 
    id: 'mat-elec-05', 
    name: 'Disyuntor Automático Bipolar 16A Curva C Schneider', 
    category: 'Electricidad y Canalización', 
    unit: 'Unidad', 
    estimatedPrice: 6800, 
    description: 'Protección termomagnética de 2 polos contra sobrecargas y cortocircuitos.',
    suppliers: ['Dartel', 'Sodimac Constructor', 'Electrocom']
  },
  { 
    id: 'mat-elec-06', 
    name: 'Protector Diferencial Bipolar 2x25A 30mA', 
    category: 'Electricidad y Canalización', 
    unit: 'Unidad', 
    estimatedPrice: 15900, 
    description: 'Dispositivo salvavidas para protección de personas ante fugas de corriente.',
    suppliers: ['Dartel', 'Sodimac', 'Imperial']
  },

  // 10. Gasfitería y Alcantarillado
  { 
    id: 'mat-gas-01', 
    name: 'Tubo PVC Sanitario Gris 110mm x 3m', 
    category: 'Gasfitería y Alcantarillado', 
    unit: 'Tira 3m', 
    estimatedPrice: 15800, 
    description: 'Tubería pesada para desagües de inodoros y descargas de alcantarillado.',
    suppliers: ['Sodimac Constructor', 'Imperial', 'Construmart', 'Vinilit']
  },
  { 
    id: 'mat-gas-02', 
    name: 'Tubo PVC Sanitario Gris 50mm x 3m', 
    category: 'Gasfitería y Alcantarillado', 
    unit: 'Tira 3m', 
    estimatedPrice: 7200, 
    description: 'Tubería para desagüe de lavamanos, duchas y lavaplatos.',
    suppliers: ['Sodimac Constructor', 'Imperial', 'Construmart']
  },
  { 
    id: 'mat-gas-03', 
    name: 'Tubo PPR Termofusión 20mm x 3m PN16 (Agua Fría/Caliente)', 
    category: 'Gasfitería y Alcantarillado', 
    unit: 'Tira 3m', 
    estimatedPrice: 3890, 
    description: 'Tubería de polipropileno copolímero unida por fusión térmica sin soldadura líquida.',
    suppliers: ['Imperial', 'Sodimac Constructor', 'Construmart', 'Tigre']
  },
  { 
    id: 'mat-gas-04', 
    name: 'Válvula de Paso Esfera Metálica 1/2" HI-HI', 
    category: 'Gasfitería y Alcantarillado', 
    unit: 'Unidad', 
    estimatedPrice: 4200, 
    description: 'Llave de corte rápido en bronce cromado para control de redes de agua potable.',
    suppliers: ['Sodimac', 'Imperial', 'Construmart']
  },
  { 
    id: 'mat-gas-05', 
    name: 'Pegamento PVC Vinilit Tradicional 240cc', 
    category: 'Gasfitería y Alcantarillado', 
    unit: 'Unidad 240cc', 
    estimatedPrice: 6490, 
    description: 'Soldadura líquida solvente para unión estanca de cañerías y fittings sanitarios.',
    suppliers: ['Sodimac Constructor', 'Imperial', 'Construmart']
  },

  // 11. Herramientas y Seguridad
  { 
    id: 'mat-herr-01', 
    name: 'Disco de Corte Diamantado Segmentado 4 1/2"', 
    category: 'Herramientas y Seguridad', 
    unit: 'Unidad', 
    estimatedPrice: 9500, 
    description: 'Disco para esmeril angular para corte rápido de hormigón, ladrillo y piedra.',
    suppliers: ['Sodimac Constructor', 'Imperial', 'DeWalt / Bosch']
  },
  { 
    id: 'mat-herr-02', 
    name: 'Disco de Corte Fino para Metal 4 1/2" (1mm)', 
    category: 'Herramientas y Seguridad', 
    unit: 'Unidad', 
    estimatedPrice: 1200, 
    description: 'Corte preciso y sin rebaba de perfiles Metalcon y fierro de construcción.',
    suppliers: ['Sodimac Constructor', 'Imperial', 'Construmart']
  },
  { 
    id: 'mat-herr-03', 
    name: 'Carretilla de Construcción 70L Tolva Reforzada', 
    category: 'Herramientas y Seguridad', 
    unit: 'Unidad', 
    estimatedPrice: 48900, 
    description: 'Carretilla con rueda neumática para acarreo pesado de mezclas y áridos.',
    suppliers: ['Sodimac Constructor', 'Construmart', 'Red MTS']
  },
  { 
    id: 'mat-herr-04', 
    name: 'Huincha de Medir Profesional 8m Stanley / Lufkin', 
    category: 'Herramientas y Seguridad', 
    unit: 'Unidad', 
    estimatedPrice: 12900, 
    description: 'Cinta métrica con bloqueo resistente a caídas e impactos en obra.',
    suppliers: ['Sodimac', 'Imperial', 'Construmart']
  },
  { 
    id: 'mat-herr-05', 
    name: 'Casco de Seguridad Tipo I Clase E con Barbiquejo', 
    category: 'Herramientas y Seguridad', 
    unit: 'Unidad', 
    estimatedPrice: 5900, 
    description: 'Elemento de protección personal certificado según norma chilena NCh461.',
    suppliers: ['Sodimac Constructor', 'Imperial', '3M']
  }
];

