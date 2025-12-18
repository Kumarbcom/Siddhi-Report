
import { supabase } from './supabase';
import { Material, MaterialFormData } from '../types';
import { dbService, STORES } from './db';

const BATCH_SIZE = 1000;

export const materialService = {
  async getAll(): Promise<Material[]> {
    const allData: Material[] = [];
    try {
      let hasMore = true;
      let page = 0;
      while (hasMore) {
        const { data, error } = await supabase
          .from('material_master')
          .select('*')
          .order('created_at', { ascending: false })
          .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1);

        if (error) throw error;
        if (data && data.length > 0) {
          const mapped = data.map((row: any) => ({
            id: row.id,
            description: row.description,
            partNo: row.part_no,
            make: row.make,
            materialGroup: row.material_group,
            createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
          }));
          mapped.forEach((m: Material) => allData.push(m));
          if (data.length < BATCH_SIZE) hasMore = false;
          else page++;
        } else {
          hasMore = false;
        }
      }
      await dbService.clearStore(STORES.MATERIALS);
      await dbService.putBatch(STORES.MATERIALS, allData);
      return allData;
    } catch (e) {
      console.warn('Supabase fetch failed (Materials), using IndexedDB.');
      return await dbService.getAll<Material>(STORES.MATERIALS);
    }
  },

  async deduplicate(): Promise<Material[]> {
    const materials = await this.getAll();
    const seen = new Set<string>();
    const unique: Material[] = [];
    for (const m of materials) {
      const key = `${(m.description || '').toLowerCase().trim()}|${(m.partNo || '').toLowerCase().trim()}|${(m.make || '').toLowerCase().trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(m);
      }
    }
    return unique;
  },

  async createBulk(materials: MaterialFormData[]): Promise<Material[]> {
    const timestamp = Date.now();
    const newItems = materials.map(m => ({ ...m, id: crypto.randomUUID(), createdAt: timestamp }));
    const rows = newItems.map(m => ({
      id: m.id,
      description: m.description,
      part_no: m.partNo,
      make: m.make,
      material_group: m.materialGroup,
      created_at: new Date(m.createdAt).toISOString()
    }));

    try {
      const chunks = [];
      for (let i = 0; i < rows.length; i += BATCH_SIZE) chunks.push(rows.slice(i, i + BATCH_SIZE));
      for (const chunk of chunks) {
        const { error } = await supabase.from('material_master').insert(chunk);
        if (error) throw error;
      }
    } catch (e) {
      console.warn('Supabase bulk insert failed (Materials), synced locally.');
    }

    await dbService.putBatch(STORES.MATERIALS, newItems);
    return newItems;
  },

  async update(material: Material): Promise<void> {
    try {
      await supabase.from('material_master').update({
        description: material.description,
        part_no: material.partNo,
        make: material.make,
        material_group: material.materialGroup
      }).eq('id', material.id);
    } catch (e) { console.warn('Supabase update failed.'); }
    await dbService.putBatch(STORES.MATERIALS, [material]);
  },

  async delete(id: string): Promise<void> {
    try {
      await supabase.from('material_master').delete().eq('id', id);
    } catch (e) { console.warn('Supabase delete failed.'); }
    await dbService.deleteOne(STORES.MATERIALS, id);
  },

  async clearAll(): Promise<void> {
    try {
      await supabase.from('material_master').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch (e) { console.warn('Supabase clear failed.'); }
    await dbService.clearStore(STORES.MATERIALS);
  }
};
