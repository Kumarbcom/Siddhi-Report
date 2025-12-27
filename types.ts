
export interface Material {
  id: string;
  materialCode: string;
  description: string;
  partNo: string;
  make: string;
  materialGroup: string;
  createdAt: number;
  updatedAt?: number;
}

export type MaterialFormData = Omit<Material, 'id' | 'createdAt' | 'updatedAt'>;

export interface PendingSOItem {
  id: string;
  date: string;
  orderNo: string;
  partyName: string;
  itemName: string;
  materialCode: string;
  partNo: string;
  orderedQty: number;
  balanceQty: number;
  rate: number;
  discount: number;
  value: number;
  dueDate: string;
  overDueDays: number;
  createdAt: number;
}

export interface PendingPOItem {
  id: string;
  date: string;
  orderNo: string;
  partyName: string;
  itemName: string;
  materialCode: string;
  partNo: string;
  orderedQty: number;
  balanceQty: number;
  rate: number;
  discount: number;
  value: number;
  dueDate: string;
  overDueDays: number;
  createdAt: number;
}

export interface SalesRecord {
  id: string;
  particulars: string;
  quantity: number;
  rate: number; // Eff. Rate
  value: number;
  createdAt: number;
}

export interface ClosingStockItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  value: number;
  createdAt: number;
}

export interface SalesReportItem {
  id: string;
  date: string;
  customerName: string;
  particulars: string;
  consignee: string;
  voucherNo: string;
  voucherRefNo: string;
  quantity: number;
  value: number;
  createdAt: number;
}

export interface CustomerMasterItem {
  id: string;
  customerName: string;
  group: string;
  salesRep: string;
  status: string;
  customerGroup: string;
  createdAt: number;
}


export interface Attendee {
  id: string;
  name: string;
  designation: string;
  imageUrl?: string;
  createdAt: number;
}

export interface MOMItem {
  id: string;
  slNo: number;
  agendaItem: string;
  discussion: string;
  actionAccount: string[];
  timeline: string;
  reminderDate?: string;
  isCompleted?: boolean;
}

export interface MOM {
  id: string;
  title: string;
  date: string;
  attendees: string[]; // IDs of attendees
  items: MOMItem[];
  createdAt: number;
  benchmarks?: Record<string, any>;
}

// Support for Vite env variables in TypeScript
declare global {
  interface ImportMetaEnv {
    readonly VITE_GEMINI_API_KEY: string;
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_KEY: string;
    // add more env variables as needed
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
