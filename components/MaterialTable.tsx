
import React, { useState, useMemo } from 'react';
import { Material } from '../types';
import { Trash2, PackageOpen, Search, ArrowUpDown, ArrowUp, ArrowDown, Pencil, Save, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface MaterialTableProps {
  materials: Material[];
  onUpdate: (item: Material) => void;
  onDelete: (id: string) => void;
}

type SortKey = keyof Material;

const MaterialTable: React.FC<MaterialTableProps> = ({ materials, onUpdate, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  
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
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const processedMaterials = useMemo(() => {
    let data = [...materials];
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      data = data.filter(item => 
        item.description.toLowerCase().includes(lowerSearch) ||
        item.partNo.toLowerCase().includes(lowerSearch) ||
        item.make.toLowerCase().includes(lowerSearch) ||
        item.materialGroup.toLowerCase().includes(lowerSearch)
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
  }, [materials, searchTerm, sortConfig]);

  const totalPages = Math.ceil(processedMaterials.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedMaterials.slice(start, start + itemsPerPage);
  }, [processedMaterials, currentPage, itemsPerPage]);

  const renderSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />;
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="relative flex-shrink-0">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-3.5 w-3.5 text-gray-400" /></div>
        <input
          type="text"
          placeholder="Search materials..."
          className="pl-9 pr-3 py-1.5 w-full border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              <tr className="border-b border-gray-200">
                <th className="py-2 px-3 bg-gray-100 border-r border-gray-200 w-12 text-center">#</th>
                <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('description')}>Description {renderSortIcon('description')}</th>
                <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('partNo')}>Part No {renderSortIcon('partNo')}</th>
                <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('make')}>Make {renderSortIcon('make')}</th>
                <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('materialGroup')}>Group {renderSortIcon('materialGroup')}</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-xs">
              {paginatedItems.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-500">No matching materials found.</td></tr>
              ) : (
                paginatedItems.map((material, idx) => {
                  const serialNo = (currentPage - 1) * itemsPerPage + idx + 1;
                  return (
                    <tr key={material.id} className={`hover:bg-blue-50/50 group ${editingId === material.id ? 'bg-blue-50' : ''}`}>
                      <td className="py-2 px-3 bg-gray-50/50 text-center text-gray-400 font-mono border-r border-gray-100">{serialNo}</td>
                      {editingId === material.id ? (
                        <>
                          <td className="py-2 px-3"><input type="text" className="w-full border border-blue-300 rounded px-1.5 py-0.5" value={editForm?.description || ''} onChange={e => handleInputChange('description', e.target.value)} /></td>
                          <td className="py-2 px-3"><input type="text" className="w-full border border-blue-300 rounded px-1.5 py-0.5" value={editForm?.partNo || ''} onChange={e => handleInputChange('partNo', e.target.value)} /></td>
                          <td className="py-2 px-3"><input type="text" className="w-full border border-blue-300 rounded px-1.5 py-0.5" value={editForm?.make || ''} onChange={e => handleInputChange('make', e.target.value)} /></td>
                          <td className="py-2 px-3"><input type="text" className="w-full border border-blue-300 rounded px-1.5 py-0.5" value={editForm?.materialGroup || ''} onChange={e => handleInputChange('materialGroup', e.target.value)} /></td>
                          <td className="py-2 px-3 text-right"><div className="flex justify-end gap-1"><button onClick={handleSaveEdit} className="p-1 rounded bg-green-100 text-green-700"><Save className="w-3.5 h-3.5" /></button><button onClick={handleCancelEdit} className="p-1 rounded bg-red-100 text-red-700"><X className="w-3.5 h-3.5" /></button></div></td>
                        </>
                      ) : (
                        <>
                          <td className="py-2 px-3 font-medium text-gray-900">{material.description}</td>
                          <td className="py-2 px-3 text-gray-600 font-mono">{material.partNo}</td>
                          <td className="py-2 px-3"><span className="inline-flex px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 border border-gray-200">{material.make}</span></td>
                          <td className="py-2 px-3 text-gray-600">{material.materialGroup}</td>
                          <td className="py-2 px-3 text-right"><div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100"><button onClick={() => handleEditClick(material)} className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></button><button onClick={() => onDelete(material.id)} className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button></div></td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 px-3 py-2 border-t border-gray-200 text-[10px] text-gray-500 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-2">
            <span>Rows:</span><select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="bg-white border rounded px-1"><option value={50}>50</option><option value={100}>100</option><option value={500}>500</option></select>
            <span className="ml-2">Showing {paginatedItems.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} - {Math.min(currentPage * itemsPerPage, processedMaterials.length)} of {processedMaterials.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-2 font-medium text-gray-700">Page {currentPage} / {Math.max(1, totalPages)}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaterialTable;
