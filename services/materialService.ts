
import { supabase } from './supabase';
import { Material, MaterialFormData } from '../types';

/**
 * SQL SCHEMA FOR material_master TABLE:
 * 
 * CREATE TABLE material_master (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   material_code TEXT,
 *   description TEXT NOT NULL,
 *   part_no TEXT,
 *   make TEXT,
 *   material_group TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * UNIQUE CONSTRAINT (Optional but recommended):
 * CREATE UNIQUE INDEX idx_material_code ON material_master(material_code);
 */

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
          materialCode: row.material_code || '',
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
        if (error) {
            console.error('Supabase insert error:', error.message);
            throw error;
        }
    } catch (e) {
        console.warn('Supabase save failed, backup handled in App state.');
    }

    // Always save to local storage as backup/fallback
    const current = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    const updated = [...newItems, ...current];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));

    return newItems;
  },

  // Update a material
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
    } catch (e) {
        console.warn('Supabase update failed.');
    }

    const current: Material[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    const updated = current.map(m => m.id === material.id ? material : m);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  },

  // Delete a material
  async delete(id: string): Promise<void> {
    try {
        const { error } = await supabase.from('material_master').delete().eq('id', id);
        if (error) throw error;
    } catch (e) {
        console.warn('Supabase delete failed.');
    }

    const current: Material[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    const updated = current.filter(m => m.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  }
};
