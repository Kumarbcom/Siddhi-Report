
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
import { Database, AlertCircle, ClipboardList, ShoppingCart, TrendingUp, Package, Layers, LayoutDashboard, FileBarChart, Users, ChevronRight, Menu, X } from 'lucide-react';

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Data State
  const [materials, setMaterials] = useState<Material[]>([]);
  const [closingStockItems, setClosingStockItems] = useState<ClosingStockItem[]>([]);
  const [pendingSOItems, setPendingSOItems] = useState<PendingSOItem[]>([]);
  const [pendingPOItems, setPendingPOItems] = useState<PendingPOItem[]>([]);
  const [sales1Year, setSales1Year] = useState<SalesRecord[]>([]);
  const [sales3Months, setSales3Months] = useState<SalesRecord[]>([]);
  const [salesReportItems, setSalesReportItems] = useState<SalesReportItem[]>([]);
  const [customerMasterItems, setCustomerMasterItems] = useState<CustomerMasterItem[]>([]);
  
  // Loading State to prevent overwrite on init
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const [selectedMake, setSelectedMake] = useState<string | 'ALL'>('ALL');
  const [error, setError] = useState<string | null>(null);

  // --- Load Data Effects ---
  useEffect(() => {
    const loadData = () => {
      try {
        const storedMaster = localStorage.getItem(STORAGE_KEY_MASTER);
        if (storedMaster) setMaterials(JSON.parse(storedMaster));

        const storedStock = localStorage.getItem(STORAGE_KEY_STOCK);
        if (storedStock) setClosingStockItems(JSON.parse(storedStock));

        const storedSO = localStorage.getItem(STORAGE_KEY_PENDING_SO);
        if (storedSO) setPendingSOItems(JSON.parse(storedSO));

        const storedPO = localStorage.getItem(STORAGE_KEY_PENDING_PO);
        if (storedPO) setPendingPOItems(JSON.parse(storedPO));

        const storedS1Y = localStorage.getItem(STORAGE_KEY_SALES_1Y);
        if (storedS1Y) setSales1Year(JSON.parse(storedS1Y));

        const storedS3M = localStorage.getItem(STORAGE_KEY_SALES_3M);
        if (storedS3M) setSales3Months(JSON.parse(storedS3M));

        const storedReport = localStorage.getItem(STORAGE_KEY_SALES_REPORT);
        if (storedReport) setSalesReportItems(JSON.parse(storedReport));

        const storedCust = localStorage.getItem(STORAGE_KEY_CUSTOMER_MASTER);
        if (storedCust) setCustomerMasterItems(JSON.parse(storedCust));
      } catch (e) {
        console.error("Error loading data from local storage", e);
        setError("Failed to load some data. Please check console.");
      } finally {
        setIsDataLoaded(true);
      }
    };
    loadData();
  }, []);

  // --- Save Data Effects (Only run if isDataLoaded is true) ---
  useEffect(() => { if (isDataLoaded) localStorage.setItem(STORAGE_KEY_MASTER, JSON.stringify(materials)); }, [materials, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem(STORAGE_KEY_STOCK, JSON.stringify(closingStockItems)); }, [closingStockItems, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem(STORAGE_KEY_PENDING_SO, JSON.stringify(pendingSOItems)); }, [pendingSOItems, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem(STORAGE_KEY_PENDING_PO, JSON.stringify(pendingPOItems)); }, [pendingPOItems, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem(STORAGE_KEY_SALES_1Y, JSON.stringify(sales1Year)); }, [sales1Year, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem(STORAGE_KEY_SALES_3M, JSON.stringify(sales3Months)); }, [sales3Months, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem(STORAGE_KEY_SALES_REPORT, JSON.stringify(salesReportItems)); }, [salesReportItems, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem(STORAGE_KEY_CUSTOMER_MASTER, JSON.stringify(customerMasterItems)); }, [customerMasterItems, isDataLoaded]);

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
      
      localStorage.clear();
      setError(null);
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

  // --- Sidebar Component ---
  const SidebarItem = ({ id, label, icon: Icon, count, onClick }: any) => (
    <button
      onClick={() => onClick(id)}
      className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
        activeTab === id 
          ? 'bg-blue-50 text-blue-700' 
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <Icon className={`w-4 h-4 ${activeTab === id ? 'text-blue-600' : 'text-gray-400'}`} />
      <span className="flex-1">{label}</span>
      {count !== undefined && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-gray-900 overflow-hidden">
      
      {/* Sidebar */}
      <aside className={`bg-white border-r border-gray-200 flex flex-col flex-shrink-0 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-0 -ml-64 md:w-16 md:ml-0 overflow-hidden'}`}>
        {/* Sidebar Header */}
        <div className="h-14 flex items-center px-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg text-white flex-shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'} transition-opacity`}>
               <h1 className="text-sm font-bold text-gray-900 leading-tight">Material Master</h1>
               <p className="text-[9px] text-gray-500 font-medium">AI Database System</p>
            </div>
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-4 px-3 space-y-6">
           
           {/* Group: Dashboard */}
           <div>
             {isSidebarOpen && <div className="px-3 mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Group Dashboard</div>}
             <SidebarItem id="dashboard" label="Dashboard" icon={LayoutDashboard} onClick={setActiveTab} />
           </div>

           {/* Group: Masters */}
           <div>
             {isSidebarOpen && <div className="px-3 mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Masters</div>}
             <div className="space-y-1">
                <SidebarItem id="master" label="Material Master" icon={Database} count={materials.length} onClick={setActiveTab} />
                <SidebarItem id="customerMaster" label="Customer Master" icon={Users} count={customerMasterItems.length} onClick={setActiveTab} />
             </div>
           </div>

           {/* Group: Data Tables */}
           <div>
             {isSidebarOpen && <div className="px-3 mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Data Tables</div>}
             <div className="space-y-1">
                <SidebarItem id="closingStock" label="Closing Stock" icon={Package} count={closingStockItems.length} onClick={setActiveTab} />
                <SidebarItem id="pendingSO" label="Pending SO" icon={ClipboardList} count={pendingSOItems.length} onClick={setActiveTab} />
                <SidebarItem id="pendingPO" label="Pending PO" icon={ShoppingCart} count={pendingPOItems.length} onClick={setActiveTab} />
                <SidebarItem id="salesReport" label="Sales Report" icon={FileBarChart} count={salesReportItems.length} onClick={setActiveTab} />
                <SidebarItem id="salesHistory" label="Sales History" icon={TrendingUp} count={sales1Year.length + sales3Months.length} onClick={setActiveTab} />
             </div>
           </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
           {isSidebarOpen ? (
              <div className="flex flex-col gap-2">
                 <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <div className={`w-1.5 h-1.5 rounded-full ${isDataLoaded ? 'bg-green-500 animate-pulse' : 'bg-orange-500'}`}></div>
                    {isDataLoaded ? "System Connected" : "Loading Data..."}
                 </div>
                 {(materials.length > 0 || closingStockItems.length > 0 || pendingSOItems.length > 0) && (
                   <button onClick={handleClearDatabase} className="text-xs text-red-500 hover:text-red-700 font-medium text-left flex items-center gap-1.5 mt-1">
                     <AlertCircle className="w-3 h-3" /> Clear All Data
                   </button>
                 )}
              </div>
           ) : (
              <div className="flex justify-center">
                 <div className={`w-1.5 h-1.5 rounded-full ${isDataLoaded ? 'bg-green-500' : 'bg-orange-500'}`}></div>
              </div>
           )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Mobile Header / Sidebar Toggle */}
        <header className="bg-white border-b border-gray-200 h-14 flex items-center justify-between px-4 flex-shrink-0 md:hidden">
            <div className="flex items-center gap-2">
               <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                  {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
               </button>
               <span className="font-bold text-gray-900">Material Master AI</span>
            </div>
        </header>

        {/* Main View Container */}
        <main className="flex-1 overflow-hidden p-4 relative">
          
          {error && (
            <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-3 text-orange-800 flex-shrink-0">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-xs font-medium">{error}</p>
            </div>
          )}

          {/* Tab Content Rendering */}
          <div className="h-full overflow-hidden flex flex-col">
            
            {/* --- DASHBOARD TAB --- */}
            {activeTab === 'dashboard' && (
              <DashboardView 
                  materials={materials}
                  closingStock={closingStockItems}
                  pendingSO={pendingSOItems}
                  pendingPO={pendingPOItems}
                  salesReportItems={salesReportItems} // Pass detailed items for new dash
                  customers={customerMasterItems} // Pass customers for group logic
                  sales1Year={sales1Year}
                  sales3Months={sales3Months}
                  setActiveTab={setActiveTab}
              />
            )}

            {/* --- MATERIAL MASTER TAB --- */}
            {activeTab === 'master' && (
              <div className="flex flex-col lg:flex-row gap-4 items-start h-full">
                
                {/* Filter Sidebar (Make) */}
                <div className="w-full lg:w-56 flex-shrink-0 flex flex-col gap-3 h-full">
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center text-center flex-shrink-0">
                    <div className="bg-blue-50 p-2.5 rounded-full mb-2"><Database className="w-5 h-5 text-blue-600" /></div>
                    <p className="text-xs font-medium text-gray-500">Total Materials</p>
                    <p className="text-2xl font-bold text-gray-900 mt-0.5">{materials.length}</p>
                  </div>
                  
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col flex-1 overflow-hidden min-h-0">
                    <div className="p-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                      <h3 className="text-xs font-bold text-gray-700 flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5" /> Filter by Make
                      </h3>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar p-1 space-y-0.5 flex-1">
                      <button onClick={() => setSelectedMake('ALL')} className={`w-full text-left px-3 py-1.5 rounded-md text-xs flex justify-between items-center transition-colors ${selectedMake === 'ALL' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 hover:bg-gray-100'}`}>
                        <span className="font-medium">All Makes</span>
                        <span className={`text-[10px] px-1.5 py-px rounded-full ${selectedMake === 'ALL' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>{materials.length}</span>
                      </button>
                      {makeStats.length > 0 ? (
                        makeStats.map(([make, count]) => (
                          <button key={make} onClick={() => setSelectedMake(make)} className={`w-full text-left px-3 py-1.5 rounded-md text-xs flex justify-between items-center transition-colors ${selectedMake === make ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 hover:bg-gray-100'}`}>
                            <span className="truncate font-medium w-3/4" title={make}>{make}</span>
                            <span className={`text-[10px] px-1.5 py-px rounded-full ${selectedMake === make ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>{count}</span>
                          </button>
                        ))
                      ) : <div className="text-center text-gray-400 text-xs italic py-4">No data</div>}
                    </div>
                  </div>
                </div>

                {/* Table Content */}
                <div className="flex-1 w-full min-w-0 flex flex-col gap-3 h-full overflow-hidden">
                  <AddMaterialForm materials={materials} onBulkAdd={handleBulkAddMaterial} onClear={handleClearMaterials} />
                  <div className="flex-1 min-h-0">
                      <MaterialTable materials={filteredMaterials} onDelete={handleDeleteMaterial} />
                  </div>
                </div>
              </div>
            )}

            {/* --- CUSTOMER MASTER TAB --- */}
            {activeTab === 'customerMaster' && (
              <div className="h-full w-full">
                <CustomerMasterView items={customerMasterItems} onBulkAdd={handleBulkAddCustomerMaster} onDelete={handleDeleteCustomerMaster} onClear={handleClearCustomerMaster} />
              </div>
            )}

            {/* --- CLOSING STOCK TAB --- */}
            {activeTab === 'closingStock' && (
              <div className="h-full w-full">
                <ClosingStockView items={closingStockItems} materials={materials} onBulkAdd={handleBulkAddStock} onDelete={handleDeleteStock} onClear={handleClearStock} />
              </div>
            )}

            {/* --- PENDING SO TAB --- */}
            {activeTab === 'pendingSO' && (
              <div className="h-full w-full">
                <PendingSOView items={pendingSOItems} materials={materials} closingStockItems={closingStockItems} onBulkAdd={handleBulkAddPendingSO} onDelete={handleDeletePendingSO} onClear={handleClearPendingSO} />
              </div>
            )}

            {/* --- PENDING PO TAB --- */}
            {activeTab === 'pendingPO' && (
              <div className="h-full w-full">
                <PendingPOView items={pendingPOItems} materials={materials} closingStockItems={closingStockItems} onBulkAdd={handleBulkAddPendingPO} onDelete={handleDeletePendingPO} onClear={handleClearPendingPO} />
              </div>
            )}

            {/* --- SALES REPORT TAB --- */}
            {activeTab === 'salesReport' && (
              <div className="h-full w-full">
                <SalesReportView items={salesReportItems} materials={materials} customers={customerMasterItems} onBulkAdd={handleBulkAddSalesReport} onDelete={handleDeleteSalesReport} onClear={handleClearSalesReport} />
              </div>
            )}

            {/* --- SALES HISTORY TAB --- */}
            {activeTab === 'salesHistory' && (
              <div className="h-full overflow-y-auto custom-scrollbar pr-1">
                <SalesHistoryView sales1Year={sales1Year} sales3Months={sales3Months} onBulkAdd1Year={handleBulkAddSales1Y} onBulkAdd3Months={handleBulkAddSales3M} onDelete1Year={handleDeleteSales1Y} onDelete3Months={handleDeleteSales3M} onClear1Year={handleClearSales1Y} onClear3Months={handleClearSales3M} />
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
