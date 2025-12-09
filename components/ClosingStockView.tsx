
import React, { useRef, useState, useMemo } from 'react';
import { ClosingStockItem, Material } from '../types';
import { Trash2, Download, Upload, Package, Search, ArrowUpDown, ArrowUp, ArrowDown, Filter, PieChart as PieChartIcon, BarChart3, Layers, AlertTriangle, Link2Off } from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';

interface ClosingStockViewProps {
  items: ClosingStockItem[];
  materials: Material[]; // Required for Pivot lookup
  onBulkAdd: (items: Omit<ClosingStockItem, 'id' | 'createdAt'>[]) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

type SortKey = keyof ClosingStockItem;
type Metric = 'quantity' | 'value';

const COLORS = ['#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444', '#6B7280', '#059669', '#2563EB'];

const Toggle: React.FC<{ value: Metric; onChange: (m: Metric) => void; colorClass: string }> = ({ value, onChange, colorClass }) => (
  <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
    <button 
      onClick={() => onChange('quantity')} 
      className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-all ${value === 'quantity' ? `bg-white shadow-sm ${colorClass}` : 'text-gray-500 hover:text-gray-700'}`}
    >
      Qty
    </button>
    <button 
      onClick={() => onChange('value')} 
      className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-all ${value === 'value' ? `bg-white shadow-sm ${colorClass}` : 'text-gray-500 hover:text-gray-700'}`}
    >
      Value
    </button>
  </div>
);

