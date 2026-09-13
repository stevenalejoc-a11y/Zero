import React, { useState, useEffect, useRef } from 'react';
import { Project, Quotation, QuotationItem, QuotationChapter } from '../types';
import { db } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { 
  X, Plus, Trash2, Download, Eye, Save, Sparkles, Building2,
  FileText, Calendar, DollarSign, Clock, Check, Layers,
  ChevronDown, ChevronUp, RefreshCw, Loader2, Copy, CheckCircle
} from 'lucide-react';
import { 
  createChileanStandardQuotationReportHTML, 
  generatePDFFromElement, 
  formatCLP 
} from '../lib/pdfExport';
import { saveLocalQuotation } from '../lib/quotationStorage';

interface ChileanQuotationEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  project?: Project | null;
  projects?: Project[];
  quotationToEdit?: Quotation | null;
  onSaved?: (savedQuotation: Quotation) => void;
}

// Preset units for Chilean construction
const COMMON_UNITS = [
  'GL', 'M', 'ML', 'M2', 'M3', 'CM', 'MM', 'UN', 'C/U', 
  'SACOS', 'KG', 'TON', 'LT', 'GAL', 'TIRAS', 'PLC', 
  'RLL', 'CAJA', 'PAQ', 'JGO', 'PAR', 'HORAS', 'DIAS', 'VIAJES'
];

