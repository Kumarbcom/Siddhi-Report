
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
import { Database, AlertCircle, ClipboardList, ShoppingCart, TrendingUp, Package, Layers, LayoutDashboard, FileBarChart, Users, Menu, X, MessageSquare, Table } from 'lucide-react';
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
  const loadData = async () => {
    try {
      setIsDbLoading(true);
      const [dbMaterials, dbCustomers, dbStock, dbSO, dbPO, dbSales] = await Promise.all([
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

      const storedS1Y = localStorage.getItem(STORAGE_KEY_SALES_1Y);
      if (storedS1Y) setSales1Year(JSON.parse(storedS1Y));
      const storedS3M = localStorage.getItem(STORAGE_KEY_SALES_3M);
      if (storedS3M) setSales3Months(JSON.parse(storedS3M));
    } catch (e) {
      console.error("Error loading data", e);
      setError("Failed to load some data. Please check connection.");
    } finally {
      setIsDataLoaded(true);
      setIsDbLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

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
    if (confirm("Delete material master record?")) {
        await materialService.delete(id);
        setMaterials(prev => prev.filter(m => m.id !== id));
    }
  };

  // --- Handlers: Sales Report ---
  const handleBulkAddSales = async (items: any) => {
      // Items are usually empty here if createBulkWithUpsert was called from View
      // But we reload to get the latest state from DB
      await loadData();
  };
  const handleUpdateSales = async (item: SalesReportItem) => {
      await salesService.update(item);
      setSalesReportItems(prev => prev.map(i => i.id === item.id ? item : i));
  };
  const handleDeleteSales = async (id: string) => {
      if (confirm("Delete this sales transaction?")) {
        await salesService.delete(id);
        setSalesReportItems(prev => prev.filter(i => i.id !== id));
      }
  };
  const handleClearSales = async () => {
      if(confirm("DANGER: Clear all sales data from database?")) {
          await salesService.clearAll();
          setSalesReportItems([]);
      }
  };

  // Other handlers follow same pattern as existing... (Customer, Stock, SO, PO)
  const handleBulkAddCustomer = async (items: any) => { const newItems = await customerService.createBulk(items); setCustomerMasterItems(prev => [...newItems, ...prev]); };
  const handleUpdateCustomer = async (item: CustomerMasterItem) => { await customerService.update(item); setCustomerMasterItems(prev => prev.map(i => i.id === item.id ? item : i)); };
  const handleDeleteCustomer = async (id: string) => { await customerService.delete(id); setCustomerMasterItems(prev => prev.filter(i => i.id !== id)); };

  const handleBulkAddStock = async (items: any) => { const newItems = await stockService.createBulk(items); setClosingStockItems(prev => [...newItems, ...prev]); };
  const handleUpdateStock = async (item: ClosingStockItem) => { await stockService.update(item); setClosingStockItems(prev => prev.map(i => i.id === item.id ? item : i)); };
  const handleDeleteStock = async (id: string) => { await stockService.delete(id); setClosingStockItems(prev => prev.filter(i => i.id !== id)); };

  const handleBulkAddSO = async (items: any) => { const newItems = await soService.createBulk(items); setPendingSOItems(prev => [...newItems, ...prev]); };
  const handleUpdateSO = async (item: PendingSOItem) => { await soService.update(item); setPendingSOItems(prev => prev.map(i => i.id === item.id ? item : i)); };
  const handleDeleteSO = async (id: string) => { await soService.delete(id); setPendingSOItems(prev => prev.filter(i => i.id !== id)); };

  const handleBulkAddPO = async (items: any) => { const newItems = await poService.createBulk(items); setPendingPOItems(prev => [...newItems, ...prev]); };
  const handleUpdatePO = async (item: PendingPOItem) => { await poService.update(item); setPendingPOItems(prev => prev.map(i => i.id === item.id ? item : i)); };
  const handleDeletePO = async (id: string) => { await poService.delete(id); setPendingPOItems(prev => prev.filter(i => i.id !== id)); };

  const makeStats = useMemo(() => {
    const counts: Record<string, number> = {};
    materials.forEach(m => { 
        const makeKey = (m.make?.trim() || 'Unspecified').toUpperCase();
        counts[makeKey] = (counts[makeKey] || 0) + 1; 
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [materials]);

  const filteredMaterials = useMemo(() => {
    if (selectedMake === 'ALL') return materials;
    return materials.filter(m => (m.make?.trim() || 'Unspecified').toUpperCase() === selectedMake);
  }, [materials, selectedMake]);

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
      <aside className={`bg-white border-r border-gray-200 flex flex-col flex-shrink-0 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-0 -ml-64 md:w-16 md:ml-0 overflow-hidden'}`}>
        <div className="h-14 flex items-center px-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg text-white flex-shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'} transition-opacity`}>
               <h1 className="text-sm font-bold text-gray-900 leading-tight">Siddhi Kabel Corp.</h1>
               <p className="text-[9px] text-gray-500 font-medium uppercase tracking-tighter">Inventory Intelligence</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar py-4 px-3 space-y-6">
           <div>
             {isSidebarOpen && <div className="px-3 mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Analysis</div>}
             <SidebarItem id="dashboard" label="Performance Dashboard" icon={LayoutDashboard} onClick={setActiveTab} />
             <SidebarItem id="pivotReport" label="Pivot Strategy Report" icon={Table} onClick={setActiveTab} />
             <SidebarItem id="chat" label="AI Analyst" icon={MessageSquare} onClick={setActiveTab} />
           </div>
           <div>
             {isSidebarOpen && <div className="px-3 mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Masters</div>}
             <div className="space-y-1">
                <SidebarItem id="master" label="Material Master" icon={Database} count={materials.length} onClick={setActiveTab} />
                <SidebarItem id="customerMaster" label="Customer Master" icon={Users} count={customerMasterItems.length} onClick={setActiveTab} />
             </div>
           </div>
           <div>
             {isSidebarOpen && <div className="px-3 mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Operations</div>}
             <div className="space-y-1">
                <SidebarItem id="closingStock" label="Closing Stock" icon={Package} count={closingStockItems.length} onClick={setActiveTab} />
                <SidebarItem id="pendingSO" label="Pending SO" icon={ClipboardList} count={pendingSOItems.length} onClick={setActiveTab} />
                <SidebarItem id="pendingPO" label="Pending PO" icon={ShoppingCart} count={pendingPOItems.length} onClick={setActiveTab} />
                <SidebarItem id="salesReport" label="Sales History" icon={FileBarChart} count={salesReportItems.length} onClick={setActiveTab} />
             </div>
           </div>
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
           {isSidebarOpen && (
              <div className="flex flex-col gap-2">
                 <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <div className={`w-1.5 h-1.5 rounded-full ${!isDbLoading ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-orange-500 animate-pulse'}`}></div>
                    {isDbLoading ? "Syncing Database..." : "Supabase Connected"}
                 </div>
              </div>
           )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <header className="bg-white border-b border-gray-200 h-14 flex items-center justify-between px-4 flex-shrink-0 md:hidden">
            <div className="flex items-center gap-2">
               <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                  {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
               </button>
               <span className="font-bold text-gray-900 text-sm">Siddhi Kabel</span>
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
            {activeTab === 'pivotReport' && (
                <PivotReportView
                  materials={materials}
                  closingStock={closingStockItems}
                  pendingSO={pendingSOItems}
                  pendingPO={pendingPOItems}
                  salesReportItems={salesReportItems}
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
            {activeTab === 'master' && (
              <div className="flex flex-col lg:flex-row gap-4 items-start h-full">
                <div className="w-full lg:w-56 flex-shrink-0 flex flex-col gap-3 h-full">
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center text-center flex-shrink-0">
                    <div className="bg-blue-50 p-2.5 rounded-full mb-2"><Database className="w-5 h-5 text-blue-600" /></div>
                    <p className="text-xs font-medium text-gray-500">Material Master</p>
                    <p className="text-2xl font-black text-gray-900 mt-0.5">{materials.length}</p>
                    <p className="text-[9px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full mt-1 border border-green-100">Synchronized</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col flex-1 overflow-hidden min-h-0">
                    <div className="p-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                      <h3 className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-2">Manufacturers</h3>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar p-1 space-y-0.5 flex-1">
                      <button onClick={() => setSelectedMake('ALL')} className={`w-full text-left px-3 py-1.5 rounded-md text-xs flex justify-between items-center transition-all ${selectedMake === 'ALL' ? 'bg-blue-600 text-white font-bold shadow-md' : 'text-gray-700 hover:bg-gray-100'}`}>
                        <span>All Makes</span>
                      </button>
                      {makeStats.map(([make, count]) => (
                          <button key={make} onClick={() => setSelectedMake(make)} className={`w-full text-left px-3 py-1.5 rounded-md text-xs flex justify-between items-center transition-all ${selectedMake === make ? 'bg-blue-600 text-white font-bold shadow-md' : 'text-gray-700 hover:bg-gray-100'}`}>
                            <span className="truncate w-3/4" title={make}>{make}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedMake === make ? 'bg-blue-500' : 'bg-gray-100'}`}>{count}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
                <div className="flex-1 w-full min-w-0 flex flex-col gap-3 h-full overflow-hidden">
                  <AddMaterialForm materials={materials} onBulkAdd={handleBulkAddMaterial} onClear={() => {}} />
                  <div className="flex-1 min-h-0">
                      <MaterialTable materials={filteredMaterials} onUpdate={handleUpdateMaterial} onDelete={handleDeleteMaterial} />
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'customerMaster' && <div className="h-full w-full"><CustomerMasterView items={customerMasterItems} onBulkAdd={handleBulkAddCustomer} onUpdate={handleUpdateCustomer} onDelete={handleDeleteCustomer} onClear={() => {}} /></div>}
            {activeTab === 'closingStock' && <div className="h-full w-full"><ClosingStockView items={closingStockItems} materials={materials} onBulkAdd={handleBulkAddStock} onUpdate={handleUpdateStock} onDelete={handleDeleteStock} onClear={() => {}} /></div>}
            {activeTab === 'pendingSO' && <div className="h-full w-full"><PendingSOView items={pendingSOItems} materials={materials} closingStockItems={closingStockItems} onBulkAdd={handleBulkAddSO} onUpdate={handleUpdateSO} onDelete={handleDeleteSO} onClear={() => {}} /></div>}
            {activeTab === 'pendingPO' && <div className="h-full w-full"><PendingPOView items={pendingPOItems} materials={materials} closingStockItems={closingStockItems} pendingSOItems={pendingSOItems} onBulkAdd={handleBulkAddPO} onUpdate={handleUpdatePO} onDelete={handleDeletePO} onClear={() => {}} /></div>}
            {activeTab === 'salesReport' && <div className="h-full w-full"><SalesReportView items={salesReportItems} materials={materials} customers={customerMasterItems} onBulkAdd={handleBulkAddSales} onUpdate={handleUpdateSales} onDelete={handleDeleteSales} onClear={handleClearSales} /></div>}
            {activeTab === 'salesHistory' && <div className="h-full overflow-y-auto custom-scrollbar pr-1 text-center py-20 text-gray-400">Sales History Legacy View - Use Sales Report for Database Tracking.</div>}
        </main>
      </div>
    </div>
  );
};

export default App;
