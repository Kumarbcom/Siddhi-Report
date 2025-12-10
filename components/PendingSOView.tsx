
import React, { useRef, useMemo, useState } from 'react';
import { PendingSOItem, Material, ClosingStockItem } from '../types';
import { Trash2, Download, Upload, ClipboardList, Search, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Package, Clock, AlertCircle, CheckCircle2, TrendingUp, AlertOctagon, Layers, FileDown } from 'lucide-react';
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

    const stockResults = new Map<string, { totalStock: number; allocated: number; shortage: number; status: 'future' | 'full' | 'partial' | 'none' }>();

    Object.keys(groupedItems).forEach(key => {
        const groupOrders = groupedItems[key];
        const stockItem = closingStockItems.find(s => s.description.toLowerCase().trim() === key);
        const totalStock = stockItem ? stockItem.quantity : 0;

        groupOrders.sort((a, b) => {
            const dateA = new Date(a.dueDate || '9999-12-31').getTime();
            const dateB = new Date(b.dueDate || '9999-12-31').getTime();
            return dateA - dateB;
        });

        let runningStock = totalStock;
        
        groupOrders.forEach(order => {
            const dueDate = order.dueDate ? new Date(order.dueDate) : new Date('9999-12-31');
            const isFuture = dueDate > endOfCurrentMonth;

            if (isFuture) {
                stockResults.set(order.id, {
                    totalStock,
                    allocated: 0,
                    shortage: order.balanceQty,
                    status: 'future'
                });
            } else {
                const needed = order.balanceQty;
                const canAllocate = Math.min(runningStock, needed);
                const shortage = needed - canAllocate;
                runningStock = Math.max(0, runningStock - canAllocate);

                let status: 'full' | 'partial' | 'none' = 'none';
                if (canAllocate === needed) status = 'full';
                else if (canAllocate > 0) status = 'partial';

                stockResults.set(order.id, {
                    totalStock,
                    allocated: canAllocate,
                    shortage: shortage,
                    status
                });
            }
        });
    });

    return items.map(item => {
        const logic = stockResults.get(item.id) || { totalStock: 0, allocated: 0, shortage: item.balanceQty, status: 'none' };
        return { ...item, ...logic };
    });
  }, [items, closingStockItems]);

  // --- Processing & Sorting ---
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

  // --- Totals Calculation ---
  const totals = useMemo(() => {
      const t = {
          ordered: 0,
          orderedValue: 0,
          balance: 0,
          value: 0,
          allocated: 0,
          toArrange: 0,
          uniqueInventory: 0,
          uniqueOrderCount: 0
      };

      const uniqueItemsSet = new Set<string>();
      const uniqueOrders = new Set<string>();

      processedItems.forEach(item => {
          t.ordered += item.orderedQty || 0;
          t.orderedValue += (item.orderedQty || 0) * (item.rate || 0);

          t.balance += item.balanceQty || 0;
          // STRICT CALCULATION: Sum of (Balance Qty * Rate)
          const itemVal = (item.balanceQty || 0) * (item.rate || 0);
          t.value += itemVal;
          
          t.allocated += item.allocated || 0;
          t.toArrange += item.shortage || 0;

          if (item.orderNo) uniqueOrders.add(item.orderNo);

          const normName = item.itemName.toLowerCase().trim();
          if (!uniqueItemsSet.has(normName)) {
              uniqueItemsSet.add(normName);
              const stock = closingStockItems.find(s => s.description.toLowerCase().trim() === normName);
              t.uniqueInventory += stock ? stock.quantity : 0;
          }
      });
      t.uniqueOrderCount = uniqueOrders.size;
      return t;
  }, [processedItems, closingStockItems]);

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

  const handleExport = () => {
    if (items.length === 0) {
      alert("No data to export.");
      return;
    }
    const data = items.map(i => ({
      "Date": formatDateDisplay(i.date),
      "Order": i.orderNo,
      "Party's Name": i.partyName,
      "Name of Item": i.itemName,
      "Material Code": i.materialCode,
      "Part No": i.partNo,
      "Ordered": i.orderedQty,
      "Balance": i.balanceQty,
      "Rate": i.rate,
      "Discount": i.discount,
      "Value": i.value,
      "Due on": formatDateDisplay(i.dueDate),
      "OverDue": i.overDueDays
    }));
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Pending_SO");
    writeFile(wb, "Pending_SO_Export.xlsx");
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
         
         const date = formatExcelDate(getVal(['date', 'dt']));
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
         
         const due = formatExcelDate(getVal(['due on', 'due date', 'due']));
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

  const renderSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-purple-500" /> : <ArrowDown className="w-3 h-3 text-purple-500" />;
  };

  return (
    <div className="flex flex-col h-full gap-4">
      
      {/* 1. Summary Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 flex-shrink-0">
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200">
             <p className="text-[10px] text-gray-500 font-medium uppercase mb-0.5">Total Ordered ({totals.uniqueOrderCount} Orders)</p>
             <div className="flex flex-col">
                <span className="text-sm font-bold text-blue-600">Qty: {totals.ordered.toLocaleString()}</span>
                <span className="text-xs font-bold text-gray-800">{formatCurrency(totals.orderedValue)}</span>
             </div>
          </div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200">
             <p className="text-[10px] text-gray-500 font-medium uppercase mb-0.5">Total Balance</p>
             <div className="flex flex-col">
                <span className="text-sm font-bold text-orange-600">Qty: {totals.balance.toLocaleString()}</span>
                <span className="text-xs font-bold text-gray-800">{formatCurrency(totals.value)}</span>
             </div>
          </div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200">
             <p className="text-[10px] text-gray-500 font-medium uppercase mb-0.5">Inventory (Ref)</p>
             <p className="text-base font-bold text-gray-600">{totals.uniqueInventory.toLocaleString()}</p>
          </div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200">
             <p className="text-[10px] text-gray-500 font-medium uppercase mb-0.5">Allocated (FIFO)</p>
             <p className="text-base font-bold text-emerald-600">{totals.allocated.toLocaleString()}</p>
          </div>
          {/* Show To Arrange only if stock < balance (shortage exists) */}
          {totals.toArrange > 0 ? (
             <div className="bg-red-50 p-3 rounded-xl shadow-sm border border-red-200">
                <p className="text-[10px] text-red-700 font-medium uppercase mb-0.5">Need To Arrange</p>
                <p className="text-base font-bold text-red-700">{totals.toArrange.toLocaleString()}</p>
             </div>
          ) : (
             <div className="bg-green-50 p-3 rounded-xl shadow-sm border border-green-200 opacity-50">
                <p className="text-[10px] text-green-700 font-medium uppercase mb-0.5">Stock Status</p>
                <p className="text-xs font-bold text-green-700 flex items-center gap-1 mt-1"><CheckCircle2 className="w-3.5 h-3.5" /> Sufficient</p>
             </div>
          )}
      </div>

      {/* 2. Actions Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex flex-col gap-3 flex-shrink-0">
         <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-purple-600" /> Pending Orders
            </h2>
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={handleExport}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 border border-gray-200 shadow-sm"
                    title="Export All Pending SO"
                >
                    <FileDown className="w-3.5 h-3.5" /> Export All
                </button>
                <button onClick={handleDownloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 rounded-lg text-xs border hover:bg-gray-50 transition-colors"><Download className="w-3.5 h-3.5" /> Template</button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs border border-emerald-100 hover:bg-emerald-100 transition-colors"><Upload className="w-3.5 h-3.5" /> Import Excel</button>
                <div className="w-px h-6 bg-gray-200 mx-0.5 hidden sm:block"></div>
                <button onClick={onClear} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs border border-red-100 hover:bg-red-100 transition-colors"><Trash2 className="w-3.5 h-3.5" /> Clear Data</button>
            </div>
         </div>
         <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-3.5 w-3.5 text-gray-400" /></div>
            <input type="text" placeholder="Search orders by No, Party, Item or Part No..." className="pl-9 pr-3 py-1.5 w-full border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
         </div>
      </div>

      {/* 3. Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0">
         <div className="overflow-auto h-full">
            <table className="w-full text-left border-collapse min-w-full">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    <tr className="border-b border-gray-200">
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('date')}>Date {renderSortIcon('date')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('orderNo')}>Order {renderSortIcon('orderNo')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('partyName')}>Party's Name {renderSortIcon('partyName')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100 w-56" onClick={() => handleSort('itemName')}>Name of Item {renderSortIcon('itemName')}</th>
                        <th className="py-2 px-3 hidden md:table-cell">Mat Code</th>
                        <th className="py-2 px-3 hidden md:table-cell">Part No</th>
                        <th className="py-2 px-3 text-right">Ordered</th>
                        <th className="py-2 px-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('balanceQty')}>Balance {renderSortIcon('balanceQty')}</th>
                        <th className="py-2 px-3 text-right hidden lg:table-cell">Rate</th>
                        <th className="py-2 px-3 text-right hidden lg:table-cell">Disc</th>
                        <th className="py-2 px-3 text-right">Value</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('dueDate')}>Due On {renderSortIcon('dueDate')}</th>
                        <th className="py-2 px-3 text-center">OD</th>
                        
                        <th className="py-2 px-3 text-center bg-gray-50 border-l border-gray-100">Stock</th>
                        <th className="py-2 px-3 text-center bg-gray-50">Alloc</th>
                        <th className="py-2 px-3 text-center bg-gray-50 border-r border-gray-100 text-red-600">Arrange</th>
                        
                        <th className="py-2 px-3 text-right">Act</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-xs">
                    {processedItems.length === 0 ? (
                        <tr><td colSpan={17} className="py-8 text-center text-gray-500">No matching orders found.</td></tr>
                    ) : (
                        processedItems.map(item => {
                            const inMaster = materials.some(m => m.description.toLowerCase().trim() === item.itemName.toLowerCase().trim());
                            
                            return (
                                <tr key={item.id} className="hover:bg-purple-50/20 transition-colors">
                                    <td className="py-2 px-3 text-gray-600 whitespace-nowrap">{formatDateDisplay(item.date)}</td>
                                    <td className="py-2 px-3 font-medium text-gray-800 whitespace-nowrap">{item.orderNo}</td>
                                    <td className="py-2 px-3 text-gray-700 max-w-[120px] truncate" title={item.partyName}>{item.partyName}</td>
                                    <td className="py-2 px-3 text-gray-800 max-w-[200px]">
                                        <div className="flex flex-col">
                                            <span className="font-medium line-clamp-1" title={item.itemName}>{item.itemName}</span>
                                            {!inMaster && (
                                                <span className="inline-flex items-center gap-0.5 mt-0.5 text-[9px] text-red-600 bg-red-50 px-1 py-px rounded border border-red-100 w-fit whitespace-nowrap">
                                                    <AlertTriangle className="w-2 h-2" /> Not in Master
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-2 px-3 text-gray-500 hidden md:table-cell text-[10px]">{item.materialCode}</td>
                                    <td className="py-2 px-3 text-gray-500 hidden md:table-cell text-[10px] font-mono">{item.partNo}</td>
                                    <td className="py-2 px-3 text-right text-gray-600">{item.orderedQty}</td>
                                    <td className="py-2 px-3 text-right font-medium text-orange-600 bg-orange-50/30 rounded">{item.balanceQty}</td>
                                    <td className="py-2 px-3 text-right text-gray-500 hidden lg:table-cell">{item.rate}</td>
                                    <td className="py-2 px-3 text-right text-gray-500 hidden lg:table-cell">{item.discount}</td>
                                    <td className="py-2 px-3 text-right font-semibold text-gray-800">{formatCurrency(item.value)}</td>
                                    <td className="py-2 px-3 whitespace-nowrap text-gray-600">{formatDateDisplay(item.dueDate)}</td>
                                    <td className="py-2 px-3 text-center">
                                        {item.overDueDays > 0 ? <span className="inline-flex px-1 py-px rounded text-[9px] font-bold bg-red-100 text-red-700 whitespace-nowrap">{item.overDueDays} D</span> : <span className="text-gray-300">-</span>}
                                    </td>
                                    
                                    {/* FIFO Logic Columns */}
                                    <td className="py-2 px-3 text-center border-l border-gray-100 bg-gray-50/40">
                                        <span className="text-gray-600 font-medium">{item.totalStock}</span>
                                    </td>
                                    
                                    <td className="py-2 px-3 text-center bg-gray-50/40">
                                        {item.status === 'future' ? (
                                            <span className="inline-flex items-center gap-0.5 text-[9px] text-blue-500 font-medium" title="Future Requirement">
                                                <Clock className="w-2.5 h-2.5" /> Fut
                                            </span>
                                        ) : (
                                            <span className={`inline-flex items-center gap-1 text-[10px] px-1 py-px rounded font-bold whitespace-nowrap ${
                                                item.status === 'full' 
                                                ? 'text-emerald-700 bg-emerald-100' 
                                                : item.status === 'partial' 
                                                    ? 'text-orange-700 bg-orange-100'
                                                    : 'text-gray-400'
                                            }`}>
                                                {item.allocated}
                                            </span>
                                        )}
                                    </td>

                                    <td className="py-2 px-3 text-center border-r border-gray-100 bg-gray-50/40">
                                         {item.shortage > 0 ? (
                                             <span className="font-bold text-red-600 bg-red-50 px-1 py-px rounded">{item.shortage}</span>
                                         ) : (
                                             <span className="text-gray-300">-</span>
                                         )}
                                    </td>

                                    <td className="py-2 px-3 text-right">
                                        <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-600 transition-colors p-0.5 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
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
