import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { Project, Invoice, Expense, Quotation, Note, QuotationItem } from '../types';

export interface PDFExportOptions {
  companyName?: string;
  companyRut?: string;
  companyAddress?: string;
  companyContact?: string;
  companyEmail?: string;
  rut?: string;
  address?: string;
  contact?: string;
  email?: string;
  notes?: Note[];
  aiAnalysis?: string;
}

const DEFAULT_COMPANY = {
  name: 'VIÑA CONSTRUCCIONES & ESTRUCTURAS SPA',
  rut: '78.447.669-3',
  address: 'LAS MAGNOLIAS 222 VIÑA DEL MAR',
  contact: '+56992968077',
  email: 'VINAESTRUCTURASSPA@GMAIL.COM'
};

/**
 * Clean styles to remove modern color functions like oklch/oklab that break canvas exporters
 */
function cleanDomStyles(element: HTMLElement) {
  const elements = [element, ...Array.from(element.querySelectorAll('*'))];
  elements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    const inlineStyle = htmlEl.getAttribute('style') || '';
    if (inlineStyle.includes('oklch') || inlineStyle.includes('oklab') || inlineStyle.includes('light-dark')) {
      const fixed = inlineStyle
        .replace(/oklch\([^)]*\)/gi, '#2563eb')
        .replace(/oklab\([^)]*\)/gi, '#2563eb')
        .replace(/light-dark\([^)]*\)/gi, '#ffffff');
      htmlEl.setAttribute('style', fixed);
    }
  });
}

/**
 * Capture an element using html2canvas and compile into a multi-page jsPDF document
 */
export async function generatePDFFromElement(
  element: HTMLElement,
  fileName: string,
  onProgress?: (status: string) => void
): Promise<void> {
  onProgress?.('Preparando documento...');

  // Create an off-screen clone with standard styling
  const clone = element.cloneNode(true) as HTMLElement;
  cleanDomStyles(clone);

  clone.style.position = 'fixed';
  clone.style.left = '-9999px';
  clone.style.top = '0';
  clone.style.width = '1000px';
  clone.style.backgroundColor = '#ffffff';
  clone.style.color = '#0f172a';
  clone.style.zIndex = '-1000';
  clone.classList.add('pdf-render-root');

  document.body.appendChild(clone);

  try {
    onProgress?.('Generando imagen de alta resolución...');
    const canvas = await html2canvas(clone, {
      scale: 2, // 2x for crisp Retina quality
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1000,
      onclone: (clonedDoc) => {
        // Ensure no elements in cloned document use unsupported color spaces
        const all = clonedDoc.querySelectorAll('*');
        all.forEach((node) => {
          const el = node as HTMLElement;
          if (el.style) {
            el.style.fontFamily = 'Arial, Helvetica, sans-serif';
          }
        });
      }
    });

    onProgress?.('Compilando archivo PDF...');
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    
    // A4 dimensions in mm: 210 x 297
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const imgProps = pdf.getImageProperties(imgData);
    const calculatedImgHeight = (imgProps.height * pdfWidth) / imgProps.width;

    let heightLeft = calculatedImgHeight;
    let position = 0;
    let pageNum = 1;

    // First page
    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, calculatedImgHeight, undefined, 'FAST');
    heightLeft -= pdfHeight;

    // Subsequent pages if content overflows A4
    while (heightLeft > 2) {
      position -= pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, calculatedImgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;
      pageNum++;
    }

    onProgress?.('Descargando PDF...');
    pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
  } catch (error) {
    console.error('Error in generatePDFFromElement:', error);
    throw error;
  } finally {
    document.body.removeChild(clone);
  }
}

/**
 * Format currency in Chilean Pesos
 */
export function formatCLP(amount: number): string {
  return `$${Math.round(amount || 0).toLocaleString('es-CL')}`;
}

/**
 * Builds HTML template for General Project Report (Resumen General)
 */
