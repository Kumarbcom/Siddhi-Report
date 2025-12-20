
import React, { useRef } from 'react';
import { Material, MaterialFormData } from '../types';
import { Upload, Download, Trash2, FileDown } from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';

interface AddMaterialFormProps {
  materials: Material[];
  onBulkAdd: (data: MaterialFormData[]) => void;
  onClear: () => void;
}

const AddMaterialForm: React.FC<AddMaterialFormProps> = ({ materials, onBulkAdd, onClear }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const headers = [
      { 
        "Material Code": "MAT-001",
        "Description": "Deep Groove Ball Bearing 6205", 
        "Part No": "6205-2RS", 
        "Make": "SKF", 
        "Material Group": "MECH-BRG" 
      },
      { 
        "Material Code": "MAT-002",
        "Description": "Inductive Proximity Sensor", 
        "Part No": "IME12-04NNSZC0S", 
        "Make": "SICK", 
        "Material Group": "ELEC-SENS" 
      }
    ];
    const ws = utils.json_to_sheet(headers);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Template");
    writeFile(wb, "Material_Master_Template.xlsx");
  };

  const handleExport = () => {
    if (materials.length === 0) {
      alert("No data to export.");
      return;
    }
    const data = materials.map(m => ({
      "Material Code": m.materialCode,
      "Description": m.description,
      "Part No": m.partNo,
      "Make": m.make,
      "Material Group": m.materialGroup
    }));
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Material_Master");
    writeFile(wb, "Material_Master_Export.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = read(arrayBuffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = utils.sheet_to_json<any>(ws);
      
      const validItems: MaterialFormData[] = data.map((row) => {
         // Try to match common header variations case-insensitively
         const getVal = (key: string) => {
             const foundKey = Object.keys(row).find(k => k.toLowerCase().trim() === key.toLowerCase().trim());
             return foundKey ? String(row[foundKey]) : '';
         };

         return {
             materialCode: getVal('material code') || getVal('code') || getVal('id'),
             description: getVal('description') || getVal('desc'),
             partNo: getVal('part no') || getVal('partno') || getVal('part number'),
             make: getVal('make') || getVal('brand') || getVal('manufacturer'),
             materialGroup: getVal('material group') || getVal('materialgroup') || getVal('group')
         };
      }).filter(item => item.description && item.partNo);

      if (validItems.length > 0) {
        onBulkAdd(validItems);
      } else {
        alert("No valid material records found in the Excel file. Please ensure columns named 'Description' and 'Part No' exist.");
      }
    } catch (err) {
      console.error("Error parsing Excel:", err);
      alert("Failed to parse the Excel file. Please ensure it is a valid .xlsx or .xls file.");
    }
    
    // Reset the input so the same file can be selected again if needed
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h2 className="text-lg font-semibold text-gray-800">Actions</h2>
        <div className="flex flex-wrap gap-3">
            <button
                type="button"
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors border border-gray-200 shadow-sm"
                title="Export All Materials"
            >
                <FileDown className="w-4 h-4" />
                Export All
            </button>
            <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors border border-gray-200 shadow-sm"
                title="Download Excel Template"
            >
                <Download className="w-4 h-4" />
                Template
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".xlsx, .xls" 
                onChange={handleFileUpload} 
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors border border-blue-100"
            >
              <Upload className="w-4 h-4" />
              Import Excel
            </button>
            <div className="w-px h-8 bg-gray-200 mx-1 hidden sm:block"></div>
            <button
                type="button"
                onClick={onClear}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors border border-red-100"
                title="Clear All Material Data"
            >
                <Trash2 className="w-4 h-4" />
                Clear Data
            </button>
        </div>
      </div>
    </div>
  );
};

export default AddMaterialForm;
