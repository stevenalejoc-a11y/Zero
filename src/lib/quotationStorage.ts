import { Quotation } from '../types';

const STORAGE_PREFIX = 'vina_quotations_';
const GLOBAL_KEY = 'vina_global_quotations';

export const INITIAL_SAMPLE_QUOTATIONS: Quotation[] = [
  {
    id: 'nogales_municipal_sample',
    projectId: 'p1',
    name: 'Obra Municipal Nogales (Techumbre y Baños)',
    date: new Date().toISOString(),
    items: [],
    ownerId: 'admin',
    status: 'approved',
    totalNet: 1045200,
    clientName: 'I. MUNICIPALIDAD DE NOGALES',
    clientRut: '69.060.600-3',
    clientAddress: 'PEDRO FELIX VICUÑA N°199, NOGALES.',
    projectGlosa: 'MANTENCION Y REPARACION DE TECHUMBRE, BAÑOS, SEGUN SOLICITUD DE PEDIDO N°16/5, DOM.',
    deliveryDays: '20 DIAS',
    legalRepresentative: 'ANGELINA DEL CARMEN LEPE RUIZ',
    bankName: 'Viña construcciones & Estructuras SpA.\nCuenta vista Banco Estado N° 912-7-022657-0\nRepresentante legal. Angelina Lepe Ruiz.',
    companyName: 'VIÑA CONSTRUCCIONES & ESTRUCTURAS SPA',
    companyRut: '78.447.669-3',
    companyAddress: 'LAS MAGNOLIAS 222 VIÑA DEL MAR',
    companyContact: '+56992968077',
    companyEmail: 'VINAESTRUCTURASSPA@GMAIL.COM',
    chapters: [
      {
        id: 'ch-1',
        number: 1,
        title: 'REPARACIÓN OFICINA SECRETARIA.',
        items: [
          { name: 'Limpieza de techumbre.', unit: 'GL', quantity: 1, price: 150000, total: 150000 },
          { name: 'Cambio de planchas de zinc onduladas + fijaciones.', unit: 'C/U', quantity: 3, price: 28900, total: 86700 },
          { name: 'Sello poliuretano techumbre.', unit: 'GL', quantity: 1, price: 35000, total: 35000 },
          { name: 'Retiro cielo existente.', unit: 'M2', quantity: 10, price: 8500, total: 85000 },
          { name: 'Revestimiento en terciado ranurado 9mm + cornizas.', unit: 'M2', quantity: 5, price: 22000, total: 110000 }
        ]
      },
      {
        id: 'ch-2',
        number: 2,
        title: 'BAÑOS CENTRO CIVICO.',
        items: [
          { name: 'Retiro y modificación de cañería de cobre.', unit: 'GL', quantity: 1, price: 75000, total: 75000 },
          { name: 'Retiro de cerámicos muros', unit: 'M2', quantity: 20, price: 7000, total: 140000 },
          { name: 'Instalación de porcelanato de muro.', unit: 'M2', quantity: 20, price: 18500, total: 370000 }
        ]
      }
    ]
  },
  {
    id: 'construccion_ampliacion_sample',
    projectId: 'p1',
    name: 'Construcción y Ampliación Habitacional',
    date: new Date().toISOString(),
    items: [],
    ownerId: 'admin',
    status: 'draft',
    totalNet: 2150000,
    clientName: 'INVERSIONES & PROYECTOS HABITACIONALES LTDA.',
    clientRut: '77.543.210-K',
    clientAddress: 'AV. LIBERTAD 1450, VIÑA DEL MAR',
    projectGlosa: 'CONSTRUCCIÓN DE AMPLIACIÓN SEGUNDO PISO Y ESTRUCTURA TECHUMBRE.',
    deliveryDays: '35 DIAS',
    legalRepresentative: 'ANGELINA DEL CARMEN LEPE RUIZ',
    bankName: 'Viña construcciones & Estructuras SpA.\nCuenta vista Banco Estado N° 912-7-022657-0\nRepresentante legal. Angelina Lepe Ruiz.',
    companyName: 'VIÑA CONSTRUCCIONES & ESTRUCTURAS SPA',
    companyRut: '78.447.669-3',
    companyAddress: 'LAS MAGNOLIAS 222 VIÑA DEL MAR',
    companyContact: '+56992968077',
    companyEmail: 'VINAESTRUCTURASSPA@GMAIL.COM',
    chapters: [
      {
        id: 'ch-1',
        number: 1,
        title: 'OBRAS PRELIMINARES Y FUNDACIONES',
        items: [
          { name: 'Trazado, replanteo y excavaciones para fundaciones.', unit: 'M3', quantity: 6, price: 35000, total: 210000 },
          { name: 'Cimientos y sobrecimientos de hormigón armado H-20.', unit: 'M3', quantity: 5, price: 110000, total: 550000 }
        ]
      },
      {
        id: 'ch-2',
        number: 2,
        title: 'ESTRUCTURA DE MUROS Y TABIQUERÍA',
        items: [
          { name: 'Tabiquería estructural Metalcon 60x38x0.85 con aislación.', unit: 'M2', quantity: 45, price: 17500, total: 787500 },
          { name: 'Revestimiento interior placa Volcanita 15mm junta invisible.', unit: 'M2', quantity: 70, price: 8500, total: 595000 }
        ]
      }
    ]
  }
];