// Predefined Chilean Construction Templates
const TEMPLATES = [
  {
    id: 'nogales_municipal',
    name: 'Obra Municipal Nogales (Techumbre y Baños)',
    description: 'Plantilla idéntica a la solicitud de pedido DOM con 3 capítulos y partidas de techumbre, baños y gimnasio.',
    clientName: 'I. MUNICIPALIDAD DE NOGALES',
    clientRut: '69.060.600-3',
    clientAddress: 'PEDRO FELIX VICUÑA N°199, NOGALES.',
    projectGlosa: 'MANTENCION Y REPARACION DE TECHUMBRE, BAÑOS, SEGUN SOLICITUD DE PEDIDO N°16/5, DOM.',
    deliveryDays: '20 DIAS',
    representative: 'ANGELINA DEL CARMEN LEPE RUIZ',
    bankDetails: 'Viña construcciones & Estructuras SpA.\nCuenta vista Banco Estado N° 912-7-022657-0\nRepresentante legal. Angelina Lepe Ruiz.',
    chapters: [
      {
        id: 'ch-1',
        number: 1,
        title: 'REPARACIÓN OFICINA SECRETARIA.',
        items: [
          { name: 'Limpieza de techumbre.', unit: 'GL', quantity: 1, price: 150000 },
          { name: 'Cambio de planchas de zinc onduladas + fijaciones (tornillos autoperforantes con golillas de estaqueidad).', unit: 'C/U', quantity: 3, price: 28900 },
          { name: 'Sello poliuretano techumbre.', unit: 'GL', quantity: 1, price: 35000 },
          { name: 'Retiro cielo existente.', unit: 'M2', quantity: 10, price: 8500 },
          { name: 'Revestimiento en terciado ranurado 9mm + cornizas.', unit: 'M2', quantity: 5, price: 22000 },
          { name: 'Barniz natural.', unit: 'M2', quantity: 10, price: 6500 },
          { name: 'Retiro de puerta y marco puerta.', unit: 'C/U', quantity: 1, price: 25000 },
          { name: 'Instalación de puerta exterior 80cm+ bisagras.', unit: 'C/U', quantity: 1, price: 65000 },
          { name: 'Cerradura exterior.', unit: 'C/U', quantity: 1, price: 22000 },
        ]
      },
      {
        id: 'ch-2',
        number: 2,
        title: 'BAÑOS CENTRO CIVICO.',
        items: [
          { name: 'Retiro y modificacion de cañería de cobre.', unit: 'GL', quantity: 1, price: 75000 },
          { name: 'Retiro de cerámicos muros', unit: 'M2', quantity: 50, price: 7000 },
          { name: 'Instalación de porcelanato de muro.', unit: 'M2', quantity: 50, price: 18500 },
          { name: 'Retiro de artefactos sanitarios.', unit: 'UN', quantity: 6, price: 12000 },
          { name: 'Instalacion de artefactos sanitarios WC.', unit: 'GL', quantity: 3, price: 45000 },
          { name: 'Instalacion de lavamanos con pedestal.', unit: 'GL', quantity: 3, price: 38000 },
          { name: 'Griferia (llave) lavamanos.', unit: 'C/U', quantity: 1, price: 24900 },
        ]
      },
      {
        id: 'ch-3',
        number: 3,
        title: 'REPARACIÓN DE TECHUMBRE GIMNASIO MUNICIPAL DE NOGALES.',
        items: [
          { name: 'Reparacion de techumbre gimnasio de nogales', unit: 'GL', quantity: 1, price: 320000 }
        ]
      }
    ]
  },
  {
    id: 'construccion_ampliacion',
    name: 'Construcción y Ampliación Habitacional',
    description: 'Estructura por capítulos para obras nuevas: Fundaciones, Obra Gruesa, Techumbre y Terminaciones.',
    clientName: 'INVERSIONES & PROYECTOS HABITACIONALES LTDA.',
    clientRut: '77.543.210-K',
    clientAddress: 'AV. LIBERTAD 1450, VIÑA DEL MAR',
    projectGlosa: 'CONSTRUCCIÓN DE AMPLIACIÓN SEGUNDO PISO Y ESTRUCTURA TECHUMBRE.',
    deliveryDays: '35 DIAS',
    representative: 'ANGELINA DEL CARMEN LEPE RUIZ',
    bankDetails: 'Viña construcciones & Estructuras SpA.\nCuenta vista Banco Estado N° 912-7-022657-0\nRepresentante legal. Angelina Lepe Ruiz.',
    chapters: [
      {
        id: 'ch-1',
        number: 1,
        title: 'OBRAS PRELIMINARES Y FUNDACIONES',
        items: [
          { name: 'Trazado, replanteo y excavaciones para fundaciones.', unit: 'M3', quantity: 6, price: 35000 },
          { name: 'Cimientos y sobrecimientos de hormigón armado H-20.', unit: 'M3', quantity: 5, price: 110000 },
          { name: 'Radier interior e=10cm con malla acma C-92 y polietileno.', unit: 'M2', quantity: 35, price: 18000 }
        ]
      },
      {
        id: 'ch-2',
        number: 2,
        title: 'ESTRUCTURA DE MUROS Y TABIQUERÍA',
        items: [
          { name: 'Tabiquería estructural Metalcon 60x38x0.85 con aislación térmica.', unit: 'M2', quantity: 45, price: 17500 },
          { name: 'Revestimiento interior placa Volcanita 15mm junta invisible.', unit: 'M2', quantity: 80, price: 8500 },
          { name: 'Revestimiento exterior plancha OSB 11.1mm con barrera de humedad Tyvek.', unit: 'M2', quantity: 45, price: 14000 }
        ]
      },
      {
        id: 'ch-3',
        number: 3,
        title: 'TECHUMBRE Y CUBIERTA',
        items: [
          { name: 'Estructura cerchas madera pino estructural 2x4 escuadrada.', unit: 'C/U', quantity: 8, price: 42000 },
          { name: 'Cubierta en plancha zinc alum onda toledana e=0.4mm con caballetes.', unit: 'M2', quantity: 50, price: 15500 },
          { name: 'Canales y bajadas de aguas lluvias en PVC 75mm.', unit: 'ML', quantity: 16, price: 12000 }
        ]
      }
    ]
  },
  {
    id: 'remodelacion_banos',
    name: 'Remodelación de Baños y Cocina',
    description: 'Demoliciones, gasfitería, porcelanatos y artefactos sanitarios.',
    clientName: 'CONDOMINIO LOS ALERCES',
    clientRut: '65.123.987-4',
    clientAddress: 'LOS ALERCES 550, CONCÓN',
    projectGlosa: 'REMODELACIÓN INTEGRAL DE BAÑOS Y CAMBIO DE RED DE AGUA.',
    deliveryDays: '15 DIAS',
    representative: 'ANGELINA DEL CARMEN LEPE RUIZ',
    bankDetails: 'Viña construcciones & Estructuras SpA.\nCuenta vista Banco Estado N° 912-7-022657-0\nRepresentante legal. Angelina Lepe Ruiz.',
    chapters: [
      {
        id: 'ch-1',
        number: 1,
        title: 'DEMOLICIÓN Y RETIRO DE ARTEFACTOS',
        items: [
          { name: 'Retiro cuidadoso de artefactos sanitarios antiguos.', unit: 'GL', quantity: 1, price: 45000 },
          { name: 'Picado y retiro de cerámicos existentes en piso y muros.', unit: 'M2', quantity: 24, price: 7500 }
        ]
      },
      {
        id: 'ch-2',
        number: 2,
        title: 'INSTALACIONES Y REVESTIMIENTOS',
        items: [
          { name: 'Modificación y prueba hidráulica de red PPR agua fría y caliente.', unit: 'GL', quantity: 1, price: 130000 },
          { name: 'Impermeabilización de muros y ducha con membrana hidro-repelente.', unit: 'M2', quantity: 14, price: 13000 },
          { name: 'Instalación de porcelanato rectificado 60x60 en muros y piso.', unit: 'M2', quantity: 24, price: 19500 }
        ]
      },
      {
        id: 'ch-3',
        number: 3,
        title: 'MONTAJE DE ARTEFACTOS Y GRIFERÍA',
        items: [
          { name: 'Instalación de WC One Piece ecológico y conexión flexible.', unit: 'C/U', quantity: 1, price: 42000 },
          { name: 'Instalación de mueble vanitorio con grifería monomando alta.', unit: 'C/U', quantity: 1, price: 48000 },
          { name: 'Instalación de shower door de cristal templado 8mm.', unit: 'C/U', quantity: 1, price: 75000 }
        ]
      }
    ]
  }
];

