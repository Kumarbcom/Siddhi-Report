-- Table: customer_sales_analysis

CREATE TABLE IF NOT EXISTS customer_sales_analysis (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_name TEXT NOT NULL,
    group_name TEXT,
    category TEXT CHECK (category IN ('Repeat', 'New', 'Rebuild', 'Lost')),
    
    -- Financial Year 23-24
    fy_23_24_qty NUMERIC DEFAULT 0,
    fy_23_24_val NUMERIC DEFAULT 0,
    
    -- Financial Year 24-25
    fy_24_25_qty NUMERIC DEFAULT 0,
    fy_24_25_val NUMERIC DEFAULT 0,
    
    -- Financial Year 25-26 (Current)
    fy_25_26_qty NUMERIC DEFAULT 0,
    fy_25_26_val NUMERIC DEFAULT 0,
    
    -- Calculated Metrics
    ytd_growth_percentage NUMERIC GENERATED ALWAYS AS (
        CASE 
            WHEN fy_24_25_val = 0 THEN 0 
            ELSE ((fy_25_26_val - fy_24_25_val) / fy_24_25_val) * 100 
        END
    ) STORED,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_customer_analysis_category ON customer_sales_analysis(category);
CREATE INDEX idx_customer_analysis_group ON customer_sales_analysis(group_name);
CREATE INDEX idx_customer_analysis_name ON customer_sales_analysis(customer_name);
CREATE INDEX idx_customer_analysis_growth ON customer_sales_analysis(ytd_growth_percentage);

-- Enable Row Level Security
ALTER TABLE customer_sales_analysis ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for authenticated users" ON customer_sales_analysis
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable write access for admin users" ON customer_sales_analysis
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
