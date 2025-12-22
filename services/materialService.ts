
import { supabase, isConfigured } from './supabase';
import { Material, MaterialFormData } from '../types';

const LOCAL_STORAGE_KEY = 'material_master_db_v1';

export const materialService = {
  async getAll(): Promise<Material[]> {
    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from('material_master')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          const mappedData = data.map((row: any) => ({
            id: row.id,
            materialCode: row.material_code || '',
            description: row.description || '',
            partNo: row.part_no || '',
            make: row.make || '',
            materialGroup: row.material_group || '',
            createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
          }));
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mappedData));
          return mappedData;
        }
        if (error) console.error('Supabase fetch error:', error.message);
      } catch (e) {
        console.error('Supabase network error (TypeError likely):', e);
      }
    }

    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    return local ? JSON.parse(local) : [];
  },

  async createBulk(materials: MaterialFormData[]): Promise<Material[]> {
    const timestamp = Date.now();
    const rows = materials.map(m => ({
      material_code: m.materialCode,
      description: m.description,
      part_no: m.partNo,
      make: m.make,
      material_group: m.materialGroup
    }));

    if (isConfigured) {
      try {
        const { data, error } = await supabase.from('material_master').insert(rows).select();
        if (!error && data) {
          const newItems = data.map((row: any) => ({
            id: row.id,
            materialCode: row.material_code,
            description: row.description,
            partNo: row.part_no,
            make: row.make,
            materialGroup: row.material_group,
            createdAt: new Date(row.created_at).getTime()
          }));
          const current = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...newItems, ...current]));
          return newItems;
        }
        throw new Error(error?.message || 'Unknown database error');
      } catch (e: any) {
        console.error('Supabase Insert Error:', e.message);
        // Fallback to local only logic if requested
      }
    }

    // Local Fallback
    const newItems = materials.map(m => ({ ...m, id: crypto.randomUUID(), createdAt: timestamp }));
    const current = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...newItems, ...current]));
    return newItems;
  },

  async update(material: Material): Promise<void> {
    if (isConfigured) {
      try {
        const { error } = await supabase
          .from('material_master')
          .update({
            material_code: material.materialCode,
            description: material.description,
            part_no: material.partNo,
            make: material.make,
            material_group: material.materialGroup
          })
          .eq('id', material.id);
        if (error) throw error;
      } catch (e) {
        console.error('Update failed:', e);
      }
    }

    const current: Material[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    const updated = current.map(m => m.id === material.id ? material : m);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  },

  async delete(id: string): Promise<void> {
    if (isConfigured) {
      try {
        const { error } = await supabase.from('material_master').delete().eq('id', id);
        if (error) throw error;
      } catch (e) {
        console.error('Delete failed:', e);
      }
    }

    const current: Material[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current.filter(m => m.id !== id)));
  },

  async clearAll(): Promise<void> {
    if (isConfigured) {
      try {
        await supabase.from('material_master').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (e) {
        console.error('Clear failed:', e);
      }
    }
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
};
