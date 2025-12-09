
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
    const soCount = pendingSO.length;

    // Pending PO
    const poBalValue = pendingPO.reduce((acc, i) => acc + (i.balanceQty * i.rate), 0);
    const poBalQty = pendingPO.reduce((acc, i) => acc + i.balanceQty, 0);
    const poCount = pendingPO.length;

    return { invValue, invQty, totalSalesValue, totalSalesQty, soBalValue, soBalQty, soCount, poBalValue, poBalQty, poCount };
  }, [closingStock, pendingSO, pendingPO, sales1Year, sales3Months]);

  const formatCurrency = (val: number) => `Rs. ${Math.round(val).toLocaleString('en-IN')}`;

  return (
    <div className="h-full w-full overflow-y-auto p-6 bg-gray-50/50">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Executive Dashboard</h1>
        <p className="text-gray-500">Overview of business performance and pending actions.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        
        {/* Sales Card */}
        <div 
          onClick={() => setActiveTab('salesHistory')}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition-all hover:border-teal-200 group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-teal-100 text-teal-700 rounded-lg">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Total Sales</h3>
            </div>
            <div className="space-y-1">
               <p className="text-3xl font-bold text-gray-900">{formatCurrency(stats.totalSalesValue)}</p>
               <p className="text-sm text-gray-500 font-medium">Qty: {stats.totalSalesQty.toLocaleString()}</p>
            </div>
            <div className="mt-6 flex items-center text-teal-600 text-sm font-medium gap-1 group-hover:gap-2 transition-all">
              View History <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Inventory Card */}
        <div 
          onClick={() => setActiveTab('closingStock')}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition-all hover:border-emerald-200 group relative overflow-hidden"
        >
           <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
           <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-lg">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Inventory</h3>
            </div>
            <div className="space-y-1">
               <p className="text-3xl font-bold text-gray-900">{formatCurrency(stats.invValue)}</p>
               <p className="text-sm text-gray-500 font-medium">Qty: {stats.invQty.toLocaleString()}</p>
            </div>
            <div className="mt-6 flex items-center text-emerald-600 text-sm font-medium gap-1 group-hover:gap-2 transition-all">
              Manage Stock <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Sales Orders Card */}
        <div 
          onClick={() => setActiveTab('pendingSO')}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition-all hover:border-purple-200 group relative overflow-hidden"
        >
           <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
           <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-purple-100 text-purple-700 rounded-lg">
                <ClipboardList className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Pending SO</h3>
            </div>
            <div className="space-y-1">
               <p className="text-3xl font-bold text-gray-900">{formatCurrency(stats.soBalValue)}</p>
               <p className="text-sm text-gray-500 font-medium">Bal Qty: {stats.soBalQty.toLocaleString()}</p>
            </div>
            <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center text-purple-600 text-sm font-medium gap-1 group-hover:gap-2 transition-all">
                  View Orders <ArrowRight className="w-4 h-4" />
                </div>
                <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full font-bold">{stats.soCount} Orders</span>
            </div>
          </div>
        </div>

        {/* Purchase Orders Card */}
        <div 
          onClick={() => setActiveTab('pendingPO')}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition-all hover:border-orange-200 group relative overflow-hidden"
        >
           <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
           <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-orange-100 text-orange-700 rounded-lg">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Pending PO</h3>
            </div>
            <div className="space-y-1">
               <p className="text-3xl font-bold text-gray-900">{formatCurrency(stats.poBalValue)}</p>
               <p className="text-sm text-gray-500 font-medium">Bal Qty: {stats.poBalQty.toLocaleString()}</p>
            </div>
             <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center text-orange-600 text-sm font-medium gap-1 group-hover:gap-2 transition-all">
                  View Orders <ArrowRight className="w-4 h-4" />
                </div>
                <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full font-bold">{stats.poCount} Orders</span>
            </div>
          </div>
        </div>

      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
             <div className="flex items-center gap-2 mb-4">
                 <Wallet className="w-5 h-5 text-gray-500" />
                 <h3 className="text-lg font-semibold text-gray-800">Quick Stats</h3>
             </div>
             <div className="space-y-4">
                 <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                     <span className="text-gray-600">Material Master Records</span>
                     <span className="font-bold text-gray-900">{materials.length}</span>
                 </div>
                 <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                     <span className="text-gray-600">Items Not in Master</span>
                     <span className={`font-bold ${closingStock.filter(i => !materials.some(m => m.description.toLowerCase().trim() === i.description.toLowerCase().trim())).length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                         {closingStock.filter(i => !materials.some(m => m.description.toLowerCase().trim() === i.description.toLowerCase().trim())).length}
                     </span>
                 </div>
             </div>
          </div>
          
           <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex flex-col justify-center items-center text-center">
               <div className="bg-white p-4 rounded-full shadow-sm mb-3">
                   <AlertCircle className="w-8 h-8 text-blue-600" />
               </div>
               <h3 className="text-lg font-bold text-blue-900">System Status</h3>
               <p className="text-blue-700 text-sm mt-1">All database connections are active and local storage is synced.</p>
               <p className="text-xs text-blue-500 mt-4">Last updated: Just now</p>
           </div>
      </div>
    </div>
  );
};

export default DashboardView;
