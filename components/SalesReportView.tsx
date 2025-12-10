
import React, { useRef, useState, useMemo } from 'react';
import { SalesReportItem, Material, CustomerMasterItem } from '../types';
import { Trash2, Download, Upload, Search, ArrowUpDown, ArrowUp, ArrowDown, FileBarChart, AlertTriangle, UserX, PackageX, Users, Package, FileWarning, FileDown, Loader2 } from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';

interface SalesReportViewProps {
  items: SalesReportItem[];
  materials: Material[];
  customers: CustomerMasterItem[];
  onBulkAdd: (items: Omit<SalesReportItem, 'id' | 'createdAt'>[]) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

// Extend the base type to include derived fields for sorting/display
type EnrichedSalesItem = SalesReportItem & {
  custGroup: string;
  salesRep: string;
  custStatus: string;
  custType: string;
  make: string;
  matGroup: string;
  isCustUnknown: boolean;
  isMatUnknown: boolean;
};

type SortKey = keyof EnrichedSalesItem;

const SalesReportView: React.FC<SalesReportViewProps> = ({ 
  items, 
  materials,
  customers,
  onBulkAdd, 
  onDelete,
  onClear
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

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

  const getStatusColor = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'active') return 'bg-green-100 text-green-700 border-green-200';
    if (s === 'inactive' || s === 'blocked') return 'bg-red-100 text-red-700 border-red-200';
    return 'text-gray-500';
  };

