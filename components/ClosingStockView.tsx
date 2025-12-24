
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { ClosingStockItem, Material } from '../types';
import { Trash2, Download, Upload, Package, Search, ArrowUpDown, ArrowUp, ArrowDown, Filter, PieChart as PieChartIcon, BarChart3, Layers, AlertTriangle, Link2Off, FileDown, Pencil, Save, X } from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';

const formatLargeValue = (val: number, compact: boolean = false) => {
  if (isNaN(val) || val === null) return '-';
  if (val === 0) return '0';
  const absVal = Math.abs(val);
  if (!compact) return val.toLocaleString('en-IN');
  if (absVal >= 10000000) return (val / 10000000).toFixed(2) + ' Cr';
  if (absVal >= 100000) return (val / 100000).toFixed(2) + ' L';
  if (absVal >= 1000) return (val / 1000).toFixed(1) + ' k';
  return Math.round(val).toLocaleString('en-IN');
};

type Metric = 'quantity' | 'value';

const COLORS = ['#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444', '#6B7280', '#059669', '#2563EB'];

const Toggle: React.FC<{ value: Metric; onChange: (m: Metric) => void; colorClass: string }> = ({ value, onChange, colorClass }) => (
  <div className="flex bg-gray-100 p-0.5 rounded-md border border-gray-200">
    <button onClick={() => onChange('quantity')} className={`px-2 py-0.5 text-[9px] font-semibold rounded transition-all ${value === 'quantity' ? `bg-white shadow-sm ${colorClass}` : 'text-gray-500 hover:text-gray-700'}`}>Qty</button>
    <button onClick={() => onChange('value')} className={`px-2 py-0.5 text-[9px] font-semibold rounded transition-all ${value === 'value' ? `bg-white shadow-sm ${colorClass}` : 'text-gray-500 hover:text-gray-700'}`}>Value</button>
  </div>
);

const getMergedMakeName = (makeName: string) => {
  const m = String(makeName || 'Unspecified').trim();
  const lowerM = m.toLowerCase();
  if (lowerM.includes('lapp')) return 'Lapp';
  if (lowerM.includes('luker')) return 'Luker';
  return m;
};

