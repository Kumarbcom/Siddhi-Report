
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
import { Database, AlertCircle, ClipboardList, ShoppingCart, TrendingUp, Package, Layers, LayoutDashboard, FileBarChart, Users, ChevronRight, Menu, X, HardDrive, Table, MessageSquare, AlertTriangle, Factory } from 'lucide-react';
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
  
  const [materials, setMaterials] = useState<Material[]>([]);
  const [closingStockItems, setClosingStockItems] = useState<ClosingStockItem[]>([]);
  const [pendingSOItems, setPendingSOItems] = useState<PendingSOItem[]>([]);
  const [pendingPOItems, setPendingPOItems] = useState<PendingPOItem[]>([]);
  const [sales1Year, setSales1Year] = useState<SalesRecord[]>([]);
  const [sales3Months, setSales3Months] = useState<SalesRecord[]>([]);
  const [salesReportItems, setSalesReportItems] = useState<SalesReportItem[]>([]);
  const [customerMasterItems, setCustomerMasterItems] = useState<CustomerMasterItem[]>([]);
  
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isDbLoading, setIsDbLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<'connected' | 'partial' | 'error'>('connected');

  const [selectedMake, setSelectedMake] = useState<string | 'ALL'>('ALL');

  const loadAllData = async () => {
    try {
      setIsDbLoading(true);

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

      const storedS1Y = localStorage.getItem(STORAGE_KEY_SALES_1Y);
      if (storedS1Y) setSales1Year(JSON.parse(storedS1Y));
      const storedS3M = localStorage.getItem(STORAGE_KEY_SALES_3M);
      if (storedS3M) setSales3Months(JSON.parse(storedS3M));

      setDbStatus('connected');
    } catch (e) {
      console.error("Error loading data", e);
      setDbStatus('error');
    } finally {
      setIsDataLoaded(true);
      setIsDbLoading(false);
    }
  };

  useEffect(() => { loadAllData(); }, []);

  const handleBulkAddMaterial = async (dataList: MaterialFormData[]) => {
    const newItems = await materialService.createBulk(dataList);
    setMaterials(prev => [...newItems, ...prev]);
  };
  const handleUpdateMaterial = async (item: Material) => {
    await materialService.update(item);
    setMaterials(prev => prev.map(m => m.id === item.id ? item : m));
  };
  const handleDeleteMaterial = async (id: string) => {
    if (confirm("Delete material record?")) { 
      await materialService.delete(id); 
      setMaterials(prev => prev.filter(m => m.id !== id)); 
    }
  };
  const handleClearMaterials = async () => {
      if(confirm("DANGER: This will permanently delete ALL Material Master records from Supabase and local storage. Continue?")) {
          await materialService.clearAll();
          setMaterials([]);
      }
  };

  const handleBulkAddSales = async (items: any) => {
      const newItems = await salesService.createBulk(items);
      setSalesReportItems(prev => [...newItems, ...prev]);
  };
  const handleUpdateSales = async (item: SalesReportItem) => {
      await salesService.update(item);
      setSalesReportItems(prev => prev.map(i => i.id === item.id ? i : i));
  };
  const handleDeleteSales = async (id: string) => {
      if(confirm("Delete this transaction?")) {
        await salesService.delete(id);
        setSalesReportItems(prev => prev.filter(i => i.id !== id));
      }
  };
  const handleClearSales = async () => {
      if(confirm("DANGER: This will permanently delete ALL sales records from Supabase and Local storage. Continue?")) {
          await salesService.clearAll();
          setSalesReportItems([]);
      }
  };

  const handleBulkAddCustomer = async (items: any) => { 
    const newItems = await customerService.createBulk(items); 
    setCustomerMasterItems(prev => [...newItems, ...prev]); 
  };
  const handleUpdateCustomer = async (item: CustomerMasterItem) => {
    await customerService.update(item);
    setCustomerMasterItems(prev => prev.map(i => i.id === item.id ? item : i));
  };
  const handleDeleteCustomer = async (id: string) => {
    if (confirm("Delete customer record?")) {
      await customerService.delete(id);
      setCustomerMasterItems(prev => prev.filter(i => i.id !== id));
    }
  };
  const handleClearCustomers = async () => { 
    if(confirm("DANGER: This will permanently delete ALL Customer Master records from Supabase and local storage. Continue?")) { 
      await customerService.clearAll(); 
      setCustomerMasterItems([]); 
    } 
  };
  
  const handleBulkAddStock = async (items: any) => { 
    const newItems = await stockService.createBulk(items); 
    setClosingStockItems(prev => [...newItems, ...prev]); 
  };
  const handleUpdateStock = async (item: ClosingStockItem) => {
    await stockService.update(item);
    setClosingStockItems(prev => prev.map(i => i.id === item.id ? item : i));
  };
  const handleDeleteStock = async (id: string) => {
    if (confirm("Delete stock record?")) {
      await stockService.delete(id);
      setClosingStockItems(prev => prev.filter(i => i.id !== id));
    }
  };
  const handleClearStock = async () => { 
    if(confirm("DANGER: This will permanently delete ALL Closing Stock records from Supabase and local storage. Continue?")) { 
      await stockService.clearAll(); 
      setClosingStockItems([]); 
    } 
  };
  
  const handleBulkAddSO = async (items: any) => { 
    const newItems = await soService.createBulk(items); 
    setPendingSOItems(prev => [...newItems, ...prev]); 
  };
  const handleUpdateSO = async (item: PendingSOItem) => {
    await soService.update(item);
    setPendingSOItems(prev => prev.map(i => i.id === item.id ? item : i));
  };
  const handleDeleteSO = async (id: string) => {
    if (confirm("Delete pending sales order?")) {
      await soService.delete(id);
      setPendingSOItems(prev => prev.filter(i => i.id !== id));
    }
  };
  const handleClearSO = async () => { 
    if(confirm("DANGER: This will permanently delete ALL Pending SO records from Supabase and local storage. Continue?")) { 
      await stockService.clearAll(); 
      setPendingSOItems([]); 
    } 
  };
  
  const handleBulkAddPO = async (items: any) => { 
    const newItems = await poService.createBulk(items); 
    setPendingPOItems(prev => [...newItems, ...prev]); 
  };
  const handleUpdatePO = async (item: PendingPOItem) => {
    await poService.update(item);
    setPendingPOItems(prev => prev.map(i => i.id === item.id ? item : i));
  };
  const handleDeletePO = async (id: string) => {
    if (confirm("Delete pending purchase order?")) {
      await poService.delete(id);
      setPendingPOItems(prev => prev.filter(i => i.id !== id));
    }
  };
  const handleClearPO = async () => { 
    if(confirm("DANGER: This will permanently delete ALL Pending PO records from Supabase and local storage. Continue?")) { 
      await stockService.clearAll(); 
      setPendingPOItems([]); 
    } 
  };

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
            <div className="bg-blue-600 p-1.5 rounded-lg text-white flex-shrink-0"><Database className="w-4 h-4" /></div>
            <div className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'} transition-opacity`}>
               <h1 className="text-sm font-bold text-gray-900 leading-tight">Siddhi Kabel</h1>
               <p className="text-[9px] text-gray-500 font-medium">{dbStatus === 'connected' ? 'Supabase Linked' : 'Offline Mode'}</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar py-4 px-3 space-y-6">
           <div>
             {isSidebarOpen && <div className="px-3 mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Analysis</div>}
             <SidebarItem id="dashboard" label="Dashboard" icon={LayoutDashboard} onClick={setActiveTab} />
             <SidebarItem id="pivotReport" label="Strategy Report" icon={Table} onClick={setActiveTab} />
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
             {isSidebarOpen && <div className="px-3 mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reports</div>}
             <div className="space-y-1">
                <SidebarItem id="closingStock" label="Closing Stock" icon={Package} count={closingStockItems.length} onClick={setActiveTab} />
                <SidebarItem id="pendingSO" label="Pending SO" icon={ClipboardList} count={pendingSOItems.length} onClick={setActiveTab} />
                <SidebarItem id="pendingPO" label="Pending PO" icon={ShoppingCart} count={pendingPOItems.length} onClick={setActiveTab} />
                <SidebarItem id="salesReport" label="Sales Report" icon={FileBarChart} count={salesReportItems.length} onClick={setActiveTab} />
             </div>
           </div>
        </div>
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
           {isSidebarOpen && (
              <div className="flex flex-col gap-2">
                 <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <div className={`w-1.5 h-1.5 rounded-full ${!isDbLoading ? 'bg-green-500' : 'bg-orange-500 animate-pulse'}`}></div>
                    {isDbLoading ? "Syncing DB..." : "System Live"}
                 </div>
              </div>
           )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        {dbStatus === 'error' && (
            <div className="bg-orange-600 text-white px-4 py-2 flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> <span>Sync issue. Ensure table "material_master" exists in Supabase.</span></div>
                <button onClick={loadAllData} className="bg-white text-orange-600 px-2 py-0.5 rounded shadow-sm hover:bg-gray-100">Retry Link</button>
            </div>
        )}
        <header className="bg-white border-b border-gray-200 h-14 flex items-center justify-between px-4 flex-shrink-0 md:hidden">
            <div className="flex items-center gap-2">
               <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg">{isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
               <span className="font-bold text-gray-900">Siddhi Kabel</span>
            </div>
        </header>
        <main className="flex-1 overflow-hidden p-4 relative">
          {activeTab === 'dashboard' && (<DashboardView materials={materials} closingStock={closingStockItems} pendingSO={pendingSOItems} pendingPO={pendingPOItems} salesReportItems={salesReportItems} customers={customerMasterItems} sales1Year={sales1Year} sales3Months={sales3Months} setActiveTab={setActiveTab} />)}
          {activeTab === 'pivotReport' && (<PivotReportView materials={materials} closingStock={closingStockItems} pendingSO={pendingSOItems} pendingPO={pendingPOItems} salesReportItems={salesReportItems} />)}
          {activeTab === 'chat' && (<div className="h-full w-full max-w-4xl mx-auto"><ChatView materials={materials} closingStock={closingStockItems} pendingSO={pendingSOItems} pendingPO={pendingPOItems} salesReportItems={salesReportItems} customers={customerMasterItems} /></div>)}
          {activeTab === 'master' && (
            <div className="flex flex-col h-full gap-4">
              <div className="bg-white border-b border-gray-200 p-4 rounded-xl shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 flex-shrink-0">
                  <div className="flex items-center gap-3">
                      <div className="bg-blue-600 p-2 rounded-lg text-white"><Factory className="w-5 h-5" /></div>
                      <div>
                          <h2 className="text-sm font-black text-gray-800 uppercase tracking-tight">Material Master Repository</h2>
                          <p className="text-[10px] text-gray-500 font-medium">Central database for parts, items and industrial codes</p>
                      </div>
                  </div>
                  <div className="flex items-center gap-4 bg-gray-50 px-4 py-2 rounded-lg border border-gray-100">
                      <div className="flex flex-col items-center">
                          <span className="text-[9px] font-bold text-gray-400 uppercase">Total Items</span>
                          <span className="text-sm font-black text-gray-900">{materials.length}</span>
                      </div>
                      <div className="w-px h-6 bg-gray-200"></div>
                      <div className="flex flex-col items-center">
                          <span className="text-[9px] font-bold text-gray-400 uppercase">Unique Makes</span>
                          <span className="text-sm font-black text-blue-600">{makeStats.length}</span>
                      </div>
                  </div>
              </div>
              
              <div className="flex flex-col lg:flex-row gap-4 items-start flex-1 min-h-0 overflow-hidden">
                <div className="w-full lg:w-64 flex-shrink-0 flex flex-col gap-3 h-full overflow-hidden">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col flex-1 overflow-hidden min-h-0">
                    <div className="p-3 border-b border-gray-100 bg-gray-50 flex-shrink-0"><h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Filter by Manufacturer</h3></div>
                    <div className="overflow-y-auto custom-scrollbar p-1.5 space-y-1 flex-1">
                      <button onClick={() => setSelectedMake('ALL')} className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold flex justify-between items-center transition-all ${selectedMake === 'ALL' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>
                          All Brands
                          {selectedMake === 'ALL' && <ChevronRight className="w-3 h-3" />}
                      </button>
                      {makeStats.map(([make, count]) => (
                          <button key={make} onClick={() => setSelectedMake(make)} className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold flex justify-between items-center transition-all ${selectedMake === make ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>
                              <span className="truncate w-3/4">{make === 'UNSPECIFIED' ? 'Other Brands' : make}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${selectedMake === make ? 'bg-blue-500' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
                          </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex-1 w-full min-w-0 flex flex-col gap-3 h-full overflow-hidden">
                  <AddMaterialForm materials={materials} onBulkAdd={handleBulkAddMaterial} onClear={handleClearMaterials} />
                  <div className="flex-1 min-h-0"><MaterialTable materials={filteredMaterials} onUpdate={handleUpdateMaterial} onDelete={handleDeleteMaterial} /></div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'customerMaster' && <div className="h-full w-full"><CustomerMasterView items={customerMasterItems} onBulkAdd={handleBulkAddCustomer} onUpdate={handleUpdateCustomer} onDelete={handleDeleteCustomer} onClear={handleClearCustomers} /></div>}
          {activeTab === 'closingStock' && <div className="h-full w-full"><ClosingStockView items={closingStockItems} materials={materials} onBulkAdd={handleBulkAddStock} onUpdate={handleUpdateStock} onDelete={handleDeleteStock} onClear={handleClearStock} /></div>}
          {activeTab === 'pendingSO' && <div className="h-full w-full"><PendingSOView items={pendingSOItems} materials={materials} closingStockItems={closingStockItems} onBulkAdd={handleBulkAddSO} onUpdate={handleUpdateSO} onDelete={handleDeleteSO} onClear={handleClearSO} /></div>}
          {activeTab === 'pendingPO' && <div className="h-full w-full"><PendingPOView items={pendingPOItems} materials={materials} closingStockItems={closingStockItems} onBulkAdd={handleBulkAddPO} onUpdate={handleUpdatePO} onDelete={handleDeletePO} onClear={handleClearPO} /></div>}
          {activeTab === 'salesReport' && <div className="h-full w-full"><SalesReportView items={salesReportItems} materials={materials} customers={customerMasterItems} onBulkAdd={handleBulkAddSales} onUpdate={handleUpdateSales} onDelete={handleDeleteSales} onClear={handleClearSales} /></div>}
        </main>
      </div>
    </div>
  );
};

export default App;
