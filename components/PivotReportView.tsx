
import React, { useMemo, useState } from 'react';
import { Material, ClosingStockItem, PendingSOItem, PendingPOItem, SalesReportItem, CustomerMasterItem } from '../types';
import { FileDown, Search, ArrowUp, ArrowDown, Filter, AlertTriangle, Minus, ArrowUpDown, Layers, AlignLeft, Eye, EyeOff, X, Plus, ChevronRight, ChevronDown } from 'lucide-react';
import { utils, writeFile } from 'xlsx';
import { fastSalesService } from '../services/fastSalesService';

interface PivotReportViewProps {
    materials: Material[];
    closingStock: ClosingStockItem[];
    pendingSO: PendingSOItem[];
    pendingPO: PendingPOItem[];
    salesReportItems: SalesReportItem[];
    customers: CustomerMasterItem[];
    isAdmin?: boolean;
}

const PLANNED_STOCK_GROUPS = new Set([
    "eaton-ace", "eaton-biesse", "eaton-coffee day", "eaton-enrx pvt ltd",
    "eaton-eta technology", "eaton-faively", "eaton-planned stock specific customer",
    "eaton-probat india", "eaton-rinac", "eaton-schenck process",
    "eaton-planned stock general", "hager-incap contracting", "lapp-ace group",
    "lapp-ams group", "lapp-disa india", "lapp-engineered customized control",
    "lapp-kennametal", "lapp-planned stock general", "lapp-rinac", "lapp-titan"
]);

const roundToTen = (num: number) => {
    if (num <= 0) return 0;
    return Math.ceil(num / 10) * 10;
};

const getMergedMakeName = (makeName: string) => {
    const m = String(makeName || 'Unspecified').trim();
    const lowerM = m.toLowerCase();
    if (lowerM.includes('lapp')) return 'LAPP';
    if (lowerM.includes('luker')) return 'Luker';
    return m;
};

const formatLargeValue = (val: number) => {
    if (val === 0) return '-';
    const absVal = Math.abs(val);
    if (absVal >= 10000000) return `${(val / 10000000).toFixed(2)} Cr`;
    if (absVal >= 100000) return `${(val / 100000).toFixed(2)} L`;
    return Math.round(val).toLocaleString('en-IN');
};

const parseDate = (val: any): Date => {
    if (!val) return new Date(0);
    if (val instanceof Date) return val;
    if (typeof val === 'number') return new Date((Math.round(val) - 25568) * 86400 * 1000);
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date(0) : d;
};

type SortPath =
    | 'description' | 'make' | 'materialGroup'
    | 'stock.qty' | 'stock.val'
    | 'so.qty' | 'so.val' | 'so.curQty' | 'so.schQty'
    | 'po.qty' | 'po.val' | 'po.curQty' | 'po.schQty'
    | 'net.qty' | 'net.val'
    | 'avg3m.qty' | 'avg3m.val'
    | 'avg1y.qty' | 'avg1y.val'
    | 'growth.pct'
    | 'levels.min.qty' | 'levels.min.val'
    | 'levels.reorder.qty' | 'levels.reorder.val'
    | 'levels.max.qty' | 'levels.max.val'
    | 'actions.excessStock.qty' | 'actions.excessStock.val'
    | 'actions.excessPO.qty' | 'actions.excessPO.val'
    | 'actions.poNeed.qty' | 'actions.poNeed.val'
    | 'actions.expedite.qty' | 'actions.expedite.val';

