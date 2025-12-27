
import React, { useState, useMemo, useEffect } from 'react';
import { MOM, MOMItem, Material, ClosingStockItem, PendingSOItem, PendingPOItem, SalesReportItem, CustomerMasterItem } from '../types';
import { Plus, Trash2, Save, Download, FileSpreadsheet, FileText, Calendar, Users, ListFilter, Search, ArrowRight, Printer, Loader2 } from 'lucide-react';
import { utils, writeFile } from 'xlsx';
import { momService } from '../services/momService';

interface MOMViewProps {
    materials: Material[];
    closingStock: ClosingStockItem[];
    pendingSO: PendingSOItem[];
    pendingPO: PendingPOItem[];
    salesReportItems: SalesReportItem[];
    customers: CustomerMasterItem[];
}

const MOMView: React.FC<MOMViewProps> = ({
    materials,
    closingStock,
    pendingSO,
    pendingPO,
    salesReportItems,
    customers
}) => {
    const [moms, setMoms] = useState<MOM[]>([]);
    const [currentMom, setCurrentMom] = useState<Partial<MOM>>({
        title: 'Weekly Review Meeting',
        date: '',
        attendees: [],
        items: []
    });
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Load MOms
    useEffect(() => {
        const loadMoms = async () => {
            setIsLoading(true);
            const data = await momService.getAll();
            setMoms(data);
            setIsLoading(false);
        };
        loadMoms();
    }, []);

    // Thursday Logic
    const getThursdayOfWeek = (date: Date) => {
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1) + 3; // Thursday is 4th day (Mon is 1)
        return new Date(date.setDate(diff)).toISOString().split('T')[0];
    };

    useEffect(() => {
        if (!currentMom.date) {
            setCurrentMom(prev => ({ ...prev, date: getThursdayOfWeek(new Date()) }));
        }
    }, []);

    // Auto-Pull Data Logic
    const autoPullData = useMemo(() => {
        const totalPendingSO = pendingSO.reduce((acc, i) => acc + (i.value || 0), 0);
        const scheduledOrders = pendingSO.filter(i => {
            const due = new Date(i.dueDate);
            const today = new Date();
            const diffTime = due.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays <= 7 && diffDays >= 0;
        }).reduce((acc, i) => acc + (i.value || 0), 0);

        const totalStockValue = closingStock.reduce((acc, i) => acc + (i.value || 0), 0);

        // Excess Stock Logic (simplified from Dashboard)
        const soMap = new Map<string, number>();
        pendingSO.forEach(s => {
            const k = String(s.itemName || '').toLowerCase().trim();
            soMap.set(k, (soMap.get(k) || 0) + (s.balanceQty || 0));
        });
        const excessStockVal = closingStock.reduce((acc, i) => {
            const descLower = String(i.description || '').toLowerCase().trim();
            const sQty = soMap.get(descLower) || 0;
            const excessQty = Math.max(0, (i.quantity || 0) - sQty);
            return acc + (excessQty * (i.rate || 0));
        }, 0);

        // Weekly Sales (last 7 days)
        const last7DaysSales = salesReportItems.filter(i => {
            const d = new Date(i.date);
            const today = new Date();
            const diff = today.getTime() - d.getTime();
            return diff <= 7 * 24 * 60 * 60 * 1000;
        }).reduce((acc, i) => acc + (i.value || 0), 0);

        return {
            totalPendingSO,
            scheduledOrders,
            totalStockValue,
            excessStockVal,
            last7DaysSales
        };
    }, [pendingSO, closingStock, salesReportItems]);

    const handleAutoPopulate = () => {
        const agendaItems: MOMItem[] = [
            {
                id: crypto.randomUUID(),
                slNo: 1,
                agendaItem: `Inventory Management Review - Current Total Stock Value: ₹${autoPullData.totalStockValue.toLocaleString('en-IN')}`,
                discussion: 'Review of current stock levels vs physical verification status.',
                actionAccount: ['Logistic Team'],
                timeline: 'Next Thursday'
            },
            {
                id: crypto.randomUUID(),
                slNo: 2,
                agendaItem: `Pending Sales Order Review - Total Value: ₹${autoPullData.totalPendingSO.toLocaleString('en-IN')}`,
                discussion: 'Review of all open SOs and execution plan.',
                actionAccount: ['Sales Team'],
                timeline: 'Immediate'
            },
            {
                id: crypto.randomUUID(),
                slNo: 3,
                agendaItem: `Excess & Non-Moving Stock Review - Estimated Excess: ₹${autoPullData.excessStockVal.toLocaleString('en-IN')}`,
                discussion: 'Strategy to liquidate excess inventory.',
                actionAccount: ['Sales Hub'],
                timeline: 'Next Week'
            },
            {
                id: crypto.randomUUID(),
                slNo: 4,
                agendaItem: `Scheduled Orders Analysis - Orders due this week: ₹${autoPullData.scheduledOrders.toLocaleString('en-IN')}`,
                discussion: 'Allocation of stock for high priority scheduled orders.',
                actionAccount: ['Warehouse'],
                timeline: 'Next 3 Days'
            },
            {
                id: crypto.randomUUID(),
                slNo: 5,
                agendaItem: `Weekly Sales Review - Sales Value (L7D): ₹${autoPullData.last7DaysSales.toLocaleString('en-IN')}`,
                discussion: 'Review of sales achievement against weekly targets.',
                actionAccount: ['Sales Manager'],
                timeline: 'Next Week'
            }
        ];
        setCurrentMom(prev => ({ ...prev, items: agendaItems }));
    };

    const addItem = () => {
        const newItem: MOMItem = {
            id: crypto.randomUUID(),
            slNo: (currentMom.items?.length || 0) + 1,
            agendaItem: '',
            discussion: '',
            actionAccount: [],
            timeline: ''
        };
        setCurrentMom(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
    };

    const removeItem = (id: string) => {
        setCurrentMom(prev => ({
            ...prev,
            items: prev.items?.filter(i => i.id !== id).map((item, idx) => ({ ...item, slNo: idx + 1 }))
        }));
    };

    const updateItem = (id: string, field: keyof MOMItem, value: any) => {
        setCurrentMom(prev => ({
            ...prev,
            items: prev.items?.map(i => i.id === id ? { ...i, [field]: value } : i)
        }));
    };

    const handleSave = async () => {
        if (!currentMom.title || !currentMom.date) {
            alert('Title and Date are required');
            return;
        }
        setIsLoading(true);
        try {
            const saved = await momService.save(currentMom as any);
            if (saved) {
                alert('MOM saved successfully!');
                const updatedMoms = await momService.getAll();
                setMoms(updatedMoms);
            }
        } catch (e) {
            alert('Error saving MOM');
        } finally {
            setIsLoading(false);
        }
    };

    const exportToExcel = () => {
        const data = currentMom.items?.map(i => ({
            'SL No': i.slNo,
            'Agenda Item & Discussion': i.agendaItem + '\n' + i.discussion,
            'Action Account': i.actionAccount.join(', '),
            'Timeline': i.timeline
        }));
        const ws = utils.json_to_sheet(data || []);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "MOM");
        writeFile(wb, `MOM_${currentMom.date}.xlsx`);
    };

    const filteredMoms = moms.filter(m =>
        m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.date.includes(searchTerm)
    );

    return (
        <div className="flex flex-col h-full gap-4 max-w-6xl mx-auto p-4 animate-fade-in">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                        <FileText className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-800 tracking-tight">Minutes of Meeting</h1>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Weekly Review - Thursday</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleAutoPopulate} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black border border-indigo-100 hover:bg-indigo-100 transition-all">
                        <ArrowRight className="w-4 h-4" /> Auto-Pull Data
                    </button>
                    <button onClick={handleSave} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all">
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save MOM
                    </button>
                    <div className="relative">
                        <button onClick={() => window.print()} className="p-2 bg-gray-50 text-gray-600 rounded-xl border border-gray-200 hover:bg-gray-100">
                            <Printer className="w-5 h-5" />
                        </button>
                    </div>
                    <button onClick={exportToExcel} className="p-2 bg-green-50 text-green-600 rounded-xl border border-green-200 hover:bg-green-100">
                        <FileSpreadsheet className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
                {/* Left Panel: History & Search */}
                <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-4 overflow-hidden">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by date/title..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">History</p>
                        {filteredMoms.map(mom => (
                            <button
                                key={mom.id}
                                onClick={() => setCurrentMom(mom)}
                                className={`flex flex-col gap-1 p-3 rounded-xl border text-left transition-all ${currentMom.id === mom.id ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:border-gray-300'}`}
                            >
                                <span className="text-sm font-bold text-gray-800">{mom.title}</span>
                                <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold">
                                    <Calendar className="w-3 h-3" /> {mom.date}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content: Document Editor */}
                <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col print:border-none print:shadow-none">
                    <div className="p-6 border-b border-gray-50 bg-gray-50/30">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Meeting Title</label>
                                    <input
                                        type="text"
                                        className="w-full bg-transparent border-b-2 border-gray-200 py-2 text-lg font-black text-gray-800 focus:border-blue-500 outline-none transition-colors"
                                        value={currentMom.title}
                                        onChange={e => setCurrentMom(prev => ({ ...prev, title: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Meeting Date</label>
                                    <div className="flex items-center gap-3 mt-1">
                                        <Calendar className="w-5 h-5 text-blue-500" />
                                        <input
                                            type="date"
                                            className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                                            value={currentMom.date}
                                            onChange={e => setCurrentMom(prev => ({ ...prev, date: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 flex items-center gap-2">
                                    <Users className="w-3 h-3" /> Attendees
                                </label>
                                <textarea
                                    placeholder="Enter attendee names (comma separated)..."
                                    className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm min-h-[100px] outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    value={currentMom.attendees?.join(', ')}
                                    onChange={e => setCurrentMom(prev => ({ ...prev, attendees: e.target.value.split(',').map(s => s.trim()) }))}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-6 scroll-smooth">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                    <th className="pb-4 text-left w-12">#</th>
                                    <th className="pb-4 text-left">Agenda Item & Discussion</th>
                                    <th className="pb-4 text-left w-48">Action Account</th>
                                    <th className="pb-4 text-left w-40">Timeline</th>
                                    <th className="pb-4 text-right w-12 print:hidden"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {currentMom.items?.map((item) => (
                                    <tr key={item.id} className="group hover:bg-blue-50/30 transition-colors">
                                        <td className="py-4 align-top text-xs font-black text-gray-400">{item.slNo}</td>
                                        <td className="py-2 pr-4 align-top">
                                            <div className="flex flex-col gap-1">
                                                <input
                                                    type="text"
                                                    placeholder="Agenda Item"
                                                    className="w-full bg-transparent font-bold text-gray-800 outline-none text-sm placeholder:text-gray-300"
                                                    value={item.agendaItem}
                                                    onChange={e => updateItem(item.id, 'agendaItem', e.target.value)}
                                                />
                                                <textarea
                                                    placeholder="Discussion points..."
                                                    className="w-full bg-transparent text-xs text-gray-500 outline-none resize-none min-h-[60px] placeholder:text-gray-300"
                                                    value={item.discussion}
                                                    onChange={e => updateItem(item.id, 'discussion', e.target.value)}
                                                />
                                            </div>
                                        </td>
                                        <td className="py-4 align-top pr-4">
                                            <input
                                                type="text"
                                                placeholder="Assign to..."
                                                className="w-full bg-white/50 border border-gray-100 rounded-lg px-2 py-1.5 text-[11px] font-bold text-gray-600 outline-none focus:bg-white focus:border-blue-200"
                                                value={item.actionAccount.join(', ')}
                                                onChange={e => updateItem(item.id, 'actionAccount', e.target.value.split(',').map(s => s.trim()))}
                                            />
                                        </td>
                                        <td className="py-4 align-top">
                                            <input
                                                type="text"
                                                placeholder="e.g. Next Week"
                                                className="w-full bg-white/50 border border-gray-100 rounded-lg px-2 py-1.5 text-[11px] font-bold text-gray-600 outline-none focus:bg-white focus:border-blue-200"
                                                value={item.timeline}
                                                onChange={e => updateItem(item.id, 'timeline', e.target.value)}
                                            />
                                        </td>
                                        <td className="py-4 text-right align-top print:hidden">
                                            <button
                                                onClick={() => removeItem(item.id)}
                                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button
                            onClick={addItem}
                            className="mt-4 flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-100 rounded-xl text-gray-400 hover:border-blue-200 hover:text-blue-500 hover:bg-blue-50/50 transition-all text-xs font-bold w-full justify-center print:hidden"
                        >
                            <Plus className="w-4 h-4" /> Add Agenda Item
                        </button>
                    </div>
                </div>
            </div>

            {/* Print Styles */}
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .print\\:hidden { display: none !important; }
                    .max-w-6xl { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
                    .lg\\:col-span-3 { width: 100% !important; border: none !important; }
                    .document-to-print, .document-to-print * { visibility: visible; }
                    .document-to-print { position: absolute; left: 0; top: 0; width: 100%; }
                }
            `}</style>
        </div>
    );
};

export default MOMView;