export function getLocalQuotations(projectId?: string): Quotation[] {
  try {
    const key = projectId ? `${STORAGE_PREFIX}${projectId}` : GLOBAL_KEY;
    const raw = localStorage.getItem(key);
    let items: Quotation[] = [];

    if (raw) {
      items = JSON.parse(raw) as Quotation[];
    }

    // Also check global storage if specific project key was empty
    if (items.length === 0 && projectId) {
      const globalRaw = localStorage.getItem(GLOBAL_KEY);
      if (globalRaw) {
        items = JSON.parse(globalRaw) as Quotation[];
      }
    }

    // If still empty, seed with initial sample quotations so user always sees data
    if (items.length === 0) {
      items = INITIAL_SAMPLE_QUOTATIONS.map(q => ({
        ...q,
        projectId: projectId || q.projectId
      }));
      localStorage.setItem(key, JSON.stringify(items));
      localStorage.setItem(GLOBAL_KEY, JSON.stringify(items));
    }

    return items;
  } catch (err) {
    console.error('Error reading local quotations:', err);
    return INITIAL_SAMPLE_QUOTATIONS;
  }
}

export function saveLocalQuotation(projectId: string, quotation: Quotation): Quotation {
  try {
    const idToUse = quotation.id || `cot-${Date.now()}`;
    const updatedQuotation: Quotation = { 
      ...quotation, 
      id: idToUse, 
      projectId: projectId || quotation.projectId || 'default' 
    };

    // Save to project key
    const projectKey = `${STORAGE_PREFIX}${projectId}`;
    const existingProject = getLocalQuotations(projectId);
    const pIdx = existingProject.findIndex(q => q.id === idToUse);
    if (pIdx >= 0) {
      existingProject[pIdx] = updatedQuotation;
    } else {
      existingProject.unshift(updatedQuotation);
    }
    localStorage.setItem(projectKey, JSON.stringify(existingProject));

    // Save to global key
    const globalRaw = localStorage.getItem(GLOBAL_KEY);
    let globalList: Quotation[] = globalRaw ? JSON.parse(globalRaw) : [];
    const gIdx = globalList.findIndex(q => q.id === idToUse);
    if (gIdx >= 0) {
      globalList[gIdx] = updatedQuotation;
    } else {
      globalList.unshift(updatedQuotation);
    }
    localStorage.setItem(GLOBAL_KEY, JSON.stringify(globalList));

    return updatedQuotation;
  } catch (err) {
    console.error('Error saving local quotation:', err);
    return quotation;
  }
}

export function deleteLocalQuotation(projectId: string, quotationId: string): void {
  try {
    const projectKey = `${STORAGE_PREFIX}${projectId}`;
    const existingProject = getLocalQuotations(projectId);
    const filteredProject = existingProject.filter(q => q.id !== quotationId);
    localStorage.setItem(projectKey, JSON.stringify(filteredProject));

    const globalRaw = localStorage.getItem(GLOBAL_KEY);
    if (globalRaw) {
      const globalList: Quotation[] = JSON.parse(globalRaw);
      const filteredGlobal = globalList.filter(q => q.id !== quotationId);
      localStorage.setItem(GLOBAL_KEY, JSON.stringify(filteredGlobal));
    }
  } catch (err) {
    console.error('Error deleting local quotation:', err);
  }
}
