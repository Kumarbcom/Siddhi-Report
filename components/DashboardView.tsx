
import React, { useState, useMemo } from 'react';
import { Material, ClosingStockItem, PendingSOItem, PendingPOItem, SalesRecord } from '../types';
import { TrendingUp, Package, ClipboardList, ShoppingCart, Wallet, AlertCircle, BarChart3, Users, Layers, AlertTriangle, Clock } from 'lucide-react';

interface DashboardViewProps {
  materials: Material[];
  closingStock: ClosingStockItem[];
  pendingSO: PendingSOItem[];
  pendingPO: PendingPOItem[];
  sales1Year: SalesRecord[];
  sales3Months: SalesRecord[];
  setActiveTab: (tab: any) => void;
}

type SubTab = 'sales' | 'inventory' | 'so' | 'po';

const DashboardView: React.FC<DashboardViewProps> = ({
  materials,
  closingStock,
  pendingSO,
  pendingPO,
  sales1Year,
  sales3Months,
  setActiveTab
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('sales');

  const formatCurrency = (val: number) => `Rs. ${Math.round(val).toLocaleString('en-IN')}`;

  // --- Helper Components ---

  const StatCard = ({ title, value, subValue, icon: Icon, colorClass, bgClass }: any) => (
    <div className={`p-4 rounded-xl border ${bgClass} flex items-start justify-between shadow-sm`}>
      <div>
        <p className={`text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>{title}</p>
        <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
        {subValue && <p className="text-xs text-gray-500 font-medium mt-1">{subValue}</p>}
      </div>
      <div className={`p-2 rounded-lg ${colorClass} bg-white/50`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );

  const SimpleBarChart = ({ title, data, color }: { title: string, data: { label: string, value: number, subLabel?: string }[], color: string }) => {
    const maxVal = Math.max(...data.map(d => d.value), 1);
    return (
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col h-full">
        <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
          <BarChart3 className={`w-4 h-4 text-${color}-600`} /> {title}
        </h3>
        <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-2">
          {data.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-xs italic">No data available</div>
          ) : (
            data.map((item, idx) => (
              <div key={idx}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-gray-700 truncate w-2/3" title={item.label}>{item.label}</span>
                  <span className="font-bold text-gray-900">{item.subLabel || formatCurrency(item.value)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full bg-${color}-500 transition-all duration-500`} 
                    style={{ width: `${(item.value / maxVal) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  // --- Data Calculations ---

  const salesStats = useMemo(() => {
    const total1Y = sales1Year.reduce((acc, i) => acc + i.value, 0);
    const total3M = sales3Months.reduce((acc, i) => acc + i.value, 0);
    const count1Y = sales1Year.reduce((acc, i) => acc + i.quantity, 0);
    const count3M = sales3Months.reduce((acc, i) => acc + i.quantity, 0);
    
    // Top 5 Items by Value (1 Year)
    const topItems1Y = [...sales1Year].sort((a, b) => b.value - a.value).slice(0, 5).map(i => ({ label: i.particulars, value: i.value }));
    // Top 5 Items by Value (3 Months)
    const topItems3M = [...sales3Months].sort((a, b) => b.value - a.value).slice(0, 5).map(i => ({ label: i.particulars, value: i.value }));

    return { total1Y, total3M, count1Y, count3M, topItems1Y, topItems3M };
  }, [sales1Year, sales3Months]);

  const inventoryStats = useMemo(() => {
    const totalVal = closingStock.reduce((acc, i) => acc + i.value, 0);
    const totalQty = closingStock.reduce((acc, i) => acc + i.quantity, 0);
    const count = closingStock.length;
    const unmatched = closingStock.filter(i => !materials.some(m => m.description.toLowerCase().trim() === i.description.toLowerCase().trim())).length;

    // Aggregations by Make & Group (using simple fuzzy match logic same as closing stock view)
    const makeMap = new Map<string, number>();
    const groupMap = new Map<string, number>();

    closingStock.forEach(item => {
       const mat = materials.find(m => m.description.toLowerCase().trim() === item.description.toLowerCase().trim());
       const make = mat ? mat.make : 'Unspecified';
       const group = mat ? mat.materialGroup : 'Unspecified';
       makeMap.set(make, (makeMap.get(make) || 0) + item.value);
       groupMap.set(group, (groupMap.get(group) || 0) + item.value);
    });

    const topMakes = Array.from(makeMap.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 5);
    const topGroups = Array.from(groupMap.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).filter(i => i.label !== 'Unspecified').slice(0, 5);

    return { totalVal, totalQty, count, unmatched, topMakes, topGroups };
  }, [closingStock, materials]);

  const soStats = useMemo(() => {
     const totalVal = pendingSO.reduce((acc, i) => acc + (i.balanceQty * i.rate), 0);
     const totalQty = pendingSO.reduce((acc, i) => acc + i.balanceQty, 0);
     const overdueItems = pendingSO.filter(i => i.overDueDays > 0);
     const overdueVal = overdueItems.reduce((acc, i) => acc + (i.balanceQty * i.rate), 0);
     const overdueCount = overdueItems.length;

     // Top Customers
     const partyMap = new Map<string, number>();
     pendingSO.forEach(i => {
         const val = i.balanceQty * i.rate;
         partyMap.set(i.partyName, (partyMap.get(i.partyName) || 0) + val);
     });
     const topParties = Array.from(partyMap.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 5);

     // Top Items
     const itemMap = new Map<string, number>();
     pendingSO.forEach(i => {
        itemMap.set(i.itemName, (itemMap.get(i.itemName) || 0) + i.balanceQty);
     });
     const topItems = Array.from(itemMap.entries()).map(([label, value]) => ({ label, value, subLabel: value.toLocaleString() })).sort((a, b) => b.value - a.value).slice(0, 5);

     return { totalVal, totalQty, overdueVal, overdueCount, topParties, topItems };
  }, [pendingSO]);

  const poStats = useMemo(() => {
    const totalVal = pendingPO.reduce((acc, i) => acc + (i.balanceQty * i.rate), 0);
    const totalQty = pendingPO.reduce((acc, i) => acc + i.balanceQty, 0);
    const overdueItems = pendingPO.filter(i => i.overDueDays > 0);
    const overdueCount = overdueItems.length;

    // Top Suppliers
    const partyMap = new Map<string, number>();
    pendingPO.forEach(i => {
        const val = i.balanceQty * i.rate;
        partyMap.set(i.partyName, (partyMap.get(i.partyName) || 0) + val);
    });
    const topParties = Array.from(partyMap.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 5);

    return { totalVal, totalQty, overdueCount, topParties };
 }, [pendingPO]);


  return (
    <div className="h-full w-full flex flex-col bg-gray-50/50">
      
      {/* Title & Navigation */}
      <div className="px-6 pt-6 pb-2">
        <h1 className="text-xl font-bold text-gray-900 mb-4">Executive Dashboard</h1>
        <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-gray-200 w-fit">
           <button 
             onClick={() => setActiveSubTab('sales')}
             className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${activeSubTab === 'sales' ? 'bg-teal-50 text-teal-700 shadow-sm ring-1 ring-teal-200' : 'text-gray-500 hover:bg-gray-50'}`}
           >
             <TrendingUp className="w-4 h-4" /> Total Sales
           </button>
           <button 
             onClick={() => setActiveSubTab('inventory')}
             className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${activeSubTab === 'inventory' ? 'bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-200' : 'text-gray-500 hover:bg-gray-50'}`}
           >
             <Package className="w-4 h-4" /> Inventory
           </button>
           <button 
             onClick={() => setActiveSubTab('so')}
             className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${activeSubTab === 'so' ? 'bg-purple-50 text-purple-700 shadow-sm ring-1 ring-purple-200' : 'text-gray-500 hover:bg-gray-50'}`}
           >
             <ClipboardList className="w-4 h-4" /> Pending SO
           </button>
           <button 
             onClick={() => setActiveSubTab('po')}
             className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${activeSubTab === 'po' ? 'bg-orange-50 text-orange-700 shadow-sm ring-1 ring-orange-200' : 'text-gray-500 hover:bg-gray-50'}`}
           >
             <ShoppingCart className="w-4 h-4" /> Pending PO
           </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        
        {/* --- SALES CONTENT --- */}
        {activeSubTab === 'sales' && (
           <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                 <StatCard 
                    title="Total Sales (1 Year)" 
                    value={formatCurrency(salesStats.total1Y)} 
                    subValue={`${salesStats.count1Y} Items sold`} 
                    icon={Wallet} 
                    bgClass="bg-indigo-50/50 border-indigo-100" 
                    colorClass="text-indigo-600" 
                 />
                 <StatCard 
                    title="Total Sales (3 Months)" 
                    value={formatCurrency(salesStats.total3M)} 
                    subValue={`${salesStats.count3M} Items sold`} 
                    icon={TrendingUp} 
                    bgClass="bg-teal-50/50 border-teal-100" 
                    colorClass="text-teal-600" 
                 />
                 <div className="p-4 rounded-xl border bg-white border-gray-200 flex flex-col justify-center items-center text-center shadow-sm">
                    <p className="text-gray-500 text-xs">Sales Velocity (3M)</p>
                    <h3 className="text-xl font-bold text-gray-900 mt-1">{Math.round(salesStats.count3M / 3).toLocaleString()} <span className="text-xs font-normal text-gray-400">/mo</span></h3>
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-80">
                 <SimpleBarChart title="Top 5 Items by Value (1 Year)" data={salesStats.topItems1Y} color="indigo" />
                 <SimpleBarChart title="Top 5 Items by Value (3 Months)" data={salesStats.topItems3M} color="teal" />
              </div>
           </div>
        )}

        {/* --- INVENTORY CONTENT --- */}
        {activeSubTab === 'inventory' && (
           <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                 <StatCard 
                    title="Total Stock Value" 
                    value={formatCurrency(inventoryStats.totalVal)} 
                    subValue={`${inventoryStats.count} Unique Items`} 
                    icon={Package} 
                    bgClass="bg-emerald-50/50 border-emerald-100" 
                    colorClass="text-emerald-600" 
                 />
                 <StatCard 
                    title="Total Quantity" 
                    value={inventoryStats.totalQty.toLocaleString()} 
                    subValue="Physical Units" 
                    icon={Layers} 
                    bgClass="bg-blue-50/50 border-blue-100" 
                    colorClass="text-blue-600" 
                 />
                 <StatCard 
                    title="Unmatched Items" 
                    value={inventoryStats.unmatched} 
                    subValue="Not in Material Master" 
                    icon={AlertTriangle} 
                    bgClass={inventoryStats.unmatched > 0 ? "bg-red-50/50 border-red-100" : "bg-green-50/50 border-green-100"} 
                    colorClass={inventoryStats.unmatched > 0 ? "text-red-600" : "text-green-600"} 
                 />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-80">
                 <SimpleBarChart title="Inventory Value by Make" data={inventoryStats.topMakes} color="emerald" />
                 <SimpleBarChart title="Inventory Value by Group" data={inventoryStats.topGroups} color="blue" />
              </div>
           </div>
        )}

        {/* --- PENDING SO CONTENT --- */}
        {activeSubTab === 'so' && (
           <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                 <StatCard 
                    title="Total Pending Value" 
                    value={formatCurrency(soStats.totalVal)} 
                    subValue={`Bal Qty: ${soStats.totalQty.toLocaleString()}`} 
                    icon={ClipboardList} 
                    bgClass="bg-purple-50/50 border-purple-100" 
                    colorClass="text-purple-600" 
                 />
                 <StatCard 
                    title="Overdue Orders" 
                    value={soStats.overdueCount} 
                    subValue={`Val: ${formatCurrency(soStats.overdueVal)}`} 
                    icon={Clock} 
                    bgClass="bg-red-50/50 border-red-100" 
                    colorClass="text-red-600" 
                 />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-80">
                 <SimpleBarChart title="Pending Value by Customer" data={soStats.topParties} color="purple" />
                 <SimpleBarChart title="Pending Qty by Item" data={soStats.topItems} color="pink" />
              </div>
           </div>
        )}

        {/* --- PENDING PO CONTENT --- */}
        {activeSubTab === 'po' && (
           <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                 <StatCard 
                    title="Total Pending Value" 
                    value={formatCurrency(poStats.totalVal)} 
                    subValue={`Bal Qty: ${poStats.totalQty.toLocaleString()}`} 
                    icon={ShoppingCart} 
                    bgClass="bg-orange-50/50 border-orange-100" 
                    colorClass="text-orange-600" 
                 />
                 <StatCard 
                    title="Overdue POs" 
                    value={poStats.overdueCount} 
                    subValue="Delayed deliveries" 
                    icon={AlertCircle} 
                    bgClass="bg-red-50/50 border-red-100" 
                    colorClass="text-red-600" 
                 />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-80">
                 <SimpleBarChart title="Pending Value by Supplier" data={poStats.topParties} color="orange" />
              </div>
           </div>
        )}

      </div>
    </div>
  );
};

export default DashboardView;
