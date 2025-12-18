
import { supabase } from './supabase';
import { Material, MaterialFormData } from '../types';

const LOCAL_STORAGE_KEY = 'material_master_db_v1';

export const materialService = {
  // Fetch all materials
  async getAll(): Promise<Material[]> {
    let dbData: Material[] = [];
    let useLocal = false;

    try {
      const { data, error } = await supabase
        .from('material_master')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase fetch failed (Using Local Storage):', error.message);
        useLocal = true;
      } else {
        dbData = (data || []).map((row: any) => ({
          id: row.id,
          description: row.description,
          partNo: row.part_no,
          make: row.make,
          materialGroup: row.material_group,
          createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
        }));
      }
    } catch (e) {
      console.warn('Supabase connection error (Using Local Storage).');
      useLocal = true;
    }

    if (useLocal) {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY);
        return local ? JSON.parse(local) : [];
    }

    return dbData;
  },

  // Create multiple materials (Bulk Import)
  async createBulk(materials: MaterialFormData[]): Promise<Material[]> {
    const timestamp = Date.now();
    const newItems = materials.map(m => ({
      ...m,
      id: crypto.randomUUID(),
      createdAt: timestamp
    }));

    let success = false;

    try {
        const rows = newItems.map(m => ({
          id: m.id,
          description: m.description,
          part_no: m.partNo,
          make: m.make,
          material_group: m.materialGroup,
          created_at: new Date(m.createdAt).toISOString()
        }));

        const { error } = await supabase.from('material_master').insert(rows);
        if (error) {
            console.error('Supabase insert error:', error.message);
            throw error;
        }
        success = true;
    } catch (e) {
        console.warn('Falling back to local storage for save.');
    }

    // Always save to local storage as backup/fallback
    if (!success) {
        const current = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
        const updated = [...newItems, ...current];
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    }

    return newItems;
  },

  // Update a material
  async update(material: Material): Promise<void> {
    let success = false;
    try {
        const { error } = await supabase
        .from('material_master')
        .update({
            description: material.description,
            part_no: material.partNo,
            make: material.make,
            material_group: material.materialGroup
        })
        .eq('id', material.id);
        
        if (error) throw error;
        success = true;
    } catch (e) {
        console.warn('Falling back to local storage for update.');
    }

    if (!success) {
        const current: Material[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
        const updated = current.map(m => m.id === material.id ? material : m);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    }
  },

  // Delete a material
  async delete(id: string): Promise<void> {
    let success = false;
    try {
        const { error } = await supabase.from('material_master').delete().eq('id', id);
        if (error) throw error;
        success = true;
    } catch (e) {
        console.warn('Falling back to local storage for delete.');
    }

    if (!success) {
        const current: Material[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
        const updated = current.filter(m => m.id !== id);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    }
  }
};
