
import React, { useState, useMemo, useEffect } from 'react';
import { MOM, MOMItem, Material, ClosingStockItem, PendingSOItem, PendingPOItem, SalesReportItem, CustomerMasterItem, Attendee } from '../types';
import { Plus, Trash2, Save, FileSpreadsheet, FileText, Calendar, Search, ArrowRight, Printer, Loader2, User, Bell, CheckCircle, Clock, X, History as HistoryIcon } from 'lucide-react';
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
    const PLANNED_STOCK_GROUPS = useMemo(() => new Set([
        "eaton-ace", "eaton-biesse", "eaton-coffee day", "eaton-enrx pvt ltd",
        "eaton-eta technology", "eaton-faively", "eaton-planned stock specific customer",
        "eaton-probat india", "eaton-rinac", "eaton-schenck process", "eaton-planned stock general",
        "hager-incap contracting", "lapp-ace group", "lapp-ams group", "lapp-disa india",
        "lapp-engineered customized control", "lapp-kennametal", "lapp-planned stock general",
        "lapp-rinac", "lapp-titan"
    ]), []);

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

    useEffect(() => {
        // Auto-expand textareas in the agenda table
        const textareas = document.querySelectorAll('textarea');
        textareas.forEach(ta => {
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
        });
    }, [currentMom.items]);
    const [showAttendeeDropdown, setShowAttendeeDropdown] = useState(false);
    const [isHistoryVisible, setIsHistoryVisible] = useState(true);

    const toCr = (val: number) => (val / 10000000).toFixed(2) + ' Cr';

    const getMergedMakeName = (makeName: string) => {
        const m = String(makeName || 'Unspecified').trim();
        const lowerM = m.toLowerCase();
        if (lowerM.includes('lapp')) return 'LAPP';
        if (lowerM.includes('luker')) return 'Luker';
        return m;
    };

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

    // Auto-populate agenda items if empty
    useEffect(() => {
        if (currentMom.items && currentMom.items.length === 0 && autoPullData.ytdSales > 0) {
            handleAutoPopulate();
        }
    }, [currentMom.items, autoPullData]);

    const autoPullData = useMemo(() => {
        const momDateStr = currentMom.date || new Date().toISOString().split('T')[0];
        const momDate = new Date(momDateStr);
        const fyYear = momDate.getMonth() < 3 ? momDate.getFullYear() - 1 : momDate.getFullYear();
        const fyStartDate = new Date(fyYear, 3, 1);

        const salesFY = salesReportItems.filter(i => {
            const d = new Date(i.date);
            return d >= fyStartDate && d <= momDate;
        });
        const ytdSales = salesFY.reduce((acc, i) => acc + (i.value || 0), 0);

        // Sales Performance
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        const fourteenDaysAgo = new Date(today);
        fourteenDaysAgo.setDate(today.getDate() - 14);

        const thisWeekSales = salesReportItems
            .filter(i => {
                const d = new Date(i.date);
                return d > sevenDaysAgo && d <= today;
            })
            .reduce((acc, i) => acc + (i.value || 0), 0);

        const lastWeekSales = salesReportItems
            .filter(i => {
                const d = new Date(i.date);
                return d > fourteenDaysAgo && d <= sevenDaysAgo;
            })
            .reduce((acc, i) => acc + (i.value || 0), 0);

        const onlineSales = salesFY
            .filter(i => {
                const cust = customers.find(c => c.customerName === i.customerName);
                const g = (cust?.customerGroup || cust?.group || '').toLowerCase();
                return g.includes('online');
            })
            .reduce((acc, i) => acc + (i.value || 0), 0);

        const totalPendingSOVal = pendingSO.reduce((acc, i) => acc + (i.value || 0), 0);
        const scheduledOrdersVal = pendingSO
            .filter(i => new Date(i.dueDate) > momDate)
            .reduce((acc, i) => acc + (i.value || 0), 0);

        const dueOrders = pendingSO.filter(i => new Date(i.dueDate) <= momDate);
        const dueOrdersVal = dueOrders.reduce((acc, i) => acc + (i.value || 0), 0);

        const stockMap = new Map<string, { qty: number; rate: number }>();
        closingStock.forEach(s => {
            const k = (s.description || '').toLowerCase().trim();
            stockMap.set(k, { qty: (stockMap.get(k)?.qty || 0) + (s.quantity || 0), rate: s.rate || 0 });
        });

        const matLookup = new Map<string, Material>();
        materials.forEach(m => {
            if (m.description) matLookup.set(m.description.toLowerCase().trim(), m);
            if (m.partNo) matLookup.set(m.partNo.toLowerCase().trim(), m);
        });

        let readyStockVal = 0;
        dueOrders.forEach(i => {
            const k = (i.itemName || '').toLowerCase().trim();
            const available = stockMap.get(k) || { qty: 0, rate: 0 };
            const utilized = Math.min(i.balanceQty || 0, available.qty);
            readyStockVal += (utilized * (i.rate || 0));
            stockMap.set(k, { ...available, qty: available.qty - utilized });
        });
        const shortageVal = Math.max(0, dueOrdersVal - readyStockVal);

        const nonMovingItems = closingStock.filter(s => {
            const desc = (s.description || '').toLowerCase().trim();
            const m = matLookup.get(desc);
            const g = (m?.materialGroup || '').toLowerCase();
            return g.includes('non-moving') || g.includes('non moving') || g.includes('nonmoving');
        });

        const lappNonMoving = nonMovingItems
            .filter(i => {
                const mRec = matLookup.get((i.description || '').toLowerCase().trim());
                return getMergedMakeName(mRec?.make || '').toUpperCase() === 'LAPP';
            })
            .reduce((acc, i) => acc + (i.value || 0), 0);

        const eatonNonMoving = nonMovingItems
            .filter(i => {
                const mRec = matLookup.get((i.description || '').toLowerCase().trim());
                return (mRec?.make || '').toUpperCase().includes('EATON');
            })
            .reduce((acc, i) => acc + (i.value || 0), 0);

        const hagerNonMoving = nonMovingItems
            .filter(i => {
                const k = (i.description || '').toLowerCase().trim();
                const mRec = matLookup.get(k);
                const isHager = (mRec?.make || '').toUpperCase().includes('HAGER');
                const isNotIncap = !(mRec?.materialGroup || '').toLowerCase().includes('incap');
                return isHager && isNotIncap;
            })
            .reduce((acc, i) => acc + (i.value || 0), 0);

        const othersNonMoving = nonMovingItems
            .filter(i => {
                const k = (i.description || '').toLowerCase().trim();
                const mRec = matLookup.get(k);
                const mergedMake = getMergedMakeName(mRec?.make || '').toUpperCase();
                const g = (mRec?.materialGroup || '').toLowerCase();
                const isLapp = mergedMake === 'LAPP';
                const isEaton = (mRec?.make || '').toUpperCase().includes('EATON');
                const isHagerNonIncap = (mRec?.make || '').toUpperCase().includes('HAGER') && !g.includes('incap');
                return !isLapp && !isEaton && !isHagerNonIncap;
            })
            .reduce((acc, i) => acc + (i.value || 0), 0);

        const soAggMap = new Map<string, { qty: number; rate: number }>();
        pendingSO.forEach(s => {
            const k = (s.itemName || '').toLowerCase().trim();
            const ex = soAggMap.get(k) || { qty: 0, rate: 0 };
            soAggMap.set(k, { qty: ex.qty + (s.balanceQty || 0), rate: s.rate || 0 });
        });

        const poAggMap = new Map<string, { qty: number; rate: number }>();
        pendingPO.forEach(p => {
            const k = (p.itemName || '').toLowerCase().trim();
            const ex = poAggMap.get(k) || { qty: 0, rate: 0 };
            poAggMap.set(k, { qty: ex.qty + (p.balanceQty || 0), rate: p.rate || 0 });
        });

        const sales1yMap = new Map<string, number>();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(momDate.getFullYear() - 1);
        salesReportItems.forEach(s => {
            const k = (s.particulars || '').toLowerCase().trim();
            if (new Date(s.date) >= oneYearAgo) {
                sales1yMap.set(k, (sales1yMap.get(k) || 0) + (s.quantity || 0));
            }
        });

        const excessStockByMake: Record<string, number> = {};

        const totalExcessStockVal = closingStock.reduce((acc, s) => {
            const k = (s.description || '').toLowerCase().trim();
            const m = matLookup.get(k);
            if (!m) return acc;

            const group = (m.materialGroup || '').toLowerCase();
            const isPlanned = PLANNED_STOCK_GROUPS.has(group);

            const descKey = (m.description || '').toLowerCase().trim();
            const partKey = (m.partNo || '').toLowerCase().trim();
            const s1DescQty = sales1yMap.get(descKey) || 0;
            const s1PartQty = (partKey && partKey !== descKey) ? (sales1yMap.get(partKey) || 0) : 0;
            const total1yQty = s1DescQty + s1PartQty;

            const avg1yQty = total1yQty / 12;
            const maxStock = isPlanned ? Math.ceil((avg1yQty * 3) / 10) * 10 : 0;
            const committed = soAggMap.get(k)?.qty || 0;
            const excessQty = Math.max(0, (s.quantity || 0) - (committed + maxStock));
            const val = excessQty * (s.rate || 0);

            if (val > 0) {
                const make = getMergedMakeName(m.make || 'UNSPECIFIED').toUpperCase();
                excessStockByMake[make] = (excessStockByMake[make] || 0) + val;
                return acc + val;
            }
            return acc;
        }, 0);

        poAggMap.forEach((p, k) => {
            const m = matLookup.get(k);
            if (!m) return;

            const group = (m.materialGroup || '').toLowerCase();
            const isPlanned = PLANNED_STOCK_GROUPS.has(group);

            const descKey = (m.description || '').toLowerCase().trim();
            const partKey = (m.partNo || '').toLowerCase().trim();
            const s1DescQty = sales1yMap.get(descKey) || 0;
            const s1PartQty = (partKey && partKey !== descKey) ? (sales1yMap.get(partKey) || 0) : 0;
            const total1yQty = s1DescQty + s1PartQty;

            const sRec = stockMap.get(k) || { qty: 0, rate: 0 };
            const soQty = soAggMap.get(k)?.qty || 0;
            const avg1yQty = total1yQty / 12;
            const maxStock = isPlanned ? Math.ceil((avg1yQty * 3) / 10) * 10 : 0;
            const projectedExcess = Math.max(0, (sRec.qty + p.qty - soQty) - maxStock);
            const committed = soAggMap.get(k)?.qty || 0;
            const eStockQty = Math.max(0, sRec.qty - (committed + maxStock));
            const ePOQty = Math.max(0, projectedExcess - eStockQty);
            if (ePOQty > 0) {
                const bestRate = sRec.rate || p.rate || (soAggMap.get(k)?.rate || 0);
                totalExcessPOVal += (ePOQty * bestRate);
            }
        });

        const weeklyGrowthVal = lastWeekSales > 0 ? ((thisWeekSales - lastWeekSales) / lastWeekSales) * 100 : 0;
        const weeklyGrowthText = lastWeekSales > 0 ? `${weeklyGrowthVal >= 0 ? '+' : ''}${weeklyGrowthVal.toFixed(1)}% vs LW` : 'N/A';

        return {
            ytdSales, thisWeekSales, lastWeekSales, onlineSales,
            weeklyGrowthText,
            totalPendingSO: totalPendingSOVal, scheduledOrders: scheduledOrdersVal, dueOrdersVal, readyStockVal, shortageVal,
            lappNonMoving, eatonNonMoving, hagerNonMoving, othersNonMoving,
            totalExcess: totalExcessStockVal, excessByMake: excessStockByMake, excessPOVal: totalExcessPOVal
        };
    }, [pendingSO, closingStock, salesReportItems, customers, currentMom.date, materials, pendingPO]);

    const handleAutoPopulate = () => {
        const agendaItems: MOMItem[] = [
            {
                id: crypto.randomUUID(), slNo: 1, agendaItem: 'Sales Review: Present YTD vs Weekly Momentum',
                discussion: `• Present YTD Sales (FY): ${toCr(autoPullData.ytdSales)}\n• Online Sales YTD: ${toCr(autoPullData.onlineSales)}\n• Current Week Sales: ${toCr(autoPullData.thisWeekSales)} (${autoPullData.weeklyGrowthText})\n• Last Week Sales Performance: ${toCr(autoPullData.lastWeekSales)}`,
                actionAccount: ['Kumar'], timeline: currentMom.date || '', isCompleted: false
            },
            {
                id: crypto.randomUUID(), slNo: 2, agendaItem: `Pending SO Deep Analysis - ${toCr(autoPullData.totalPendingSO)}`,
                discussion: `• Scheduled Orders (Future): ${toCr(autoPullData.scheduledOrders)}\n• Due Orders (Past/Today): ${toCr(autoPullData.dueOrdersVal)}\n• Ready Stock (For Due Orders): ${toCr(autoPullData.readyStockVal)}\n• Shortage (Need to Arrange): ${toCr(autoPullData.shortageVal)}`,
                actionAccount: ['Sales Team'], timeline: 'Immediate', isCompleted: false
            },
            {
                id: crypto.randomUUID(), slNo: 3, agendaItem: 'System Stock & Non-Moving Status',
                discussion: `• LAPP Non-Moving: ${toCr(autoPullData.lappNonMoving)}\n• Eaton Non-Moving: ${toCr(autoPullData.eatonNonMoving)}\n• Hager - Non-Moving (Excl. Incap): ${toCr(autoPullData.hagerNonMoving)}\n• Others Non-Moving: ${toCr(autoPullData.othersNonMoving)}\n• Total Physical Stock: ${toCr(closingStock.reduce((a, b) => a + (b.value || 0), 0))}`,
                actionAccount: ['Logistic Team'], timeline: 'Next Thursday', isCompleted: false
            },
            {
                id: crypto.randomUUID(), slNo: 4, agendaItem: `Excess Stock Make-wise Summary (Strategy Report) - ${toCr(autoPullData.totalExcess)}`,
                discussion: Object.entries(autoPullData.excessByMake).sort(([, a], [, b]) => b - a).filter(([_, v]) => v > 1000).map(([m, v]) => `• ${m}: ${toCr(v)}`).join('\n') + `\n• Need Liquadate: ₹ _________ Cr.`,
                actionAccount: ['Mohan', 'Gurudatt'], timeline: '', isCompleted: false
            },
            {
                id: crypto.randomUUID(), slNo: 5, agendaItem: 'Procurement Action Plan - Excess PO Analysis',
                discussion: `• Excess PO Value (Strategy Report): ${toCr(autoPullData.excessPOVal)}\n• PO need to cancel: ₹ _________ Cr.\n• Need to Hold: ₹ _________ Cr.`,
                actionAccount: ['Mohan'], timeline: 'Immediate', isCompleted: false
            }
        ];
        setCurrentMom(prev => ({ ...prev, items: agendaItems }));
    };

    const handleSave = async () => {
        if (!currentMom.title || !currentMom.date) return alert('Title and Date are required');
        setIsLoading(true);
        try {
            const saved = await momService.save(currentMom as any);
            if (saved) {
                alert('MOM saved successfully!');
                setMoms(await momService.getAll());
            }
        } catch (e) { alert('Error saving MOM'); } finally { setIsLoading(false); }
    };

    const toggleAttendee = (id: string) => {
        setCurrentMom(prev => {
            const current = prev.attendees || [];
            return { ...prev, attendees: current.includes(id) ? current.filter(a => a !== id) : [...current, id] };
        });
    };

    const updateItem = (id: string, field: keyof MOMItem, value: any) => {
        setCurrentMom(prev => ({ ...prev, items: prev.items?.map(i => i.id === id ? { ...i, [field]: value } : i) }));
    };

    const addItem = () => {
        const newItem: MOMItem = { id: crypto.randomUUID(), slNo: (currentMom.items?.length || 0) + 1, agendaItem: '', discussion: '', actionAccount: [], timeline: '', isCompleted: false };
        setCurrentMom(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
    };

    const removeItem = (id: string) => {
        setCurrentMom(prev => ({ ...prev, items: prev.items?.filter(i => i.id !== id).map((item, idx) => ({ ...item, slNo: idx + 1 })) }));
    };

    const filteredMoms = moms.filter(m => m.title.toLowerCase().includes(searchTerm.toLowerCase()) || m.date.includes(searchTerm));

    return (
        <div className="flex flex-col h-full gap-4 w-full p-4 animate-fade-in print:p-0">
            {/* Top Bar - Compact */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 rounded-2xl shadow-sm border border-gray-100 print:hidden">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <FileText className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-gray-800 tracking-tight">Weekly Review MOM</h1>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Siddhi Reports</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsHistoryVisible(!isHistoryVisible)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${isHistoryVisible ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                        title={isHistoryVisible ? "Hide History" : "Show History"}
                    >
                        <HistoryIcon className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase">{isHistoryVisible ? 'Hide History' : 'History'}</span>
                    </button>
                    <button onClick={handleSave} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                    </button>
                    <button onClick={() => window.print()} className="p-2 bg-gray-50 text-gray-600 rounded-xl border border-gray-200 hover:bg-gray-100">
                        <Printer className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className={`grid grid-cols-1 ${isHistoryVisible ? 'lg:grid-cols-4' : 'lg:grid-cols-1'} gap-6 flex-1 min-h-0`}>
                {isHistoryVisible && (
                    <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-4 overflow-hidden print:hidden animate-in slide-in-from-left duration-300">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input type="text" placeholder="Search history..." className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2">
                            {filteredMoms.map(mom => (
                                <button key={mom.id} onClick={() => setCurrentMom(mom)} className={`flex flex-col gap-1 p-3 rounded-xl border text-left transition-all ${currentMom.id === mom.id ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-100 hover:border-gray-300'}`}>
                                    <span className="text-sm font-bold text-gray-800">{mom.title}</span>
                                    <div className="text-[10px] text-gray-500 font-bold tracking-tight">{mom.date}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className={`${isHistoryVisible ? 'lg:col-span-3' : 'lg:col-span-1'} bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col print:border-none print:shadow-none transition-all duration-300 print-area`}>
                    {/* Compact Header */}
                    <div className="p-4 border-b border-gray-100 bg-gray-50/30 print:bg-white print:p-0 print:border-none">
                        <div className="flex justify-between items-start mb-4 print:flex-col print:items-center print:gap-2">
                            <div className="print:text-center print:w-full">
                                <h2 className="text-xl font-black text-gray-900 tracking-tighter mb-1 print:text-2xl print:uppercase">Minutes of Meeting (MOM)</h2>
                                <div className="flex items-center gap-2 print:justify-center">
                                    <div className="w-8 h-1 bg-indigo-600 rounded-full"></div>
                                    <span className="text-[10px] font-black text-indigo-600 uppercase">OFFICIAL RECORD</span>
                                </div>
                            </div>
                            <div className="text-right print:text-center print:w-full">
                                <label className="text-[9px] font-black text-gray-400 uppercase block print:hidden">Meeting Date</label>
                                <input type="date" className="bg-transparent border-none text-right font-black text-sm p-0 print:text-center print:text-[12px]" value={currentMom.date} onChange={e => setCurrentMom(prev => ({ ...prev, date: e.target.value }))} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-1 print:mb-4">
                            <div className="print:text-center">
                                <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block print:hidden">Meeting Title</label>
                                <input type="text" className="w-full bg-white border border-gray-100 rounded-lg px-3 py-1.5 text-sm font-bold shadow-sm outline-none print:border-none print:text-xl print:p-0 print:text-center" value={currentMom.title} onChange={e => setCurrentMom(prev => ({ ...prev, title: e.target.value }))} />
                            </div>
                            <div className="relative">
                                <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block flex justify-between">
                                    Attendees ({currentMom.attendees?.length || 0})
                                    <button onClick={() => setShowAttendeeDropdown(!showAttendeeDropdown)} className="text-indigo-600 font-black text-[10px] print:hidden">Select Participants</button>
                                </label>
                                <div className="flex flex-wrap gap-1.5 min-h-[38px] p-1.5 bg-white border border-gray-100 rounded-lg print:border-none">
                                    {currentMom.attendees?.map(id => {
                                        const a = attendeeMaster.find(at => at.id === id);
                                        return a ? (
                                            <div key={id} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100 text-[10px] font-bold">
                                                <span>{a.name}</span>
                                                <button onClick={() => toggleAttendee(id)} className="print:hidden"><X className="w-3 h-3" /></button>
                                            </div>
                                        ) : null;
                                    })}
                                </div>
                                {showAttendeeDropdown && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-50 p-2 max-h-48 overflow-y-auto print:hidden">
                                        <div className="grid gap-1">
                                            {attendeeMaster.filter(a => !currentMom.attendees?.includes(a.id)).map(a => (
                                                <button key={a.id} onClick={() => toggleAttendee(a.id)} className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-gray-50 text-left">
                                                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">{a.name[0]}</div>
                                                    <div className="text-[11px] font-bold">{a.name}</div>
                                                </button>
                                            ))}
                                            <button onClick={() => setShowAttendeeDropdown(false)} className="w-full mt-1 py-1.5 bg-gray-900 text-white rounded-lg text-[10px] font-black uppercase">Close</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-4 snap-y snap-mandatory scroll-smooth">
                        <table className="w-full border-collapse">
                            <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b-2 border-gray-900 print:static">
                                <tr>
                                    <th className="py-2 text-left w-6 text-[9px] font-black uppercase text-gray-400">#</th>
                                    <th className="py-2 text-left text-[9px] font-black uppercase text-gray-400">Agenda & Discussion</th>
                                    <th className="py-2 text-left w-48 text-[9px] font-black uppercase text-gray-400">Action Account</th>
                                    <th className="py-2 text-left w-32 text-[9px] font-black uppercase text-gray-400">Timeline</th>
                                    <th className="py-2 text-right w-8 print:hidden"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {currentMom.items?.map((item) => (
                                    <tr key={item.id} className="group transition-colors snap-start scroll-mt-12">
                                        <td className="py-4 align-top text-xs font-black">{item.slNo}</td>
                                        <td className="py-4 px-2 align-top">
                                            <input type="text" className="w-full bg-transparent font-black text-sm outline-none mb-1" value={item.agendaItem} onChange={e => updateItem(item.id, 'agendaItem', e.target.value)} placeholder="Topic..." />
                                            <textarea
                                                className="w-full bg-transparent text-[11px] text-gray-600 outline-none resize-none leading-relaxed min-h-[100px] border-none focus:ring-0 p-0"
                                                value={item.discussion}
                                                onChange={e => updateItem(item.id, 'discussion', e.target.value)}
                                                onInput={(e) => {
                                                    const target = e.target as HTMLTextAreaElement;
                                                    target.style.height = 'auto';
                                                    target.style.height = target.scrollHeight + 'px';
                                                }}
                                                placeholder="Details..."
                                            />
                                        </td>
                                        <td className="py-4 align-top pr-2">
                                            <div className="flex flex-wrap gap-1 mb-1">
                                                {item.actionAccount.map(acc => (
                                                    <span key={acc} className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1">
                                                        {acc} <X className="w-2 h-2 cursor-pointer print:hidden" onClick={() => updateItem(item.id, 'actionAccount', item.actionAccount.filter(a => a !== acc))} />
                                                    </span>
                                                ))}
                                            </div>
                                            <select className="w-full text-[10px] border border-gray-100 rounded p-1 print:hidden" value="" onChange={e => e.target.value && !item.actionAccount.includes(e.target.value) && updateItem(item.id, 'actionAccount', [...item.actionAccount, e.target.value])}>
                                                <option value="">Assign...</option>
                                                {attendeeMaster.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                                                {['Sales Team', 'Logistic Team', 'Warehouse'].map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                            <div className="hidden print:block text-[10px] font-black">{item.actionAccount.join(', ')}</div>
                                        </td>
                                        <td className="py-4 align-top">
                                            <input type="text" className="w-full text-[10px] border border-gray-100 rounded p-1 mb-1 shadow-inner print:border-none" value={item.timeline} onChange={e => updateItem(item.id, 'timeline', e.target.value)} placeholder="Timeline..." />
                                        </td>
                                        <td className="py-4 text-right align-top print:hidden">
                                            <button onClick={() => removeItem(item.id)} className="p-1 hover:text-red-500 transition-opacity opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button onClick={addItem} className="mt-4 w-full py-2 border-2 border-dashed border-gray-100 rounded-xl text-xs font-black text-gray-400 hover:bg-gray-50 print:hidden">+ Add Agenda Point</button>
                    </div>

                    <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center print:bg-white print:fixed print:bottom-0 print:left-0 print:right-0 print:p-0 print:border-none">
                        <div className="flex gap-16 print:w-full print:justify-around print:mt-12">
                            <div className="w-48 border-t border-gray-900 pt-2 text-center"><p className="text-[10px] font-black uppercase">Prepared By</p></div>
                            <div className="w-48 border-t border-gray-900 pt-2 text-center"><p className="text-[10px] font-black uppercase">Approved By</p></div>
                        </div>
                        <div className="text-[8px] text-gray-400 font-bold italic print:hidden">Siddhi Reports - Document ID: {currentMom.id?.slice(0, 8) || 'NEW'}</div>
                    </div>
                </div>
            </div>

            <style>{`
                @media print {
                    @page { margin: 0.5cm; size: A4; }
                    body * { visibility: hidden; }
                    .print-area, .print-area * { visibility: visible; }
                    .print-area { 
                        position: absolute; 
                        left: 0; 
                        top: 0; 
                        width: 100%; 
                        height: auto;
                        padding: 0 !important;
                        margin: 0 !important;
                        background: white !important;
                    }
                    .print\\:hidden { display: none !important; }
                    .no-print { display: none !important; }
                    textarea { height: auto !important; overflow: visible !important; border: none !important; padding: 0 !important; margin: 0 !important; }
                    table { page-break-inside: auto; margin-bottom: 50px; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                    .print-area { padding-bottom: 100px !important; }
                }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
            `}</style>
        </div>
    );
};

export default MOMView;
