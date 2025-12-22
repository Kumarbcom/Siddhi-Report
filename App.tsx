
import React, { useState, useEffect, useMemo } from 'react';
import { Material, MaterialFormData, PendingSOItem, PendingPOItem, SalesRecord, ClosingStockItem, SalesReportItem, CustomerMasterItem } from './types';
import MaterialTable from './components/MaterialTable';
import AddMaterialForm from './components/AddMaterialForm';
import PendingSOView from './components/PendingSOView';
import PendingPOView from './components/PendingPOView';
import ClosingStockView from './components/ClosingStockView';
import SalesReportView from './components/SalesReportView';
import CustomerMasterView from './components/CustomerMasterView';
import DashboardView from './components/DashboardView';
import PivotReportView from './components/PivotReportView';
import ChatView from './components/ChatView';
import { Database, ClipboardList, ShoppingCart, Package, LayoutDashboard, FileBarChart, Users, ChevronRight, Menu, X, Table, MessageSquare, AlertTriangle, Factory } from 'lucide-react';
import { materialService } from './services/materialService';
import { customerService } from './services/customerService';
import { stockService } from './services/stockService';
import { soService } from './services/soService';
import { poService } from './services/poService';
import { salesService } from './services/salesService';
import { isConfigured } from './services/supabase';

