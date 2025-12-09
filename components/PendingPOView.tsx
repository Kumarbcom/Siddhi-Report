
import React, { useRef, useMemo, useState } from 'react';
import { PendingPOItem, Material, ClosingStockItem } from '../types';
import { Trash2, Download, Upload, ShoppingCart, Search, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Package } from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';

interface PendingPOViewProps {
  items: PendingPOItem[];
  materials: Material[];
  closingStockItems: ClosingStockItem[];
  onBulkAdd: (items: Omit<PendingPOItem, 'id' | 'createdAt'>[]) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

type SortKey = keyof PendingPOItem;

const PendingPOView: React.FC<PendingPOViewProps> = ({ 
  items, 
  materials,
  closingStockItems,
  onBulkAdd, 
  onDelete,
  onClear
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);

  const calculateOverDue = (dueDateStr: string) => {
    if (!dueDateStr) return 0;
    const due = new Date(dueDateStr);
    const today = new Date();
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays > 0 ? diffDays : 0;
  };

  // Helper to safely display date in dd-MMM-yyyy format
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '-';
    // Assume input is YYYY-MM-DD
    const parts = dateStr.split('-');
    if (parts.length === 3) {
       const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
       if (!isNaN(date.getTime())) {
           return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
       }
    }
    return dateStr;
  };

  const formatCurrency = (val: number) => {
    return `Rs. ${Math.round(val).toLocaleString('en-IN')}`;
  };

  const handleDownloadTemplate = () => {
    const headers = [
      {
        "Date": "2023-10-01",
        "Order": "PO-2023-901",
        "Party's Name": "Steel Supplies Co",
        "Name of Item": "Steel Rod 10mm",
        "Material Code": "RAW-STL",
        "Part No": "STL-10MM",
        "Ordered": 500,
        "Balance": 100,
        "Rate": 15.50,
        "Discount": 2,
        "Value": 1550.00,
        "Due on": "2023-10-20",
        "OverDue": 0
      }
    ];
    const ws = utils.json_to_sheet(headers);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Pending_PO_Template");
    writeFile(wb, "Pending_PO_Template.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = read(arrayBuffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = utils.sheet_to_json<any>(ws, { cellDates: true, dateNF: 'yyyy-mm-dd' });
      const newItems: Omit<PendingPOItem, 'id' | 'createdAt'>[] = [];

      data.forEach((row) => {
         const getVal = (keys: string[]) => {
             for (const k of keys) {
                 const foundKey = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase());
                 if (foundKey) return row[foundKey];
             }
             return '';
         };
         const formatDate = (val: any) => val instanceof Date ? val.toISOString().split('T')[0] : String(val || '');

         // Strict Mapping
         const date = formatDate(getVal(['date', 'dt']));
         const orderNo = String(getVal(['order', 'order no']) || '');
         const partyName = String(getVal(['party\'s name', 'party name', 'party']) || '');
         const itemName = String(getVal(['name of item', 'item name', 'item']) || '');
         const materialCode = String(getVal(['material code', 'mat code']) || '');
         const partNo = String(getVal(['part no']) || '');
         const ordered = parseFloat(getVal(['ordered', 'ordered qty'])) || 0;
         const balance = parseFloat(getVal(['balance', 'bal', 'bal qty'])) || 0;
         const rate = parseFloat(getVal(['rate', 'price'])) || 0;
         const discount = parseFloat(getVal(['discount', 'disc'])) || 0;
         let value = parseFloat(getVal(['value', 'val', 'amount'])) || 0;
         if (value === 0 && balance !== 0 && rate !== 0) value = balance * rate;
         
         const due = formatDate(getVal(['due on', 'due', 'due date']));
         let overDue = parseFloat(getVal(['overdue', 'over due', 'od days']));
         if (!overDue && due) overDue = calculateOverDue(due);

         if (!partyName && !orderNo && !itemName) return;

         newItems.push({
             date, orderNo, partyName, itemName, materialCode, partNo,
             orderedQty: ordered, balanceQty: balance, rate, discount,
             value, dueDate: due, overDueDays: overDue
         });
      });
      if (newItems.length > 0) { onBulkAdd(newItems); alert(`Imported ${newItems.length} records.`); }
      else { alert("No valid records found."); }
    } catch (err) { alert("Failed to parse Excel file."); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const processedItems = useMemo(() => {
    let data = [...items];
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        data = data.filter(i => i.orderNo.toLowerCase().includes(lower) || i.partyName.toLowerCase().includes(lower) || i.itemName.toLowerCase().includes(lower));
    }
    if (sortConfig) {
        data.sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }
    return data;
  }, [items, searchTerm, sortConfig]);