  const handleDownloadTemplate = () => {
    const headers = [
      {
        "Date": "2023-10-01",
        "Customer Name": "ABC Corp",
        "Particulars": "Industrial Motor 5HP",
        "Consignee": "XYZ Works",
        "Voucher No.": "INV-001",
        "Voucher Ref. No.": "PO-999",
        "Quantity": 1,
        "Value": 15000.00
      }
    ];
    const ws = utils.json_to_sheet(headers);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Sales_Report_Template");
    writeFile(wb, "Sales_Report_Template.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = read(arrayBuffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = utils.sheet_to_json<any>(ws, { cellDates: true, dateNF: 'yyyy-mm-dd' });
      const newItems: Omit<SalesReportItem, 'id' | 'createdAt'>[] = [];

      const formatExcelDate = (val: any) => {
        if (val instanceof Date) return val.toISOString().split('T')[0];
        if (typeof val === 'number') {
            const d = new Date((val - (25567 + 2)) * 86400 * 1000);
            return d.toISOString().split('T')[0];
        }
        return String(val || '');
      };

      // Robust parsing for numbers (handles commas "1,500")
      const parseNum = (val: any) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            // Remove commas, spaces, currency symbols
            const clean = val.replace(/[,Rs. ₹$]/g, '').trim();
            const num = parseFloat(clean);
            return isNaN(num) ? 0 : num;
        }
        return 0;
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
         const customerName = String(getVal(['customer name', 'customer', 'party']) || '');
         const particulars = String(getVal(['particulars', 'item', 'description']) || '');
         const consignee = String(getVal(['consignee', 'ship to']) || '');
         const voucherNo = String(getVal(['voucher no', 'voucher no.', 'inv no', 'invoice']) || '');
         const voucherRefNo = String(getVal(['voucher ref. no.', 'voucher ref no', 'ref no']) || '');
         
         const quantity = parseNum(getVal(['quantity', 'qty']));
         const value = parseNum(getVal(['value', 'amount', 'total', 'net amount']));

         if (customerName || particulars || voucherNo) {
             newItems.push({
                 date, customerName, particulars, consignee, voucherNo, voucherRefNo, quantity, value
             });
         }
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

  // --- Enrichment Logic ---
  const enrichedItems: EnrichedSalesItem[] = useMemo(() => {
    return items.map(item => {
        const cleanCust = item.customerName.toLowerCase().trim();
        const cleanPart = item.particulars.toLowerCase().trim();

        const customer = customers.find(c => c.customerName.toLowerCase().trim() === cleanCust);
        
        // Match against Part No first, then Description
        const material = materials.find(m => 
            m.partNo.toLowerCase().trim() === cleanPart || 
            m.description.toLowerCase().trim() === cleanPart
        );

        return {
            ...item,
            custGroup: customer?.group || '',
            salesRep: customer?.salesRep || '',
            custStatus: customer?.status || '',
            custType: customer?.customerGroup || '',
            make: material?.make || '',
            matGroup: material?.materialGroup || '',
            isCustUnknown: !customer && !!item.customerName,
            isMatUnknown: !material && !!item.particulars
        };
    });
  }, [items, customers, materials]);

  const processedItems = useMemo(() => {
    let data = [...enrichedItems];
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        data = data.filter(i => 
            i.customerName.toLowerCase().includes(lower) || 
            i.particulars.toLowerCase().includes(lower) ||
            i.voucherNo.toLowerCase().includes(lower) ||
            i.salesRep.toLowerCase().includes(lower) ||
            i.make.toLowerCase().includes(lower)
        );
    }
    if (sortConfig) {
        data.sort((a, b) => {
            // @ts-ignore - dynamic sort key access
            const valA = a[sortConfig.key];
            // @ts-ignore
            const valB = b[sortConfig.key];
            
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }
    return data;
  }, [enrichedItems, searchTerm, sortConfig]);

  // --- Export Discrepancies ---
  const handleExportUnknowns = () => {
    const unknownCusts = new Set<string>();
    const unknownMats = new Set<string>();

    enrichedItems.forEach(i => {
        if (i.isCustUnknown) unknownCusts.add(i.customerName);
        if (i.isMatUnknown) unknownMats.add(i.particulars);
    });

    if (unknownCusts.size === 0 && unknownMats.size === 0) {
        alert("No discrepancies found to export. All customers and items match the Master Database.");
        return;
    }

    const wb = utils.book_new();

    if (unknownCusts.size > 0) {
        const custData = Array.from(unknownCusts).map(name => ({ "Missing Customer Name": name }));
        const wsCust = utils.json_to_sheet(custData);
        utils.book_append_sheet(wb, wsCust, "Missing Customers");
    }

    if (unknownMats.size > 0) {
        const matData = Array.from(unknownMats).map(name => ({ "Missing Item Description": name }));
        const wsMat = utils.json_to_sheet(matData);
        utils.book_append_sheet(wb, wsMat, "Missing Items");
    }

    writeFile(wb, "Sales_Report_Discrepancies.xlsx");
  };

  // --- Export All Data ---
  const handleExportAll = async () => {
    if (enrichedItems.length === 0) {
      alert("No data to export.");
      return;
    }

    setIsExporting(true);

    // Use setTimeout to allow the UI to update with the spinner before the heavy sync operation blocks the thread
    setTimeout(() => {
        try {
            // Map to a clean structure for Excel
            const exportData = enrichedItems.map(item => ({
              "Date": formatDateDisplay(item.date),
              "Customer Name": item.customerName,
              "Customer Group": item.custGroup,
              "Sales Rep": item.salesRep,
              "Customer Status": item.custStatus,
              "Particulars": item.particulars,
              "Make": item.make,
              "Material Group": item.matGroup,
              "Consignee": item.consignee,
              "Voucher No.": item.voucherNo,
              "Voucher Ref. No.": item.voucherRefNo,
              "Quantity": item.quantity,
              "Value": item.value,
              "Data Quality": (item.isCustUnknown ? "Unknown Customer; " : "") + (item.isMatUnknown ? "Unknown Item" : "")
            }));
        
            const ws = utils.json_to_sheet(exportData);
            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, "Sales_Report_Full");
            
            const fileName = `Sales_Report_Full_${new Date().toISOString().split('T')[0]}.xlsx`;
            writeFile(wb, fileName);
        } catch (error) {
            console.error("Export failed:", error);
            alert("Failed to export data. The dataset might be too large.");
        } finally {
            setIsExporting(false);
        }
    }, 100);
  };

  const renderSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />;
  };

  // Calculate Totals & Validation Stats
  const stats = useMemo(() => {
      let quantity = 0;
      let value = 0;
      let unknownCustomers = 0;
      let unknownItems = 0;

      enrichedItems.forEach(item => {
          quantity += item.quantity;
          value += item.value;
          if (item.isCustUnknown) unknownCustomers++;
          if (item.isMatUnknown) unknownItems++;
      });

      return { quantity, value, unknownCustomers, unknownItems };
  }, [enrichedItems]);