export function createGeneralReportHTML(
  project: Project,
  invoices: Invoice[],
  expenses: Expense[],
  notes: Note[] = [],
  options: PDFExportOptions = {}
): HTMLElement {
  const company = { ...DEFAULT_COMPANY, ...options };
  const totalNetInvoices = invoices.reduce((s, i) => s + (i.netAmount || 0), 0);
  const totalIvaInvoices = invoices.reduce((s, i) => s + (i.iva || 0), 0);
  const totalInvoicedGross = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const totalOtherExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalSpent = totalNetInvoices + totalOtherExpenses;
  const remaining = project.budget - totalSpent;
  const marginPercent = project.budget > 0 ? ((project.budget - totalSpent) / project.budget) * 100 : 0;

  // Group expenses by category
  const laborExp = expenses.filter(e => e.category === 'labor').reduce((s, e) => s + e.amount, 0);
  const fuelExp = expenses.filter(e => e.category === 'fuel').reduce((s, e) => s + e.amount, 0);
  const toolsExp = expenses.filter(e => e.category === 'tools').reduce((s, e) => s + e.amount, 0);
  const otherExp = expenses.filter(e => e.category === 'other' || !e.category).reduce((s, e) => s + e.amount, 0);

  const container = document.createElement('div');
  container.className = 'pdf-export-container';
  container.style.padding = '40px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = 'Arial, Helvetica, sans-serif';
  container.style.lineHeight = '1.5';

  container.innerHTML = `
    <!-- HEADER -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 25px;">
      <div>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 6px;">
          <div style="background-color: #2563eb; color: #ffffff; width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px;">
            V
          </div>
          <div>
            <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px;">${company.name}</h1>
            <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: bold;">${company.rut}</p>
          </div>
        </div>
        <p style="margin: 2px 0 0 0; font-size: 10px; color: #64748b;">${company.address}</p>
        <p style="margin: 0; font-size: 10px; color: #64748b;">${company.contact}</p>
      </div>

      <div style="text-align: right;">
        <span style="background-color: #eff6ff; color: #1d4ed8; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; border: 1px solid #bfdbfe;">
          Informe Ejecutivo de Obra
        </span>
        <h2 style="margin: 8px 0 2px 0; font-size: 20px; font-weight: 900; color: #2563eb;">RESUMEN GENERAL</h2>
        <p style="margin: 0; font-size: 11px; color: #64748b;">Fecha de emisión: <strong>${new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })}</strong></p>
        <p style="margin: 0; font-size: 11px; color: #64748b;">Estado: <strong style="color: ${project.status === 'active' ? '#16a34a' : '#2563eb'}; text-transform: uppercase;">${project.status === 'active' ? 'En Ejecución' : project.status === 'completed' ? 'Finalizado' : 'En Pausa'}</strong></p>
      </div>
    </div>

    <!-- PROJECT INFO CARD -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 25px; display: grid; grid-template-columns: 2fr 1fr; gap: 15px;">
      <div>
        <p style="margin: 0; font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; letter-spacing: 0.5px;">Proyecto / Obra</p>
        <h3 style="margin: 2px 0 4px 0; font-size: 18px; font-weight: 800; color: #0f172a;">${project.name}</h3>
        <p style="margin: 0; font-size: 12px; color: #475569;"><strong>Ubicación:</strong> ${project.address || 'Sin dirección especificada'}</p>
        ${project.description ? `<p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b; font-style: italic;">"${project.description}"</p>` : ''}
      </div>
      <div style="border-left: 2px solid #e2e8f0; padding-left: 15px;">
        <p style="margin: 0; font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold;">Presupuesto OC (Neto)</p>
        <p style="margin: 2px 0; font-size: 20px; font-weight: 900; color: #2563eb;">${formatCLP(project.budget)}</p>
        <p style="margin: 0; font-size: 10px; color: #64748b;">Margen Estimado: <strong>${marginPercent.toFixed(1)}%</strong></p>
      </div>
    </div>

    <!-- FINANCIAL KPIS -->
    <div style="margin-bottom: 25px;">
      <h3 style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 10px; border-left: 4px solid #2563eb; padding-left: 8px;">
        Balance Financiero y Rendimiento
      </h3>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
          <p style="margin: 0; font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase;">Presupuesto Base</p>
          <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 800; color: #0f172a;">${formatCLP(project.budget)}</p>
        </div>
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
          <p style="margin: 0; font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase;">Facturas Proveedores</p>
          <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 800; color: #2563eb;">${formatCLP(totalNetInvoices)}</p>
        </div>
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
          <p style="margin: 0; font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase;">Gastos Operacionales</p>
          <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 800; color: #d97706;">${formatCLP(totalOtherExpenses)}</p>
        </div>
        <div style="background-color: ${remaining >= 0 ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${remaining >= 0 ? '#bbf7d0' : '#fecaca'}; border-radius: 8px; padding: 12px; text-align: center;">
          <p style="margin: 0; font-size: 10px; color: ${remaining >= 0 ? '#166534' : '#991b1b'}; font-weight: bold; text-transform: uppercase;">Saldo Disponible</p>
          <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 900; color: ${remaining >= 0 ? '#16a34a' : '#dc2626'};">${formatCLP(remaining)}</p>
        </div>
      </div>
    </div>

    <!-- BREAKDOWN TABLES (2 COLUMNS) -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
      <!-- FACTURAS RESUMEN -->
      <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; background-color: #ffffff;">
        <h4 style="margin: 0 0 10px 0; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #1e293b; display: flex; justify-content: space-between;">
          <span>Compras y Facturas (${invoices.length})</span>
          <span style="color: #2563eb;">Total: ${formatCLP(totalNetInvoices)}</span>
        </h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="border-bottom: 1px solid #e2e8f0; color: #64748b; text-align: left;">
              <th style="padding: 6px 4px; font-size: 10px;">N° Factura</th>
              <th style="padding: 6px 4px; font-size: 10px;">Proveedor</th>
              <th style="padding: 6px 4px; font-size: 10px; text-align: right;">Neto</th>
            </tr>
          </thead>
          <tbody>
            ${invoices.slice(0, 5).map(inv => `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 6px 4px; font-weight: bold; color: #2563eb;">#${inv.invoiceNumber}</td>
                <td style="padding: 6px 4px; color: #334155;">${inv.provider}</td>
                <td style="padding: 6px 4px; text-align: right; font-weight: bold;">${formatCLP(inv.netAmount)}</td>
              </tr>
            `).join('')}
            ${invoices.length === 0 ? `<tr><td colspan="3" style="padding: 12px; text-align: center; color: #94a3b8;">Sin facturas registradas</td></tr>` : ''}
            ${invoices.length > 5 ? `<tr><td colspan="3" style="padding: 6px; text-align: center; font-size: 10px; color: #64748b; background-color: #f8fafc;">+ ${invoices.length - 5} facturas adicionales en el informe detallado</td></tr>` : ''}
          </tbody>
        </table>
      </div>

      <!-- GASTOS OPERATIVOS RESUMEN -->
      <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; background-color: #ffffff;">
        <h4 style="margin: 0 0 10px 0; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #1e293b; display: flex; justify-content: space-between;">
          <span>Costos Operacionales</span>
          <span style="color: #d97706;">Total: ${formatCLP(totalOtherExpenses)}</span>
        </h4>
        <div style="display: flex; flex-direction: column; gap: 8px; font-size: 11px;">
          <div style="display: flex; justify-content: space-between; padding: 6px 8px; background-color: #f8fafc; border-radius: 6px;">
            <span style="color: #475569;">🔨 Mano de Obra Faena:</span>
            <strong style="color: #0f172a;">${formatCLP(laborExp)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 8px; background-color: #f8fafc; border-radius: 6px;">
            <span style="color: #475569;">⛽ Combustible y Fletes:</span>
            <strong style="color: #0f172a;">${formatCLP(fuelExp)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 8px; background-color: #f8fafc; border-radius: 6px;">
            <span style="color: #475569;">🔧 Herramientas y Equipos:</span>
            <strong style="color: #0f172a;">${formatCLP(toolsExp)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 8px; background-color: #f8fafc; border-radius: 6px;">
            <span style="color: #475569;">📦 Otros Gastos Menores:</span>
            <strong style="color: #0f172a;">${formatCLP(otherExp)}</strong>
          </div>
        </div>
      </div>
    </div>

    <!-- NOTES / BITACORA SECTION -->
    ${notes.length > 0 ? `
      <div style="margin-bottom: 25px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; background-color: #f8fafc;">
        <h4 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #1e293b;">
          Últimas Bitácoras y Registros de Obra
        </h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${notes.slice(0, 3).map(n => `
            <div style="background-color: #ffffff; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px; font-size: 11px;">
              <span style="font-weight: bold; color: #2563eb; font-size: 10px;">${new Date(n.date).toLocaleDateString('es-CL')}</span>
              <p style="margin: 2px 0 0 0; color: #334155;">${n.content}</p>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- AI ADVISORY OR ANALYSIS IF AVAILABLE -->
    ${options.aiAnalysis ? `
      <div style="margin-bottom: 25px; border: 1px solid #bfdbfe; background-color: #eff6ff; border-radius: 10px; padding: 14px;">
        <h4 style="margin: 0 0 6px 0; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #1d4ed8;">
          💡 Análisis Financiero & Recomendaciones de Obra
        </h4>
        <p style="margin: 0; font-size: 11px; color: #1e40af; line-height: 1.6; white-space: pre-wrap;">${options.aiAnalysis}</p>
      </div>
    ` : ''}

    <!-- SIGNATURES & LEGAL FOOTER -->
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #cbd5e1; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center;">
      <div>
        <div style="height: 50px; border-bottom: 1px solid #94a3b8; margin-bottom: 6px;"></div>
        <p style="margin: 0; font-size: 11px; font-weight: bold; color: #0f172a;">Administrador de Obra / Jefe de Proyecto</p>
        <p style="margin: 0; font-size: 10px; color: #64748b;">${company.name}</p>
      </div>
      <div>
        <div style="height: 50px; border-bottom: 1px solid #94a3b8; margin-bottom: 6px;"></div>
        <p style="margin: 0; font-size: 11px; font-weight: bold; color: #0f172a;">Recepción Técnica / Mandante ITO</p>
        <p style="margin: 0; font-size: 10px; color: #64748b;">Firma Conforme y Timbre</p>
      </div>
    </div>

    <!-- DOCUMENT FOOTER -->
    <div style="margin-top: 30px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 10px;">
      Documento generado automáticamente por el Sistema Integral de Gestión de Obras • Viña Construcciones & Estructuras SpA • Página 1
    </div>
  `;

  return container;
}

/**
 * Builds HTML template for Invoices & Supplier Report (Reporte de Facturas y Proveedores)
 */
export function createInvoicesReportHTML(
  project: Project,
  invoices: Invoice[],
  options: PDFExportOptions = {}
): HTMLElement {
  const company = { ...DEFAULT_COMPANY, ...options };
  const totalNet = invoices.reduce((s, i) => s + (i.netAmount || 0), 0);
  const totalIva = invoices.reduce((s, i) => s + (i.iva || 0), 0);
  const totalGross = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);

  // Group invoices by provider
  const providerSummary: { [key: string]: { count: number; net: number; iva: number; total: number } } = {};
  invoices.forEach(inv => {
    const prov = inv.provider || 'Proveedor General';
    if (!providerSummary[prov]) {
      providerSummary[prov] = { count: 0, net: 0, iva: 0, total: 0 };
    }
    providerSummary[prov].count++;
    providerSummary[prov].net += inv.netAmount || 0;
    providerSummary[prov].iva += inv.iva || 0;
    providerSummary[prov].total += inv.totalAmount || 0;
  });

  const sortedProviders = Object.entries(providerSummary).sort((a, b) => b[1].net - a[1].net);

  const container = document.createElement('div');
  container.className = 'pdf-export-container';
  container.style.padding = '40px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = 'Arial, Helvetica, sans-serif';
  container.style.lineHeight = '1.5';

  container.innerHTML = `
    <!-- HEADER -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 25px;">
      <div>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 6px;">
          <div style="background-color: #2563eb; color: #ffffff; width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px;">
            🧾
          </div>
          <div>
            <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase;">${company.name}</h1>
            <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: bold;">${company.rut}</p>
          </div>
        </div>
        <p style="margin: 2px 0 0 0; font-size: 10px; color: #64748b;">${company.address}</p>
        <p style="margin: 0; font-size: 10px; color: #64748b;">${company.contact}</p>
      </div>

      <div style="text-align: right;">
        <span style="background-color: #eff6ff; color: #1d4ed8; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; border: 1px solid #bfdbfe;">
          Gestión de Facturación & Proveedores
        </span>
        <h2 style="margin: 8px 0 2px 0; font-size: 20px; font-weight: 900; color: #2563eb;">REPORTE DE FACTURAS</h2>
        <p style="margin: 0; font-size: 11px; color: #64748b;">Proyecto: <strong>${project.name}</strong></p>
        <p style="margin: 0; font-size: 11px; color: #64748b;">Fecha: <strong>${new Date().toLocaleDateString('es-CL')}</strong></p>
      </div>
    </div>

    <!-- FINANCIAL SUMMARY CARDS -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px;">
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center;">
        <p style="margin: 0; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold;">Total Facturas Netas</p>
        <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: 900; color: #0f172a;">${formatCLP(totalNet)}</p>
      </div>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center;">
        <p style="margin: 0; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold;">Crédito Fiscal IVA (19%)</p>
        <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: 900; color: #2563eb;">${formatCLP(totalIva)}</p>
      </div>
      <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px; text-align: center;">
        <p style="margin: 0; font-size: 11px; text-transform: uppercase; color: #1e40af; font-weight: bold;">Total Bruto Facturado</p>
        <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: 900; color: #1d4ed8;">${formatCLP(totalGross)}</p>
      </div>
    </div>

    <!-- CONCENTRATION BY SUPPLIER -->
    <div style="margin-bottom: 25px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; background-color: #ffffff;">
      <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 800; text-transform: uppercase; color: #0f172a; border-left: 4px solid #2563eb; padding-left: 8px;">
        Concentración de Facturación por Proveedor
      </h3>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
        ${sortedProviders.map(([provName, stats]) => {
          const percent = totalNet > 0 ? (stats.net / totalNet) * 100 : 0;
          return `
            <div style="border: 1px solid #f1f5f9; background-color: #f8fafc; padding: 10px 14px; border-radius: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <strong style="font-size: 12px; color: #0f172a;">${provName}</strong>
                <span style="font-size: 10px; background-color: #e2e8f0; color: #475569; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${stats.count} doc(s)</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b;">
                <span>Neto: <strong>${formatCLP(stats.net)}</strong></span>
                <span style="color: #2563eb; font-weight: bold;">${percent.toFixed(1)}% del total</span>
              </div>
            </div>
          `;
        }).join('')}
        ${sortedProviders.length === 0 ? `<p style="color: #94a3b8; font-size: 11px;">No hay proveedores registrados aún.</p>` : ''}
      </div>
    </div>

    <!-- INVOICES DETAILED TABLE -->
    <div style="margin-bottom: 25px;">
      <h3 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 800; text-transform: uppercase; color: #0f172a; border-left: 4px solid #2563eb; padding-left: 8px;">
        Detalle Cronológico de Facturas (IVA Extraído / Restado)
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
        <thead>
          <tr style="background-color: #f1f5f9; color: #475569; border-bottom: 2px solid #cbd5e1;">
            <th style="padding: 8px 10px;">N° Factura</th>
            <th style="padding: 8px 10px;">Proveedor</th>
            <th style="padding: 8px 10px;">Fecha Emisión</th>
            <th style="padding: 8px 10px; text-align: right;">Total Factura</th>
            <th style="padding: 8px 10px; text-align: right;">IVA Extraído (-)</th>
            <th style="padding: 8px 10px; text-align: right;">Monto Neto (Total - IVA)</th>
          </tr>
        </thead>
        <tbody>
          ${invoices.map(inv => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 10px; font-weight: bold; color: #2563eb;">#${inv.invoiceNumber}</td>
              <td style="padding: 8px 10px; font-weight: 600; color: #1e293b;">${inv.provider}</td>
              <td style="padding: 8px 10px; color: #64748b;">${inv.date ? new Date(inv.date).toLocaleDateString('es-CL') : 'N/A'}</td>
              <td style="padding: 8px 10px; text-align: right; font-weight: bold; color: #0f172a;">${formatCLP(inv.totalAmount || (inv.netAmount + inv.iva))}</td>
              <td style="padding: 8px 10px; text-align: right; color: #d97706;">-${formatCLP(inv.iva)}</td>
              <td style="padding: 8px 10px; text-align: right; color: #059669; font-weight: 600;">${formatCLP(inv.netAmount)}</td>
            </tr>
          `).join('')}
          ${invoices.length === 0 ? `<tr><td colspan="6" style="padding: 20px; text-align: center; color: #94a3b8;">No se registran facturas en este proyecto.</td></tr>` : ''}
        </tbody>
        <tfoot>
          <tr style="background-color: #f8fafc; font-weight: bold; border-top: 2px solid #cbd5e1;">
            <td colspan="3" style="padding: 10px; text-transform: uppercase;">Totales Acumulados</td>
            <td style="padding: 10px; text-align: right; font-size: 13px; color: #1e40af;">${formatCLP(totalGross)}</td>
            <td style="padding: 10px; text-align: right; color: #d97706;">-${formatCLP(totalIva)}</td>
            <td style="padding: 10px; text-align: right; color: #059669; font-weight: bold;">${formatCLP(totalNet)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- SIGNATURES -->
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #cbd5e1; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center;">
      <div>
        <div style="height: 50px; border-bottom: 1px solid #94a3b8; margin-bottom: 6px;"></div>
        <p style="margin: 0; font-size: 11px; font-weight: bold; color: #0f172a;">Jefe de Adquisiciones y Bodega</p>
        <p style="margin: 0; font-size: 10px; color: #64748b;">Recepción de Documentos y Materiales</p>
      </div>
      <div>
        <div style="height: 50px; border-bottom: 1px solid #94a3b8; margin-bottom: 6px;"></div>
        <p style="margin: 0; font-size: 11px; font-weight: bold; color: #0f172a;">Departamento de Contabilidad y Finanzas</p>
        <p style="margin: 0; font-size: 10px; color: #64748b;">Revisión y Conciliación Tributaria</p>
      </div>
    </div>

    <div style="margin-top: 30px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 10px;">
      Reporte Oficial de Facturas • Viña Construcciones & Estructuras SpA
    </div>
  `;

  return container;
}

// Backward compatibility export
export const createFactoriesReportHTML = createInvoicesReportHTML;

/**
 * Builds HTML template for a Single Invoice Voucher (Comprobante Individual de Factura)
 */
export function createSingleInvoiceReportHTML(
  project: Project,
  invoice: Invoice,
  options: PDFExportOptions = {}
): HTMLElement {
  const company = { ...DEFAULT_COMPANY, ...options };
  const totalAmount = invoice.totalAmount || ((invoice.netAmount || 0) + (invoice.iva || 0));
  const ivaRate = invoice.ivaRate || 19;
  // El IVA se resta del valor total de la factura, no se suma
  const ivaAmount = invoice.iva || (invoice.extractionMethod === 'direct_percentage'
    ? Math.round(totalAmount * (ivaRate / 100))
    : Math.max(0, totalAmount - Math.round(totalAmount / (1 + (ivaRate / 100)))));
  const netAmount = invoice.netAmount || Math.max(0, totalAmount - ivaAmount);

  const container = document.createElement('div');
  container.className = 'pdf-export-container';
  container.style.padding = '40px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = 'Arial, Helvetica, sans-serif';
  container.style.lineHeight = '1.5';

  container.innerHTML = `
    <!-- HEADER -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 25px;">
      <div>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 6px;">
          <div style="background-color: #2563eb; color: #ffffff; width: 44px; height: 44px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 22px;">
            🧾
          </div>
          <div>
            <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase;">${company.name}</h1>
            <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: bold;">${company.rut}</p>
          </div>
        </div>
        <p style="margin: 2px 0 0 0; font-size: 10px; color: #64748b;">${company.address}</p>
        <p style="margin: 0; font-size: 10px; color: #64748b;">${company.contact}</p>
      </div>

      <div style="text-align: right;">
        <span style="background-color: #eff6ff; color: #1d4ed8; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; border: 1px solid #bfdbfe;">
          Comprobante de Gasto & Factura
        </span>
        <h2 style="margin: 8px 0 2px 0; font-size: 22px; font-weight: 900; color: #2563eb;">FACTURA #${invoice.invoiceNumber}</h2>
        <p style="margin: 0; font-size: 11px; color: #64748b;">Fecha Emisión: <strong>${invoice.date ? new Date(invoice.date + 'T12:00:00').toLocaleDateString('es-CL') : new Date().toLocaleDateString('es-CL')}</strong></p>
        <p style="margin: 0; font-size: 11px; color: #64748b;">Impresión: <strong>${new Date().toLocaleDateString('es-CL')}</strong></p>
      </div>
    </div>

    <!-- DOCUMENT SUMMARY INFO -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 25px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div>
        <p style="margin: 0; font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold;">Proveedor / Emisor del Documento</p>
        <h3 style="margin: 4px 0 6px 0; font-size: 18px; font-weight: 800; color: #0f172a;">${invoice.provider || 'Proveedor no especificado'}</h3>
        <p style="margin: 0; font-size: 11px; color: #475569;"><strong>Documento Tributario:</strong> Factura Electrónica</p>
        <p style="margin: 0; font-size: 11px; color: #475569;"><strong>Folio N°:</strong> ${invoice.invoiceNumber}</p>
      </div>
      <div>
        <p style="margin: 0; font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold;">Centro de Costos / Obra Asignada</p>
        <h3 style="margin: 4px 0 6px 0; font-size: 18px; font-weight: 800; color: #0f172a;">${project.name}</h3>
        <p style="margin: 0; font-size: 11px; color: #475569;"><strong>Ubicación de Faena:</strong> ${project.address}</p>
        <p style="margin: 0; font-size: 11px; color: #475569;"><strong>Estado de Proyecto:</strong> ${project.status === 'active' ? 'En Ejecución' : 'Finalizado'}</p>
      </div>
    </div>

    <!-- MAIN FINANCIAL VOUCHER CARD -->
    <div style="background: linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%); border: 2px solid #bfdbfe; border-radius: 14px; padding: 22px; margin-bottom: 30px;">
      <h3 style="margin: 0 0 16px 0; font-size: 13px; font-weight: 800; text-transform: uppercase; color: #1e3a8a; letter-spacing: 0.5px;">
        Desglose Tributario del Documento (IVA Restado del Total)
      </h3>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
        <div style="background-color: #ffffff; border: 2px solid #2563eb; border-radius: 10px; padding: 14px; text-align: center;">
          <p style="margin: 0; font-size: 11px; color: #2563eb; font-weight: 800; text-transform: uppercase;">Total Factura</p>
          <p style="margin: 6px 0 0 0; font-size: 24px; font-weight: 900; color: #1e3a8a;">${formatCLP(totalAmount)}</p>
          <span style="font-size: 10px; color: #16a34a; font-weight: bold;">Valor Total Documento</span>
        </div>
        <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; text-align: center;">
          <p style="margin: 0; font-size: 11px; color: #d97706; font-weight: bold; text-transform: uppercase;">(-) IVA Extraído (${ivaRate}%)</p>
          <p style="margin: 6px 0 0 0; font-size: 22px; font-weight: 900; color: #d97706;">-${formatCLP(ivaAmount)}</p>
          <span style="font-size: 10px; color: #d97706; font-weight: bold;">Crédito Fiscal SII</span>
        </div>
        <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; text-align: center;">
          <p style="margin: 0; font-size: 11px; color: #059669; font-weight: bold; text-transform: uppercase;">(=) Monto Neto</p>
          <p style="margin: 6px 0 0 0; font-size: 22px; font-weight: 900; color: #059669;">${formatCLP(netAmount)}</p>
          <span style="font-size: 10px; color: #059669; font-weight: bold;">Total - IVA</span>
        </div>
      </div>
    </div>

    <!-- AUDIT & VERIFICATION NOTES -->
    <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 14px 18px; border-radius: 6px; font-size: 11px; color: #475569; margin-bottom: 35px;">
      <p style="margin: 0 0 4px 0; font-weight: bold; color: #0f172a;">Información de Auditoría y Control:</p>
      <ul style="margin: 0; padding-left: 16px; line-height: 1.6;">
        <li>Documento tributario verificado e incorporado al cálculo de costos acumulados de la obra <strong>${project.name}</strong>.</li>
        <li>El IVA Crédito Fiscal (-$${ivaAmount.toLocaleString('es-CL')}) queda deducido del valor total de la factura ($${totalAmount.toLocaleString('es-CL')}) para la conciliación contable mensual ante el SII.</li>
      </ul>
    </div>

    <!-- SIGNATURES -->
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #cbd5e1; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center;">
      <div>
        <div style="height: 50px; border-bottom: 1px solid #94a3b8; margin-bottom: 6px;"></div>
        <p style="margin: 0; font-size: 11px; font-weight: bold; color: #0f172a;">Recepción en Obra / Bodega</p>
        <p style="margin: 0; font-size: 10px; color: #64748b;">Firma y Conforme de Materiales</p>
      </div>
      <div>
        <div style="height: 50px; border-bottom: 1px solid #94a3b8; margin-bottom: 6px;"></div>
        <p style="margin: 0; font-size: 11px; font-weight: bold; color: #0f172a;">Administración & Finanzas</p>
        <p style="margin: 0; font-size: 10px; color: #64748b;">Registro y Pago Efectuado</p>
      </div>
    </div>

    <div style="margin-top: 30px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 10px;">
      Comprobante Oficial de Factura • Viña Construcciones & Estructuras SpA
    </div>
  `;

  return container;
}

/**
 * Builds HTML template for Chilean Standard Contractor / Municipal Quotation
 * (Estilo Oficial Viña Construcciones / Licitaciones & Obras Municipales)
 */
export function createChileanStandardQuotationReportHTML(
  project: Project,
  quotation: Quotation,
  options: PDFExportOptions = {}
): HTMLElement {
  const company = {
    name: quotation.companyName || options.companyName || DEFAULT_COMPANY.name,
    rut: quotation.companyRut || options.companyRut || DEFAULT_COMPANY.rut,
    address: quotation.companyAddress || options.companyAddress || DEFAULT_COMPANY.address,
    contact: quotation.companyContact || options.companyContact || DEFAULT_COMPANY.contact,
    email: quotation.companyEmail || options.companyEmail || DEFAULT_COMPANY.email
  };

  const client = {
    name: quotation.clientName || '',
    rut: quotation.clientRut || '',
    address: quotation.clientAddress || (project?.address && project.id !== 'general' ? project.address : ''),
    projectGlosa: quotation.projectGlosa || (project?.description && project.id !== 'general' ? project.description : '')
  };

  const formattedDate = quotation.date 
    ? new Date(quotation.date).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
    : new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');

  const deliveryDays = quotation.deliveryDays || '';
  const representative = quotation.legalRepresentative || '';
  const bankDetails = quotation.bankName || '';

  // Process items & chapters
  const rawItems = quotation.items || [];
  
  // Group items by chapter
  interface GroupedChapter {
    number: number;
    title: string;
    items: QuotationItem[];
  }

  const chaptersMap = new Map<number, GroupedChapter>();

  if (quotation.chapters && quotation.chapters.length > 0) {
    quotation.chapters.forEach((ch, idx) => {
      chaptersMap.set(ch.number || (idx + 1), {
        number: ch.number || (idx + 1),
        title: ch.title,
        items: ch.items || []
      });
    });
  } else {
    // Infer or group raw items
    rawItems.forEach((it, idx) => {
      let chNum = it.chapterNumber || 1;
      let chTitle = it.chapterTitle || 'PARTIDA GENERAL DE OBRA';

      // If itemNumber is like "2.1", infer chapter 2
      if (it.itemNumber && it.itemNumber.includes('.')) {
        const parts = it.itemNumber.split('.');
        const parsed = parseInt(parts[0], 10);
        if (!isNaN(parsed)) {
          chNum = parsed;
        }
      }

      if (!chaptersMap.has(chNum)) {
        chaptersMap.set(chNum, {
          number: chNum,
          title: chTitle,
          items: []
        });
      }

      chaptersMap.get(chNum)!.items.push(it);
    });
  }

  // If no items at all, fallback default example structure
  if (chaptersMap.size === 0) {
    chaptersMap.set(1, {
      number: 1,
      title: 'REPARACIÓN GENERAL',
      items: []
    });
  }

  const sortedChapters = Array.from(chaptersMap.values()).sort((a, b) => a.number - b.number);

  // Totals calculations
  let totalCostDirect = 0;
  sortedChapters.forEach(ch => {
    ch.items.forEach(it => {
      totalCostDirect += Number(it.total) || 0;
    });
  });

  if (totalCostDirect === 0 && quotation.totalNet) {
    totalCostDirect = quotation.totalNet;
  }

  const ivaAmount = Math.round(totalCostDirect * 0.19);
  const totalAmount = totalCostDirect + ivaAmount;

  const container = document.createElement('div');
  container.className = 'pdf-export-container chilean-standard-quotation';
  container.style.padding = '24px 30px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#000000';
  container.style.fontFamily = '"Segoe UI", Arial, Helvetica, sans-serif';
  container.style.fontSize = '11px';
  container.style.lineHeight = '1.3';

  container.innerHTML = `
    <div style="border: 2px solid #1e3a8a; padding: 0; background-color: #ffffff; box-sizing: border-box; border-radius: 2px; overflow: hidden;">
      
      <!-- 1. SECCION: EMPRESA -->
      <div style="background-color: #1e3a8a; color: #ffffff; padding: 5px 10px; text-align: center; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">
        EMPRESA
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-bottom: 1.5px solid #1e3a8a; background-color: #ffffff;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <!-- LOGO VIÑA CONSTRUCCIONES & ESTRUCTURAS SPA -->
          <div style="height: 60px; display: flex; align-items: center; justify-content: center;">
            <img src="/logo.png" alt="Viña Construcciones & Estructuras SpA" style="height: 56px; width: auto; object-fit: contain;" />
          </div>
        </div>

        <div style="text-align: center; flex: 1; padding: 0 12px;">
          <h2 style="margin: 0; font-size: 14px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px;">
            ${company.name}
          </h2>
          <p style="margin: 3px 0 1px 0; font-size: 10px; font-weight: 700; color: #334155; text-transform: uppercase;">
            ${company.address}
          </p>
          <p style="margin: 1px 0; font-size: 10px; font-weight: 800; color: #0f172a;">
            RUT: ${company.rut}
          </p>
          <p style="margin: 1px 0; font-size: 9.5px; font-weight: 700; color: #334155;">
            CONTACTO: ${company.contact}
          </p>
          <p style="margin: 1px 0 0 0; font-size: 9.5px; font-weight: 700; color: #2563eb; text-transform: uppercase;">
            EMAIL: ${company.email}
          </p>
        </div>
      </div>

      <!-- 2. SECCION: CLIENTE -->
      <div style="background-color: #1e3a8a; color: #ffffff; padding: 5px 10px; text-align: center; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">
        CLIENTE & DATOS DE LA OBRA
      </div>

      <div style="display: grid; grid-template-columns: 1fr 180px; border-bottom: 1.5px solid #1e3a8a; background-color: #ffffff;">
        <div style="padding: 8px 12px; border-right: 1.5px solid #1e3a8a; font-size: 10px;">
          <div style="display: grid; grid-template-columns: 85px 1fr; row-gap: 4px; align-items: baseline;">
            <span style="font-weight: 900; color: #1e3a8a;">NOMBRE:</span>
            <span style="font-weight: 700; text-transform: uppercase; color: #0f172a;">${client.name}</span>

            <span style="font-weight: 900; color: #1e3a8a;">RUT:</span>
            <span style="font-weight: 700; color: #0f172a;">${client.rut}</span>

            <span style="font-weight: 900; color: #1e3a8a;">DIRECCIÓN:</span>
            <span style="font-weight: 700; text-transform: uppercase; color: #0f172a;">${client.address}</span>

            <span style="font-weight: 900; color: #1e3a8a;">PROYECTO:</span>
            <span style="font-weight: 700; text-transform: uppercase; color: #0f172a;">${client.projectGlosa}</span>
          </div>
        </div>

        <div style="padding: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: #f8fafc;">
          <table style="border-collapse: collapse; width: 100%; border: 1.5px solid #1e3a8a; text-align: center;">
            <tr>
              <td style="border: 1px solid #1e3a8a; padding: 5px 6px; font-weight: 900; font-size: 9.5px; background-color: #e2e8f0; color: #0f172a;">
                FECHA
              </td>
              <td style="border: 1px solid #1e3a8a; padding: 5px 6px; font-weight: 800; font-size: 11px; background-color: #ffffff; color: #1e3a8a;">
                ${formattedDate}
              </td>
            </tr>
            <tr>
              <td style="border: 1px solid #1e3a8a; padding: 4px 6px; font-weight: 900; font-size: 9px; background-color: #e2e8f0; color: #0f172a;">
                DOCUMENTO
              </td>
              <td style="border: 1px solid #1e3a8a; padding: 4px 6px; font-weight: 800; font-size: 9.5px; background-color: #ffffff; color: #0f172a;">
                COT-${(quotation.id || '001').substring(0, 6).toUpperCase()}
              </td>
            </tr>
          </table>
        </div>
      </div>

      <!-- 3. SECCION: COTIZACION (TABLA PRINCIPAL) -->
      <div style="background-color: #1e3a8a; color: #ffffff; padding: 5px 10px; text-align: center; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">
        DETALLE DE PARTIDAS Y PRESUPUESTO
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 9.5px; text-align: left;">
        <thead>
          <tr style="background-color: #1e293b; color: #ffffff; text-align: center; font-weight: 900; font-size: 9.5px;">
            <th style="border-right: 1px solid #475569; padding: 6px; width: 55px;">ITEM</th>
            <th style="border-right: 1px solid #475569; padding: 6px 10px; text-align: left;">DESCRIPCIÓN DE LA PARTIDA</th>
            <th style="border-right: 1px solid #475569; padding: 6px; width: 52px;">UNID.</th>
            <th style="border-right: 1px solid #475569; padding: 6px; width: 52px;">CANT.</th>
            <th style="border-right: 1px solid #475569; padding: 6px 8px; width: 90px; text-align: right;">PRECIO UNIT.</th>
            <th style="padding: 6px 10px; width: 100px; text-align: right;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${sortedChapters.map((chapter) => {
            const chapterRow = `
              <tr style="background-color: #f1f5f9; border-bottom: 1.5px solid #cbd5e1;">
                <td style="border-right: 1px solid #cbd5e1; padding: 5px 6px; text-align: center; font-weight: 900; font-size: 10px; color: #1e3a8a;">
                  ${chapter.number}
                </td>
                <td colspan="5" style="padding: 5px 10px; font-weight: 900; text-transform: uppercase; font-size: 10px; color: #0f172a; letter-spacing: 0.3px;">
                  ${chapter.title}
                </td>
              </tr>
            `;

            const itemRows = chapter.items.map((it, idx) => {
              const itemNum = it.itemNumber || `${chapter.number}.${idx + 1}`;
              const unit = it.unit || 'GL';
              const qty = it.quantity || 1;
              const price = Number(it.price) || 0;
              const total = Number(it.total) || (qty * price);

              return `
                <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${idx % 2 === 0 ? '#ffffff' : '#fafafa'};">
                  <td style="border-right: 1px solid #e2e8f0; padding: 4px 6px; text-align: center; font-weight: 700; font-size: 9.5px; color: #334155;">
                    ${itemNum}
                  </td>
                  <td style="border-right: 1px solid #e2e8f0; padding: 4px 10px; font-weight: 500; font-size: 9.5px; color: #0f172a;">
                    ${it.name}
                  </td>
                  <td style="border-right: 1px solid #e2e8f0; padding: 4px; text-align: center; font-weight: 700; font-size: 9px; text-transform: uppercase; color: #475569;">
                    ${unit}
                  </td>
                  <td style="border-right: 1px solid #e2e8f0; padding: 4px; text-align: center; font-weight: 700; font-size: 9.5px; color: #0f172a;">
                    ${qty}
                  </td>
                  <td style="border-right: 1px solid #e2e8f0; padding: 4px 8px; text-align: right; font-weight: 600; font-size: 9.5px; color: #334155;">
                    ${price > 0 ? formatCLP(price) : '$ -'}
                  </td>
                  <td style="padding: 4px 10px; text-align: right; font-weight: 800; font-size: 9.5px; color: #1e3a8a;">
                    ${total > 0 ? formatCLP(total) : '$ -'}
                  </td>
                </tr>
              `;
            }).join('');

            return chapterRow + itemRows;
          }).join('')}
        </tbody>
      </table>

      <!-- 4. FOOTER / TOTALS / ESPACIO EN BLANCO FIRMA / DATOS BANCARIOS / PLAZO -->
      <div style="border-top: 2px solid #1e3a8a; display: grid; grid-template-columns: 1fr 230px; background-color: #ffffff;">
        
        <!-- COLUMNA IZQUIERDA: ESPACIO EN BLANCO PARA FIRMA Y DATOS BANCARIOS -->
        <div style="padding: 10px 14px; border-right: 1.5px solid #1e3a8a; display: flex; flex-direction: column; justify-content: space-between;">
          
          <!-- SECCIÓN DE FIRMA EN BLANCO (SIN TIMBRE DIGITAL, ESPACIO LIMPIO PARA FIRMA MANUAL O DIGITAL) -->
          <div style="text-align: center; padding: 8px 0 12px 0;">
            <div style="font-weight: 800; font-size: 9.5px; text-transform: uppercase; color: #1e3a8a; letter-spacing: 0.5px; margin-bottom: 25px;">
              POR ${company.name}
            </div>

            <!-- ESPACIO LIBRE / LÍNEA EN BLANCO PARA FIRMA -->
            <div style="width: 220px; border-bottom: 1px solid #000000; margin: 0 auto 6px auto;"></div>

            <div style="font-weight: 900; font-size: 10px; text-transform: uppercase; color: #000000;">
              ${representative}
            </div>
            <div style="font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-top: 1px;">
              REPRESENTANTE LEGAL / FIRMA Y TIMBRE
            </div>
          </div>

          <!-- DATOS BANCARIOS BOX -->
          <div style="border: 1.5px solid #1e3a8a; border-radius: 4px; overflow: hidden; display: grid; grid-template-columns: 85px 1fr; font-size: 9px; margin-top: 6px;">
            <div style="border-right: 1.5px solid #1e3a8a; padding: 6px; font-weight: 900; display: flex; align-items: center; justify-content: center; text-align: center; background-color: #f1f5f9; color: #1e3a8a; text-transform: uppercase;">
              DATOS<br/>BANCARIOS
            </div>
            <div style="padding: 6px 10px; font-weight: 700; white-space: pre-line; line-height: 1.4; background-color: #ffffff; color: #0f172a;">
              ${bankDetails}
            </div>
          </div>

        </div>

        <!-- COLUMNA DERECHA: TABLA TOTALES & PLAZO ENTREGA -->
        <div style="display: flex; flex-direction: column; justify-content: space-between; background-color: #f8fafc;">
          
          <!-- TABLA TOTALES (COSTO DIRECTO, IVA, TOTAL) -->
          <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
            <tr style="border-bottom: 1px solid #cbd5e1;">
              <td style="padding: 7px 10px; font-weight: 800; text-align: right; border-right: 1px solid #cbd5e1; background-color: #f1f5f9; color: #334155;">
                COSTO DIRECTO
              </td>
              <td style="padding: 7px 10px; font-weight: 800; text-align: right; width: 105px; background-color: #ffffff; color: #0f172a;">
                ${totalCostDirect > 0 ? formatCLP(totalCostDirect) : '$0'}
              </td>
            </tr>
            <tr style="border-bottom: 1px solid #cbd5e1;">
              <td style="padding: 7px 10px; font-weight: 800; text-align: right; border-right: 1px solid #cbd5e1; background-color: #f1f5f9; color: #334155;">
                IVA (19%)
              </td>
              <td style="padding: 7px 10px; font-weight: 800; text-align: right; background-color: #ffffff; color: #2563eb;">
                ${totalCostDirect > 0 ? formatCLP(ivaAmount) : '$0'}
              </td>
            </tr>
            <tr style="border-bottom: 2px solid #1e3a8a; background-color: #1e3a8a;">
              <td style="padding: 8px 10px; font-weight: 900; text-align: right; border-right: 1px solid #1e3a8a; background-color: #1e3a8a; color: #ffffff; font-size: 11px;">
                TOTAL GENERAL
              </td>
              <td style="padding: 8px 10px; font-weight: 900; text-align: right; background-color: #1e3a8a; color: #ffffff; font-size: 11px;">
                ${totalAmount > 0 ? formatCLP(totalAmount) : '$0'}
              </td>
            </tr>
          </table>

          <!-- PLAZO ESTIMADO DE ENTREGA (DESTACADO EN AMARILLO VIBRANTE Y BORDES LIMPIOS) -->
          <div style="background-color: #fef08a; border: 1.5px solid #ca8a04; border-radius: 4px; margin: 10px; padding: 8px; text-align: center;">
            <div style="font-weight: 900; font-size: 9px; text-transform: uppercase; color: #854d0e; letter-spacing: 0.5px;">
              PLAZO ESTIMADO DE ENTREGA
            </div>
            <div style="font-weight: 900; font-size: 13px; text-transform: uppercase; color: #713f12; margin-top: 2px;">
              ${deliveryDays}
            </div>
          </div>

        </div>

      </div>

    </div>
  `;

  return container;
}

/**
 * Builds HTML template for Technical Quotation Report (Cotización Técnica)
 */
export function createQuotationReportHTML(
  project: Project,
  quotation: Quotation,
  options: PDFExportOptions = {}
): HTMLElement {
  // If styleFormat is chilean_standard or by default for Chilean contractor quotes, return the Chilean standard layout
  if (quotation.styleFormat === 'chilean_standard' || !quotation.styleFormat) {
    return createChileanStandardQuotationReportHTML(project, quotation, options);
  }

  const company = { ...DEFAULT_COMPANY, ...options };
  const items = quotation.items || [];
  const totalNet = quotation.totalNet || items.reduce((s, it) => s + (it.total || 0), 0);
  const iva = Math.round(totalNet * 0.19);
  const totalGross = totalNet + iva;

  const container = document.createElement('div');
  container.className = 'pdf-export-container';
  container.style.padding = '40px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = 'Arial, Helvetica, sans-serif';
  container.style.lineHeight = '1.5';

  container.innerHTML = `
    <!-- HEADER -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 25px;">
      <div>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 6px;">
          <div style="background-color: #2563eb; color: #ffffff; width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px;">
            📋
          </div>
          <div>
            <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase;">${company.name}</h1>
            <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: bold;">${company.rut}</p>
          </div>
        </div>
        <p style="margin: 2px 0 0 0; font-size: 10px; color: #64748b;">${company.address}</p>
        <p style="margin: 0; font-size: 10px; color: #64748b;">${company.contact}</p>
      </div>

      <div style="text-align: right;">
        <span style="background-color: ${quotation.status === 'approved' ? '#f0fdf4' : '#fffbeb'}; color: ${quotation.status === 'approved' ? '#15803d' : '#b45309'}; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; border: 1px solid ${quotation.status === 'approved' ? '#bbf7d0' : '#fde68a'};">
          ${quotation.status === 'approved' ? 'Cotización Aprobada' : 'Propuesta / Borrador'}
        </span>
        <h2 style="margin: 8px 0 2px 0; font-size: 20px; font-weight: 900; color: #2563eb;">COTIZACIÓN TÉCNICA</h2>
        <p style="margin: 0; font-size: 11px; color: #64748b;">N° Documento: <strong>COT-${(quotation.id || '001').substring(0, 6).toUpperCase()}</strong></p>
        <p style="margin: 0; font-size: 11px; color: #64748b;">Fecha: <strong>${new Date(quotation.date || Date.now()).toLocaleDateString('es-CL')}</strong></p>
      </div>
    </div>

    <!-- QUOTATION CLIENT & PROJECT CARD -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 25px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div>
        <p style="margin: 0; font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold;">Identificación del Trabajo</p>
        <h3 style="margin: 2px 0 4px 0; font-size: 16px; font-weight: 800; color: #0f172a;">${quotation.name}</h3>
        <p style="margin: 0; font-size: 11px; color: #475569;"><strong>Obra Asociada:</strong> ${project.name}</p>
        <p style="margin: 0; font-size: 11px; color: #475569;"><strong>Dirección faena:</strong> ${project.address}</p>
      </div>
      <div>
        <p style="margin: 0; font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold;">Condiciones Comerciales</p>
        <p style="margin: 2px 0 0 0; font-size: 11px; color: #475569;"><strong>Validez de la oferta:</strong> 15 días corridos</p>
        <p style="margin: 0; font-size: 11px; color: #475569;"><strong>Entrega:</strong> Puesta en obra / Despacho incluido</p>
        <p style="margin: 0; font-size: 11px; color: #475569;"><strong>Forma de pago:</strong> 50% anticipo, 50% contra recepción</p>
      </div>
    </div>

    <!-- ITEMS TABLE -->
    <div style="margin-bottom: 25px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
        <thead>
          <tr style="background-color: #2563eb; color: #ffffff;">
            <th style="padding: 10px 12px; width: 40px; text-align: center;">#</th>
            <th style="padding: 10px 12px;">Descripción del Material / Insumo</th>
            <th style="padding: 10px 12px; width: 100px; text-align: center;">Unidad</th>
            <th style="padding: 10px 12px; width: 80px; text-align: center;">Cantidad</th>
            <th style="padding: 10px 12px; width: 110px; text-align: right;">Precio Unit.</th>
            <th style="padding: 10px 12px; width: 120px; text-align: right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it, idx) => `
            <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
              <td style="padding: 10px 12px; text-align: center; color: #64748b; font-weight: bold;">${idx + 1}</td>
              <td style="padding: 10px 12px;">
                <strong style="color: #0f172a; font-size: 12px;">${it.name}</strong>
              </td>
              <td style="padding: 10px 12px; text-align: center; color: #475569;">
                <span style="background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px;">${it.unit || 'Unidad'}</span>
              </td>
              <td style="padding: 10px 12px; text-align: center; font-weight: bold; color: #0f172a; font-size: 12px;">
                ${it.quantity}
              </td>
              <td style="padding: 10px 12px; text-align: right; color: #475569;">
                ${formatCLP(it.price)}
              </td>
              <td style="padding: 10px 12px; text-align: right; font-weight: bold; color: #2563eb; font-size: 12px;">
                ${formatCLP(it.total)}
              </td>
            </tr>
          `).join('')}
          ${items.length === 0 ? `<tr><td colspan="6" style="padding: 24px; text-align: center; color: #94a3b8;">Sin ítems en la cotización.</td></tr>` : ''}
        </tbody>
      </table>
    </div>

    <!-- TOTALS BREAKDOWN -->
    <div style="display: flex; justify-content: flex-end; margin-bottom: 30px;">
      <div style="width: 320px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px;">
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px; color: #475569;">
          <span>Subtotal Neto:</span>
          <strong style="color: #0f172a;">${formatCLP(totalNet)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px; color: #475569;">
          <span>IVA (19%):</span>
          <strong style="color: #2563eb;">${formatCLP(iva)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 16px; border-top: 2px solid #cbd5e1; padding-top: 10px; font-weight: 900; color: #0f172a;">
          <span>Total General:</span>
          <span style="color: #2563eb;">${formatCLP(totalGross)}</span>
        </div>
      </div>
    </div>

    <!-- COMMERCIAL TERMS & ACCEPTANCE -->
    <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 12px 16px; border-radius: 4px; font-size: 10px; color: #475569; margin-bottom: 30px;">
      <p style="margin: 0 0 4px 0; font-weight: bold; color: #0f172a;">Notas Técnicas y Observaciones:</p>
      <ul style="margin: 0; padding-left: 16px;">
        <li>Valores expresados en Pesos Chilenos (CLP). Precios de materiales garantizados según disponibilidad de distribuidores y fábricas autorizadas.</li>
        <li>Los plazos de entrega comienzan a regir tras la firma de la presente orden y el abono correspondiente.</li>
      </ul>
    </div>

    <!-- SIGNATURES -->
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #cbd5e1; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center;">
      <div>
        <div style="height: 50px; border-bottom: 1px solid #94a3b8; margin-bottom: 6px;"></div>
        <p style="margin: 0; font-size: 11px; font-weight: bold; color: #0f172a;">Emisor Responsable / Presupuestos</p>
        <p style="margin: 0; font-size: 10px; color: #64748b;">${company.name}</p>
      </div>
      <div>
        <div style="height: 50px; border-bottom: 1px solid #94a3b8; margin-bottom: 6px;"></div>
        <p style="margin: 0; font-size: 11px; font-weight: bold; color: #0f172a;">Aceptación Cliente / Mandante</p>
        <p style="margin: 0; font-size: 10px; color: #64748b;">Firma, Nombre y RUT</p>
      </div>
    </div>

    <div style="margin-top: 25px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 10px;">
      Propuesta Técnica y Comercial generada por Viña Construcciones & Estructuras SpA
    </div>
  `;

  return container;
}

/**
 * Builds HTML template for Global Summary of All Active Projects (Expenses & Material Totals)
 */
export function createGlobalSummaryReportHTML(
  activeProjects: Project[],
  allInvoices: Invoice[],
  allExpenses: Expense[],
  allQuotations: Quotation[] = [],
  options: PDFExportOptions = {}
): HTMLElement {
  const company = { ...DEFAULT_COMPANY, ...options };

  // Calculate Global Financial Aggregates
  const totalGlobalBudget = activeProjects.reduce((acc, p) => acc + (p.budget || 0), 0);
  
  // Filter invoices and expenses belonging to the active projects
  const activeProjectIds = new Set(activeProjects.map(p => p.id).filter(Boolean));
  const activeInvoices = allInvoices.filter(i => activeProjectIds.has(i.projectId));
  const activeExpenses = allExpenses.filter(e => activeProjectIds.has(e.projectId));
  const activeQuotations = allQuotations.filter(q => activeProjectIds.has(q.projectId));

  const totalInvoicedNet = activeInvoices.reduce((acc, i) => acc + (i.netAmount || 0), 0);
  const totalInvoicedIva = activeInvoices.reduce((acc, i) => acc + (i.iva || 0), 0);
  const totalInvoicedGross = activeInvoices.reduce((acc, i) => acc + (i.totalAmount || 0), 0);
  const totalOperExpenses = activeExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  
  const totalGlobalSpent = totalInvoicedNet + totalOperExpenses;
  const totalGlobalRemaining = totalGlobalBudget - totalGlobalSpent;
  const globalExecutionPct = totalGlobalBudget > 0 ? (totalGlobalSpent / totalGlobalBudget) * 100 : 0;

  // Group Expenses by Category across active projects
  const laborExpenses = activeExpenses.filter(e => e.category === 'labor').reduce((acc, e) => acc + e.amount, 0);
  const fuelExpenses = activeExpenses.filter(e => e.category === 'fuel').reduce((acc, e) => acc + e.amount, 0);
  const toolsExpenses = activeExpenses.filter(e => e.category === 'tools').reduce((acc, e) => acc + e.amount, 0);
  const otherExpenses = activeExpenses.filter(e => e.category === 'other' || !e.category).reduce((acc, e) => acc + e.amount, 0);

  // Group Top Suppliers from Invoices
  const supplierTotals: { [key: string]: { count: number; totalNet: number; totalGross: number } } = {};
  activeInvoices.forEach(inv => {
    const prov = inv.provider || 'Proveedor General';
    if (!supplierTotals[prov]) {
      supplierTotals[prov] = { count: 0, totalNet: 0, totalGross: 0 };
    }
    supplierTotals[prov].count += 1;
    supplierTotals[prov].totalNet += (inv.netAmount || 0);
    supplierTotals[prov].totalGross += (inv.totalAmount || 0);
  });

  const sortedSuppliers = Object.entries(supplierTotals)
    .sort((a, b) => b[1].totalNet - a[1].totalNet)
    .slice(0, 6);

  // Aggregate Material Totals across all active project quotations
  interface AggregatedMaterial {
    name: string;
    totalQuantity: number;
    unit: string;
    totalAmount: number;
    projectNames: Set<string>;
    itemCount: number;
  }

  const materialMap = new Map<string, AggregatedMaterial>();

  activeQuotations.forEach(q => {
    const proj = activeProjects.find(p => p.id === q.projectId);
    const projName = proj?.name || 'Obra';

    (q.items || []).forEach(item => {
      const normalizedName = item.name.trim();
      const existing = materialMap.get(normalizedName);
      if (existing) {
        existing.totalQuantity += Number(item.quantity) || 0;
        existing.totalAmount += Number(item.total) || 0;
        existing.projectNames.add(projName);
        existing.itemCount += 1;
      } else {
        materialMap.set(normalizedName, {
          name: item.name,
          totalQuantity: Number(item.quantity) || 0,
          unit: item.unit || 'Unidad',
          totalAmount: Number(item.total) || 0,
          projectNames: new Set([projName]),
          itemCount: 1
        });
      }
    });
  });

  const aggregatedMaterialsList = Array.from(materialMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  const totalMaterialInvestment = aggregatedMaterialsList.reduce((acc, m) => acc + m.totalAmount, 0);

  const container = document.createElement('div');
  container.className = 'pdf-export-container';
  container.style.padding = '36px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = 'Arial, Helvetica, sans-serif';
  container.style.lineHeight = '1.45';

  container.innerHTML = `
    <!-- HEADER -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 18px; margin-bottom: 22px;">
      <div>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 6px;">
          <div style="background-color: #2563eb; color: #ffffff; width: 44px; height: 44px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 22px;">
            V
          </div>
          <div>
            <h1 style="margin: 0; font-size: 17px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px;">${company.name}</h1>
            <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: bold;">${company.rut}</p>
          </div>
        </div>
        <p style="margin: 2px 0 0 0; font-size: 10px; color: #64748b;">${company.address}</p>
        <p style="margin: 0; font-size: 10px; color: #64748b;">${company.contact}</p>
      </div>

      <div style="text-align: right;">
        <span style="background-color: #1e40af; color: #ffffff; padding: 4px 14px; border-radius: 20px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">
          Consolidado Sistema de Obras
        </span>
        <h2 style="margin: 8px 0 2px 0; font-size: 19px; font-weight: 900; color: #2563eb;">RESUMEN GLOBAL DE PROYECTOS</h2>
        <p style="margin: 0; font-size: 11px; color: #64748b;">Fecha de emisión: <strong>${new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })}</strong></p>
        <p style="margin: 0; font-size: 11px; color: #64748b;">Proyectos Activos: <strong style="color: #16a34a;">${activeProjects.length} Obra${activeProjects.length === 1 ? '' : 's'} en Ejecución</strong></p>
      </div>
    </div>

    <!-- GLOBAL EXECUTIVE KPIS (4 CARDS) -->
    <div style="margin-bottom: 22px;">
      <h3 style="font-size: 12px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin: 0 0 10px 0; border-left: 4px solid #2563eb; padding-left: 8px;">
        1. Balance Financiero Consolidado del Sistema
      </h3>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; text-align: center;">
          <p style="margin: 0; font-size: 10px; color: #64748b; font-weight: 800; text-transform: uppercase;">Presupuesto Global OC</p>
          <p style="margin: 4px 0 0 0; font-size: 17px; font-weight: 900; color: #0f172a;">${formatCLP(totalGlobalBudget)}</p>
          <p style="margin: 2px 0 0 0; font-size: 9px; color: #64748b;">${activeProjects.length} contratos activos</p>
        </div>

        <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; text-align: center;">
          <p style="margin: 0; font-size: 10px; color: #1e40af; font-weight: 800; text-transform: uppercase;">Facturas Materiales (Neto)</p>
          <p style="margin: 4px 0 0 0; font-size: 17px; font-weight: 900; color: #2563eb;">${formatCLP(totalInvoicedNet)}</p>
          <p style="margin: 2px 0 0 0; font-size: 9px; color: #3b82f6;">+ ${formatCLP(totalInvoicedIva)} IVA 19%</p>
        </div>

        <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; text-align: center;">
          <p style="margin: 0; font-size: 10px; color: #92400e; font-weight: 800; text-transform: uppercase;">Gastos Operativos Faena</p>
          <p style="margin: 4px 0 0 0; font-size: 17px; font-weight: 900; color: #d97706;">${formatCLP(totalOperExpenses)}</p>
          <p style="margin: 2px 0 0 0; font-size: 9px; color: #b45309;">${activeExpenses.length} rendiciones</p>
        </div>

        <div style="background-color: ${totalGlobalRemaining >= 0 ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${totalGlobalRemaining >= 0 ? '#bbf7d0' : '#fecaca'}; border-radius: 8px; padding: 12px; text-align: center;">
          <p style="margin: 0; font-size: 10px; color: ${totalGlobalRemaining >= 0 ? '#166534' : '#991b1b'}; font-weight: 800; text-transform: uppercase;">Saldo / Margen Global</p>
          <p style="margin: 4px 0 0 0; font-size: 17px; font-weight: 900; color: ${totalGlobalRemaining >= 0 ? '#16a34a' : '#dc2626'};">${formatCLP(totalGlobalRemaining)}</p>
          <p style="margin: 2px 0 0 0; font-size: 9px; color: ${totalGlobalRemaining >= 0 ? '#15803d' : '#b91c1c'}; font-weight: bold;">${globalExecutionPct.toFixed(1)}% ejecutado</p>
        </div>
      </div>
    </div>

    <!-- TABLE: ACTIVE PROJECTS BREAKDOWN -->
    <div style="margin-bottom: 22px;">
      <h3 style="font-size: 12px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin: 0 0 10px 0; border-left: 4px solid #2563eb; padding-left: 8px;">
        2. Estado Financiero por Obra y Proyecto Activo
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; text-align: left;">
        <thead>
          <tr style="background-color: #1e293b; color: #ffffff;">
            <th style="padding: 8px 10px;">Proyecto / Ubicación</th>
            <th style="padding: 8px 10px; text-align: right;">Presupuesto OC</th>
            <th style="padding: 8px 10px; text-align: right;">Facturas Neto</th>
            <th style="padding: 8px 10px; text-align: right;">Gastos Faena</th>
            <th style="padding: 8px 10px; text-align: right;">Total Gastado</th>
            <th style="padding: 8px 10px; text-align: right;">Saldo Restante</th>
            <th style="padding: 8px 10px; text-align: center;">% Avance</th>
          </tr>
        </thead>
        <tbody>
          ${activeProjects.map((p, idx) => {
            const pInvoices = activeInvoices.filter(i => i.projectId === p.id);
            const pExpenses = activeExpenses.filter(e => e.projectId === p.id);
            const pInvNet = pInvoices.reduce((s, i) => s + (i.netAmount || 0), 0);
            const pExp = pExpenses.reduce((s, e) => s + (e.amount || 0), 0);
            const pSpent = pInvNet + pExp;
            const pRemaining = (p.budget || 0) - pSpent;
            const pPct = p.budget > 0 ? (pSpent / p.budget) * 100 : 0;

            return `
              <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="padding: 8px 10px;">
                  <strong style="color: #0f172a; font-size: 11px;">${p.name}</strong>
                  <div style="font-size: 9.5px; color: #64748b;">${p.address || 'Sin dirección'}</div>
                </td>
                <td style="padding: 8px 10px; text-align: right; font-weight: bold; color: #0f172a;">
                  ${formatCLP(p.budget)}
                </td>
                <td style="padding: 8px 10px; text-align: right; color: #2563eb; font-weight: bold;">
                  ${formatCLP(pInvNet)}
                </td>
                <td style="padding: 8px 10px; text-align: right; color: #d97706; font-weight: bold;">
                  ${formatCLP(pExp)}
                </td>
                <td style="padding: 8px 10px; text-align: right; font-weight: 900; color: #0f172a;">
                  ${formatCLP(pSpent)}
                </td>
                <td style="padding: 8px 10px; text-align: right; font-weight: bold; color: ${pRemaining >= 0 ? '#16a34a' : '#dc2626'};">
                  ${formatCLP(pRemaining)}
                </td>
                <td style="padding: 8px 10px; text-align: center;">
                  <span style="background-color: ${pPct > 90 ? '#fef2f2' : pPct > 70 ? '#fffbeb' : '#eff6ff'}; color: ${pPct > 90 ? '#dc2626' : pPct > 70 ? '#b45309' : '#1d4ed8'}; padding: 2px 6px; border-radius: 4px; font-weight: 900; font-size: 10px;">
                    ${pPct.toFixed(0)}%
                  </span>
                </td>
              </tr>
            `;
          }).join('')}
          ${activeProjects.length === 0 ? `
            <tr><td colspan="7" style="padding: 18px; text-align: center; color: #94a3b8;">No se registran obras activas actualmente.</td></tr>
          ` : ''}
          <!-- TOTALS ROW -->
          <tr style="background-color: #f1f5f9; font-weight: 900; border-top: 2px solid #cbd5e1; border-bottom: 2px solid #cbd5e1;">
            <td style="padding: 9px 10px; font-size: 11px; text-transform: uppercase;">TOTALES CONSOLIDADOS:</td>
            <td style="padding: 9px 10px; text-align: right; color: #0f172a; font-size: 11px;">${formatCLP(totalGlobalBudget)}</td>
            <td style="padding: 9px 10px; text-align: right; color: #2563eb; font-size: 11px;">${formatCLP(totalInvoicedNet)}</td>
            <td style="padding: 9px 10px; text-align: right; color: #d97706; font-size: 11px;">${formatCLP(totalOperExpenses)}</td>
            <td style="padding: 9px 10px; text-align: right; color: #0f172a; font-size: 11px;">${formatCLP(totalGlobalSpent)}</td>
            <td style="padding: 9px 10px; text-align: right; color: ${totalGlobalRemaining >= 0 ? '#16a34a' : '#dc2626'}; font-size: 11px;">${formatCLP(totalGlobalRemaining)}</td>
            <td style="padding: 9px 10px; text-align: center; color: #1e40af; font-size: 11px;">${globalExecutionPct.toFixed(0)}%</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- OPERATIONAL EXPENSES BREAKDOWN & TOP SUPPLIERS (2 COLUMNS) -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 22px;">
      <!-- GASTOS OPERACIONALES DETALLADOS -->
      <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background-color: #ffffff;">
        <h4 style="margin: 0 0 8px 0; font-size: 11.5px; font-weight: 900; text-transform: uppercase; color: #0f172a; display: flex; justify-content: space-between;">
          <span>Desglose de Gastos Operativos</span>
          <span style="color: #d97706;">Total: ${formatCLP(totalOperExpenses)}</span>
        </h4>
        <div style="display: flex; flex-direction: column; gap: 6px; font-size: 10.5px;">
          <div style="display: flex; justify-content: space-between; padding: 5px 8px; background-color: #f8fafc; border-radius: 6px;">
            <span style="color: #475569;">🔨 Mano de Obra & Tratos Faena:</span>
            <strong style="color: #0f172a;">${formatCLP(laborExpenses)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 5px 8px; background-color: #f8fafc; border-radius: 6px;">
            <span style="color: #475569;">⛽ Combustible, Fletes & Movilización:</span>
            <strong style="color: #0f172a;">${formatCLP(fuelExpenses)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 5px 8px; background-color: #f8fafc; border-radius: 6px;">
            <span style="color: #475569;">🔧 Herramientas, Arriendos & Equipos:</span>
            <strong style="color: #0f172a;">${formatCLP(toolsExpenses)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 5px 8px; background-color: #f8fafc; border-radius: 6px;">
            <span style="color: #475569;">📦 Otros Gastos e Imprevistos:</span>
            <strong style="color: #0f172a;">${formatCLP(otherExpenses)}</strong>
          </div>
        </div>
      </div>

      <!-- TOP PROVEEDORES FACTURADOS -->
      <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background-color: #ffffff;">
        <h4 style="margin: 0 0 8px 0; font-size: 11.5px; font-weight: 900; text-transform: uppercase; color: #0f172a; display: flex; justify-content: space-between;">
          <span>Principales Proveedores Facturados</span>
          <span style="color: #2563eb;">${activeInvoices.length} DTEs</span>
        </h4>
        <div style="display: flex; flex-direction: column; gap: 6px; font-size: 10.5px;">
          ${sortedSuppliers.map(([name, data]) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 8px; background-color: #f8fafc; border-radius: 6px;">
              <div>
                <strong style="color: #0f172a; font-size: 11px;">${name}</strong>
                <span style="font-size: 9px; color: #64748b; margin-left: 4px;">(${data.count} fact.)</span>
              </div>
              <strong style="color: #2563eb;">${formatCLP(data.totalNet)}</strong>
            </div>
          `).join('')}
          ${sortedSuppliers.length === 0 ? `
            <div style="padding: 12px; text-align: center; color: #94a3b8; font-size: 10px;">Sin facturas registradas en obras activas</div>
          ` : ''}
        </div>
      </div>
    </div>

    <!-- CONSOLIDATED MATERIAL TOTALS ACROSS ACTIVE PROJECTS -->
    <div style="margin-bottom: 22px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <h3 style="font-size: 12px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin: 0; border-left: 4px solid #2563eb; padding-left: 8px;">
          3. Consolidado Total de Materiales & Partidas Presupuestadas
        </h3>
        ${totalMaterialInvestment > 0 ? `
          <span style="font-size: 11px; font-weight: 900; color: #2563eb;">
            Total Cotizado en Sistema: ${formatCLP(totalMaterialInvestment)}
          </span>
        ` : ''}
      </div>

      ${aggregatedMaterialsList.length > 0 ? `
        <table style="width: 100%; border-collapse: collapse; font-size: 10px; text-align: left;">
          <thead>
            <tr style="background-color: #2563eb; color: #ffffff;">
              <th style="padding: 6px 8px; width: 30px; text-align: center;">#</th>
              <th style="padding: 6px 8px;">Descripción del Material / Insumo</th>
              <th style="padding: 6px 8px; width: 90px; text-align: center;">Cantidad Total</th>
              <th style="padding: 6px 8px; width: 80px; text-align: center;">Unidad</th>
              <th style="padding: 6px 8px; text-align: right; width: 110px;">Inversión Total</th>
              <th style="padding: 6px 8px; width: 220px;">Obras que lo Utilizan</th>
            </tr>
          </thead>
          <tbody>
            ${aggregatedMaterialsList.slice(0, 12).map((m, idx) => `
              <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="padding: 6px 8px; text-align: center; color: #64748b; font-weight: bold;">${idx + 1}</td>
                <td style="padding: 6px 8px;">
                  <strong style="color: #0f172a; font-size: 10.5px;">${m.name}</strong>
                </td>
                <td style="padding: 6px 8px; text-align: center; font-weight: 900; color: #0f172a; font-size: 11px;">
                  ${m.totalQuantity.toLocaleString('es-CL')}
                </td>
                <td style="padding: 6px 8px; text-align: center; color: #64748b;">
                  <span style="background-color: #f1f5f9; padding: 1px 5px; border-radius: 3px; font-weight: bold; font-size: 9px;">${m.unit}</span>
                </td>
                <td style="padding: 6px 8px; text-align: right; font-weight: 900; color: #2563eb; font-size: 11px;">
                  ${formatCLP(m.totalAmount)}
                </td>
                <td style="padding: 6px 8px; color: #475569; font-size: 9.5px;">
                  ${Array.from(m.projectNames).join(' • ')}
                </td>
              </tr>
            `).join('')}
            ${aggregatedMaterialsList.length > 12 ? `
              <tr>
                <td colspan="6" style="padding: 6px; text-align: center; font-size: 9.5px; color: #64748b; background-color: #f8fafc; font-style: italic;">
                  + ${aggregatedMaterialsList.length - 12} materiales y partidas adicionales detalladas en las cotizaciones individuales de obra.
                </td>
              </tr>
            ` : ''}
          </tbody>
        </table>
      ` : `
        <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 14px; text-align: center; font-size: 10.5px; color: #64748b;">
          Para ver el desglose cuantitativo consolidado de materiales (sacos de cemento, fierro, maderas, planchas, etc.), crea o asocia cotizaciones técnicas a tus proyectos en la pestaña "Cotizaciones".
        </div>
      `}
    </div>

    <!-- REGULATORY AND TAX COMPLIANCE (CHILEAN SII & IVA) -->
    <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 10px 14px; border-radius: 4px; font-size: 9.5px; color: #475569; margin-bottom: 22px;">
      <p style="margin: 0 0 2px 0; font-weight: bold; color: #0f172a;">Validación Contable y Tributaria (Normativa Chilena):</p>
      <p style="margin: 0; line-height: 1.4;">
        Todos los montos facturados corresponden a Documentos Tributarios Electrónicos (DTE) con IVA 19% recuperable como crédito fiscal. Los gastos operacionales corresponden a rendiciones de caja chica de faena, compras menores y anticipos de tratos de mano de obra según legislación laboral vigente.
      </p>
    </div>

    <!-- SIGNATURES -->
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #cbd5e1; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center;">
      <div>
        <div style="height: 44px; border-bottom: 1px solid #94a3b8; margin-bottom: 4px;"></div>
        <p style="margin: 0; font-size: 10.5px; font-weight: bold; color: #0f172a;">Jefe de Obra / Gerencia de Proyectos</p>
        <p style="margin: 0; font-size: 9.5px; color: #64748b;">${company.name}</p>
      </div>
      <div>
        <div style="height: 44px; border-bottom: 1px solid #94a3b8; margin-bottom: 4px;"></div>
        <p style="margin: 0; font-size: 10.5px; font-weight: bold; color: #0f172a;">Encargado de Adquisiciones & Finanzas</p>
        <p style="margin: 0; font-size: 9.5px; color: #64748b;">Control de Presupuestos y Abastecimiento</p>
      </div>
    </div>

    <div style="margin-top: 18px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 8px;">
      Documento Consolidado emitido por Viña Construcciones & Estructuras SpA • Gestión Integral de Construcción en Chile
    </div>
  `;

  return container;
}

/**
 * Builds HTML template for Gastos de Faena Consolidated Report (Mano de obra, combustible, herramientas, etc.)
 */
export function createExpensesReportHTML(
  project: Project,
  expenses: Expense[],
  options: PDFExportOptions = {}
): HTMLElement {
  const company = { ...DEFAULT_COMPANY, ...options };
  const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Group by category
  const categoryTotals = {
    labor: expenses.filter(e => e.category === 'labor').reduce((sum, e) => sum + (e.amount || 0), 0),
    fuel: expenses.filter(e => e.category === 'fuel').reduce((sum, e) => sum + (e.amount || 0), 0),
    tools: expenses.filter(e => e.category === 'tools').reduce((sum, e) => sum + (e.amount || 0), 0),
    other: expenses.filter(e => e.category === 'other' || !e.category).reduce((sum, e) => sum + (e.amount || 0), 0),
  };

  const container = document.createElement('div');
  container.className = 'pdf-export-container';
  container.style.padding = '40px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = 'Arial, Helvetica, sans-serif';
  container.style.lineHeight = '1.5';

  container.innerHTML = `
    <!-- HEADER -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0284c7; padding-bottom: 20px; margin-bottom: 25px;">
      <div>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 6px;">
          <div style="background-color: #0284c7; color: #ffffff; width: 44px; height: 44px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 22px;">
            👷
          </div>
          <div>
            <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase;">${company.name}</h1>
            <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: bold;">RUT: ${company.rut || '78.447.669-3'}</p>
          </div>
        </div>
        <p style="margin: 2px 0 0 0; font-size: 10px; color: #64748b;">${company.address}</p>
        <p style="margin: 0; font-size: 10px; color: #64748b;">${company.contact}</p>
      </div>

      <div style="text-align: right;">
        <span style="background-color: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; border: 1px solid #bae6fd;">
          Control Operacional de Campo
        </span>
        <h2 style="margin: 8px 0 2px 0; font-size: 20px; font-weight: 900; color: #0284c7;">INFORME DE GASTOS DE FAENA</h2>
        <p style="margin: 0; font-size: 11px; color: #64748b;">Obra: <strong>${project.name}</strong></p>
        <p style="margin: 0; font-size: 11px; color: #64748b;">Fecha Emisión: <strong>${new Date().toLocaleDateString('es-CL')}</strong></p>
      </div>
    </div>

    <!-- SUMMARY CARDS -->
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 25px;">
      <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 12px; text-align: center;">
        <p style="margin: 0; font-size: 10px; text-transform: uppercase; color: #0369a1; font-weight: bold;">Mano de Obra</p>
        <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 900; color: #0f172a;">${formatCLP(categoryTotals.labor)}</p>
        <span style="font-size: 9px; color: #64748b;">Empleados y Tratos</span>
      </div>
      <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 12px; text-align: center;">
        <p style="margin: 0; font-size: 10px; text-transform: uppercase; color: #c2410c; font-weight: bold;">Combustible / Fletes</p>
        <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 900; color: #0f172a;">${formatCLP(categoryTotals.fuel)}</p>
        <span style="font-size: 9px; color: #64748b;">Transporte y Cargas</span>
      </div>
      <div style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 10px; padding: 12px; text-align: center;">
        <p style="margin: 0; font-size: 10px; text-transform: uppercase; color: #7e22ce; font-weight: bold;">Herramientas / Arriendos</p>
        <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 900; color: #0f172a;">${formatCLP(categoryTotals.tools)}</p>
        <span style="font-size: 9px; color: #64748b;">Equipos de Faena</span>
      </div>
      <div style="background-color: #f8fafc; border: 2px solid #0284c7; border-radius: 10px; padding: 12px; text-align: center;">
        <p style="margin: 0; font-size: 10px; text-transform: uppercase; color: #0284c7; font-weight: bold;">Total Rendido</p>
        <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 900; color: #0369a1;">${formatCLP(totalAmount)}</p>
        <span style="font-size: 9px; color: #0284c7; font-weight: bold;">${expenses.length} Rendición(es)</span>
      </div>
    </div>

    <!-- EXPENSES DETAILED TABLE -->
    <div style="margin-bottom: 25px;">
      <h3 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 800; text-transform: uppercase; color: #0f172a; border-left: 4px solid #0284c7; padding-left: 8px;">
        Detalle de Rendiciones de Gasto de Campo
      </h3>

      <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
        <thead>
          <tr style="background-color: #0284c7; color: #ffffff; text-transform: uppercase; font-size: 10px;">
            <th style="padding: 8px 10px; text-align: left; border-radius: 4px 0 0 0;">Fecha</th>
            <th style="padding: 8px 10px; text-align: left;">Glosa / Descripción del Gasto</th>
            <th style="padding: 8px 10px; text-align: center;">Categoría</th>
            <th style="padding: 8px 10px; text-align: right; border-radius: 0 4px 0 0;">Monto ($ CLP)</th>
          </tr>
        </thead>
        <tbody>
          ${expenses.map((exp, idx) => {
            const catLabel = exp.category === 'labor' ? 'Mano de Obra' :
                             exp.category === 'fuel' ? 'Combustible / Flete' :
                             exp.category === 'tools' ? 'Herramientas / Arriendo' : 'Imprevistos';
            const catBg = exp.category === 'labor' ? '#eff6ff' :
                          exp.category === 'fuel' ? '#fff7ed' :
                          exp.category === 'tools' ? '#faf5ff' : '#f8fafc';
            const catText = exp.category === 'labor' ? '#1d4ed8' :
                            exp.category === 'fuel' ? '#c2410c' :
                            exp.category === 'tools' ? '#7e22ce' : '#475569';
            return `
              <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
                <td style="padding: 8px 10px; font-size: 10px; color: #64748b;">
                  ${exp.date ? new Date(exp.date + 'T12:00:00').toLocaleDateString('es-CL') : new Date().toLocaleDateString('es-CL')}
                </td>
                <td style="padding: 8px 10px; font-weight: bold; color: #0f172a;">
                  ${exp.description}
                </td>
                <td style="padding: 8px 10px; text-align: center;">
                  <span style="background-color: ${catBg}; color: ${catText}; padding: 3px 8px; border-radius: 12px; font-size: 9.5px; font-weight: bold; display: inline-block;">
                    ${catLabel}
                  </span>
                </td>
                <td style="padding: 8px 10px; text-align: right; font-weight: bold; color: #0f172a; font-family: monospace;">
                  ${formatCLP(exp.amount)}
                </td>
              </tr>
            `;
          }).join('')}
          ${expenses.length === 0 ? `
            <tr>
              <td colspan="4" style="padding: 20px; text-align: center; color: #94a3b8; font-style: italic;">
                No hay rendiciones de gastos de faena registradas en este proyecto.
              </td>
            </tr>
          ` : ''}
        </tbody>
        <tfoot>
          <tr style="background-color: #f0f9ff; border-top: 2px solid #0284c7; font-weight: bold;">
            <td colspan="3" style="padding: 10px; text-align: right; text-transform: uppercase; font-size: 11px; color: #0369a1;">
              Total Acumulado Rendiciones de Faena:
            </td>
            <td style="padding: 10px; text-align: right; font-size: 14px; font-weight: 900; color: #0284c7; font-family: monospace;">
              ${formatCLP(totalAmount)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- AUDIT NOTE -->
    <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 12px 16px; border-radius: 6px; font-size: 10px; color: #475569; margin-bottom: 30px;">
      <p style="margin: 0 0 4px 0; font-weight: bold; color: #0f172a;">Normativa y Control de Caja Chica en Obra:</p>
      <p style="margin: 0; line-height: 1.5;">
        Los presentes gastos de faena comprenden pagos directos de mano de obra (tratos temporales/diarios), cargas de combustible para maquinaria/vehículos, fletes y viáticos aprobados por el Residente de Obra de <strong>${company.name}</strong>.
      </p>
    </div>

    <!-- SIGNATURES -->
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #cbd5e1; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center;">
      <div>
        <div style="height: 50px; border-bottom: 1px solid #94a3b8; margin-bottom: 6px;"></div>
        <p style="margin: 0; font-size: 11px; font-weight: bold; color: #0f172a;">Jefe de Faena / Capataz Rindente</p>
        <p style="margin: 0; font-size: 10px; color: #64748b;">Firma Rindente de Gastos Operacionales</p>
      </div>
      <div>
        <div style="height: 50px; border-bottom: 1px solid #94a3b8; margin-bottom: 6px;"></div>
        <p style="margin: 0; font-size: 11px; font-weight: bold; color: #0f172a;">Administración & Finanzas</p>
        <p style="margin: 0; font-size: 10px; color: #64748b;">Aprobado y Reembolsado</p>
      </div>
    </div>
  `;

  return container;
}

/**
 * Builds HTML template for a Single Expense Voucher (Comprobante Individual de Rendición de Gasto)
 */
export function createSingleExpenseReportHTML(
  project: Project,
  expense: Expense,
  options: PDFExportOptions = {}
): HTMLElement {
  const company = { ...DEFAULT_COMPANY, ...options };
  const catLabel = expense.category === 'labor' ? 'Mano de Obra / Empleados' :
                   expense.category === 'fuel' ? 'Combustible / Flete / Transporte' :
                   expense.category === 'tools' ? 'Herramientas / Arriendo Maquinaria' : 'Gastos Varios / Imprevistos';

  const container = document.createElement('div');
  container.className = 'pdf-export-container';
  container.style.padding = '40px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = 'Arial, Helvetica, sans-serif';
  container.style.lineHeight = '1.5';

  container.innerHTML = `
    <!-- HEADER -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0284c7; padding-bottom: 20px; margin-bottom: 25px;">
      <div>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 6px;">
          <div style="background-color: #0284c7; color: #ffffff; width: 44px; height: 44px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 22px;">
            💵
          </div>
          <div>
            <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase;">${company.name}</h1>
            <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: bold;">RUT: ${company.rut || '78.447.669-3'}</p>
          </div>
        </div>
        <p style="margin: 2px 0 0 0; font-size: 10px; color: #64748b;">${company.address}</p>
        <p style="margin: 0; font-size: 10px; color: #64748b;">${company.contact}</p>
      </div>

      <div style="text-align: right;">
        <span style="background-color: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; border: 1px solid #bae6fd;">
          Comprobante de Caja Chica / Faena
        </span>
        <h2 style="margin: 8px 0 2px 0; font-size: 20px; font-weight: 900; color: #0284c7;">RENDICIÓN DE GASTO</h2>
        <p style="margin: 0; font-size: 11px; color: #64748b;">Fecha: <strong>${expense.date ? new Date(expense.date + 'T12:00:00').toLocaleDateString('es-CL') : new Date().toLocaleDateString('es-CL')}</strong></p>
      </div>
    </div>

    <!-- DOCUMENT SUMMARY INFO -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 25px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div>
        <p style="margin: 0; font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold;">Centro de Costos / Obra Asignada</p>
        <h3 style="margin: 4px 0 6px 0; font-size: 16px; font-weight: 800; color: #0f172a;">${project.name}</h3>
        <p style="margin: 0; font-size: 11px; color: #475569;"><strong>Ubicación de Faena:</strong> ${project.address}</p>
      </div>
      <div>
        <p style="margin: 0; font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold;">Categoría Operacional</p>
        <h3 style="margin: 4px 0 6px 0; font-size: 16px; font-weight: 800; color: #0284c7;">${catLabel}</h3>
        <p style="margin: 0; font-size: 11px; color: #475569;"><strong>Tipo de Rendición:</strong> Gasto Operacional de Campo</p>
      </div>
    </div>

    <!-- MAIN AMOUNT BOX -->
    <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px solid #38bdf8; border-radius: 14px; padding: 24px; margin-bottom: 30px; text-align: center;">
      <p style="margin: 0; font-size: 11px; font-weight: bold; text-transform: uppercase; color: #0369a1; letter-spacing: 0.5px;">
        Monto Total Rendido por Faena
      </p>
      <h1 style="margin: 10px 0 6px 0; font-size: 34px; font-weight: 900; color: #0f172a; font-family: monospace;">
        ${formatCLP(expense.amount)}
      </h1>
      <p style="margin: 0; font-size: 13px; font-weight: bold; color: #0369a1;">
        "${expense.description}"
      </p>
    </div>

    <!-- AUDIT NOTE -->
    <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 14px 18px; border-radius: 6px; font-size: 11px; color: #475569; margin-bottom: 35px;">
      <p style="margin: 0 0 4px 0; font-weight: bold; color: #0f172a;">Declaración y Resguardo de Rendición:</p>
      <p style="margin: 0; line-height: 1.5;">
        El presente comprobante autoriza el desembolso y rendición del monto especificado para cubrir necesidades directas de la faena <strong>${project.name}</strong>. Se encuentra sujeto a verificación por la administración central.
      </p>
    </div>

    <!-- SIGNATURES -->
    <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #cbd5e1; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center;">
      <div>
        <div style="height: 50px; border-bottom: 1px solid #94a3b8; margin-bottom: 6px;"></div>
        <p style="margin: 0; font-size: 11px; font-weight: bold; color: #0f172a;">Empleado / Rindente</p>
        <p style="margin: 0; font-size: 10px; color: #64748b;">Firma y RUT de Quien Recibe / Rinde</p>
      </div>
      <div>
        <div style="height: 50px; border-bottom: 1px solid #94a3b8; margin-bottom: 6px;"></div>
        <p style="margin: 0; font-size: 11px; font-weight: bold; color: #0f172a;">Aprobación Residente de Obra</p>
        <p style="margin: 0; font-size: 10px; color: #64748b;">Viña Construcciones & Estructuras SpA</p>
      </div>
    </div>
  `;

  return container;
}


