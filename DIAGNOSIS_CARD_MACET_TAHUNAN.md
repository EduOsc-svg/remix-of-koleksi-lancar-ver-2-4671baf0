# 🔍 DIAGNOSIS - Card Macet Dashboard Tahunan Tidak Berfungsi

**Date:** 2026-06-05  
**Issue:** Card "Macet" di tab Tahunan tidak menampilkan data atau tidak responsif  
**Status:** Investigasi

---

## 📍 Lokasi Card

- **File:** `src/pages/Dashboard.tsx` line 827
- **Tab:** KEUNTUNGAN → Tahunan (yearly view)
- **Hook:** `useMacetSummaryYearly(selectedYear)`
- **Data Hook File:** `src/hooks/useMacetSummary.ts`

---

## 🔧 Implementasi Saat Ini

### Card Component (Dashboard.tsx line 827-835)
```typescript
<StatCard
  icon={Ban}
  iconColor="text-rose-500"
  label="Macet"
  value={macetSummaryYearly?.total_outstanding ?? 0}
  valueColor="text-rose-600"
  isNegative
  subtitle={`${macetSummaryYearly?.macet_count ?? 0} kontrak macet tahun ${selectedYear.getFullYear()}`}
  hoverInfo={`...detail...`}
  onDetailClick={() => { setMacetDetailScope('yearly'); setMacetDetailOpen(true); }}
/>
```

### Data Source (useMacetSummaryYearly)
```typescript
export const useMacetSummaryYearly = (year: Date = new Date()) => {
  const s = format(startOfYear(year), 'yyyy-MM-dd');
  const e = format(endOfYear(year), 'yyyy-MM-dd');
  return useQuery({
    queryKey: ['macet_summary_yearly', s, e],
    queryFn: () => fetchMacet(s, e),
  });
};
```

### Fetch Logic (fetchMacet function)
```typescript
const fetchMacet = async (rangeStart: string, rangeEnd: string): Promise<MacetSummary> => {
  // 1. Query contracts dengan filter:
  //    - NOT status='returned'
  //    - NOT status='completed'
  //    - start_date >= rangeStart && start_date <= rangeEnd
  
  // 2. Real-time calculation:
  //    - Get earliest unpaid coupon per contract
  //    - Get latest payment per contract
  
  // 3. Determine status menggunakan determineContractStatus()
  //    - Filter hanya yang status = 'macet'
  
  // 4. Hitung sisa tagihan (total_loan_amount - paid)
  
  // 5. Return MacetSummary
};
```

---

## 🚨 Kemungkinan Masalah

### Issue 1: **Status Calculation Logic Error**
**Location:** `src/lib/statusCalculation.ts` → `determineContractStatus()`

**Symptom:** `status === 'macet'` filter pada line 93 menghasilkan 0 kontrak

**Debug:**
```typescript
// Di console atau logs, cek:
console.log("macetSummaryYearly?.macet_count:", macetSummaryYearly?.macet_count);
// Jika = 0, berarti tidak ada kontrak yang ter-filter sebagai 'macet'
```

**Root Cause Candidates:**
- Logika di `determineContractStatus()` salah mengklasifikasi status
- `lateDays` atau `daysSinceLastPayment` calculation error
- `created_at` filter tidak sesuai ekspektasi

---

### Issue 2: **Data Not Loading (Query Failed)**
**Symptom:** `macetSummaryYearly` = undefined atau error di console

**Debug:**
```javascript
// Buka DevTools → Network tab
// Cari request untuk 'macet_summary_yearly'
// - Status 200? atau error?
// - Response ada data?

// Console → check error logs
// Ada warning/error dari TanStack Query?
```

---

### Issue 3: **Date Range Issue**
**Symptom:** Query jalan tapi hasilnya 0

**Debug:**
```typescript
// selectedYear tidak proper formatted
const s = format(startOfYear(year), 'yyyy-MM-dd');
const e = format(endOfYear(year), 'yyyy-MM-dd');
console.log("Query range:", s, "to", e);
// Expected: "2026-01-01" to "2026-12-31"

// Cek apakah ada kontrak dengan start_date dalam range ini
// Query test di Supabase:
// SELECT COUNT(*) FROM credit_contracts 
// WHERE start_date >= '2026-01-01' AND start_date <= '2026-12-31'
```