  return (
    <div className="flex flex-col h-full gap-4">
      
      {/* 1. Summary Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200">
             <p className="text-[10px] text-gray-500 font-medium uppercase mb-0.5">Total Quantity</p>
             <p className="text-xl font-bold text-blue-600">{stats.quantity.toLocaleString()}</p>
          </div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200">
             <p className="text-[10px] text-gray-500 font-medium uppercase mb-0.5">Total Value</p>
             <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.value)}</p>
          </div>
          <div className={`p-3 rounded-xl shadow-sm border ${stats.unknownCustomers > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
             <div className="flex items-center gap-1.5 mb-0.5">
                 {stats.unknownCustomers > 0 ? <UserX className="w-3.5 h-3.5 text-orange-600" /> : <Users className="w-3.5 h-3.5 text-green-600" />}
                 <p className={`text-[10px] font-medium uppercase ${stats.unknownCustomers > 0 ? 'text-orange-700' : 'text-green-700'}`}>Unknown Customers</p>
             </div>
             <p className={`text-xl font-bold ${stats.unknownCustomers > 0 ? 'text-orange-800' : 'text-green-800'}`}>{stats.unknownCustomers}</p>
          </div>
          <div className={`p-3 rounded-xl shadow-sm border ${stats.unknownItems > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
             <div className="flex items-center gap-1.5 mb-0.5">
                 {stats.unknownItems > 0 ? <PackageX className="w-3.5 h-3.5 text-red-600" /> : <Package className="w-3.5 h-3.5 text-green-600" />}
                 <p className={`text-[10px] font-medium uppercase ${stats.unknownItems > 0 ? 'text-red-700' : 'text-green-700'}`}>Unknown Items</p>
             </div>
             <p className={`text-xl font-bold ${stats.unknownItems > 0 ? 'text-red-800' : 'text-green-800'}`}>{stats.unknownItems}</p>
          </div>
      </div>

      {/* 2. Actions Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex flex-col gap-3 flex-shrink-0">
         <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <FileBarChart className="w-4 h-4 text-blue-600" /> Sales Report
            </h2>
            <div className="flex flex-wrap gap-2">
                <button 
                    onClick={handleExportAll} 
                    disabled={isExporting}
                    className={`flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-700 rounded-lg text-xs font-medium border border-gray-300 transition-colors shadow-sm ${isExporting ? 'opacity-50 cursor-wait' : 'hover:bg-gray-50'}`}
                    title="Export Full Report to Excel"
                >
                    {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                    {isExporting ? 'Exporting...' : 'Export All Data'}
                </button>
                {(stats.unknownCustomers > 0 || stats.unknownItems > 0) && (
                    <button 
                        onClick={handleExportUnknowns} 
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium border border-amber-200 hover:bg-amber-100 transition-colors shadow-sm"
                        title="Export items not found in Masters to Excel"
                    >
                        <FileWarning className="w-3.5 h-3.5" /> Export Errors
                    </button>
                )}
                <button onClick={handleDownloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 rounded-lg text-xs border hover:bg-gray-50 transition-colors"><Download className="w-3.5 h-3.5" /> Template</button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs border border-blue-100 hover:bg-blue-100 transition-colors"><Upload className="w-3.5 h-3.5" /> Import Excel</button>
                <div className="w-px h-6 bg-gray-200 mx-0.5 hidden sm:block"></div>
                <button onClick={onClear} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs border border-red-100 hover:bg-red-100 transition-colors"><Trash2 className="w-3.5 h-3.5" /> Clear Data</button>
            </div>
         </div>
         <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-3.5 w-3.5 text-gray-400" /></div>
            <input type="text" placeholder="Search by Customer, Particulars, Sales Rep, Make..." className="pl-9 pr-3 py-1.5 w-full border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
         </div>
      </div>

      {/* 3. Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0">
         <div className="overflow-auto h-full">
            <table className="w-full text-left border-collapse min-w-full">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    <tr className="border-b border-gray-200">
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('date')}>Date {renderSortIcon('date')}</th>
                        
                        {/* Customer Master Columns */}
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100 bg-blue-50/50" onClick={() => handleSort('customerName')}>Customer {renderSortIcon('customerName')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100 bg-blue-50/50" onClick={() => handleSort('custGroup')}>Group {renderSortIcon('custGroup')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100 bg-blue-50/50" onClick={() => handleSort('salesRep')}>Rep {renderSortIcon('salesRep')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100 bg-blue-50/50" onClick={() => handleSort('custStatus')}>Status {renderSortIcon('custStatus')}</th>
                        
                        {/* Material Master Columns */}
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100 bg-orange-50/50 w-56" onClick={() => handleSort('particulars')}>Particulars {renderSortIcon('particulars')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100 bg-orange-50/50" onClick={() => handleSort('make')}>Make {renderSortIcon('make')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100 bg-orange-50/50" onClick={() => handleSort('matGroup')}>Mat Group {renderSortIcon('matGroup')}</th>
                        
                        {/* Other Sales Columns */}
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('voucherNo')}>Voucher {renderSortIcon('voucherNo')}</th>
                        <th className="py-2 px-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('quantity')}>Qty {renderSortIcon('quantity')}</th>
                        <th className="py-2 px-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('value')}>Value {renderSortIcon('value')}</th>
                        <th className="py-2 px-3 text-right">Act</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-xs text-gray-700">
                    {processedItems.length === 0 ? (
                        <tr><td colSpan={12} className="py-8 text-center text-gray-500">No matching sales records found.</td></tr>
                    ) : (
                        processedItems.map(item => {
                            return (
                                <tr key={item.id} className="hover:bg-blue-50/20 transition-colors">
                                    <td className="py-2 px-3 whitespace-nowrap text-gray-500">{formatDateDisplay(item.date)}</td>
                                    
                                    {/* Customer Info */}
                                    <td className="py-2 px-3 max-w-[150px] bg-blue-50/20">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-900 truncate" title={item.customerName}>{item.customerName}</span>
                                            {item.isCustUnknown && (
                                                <span className="inline-flex items-center gap-0.5 mt-0.5 text-[9px] text-orange-700 bg-orange-50 px-1 py-px rounded border border-orange-100 w-fit whitespace-nowrap">
                                                    <AlertTriangle className="w-2 h-2" /> Not in Master
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-2 px-3 bg-blue-50/20 text-gray-600 truncate max-w-[100px]" title={item.custGroup}>{item.custGroup || '-'}</td>
                                    <td className="py-2 px-3 bg-blue-50/20 text-gray-600 truncate max-w-[100px]" title={item.salesRep}>{item.salesRep || '-'}</td>
                                    <td className="py-2 px-3 bg-blue-50/20">
                                        {item.custStatus ? (
                                            <span className={`inline-block px-1.5 py-px rounded text-[9px] font-medium border ${getStatusColor(item.custStatus)}`}>
                                                {item.custStatus}
                                            </span>
                                        ) : <span className="text-gray-400">-</span>}
                                    </td>

                                    {/* Material Info */}
                                    <td className="py-2 px-3 max-w-[200px] bg-orange-50/20">
                                        <div className="flex flex-col">
                                            <span className="truncate text-gray-800" title={item.particulars}>{item.particulars}</span>
                                            {item.isMatUnknown && (
                                                <span className="inline-flex items-center gap-0.5 mt-0.5 text-[9px] text-red-700 bg-red-50 px-1 py-px rounded border border-red-100 w-fit whitespace-nowrap">
                                                    <AlertTriangle className="w-2 h-2" /> Not in Master
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-2 px-3 bg-orange-50/20 text-gray-600 truncate max-w-[80px]">{item.make || '-'}</td>
                                    <td className="py-2 px-3 bg-orange-50/20 text-gray-600 truncate max-w-[80px]">{item.matGroup || '-'}</td>

                                    {/* Sales Data */}
                                    <td className="py-2 px-3 text-gray-500 font-mono text-[10px] whitespace-nowrap">{item.voucherNo}</td>
                                    <td className="py-2 px-3 text-right font-medium">{item.quantity}</td>
                                    <td className="py-2 px-3 text-right font-bold text-gray-900 whitespace-nowrap">{formatCurrency(item.value)}</td>
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

export default SalesReportView;