const PivotReportView: React.FC<PivotReportViewProps> = ({
    materials, closingStock, pendingSO, pendingPO, salesReportItems, customers, isAdmin = false
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [slicerMake, setSlicerMake] = useState('ALL');
    const [slicerGroup, setSlicerGroup] = useState('ALL');
    const [slicerItemCategory, setSlicerItemCategory] = useState('ALL');
    const [slicerLappCategory, setSlicerLappCategory] = useState('ALL');
    const [selectedPopupItem, setSelectedPopupItem] = useState<any>(null);
    const [popupPeriod, setPopupPeriod] = useState<'1Y' | '3M'>('1Y');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const toggleGroup = (group: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(group)) next.delete(group);
            else next.add(group);
            return next;
        });
    };
    const [slicerLappSubCategory, setSlicerLappSubCategory] = useState('ALL');
    const [filterDescription, setFilterDescription] = useState('');
    const [showExcessStock, setShowExcessStock] = useState(false);
    const [showExcessPO, setShowExcessPO] = useState(false);
    const [showPONeed, setShowPONeed] = useState(false);
    const [showExpedite, setShowExpedite] = useState(false);
    const [showSOCols, setShowSOCols] = useState(true);
    const [showPOCols, setShowPOCols] = useState(true);
    const [showPlanningColumns, setShowPlanningColumns] = useState(true);
    const [displayLimit, setDisplayLimit] = useState(100);
    const [sortConfig, setSortConfig] = useState<{ key: SortPath; direction: 'asc' | 'desc' }>({
        key: 'stock.val',
        direction: 'desc'
    });

    const pivotData = useMemo(() => {
        const salesSummaries = fastSalesService.getSummaries(salesReportItems);
        const stockMap = new Map<string, { qty: number; val: number }>();
        closingStock.forEach(item => {
            if (!item.description) return;
            const key = item.description.toLowerCase().trim();
            const existing = stockMap.get(key) || { qty: 0, val: 0 };
            stockMap.set(key, { qty: existing.qty + (item.quantity || 0), val: existing.val + (item.value || 0) });
        });

        const soMap = new Map<string, any>();
        const poMap = new Map<string, any>();
        const todayT = new Date().setHours(0, 0, 0, 0);

        pendingSO.forEach(item => {
            if (!item.itemName) return;
            const key = item.itemName.toLowerCase().trim();
            const ex = soMap.get(key) || { qty: 0, val: 0, curQty: 0, curVal: 0, schQty: 0, schVal: 0 };
            const v = (item.balanceQty || 0) * (item.rate || 0);
            const due = item.dueDate ? parseDate(item.dueDate).getTime() : 0;
            const isCur = due <= todayT;
            ex.qty += (item.balanceQty || 0); ex.val += v;
            if (isCur) { ex.curQty += (item.balanceQty || 0); ex.curVal += v; }
            else { ex.schQty += (item.balanceQty || 0); ex.schVal += v; }
            soMap.set(key, ex);
        });

        pendingPO.forEach(item => {
            if (!item.itemName) return;
            const key = item.itemName.toLowerCase().trim();
            const ex = poMap.get(key) || { qty: 0, val: 0, curQty: 0, curVal: 0, schQty: 0, schVal: 0 };
            const v = (item.balanceQty || 0) * (item.rate || 0);
            const due = item.dueDate ? parseDate(item.dueDate).getTime() : 0;
            const isCur = due <= todayT;
            ex.qty += (item.balanceQty || 0); ex.val += v;
            if (isCur) { ex.curQty += (item.balanceQty || 0); ex.curVal += v; }
            else { ex.schQty += (item.balanceQty || 0); ex.schVal += v; }
            poMap.set(key, ex);
        });

        const results = materials.map(mat => {
            const dKey = mat.description?.toLowerCase().trim() || '';
            const pKey = mat.partNo?.toLowerCase().trim() || '';
            const stock = stockMap.get(dKey) || { qty: 0, val: 0 };
            const so = soMap.get(dKey) || { qty: 0, val: 0, curQty: 0, curVal: 0, schQty: 0, schVal: 0 };
            const po = poMap.get(dKey) || { qty: 0, val: 0, curQty: 0, curVal: 0, schQty: 0, schVal: 0 };
            const netQty = stock.qty + po.qty - so.qty;
            let rate = stock.qty > 0 ? stock.val / stock.qty : (po.qty > 0 ? po.val / po.qty : (so.qty > 0 ? so.val / so.qty : 0));
            
            const sD = salesSummaries.get(dKey);
            const sP = pKey ? salesSummaries.get(pKey) : null;
            let s3q = (sD?.qty3m || 0) + (sP && sP !== sD ? sP.qty3m : 0);
            let s1q = (sD?.qty1y || 0) + (sP && sP !== sD ? sP.qty1y : 0);
            let s3v = (sD?.val3m || 0) + (sP && sP !== sD ? sP.val3m : 0);
            let s1v = (sD?.val1y || 0) + (sP && sP !== sD ? sP.val1y : 0);

            const a3q = s3q / 3; const a1q = s1q / 12;
            const r1y = s1q > 0 ? s1v / s1q : rate;
            const grp = String(mat.materialGroup || '').trim() || 'Unspecified';
            const isPl = PLANNED_STOCK_GROUPS.has(grp.toLowerCase());
            let strategy = s1q * 12 >= 500 ? 'GENERAL STOCK' : (s1q > 0 ? 'AGAINST ORDER' : 'MADE TO ORDER');
            
            const mk = getMergedMakeName(mat.make || '').toUpperCase();
            const lGrp = grp.toLowerCase();

            let isApplicable = false;
            if (mk === 'LAPP') {
                const excluded = ["lapp-planned stock specific customer", "lapp-non moving stocks", "lapp-against customer po", "lapp infra"];
                isApplicable = !excluded.some(ex => lGrp.includes(ex.toLowerCase()));
            } else if (mk === 'EATON') {
                const excluded = ["eaton-non moving stock", "eaton-planned stock specific customer"];
                isApplicable = !excluded.some(ex => lGrp.includes(ex.toLowerCase()));
            }

            let min = 0, re = 0, max = 0;
            if (isApplicable && a1q > 0) {
                min = roundToTen(a1q); 
                re = roundToTen(a1q * 1.5); 
                max = min * 2;
            }

            const exStock = Math.max(0, stock.qty - (so.qty + max));
            const exPO = Math.max(0, (netQty - max) - exStock);
            const poNeed = Math.max(0, max - netQty);
            const expGap = (so.curQty + max) - stock.qty;
            const expQty = (expGap > 0 && po.qty > 0) ? Math.min(po.qty, expGap) : 0;

            let lappCategory = '';
            let lappSubCategory = '';
            
            if (mk === 'LAPP') {
                const desc = (mat.description || '').toUpperCase();
                
                if (desc.includes('UNIPLUS')) {
                    lappCategory = 'Uniplus';
                    if (desc.includes('FRLSH') || desc.includes('FR-LSH') || desc.includes('FRLS')) lappSubCategory = 'FRLSH';
                    else if (desc.includes('HFFR')) lappSubCategory = 'HFFR';
                    else lappSubCategory = 'FR';
                } else if (desc.includes('OLFLEX') || desc.includes('ÖLFLEX')) {
                    lappCategory = 'Olflex';
                    if (desc.includes('100I') || desc.includes('100 I')) lappSubCategory = '100I';
                    else if (desc.includes('100')) lappSubCategory = '100';
                    else if (desc.includes('110')) lappSubCategory = '110';
                    else if (desc.includes('INFRA')) lappSubCategory = 'Infra';
                    else lappSubCategory = 'Other Products';
                } else if (desc.includes('UNITRONIC')) {
                    lappCategory = 'UNITRONIC';
                    if (desc.includes('LIYCY (TP)')) lappSubCategory = 'LIYCY (TP)';
                    else if (desc.includes('LIYY (TP)')) lappSubCategory = 'LIYY (TP)';
                    else if (desc.includes('LIYCY')) lappSubCategory = 'LIYCY';
                    else if (desc.includes('LIYY')) lappSubCategory = 'LIYY';
                    else lappSubCategory = 'Other Products';
                } else {
                    lappCategory = 'Other Products';
                    lappSubCategory = 'Other Products';
                }
            }

            const customers = new Set([...(sD?.customers || []), ...(sP && sP !== sD ? sP.customers : [])]);
            const billedMonths = new Set([...(sD?.billedMonths || []), ...(sP && sP !== sD ? sP.billedMonths : [])]);
            const custCount = customers.size;
            const monthCount = billedMonths.size;

            let itemCategory = 'Non-Moving';
            if (monthCount > 0) {
                if (custCount >= 10 && monthCount >= 8) {
                    itemCategory = 'Fast Runner';
                } else if (custCount >= 4 && custCount <= 9 && monthCount >= 8) {
                    itemCategory = 'Slow Runner';
                } else if (custCount <= 3 && monthCount >= 8) {
                    itemCategory = 'Specific Customer';
                } else {
                    itemCategory = 'Irregular Runner';
                }
            }

            return {
                ...mat,
                make: getMergedMakeName(mat.make || '').toUpperCase(),
                materialGroup: grp,
                lappCategory,
                lappSubCategory,
                itemCategory,
                stock, so, po, net: { qty: netQty, val: netQty * rate },
                avg3m: { qty: a3q, val: a3q * (s3q > 0 ? s3v / s3q : rate) },
                avg1y: { qty: a1q, val: a1q * r1y },
                growth: { pct: a1q > 0 ? ((a3q - a1q) / a1q) * 100 : 0 },
                levels: { min: { qty: min, val: min * r1y }, reorder: { qty: re, val: re * r1y }, max: { qty: max, val: max * r1y } },
                actions: {
                    excessStock: { qty: exStock, val: exStock * rate },
                    excessPO: { qty: exPO, val: exPO * rate },
                    poNeed: { qty: poNeed, val: poNeed * rate },
                    expedite: { qty: expQty, val: expQty * rate }
                }
            };
        });

        return results.filter(i => i.stock.qty > 0 || i.so.qty > 0 || i.po.qty > 0 || i.avg1y.qty > 0 || i.actions.poNeed.qty > 0);
    }, [materials, closingStock, pendingSO, pendingPO, salesReportItems]);

    const slicerOptions = useMemo(() => {
        const makes = new Set<string>();
        const groups = new Set<string>();
        const lappCats = new Set<string>();
        const lappSubCats = new Set<string>();
        
        pivotData.forEach(i => {
            if (i.make) makes.add(i.make);
            if (slicerMake === 'ALL' || i.make === slicerMake) {
                if (i.materialGroup) groups.add(i.materialGroup);
                if (i.make === 'LAPP') {
                    if (i.lappCategory) lappCats.add(i.lappCategory);
                    if (slicerLappCategory === 'ALL' || i.lappCategory === slicerLappCategory) {
                        if (i.lappSubCategory) lappSubCats.add(i.lappSubCategory);
                    }
                }
            }
        });

        return {
            makes: ['ALL', ...Array.from(makes).sort()],
            groups: ['ALL', ...Array.from(groups).sort()],
            lappCategories: ['ALL', ...Array.from(lappCats).sort()],
            lappSubCategories: ['ALL', ...Array.from(lappSubCats).sort()]
        };
    }, [pivotData, slicerMake, slicerLappCategory]);

    const filteredData = useMemo(() => {
        let d = pivotData;
        if (slicerMake !== 'ALL') d = d.filter(i => i.make === slicerMake);
        if (slicerGroup !== 'ALL') d = d.filter(i => i.materialGroup === slicerGroup);
        if (slicerItemCategory !== 'ALL') d = d.filter(i => (i as any).itemCategory === slicerItemCategory);
        if (slicerMake === 'LAPP') {
            if (slicerLappCategory !== 'ALL') d = d.filter(i => (i as any).lappCategory === slicerLappCategory);
            if (slicerLappSubCategory !== 'ALL') d = d.filter(i => (i as any).lappSubCategory === slicerLappSubCategory);
        }
        if (filterDescription) {
            const l = filterDescription.toLowerCase();
            d = d.filter(i => i.description?.toLowerCase().includes(l));
        }
        if (searchTerm) {
            const l = searchTerm.toLowerCase();
            d = d.filter(i => i.description?.toLowerCase().includes(l) || i.make.toLowerCase().includes(l) || i.materialGroup.toLowerCase().includes(l));
        }
        if (showExcessStock || showExcessPO || showPONeed || showExpedite) {
            d = d.filter(i => (showExcessStock && i.actions.excessStock.qty > 0) || (showExcessPO && i.actions.excessPO.qty > 0) || (showPONeed && i.actions.poNeed.qty > 0) || (showExpedite && i.actions.expedite.qty > 0));
        }
        const keys = sortConfig.key.split('.');
        return [...d].sort((a, b) => {
            let vA: any = a, vB: any = b;
            keys.forEach(k => { vA = vA?.[k]; vB = vB?.[k]; });
            
            // Handle null/undef
            vA = vA ?? 0; vB = vB ?? 0;

            if (typeof vA === 'string' && typeof vB === 'string') {
                return sortConfig.direction === 'asc' ? vA.localeCompare(vB) : vB.localeCompare(vA);
            }
            const nA = Number(vA); const nB = Number(vB);
            if (isNaN(nA) || isNaN(nB)) return 0;
            return sortConfig.direction === 'asc' ? (nA - nB) : (nB - nA);
        });
    }, [pivotData, searchTerm, slicerMake, slicerGroup, slicerItemCategory, slicerLappCategory, slicerLappSubCategory, filterDescription, showExcessStock, showExcessPO, showPONeed, showExpedite, sortConfig]);

    const totals = useMemo(() => {
        const t = {
            stockQty: 0, stockVal: 0,
            soCur: 0, soSch: 0, soTot: 0,
            poCur: 0, poSch: 0, poTot: 0,
            netQty: 0, netVal: 0,
            avg3m: 0, avg1y: 0,
            min: 0, re: 0, max: 0,
            exSQty: 0, exSVal: 0,
            exPQty: 0, exPVal: 0,
            needQty: 0, needVal: 0,
            expQty: 0, expVal: 0
        };
        filteredData.forEach(r => {
            t.stockQty += (r.stock.qty || 0); t.stockVal += (r.stock.val || 0);
            t.soCur += (r.so.curQty || 0); t.soSch += (r.so.schQty || 0); t.soTot += (r.so.qty || 0);
            t.poCur += (r.po.curQty || 0); t.poSch += (r.po.schQty || 0); t.poTot += (r.po.qty || 0);
            t.netQty += (r.net.qty || 0); t.netVal += (r.net.val || 0);
            t.avg3m += (r.avg3m.qty || 0); t.avg1y += (r.avg1y.qty || 0);
            t.min += (r.levels.min.qty || 0); t.re += (r.levels.reorder.qty || 0); t.max += (r.levels.max.qty || 0);
            t.exSQty += (r.actions.excessStock.qty || 0); t.exSVal += (r.actions.excessStock.val || 0);
            t.exPQty += (r.actions.excessPO.qty || 0); t.exPVal += (r.actions.excessPO.val || 0);
            t.needQty += (r.actions.poNeed.qty || 0); t.needVal += (r.actions.poNeed.val || 0);
            t.expQty += (r.actions.expedite.qty || 0); t.expVal += (r.actions.expedite.val || 0);
        });
        return t;
    }, [filteredData]);

    const handleHeaderSort = (key: SortPath) => setSortConfig(p => ({ key, direction: p.key === key && p.direction === 'desc' ? 'asc' : 'desc' }));

    const handleMakeChange = (m: string) => {
        setSlicerMake(m);
        setSlicerGroup('ALL');
        setSlicerItemCategory('ALL');
        setSlicerLappCategory('ALL');
        setSlicerLappSubCategory('ALL');
    };

    const popupData = useMemo(() => {
        if (!selectedPopupItem) return null;

        const targetDesc = selectedPopupItem.description?.toLowerCase().trim();
        const targetPart = selectedPopupItem.partNo?.toLowerCase().trim();
        
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        
        // Current periods
        const start1Y = now - (365 * dayMs);
        const start3M = now - (90 * dayMs);
        
        // Last Year (LY) same periods
        const startLY1Y = start1Y - (365 * dayMs);
        const endLY1Y = start1Y; // up to exactly 1 year ago
        
        const startLY3M = start3M - (365 * dayMs);
        const endLY3M = now - (365 * dayMs);

        const custMap = new Map<string, {
            qty3m: number; val3m: number;
            qty1y: number; val1y: number;
            lyQty3m: number; lyQty1y: number;
            months: Set<string>;
        }>();
        
        let total3m = 0; let valTotal3m = 0;
        let total1y = 0; let valTotal1y = 0;
        let lyTotal3m = 0; let lyTotal1y = 0;

        salesReportItems.forEach(s => {
            const time = new Date(s.date).getTime();
            if (time < startLY1Y) return;
            const p = s.particulars?.toLowerCase().trim();
            if (!(p === targetDesc || (targetPart && p === targetPart))) return;

            const cName = (s.customerName || 'UNKNOWN').trim().toUpperCase();
            const ex = custMap.get(cName) || { qty3m: 0, val3m: 0, qty1y: 0, val1y: 0, lyQty3m: 0, lyQty1y: 0, months: new Set() };
            const q = Number(s.quantity) || 0;
            const v = Number(s.value) || 0;
            
            // Current 1Y
            if (time >= start1Y) {
                ex.qty1y += q;
                ex.val1y += v;
                total1y += q;
                valTotal1y += v;
                const d = new Date(s.date);
                if (!isNaN(d.getTime())) ex.months.add(`${d.getFullYear()}-${d.getMonth()}`);
            }
            // Current 3M
            if (time >= start3M) {
                ex.qty3m += q;
                ex.val3m += v;
                total3m += q;
                valTotal3m += v;
            }
            // LY 1Y
            if (time >= startLY1Y && time < endLY1Y) {
                ex.lyQty1y += q;
                lyTotal1y += q;
            }
            // LY 3M
            if (time >= startLY3M && time < endLY3M) {
                ex.lyQty3m += q;
                lyTotal3m += q;
            }
            
            custMap.set(cName, ex);
        });

        const groupLookup = new Map<string, string>();
        customers.forEach(c => {
            groupLookup.set((c.customerName || '').trim().toUpperCase(), c.customerGroup || 'Uncategorized');
        });

        const groupsMap = new Map<string, {
            groupName: string;
            customers: {
                name: string; 
                qty3m: number; val3m: number;
                qty1y: number; val1y: number;
                lyQty3m: number; lyQty1y: number;
                billedMonths: number;
            }[];
            gQty3m: number; gVal3m: number;
            gQty1y: number; gVal1y: number;
            gLyQty3m: number; gLyQty1y: number;
            totalCustomers: number;
        }>();

        custMap.forEach((data, cName) => {
            if (data.qty1y === 0 && data.lyQty1y === 0) return;

            const gName = groupLookup.get(cName) || 'Uncategorized';
            const exG = groupsMap.get(gName) || { 
                groupName: gName, customers: [], 
                gQty3m: 0, gVal3m: 0, gQty1y: 0, gVal1y: 0, gLyQty3m: 0, gLyQty1y: 0, 
                totalCustomers: 0 
            };
            
            exG.customers.push({
                name: cName,
                qty3m: data.qty3m, val3m: data.val3m,
                qty1y: data.qty1y, val1y: data.val1y,
                lyQty3m: data.lyQty3m, lyQty1y: data.lyQty1y,
                billedMonths: data.months.size
            });
            
            exG.gQty3m += data.qty3m; exG.gVal3m += data.val3m;
            exG.gQty1y += data.qty1y; exG.gVal1y += data.val1y;
            exG.gLyQty3m += data.lyQty3m; exG.gLyQty1y += data.lyQty1y;
            
            groupsMap.set(gName, exG);
        });

        const groupedArray = Array.from(groupsMap.values());
        groupedArray.forEach(g => {
            g.totalCustomers = g.customers.filter(c => c.qty1y > 0).length;
            g.customers.sort((a, b) => b.qty1y - a.qty1y);
        });
        
        groupedArray.sort((a, b) => b.gQty1y - a.gQty1y);

        return { 
            groups: groupedArray, 
            total3m, valTotal3m, 
            total1y, valTotal1y, 
            lyTotal3m, lyTotal1y 
        };
    }, [selectedPopupItem, salesReportItems, customers]);

    const handleExport = () => {
        console.log("🚀 Exporting Strategy Report...");
        try {
            if (filteredData.length === 0) {
                alert("No data to export");
                return;
            }

            const exportData = filteredData.map(r => ({
                'Make': r.make || '',
                'Group': r.materialGroup || '',
                'Description': r.description || '',
                'Stock Qty': Number(r.stock.qty) || 0,
                'Stock Val': Math.round(Number(r.stock.val)) || 0,
                'SO Cur Qty': Number(r.so.curQty) || 0,
                'SO Sch Qty': Number(r.so.schQty) || 0,
                'SO Total Qty': Number(r.so.qty) || 0,
                'PO Cur Qty': Number(r.po.curQty) || 0,
                'PO Sch Qty': Number(r.po.schQty) || 0,
                'PO Total Qty': Number(r.po.qty) || 0,
                'Net Qty': Number(r.net.qty) || 0,
                'Net Val': Math.round(Number(r.net.val)) || 0,
                'Avg 3M Qty': (Number(r.avg3m.qty) || 0).toFixed(2),
                'Avg 1Y Qty': (Number(r.avg1y.qty) || 0).toFixed(2),
                'Trend %': (Math.round(Number(r.growth.pct)) || 0) + '%',
                'Min Level': Number(r.levels.min.qty) || 0,
                'Reorder Level': Number(r.levels.reorder.qty) || 0,
                'Max Level': Number(r.levels.max.qty) || 0,
                'Excess Stock Qty': Number(r.actions.excessStock.qty) || 0,
                'Excess Stock Val': Math.round(Number(r.actions.excessStock.val)) || 0,
                'Excess PO Qty': Number(r.actions.excessPO.qty) || 0,
                'Excess PO Val': Math.round(Number(r.actions.excessPO.val)) || 0,
                'PO Need Qty': Number(r.actions.poNeed.qty) || 0,
                'PO Need Val': Math.round(Number(r.actions.poNeed.val)) || 0,
                'Expedite Qty': Number(r.actions.expedite.qty) || 0,
                'Expedite Val': Math.round(Number(r.actions.expedite.val)) || 0
            }));

            const ws = utils.json_to_sheet(exportData);
            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, "Strategy_Report");
            
            // Add summary row
            const summaryRow = {
                'Make': 'TOTALS',
                'Group': '',
                'Description': `${filteredData.length} ITEMS`,
                'Stock Qty': totals.stockQty,
                'Stock Val': Math.round(totals.stockVal),
                'SO Cur Qty': totals.soCur,
                'SO Sch Qty': totals.soSch,
                'SO Total Qty': totals.soTot,
                'PO Cur Qty': totals.poCur,
                'PO Sch Qty': totals.poSch,
                'PO Total Qty': totals.poTot,
                'Net Qty': totals.netQty,
                'Net Val': Math.round(totals.netVal),
                'Avg 3M Qty': totals.avg3m.toFixed(2),
                'Avg 1Y Qty': totals.avg1y.toFixed(2),
                'Trend %': '',
                'Min Level': totals.min,
                'Reorder Level': totals.re,
                'Max Level': totals.max,
                'Excess Stock Qty': totals.exSQty,
                'Excess Stock Val': Math.round(totals.exSVal),
                'Excess PO Qty': totals.exPQty,
                'Excess PO Val': Math.round(totals.exPVal),
                'PO Need Qty': totals.needQty,
                'PO Need Val': Math.round(totals.needVal),
                'Expedite Qty': totals.expQty,
                'Expedite Val': Math.round(totals.expVal)
            };
            
            utils.sheet_add_json(ws, [summaryRow], { skipHeader: true, origin: -1 });

            const fileName = `Strategy_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
            writeFile(wb, fileName);
            console.log("✅ Export successful:", fileName);
        } catch (error) {
            console.error("❌ Export failed:", error);
            alert("Export failed: " + (error instanceof Error ? error.message : String(error)));
        }
    };

    const renderSortIcon = (key: SortPath) => {
        if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-2 h-2 text-gray-300 ml-1" />;
        return sortConfig.direction === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-indigo-600 ml-1" /> : <ArrowDown className="w-2.5 h-2.5 text-indigo-600 ml-1" />;
    };

    return (
        <div className="flex flex-col h-full gap-3">
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Filter className="w-5 h-5 text-indigo-600" />
                        <div><h2 className="text-sm font-bold text-gray-800">Pivot Strategy Report</h2><p className="text-[10px] text-gray-500">{filteredData.length} items</p></div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" /><input type="text" placeholder="Search..." className="pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs outline-none w-64" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                        <button onClick={handleExport} className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold border border-green-100 hover:bg-green-100 transition-colors shadow-sm"><FileDown className="w-3.5 h-3.5" /> Export</button>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 border-t pt-3">
                    <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-lg border">
                        <select value={slicerMake} onChange={e => handleMakeChange(e.target.value)} className="bg-transparent text-xs font-bold outline-none">{slicerOptions.makes.map(m => <option key={m} value={m}>{m}</option>)}</select>
                        <select value={slicerGroup} onChange={e => setSlicerGroup(e.target.value)} className="bg-transparent text-xs font-bold outline-none">{slicerOptions.groups.map(g => <option key={g} value={g}>{g}</option>)}</select>
                        <select value={slicerItemCategory} onChange={e => setSlicerItemCategory(e.target.value)} className="bg-transparent text-xs font-bold outline-none border-l pl-2 text-indigo-700">
                            {['ALL', 'Fast Runner', 'Slow Runner', 'Specific Customer', 'Irregular Runner', 'Non-Moving'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        {slicerMake === 'LAPP' && (
                            <>
                                <select value={slicerLappCategory} onChange={e => { setSlicerLappCategory(e.target.value); setSlicerLappSubCategory('ALL'); }} className="bg-transparent text-xs font-bold outline-none border-l pl-2 text-indigo-700">{slicerOptions.lappCategories.map(c => <option key={c} value={c}>{c}</option>)}</select>
                                <select value={slicerLappSubCategory} onChange={e => setSlicerLappSubCategory(e.target.value)} className="bg-transparent text-xs font-bold outline-none border-l pl-2 text-indigo-700">{slicerOptions.lappSubCategories.map(c => <option key={c} value={c}>{c}</option>)}</select>
                            </>
                        )}
                        <input type="text" placeholder="Description..." value={filterDescription} onChange={e => setFilterDescription(e.target.value)} className="bg-transparent text-xs outline-none w-32 border-l pl-2" />
                    </div>
                    <div className="flex gap-1.5">
                        <button onClick={() => { setShowExcessStock(!showExcessStock); if(!showExcessStock) {setShowExcessPO(false); setShowPONeed(false); setShowExpedite(false);} }} className={`px-2 py-1 rounded text-[10px] font-bold border ${showExcessStock ? 'bg-red-50 text-red-700' : 'bg-white text-gray-500'}`}>Excess Stock</button>
                        <button onClick={() => { setShowExcessPO(!showExcessPO); if(!showExcessPO) {setShowExcessStock(false); setShowPONeed(false); setShowExpedite(false);} }} className={`px-2 py-1 rounded text-[10px] font-bold border ${showExcessPO ? 'bg-orange-50 text-orange-700' : 'bg-white text-gray-500'}`}>Excess PO</button>
                        <button onClick={() => { setShowPONeed(!showPONeed); if(!showPONeed) {setShowExcessStock(false); setShowExcessPO(false); setShowExpedite(false);} }} className={`px-2 py-1 rounded text-[10px] font-bold border ${showPONeed ? 'bg-green-50 text-green-700' : 'bg-white text-gray-500'}`}>PO Need</button>
                        <button onClick={() => { setShowExpedite(!showExpedite); if(!showExpedite) {setShowExcessStock(false); setShowExcessPO(false); setShowPONeed(false);} }} className={`px-2 py-1 rounded text-[10px] font-bold border ${showExpedite ? 'bg-blue-50 text-blue-700' : 'bg-white text-gray-500'}`}>Expedite</button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex-1 relative">
                <div className="overflow-auto h-full w-full">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-50 bg-gray-50 text-[9px] font-bold uppercase">
                            <tr className="bg-gray-100 border-b text-center">
                                <th colSpan={3} className="p-1 border-r sticky left-0 z-20 bg-gray-100">Master Data</th>
                                <th colSpan={2} className="p-1 border-r bg-blue-50/50">Stock Inventory</th>
                                <th colSpan={showSOCols ? 3 : 1} className="p-1 border-r bg-orange-50/50 cursor-pointer hover:bg-orange-100/50 transition-colors" onClick={() => setShowSOCols(!showSOCols)} title="Toggle SO Details">
                                    <div className="flex items-center justify-center gap-1">Sales (SO) {showSOCols ? <EyeOff className="w-3 h-3 text-orange-400" /> : <Eye className="w-3 h-3 text-orange-400" />}</div>
                                </th>
                                <th colSpan={showPOCols ? 3 : 1} className="p-1 border-r bg-purple-50/50 cursor-pointer hover:bg-purple-100/50 transition-colors" onClick={() => setShowPOCols(!showPOCols)} title="Toggle PO Details">
                                    <div className="flex items-center justify-center gap-1">Purchases (PO) {showPOCols ? <EyeOff className="w-3 h-3 text-purple-400" /> : <Eye className="w-3 h-3 text-purple-400" />}</div>
                                </th>
                                <th colSpan={2} className="p-1 border-r bg-gray-200 text-center">Net</th>
                                <th colSpan={3} className="p-1 border-r bg-indigo-50/50 text-center">Planning (Avg/Trend)</th>
                                <th colSpan={3} className="p-1 border-r bg-emerald-50/50 text-center">Levels (Min/Re/Max)</th>
                                {(!showExcessStock && !showExcessPO && !showPONeed && !showExpedite || showExcessStock) && <th colSpan={2} className="p-1 border-r text-red-700 text-center">Ex Stock</th>}
                                {(!showExcessStock && !showExcessPO && !showPONeed && !showExpedite || showExcessPO) && <th colSpan={2} className="p-1 border-r text-red-700 text-center">Ex PO</th>}
                                {(!showExcessStock && !showExcessPO && !showPONeed && !showExpedite || showPONeed) && <th colSpan={2} className="p-1 border-r text-green-700 text-center">Need</th>}
                                {(!showExcessStock && !showExcessPO && !showPONeed && !showExpedite || showExpedite) && <th colSpan={2} className="p-1 text-blue-700 text-center">Exp</th>}
                            </tr>
                            <tr className="border-b cursor-pointer">
                                <th onClick={() => handleHeaderSort('make')} className="p-2 border-r sticky left-0 z-20 bg-gray-50 min-w-[70px]">Make {renderSortIcon('make')}</th>
                                <th onClick={() => handleHeaderSort('materialGroup')} className="p-2 border-r sticky left-[70px] z-20 bg-gray-50 min-w-[150px]">Group {renderSortIcon('materialGroup')}</th>
                                <th onClick={() => handleHeaderSort('description')} className="p-2 border-r sticky left-[220px] z-20 bg-gray-50 min-w-[250px]">Description {renderSortIcon('description')}</th>
                                <th onClick={() => handleHeaderSort('stock.qty')} className="p-2 text-right bg-blue-50/20 min-w-[80px]">Qty {renderSortIcon('stock.qty')}</th>
                                <th onClick={() => handleHeaderSort('stock.val')} className="p-2 text-right border-r bg-blue-50/20 min-w-[100px]">Val {renderSortIcon('stock.val')}</th>
                                {showSOCols && <th onClick={() => handleHeaderSort('so.curQty')} className="p-2 text-right text-orange-600 min-w-[60px]">Cur {renderSortIcon('so.curQty')}</th>}
                                {showSOCols && <th onClick={() => handleHeaderSort('so.schQty')} className="p-2 text-right text-orange-600 min-w-[60px]">Sch {renderSortIcon('so.schQty')}</th>}
                                <th onClick={() => handleHeaderSort('so.qty')} className="p-2 text-right border-r min-w-[70px]">Tot {renderSortIcon('so.qty')}</th>
                                {showPOCols && <th onClick={() => handleHeaderSort('po.curQty')} className="p-2 text-right text-purple-600">Cur {renderSortIcon('po.curQty')}</th>}
                                {showPOCols && <th onClick={() => handleHeaderSort('po.schQty')} className="p-2 text-right text-purple-600">Sch {renderSortIcon('po.schQty')}</th>}
                                <th onClick={() => handleHeaderSort('po.qty')} className="p-2 text-right border-r">Tot {renderSortIcon('po.qty')}</th>
                                <th onClick={() => handleHeaderSort('net.qty')} className="p-2 text-right bg-gray-100">Qty {renderSortIcon('net.qty')}</th>
                                <th onClick={() => handleHeaderSort('net.val')} className="p-2 text-right border-r bg-gray-100">Val {renderSortIcon('net.val')}</th>
                                <th onClick={() => handleHeaderSort('avg3m.qty')} className="p-2 text-right text-indigo-700">3M {renderSortIcon('avg3m.qty')}</th>
                                <th onClick={() => handleHeaderSort('avg1y.qty')} className="p-2 text-right text-indigo-700">1Y {renderSortIcon('avg1y.qty')}</th>
                                <th onClick={() => handleHeaderSort('growth.pct')} className="p-2 text-center border-r text-indigo-700">Trend {renderSortIcon('growth.pct')}</th>
                                <th onClick={() => handleHeaderSort('levels.min.qty')} className="p-2 text-right text-emerald-700">Min {renderSortIcon('levels.min.qty')}</th>
                                <th onClick={() => handleHeaderSort('levels.reorder.qty')} className="p-2 text-right text-emerald-700">Re {renderSortIcon('levels.reorder.qty')}</th>
                                <th onClick={() => handleHeaderSort('levels.max.qty')} className="p-2 text-right border-r text-emerald-700">Max {renderSortIcon('levels.max.qty')}</th>
                                {(!showExcessStock && !showExcessPO && !showPONeed && !showExpedite || showExcessStock) && <><th onClick={() => handleHeaderSort('actions.excessStock.qty')} className="p-2 text-right">Qty {renderSortIcon('actions.excessStock.qty')}</th>
                                <th onClick={() => handleHeaderSort('actions.excessStock.val')} className="p-2 text-right border-r">Val {renderSortIcon('actions.excessStock.val')}</th></>}
                                {(!showExcessStock && !showExcessPO && !showPONeed && !showExpedite || showExcessPO) && <><th onClick={() => handleHeaderSort('actions.excessPO.qty')} className="p-2 text-right">Qty {renderSortIcon('actions.excessPO.qty')}</th>
                                <th onClick={() => handleHeaderSort('actions.excessPO.val')} className="p-2 text-right border-r">Val {renderSortIcon('actions.excessPO.val')}</th></>}
                                {(!showExcessStock && !showExcessPO && !showPONeed && !showExpedite || showPONeed) && <><th onClick={() => handleHeaderSort('actions.poNeed.qty')} className="p-2 text-right">Qty {renderSortIcon('actions.poNeed.qty')}</th>
                                <th onClick={() => handleHeaderSort('actions.poNeed.val')} className="p-2 text-right border-r">Val {renderSortIcon('actions.poNeed.val')}</th></>}
                                {(!showExcessStock && !showExcessPO && !showPONeed && !showExpedite || showExpedite) && <><th onClick={() => handleHeaderSort('actions.expedite.qty')} className="p-2 text-right">Qty {renderSortIcon('actions.expedite.qty')}</th>
                                <th onClick={() => handleHeaderSort('actions.expedite.val')} className="p-2 text-right">Val {renderSortIcon('actions.expedite.val')}</th></>}
                            </tr>
                            <tr className="bg-amber-50 border-b text-[10px] font-black text-gray-900 shadow-sm z-10">
                                <td className="p-2 border-r sticky left-0 z-20 bg-amber-50">TOTALS</td>
                                <td className="p-2 border-r sticky left-[70px] z-20 bg-amber-50 text-[8px] text-gray-400">SUM OF FILTERED</td>
                                <td className="p-2 border-r sticky left-[220px] z-20 bg-amber-50 text-[8px] text-gray-400 text-right">{filteredData.length} ITEMS</td>
                                <td className="p-2 text-right bg-blue-100/30">{totals.stockQty.toLocaleString()}</td>
                                <td className="p-2 text-right border-r bg-blue-100/30 text-blue-900">{formatLargeValue(totals.stockVal)}</td>
                                {showSOCols && <td className="p-2 text-right text-orange-700">{totals.soCur.toLocaleString()}</td>}
                                {showSOCols && <td className="p-2 text-right text-orange-700">{totals.soSch.toLocaleString()}</td>}
                                <td className="p-2 text-right border-r font-bold">{totals.soTot.toLocaleString()}</td>
                                {showPOCols && <td className="p-2 text-right text-purple-700">{totals.poCur.toLocaleString()}</td>}
                                {showPOCols && <td className="p-2 text-right text-purple-700">{totals.poSch.toLocaleString()}</td>}
                                <td className="p-2 text-right border-r font-bold">{totals.poTot.toLocaleString()}</td>
                                <td className="p-2 text-right bg-slate-200/50">{totals.netQty.toLocaleString()}</td>
                                <td className="p-2 text-right border-r bg-slate-200/50">{formatLargeValue(totals.netVal)}</td>
                                <td className="p-2 text-right text-indigo-800">{totals.avg3m.toFixed(0)}</td>
                                <td className="p-2 text-right text-indigo-800">{totals.avg1y.toFixed(0)}</td>
                                <td className="p-2 text-center border-r">-</td>
                                <td className="p-2 text-right text-emerald-800">{totals.min.toLocaleString()}</td>
                                <td className="p-2 text-right text-emerald-800">{totals.re.toLocaleString()}</td>
                                <td className="p-2 text-right border-r text-emerald-800 font-bold">{totals.max.toLocaleString()}</td>
                                {(!showExcessStock && !showExcessPO && !showPONeed && !showExpedite || showExcessStock) && <><td className="p-2 text-right text-red-700">{totals.exSQty.toLocaleString()}</td>
                                <td className="p-2 text-right border-r text-red-700">{formatLargeValue(totals.exSVal)}</td></>}
                                {(!showExcessStock && !showExcessPO && !showPONeed && !showExpedite || showExcessPO) && <><td className="p-2 text-right text-red-700">{totals.exPQty.toLocaleString()}</td>
                                <td className="p-2 text-right border-r text-red-700">{formatLargeValue(totals.exPVal)}</td></>}
                                {(!showExcessStock && !showExcessPO && !showPONeed && !showExpedite || showPONeed) && <><td className="p-2 text-right text-green-700">{totals.needQty.toLocaleString()}</td>
                                <td className="p-2 text-right border-r text-green-700">{formatLargeValue(totals.needVal)}</td></>}
                                {(!showExcessStock && !showExcessPO && !showPONeed && !showExpedite || showExpedite) && <><td className="p-2 text-right text-blue-700">{totals.expQty.toLocaleString()}</td>
                                <td className="p-2 text-right text-blue-700">{formatLargeValue(totals.expVal)}</td></>}
                            </tr>
                        </thead>
                        <tbody className="divide-y text-[10px]">
                            {filteredData.slice(0, displayLimit).map((r, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                    <td className="p-1 border-r sticky left-0 z-10 bg-white font-bold">{r.make}</td>
                                    <td className="p-1 border-r sticky left-[70px] z-10 bg-white truncate max-w-[150px] text-gray-600" title={r.materialGroup}>{r.materialGroup}</td>
                                    <td 
                                        className="p-1 border-r sticky left-[220px] z-10 bg-white truncate max-w-[250px] font-medium cursor-pointer hover:text-indigo-600 hover:underline underline-offset-2 transition-colors" 
                                        title={`${r.description} (Click for Customer Breakdown)`}
                                        onClick={() => setSelectedPopupItem(r)}
                                    >
                                        {r.description}
                                    </td>
                                    <td className="p-1 text-right bg-blue-50/5 font-bold">{r.stock.qty || '-'}</td>
                                    <td className="p-1 text-right border-r text-gray-500">{r.stock.val ? Math.round(r.stock.val).toLocaleString() : '-'}</td>
                                    {showSOCols && <td className="p-1 text-right text-orange-600">{r.so.curQty || '-'}</td>}
                                    {showSOCols && <td className="p-1 text-right text-orange-400">{r.so.schQty || '-'}</td>}
                                    <td className="p-1 text-right border-r font-bold">{r.so.qty || '-'}</td>
                                    {showPOCols && <td className="p-1 text-right text-purple-600">{r.po.curQty || '-'}</td>}
                                    {showPOCols && <td className="p-1 text-right text-purple-400">{r.po.schQty || '-'}</td>}
                                    <td className="p-1 text-right border-r font-bold">{r.po.qty || '-'}</td>
                                    <td className="p-1 text-right bg-gray-50 font-bold">{r.net.qty}</td>
                                    <td className="p-1 text-right border-r bg-gray-50">{Math.round(r.net.val).toLocaleString()}</td>
                                    <td className="p-1 text-right text-indigo-700">{r.avg3m.qty > 0 ? r.avg3m.qty.toFixed(1) : '0'}</td>
                                    <td className="p-1 text-right text-indigo-700">{r.avg1y.qty > 0 ? r.avg1y.qty.toFixed(1) : '0'}</td>
                                    <td className="p-1 text-center border-r text-[8px] font-black">
                                        {r.avg1y.qty > 0 && (
                                            <div className={`flex items-center justify-center gap-0.5 ${r.growth.pct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {r.growth.pct >= 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                                                <span>{Math.abs(Math.round(r.growth.pct))}%</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-1 text-right text-emerald-700 font-bold">{r.levels.min.qty || '0'}</td>
                                    <td className="p-1 text-right text-emerald-700 font-bold">{r.levels.reorder.qty || '0'}</td>
                                    <td className="p-1 text-right border-r text-emerald-700 font-bold">{r.levels.max.qty || '0'}</td>
                                    {(!showExcessStock && !showExcessPO && !showPONeed && !showExpedite || showExcessStock) && <><td className="p-1 text-right text-red-600 font-bold">{r.actions.excessStock.qty || ''}</td>
                                    <td className="p-1 text-right border-r text-red-300">{r.actions.excessStock.val ? Math.round(r.actions.excessStock.val).toLocaleString() : ''}</td></>}
                                    {(!showExcessStock && !showExcessPO && !showPONeed && !showExpedite || showExcessPO) && <><td className="p-1 text-right text-red-600 font-bold">{r.actions.excessPO.qty || ''}</td>
                                    <td className="p-1 text-right border-r text-red-300">{r.actions.excessPO.val ? Math.round(r.actions.excessPO.val).toLocaleString() : ''}</td></>}
                                    {(!showExcessStock && !showExcessPO && !showPONeed && !showExpedite || showPONeed) && <><td className="p-1 text-right text-green-600 font-bold">{r.actions.poNeed.qty || ''}</td>
                                    <td className="p-1 text-right border-r text-green-300">{r.actions.poNeed.val ? Math.round(r.actions.poNeed.val).toLocaleString() : ''}</td></>}
                                    {(!showExcessStock && !showExcessPO && !showPONeed && !showExpedite || showExpedite) && <><td className="p-1 text-right text-blue-600 font-bold">{r.actions.expedite.qty || ''}</td>
                                    <td className="p-1 text-right border-r text-blue-300">{r.actions.expedite.val ? Math.round(r.actions.expedite.val).toLocaleString() : ''}</td></>}
                                </tr>
                            ))}
                            {filteredData.length > displayLimit && (
                                <tr><td colSpan={27} className="p-4 text-center"><button onClick={() => setDisplayLimit(d => d + 200)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-md">Load More ({filteredData.length - displayLimit})</button></td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Right-aligned Popup Panel */}
            {selectedPopupItem && popupData && (() => {
                const is3M = popupPeriod === '3M';
                const totalQty = is3M ? popupData.total3m : popupData.total1y;
                const totalVal = is3M ? popupData.valTotal3m : popupData.valTotal1y;
                
                const avgTotal3M = popupData.total3m / 3;
                const avgTotal1Y = popupData.total1y / 12;
                const totalGrowthPct = avgTotal1Y > 0 ? ((avgTotal3M - avgTotal1Y) / avgTotal1Y) * 100 : (avgTotal3M > 0 ? 100 : 0);

                return (
                    <div className="fixed inset-0 z-[100] flex justify-end bg-black/20 backdrop-blur-sm transition-all" onClick={() => setSelectedPopupItem(null)}>
                        <div className="w-[900px] h-full bg-white shadow-2xl flex flex-col animate-slide-in-right overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between p-4 border-b bg-indigo-50">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-bold text-indigo-900 text-sm">Customer Breakdown</h3>
                                        <div className="flex bg-white rounded-lg border p-0.5 shadow-sm">
                                            <button onClick={() => setPopupPeriod('3M')} className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md transition-colors ${is3M ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>3 Months</button>
                                            <button onClick={() => setPopupPeriod('1Y')} className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md transition-colors ${!is3M ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>1 Year</button>
                                        </div>
                                    </div>
                                    <p className="text-xs text-indigo-700 font-medium mt-1.5 truncate max-w-[700px]" title={selectedPopupItem.description}>{selectedPopupItem.description}</p>
                                </div>
                                <button onClick={() => setSelectedPopupItem(null)} className="p-1 hover:bg-indigo-100 rounded-full text-indigo-900"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="flex-1 overflow-auto p-4 bg-gray-50">
                                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-gray-100 text-gray-600 font-bold border-b">
                                            <tr>
                                                <th className="p-2 w-8"></th>
                                                <th className="p-2">Customer Group / Name</th>
                                                <th className="p-2 text-center">Billed Months</th>
                                                <th className="p-2 text-right bg-indigo-50/50">3M Qty</th>
                                                <th className="p-2 text-right bg-indigo-50/50">1Y Qty</th>
                                                <th className="p-2 text-right">Value (₹)</th>
                                                <th className="p-2 text-right">Consumption %</th>
                                                <th className="p-2 text-center text-indigo-800">Trend (3M vs 1Y)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {popupData.groups.length === 0 && (
                                                <tr><td colSpan={8} className="p-4 text-center text-gray-500 italic">No sales found.</td></tr>
                                            )}
                                            {popupData.groups.map(g => {
                                                const isExpanded = expandedGroups.has(g.groupName);
                                                const gQty = is3M ? g.gQty3m : g.gQty1y;
                                                const gVal = is3M ? g.gVal3m : g.gVal1y;
                                                
                                                const avgG3M = g.gQty3m / 3;
                                                const avgG1Y = g.gQty1y / 12;
                                                const groupGrowth = avgG1Y > 0 ? ((avgG3M - avgG1Y) / avgG1Y) * 100 : (avgG3M > 0 ? 100 : 0);
                                                const groupConsumption = totalQty > 0 ? (gQty / totalQty) * 100 : 0;

                                                // Only show group if it has activity in 1Y
                                                if (g.gQty1y === 0) return null;

                                                return (
                                                    <React.Fragment key={g.groupName}>
                                                        <tr className="bg-slate-50 hover:bg-slate-100 cursor-pointer font-bold border-b-[1px] border-slate-200" onClick={() => toggleGroup(g.groupName)}>
                                                            <td className="p-2 text-center text-indigo-600">
                                                                {isExpanded ? <ChevronDown className="w-4 h-4 mx-auto" /> : <ChevronRight className="w-4 h-4 mx-auto" />}
                                                            </td>
                                                            <td className="p-2">
                                                                <span className="text-indigo-900">{g.groupName}</span>
                                                                <span className="ml-2 text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200">{g.totalCustomers} {g.totalCustomers === 1 ? 'Customer' : 'Customers'}</span>
                                                            </td>
                                                            <td className="p-2 text-center text-gray-500">-</td>
                                                            <td className="p-2 text-right text-indigo-700 bg-indigo-50/20">{g.gQty3m.toLocaleString()}</td>
                                                            <td className="p-2 text-right text-indigo-900 bg-indigo-50/20">{g.gQty1y.toLocaleString()}</td>
                                                            <td className="p-2 text-right text-gray-700">{Math.round(gVal).toLocaleString()}</td>
                                                            <td className="p-2 text-right text-emerald-700">{groupConsumption.toFixed(1)}%</td>
                                                            <td className="p-2 text-center bg-gray-50/50">
                                                                {(g.gQty3m > 0 || g.gQty1y > 0) && (
                                                                    <div className={`flex items-center justify-center gap-0.5 text-[10px] ${groupGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                        {groupGrowth >= 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                                                                        <span>{Math.abs(Math.round(groupGrowth))}%</span>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                        {isExpanded && g.customers.map((c, i) => {
                                                            const cQty = is3M ? c.qty3m : c.qty1y;
                                                            const cVal = is3M ? c.val3m : c.val1y;
                                                            
                                                            const avgC3M = c.qty3m / 3;
                                                            const avgC1Y = c.qty1y / 12;
                                                            const cGrowth = avgC1Y > 0 ? ((avgC3M - avgC1Y) / avgC1Y) * 100 : (avgC3M > 0 ? 100 : 0);
                                                            const cConsumption = totalQty > 0 ? (cQty / totalQty) * 100 : 0;
                                                            
                                                            const isStopped = c.qty1y === 0;
                                                            if (isStopped) return null;

                                                            return (
                                                                <tr key={`${g.groupName}-${c.name}-${i}`} className={`hover:bg-indigo-50/30 bg-white`}>
                                                                    <td className="p-2"></td>
                                                                    <td className="p-2 pl-4 border-l-2 border-indigo-200 text-gray-700 font-medium truncate max-w-[280px]" title={c.name}>
                                                                        {c.name}
                                                                    </td>
                                                                    <td className="p-2 text-center font-bold text-gray-600">{c.billedMonths}</td>
                                                                    <td className="p-2 text-right font-bold text-indigo-600 bg-indigo-50/10">{c.qty3m.toLocaleString()}</td>
                                                                    <td className="p-2 text-right font-bold text-indigo-900 bg-indigo-50/10">{c.qty1y.toLocaleString()}</td>
                                                                    <td className="p-2 text-right text-gray-600">{Math.round(cVal).toLocaleString()}</td>
                                                                    <td className="p-2 text-right font-bold text-emerald-600">{cConsumption.toFixed(1)}%</td>
                                                                    <td className="p-2 text-center bg-gray-50/30">
                                                                        {(c.qty3m > 0 || c.qty1y > 0) && (
                                                                            <div className={`flex items-center justify-center gap-0.5 text-[9px] font-black ${cGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                                {cGrowth >= 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                                                                                <span>{Math.abs(Math.round(cGrowth))}%</span>
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                        {popupData.groups.length > 0 && (
                                            <tfoot className="bg-gray-800 text-white font-bold text-xs">
                                                <tr>
                                                    <td colSpan={3} className="p-2 text-right uppercase">TOTAL (BASED ON {popupPeriod}):</td>
                                                    <td className="p-2 text-right text-indigo-300">{popupData.total3m.toLocaleString()}</td>
                                                    <td className="p-2 text-right text-indigo-300">{popupData.total1y.toLocaleString()}</td>
                                                    <td className="p-2 text-right text-gray-300">{Math.round(totalVal).toLocaleString()}</td>
                                                    <td className="p-2 text-right text-green-400">100%</td>
                                                    <td className="p-2 text-center bg-gray-900">
                                                        <div className={`flex items-center justify-center gap-0.5 ${totalGrowthPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {totalGrowthPct >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                                            <span>{Math.abs(Math.round(totalGrowthPct))}%</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default PivotReportView;
