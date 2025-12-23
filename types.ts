
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
