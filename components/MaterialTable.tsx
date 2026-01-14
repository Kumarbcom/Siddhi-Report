
import React, { useState, useMemo, useDeferredValue } from 'react';
import { Material, SalesReportItem } from '../types';
import {
  Trash2,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Pencil,
  Save,
  X,
  Hash,
  Database,
  Layers,
  CheckCircle2,
  Loader2,
  Grid,
  Package,
  Users
} from 'lucide-react';
import { isSupabaseConfigured } from '../services/supabase';

interface MaterialTableProps {
  materials: Material[];
  salesReportItems?: SalesReportItem[];
  onUpdate: (item: Material) => void;
  onDelete: (id: string) => void;
  isAdmin?: boolean;
}

type SortKey = keyof Material;

const MaterialTable: React.FC<MaterialTableProps> = ({ materials, salesReportItems = [], onUpdate, onDelete, isAdmin = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Material | null>(null);

  const handleEditClick = (item: Material) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleSaveEdit = () => {
    if (editForm) {
      onUpdate(editForm);
      setEditingId(null);
      setEditForm(null);
    }
  };

  const handleInputChange = (field: keyof Material, value: string) => {
    if (editForm) {
      setEditForm({ ...editForm, [field]: value });
    }
  };

  const handleSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const salesMap = useMemo(() => {
    const map = new Map();
    salesReportItems.forEach(item => {
      const key = (item.particulars || '').trim().toLowerCase();
      if (!map.has(key)) map.set(key, { total: 0, customers: new Set() });
      const data = map.get(key);
      data.total += (item.quantity || 0);
      data.customers.add(item.customerName);
    });
    return map;
  }, [salesReportItems]);

  const materialsWithSearch = useMemo(() => {
    return materials.map(m => ({
      ...m,
      searchText: `${m.materialCode || ''} ${m.description || ''} ${m.partNo || ''} ${m.make || ''} ${m.materialGroup || ''}`.toLowerCase()
    }));
  }, [materials]);

  const processedMaterials = useMemo(() => {
    let data = [...materialsWithSearch];
    if (deferredSearchTerm) {
      const words = deferredSearchTerm.toLowerCase().split(/\s+/).filter(Boolean);
      data = data.filter(item => words.every(word => item.searchText.includes(word)));
    }
    if (sortConfig) {
      data.sort((a, b) => {
        const valA = String((a as any)[sortConfig.key] || '');
        const valB = String((b as any)[sortConfig.key] || '');
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [materialsWithSearch, deferredSearchTerm, sortConfig]);

  const renderSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-green-700" /> : <ArrowDown className="w-3 h-3 text-green-700" />;
  };

  return (
    <div className="flex flex-col h-full bg-[#f3f4f6] border border-gray-300 rounded-lg overflow-hidden shadow-sm">
      {/* Search & Ribbon Area */}
      <div className="bg-white border-b border-gray-300 p-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="bg-green-700 text-white p-1.5 rounded-md">
            <Grid className="w-4 h-4" />
          </div>
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Filter Master Repository..."
              className="w-full pl-10 pr-4 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-green-600 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {deferredSearchTerm !== searchTerm && (
            <div className="flex items-center gap-2 text-[10px] text-blue-600 font-bold animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">
            ITEMS LOADED: <span className="text-green-700 font-black">{processedMaterials.length}</span>
          </div>
        </div>
      </div>

      {/* Excel Table Area */}
      <div className="flex-1 overflow-auto bg-white custom-scrollbar">
        <table className="w-full text-left border-collapse table-auto min-w-max">
          <thead className="sticky top-0 z-20 bg-[#f8f9fa]">
            <tr className="text-[10px] font-bold text-gray-600 uppercase">
              <th className="border border-gray-300 px-3 py-2 bg-gray-100 w-10 text-center select-none">#</th>
              <th className="border border-gray-300 px-3 py-2 bg-gray-50 hover:bg-gray-200 cursor-pointer select-none" onClick={() => handleSort('materialGroup')}>
                <div className="flex items-center gap-1">Group {renderSortIcon('materialGroup')}</div>
              </th>
              <th className="border border-gray-300 px-3 py-2 bg-gray-50 hover:bg-gray-200 cursor-pointer select-none" onClick={() => handleSort('make')}>
                <div className="flex items-center gap-1">Make {renderSortIcon('make')}</div>
              </th>
              <th className="border border-gray-300 px-3 py-2 bg-gray-50 hover:bg-gray-200 cursor-pointer select-none" onClick={() => handleSort('materialCode')}>
                <div className="flex items-center gap-1">Code {renderSortIcon('materialCode')}</div>
              </th>
              <th className="border border-gray-300 px-3 py-2 bg-gray-50 hover:bg-gray-200 cursor-pointer select-none min-w-[350px]" onClick={() => handleSort('description')}>
                <div className="flex items-center gap-1">Material Description {renderSortIcon('description')}</div>
              </th>
              <th className="border border-gray-300 px-3 py-2 bg-gray-50 hover:bg-gray-200 cursor-pointer select-none" onClick={() => handleSort('partNo')}>
                <div className="flex items-center gap-1">Part Number {renderSortIcon('partNo')}</div>
              </th>
              <th className="border border-gray-300 px-3 py-2 bg-green-50 text-green-800 text-center font-black">Sales Qty</th>
              <th className="border border-gray-300 px-3 py-2 bg-green-50 text-green-800 text-center font-black">Customers</th>
              <th className="border border-gray-300 px-3 py-2 bg-gray-100 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-[11px]">
            {processedMaterials.map((material, idx) => {
              const salesInfo = salesMap.get(material.description.trim().toLowerCase()) || { total: 0, customers: new Set() };
              return (
                <tr key={material.id} className="hover:bg-blue-50/50 even:bg-gray-50/20 transition-colors group">
                  <td className="border border-gray-200 px-2 py-1 text-center text-gray-400 font-mono bg-gray-50/30">{idx + 1}</td>

                  {editingId === material.id ? (
                    <>
                      <td className="border border-blue-300 px-2 py-1 bg-blue-50"><input className="w-full px-1 py-0.5 border border-blue-400 text-[10px] uppercase font-bold" value={editForm?.materialGroup || ''} onChange={e => handleInputChange('materialGroup', e.target.value)} /></td>
                      <td className="border border-blue-300 px-2 py-1 bg-blue-50"><input className="w-full px-1 py-0.5 border border-blue-400 text-[10px] uppercase font-bold" value={editForm?.make || ''} onChange={e => handleInputChange('make', e.target.value)} /></td>
                      <td className="border border-blue-300 px-2 py-1 bg-blue-50"><input className="w-full px-1 py-0.5 border border-blue-400 text-[10px] uppercase font-bold" value={editForm?.materialCode || ''} onChange={e => handleInputChange('materialCode', e.target.value)} /></td>
                      <td className="border border-blue-300 px-2 py-1 bg-blue-50"><input className="w-full px-1 py-0.5 border border-blue-400 text-[10px] uppercase font-bold" value={editForm?.description || ''} onChange={e => handleInputChange('description', e.target.value)} /></td>
                      <td className="border border-blue-300 px-2 py-1 bg-blue-50"><input className="w-full px-1 py-0.5 border border-blue-400 text-[10px] uppercase font-bold" value={editForm?.partNo || ''} onChange={e => handleInputChange('partNo', e.target.value)} /></td>
                      <td className="border border-gray-200 px-3 py-1 text-center bg-green-50/20">-</td>
                      <td className="border border-gray-200 px-3 py-1 text-center bg-green-50/20">-</td>
                      <td className="border border-gray-200 px-2 py-1 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={handleSaveEdit} className="p-1 bg-green-700 text-white rounded"><Save className="w-3.5 h-3.5" /></button>
                          <button onClick={handleCancelEdit} className="p-1 bg-red-700 text-white rounded"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="border border-gray-200 px-3 py-1 font-bold text-gray-500 uppercase">{material.materialGroup || '-'}</td>
                      <td className="border border-gray-200 px-3 py-1 font-black text-blue-700 uppercase tracking-tighter">{material.make || '-'}</td>
                      <td className="border border-gray-200 px-3 py-1 font-mono text-gray-400">{material.materialCode || '-'}</td>
                      <td className="border border-gray-200 px-3 py-1 font-black text-gray-900 uppercase truncate max-w-[400px]" title={material.description}>{material.description}</td>
                      <td className="border border-gray-200 px-3 py-1 font-mono text-gray-500">{material.partNo || '-'}</td>
                      <td className="border border-gray-200 px-3 py-1 text-center font-bold text-green-700 bg-green-50/10">{salesInfo.total || 0}</td>
                      <td className="border border-gray-200 px-3 py-1 text-center font-bold text-blue-600 bg-green-50/10">{salesInfo.customers.size || 0}</td>
                      <td className="border border-gray-200 px-3 py-1 text-right">
                        {isAdmin && (
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEditClick(material)} className="text-gray-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => onDelete(material.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Status Bar */}
      <div className="bg-green-700 text-white px-3 py-1 text-[9px] font-bold flex justify-between items-center select-none uppercase tracking-widest">
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span>{isSupabaseConfigured ? 'CONNECTED ▪ CLOUD DB' : 'LOCAL ▪ OFFLINE ENGINE'}</span>
          </div>
          <span className="text-green-500">|</span>
          <span>SYSTEM READY</span>
        </div>
        <div>REPOSITORY MASTER SHEET 100% SCALE</div>
      </div>
    </div>
  );
};

export default MaterialTable;
