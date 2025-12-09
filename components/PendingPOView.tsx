
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

  // Robust Date Formatter
  const formatDateDisplay = (dateVal: string | Date | number) => {
    if (!dateVal) return '-';
    let date: Date | null = null;

    if (dateVal instanceof Date) {
        date = dateVal;
    } else if (typeof dateVal === 'string') {
        const parts = dateVal.split('-');
        if (parts.length === 3) {
            date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        } else {
            date = new Date(dateVal);
        }
    } else if (typeof dateVal === 'number') {
        date = new Date((dateVal - (25567 + 2)) * 86400 * 1000);
    }

    if (date && !isNaN(date.getTime())) {
        return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
    }
    return String(dateVal);
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

      const formatExcelDate = (val: any) => {
        if (val instanceof Date) return val.toISOString().split('T')[0];
        if (typeof val === 'number') {
            const d = new Date((val - (25567 + 2)) * 86400 * 1000);
            return d.toISOString().split('T')[0];
        }
        return String(val || '');
      };

      data.forEach((row) => {
         const getVal = (keys: string[]) => {
             for (const k of keys) {
                 const foundKey = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase());
                 if (foundKey) return row[foundKey];
             }
             return '';
         };

         // Strict Mapping
         const date = formatExcelDate(getVal(['date', 'dt']));
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
         
         const due = formatExcelDate(getVal(['due on', 'due', 'due date']));
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

  // Calculate Totals
  const totals = useMemo(() => {
      const uniqueOrders = new Set<string>();
      const result = items.reduce((acc, item) => {
          if (item.orderNo) uniqueOrders.add(item.orderNo);
          return {
              // STRICT CALCULATION: Balance * Rate for Total Value
              value: acc.value + ((item.balanceQty || 0) * (item.rate || 0)),
              orderedValue: acc.orderedValue + ((item.orderedQty || 0) * (item.rate || 0)),
              ordered: acc.ordered + (item.orderedQty || 0),
              balance: acc.balance + (item.balanceQty || 0)
          };
      }, { value: 0, orderedValue: 0, ordered: 0, balance: 0 });
      
      return { ...result, uniqueOrderCount: uniqueOrders.size };
  }, [items]);

  return (
    <div className="flex flex-col h-full gap-4">
      
      {/* 1. Summary Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-shrink-0">
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200">
             <p className="text-[10px] text-gray-500 font-medium uppercase mb-0.5">Total Ordered ({totals.uniqueOrderCount} Orders)</p>
             <div className="flex flex-col">
                <span className="text-base font-bold text-blue-600">Qty: {totals.ordered.toLocaleString()}</span>
                <span className="text-xs font-bold text-gray-800">{formatCurrency(totals.orderedValue)}</span>
             </div>
          </div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200">
             <p className="text-[10px] text-gray-500 font-medium uppercase mb-0.5">Total Balance</p>
             <div className="flex flex-col">
                <span className="text-base font-bold text-orange-600">Qty: {totals.balance.toLocaleString()}</span>
                <span className="text-xs font-bold text-gray-800">{formatCurrency(totals.value)}</span>
             </div>
          </div>
      </div>

      {/* 2. Actions Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex flex-col gap-3 flex-shrink-0">
         <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-orange-600" /> Pending PO Actions
            </h2>
            <div className="flex flex-wrap gap-2">
                <button onClick={handleDownloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 rounded-lg text-xs border hover:bg-gray-50 transition-colors"><Download className="w-3.5 h-3.5" /> Template</button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs border border-emerald-100 hover:bg-emerald-100 transition-colors"><Upload className="w-3.5 h-3.5" /> Import Excel</button>
                <div className="w-px h-6 bg-gray-200 mx-0.5 hidden sm:block"></div>
                <button onClick={onClear} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs border border-red-100 hover:bg-red-100 transition-colors"><Trash2 className="w-3.5 h-3.5" /> Clear Data</button>
            </div>
         </div>
         <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-3.5 w-3.5 text-gray-400" /></div>
            <input type="text" placeholder="Search POs..." className="pl-9 pr-3 py-1.5 w-full border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
         </div>
      </div>

      {/* 3. Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0">
         <div className="overflow-auto h-full">
            <table className="w-full text-left border-collapse min-w-full">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                    <tr className="border-b border-gray-200 text-[10px] text-gray-500 uppercase">
                        <th className="py-2 px-3 font-semibold cursor-pointer" onClick={() => handleSort('date')}>Date {renderSortIcon('date')}</th>
                        <th className="py-2 px-3 font-semibold cursor-pointer" onClick={() => handleSort('orderNo')}>Order {renderSortIcon('orderNo')}</th>
                        <th className="py-2 px-3 font-semibold cursor-pointer" onClick={() => handleSort('partyName')}>Party's Name {renderSortIcon('partyName')}</th>
                        <th className="py-2 px-3 font-semibold w-56 cursor-pointer" onClick={() => handleSort('itemName')}>Name of Item {renderSortIcon('itemName')}</th>
                        <th className="py-2 px-3 font-semibold text-center bg-gray-100 text-gray-700 border-l border-r border-gray-200">Stock</th>
                        <th className="py-2 px-3 font-semibold hidden md:table-cell">Mat Code</th>
                        <th className="py-2 px-3 font-semibold hidden md:table-cell">Part No</th>
                        <th className="py-2 px-3 font-semibold text-right">Ordered</th>
                        <th className="py-2 px-3 font-semibold text-right cursor-pointer" onClick={() => handleSort('balanceQty')}>Balance {renderSortIcon('balanceQty')}</th>
                        <th className="py-2 px-3 font-semibold text-right hidden lg:table-cell">Rate</th>
                        <th className="py-2 px-3 font-semibold text-right hidden lg:table-cell">Disc</th>
                        <th className="py-2 px-3 font-semibold text-right">Value</th>
                        <th className="py-2 px-3 font-semibold cursor-pointer" onClick={() => handleSort('dueDate')}>Due on {renderSortIcon('dueDate')}</th>
                        <th className="py-2 px-3 font-semibold text-center">OD</th>
                        <th className="py-2 px-3 font-semibold text-right">Act</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {processedItems.length === 0 ? (
                        <tr><td colSpan={15} className="py-8 text-center text-gray-500 text-xs">No matching purchase orders found.</td></tr>
                    ) : (
                        processedItems.map(item => {
                            const inMaster = materials.some(m => m.description.toLowerCase().trim() === item.itemName.toLowerCase().trim());
                            const stockItem = closingStockItems.find(s => s.description.toLowerCase().trim() === item.itemName.toLowerCase().trim());
                            const currentStock = stockItem ? stockItem.quantity : 0;

                            return (
                                <tr key={item.id} className="hover:bg-orange-50/20 transition-colors text-xs text-gray-700">
                                    <td className="py-2 px-3 whitespace-nowrap">{formatDateDisplay(item.date)}</td>
                                    <td className="py-2 px-3 font-medium whitespace-nowrap">{item.orderNo}</td>
                                    <td className="py-2 px-3 max-w-[120px] truncate">{item.partyName}</td>
                                    <td className="py-2 px-3 max-w-[200px]">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-900 line-clamp-1" title={item.itemName}>{item.itemName}</span>
                                            {!inMaster && (
                                                <span className="inline-flex items-center gap-0.5 mt-0.5 text-[9px] text-red-600 bg-red-50 px-1 py-px rounded border border-red-100 w-fit whitespace-nowrap">
                                                    <AlertTriangle className="w-2 h-2" /> Not in Master
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    {/* Stock Column */}
                                    <td className="py-2 px-3 text-center border-l border-r border-gray-100 bg-gray-50/40">
                                        <span className="inline-flex items-center gap-0.5 text-[9px] text-gray-700 bg-white px-1.5 py-0.5 rounded-full border border-gray-200 shadow-sm font-medium whitespace-nowrap" title="Current Stock">
                                            <Package className="w-2.5 h-2.5 text-gray-500" /> {currentStock}
                                        </span>
                                    </td>
                                    <td className="py-2 px-3 hidden md:table-cell text-[10px]">{item.materialCode}</td>
                                    <td className="py-2 px-3 hidden md:table-cell text-[10px] font-mono">{item.partNo}</td>
                                    <td className="py-2 px-3 text-right text-gray-500">{item.orderedQty}</td>
                                    <td className="py-2 px-3 text-right font-medium text-blue-600 bg-blue-50/30 rounded">{item.balanceQty}</td>
                                    <td className="py-2 px-3 text-right text-gray-500 hidden lg:table-cell">{item.rate}</td>
                                    <td className="py-2 px-3 text-right text-gray-500 hidden lg:table-cell">{item.discount}</td>
                                    <td className="py-2 px-3 text-right font-semibold text-gray-900 whitespace-nowrap">{formatCurrency(item.value)}</td>
                                    <td className="py-2 px-3 whitespace-nowrap">{formatDateDisplay(item.dueDate)}</td>
                                    <td className="py-2 px-3 text-center">
                                        {item.overDueDays > 0 ? <span className="inline-flex px-1 py-px rounded text-[9px] font-bold bg-red-100 text-red-700 whitespace-nowrap">{item.overDueDays} D</span> : <span className="text-gray-300">-</span>}
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                        <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
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
