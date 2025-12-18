
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
            date: row.date,
            orderNo: row.order_no,
            partyName: row.party_name,
            itemName: row.item_name,
            materialCode: row.material_code,
            partNo: row.part_no,
            orderedQty: Number(row.ordered_qty),
            balanceQty: Number(row.balance_qty),
            rate: Number(row.rate),
            discount: Number(row.discount),
            value: Number(row.value),
            dueDate: row.due_on,
            overDueDays: Number(row.overdue_days),
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
      console.warn('Supabase fetch failed (PO), using IndexedDB.');
      return await dbService.getAll<PendingPOItem>(STORES.PO);
    }
  },

  async createBulk(items: Omit<PendingPOItem, 'id' | 'createdAt'>[]): Promise<PendingPOItem[]> {
    const timestamp = Date.now();
    const newItems = items.map(i => ({ ...i, id: crypto.randomUUID(), createdAt: timestamp }));
    const rows = newItems.map(i => ({
      id: i.id,
      date: i.date,
      order_no: i.orderNo,
      party_name: i.partyName,
      item_name: i.itemName,
      material_code: i.materialCode,
      part_no: i.partNo,
      ordered_qty: i.orderedQty,
      balance_qty: i.balanceQty,
      rate: i.rate,
      discount: i.discount,
      value: i.value,
      due_on: i.dueDate,
      overdue_days: i.overDueDays,
      created_at: new Date(i.createdAt).toISOString()
    }));
    try {
      const chunks = [];
      for (let i = 0; i < rows.length; i += BATCH_SIZE) chunks.push(rows.slice(i, i + BATCH_SIZE));
      const CONCURRENCY = 5;
      for (let i = 0; i < chunks.length; i += CONCURRENCY) {
        const batch = chunks.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(chunk => supabase.from('pending_purchase_orders').insert(chunk)));
      }
    } catch (e) { console.warn('Supabase bulk insert failed (PO), synced locally.'); }
    await dbService.putBatch(STORES.PO, newItems);
    return newItems;
  },

  async update(item: PendingPOItem): Promise<void> {
    try {
      await supabase.from('pending_purchase_orders').update({
        date: item.date,
        order_no: item.orderNo,
        party_name: item.partyName,
        item_name: item.itemName,
        part_no: item.partNo,
        ordered_qty: item.orderedQty,
        balance_qty: item.balanceQty,
        rate: item.rate,
        value: item.value,
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
