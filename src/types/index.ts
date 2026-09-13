export interface Project {
  id?: string;
  name: string;
  address: string;
  description: string;
  budget: number;
  hasIva?: boolean;
  ivaAmount?: number;
  totalBudgetBruto?: number;
  totalNetInvoices: number;
  totalIvaInvoices: number;
  totalExpenses: number;
  status: 'active' | 'completed' | 'on-hold';
  createdAt: any;
  ownerId: string;
}

export interface InvoiceItemDetail {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id?: string;
  projectId: string;
  invoiceNumber: string;
  provider: string;
  netAmount: number;
  iva: number;
  ivaRate?: number;
  extractionMethod?: 'dte_included' | 'direct_percentage';
  totalAmount: number;
  date: string;
  ownerId: string;
  details?: InvoiceItemDetail[];
}

export interface Expense {
  id?: string;
  projectId: string;
  description: string;
  amount: number;
  category: 'labor' | 'fuel' | 'tools' | 'other';
  date: string;
  ownerId: string;
}

export interface Material {
  id?: string;
  name: string;
  category: string;
  unit: string;
  estimatedPrice?: number;
  description?: string;
  brand?: string;
  suppliers?: string[];
  isAIGenerated?: boolean;
}

export interface SupplierDetail {
  name: string;
  brandOrChain?: string;
  priceEstimateClp?: number;
  priceFormatted?: string;
  priceLevel: 'Económico' | 'Medio' | 'Mayorista' | 'Premium';
  availability: 'Inmediata' | '24-48h' | 'Por Pedido' | 'Alta' | 'Media';
  regions: string[];
  locationsOrBranches?: string;
  deliveryOptions: string[];
  discountOrPerk?: string;
  rating?: number;
  contactOrWeb?: string;
}

export interface SupplierFilterParams {
  query?: string;
  materials?: string[];
  region?: string;
  priceCriterion?: 'all' | 'economic' | 'wholesale' | 'quality';
  availabilityFilter?: 'all' | 'immediate' | '24h' | 'order';
  deliveryMode?: 'all' | 'crane_truck' | 'store_pickup' | 'express';
}

export interface SupplierSuggestion {
  materialName: string;
  category?: string;
  suggestedSuppliers: string[];
  bestOption?: string;
  averagePriceRange: string;
  minPrice?: number;
  maxPrice?: number;
  priceLevel?: 'Económico' | 'Medio' | 'Mayorista' | 'Premium';
  tips: string;
  availability?: string;
  availabilityStatus?: 'Inmediata' | '24-48h' | 'Por Pedido' | 'Alta';
  geographicCoverage?: string[];
  nearestBranches?: string;
  deliveryOptions?: string[];
  detailedSuppliers?: SupplierDetail[];
}

export interface QuotationChapter {
  id: string;
  number: number;
  title: string;
  items: QuotationItem[];
}

export interface QuotationItem {
  id?: string;
  materialId?: string;
  itemNumber?: string; // e.g. "1.1", "1.2", "2.1"
  chapterNumber?: number; // e.g. 1, 2, 3
  chapterTitle?: string;
  name: string;
  quantity: number;
  unit: string; // "GL", "M2", "C/U", "UN", "ML", "KG", "M3", etc.
  price: number;
  total: number;
}

export interface Quotation {
  id?: string;
  projectId: string;
  name: string;
  date: string;
  items?: QuotationItem[];
  chapters?: QuotationChapter[];
  totalNet: number;
  status: 'draft' | 'approved';
  ownerId?: string;
  
  // Chilean Contractor / Municipal Standard quotation fields
  clientName?: string;
  clientRut?: string;
  clientAddress?: string;
  projectGlosa?: string;
  deliveryDays?: string | number;
  bankName?: string;
  bankAccountType?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  legalRepresentative?: string;
  companyName?: string;
  companyRut?: string;
  companyAddress?: string;
  companyContact?: string;
  companyEmail?: string;
  styleFormat?: 'chilean_standard' | 'modern';
}

export interface Note {
  id?: string;
  projectId: string;
  content: string;
  date: string;
  ownerId: string;
}

export interface InventoryItem {
  id?: string;
  projectId: string;
  name: string;
  category: 'materials' | 'tools' | 'safety' | 'consumibles' | 'other';
  quantity: number;
  unit: string;
  location?: string;
  status: 'available' | 'in-use' | 'low-stock' | 'out-of-stock';
  responsible?: string;
  lastUpdated: string;
  ownerId: string;
  notes?: string;
}

