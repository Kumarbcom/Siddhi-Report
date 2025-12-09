import React, { useRef } from 'react';
import { SalesRecord } from '../types';
import { Trash2, Download, Upload, History, TrendingUp } from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';

interface SalesHistoryViewProps {
  sales1Year: SalesRecord[];
  sales3Months: SalesRecord[];
  onBulkAdd1Year: (items: Omit<SalesRecord, 'id' | 'createdAt'>[]) => void;
  onBulkAdd3Months: (items: Omit<SalesRecord, 'id' | 'createdAt'>[]) => void;
  onDelete1Year: (id: string) => void;
  onDelete3Months: (id: string) => void;
  onClear1Year: () => void;
  onClear3Months: () => void;
}

const SalesHistoryView: React.FC<SalesHistoryViewProps> = ({
  sales1Year,
  sales3Months,
  onBulkAdd1Year,
  onBulkAdd3Months,
  onDelete1Year,
  onDelete3Months,
  onClear1Year,
  onClear3Months
}) => {
  const fileInputRef1Year = useRef<HTMLInputElement>(null);
  const fileInputRef3Months = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = (filename: string) => {
    const headers = [
      {
        "Particulars": "Ball Bearing 6205",
        "Quantity": 100,
        "Eff. Rate": 55.50,
        "Value": 5550.00
      },
      {
        "Particulars": "Proximity Sensor IME12",
        "Quantity": 10,
        "Eff. Rate": 1200.00,
        "Value": 12000.00
      }
    ];

    const ws = utils.json_to_sheet(headers);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Template");
    writeFile(wb, filename);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: '1year' | '3months') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = read(arrayBuffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = utils.sheet_to_json<any>(ws);

      const newItems: Omit<SalesRecord, 'id' | 'createdAt'>[] = [];

      data.forEach((row) => {
        const getVal = (keys: string[]) => {
          for (const k of keys) {
            const foundKey = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase());
            if (foundKey) return row[foundKey];
          }
          return '';
        };

        const particulars = String(getVal(['particulars', 'description', 'item']) || '');
        const quantity = parseFloat(getVal(['quantity', 'qty', 'count'])) || 0;
        const rate = parseFloat(getVal(['eff. rate', 'eff rate', 'rate', 'price'])) || 0;
        let value = parseFloat(getVal(['value', 'amount', 'total'])) || 0;

        if (!value && quantity && rate) {
            value = quantity * rate;
        }

        if (particulars) {
            newItems.push({
                particulars,
                quantity,
                rate,
                value
            });
        }
      });

      if (newItems.length > 0) {
        if (type === '1year') {
            onBulkAdd1Year(newItems);
        } else {
            onBulkAdd3Months(newItems);
        }
        alert(`Successfully imported ${newItems.length} records.`);
      } else {
        alert("No valid records found. Please ensure headers match 'Particulars', 'Quantity', 'Eff. Rate', 'Value'.");
      }
    } catch (err) {
      console.error("Error parsing Excel:", err);
      alert("Failed to parse Excel file.");
    }

    // Reset inputs
    if (fileInputRef1Year.current) fileInputRef1Year.current.value = '';
    if (fileInputRef3Months.current) fileInputRef3Months.current.value = '';
  };

  const renderTable = (data: SalesRecord[], onDelete: (id: string) => void, emptyMessage: string) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Particulars</th>
            <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Quantity</th>
            <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Eff. Rate</th>
            <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Value</th>
            <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-8 text-center text-gray-500 text-sm">{emptyMessage}</td>
            </tr>
          ) : (
            data.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="py-4 px-6 text-sm font-medium text-gray-900">{item.particulars}</td>
                <td className="py-4 px-6 text-sm text-gray-600 text-right">{item.quantity}</td>
                <td className="py-4 px-6 text-sm text-gray-600 text-right">{item.rate.toFixed(2)}</td>
                <td className="py-4 px-6 text-sm font-semibold text-gray-900 text-right">
                  {item.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
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
  );

  return (
    <div className="space-y-12">
      
      {/* Section 1: Sales Last 3 Months */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
                <div className="bg-teal-100 p-2 rounded-lg text-teal-700">
                    <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-gray-800">Sales Last 3 Months</h2>
                    <p className="text-xs text-gray-500">Recent performance metrics</p>
                </div>
            </div>
            <div className="flex gap-2">
                <button
                    onClick={onClear3Months}
                    className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors border border-red-100"
                    title="Clear 3 Months Data"
                >
                    <Trash2 className="w-4 h-4" />
                    Clear Data
                </button>
                <button
                    onClick={() => handleDownloadTemplate("Sales_3Months_Template.xlsx")}
                    className="flex items-center gap-2 px-3 py-2 bg-white text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 border border-gray-200"
                >
                    <Download className="w-4 h-4" /> Template
                </button>
                <input
                    type="file"
                    ref={fileInputRef3Months}
                    className="hidden"
                    accept=".xlsx, .xls"
                    onChange={(e) => handleFileUpload(e, '3months')}
                />
                <button
                    onClick={() => fileInputRef3Months.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 bg-teal-50 text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-100 border border-teal-100"
                >
                    <Upload className="w-4 h-4" /> Import Excel
                </button>
            </div>
        </div>
        {renderTable(sales3Months, onDelete3Months, "No recent sales records found. Upload data to view.")}
      </div>

      <div className="border-t border-gray-200"></div>

      {/* Section 2: Sales Last 1 Year */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
             <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-lg text-indigo-700">
                    <History className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-gray-800">Sales Last 1 Year</h2>
                    <p className="text-xs text-gray-500">Annual performance overview</p>
                </div>
            </div>
            <div className="flex gap-2">
                <button
                    onClick={onClear1Year}
                    className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors border border-red-100"
                    title="Clear 1 Year Data"
                >
                    <Trash2 className="w-4 h-4" />
                    Clear Data
                </button>
                <button
                    onClick={() => handleDownloadTemplate("Sales_1Year_Template.xlsx")}
                    className="flex items-center gap-2 px-3 py-2 bg-white text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 border border-gray-200"
                >
                    <Download className="w-4 h-4" /> Template
                </button>
                <input
                    type="file"
                    ref={fileInputRef1Year}
                    className="hidden"
                    accept=".xlsx, .xls"
                    onChange={(e) => handleFileUpload(e, '1year')}
                />
                <button
                    onClick={() => fileInputRef1Year.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 border border-indigo-100"
                >
                    <Upload className="w-4 h-4" /> Import Excel
                </button>
            </div>
        </div>
        {renderTable(sales1Year, onDelete1Year, "No annual sales records found. Upload data to view.")}
      </div>

    </div>
  );
};

export default SalesHistoryView;