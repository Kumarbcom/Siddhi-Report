import { createClient } from '@supabase/supabase-js';

/**
 * DATABASE SETUP SQL - Run this in your Supabase SQL Editor to "create database also":
 * 
 * -- 1. Material Master
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
 * -- 2. Customer Master
 * CREATE TABLE customer_master (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   customer_name TEXT NOT NULL,
 *   group_name TEXT,
 *   sales_rep TEXT,
 *   status TEXT,
 *   customer_group TEXT,
 *   created_at TIMESTAMPTZ DEFAULT now()
 * );
 * 
 * -- 3. Closing Stock
 * CREATE TABLE closing_stock (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   description TEXT NOT NULL,
 *   quantity NUMERIC DEFAULT 0,
 *   rate NUMERIC DEFAULT 0,
 *   value NUMERIC DEFAULT 0,
 *   created_at TIMESTAMPTZ DEFAULT now()
 * );
 * 
 * -- 4. Pending Sales Orders
 * CREATE TABLE pending_sales_orders (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   date TEXT,
 *   order_no TEXT,
 *   party_name TEXT,
 *   item_name TEXT,
 *   material_code TEXT,
 *   part_no TEXT,
 *   ordered_qty NUMERIC DEFAULT 0,
 *   balance_qty NUMERIC DEFAULT 0,
 *   rate NUMERIC DEFAULT 0,
 *   discount NUMERIC DEFAULT 0,
 *   value NUMERIC DEFAULT 0,
 *   due_on TEXT,
 *   overdue_days NUMERIC DEFAULT 0,
 *   created_at TIMESTAMPTZ DEFAULT now()
 * );
 * 
 * -- 5. Pending Purchase Orders
 * CREATE TABLE pending_purchase_orders (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   date TEXT,
 *   order_no TEXT,
 *   party_name TEXT,
 *   item_name TEXT,
 *   material_code TEXT,
 *   part_no TEXT,
 *   ordered_qty NUMERIC DEFAULT 0,
 *   balance_qty NUMERIC DEFAULT 0,
 *   rate NUMERIC DEFAULT 0,
 *   discount NUMERIC DEFAULT 0,
 *   value NUMERIC DEFAULT 0,
 *   due_on TEXT,
 *   overdue_days NUMERIC DEFAULT 0,
 *   created_at TIMESTAMPTZ DEFAULT now()
 * );
 * 
 * -- 6. Sales Report
 * CREATE TABLE sales_report (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   date TEXT,
 *   customer_name TEXT,
 *   particulars TEXT,
 *   consignee TEXT,
 *   voucher_no TEXT,
 *   voucher_ref_no TEXT,
 *   quantity NUMERIC DEFAULT 0,
 *   value NUMERIC DEFAULT 0,
 *   created_at TIMESTAMPTZ DEFAULT now()
 * );
 * 
 * -- 7. Enable RLS and Create Public Access Policies
 * ALTER TABLE material_master ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Allow public full access material" ON material_master FOR ALL USING (true);
 * 
 * ALTER TABLE customer_master ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Allow public full access customer" ON customer_master FOR ALL USING (true);
 * 
 * ALTER TABLE closing_stock ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Allow public full access stock" ON closing_stock FOR ALL USING (true);
 * 
 * ALTER TABLE pending_sales_orders ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Allow public full access so" ON pending_sales_orders FOR ALL USING (true);
 * 
 * ALTER TABLE pending_purchase_orders ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Allow public full access po" ON pending_purchase_orders FOR ALL USING (true);
 * 
 * ALTER TABLE sales_report ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Allow public full access sales" ON sales_report FOR ALL USING (true);
 */

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn("SUPABASE WARNING: SUPABASE_URL or SUPABASE_KEY is missing. Ensure they are configured in the environment.");
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co', 
  supabaseKey || 'placeholder-key'
);