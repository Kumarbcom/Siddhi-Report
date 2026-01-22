import { supabase } from './supabase';

export interface CustomerAnalysisRecord {
    id: string;
    customer_name: string;
    group_name: string;
    category: 'Repeat' | 'New' | 'Rebuild' | 'Lost';
    fy_23_24_qty: number;
    fy_23_24_val: number;
    fy_24_25_qty: number;
    fy_24_25_val: number;
    fy_25_26_qty: number;
    fy_25_26_val: number;
    ytd_growth_percentage: number;
}

export interface CustomerAnalysisParams {
    page?: number;
    pageSize?: number;
    sortBy?: keyof CustomerAnalysisRecord;
    sortDesc?: boolean;
    category?: string;
    group?: string;
    search?: string;
    growthFilter?: 'POSITIVE' | 'NEGATIVE' | 'ALL';
}

export const customerAnalysisService = {
    async fetchAnalysis(params: CustomerAnalysisParams) {
        let query = supabase
            .from('customer_sales_analysis')
            .select('*', { count: 'exact' });

        // Filtering
        if (params.category && params.category !== 'ALL') {
            query = query.eq('category', params.category);
        }

        if (params.group && params.group !== 'ALL') {
            query = query.eq('group_name', params.group);
        }

        if (params.search) {
            query = query.or(`customer_name.ilike.%${params.search}%,group_name.ilike.%${params.search}%`);
        }

        if (params.growthFilter) {
            if (params.growthFilter === 'POSITIVE') {
                query = query.gte('ytd_growth_percentage', 0);
            } else if (params.growthFilter === 'NEGATIVE') {
                query = query.lt('ytd_growth_percentage', 0);
            }
        }

        // Sorting
        const sortField = params.sortBy || 'fy_25_26_val';
        query = query.order(sortField, { ascending: !params.sortDesc });

        // Pagination
        const page = params.page || 0;
        const pageSize = params.pageSize || 10;
        const from = page * pageSize;
        const to = from + pageSize - 1;

        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) {
            console.error('Error fetching customer analysis:', error);
            throw error;
        }

        return { data: data as CustomerAnalysisRecord[], count };
    },

    async getGroups() {
        const { data, error } = await supabase
            .from('customer_sales_analysis')
            .select('group_name')
            .not('group_name', 'is', null);

        if (error) throw error;
        // Return unique groups
        return [...new Set(data.map(item => item.group_name))];
    }
};
