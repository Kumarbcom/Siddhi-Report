
import React, { useState, useMemo } from 'react';
import { Material } from '../types';
import { Trash2, PackageOpen, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface MaterialTableProps {
  materials: Material[];
  onDelete: (id: string) => void;
}

type SortKey = keyof Material;

const MaterialTable: React.FC<MaterialTableProps> = ({ materials, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const processedMaterials = useMemo(() => {
    let data = [...materials];

    // Filter
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      data = data.filter(item => 
        item.description.toLowerCase().includes(lowerSearch) ||
        item.partNo.toLowerCase().includes(lowerSearch) ||
        item.make.toLowerCase().includes(lowerSearch) ||
        item.materialGroup.toLowerCase().includes(lowerSearch)
      );
    }

    // Sort
    if (sortConfig) {
      data.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [materials, searchTerm, sortConfig]);

  const renderSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-blue-500" /> 
      : <ArrowDown className="w-3 h-3 text-blue-500" />;
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Search Bar */}
      <div className="relative flex-shrink-0">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-3.5 w-3.5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search materials by Description, Part No, Make..."
          className="pl-9 pr-3 py-1.5 w-full border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="overflow-auto flex-1 h-[calc(100vh-280px)]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
              <tr className="border-b border-gray-200">
                <th 
                  className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('description')}
                >
                  <div className="flex items-center gap-1">Description {renderSortIcon('description')}</div>
                </th>
                <th 
                  className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('partNo')}
                >
                  <div className="flex items-center gap-1">Part No {renderSortIcon('partNo')}</div>
                </th>
                <th 
                  className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('make')}
                >
                  <div className="flex items-center gap-1">Make {renderSortIcon('make')}</div>
                </th>
                <th 
                  className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('materialGroup')}
                >
                  <div className="flex items-center gap-1">Group {renderSortIcon('materialGroup')}</div>
                </th>
                <th className="py-2 px-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {processedMaterials.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                        <PackageOpen className="w-6 h-6 text-gray-300 mb-1" />
                        <p className="text-xs">No matching materials found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                  processedMaterials.map((material) => (
                    <tr 
                      key={material.id} 
                      className="hover:bg-blue-50/50 transition-colors duration-150 group"
                    >
                      <td className="py-2 px-3 text-xs font-medium text-gray-900">{material.description}</td>
                      <td className="py-2 px-3 text-xs text-gray-600 font-mono">{material.partNo}</td>
                      <td className="py-2 px-3 text-xs text-gray-600">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-800 border border-gray-200">
                          {material.make}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-xs text-gray-600">{material.materialGroup}</td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => onDelete(material.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-md hover:bg-red-50"
                          title="Delete Material"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 px-3 py-2 border-t border-gray-200 text-[10px] text-gray-500 flex justify-between items-center flex-shrink-0">
          <span>Showing {processedMaterials.length} of {materials.length} records</span>
          <span>Local Database</span>
        </div>
      </div>
    </div>
  );
};

export default MaterialTable;
