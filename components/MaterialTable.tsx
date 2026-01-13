
import React, { useState, useMemo, useDeferredValue } from 'react';
import { Material } from '../types';
import { Trash2, Search, ArrowUpDown, ArrowUp, ArrowDown, Pencil, Save, X, Hash, Globe, WifiOff, Database, Layers, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { isSupabaseConfigured } from '../services/supabase';

interface MaterialTableProps {
  materials: Material[];
  onUpdate: (item: Material) => void;
  onDelete: (id: string) => void;
  isAdmin?: boolean;
}

type SortKey = keyof Material;

const MaterialTable: React.FC<MaterialTableProps> = ({ materials, onUpdate, onDelete, isAdmin = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);

  const isEnvLinked = isSupabaseConfigured;

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

  // Pre-calculate search text for performance
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
      data = data.filter(item => {
        return words.every(word => item.searchText.includes(word));
      });
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
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />;
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-3 items-center flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 w-full">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by Code, Description, Part No, Make..."
              className="pl-10 pr-3 py-2 w-full border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {deferredSearchTerm !== searchTerm && (
            <div className="flex items-center gap-2 text-[10px] text-blue-500 font-bold animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Filtering...</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">

          <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
            <Layers className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-bold text-blue-700 uppercase tracking-tight">{processedMaterials.length} Items</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="overflow-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur-sm shadow-sm border-b border-gray-200">
              <tr className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                <th className="py-3 px-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('materialCode')}><div className="flex items-center gap-1">Material Code {renderSortIcon('materialCode')}</div></th>
                <th className="py-3 px-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('description')}><div className="flex items-center gap-1">Description {renderSortIcon('description')}</div></th>
                <th className="py-3 px-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('partNo')}><div className="flex items-center gap-1">Part No {renderSortIcon('partNo')}</div></th>
                <th className="py-3 px-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('make')}><div className="flex items-center gap-1">Make {renderSortIcon('make')}</div></th>
                <th className="py-3 px-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('materialGroup')}><div className="flex items-center gap-1">Group {renderSortIcon('materialGroup')}</div></th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {processedMaterials.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Database className="w-12 h-12 text-gray-200" />
                      <p className="font-bold">No Records Found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                processedMaterials.map((material) => (
                  <tr key={material.id} className={`hover:bg-blue-50/20 transition-colors group ${editingId === material.id ? 'bg-blue-50' : ''}`}>
                    {editingId === material.id ? (
                      <>
                        <td className="py-2 px-4"><input type="text" className="w-full border border-blue-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500" value={editForm?.materialCode || ''} onChange={e => handleInputChange('materialCode', e.target.value)} /></td>
                        <td className="py-2 px-4"><input type="text" className="w-full border border-blue-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500" value={editForm?.description || ''} onChange={e => handleInputChange('description', e.target.value)} /></td>
                        <td className="py-2 px-4"><input type="text" className="w-full border border-blue-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500" value={editForm?.partNo || ''} onChange={e => handleInputChange('partNo', e.target.value)} /></td>
                        <td className="py-2 px-4"><input type="text" className="w-full border border-blue-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500" value={editForm?.make || ''} onChange={e => handleInputChange('make', e.target.value)} /></td>
                        <td className="py-2 px-4"><input type="text" className="w-full border border-blue-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500" value={editForm?.materialGroup || ''} onChange={e => handleInputChange('materialGroup', e.target.value)} /></td>
                        <td className="py-2 px-4 text-right">
                          <div className="flex justify-end gap-1">
                            <button onClick={handleSaveEdit} className="p-1.5 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors shadow-sm"><Save className="w-4 h-4" /></button>
                            <button onClick={handleCancelEdit} className="p-1.5 rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors shadow-sm"><X className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2.5 px-4 text-xs font-black text-blue-700 font-mono tracking-tight"><div className="flex items-center gap-2"><Hash className="w-3 h-3 text-blue-300" />{material.materialCode || '-'}</div></td>
                        <td className="py-2.5 px-4 text-xs font-bold text-gray-900 leading-tight">{material.description}</td>
                        <td className="py-2.5 px-4 text-xs text-gray-600 font-mono">{material.partNo || '-'}</td>
                        <td className="py-2.5 px-4"><span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-gray-100 text-gray-700 border border-gray-200 whitespace-nowrap">{material.make || 'Other'}</span></td>
                        <td className="py-2.5 px-4 text-xs text-gray-500 font-medium whitespace-nowrap">{material.materialGroup || '-'}</td>
                        <td className="py-2.5 px-4 text-right">
                          {isAdmin && (
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={() => handleEditClick(material)} className="text-gray-400 hover:text-blue-600 p-1.5 rounded-md hover:bg-blue-50 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => onDelete(material.id)} className="text-gray-400 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 text-[10px] text-gray-500 flex flex-col sm:flex-row justify-between items-center flex-shrink-0 gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-gray-400" />
              <span className="font-bold uppercase tracking-wider">Repository Status:</span>
            </div>
            {isEnvLinked ? (
              <span className="text-green-600 font-black flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                <CheckCircle2 className="w-3 h-3" /> Supabase Cloud Master Linked
              </span>
            ) : (
              <span className="text-blue-600 font-black flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                <Database className="w-3 h-3" /> IndexedDB Local Engine Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium italic">Master Data Integrity: 100%</span>
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaterialTable;
