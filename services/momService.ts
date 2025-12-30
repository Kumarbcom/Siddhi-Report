
import { supabase, isConfigValid } from '../lib/supabaseClient';
import { dbService, STORES } from './db';
import { MOM } from '../types';

const getUuid = () => crypto.randomUUID();

export const momService = {
    async getAll(): Promise<MOM[]> {
        if (isConfigValid) {
            try {
                const { data, error } = await supabase
                    .from('moms')
                    .select('*')
                    .order('date', { ascending: false });

                if (!error && data) {
                    await dbService.putBatch(STORES.MOMS, data);
                    return data;
                }
            } catch (e) {
                console.warn("MOM Sync: Cloud fetch failed, using local.");
            }
        }
        return dbService.getAll<MOM>(STORES.MOMS);
    },

    async save(mom: Omit<MOM, 'id' | 'createdAt'> & { id?: string }): Promise<MOM | null> {
        const timestamp = Date.now();
        const id = mom.id || getUuid();
        const fullMom: MOM = {
            ...mom,
            id,
            createdAt: mom.id ? (mom as MOM).createdAt : timestamp
        };

        if (isConfigValid) {
            try {
                const { error } = await supabase
                    .from('moms')
                    .upsert({
                        id: fullMom.id,
                        title: fullMom.title,
                        date: fullMom.date,
                        attendees: fullMom.attendees,
                        items: fullMom.items,
                        benchmarks: fullMom.benchmarks,
                        created_at: new Date(fullMom.createdAt).toISOString()
                    });

                if (error) console.error('Supabase MOM save error:', error.message);
            } catch (e: any) {
                console.error('MOM cloud save failed:', e.message);
            }
        }

        await dbService.put(STORES.MOMS, fullMom);
        return fullMom;
    },

    async delete(id: string): Promise<void> {
        if (isConfigValid) {
            try {
                const { error } = await supabase
                    .from('moms')
                    .delete()
                    .eq('id', id);
                if (error) console.error('Supabase MOM delete error:', error.message);
            } catch (e: any) {
                console.error('MOM cloud delete failed:', e.message);
            }
        }
        await dbService.delete(STORES.MOMS, id);
    }
};
