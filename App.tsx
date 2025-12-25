
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
import ConfirmationModal from './components/ConfirmationModal';
import { Database, AlertCircle, ClipboardList, ShoppingCart, TrendingUp, Package, Layers, LayoutDashboard, FileBarChart, Users, ChevronRight, Menu, X, HardDrive, Table, MessageSquare, AlertTriangle, Factory, CloudOff, Cloud, Trash2, Loader2 } from 'lucide-react';
import { materialService } from './services/materialService';
import { customerService } from './services/customerService';
import { stockService } from './services/stockService';
import { soService } from './services/soService';
import { poService } from './services/poService';
import { salesService } from './services/salesService';
import { isSupabaseConfigured } from './services/supabase';
import { dbService, STORES } from './services/db';

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
  const [dbStatus, setDbStatus] = useState<'connected' | 'partial' | 'error' | 'unlinked'>(
    isSupabaseConfigured ? 'connected' : 'unlinked'
  );
  const [isSyncing, setIsSyncing] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    onConfirmLabel?: string;
    onCancelLabel?: string;
    isDanger?: boolean;
    isLoading?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { }
  });

  const [selectedMake, setSelectedMake] = useState<string | 'ALL'>('ALL');

  const loadAllData = async () => {
    try {
      setIsDbLoading(true);

      // --- PHASE 1: Instant Local Load ---
      // This retrieves data from the browser's IndexedDB immediately.
      const [
        localMats,
        localCusts,
        localStock,
        localSO,
        localPO,
        localSales
      ] = await Promise.all([
        dbService.getAll<Material>(STORES.MATERIALS),
        dbService.getAll<CustomerMasterItem>(STORES.CUSTOMERS),
        dbService.getAll<ClosingStockItem>(STORES.STOCK),
        dbService.getAll<PendingSOItem>(STORES.SO),
        dbService.getAll<PendingPOItem>(STORES.PO),
        dbService.getAll<SalesReportItem>(STORES.SALES)
      ]);

      setMaterials(localMats);
      setCustomerMasterItems(localCusts);
      setClosingStockItems(localStock);
      setPendingSOItems(localSO);
      setPendingPOItems(localPO);
      setSalesReportItems(localSales);

      const storedS1Y = localStorage.getItem(STORAGE_KEY_SALES_1Y);
      if (storedS1Y) setSales1Year(JSON.parse(storedS1Y));
      const storedS3M = localStorage.getItem(STORAGE_KEY_SALES_3M);
      if (storedS3M) setSales3Months(JSON.parse(storedS3M));

      // App is visually ready now
      setIsDataLoaded(true);
      setIsDbLoading(false);

      // --- PHASE 2: Background Cloud Sync ---
      if (isSupabaseConfigured) {
        setDbStatus('connected');
        setIsSyncing(true);

        // We trigger all cloud fetches in parallel. 
        // We update the state individually as each one returns fresh data.
        const syncPromises = [
          materialService.getAll().then(m => setMaterials(m)).catch(e => console.warn("Sync Error (Materials):", e)),
          customerService.getAll().then(c => setCustomerMasterItems(c)).catch(e => console.warn("Sync Error (Customers):", e)),
          stockService.getAll().then(s => setClosingStockItems(s)).catch(e => console.warn("Sync Error (Stock):", e)),
          soService.getAll().then(s => setPendingSOItems(s)).catch(e => console.warn("Sync Error (SO):", e)),
          poService.getAll().then(p => setPendingPOItems(p)).catch(e => console.warn("Sync Error (PO):", e)),
          salesService.getAll().then(s => setSalesReportItems(s)).catch(e => console.warn("Sync Error (Sales):", e))
        ];

        Promise.all(syncPromises).finally(() => setIsSyncing(false));
      } else {
        setDbStatus('unlinked');
      }
    } catch (e) {
      console.error("Critical Load Error:", e);
      setDbStatus('error');
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
      try {
        await materialService.delete(id);
        setMaterials(prev => prev.filter(m => m.id !== id));
      } catch (e: any) {
        alert("Failed to delete from cloud: " + (e.message || "Unknown error"));
      }
    }
  };
  const handleClearMaterials = async () => {
    setConfirmModal({
      isOpen: true,
      title: "Clear All Materials?",
      message: "DANGER: This will permanently delete ALL Material Master records from Supabase and local storage. This action cannot be undone.",
      isDanger: true,
      isLoading: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          await materialService.clearAll();
          setMaterials([]);
          setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (e: any) {
          alert("Failed to clear cloud data: " + (e.message || "Unknown error"));
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  const handleBulkAddSales = async (items: any) => {
    const newItems = await salesService.createBulk(items);
    setSalesReportItems(prev => [...newItems, ...prev]);
  };
  const handleUpdateSales = async (item: SalesReportItem) => {
    await salesService.update(item);
    setSalesReportItems(prev => prev.map(i => i.id === item.id ? item : i));
  };
  const handleDeleteSales = async (id: string) => {
    if (confirm("Delete this transaction?")) {
      try {
        await salesService.delete(id);
        setSalesReportItems(prev => prev.filter(i => i.id !== id));
      } catch (e: any) {
        alert("Failed to delete from cloud: " + (e.message || "Unknown error"));
      }
    }
  };
  const handleClearSales = async () => {
    setConfirmModal({
      isOpen: true,
      title: "Clear Sales History?",
      message: "DANGER: This will permanently delete ALL sales records from Supabase and local storage. This action cannot be undone.",
      isDanger: true,
      isLoading: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          await salesService.clearAll();
          setSalesReportItems([]);
          setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (e: any) {
          alert("Failed to clear cloud data: " + (e.message || "Unknown error"));
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
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
      try {
        await customerService.delete(id);
        setCustomerMasterItems(prev => prev.filter(i => i.id !== id));
      } catch (e: any) {
        alert("Failed to delete from cloud: " + (e.message || "Unknown error"));
      }
    }
  };
  const handleClearCustomers = async () => {
    setConfirmModal({
      isOpen: true,
      title: "Clear All Customers?",
      message: "DANGER: This will permanently delete ALL Customer Master records from Supabase and local storage. This action cannot be undone.",
      isDanger: true,
      isLoading: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          await customerService.clearAll();
          setCustomerMasterItems([]);
          setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (e: any) {
          alert("Failed to clear cloud data: " + (e.message || "Unknown error"));
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  const handleBulkAddStock = async (items: any) => {
    setConfirmModal({
      isOpen: true,
      title: "Import Closing Stock",
      message: "How would you like to import this data? You can replace existing records or append to them.",
      isDanger: false,
      onConfirmLabel: "Replace All",
      onCancelLabel: "Append Only",
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          await stockService.clearAll();
          const newItems = await stockService.createBulk(items);
          setClosingStockItems(newItems);
          setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (e: any) {
          alert("Import failed: " + (e.message || "Unknown error"));
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      },
      onCancel: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          const newItems = await stockService.createBulk(items);
          setClosingStockItems(prev => [...newItems, ...prev]);
          setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (e: any) {
          alert("Import failed: " + (e.message || "Unknown error"));
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };
  const handleUpdateStock = async (item: ClosingStockItem) => {
    await stockService.update(item);
    setClosingStockItems(prev => prev.map(i => i.id === item.id ? item : i));
  };
  const handleDeleteStock = async (id: string) => {
    if (confirm("Delete stock record?")) {
      try {
        await stockService.delete(id);
        setClosingStockItems(prev => prev.filter(i => i.id !== id));
      } catch (e: any) {
        alert("Failed to delete from cloud: " + (e.message || "Unknown error"));
      }
    }
  };
  const handleClearStock = async () => {
    setConfirmModal({
      isOpen: true,
      title: "Clear Closing Stock?",
      message: "DANGER: This will permanently delete ALL Closing Stock records from Supabase and local storage. Continue?",
      isDanger: true,
      isLoading: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          await stockService.clearAll();
          setClosingStockItems([]);
          setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (e: any) {
          alert("Failed to clear data: " + (e.message || "Unknown error"));
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  const handleBulkAddSO = async (items: any) => {
    setConfirmModal({
      isOpen: true,
      title: "Import Pending SO",
      message: "How would you like to import this data? Replace existing records or append to them?",
      isDanger: false,
      onConfirmLabel: "Replace All",
      onCancelLabel: "Append Only",
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          await soService.clearAll();
          const newItems = await soService.createBulk(items);
          setPendingSOItems(newItems);
          setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (e: any) {
          alert("Import failed: " + (e.message || "Unknown error"));
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      },
      onCancel: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          const newItems = await soService.createBulk(items);
          setPendingSOItems(prev => [...newItems, ...prev]);
          setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (e: any) {
          alert("Import failed: " + (e.message || "Unknown error"));
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };
  const handleUpdateSO = async (item: PendingSOItem) => {
    await soService.update(item);
    setPendingSOItems(prev => prev.map(i => i.id === item.id ? item : i));
  };
  const handleDeleteSO = async (id: string) => {
    if (confirm("Delete pending sales order?")) {
      try {
        await soService.delete(id);
        setPendingSOItems(prev => prev.filter(i => i.id !== id));
      } catch (e: any) {
        alert("Failed to delete from cloud: " + (e.message || "Unknown error"));
      }
    }
  };
  const handleClearSO = async () => {
    setConfirmModal({
      isOpen: true,
      title: "Clear Pending SO?",
      message: "DANGER: This will permanently delete ALL Pending SO records from Supabase and local storage. Continue?",
      isDanger: true,
      isLoading: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          await soService.clearAll();
          setPendingSOItems([]);
          setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (e: any) {
          alert("Failed to clear data: " + (e.message || "Unknown error"));
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  const handleBulkAddPO = async (items: any) => {
    setConfirmModal({
      isOpen: true,
      title: "Import Pending PO",
      message: "How would you like to import this data? Replace existing records or append to them?",
      isDanger: false,
      onConfirmLabel: "Replace All",
      onCancelLabel: "Append Only",
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          await poService.clearAll();
          const newItems = await poService.createBulk(items);
          setPendingPOItems(newItems);
          setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (e: any) {
          alert("Import failed: " + (e.message || "Unknown error"));
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      },
      onCancel: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          const newItems = await poService.createBulk(items);
          setPendingPOItems(prev => [...newItems, ...prev]);
          setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (e: any) {
          alert("Import failed: " + (e.message || "Unknown error"));
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };
  const handleUpdatePO = async (item: PendingPOItem) => {
    await poService.update(item);
    setPendingPOItems(prev => prev.map(i => i.id === item.id ? item : i));
  };
  const handleDeletePO = async (id: string) => {
    if (confirm("Delete pending purchase order?")) {
      try {
        await poService.delete(id);
        setPendingPOItems(prev => prev.filter(i => i.id !== id));
      } catch (e: any) {
        alert("Failed to delete from cloud: " + (e.message || "Unknown error"));
      }
    }
  };
  const handleClearPO = async () => {
    setConfirmModal({
      isOpen: true,
      title: "Clear Pending PO?",
      message: "DANGER: This will permanently delete ALL Pending PO records from Supabase and local storage. Continue?",
      isDanger: true,
      isLoading: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          await poService.clearAll();
          setPendingPOItems([]);
          setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (e: any) {
          alert("Failed to clear data: " + (e.message || "Unknown error"));
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
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
      onClick={() => {
        onClick(id);
        if (window.innerWidth < 768) setIsSidebarOpen(false);
      }}
      className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors relative group ${activeTab === id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`}
      title={!isSidebarOpen ? label : ''}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${activeTab === id ? 'text-blue-600' : 'text-gray-400'}`} />
      <span className={`flex-1 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 md:hidden'}`}>{label}</span>
      {count !== undefined && isSidebarOpen && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
          {count > 1000 ? (count / 1000).toFixed(1) + 'k' : count}
        </span>
      )}
      {!isSidebarOpen && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity hidden md:block">
          {label} {count !== undefined && `(${count})`}
        </div>
      )}
    </button>
  );

  if (isDbLoading) {
    return (
      <div className="fixed inset-0 bg-white z-[200] flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-24 h-24 border-4 border-blue-50 rounded-full animate-spin border-t-blue-600"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Database className="w-8 h-8 text-blue-600 animate-pulse" />
          </div>
        </div>
        <h2 className="mt-8 text-2xl font-black text-gray-900 uppercase tracking-tighter">Siddhi Kabel</h2>
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-500 font-bold uppercase tracking-widest">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Verifying Local Engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-gray-900 overflow-hidden">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[100] md:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`bg-white border-r border-gray-200 flex flex-col flex-shrink-0 transition-all duration-300 fixed inset-y-0 left-0 z-[110] md:relative md:translate-x-0 ${isSidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full md:w-16 md:translate-x-0'}`}>
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="bg-blue-600 p-1.5 rounded-lg text-white flex-shrink-0"><Database className="w-4 h-4" /></div>
            <div className={`${isSidebarOpen ? 'opacity-100 block' : 'opacity-0 hidden'} transition-all duration-300 whitespace-nowrap`}>
              <h1 className="text-sm font-bold text-gray-900 leading-tight">Siddhi Kabel</h1>
              <p className="text-[9px] text-gray-500 font-medium"> Central Master </p>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors ${!isSidebarOpen && 'md:hidden'}`}
          >
            {isSidebarOpen ? <X className="w-4 h-4 md:hidden" /> : null}
            <Menu className={`w-4 h-4 ${isSidebarOpen ? 'hidden md:block' : 'hidden'}`} />
          </button>
        </div>
        {!isSidebarOpen && (
          <div className="hidden md:flex flex-col items-center py-4 border-b border-gray-100">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-blue-600 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className={`flex-1 ${isSidebarOpen ? 'overflow-y-auto' : 'overflow-y-visible'} custom-scrollbar py-4 px-3 space-y-6`}>
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
              <div className="flex items-center gap-2 text-[10px] font-bold">
                <div className={`w-2 h-2 rounded-full ${dbStatus === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-400'}`}></div>
                <span className={dbStatus === 'connected' ? 'text-green-700' : 'text-gray-500'}>
                  {dbStatus === 'connected' ? 'SUPABASE LINKED' : 'LOCAL ENGINE'}
                </span>
              </div>
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        {dbStatus === 'unlinked' && (
          <div className="bg-indigo-600 text-white px-4 py-2 flex items-center justify-between text-xs font-bold shadow-md z-20">
            <div className="flex items-center gap-2">
              <CloudOff className="w-4 h-4" />
              <span>Cloud Sync Inactive: Running in Local mode. Add valid SUPABASE Keys to connect.</span>
            </div>
          </div>
        )}
        {dbStatus === 'error' && (
          <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-between text-xs font-bold shadow-md z-20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>Sync Error: Connection to cloud failed. Reverting to local storage.</span>
            </div>
            <button onClick={loadAllData} className="bg-white text-red-600 px-3 py-1 rounded-md shadow-sm hover:bg-gray-100 transition-colors uppercase tracking-widest text-[10px]">Retry Cloud Link</button>
          </div>
        )}
        {dbStatus === 'connected' && (
          <div className={`bg-emerald-600 text-white px-4 py-1.5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest shadow-sm z-20 transition-all duration-500`}>
            <div className="flex items-center gap-2">
              <Cloud className="w-3.5 h-3.5" />
              <span>Secure Cloud Link Active</span>
            </div>
            {isSyncing && (
              <div className="flex items-center gap-2 bg-emerald-700 px-2 py-0.5 rounded border border-emerald-500 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Syncing Cloud Records...</span>
              </div>
            )}
          </div>
        )}

        <header className="bg-white border-b border-gray-200 h-14 flex items-center justify-between px-4 flex-shrink-0 md:hidden z-30">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-bold text-gray-900">Siddhi Kabel</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${dbStatus === 'connected' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            <span className="text-[10px] font-bold text-gray-500 uppercase">{dbStatus === 'connected' ? 'Cloud' : 'Local'}</span>
          </div>
        </header>
        <main className="flex-1 overflow-hidden p-4 relative">
          {activeTab === 'dashboard' && <DashboardView materials={materials} closingStock={closingStockItems} pendingSO={pendingSOItems} pendingPO={pendingPOItems} salesReportItems={salesReportItems} customers={customerMasterItems} sales1Year={sales1Year} sales3Months={sales3Months} setActiveTab={setActiveTab} />}
          {activeTab === 'pivotReport' && <PivotReportView materials={materials} closingStock={closingStockItems} pendingSO={pendingSOItems} pendingPO={pendingPOItems} salesReportItems={salesReportItems} />}
          {activeTab === 'chat' && (
            <div className="h-full w-full max-w-4xl mx-auto flex flex-col gap-4">
              <ChatView materials={materials} closingStock={closingStockItems} pendingSO={pendingSOItems} pendingPO={pendingPOItems} salesReportItems={salesReportItems} customers={customerMasterItems} />
            </div>
          )}
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
          {activeTab === 'pendingPO' && <div className="h-full w-full"><PendingPOView items={pendingPOItems} materials={materials} closingStockItems={closingStockItems} pendingSOItems={pendingSOItems} salesReportItems={salesReportItems} onBulkAdd={handleBulkAddPO} onUpdate={handleUpdatePO} onDelete={handleDeletePO} onClear={handleClearPO} /></div>}
          {activeTab === 'salesReport' && <div className="h-full w-full"><SalesReportView items={salesReportItems} materials={materials} customers={customerMasterItems} onBulkAdd={handleBulkAddSales} onUpdate={handleUpdateSales} onDelete={handleDeleteSales} onClear={handleClearSales} /></div>}
        </main>
      </div>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        isDanger={confirmModal.isDanger}
        isLoading={confirmModal.isLoading}
        confirmLabel={confirmModal.onConfirmLabel}
        cancelLabel={confirmModal.onCancelLabel}
        onConfirm={confirmModal.onConfirm}
        onCancel={confirmModal.onCancel || (() => setConfirmModal(prev => ({ ...prev, isOpen: false })))}
      />
    </div>
  );
};

export default App;