const ModernDonutChart: React.FC<{
  data: { label: string; value: number; color: string }[],
  metric: Metric,
  total: number,
  centerColorClass?: string
}> = ({ data, metric, total, centerColorClass }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  let cumulativePercent = 0;
  if (total === 0) return <div className="flex items-center justify-center h-48 text-gray-400 text-[10px] font-bold uppercase">No records found</div>;

  const slices = data.map(slice => {
    const percent = slice.value / (total || 1);
    const startPercent = cumulativePercent;
    cumulativePercent += percent;
    return { ...slice, percent, startPercent };
  });

  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  const centerLabel = hoveredIndex !== null ? slices[hoveredIndex].label : `Total ${metric === 'value' ? 'Value' : 'Qty'}`;
  const centerValue = hoveredIndex !== null ?
    formatLargeValue(slices[hoveredIndex].value, metric === 'value') :
    formatLargeValue(total, metric === 'value');

  return (
    <div className="flex flex-col items-center gap-3 h-full">
      <div className="relative w-32 h-32 flex-shrink-0">
        <svg viewBox="-1 -1 2 2" style={{ transform: 'rotate(-90deg)' }} className="w-full h-full drop-shadow-sm">
          {slices.map((slice, i) => {
            if (slice.percent >= 0.999) return (
              <circle
                key={i}
                cx="0" cy="0" r="0.85"
                fill="none"
                stroke={slice.color}
                strokeWidth="0.3"
                className="transition-all cursor-pointer hover:opacity-80"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
            const [startX, startY] = getCoordinatesForPercent(slice.startPercent);
            const [endX, endY] = getCoordinatesForPercent(slice.startPercent + slice.percent);
            const largeArcFlag = slice.percent > 0.5 ? 1 : 0;
            return (
              <path
                key={i}
                d={`M ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} L ${endX * 0.7} ${endY * 0.7} A 0.7 0.7 0 ${largeArcFlag} 0 ${startX * 0.7} ${startY * 0.7} Z`}
                fill={slice.color}
                className={`transition-all duration-300 cursor-pointer ${hoveredIndex === i ? 'opacity-100 scale-105 stroke-2 stroke-white' : 'opacity-85 hover:opacity-100'}`}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-1 text-center">
          <span className="text-[9px] text-gray-400 uppercase font-black truncate w-full px-2 leading-tight">{centerLabel}</span>
          <span className={`text-xs font-black leading-none ${centerColorClass || 'text-gray-900'}`}>
            {metric === 'value' && !centerValue.includes(' ') ? 'Rs. ' : ''}{centerValue}
          </span>
        </div>
      </div>
      <div className="flex-1 w-full overflow-hidden flex flex-col min-h-0">
        <div className="flex items-center justify-between text-[9px] uppercase font-black text-gray-400 pb-1 border-b border-gray-100 mb-1">
          <span>Make / Brand</span>
          <div className="flex gap-2"><span className="w-8 text-right">%</span><span className="w-20 text-right">{metric === 'value' ? 'Val' : 'Qty'}</span></div>
        </div>
        <div className="overflow-y-auto custom-scrollbar flex-1 space-y-0.5 pr-1">
          {slices.map((item, i) => (
            <div
              key={i}
              className={`flex items-center justify-between text-[10px] p-1 rounded transition-all cursor-pointer ${hoveredIndex === i ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="w-2 h-2 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: item.color }}></span>
                <span className={`font-bold truncate ${hoveredIndex === i ? 'text-gray-900' : 'text-gray-600'}`} title={item.label}>{item.label}</span>
              </div>
              <div className="flex gap-2 items-center flex-shrink-0">
                <span className="w-8 text-right text-gray-400 font-bold text-[9px]">{Math.round(item.percent * 100)}%</span>
                <span className={`w-20 text-right font-black truncate ${hoveredIndex === i ? 'text-blue-600' : 'text-gray-900'}`}>
                  {formatLargeValue(item.value, metric === 'value')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface ClosingStockViewProps {
  items: ClosingStockItem[];
  materials: Material[];
  onBulkAdd: (items: Omit<ClosingStockItem, 'id' | 'createdAt'>[]) => void;
  onUpdate: (item: ClosingStockItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

const ClosingStockView: React.FC<ClosingStockViewProps> = ({
  items,
  materials,
  onBulkAdd,
  onUpdate,
  onDelete,
  onClear
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMake, setSelectedMake] = useState<string>('ALL');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [makeMetric, setMakeMetric] = useState<Metric>('value');
  const [groupMetric, setGroupMetric] = useState<Metric>('value');
  const [topMetric, setTopMetric] = useState<Metric>('value');

  // Sorting
  const [sortKey, setSortKey] = useState<string>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ClosingStockItem | null>(null);

  const handleEditClick = (item: ClosingStockItem) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleSaveEdit = () => {
    if (editForm) {
      const val = editForm.quantity * editForm.rate;
      onUpdate({ ...editForm, value: val });
      setEditingId(null);
      setEditForm(null);
    }
  };

  const handleInputChange = (field: keyof ClosingStockItem, value: any) => {
    if (editForm) {
      setEditForm({ ...editForm, [field]: value });
    }
  };

  // Robust Enrichment with Dual Lookup
  const enrichedItems = useMemo(() => {
    const matByPartNo = new Map<string, { make: string, group: string }>();
    const matByDesc = new Map<string, { make: string, group: string }>();

    materials.forEach(m => {
      const info = { make: m.make, group: m.materialGroup };
      if (m.partNo) matByPartNo.set(String(m.partNo).toLowerCase().trim(), info);
      if (m.description) matByDesc.set(String(m.description).toLowerCase().trim(), info);
    });

    return items.map(item => {
      const searchKey = String(item.description || '').toLowerCase().trim();
      const matInfo = matByPartNo.get(searchKey) || matByDesc.get(searchKey);
      const mergedMake = getMergedMakeName(matInfo?.make || 'Unspecified');

      return {
        ...item,
        make: mergedMake,
        group: matInfo?.group || 'Unspecified',
        isLinked: !!matInfo
      };
    });
  }, [items, materials]);

  const uniqueMakes = useMemo(() => {
    let filtered = enrichedItems;
    if (selectedGroup !== 'ALL') filtered = filtered.filter(i => i.group === selectedGroup);
    const makes = Array.from(new Set(filtered.map(i => i.make))).sort().filter(m => m !== 'Unspecified');
    const hasUnspecified = enrichedItems.some(i => i.make === 'Unspecified');
    return ['ALL', ...makes, ...(hasUnspecified ? ['Unspecified'] : [])];
  }, [enrichedItems, selectedGroup]);

  const uniqueGroups = useMemo(() => {
    let filtered = enrichedItems;
    if (selectedMake !== 'ALL') filtered = filtered.filter(i => i.make === selectedMake);
    const groups = Array.from(new Set(filtered.map(i => i.group))).sort().filter(g => g !== 'Unspecified');
    const hasUnspecified = enrichedItems.some(i => i.group === 'Unspecified');
    return ['ALL', ...groups, ...(hasUnspecified ? ['Unspecified'] : [])];
  }, [enrichedItems, selectedMake]);

  const filteredData = useMemo(() => {
    let data = enrichedItems;
    if (selectedMake !== 'ALL') data = data.filter(i => i.make === selectedMake);
    if (selectedGroup !== 'ALL') data = data.filter(i => i.group === selectedGroup);
    if (searchTerm) {
      const low = searchTerm.toLowerCase();
      data = data.filter(i => i.description.toLowerCase().includes(low));
    }
    return data;
  }, [enrichedItems, selectedMake, selectedGroup, searchTerm]);

  useEffect(() => {
    if (selectedMake !== 'ALL' && !uniqueMakes.includes(selectedMake)) setSelectedMake('ALL');
  }, [uniqueMakes, selectedMake]);
  useEffect(() => {
    if (selectedGroup !== 'ALL' && !uniqueGroups.includes(selectedGroup)) setSelectedGroup('ALL');
  }, [uniqueGroups, selectedGroup]);


  const stats = useMemo(() => {
    const totalQty = filteredData.reduce((acc, i) => acc + i.quantity, 0);
    const totalVal = filteredData.reduce((acc, i) => acc + i.value, 0);
    const count = filteredData.length;
    const totalUnmatched = enrichedItems.filter(i => !i.isLinked).length;

    const makeMap = new Map<string, { qty: number, val: number }>();
    filteredData.forEach(i => { const m = makeMap.get(i.make) || { qty: 0, val: 0 }; m.qty += i.quantity; m.val += i.value; makeMap.set(i.make, m); });
    const byMake = Array.from(makeMap.entries()).map(([label, data], i) => ({
      label,
      value: makeMetric === 'value' ? data.val : data.qty,
      color: label === 'Unspecified' ? '#9CA3AF' : COLORS[i % COLORS.length]
    })).sort((a, b) => b.value - a.value);

    const groupMap = new Map<string, { qty: number, val: number }>();
    filteredData.forEach(i => { const g = groupMap.get(i.group) || { qty: 0, val: 0 }; g.qty += i.quantity; g.val += i.value; groupMap.set(i.group, g); });
    const groupDenominator = Array.from(groupMap.values()).reduce((acc, v) => acc + (groupMetric === 'value' ? v.val : v.qty), 0);
    const byGroup = Array.from(groupMap.entries()).map(([label, data]) => ({ label, value: groupMetric === 'value' ? data.val : data.qty, share: groupDenominator > 0 ? ((groupMetric === 'value' ? data.val : data.qty) / groupDenominator) * 100 : 0 })).sort((a, b) => b.value - a.value).filter(g => g.label !== 'Unspecified');

    const topArticles = [...filteredData].sort((a, b) => { const valA = topMetric === 'value' ? a.value : a.quantity; const valB = topMetric === 'value' ? b.value : b.quantity; return valB - valA; }).slice(0, 5).map(i => ({
      label: i.description,
      value: topMetric === 'value' ? i.value : i.quantity,
      share: (topMetric === 'value' ? totalVal : totalQty) > 0 ? ((topMetric === 'value' ? i.value : i.quantity) / (topMetric === 'value' ? totalVal : totalQty)) * 100 : 0
    }));
    const currentMakeTotal = byMake.reduce((acc, item) => acc + item.value, 0);
    return { totalQty, totalVal, count, totalUnmatched, byMake, byGroup, topArticles, currentMakeTotal, groupDenominator };
  }, [filteredData, enrichedItems, makeMetric, groupMetric, topMetric]);

  const handleDownloadTemplate = () => { const headers = [{ "Description": "Bearing 6205", "Quantity": 10, "Rate": 55.50, "Value": 555.00 }]; const ws = utils.json_to_sheet(headers); const wb = utils.book_new(); utils.book_append_sheet(wb, ws, "Stock_Template"); writeFile(wb, "Closing_Stock_Template.xlsx"); };
  const handleExport = () => { if (items.length === 0) { alert("No data to export."); return; } const data = tableData.map(i => ({ "Description": i.description, "Make": i.make, "Group": i.group, "Quantity": i.quantity, "Rate": i.rate, "Value": i.value })); const ws = utils.json_to_sheet(data); const wb = utils.book_new(); utils.book_append_sheet(wb, ws, "Closing_Stock"); writeFile(wb, `Closing_Stock_Export_${selectedMake}.xlsx`); };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer(); const wb = read(arrayBuffer); const ws = wb.Sheets[wb.SheetNames[0]]; const data = utils.sheet_to_json<any>(ws);
      const newItems: Omit<ClosingStockItem, 'id' | 'createdAt'>[] = [];
      data.forEach((row) => {
        const getVal = (keys: string[]) => { for (const k of keys) { const foundKey = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase()); if (foundKey) return row[foundKey]; } return undefined; };
        const parseNum = (val: any) => { if (typeof val === 'number') return val; if (typeof val === 'string') { const clean = val.replace(/[,Rs. ]/g, '').trim(); return parseFloat(clean) || 0; } return 0; };
        const description = String(getVal(['description', 'desc', 'particulars']) || '').trim(); const quantity = parseNum(getVal(['quantity', 'qty', 'stock'])); const rate = parseNum(getVal(['rate', 'price', 'unit price'])); let value = parseNum(getVal(['value', 'val', 'amount', 'total']));
        if (value === 0 && quantity !== 0 && rate !== 0) value = quantity * rate;
        if (description) newItems.push({ description, quantity, rate, value });
      });
      if (newItems.length > 0) { onBulkAdd(newItems); alert(`Imported ${newItems.length} records.`); } else alert("No valid stock records found.");
    } catch (err) { alert("Failed to parse Excel file."); } if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSort = (key: string) => {
    if (sortKey === key) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortOrder('desc'); }
  };

  const tableData = useMemo(() => {
    const data = [...filteredData];
    data.sort((a: any, b: any) => {
      const vA = a[sortKey];
      const vB = b[sortKey];
      if (typeof vA === 'string') return sortOrder === 'asc' ? vA.localeCompare(vB) : vB.localeCompare(vA);
      return sortOrder === 'asc' ? vA - vB : vB - vA;
    });
    return data;
  }, [filteredData, sortKey, sortOrder]);

  const formatCurrency = (val: number) => `Rs. ${Math.round(val).toLocaleString('en-IN')}`;

  return (
    <div className="flex flex-col h-full gap-3 overflow-hidden">
      {/* Top Controls & Metrics */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 space-y-3 flex-shrink-0">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100 flex flex-col justify-center shadow-inner"><p className="text-[10px] font-black text-emerald-700 uppercase tracking-tighter mb-0.5">Total Value</p><p className="text-xl font-black text-gray-900 leading-none">{formatCurrency(stats.totalVal)}</p></div>
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 flex flex-col justify-center shadow-inner"><p className="text-[10px] font-black text-blue-700 uppercase tracking-tighter mb-0.5">Total Quantity</p><p className="text-xl font-black text-gray-900 leading-none">{stats.totalQty.toLocaleString()}</p></div>
          <div className="bg-purple-50 rounded-lg p-3 border border-purple-100 flex flex-col justify-center shadow-inner"><p className="text-[10px] font-black text-purple-700 uppercase tracking-tighter mb-0.5">SKU Count</p><p className="text-xl font-black text-gray-900 leading-none">{stats.count.toLocaleString()}</p></div>
          <div className={`rounded-lg p-3 border flex flex-col justify-center shadow-inner ${stats.totalUnmatched > 0 ? 'bg-orange-50 border-orange-100' : 'bg-green-50 border-green-100'}`}><p className={`text-[10px] font-black uppercase tracking-tighter mb-0.5 ${stats.totalUnmatched > 0 ? 'text-orange-700' : 'text-green-700'}`}>Not in Master</p><p className={`text-xl font-black leading-none ${stats.totalUnmatched > 0 ? 'text-orange-900' : 'text-green-900'}`}>{stats.totalUnmatched.toLocaleString()}</p></div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
          <div className="flex flex-col min-w-[140px]">
            <label className="text-[9px] font-black text-gray-400 uppercase mb-1 flex items-center gap-1.5"><Filter className="w-2.5 h-2.5" /> Make / Brand</label>
            <select value={selectedMake} onChange={e => setSelectedMake(e.target.value)} className="bg-white border border-blue-200 rounded-md px-2 py-1.5 text-xs font-black text-blue-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all">
              {uniqueMakes.map(m => (<option key={m} value={m}>{m === 'ALL' ? 'ALL BRANDS' : m}</option>))}
            </select>
          </div>
          <div className="flex flex-col min-w-[140px]">
            <label className="text-[9px] font-black text-gray-400 uppercase mb-1 flex items-center gap-1.5"><Layers className="w-2.5 h-2.5" /> Material Group</label>
            <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} className="bg-white border border-emerald-200 rounded-md px-2 py-1.5 text-xs font-black text-emerald-700 focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm transition-all">
              {uniqueGroups.map(g => (<option key={g} value={g}>{g === 'ALL' ? 'ALL GROUPS' : g}</option>))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px] flex flex-col">
            <label className="text-[9px] font-black text-gray-400 uppercase mb-1">Live Article Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input type="text" placeholder="Type to filter items..." className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs font-medium focus:ring-2 focus:ring-blue-500 bg-white outline-none shadow-sm transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <div className="flex items-end gap-2 px-1">
            <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 rounded-lg text-xs font-bold border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors uppercase"><FileDown className="w-3.5 h-3.5" /> Export</button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-lg hover:bg-emerald-700 active:scale-95 transition-all uppercase"><Upload className="w-3.5 h-3.5" /> Import</button>
            <div className="w-px h-6 bg-gray-200 mx-1"></div>
            <button onClick={onClear} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold border border-rose-100 hover:bg-rose-100 transition-colors uppercase"><Trash2 className="w-3.5 h-3.5" /> Clear</button>
          </div>
        </div>
      </div>

      {/* Analytics Row */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2.5 flex flex-col h-60">
            <div className="flex justify-between items-center mb-1.5 border-b border-gray-50 pb-1 flex-shrink-0"><div className="flex items-center gap-1.5"><PieChartIcon className="w-3.5 h-3.5 text-purple-600" /><h3 className="text-[10px] font-black text-gray-800 uppercase tracking-tight">Make Mix</h3></div><Toggle value={makeMetric} onChange={setMakeMetric} colorClass="text-purple-700" /></div>
            <div className="flex-1 min-h-0 overflow-hidden"><ModernDonutChart data={stats.byMake} metric={makeMetric} total={stats.currentMakeTotal} centerColorClass="text-purple-600" /></div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2.5 flex flex-col h-60">
            <div className="flex justify-between items-center mb-1.5 border-b border-gray-50 pb-1 flex-shrink-0"><div className="flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5 text-blue-600" /><h3 className="text-[10px] font-black text-gray-800 uppercase tracking-tight">Group Share %</h3></div><Toggle value={groupMetric} onChange={setGroupMetric} colorClass="text-blue-700" /></div>
            <div className="overflow-y-auto custom-scrollbar space-y-1.5 flex-1 pr-1">
              {stats.byGroup.map((group) => {
                const maxVal = stats.byGroup[0]?.value || 1;
                const relativePercent = (group.value / maxVal) * 100;
                return (
                  <div key={group.label} className="text-[9px]">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-gray-700 font-bold truncate w-24 uppercase">{group.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-blue-600 font-black">{group.share.toFixed(1)}%</span>
                        <span className="text-gray-900 font-black opacity-40">{formatLargeValue(group.value, groupMetric === 'value')}</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1 overflow-hidden shadow-inner">
                      <div className="bg-blue-600 h-1 rounded-full transition-all duration-700 shadow-[0_0_5px_rgba(59,130,246,0.3)]" style={{ width: `${relativePercent}%` }}></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2.5 flex flex-col h-60">
            <div className="flex justify-between items-center mb-1.5 border-b border-gray-50 pb-1 flex-shrink-0"><div className="flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5 text-emerald-600" /><h3 className="text-[10px] font-black text-gray-800 uppercase tracking-tight">High Value Items %</h3></div><Toggle value={topMetric} onChange={setTopMetric} colorClass="text-emerald-700" /></div>
            <div className="space-y-1.5 flex-1 overflow-y-auto custom-scrollbar pr-1">
              {stats.topArticles.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className={`flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full text-[8px] font-black ${idx === 0 ? 'bg-yellow-400 text-yellow-900' : 'bg-gray-100 text-gray-500'}`}>{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <p className="text-[9px] font-black text-gray-800 truncate leading-tight w-3/5" title={item.label}>{item.label}</p>
                      <span className="text-[9px] font-black text-emerald-600">{item.share.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1">
                      <div className={`h-1 rounded-full ${idx === 0 ? 'bg-emerald-600' : 'bg-emerald-400'} transition-all duration-700 shadow-sm`} style={{ width: `${(item.value / (stats.topArticles[0]?.value || 1)) * 100}%` }}></div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[9px] font-black text-gray-900 leading-none">{formatLargeValue(item.value, topMetric === 'value')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Table Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0 relative">
        <div className="p-3 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-2">
            <h4 className="text-[11px] font-black text-gray-700 uppercase tracking-widest flex items-center gap-1.5"><Package className="w-4 h-4 text-blue-600" /> Detailed Stock Inventory</h4>
            <span className="text-[10px] font-black px-2 py-0.5 bg-white border border-gray-200 text-gray-500 rounded-md shadow-sm">{tableData.length} Records Shown</span>
          </div>
        </div>
        <div className="flex-1 overflow-auto custom-scrollbar w-full">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="sticky top-0 z-10 bg-gray-100/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
              <tr className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                <th className="py-3 px-4 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('description')}><div className="flex items-center gap-1.5">Description <ArrowUpDown className={`w-3 h-3 ${sortKey === 'description' ? 'text-blue-600' : 'text-gray-300'}`} /></div></th>
                <th className="py-3 px-4 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('make')}><div className="flex items-center gap-1.5">Make <ArrowUpDown className={`w-3 h-3 ${sortKey === 'make' ? 'text-blue-600' : 'text-gray-300'}`} /></div></th>
                <th className="py-3 px-4 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('group')}><div className="flex items-center gap-1.5">Group <ArrowUpDown className={`w-3 h-3 ${sortKey === 'group' ? 'text-blue-600' : 'text-gray-300'}`} /></div></th>
                <th className="py-3 px-4 text-right cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('quantity')}><div className="flex items-center justify-end gap-1.5">Quantity <ArrowUpDown className={`w-3 h-3 ${sortKey === 'quantity' ? 'text-blue-600' : 'text-gray-300'}`} /></div></th>
                <th className="py-3 px-4 text-right cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('rate')}><div className="flex items-center justify-end gap-1.5">Rate <ArrowUpDown className={`w-3 h-3 ${sortKey === 'rate' ? 'text-blue-600' : 'text-gray-300'}`} /></div></th>
                <th className="py-3 px-4 text-right cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('value')}><div className="flex items-center justify-end gap-1.5">Value <ArrowUpDown className={`w-3 h-3 ${sortKey === 'value' ? 'text-blue-600' : 'text-gray-300'}`} /></div></th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tableData.length === 0 ? (
                <tr><td colSpan={7} className="py-20 text-center text-gray-400 bg-gray-50/20"><div className="flex flex-col items-center justify-center gap-3"><Package className="w-12 h-12 text-gray-200" /><p className="text-sm font-bold uppercase tracking-tight">No matching stock found</p></div></td></tr>
              ) : (
                tableData.map((item) => (
                  <tr key={item.id} className={`hover:bg-blue-50/30 transition-all duration-200 group ${editingId === item.id ? 'bg-blue-50/60' : ''}`}>
                    {editingId === item.id ? (
                      <>
                        <td className="py-2.5 px-4"><input type="text" className="w-full border border-blue-400 rounded-md px-2 py-1 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={editForm?.description || ''} onChange={e => handleInputChange('description', e.target.value)} /></td>
                        <td className="py-2.5 px-4 text-[10px] font-black text-gray-400 uppercase">{item.make}</td>
                        <td className="py-2.5 px-4 text-[10px] font-bold text-gray-400 uppercase">{item.group}</td>
                        <td className="py-2.5 px-4 text-right"><input type="number" className="w-24 border border-blue-400 rounded-md px-2 py-1 text-xs font-black text-right outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={editForm?.quantity || 0} onChange={e => handleInputChange('quantity', parseFloat(e.target.value))} /></td>
                        <td className="py-2.5 px-4 text-right"><input type="number" className="w-24 border border-blue-400 rounded-md px-2 py-1 text-xs font-black text-right outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={editForm?.rate || 0} onChange={e => handleInputChange('rate', parseFloat(e.target.value))} /></td>
                        <td className="py-2.5 px-4 text-right font-black text-emerald-700 text-xs">{(editForm!.quantity * editForm!.rate).toLocaleString('en-IN')}</td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button onClick={handleSaveEdit} className="p-1.5 bg-emerald-600 text-white rounded-md shadow-md hover:bg-emerald-700 active:scale-95 transition-all"><Save className="w-3.5 h-3.5" /></button>
                            <button onClick={handleCancelEdit} className="p-1.5 bg-white border border-gray-200 text-gray-600 rounded-md hover:bg-gray-100 active:scale-95 transition-all"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2.5 px-4 max-w-sm">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-black text-gray-900 truncate leading-tight group-hover:text-blue-700 transition-colors" title={item.description}>{item.description}</span>
                            {!item.isLinked && <span className="inline-flex items-center gap-1.5 mt-1 text-[8px] font-black text-orange-600 uppercase tracking-tighter bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100 w-fit"><AlertTriangle className="w-2.5 h-2.5" /> No Master Linking</span>}
                          </div>
                        </td>
                        <td className="py-2.5 px-4"><span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight ${item.make === 'Unspecified' ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>{item.make}</span></td>
                        <td className="py-2.5 px-4"><span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">{item.group}</span></td>
                        <td className="py-2.5 px-4 text-right font-black text-blue-900 text-xs">{item.quantity.toLocaleString()}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-gray-400 text-[10px]">{item.rate.toFixed(1)}</td>
                        <td className="py-2.5 px-4 text-right font-black text-emerald-700 text-xs tracking-tight">{formatCurrency(item.value)}</td>
                        <td className="py-2.5 px-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => handleEditClick(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-all"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => onDelete(item.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </>
                    )}
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
