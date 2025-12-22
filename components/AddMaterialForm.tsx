
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
             materialCode: getVal(['materialcode', 'matcode', 'code', 'id']),
             description: getVal(['description', 'desc', 'itemname', 'particulars', 'materialname']),
             partNo: getVal(['partno', 'partnumber', 'reference', 'refno']),
             make: getVal(['make', 'brand', 'manufacturer', 'mfr', 'mfg']),
             materialGroup: getVal(['materialgroup', 'group', 'category', 'class'])
         };
      }).filter(item => item.description); // Description is the only strict requirement

      if (validItems.length > 0) {
        onBulkAdd(validItems);
        alert(`Successfully imported ${validItems.length} materials.`);
      } else {
        alert("Extraction failed: No valid rows found. Please ensure your Excel has a column for 'Description'.");
      }
    } catch (err) {
      console.error("Excel Parsing Error:", err);
      alert("Failed to read the Excel file. Please ensure it is a valid .xlsx format.");
    }
    
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Material Master Data</h2>
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{materials.length} Records</span>
        </div>
        <div className="flex flex-wrap gap-2">
            <button
                type="button"
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors border border-gray-200 shadow-sm"
            >
                <FileDown className="w-3.5 h-3.5" />
                Export
            </button>
            <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors border border-gray-200 shadow-sm"
            >
                <Download className="w-3.5 h-3.5" />
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
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Upload className="w-3.5 h-3.5" />
              Import Excel
            </button>
            <div className="w-px h-6 bg-gray-200 mx-1 hidden sm:block"></div>
            <button
                type="button"
                onClick={onClear}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors border border-red-100"
            >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
            </button>
        </div>
      </div>
    </div>
  );
};

export default AddMaterialForm;
