
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { SalesReportItem, Material, CustomerMasterItem } from '../types';
import { Trash2, Download, Upload, Search, ArrowUpDown, ArrowUp, ArrowDown, FileDown, ChevronLeft, ChevronRight, Save, X, Pencil } from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';

/**
 * UTILITY HELPERS - TOP LEVEL
 */
const getFiscalInfo = (dateVal: any) => {
    let date = dateVal instanceof Date ? dateVal : new Date(dateVal);
    if (isNaN(date.getTime())) date = new Date();
    const month = date.getMonth(); 
    const year = date.getFullYear(); 
    const startYear = month >= 3 ? year : year - 1; 
    return { 
        fiscalYear: `${startYear}-${startYear + 1}`, 
        fiscalMonthIndex: month >= 3 ? month - 3 : month + 9 
    }; 
};

interface SalesReportViewProps {
  items: SalesReportItem[];
  materials: Material[];
  customers: CustomerMasterItem[];
  onBulkAdd: (items: Omit<SalesReportItem, 'id' | 'createdAt'>[]) => void;
  onUpdate: (item: SalesReportItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

const SalesReportView: React.FC<SalesReportViewProps> = ({ 
  items = [], 
  onBulkAdd, 
  onUpdate,
  onDelete,
  onClear
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFY, setSelectedFY] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof SalesReportItem; direction: 'asc' | 'desc' } | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  const enrichedItems = useMemo(() => {
    return items.map(item => {
        const { fiscalYear } = getFiscalInfo(item.date);
        return { ...item, fiscalYear };
    });
  }, [items]);

  const fys = useMemo(() => Array.from(new Set(enrichedItems.map(i => i.fiscalYear))).sort().reverse(), [enrichedItems]);

  useEffect(() => { if (fys.length > 0 && !selectedFY) setSelectedFY(fys[0]); }, [fys, selectedFY]);

  const filteredItems = useMemo(() => {
      let data = enrichedItems.filter(i => i.fiscalYear === selectedFY);
      if (searchTerm) {
          const l = searchTerm.toLowerCase();
          data = data.filter(i => i.customerName.toLowerCase().includes(l) || i.particulars.toLowerCase().includes(l));
      }
      if (sortConfig) {
          data.sort((a, b) => {
              const valA = a[sortConfig.key];
              const valB = b[sortConfig.key];
              if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
              if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
              return 0;
          });
      }
      return data;
  }, [enrichedItems, selectedFY, searchTerm, sortConfig]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if(!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = utils.sheet_to_json<any>(ws);
      const newItems = data.map(r => ({
          date: r.Date || r.date || new Date().toISOString(),
          customerName: r.Customer || r.customer || 'Unknown',
          particulars: r.Item || r.item || '',
          voucherNo: String(r.Voucher || ''),
          quantity: Number(r.Quantity || 0),
          value: Number(r.Value || r.Amount || 0),
          consignee: '',
          voucherRefNo: ''
      }));
      onBulkAdd(newItems);
    } catch(err) { alert("Import error"); }
  };

  const handleSort = (key: keyof SalesReportItem) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: keyof SalesReportItem) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />;
  };

  return (
    <div className="flex flex-col h-full gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4 flex-shrink-0">
            <div className="flex items-center gap-4 w-full md:w-auto">
                <select value={selectedFY} onChange={e => { setSelectedFY(e.target.value); setCurrentPage(1); }} className="border rounded px-2 py-1 text-xs">
                    {fys.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <div className="relative flex-1 md:w-64"><Search className="absolute left-2 top-1.5 w-3.5 h-3.5 text-gray-400" /><input type="text" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} placeholder="Search Sales..." className="pl-8 pr-2 py-1 text-xs border rounded w-full" /></div>
            </div>
            <div className="flex gap-2">
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700">Import Sales</button>
                <button onClick={onClear} className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-100 rounded text-xs font-bold hover:bg-red-100">Clear</button>
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="overflow-auto flex-1">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-gray-50 border-b">
                        <tr className="text-[10px] font-bold text-gray-500 uppercase">
                            <th className="p-3 cursor-pointer" onClick={() => handleSort('date')}><div className="flex items-center gap-1">Date {renderSortIcon('date')}</div></th>
                            <th className="p-3 cursor-pointer" onClick={() => handleSort('customerName')}><div className="flex items-center gap-1">Customer {renderSortIcon('customerName')}</div></th>
                            <th className="p-3 cursor-pointer" onClick={() => handleSort('particulars')}><div className="flex items-center gap-1">Item {renderSortIcon('particulars')}</div></th>
                            <th className="p-3 text-right cursor-pointer" onClick={() => handleSort('value')}><div className="flex items-center justify-end gap-1">Value {renderSortIcon('value')}</div></th>
                            <th className="p-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-xs">
                        {paginatedItems.map(i => (
                            <tr key={i.id} className="hover:bg-gray-50 transition-colors">
                                <td className="p-3 whitespace-nowrap">{String(i.date)}</td>
                                <td className="p-3 font-bold truncate max-w-[200px]">{i.customerName}</td>
                                <td className="p-3 truncate max-w-[300px]">{i.particulars}</td>
                                <td className="p-3 text-right font-bold text-emerald-600">Rs. {Math.round(i.value).toLocaleString()}</td>
                                <td className="p-3 text-right"><button onClick={() => onDelete(i.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3 flex-shrink-0">
              <div className="flex items-center gap-4 text-[10px] text-gray-500">
                  <div className="flex items-center gap-1.5 font-bold uppercase">
                      <span>Page {currentPage} of {totalPages || 1}</span>
                      <span className="text-gray-300">|</span>
                      <span>Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredItems.length)} of {filteredItems.length.toLocaleString()} records</span>
                  </div>
              </div>
              <div className="flex items-center gap-1">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="p-1.5 rounded border bg-white disabled:opacity-50 hover:bg-gray-100 text-gray-600 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                <div className="flex gap-1 overflow-x-auto max-w-[150px] scrollbar-hide">
                    {[...Array(totalPages)].map((_, i) => {
                        const page = i + 1;
                        if (totalPages > 10 && page > 3 && page < totalPages - 2 && Math.abs(page - currentPage) > 1) {
                            if (page === currentPage - 2 || page === currentPage + 2) return <span key={page} className="text-gray-300">...</span>;
                            return null;
                        }
                        return (
                            <button key={page} onClick={() => setCurrentPage(page)} className={`min-w-[28px] h-7 text-[10px] font-bold rounded border transition-colors ${currentPage === page ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>{page}</button>
                        );
                    })}
                </div>
                <button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="p-1.5 rounded border bg-white disabled:opacity-50 hover:bg-gray-100 text-gray-600 transition-colors"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
        </div>
    </div>
  );
};

export default SalesReportView;
