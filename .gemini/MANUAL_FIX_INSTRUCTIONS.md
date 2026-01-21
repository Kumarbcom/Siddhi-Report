# Manual Fix Instructions for Customer Tab

## Problem
- Customer Analysis tab exists but is empty
- Customer categorization is still showing in Sales tab
- Need to move it to the Customer Analysis tab

## Solution - Manual Steps

### Step 1: Find the Customer Categorization Section in Sales Tab
**Location**: Around line 1979-2099 in `components/DashboardView.tsx`

**Starts with**:
```tsx
{/* Customer Categorization Section */}
<div className="bg-gradient-to-br from-purple-50 to-blue-50...
```

**Ends with** (before inventory section):
```tsx
                            </div>
                        </div>
                    ) : activeSubTab === 'inventory' ? (
```

### Step 2: CUT this entire section (lines ~1979-2099)

### Step 3: Find where to INSERT it
**Location**: Around line 3332 in `components/DashboardView.tsx`

**Look for**:
```tsx
                        </div>
                    ) : null}
```

### Step 4: PASTE the customer section BEFORE `) : null}`

**Should look like**:
```tsx
                        </div>
                    ) : activeSubTab === 'customer' ? (
                        <div className="flex flex-col gap-4">
                            {/* Customer Categorization Section */}
                            <div className="bg-gradient-to-br from-purple-50 to-blue-50...
                            ... [all the customer categorization UI] ...
                            </div>
                        </div>
                    ) : null}
```

## Alternative: Use the Pre-made File

I've created the complete customer tab section in:
`.gemini/customer_tab_section.tsx`

You can copy the content from that file and paste it at line 3332 (before `) : null}`)

## After Making Changes

1. Save the file
2. Test in browser - click on "Customer Analysis" tab
3. Verify customer data shows in Customer tab
4. Verify customer section is removed from Sales tab
5. Commit and push:
   ```
   git add components/DashboardView.tsx
   git commit -m "Move customer categorization to Customer Analysis tab"
   git push
   ```

## Quick Test
After making changes, the tabs should work like this:
- **Sales Tab**: Shows sales metrics, charts, top customers (NO customer categorization section)
- **Customer Analysis Tab**: Shows ONLY customer categorization (Repeat/Rebuild/New analysis)

## File References
- Main file: `components/DashboardView.tsx`
- Customer tab code: `.gemini/customer_tab_section.tsx`
- Update script (if you want to try): `.gemini/update_dashboard.py`
