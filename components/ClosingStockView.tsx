import React, { useRef } from 'react';
import { ClosingStockItem } from '../types';
import { Trash2, Download, Upload, Package } from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';

interface ClosingStockViewProps {
  items: ClosingStockItem[];
  onBulkAdd: (items: Omit<ClosingStockItem, 'id' | 'createdAt'>[]) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

const ClosingStockView: React.FC<ClosingStockViewProps> = ({ 
  items, 
  onBulkAdd,
  onDelete,
  onClear
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const headers = [
      { 
        "Description": "Deep Groove Ball Bearing 6205", 
        "Quantity": 10, 
        "Rate": 55.50,
        "Value": 555.00
      },
      { 
        "Description": "Sensor Inductive", 
        "Quantity": 5, 
        "Rate": 1200.00,
        "Value": 6000.00
      }
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

         const description = String(getVal(['description', 'desc', 'particulars', 'item name']) || '');
         const quantity = parseFloat(getVal(['quantity', 'qty', 'stock'])) || 0;
         const rate = parseFloat(getVal(['rate', 'price', 'unit price'])) || 0;
         let value = parseFloat(getVal(['value', 'amount', 'total', 'val'])) || 0;

         // If value is missing in Excel but we have qty and rate, calculate it
         if (value === 0 && quantity !== 0 && rate !== 0) {
             value = quantity * rate;
         }

         if (description) {
             newItems.push({
                 description,
                 quantity,
                 rate,
                 value
             });
         }
      });

      if (newItems.length > 0) {
        onBulkAdd(newItems);
        alert(`Successfully imported ${newItems.length} stock records.`);
      } else {
        alert("No valid stock records found. Please ensure the Excel file has 'Description', 'Quantity', 'Rate', and 'Value' columns.");
      }
    } catch (err) {
      console.error("Error parsing Excel:", err);
      alert("Failed to parse the Excel file.");
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-800">Stock Actions</h2>
            <div className="flex flex-wrap gap-3">
                <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors border border-gray-200 shadow-sm"
                >
                    <Download className="w-4 h-4" /> Template
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".xlsx, .xls" 
                    onChange={handleFileUpload} 
                />
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
                >
                    <Trash2 className="w-4 h-4" /> Clear Data
                </button>
            </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Quantity</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Rate</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Value</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">
                     <div className="flex flex-col items-center justify-center">
                        <Package className="w-8 h-8 text-gray-300 mb-2" />
                        <p>No stock records found.</p>
                     </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6 text-sm text-gray-900">{item.description}</td>
                    <td className="py-4 px-6 text-sm text-gray-700 text-right">{item.quantity}</td>
                    <td className="py-4 px-6 text-sm text-gray-700 text-right">{item.rate.toFixed(2)}</td>
                    <td className="py-4 px-6 text-sm font-semibold text-gray-900 text-right">{item.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => onDelete(item.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-md hover:bg-red-50"
                      >
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
    </div>
  );
};

export default ClosingStockView;