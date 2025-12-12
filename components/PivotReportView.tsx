
import React, { useMemo, useState } from 'react';
import { Material, ClosingStockItem, PendingSOItem, PendingPOItem, SalesReportItem } from '../types';
import { FileDown, Search, ArrowUp, ArrowDown, Filter, AlertTriangle, Minus, ArrowUpDown, Layers, AlignLeft } from 'lucide-react';
import { utils, writeFile } from 'xlsx';

interface PivotReportViewProps {
  materials: Material[];
  closingStock: ClosingStockItem[];
  pendingSO: PendingSOItem[];
  pendingPO: PendingPOItem[];
  salesReportItems: SalesReportItem[];
}

// --- Groups allowed for Stock Planning ---
const PLANNED_STOCK_GROUPS = new Set([
  "eaton-ace",
  "eaton-biesse",
  "eaton-coffee day",
  "eaton-enrx pvt ltd",
  "eaton-eta technology",
  "eaton-faively",
  "eaton-planned stock specific customer",
  "eaton-probat india",
  "eaton-rinac",
  "eaton-schenck process",
  "eaton-planned stock general",
  "hager-incap contracting",
  "lapp-ace group",
  "lapp-ams group",
  "lapp-disa india",
  "lapp-engineered customized control",
  "lapp-kennametal",
  "lapp-planned stock general",
  "lapp-rinac",
  "lapp-titan"
]);

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

// --- Helper: Robust Date Parsing ---
const parseDate = (val: any): Date => {
    if (!val) return new Date(0); // Return epoch if invalid
    if (val instanceof Date) return val;
    if (typeof val === 'number') {
        // Excel serial date conversion
        return new Date((val - (25567 + 2)) * 86400 * 1000);
    }
    if (typeof val === 'string') {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d;
        // Try DD-MM-YYYY or DD/MM/YYYY common in exports
        const parts = val.split(/[-/.]/);
        if (parts.length === 3) {
             // Try assuming DD-MM-YYYY first (common in IN/UK)
             const d2 = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
             if (!isNaN(d2.getTime())) return d2;
        }
    }
    return new Date(0);
};

