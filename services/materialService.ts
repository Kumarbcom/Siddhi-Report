
import { supabase } from './supabase';
import { Material, MaterialFormData } from '../types';

const LOCAL_STORAGE_KEY = 'material_master_db_v1';

export const materialService = {
  async getAll(): Promise<Material[]> {
    try {
      const { data, error } = await supabase
        .from('material_master')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
          if (error.code === 'PGRST116' || error.message.includes('not found')) {
              console.error('DATABASE ERROR: The table "material_master" does not exist in your Supabase project. Please run the SQL setup script.');
          }
          throw error;
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        materialCode: row.material_code || '',
        description: row.description || '',
        partNo: row.part_no || '',
        make: row.make || '',
        materialGroup: row.material_group || '',
        createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
      }));
    } catch (e: any) {
      console.warn('Supabase fetch failed (Material Master). Falling back to local storage.', e.message || e);
      const local = localStorage.getItem(LOCAL_STORAGE_KEY);
      return local ? JSON.parse(local) : [];
    }
  },

  async createBulk(materials: MaterialFormData[]): Promise<Material[]> {
    const timestamp = Date.now();
    const newItems = materials.map(m => ({
      ...m,
      id: crypto.randomUUID(),
      createdAt: timestamp
    }));

    try {
        const rows = newItems.map(m => ({
          id: m.id,
          material_code: m.materialCode,
          description: m.description,
          part_no: m.partNo,
          make: m.make,
          material_group: m.materialGroup,
          created_at: new Date(m.createdAt).toISOString()
        }));

        const { error } = await supabase.from('material_master').insert(rows);
        if (error) throw error;
        console.log(`Successfully synced ${rows.length} materials to Supabase.`);
    } catch (e: any) {
        console.error('Supabase insert failed (Material Master).', e.message || e);
    }

    // Always update local cache for offline/instant feedback
    const current = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...newItems, ...current]));
    return newItems;
  },

  async update(material: Material): Promise<void> {
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
    } catch (e: any) {
        console.warn('Supabase update failed.', e.message || e);
    }

    const current: Material[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    const updated = current.map(m => m.id === material.id ? material : m);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  },

  async delete(id: string): Promise<void> {
    try {
        const { error } = await supabase.from('material_master').delete().eq('id', id);
        if (error) throw error;
    } catch (e: any) {
        console.warn('Supabase delete failed.', e.message || e);
    }

    const current: Material[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    const updated = current.filter(m => m.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  },

  async clearAll(): Promise<void> {
    try {
      // Use .neq with a dummy UUID to delete everything
      const { error } = await supabase
        .from('material_master')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      console.log('Supabase Material Master cleared.');
    } catch (e: any) {
      console.error('Supabase clearAll failed (Material Master):', e.message);
    }
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
};
