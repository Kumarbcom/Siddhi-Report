
import { supabase } from './supabase';
import { PendingPOItem } from '../types';
import { dbService, STORES } from './db';

const BATCH_SIZE = 1000;

export const poService = {
  async getAll(): Promise<PendingPOItem[]> {
    const allData: PendingPOItem[] = [];
    try {
      let hasMore = true;
      let page = 0;
      while (hasMore) {
        const { data, error } = await supabase.from('pending_purchase_orders')
          .select('*')
          .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          const mapped = data.map((row: any) => ({
            id: row.id,
            date: row.po_date || row.date,
            orderNo: row.order_no,
            partyName: row.party_name,
            itemName: row.item_name,
            materialCode: row.material_code,
            partNo: row.part_no,
            orderedQty: Number(row.ordered_qty || 0),
            balanceQty: Number(row.balance_qty || 0),
            rate: Number(row.rate || 0),
            discount: Number(row.discount || 0),
            value: Number(row.value || 0),
            dueDate: row.due_on,
            overDueDays: Number(row.overdue_days || 0),
            createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
          }));
          mapped.forEach((item: PendingPOItem) => allData.push(item));
          if (data.length < BATCH_SIZE) hasMore = false;
          else page++;
        } else { hasMore = false; }
      }
      await dbService.clearStore(STORES.PO);
      await dbService.putBatch(STORES.PO, allData);
      return allData;
    } catch (e) {
      console.warn('Supabase fetch failed (PO), using IndexedDB.', e);
      return await dbService.getAll<PendingPOItem>(STORES.PO);
    }
  },

  async createBulk(items: Omit<PendingPOItem, 'id' | 'createdAt'>[]): Promise<PendingPOItem[]> {
    const timestamp = Date.now();
    const newItems = items.map(i => ({ ...i, id: crypto.randomUUID(), createdAt: timestamp }));
    const rows = newItems.map(i => ({
      id: i.id,
      po_date: i.date,
      order_no: i.orderNo,
      party_name: i.partyName,
      item_name: i.itemName,
      material_code: i.materialCode,
      part_no: i.partNo,
      ordered_qty: Number(i.orderedQty || 0),
      balance_qty: Number(i.balanceQty || 0),
      rate: Number(i.rate || 0),
      discount: Number(i.discount || 0),
      value: Number(i.value || 0),
      due_on: i.dueDate,
      overdue_days: Number(i.overDueDays || 0),
      created_at: new Date(i.createdAt).toISOString()
    }));
    try {
      const { error } = await supabase.from('pending_purchase_orders').insert(rows);
      if (error) throw error;
    } catch (e) { 
      console.error('Supabase bulk insert failed (PO):', e);
    }
    await dbService.putBatch(STORES.PO, newItems);
    return newItems;
  },

  async update(item: PendingPOItem): Promise<void> {
    try {
      await supabase.from('pending_purchase_orders').update({
        po_date: item.date,
        order_no: item.orderNo,
        party_name: item.partyName,
        item_name: item.itemName,
        part_no: item.partNo,
        ordered_qty: Number(item.orderedQty),
        balance_qty: Number(item.balanceQty),
        rate: Number(item.rate),
        value: Number(item.value),
        due_on: item.dueDate
      }).eq('id', item.id);
    } catch (e) { console.warn('Supabase update failed.'); }
    await dbService.putBatch(STORES.PO, [item]);
  },

  async delete(id: string): Promise<void> {
    try {
      await supabase.from('pending_purchase_orders').delete().eq('id', id);
    } catch (e) { console.warn('Supabase delete failed.'); }
    await dbService.deleteOne(STORES.PO, id);
  },

  async clearAll(): Promise<void> {
    try {
      await supabase.from('pending_purchase_orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch (e) { console.warn('Supabase clear failed.'); }
    await dbService.clearStore(STORES.PO);
  }
};