// --- Type for Sort Keys ---
type SortPath = 
  | 'description' | 'make' | 'materialGroup'
  | 'stock.qty' | 'stock.val'
  | 'so.qty' | 'so.val'
  | 'po.qty' | 'po.val'
  | 'net.qty' | 'net.val'
  | 'avg3m.qty' | 'avg3m.val'
  | 'avg1y.qty' | 'avg1y.val'
  | 'growth.pct'
  | 'levels.min.qty' | 'levels.min.val'
  | 'levels.reorder.qty' | 'levels.reorder.val'
  | 'levels.max.qty' | 'levels.max.val'
  | 'actions.excessStock.qty' | 'actions.excessStock.val'
  | 'actions.excessPO.qty' | 'actions.excessPO.val'
  | 'actions.poNeed.qty' | 'actions.poNeed.val'
  | 'actions.expedite.qty' | 'actions.expedite.val';

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
  const [filterDescription, setFilterDescription] = useState('');

  // Toggles
  const [showExcessStock, setShowExcessStock] = useState(false);
  const [showExcessPO, setShowExcessPO] = useState(false);
  const [showPONeed, setShowPONeed] = useState(false);
  const [showExpedite, setShowExpedite] = useState(false);

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: SortPath; direction: 'asc' | 'desc' }>({ 
      key: 'stock.val', 
      direction: 'desc' 
  });

  // --- Core Calculation Logic ---
  const pivotData = useMemo(() => {
    // 1. Create Index Maps for fast lookup
    const stockMap = new Map<string, { qty: number; val: number }>();
    closingStock.forEach(i => {
        if (!i.description) return;
        const key = i.description.toLowerCase().trim();
        const existing = stockMap.get(key) || { qty: 0, val: 0 };
        stockMap.set(key, { qty: existing.qty + (i.quantity || 0), val: existing.val + (i.value || 0) });
    });

    const soMap = new Map<string, { qty: number; val: number }>();
    pendingSO.forEach(i => {
        if (!i.itemName) return;
        const key = i.itemName.toLowerCase().trim();
        const existing = soMap.get(key) || { qty: 0, val: 0 };
        const val = (i.balanceQty || 0) * (i.rate || 0);
        soMap.set(key, { qty: existing.qty + (i.balanceQty || 0), val: existing.val + val });
    });

    const poMap = new Map<string, { qty: number; val: number }>();
    pendingPO.forEach(i => {
        if (!i.itemName) return;
        const key = i.itemName.toLowerCase().trim();
        const existing = poMap.get(key) || { qty: 0, val: 0 };
        const val = (i.balanceQty || 0) * (i.rate || 0);
        poMap.set(key, { qty: existing.qty + (i.balanceQty || 0), val: existing.val + val });
    });

    // 2. Date Ranges for Sales
    const now = new Date();
    const threeMonthsAgo = new Date(); 
    threeMonthsAgo.setMonth(now.getMonth() - 3);
    const oneYearAgo = new Date(); 
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    const sales3mMap = new Map<string, { qty: number; val: number }>();
    const sales1yMap = new Map<string, { qty: number; val: number }>();

    salesReportItems.forEach(i => {
        if (!i.particulars) return;
        const key = i.particulars.toLowerCase().trim();
        const d = parseDate(i.date);
        
        // 1 Year Data
        if (d >= oneYearAgo) {
            const ex1 = sales1yMap.get(key) || { qty: 0, val: 0 };
            sales1yMap.set(key, { qty: ex1.qty + (i.quantity || 0), val: ex1.val + (i.value || 0) });

            // 3 Months Data (Subset)
            if (d >= threeMonthsAgo) {
                const ex3 = sales3mMap.get(key) || { qty: 0, val: 0 };
                sales3mMap.set(key, { qty: ex3.qty + (i.quantity || 0), val: ex3.val + (i.value || 0) });
            }
        }
    });

    // 3. Build Rows
    const rawRows = materials.map(mat => {
        const descriptionKey = mat.description ? mat.description.toLowerCase().trim() : '';
        const partNoKey = mat.partNo ? mat.partNo.toLowerCase().trim() : '';
        
        // Normalize Make and Group for consistent filtering
        const normalizedMake = String(mat.make || '').trim() || 'Unspecified';
        const normalizedGroup = String(mat.materialGroup || '').trim() || 'Unspecified';

        const stock = stockMap.get(descriptionKey) || { qty: 0, val: 0 };
        const so = soMap.get(descriptionKey) || { qty: 0, val: 0 };
        const po = poMap.get(descriptionKey) || { qty: 0, val: 0 };
        
        const netQty = stock.qty + po.qty - so.qty;
        
        // Estimate Rate (Stock Valuation Rate)
        let avgRate = 0;
        if (stock.qty > 0) avgRate = stock.val / stock.qty;
        else if (po.qty > 0) avgRate = po.val / po.qty;
        else if (so.qty > 0) avgRate = so.val / so.qty;

        const netVal = netQty * avgRate;

        // Sales Averages (Dual Match Logic: Part No + Description)
        // --- 3 Months ---
        const s3Part = (partNoKey && sales3mMap.get(partNoKey)) || { qty: 0, val: 0 };
        const s3Desc = (descriptionKey && sales3mMap.get(descriptionKey)) || { qty: 0, val: 0 };
        
        let s3TotalQty = 0;
        let s3TotalVal = 0;

        if (partNoKey && descriptionKey && partNoKey !== descriptionKey) {
            s3TotalQty = s3Part.qty + s3Desc.qty;
            s3TotalVal = s3Part.val + s3Desc.val;
        } else {
            // If keys same or one missing, prefer Desc match as primary, fallback to Part
            const bestMatch = s3Desc.qty > 0 ? s3Desc : s3Part;
            s3TotalQty = bestMatch.qty;
            s3TotalVal = bestMatch.val;
        }

        // NO ROUNDING for Sales Averages
        const avg3mQty = s3TotalQty / 3;
        // Determine 3M Rate: Use actual sales rate if available, else fallback to inventory avgRate
        const rate3m = s3TotalQty > 0 ? s3TotalVal / s3TotalQty : avgRate;
        const avg3mVal = avg3mQty * rate3m;

        // --- 1 Year ---
        const s1Part = (partNoKey && sales1yMap.get(partNoKey)) || { qty: 0, val: 0 };
        const s1Desc = (descriptionKey && sales1yMap.get(descriptionKey)) || { qty: 0, val: 0 };

        let s1TotalQty = 0;
        let s1TotalVal = 0;

        if (partNoKey && descriptionKey && partNoKey !== descriptionKey) {
            s1TotalQty = s1Part.qty + s1Desc.qty;
            s1TotalVal = s1Part.val + s1Desc.val;
        } else {
            const bestMatch = s1Desc.qty > 0 ? s1Desc : s1Part;
            s1TotalQty = bestMatch.qty;
            s1TotalVal = bestMatch.val;
        }

        // NO ROUNDING for Sales Averages
        const avg1yQty = s1TotalQty / 12;
        // Determine 1Y Rate: Use actual sales rate if available, else fallback to inventory avgRate
        const rate1y = s1TotalQty > 0 ? s1TotalVal / s1TotalQty : avgRate;
        const avg1yVal = avg1yQty * rate1y;

        const diffQty = avg3mQty - avg1yQty;
        const growthPct = avg1yQty > 0 ? (diffQty / avg1yQty) * 100 : 0;

        // Stock Norms Logic
        // Only apply norms if Material Group is in the allowed list
        const isPlannedStock = PLANNED_STOCK_GROUPS.has(normalizedGroup.toLowerCase());
        
        let minStock = 0;
        let minStockVal = 0;
        let reorderStock = 0;
        let reorderStockVal = 0;
        let maxStock = 0;
        let maxStockVal = 0;

        if (isPlannedStock) {
            // Rules: 
            // 1. Min/Reorder/Max Qty -> Round Up to nearest 10
            // 2. Min/Reorder/Max Val -> Use Sales Rate (rate1y) to determine value
            minStock = roundToTen(avg1yQty);
            minStockVal = minStock * rate1y;
            
            reorderStock = roundToTen(avg1yQty * 1.5);
            reorderStockVal = reorderStock * rate1y;
            
            maxStock = roundToTen(avg1yQty * 3);
            maxStockVal = maxStock * rate1y;
        }

        // Actions
        const excessStockThreshold = so.qty + maxStock;
        const excessStockQty = Math.max(0, stock.qty - excessStockThreshold);
        const excessStockVal = excessStockQty * avgRate; // Use Inventory Rate for Excess Stock Value (as it sits in stock)

        // Fix: Excess PO Logic
        // Calculate Total Excess = (Stock + PO - SO) - Max Stock
        const totalProjectedExcess = Math.max(0, netQty - maxStock);
        // Excess PO = Total Excess - Excess Stock (Only count the PO portion of the excess)
        const excessPOQty = Math.max(0, totalProjectedExcess - excessStockQty);
        const excessPOVal = excessPOQty * avgRate; // Use Inventory Rate (PO rate approx)

        const deficit = maxStock - netQty;
        const poNeedQty = deficit > 0 ? deficit : 0;
        const poNeedVal = poNeedQty * avgRate;

        const immediateGap = (so.qty + maxStock) - stock.qty;
        const expediteQty = (immediateGap > 0 && po.qty > 0) ? Math.min(po.qty, immediateGap) : 0;
        const expediteVal = expediteQty * avgRate;

        return {
            ...mat,
            make: normalizedMake,
            materialGroup: normalizedGroup,
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
        item.actions.expedite.qty > 0 ||
        item.avg3m.qty > 0 || // Include if there's recent sales activity even if no stock
        item.avg1y.qty > 0
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

      // Description Filter (Specific)
      if (filterDescription) {
          const lowerDesc = filterDescription.toLowerCase();
          data = data.filter(i => i.description.toLowerCase().includes(lowerDesc));
      }

      // Search (Global)
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

      // Deep Sort Function
      const getVal = (obj: any, path: string) => {
          return path.split('.').reduce((acc, part) => acc && acc[part] !== undefined ? acc[part] : 0, obj);
      };

      data = [...data].sort((a, b) => {
          const valA = getVal(a, sortConfig.key);
          const valB = getVal(b, sortConfig.key);
          
          if (typeof valA === 'string' && typeof valB === 'string') {
              return sortConfig.direction === 'asc' 
                  ? valA.localeCompare(valB) 
                  : valB.localeCompare(valA);
          }
          
          // Numeric Sort
          return sortConfig.direction === 'asc' 
              ? (Number(valA) - Number(valB)) 
              : (Number(valB) - Number(valA));
      });

      return data;
  }, [pivotData, searchTerm, slicerMake, slicerGroup, filterDescription, showExcessStock, showExcessPO, showPONeed, showExpedite, sortConfig]);

  // --- Totals ---
  // STRICT CALCULATION on filteredData
  const totals = useMemo(() => {
      return filteredData.reduce((acc, row) => ({
          stock: { qty: acc.stock.qty + (Number(row.stock.qty) || 0), val: acc.stock.val + (Number(row.stock.val) || 0) },
          so: { qty: acc.so.qty + (Number(row.so.qty) || 0), val: acc.so.val + (Number(row.so.val) || 0) },
          po: { qty: acc.po.qty + (Number(row.po.qty) || 0), val: acc.po.val + (Number(row.po.val) || 0) },
          net: { qty: acc.net.qty + (Number(row.net.qty) || 0), val: acc.net.val + (Number(row.net.val) || 0) },
          avg3m: { qty: acc.avg3m.qty + (Number(row.avg3m.qty) || 0), val: acc.avg3m.val + (Number(row.avg3m.val) || 0) },
          avg1y: { qty: acc.avg1y.qty + (Number(row.avg1y.qty) || 0), val: acc.avg1y.val + (Number(row.avg1y.val) || 0) },
          min: { qty: acc.min.qty + (Number(row.levels.min.qty) || 0), val: acc.min.val + (Number(row.levels.min.val) || 0) },
          reorder: { qty: acc.reorder.qty + (Number(row.levels.reorder.qty) || 0), val: acc.reorder.val + (Number(row.levels.reorder.val) || 0) },
          max: { qty: acc.max.qty + (Number(row.levels.max.qty) || 0), val: acc.max.val + (Number(row.levels.max.val) || 0) },
          excessStock: { qty: acc.excessStock.qty + (Number(row.actions.excessStock.qty) || 0), val: acc.excessStock.val + (Number(row.actions.excessStock.val) || 0) },
          excessPO: { qty: acc.excessPO.qty + (Number(row.actions.excessPO.qty) || 0), val: acc.excessPO.val + (Number(row.actions.excessPO.val) || 0) },
          poNeed: { qty: acc.poNeed.qty + (Number(row.actions.poNeed.qty) || 0), val: acc.poNeed.val + (Number(row.actions.poNeed.val) || 0) },
          expedite: { qty: acc.expedite.qty + (Number(row.actions.expedite.qty) || 0), val: acc.expedite.val + (Number(row.actions.expedite.val) || 0) },
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
          "3M Avg Qty": i.avg3m.qty.toFixed(2), "3M Avg Val": i.avg3m.val,
          "1Y Avg Qty": i.avg1y.qty.toFixed(2), "1Y Avg Val": i.avg1y.val,
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

  const handleHeaderSort = (key: SortPath) => {
      setSortConfig(current => {
          if (current.key === key) {
              // Toggle direction
              return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
          }
          // Default to DESC for new column (Highest to Lowest)
          return { key, direction: 'desc' };
      });
  };

  const renderSortArrow = (key: SortPath) => {
      if (sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 text-gray-300 opacity-50 group-hover:opacity-100" />;
      return sortConfig.direction === 'asc' 
          ? <ArrowUp className="w-3 h-3 text-indigo-600" /> 
          : <ArrowDown className="w-3 h-3 text-indigo-600" />;
  };

  const formatVal = (v: number) => Math.round(v).toLocaleString('en-IN');
  const formatDec = (v: number) => v.toFixed(2);

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
                        <input type="text" placeholder="Global Search..." className="pl-9 pr-3 py-1.5 w-full border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
                    <div className="w-px h-6 bg-gray-300 mx-1"></div>
                    <div className="flex flex-col">
                        <label className="text-[9px] font-bold text-gray-400 uppercase">Description Contains</label>
                        <div className="flex items-center">
                            <AlignLeft className="w-3 h-3 text-gray-400 mr-1" />
                            <input type="text" placeholder="Filter..." value={filterDescription} onChange={e => setFilterDescription(e.target.value)} className="bg-transparent text-xs font-bold text-gray-700 outline-none w-24 placeholder:font-normal placeholder:text-gray-400" />
                        </div>
                    </div>
                </div>

                {/* Toggles */}
                <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setShowExcessStock(!showExcessStock)} className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${showExcessStock ? 'bg-red-50 text-red-700 border-red-200 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>Excess Stock</button>
                    <button onClick={() => setShowExcessPO(!showExcessPO)} className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${showExcessPO ? 'bg-orange-50 text-orange-700 border-orange-200 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>Excess PO</button>
                    <button onClick={() => setShowPONeed(!showPONeed)} className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${showPONeed ? 'bg-green-50 text-green-700 border-green-200 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>PO Need</button>
                    <button onClick={() => setShowExpedite(!showExpedite)} className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${showExpedite ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>Expedite</button>
                </div>
            </div>
        </div>

        {/* Dense Pivot Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col min-h-0 relative">
            <div className="overflow-auto h-full w-full">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-50 bg-gray-50 shadow-sm text-[9px] font-bold text-gray-600 uppercase tracking-tight select-none">
                        {/* Group Headers */}
                        <tr className="bg-gray-100 border-b border-gray-200">
                            <th colSpan={3} className="sticky left-0 z-50 py-1 px-2 text-center border-r border-gray-300 bg-gray-100">Master Data</th>
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
                        {/* Sub Headers - CLICKABLE FOR SORTING */}
                        <tr className="border-b border-gray-200 cursor-pointer">
                            <th onClick={() => handleHeaderSort('make')} className="sticky left-0 z-50 py-2 px-2 border-r whitespace-nowrap w-24 bg-gray-50 hover:bg-gray-200 group border-b border-gray-200"><div className="flex items-center gap-1">Make {renderSortArrow('make')}</div></th>
                            <th onClick={() => handleHeaderSort('materialGroup')} className="sticky left-[6rem] z-50 py-2 px-2 border-r whitespace-nowrap w-24 bg-gray-50 hover:bg-gray-200 group border-b border-gray-200"><div className="flex items-center gap-1">Group {renderSortArrow('materialGroup')}</div></th>
                            <th onClick={() => handleHeaderSort('description')} className="sticky left-[12rem] z-50 py-2 px-2 border-r whitespace-nowrap min-w-[200px] bg-gray-50 hover:bg-gray-200 group border-b border-gray-200"><div className="flex items-center gap-1">Description {renderSortArrow('description')}</div></th>
                            
                            <th onClick={() => handleHeaderSort('stock.qty')} className="py-2 px-2 text-right bg-blue-50/30 hover:bg-blue-100/50 group"><div className="flex items-center justify-end gap-1">Qty {renderSortArrow('stock.qty')}</div></th>
                            <th onClick={() => handleHeaderSort('stock.val')} className="py-2 px-2 text-right border-r bg-blue-50/30 hover:bg-blue-100/50 group"><div className="flex items-center justify-end gap-1">Val {renderSortArrow('stock.val')}</div></th>
                            
                            <th onClick={() => handleHeaderSort('so.qty')} className="py-2 px-2 text-right bg-orange-50/30 hover:bg-orange-100/50 group"><div className="flex items-center justify-end gap-1">Qty {renderSortArrow('so.qty')}</div></th>
                            <th onClick={() => handleHeaderSort('so.val')} className="py-2 px-2 text-right border-r bg-orange-50/30 hover:bg-orange-100/50 group"><div className="flex items-center justify-end gap-1">Val {renderSortArrow('so.val')}</div></th>
                            
                            <th onClick={() => handleHeaderSort('po.qty')} className="py-2 px-2 text-right bg-purple-50/30 hover:bg-purple-100/50 group"><div className="flex items-center justify-end gap-1">Qty {renderSortArrow('po.qty')}</div></th>
                            <th onClick={() => handleHeaderSort('po.val')} className="py-2 px-2 text-right border-r bg-purple-50/30 hover:bg-purple-100/50 group"><div className="flex items-center justify-end gap-1">Val {renderSortArrow('po.val')}</div></th>
                            
                            <th onClick={() => handleHeaderSort('net.qty')} className="py-2 px-2 text-right bg-gray-100 font-extrabold hover:bg-gray-200 group"><div className="flex items-center justify-end gap-1">Qty {renderSortArrow('net.qty')}</div></th>
                            <th onClick={() => handleHeaderSort('net.val')} className="py-2 px-2 text-right border-r bg-gray-100 font-extrabold hover:bg-gray-200 group"><div className="flex items-center justify-end gap-1">Val {renderSortArrow('net.val')}</div></th>
                            
                            <th onClick={() => handleHeaderSort('avg3m.qty')} className="py-2 px-2 text-right bg-yellow-50/30 hover:bg-yellow-100/50 group"><div className="flex items-center justify-end gap-1">3M Avg {renderSortArrow('avg3m.qty')}</div></th>
                            <th onClick={() => handleHeaderSort('avg1y.qty')} className="py-2 px-2 text-right bg-yellow-50/30 hover:bg-yellow-100/50 group"><div className="flex items-center justify-end gap-1">1Y Avg {renderSortArrow('avg1y.qty')}</div></th>
                            <th onClick={() => handleHeaderSort('growth.pct')} className="py-2 px-2 text-center border-r bg-yellow-50/30 hover:bg-yellow-100/50 group"><div className="flex items-center justify-center gap-1">Trend {renderSortArrow('growth.pct')}</div></th>
                            
                            <th onClick={() => handleHeaderSort('levels.min.qty')} className="py-2 px-2 text-right bg-teal-50/30 hover:bg-teal-100/50 group"><div className="flex items-center justify-end gap-1">Min Q {renderSortArrow('levels.min.qty')}</div></th>
                            <th onClick={() => handleHeaderSort('levels.min.val')} className="py-2 px-2 text-right border-r bg-teal-50/30 hover:bg-teal-100/50 group"><div className="flex items-center justify-end gap-1">Min V {renderSortArrow('levels.min.val')}</div></th>
                            <th onClick={() => handleHeaderSort('levels.reorder.qty')} className="py-2 px-2 text-right bg-teal-50/30 hover:bg-teal-100/50 group"><div className="flex items-center justify-end gap-1">Re Q {renderSortArrow('levels.reorder.qty')}</div></th>
                            <th onClick={() => handleHeaderSort('levels.reorder.val')} className="py-2 px-2 text-right border-r bg-teal-50/30 hover:bg-teal-100/50 group"><div className="flex items-center justify-end gap-1">Re V {renderSortArrow('levels.reorder.val')}</div></th>
                            <th onClick={() => handleHeaderSort('levels.max.qty')} className="py-2 px-2 text-right bg-teal-50/30 hover:bg-teal-100/50 group"><div className="flex items-center justify-end gap-1">Max Q {renderSortArrow('levels.max.qty')}</div></th>
                            <th onClick={() => handleHeaderSort('levels.max.val')} className="py-2 px-2 text-right border-r bg-teal-50/30 hover:bg-teal-100/50 group"><div className="flex items-center justify-end gap-1">Max V {renderSortArrow('levels.max.val')}</div></th>
                            
                            <th onClick={() => handleHeaderSort('actions.excessStock.qty')} className="py-2 px-2 text-right bg-red-50/50 hover:bg-red-100/50 group"><div className="flex items-center justify-end gap-1">Qty {renderSortArrow('actions.excessStock.qty')}</div></th>
                            <th onClick={() => handleHeaderSort('actions.excessStock.val')} className="py-2 px-2 text-right border-r bg-red-50/50 hover:bg-red-100/50 group"><div className="flex items-center justify-end gap-1">Val {renderSortArrow('actions.excessStock.val')}</div></th>
                            
                            <th onClick={() => handleHeaderSort('actions.excessPO.qty')} className="py-2 px-2 text-right bg-red-50/50 hover:bg-red-100/50 group"><div className="flex items-center justify-end gap-1">Qty {renderSortArrow('actions.excessPO.qty')}</div></th>
                            <th onClick={() => handleHeaderSort('actions.excessPO.val')} className="py-2 px-2 text-right border-r bg-red-50/50 hover:bg-red-100/50 group"><div className="flex items-center justify-end gap-1">Val {renderSortArrow('actions.excessPO.val')}</div></th>
                            
                            <th onClick={() => handleHeaderSort('actions.poNeed.qty')} className="py-2 px-2 text-right bg-green-50/50 hover:bg-green-100/50 group"><div className="flex items-center justify-end gap-1">Qty {renderSortArrow('actions.poNeed.qty')}</div></th>
                            <th onClick={() => handleHeaderSort('actions.poNeed.val')} className="py-2 px-2 text-right border-r bg-green-50/50 hover:bg-green-100/50 group"><div className="flex items-center justify-end gap-1">Val {renderSortArrow('actions.poNeed.val')}</div></th>
                            
                            <th onClick={() => handleHeaderSort('actions.expedite.qty')} className="py-2 px-2 text-right bg-blue-50/50 hover:bg-blue-100/50 group"><div className="flex items-center justify-end gap-1">Qty {renderSortArrow('actions.expedite.qty')}</div></th>
                            <th onClick={() => handleHeaderSort('actions.expedite.val')} className="py-2 px-2 text-right bg-blue-50/50 hover:bg-blue-100/50 group"><div className="flex items-center justify-end gap-1">Val {renderSortArrow('actions.expedite.val')}</div></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-[10px] text-gray-700">
                        {/* TOTALS ROW - Sticky under header + Sticky Columns */}
                        {filteredData.length > 0 && (
                            <tr className="bg-yellow-50 font-bold border-b-2 border-yellow-200 text-gray-900 sticky top-[62px] z-40 shadow-sm">
                                <td colSpan={3} className="sticky left-0 z-40 py-2 px-2 text-right border-r uppercase text-[9px] tracking-wide text-gray-500 bg-yellow-50 border-b-2 border-yellow-200">Filtered Totals:</td>
                                
                                <td className="py-2 px-2 text-right bg-blue-100/50">{formatLargeValue(totals.stock.qty)}</td>
                                <td className="py-2 px-2 text-right border-r bg-blue-100/50">{formatLargeValue(totals.stock.val)}</td>
                                
                                <td className="py-2 px-2 text-right bg-orange-100/50">{formatLargeValue(totals.so.qty)}</td>
                                <td className="py-2 px-2 text-right border-r bg-orange-100/50">{formatLargeValue(totals.so.val)}</td>
                                
                                <td className="py-2 px-2 text-right bg-purple-100/50">{formatLargeValue(totals.po.qty)}</td>
                                <td className="py-2 px-2 text-right border-r bg-purple-100/50">{formatLargeValue(totals.po.val)}</td>
                                
                                <td className="py-2 px-2 text-right bg-gray-200">{formatLargeValue(totals.net.qty)}</td>
                                <td className="py-2 px-2 text-right border-r bg-gray-200">{formatLargeValue(totals.net.val)}</td>
                                
                                <td className="py-2 px-2 text-right bg-yellow-100/50">{formatDec(totals.avg3m.qty)}</td>
                                <td className="py-2 px-2 text-right bg-yellow-100/50">{formatDec(totals.avg1y.qty)}</td>
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
                                    <td className="sticky left-0 z-10 py-1 px-2 border-r truncate max-w-[100px] bg-white group-hover:bg-gray-50 border-b border-gray-100">{row.make}</td>
                                    <td className="sticky left-[6rem] z-10 py-1 px-2 border-r truncate max-w-[100px] bg-white group-hover:bg-gray-50 border-b border-gray-100">{row.materialGroup}</td>
                                    <td className="sticky left-[12rem] z-10 py-1 px-2 border-r truncate max-w-[250px] font-medium text-gray-900 bg-white group-hover:bg-gray-50 border-b border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" title={row.description}>{row.description}</td>
                                    
                                    <td className="py-1 px-2 text-right bg-blue-50/10 font-medium">{row.stock.qty || '-'}</td>
                                    <td className="py-1 px-2 text-right border-r bg-blue-50/10 text-gray-500">{row.stock.val ? formatVal(row.stock.val) : '-'}</td>
                                    
                                    <td className="py-1 px-2 text-right bg-orange-50/10">{row.so.qty || '-'}</td>
                                    <td className="py-1 px-2 text-right border-r bg-orange-50/10 text-gray-500">{row.so.val ? formatVal(row.so.val) : '-'}</td>
                                    
                                    <td className="py-1 px-2 text-right bg-purple-50/10">{row.po.qty || '-'}</td>
                                    <td className="py-1 px-2 text-right border-r bg-purple-50/10 text-gray-500">{row.po.val ? formatVal(row.po.val) : '-'}</td>
                                    
                                    <td className="py-1 px-2 text-right bg-gray-50 font-bold">{row.net.qty}</td>
                                    <td className="py-1 px-2 text-right border-r bg-gray-50 text-gray-600">{formatVal(row.net.val)}</td>
                                    
                                    <td className="py-1 px-2 text-right bg-yellow-50/10">{formatDec(row.avg3m.qty)}</td>
                                    <td className="py-1 px-2 text-right bg-yellow-50/10">{formatDec(row.avg1y.qty)}</td>
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
