# 🔧 DEBUGGING SCRIPT - Card Macet Issue

## 📋 Langkah-Langkah Debug

### Step 1: Console Inspection
Saat Dashboard terbuka di tab Tahunan, buka DevTools (F12) dan jalankan:

```javascript
// Check apakah hook data ada
console.log("macetSummaryYearly data:", window.__debug_macet = macetSummaryYearly);
// Cek di React DevTools atau cari di global

// Lebih mudah: buka React DevTools (extension)
// Cari component Dashboard
// Expand props
// Cari macetSummaryYearly
```

---

### Step 2: Add Debugging to Dashboard.tsx

Sementara untuk diagnosis, kita bisa tambahkan console log. Berikut edit yang bisa dilakukan:

**File:** `src/pages/Dashboard.tsx`

**After line 92** (setelah `useMacetSummaryYearly` initialization), tambahkan:

```typescript
// TEMPORARY DEBUG (remove later)
React.useEffect(() => {
  console.log("=== YEARLY MACET DEBUG ===");
  console.log("Selected Year:", selectedYear);
  console.log("Year range:", format(startOfYear(selectedYear), 'yyyy-MM-dd'), 
                            "to", 
                            format(endOfYear(selectedYear), 'yyyy-MM-dd'));
  console.log("macetSummaryYearly:", macetSummaryYearly);
  console.log("macet_count:", macetSummaryYearly?.macet_count ?? 0);
  console.log("total_outstanding:", macetSummaryYearly?.total_outstanding ?? 0);
  console.log("total_modal_at_risk:", macetSummaryYearly?.total_modal_at_risk ?? 0);
  if (macetSummaryYearly?.contracts) {
    console.log("First macet contract:", macetSummaryYearly.contracts[0]);
  }
}, [macetSummaryYearly, selectedYear]);
```

---

### Step 3: Check Status Calculation

**In Supabase SQL Editor**, run test queries:

```sql
-- Query 1: Check total contracts untuk tahun 2026
SELECT COUNT(*) as total_count,
       COUNT(CASE WHEN status='macet' THEN 1 END) as macet_count_db,
       COUNT(CASE WHEN status='active' THEN 1 END) as active_count,
       COUNT(CASE WHEN status='completed' THEN 1 END) as completed_count,
       COUNT(CASE WHEN status='returned' THEN 1 END) as returned_count
FROM credit_contracts
WHERE DATE(start_date) >= '2026-01-01'
  AND DATE(start_date) <= '2026-12-31';

-- Query 2: List contracts dengan status breakdown
SELECT id, contract_ref, status, start_date, omset, total_loan_amount
FROM credit_contracts
WHERE DATE(start_date) >= '2026-01-01'
  AND DATE(start_date) <= '2026-12-31'
  AND status NOT IN ('returned', 'completed')
LIMIT 10;

-- Query 3: Check unpaid coupons
SELECT cc.id, cc.contract_ref, COUNT(*) as unpaid_count, MIN(ic.due_date) as earliest_due
FROM credit_contracts cc
LEFT JOIN installment_coupons ic ON cc.id = ic.contract_id AND ic.status='unpaid'
WHERE DATE(cc.start_date) >= '2026-01-01'
  AND DATE(cc.start_date) <= '2026-12-31'
GROUP BY cc.id, cc.contract_ref
HAVING COUNT(*) > 0
LIMIT 10;

-- Query 4: Check last payments
SELECT pl.contract_id, cc.contract_ref, MAX(pl.payment_date) as last_payment
FROM payment_logs pl
JOIN credit_contracts cc ON pl.contract_id = cc.id
WHERE DATE(cc.start_date) >= '2026-01-01'
  AND DATE(cc.start_date) <= '2026-12-31'
GROUP BY pl.contract_id, cc.contract_ref
LIMIT 10;
```

---

### Step 4: Manual Status Calculation

Untuk kontrak tertentu, hitung status secara manual:

