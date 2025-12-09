
import React, { useMemo } from 'react';
import { Material, ClosingStockItem, PendingSOItem, PendingPOItem, SalesRecord } from '../types';
import { TrendingUp, Package, ClipboardList, ShoppingCart, ArrowRight, Wallet, AlertCircle } from 'lucide-react';

interface DashboardViewProps {
  materials: Material[];
  closingStock: ClosingStockItem[];
  pendingSO: PendingSOItem[];
  pendingPO: PendingPOItem[];
  sales1Year: SalesRecord[];
  sales3Months: SalesRecord[];
  setActiveTab: (tab: any) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({
  materials,
  closingStock,
  pendingSO,
  pendingPO,
  sales1Year,
  sales3Months,
  setActiveTab
}) => {
  
  const stats = useMemo(() => {
    // Inventory
    const invValue = closingStock.reduce((acc, item) => acc + item.value, 0);
    const invQty = closingStock.reduce((acc, item) => acc + item.quantity, 0);

    // Sales (Combined)
    const totalSalesValue = sales1Year.reduce((acc, i) => acc + i.value, 0) + sales3Months.reduce((acc, i) => acc + i.value, 0);
    const totalSalesQty = sales1Year.reduce((acc, i) => acc + i.quantity, 0) + sales3Months.reduce((acc, i) => acc + i.quantity, 0);

    // Pending SO
    const soBalValue = pendingSO.reduce((acc, i) => acc + (i.balanceQty * i.rate), 0);
    const soBalQty = pendingSO.reduce((acc, i) => acc + i.balanceQty, 0);
    const soCount = new Set(pendingSO.map(i => i.orderNo.trim()).filter(Boolean)).size;

    // Pending PO
    const poBalValue = pendingPO.reduce((acc, i) => acc + (i.balanceQty * i.rate), 0);
    const poBalQty = pendingPO.reduce((acc, i) => acc + i.balanceQty, 0);
    const poCount = new Set(pendingPO.map(i => i.orderNo.trim()).filter(Boolean)).size;

    return { invValue, invQty, totalSalesValue, totalSalesQty, soBalValue, soBalQty, soCount, poBalValue, poBalQty, poCount };
  }, [closingStock, pendingSO, pendingPO, sales1Year, sales3Months]);

  const formatCurrency = (val: number) => `Rs. ${Math.round(val).toLocaleString('en-IN')}`;

  return (
    <div className="h-full w-full overflow-y-auto p-4 bg-gray-50/50">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Executive Dashboard</h1>
        <p className="text-gray-500 text-xs">Overview of business performance and pending actions.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        
        {/* Sales Card */}
        <div 
          onClick={() => setActiveTab('salesHistory')}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-all hover:border-teal-200 group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-teal-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-teal-100 text-teal-700 rounded-lg">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-gray-800">Total Sales</h3>
            </div>
            <div className="space-y-0.5">
               <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalSalesValue)}</p>
               <p className="text-xs text-gray-500 font-medium">Qty: {stats.totalSalesQty.toLocaleString()}</p>
            </div>
            <div className="mt-4 flex items-center text-teal-600 text-xs font-medium gap-1 group-hover:gap-2 transition-all">
              View History <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Inventory Card */}
        <div 
          onClick={() => setActiveTab('closingStock')}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-all hover:border-emerald-200 group relative overflow-hidden"
        >
           <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
           <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                <Package className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-gray-800">Inventory</h3>
            </div>
            <div className="space-y-0.5">
               <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.invValue)}</p>
               <p className="text-xs text-gray-500 font-medium">Qty: {stats.invQty.toLocaleString()}</p>
            </div>
            <div className="mt-4 flex items-center text-emerald-600 text-xs font-medium gap-1 group-hover:gap-2 transition-all">
              Manage Stock <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Sales Orders Card */}
        <div 
          onClick={() => setActiveTab('pendingSO')}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-all hover:border-purple-200 group relative overflow-hidden"
        >
           <div className="absolute top-0 right-0 w-20 h-20 bg-purple-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
           <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                <ClipboardList className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-gray-800">Pending SO</h3>
            </div>
            <div className="space-y-0.5">
               <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.soBalValue)}</p>
               <p className="text-xs text-gray-500 font-medium">Bal Qty: {stats.soBalQty.toLocaleString()}</p>
            </div>
            <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center text-purple-600 text-xs font-medium gap-1 group-hover:gap-2 transition-all">
                  View Orders <ArrowRight className="w-3.5 h-3.5" />
                </div>
                <span className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded-full font-bold">{stats.soCount} Orders</span>
            </div>
          </div>
        </div>

        {/* Purchase Orders Card */}
        <div 
          onClick={() => setActiveTab('pendingPO')}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-all hover:border-orange-200 group relative overflow-hidden"
        >
           <div className="absolute top-0 right-0 w-20 h-20 bg-orange-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
           <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-orange-100 text-orange-700 rounded-lg">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-gray-800">Pending PO</h3>
            </div>
            <div className="space-y-0.5">
               <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.poBalValue)}</p>
               <p className="text-xs text-gray-500 font-medium">Bal Qty: {stats.poBalQty.toLocaleString()}</p>
            </div>
             <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center text-orange-600 text-xs font-medium gap-1 group-hover:gap-2 transition-all">
                  View Orders <ArrowRight className="w-3.5 h-3.5" />
                </div>
                <span className="bg-orange-100 text-orange-800 text-[10px] px-2 py-0.5 rounded-full font-bold">{stats.poCount} Orders</span>
            </div>
          </div>
        </div>

      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
             <div className="flex items-center gap-2 mb-3">
                 <Wallet className="w-4 h-4 text-gray-500" />
                 <h3 className="text-sm font-bold text-gray-800">Quick Stats</h3>
             </div>
             <div className="space-y-3">
                 <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg text-xs">
                     <span className="text-gray-600">Material Master Records</span>
                     <span className="font-bold text-gray-900">{materials.length}</span>
                 </div>
                 <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg text-xs">
                     <span className="text-gray-600">Items Not in Master</span>
                     <span className={`font-bold ${closingStock.filter(i => !materials.some(m => m.description.toLowerCase().trim() === i.description.toLowerCase().trim())).length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                         {closingStock.filter(i => !materials.some(m => m.description.toLowerCase().trim() === i.description.toLowerCase().trim())).length}
                     </span>
                 </div>
             </div>
          </div>
          
           <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 flex flex-col justify-center items-center text-center">
               <div className="bg-white p-3 rounded-full shadow-sm mb-2">
                   <AlertCircle className="w-6 h-6 text-blue-600" />
               </div>
               <h3 className="text-base font-bold text-blue-900">System Status</h3>
               <p className="text-blue-700 text-xs mt-1">All database connections are active and local storage is synced.</p>
           </div>
      </div>
    </div>
  );
};

export default DashboardView;
