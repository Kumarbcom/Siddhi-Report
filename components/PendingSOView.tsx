
import React, { useRef, useMemo, useState } from 'react';
import { PendingSOItem, Material, ClosingStockItem } from '../types';
import { Trash2, Download, Upload, ClipboardList, Search, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, CheckCircle, Package, Clock, AlertCircle } from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';

interface PendingSOViewProps {
  items: PendingSOItem[];
  materials: Material[];
  closingStockItems: ClosingStockItem[];
  onBulkAdd: (items: Omit<PendingSOItem, 'id' | 'createdAt'>[]) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

type SortKey = keyof PendingSOItem;

const PendingSOView: React.FC<PendingSOViewProps> = ({ 
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

  // Helper to safely display date in dd-MMM-yyyy format ignoring timezone shifts for YYYY-MM-DD strings
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '-';
    // Assume input is YYYY-MM-DD from the import logic
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

  // --- FIFO Stock Calculation Logic ---
  const itemsWithStockLogic = useMemo(() => {
    const today = new Date();
    const endOfCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endOfCurrentMonth.setHours(23, 59, 59, 999);

    const groupedItems: Record<string, PendingSOItem[]> = {};
    items.forEach(item => {
        const key = item.itemName.toLowerCase().trim();
        if (!groupedItems[key]) groupedItems[key] = [];
        groupedItems[key].push(item);
    });

    const stockResults = new Map<string, { displayStock: number; status: 'future' | 'available' | 'shortage'; totalStock: number }>();

    Object.keys(groupedItems).forEach(key => {
        const groupOrders = groupedItems[key];
        const stockItem = closingStockItems.find(s => s.description.toLowerCase().trim() === key);
        const totalStock = stockItem ? stockItem.quantity : 0;

        const fifoCandidates: PendingSOItem[] = [];
        
        groupOrders.forEach(order => {
            const dueDate = order.dueDate ? new Date(order.dueDate) : new Date('9999-12-31');
            
            if (dueDate > endOfCurrentMonth) {
                stockResults.set(order.id, { 
                    displayStock: totalStock, 
                    status: 'future',
                    totalStock
                });
            } else {
                fifoCandidates.push(order);
            }
        });

        fifoCandidates.sort((a, b) => {
            const dateA = new Date(a.dueDate || '1970-01-01').getTime();
            const dateB = new Date(b.dueDate || '1970-01-01').getTime();
            return dateA - dateB;
        });

        let runningStock = totalStock;
        
        fifoCandidates.forEach(order => {
            const availableForThisOrder = runningStock;
            let status: 'available' | 'shortage' = 'available';
            if (availableForThisOrder <= 0) {
                status = 'shortage';
            }

            stockResults.set(order.id, {
                displayStock: availableForThisOrder, 
                status,
                totalStock
            });

            runningStock -= order.balanceQty;
        });
    });

    return items.map(item => {
        const logic = stockResults.get(item.id) || { displayStock: 0, status: 'shortage', totalStock: 0 };
        return { ...item, ...logic };
    });

  }, [items, closingStockItems]);


  const handleDownloadTemplate = () => {
    const headers = [
      {
        "Date": "2023-10-01",
        "Order": "SO-2023-001",
        "Party's Name": "Acme Corp",
        "Name of Item": "Ball Bearing 6205",
        "Material Code": "MECH-001",
        "Part No": "6205-2RS",
        "Ordered": 100,
        "Balance": 50,
        "Rate": 55.00,
        "Discount": 0,
        "Value": 2750.00,
        "Due on": "2023-10-15",
        "OverDue": 5
      }
    ];
    const ws = utils.json_to_sheet(headers);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Pending_SO_Template");
    writeFile(wb, "Pending_SO_Template.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = read(arrayBuffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = utils.sheet_to_json<any>(ws, { cellDates: true, dateNF: 'yyyy-mm-dd' });
      const newItems: Omit<PendingSOItem, 'id' | 'createdAt'>[] = [];
      data.forEach((row) => {
         const getVal = (keys: string[]) => {
             for (const k of keys) {
                 const foundKey = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase());
                 if (foundKey) return row[foundKey];
             }
             return '';
         };
         const formatDate = (val: any) => val instanceof Date ? val.toISOString().split('T')[0] : String(val || '');

         const date = formatDate(getVal(['date', 'dt']));
         const orderNo = String(getVal(['order', 'order no', 'so no']) || '');
         const partyName = String(getVal(['party\'s name', 'party name']) || '');
         const itemName = String(getVal(['name of item', 'item name', 'description']) || '');
         const materialCode = String(getVal(['material code']) || '');
         const partNo = String(getVal(['part no']) || '');
         const ordered = parseFloat(getVal(['ordered', 'ordered qty'])) || 0;
         const balance = parseFloat(getVal(['balance', 'bal qty'])) || 0;
         const rate = parseFloat(getVal(['rate', 'price'])) || 0;
         const discount = parseFloat(getVal(['discount'])) || 0;
         let value = parseFloat(getVal(['value', 'val', 'amount'])) || 0;
         if (value === 0 && balance !== 0 && rate !== 0) value = balance * rate;
         
         const due = formatDate(getVal(['due on', 'due date', 'due']));
         let overDue = parseFloat(getVal(['overdue', 'over due']));
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
    let data = [...itemsWithStockLogic];
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        data = data.filter(i => 
            i.orderNo.toLowerCase().includes(lower) || 
            i.partyName.toLowerCase().includes(lower) || 
            i.itemName.toLowerCase().includes(lower) ||
            i.partNo.toLowerCase().includes(lower)
        );
    }
    if (sortConfig) {
        data.sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
            if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }
    return data;
  }, [itemsWithStockLogic, searchTerm, sortConfig]);

  const renderSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-purple-500" /> : <ArrowDown className="w-3 h-3 text-purple-500" />;
  };

  const totalBalanceValue = useMemo(() => items.reduce((sum, item) => sum + item.value, 0), [items]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Total Pending Value</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalBalanceValue)}</p>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg"><ClipboardList className="w-6 h-6 text-purple-600" /></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-4">
         <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-800">Pending Order Actions</h2>
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
            <input type="text" placeholder="Search orders..." className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
                        <th className="py-3 px-4 font-semibold">Material Code</th>
                        <th className="py-3 px-4 font-semibold">Part No</th>
                        <th className="py-3 px-4 font-semibold text-right">Ordered</th>
                        <th className="py-3 px-4 font-semibold text-right cursor-pointer" onClick={() => handleSort('balanceQty')}>Balance {renderSortIcon('balanceQty')}</th>
                        <th className="py-3 px-4 font-semibold text-right">Rate</th>
                        <th className="py-3 px-4 font-semibold text-right">Discount</th>
                        <th className="py-3 px-4 font-semibold text-right">Value</th>
                        <th className="py-3 px-4 font-semibold cursor-pointer" onClick={() => handleSort('dueDate')}>Due on {renderSortIcon('dueDate')}</th>
                        <th className="py-3 px-4 font-semibold text-center cursor-pointer" onClick={() => handleSort('overDueDays')}>OverDue {renderSortIcon('overDueDays')}</th>
                        {/* Moved Stock Columns to End */}
                        <th className="py-3 px-4 font-semibold text-center bg-gray-50 border-l border-gray-200">Total Stock</th>
                        <th className="py-3 px-4 font-semibold text-center bg-gray-50 border-r border-gray-200">FIFO Avail</th>
                        <th className="py-3 px-4 font-semibold text-right">Act</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {processedItems.length === 0 ? (
                        <tr><td colSpan={16} className="py-8 text-center text-gray-500 text-sm">No matching orders found.</td></tr>
                    ) : (
                        processedItems.map(item => {
                            const inMaster = materials.some(m => m.description.toLowerCase().trim() === item.itemName.toLowerCase().trim());
                            
                            return (
                                <tr key={item.id} className="hover:bg-purple-50/30 transition-colors text-sm text-gray-700">
                                    <td className="py-3 px-4">{formatDateDisplay(item.date)}</td>
                                    <td className="py-3 px-4 font-medium">{item.orderNo}</td>
                                    <td className="py-3 px-4 max-w-[150px] truncate" title={item.partyName}>{item.partyName}</td>
                                    <td className="py-3 px-4 max-w-[220px]">
                                        <div className="flex flex-col">
                                            <span className="truncate font-medium text-gray-900" title={item.itemName}>{item.itemName}</span>
                                            {!inMaster && (
                                                <span className="inline-flex items-center gap-0.5 mt-1 text-[10px] text-red-600 bg-red-50 px-1 py-0.5 rounded border border-red-100 w-fit">
                                                    <AlertTriangle className="w-3 h-3" /> Not in Master
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">{item.materialCode}</td>
                                    <td className="py-3 px-4 font-mono text-xs">{item.partNo}</td>
                                    <td className="py-3 px-4 text-right">{item.orderedQty}</td>
                                    <td className="py-3 px-4 text-right font-medium text-orange-600">{item.balanceQty}</td>
                                    <td className="py-3 px-4 text-right">{item.rate}</td>
                                    <td className="py-3 px-4 text-right">{item.discount}</td>
                                    <td className="py-3 px-4 text-right font-semibold">{formatCurrency(item.value)}</td>
                                    <td className="py-3 px-4">{formatDateDisplay(item.dueDate)}</td>
                                    <td className="py-3 px-4 text-center">
                                        {item.overDueDays > 0 ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">{item.overDueDays} Days</span> : <span className="text-gray-400 text-xs">-</span>}
                                    </td>
                                    
                                    {/* Separate Stock Columns at End */}
                                    <td className="py-3 px-4 text-center border-l border-gray-100 bg-gray-50/30">
                                        <span className="text-gray-700 font-medium">{item.totalStock}</span>
                                    </td>
                                    <td className="py-3 px-4 text-center border-r border-gray-100 bg-gray-50/30">
                                        {item.status === 'future' ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                                <Clock className="w-3 h-3" /> Future
                                            </span>
                                        ) : (
                                            <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-bold ${item.status === 'shortage' ? 'text-red-700 bg-red-50 border-red-100' : 'text-emerald-700 bg-emerald-50 border-emerald-100'}`}>
                                                {item.status === 'shortage' ? <AlertCircle className="w-3 h-3" /> : <Package className="w-3 h-3" />}
                                                {item.displayStock < 0 ? 0 : item.displayStock}
                                            </span>
                                        )}
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

export default PendingSOView;
