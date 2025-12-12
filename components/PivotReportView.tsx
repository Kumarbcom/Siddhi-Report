
import React, { useMemo, useState } from 'react';
import { Material, ClosingStockItem, PendingSOItem, PendingPOItem, SalesReportItem } from '../types';
import { FileDown, Search, ArrowUp, ArrowDown, Filter, AlertTriangle, Minus } from 'lucide-react';
import { utils, writeFile } from 'xlsx';

interface PivotReportViewProps {
  materials: Material[];
  closingStock: ClosingStockItem[];
  pendingSO: PendingSOItem[];
  pendingPO: PendingPOItem[];
  salesReportItems: SalesReportItem[];
}

// --- Helper: Round UP to nearest 10 ---
const roundToTen = (num: number) => {
    if (num <= 0) return 0;
    return Math.ceil(num / 10) * 10;
};

const PivotReportView: React.FC<PivotReportViewProps> = ({
  materials,
  closingStock,
  pendingSO,
  pendingPO,
  salesReportItems
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'ACTION' | 'EXCESS'>('ALL');

  // --- Core Calculation Logic ---
  const pivotData = useMemo(() => {
    // 1. Create Index Maps for fast lookup
    const stockMap = new Map<string, { qty: number; val: number }>();
    closingStock.forEach(i => {
        const key = i.description.toLowerCase().trim();
        const existing = stockMap.get(key) || { qty: 0, val: 0 };
        stockMap.set(key, { qty: existing.qty + i.quantity, val: existing.val + i.value });
    });

    const soMap = new Map<string, { qty: number; val: number }>();
    pendingSO.forEach(i => {
        const key = i.itemName.toLowerCase().trim();
        const existing = soMap.get(key) || { qty: 0, val: 0 };
        // Use balanceQty for pending
        const val = (i.balanceQty || 0) * (i.rate || 0);
        soMap.set(key, { qty: existing.qty + (i.balanceQty || 0), val: existing.val + val });
    });

    const poMap = new Map<string, { qty: number; val: number }>();
    pendingPO.forEach(i => {
        const key = i.itemName.toLowerCase().trim();
        const existing = poMap.get(key) || { qty: 0, val: 0 };
        const val = (i.balanceQty || 0) * (i.rate || 0);
        poMap.set(key, { qty: existing.qty + (i.balanceQty || 0), val: existing.val + val });
    });

    // 2. Date Ranges for Sales
    const now = new Date();
    const threeMonthsAgo = new Date(); threeMonthsAgo.setMonth(now.getMonth() - 3);
    const oneYearAgo = new Date(); oneYearAgo.setFullYear(now.getFullYear() - 1);

    const sales3mMap = new Map<string, { qty: number; val: number }>();
    const sales1yMap = new Map<string, { qty: number; val: number }>();

    salesReportItems.forEach(i => {
        const key = i.particulars.toLowerCase().trim();
        const d = new Date(i.date);
        
        // 1 Year Data
        if (d >= oneYearAgo) {
            const ex1 = sales1yMap.get(key) || { qty: 0, val: 0 };
            sales1yMap.set(key, { qty: ex1.qty + i.quantity, val: ex1.val + i.value });

            // 3 Months Data (Subset)
            if (d >= threeMonthsAgo) {
                const ex3 = sales3mMap.get(key) || { qty: 0, val: 0 };
                sales3mMap.set(key, { qty: ex3.qty + i.quantity, val: ex3.val + i.value });
            }
        }
    });

    // 3. Build Rows based on Material Master
    return materials.map(mat => {
        const descriptionKey = mat.description.toLowerCase().trim();
        const partNoKey = mat.partNo ? mat.partNo.toLowerCase().trim() : '';
        
        // Basic Data
        const stock = stockMap.get(descriptionKey) || { qty: 0, val: 0 };
        const so = soMap.get(descriptionKey) || { qty: 0, val: 0 };
        const po = poMap.get(descriptionKey) || { qty: 0, val: 0 };
        
        // Net Calculation: Stock + PO - SO
        const netQty = stock.qty + po.qty - so.qty;
        
        // Estimate Rate: Try Stock -> PO -> SO
        let avgRate = 0;
        if (stock.qty > 0) {
            avgRate = stock.val / stock.qty;
        } else if (po.qty > 0) {
            avgRate = po.val / po.qty;
        } else if (so.qty > 0) {
            avgRate = so.val / so.qty;
        }

        const netVal = netQty * avgRate;

        // Sales Averages (Rounded to 10)
        // PRIORITIZE Part Number for Sales Matching, fallback to Description
        const s3 = (partNoKey && sales3mMap.get(partNoKey)) || sales3mMap.get(descriptionKey) || { qty: 0, val: 0 };
        const avg3mQtyRaw = s3.qty / 3;
        const avg3mQty = roundToTen(avg3mQtyRaw);
        const avg3mVal = avg3mQty * (s3.qty > 0 ? s3.val / s3.qty : avgRate);

        const s1 = (partNoKey && sales1yMap.get(partNoKey)) || sales1yMap.get(descriptionKey) || { qty: 0, val: 0 };
        const avg1yQtyRaw = s1.qty / 12;
        const avg1yQty = roundToTen(avg1yQtyRaw);
        const avg1yVal = avg1yQty * (s1.qty > 0 ? s1.val / s1.qty : avgRate);

        // Comparison
        const diffQty = avg3mQty - avg1yQty;
        const growthPct = avg1yQty > 0 ? (diffQty / avg1yQty) * 100 : 0;

        // Stock Levels (Based on 1Y Avg)
        const minStock = avg1yQty; // Min is Avg Annual (Monthly)
        const minStockVal = minStock * avgRate;

        const reorderStock = roundToTen(avg1yQtyRaw * 1.5);
        const reorderStockVal = reorderStock * avgRate;

        const maxStock = roundToTen(avg1yQtyRaw * 3); // Using 3x to create a logical ceiling above reorder
        const maxStockVal = maxStock * avgRate;

        // --- Actionable Logic ---
        
        // 1. Excess Stock: If Closing > (SO + Max)
        const excessStockThreshold = so.qty + maxStock;
        const excessStockQty = Math.max(0, stock.qty - excessStockThreshold);
        const excessStockVal = excessStockQty * avgRate;

        // 2. Excess PO: If Net > Max (i.e., we are bringing in too much)
        const excessPOQty = Math.max(0, netQty - maxStock);
        const excessPOVal = excessPOQty * avgRate;

        // 3. PO Need to Place: If Net < Max (Targeting Max Stock)
        // Only trigger if Net is below Reorder level to be realistic, but prompt implies simple logic
        const deficit = maxStock - netQty;
        const poNeedQty = deficit > 0 ? deficit : 0;
        const poNeedVal = poNeedQty * avgRate;

        // 4. PO Exist (Expedite): Pending PO > (Closing - (SO + Max))??
        // Logic Interpretation: Do we have POs that need to be rushed because Closing Stock is dangerously low?
        // Let's use: Amount of Pending PO that is required to fill the gap between Closing and Max.
        // Gap = Max - (Closing - SO). 
        // Expedite = Min(Pending PO, Gap).
        const immediateGap = (so.qty + maxStock) - stock.qty;
        const expediteQty = (immediateGap > 0 && po.qty > 0) ? Math.min(po.qty, immediateGap) : 0;
        const expediteVal = expediteQty * avgRate;

        return {
            ...mat,
            stock, so, po, net: { qty: netQty, val: netVal },
            avg3m: { qty: avg3mQty, val: avg3mVal },
            avg1y: { qty: avg1yQty, val: avg1yVal },
            growth: { diff: diffQty, pct: growthPct },
            levels: { 
                min: { qty: minStock, val: minStockVal }, 
                reorder: { qty: reorderStock, val: reorderStockVal }, 
                max: { qty: maxStock, val: maxStockVal } 
            },
            actions: {
                excessStock: { qty: excessStockQty, val: excessStockVal },
                excessPO: { qty: excessPOQty, val: excessPOVal },
                poNeed: { qty: poNeedQty, val: poNeedVal },
                expedite: { qty: expediteQty, val: expediteVal }
            }
        };
    });
  }, [materials, closingStock, pendingSO, pendingPO, salesReportItems]);

  // --- Filtering & Sorting ---
  const filteredData = useMemo(() => {
      let data = pivotData;
      
      // Text Search
      if (searchTerm) {
          const lower = searchTerm.toLowerCase();
          data = data.filter(i => 
              i.description.toLowerCase().includes(lower) || 
              i.make.toLowerCase().includes(lower) ||
              i.materialGroup.toLowerCase().includes(lower)
          );
      }

      // Type Filter
      if (filterType === 'ACTION') {
          data = data.filter(i => i.actions.poNeed.qty > 0 || i.actions.expedite.qty > 0);
      } else if (filterType === 'EXCESS') {
          data = data.filter(i => i.actions.excessStock.qty > 0 || i.actions.excessPO.qty > 0);
      }

      return data;
  }, [pivotData, searchTerm, filterType]);

  // --- Export ---
  const handleExport = () => {
      const exportRows = filteredData.map(i => ({
          "Make": i.make,
          "Group": i.materialGroup,
          "Description": i.description,
          "Closing Qty": i.stock.qty, "Closing Val": i.stock.val,
          "Pending SO Qty": i.so.qty, "Pending SO Val": i.so.val,
          "Pending PO Qty": i.po.qty, "Pending PO Val": i.po.val,
          "Net Stock Qty": i.net.qty, "Net Stock Val": i.net.val,
          "3M Avg Qty": i.avg3m.qty, "3M Avg Val": i.avg3m.val,
          "1Y Avg Qty": i.avg1y.qty, "1Y Avg Val": i.avg1y.val,
          "Growth %": i.growth.pct.toFixed(1) + '%',
          "Min Qty": i.levels.min.qty, "Min Val": i.levels.min.val,
          "Reorder Qty": i.levels.reorder.qty, "Reorder Val": i.levels.reorder.val,
          "Max Qty": i.levels.max.qty, "Max Val": i.levels.max.val,
          "Excess Stock Qty": i.actions.excessStock.qty, "Excess Stock Val": i.actions.excessStock.val,
          "Excess PO Qty": i.actions.excessPO.qty, "Excess PO Val": i.actions.excessPO.val,
          "Need to Place Qty": i.actions.poNeed.qty, "Need to Place Val": i.actions.poNeed.val,
          "Expedite PO Qty": i.actions.expedite.qty, "Expedite PO Val": i.actions.expedite.val
      }));
      const ws = utils.json_to_sheet(exportRows);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Pivot_Report");
      writeFile(wb, "Pivot_Inventory_Report.xlsx");
  };

  const formatVal = (v: number) => Math.round(v).toLocaleString('en-IN');

  return (
    <div className="flex flex-col h-full gap-4">
        
        {/* Toolbar */}
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4 flex-shrink-0">
            <div className="flex items-center gap-3">
                <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600"><Filter className="w-5 h-5" /></div>
                <div>
                    <h2 className="text-sm font-bold text-gray-800">Pivot Strategy Report</h2>
                    <p className="text-[10px] text-gray-500">{filteredData.length} records analyzed</p>
                </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-3.5 w-3.5 text-gray-400" /></div>
                    <input type="text" placeholder="Search..." className="pl-9 pr-3 py-1.5 w-full border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setFilterType('ALL')} className={`px-3 py-1 text-[10px] font-bold rounded ${filterType === 'ALL' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>All</button>
                    <button onClick={() => setFilterType('ACTION')} className={`px-3 py-1 text-[10px] font-bold rounded ${filterType === 'ACTION' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Actions</button>
                    <button onClick={() => setFilterType('EXCESS')} className={`px-3 py-1 text-[10px] font-bold rounded ${filterType === 'EXCESS' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>Excess</button>
                </div>

                <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold border border-green-100 hover:bg-green-100">
                    <FileDown className="w-3.5 h-3.5" /> Export
                </button>
            </div>
        </div>

        {/* Dense Pivot Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col min-h-0 relative">
            <div className="overflow-auto h-full w-full">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-20 bg-gray-50 shadow-sm text-[9px] font-bold text-gray-600 uppercase tracking-tight">
                        {/* Group Headers */}
                        <tr className="bg-gray-100 border-b border-gray-200">
                            <th colSpan={3} className="py-1 px-2 text-center border-r border-gray-300">Master Data</th>
                            <th colSpan={2} className="py-1 px-2 text-center border-r border-gray-300 bg-blue-50/50">Current Stock</th>
                            <th colSpan={2} className="py-1 px-2 text-center border-r border-gray-300 bg-orange-50/50">Pending SO</th>
                            <th colSpan={2} className="py-1 px-2 text-center border-r border-gray-300 bg-purple-50/50">Pending PO</th>
                            <th colSpan={2} className="py-1 px-2 text-center border-r border-gray-300 bg-gray-200">Net Position</th>
                            <th colSpan={3} className="py-1 px-2 text-center border-r border-gray-300 bg-yellow-50/50">Sales Performance</th>
                            <th colSpan={6} className="py-1 px-2 text-center border-r border-gray-300 bg-teal-50/50">Stock Norms</th>
                            <th colSpan={2} className="py-1 px-2 text-center border-r border-gray-300 bg-red-50 text-red-700">Excess Stock</th>
                            <th colSpan={2} className="py-1 px-2 text-center border-r border-gray-300 bg-red-50 text-red-700">Excess PO</th>
                            <th colSpan={2} className="py-1 px-2 text-center border-r border-gray-300 bg-green-50 text-green-700">PO Needed</th>
                            <th colSpan={2} className="py-1 px-2 text-center bg-blue-50 text-blue-700">Expedite</th>
                        </tr>
                        {/* Sub Headers */}
                        <tr className="border-b border-gray-200">
                            <th className="py-2 px-2 border-r whitespace-nowrap w-24">Make</th>
                            <th className="py-2 px-2 border-r whitespace-nowrap w-24">Group</th>
                            <th className="py-2 px-2 border-r whitespace-nowrap min-w-[200px]">Description</th>
                            
                            <th className="py-2 px-2 text-right bg-blue-50/30">Qty</th>
                            <th className="py-2 px-2 text-right border-r bg-blue-50/30">Val</th>
                            
                            <th className="py-2 px-2 text-right bg-orange-50/30">Qty</th>
                            <th className="py-2 px-2 text-right border-r bg-orange-50/30">Val</th>
                            
                            <th className="py-2 px-2 text-right bg-purple-50/30">Qty</th>
                            <th className="py-2 px-2 text-right border-r bg-purple-50/30">Val</th>
                            
                            <th className="py-2 px-2 text-right bg-gray-100 font-extrabold">Qty</th>
                            <th className="py-2 px-2 text-right border-r bg-gray-100 font-extrabold">Val</th>
                            
                            <th className="py-2 px-2 text-right bg-yellow-50/30">3M Avg</th>
                            <th className="py-2 px-2 text-right bg-yellow-50/30">1Y Avg</th>
                            <th className="py-2 px-2 text-center border-r bg-yellow-50/30">Trend</th>
                            
                            <th className="py-2 px-2 text-right bg-teal-50/30">Min Qty</th>
                            <th className="py-2 px-2 text-right border-r bg-teal-50/30">Min Val</th>
                            <th className="py-2 px-2 text-right bg-teal-50/30">Reorder Qty</th>
                            <th className="py-2 px-2 text-right border-r bg-teal-50/30">Reorder Val</th>
                            <th className="py-2 px-2 text-right bg-teal-50/30">Max Qty</th>
                            <th className="py-2 px-2 text-right border-r bg-teal-50/30">Max Val</th>
                            
                            <th className="py-2 px-2 text-right bg-red-50/50">Qty</th>
                            <th className="py-2 px-2 text-right border-r bg-red-50/50">Val</th>
                            
                            <th className="py-2 px-2 text-right bg-red-50/50">Qty</th>
                            <th className="py-2 px-2 text-right border-r bg-red-50/50">Val</th>
                            
                            <th className="py-2 px-2 text-right bg-green-50/50">Qty</th>
                            <th className="py-2 px-2 text-right border-r bg-green-50/50">Val</th>
                            
                            <th className="py-2 px-2 text-right bg-blue-50/50">Qty</th>
                            <th className="py-2 px-2 text-right bg-blue-50/50">Val</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-[10px] text-gray-700">
                        {filteredData.length === 0 ? (
                            <tr><td colSpan={29} className="py-10 text-center text-gray-400">No data matches your filter.</td></tr>
                        ) : (
                            filteredData.map((row, idx) => (
                                <tr key={row.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="py-1 px-2 border-r truncate max-w-[100px]">{row.make}</td>
                                    <td className="py-1 px-2 border-r truncate max-w-[100px]">{row.materialGroup}</td>
                                    <td className="py-1 px-2 border-r truncate max-w-[250px] font-medium text-gray-900" title={row.description}>{row.description}</td>
                                    
                                    <td className="py-1 px-2 text-right bg-blue-50/10 font-medium">{row.stock.qty || '-'}</td>
                                    <td className="py-1 px-2 text-right border-r bg-blue-50/10 text-gray-500">{row.stock.val ? formatVal(row.stock.val) : '-'}</td>
                                    
                                    <td className="py-1 px-2 text-right bg-orange-50/10">{row.so.qty || '-'}</td>
                                    <td className="py-1 px-2 text-right border-r bg-orange-50/10 text-gray-500">{row.so.val ? formatVal(row.so.val) : '-'}</td>
                                    
                                    <td className="py-1 px-2 text-right bg-purple-50/10">{row.po.qty || '-'}</td>
                                    <td className="py-1 px-2 text-right border-r bg-purple-50/10 text-gray-500">{row.po.val ? formatVal(row.po.val) : '-'}</td>
                                    
                                    <td className="py-1 px-2 text-right bg-gray-50 font-bold">{row.net.qty}</td>
                                    <td className="py-1 px-2 text-right border-r bg-gray-50 text-gray-600">{formatVal(row.net.val)}</td>
                                    
                                    <td className="py-1 px-2 text-right bg-yellow-50/10">{row.avg3m.qty}</td>
                                    <td className="py-1 px-2 text-right bg-yellow-50/10">{row.avg1y.qty}</td>
                                    <td className="py-1 px-2 text-center border-r bg-yellow-50/10">
                                        <div className="flex items-center justify-center gap-0.5">
                                            {row.growth.diff > 0 ? <ArrowUp className="w-2.5 h-2.5 text-green-500" /> : row.growth.diff < 0 ? <ArrowDown className="w-2.5 h-2.5 text-red-500" /> : <Minus className="w-2.5 h-2.5 text-gray-300" />}
                                            <span className={`${row.growth.diff > 0 ? 'text-green-600' : row.growth.diff < 0 ? 'text-red-600' : 'text-gray-400'}`}>{Math.round(Math.abs(row.growth.pct))}%</span>
                                        </div>
                                    </td>
                                    
                                    <td className="py-1 px-2 text-right bg-teal-50/10 text-gray-500">{row.levels.min.qty}</td>
                                    <td className="py-1 px-2 text-right border-r bg-teal-50/10 text-gray-400">{formatVal(row.levels.min.val)}</td>
                                    <td className="py-1 px-2 text-right bg-teal-50/10 font-medium text-teal-700">{row.levels.reorder.qty}</td>
                                    <td className="py-1 px-2 text-right border-r bg-teal-50/10 text-teal-600">{formatVal(row.levels.reorder.val)}</td>
                                    <td className="py-1 px-2 text-right bg-teal-50/10 text-gray-500">{row.levels.max.qty}</td>
                                    <td className="py-1 px-2 text-right border-r bg-teal-50/10 text-gray-400">{formatVal(row.levels.max.val)}</td>
                                    
                                    <td className="py-1 px-2 text-right bg-red-50/20 font-bold text-red-600">{row.actions.excessStock.qty || ''}</td>
                                    <td className="py-1 px-2 text-right border-r bg-red-50/20 text-red-400">{row.actions.excessStock.val ? formatVal(row.actions.excessStock.val) : ''}</td>
                                    
                                    <td className="py-1 px-2 text-right bg-red-50/20 font-bold text-red-600">{row.actions.excessPO.qty || ''}</td>
                                    <td className="py-1 px-2 text-right border-r bg-red-50/20 text-red-400">{row.actions.excessPO.val ? formatVal(row.actions.excessPO.val) : ''}</td>
                                    
                                    <td className="py-1 px-2 text-right bg-green-50/20 font-bold text-green-600">{row.actions.poNeed.qty || ''}</td>
                                    <td className="py-1 px-2 text-right border-r bg-green-50/20 text-green-400">{row.actions.poNeed.val ? formatVal(row.actions.poNeed.val) : ''}</td>
                                    
                                    <td className="py-1 px-2 text-right bg-blue-50/20 font-bold text-blue-600">{row.actions.expedite.qty || ''}</td>
                                    <td className="py-1 px-2 text-right bg-blue-50/20 text-blue-400">{row.actions.expedite.val ? formatVal(row.actions.expedite.val) : ''}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default PivotReportView;