---

### Issue 4: **Data Dependency Missing**
**Symptom:** Hook tidak ada data (maupun data kosong)

**Dependencies untuk `fetchMacet()`:**
- ✓ Table: `credit_contracts`
- ✓ Table: `installment_coupons`
- ✓ Table: `payment_logs`
- ✓ Function: `determineContractStatus()`
- ✓ Function: `calculateLateDays()`
- ✓ Function: `calculateDaysSinceLastPayment()`

**Cek:**
- Apakah fungsi status calculation sudah di-update (dari mana status ini di-derive)?
- Apakah `determineContractStatus()` return value include 'macet'?

---

## 🔧 Quick Diagnostic Steps

### Step 1: Check Console untuk Error
```javascript
// Open DevTools (F12)
// Buka Console tab
// Refresh page
// Cari warning/error messages berkaitan "macet" atau "status"
```

### Step 2: Check Data Loading
```javascript
// Di React DevTools atau console:
// Cari useState macetDetailOpen, macetDetailScope
// Cek apakah macetSummaryYearly loading/error status

// Print ke console:
console.log("macetSummaryYearly:", macetSummaryYearly);
// Expected: { macet_count: X, total_outstanding: Y, ... }
// Actual: undefined? error? empty?
```

### Step 3: Verify Status Calculation
```typescript
// Buka src/lib/statusCalculation.ts
// Check function determineContractStatus()
// Does it have case/return for 'macet'?

// Example: should have something like:
if (lateDays > X) return 'macet';
```

### Step 4: Test Query Directly
```sql
-- Buka Supabase SQL Editor
-- Test query untuk year 2026:
SELECT COUNT(*) as total_contracts,
       COUNT(CASE WHEN status='macet' THEN 1 END) as macet_count
FROM credit_contracts
WHERE start_date >= '2026-01-01' 
  AND start_date <= '2026-12-31'
  AND status NOT IN ('returned', 'completed');
```

---

## 📊 Possible Root Causes (Ranking)

| Priority | Issue | Probability | Impact |
|----------|-------|-------------|--------|
| 🔴 HIGH | `determineContractStatus()` logic returns no 'macet' status | 60% | No data shown |
| 🔴 HIGH | Query filters too strict (wrong date range or status filter) | 25% | No data shown |
| 🟡 MEDIUM | `calculateLateDays()` or `calculateDaysSinceLastPayment()` error | 10% | Wrong classification |
| 🟡 MEDIUM | Hook not properly integrated with Dashboard state | 3% | Stale/missing data |
| 🟢 LOW | UI rendering error (though card structure looks OK) | 2% | Visible but wrong format |

---

## ✅ Verification Checklist

- [ ] **Console Check** - No errors when card loads?
- [ ] **Data Check** - `macetSummaryYearly` returns actual object (not undefined)?
- [ ] **Count Check** - `macet_count > 0` or always 0?
- [ ] **Query Check** - SQL test returns expected contract count?
- [ ] **Status Function** - `determineContractStatus()` includes 'macet' case?
- [ ] **Logs** - Any warning messages in console about status calculation?

---

## 🔧 Recommended Next Actions

1. **IMMEDIATE:** Check console for errors (Step 2 above)
2. **IMMEDIATE:** Test if `macetSummaryYearly?.macet_count > 0` (add console.log)
3. **IF ZERO:** Verify status calculation logic in `statusCalculation.ts`
4. **IF UNDEFINED:** Check network tab for query errors
5. **IF OK:** Check UI rendering (StatCard component)

---

## 📋 Files to Review

1. **`src/pages/Dashboard.tsx`** - Line 827 card definition
2. **`src/hooks/useMacetSummary.ts`** - Data fetching & aggregation
3. **`src/lib/statusCalculation.ts`** - Status determination logic
4. **`src/components/dashboard/MacetDetailDialog.tsx`** - Detail dialog

---

**Next Step:** Run diagnostic checks above and report findings. Saya siap untuk debug lebih detail setelah tau hasil investigasi Anda!