export default function ChileanQuotationEditorModal({
  isOpen,
  onClose,
  project,
  projects,
  quotationToEdit,
  onSaved
}: ChileanQuotationEditorModalProps) {
  // Associated Project Selection
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    quotationToEdit?.projectId || project?.id || (projects && projects[0]?.id) || 'general'
  );

  const effectiveProject: Project = (project && project.id === selectedProjectId)
    ? project
    : (projects?.find(p => p.id === selectedProjectId) || project || {
        id: selectedProjectId || 'general',
        name: 'Propuesta General / Licitación',
        address: 'Región de Valparaíso',
        description: 'Cotización comercial estándar',
        budget: 0,
        totalNetInvoices: 0,
        totalIvaInvoices: 0,
        totalExpenses: 0,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
        ownerId: 'user'
      });

  // Form State - start completely empty with no pre-filled data
  const [quotationName, setQuotationName] = useState('');
  const [quotationDate, setQuotationDate] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientRut, setClientRut] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [projectGlosa, setProjectGlosa] = useState('');
  const [deliveryDays, setDeliveryDays] = useState('');
  const [representative, setRepresentative] = useState('');
  const [bankDetails, setBankDetails] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyRut, setCompanyRut] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyContact, setCompanyContact] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');

  // Chapters & Items State - clean initial blank slate
  const [chapters, setChapters] = useState<QuotationChapter[]>([
    {
      id: 'ch-1',
      number: 1,
      title: '',
      items: [
        {
          id: 'it-1-1',
          itemNumber: '1.1',
          chapterNumber: 1,
          chapterTitle: '',
          name: '',
          unit: '',
          quantity: 1,
          price: 0,
          total: 0
        }
      ]
    }
  ]);

  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfStatusMessage, setPdfStatusMessage] = useState('');

  const previewRef = useRef<HTMLDivElement>(null);

  // Initialize or populate data
  useEffect(() => {
    if (!isOpen) return;

    if (quotationToEdit) {
      setSelectedProjectId(quotationToEdit.projectId || project?.id || 'general');
      setQuotationName(quotationToEdit.name || '');
      setQuotationDate(quotationToEdit.date ? quotationToEdit.date.split('T')[0] : '');
      setClientName(quotationToEdit.clientName || '');
      setClientRut(quotationToEdit.clientRut || '');
      setClientAddress(quotationToEdit.clientAddress || '');
      setProjectGlosa(quotationToEdit.projectGlosa || '');
      setDeliveryDays(String(quotationToEdit.deliveryDays || ''));
      setRepresentative(quotationToEdit.legalRepresentative || '');
      setBankDetails(quotationToEdit.bankName || '');
      setCompanyName(quotationToEdit.companyName || '');
      setCompanyRut(quotationToEdit.companyRut || '');
      setCompanyAddress(quotationToEdit.companyAddress || '');
      setCompanyContact(quotationToEdit.companyContact || '');
      setCompanyEmail(quotationToEdit.companyEmail || '');

      // Reconstruct chapters if saved
      if (quotationToEdit.chapters && quotationToEdit.chapters.length > 0) {
        setChapters(quotationToEdit.chapters);
      } else if (quotationToEdit.items && quotationToEdit.items.length > 0) {
        // Group items by chapter number
        const map = new Map<number, QuotationChapter>();
        quotationToEdit.items.forEach((it, idx) => {
          let chNum = it.chapterNumber || 1;
          let chTitle = it.chapterTitle || 'PARTIDA GENERAL';

          if (it.itemNumber && it.itemNumber.includes('.')) {
            const parsed = parseInt(it.itemNumber.split('.')[0], 10);
            if (!isNaN(parsed)) chNum = parsed;
          }

          if (!map.has(chNum)) {
            map.set(chNum, {
              id: `ch-${chNum}`,
              number: chNum,
              title: chTitle,
              items: []
            });
          }

          map.get(chNum)!.items.push({
            ...it,
            id: it.id || `it-${chNum}-${idx}`,
            itemNumber: it.itemNumber || `${chNum}.${map.get(chNum)!.items.length + 1}`,
            total: it.total || (it.quantity * it.price)
          });
        });
        setChapters(Array.from(map.values()));
      }
    } else {
      // Start with a completely blank slate - NOTHING PRE-FILLED!
      setSelectedProjectId('general');
      setQuotationName('');
      setQuotationDate('');
      setClientName('');
      setClientRut('');
      setClientAddress('');
      setProjectGlosa('');
      setDeliveryDays('');
      setRepresentative('');
      setBankDetails('');
      setCompanyName('');
      setCompanyRut('');
      setCompanyAddress('');
      setCompanyContact('');
      setCompanyEmail('');
      
      setChapters([
        {
          id: 'ch-1',
          number: 1,
          title: '',
          items: [
            {
              id: 'it-1-1',
              itemNumber: '1.1',
              chapterNumber: 1,
              chapterTitle: '',
              name: '',
              unit: '',
              quantity: 1,
              price: 0,
              total: 0
            }
          ]
        }
      ]);
    }
  }, [isOpen, quotationToEdit, project]);

  const loadTemplate = (tmpl: typeof TEMPLATES[0]) => {
    setQuotationName(tmpl.name);
    setClientName(tmpl.clientName);
    setClientRut(tmpl.clientRut);
    setClientAddress(tmpl.clientAddress);
    setProjectGlosa(tmpl.projectGlosa);
    setDeliveryDays(tmpl.deliveryDays);
    setRepresentative(tmpl.representative);
    setBankDetails(tmpl.bankDetails);

    // Format chapters
    const builtChapters: QuotationChapter[] = tmpl.chapters.map(ch => ({
      id: ch.id,
      number: ch.number,
      title: ch.title,
      items: ch.items.map((it, idx) => ({
        id: `it-${ch.number}-${idx + 1}`,
        itemNumber: `${ch.number}.${idx + 1}`,
        chapterNumber: ch.number,
        chapterTitle: ch.title,
        name: it.name,
        unit: it.unit,
        quantity: it.quantity,
        price: it.price,
        total: it.quantity * it.price
      }))
    }));

    setChapters(builtChapters);
  };

  // Chapter management
  const addChapter = () => {
    const nextNumber = chapters.length + 1;
    const newChapter: QuotationChapter = {
      id: `ch-${Date.now()}`,
      number: nextNumber,
      title: `CAPÍTULO ${nextNumber}: NUEVAS PARTIDAS`,
      items: [
        {
          id: `it-${nextNumber}-1`,
          itemNumber: `${nextNumber}.1`,
          chapterNumber: nextNumber,
          chapterTitle: `CAPÍTULO ${nextNumber}: NUEVAS PARTIDAS`,
          name: 'Descripción de la partida o trabajo...',
          unit: 'GL',
          quantity: 1,
          price: 0,
          total: 0
        }
      ]
    };
    setChapters([...chapters, newChapter]);
  };

  const updateChapterTitle = (chapterIndex: number, newTitle: string) => {
    const updated = [...chapters];
    updated[chapterIndex].title = newTitle;
    setChapters(updated);
  };

  const removeChapter = (chapterIndex: number) => {
    if (chapters.length === 1) {
      alert('La cotización debe tener al menos un capítulo.');
      return;
    }
    const updated = chapters.filter((_, idx) => idx !== chapterIndex).map((ch, idx) => {
      const newNum = idx + 1;
      return {
        ...ch,
        number: newNum,
        items: ch.items.map((it, itIdx) => ({
          ...it,
          chapterNumber: newNum,
          itemNumber: `${newNum}.${itIdx + 1}`
        }))
      };
    });
    setChapters(updated);
  };

  // Item management within chapter
  const addItemToChapter = (chapterIndex: number) => {
    const updated = [...chapters];
    const chapter = updated[chapterIndex];
    const nextItemIndex = chapter.items.length + 1;

    const newItem: QuotationItem = {
      id: `it-${chapter.number}-${Date.now()}`,
      itemNumber: `${chapter.number}.${nextItemIndex}`,
      chapterNumber: chapter.number,
      chapterTitle: chapter.title,
      name: '',
      unit: 'GL',
      quantity: 1,
      price: 0,
      total: 0
    };

    chapter.items.push(newItem);
    setChapters(updated);
  };

  const updateItem = (
    chapterIndex: number,
    itemIndex: number,
    field: keyof QuotationItem,
    value: any
  ) => {
    const updated = [...chapters];
    const item = { ...updated[chapterIndex].items[itemIndex], [field]: value };

    if (field === 'quantity' || field === 'price') {
      const q = field === 'quantity' ? Number(value) || 0 : item.quantity;
      const p = field === 'price' ? Number(value) || 0 : item.price;
      item.total = q * p;
    }

    updated[chapterIndex].items[itemIndex] = item;
    setChapters(updated);
  };

  const removeItemFromChapter = (chapterIndex: number, itemIndex: number) => {
    setChapters(prev => prev.map((ch, cIdx) => {
      if (cIdx !== chapterIndex) return ch;
      const newItems = ch.items
        .filter((_, idx) => idx !== itemIndex)
        .map((it, idx) => ({
          ...it,
          itemNumber: `${ch.number}.${idx + 1}`
        }));
      return { ...ch, items: newItems };
    }));
  };

  // Compute live totals
  let totalCostDirect = 0;
  const flatItems: QuotationItem[] = [];
  chapters.forEach(ch => {
    ch.items.forEach(it => {
      totalCostDirect += it.total;
      flatItems.push(it);
    });
  });

  const totalIva = Math.round(totalCostDirect * 0.19);
  const totalGeneral = totalCostDirect + totalIva;

  // Build current Quotation Object for Preview & Save
  const currentQuotationObject: Quotation = {
    id: quotationToEdit?.id,
    projectId: selectedProjectId,
    name: quotationName || 'Cotización de Obras',
    date: quotationDate,
    items: flatItems,
    chapters: chapters,
    totalNet: totalCostDirect,
    status: quotationToEdit?.status || 'draft',
    ownerId: effectiveProject.ownerId || 'user',
    clientName,
    clientRut,
    clientAddress,
    projectGlosa,
    deliveryDays,
    legalRepresentative: representative,
    bankName: bankDetails,
    companyName,
    companyRut,
    companyAddress,
    companyContact,
    companyEmail,
    styleFormat: 'chilean_standard'
  };

  // Update Live Preview
  useEffect(() => {
    if (!previewRef.current || !isOpen) return;

    previewRef.current.innerHTML = '';
    const htmlElement = createChileanStandardQuotationReportHTML(
      effectiveProject,
      currentQuotationObject
    );
    previewRef.current.appendChild(htmlElement);
  }, [
    isOpen,
    activeTab,
    selectedProjectId,
    quotationName,
    quotationDate,
    clientName,
    clientRut,
    clientAddress,
    projectGlosa,
    deliveryDays,
    representative,
    bankDetails,
    companyName,
    companyRut,
    companyAddress,
    companyContact,
    companyEmail,
    chapters
  ]);

  // Save to Firebase and Local Storage
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const handleSaveQuotation = async () => {
    if (!quotationName.trim()) {
      alert('Por favor ingresa un nombre para la cotización.');
      return;
    }

    setIsSaving(true);
    setSaveSuccessMessage(null);

    let savedObject = { ...currentQuotationObject };

    try {
      if (quotationToEdit?.id && !quotationToEdit.id.startsWith('local-')) {
        try {
          await updateDoc(doc(db, 'quotations', quotationToEdit.id), {
            ...savedObject,
            updatedAt: new Date().toISOString()
          });
        } catch (fbErr) {
          console.warn('Firestore update error, proceeding with local save:', fbErr);
        }
      } else {
        try {
          const docRef = await addDoc(collection(db, 'quotations'), {
            ...savedObject,
            createdAt: new Date().toISOString()
          });
          savedObject.id = docRef.id;
        } catch (fbErr) {
          console.warn('Firestore addDoc error, proceeding with local save:', fbErr);
          savedObject.id = quotationToEdit?.id || `local-${Date.now()}`;
        }
      }

      // Always persist locally to ensure complete offline & instant persistence
      const finalSaved = saveLocalQuotation(selectedProjectId, savedObject);

      setSaveSuccessMessage('¡Cotización guardada exitosamente!');
      if (onSaved) onSaved(finalSaved);

      setTimeout(() => {
        setSaveSuccessMessage(null);
        onClose();
      }, 700);
    } catch (error) {
      console.error('Error saving Chilean quotation:', error);
      // Fallback save locally
      savedObject.id = quotationToEdit?.id || `local-${Date.now()}`;
      const finalSaved = saveLocalQuotation(selectedProjectId, savedObject);
      if (onSaved) onSaved(finalSaved);
      setSaveSuccessMessage('¡Cotización guardada localmente!');
      setTimeout(() => {
        setSaveSuccessMessage(null);
        onClose();
      }, 700);
    } finally {
      setIsSaving(false);
    }
  };

  // Direct PDF Export
  const handleDirectExportPDF = async () => {
    setIsGeneratingPDF(true);
    setPdfStatusMessage('Generando documento oficial en PDF...');

    try {
      const htmlElement = createChileanStandardQuotationReportHTML(
        effectiveProject,
        currentQuotationObject
      );

      const filename = `Cotizacion_${(quotationName || 'Oficial').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

      await generatePDFFromElement(htmlElement, filename, (msg) => {
        setPdfStatusMessage(msg);
      });
    } catch (error) {
      console.error('Error generating Chilean standard PDF quote:', error);
      alert('Ocurrió un error al generar el PDF.');
    } finally {
      setIsGeneratingPDF(false);
      setPdfStatusMessage('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-7xl max-h-[96vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-blue-600/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 dark:text-white text-base sm:text-lg uppercase tracking-tight">
                  {quotationToEdit ? 'Editar Cotización Estándar Chilena' : 'Crear Cotización Estándar Chilena'}
                </h3>
                <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-[10px] font-black uppercase rounded-full">
                  Formato Contratista / Municipal DOM
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Diseñada con encabezados celestes, ítems por capítulos, RUT de mandante, plazo y datos bancarios.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher Mobile / Desktop */}
            <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'editor'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Editor de Partidas
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'preview'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Vista Previa A4
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL MAIN CONTENT */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          
          {/* LEFT: EDITOR FORM (Visible when activeTab === 'editor' or on wide screen) */}
          <div className={`flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900 ${activeTab === 'preview' ? 'hidden lg:block lg:max-w-xl xl:max-w-2xl border-r border-slate-200 dark:border-slate-800' : 'w-full'}`}>
            
            {/* QUICK PRESET TEMPLATES BAR */}
            <div className="p-3.5 bg-blue-50/80 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Cargar Plantilla Rápida de Construcción:
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => loadTemplate(tmpl)}
                    className="p-2 bg-white dark:bg-slate-800 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 border border-blue-200/60 dark:border-blue-800 rounded-xl text-left transition-all group"
                  >
                    <p className="text-[11px] font-bold text-slate-900 dark:text-white group-hover:text-blue-600 line-clamp-1">
                      {tmpl.name}
                    </p>
                    <p className="text-[9.5px] text-slate-500 dark:text-slate-400 line-clamp-1">
                      {tmpl.chapters.length} Capítulos • {tmpl.deliveryDays}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* GENERAL QUOTATION INFO */}
            <div className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-600 dark:text-slate-300 tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                1. Datos Principales de la Cotización
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Título / Identificador de la Cotización *
                  </label>
                  <input
                    type="text"
                    value={quotationName}
                    onChange={(e) => setQuotationName(e.target.value)}
                    placeholder="Ej. Cotización Techumbre y Baños Nogales"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Fecha de Emisión
                  </label>
                  <input
                    type="date"
                    value={quotationDate}
                    onChange={(e) => setQuotationDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Obra Destino / Proyecto Vinculado */}
              {projects && projects.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Obra / Proyecto Asociado
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="general">Propuesta General / Licitación Independiente</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        Obra: {p.name} ({p.address || 'Sin dirección'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* MANDANTE / CLIENTE SECTION */}
            <div className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-600 dark:text-slate-300 tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                2. Datos del Cliente / Mandante (Sección CLIENTE)
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Nombre Cliente / Municipalidad
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ej. I. MUNICIPALIDAD DE NOGALES"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    RUT del Cliente
                  </label>
                  <input
                    type="text"
                    value={clientRut}
                    onChange={(e) => setClientRut(e.target.value)}
                    placeholder="Ej. 69.060.600-3"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Dirección de la Faena / Obra
                  </label>
                  <input
                    type="text"
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    placeholder="Ej. PEDRO FELIX VICUÑA N°199, NOGALES."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Proyecto / Glosa Solicitud DOM
                  </label>
                  <textarea
                    rows={2}
                    value={projectGlosa}
                    onChange={(e) => setProjectGlosa(e.target.value)}
                    placeholder="Ej. MANTENCION Y REPARACION DE TECHUMBRE, BAÑOS, SEGUN SOLICITUD DE PEDIDO N°16/5, DOM."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* CHAPTERS & ITEMS BUILDER */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase text-slate-600 dark:text-slate-300 tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  3. Capítulos y Partidas de la Cotización
                </h4>

                <button
                  type="button"
                  onClick={addChapter}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar Capítulo
                </button>
              </div>

              {/* CHAPTERS LIST */}
              {chapters.map((chapter, chIdx) => (
                <div 
                  key={chapter.id || chIdx}
                  className="bg-white dark:bg-slate-800/90 rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
                >
                  {/* CHAPTER HEADER */}
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
                    <span className="w-7 h-7 bg-blue-600 text-white rounded-lg font-black text-xs flex items-center justify-center">
                      {chapter.number}
                    </span>
                    <input
                      type="text"
                      value={chapter.title}
                      onChange={(e) => updateChapterTitle(chIdx, e.target.value)}
                      placeholder={`Ej. REPARACIÓN OFICINA SECRETARIA`}
                      className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-black text-slate-900 dark:text-white uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeChapter(chIdx)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Eliminar capítulo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* ITEMS TABLE IN CHAPTER */}
                  <div className="p-3 space-y-2">
                    <div className="hidden sm:grid sm:grid-cols-12 gap-2 text-[10px] font-black uppercase text-slate-400 px-2 pb-1 border-b border-slate-100 dark:border-slate-700/50">
                      <div className="col-span-1 text-center">Ítem</div>
                      <div className="col-span-5">Descripción de la Partida</div>
                      <div className="col-span-2 text-center">Unidad</div>
                      <div className="col-span-1 text-center">Cant.</div>
                      <div className="col-span-2 text-right">Precio Unit.</div>
                      <div className="col-span-1 text-right">Acción</div>
                    </div>

                    {chapter.items.map((item, itIdx) => (
                      <div 
                        key={item.id || itIdx}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800"
                      >
                        <div className="sm:col-span-1 text-center font-bold text-xs text-blue-600 dark:text-blue-400">
                          {item.itemNumber || `${chapter.number}.${itIdx + 1}`}
                        </div>

                        <div className="sm:col-span-5">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateItem(chIdx, itIdx, 'name', e.target.value)}
                            placeholder="Ej. Cambio de planchas de zinc..."
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <input
                            type="text"
                            list={`units-${chIdx}-${itIdx}`}
                            value={item.unit}
                            onChange={(e) => updateItem(chIdx, itIdx, 'unit', e.target.value.toUpperCase())}
                            placeholder="GL"
                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-center text-slate-900 dark:text-white uppercase focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                          <datalist id={`units-${chIdx}-${itIdx}`}>
                            {COMMON_UNITS.map(u => (
                              <option key={u} value={u} />
                            ))}
                          </datalist>
                        </div>

                        <div className="sm:col-span-1">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.quantity}
                            onChange={(e) => updateItem(chIdx, itIdx, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-center text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <input
                            type="number"
                            min="0"
                            value={item.price}
                            onChange={(e) => updateItem(chIdx, itIdx, 'price', parseInt(e.target.value) || 0)}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-right text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>

                        <div className="sm:col-span-1 text-right flex justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              removeItemFromChapter(chIdx, itIdx);
                            }}
                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar partida"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => addItemToChapter(chIdx)}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Añadir Partida a {chapter.title || `Capítulo ${chapter.number}`}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* CONDITIONS & BANK DETAILS */}
            <div className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-600 dark:text-slate-300 tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                4. Plazo de Entrega, Datos Bancarios y Firma
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Plazo Estimado de Entrega (Destacado Amarillo)
                  </label>
                  <input
                    type="text"
                    value={deliveryDays}
                    onChange={(e) => setDeliveryDays(e.target.value.toUpperCase())}
                    placeholder="Ej. 20 DIAS"
                    className="w-full px-3 py-2 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-300 dark:border-yellow-700 text-yellow-900 dark:text-yellow-200 font-black rounded-xl text-xs outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Representante Legal / Firma Aprobada
                  </label>
                  <input
                    type="text"
                    value={representative}
                    onChange={(e) => setRepresentative(e.target.value)}
                    placeholder="Ej. ANGELINA DEL CARMEN LEPE RUIZ"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none text-slate-900 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Datos Bancarios
                  </label>
                  <textarea
                    rows={3}
                    value={bankDetails}
                    onChange={(e) => setBankDetails(e.target.value)}
                    placeholder="Banco, tipo de cuenta, número de cuenta y titular..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-medium outline-none text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* LIVE FINANCIAL RECAP */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Resumen de la Cotización
                </span>
                <div className="flex gap-4 text-xs">
                  <span>Costo Directo: <strong className="text-white">{formatCLP(totalCostDirect)}</strong></span>
                  <span>IVA (19%): <strong className="text-blue-300">{formatCLP(totalIva)}</strong></span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-black text-blue-400 block">Total Cotizado</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-400">{formatCLP(totalGeneral)}</span>
              </div>
            </div>

          </div>

          {/* RIGHT: LIVE PREVIEW CONTAINER */}
          <div className={`flex-1 bg-slate-200 dark:bg-slate-950 p-3 sm:p-6 overflow-y-auto flex flex-col items-center ${activeTab === 'editor' ? 'hidden lg:flex' : 'flex'}`}>
            <div className="w-full max-w-[820px] flex items-center justify-between mb-3 text-xs text-slate-600 dark:text-slate-400">
              <span className="font-bold flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-blue-600" />
                Vista Previa Estilo Viña Construcciones & Estructuras SpA / Municipal (A4)
              </span>
              <span className="bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-300 dark:border-slate-700 shadow-xs font-bold text-[10px] text-blue-600 dark:text-blue-400">
                {flatItems.length} Partidas en {chapters.length} Capítulos
              </span>
            </div>

            {/* RENDERED PREVIEW CONTAINER */}
            <div className="w-full max-w-[820px] bg-white shadow-2xl rounded-sm border border-slate-300 overflow-hidden transform origin-top transition-all">
              <div ref={previewRef} className="preview-container text-slate-900" />
            </div>
          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            {saveSuccessMessage ? (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 animate-in fade-in">
                <CheckCircle className="w-4 h-4" />
                {saveSuccessMessage}
              </span>
            ) : (
              <>
                <span>Partidas Totales: <strong>{flatItems.length}</strong></span>
                <span>•</span>
                <span>Total Neto: <strong>{formatCLP(totalCostDirect)}</strong></span>
                <span>•</span>
                <span>Total con IVA: <strong className="text-blue-600 dark:text-blue-400">{formatCLP(totalGeneral)}</strong></span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleDirectExportPDF}
              disabled={isGeneratingPDF || flatItems.length === 0}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {isGeneratingPDF ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{pdfStatusMessage || 'Exportando PDF...'}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Descargar PDF</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSaveQuotation}
              disabled={isSaving || !quotationName.trim()}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{quotationToEdit ? 'Actualizar Cotización' : 'Guardar Cotización'}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
