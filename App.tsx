
import React, { useState, useEffect, useMemo } from 'react';
import { Material, MaterialFormData, PendingSOItem, PendingPOItem, SalesRecord, ClosingStockItem } from './types';
import MaterialTable from './components/MaterialTable';
import AddMaterialForm from './components/AddMaterialForm';
import PendingSOView from './components/PendingSOView';
import PendingPOView from './components/PendingPOView';
import SalesHistoryView from './components/SalesHistoryView';
import ClosingStockView from './components/ClosingStockView';
import DashboardView from './components/DashboardView';
import { Database, AlertCircle, ClipboardList, ShoppingCart, TrendingUp, Package, Layers, LayoutDashboard } from 'lucide-react';

const STORAGE_KEY_MASTER = 'material_master_db_v1';
const STORAGE_KEY_STOCK = 'closing_stock_db_v1';
const STORAGE_KEY_PENDING_SO = 'pending_so_db_v1';
const STORAGE_KEY_PENDING_PO = 'pending_po_db_v1';
const STORAGE_KEY_SALES_1Y = 'sales_1year_db_v1';
const STORAGE_KEY_SALES_3M = 'sales_3months_db_v1';

type ActiveTab = 'dashboard' | 'master' | 'closingStock' | 'pendingSO' | 'pendingPO' | 'salesHistory';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  
  const [materials, setMaterials] = useState<Material[]>([]);
  const [closingStockItems, setClosingStockItems] = useState<ClosingStockItem[]>([]);
  const [pendingSOItems, setPendingSOItems] = useState<PendingSOItem[]>([]);
  const [pendingPOItems, setPendingPOItems] = useState<PendingPOItem[]>([]);
  const [sales1Year, setSales1Year] = useState<SalesRecord[]>([]);
  const [sales3Months, setSales3Months] = useState<SalesRecord[]>([]);
  
  const [selectedMake, setSelectedMake] = useState<string | 'ALL'>('ALL');
  const [error, setError] = useState<string | null>(null);

  // Load Master Data
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY_MASTER);
    if (stored) { try { setMaterials(JSON.parse(stored)); } catch (e) { console.error("Master DB corruption", e); } }
  }, []);

  // Load Closing Stock Data
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY_STOCK);
    if (stored) { try { setClosingStockItems(JSON.parse(stored)); } catch (e) { console.error("Stock DB corruption", e); } }
  }, []);

  // Load Pending SO Data
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY_PENDING_SO);
    if (stored) { try { setPendingSOItems(JSON.parse(stored)); } catch (e) { console.error("Pending SO DB corruption", e); } }
  }, []);

  // Load Pending PO Data
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY_PENDING_PO);
    if (stored) { try { setPendingPOItems(JSON.parse(stored)); } catch (e) { console.error("Pending PO DB corruption", e); } }
  }, []);

  // Load Sales Data
  useEffect(() => {
    const stored1Y = localStorage.getItem(STORAGE_KEY_SALES_1Y);
    if (stored1Y) { try { setSales1Year(JSON.parse(stored1Y)); } catch (e) { console.error("Sales 1Y DB corruption", e); } }
    
    const stored3M = localStorage.getItem(STORAGE_KEY_SALES_3M);
    if (stored3M) { try { setSales3Months(JSON.parse(stored3M)); } catch (e) { console.error("Sales 3M DB corruption", e); } }
  }, []);

  // Save Effects
  useEffect(() => { localStorage.setItem(STORAGE_KEY_MASTER, JSON.stringify(materials)); }, [materials]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_STOCK, JSON.stringify(closingStockItems)); }, [closingStockItems]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PENDING_SO, JSON.stringify(pendingSOItems)); }, [pendingSOItems]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PENDING_PO, JSON.stringify(pendingPOItems)); }, [pendingPOItems]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_SALES_1Y, JSON.stringify(sales1Year)); }, [sales1Year]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_SALES_3M, JSON.stringify(sales3Months)); }, [sales3Months]);

  // --- Handlers for Material Master ---
  const handleBulkAddMaterial = (dataList: MaterialFormData[]) => {
    const newMaterials: Material[] = dataList.map(item => ({ ...item, id: crypto.randomUUID(), createdAt: Date.now() }));
    setMaterials(prev => [...newMaterials, ...prev]);
    setError(null);
  };

  const handleDeleteMaterial = (id: string) => {
    if (window.confirm("Delete this material?")) {
      setMaterials(prev => prev.filter(m => m.id !== id));
    }
  };

  const handleClearMaterials = () => {
    if (window.confirm("Are you sure you want to delete ALL Material Master records? This action cannot be undone.")) {
      setMaterials([]);
    }
  };

  // --- Handlers for Closing Stock ---
  const handleBulkAddStock = (items: Omit<ClosingStockItem, 'id' | 'createdAt'>[]) => {
    const newItems = items.map(item => ({ ...item, id: crypto.randomUUID(), createdAt: Date.now() }));
    setClosingStockItems(prev => [...newItems, ...prev]);
  };

  const handleDeleteStock = (id: string) => {
    setClosingStockItems(prev => prev.filter(i => i.id !== id));
  };

  const handleClearStock = () => {
    if (window.confirm("Are you sure you want to delete ALL Closing Stock records?")) {
      setClosingStockItems([]);
    }
  };

  // --- Handlers for Pending SO ---
  const handleBulkAddPendingSO = (items: Omit<PendingSOItem, 'id' | 'createdAt'>[]) => {
    const newSOs = items.map(item => ({ ...item, id: crypto.randomUUID(), createdAt: Date.now() }));
    setPendingSOItems(prev => [...newSOs, ...prev]);
  };

  const handleDeletePendingSO = (id: string) => {
     setPendingSOItems(prev => prev.filter(i => i.id !== id));
  };

  const handleClearPendingSO = () => {
    if (window.confirm("Are you sure you want to delete ALL Pending Sales Orders?")) {
      setPendingSOItems([]);
    }
  };

  // --- Handlers for Pending PO ---
  const handleBulkAddPendingPO = (items: Omit<PendingPOItem, 'id' | 'createdAt'>[]) => {
    const newPOs = items.map(item => ({ ...item, id: crypto.randomUUID(), createdAt: Date.now() }));
    setPendingPOItems(prev => [...newPOs, ...prev]);
  };

  const handleDeletePendingPO = (id: string) => {
     setPendingPOItems(prev => prev.filter(i => i.id !== id));
  };

  const handleClearPendingPO = () => {
    if (window.confirm("Are you sure you want to delete ALL Pending Purchase Orders?")) {
      setPendingPOItems([]);
    }
  };

  // --- Handlers for Sales History ---
  const handleBulkAddSales1Y = (items: Omit<SalesRecord, 'id' | 'createdAt'>[]) => {
    const newItems = items.map(item => ({ ...item, id: crypto.randomUUID(), createdAt: Date.now() }));
    setSales1Year(prev => [...newItems, ...prev]);
  };

  const handleBulkAddSales3M = (items: Omit<SalesRecord, 'id' | 'createdAt'>[]) => {
    const newItems = items.map(item => ({ ...item, id: crypto.randomUUID(), createdAt: Date.now() }));
    setSales3Months(prev => [...newItems, ...prev]);
  };

  const handleDeleteSales1Y = (id: string) => {
    setSales1Year(prev => prev.filter(i => i.id !== id));
  };

  const handleDeleteSales3M = (id: string) => {
    setSales3Months(prev => prev.filter(i => i.id !== id));
  };

  const handleClearSales1Y = () => {
    if (window.confirm("Are you sure you want to delete ALL Sales History (1 Year) records?")) {
      setSales1Year([]);
    }
  };

  const handleClearSales3M = () => {
    if (window.confirm("Are you sure you want to delete ALL Sales History (3 Months) records?")) {
      setSales3Months([]);
    }
  };

  const handleClearDatabase = () => {
    if (window.confirm("Are you sure you want to clear ALL data from ALL tabs? This is irreversible.")) {
      setMaterials([]);
      setClosingStockItems([]);
      setPendingSOItems([]);
      setPendingPOItems([]);
      setSales1Year([]);
      setSales3Months([]);
      localStorage.removeItem(STORAGE_KEY_MASTER);
      localStorage.removeItem(STORAGE_KEY_STOCK);
      localStorage.removeItem(STORAGE_KEY_PENDING_SO);
      localStorage.removeItem(STORAGE_KEY_PENDING_PO);
      localStorage.removeItem(STORAGE_KEY_SALES_1Y);
      localStorage.removeItem(STORAGE_KEY_SALES_3M);
    }
  };

  // Stats for "Records by Make"
  const makeStats = useMemo(() => {
    const counts: Record<string, number> = {};
    materials.forEach(m => { const make = m.make?.trim() || 'Unspecified'; counts[make] = (counts[make] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [materials]);

  // Filtered materials based on selection
  const filteredMaterials = useMemo(() => {
    if (selectedMake === 'ALL') return materials;
    return materials.filter(m => (m.make?.trim() || 'Unspecified') === selectedMake);
  }, [materials, selectedMake]);

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900 pb-0 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm flex-shrink-0">
        <div className="w-full px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">Material Master</h1>
              <p className="text-xs text-gray-500 font-medium">Database & Management System</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden md:flex items-center gap-2 text-sm text-gray-500 bg-gray-50 px-3 py-1 rounded-full border border-gray-200">
                <div className="w-2 h-2 rounded-full bg-green-50 animate-pulse"></div>
                Database Connected
             </div>
             {(materials.length > 0 || closingStockItems.length > 0 || pendingSOItems.length > 0 || pendingPOItems.length > 0) && (
               <button onClick={handleClearDatabase} className="text-xs text-red-500 hover:text-red-700 font-medium underline">
                 Clear All Data
               </button>
             )}
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="w-full px-6 flex space-x-6 md:space-x-8 -mb-px overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`pb-3 pt-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'dashboard' ? 'border-gray-800 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </button>
          <button
            onClick={() => setActiveTab('master')}
            className={`pb-3 pt-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'master' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Database className="w-4 h-4" /> Material Master
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{materials.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('closingStock')}
            className={`pb-3 pt-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'closingStock' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Package className="w-4 h-4" /> Closing Stock
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{closingStockItems.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('pendingSO')}
            className={`pb-3 pt-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'pendingSO' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ClipboardList className="w-4 h-4" /> Pending SO
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{pendingSOItems.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('pendingPO')}
            className={`pb-3 pt-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'pendingPO' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ShoppingCart className="w-4 h-4" /> Pending PO
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{pendingPOItems.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('salesHistory')}
            className={`pb-3 pt-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'salesHistory' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <TrendingUp className="w-4 h-4" /> Sales History
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{sales1Year.length + sales3Months.length}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 w-full px-6 py-6 overflow-hidden flex flex-col h-[calc(100vh-64px)]">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700 flex-shrink-0">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* --- DASHBOARD TAB --- */}
        {activeTab === 'dashboard' && (
           <DashboardView 
              materials={materials}
              closingStock={closingStockItems}
              pendingSO={pendingSOItems}
              pendingPO={pendingPOItems}
              sales1Year={sales1Year}
              sales3Months={sales3Months}
              setActiveTab={setActiveTab}
           />
        )}

        {/* --- MATERIAL MASTER TAB --- */}
        {activeTab === 'master' && (
          <div className="flex flex-col lg:flex-row gap-6 items-start h-full">
            
            {/* Left Column: Interactive Vertical Tabs (Make Filter) */}
            <div className="w-full lg:w-72 flex-shrink-0 flex flex-col gap-4 h-full">
              
              {/* Total Materials Summary */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center text-center flex-shrink-0">
                 <div className="bg-blue-50 p-4 rounded-full mb-3">
                    <Database className="w-8 h-8 text-blue-600" />
                </div>
                 <p className="text-sm font-medium text-gray-500">Total Materials</p>
                 <p className="text-4xl font-bold text-gray-900 mt-2">{materials.length}</p>
              </div>
              
              {/* Vertical Tabs for Makes */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col flex-1 overflow-hidden min-h-0">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    Filter by Make
                  </h3>
                </div>
                <div className="overflow-y-auto custom-scrollbar p-2 space-y-1 flex-1">
                  <button
                    onClick={() => setSelectedMake('ALL')}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex justify-between items-center transition-colors ${
                      selectedMake === 'ALL' 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="font-medium">All Makes</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${selectedMake === 'ALL' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {materials.length}
                    </span>
                  </button>
                  
                  {makeStats.length > 0 ? (
                    makeStats.map(([make, count]) => (
                      <button
                        key={make}
                        onClick={() => setSelectedMake(make)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex justify-between items-center transition-colors ${
                          selectedMake === make 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span className="truncate font-medium w-3/4" title={make}>{make}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${selectedMake === make ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                          {count}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="text-center text-gray-400 text-sm italic py-4">No data</div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Main Content */}
            <div className="flex-1 w-full min-w-0 flex flex-col gap-4 h-full overflow-hidden">
               <AddMaterialForm 
                  onBulkAdd={handleBulkAddMaterial} 
                  onClear={handleClearMaterials}
               />
               <div className="flex-1 min-h-0">
                   <MaterialTable 
                      materials={filteredMaterials} 
                      onDelete={handleDeleteMaterial} 
                   />
               </div>
            </div>
          </div>
        )}

        {/* --- CLOSING STOCK TAB --- */}
        {activeTab === 'closingStock' && (
          <div className="h-full w-full">
             <ClosingStockView
               items={closingStockItems}
               materials={materials} // Passed for Pivot functionality
               onBulkAdd={handleBulkAddStock}
               onDelete={handleDeleteStock}
               onClear={handleClearStock}
             />
          </div>
        )}

        {/* --- PENDING SO TAB --- */}
        {activeTab === 'pendingSO' && (
          <div className="h-full w-full">
             <PendingSOView 
               items={pendingSOItems} 
               materials={materials} 
               closingStockItems={closingStockItems}
               onBulkAdd={handleBulkAddPendingSO} 
               onDelete={handleDeletePendingSO}
               onClear={handleClearPendingSO} 
             />
          </div>
        )}

        {/* --- PENDING PO TAB --- */}
        {activeTab === 'pendingPO' && (
          <div className="h-full w-full">
             <PendingPOView 
               items={pendingPOItems} 
               materials={materials} 
               closingStockItems={closingStockItems}
               onBulkAdd={handleBulkAddPendingPO} 
               onDelete={handleDeletePendingPO}
               onClear={handleClearPendingPO}
             />
          </div>
        )}

        {/* --- SALES HISTORY TAB --- */}
        {activeTab === 'salesHistory' && (
          <div className="h-full overflow-y-auto">
             <SalesHistoryView 
               sales1Year={sales1Year} 
               sales3Months={sales3Months} 
               onBulkAdd1Year={handleBulkAddSales1Y} 
               onBulkAdd3Months={handleBulkAddSales3M} 
               onDelete1Year={handleDeleteSales1Y}
               onDelete3Months={handleDeleteSales3M}
               onClear1Year={handleClearSales1Y}
               onClear3Months={handleClearSales3M}
             />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
