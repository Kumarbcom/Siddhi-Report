
import React, { useRef, useState, useMemo } from 'react';
import { SalesRecord } from '../types';
import { Trash2, Download, Upload, History, TrendingUp, Search, ArrowUpDown, ArrowUp, ArrowDown, FileDown, Pencil, Save, X } from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';

interface SalesHistoryViewProps {
  sales1Year: SalesRecord[];
  sales3Months: SalesRecord[];
  onBulkAdd1Year: (items: Omit<SalesRecord, 'id' | 'createdAt'>[]) => void;
  onBulkAdd3Months: (items: Omit<SalesRecord, 'id' | 'createdAt'>[]) => void;
  onUpdate1Year: (item: SalesRecord) => void;
  onUpdate3Months: (item: SalesRecord) => void;
  onDelete1Year: (id: string) => void;
  onDelete3Months: (id: string) => void;
  onClear1Year: () => void;
  onClear3Months: () => void;
}

type SortKey = keyof SalesRecord;

const SalesHistoryView: React.FC<SalesHistoryViewProps> = ({
  sales1Year,
  sales3Months,
  onBulkAdd1Year,
  onBulkAdd3Months,
  onUpdate1Year,
  onUpdate3Months,
  onDelete1Year,
  onDelete3Months,
  onClear1Year,
  onClear3Months
}) => {
  const fileInputRef1Year = useRef<HTMLInputElement>(null);
  const fileInputRef3Months = useRef<HTMLInputElement>(null);
  const [search1Y, setSearch1Y] = useState('');
  const [search3M, setSearch3M] = useState('');
  const [sort1Y, setSort1Y] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
  const [sort3M, setSort3M] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);

  // Edit State (Separate for each table to avoid conflict, though ids are unique usually)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SalesRecord | null>(null);

  const handleEditClick = (item: SalesRecord) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleSaveEdit = (type: '1year' | '3months') => {
    if (editForm) {
      // Recalculate Value if needed
      const val = editForm.quantity * editForm.rate;
      const updated = { ...editForm, value: val };
      if (type === '1year') onUpdate1Year(updated);
      else onUpdate3Months(updated);
      setEditingId(null);
      setEditForm(null);
    }
  };

  const handleInputChange = (field: keyof SalesRecord, value: any) => {
    if (editForm) {
      setEditForm({ ...editForm, [field]: value });
    }
  };

  const handleDownloadTemplate = (filename: string) => { const headers = [{ "Particulars": "Ball Bearing 6205", "Quantity": 100, "Eff. Rate": 55.50, "Value": 5550.00 }]; const ws = utils.json_to_sheet(headers); const wb = utils.book_new(); utils.book_append_sheet(wb, ws, "Template"); writeFile(wb, filename); };
  const handleExport = (data: SalesRecord[], filename: string) => { if (data.length === 0) { alert("No data to export."); return; } const exportData = data.map(i => ({ "Particulars": i.particulars, "Quantity": i.quantity, "Eff. Rate": i.rate, "Value": i.value })); const ws = utils.json_to_sheet(exportData); const wb = utils.book_new(); utils.book_append_sheet(wb, ws, "Sales_History"); writeFile(wb, filename); };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: '1year' | '3months') => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer(); const wb = read(arrayBuffer); const ws = wb.Sheets[wb.SheetNames[0]]; const data = utils.sheet_to_json<any>(ws); const newItems: Omit<SalesRecord, 'id' | 'createdAt'>[] = [];
      data.forEach((row) => {
        const getVal = (keys: string[]) => { for (const k of keys) { const foundKey = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase()); if (foundKey) return row[foundKey]; } return ''; };
        const particulars = String(getVal(['particulars', 'description']) || ''); const quantity = parseFloat(getVal(['quantity', 'qty'])) || 0; const rate = parseFloat(getVal(['eff. rate', 'rate'])) || 0; let value = parseFloat(getVal(['value', 'total'])) || 0; if (!value && quantity && rate) value = quantity * rate;
        if (particulars) newItems.push({ particulars, quantity, rate, value });
      });
      if (newItems.length > 0) { type === '1year' ? onBulkAdd1Year(newItems) : onBulkAdd3Months(newItems); alert(`Imported ${newItems.length} records.`); } else alert("No valid records found.");
    } catch (err) { alert("Failed to parse Excel file."); } if (fileInputRef1Year.current) fileInputRef1Year.current.value = ''; if (fileInputRef3Months.current) fileInputRef3Months.current.value = '';
  };

  const processData = (data: SalesRecord[], search: string, sort: { key: SortKey; direction: 'asc' | 'desc' } | null) => { let filtered = [...data]; if (search) filtered = filtered.filter(i => i.particulars.toLowerCase().includes(search.toLowerCase())); if (sort) { filtered.sort((a, b) => { if (a[sort.key] < b[sort.key]) return sort.direction === 'asc' ? -1 : 1; if (a[sort.key] > b[sort.key]) return sort.direction === 'asc' ? 1 : -1; return 0; }); } return filtered; };
  const renderSortIcon = (currentSort: { key: SortKey; direction: 'asc' | 'desc' } | null, key: SortKey, color: string) => { if (!currentSort || currentSort.key !== key) return <ArrowUpDown className="w-3 h-3 text-gray-400" />; return currentSort.direction === 'asc' ? <ArrowUp className={`w-3 h-3 text-${color}-500`} /> : <ArrowDown className={`w-3 h-3 text-${color}-500`} />; };
  const formatCurrency = (val: number) => `Rs. ${Math.round(val).toLocaleString('en-IN')}`;

  const renderTable = (data: SalesRecord[], onDelete: (id: string) => void, emptyMessage: string, search: string, setSearch: (s: string) => void, sort: { key: SortKey; direction: 'asc' | 'desc' } | null, setSort: (s: { key: SortKey; direction: 'asc' | 'desc' } | null) => void, color: string, type: '1year' | '3months') => {
    const processed = processData(data, search, sort);
    const handleSort = (key: SortKey) => { let direction: 'asc' | 'desc' = 'asc'; if (sort && sort.key === key && sort.direction === 'asc') direction = 'desc'; setSort({ key, direction }); };

    return (
        <div className="flex flex-col gap-3">
            <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-3.5 w-3.5 text-gray-400" /></div><input type="text" placeholder="Search particulars..." className={`pl-9 pr-3 py-1.5 w-full border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-${color}-500 outline-none`} value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                <div className="overflow-auto max-h-[45vh]">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                        <tr className="border-b border-gray-200">
                            <th className="py-2 px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('particulars')}><div className="flex items-center gap-1">Particulars {renderSortIcon(sort, 'particulars', color)}</div></th>
                            <th className="py-2 px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-right cursor-pointer" onClick={() => handleSort('quantity')}><div className="flex items-center justify-end gap-1">Quantity {renderSortIcon(sort, 'quantity', color)}</div></th>
                            <th className="py-2 px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-right cursor-pointer" onClick={() => handleSort('rate')}><div className="flex items-center justify-end gap-1">Rate {renderSortIcon(sort, 'rate', color)}</div></th>
                            <th className="py-2 px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-right cursor-pointer" onClick={() => handleSort('value')}><div className="flex items-center justify-end gap-1">Value {renderSortIcon(sort, 'value', color)}</div></th>
                            <th className="py-2 px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                        {processed.length === 0 ? (<tr><td colSpan={5} className="py-8 text-center text-gray-500 text-xs">{emptyMessage}</td></tr>) : (
                            processed.map((item) => (
                            <tr key={item.id} className={`hover:bg-gray-50/50 transition-colors ${editingId === item.id ? 'bg-gray-50' : ''}`}>
                                {editingId === item.id ? (
                                    <>
                                        <td className="py-2 px-3"><input type="text" className={`w-full border border-${color}-300 rounded px-1.5 py-0.5 text-xs focus:outline-none`} value={editForm?.particulars || ''} onChange={e => handleInputChange('particulars', e.target.value)} /></td>
                                        <td className="py-2 px-3 text-right"><input type="number" className={`w-20 border border-${color}-300 rounded px-1.5 py-0.5 text-xs text-right focus:outline-none`} value={editForm?.quantity || 0} onChange={e => handleInputChange('quantity', parseFloat(e.target.value))} /></td>
                                        <td className="py-2 px-3 text-right"><input type="number" className={`w-20 border border-${color}-300 rounded px-1.5 py-0.5 text-xs text-right focus:outline-none`} value={editForm?.rate || 0} onChange={e => handleInputChange('rate', parseFloat(e.target.value))} /></td>
                                        <td className="py-2 px-3 text-xs text-right text-gray-500">{(editForm!.quantity * editForm!.rate).toFixed(2)}</td>
                                        <td className="py-2 px-3 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => handleSaveEdit(type)} className="p-1 rounded bg-green-100 text-green-700 hover:bg-green-200"><Save className="w-3.5 h-3.5" /></button>
                                                <button onClick={handleCancelEdit} className="p-1 rounded bg-red-100 text-red-700 hover:bg-red-200"><X className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="py-2 px-3 text-xs font-medium text-gray-900">{item.particulars}</td>
                                        <td className="py-2 px-3 text-xs text-gray-600 text-right">{item.quantity}</td>
                                        <td className="py-2 px-3 text-xs text-gray-600 text-right">{item.rate.toFixed(2)}</td>
                                        <td className="py-2 px-3 text-xs font-semibold text-gray-900 text-right">{formatCurrency(item.value)}</td>
                                        <td className="py-2 px-3 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => handleEditClick(item)} className="text-gray-400 hover:text-blue-600 p-0.5 rounded hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
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

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div className="flex items-center gap-2"><div className="bg-teal-100 p-1.5 rounded-lg text-teal-700"><TrendingUp className="w-4 h-4" /></div><div><h2 className="text-sm font-bold text-gray-800">Sales Last 3 Months</h2><p className="text-[10px] text-gray-500">Recent performance metrics</p></div></div>
            <div className="flex gap-2">
                <button onClick={() => handleExport(sales3Months, "Sales_History_3Months.xlsx")} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm"><FileDown className="w-3.5 h-3.5" /> Export</button>
                <button onClick={onClear3Months} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 border border-red-100"><Trash2 className="w-3.5 h-3.5" /> Clear Data</button>
                <button onClick={() => handleDownloadTemplate("Sales_3Months_Template.xlsx")} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 rounded-lg text-xs border hover:bg-gray-50"><Download className="w-3.5 h-3.5" /> Template</button>
                <input type="file" ref={fileInputRef3Months} className="hidden" accept=".xlsx, .xls" onChange={(e) => handleFileUpload(e, '3months')} />
                <button onClick={() => fileInputRef3Months.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 rounded-lg text-xs border border-teal-100 hover:bg-teal-100"><Upload className="w-3.5 h-3.5" /> Import Excel</button>
            </div>
        </div>
        {renderTable(sales3Months, onDelete3Months, "No recent sales records found.", search3M, setSearch3M, sort3M, setSort3M, 'teal', '3months')}
      </div>

      <div className="border-t border-gray-200"></div>

      <div className="space-y-3">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
             <div className="flex items-center gap-2"><div className="bg-indigo-100 p-1.5 rounded-lg text-indigo-700"><History className="w-4 h-4" /></div><div><h2 className="text-sm font-bold text-gray-800">Sales Last 1 Year</h2><p className="text-[10px] text-gray-500">Annual performance overview</p></div></div>
            <div className="flex gap-2">
                <button onClick={() => handleExport(sales1Year, "Sales_History_1Year.xlsx")} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm"><FileDown className="w-3.5 h-3.5" /> Export</button>
                <button onClick={onClear1Year} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 border border-red-100"><Trash2 className="w-3.5 h-3.5" /> Clear Data</button>
                <button onClick={() => handleDownloadTemplate("Sales_1Year_Template.xlsx")} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 rounded-lg text-xs border hover:bg-gray-50"><Download className="w-3.5 h-3.5" /> Template</button>
                <input type="file" ref={fileInputRef1Year} className="hidden" accept=".xlsx, .xls" onChange={(e) => handleFileUpload(e, '1year')} />
                <button onClick={() => fileInputRef1Year.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs border border-indigo-100 hover:bg-indigo-100"><Upload className="w-3.5 h-3.5" /> Import Excel</button>
            </div>
        </div>
        {renderTable(sales1Year, onDelete1Year, "No annual sales records found.", search1Y, setSearch1Y, sort1Y, setSort1Y, 'indigo', '1year')}
      </div>
    </div>
  );
};

export default SalesHistoryView;
