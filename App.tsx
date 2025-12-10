
import React, { useState, useEffect, useMemo } from 'react';
import { Material, MaterialFormData, PendingSOItem, PendingPOItem, SalesRecord, ClosingStockItem, SalesReportItem, CustomerMasterItem } from './types';
import MaterialTable from './components/MaterialTable';
import AddMaterialForm from './components/AddMaterialForm';
import PendingSOView from './components/PendingSOView';
import PendingPOView from './components/PendingPOView';
import SalesHistoryView from './components/SalesHistoryView';
import ClosingStockView from './components/ClosingStockView';
import SalesReportView from './components/SalesReportView';
import CustomerMasterView from './components/CustomerMasterView';
import DashboardView from './components/DashboardView';
import { Database, AlertCircle, ClipboardList, ShoppingCart, TrendingUp, Package, Layers, LayoutDashboard, FileBarChart, Users } from 'lucide-react';

const STORAGE_KEY_MASTER = 'material_master_db_v1';
const STORAGE_KEY_STOCK = 'closing_stock_db_v1';
const STORAGE_KEY_PENDING_SO = 'pending_so_db_v1';
const STORAGE_KEY_PENDING_PO = 'pending_po_db_v1';
const STORAGE_KEY_SALES_1Y = 'sales_1year_db_v1';
const STORAGE_KEY_SALES_3M = 'sales_3months_db_v1';
const STORAGE_KEY_SALES_REPORT = 'sales_report_db_v1';
const STORAGE_KEY_CUSTOMER_MASTER = 'customer_master_db_v1';

