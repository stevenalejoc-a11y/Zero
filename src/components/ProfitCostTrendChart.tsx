import React, { useState, useEffect, useMemo } from 'react';
import { 
  ResponsiveContainer, ComposedChart, Area, Line, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine 
} from 'recharts';
import { 
  TrendingUp, DollarSign, Calendar, Filter, Sparkles, 
  ArrowUpRight, ArrowDownRight, Layers, ShieldCheck, 
  BarChart3, Activity, PieChart as PieIcon, Info
} from 'lucide-react';
import { Project, Invoice, Expense } from '../types';
import { db, collection, query, where, onSnapshot } from '../lib/firebase';
import { formatCLP } from '../lib/pdfExport';

interface ProfitCostTrendChartProps {
  projects: Project[];
  userId: string;
}

type TimeRangeOption = '6m' | '12m' | 'all';
type ChartViewMode = 'composed_trend' | 'profit_margin' | 'project_comparison';

interface MonthlyDataPoint {
  monthKey: string;     // YYYY-MM
  label: string;        // 'Ene 2026'
  estimatedCost: number; // Costo directo proyectado
  actualCost: number;    // Costo real ejecutado (invoices + expenses)
  projectedRevenue: number; // Presupuesto asignado/devengado
  netProfit: number;     // Utilidad Neta (Revenue - ActualCost)
  profitMarginPercent: number; // % Margen
  invoiceCount: number;
  expenseCount: number;
}

