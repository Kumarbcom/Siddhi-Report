
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MOM, MOMItem, Material, ClosingStockItem, PendingSOItem, PendingPOItem, SalesReportItem, CustomerMasterItem, Attendee } from '../types';
import { Plus, Trash2, Save, Download, FileSpreadsheet, FileText, Calendar, Users, ListFilter, Search, ArrowRight, Printer, Loader2, User, Bell, CheckCircle, Clock, X, ChevronDown, Check } from 'lucide-react';
import { utils, writeFile } from 'xlsx';
import { momService } from '../services/momService';
import { attendeeService } from '../services/attendeeService';

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
    const [attendeeMaster, setAttendeeMaster] = useState<Attendee[]>([]);
    const [currentMom, setCurrentMom] = useState<Partial<MOM>>({
        title: 'Weekly Review Meeting',
        date: '',
        attendees: [],
        items: []
    });
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAttendeeDropdown, setShowAttendeeDropdown] = useState(false);

    // Format numbers to Cr
    const toCr = (val: number) => (val / 10000000).toFixed(2) + ' Cr';

    // Load Data
    useEffect(() => {
        const loadInitialData = async () => {
            setIsLoading(true);
            const [momsData, attendeesData] = await Promise.all([
                momService.getAll(),
                attendeeService.getAll()
            ]);
            setMoms(momsData);
            setAttendeeMaster(attendeesData);
            setIsLoading(false);
        };
        loadInitialData();
    }, []);

    // Thursday Logic
    const getThursdayOfWeek = (date: Date) => {
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1) + 3;
        return new Date(date.setDate(diff)).toISOString().split('T')[0];
    };

    useEffect(() => {
        if (!currentMom.date) {
            setCurrentMom(prev => ({ ...prev, date: getThursdayOfWeek(new Date()) }));
        }
    }, [currentMom.date]);

    // Enhanced Auto-Pull Logic matching the user's image structure
    const autoPullData = useMemo(() => {
        const momDateStr = currentMom.date || new Date().toISOString().split('T')[0];
        const momDate = new Date(momDateStr);

        // --- POINT 1: Sales Review ---
        const ytdSales = salesReportItems.reduce((acc, i) => acc + (i.value || 0), 0);

        const lastWeekStart = new Date(momDate);
        lastWeekStart.setDate(momDate.getDate() - 7);
        const lastWeekSales = salesReportItems
            .filter(i => {
                const d = new Date(i.date);
                return d >= lastWeekStart && d <= momDate;
            })
            .reduce((acc, i) => acc + (i.value || 0), 0);

        const onlineSales = salesReportItems
            .filter(i => {
                const cust = customers.find(c => c.customerName === i.customerName);
                return cust?.customerGroup === 'Online' || cust?.group === 'Online';
            })
            .reduce((acc, i) => acc + (i.value || 0), 0);

        // --- POINT 2: Pending SO ---
        const scheduledOrders = pendingSO
            .filter(i => new Date(i.dueDate) > momDate)
            .reduce((acc, i) => acc + (i.value || 0), 0);

        const dueOrders = pendingSO.filter(i => new Date(i.dueDate) <= momDate);
        const dueOrdersVal = dueOrders.reduce((acc, i) => acc + (i.value || 0), 0);

        const stockMap = new Map<string, number>();
        closingStock.forEach(s => {
            const k = s.description.toLowerCase().trim();
            stockMap.set(k, (stockMap.get(k) || 0) + s.quantity);
        });

        let readyStockVal = 0;
        dueOrders.forEach(i => {
            const availableQty = stockMap.get(i.itemName.toLowerCase().trim()) || 0;
            const utilized = Math.min(i.balanceQty, availableQty);
            readyStockVal += (utilized * i.rate);
            // Deduct from map to handle multiple orders for same item
            stockMap.set(i.itemName.toLowerCase().trim(), availableQty - utilized);
        });
        const shortageVal = Math.max(0, dueOrdersVal - readyStockVal);

        // --- POINT 3: Non-Moving ---
        const soldItemKeys = new Set(salesReportItems.map(s => (s.particulars || s.itemName || '').toLowerCase().trim()));
        const nonMovingItems = closingStock.filter(s => !soldItemKeys.has(s.description.toLowerCase().trim()));

        const lappNonMoving = nonMovingItems
            .filter(i => i.make?.toUpperCase().includes('LAPP'))
            .reduce((acc, i) => acc + (i.value || 0), 0);
        const eatonNonMoving = nonMovingItems
            .filter(i => i.make?.toUpperCase().includes('EATON'))
            .reduce((acc, i) => acc + (i.value || 0), 0);
        const othersNonMoving = nonMovingItems
            .filter(i => !i.make?.toUpperCase().includes('LAPP') && !i.make?.toUpperCase().includes('EATON'))
            .reduce((acc, i) => acc + (i.value || 0), 0);

        // --- POINT 4: Excess Stock ---
        // Definition: Stock > SO for that item
        const soMap = new Map<string, number>();
        pendingSO.forEach(s => {
            const k = s.itemName.toLowerCase().trim();
            soMap.set(k, (soMap.get(k) || 0) + s.balanceQty);
        });

        const excessItems = closingStock.map(s => {
            const k = s.description.toLowerCase().trim();
            const committed = soMap.get(k) || 0;
            const excessQty = Math.max(0, s.quantity - committed);
            const make = (s.make || 'UNSPECIFIED').toUpperCase();
            return { make, value: excessQty * s.rate };
        });

        const excessByMake: Record<string, number> = {};
        excessItems.forEach(i => {
            excessByMake[i.make] = (excessByMake[i.make] || 0) + i.value;
        });
        const totalExcess = Object.values(excessByMake).reduce((a, b) => a + b, 0);

        // --- POINT 5: Excess PO ---
        // Simplified: POs for items that already have enough STOCK + PO for current SO
        const excessPOVal = pendingPO.reduce((acc, p) => acc + (p.value || 0), 0); // Placeholder: user needs reference to PO values

        return {
            ytdSales,
            lastWeekSales,
            onlineSales,
            totalPendingSO: pendingSO.reduce((acc, i) => acc + (i.value || 0), 0),
            scheduledOrders,
            dueOrdersVal,
            readyStockVal,
            shortageVal,
            lappNonMoving,
            eatonNonMoving,
            othersNonMoving,
            totalExcess,
            excessByMake,
            excessPOVal
        };
    }, [pendingSO, closingStock, salesReportItems, customers, currentMom.date]);

    const handleAutoPopulate = () => {
        const agendaItems: MOMItem[] = [
            {
                id: crypto.randomUUID(),
                slNo: 1,
                agendaItem: `Sales Review: Present YTD vs Last Week`,
                discussion: `• Present YTD Sales: ${toCr(autoPullData.ytdSales)}\n• Online Sales YTD: ${toCr(autoPullData.onlineSales)}\n• Last Week Sales Achievement: ${toCr(autoPullData.lastWeekSales)}`,
                actionAccount: ['Kumar'],
                timeline: currentMom.date || '',
                isCompleted: false
            },
            {
                id: crypto.randomUUID(),
                slNo: 2,
                agendaItem: `Pending SO Deep Analysis - ${toCr(autoPullData.totalPendingSO)}`,
                discussion: `• Scheduled Orders (Future): ${toCr(autoPullData.scheduledOrders)}\n• Due Orders (Past/Today): ${toCr(autoPullData.dueOrdersVal)}\n• Ready Stock (For Due Orders): ${toCr(autoPullData.readyStockVal)}\n• Shortage (Need to Arrange): ${toCr(autoPullData.shortageVal)}`,
                actionAccount: ['Sales Team'],
                timeline: 'Immediate',
                isCompleted: false
            },
            {
                id: crypto.randomUUID(),
                slNo: 3,
                agendaItem: `System Stock & Non-Moving Status`,
                discussion: `• Lapp Non-Moving: ${toCr(autoPullData.lappNonMoving)}\n• Eaton Non-Moving: ${toCr(autoPullData.eatonNonMoving)}\n• Others Non-Moving: ${toCr(autoPullData.othersNonMoving)}\n• Total Physical Stock: ${toCr(closingStock.reduce((a, b) => a + (b.value || 0), 0))}`,
                actionAccount: ['Logistic Team'],
                timeline: 'Next Thursday',
                isCompleted: false
            },
            {
                id: crypto.randomUUID(),
                slNo: 4,
                agendaItem: `Excess Stock Make-wise Summary - ${toCr(autoPullData.totalExcess)}`,
                discussion: Object.entries(autoPullData.excessByMake)
                    .filter(([_, val]) => val > 1000) // Only show significant makes
                    .map(([make, val]) => `• ${make}: ${toCr(val)}`)
                    .join('\n'),
                actionAccount: ['Mohan/Gurudatt'],
                timeline: '',
                isCompleted: false
            },
            {
                id: crypto.randomUUID(),
                slNo: 5,
                agendaItem: 'Procurement Action Plan - Excess PO Analysis',
                discussion: `• Excess PO Value (on Supplier): ${toCr(autoPullData.excessPOVal)}\n• Need to send back: [INPUT AMOUNT]\n• Old Physical Excess to Liquidate: [INPUT AMOUNT]`,
                actionAccount: ['Mohan'],
                timeline: 'Immediate',
                isCompleted: false
            },
            {
                id: crypto.randomUUID(),
                slNo: 6,
                agendaItem: 'Work Flow Management',
                discussion: '• OFFER MANAGEMENT: Enquiry Match, Follow up & Conversion\n• PO VERIFICATION: Spec, Price, MOQ, Lead time checks\n• ORDER PROCESSING: SO/DC/Billing/E-Way sync\n• POD & DISPATCH: Documentation flow',
                actionAccount: ['KUMAR/GEETHA/MOHAN/VANDITHA'],
                timeline: 'Ongoing',
                isCompleted: false
            },
            {
                id: crypto.randomUUID(),
                slNo: 7,
                agendaItem: 'SOP & Approval Process',
                discussion: 'Review of individual performance SOPs and administrative approval hierarchies.',
                actionAccount: [],
                timeline: '',
                isCompleted: false
            },
            {
                id: crypto.randomUUID(),
                slNo: 8,
                agendaItem: 'Review and Check Mechanism',
                discussion: 'Implementation of PO verification protocols.',
                actionAccount: [],
                timeline: '',
                isCompleted: false
            },
            {
                id: crypto.randomUUID(),
                slNo: 9,
                agendaItem: 'Rate Contract Review',
                discussion: 'Customer and Vendor rate contract status review.',
                actionAccount: ['Ranjan'],
                timeline: 'Next Week',
                isCompleted: false
            }
        ];
        setCurrentMom(prev => ({ ...prev, items: agendaItems }));
    };

    // Auto-populate for new MOMs
    useEffect(() => {
        if (!currentMom.id && (!currentMom.items || currentMom.items.length === 0) && autoPullData.totalSales > 0) {
            handleAutoPopulate();
        }
    }, [autoPullData, currentMom.id]);

    const addItem = () => {
        const newItem: MOMItem = {
            id: crypto.randomUUID(),
            slNo: (currentMom.items?.length || 0) + 1,
            agendaItem: '',
            discussion: '',
            actionAccount: [],
            timeline: '',
            isCompleted: false
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

    const toggleAttendee = (id: string) => {
        setCurrentMom(prev => {
            const current = prev.attendees || [];
            if (current.includes(id)) {
                return { ...prev, attendees: current.filter(a => a !== id) };
            }
            return { ...prev, attendees: [...current, id] };
        });
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
            'Agenda Item': i.agendaItem,
            'Discussion': i.discussion,
            'Action Account': i.actionAccount.join(', '),
            'Timeline': i.timeline,
            'Status': i.isCompleted ? 'Completed' : 'Pending'
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
        <div className="flex flex-col h-full gap-4 w-full p-4 animate-fade-in print:p-0">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 print:hidden">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                        <FileText className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-800 tracking-tight">Weekly Review MOM</h1>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Powered by Siddhi Reports</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleAutoPopulate} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black border border-indigo-100 hover:bg-indigo-100 transition-all">
                        <ArrowRight className="w-4 h-4" /> Pull Report Info
                    </button>
                    <button onClick={handleSave} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Document
                    </button>
                    <button onClick={() => window.print()} className="p-2 bg-gray-50 text-gray-600 rounded-xl border border-gray-200 hover:bg-gray-100">
                        <Printer className="w-5 h-5" />
                    </button>
                    <button onClick={exportToExcel} className="p-2 bg-green-50 text-green-600 rounded-xl border border-green-200 hover:bg-green-100">
                        <FileSpreadsheet className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
                {/* Left Panel: History */}
                <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-4 overflow-hidden print:hidden">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search history..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Recent Records</p>
                        {filteredMoms.map(mom => (
                            <button
                                key={mom.id}
                                onClick={() => setCurrentMom(mom)}
                                className={`flex flex-col gap-1 p-3 rounded-xl border text-left transition-all ${currentMom.id === mom.id ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-100 hover:border-gray-300'}`}
                            >
                                <span className="text-sm font-bold text-gray-800">{mom.title}</span>
                                <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold">
                                    <Clock className="w-3 h-3" /> {mom.date}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content */}
                <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col print:border-none print:shadow-none print:bg-white">
                    {/* Document Header */}
                    <div className="p-8 border-b border-gray-100 bg-gray-50/30 print:bg-white print:p-4">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 tracking-tighter mb-1 print:text-xl">Minutes of Meeting (MOM)</h2>
                                <div className="flex items-center gap-2">
                                    <div className="w-12 h-1 bg-indigo-600 rounded-full"></div>
                                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Official Record</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Meeting Date</label>
                                <input
                                    type="date"
                                    className="bg-transparent border-none text-right font-black text-gray-800 focus:ring-0 p-0 text-sm"
                                    value={currentMom.date}
                                    onChange={e => setCurrentMom(prev => ({ ...prev, date: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Meeting Title</label>
                                <input
                                    type="text"
                                    className="w-full bg-white border border-gray-100 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-800 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all print:border-none print:font-black"
                                    value={currentMom.title}
                                    onChange={e => setCurrentMom(prev => ({ ...prev, title: e.target.value }))}
                                />
                            </div>
                            <div className="relative">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block flex justify-between items-center">
                                    Attendees ({currentMom.attendees?.length || 0})
                                    <button
                                        onClick={() => setShowAttendeeDropdown(!showAttendeeDropdown)}
                                        className="text-indigo-600 hover:text-indigo-700 text-[10px] font-black flex items-center gap-1 print:hidden"
                                    >
                                        <Plus className="w-3 h-3" /> Select Participants
                                    </button>
                                </label>
                                <div className="flex flex-wrap gap-2 min-h-[44px] p-2 bg-white border border-gray-100 rounded-xl shadow-sm print:border-none">
                                    {currentMom.attendees?.length ? (
                                        currentMom.attendees.map(id => {
                                            const attendee = attendeeMaster.find(a => a.id === id);
                                            return attendee ? (
                                                <div key={id} className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg border border-indigo-100 animate-fade-in group print:bg-white print:border-none print:p-0">
                                                    {attendee.imageUrl && <img src={attendee.imageUrl} className="w-4 h-4 rounded-full object-cover print:hidden" alt="" />}
                                                    <span className="text-[11px] font-bold">{attendee.name}</span>
                                                    <button onClick={() => toggleAttendee(id)} className="text-indigo-300 hover:text-indigo-600 print:hidden"><X className="w-3 h-3" /></button>
                                                </div>
                                            ) : null;
                                        })
                                    ) : <span className="text-xs text-gray-300 italic p-1">No attendees selected...</span>}
                                </div>

                                {showAttendeeDropdown && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 p-3 max-h-64 overflow-y-auto scale-in-center print:hidden">
                                        <div className="grid grid-cols-1 gap-1">
                                            {attendeeMaster.map(a => (
                                                <button
                                                    key={a.id}
                                                    onClick={() => toggleAttendee(a.id)}
                                                    className={`flex items-center justify-between w-full p-2.5 rounded-xl text-left transition-all ${currentMom.attendees?.includes(a.id) ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden">
                                                            {a.imageUrl ? <img src={a.imageUrl} className="w-full h-full object-cover" alt="" /> : <User className="w-4 h-4 text-indigo-600" />}
                                                        </div>
                                                        <div>
                                                            <div className="text-xs font-black">{a.name}</div>
                                                            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{a.designation}</div>
                                                        </div>
                                                    </div>
                                                    {currentMom.attendees?.includes(a.id) && <Check className="w-4 h-4" />}
                                                </button>
                                            ))}
                                            {attendeeMaster.length === 0 && (
                                                <div className="text-center py-4">
                                                    <p className="text-xs text-gray-400">No attendees found in master.</p>
                                                    <button className="text-[10px] font-black text-indigo-600 mt-2">Go to Attendee Master</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* MOM Table */}
                    <div className="flex-1 overflow-auto bg-white p-8 print:p-4">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="border-b-2 border-gray-900 print:border-b-4">
                                    <th className="py-4 text-left w-12 text-[10px] font-black uppercase tracking-widest text-gray-400 print:text-black">S.No</th>
                                    <th className="py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400 print:text-black">Agenda Item & Discussion</th>
                                    <th className="py-4 text-left w-48 text-[10px] font-black uppercase tracking-widest text-gray-400 print:text-black">Action Account</th>
                                    <th className="py-4 text-left w-40 text-[10px] font-black uppercase tracking-widest text-gray-400 print:text-black">Timeline</th>
                                    <th className="py-4 text-right w-12 print:hidden"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {currentMom.items?.map((item) => (
                                    <tr key={item.id} className="group hover:bg-gray-50/50 transition-colors">
                                        <td className="py-6 align-top text-xs font-black text-gray-800">{item.slNo}</td>
                                        <td className="py-6 px-4 align-top">
                                            <div className="flex flex-col gap-2">
                                                <input
                                                    type="text"
                                                    className="w-full bg-transparent font-black text-gray-900 outline-none text-sm placeholder:text-gray-200 print:text-[13px]"
                                                    value={item.agendaItem}
                                                    onChange={e => updateItem(item.id, 'agendaItem', e.target.value)}
                                                    placeholder="Enter Agenda Item..."
                                                />
                                                <textarea
                                                    className="w-full bg-transparent text-xs text-gray-600 outline-none resize-none min-h-[80px] leading-relaxed placeholder:text-gray-200 print:text-[11px] print:text-black"
                                                    value={item.discussion}
                                                    onChange={e => updateItem(item.id, 'discussion', e.target.value)}
                                                    placeholder="Discussion details..."
                                                />
                                            </div>
                                        </td>
                                        <td className="py-6 align-top pr-4 w-64">
                                            <div className="relative group/assoc">
                                                <div className="flex flex-wrap gap-1 mb-2">
                                                    {item.actionAccount.map(acc => (
                                                        <span key={acc} className="flex items-center gap-1 bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-bold border border-gray-200">
                                                            {acc}
                                                            <button
                                                                onClick={() => {
                                                                    const next = item.actionAccount.filter(a => a !== acc);
                                                                    updateItem(item.id, 'actionAccount', next);
                                                                }}
                                                                className="text-gray-400 hover:text-red-500 print:hidden"
                                                            >
                                                                <X className="w-2.5 h-2.5" />
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                                <select
                                                    className="w-full bg-white border border-gray-100 rounded-lg px-2 py-1.5 text-[10px] font-bold text-gray-700 outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm print:hidden"
                                                    value=""
                                                    onChange={e => {
                                                        if (e.target.value && !item.actionAccount.includes(e.target.value)) {
                                                            updateItem(item.id, 'actionAccount', [...item.actionAccount, e.target.value]);
                                                        }
                                                    }}
                                                >
                                                    <option value="">Assign Person...</option>
                                                    {attendeeMaster.map(a => (
                                                        <option key={a.id} value={a.name}>{a.name}</option>
                                                    ))}
                                                    <option value="Sales Team">Sales Team</option>
                                                    <option value="Logistic Team">Logistic Team</option>
                                                    <option value="Warehouse">Warehouse</option>
                                                </select>
                                                <div className="hidden print:block text-[11px] font-black text-gray-800">
                                                    {item.actionAccount.join(', ')}
                                                </div>
                                                <div className="mt-2 flex items-center gap-2 px-1 print:hidden">
                                                    <button
                                                        onClick={() => updateItem(item.id, 'isCompleted', !item.isCompleted)}
                                                        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-black uppercase transition-all ${item.isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}
                                                    >
                                                        {item.isCompleted ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                                        {item.isCompleted ? 'Completed' : 'Pending'}
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-6 align-top">
                                            <div className="space-y-2">
                                                <div className="relative group/cal">
                                                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-indigo-400 pointer-events-none" />
                                                    <input
                                                        type="text"
                                                        className="w-full bg-white border border-gray-100 rounded-lg pl-8 pr-3 py-2 text-[11px] font-bold text-gray-700 outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm print:border-none print:shadow-none print:font-black"
                                                        value={item.timeline}
                                                        onChange={e => updateItem(item.id, 'timeline', e.target.value)}
                                                        placeholder="Next Thursday"
                                                    />
                                                </div>
                                                <div className="relative print:hidden">
                                                    <Bell className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-rose-400 pointer-events-none" />
                                                    <input
                                                        type="date"
                                                        className="w-full bg-rose-50/30 border border-rose-100 rounded-lg pl-8 pr-3 py-1.5 text-[10px] font-bold text-rose-600 outline-none focus:ring-1 focus:ring-rose-500"
                                                        value={item.reminderDate || ''}
                                                        onChange={e => updateItem(item.id, 'reminderDate', e.target.value)}
                                                        title="Set Reminder"
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-6 text-right align-top print:hidden">
                                            <button
                                                onClick={() => removeItem(item.id)}
                                                className="p-1.5 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {(!currentMom.items || currentMom.items.length === 0) && (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <FileText className="w-12 h-12 text-gray-100" />
                                                <p className="text-gray-400 text-sm font-bold">No items found. Click 'Pull Report Info' or 'Add Item' to start.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        <button
                            onClick={addItem}
                            className="mt-6 flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-100 rounded-2xl text-gray-400 hover:border-indigo-200 hover:text-indigo-500 hover:bg-indigo-50/50 transition-all text-xs font-black w-full justify-center print:hidden"
                        >
                            <Plus className="w-4 h-4" /> Add New Agenda Point
                        </button>
                    </div>

                    {/* Document Footer */}
                    <div className="p-8 bg-gray-50/50 border-t border-gray-100 print:bg-white print:p-4">
                        <div className="flex justify-between items-end">
                            <div className="space-y-4">
                                <div className="flex gap-12">
                                    <div className="w-48 border-t border-gray-900 pt-2 print:border-black">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 print:text-black">Prepared By</p>
                                    </div>
                                    <div className="w-48 border-t border-gray-900 pt-2 print:border-black">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 print:text-black">Approved By</p>
                                    </div>
                                </div>
                                <p className="text-[10px] text-gray-400 font-bold italic print:text-black">This is a system generated document from Siddhi Reports.</p>
                            </div>
                            <div className="text-right flex flex-col items-end gap-2">
                                <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 print:border-black">
                                    <p className="text-[10px] font-black text-gray-400 uppercase print:text-black">Document ID</p>
                                    <p className="text-xs font-black text-gray-800 print:text-black">{currentMom.id?.slice(0, 8).toUpperCase() || 'NEW'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @media print {
                    @page { margin: 1cm; size: A4; }
                    body { background: white !important; }
                    .print\\:hidden { display: none !important; }
                    .max-w-6xl { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
                    .lg\\:col-span-1 { display: none !important; }
                    .lg\\:col-span-3 { width: 100% !important; }
                    table { page-break-inside: auto; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                    thead { display: table-header-group; }
                    tfoot { display: table-footer-group; }
                }
                .scale-in-center { animation: scale-in-center 0.2s cubic-bezier(0.250, 0.460, 0.450, 0.940) both; }
                @keyframes scale-in-center {
                    0% { transform: scale(0.95); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default MOMView;
