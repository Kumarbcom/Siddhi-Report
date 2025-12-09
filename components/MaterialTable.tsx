import React from 'react';
import { Material } from '../types';
import { Trash2, PackageOpen } from 'lucide-react';

interface MaterialTableProps {
  materials: Material[];
  onDelete: (id: string) => void;
}

const MaterialTable: React.FC<MaterialTableProps> = ({ materials, onDelete }) => {
  if (materials.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center flex flex-col items-center justify-center">
        <div className="bg-blue-50 p-4 rounded-full mb-4">
          <PackageOpen className="w-8 h-8 text-blue-500" />
        </div>
        <h3 className="text-lg font-medium text-gray-900">No Materials Found</h3>
        <p className="text-gray-500 mt-2 max-w-sm">
          Your database is currently empty. Add a new material manually or use the AI generator to populate sample data.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
              <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Part No</th>
              <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Make</th>
              <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Material Group</th>
              <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {materials.map((material) => (
              <tr 
                key={material.id} 
                className="hover:bg-blue-50/50 transition-colors duration-150 group"
              >
                <td className="py-4 px-6 text-sm font-medium text-gray-900">{material.description}</td>
                <td className="py-4 px-6 text-sm text-gray-600 font-mono">{material.partNo}</td>
                <td className="py-4 px-6 text-sm text-gray-600">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {material.make}
                  </span>
                </td>
                <td className="py-4 px-6 text-sm text-gray-600">{material.materialGroup}</td>
                <td className="py-4 px-6 text-right">
                  <button
                    onClick={() => onDelete(material.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-md hover:bg-red-50"
                    title="Delete Material"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center">
        <span>Showing {materials.length} records</span>
        <span>Local Database (Persisted)</span>
      </div>
    </div>
  );
};

export default MaterialTable;