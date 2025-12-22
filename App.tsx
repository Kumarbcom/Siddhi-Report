
import React, { useState, useEffect, useMemo } from 'react';
import { Material, MaterialFormData, PendingSOItem, PendingPOItem, ClosingStockItem, SalesReportItem, CustomerMasterItem } from './types';
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
import { Database, ClipboardList, ShoppingCart, Package, LayoutDashboard, FileBarChart, Users, AlertTriangle, Factory, Table, MessageSquare } from 'lucide-react';
import { materialService } from './services/materialService';
import { customerService } from './services/customerService';
import { stockService } from './services/stockService';
import { soService } from './services/soService';
import { poService } from './services/poService';
import { salesService } from './services/salesService';
import { isConfigured } from './services/supabase';

type ActiveTab = 'dashboard' | 'chat' | 'master' | 'customerMaster' | 'closingStock' | 'pendingSO' | 'pendingPO' | 'salesReport' | 'pivotReport';

const SidebarItem = ({ id, label, icon: Icon, count, activeTab, onClick }: any) => (
  <button 
    onClick={() => onClick(id)} 
    className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab === id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
  >
    <Icon className={`w-4 h-4 ${activeTab === id ? 'text-blue-600' : 'text-gray-400'}`} />
    <span className="flex-1">{label}</span>
    {count !== undefined && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{count}</span>}
  </button>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isSidebarOpen] = useState(true);
  
  const [materials, setMaterials] = useState<Material[]>([]);
  const [closingStockItems, setClosingStockItems] = useState<ClosingStockItem[]>([]);
  const [pendingSOItems, setPendingSOItems] = useState<PendingSOItem[]>([]);
  const [pendingPOItems, setPendingPOItems] = useState<PendingPOItem[]>([]);
  const [salesReportItems, setSalesReportItems] = useState<SalesReportItem[]>([]);
  const [customerMasterItems, setCustomerMasterItems] = useState<CustomerMasterItem[]>([]);
  
  const [isDbLoading, setIsDbLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<'connected' | 'error'>(isConfigured ? 'connected' : 'error');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAllData = async () => {
    if (!isConfigured) {
        setIsDbLoading(false);
        setDbStatus('error');
        setErrorMessage("Supabase is not configured.");
        return;
    }

    try {
      setIsDbLoading(true);
      setErrorMessage(null);

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
      console.error("Sync Error:", e);
      setDbStatus('error');
      const msg = e.message || String(e);
      if (msg.includes("not found") || msg.includes("relation") || msg.includes("does not exist")) {
        setErrorMessage("Database Schema Missing: Initialize tables via SQL Editor.");
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setIsDbLoading(false);
    }
  };

  useEffect(() => { loadAllData(); }, []);

  const handleBulkAddMaterial = async (data: MaterialFormData[]) => {
    try { const items = await materialService.createBulk(data); setMaterials(p => [...items, ...p]); } catch(e: any) { alert(e.message); }
  };
  const handleUpdateMaterial = async (item: Material) => {
    try { await materialService.update(item); setMaterials(p => p.map(m => m.id === item.id ? item : m)); } catch(e: any) { alert(e.message); }
  };
  const handleDeleteMaterial = async (id: string) => {
    if (confirm("Delete?")) { try { await materialService.delete(id); setMaterials(p => p.filter(m => m.id !== id)); } catch(e: any) { alert(e.message); } }
  };
  const handleClearMaterials = async () => {
    if(confirm("DANGER: Clear ALL?")) { try { await materialService.clearAll(); setMaterials([]); } catch(e: any) { alert(e.message); } }
  };

  const handleBulkAddSales = async (items: any) => { try { const res = await salesService.createBulk(items); setSalesReportItems(p => [...res, ...p]); } catch(e: any) { alert(e.message); } };
  const handleUpdateSales = async (item: SalesReportItem) => { try { await salesService.update(item); setSalesReportItems(p => p.map(i => i.id === item.id ? item : i)); } catch(e: any) { alert(e.message); } };
  const handleDeleteSales = async (id: string) => { if(confirm("Delete?")) { try { await salesService.delete(id); setSalesReportItems(p => p.filter(i => i.id !== id)); } catch(e: any) { alert(e.message); } } };
  const handleClearSales = async () => { if(confirm("DANGER?")) { try { await salesService.clearAll(); setSalesReportItems([]); } catch(e: any) { alert(e.message); } } };

  const handleBulkAddCustomer = async (items: any) => { try { const res = await customerService.createBulk(items); setCustomerMasterItems(p => [...res, ...p]); } catch(e: any) { alert(e.message); } };
  const handleUpdateCustomer = async (item: CustomerMasterItem) => { try { await customerService.update(item); setCustomerMasterItems(p => p.map(i => i.id === item.id ? item : i)); } catch(e: any) { alert(e.message); } };
  const handleDeleteCustomer = async (id: string) => { if (confirm("Delete?")) { try { await customerService.delete(id); setCustomerMasterItems(p => p.filter(i => i.id !== id)); } catch(e: any) { alert(e.message); } } };
  const handleClearCustomers = async () => { if(confirm("Clear?")) { try { await customerService.clearAll(); setCustomerMasterItems([]); } catch(e: any) { alert(e.message); } } };
  
  const handleBulkAddStock = async (items: any) => { try { const res = await stockService.createBulk(items); setClosingStockItems(p => [...res, ...p]); } catch(e: any) { alert(e.message); } };
  const handleUpdateStock = async (item: ClosingStockItem) => { try { await stockService.update(item); setClosingStockItems(p => p.map(i => i.id === item.id ? item : i)); } catch(e: any) { alert(e.message); } };
  const handleDeleteStock = async (id: string) => { if (confirm("Delete?")) { try { await stockService.delete(id); setClosingStockItems(p => p.filter(i => i.id !== id)); } catch(e: any) { alert(e.message); } } };
  const handleClearStock = async () => { if(confirm("Clear?")) { try { await stockService.clearAll(); setClosingStockItems([]); } catch(e: any) { alert(e.message); } } };
  
  const handleBulkAddSO = async (items: any) => { try { const res = await soService.createBulk(items); setPendingSOItems(p => [...res, ...p]); } catch(e: any) { alert(e.message); } };
  const handleUpdateSO = async (item: PendingSOItem) => { try { await soService.update(item); setPendingSOItems(p => p.map(i => i.id === item.id ? item : i)); } catch(e: any) { alert(e.message); } };
  const handleDeleteSO = async (id: string) => { if (confirm("Delete?")) { try { await soService.delete(id); setPendingSOItems(p => p.filter(i => i.id !== id)); } catch(e: any) { alert(e.message); } } };
  const handleClearSO = async () => { if(confirm("Clear?")) { try { await soService.clearAll(); setPendingSOItems([]); } catch(e: any) { alert(e.message); } } };
  
  const handleBulkAddPO = async (items: any) => { try { const res = await poService.createBulk(items); setPendingPOItems(p => [...res, ...p]); } catch(e: any) { alert(e.message); } };
  const handleUpdatePO = async (item: PendingPOItem) => { try { await poService.update(item); setPendingPOItems(p => p.map(i => i.id === item.id ? item : i)); } catch(e: any) { alert(e.message); } };
  const handleDeletePO = async (id: string) => { if (confirm("Delete?")) { try { await poService.delete(id); setPendingPOItems(p => p.filter(i => i.id !== id)); } catch(e: any) { alert(e.message); } } };
  const handleClearPO = async () => { if(confirm("Clear?")) { try { await poService.clearAll(); setPendingPOItems([]); } catch(e: any) { alert(e.message); } } };

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-gray-900 overflow-hidden">
      <aside className={`bg-white border-r border-gray-200 flex flex-col flex-shrink-0 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-16'}`}>
        <div className="h-14 flex items-center px-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg text-white"><Database className="w-4 h-4" /></div>
            {isSidebarOpen && <h1 className="text-sm font-bold truncate">Siddhi Kabel</h1>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
           <SidebarItem id="dashboard" label="Dashboard" icon={LayoutDashboard} activeTab={activeTab} onClick={setActiveTab} />
           <SidebarItem id="pivotReport" label="Strategy Report" icon={Table} activeTab={activeTab} onClick={setActiveTab} />
           <SidebarItem id="chat" label="AI Analyst" icon={MessageSquare} activeTab={activeTab} onClick={setActiveTab} />
           <div className="border-t border-gray-100 my-2 pt-2">
              <SidebarItem id="master" label="Material Master" icon={Database} count={materials.length} activeTab={activeTab} onClick={setActiveTab} />
              <SidebarItem id="customerMaster" label="Customer Master" icon={Users} count={customerMasterItems.length} activeTab={activeTab} onClick={setActiveTab} />
              <SidebarItem id="closingStock" label="Closing Stock" icon={Package} count={closingStockItems.length} activeTab={activeTab} onClick={setActiveTab} />
              <SidebarItem id="pendingSO" label="Pending SO" icon={ClipboardList} count={pendingSOItems.length} activeTab={activeTab} onClick={setActiveTab} />
              <SidebarItem id="pendingPO" label="Pending PO" icon={ShoppingCart} count={pendingPOItems.length} activeTab={activeTab} onClick={setActiveTab} />
              <SidebarItem id="salesReport" label="Sales Report" icon={FileBarChart} count={salesReportItems.length} activeTab={activeTab} onClick={setActiveTab} />
           </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        {dbStatus === 'error' && (
            <div className="bg-red-600 text-white px-4 py-2 flex flex-col gap-1 shadow-lg z-[200]">
                <div className="flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Cloud Connection Error</div>
                    <button onClick={loadAllData} className="bg-white text-red-600 px-3 py-1 rounded text-[10px] font-black uppercase">Retry</button>
                </div>
                {errorMessage && <p className="text-[10px] font-mono opacity-90">{errorMessage}</p>}
            </div>
        )}
        <main className="flex-1 overflow-hidden p-4 relative">
          {activeTab === 'dashboard' && (<DashboardView materials={materials} closingStock={closingStockItems} pendingSO={pendingSOItems} pendingPO={pendingPOItems} salesReportItems={salesReportItems} customers={customerMasterItems} sales1Year={[]} sales3Months={[]} setActiveTab={setActiveTab} />)}
          {activeTab === 'pivotReport' && (<PivotReportView materials={materials} closingStock={closingStockItems} pendingSO={pendingSOItems} pendingPO={pendingPOItems} salesReportItems={salesReportItems} />)}
          {activeTab === 'chat' && (<ChatView materials={materials} closingStock={closingStockItems} pendingSO={pendingSOItems} pendingPO={pendingPOItems} salesReportItems={salesReportItems} customers={customerMasterItems} />)}
          {activeTab === 'master' && (
            <div className="flex flex-col h-full gap-4">
              <AddMaterialForm materials={materials} onBulkAdd={handleBulkAddMaterial} onClear={handleClearMaterials} />
              <MaterialTable materials={materials} onUpdate={handleUpdateMaterial} onDelete={handleDeleteMaterial} />
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
