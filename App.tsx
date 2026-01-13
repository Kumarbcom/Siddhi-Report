
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
import MOMView from './components/MOMView';
import AttendeeMasterView from './components/AttendeeMasterView';
import ChatView from './components/ChatView';
import UserManagementView from './components/UserManagementView';
import ConfirmationModal from './components/ConfirmationModal';
import { Database, AlertCircle, ClipboardList, ShoppingCart, TrendingUp, Package, Layers, LayoutDashboard, FileBarChart, Users, ChevronRight, Menu, X, HardDrive, Table, MessageSquare, AlertTriangle, Factory, CloudOff, Cloud, Trash2, Loader2, UserCircle, LogOut, ShieldCheck, Lock } from 'lucide-react';
import { authService, User } from './services/authService';
import { LoginView } from './components/LoginView';
import { PasswordChangeModal } from './components/PasswordChangeModal';
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

const getMergedMakeName = (makeName: string) => {
  const m = String(makeName || 'Unspecified').trim();
  const lowerM = m.toLowerCase();
  if (lowerM.includes('lapp')) return 'LAPP';
  if (lowerM.includes('luker')) return 'Luker';
  return m;
};

type ActiveTab = 'dashboard' | 'chat' | 'master' | 'customerMaster' | 'closingStock' | 'pendingSO' | 'pendingPO' | 'salesHistory' | 'salesReport' | 'pivotReport' | 'mom' | 'attendees' | 'userManagement';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(authService.getCurrentUser());
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const isAdmin = currentUser?.role === 'admin';

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

      setIsDataLoaded(true);
      setIsDbLoading(false);

      if (isSupabaseConfigured) {
        setDbStatus('connected');
        setIsSyncing(true);
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
  const handleAddMaterial = async (data: MaterialFormData) => {
    const newItem = await materialService.create(data);
    setMaterials(prev => [newItem, ...prev]);
  };
  const handleUpdateMaterial = async (item: Material) => {
    await materialService.update(item);
    setMaterials(prev => prev.map(m => m.id === item.id ? item : m));
  };
  const handleDeleteMaterial = async (id: string) => {
    if (!isAdmin) return;
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
    if (!isAdmin) return;
    setConfirmModal({
      isOpen: true,
      title: "Clear All Materials?",
      message: "DANGER: This will permanently delete ALL Material Master records. This action cannot be undone.",
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
    if (!isAdmin) return;
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
    if (!isAdmin) return;
    setConfirmModal({
      isOpen: true,
      title: "Clear Sales History?",
      message: "DANGER: This will permanently delete ALL sales records. This action cannot be undone.",
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

  const handleBulkAddCustomer = async (dataList: Omit<CustomerMasterItem, 'id' | 'createdAt'>[]) => {
    const newItems = await customerService.createBulk(dataList);
    setCustomerMasterItems(prev => [...newItems, ...prev]);
  };
  const handleAddCustomer = async (data: Omit<CustomerMasterItem, 'id' | 'createdAt'>) => {
    const newItem = await customerService.create(data);
    setCustomerMasterItems(prev => [newItem, ...prev]);
  };
  const handleUpdateCustomer = async (item: CustomerMasterItem) => {
    await customerService.update(item);
    setCustomerMasterItems(prev => prev.map(i => i.id === item.id ? item : i));
  };
  const handleDeleteCustomer = async (id: string) => {
    if (!isAdmin) return;
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
    if (!isAdmin) return;
    setConfirmModal({
      isOpen: true,
      title: "Clear All Customers?",
      message: "DANGER: This will permanently delete ALL Customer Master records. Continue?",
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
    if (!isAdmin) return;
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
    if (!isAdmin) return;
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
    if (!isAdmin) return;
    setConfirmModal({
      isOpen: true,
      title: "Clear Closing Stock?",
      message: "DANGER: This will permanently delete ALL Closing Stock records. Continue?",
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
    if (!isAdmin) return;
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
    if (!isAdmin) return;
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
    if (!isAdmin) return;
    setConfirmModal({
      isOpen: true,
      title: "Clear Pending SO?",
      message: "DANGER: This will permanently delete ALL Pending SO records. Continue?",
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
    if (!isAdmin) return;
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
    if (!isAdmin) return;
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
    if (!isAdmin) return;
    setConfirmModal({
      isOpen: true,
      title: "Clear Pending PO?",
      message: "DANGER: This will permanently delete ALL Pending PO records. Continue?",
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
      const makeKey = getMergedMakeName(m.make || 'Unspecified').toUpperCase();
      counts[makeKey] = (counts[makeKey] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [materials]);

  const filteredMaterials = useMemo(() => {
    if (selectedMake === 'ALL') return materials;
    return materials.filter(m => getMergedMakeName(m.make || 'Unspecified').toUpperCase() === selectedMake);
  }, [materials, selectedMake]);

  const SidebarItem = ({ id, label, icon: Icon, count, onClick }: any) => (
    <button
      onClick={() => {
        onClick(id);
        if (window.innerWidth < 768) setIsSidebarOpen(false);
      }}
      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all relative group ${activeTab === id ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
      title={!isSidebarOpen ? label : ''}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${activeTab === id ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}`} />
      <span className={`flex-1 truncate transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 md:hidden'}`}>{label}</span>
      {count !== undefined && isSidebarOpen && (
        <span className={`text-[9px] px-1.5 py-0.5 rounded-lg font-black ${activeTab === id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
          {count > 1000 ? (count / 1000).toFixed(1) + 'k' : count}
        </span>
      )}
    </button>
  );

  if (isDbLoading) {
    return (
      <div className="fixed inset-0 bg-white z-[200] flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-24 h-24 border-4 border-blue-50 rounded-full animate-spin border-t-blue-600"></div>
          <div className="absolute inset-0 flex items-center justify-center"><Database className="w-8 h-8 text-blue-600 animate-pulse" /></div>
        </div>
        <h2 className="mt-8 text-2xl font-black text-gray-900 uppercase tracking-tighter">Siddhi Kabel</h2>
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-500 font-bold uppercase tracking-widest"><Loader2 className="w-4 h-4 animate-spin" /><span>Verifying Systems...</span></div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView onLogin={setCurrentUser} />;
  }

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className={`print:hidden fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2.5 rounded-2xl shadow-lg shadow-blue-200"><ShieldCheck className="w-5 h-5 text-white" /></div>
              <div><h1 className="text-sm font-black text-gray-900 tracking-tight uppercase leading-none mb-1">Siddhi Kabel</h1><span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Enterprise Hub</span></div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
          </div>

          <div className="px-4 py-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-black shadow-sm">{currentUser.username.charAt(0)}</div>
              <div className="flex-1 min-w-0"><p className="text-xs font-black text-gray-800 truncate">{currentUser.username}</p><p className="text-[9px] font-bold text-blue-600 uppercase tracking-tighter">{currentUser.role === 'admin' ? '🔥 System Admin' : '👤 Viewer Access'}</p></div>
              <div className="flex flex-col gap-1">
                <button onClick={() => { authService.logout(); setCurrentUser(null); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Sign Out"><LogOut className="w-4 h-4" /></button>
                <button onClick={() => setShowPasswordChange(true)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all" title="Change Password"><Lock className="w-4 h-4" /></button>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-6 custom-scrollbar">
            <div>
              <div className="px-3 mb-3 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Management</div>
              <div className="space-y-1">
                <SidebarItem id="dashboard" label="Dashboard" icon={LayoutDashboard} onClick={setActiveTab} />
                <SidebarItem id="pivotReport" label="Strategy Report" icon={Table} onClick={setActiveTab} />
                <SidebarItem id="chat" label="AI Analyst" icon={MessageSquare} onClick={setActiveTab} />
              </div>
            </div>
            <div>
              <div className="px-3 mb-3 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Masters</div>
              <div className="space-y-1">
                <SidebarItem id="master" label="Material Master" icon={Database} count={materials.length} onClick={setActiveTab} />
                <SidebarItem id="customerMaster" label="Customer Master" icon={Users} count={customerMasterItems.length} onClick={setActiveTab} />
              </div>
            </div>
            <div>
              <div className="px-3 mb-3 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Analytics</div>
              <div className="space-y-1">
                <SidebarItem id="closingStock" label="Closing Stock" icon={Package} count={closingStockItems.length} onClick={setActiveTab} />
                <SidebarItem id="pendingSO" label="Pending SO" icon={ClipboardList} count={pendingSOItems.length} onClick={setActiveTab} />
                <SidebarItem id="pendingPO" label="Pending PO" icon={ShoppingCart} count={pendingPOItems.length} onClick={setActiveTab} />
                <SidebarItem id="salesReport" label="Sales Report" icon={FileBarChart} count={salesReportItems.length} onClick={setActiveTab} />
                <SidebarItem id="mom" label="Weekly MOM" icon={ClipboardList} onClick={setActiveTab} />
                <SidebarItem id="attendees" label="Attendee Master" icon={UserCircle} onClick={setActiveTab} />
              </div>
            </div>
            <div>
              <div className="px-3 mb-3 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Security</div>
              <div className="space-y-1">
                {isAdmin && <SidebarItem id="userManagement" label="User Management" icon={ShieldCheck} onClick={setActiveTab} />}
                <button
                  onClick={() => setShowPasswordChange(true)}
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-gray-500 hover:bg-gray-50 hover:text-gray-900 group"
                >
                  <Lock className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                  <span>Change Password</span>
                </button>
              </div>
            </div>
          </nav>

          <div className="p-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
            <div className="flex items-center gap-2 text-[10px] font-bold">
              <div className={`w-2 h-2 rounded-full ${dbStatus === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-400'}`}></div>
              <span className={dbStatus === 'connected' ? 'text-green-700' : 'text-gray-500'}>{dbStatus === 'connected' ? 'CLOUD LINKED' : 'LOCAL ENGINE'}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-gray-200 h-14 flex items-center justify-between px-4 sticky top-0 z-30">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-gray-600"><Menu className="w-6 h-6" /></button>
          <span className="font-black text-sm tracking-tight">SIDDHI KABEL</span>
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">{currentUser.username.charAt(0)}</div>
        </header>

        <main className="flex-1 overflow-hidden p-4 relative bg-gray-50/30">
          <div key={activeTab} className="h-full w-full">
            {activeTab === 'dashboard' && <DashboardView isAdmin={isAdmin} materials={materials} closingStock={closingStockItems} pendingSO={pendingSOItems} pendingPO={pendingPOItems} salesReportItems={salesReportItems} customers={customerMasterItems} sales1Year={sales1Year} sales3Months={sales3Months} setActiveTab={setActiveTab} />}
            {activeTab === 'pivotReport' && <PivotReportView isAdmin={isAdmin} materials={materials} closingStock={closingStockItems} pendingSO={pendingSOItems} pendingPO={pendingPOItems} salesReportItems={salesReportItems} />}
            {activeTab === 'chat' && <div className="h-full w-full max-w-4xl mx-auto flex flex-col gap-4"><ChatView isAdmin={isAdmin} materials={materials} closingStock={closingStockItems} pendingSO={pendingSOItems} pendingPO={pendingPOItems} salesReportItems={salesReportItems} customers={customerMasterItems} /></div>}
            {activeTab === 'master' && (
              <div className="flex flex-col h-full gap-4">
                <div className="bg-white border border-gray-100 p-4 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-100"><Factory className="w-5 h-5" /></div>
                    <div><h2 className="text-sm font-black text-gray-800 uppercase tracking-tight">Material Repository</h2><p className="text-[10px] text-gray-500 font-medium">Internal database for LAPP & Luker brands</p></div>
                  </div>
                </div>
                <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
                  {isAdmin && (
                    <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-4">
                      <AddMaterialForm materials={materials} onBulkAdd={handleBulkAddMaterial} onClear={handleClearMaterials} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                    <MaterialTable isAdmin={isAdmin} materials={materials} onUpdate={handleUpdateMaterial} onDelete={handleDeleteMaterial} />
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'customerMaster' && <div className="h-full w-full"><CustomerMasterView isAdmin={isAdmin} items={customerMasterItems} onBulkAdd={handleBulkAddCustomer} onUpdate={handleUpdateCustomer} onDelete={handleDeleteCustomer} onClear={handleClearCustomers} /></div>}
            {activeTab === 'closingStock' && <div className="h-full w-full"><ClosingStockView isAdmin={isAdmin} items={closingStockItems} materials={materials} onBulkAdd={handleBulkAddStock} onUpdate={handleUpdateStock} onDelete={handleDeleteStock} onClear={handleClearStock} /></div>}
            {activeTab === 'pendingSO' && <div className="h-full w-full"><PendingSOView isAdmin={isAdmin} items={pendingSOItems} materials={materials} closingStockItems={closingStockItems} onBulkAdd={handleBulkAddSO} onUpdate={handleUpdateSO} onDelete={handleDeleteSO} onClear={handleClearSO} onAddMaterial={handleAddMaterial} /></div>}
            {activeTab === 'pendingPO' && <div className="h-full w-full"><PendingPOView isAdmin={isAdmin} items={pendingPOItems} materials={materials} closingStockItems={closingStockItems} pendingSOItems={pendingSOItems} salesReportItems={salesReportItems} onBulkAdd={handleBulkAddPO} onUpdate={handleUpdatePO} onDelete={handleDeletePO} onClear={handleClearPO} onAddMaterial={handleAddMaterial} /></div>}
            {activeTab === 'salesReport' && <div className="h-full w-full"><SalesReportView isAdmin={isAdmin} items={salesReportItems} materials={materials} customers={customerMasterItems} onBulkAdd={handleBulkAddSales} onUpdate={handleUpdateSales} onDelete={handleDeleteSales} onClear={handleClearSales} onAddMaterial={handleAddMaterial} onAddCustomer={handleAddCustomer} /></div>}
            {activeTab === 'mom' && <div className="h-full w-full"><MOMView isAdmin={isAdmin} materials={materials} closingStock={closingStockItems} pendingSO={pendingSOItems} pendingPO={pendingPOItems} salesReportItems={salesReportItems} customers={customerMasterItems} /></div>}
            {activeTab === 'attendees' && <div className="h-full w-full"><AttendeeMasterView isAdmin={isAdmin} /></div>}
            {activeTab === 'userManagement' && isAdmin && <div className="h-full w-full"><UserManagementView /></div>}
          </div>
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

      {showPasswordChange && (
        <PasswordChangeModal
          user={currentUser}
          onClose={() => setShowPasswordChange(false)}
          onSuccess={() => { setShowPasswordChange(false); alert("Password updated successfully!"); }}
        />
      )}
    </div>
  );
};

export default App;
