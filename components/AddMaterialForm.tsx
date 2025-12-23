
import React, { useRef } from 'react';
import { Material, MaterialFormData } from '../types';
import { Upload, Download, Trash2, FileDown, PlusCircle, Database, LayoutGrid } from 'lucide-react';
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
         // Flexible header matching helper
         const getVal = (keyArray: string[]) => {
             const foundKey = Object.keys(row).find(k => 
                keyArray.some(target => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(target.toLowerCase().replace(/[^a-z0-9]/g, '')))
             );
             return foundKey ? String(row[foundKey]).trim() : '';
         };

         return {
             materialCode: getVal(['materialcode', 'matcode', 'code', 'id', 'itemcode']),
             description: getVal(['description', 'desc', 'itemname', 'particulars', 'materialname']),
             partNo: getVal(['partno', 'partnumber', 'reference', 'refno', 'pno']),
             make: getVal(['make', 'brand', 'manufacturer', 'mfr', 'mfg']),
             materialGroup: getVal(['materialgroup', 'group', 'category', 'class'])
         };
      }).filter(item => item.description); // Description is essential

      if (validItems.length > 0) {
        onBulkAdd(validItems);
        // Note: The count might be slightly lower if service dedupes internal codes
        alert(`Initiated import of ${validItems.length} items to database.`);
      } else {
        alert("Extraction failed: Please ensure your Excel has a column for 'Description'.");
      }
    } catch (err) {
      console.error("Excel Parsing Error:", err);
      alert("Failed to read the Excel file.");
    }
    
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-md">
                <Database className="w-5 h-5" />
            </div>
            <div>
                <h2 className="text-sm font-black text-gray-800 uppercase tracking-tight">Material Repository</h2>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold border border-indigo-100">{materials.length} Master Records</span>
                </div>
            </div>
        </div>
        
        <div className="flex flex-wrap justify-center sm:justify-end gap-2">
            <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-200 shadow-inner">
                <button
                    type="button"
                    onClick={handleExport}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 rounded-md text-[10px] font-black uppercase tracking-wider hover:bg-white hover:text-indigo-600 transition-all"
                >
                    <FileDown className="w-3.5 h-3.5" />
                    Export
                </button>
                <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 rounded-md text-[10px] font-black uppercase tracking-wider hover:bg-white hover:text-indigo-600 transition-all border-l border-gray-200"
                >
                    <Download className="w-3.5 h-3.5" />
                    Template
                </button>
            </div>

            <div className="flex gap-2">
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
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
                >
                  <Upload className="w-4 h-4" />
                  Batch Import
                </button>
                
                <button
                    type="button"
                    onClick={onClear}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-red-100 transition-colors border border-red-100"
                    title="Clear All Master Data"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AddMaterialForm;
