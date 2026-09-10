import React, { useMemo, useState } from 'react';
import { Material, SalesReportItem, ClosingStockItem, PendingPOItem, PendingSOItem } from '../types';
import { Calculator, AlertTriangle, CheckCircle, Package, TrendingUp, Info, BarChart2 } from 'lucide-react';

interface InventoryCalculatorViewProps {
  materials: Material[];
  closingStock: ClosingStockItem[];
  pendingSO: PendingSOItem[];
  pendingPO: PendingPOItem[];
  salesReportItems: SalesReportItem[];
}

import SawtoothGraph from './SawtoothGraph';

const InventoryCalculatorView: React.FC<InventoryCalculatorViewProps> = ({
  materials, closingStock, pendingSO, pendingPO, salesReportItems
}) => {
  const [orderingCost, setOrderingCost] = useState<number>(150);
  const [holdingCost, setHoldingCost] = useState<number>(2.50);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const calculatedData = useMemo(() => {
    // 1. Filter Lapp materials
    const lappMaterials = materials.filter(m => 
      (m.make || '').toLowerCase() === 'lapp' || 
      (m.description || '').toLowerCase().includes('lapp')
    );

    // 2. Prepare Date Range for Sales
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    
    // Filter sales within the last 1 year for accurate Annual Demand and Weekly variation
    const recentSales = salesReportItems.filter(s => new Date(s.date) >= oneYearAgo);
    
    // Total weeks in the analysis period (52 weeks for 1 year)
    const TOTAL_WEEKS = 52;

    // 3. Process each material
    let items = lappMaterials.map(mat => {
      // Get lead times
      const desc = (mat.description || '').toLowerCase();
      let leadTimes = { max: 6, avg: 3, min: 2, emg: 1 }; // default
      if (desc.includes('silvyn')) leadTimes = { max: 14, avg: 10, min: 6, emg: 4 };
      else if (desc.includes('uniplus')) leadTimes = { max: 6, avg: 3, min: 2, emg: 1 };
      else if (desc.includes('skintop')) leadTimes = { max: 5, avg: 3, min: 2, emg: 1 };
      else if (desc.includes('olflex') || desc.includes('olfex') || desc.includes('110 sy') || desc.includes('110 cy') || desc.includes('100 i') || desc.includes('100i') || desc.includes('unitronic')) {
        leadTimes = { max: 12, avg: 6, min: 2, emg: 2 };
      }

      // Group sales by week
      const weeklySales: Record<string, number> = {};
      let totalAnnualQty = 0;
      let totalAnnualValue = 0;

      const descKey = (mat.description || '').toLowerCase().trim();
      const partKey = (mat.partNo || '').toLowerCase().trim();

      const matSales = recentSales.filter(s => {
        const pk = (s.particulars || '').toLowerCase().trim();
        return pk === descKey || (partKey && pk.includes(partKey));
      });

      matSales.forEach(sale => {
        const d = new Date(sale.date);
        const getWeek = (date: Date) => {
            const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
            const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
            return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        };
        const weekKey = `${d.getFullYear()}-W${getWeek(d)}`;
        weeklySales[weekKey] = (weeklySales[weekKey] || 0) + sale.quantity;
        totalAnnualQty += sale.quantity;
        totalAnnualValue += sale.value;
      });

      const weeksWithSales = Object.keys(weeklySales).length;
      const salesValues = Object.values(weeklySales);
      
      const maxConsumption = salesValues.length > 0 ? Math.max(...salesValues) : 0;
      const minConsumption = weeksWithSales < TOTAL_WEEKS ? 0 : Math.min(...salesValues);
      const avgConsumption = totalAnnualQty / TOTAL_WEEKS; // Using total period average

      // Unit Price approximation
      const unitPrice = totalAnnualQty > 0 ? (totalAnnualValue / totalAnnualQty) : 0;

      // Variance & StdDev for XYZ
      let variance = 0;
      if (avgConsumption > 0) {
        let sumSquaredDiff = 0;
        // For weeks with sales
        salesValues.forEach(qty => {
          sumSquaredDiff += Math.pow(qty - avgConsumption, 2);
        });
        // For weeks without sales (qty = 0)
        const emptyWeeks = TOTAL_WEEKS - weeksWithSales;
        sumSquaredDiff += emptyWeeks * Math.pow(0 - avgConsumption, 2);
        variance = sumSquaredDiff / TOTAL_WEEKS;
      }
      const stdDev = Math.sqrt(variance);
      const cv = avgConsumption > 0 ? (stdDev / avgConsumption) : 0;
      let xyzClass = 'Z';
      if (avgConsumption === 0) xyzClass = 'N/A';
      else if (cv <= 0.5) xyzClass = 'X';
      else if (cv <= 1.0) xyzClass = 'Y';

      // Formulas
      const rol = maxConsumption * leadTimes.max;
      const minStock = Math.max(0, rol - (avgConsumption * leadTimes.avg));
      
      const D = totalAnnualQty; // Annual demand
      // EOQ = sqrt(2 * D * S / H)
      let eoq = 0;
      if (D > 0 && orderingCost > 0 && holdingCost > 0) {
        eoq = Math.round(Math.sqrt((2 * D * orderingCost) / holdingCost));
      }
      const activeRoq = eoq > 0 ? eoq : 0; // if fixed roq was there, we'd use it

      const maxStock = (rol + activeRoq) - (minConsumption * leadTimes.min);
      const averageStock = minStock + (activeRoq / 2);
      const dangerLevel = avgConsumption * leadTimes.emg;

      // Current Situation
      const currentStock = closingStock.filter(c => (c.description || '').toLowerCase().trim() === descKey).reduce((acc, c) => acc + c.quantity, 0);
      const poQty = pendingPO.filter(p => {
        const pk = (p.partNo || '').toLowerCase().trim();
        const dk = (p.itemName || '').toLowerCase().trim();
        return pk === partKey || dk === descKey;
      }).reduce((acc, p) => acc + p.balanceQty, 0);
      const soQty = pendingSO.filter(s => {
        const pk = (s.partNo || '').toLowerCase().trim();
        const dk = (s.itemName || '').toLowerCase().trim();
        return pk === partKey || dk === descKey;
      }).reduce((acc, s) => acc + s.balanceQty, 0);
      
      const effectiveStock = currentStock + poQty - soQty;

      let status = 'Healthy';
      if (avgConsumption === 0 && currentStock === 0) status = 'No Data';
      else if (effectiveStock <= dangerLevel) status = 'Critical';
      else if (effectiveStock <= rol) status = 'Reorder Required';
      else if (effectiveStock > maxStock) status = 'Overstock';

      return {
        material: mat,
        annualDemand: totalAnnualQty,
        annualValue: totalAnnualValue,
        maxConsumption: Math.round(maxConsumption),
        avgConsumption: Number(avgConsumption.toFixed(2)),
        minConsumption: Math.round(minConsumption),
        leadTimes,
        rol: Math.round(rol),
        minStock: Math.round(minStock),
        maxStock: Math.round(maxStock),
        averageStock: Math.round(averageStock),
        dangerLevel: Math.round(dangerLevel),
        eoq,
        xyzClass,
        currentStock,
        pendingPO: poQty,
        pendingSO: soQty,
        effectiveStock,
        status,
        cv: Number(cv.toFixed(2))
      };
    });

    // ABC Classification
    items.sort((a, b) => b.annualValue - a.annualValue);
    const totalValueAll = items.reduce((acc, i) => acc + i.annualValue, 0);
    let cumulativeValue = 0;

    items = items.map(item => {
      cumulativeValue += item.annualValue;
      const pct = totalValueAll > 0 ? (cumulativeValue / totalValueAll) : 0;
      let abcClass = 'C';
      if (item.annualValue === 0) abcClass = 'N/A';
      else if (pct <= 0.80) abcClass = 'A';
      else if (pct <= 0.95) abcClass = 'B';
      
      return { ...item, abcClass };
    });

    return items;
  }, [materials, salesReportItems, closingStock, pendingSO, pendingPO, orderingCost, holdingCost]);

  // Filter state
  const [filterText, setFilterText] = useState('');
  
  const filteredData = calculatedData.filter(item => 
    item.material.description.toLowerCase().includes(filterText.toLowerCase()) ||
    item.material.partNo.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Calculator className="w-6 h-6 text-blue-600" />
            Inventory Stock Level Calculator
          </h2>
          <p className="text-sm text-gray-500">Lapp Products Analysis (ABC/XYZ & Standard Formulas)</p>
        </div>
        <div className="flex gap-4">
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600">Ordering Cost (S)</label>
            <input 
              type="number" 
              value={orderingCost} 
              onChange={e => setOrderingCost(Number(e.target.value))}
              className="px-3 py-1.5 border border-gray-200 rounded-md text-sm w-24"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600">Holding Cost (H)</label>
            <input 
              type="number" 
              value={holdingCost} 
              onChange={e => setHoldingCost(Number(e.target.value))}
              className="px-3 py-1.5 border border-gray-200 rounded-md text-sm w-24"
            />
          </div>
          <div className="flex flex-col justify-end">
             <input 
              type="text" 
              placeholder="Search part..."
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-md text-sm w-48"
            />
          </div>
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-slate-50 sticky top-0 z-10 text-xs text-slate-500 uppercase font-semibold">
              <tr>
                <th className="px-4 py-3 border-b">Part Number / Description</th>
                <th className="px-4 py-3 border-b text-center">Class</th>
                <th className="px-4 py-3 border-b text-right">Cons. (Wk)<br/><span className="text-[9px]">Max/Avg/Min</span></th>
                <th className="px-4 py-3 border-b text-right">LT (Wks)<br/><span className="text-[9px]">Max/Avg/Min</span></th>
                <th className="px-4 py-3 border-b text-right">ROL</th>
                <th className="px-4 py-3 border-b text-right">Levels<br/><span className="text-[9px]">Min/Max/Avg</span></th>
                <th className="px-4 py-3 border-b text-right text-red-500">Danger</th>
                <th className="px-4 py-3 border-b text-right">EOQ</th>
                <th className="px-4 py-3 border-b text-right bg-blue-50">Stock<br/><span className="text-[9px]">Cur/PO/SO</span></th>
                <th className="px-4 py-3 border-b text-right bg-blue-50 font-bold">Effective</th>
                <th className="px-4 py-3 border-b text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData.map((row) => (
                <React.Fragment key={row.material.id}>
                  <tr 
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setExpandedRow(expandedRow === row.material.id ? null : row.material.id)}
                  >
                    <td className="px-4 py-2">
                      <div className="font-bold text-gray-800">{row.material.partNo || '-'}</div>
                      <div className="text-xs text-gray-500 truncate max-w-[200px]" title={row.material.description}>{row.material.description}</div>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${row.abcClass==='A'?'bg-green-100 text-green-700':row.abcClass==='B'?'bg-blue-100 text-blue-700':'bg-gray-100 text-gray-600'}`}>{row.abcClass}</span>
                      <span className={`ml-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${row.xyzClass==='X'?'bg-emerald-100 text-emerald-700':row.xyzClass==='Y'?'bg-amber-100 text-amber-700':'bg-red-100 text-red-700'}`}>{row.xyzClass}</span>
                    </td>
                    <td className="px-4 py-2 text-right text-xs">
                      <div className="font-medium">{row.maxConsumption} / {row.avgConsumption} / {row.minConsumption}</div>
                    </td>
                    <td className="px-4 py-2 text-right text-xs">
                      <div className="font-medium text-slate-500">{row.leadTimes.max} / {row.leadTimes.avg} / {row.leadTimes.min}</div>
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-indigo-600">
                      {row.rol}
                    </td>
                    <td className="px-4 py-2 text-right text-xs">
                      <div className="font-medium">{row.minStock} / {row.maxStock} / {row.averageStock}</div>
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-red-500">
                      {row.dangerLevel}
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-blue-600">
                      {row.eoq}
                    </td>
                    <td className="px-4 py-2 text-right text-xs bg-blue-50/30">
                      <div className="font-medium">{row.currentStock} / {row.pendingPO} / {row.pendingSO}</div>
                    </td>
                    <td className="px-4 py-2 text-right font-black text-blue-700 bg-blue-50/50">
                      {row.effectiveStock}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {row.status === 'Critical' && <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-100 text-red-700 px-2 py-1 rounded-full"><AlertTriangle className="w-3 h-3"/> Critical</span>}
                      {row.status === 'Reorder Required' && <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full"><AlertTriangle className="w-3 h-3"/> Reorder</span>}
                      {row.status === 'Healthy' && <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full"><CheckCircle className="w-3 h-3"/> Healthy</span>}
                      {row.status === 'Overstock' && <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded-full"><TrendingUp className="w-3 h-3"/> Overstock</span>}
                      {row.status === 'No Data' && <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-full">No Data</span>}
                    </td>
                  </tr>
                  {expandedRow === row.material.id && (
                    <tr>
                      <td colSpan={11} className="bg-slate-50 p-4 border-b border-slate-200 shadow-inner">
                        <SawtoothGraph 
                          maxStock={row.maxStock} 
                          minStock={row.minStock} 
                          rol={row.rol} 
                          eoq={row.eoq} 
                          leadTimeAvg={row.leadTimes.avg} 
                          avgConsumption={row.avgConsumption} 
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {filteredData.length === 0 && (
                <tr><td colSpan={11} className="p-8 text-center text-gray-400">No Lapp products found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InventoryCalculatorView;