const ModernDonutChart: React.FC<{ 
  data: { label: string; value: number; color: string; displayValue: string }[], 
  metric: Metric,
  total: number 
}> = ({ data, metric, total }) => {
  let cumulativePercent = 0;

  if (total === 0) return <div className="flex items-center justify-center h-48 text-gray-400 text-xs">No Data</div>;

  // Calculate paths for donut segments
  const slices = data.map(slice => {
    const percent = slice.value / total;
    const startPercent = cumulativePercent;
    cumulativePercent += percent;
    return { ...slice, percent, startPercent };
  });

  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  return (
    <div className="flex flex-col items-center gap-4 h-full">
      {/* Chart */}
      <div className="relative w-40 h-40 flex-shrink-0">
        <svg viewBox="-1 -1 2 2" style={{ transform: 'rotate(-90deg)' }} className="w-full h-full">
          {slices.map((slice, i) => {
            if (slice.percent === 1) {
              return <circle key={i} cx="0" cy="0" r="0.8" fill="transparent" stroke={slice.color} strokeWidth="0.3" pathLength="100" />;
            }
            const [startX, startY] = getCoordinatesForPercent(slice.startPercent);
            const [endX, endY] = getCoordinatesForPercent(slice.startPercent + slice.percent);
            const largeArcFlag = slice.percent > 0.5 ? 1 : 0;
            const pathData = [
              `M ${startX} ${startY}`,
              `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
              `L ${endX * 0.6} ${endY * 0.6}`, // Inner radius 0.6
              `A 0.6 0.6 0 ${largeArcFlag} 0 ${startX * 0.6} ${startY * 0.6}`,
              'Z'
            ].join(' ');

            return (
              <path
                key={i}
                d={pathData}
                fill={slice.color}
                className="transition-all duration-300 hover:opacity-80 cursor-pointer"
              >
                <title>{`${slice.label}: ${Math.round(slice.percent * 100)}%`}</title>
              </path>
            );
          })}
        </svg>
        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] text-gray-400 uppercase font-medium tracking-wider">Total {metric === 'value' ? 'Val' : 'Qty'}</span>
          <span className="text-xs font-bold text-gray-800">
             {metric === 'value' ? 
               (total > 1000000 ? `${(total/1000000).toFixed(2)}M` : (total > 1000 ? `${(total/1000).toFixed(1)}k` : Math.round(total))) 
               : Math.round(total).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Legend Table */}
      <div className="flex-1 w-full overflow-hidden flex flex-col min-h-0">
         <div className="flex items-center justify-between text-[10px] uppercase font-semibold text-gray-400 pb-2 border-b border-gray-100 mb-2">
            <span>Make</span>
            <div className="flex gap-2">
                <span className="w-8 text-right">%</span>
                <span className="w-16 text-right">{metric === 'value' ? 'Val' : 'Qty'}</span>
            </div>
         </div>
         <div className="overflow-y-auto custom-scrollbar flex-1 space-y-1 pr-1">
            {data.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs group hover:bg-gray-50 p-1 rounded transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                  <span className="text-gray-700 font-medium truncate" title={item.label}>{item.label}</span>
                </div>
                <div className="flex gap-2 items-center">
                    <span className="w-8 text-right text-gray-500 font-mono text-[10px]">{(item.value / total * 100).toFixed(0)}%</span>
                    <span className="w-16 text-right font-medium text-gray-900 truncate" title={item.displayValue}>{item.displayValue}</span>
                </div>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
};

const ClosingStockView: React.FC<ClosingStockViewProps> = ({ 
  items, 
  materials,
  onBulkAdd,
  onDelete,
  onClear
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
  
  // Dashboard State - Independent Metrics
  const [selectedMake, setSelectedMake] = useState<string>('ALL');
  
  const [makeMetric, setMakeMetric] = useState<Metric>('value');
  const [groupMetric, setGroupMetric] = useState<Metric>('value');
  const [topMetric, setTopMetric] = useState<Metric>('value');

  // --- Data Enrichment (Join with Master) ---
  const enrichedItems = useMemo(() => {
    return items.map(item => {
        // Fuzzy match description
        const mat = materials.find(m => m.description.toLowerCase().trim() === item.description.toLowerCase().trim());
        return {
            ...item,
            make: mat ? mat.make : 'Unspecified',
            group: mat ? mat.materialGroup : 'Unspecified',
            isLinked: !!mat
        };
    });
  }, [items, materials]);

  // --- Filter Data (Slicer) ---
  const filteredData = useMemo(() => {
      if (selectedMake === 'ALL') return enrichedItems;
      return enrichedItems.filter(i => i.make === selectedMake);
  }, [enrichedItems, selectedMake]);

  // --- Helpers ---
  const formatVal = (val: number, type: Metric) => {
      const rounded = Math.round(val);
      return type === 'value' ? `Rs. ${rounded.toLocaleString('en-IN')}` : rounded.toLocaleString('en-IN');
  };

  // --- Aggregations ---
  const stats = useMemo(() => {
    // Global Totals
    const totalQty = filteredData.reduce((acc, i) => acc + i.quantity, 0);
    const totalVal = filteredData.reduce((acc, i) => acc + i.value, 0);
    const count = filteredData.length;
    const totalUnmatched = enrichedItems.filter(i => !i.isLinked).length;

    // 1. Aggregation for Make (Calculate both Qty and Value)
    const makeMap = new Map<string, { qty: number, val: number }>();
    filteredData.forEach(i => {
        const m = makeMap.get(i.make) || { qty: 0, val: 0 };
        m.qty += i.quantity;
        m.val += i.value;
        makeMap.set(i.make, m);
    });

    const byMake = Array.from(makeMap.entries())
        .map(([label, data], i) => ({ 
            label, 
            value: makeMetric === 'value' ? data.val : data.qty,
            displayValue: formatVal(makeMetric === 'value' ? data.val : data.qty, makeMetric),
            color: label === 'Unspecified' ? '#9CA3AF' : COLORS[i % COLORS.length] 
        }))
        .sort((a, b) => b.value - a.value);

    // 2. Aggregation for Group
    const groupMap = new Map<string, { qty: number, val: number }>();
    filteredData.forEach(i => {
         const g = groupMap.get(i.group) || { qty: 0, val: 0 };
         g.qty += i.quantity;
         g.val += i.value;
         groupMap.set(i.group, g);
    });

    const byGroup = Array.from(groupMap.entries())
        .map(([label, data]) => ({ 
            label, 
            value: groupMetric === 'value' ? data.val : data.qty 
        }))
        .sort((a, b) => b.value - a.value)
        .filter(g => g.label !== 'Unspecified');

    // 3. Top 5 Articles
    const topArticles = [...filteredData]
        .sort((a, b) => {
            const valA = topMetric === 'value' ? a.value : a.quantity;
            const valB = topMetric === 'value' ? b.value : b.quantity;
            return valB - valA;
        })
        .slice(0, 5)
        .map(i => ({ 
            label: i.description, 
            value: topMetric === 'value' ? i.value : i.quantity,
            subVal: topMetric === 'value' ? i.quantity : i.value 
        }));

    // Specific Totals based on metric selection for donut center
    const currentMakeTotal = byMake.reduce((acc, item) => acc + item.value, 0);

    return { totalQty, totalVal, count, totalUnmatched, byMake, byGroup, topArticles, currentMakeTotal };
  }, [filteredData, enrichedItems, makeMetric, groupMetric, topMetric]);

  // --- Unique Makes for Slicer ---
  const uniqueMakes = useMemo(() => {
     const makes = new Set(enrichedItems.map(i => i.make));
     const list = Array.from(makes).sort();
     const hasUnspecified = list.includes('Unspecified');
     const sorted = list.filter(m => m !== 'Unspecified');
     return ['ALL', ...sorted, ...(hasUnspecified ? ['Unspecified'] : [])];
  }, [enrichedItems]);

  const handleDownloadTemplate = () => {
    const headers = [
      { "Description": "Bearing 6205", "Quantity": 10, "Rate": 55.50, "Value": 555.00 },
      { "Description": "Sensor Inductive", "Quantity": 5, "Rate": 1200.00, "Value": 6000.00 }
    ];
    const ws = utils.json_to_sheet(headers);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Stock_Template");
    writeFile(wb, "Closing_Stock_Template.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = read(arrayBuffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = utils.sheet_to_json<any>(ws);
      
      const newItems: Omit<ClosingStockItem, 'id' | 'createdAt'>[] = [];
      data.forEach((row) => {
         const getVal = (keys: string[]) => {
             for (const k of keys) {
                 const foundKey = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase());
                 if (foundKey) return row[foundKey];
             }
             return '';
         };
         const description = String(getVal(['description', 'desc']) || '');
         const quantity = parseFloat(getVal(['quantity', 'qty'])) || 0;
         const rate = parseFloat(getVal(['rate', 'price'])) || 0;
         let value = parseFloat(getVal(['value', 'val'])) || 0;
         if (value === 0 && quantity !== 0 && rate !== 0) value = quantity * rate;
         if (description) newItems.push({ description, quantity, rate, value });
      });
      if (newItems.length > 0) { onBulkAdd(newItems); alert(`Imported ${newItems.length} records.`); }
      else alert("No valid stock records found.");
    } catch (err) { alert("Failed to parse Excel file."); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const tableData = useMemo(() => {
    let data = [...filteredData];
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        data = data.filter(i => i.description.toLowerCase().includes(lower));
    }
    if (sortConfig) {
        data.sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }
    return data;
  }, [filteredData, searchTerm, sortConfig]);

  const renderSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />;
  };

  const formatCurrency = (val: number) => {
      return `Rs. ${Math.round(val).toLocaleString('en-IN')}`;
  };

  return (
    <div className="flex flex-col h-full gap-6">
      
      {/* 1. Header Stats & Slicer */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-5 flex-shrink-0">
        
        {/* Top Summary Labels */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">Total Stock Value</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalVal)}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Total Items</p>
                <p className="text-2xl font-bold text-gray-900">{stats.count.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Total Quantity</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalQty.toLocaleString()}</p>
            </div>
            <div className={`rounded-lg p-4 border ${stats.totalUnmatched > 0 ? 'bg-orange-50 border-orange-100' : 'bg-green-50 border-green-100'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                   {stats.totalUnmatched > 0 ? <Link2Off className="w-3 h-3 text-orange-600" /> : <Package className="w-3 h-3 text-green-600" />}
                   <p className={`text-xs font-semibold uppercase tracking-wide ${stats.totalUnmatched > 0 ? 'text-orange-700' : 'text-green-700'}`}>
                      Not in Master
                   </p>
                </div>
                <p className={`text-2xl font-bold ${stats.totalUnmatched > 0 ? 'text-orange-800' : 'text-green-800'}`}>
                    {stats.totalUnmatched.toLocaleString()}
                </p>
            </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
             <div className="flex items-center gap-2 mb-3">
                <Filter className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Filter by Make:</span>
             </div>
             <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
                 {uniqueMakes.map(make => (
                     <button
                        key={make}
                        onClick={() => setSelectedMake(make)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                            selectedMake === make 
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                        }`}
                     >
                        {make === 'Unspecified' ? '⚠️ Unspecified' : make}
                     </button>
                 ))}
             </div>
        </div>
      </div>

      {/* 2. Charts Dashboard (Side-by-Side) */}
      {items.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-shrink-0">
              
              {/* Make Distribution (Donut) */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col h-[350px]">
                  <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3 flex-shrink-0">
                      <div className="flex items-center gap-2">
                          <PieChartIcon className="w-5 h-5 text-purple-600" />
                          <h3 className="text-sm font-bold text-gray-800">Make Distribution</h3>
                      </div>
                      <Toggle value={makeMetric} onChange={setMakeMetric} colorClass="text-purple-700" />
                  </div>
                  <div className="flex-1 min-h-0">
                    <ModernDonutChart data={stats.byMake} metric={makeMetric} total={stats.currentMakeTotal} />
                  </div>
              </div>

              {/* Group Distribution (Bar/List) */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col h-[350px]">
                  <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3 flex-shrink-0">
                      <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-blue-600" />
                          <h3 className="text-sm font-bold text-gray-800">Stock by Group</h3>
                      </div>
                      <Toggle value={groupMetric} onChange={setGroupMetric} colorClass="text-blue-700" />
                  </div>
                  <div className="overflow-y-auto custom-scrollbar space-y-3 flex-1 pr-2">
                      {stats.byGroup.map((group) => {
                          const maxVal = stats.byGroup[0]?.value || 1;
                          const percent = (group.value / maxVal) * 100;
                          return (
                              <div key={group.label} className="text-xs">
                                  <div className="flex justify-between mb-1">
                                      <span className="text-gray-700 font-medium truncate w-24">{group.label}</span>
                                      <span className="text-gray-900 font-bold">{formatVal(group.value, groupMetric)}</span>
                                  </div>
                                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                      <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${percent}%` }}></div>
                                  </div>
                              </div>
                          )
                      })}
                      {stats.byGroup.length === 0 && <div className="text-center text-gray-400 text-xs py-8">No grouped data found</div>}
                  </div>
              </div>

              {/* Top 5 Articles */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col h-[350px]">
                  <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3 flex-shrink-0">
                      <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-emerald-600" />
                          <h3 className="text-sm font-bold text-gray-800">Top 5 Articles</h3>
                      </div>
                      <Toggle value={topMetric} onChange={setTopMetric} colorClass="text-emerald-700" />
                  </div>
                  <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2">
                      {stats.topArticles.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                              <span className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                                  {idx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-gray-800 truncate" title={item.label}>{item.label}</p>
                                  <div className="w-full bg-gray-100 rounded-full h-1 mt-1">
                                      <div className={`h-1 rounded-full ${idx === 0 ? 'bg-emerald-500' : 'bg-emerald-300'} transition-all duration-500`} style={{ width: `${(item.value / stats.topArticles[0].value) * 100}%` }}></div>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <p className="text-xs font-bold text-gray-900">{formatVal(item.value, topMetric)}</p>
                              </div>
                          </div>
                      ))}
                      {stats.topArticles.length === 0 && <p className="text-center text-gray-400 text-xs py-4">No data available</p>}
                  </div>
              </div>
          </div>
      )}

      {/* 3. Actions Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-800">Detailed Stock List</h2>
            <div className="flex flex-wrap gap-3">
                <button onClick={handleDownloadTemplate} className="flex items-center gap-2 px-4 py-2 bg-white text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 border border-gray-200 shadow-sm">
                    <Download className="w-4 h-4" /> Template
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-medium hover:bg-emerald-100 border border-emerald-100">
                  <Upload className="w-4 h-4" /> Import Excel
                </button>
                <div className="w-px h-8 bg-gray-200 mx-1 hidden sm:block"></div>
                <button onClick={onClear} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 border border-red-100">
                    <Trash2 className="w-4 h-4" /> Clear Data
                </button>
            </div>
        </div>
        <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-4 w-4 text-gray-400" /></div>
            <input type="text" placeholder="Search by Description..." className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {/* 4. Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="overflow-auto h-full">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
              <tr className="border-b border-gray-200">
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('description')}>
                    <div className="flex items-center gap-1">Description {renderSortIcon('description')}</div>
                </th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Make (Ref)</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('quantity')}>
                    <div className="flex items-center justify-end gap-1">Quantity {renderSortIcon('quantity')}</div>
                </th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('rate')}>
                    <div className="flex items-center justify-end gap-1">Rate {renderSortIcon('rate')}</div>
                </th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('value')}>
                    <div className="flex items-center justify-end gap-1">Value {renderSortIcon('value')}</div>
                </th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tableData.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-500"><div className="flex flex-col items-center justify-center"><Package className="w-8 h-8 text-gray-300 mb-2" /><p>No matching stock records.</p></div></td></tr>
              ) : (
                tableData.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6 text-sm text-gray-900">
                        {item.description}
                        {!item.isLinked && (
                            <span className="inline-flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700" title="Item not found in Material Master">
                                <AlertTriangle className="w-3 h-3" /> Not in Master
                            </span>
                        )}
                    </td>
                    <td className="py-4 px-6 text-xs text-gray-500 italic">
                        {item.make === 'Unspecified' ? <span className="text-gray-400">-</span> : item.make}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-700 text-right">{item.quantity}</td>
                    <td className="py-4 px-6 text-sm text-gray-700 text-right">{item.rate.toFixed(2)}</td>
                    <td className="py-4 px-6 text-sm font-semibold text-gray-900 text-right">{formatCurrency(item.value)}</td>
                    <td className="py-4 px-6 text-right">
                      <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-md hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                    </td>
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

export default ClosingStockView;
