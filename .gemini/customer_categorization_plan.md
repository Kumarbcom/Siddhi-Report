# Customer Categorization Implementation Plan

## Overview
Add customer categorization analysis to the Dashboard that:
1. Shows distinct customer count by Customer Group
2. Categorizes customers as Repeat, Rebuild, or New based on sales history
3. Displays detailed sales table with YTD comparisons
4. Normalizes customer names (treats names with "(" as same ledger)

## Customer Categories

### Repeat Customer
- Has sales in BOTH FY 2023-24 AND FY 2024-25
- Indicates consistent, ongoing business

### Rebuild Customer  
- Has sales in FY 2023-24
- NO sales in FY 2024-25
- Has sales in FY 2025-26
- Indicates re-engaged customer

### New Customer
- NO sales in FY 2023-24
- NO sales in FY 2024-25  
- Has sales ONLY in FY 2025-26
- Indicates brand new customer

## Customer Name Normalization
- If customer name contains "(" anywhere, treat everything before "(" as the normalized name
- Example: "ABC Company (Old)" and "ABC Company (New)" both become "ABC Company"
- This consolidates sales under a single ledger

## Data to Display

### Summary Cards
- Total Repeat Customers count
- Total Rebuild Customers count
- Total New Customers count
- Group-wise breakdown

### Detailed Table
Columns:
- Customer Group
- Customer Name (normalized)
- FY 2023-24: Qty, Sales Value
- FY 2024-25: Qty, Sales Value
- FY 2025-26: Qty, Sales Value
- YTD Comparison: Current YTD vs Previous YTD (same period)
- YTD Growth %

## Implementation Steps
1. Add helper function for customer name normalization
2. Add customerCategorization useMemo hook
3. Add UI components for summary cards
4. Add detailed table with sorting and filtering
5. Add export functionality

## Files to Modify
- components/DashboardView.tsx
