import React, { useState, useEffect } from 'react';
import { 
  auth, db, signIn, logout 
} from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Project } from './types';
import Dashboard from './components/Dashboard';
import ProjectDetail from './components/ProjectDetail';
import MaterialCatalog from './components/MaterialCatalog';
import SupplierAdvisor from './components/SupplierAdvisor';
import InventoryManager from './components/InventoryManager';
import QuotationsView from './components/QuotationsView';
import CompanyLogo from './components/CompanyLogo';
import { 
  Layout, Building2, Package, LogOut, Briefcase, 
  Store, Sun, Moon, ShieldCheck, ChevronRight,
  Menu, X, Sparkles, Calendar, Layers, Clock, FileText
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'dashboard' | 'quotations' | 'inventory' | 'materials' | 'suppliers'>('dashboard');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [supplierQuery, setSupplierQuery] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // Chilean formatted date
  const todayFormatted = new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center gap-4 text-zinc-900 dark:text-zinc-100">
        <CompanyLogo size="lg" />
        <div className="w-8 h-8 border-2 border-zinc-300 dark:border-zinc-800 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-xs font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">Viña Construcciones & Estructuras SpA</p>
      </div>
    );
  }

  if (!user) {
    const isDummy = (auth.app.options as any).apiKey === 'dummy';
    return (
      <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden transition-colors">
        <div className="max-w-md w-full bg-white dark:bg-zinc-950 rounded-2xl p-8 text-center border border-zinc-200 dark:border-zinc-800 shadow-sm relative z-10">
          <div className="flex justify-center mb-5">
            <CompanyLogo size="xl" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 rounded-full text-[11px] font-semibold mb-3 border border-zinc-200 dark:border-zinc-800">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Portal Oficial de Obras
          </div>
          <h1 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight uppercase">Viña Construcciones</h1>
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2">RUT 78.447.669-3 • ESTRUCTURAS SpA</p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-8 leading-relaxed">Control presupuestario, partidas, cotizaciones y facturas DTE para contratistas en Chile.</p>
          
          {isDummy ? (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 p-4 rounded-xl mb-6 text-amber-800 dark:text-amber-200 text-xs text-left">
              <p className="font-bold mb-1">Configuración Inicial</p>
              Inicializando conexión con Firebase...
            </div>
          ) : (
            <button 
              onClick={signIn}
              className="w-full py-3 px-4 bg-zinc-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-950 text-white font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2.5 text-xs cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Ingresar con Google
            </button>
          )}
        </div>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Mis Obras y Control', icon: Layout, desc: 'Presupuestos, balances y estado' },
    { id: 'quotations', label: 'Cotizaciones Oficiales', icon: FileText, desc: 'Presupuestos, partidas y licitaciones' },
    { id: 'inventory', label: 'Inventario de Bodega', icon: Package, desc: 'Control global de materiales y herramientas' },
    { id: 'materials', label: 'Catálogo de Partidas', icon: Layers, desc: 'Materiales y precios unitarios' },
    { id: 'suppliers', label: 'Buscador Proveedores', icon: Store, desc: 'Sodimac, Construmart, Imperial' },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 flex transition-colors duration-200">
      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white dark:bg-black border-b border-zinc-200 dark:border-zinc-800 z-40 px-4 flex items-center justify-between">
        <CompanyLogo showText size="sm" />
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Backdrop on Mobile */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-xs z-40"
        />
      )}

      {/* Modern Executive Sidebar */}
      <aside className={`w-64 bg-white dark:bg-black border-r border-zinc-200 dark:border-zinc-800 flex flex-col fixed inset-y-0 z-50 transition-transform duration-200 lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Brand Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <CompanyLogo size="md" />
            <div className="min-w-0">
              <span className="font-black text-zinc-900 dark:text-white leading-tight tracking-tight text-xs uppercase block truncate">Viña Construcciones</span>
              <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">& Estructuras SpA</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800">
                  78.447.669-3
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  En Línea
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Navigation items */}
        <div className="px-2.5 py-4 flex-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
            Módulos Principales
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = (currentView === item.id && !selectedProject);
              return (
                <button
                  key={item.id}
                  onClick={() => { 
                    setCurrentView(item.id as any); 
                    setSelectedProject(null); 
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                    isActive 
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold shadow-xs' 
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 font-medium'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-tight truncate">{item.label}</p>
                    <p className={`text-[10px] truncate ${isActive ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400 dark:text-zinc-500'}`}>{item.desc}</p>
                  </div>
                  {isActive && (
                    <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Chilean Contractor Quick Info Badge */}
        <div className="p-3 mx-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 mb-2">
          <div className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200 text-xs font-semibold mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Valparaíso & Viña del Mar</span>
          </div>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Formatos oficiales certificados para licitaciones DOM y mandantes privados.
          </p>
        </div>

        {/* User & Settings footer */}
        <div className="p-2.5 border-t border-zinc-200 dark:border-zinc-800 space-y-1">
          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-colors text-xs font-semibold cursor-pointer"
          >
            <div className="flex items-center gap-2">
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-700" />}
              <span>Tema {isDarkMode ? 'Oscuro' : 'Claro'}</span>
            </div>
            <span className="text-[9px] uppercase font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800">
              {isDarkMode ? 'Dark' : 'Light'}
            </span>
          </button>

          {/* User profile */}
          <div className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || ''} className="w-7 h-7 rounded-full border border-zinc-300 dark:border-zinc-700 shrink-0 object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black font-bold text-xs flex items-center justify-center shrink-0">
                {(user.displayName || 'V')[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">{user.displayName || 'Contratista'}</p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{user.email}</p>
            </div>
            <button 
              onClick={logout}
              title="Cerrar sesión"
              className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen pt-14 lg:pt-0">
        {/* Global Top Command Bar (Desktop) */}
        <header className="hidden lg:flex items-center justify-between px-8 py-3.5 bg-white/90 dark:bg-black/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {selectedProject ? (
              <div className="flex items-center gap-2 text-xs">
                <button 
                  onClick={() => setSelectedProject(null)}
                  className="font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Obras
                </button>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                <span className="font-bold text-zinc-900 dark:text-white truncate max-w-xs">{selectedProject.name}</span>
              </div>
            ) : (
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                  {currentView === 'dashboard' ? 'Panel de Control de Obras' :
                   currentView === 'quotations' ? 'Cotizaciones Oficiales y Licitaciones' :
                   currentView === 'inventory' ? 'Inventario Global de Bodega' :
                   currentView === 'materials' ? 'Catálogo de Materiales y Partidas' :
                   'Asesor Inteligente de Proveedores'}
                </h2>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 capitalize">
                  {todayFormatted} • Viña Construcciones & Estructuras SpA
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 rounded-lg text-xs font-mono border border-zinc-200 dark:border-zinc-800">
              <Clock className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>Chile (CLT)</span>
            </div>
          </div>
        </header>

        {/* Main Routed Views */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {selectedProject ? (
            <ProjectDetail 
              project={selectedProject} 
              onBack={() => setSelectedProject(null)} 
            />
          ) : currentView === 'dashboard' ? (
            <Dashboard onSelectProject={setSelectedProject} user={user} />
          ) : currentView === 'quotations' ? (
            <QuotationsView onSelectProject={setSelectedProject} />
          ) : currentView === 'inventory' ? (
            <InventoryManager />
          ) : currentView === 'materials' ? (
            <MaterialCatalog 
              onNavigateToSuppliers={(matName) => {
                setSupplierQuery(matName);
                setCurrentView('suppliers');
              }} 
            />
          ) : (
            <SupplierAdvisor initialQuery={supplierQuery} />
          )}
        </main>
      </div>
    </div>
  );
}