type ActiveTab = 'dashboard' | 'master' | 'customerMaster' | 'closingStock' | 'pendingSO' | 'pendingPO' | 'salesHistory' | 'salesReport';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  
  const [materials, setMaterials] = useState<Material[]>([]);
  const [closingStockItems, setClosingStockItems] = useState<ClosingStockItem[]>([]);
  const [pendingSOItems, setPendingSOItems] = useState<PendingSOItem[]>([]);
  const [pendingPOItems, setPendingPOItems] = useState<PendingPOItem[]>([]);
  const [sales1Year, setSales1Year] = useState<SalesRecord[]>([]);
  const [sales3Months, setSales3Months] = useState<SalesRecord[]>([]);
  const [salesReportItems, setSalesReportItems] = useState<SalesReportItem[]>([]);
  const [customerMasterItems, setCustomerMasterItems] = useState<CustomerMasterItem[]>([]);
  
  const [selectedMake, setSelectedMake] = useState<string | 'ALL'>('ALL');
  const [error, setError] = useState<string | null>(null);

  // Helper for safe storage
  const saveToStorage = (key: string, data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      if (error && error.includes('storage')) setError(null);
    } catch (e: any) {
      console.error(`Failed to save to ${key}:`, e);
      // QuotaExceededError check
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        setError("Warning: Browser storage limit reached. Data is available in this session but may not persist after reload.");
      }
    }
  };

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

  // Load Sales Report Data
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY_SALES_REPORT);
    if (stored) { try { setSalesReportItems(JSON.parse(stored)); } catch (e) { console.error("Sales Report DB corruption", e); } }
  }, []);

  // Load Customer Master Data
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY_CUSTOMER_MASTER);
    if (stored) { try { setCustomerMasterItems(JSON.parse(stored)); } catch (e) { console.error("Customer Master DB corruption", e); } }
  }, []);

  // Save Effects with Safe Writes
  useEffect(() => { saveToStorage(STORAGE_KEY_MASTER, materials); }, [materials]);
  useEffect(() => { saveToStorage(STORAGE_KEY_STOCK, closingStockItems); }, [closingStockItems]);
  useEffect(() => { saveToStorage(STORAGE_KEY_PENDING_SO, pendingSOItems); }, [pendingSOItems]);
  useEffect(() => { saveToStorage(STORAGE_KEY_PENDING_PO, pendingPOItems); }, [pendingPOItems]);
  useEffect(() => { saveToStorage(STORAGE_KEY_SALES_1Y, sales1Year); }, [sales1Year]);
  useEffect(() => { saveToStorage(STORAGE_KEY_SALES_3M, sales3Months); }, [sales3Months]);
  useEffect(() => { saveToStorage(STORAGE_KEY_SALES_REPORT, salesReportItems); }, [salesReportItems]);
  useEffect(() => { saveToStorage(STORAGE_KEY_CUSTOMER_MASTER, customerMasterItems); }, [customerMasterItems]);

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

  // --- Handlers for Sales Report ---
  const handleBulkAddSalesReport = (items: Omit<SalesReportItem, 'id' | 'createdAt'>[]) => {
    const newItems = items.map(item => ({ ...item, id: crypto.randomUUID(), createdAt: Date.now() }));
    setSalesReportItems(prev => [...newItems, ...prev]);
  };

  const handleDeleteSalesReport = (id: string) => {
    setSalesReportItems(prev => prev.filter(i => i.id !== id));
  };

  const handleClearSalesReport = () => {
    if (window.confirm("Are you sure you want to delete ALL Sales Report records?")) {
      setSalesReportItems([]);
    }
  };

  // --- Handlers for Customer Master ---
  const handleBulkAddCustomerMaster = (items: Omit<CustomerMasterItem, 'id' | 'createdAt'>[]) => {
    const newItems = items.map(item => ({ ...item, id: crypto.randomUUID(), createdAt: Date.now() }));
    setCustomerMasterItems(prev => [...newItems, ...prev]);
  };

  const handleDeleteCustomerMaster = (id: string) => {
    setCustomerMasterItems(prev => prev.filter(i => i.id !== id));
  };

  const handleClearCustomerMaster = () => {
    if (window.confirm("Are you sure you want to delete ALL Customer Master records?")) {
      setCustomerMasterItems([]);
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
      setSalesReportItems([]);
      setCustomerMasterItems([]);
      // Clear storage
      try {
        localStorage.removeItem(STORAGE_KEY_MASTER);
        localStorage.removeItem(STORAGE_KEY_STOCK);
        localStorage.removeItem(STORAGE_KEY_PENDING_SO);
        localStorage.removeItem(STORAGE_KEY_PENDING_PO);
        localStorage.removeItem(STORAGE_KEY_SALES_1Y);
        localStorage.removeItem(STORAGE_KEY_SALES_3M);
        localStorage.removeItem(STORAGE_KEY_SALES_REPORT);
        localStorage.removeItem(STORAGE_KEY_CUSTOMER_MASTER);
        setError(null);
      } catch (e) {
        console.error("Error clearing storage", e);
      }
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
        <div className="w-full px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-1.5 rounded-lg text-white">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Material Master</h1>
              <p className="text-[10px] text-gray-500 font-medium">Database & Management System</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden md:flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-full border border-gray-200">
                <div className="w-1.5 h-1.5 rounded-full bg-green-50 animate-pulse"></div>
                Connected
             </div>
             {(materials.length > 0 || closingStockItems.length > 0 || pendingSOItems.length > 0 || pendingPOItems.length > 0 || salesReportItems.length > 0 || customerMasterItems.length > 0) && (
               <button onClick={handleClearDatabase} className="text-xs text-red-500 hover:text-red-700 font-medium underline">
                 Clear All Data
               </button>
             )}
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="w-full px-4 flex space-x-6 -mb-px overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`pb-2 pt-2 px-1 border-b-2 font-medium text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'dashboard' ? 'border-gray-800 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
          </button>
          <button
            onClick={() => setActiveTab('master')}
            className={`pb-2 pt-2 px-1 border-b-2 font-medium text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'master' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Database className="w-3.5 h-3.5" /> Material Master
            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px]">{materials.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('customerMaster')}
            className={`pb-2 pt-2 px-1 border-b-2 font-medium text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'customerMaster' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Customer Master
            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px]">{customerMasterItems.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('closingStock')}
            className={`pb-2 pt-2 px-1 border-b-2 font-medium text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'closingStock' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Package className="w-3.5 h-3.5" /> Closing Stock
            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px]">{closingStockItems.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('pendingSO')}
            className={`pb-2 pt-2 px-1 border-b-2 font-medium text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'pendingSO' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" /> Pending SO
            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px]">{pendingSOItems.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('pendingPO')}
            className={`pb-2 pt-2 px-1 border-b-2 font-medium text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'pendingPO' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" /> Pending PO
            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px]">{pendingPOItems.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('salesReport')}
            className={`pb-2 pt-2 px-1 border-b-2 font-medium text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'salesReport' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileBarChart className="w-3.5 h-3.5" /> Sales Report
            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px]">{salesReportItems.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('salesHistory')}
            className={`pb-2 pt-2 px-1 border-b-2 font-medium text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'salesHistory' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" /> Sales History
            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px]">{sales1Year.length + sales3Months.length}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 w-full px-4 py-4 overflow-hidden flex flex-col h-[calc(100vh-56px)]">
        {error && (
          <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-3 text-orange-800 flex-shrink-0">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p className="text-xs font-medium">{error}</p>
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
          <div className="flex flex-col lg:flex-row gap-4 items-start h-full">
            
            {/* Left Column: Interactive Vertical Tabs (Make Filter) */}
            <div className="w-full lg:w-64 flex-shrink-0 flex flex-col gap-3 h-full">
              
              {/* Total Materials Summary */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center text-center flex-shrink-0">
                 <div className="bg-blue-50 p-3 rounded-full mb-2">
                    <Database className="w-6 h-6 text-blue-600" />
                </div>
                 <p className="text-xs font-medium text-gray-500">Total Materials</p>
                 <p className="text-2xl font-bold text-gray-900 mt-1">{materials.length}</p>
              </div>
              
              {/* Vertical Tabs for Makes */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col flex-1 overflow-hidden min-h-0">
                <div className="p-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                  <h3 className="text-xs font-bold text-gray-700 flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" />
                    Filter by Make
                  </h3>
                </div>
                <div className="overflow-y-auto custom-scrollbar p-1 space-y-0.5 flex-1">
                  <button
                    onClick={() => setSelectedMake('ALL')}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-xs flex justify-between items-center transition-colors ${
                      selectedMake === 'ALL' 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="font-medium">All Makes</span>
                    <span className={`text-[10px] px-1.5 py-px rounded-full ${selectedMake === 'ALL' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {materials.length}
                    </span>
                  </button>
                  
                  {makeStats.length > 0 ? (
                    makeStats.map(([make, count]) => (
                      <button
                        key={make}
                        onClick={() => setSelectedMake(make)}
                        className={`w-full text-left px-3 py-1.5 rounded-md text-xs flex justify-between items-center transition-colors ${
                          selectedMake === make 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span className="truncate font-medium w-3/4" title={make}>{make}</span>
                        <span className={`text-[10px] px-1.5 py-px rounded-full ${selectedMake === make ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                          {count}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="text-center text-gray-400 text-xs italic py-4">No data</div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Main Content */}
            <div className="flex-1 w-full min-w-0 flex flex-col gap-3 h-full overflow-hidden">
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

        {/* --- CUSTOMER MASTER TAB --- */}
        {activeTab === 'customerMaster' && (
          <div className="h-full w-full">
             <CustomerMasterView 
               items={customerMasterItems}
               onBulkAdd={handleBulkAddCustomerMaster}
               onDelete={handleDeleteCustomerMaster}
               onClear={handleClearCustomerMaster}
             />
          </div>
        )}

        {/* --- CLOSING STOCK TAB --- */}
        {activeTab === 'closingStock' && (
          <div className="h-full w-full">
             <ClosingStockView
               items={closingStockItems}
               materials={materials} 
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

        {/* --- SALES REPORT TAB --- */}
        {activeTab === 'salesReport' && (
          <div className="h-full w-full">
             <SalesReportView 
               items={salesReportItems}
               materials={materials}
               customers={customerMasterItems}
               onBulkAdd={handleBulkAddSalesReport}
               onDelete={handleDeleteSalesReport}
               onClear={handleClearSalesReport}
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