  const renderSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-orange-500" /> : <ArrowDown className="w-3 h-3 text-orange-500" />;
  };

  const totalBalanceValue = useMemo(() => items.reduce((sum, item) => sum + item.value, 0), [items]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Total Pending PO Value</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalBalanceValue)}</p>
          </div>
          <div className="bg-orange-50 p-3 rounded-lg"><ShoppingCart className="w-6 h-6 text-orange-600" /></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-4">
         <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-800">Pending PO Actions</h2>
            <div className="flex flex-wrap gap-3">
                <button onClick={handleDownloadTemplate} className="flex items-center gap-2 px-4 py-2 bg-white text-gray-600 rounded-lg text-sm border hover:bg-gray-50"><Download className="w-4 h-4" /> Template</button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-sm border border-emerald-100 hover:bg-emerald-100"><Upload className="w-4 h-4" /> Import Excel</button>
                <div className="w-px h-8 bg-gray-200 mx-1 hidden sm:block"></div>
                <button onClick={onClear} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 hover:bg-red-100"><Trash2 className="w-4 h-4" /> Clear Data</button>
            </div>
         </div>
         <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-4 w-4 text-gray-400" /></div>
            <input type="text" placeholder="Search POs..." className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
         </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
         <div className="overflow-auto h-[calc(100vh-420px)]">
            <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                    <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase">
                        <th className="py-3 px-4 font-semibold cursor-pointer" onClick={() => handleSort('date')}>Date {renderSortIcon('date')}</th>
                        <th className="py-3 px-4 font-semibold cursor-pointer" onClick={() => handleSort('orderNo')}>Order {renderSortIcon('orderNo')}</th>
                        <th className="py-3 px-4 font-semibold cursor-pointer" onClick={() => handleSort('partyName')}>Party's Name {renderSortIcon('partyName')}</th>
                        <th className="py-3 px-4 font-semibold cursor-pointer" onClick={() => handleSort('itemName')}>Name of Item {renderSortIcon('itemName')}</th>
                        <th className="py-3 px-4 font-semibold text-center bg-gray-100 text-gray-700 border-l border-r border-gray-200">Stock</th>
                        <th className="py-3 px-4 font-semibold">Material Code</th>
                        <th className="py-3 px-4 font-semibold">Part No</th>
                        <th className="py-3 px-4 font-semibold text-right">Ordered</th>
                        <th className="py-3 px-4 font-semibold text-right cursor-pointer" onClick={() => handleSort('balanceQty')}>Balance {renderSortIcon('balanceQty')}</th>
                        <th className="py-3 px-4 font-semibold text-right">Rate</th>
                        <th className="py-3 px-4 font-semibold text-right">Discount</th>
                        <th className="py-3 px-4 font-semibold text-right">Value</th>
                        <th className="py-3 px-4 font-semibold cursor-pointer" onClick={() => handleSort('dueDate')}>Due on {renderSortIcon('dueDate')}</th>
                        <th className="py-3 px-4 font-semibold text-center">OverDue</th>
                        <th className="py-3 px-4 font-semibold text-right">Act</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {processedItems.length === 0 ? (
                        <tr><td colSpan={15} className="py-8 text-center text-gray-500 text-sm">No matching purchase orders found.</td></tr>
                    ) : (
                        processedItems.map(item => {
                            const inMaster = materials.some(m => m.description.toLowerCase().trim() === item.itemName.toLowerCase().trim());
                            const stockItem = closingStockItems.find(s => s.description.toLowerCase().trim() === item.itemName.toLowerCase().trim());
                            const currentStock = stockItem ? stockItem.quantity : 0;

                            return (
                                <tr key={item.id} className="hover:bg-orange-50/30 transition-colors text-sm text-gray-700">
                                    <td className="py-3 px-4">{formatDateDisplay(item.date)}</td>
                                    <td className="py-3 px-4 font-medium">{item.orderNo}</td>
                                    <td className="py-3 px-4 max-w-[150px] truncate" title={item.partyName}>{item.partyName}</td>
                                    <td className="py-3 px-4 max-w-[200px]">
                                        <div className="flex flex-col">
                                            <span className="truncate font-medium text-gray-900" title={item.itemName}>{item.itemName}</span>
                                            {!inMaster && (
                                                <span className="inline-flex items-center gap-0.5 mt-1 text-[10px] text-red-600 bg-red-50 px-1 py-0.5 rounded border border-red-100 w-fit">
                                                    <AlertTriangle className="w-3 h-3" /> Not in Master
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    {/* Stock Column */}
                                    <td className="py-3 px-4 text-center border-l border-r border-gray-100 bg-gray-50/50">
                                        <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-700 bg-white px-2 py-1 rounded-full border border-gray-200 shadow-sm font-medium" title="Current Stock">
                                            <Package className="w-3 h-3 text-gray-500" /> {currentStock}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">{item.materialCode}</td>
                                    <td className="py-3 px-4 font-mono text-xs">{item.partNo}</td>
                                    <td className="py-3 px-4 text-right">{item.orderedQty}</td>
                                    <td className="py-3 px-4 text-right font-medium text-blue-600">{item.balanceQty}</td>
                                    <td className="py-3 px-4 text-right">{item.rate}</td>
                                    <td className="py-3 px-4 text-right">{item.discount}</td>
                                    <td className="py-3 px-4 text-right font-semibold">{formatCurrency(item.value)}</td>
                                    <td className="py-3 px-4">{formatDateDisplay(item.dueDate)}</td>
                                    <td className="py-3 px-4 text-center">
                                        {item.overDueDays > 0 ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">{item.overDueDays} Days</span> : <span className="text-gray-400 text-xs">-</span>}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

export default PendingPOView;
