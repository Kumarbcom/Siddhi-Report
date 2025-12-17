
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
import PivotReportView from './components/PivotReportView';
import ChatView from './components/ChatView';
import { Database, AlertCircle, ClipboardList, ShoppingCart, TrendingUp, Package, Layers, LayoutDashboard, FileBarChart, Users, ChevronRight, Menu, X, HardDrive, Table, MessageSquare } from 'lucide-react';
import { dbService } from './services/db';
import { materialService } from './services/materialService';
import { customerService } from './services/customerService';
import { stockService } from './services/stockService';
import { soService } from './services/soService';
import { poService } from './services/poService';
import { salesService } from './services/salesService';

const STORAGE_KEY_SALES_1Y = 'sales_1year_db_v1';
const STORAGE_KEY_SALES_3M = 'sales_3months_db_v1';

type ActiveTab = 'dashboard' | 'chat' | 'master' | 'customerMaster' | 'closingStock' | 'pendingSO' | 'pendingPO' | 'salesHistory' | 'salesReport' | 'pivotReport';

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
  
  // Loading State
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isDbLoading, setIsDbLoading] = useState(true);

  const [selectedMake, setSelectedMake] = useState<string | 'ALL'>('ALL');
  const [error, setError] = useState<string | null>(null);

  // --- Load Data Effects ---
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsDbLoading(true);

        // 1. Load All Data from Supabase Services (parallel fetch)
        const [
            dbMaterials,
            dbCustomers,
            dbStock,
            dbSO,
            dbPO,
            dbSales
        ] = await Promise.all([
            materialService.getAll(),
            customerService.getAll(),
            stockService.getAll(),
            soService.getAll(),
            poService.getAll(),
            salesService.getAll()
        ]);

        setMaterials(dbMaterials);
        setCustomerMasterItems(dbCustomers);
        setClosingStockItems(dbStock);
        setPendingSOItems(dbSO);
        setPendingPOItems(dbPO);
        setSalesReportItems(dbSales);

        // 2. Load legacy local storage data (Sales History 1Y/3M - keeping local for now as user didn't ask for table for these specifically)
        const storedS1Y = localStorage.getItem(STORAGE_KEY_SALES_1Y);
        if (storedS1Y) setSales1Year(JSON.parse(storedS1Y));

        const storedS3M = localStorage.getItem(STORAGE_KEY_SALES_3M);
        if (storedS3M) setSales3Months(JSON.parse(storedS3M));

      } catch (e) {
        console.error("Error loading data", e);
        setError("Failed to load some data. Please check console.");
      } finally {
        setIsDataLoaded(true);
        setIsDbLoading(false);
      }
    };
    loadData();
  }, []);

  // --- Save Data Effects (LocalStorage Backup for Sales History only now) ---
  useEffect(() => { if (isDataLoaded) localStorage.setItem(STORAGE_KEY_SALES_1Y, JSON.stringify(sales1Year)); }, [sales1Year, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem(STORAGE_KEY_SALES_3M, JSON.stringify(sales3Months)); }, [sales3Months, isDataLoaded]);

  // --- Handlers: Material ---
  const handleBulkAddMaterial = async (dataList: MaterialFormData[]) => {
    const newItems = await materialService.createBulk(dataList);
    setMaterials(prev => [...newItems, ...prev]);
  };
  const handleUpdateMaterial = async (item: Material) => {
    await materialService.update(item);
    setMaterials(prev => prev.map(m => m.id === item.id ? item : m));
  };
  const handleDeleteMaterial = async (id: string) => {
    if (confirm("Delete?")) { await materialService.delete(id); setMaterials(prev => prev.filter(m => m.id !== id)); }
  };
  const handleClearMaterials = async () => {
    if (confirm("Are you sure you want to delete ALL Materials? This cannot be undone.")) {
      await materialService.clearAll();
      setMaterials([]);
    }
  };

  // --- Handlers: Customer ---
  const handleBulkAddCustomer = async (items: any) => {
      const newItems = await customerService.createBulk(items);
      setCustomerMasterItems(prev => [...newItems, ...prev]);
  };
  const handleUpdateCustomer = async (item: CustomerMasterItem) => {
      await customerService.update(item);
      setCustomerMasterItems(prev => prev.map(i => i.id === item.id ? item : i));
  };
  const handleDeleteCustomer = async (id: string) => {
      await customerService.delete(id);
      setCustomerMasterItems(prev => prev.filter(i => i.id !== id));
  };
  const handleClearCustomer = async () => { 
      if (confirm("Are you sure you want to delete ALL Customers? This cannot be undone.")) {
          await customerService.clearAll();
          setCustomerMasterItems([]);
      }
  };

  // --- Handlers: Stock ---
  const handleBulkAddStock = async (items: any) => {
      const newItems = await stockService.createBulk(items);
      setClosingStockItems(prev => [...newItems, ...prev]);
  };
  const handleUpdateStock = async (item: ClosingStockItem) => {
      await stockService.update(item);
      setClosingStockItems(prev => prev.map(i => i.id === item.id ? item : i));
  };
  const handleDeleteStock = async (id: string) => {
      await stockService.delete(id);
      setClosingStockItems(prev => prev.filter(i => i.id !== id));
  };
  const handleClearStock = async () => { 
      if (confirm("Are you sure you want to delete ALL Closing Stock records?")) {
          await stockService.clearAll();
          setClosingStockItems([]);
      }
  };

  // --- Handlers: SO ---
  const handleBulkAddSO = async (items: any) => {
      const newItems = await soService.createBulk(items);
      setPendingSOItems(prev => [...newItems, ...prev]);
  };
  const handleUpdateSO = async (item: PendingSOItem) => {
      await soService.update(item);
      setPendingSOItems(prev => prev.map(i => i.id === item.id ? item : i));
  };
  const handleDeleteSO = async (id: string) => {
      await soService.delete(id);
      setPendingSOItems(prev => prev.filter(i => i.id !== id));
  };
  const handleClearSO = async () => { 
      if (confirm("Are you sure you want to delete ALL Pending Sales Orders?")) {
          await soService.clearAll();
          setPendingSOItems([]);
      }
  };

  // --- Handlers: PO ---
  const handleBulkAddPO = async (items: any) => {
      const newItems = await poService.createBulk(items);
      setPendingPOItems(prev => [...newItems, ...prev]);
  };
  const handleUpdatePO = async (item: PendingPOItem) => {
      await poService.update(item);
      setPendingPOItems(prev => prev.map(i => i.id === item.id ? item : i));
  };
  const handleDeletePO = async (id: string) => {
      await poService.delete(id);
      setPendingPOItems(prev => prev.filter(i => i.id !== id));
  };
  const handleClearPO = async () => { 
      if (confirm("Are you sure you want to delete ALL Pending Purchase Orders?")) {
          await poService.clearAll();
          setPendingPOItems([]);
      }
  };

  // --- Handlers: Sales Report ---
  const handleBulkAddSales = async (items: any) => {
      setIsDbLoading(true);
      const newItems = await salesService.createBulk(items);
      setSalesReportItems(prev => [...newItems, ...prev]);
      setIsDbLoading(false);
  };
  const handleUpdateSales = async (item: SalesReportItem) => {
      await salesService.update(item);
      setSalesReportItems(prev => prev.map(i => i.id === item.id ? item : i));
  };
  const handleDeleteSales = async (id: string) => {
      await salesService.delete(id);
      setSalesReportItems(prev => prev.filter(i => i.id !== id));
  };
  const handleClearSales = async () => {
      if(confirm("Clear all sales data? This will delete all records from Supabase.")) {
          await salesService.clearAll();
          setSalesReportItems([]);
      }
  };

  // --- Legacy Handlers (Local Only) ---
  const handleBulkAddSales1Y = (items: any) => setSales1Year(prev => [...items.map((i:any) => ({...i, id: crypto.randomUUID(), createdAt: Date.now()})), ...prev]);
  const handleBulkAddSales3M = (items: any) => setSales3Months(prev => [...items.map((i:any) => ({...i, id: crypto.randomUUID(), createdAt: Date.now()})), ...prev]);
  const handleUpdateSales1Y = (updatedItem: SalesRecord) => setSales1Year(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
  const handleUpdateSales3M = (updatedItem: SalesRecord) => setSales3Months(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
  const handleDeleteSales1Y = (id: string) => setSales1Year(prev => prev.filter(i => i.id !== id));
  const handleDeleteSales3M = (id: string) => setSales3Months(prev => prev.filter(i => i.id !== id));
  const handleClearSales1Y = () => setSales1Year([]);
  const handleClearSales3M = () => setSales3Months([]);

  const handleClearDatabase = async () => {
    if (window.confirm("This will clear LOCAL storage caches. DB data remains. Continue?")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  // Stats for "Records by Make"
  const makeStats = useMemo(() => {
    const counts: Record<string, number> = {};
    materials.forEach(m => { 
        const makeRaw = m.make?.trim() || 'Unspecified';
        const makeKey = makeRaw.toUpperCase();
        counts[makeKey] = (counts[makeKey] || 0) + 1; 
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [materials]);

  const filteredMaterials = useMemo(() => {
    if (selectedMake === 'ALL') return materials;
    return materials.filter(m => {
        const makeRaw = m.make?.trim() || 'Unspecified';
        return makeRaw.toUpperCase() === selectedMake;
    });
  }, [materials, selectedMake]);

  // Sidebar Helper
  const SidebarItem = ({ id, label, icon: Icon, count, onClick }: any) => (
    <button
      onClick={() => onClick(id)}
      className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
        activeTab === id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <Icon className={`w-4 h-4 ${activeTab === id ? 'text-blue-600' : 'text-gray-400'}`} />
      <span className="flex-1">{label}</span>
      {count !== undefined && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
          {count > 1000 ? (count/1000).toFixed(1) + 'k' : count}
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
               <h1 className="text-sm font-bold text-gray-900 leading-tight">Siddhi Kabel Corp.</h1>
               <p className="text-[9px] text-gray-500 font-medium">Supabase Connected</p>
            </div>
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-4 px-3 space-y-6">
           <div>
             {isSidebarOpen && <div className="px-3 mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Group Dashboard</div>}
             <SidebarItem id="dashboard" label="Dashboard" icon={LayoutDashboard} onClick={setActiveTab} />
             <SidebarItem id="pivotReport" label="Pivot Strategy Report" icon={Table} onClick={setActiveTab} />
             <SidebarItem id="chat" label="AI Assistant" icon={MessageSquare} onClick={setActiveTab} />
           </div>
           <div>
             {isSidebarOpen && <div className="px-3 mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Masters</div>}
             <div className="space-y-1">
                <SidebarItem id="master" label="Material Master" icon={Database} count={materials.length} onClick={setActiveTab} />
                <SidebarItem id="customerMaster" label="Customer Master" icon={Users} count={customerMasterItems.length} onClick={setActiveTab} />
             </div>
           </div>
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
           {isSidebarOpen && (
              <div className="flex flex-col gap-2">
                 <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <div className={`w-1.5 h-1.5 rounded-full ${!isDbLoading ? 'bg-green-500' : 'bg-orange-500 animate-pulse'}`}></div>
                    {isDbLoading ? "Syncing..." : "Online"}
                 </div>
                 <button onClick={handleClearDatabase} className="text-xs text-red-500 hover:text-red-700 font-medium text-left flex items-center gap-1.5 mt-1">
                     <AlertCircle className="w-3 h-3" /> Reset Cache
                 </button>
              </div>
           )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <header className="bg-white border-b border-gray-200 h-14 flex items-center justify-between px-4 flex-shrink-0 md:hidden">
            <div className="flex items-center gap-2">
               <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                  {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
               </button>
               <span className="font-bold text-gray-900">Siddhi Kabel Reports</span>
            </div>
        </header>

        <main className="flex-1 overflow-hidden p-4 relative">
          {activeTab === 'dashboard' && (
              <DashboardView 
                  materials={materials}
                  closingStock={closingStockItems}
                  pendingSO={pendingSOItems}
                  pendingPO={pendingPOItems}
                  salesReportItems={salesReportItems} 
                  customers={customerMasterItems}
                  sales1Year={sales1Year}
                  sales3Months={sales3Months}
                  setActiveTab={setActiveTab}
              />
            )}
            {activeTab === 'chat' && (
              <div className="h-full w-full max-w-4xl mx-auto">
                <ChatView 
                  materials={materials}
                  closingStock={closingStockItems}
                  pendingSO={pendingSOItems}
                  pendingPO={pendingPOItems}
                  salesReportItems={salesReportItems}
                  customers={customerMasterItems}
                />
              </div>
            )}
            {activeTab === 'pivotReport' && (
              <div className="h-full w-full">
                <PivotReportView
                  materials={materials}
                  closingStock={closingStockItems}
                  pendingSO={pendingSOItems}
                  pendingPO={pendingPOItems}
                  salesReportItems={salesReportItems}
                />
              </div>
            )}
            {activeTab === 'master' && (
              <div className="flex flex-col lg:flex-row gap-4 items-start h-full">
                <div className="w-full lg:w-56 flex-shrink-0 flex flex-col gap-3 h-full">
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center text-center flex-shrink-0">
                    <div className="bg-blue-50 p-2.5 rounded-full mb-2"><Database className="w-5 h-5 text-blue-600" /></div>
                    <p className="text-xs font-medium text-gray-500">Total Materials</p>
                    <p className="text-2xl font-bold text-gray-900 mt-0.5">{materials.length}</p>
                    <p className="text-[9px] text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full mt-1">Live DB</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col flex-1 overflow-hidden min-h-0">
                    <div className="p-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                      <h3 className="text-xs font-bold text-gray-700 flex items-center gap-2">Layers Filter by Make</h3>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar p-1 space-y-0.5 flex-1">
                      <button onClick={() => setSelectedMake('ALL')} className={`w-full text-left px-3 py-1.5 rounded-md text-xs flex justify-between items-center transition-colors ${selectedMake === 'ALL' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 hover:bg-gray-100'}`}>
                        <span className="font-medium">All Makes</span>
                      </button>
                      {makeStats.map(([make, count]) => (
                          <button key={make} onClick={() => setSelectedMake(make)} className={`w-full text-left px-3 py-1.5 rounded-md text-xs flex justify-between items-center transition-colors ${selectedMake === make ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 hover:bg-gray-100'}`}>
                            <span className="truncate font-medium w-3/4" title={make}>{make}</span>
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{count}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
                <div className="flex-1 w-full min-w-0 flex flex-col gap-3 h-full overflow-hidden">
                  <AddMaterialForm materials={materials} onBulkAdd={handleBulkAddMaterial} onClear={handleClearMaterials} />
                  <div className="flex-1 min-h-0">
                      <MaterialTable materials={filteredMaterials} onUpdate={handleUpdateMaterial} onDelete={handleDeleteMaterial} />
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'customerMaster' && <div className="h-full w-full"><CustomerMasterView items={customerMasterItems} onBulkAdd={handleBulkAddCustomer} onUpdate={handleUpdateCustomer} onDelete={handleDeleteCustomer} onClear={handleClearCustomer} /></div>}
            {activeTab === 'closingStock' && <div className="h-full w-full"><ClosingStockView items={closingStockItems} materials={materials} onBulkAdd={handleBulkAddStock} onUpdate={handleUpdateStock} onDelete={handleDeleteStock} onClear={handleClearStock} /></div>}
            {activeTab === 'pendingSO' && <div className="h-full w-full"><PendingSOView items={pendingSOItems} materials={materials} closingStockItems={closingStockItems} onBulkAdd={handleBulkAddSO} onUpdate={handleUpdateSO} onDelete={handleDeleteSO} onClear={handleClearSO} /></div>}
            {activeTab === 'pendingPO' && <div className="h-full w-full"><PendingPOView items={pendingPOItems} materials={materials} closingStockItems={closingStockItems} pendingSOItems={pendingSOItems} onBulkAdd={handleBulkAddPO} onUpdate={handleUpdatePO} onDelete={handleDeletePO} onClear={handleClearPO} /></div>}
            {activeTab === 'salesReport' && <div className="h-full w-full"><SalesReportView items={salesReportItems} materials={materials} customers={customerMasterItems} onBulkAdd={handleBulkAddSales} onUpdate={handleUpdateSales} onDelete={handleDeleteSales} onClear={handleClearSales} /></div>}
            {activeTab === 'salesHistory' && <div className="h-full overflow-y-auto custom-scrollbar pr-1"><SalesHistoryView sales1Year={sales1Year} sales3Months={sales3Months} onBulkAdd1Year={handleBulkAddSales1Y} onBulkAdd3Months={handleBulkAddSales3M} onUpdate1Year={handleUpdateSales1Y} onUpdate3Months={handleUpdateSales3M} onDelete1Year={handleDeleteSales1Y} onDelete3Months={handleDeleteSales3M} onClear1Year={handleClearSales1Y} onClear3Months={handleClearSales3M} /></div>}
        </main>
      </div>
    </div>
  );
};

export default App;