type ActiveTab = 'dashboard' | 'chat' | 'master' | 'customerMaster' | 'closingStock' | 'pendingSO' | 'pendingPO' | 'salesReport' | 'pivotReport';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [materials, setMaterials] = useState<Material[]>([]);
  const [closingStockItems, setClosingStockItems] = useState<ClosingStockItem[]>([]);
  const [pendingSOItems, setPendingSOItems] = useState<PendingSOItem[]>([]);
  const [pendingPOItems, setPendingPOItems] = useState<PendingPOItem[]>([]);
  const [salesReportItems, setSalesReportItems] = useState<SalesReportItem[]>([]);
  const [customerMasterItems, setCustomerMasterItems] = useState<CustomerMasterItem[]>([]);
  
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isDbLoading, setIsDbLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<'connected' | 'error'>(isConfigured ? 'connected' : 'error');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAllData = async () => {
    if (!isConfigured) {
        setIsDbLoading(false);
        setDbStatus('error');
        setErrorMessage("Supabase is not configured. Please check your credentials.");
        return;
    }

    try {
      setIsDbLoading(true);
      setErrorMessage(null);

      // Attempt to load data - if tables don't exist, this will throw
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

      setDbStatus('connected');
    } catch (e: any) {
      console.error("Cloud Synchronization Error:", e);
      setDbStatus('error');
      
      // Robust error extraction
      let msg = "";
      if (e instanceof Error) {
        msg = e.message;
      } else if (typeof e === 'object' && e !== null) {
        // Specifically check for PostgrestError properties
        msg = e.message || e.details || e.hint || e.code || JSON.stringify(e);
      } else {
        msg = String(e);
      }
      
      // Sanitization
      if (!msg || msg === '{}' || msg === '[object Object]') {
        msg = "Unknown Database Error. Check internet connection or project status.";
      }

      const lowerMsg = msg.toLowerCase();
      if (lowerMsg.includes("404") || lowerMsg.includes("not found") || lowerMsg.includes("relation") || lowerMsg.includes("does not exist")) {
        setErrorMessage("Database Tables Missing: Please execute the SQL setup script in your Supabase SQL Editor to initialize the database schema.");
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setIsDataLoaded(true);
      setIsDbLoading(false);
    }
  };

  useEffect(() => { loadAllData(); }, []);

  const handleBulkAddMaterial = async (dataList: MaterialFormData[]) => {
    try {
        const newItems = await materialService.createBulk(dataList);
        setMaterials(prev => [...newItems, ...prev]);
    } catch (e: any) { alert("Cloud Insert Failed: " + (e.message || "Unknown error")); }
  };
  const handleUpdateMaterial = async (item: Material) => {
    try {
        await materialService.update(item);
        setMaterials(prev => prev.map(m => m.id === item.id ? item : m));
    } catch (e: any) { alert("Cloud Update Failed: " + (e.message || "Unknown error")); }
  };
  const handleDeleteMaterial = async (id: string) => {
    if (confirm("Delete cloud record?")) { 
      try {
          await materialService.delete(id); 
          setMaterials(prev => prev.filter(m => m.id !== id)); 
      } catch (e: any) { alert("Cloud Delete Failed: " + (e.message || "Unknown error")); }
    }
  };
  const handleClearMaterials = async () => {
      if(confirm("DANGER: This will permanently delete ALL records from Supabase. Continue?")) {
          try {
              await materialService.clearAll();
              setMaterials([]);
          } catch (e: any) { alert("Clear Failed: " + (e.message || "Unknown error")); }
      }
  };

  const handleBulkAddSales = async (items: any) => { try { const newItems = await salesService.createBulk(items); setSalesReportItems(prev => [...newItems, ...prev]); } catch(e: any) { alert(e.message); } };
  const handleUpdateSales = async (item: SalesReportItem) => { try { await salesService.update(item); setSalesReportItems(prev => prev.map(i => i.id === item.id ? item : i)); } catch(e: any) { alert(e.message); } };
  const handleDeleteSales = async (id: string) => { if(confirm("Delete record from cloud?")) { try { await salesService.delete(id); setSalesReportItems(prev => prev.filter(i => i.id !== id)); } catch(e: any) { alert(e.message); } } };
  const handleClearSales = async () => { if(confirm("DANGER: Delete ALL cloud sales data?")) { try { await salesService.clearAll(); setSalesReportItems([]); } catch(e: any) { alert(e.message); } } };

  const handleBulkAddCustomer = async (items: any) => { try { const newItems = await customerService.createBulk(items); setCustomerMasterItems(prev => [...newItems, ...prev]); } catch(e: any) { alert(e.message); } };
  const handleUpdateCustomer = async (item: CustomerMasterItem) => { try { await customerService.update(item); setCustomerMasterItems(prev => prev.map(i => i.id === item.id ? item : i)); } catch(e: any) { alert(e.message); } };
  const handleDeleteCustomer = async (id: string) => { if (confirm("Delete customer?")) { try { await customerService.delete(id); setCustomerMasterItems(prev => prev.filter(i => i.id !== id)); } catch(e: any) { alert(e.message); } } };
  const handleClearCustomers = async () => { if(confirm("Clear cloud customers?")) { try { await customerService.clearAll(); setCustomerMasterItems([]); } catch(e: any) { alert(e.message); } } };
  
  const handleBulkAddStock = async (items: any) => { try { const newItems = await stockService.createBulk(items); setClosingStockItems(prev => [...newItems, ...prev]); } catch(e: any) { alert(e.message); } };
  const handleUpdateStock = async (item: ClosingStockItem) => { try { await stockService.update(item); setClosingStockItems(prev => prev.map(i => i.id === item.id ? item : i)); } catch(e: any) { alert(e.message); } };
  const handleDeleteStock = async (id: string) => { if (confirm("Delete stock?")) { try { await stockService.delete(id); setClosingStockItems(prev => prev.filter(i => i.id !== id)); } catch(e: any) { alert(e.message); } } };
  const handleClearStock = async () => { if(confirm("Clear cloud stock?")) { try { await stockService.clearAll(); setClosingStockItems([]); } catch(e: any) { alert(e.message); } } };
  
  const handleBulkAddSO = async (items: any) => { try { const newItems = await soService.createBulk(items); setPendingSOItems(prev => [...newItems, ...prev]); } catch(e: any) { alert(e.message); } };
  const handleUpdateSO = async (item: PendingSOItem) => { try { await soService.update(item); setPendingSOItems(prev => prev.map(i => i.id === item.id ? item : i)); } catch(e: any) { alert(e.message); } };
  const handleDeleteSO = async (id: string) => { if (confirm("Delete cloud SO?")) { try { await soService.delete(id); setPendingSOItems(prev => prev.filter(i => i.id !== id)); } catch(e: any) { alert(e.message); } } };
  const handleClearSO = async () => { if(confirm("Clear cloud SO records?")) { try { await soService.clearAll(); setPendingSOItems([]); } catch(e: any) { alert(e.message); } } };
  
  const handleBulkAddPO = async (items: any) => { try { const newItems = await poService.createBulk(items); setPendingPOItems(prev => [...newItems, ...prev]); } catch(e: any) { alert(e.message); } };
  const handleUpdatePO = async (item: PendingPOItem) => { try { await poService.update(item); setPendingPOItems(prev => prev.map(i => i.id === item.id ? item : i)); } catch(e: any) { alert(e.message); } };
  const handleDeletePO = async (id: string) => { if (confirm("Delete cloud PO?")) { try { await poService.delete(id); setPendingPOItems(prev => prev.filter(i => i.id !== id)); } catch(e: any) { alert(e.message); } } };
  const handleClearPO = async () => { if(confirm("Clear cloud PO records?")) { try { await poService.clearAll(); setPendingPOItems([]); } catch(e: any) { alert(e.message); } } };

  const [selectedMake, setSelectedMake] = useState<string | 'ALL'>('ALL');
  const makeStats = useMemo(() => {
    const counts: Record<string, number> = {};
    materials.forEach(m => { const k = (m.make?.trim() || 'Unspecified').toUpperCase(); counts[k] = (counts[k] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [materials]);

  const filteredMaterials = useMemo(() => {
    if (selectedMake === 'ALL') return materials;
    return materials.filter(m => (m.make?.trim() || 'Unspecified').toUpperCase() === selectedMake);
  }, [materials, selectedMake]);

  const SidebarItem = ({ id, label, icon: Icon, count, onClick }: any) => (
    <button onClick={() => onClick(id)} className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab === id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
      <Icon className={`w-4 h-4 ${activeTab === id ? 'text-blue-600' : 'text-gray-400'}`} />
      <span className="flex-1">{label}</span>
      {count !== undefined && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{count}</span>}
    </button>
  );

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-gray-900 overflow-hidden">
      <aside className={`bg-white border-r border-gray-200 flex flex-col flex-shrink-0 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-0 -ml-64 md:w-16 md:ml-0 overflow-hidden'}`}>
        <div className="h-14 flex items-center px-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg text-white flex-shrink-0"><Database className="w-4 h-4" /></div>
            {isSidebarOpen && <div><h1 className="text-sm font-bold">Siddhi Kabel</h1><p className="text-[9px] text-gray-500">{dbStatus === 'connected' ? 'Cloud Sync Active' : 'Cloud Error'}</p></div>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar py-4 px-3 space-y-6">
           <SidebarItem id="dashboard" label="Dashboard" icon={LayoutDashboard} onClick={setActiveTab} />
           <SidebarItem id="pivotReport" label="Strategy Report" icon={Table} onClick={setActiveTab} />
           <SidebarItem id="chat" label="AI Analyst" icon={MessageSquare} onClick={setActiveTab} />
           <div className="border-t border-gray-100 my-2 pt-2">
              <SidebarItem id="master" label="Material Master" icon={Database} count={materials.length} onClick={setActiveTab} />
              <SidebarItem id="customerMaster" label="Customer Master" icon={Users} count={customerMasterItems.length} onClick={setActiveTab} />
              <SidebarItem id="closingStock" label="Closing Stock" icon={Package} count={closingStockItems.length} onClick={setActiveTab} />
              <SidebarItem id="pendingSO" label="Pending SO" icon={ClipboardList} count={pendingSOItems.length} onClick={setActiveTab} />
              <SidebarItem id="pendingPO" label="Pending PO" icon={ShoppingCart} count={pendingPOItems.length} onClick={setActiveTab} />
              <SidebarItem id="salesReport" label="Sales Report" icon={FileBarChart} count={salesReportItems.length} onClick={setActiveTab} />
           </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        {dbStatus === 'error' && (
            <div className="bg-red-600 text-white px-4 py-2 flex flex-col gap-1 shadow-lg z-[200]">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xs"><AlertTriangle className="w-4 h-4" /> <span>Cloud Connection Error</span></div>
                    <button onClick={loadAllData} className="bg-white text-red-600 px-3 py-1 rounded text-[10px] font-black uppercase hover:bg-gray-100 transition-colors">Retry Sync</button>
                </div>
                {errorMessage && <p className="text-[10px] bg-red-700/50 p-1.5 rounded font-mono border border-red-500/30 break-words">{errorMessage}</p>}
            </div>
        )}
        <main className="flex-1 overflow-hidden p-4 relative">
          {activeTab === 'dashboard' && (<DashboardView materials={materials} closingStock={closingStockItems} pendingSO={pendingSOItems} pendingPO={pendingPOItems} salesReportItems={salesReportItems} customers={customerMasterItems} sales1Year={[]} sales3Months={[]} setActiveTab={setActiveTab} />)}
          {activeTab === 'pivotReport' && (<PivotReportView materials={materials} closingStock={closingStockItems} pendingSO={pendingSOItems} pendingPO={pendingPOItems} salesReportItems={salesReportItems} />)}
          {activeTab === 'chat' && (<div className="h-full w-full max-w-4xl mx-auto"><ChatView materials={materials} closingStock={closingStockItems} pendingSO={pendingSOItems} pendingPO={pendingPOItems} salesReportItems={salesReportItems} customers={customerMasterItems} /></div>)}
          {activeTab === 'master' && (
            <div className="flex flex-col h-full gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 flex-shrink-0">
                  <div className="flex items-center gap-3"><div className="bg-blue-600 p-2 rounded-lg text-white"><Factory className="w-5 h-5" /></div><div><h2 className="text-sm font-black uppercase tracking-tight">Material Master Repository</h2><p className="text-[10px] text-gray-500">Direct Supabase Cloud Access</p></div></div>
                  <div className="flex items-center gap-4 bg-gray-50 px-4 py-2 rounded-lg border border-gray-100">
                      <div className="flex flex-col items-center"><span className="text-[9px] font-bold text-gray-400 uppercase">Items</span><span className="text-sm font-black text-gray-900">{materials.length}</span></div>
                      <div className="w-px h-6 bg-gray-200"></div>
                      <div className="flex flex-col items-center"><span className="text-[9px] font-bold text-gray-400 uppercase">Makes</span><span className="text-sm font-black text-blue-600">{makeStats.length}</span></div>
                  </div>
              </div>
              <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
                <div className="w-full lg:w-64 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden h-full">
                    <div className="p-3 border-b border-gray-100 bg-gray-50 font-black text-[10px] text-gray-500 uppercase tracking-widest">Brand Filter</div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        <button onClick={() => setSelectedMake('ALL')} className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold flex justify-between items-center transition-all ${selectedMake === 'ALL' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>All Brands {selectedMake === 'ALL' && <ChevronRight className="w-3 h-3" />}</button>
                        {makeStats.map(([make, count]) => (<button key={make} onClick={() => setSelectedMake(make)} className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold flex justify-between items-center transition-all ${selectedMake === make ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}><span className="truncate w-3/4">{make}</span><span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${selectedMake === make ? 'bg-blue-500' : 'bg-gray-100 text-gray-500'}`}>{count}</span></button>))}
                    </div>
                </div>
                <div className="flex-1 flex flex-col gap-3 min-h-0">
                  <AddMaterialForm materials={materials} onBulkAdd={handleBulkAddMaterial} onClear={handleClearMaterials} />
                  <div className="flex-1 min-h-0"><MaterialTable materials={filteredMaterials} onUpdate={handleUpdateMaterial} onDelete={handleDeleteMaterial} /></div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'customerMaster' && <CustomerMasterView items={customerMasterItems} onBulkAdd={handleBulkAddCustomer} onUpdate={handleUpdateCustomer} onDelete={handleDeleteCustomer} onClear={handleClearCustomers} />}
          {activeTab === 'closingStock' && <ClosingStockView items={closingStockItems} materials={materials} onBulkAdd={handleBulkAddStock} onUpdate={handleUpdateStock} onDelete={handleDeleteStock} onClear={handleClearStock} />}
          {activeTab === 'pendingSO' && <PendingSOView items={pendingSOItems} materials={materials} closingStockItems={closingStockItems} onBulkAdd={handleBulkAddSO} onUpdate={handleUpdateSO} onDelete={handleDeleteSO} onClear={handleClearSO} />}
          {activeTab === 'pendingPO' && <PendingPOView items={pendingPOItems} materials={materials} closingStockItems={closingStockItems} pendingSOItems={pendingSOItems} salesReportItems={salesReportItems} onBulkAdd={handleBulkAddPO} onUpdate={handleUpdatePO} onDelete={handleDeletePO} onClear={handleClearPO} />}
          {activeTab === 'salesReport' && <SalesReportView items={salesReportItems} materials={materials} customers={customerMasterItems} onBulkAdd={handleBulkAddSales} onUpdate={handleUpdateSales} onDelete={handleDeleteSales} onClear={handleClearSales} />}
        </main>
      </div>
    </div>
  );
};

export default App;
