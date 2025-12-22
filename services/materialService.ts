
import { supabase } from './supabase';
import { Material, MaterialFormData } from '../types';

/**
 * DATABASE SCHEMA (SQL) - Run this in Supabase SQL Editor:
 * 
 * CREATE TABLE material_master (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   material_code TEXT,
 *   description TEXT NOT NULL,
 *   part_no TEXT,
 *   make TEXT,
 *   material_group TEXT,
 *   created_at TIMESTAMPTZ DEFAULT now()
 * );
 * 
 * -- Enable Row Level Security (RLS)
 * ALTER TABLE material_master ENABLE ROW LEVEL SECURITY;
 * 
 * -- Create a policy for public access (or update for authenticated users)
 * CREATE POLICY "Allow public full access" ON material_master FOR ALL USING (true);
 */

const LOCAL_STORAGE_KEY = 'material_master_db_v1';

export const materialService = {
  async getAll(): Promise<Material[]> {
    try {
      const { data, error } = await supabase
        .from('material_master')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
          if (error.code === 'PGRST116' || error.message.includes('relation "material_master" does not exist')) {
              console.error('DATABASE LINK ERROR: The table "material_master" was not found in your Supabase database. Please run the SQL setup script.');
          }
          throw error;
      }

      console.log(`Supabase Linked: Fetched ${data?.length || 0} Material records.`);

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
      console.warn('LINKING FAILED: Using Local Browser Storage fallback.', e.message || e);
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
        
        console.log(`Supabase Success: Synced ${rows.length} materials.`);
    } catch (e: any) {
        console.error('SUPABASE SYNC ERROR: Data was saved to Local Storage ONLY.', e.message || e);
    }

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
      const { error } = await supabase
        .from('material_master')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
    } catch (e: any) {
      console.error('Supabase clearAll failed:', e.message);
    }
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
};
