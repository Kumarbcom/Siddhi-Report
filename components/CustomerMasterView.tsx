
import React, { useRef, useState, useMemo } from 'react';
import { CustomerMasterItem } from '../types';
import { Trash2, Download, Upload, Search, ArrowUpDown, ArrowUp, ArrowDown, Users, UserCheck, FileDown } from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';

interface CustomerMasterViewProps {
  items: CustomerMasterItem[];
  onBulkAdd: (items: Omit<CustomerMasterItem, 'id' | 'createdAt'>[]) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

type SortKey = keyof CustomerMasterItem;

const CustomerMasterView: React.FC<CustomerMasterViewProps> = ({ 
  items, 
  onBulkAdd, 
  onDelete,
  onClear
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);

  const handleDownloadTemplate = () => {
    const headers = [
      {
        "Customer Name": "Acme Industries Ltd",
        "Group": "Key Accounts",
        "Sales Rep": "John Doe",
        "Status": "Active",
        "Customer Group": "Manufacturing"
      },
      {
        "Customer Name": "Beta Traders",
        "Group": "Distributors",
        "Sales Rep": "Jane Smith",
        "Status": "Inactive",
        "Customer Group": "Retail"
      }
    ];
    const ws = utils.json_to_sheet(headers);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Customer_Master_Template");
    writeFile(wb, "Customer_Master_Template.xlsx");
  };

  const handleExport = () => {
    if (items.length === 0) {
      alert("No data to export.");
      return;
    }
    const data = items.map(i => ({
      "Customer Name": i.customerName,
      "Group": i.group,
      "Sales Rep": i.salesRep,
      "Status": i.status,
      "Customer Group": i.customerGroup
    }));
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Customer_Master");
    writeFile(wb, "Customer_Master_Export.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = read(arrayBuffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = utils.sheet_to_json<any>(ws);
      const newItems: Omit<CustomerMasterItem, 'id' | 'createdAt'>[] = [];

      data.forEach((row) => {
         const getVal = (keys: string[]) => {
             for (const k of keys) {
                 const foundKey = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase());
                 if (foundKey) return row[foundKey];
             }
             return '';
         };

         const customerName = String(getVal(['customer name', 'customer', 'name']) || '');
         const group = String(getVal(['group', 'account group']) || '');
         const salesRep = String(getVal(['sales rep', 'representative', 'sales person']) || '');
         const status = String(getVal(['status', 'active']) || '');
         const customerGroup = String(getVal(['customer group', 'cust group']) || '');

         if (customerName) {
             newItems.push({
                 customerName, group, salesRep, status, customerGroup
             });
         }
      });

      if (newItems.length > 0) { onBulkAdd(newItems); alert(`Imported ${newItems.length} records.`); }
      else { alert("No valid customer records found."); }
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
        data = data.filter(i => 
            i.customerName.toLowerCase().includes(lower) || 
            i.salesRep.toLowerCase().includes(lower) ||
            i.group.toLowerCase().includes(lower)
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
  }, [items, searchTerm, sortConfig]);

  const renderSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />;
  };

  // Status Badge Helper
  const getStatusColor = (status: string) => {
      const s = status.toLowerCase();
      if (s === 'active') return 'bg-green-100 text-green-700 border-green-200';
      if (s === 'inactive' || s === 'blocked') return 'bg-red-100 text-red-700 border-red-200';
      return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  return (
    <div className="flex flex-col h-full gap-4">
      
      {/* 1. Header Stats (Simple count) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex items-center gap-3">
             <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Users className="w-5 h-5" /></div>
             <div>
                <p className="text-[10px] text-gray-500 font-medium uppercase mb-0.5">Total Customers</p>
                <p className="text-xl font-bold text-gray-900">{items.length}</p>
             </div>
          </div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex items-center gap-3">
             <div className="bg-green-50 p-2 rounded-lg text-green-600"><UserCheck className="w-5 h-5" /></div>
             <div>
                <p className="text-[10px] text-gray-500 font-medium uppercase mb-0.5">Active</p>
                <p className="text-xl font-bold text-gray-900">{items.filter(i => i.status.toLowerCase() === 'active').length}</p>
             </div>
          </div>
      </div>

      {/* 2. Actions Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex flex-col gap-3 flex-shrink-0">
         <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" /> Customer Master
            </h2>
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={handleExport}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-700 rounded-lg text-xs font-medium border border-gray-300 transition-colors shadow-sm hover:bg-gray-50"
                    title="Export All Customers"
                >
                    <FileDown className="w-3.5 h-3.5" /> Export All
                </button>
                <button onClick={handleDownloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 rounded-lg text-xs border hover:bg-gray-50 transition-colors"><Download className="w-3.5 h-3.5" /> Template</button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs border border-blue-100 hover:bg-blue-100 transition-colors"><Upload className="w-3.5 h-3.5" /> Import Excel</button>
                <div className="w-px h-6 bg-gray-200 mx-0.5 hidden sm:block"></div>
                <button onClick={onClear} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs border border-red-100 hover:bg-red-100 transition-colors"><Trash2 className="w-3.5 h-3.5" /> Clear Data</button>
            </div>
         </div>
         <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-3.5 w-3.5 text-gray-400" /></div>
            <input type="text" placeholder="Search by Name, Group, Sales Rep..." className="pl-9 pr-3 py-1.5 w-full border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
         </div>
      </div>

      {/* 3. Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0">
         <div className="overflow-auto h-full">
            <table className="w-full text-left border-collapse min-w-full">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    <tr className="border-b border-gray-200">
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('customerName')}>Customer Name {renderSortIcon('customerName')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('group')}>Group {renderSortIcon('group')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('salesRep')}>Sales Rep {renderSortIcon('salesRep')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('status')}>Status {renderSortIcon('status')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('customerGroup')}>Customer Group {renderSortIcon('customerGroup')}</th>
                        <th className="py-2 px-3 text-right">Act</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-xs text-gray-700">
                    {processedItems.length === 0 ? (
                        <tr><td colSpan={6} className="py-8 text-center text-gray-500">No matching customers found.</td></tr>
                    ) : (
                        processedItems.map(item => (
                            <tr key={item.id} className="hover:bg-blue-50/20 transition-colors">
                                <td className="py-2 px-3 font-medium text-gray-900">{item.customerName}</td>
                                <td className="py-2 px-3">{item.group}</td>
                                <td className="py-2 px-3">{item.salesRep}</td>
                                <td className="py-2 px-3">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${getStatusColor(item.status)}`}>
                                        {item.status}
                                    </span>
                                </td>
                                <td className="py-2 px-3">{item.customerGroup}</td>
                                <td className="py-2 px-3 text-right">
                                    <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-600 transition-colors p-0.5 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
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

export default CustomerMasterView;
