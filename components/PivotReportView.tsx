
import React, { useMemo, useState } from 'react';
import { Material, ClosingStockItem, PendingSOItem, PendingPOItem, SalesReportItem } from '../types';
import { FileDown, Search, ArrowUp, ArrowDown, Filter, AlertTriangle, Minus, ArrowUpDown, Layers } from 'lucide-react';
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

// --- Helper: Format Large Values ---
const formatLargeValue = (val: number) => {
    if (val === 0) return '-';
    const absVal = Math.abs(val);
    if (absVal >= 10000000) return `${(val / 10000000).toFixed(2)} Cr`;
    if (absVal >= 100000) return `${(val / 100000).toFixed(2)} L`;
    return Math.round(val).toLocaleString('en-IN');
};

const PivotReportView: React.FC<PivotReportViewProps> = ({
  materials,
  closingStock,
  pendingSO,
  pendingPO,
  salesReportItems
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Slicers
  const [slicerMake, setSlicerMake] = useState('ALL');
  const [slicerGroup, setSlicerGroup] = useState('ALL');

  // Toggles
  const [showExcessStock, setShowExcessStock] = useState(false);
  const [showExcessPO, setShowExcessPO] = useState(false);
  const [showPONeed, setShowPONeed] = useState(false);
  const [showExpedite, setShowExpedite] = useState(false);

  // Sorting
  const [sortOption, setSortOption] = useState<string>('default'); // default, stockVal, poNeedVal, excessStockVal, etc.

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

    // 3. Build Rows
    const rawRows = materials.map(mat => {
        const descriptionKey = mat.description.toLowerCase().trim();
        const partNoKey = mat.partNo ? mat.partNo.toLowerCase().trim() : '';
        
        const stock = stockMap.get(descriptionKey) || { qty: 0, val: 0 };
        const so = soMap.get(descriptionKey) || { qty: 0, val: 0 };
        const po = poMap.get(descriptionKey) || { qty: 0, val: 0 };
        
        const netQty = stock.qty + po.qty - so.qty;
        
        // Estimate Rate
        let avgRate = 0;
        if (stock.qty > 0) avgRate = stock.val / stock.qty;
        else if (po.qty > 0) avgRate = po.val / po.qty;
        else if (so.qty > 0) avgRate = so.val / so.qty;

        const netVal = netQty * avgRate;

        // Sales Averages (Prioritize Part No Match)
        const s3 = (partNoKey && sales3mMap.get(partNoKey)) || sales3mMap.get(descriptionKey) || { qty: 0, val: 0 };
        const avg3mQtyRaw = s3.qty / 3;
        const avg3mQty = roundToTen(avg3mQtyRaw);
        const avg3mVal = avg3mQty * (s3.qty > 0 ? s3.val / s3.qty : avgRate);

        const s1 = (partNoKey && sales1yMap.get(partNoKey)) || sales1yMap.get(descriptionKey) || { qty: 0, val: 0 };
        const avg1yQtyRaw = s1.qty / 12;
        const avg1yQty = roundToTen(avg1yQtyRaw);
        const avg1yVal = avg1yQty * (s1.qty > 0 ? s1.val / s1.qty : avgRate);

        const diffQty = avg3mQty - avg1yQty;
        const growthPct = avg1yQty > 0 ? (diffQty / avg1yQty) * 100 : 0;

        // Stock Norms
        const minStock = avg1yQty;
        const minStockVal = minStock * avgRate;
        const reorderStock = roundToTen(avg1yQtyRaw * 1.5);
        const reorderStockVal = reorderStock * avgRate;
        const maxStock = roundToTen(avg1yQtyRaw * 3);
        const maxStockVal = maxStock * avgRate;

        // Actions
        const excessStockThreshold = so.qty + maxStock;
        const excessStockQty = Math.max(0, stock.qty - excessStockThreshold);
        const excessStockVal = excessStockQty * avgRate;

        const excessPOQty = Math.max(0, netQty - maxStock);
        const excessPOVal = excessPOQty * avgRate;

        const deficit = maxStock - netQty;
        const poNeedQty = deficit > 0 ? deficit : 0;
        const poNeedVal = poNeedQty * avgRate;

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

    // Only show items with some activity (Stock, SO, PO) or Action Needed
    return rawRows.filter(item => 
        item.stock.qty > 0 || 
        item.so.qty > 0 || 
        item.po.qty > 0 || 
        item.actions.poNeed.qty > 0 ||
        item.actions.expedite.qty > 0
    );

  }, [materials, closingStock, pendingSO, pendingPO, salesReportItems]);

  // --- Slicer Data ---
  const slicerOptions = useMemo(() => {
      const makes = new Set<string>();
      const groups = new Set<string>();
      pivotData.forEach(i => {
          if (i.make) makes.add(i.make);
          if (i.materialGroup) groups.add(i.materialGroup);
      });
      return {
          makes: ['ALL', ...Array.from(makes).sort()],
          groups: ['ALL', ...Array.from(groups).sort()]
      };
  }, [pivotData]);

  // --- Filtering & Sorting ---
  const filteredData = useMemo(() => {
      let data = pivotData;
      
      // Slicers
      if (slicerMake !== 'ALL') data = data.filter(i => i.make === slicerMake);
      if (slicerGroup !== 'ALL') data = data.filter(i => i.materialGroup === slicerGroup);

      // Search
      if (searchTerm) {
          const lower = searchTerm.toLowerCase();
          data = data.filter(i => 
              i.description.toLowerCase().includes(lower) || 
              i.make.toLowerCase().includes(lower) ||
              i.materialGroup.toLowerCase().includes(lower)
          );
      }

      // Toggles (OR Logic)
      const hasToggle = showExcessStock || showExcessPO || showPONeed || showExpedite;
      if (hasToggle) {
          data = data.filter(i => 
              (showExcessStock && i.actions.excessStock.qty > 0) ||
              (showExcessPO && i.actions.excessPO.qty > 0) ||
              (showPONeed && i.actions.poNeed.qty > 0) ||
              (showExpedite && i.actions.expedite.qty > 0)
          );
      }

      // Sorting
      const sortFn = (a: typeof data[0], b: typeof data[0]) => {
          switch (sortOption) {
              case 'stockVal': return b.stock.val - a.stock.val;
              case 'poNeedVal': return b.actions.poNeed.val - a.actions.poNeed.val;
              case 'excessStockVal': return b.actions.excessStock.val - a.actions.excessStock.val;
              case 'excessPOVal': return b.actions.excessPO.val - a.actions.excessPO.val;
              case 'expediteVal': return b.actions.expedite.val - a.actions.expedite.val;
              case 'netVal': return b.net.val - a.net.val;
              default: return 0; // Default Master order
          }
      };
      
      if (sortOption !== 'default') {
          data = [...data].sort(sortFn);
      }

      return data;
  }, [pivotData, searchTerm, slicerMake, slicerGroup, showExcessStock, showExcessPO, showPONeed, showExpedite, sortOption]);

  // --- Totals ---
  const totals = useMemo(() => {
      return filteredData.reduce((acc, row) => ({
          stock: { qty: acc.stock.qty + row.stock.qty, val: acc.stock.val + row.stock.val },
          so: { qty: acc.so.qty + row.so.qty, val: acc.so.val + row.so.val },
          po: { qty: acc.po.qty + row.po.qty, val: acc.po.val + row.po.val },
          net: { qty: acc.net.qty + row.net.qty, val: acc.net.val + row.net.val },
          avg3m: { qty: acc.avg3m.qty + row.avg3m.qty, val: acc.avg3m.val + row.avg3m.val },
          avg1y: { qty: acc.avg1y.qty + row.avg1y.qty, val: acc.avg1y.val + row.avg1y.val },
          min: { qty: acc.min.qty + row.levels.min.qty, val: acc.min.val + row.levels.min.val },
          reorder: { qty: acc.reorder.qty + row.levels.reorder.qty, val: acc.reorder.val + row.levels.reorder.val },
          max: { qty: acc.max.qty + row.levels.max.qty, val: acc.max.val + row.levels.max.val },
          excessStock: { qty: acc.excessStock.qty + row.actions.excessStock.qty, val: acc.excessStock.val + row.actions.excessStock.val },
          excessPO: { qty: acc.excessPO.qty + row.actions.excessPO.qty, val: acc.excessPO.val + row.actions.excessPO.val },
          poNeed: { qty: acc.poNeed.qty + row.actions.poNeed.qty, val: acc.poNeed.val + row.actions.poNeed.val },
          expedite: { qty: acc.expedite.qty + row.actions.expedite.qty, val: acc.expedite.val + row.actions.expedite.val },
      }), {
          stock: { qty: 0, val: 0 }, so: { qty: 0, val: 0 }, po: { qty: 0, val: 0 }, net: { qty: 0, val: 0 },
          avg3m: { qty: 0, val: 0 }, avg1y: { qty: 0, val: 0 },
          min: { qty: 0, val: 0 }, reorder: { qty: 0, val: 0 }, max: { qty: 0, val: 0 },
          excessStock: { qty: 0, val: 0 }, excessPO: { qty: 0, val: 0 }, poNeed: { qty: 0, val: 0 }, expedite: { qty: 0, val: 0 }
      });
  }, [filteredData]);

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
    <div className="flex flex-col h-full gap-3">
        
        {/* Toolbar */}
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-3 flex-shrink-0">
            {/* Top Row: Title, Search, Export */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600"><Filter className="w-5 h-5" /></div>
                    <div>
                        <h2 className="text-sm font-bold text-gray-800">Pivot Strategy Report</h2>
                        <p className="text-[10px] text-gray-500">{filteredData.length} active items (Hidden: Inactive/Empty)</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-3.5 w-3.5 text-gray-400" /></div>
                        <input type="text" placeholder="Search..." className="pl-9 pr-3 py-1.5 w-full border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold border border-green-100 hover:bg-green-100 whitespace-nowrap">
                        <FileDown className="w-3.5 h-3.5" /> Export
                    </button>
                </div>
            </div>

            {/* Bottom Row: Slicers, Toggles, Sort */}
            <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 pt-3">
                
                {/* Slicers */}
                <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-lg border border-gray-200">
                    <Layers className="w-3.5 h-3.5 text-gray-500" />
                    <div className="flex flex-col">
                        <label className="text-[9px] font-bold text-gray-400 uppercase">Make</label>
                        <select value={slicerMake} onChange={e => setSlicerMake(e.target.value)} className="bg-transparent text-xs font-bold text-gray-700 outline-none w-24">
                            {slicerOptions.makes.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div className="w-px h-6 bg-gray-300 mx-1"></div>
                    <div className="flex flex-col">
                        <label className="text-[9px] font-bold text-gray-400 uppercase">Group</label>
                        <select value={slicerGroup} onChange={e => setSlicerGroup(e.target.value)} className="bg-transparent text-xs font-bold text-gray-700 outline-none w-24">
                            {slicerOptions.groups.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>
                </div>

                {/* Toggles */}
                <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setShowExcessStock(!showExcessStock)} className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${showExcessStock ? 'bg-red-50 text-red-700 border-red-200 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>Excess Stock</button>
                    <button onClick={() => setShowExcessPO(!showExcessPO)} className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${showExcessPO ? 'bg-orange-50 text-orange-700 border-orange-200 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>Excess PO</button>
                    <button onClick={() => setShowPONeed(!showPONeed)} className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${showPONeed ? 'bg-green-50 text-green-700 border-green-200 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>PO Need</button>
                    <button onClick={() => setShowExpedite(!showExpedite)} className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${showExpedite ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>Expedite</button>
                </div>

                {/* Sort */}
                <div className="ml-auto flex items-center gap-2">
                    <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
                    <select value={sortOption} onChange={(e) => setSortOption(e.target.value)} className="bg-white border border-gray-300 text-xs rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500">
                        <option value="default">Default Sort</option>
                        <option value="stockVal">Highest Stock Val</option>
                        <option value="netVal">Highest Net Val</option>
                        <option value="poNeedVal">Highest PO Need Val</option>
                        <option value="excessStockVal">Highest Excess Stock Val</option>
                        <option value="excessPOVal">Highest Excess PO Val</option>
                        <option value="expediteVal">Highest Expedite Val</option>
                    </select>
                </div>
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
                        {/* TOTALS ROW */}
                        {filteredData.length > 0 && (
                            <tr className="bg-yellow-50 font-bold border-b-2 border-yellow-200 text-gray-900 sticky top-[62px] z-10 shadow-sm">
                                <td colSpan={3} className="py-2 px-2 text-right border-r uppercase text-[9px] tracking-wide text-gray-500">Filtered Totals:</td>
                                
                                <td className="py-2 px-2 text-right bg-blue-100/50">{formatLargeValue(totals.stock.qty)}</td>
                                <td className="py-2 px-2 text-right border-r bg-blue-100/50">{formatLargeValue(totals.stock.val)}</td>
                                
                                <td className="py-2 px-2 text-right bg-orange-100/50">{formatLargeValue(totals.so.qty)}</td>
                                <td className="py-2 px-2 text-right border-r bg-orange-100/50">{formatLargeValue(totals.so.val)}</td>
                                
                                <td className="py-2 px-2 text-right bg-purple-100/50">{formatLargeValue(totals.po.qty)}</td>
                                <td className="py-2 px-2 text-right border-r bg-purple-100/50">{formatLargeValue(totals.po.val)}</td>
                                
                                <td className="py-2 px-2 text-right bg-gray-200">{formatLargeValue(totals.net.qty)}</td>
                                <td className="py-2 px-2 text-right border-r bg-gray-200">{formatLargeValue(totals.net.val)}</td>
                                
                                <td className="py-2 px-2 text-right bg-yellow-100/50">{formatLargeValue(totals.avg3m.qty)}</td>
                                <td className="py-2 px-2 text-right bg-yellow-100/50">{formatLargeValue(totals.avg1y.qty)}</td>
                                <td className="py-2 px-2 text-center border-r bg-yellow-100/50">-</td>
                                
                                <td className="py-2 px-2 text-right bg-teal-100/50">{formatLargeValue(totals.min.qty)}</td>
                                <td className="py-2 px-2 text-right border-r bg-teal-100/50">{formatLargeValue(totals.min.val)}</td>
                                <td className="py-2 px-2 text-right bg-teal-100/50">{formatLargeValue(totals.reorder.qty)}</td>
                                <td className="py-2 px-2 text-right border-r bg-teal-100/50">{formatLargeValue(totals.reorder.val)}</td>
                                <td className="py-2 px-2 text-right bg-teal-100/50">{formatLargeValue(totals.max.qty)}</td>
                                <td className="py-2 px-2 text-right border-r bg-teal-100/50">{formatLargeValue(totals.max.val)}</td>
                                
                                <td className="py-2 px-2 text-right bg-red-100/50 text-red-800">{formatLargeValue(totals.excessStock.qty)}</td>
                                <td className="py-2 px-2 text-right border-r bg-red-100/50 text-red-800">{formatLargeValue(totals.excessStock.val)}</td>
                                
                                <td className="py-2 px-2 text-right bg-red-100/50 text-red-800">{formatLargeValue(totals.excessPO.qty)}</td>
                                <td className="py-2 px-2 text-right border-r bg-red-100/50 text-red-800">{formatLargeValue(totals.excessPO.val)}</td>
                                
                                <td className="py-2 px-2 text-right bg-green-100/50 text-green-800">{formatLargeValue(totals.poNeed.qty)}</td>
                                <td className="py-2 px-2 text-right border-r bg-green-100/50 text-green-800">{formatLargeValue(totals.poNeed.val)}</td>
                                
                                <td className="py-2 px-2 text-right bg-blue-100/50 text-blue-800">{formatLargeValue(totals.expedite.qty)}</td>
                                <td className="py-2 px-2 text-right bg-blue-100/50 text-blue-800">{formatLargeValue(totals.expedite.val)}</td>
                            </tr>
                        )}

                        {filteredData.length === 0 ? (
                            <tr><td colSpan={29} className="py-10 text-center text-gray-400">No active items match your filter.</td></tr>
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
