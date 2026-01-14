
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
  Factory,
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
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />;
  };

  return (
    <div className="flex flex-col gap-4 h-full bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
      <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 flex-1 w-full">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
            <input
              type="text"
              placeholder="Search Material Repository..."
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-blue-50 focus:border-blue-400 outline-none transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {deferredSearchTerm !== searchTerm && (
            <div className="flex items-center gap-2 text-[10px] text-blue-500 font-bold animate-pulse whitespace-nowrap">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>SYNCING...</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-2xl shadow-lg shadow-blue-100 text-[10px] font-black uppercase tracking-widest">
          <Layers className="w-4 h-4" /> {processedMaterials.length} FOUND
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-100">
            <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <th className="px-6 py-4 cursor-pointer hover:bg-gray-50" onClick={() => handleSort('materialGroup')}><div className="flex items-center gap-1">Group {renderSortIcon('materialGroup')}</div></th>
              <th className="px-6 py-4 cursor-pointer hover:bg-gray-50" onClick={() => handleSort('make')}><div className="flex items-center gap-1">Make {renderSortIcon('make')}</div></th>
              <th className="px-6 py-4 cursor-pointer hover:bg-gray-50" onClick={() => handleSort('description')}><div className="flex items-center gap-1">Description {renderSortIcon('description')}</div></th>
              <th className="px-6 py-4 cursor-pointer hover:bg-gray-50" onClick={() => handleSort('partNo')}><div className="flex items-center gap-1">Part No {renderSortIcon('partNo')}</div></th>
              <th className="px-6 py-4 text-center">Historical Sales</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {processedMaterials.map((material) => {
              const salesInfo = salesMap.get(material.description.trim().toLowerCase()) || { total: 0, customers: new Set() };
              return (
                <tr key={material.id} className={`hover:bg-blue-50/30 transition-all group ${editingId === material.id ? 'bg-blue-50 animate-pulse' : ''}`}>
                  {editingId === material.id ? (
                    <>
                      <td className="px-6 py-3"><input className="w-full border-2 border-blue-400 rounded-xl px-3 py-1.5 text-xs font-bold outline-none" value={editForm?.materialGroup || ''} onChange={e => handleInputChange('materialGroup', e.target.value)} /></td>
                      <td className="px-6 py-3"><input className="w-full border-2 border-blue-400 rounded-xl px-3 py-1.5 text-xs font-bold outline-none" value={editForm?.make || ''} onChange={e => handleInputChange('make', e.target.value)} /></td>
                      <td className="px-6 py-3"><input className="w-full border-2 border-blue-400 rounded-xl px-3 py-1.5 text-xs font-bold outline-none" value={editForm?.description || ''} onChange={e => handleInputChange('description', e.target.value)} /></td>
                      <td className="px-6 py-3"><input className="w-full border-2 border-blue-400 rounded-xl px-3 py-1.5 text-xs font-bold outline-none" value={editForm?.partNo || ''} onChange={e => handleInputChange('partNo', e.target.value)} /></td>
                      <td className="px-6 py-3 text-center">-</td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={handleSaveEdit} className="p-2 bg-green-600 text-white rounded-xl shadow-lg shadow-green-100 hover:scale-110"><Save className="w-4 h-4" /></button>
                          <button onClick={handleCancelEdit} className="p-2 bg-red-600 text-white rounded-xl shadow-lg shadow-red-100 hover:scale-110"><X className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-black bg-gray-100 text-gray-500 px-2 py-1 rounded-lg uppercase border border-gray-200">{material.materialGroup || 'UNCATEGORIZED'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg uppercase border border-blue-100">{material.make || 'OTHER'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-xs font-black text-gray-800 uppercase leading-tight line-clamp-1 group-hover:text-blue-700 transition-colors" title={material.description}>{material.description}</p>
                          <p className="text-[10px] font-bold text-gray-400 font-mono mt-0.5">{material.materialCode || '-'}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-mono font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">{material.partNo || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-center">
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-green-700">
                            <Package className="w-3 h-3" /> {salesInfo.total} Qty
                          </div>
                          <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400">
                            <Users className="w-3 h-3" /> {salesInfo.customers.size} Cust
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isAdmin && (
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => handleEditClick(material)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => onDelete(material.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
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

      <div className="p-3 bg-gray-100 border-t border-gray-200 flex justify-between items-center text-[10px] font-black text-gray-500 uppercase tracking-widest">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-600" />
            <span>{isSupabaseConfigured ? 'CLOUD ENGINE SYNCED' : 'LOCAL ENGINE ACTIVE'}</span>
          </div>
          <span className="text-gray-300">|</span>
          <span>INTEGRITY VERIFIED</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span>SYSTEM READY</span>
        </div>
      </div>
    </div>
  );
};

export default MaterialTable;