export default function ProfitCostTrendChart({ projects, userId }: ProfitCostTrendChartProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('6m');
  const [viewMode, setViewMode] = useState<ChartViewMode>('composed_trend');
  const [showEstimatedBaseline, setShowEstimatedBaseline] = useState(true);

  // Fetch all invoices for user's projects
  useEffect(() => {
    if (!userId) return;
    const invQuery = query(collection(db, 'invoices'), where('ownerId', '==', userId));
    const unsubscribe = onSnapshot(invQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Invoice[];
      setInvoices(list);
    });
    return unsubscribe;
  }, [userId]);

  // Fetch all expenses for user's projects
  useEffect(() => {
    if (!userId) return;
    const expQuery = query(collection(db, 'expenses'), where('ownerId', '==', userId));
    const unsubscribe = onSnapshot(expQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Expense[];
      setExpenses(list);
    });
    return unsubscribe;
  }, [userId]);

  // Filter projects by selection
  const relevantProjects = useMemo(() => {
    if (selectedProjectId === 'all') return projects;
    return projects.filter(p => p.id === selectedProjectId);
  }, [projects, selectedProjectId]);

  // Generate monthly trend timeline
  const monthlyTimelineData = useMemo(() => {
    const monthsMap = new Map<string, MonthlyDataPoint>();

    // Helper to format date string to YYYY-MM
    const getMonthKey = (dateStr?: string | any): string => {
      if (!dateStr) {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      }
      try {
        const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr.toDate ? dateStr.toDate() : new Date();
        if (isNaN(d.getTime())) {
          const now = new Date();
          return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } catch {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      }
    };

    const getMonthLabel = (key: string): string => {
      const [year, month] = key.split('-').map(Number);
      const date = new Date(year, month - 1, 1);
      return date.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' });
    };

    // 1. Establish baseline from active projects createdAt or recent 6 months
    const now = new Date();
    const numberOfMonths = timeRange === '6m' ? 6 : timeRange === '12m' ? 12 : 18;
    
    for (let i = numberOfMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthsMap.set(key, {
        monthKey: key,
        label: getMonthLabel(key),
        estimatedCost: 0,
        actualCost: 0,
        projectedRevenue: 0,
        netProfit: 0,
        profitMarginPercent: 0,
        invoiceCount: 0,
        expenseCount: 0
      });
    }

    // 2. Distribute project budgets & estimated direct costs (typically ~70% of budget)
    relevantProjects.forEach((proj, idx) => {
      const projMonth = getMonthKey(proj.createdAt);
      const budget = proj.budget || 0;
      const estimatedDirectCost = Math.round(budget * 0.70); // 70% estimated direct cost baseline

      if (monthsMap.has(projMonth)) {
        const entry = monthsMap.get(projMonth)!;
        entry.projectedRevenue += budget;
        entry.estimatedCost += estimatedDirectCost;
      } else {
        // If outside the predefined range, allocate proportionally across recent months for trend continuity
        const keys = Array.from(monthsMap.keys());
        if (keys.length > 0) {
          const targetKey = keys[Math.min(idx, keys.length - 1)];
          const entry = monthsMap.get(targetKey)!;
          entry.projectedRevenue += Math.round(budget / keys.length);
          entry.estimatedCost += Math.round(estimatedDirectCost / keys.length);
        }
      }
    });

    // 3. Aggregate Invoices (Net Amounts)
    const filteredInvoices = invoices.filter(inv => 
      selectedProjectId === 'all' || inv.projectId === selectedProjectId
    );

    filteredInvoices.forEach(inv => {
      const key = getMonthKey(inv.date);
      if (monthsMap.has(key)) {
        const entry = monthsMap.get(key)!;
        entry.actualCost += (inv.netAmount || 0);
        entry.invoiceCount += 1;
      } else {
        // Fallback to closest month
        const keys = Array.from(monthsMap.keys());
        if (keys.length > 0) {
          const lastKey = keys[keys.length - 1];
          const entry = monthsMap.get(lastKey)!;
          entry.actualCost += (inv.netAmount || 0);
          entry.invoiceCount += 1;
        }
      }
    });

    // 4. Aggregate Expenses
    const filteredExpenses = expenses.filter(exp => 
      selectedProjectId === 'all' || exp.projectId === selectedProjectId
    );

    filteredExpenses.forEach(exp => {
      const key = getMonthKey(exp.date);
      if (monthsMap.has(key)) {
        const entry = monthsMap.get(key)!;
        entry.actualCost += (exp.amount || 0);
        entry.expenseCount += 1;
      } else {
        const keys = Array.from(monthsMap.keys());
        if (keys.length > 0) {
          const lastKey = keys[keys.length - 1];
          const entry = monthsMap.get(lastKey)!;
          entry.actualCost += (exp.amount || 0);
          entry.expenseCount += 1;
        }
      }
    });

    // 5. Compute net profit and profit margin percentage
    const sortedTimeline = Array.from(monthsMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    
    // Smooth out estimated baseline if needed so charts have natural trajectory
    let cumulativeRevenue = 0;
    let cumulativeActualCost = 0;
    let cumulativeEstimatedCost = 0;

    return sortedTimeline.map((item, index) => {
      // If a month has actual costs but 0 allocated revenue, borrow proportional contract value
      const effectiveRevenue = item.projectedRevenue > 0 
        ? item.projectedRevenue 
        : item.actualCost > 0 
          ? Math.round(item.actualCost / 0.70) 
          : Math.round((relevantProjects.reduce((s, p) => s + p.budget, 0) / sortedTimeline.length));

      const effectiveEstimatedCost = item.estimatedCost > 0
        ? item.estimatedCost
        : Math.round(effectiveRevenue * 0.70);

      const netProfit = effectiveRevenue - item.actualCost;
      const profitMargin = effectiveRevenue > 0 ? (netProfit / effectiveRevenue) * 100 : 30;

      cumulativeRevenue += effectiveRevenue;
      cumulativeActualCost += item.actualCost;
      cumulativeEstimatedCost += effectiveEstimatedCost;

      return {
        ...item,
        projectedRevenue: effectiveRevenue,
        estimatedCost: effectiveEstimatedCost,
        netProfit: Math.max(0, netProfit),
        rawNetProfit: netProfit,
        profitMarginPercent: Math.round(profitMargin * 10) / 10,
        cumulativeRevenue,
        cumulativeActualCost,
        cumulativeEstimatedCost,
        cumulativeProfit: cumulativeRevenue - cumulativeActualCost
      };
    });
  }, [relevantProjects, invoices, expenses, selectedProjectId, timeRange]);

  // Project-by-project profit comparison data
  const projectComparisonData = useMemo(() => {
    return relevantProjects.map(p => {
      const budget = p.budget || 0;
      const estimatedCost = Math.round(budget * 0.70);
      const actualCost = (p.totalNetInvoices || 0) + (p.totalExpenses || 0);
      const netProfit = budget - actualCost;
      const margin = budget > 0 ? (netProfit / budget) * 100 : 0;

      return {
        name: p.name.length > 16 ? p.name.substring(0, 14) + '...' : p.name,
        fullName: p.name,
        Presupuesto: budget,
        'Costo Estimado': estimatedCost,
        'Costo Real': actualCost,
        'Utilidad Ganancia': Math.max(0, netProfit),
        netProfit,
        margin: Math.round(margin * 10) / 10,
        status: p.status || 'active'
      };
    });
  }, [relevantProjects]);

  // Global KPIs for this selected slice
  const globalSummary = useMemo(() => {
    const totalBudget = relevantProjects.reduce((sum, p) => sum + (p.budget || 0), 0);
    const totalEstimatedCost = Math.round(totalBudget * 0.70);
    const totalInvoicedNet = relevantProjects.reduce((sum, p) => sum + (p.totalNetInvoices || 0), 0);
    const totalExpenses = relevantProjects.reduce((sum, p) => sum + (p.totalExpenses || 0), 0);
    const totalActualCost = totalInvoicedNet + totalExpenses;
    const totalNetProfit = totalBudget - totalActualCost;
    const profitMarginPercent = totalBudget > 0 ? (totalNetProfit / totalBudget) * 100 : 0;
    
    // Cost Performance Index (CPI) = Estimated Cost of Work vs Actual Cost Incurred
    // CPI > 1.0 means under budget (efficient), CPI < 1.0 means over budget
    const cpi = totalActualCost > 0 ? (totalEstimatedCost / totalActualCost) : 1.0;

    return {
      totalBudget,
      totalEstimatedCost,
      totalActualCost,
      totalNetProfit,
      profitMarginPercent,
      cpi: Math.round(cpi * 100) / 100
    };
  }, [relevantProjects]);

  return (
    <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 shadow-xs space-y-6">
      {/* HEADER WITH TITLE & CONTROLS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0 mt-0.5">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/40 px-2 py-0.5 rounded">
                Control de Rentabilidad & Curva S
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-xs font-medium text-slate-500">Tendencias en el Tiempo</span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight uppercase">
              Utilidad vs Costos Estimados y Reales
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Análisis temporal de margen operacional, costos directos estimados y gastos ejecutados por mes.
            </p>
          </div>
        </div>

        {/* TOOLBAR CONTROLS */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Project selector dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 py-1 pr-2 pl-1 focus:outline-none cursor-pointer"
            >
              <option value="all">Todas las Obras ({projects.length})</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Time range buttons */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setTimeRange('6m')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeRange === '6m'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              6M
            </button>
            <button
              onClick={() => setTimeRange('12m')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeRange === '12m'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              12M
            </button>
            <button
              onClick={() => setTimeRange('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeRange === 'all'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Histórico
            </button>
          </div>

          {/* View mode switcher */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('composed_trend')}
              title="Curva de Tendencia Temporal (Composed)"
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                viewMode === 'composed_trend'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('profit_margin')}
              title="Margen de Ganancia Porcentual"
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                viewMode === 'profit_margin'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('project_comparison')}
              title="Comparativa de Rentabilidad por Obra"
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                viewMode === 'project_comparison'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 4 MINI EXECUTIVE KPI METRIC CHIPS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Net Profit */}
        <div className="bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Utilidad Operacional</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
          <p className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-300 font-mono">
            {formatCLP(globalSummary.totalNetProfit)}
          </p>
          <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
            Margen: <strong className="font-bold">{globalSummary.profitMarginPercent.toFixed(1)}%</strong>
          </p>
        </div>

        {/* KPI 2: Estimated Direct Cost */}
        <div className="bg-blue-50/40 dark:bg-blue-950/20 p-3.5 rounded-xl border border-blue-200/60 dark:border-blue-900/40">
          <div className="flex items-center justify-between text-blue-700 dark:text-blue-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Costo Directo Estimado</span>
            <DollarSign className="w-3.5 h-3.5" />
          </div>
          <p className="text-lg sm:text-xl font-black text-blue-700 dark:text-blue-300 font-mono">
            {formatCLP(globalSummary.totalEstimatedCost)}
          </p>
          <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">
            Presupuesto base ~70% OC
          </p>
        </div>

        {/* KPI 3: Actual Incurred Cost */}
        <div className="bg-amber-50/40 dark:bg-amber-950/20 p-3.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Costo Real Ejecutado</span>
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <p className="text-lg sm:text-xl font-black text-amber-700 dark:text-amber-300 font-mono">
            {formatCLP(globalSummary.totalActualCost)}
          </p>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
            Facturas DTE + Rendiciones
          </p>
        </div>

        {/* KPI 4: Cost Performance Index */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Índice Eficiencia (CPI)</span>
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-lg sm:text-xl font-black font-mono ${
              globalSummary.cpi >= 1.0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}>
              {globalSummary.cpi.toFixed(2)}x
            </span>
            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.2 rounded ${
              globalSummary.cpi >= 1.0 
                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' 
                : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
            }`}>
              {globalSummary.cpi >= 1.0 ? 'Dentro de Rango' : 'Revisar Costos'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {globalSummary.cpi >= 1.0 ? 'Rentabilidad controlada' : 'Gasto supera costo estimado'}
          </p>
        </div>
      </div>

      {/* CHART CONTAINER */}
      <div className="w-full">
        {/* VIEW 1: COMPOSED TREND (Área de Costos + Línea de Utilidad) */}
        {viewMode === 'composed_trend' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-blue-500 opacity-80 inline-block"></span>
                  <span>Costo Estimado Directo</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-amber-500 opacity-80 inline-block"></span>
                  <span>Costo Real Incurrido</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-emerald-500 rounded-full inline-block"></span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Utilidad / Ganancia</span>
                </span>
              </div>
              <span className="text-[11px] text-slate-400">Cifras en CLP (Pesos Chilenos)</span>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={monthlyTimelineData}
                  margin={{ top: 15, right: 15, left: 10, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="colorEstimated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05}/>
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
                  
                  <XAxis 
                    dataKey="label" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 11 }} 
                    dy={8}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                  />

                  <Tooltip
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: '1px solid rgba(148, 163, 184, 0.2)', 
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                      backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff',
                      color: document.documentElement.classList.contains('dark') ? '#ffffff' : '#0f172a',
                      fontSize: '12px',
                      padding: '12px'
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'Utilidad / Ganancia') return [`$${value.toLocaleString('es-CL')}`, '🟢 Utilidad Neta'];
                      if (name === 'Costo Estimado') return [`$${value.toLocaleString('es-CL')}`, '🔵 Costo Estimado'];
                      if (name === 'Costo Real') return [`$${value.toLocaleString('es-CL')}`, '🟠 Costo Real Incurrido'];
                      return [`$${value.toLocaleString('es-CL')}`, name];
                    }}
                    labelFormatter={(label) => `Período: ${label}`}
                  />

                  <Area 
                    type="monotone" 
                    dataKey="estimatedCost" 
                    name="Costo Estimado" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorEstimated)" 
                  />
                  
                  <Area 
                    type="monotone" 
                    dataKey="actualCost" 
                    name="Costo Real" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorActual)" 
                  />

                  <Line 
                    type="monotone" 
                    dataKey="netProfit" 
                    name="Utilidad / Ganancia" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#ffffff' }}
                    activeDot={{ r: 7, stroke: '#10b981', strokeWidth: 2 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* VIEW 2: PROFIT MARGIN % EVOLUTION */}
        {viewMode === 'profit_margin' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block"></span>
                  <span>Margen de Ganancia Realizado (%)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-blue-500 border border-dashed border-blue-500 inline-block"></span>
                  <span>Meta Objetivo (30% Margen)</span>
                </span>
              </div>
              <span className="text-[11px] text-slate-400">Porcentaje sobre monto presupuestado</span>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={monthlyTimelineData}
                  margin={{ top: 15, right: 15, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
                  <XAxis 
                    dataKey="label" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 11 }} 
                    dy={8}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: '1px solid rgba(148, 163, 184, 0.2)', 
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                      backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff',
                      color: document.documentElement.classList.contains('dark') ? '#ffffff' : '#0f172a',
                      fontSize: '12px'
                    }}
                    formatter={(value: number) => [`${value}%`, 'Margen Operacional']}
                  />
                  <ReferenceLine y={30} stroke="#3b82f6" strokeDasharray="4 4" label={{ value: 'Meta 30%', fill: '#3b82f6', fontSize: 10, position: 'right' }} />
                  <Bar 
                    dataKey="profitMarginPercent" 
                    name="Margen %" 
                    fill="#10b981" 
                    radius={[6, 6, 0, 0]} 
                    barSize={32} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="profitMarginPercent" 
                    stroke="#059669" 
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#059669' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* VIEW 3: PROJECT-BY-PROJECT PROFIT VS COST COMPARISON */}
        {viewMode === 'project_comparison' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-blue-600 inline-block"></span>
                  <span>Costo Estimado</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-amber-500 inline-block"></span>
                  <span>Costo Real</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block"></span>
                  <span>Utilidad / Ganancia</span>
                </span>
              </div>
              <span className="text-[11px] text-slate-400">Por cada obra en cartera</span>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={projectComparisonData}
                  margin={{ top: 15, right: 15, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 11 }} 
                    dy={8}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                  />
                  <Tooltip
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: '1px solid rgba(148, 163, 184, 0.2)', 
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                      backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff',
                      color: document.documentElement.classList.contains('dark') ? '#ffffff' : '#0f172a',
                      fontSize: '12px'
                    }}
                    formatter={(value: number, name: string) => [`$${value.toLocaleString('es-CL')}`, name]}
                  />
                  <Bar dataKey="Costo Estimado" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="Costo Real" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="Utilidad Ganancia" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER NOTE / EXPLANATION */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span>
            Los costos reales se alimentan automáticamente de facturas DTE electrónicas y rendiciones de gastos aprobadas.
          </span>
        </div>
        <span className="font-semibold text-slate-600 dark:text-slate-400 shrink-0">
          Actualización en tiempo real vía Firestore
        </span>
      </div>
    </div>
  );
}