```typescript
// Untuk contract_id = 'abc123', buka console dan jalankan:

import { 
  determineContractStatus, 
  calculateLateDays, 
  calculateDaysSinceLastPayment 
} from '@/lib/statusCalculation';

// Example: contract dengan
// - earliest_unpaid_due_date: '2026-05-20' (dari query 3)
// - last_payment_date: '2026-04-15' (dari query 4)
// - status: 'active'

const lateDays = calculateLateDays('2026-05-20');
const daysSinceLastPayment = calculateDaysSinceLastPayment('2026-04-15');

console.log("lateDays:", lateDays);                          // Expected: +10 jika hari ini 5/30
console.log("daysSinceLastPayment:", daysSinceLastPayment); // Expected: +45

const status = determineContractStatus({
  status: 'active',
  lateDays,
  daysSinceLastPayment,
  createdAt: '2024-01-01'
});

console.log("Calculated status:", status); // Should be 'macet' if rules met
```

---

## 🎯 Possible Issues & Solutions

### Issue A: macetSummaryYearly.macet_count = 0

**Possible Causes:**
1. No contracts dalam tahun 2026 dengan status 'macet'
2. All contracts sudah 'completed' or 'returned'
3. Status calculation logic tidak classify kontrak sebagai 'macet'

**Solution:**
- Run Query 1 & 2 di atas
- Check jika ada kontrak non-returned dalam range
- Jika ada, manually calc status untuk 1 kontrak (Step 4)

### Issue B: macetSummaryYearly = undefined

**Possible Causes:**
1. Hook belum selesai loading (still pending)
2. Error dalam query (exception throw di fetchMacet)
3. Network/CORS issue

**Solution:**
- Check React DevTools: apakah hook statusnya "loading", "success", atau "error"?
- Check Network tab di browser: apakah ada error response?
- Check console: ada error messages?

### Issue C: Data ada tapi tidak di-display

**Possible Causes:**
1. StatCard component error
2. Value formatting issue
3. conditional rendering menutup card

**Solution:**
- Check apakah StatCard component receive props with correct value
- Check console untuk React error boundaries
- Verify value type (number, not NaN)

---

## 🧪 Test Case: Force Data untuk Verify Display

Jika debugging menunjukkan query berfungsi tapi display bermasalah, bisa test dengan hard-coded data:

**Temporary Edit di Dashboard.tsx (after line 92):**

```typescript
// TEMPORARY: Override dengan mock data untuk test display
const mockMacetData = {
  macet_count: 5,
  total_outstanding: 100000000,
  total_modal_at_risk: 50000000,
  contracts: [],
  by_sales: []
};

// Uncomment untuk test:
// const macetSummaryYearly = mockMacetData;
```

Jika dengan mock data card menampilkan dengan benar, berarti:
- ✅ UI/display OK
- ❌ Masalah di data fetching

---

## 📊 Expected Results

Jika semua berfungsi normal:

```javascript
// Console output seharusnya:
=== YEARLY MACET DEBUG ===
Selected Year: Sun Jan 01 2026 00:00:00 GMT+0700
Year range: 2026-01-01 to 2026-12-31
macetSummaryYearly: {
  macet_count: 3,
  total_outstanding: 250000000,
  total_modal_at_risk: 100000000,
  contracts: [ ... ],
  by_sales: [ ... ]
}
macet_count: 3
total_outstanding: 250000000
total_modal_at_risk: 100000000
```

Dan card di UI harus menampilkan:
```
🚫 Macet
Rp 250.000.000
3 kontrak macet tahun 2026
```

---

## ✅ Checklist

- [ ] Buka DevTools Console
- [ ] Screenshot output dari Step 1
- [ ] Jalankan Query 1 & 2 di Supabase
- [ ] Catat hasilnya
- [ ] Report finding ke aku dengan detail

---

**Once you provide debug output, I can identify exact issue dan provide targeted fix!**
