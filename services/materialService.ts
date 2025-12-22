
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

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        materialCode: row.material_code || '',
        description: row.description || '',
        partNo: row.part_no || '',
        make: row.make || '',
        materialGroup: row.material_group || '',
        uom: row.uom || '',
        unitWeight: row.unit_weight || '',
        hsnCode: row.hsn_code || '',
        createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
      }));
    } catch (e: any) {
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
          uom: m.uom,
          unit_weight: m.unitWeight,
          hsn_code: m.hsnCode,
          created_at: new Date(m.createdAt).toISOString()
        }));
        await supabase.from('material_master').insert(rows);
    } catch (e: any) {}

    const current = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...newItems, ...current]));
    return newItems;
  },

  async update(material: Material): Promise<void> {
    try {
        await supabase.from('material_master').update({
            material_code: material.materialCode,
            description: material.description,
            part_no: material.partNo,
            make: material.make,
            material_group: material.materialGroup,
            uom: material.uom,
            unit_weight: material.unitWeight,
            hsn_code: material.hsnCode
        }).eq('id', material.id);
    } catch (e: any) {}
    const current: Material[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    const updated = current.map(m => m.id === material.id ? material : m);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  },

  async delete(id: string): Promise<void> {
    try { await supabase.from('material_master').delete().eq('id', id); } catch (e: any) {}
    const current: Material[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current.filter(m => m.id !== id)));
  },

  async clearAll(): Promise<void> {
    try { await supabase.from('material_master').delete().neq('id', '00000000-0000-0000-0000-000000000000'); } catch (e: any) {}
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
};
