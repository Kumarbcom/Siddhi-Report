
import { SalesReportItem } from '../types';

export interface SalesSummary {
  qty3m: number;
  val3m: number;
  qty1y: number;
  val1y: number;
  customers: Set<string>;
  billedMonths: Set<string>;
}

export type SalesSummaryMap = Map<string, SalesSummary>;

class FastSalesService {
  private summaryCache: {
    data: SalesSummaryMap;
    sourceArray: SalesReportItem[];
    timestamp: number;
  } | null = null;

  private dateCache = new Map<any, number>();

  private parseDateFast(val: any): number {
    if (!val) return 0;
    if (this.dateCache.has(val)) return this.dateCache.get(val)!;
    
    let d: number;
    if (val instanceof Date) {
      d = val.getTime();
    } else if (typeof val === 'number') {
      d = (Math.round(val) - 25568) * 86400 * 1000;
    } else {
      const parsed = new Date(val).getTime();
      d = isNaN(parsed) ? 0 : parsed;
    }
    
    this.dateCache.set(val, d);
    return d;
  }

  getSummaries(sales: SalesReportItem[]): SalesSummaryMap {
    // Return cache if it's the exact same array reference and not older than 1 hour
    if (this.summaryCache && this.summaryCache.sourceArray === sales) {
      const isCacheStale = Date.now() - this.summaryCache.timestamp > 3600000; // 1 hour
      if (!isCacheStale) {
        return this.summaryCache.data;
      }
    }

    console.time('🚀 FastSalesService.getSummaries');
    const summaries: SalesSummaryMap = new Map();
    
    const now = Date.now();
    const threeMonthsAgo = now - (90 * 24 * 60 * 60 * 1000);
    const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);

    for (let i = 0; i < sales.length; i++) {
        const item = sales[i];
        if (!item.particulars) continue;
        
        const key = item.particulars.toLowerCase().trim();
        const time = this.parseDateFast(item.date);
        
        if (time < oneYearAgo) continue;

        let summary = summaries.get(key);
        if (!summary) {
            summary = { qty3m: 0, val3m: 0, qty1y: 0, val1y: 0, customers: new Set(), billedMonths: new Set() };
            summaries.set(key, summary);
        }

        const qty = item.quantity || 0;
        const val = item.value || 0;
        
        if (item.customerName) summary.customers.add(item.customerName.trim().toUpperCase());
        const dateObj = new Date(time);
        summary.billedMonths.add(`${dateObj.getFullYear()}-${dateObj.getMonth()}`);

        summary.qty1y += qty;
        summary.val1y += val;

        if (time >= threeMonthsAgo) {
            summary.qty3m += qty;
            summary.val3m += val;
        }
    }

    this.summaryCache = {
      data: summaries,
      sourceArray: sales,
      timestamp: Date.now()
    };
    
    console.timeEnd('🚀 FastSalesService.getSummaries');
    return summaries;
  }
}

export const fastSalesService = new FastSalesService();
