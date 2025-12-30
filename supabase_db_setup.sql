-- Superbase Database Setup for Siddhi Report
-- Run this script in your Supabase SQL Editor

-- 1. Create 'moms' table (Stores MOM records and Weekly Report Benchmarks)
create table if not exists moms (
  id uuid primary key default gen_random_uuid(),
  title text,
  date timestamptz,
  attendees jsonb, -- Array of Attendee IDs
  items jsonb, -- Array of MOM Item objects (Agenda, Discussion, etc.)
  benchmarks jsonb, -- Weekly Report Data (e.g. Sales, Stock, PO/SO stats)
  created_at timestamptz default now()
);

-- 2. Create 'attendees' table (Master data for meeting attendees)
create table if not exists attendees (
  id uuid primary key default gen_random_uuid(),
  name text,
  designation text,
  image_url text, -- Use snake_case for DB columns
  created_at timestamptz default now()
);

-- 3. Enable Row Level Security (RLS)
alter table moms enable row level security;
alter table attendees enable row level security;

-- 4. Create Policies for Public Access (Adjust as needed for security)

-- Allow full access to 'moms' for anyone with the API Key
create policy "Enable all access for all users on moms"
on moms for all
using (true)
with check (true);

-- Allow full access to 'attendees' for anyone with the API Key
create policy "Enable all access for all users on attendees"
on attendees for all
using (true)
with check (true);

-- Optional: Create bucket for helper images if needed (not strictly required for text data)
-- insert into storage.buckets (id, name, public) values ('images', 'images', true);
-- create policy "Public Access" on storage.objects for all using ( bucket_id = 'images' ); 
