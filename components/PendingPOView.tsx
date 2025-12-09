import React, { useRef, useMemo } from 'react';
import { PendingPOItem, Material } from '../types';
import { Trash2, Download, Upload, ShoppingCart } from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';

interface PendingPOViewProps {
  items: PendingPOItem[];
  materials: Material[];
  onBulkAdd: (items: Omit<PendingPOItem, 'id' | 'createdAt'>[]) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

const PendingPOView: React.FC<PendingPOViewProps> = ({ 
  items, 
  onBulkAdd, 
  onDelete,
  onClear
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const calculateOverDue = (dueDateStr: string) => {
    if (!dueDateStr) return 0;
    const due = new Date(dueDateStr);
    const today = new Date();
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays > 0 ? diffDays : 0;
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
        "Due": "2023-10-20"
      },
      {
        "Date": "2023-10-05",
        "Order": "PO-2023-902",
        "Party's Name": "Tech Components Ltd",
        "Name of Item": "Micro Controller",
        "Material Code": "ELEC-MCU",
        "Part No": "MCU-8BIT",
        "Ordered": 50,
        "Balance": 50,
        "Rate": 5.00,
        "Discount": 0,
        "Due": "2023-11-15"
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
         
         const formatDate = (val: any) => {
             if (val instanceof Date) return val.toISOString().split('T')[0];
             return String(val || '');
         };

         const date = formatDate(getVal(['date', 'dt']));
         const orderNo = String(getVal(['order', 'order no', 'po no']) || '');
         const partyName = String(getVal(['party\'s name', 'party name', 'vendor', 'supplier']) || '');
         const itemName = String(getVal(['name of item', 'item name', 'description']) || '');
         const materialCode = String(getVal(['material code', 'mat code']) || '');
         const partNo = String(getVal(['part no', 'partno']) || '');
         
         const ordered = parseFloat(getVal(['ordered', 'ordered qty', 'qty'])) || 0;
         const balance = parseFloat(getVal(['balance', 'bal qty', 'pending'])) || 0;
         const rate = parseFloat(getVal(['rate', 'price', 'unit price'])) || 0;
         const discount = parseFloat(getVal(['discount', 'disc'])) || 0;
         const due = formatDate(getVal(['due', 'due date', 'delivery date']));

         if (!partyName && !orderNo && !itemName) return;

         const calculatedValue = balance * rate;
         const overDue = calculateOverDue(due);

         newItems.push({
             date,
             orderNo,
             partyName,
             itemName,
             materialCode,
             partNo,
             orderedQty: ordered,
             balanceQty: balance,
             rate,
             discount,
             value: calculatedValue,
             dueDate: due,
             overDueDays: overDue
         });
      });

      if (newItems.length > 0) {
        onBulkAdd(newItems);
        alert(`Successfully imported ${newItems.length} purchase orders.`);
      } else {
        alert("No valid records found. Please check column headers matching the template.");
      }
    } catch (err) {
      console.error("Error parsing Excel:", err);
      alert("Failed to parse Excel file.");
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const totalBalanceValue = useMemo(() => items.reduce((sum, item) => sum + item.value, 0), [items]);

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Total Pending PO Value</p>
            <p className="text-2xl font-bold text-gray-900">${totalBalanceValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-orange-50 p-3 rounded-lg">
            <ShoppingCart className="w-6 h-6 text-orange-600" />
          </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
         <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-800">Pending PO Actions</h2>
            <div className="flex flex-wrap gap-3">
                <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors border border-gray-200 shadow-sm"
                >
                    <Download className="w-4 h-4" /> Template
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors border border-emerald-100"
                >
                  <Upload className="w-4 h-4" /> Import Excel
                </button>
                <div className="w-px h-8 bg-gray-200 mx-1 hidden sm:block"></div>
                <button
                    type="button"
                    onClick={onClear}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors border border-red-100"
                    title="Clear All Pending PO Data"
                >
                    <Trash2 className="w-4 h-4" />
                    Clear Data
                </button>
            </div>
         </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
         <table className="w-full text-left border-collapse whitespace-nowrap">
             <thead>
                 <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase">
                     <th className="py-3 px-4 font-semibold">Date</th>
                     <th className="py-3 px-4 font-semibold">Order</th>
                     <th className="py-3 px-4 font-semibold">Party's Name</th>
                     <th className="py-3 px-4 font-semibold">Name of Item</th>
                     <th className="py-3 px-4 font-semibold">Mat Code</th>
                     <th className="py-3 px-4 font-semibold">Part No</th>
                     <th className="py-3 px-4 font-semibold text-right">Ordered</th>
                     <th className="py-3 px-4 font-semibold text-right">Balance</th>
                     <th className="py-3 px-4 font-semibold text-right">Rate</th>
                     <th className="py-3 px-4 font-semibold text-right">Disc</th>
                     <th className="py-3 px-4 font-semibold text-right">Value</th>
                     <th className="py-3 px-4 font-semibold">Due</th>
                     <th className="py-3 px-4 font-semibold text-center">OverDue</th>
                     <th className="py-3 px-4 font-semibold text-right">Act</th>
                 </tr>
             </thead>
             <tbody className="divide-y divide-gray-200">
                {items.length === 0 ? (
                    <tr>
                        <td colSpan={14} className="py-8 text-center text-gray-500 text-sm">No pending purchase orders found.</td>
                    </tr>
                ) : (
                    items.map(item => (
                        <tr key={item.id} className="hover:bg-orange-50/30 transition-colors text-sm text-gray-700">
                            <td className="py-3 px-4">{item.date}</td>
                            <td className="py-3 px-4 font-medium">{item.orderNo}</td>
                            <td className="py-3 px-4 max-w-[150px] truncate" title={item.partyName}>{item.partyName}</td>
                            <td className="py-3 px-4 max-w-[200px] truncate" title={item.itemName}>{item.itemName}</td>
                            <td className="py-3 px-4">{item.materialCode}</td>
                            <td className="py-3 px-4 font-mono text-xs">{item.partNo}</td>
                            <td className="py-3 px-4 text-right">{item.orderedQty}</td>
                            <td className="py-3 px-4 text-right font-medium text-blue-600">{item.balanceQty}</td>
                            <td className="py-3 px-4 text-right">{item.rate}</td>
                            <td className="py-3 px-4 text-right">{item.discount > 0 ? `${item.discount}%` : '-'}</td>
                            <td className="py-3 px-4 text-right font-semibold">{item.value.toLocaleString()}</td>
                            <td className="py-3 px-4">{item.dueDate}</td>
                            <td className="py-3 px-4 text-center">
                                {item.overDueDays > 0 ? (
                                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                        {item.overDueDays} Days
                                    </span>
                                ) : (
                                    <span className="text-gray-400 text-xs">-</span>
                                )}
                            </td>
                            <td className="py-3 px-4 text-right">
                                <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-600">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                    ))
                )}
             </tbody>
         </table>
      </div>
    </div>
  );
};

export default PendingPOView;