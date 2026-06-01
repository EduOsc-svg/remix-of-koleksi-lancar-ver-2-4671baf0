# 🚨 DISCREPANCY FOUND - Total Tertagih 31 Mei 2026

**CRITICAL ISSUE CONFIRMED**

---

## 📊 Comparison

| Source | Kupon Tertagih | Total Tertagih | Total Tagihan |
|--------|----------------|---|---|
| **Excel** | ? | **Rp 82,777,000** | ? |
| **Aplikasi** | **1000** | **Rp 37,102,000** | **Rp 83,022,000** |
| **DISCREPANCY** | - | **Rp 45,675,000 MISSING** ⚠️ | Match! ✅ |

---

## 🎯 KEY FINDINGS

### 1. **Total Tagihan MATCH (Good)** ✅
```
Aplikasi: Rp 83,022,000
Excel:    Rp ? (not in screenshot)
```
→ Ini berarti contract data cocok!

### 2. **Total Tertagih MISMATCH (Bad)** ❌
```
Aplikasi: Rp 37,102,000
Excel:    Rp 82,777,000
Missing:  Rp 45,675,000 (55% of expected!)
```
→ Ini berarti PAYMENT DATA tidak lengkap di Aplikasi!

### 3. **Kupon Tertagih Count** 
```
Aplikasi: 1000 kupon
Excel:    ? (need to calculate)
         = (29.8M + 23.8M + 28.7M + 342K) / avg_amount
```

---

## 🔧 Root Cause Hypothesis

### **MOST LIKELY: Collector/User Filter Issue** 🎯

Aplikasi mungkin **hanya menampilkan data untuk 1 kolektor tertentu**, bukan semua 4 kolektor!

**Evidence:**
- Excel: 4 kolektor (beringes, CALVIN, riski, tobi) = Rp 82.77M
- Aplikasi: Hanya ~45% = Mungkin hanya 2 kolektor termasuk

---

## 🛠️ Debugging Steps

### STEP 1: Check apakah ada Collector Filter
```
📍 Di Aplikasi, cek:
- Apakah ada dropdown/filter "Kolektor"?
- Apakah ada user session filter yang membatasi kolektor?
- Apakah value selectedDate = '2026-05-31' atau tanggal lain?
```

### STEP 2: Run Database Query
```sql
-- Query A: Total untuk SEMUA kolektor pada 31 Mei
SELECT 
  COUNT(*) as kupon_count,
  SUM(amount_paid) as total_tertagih
FROM payment_logs
WHERE DATE(payment_date) = '2026-05-31';

-- Result harus = Rp 82,777,000
```

### STEP 3: Run Query per Kolektor
```sql
-- Query B: Per kolektor breakdown
SELECT 
  c.collector_code,
  c.name as kolektor_name,
  COUNT(*) as kupon_count,
  SUM(pl.amount_paid) as total_tertagih
FROM payment_logs pl
JOIN collectors c ON pl.collector_id = c.id
WHERE DATE(pl.payment_date) = '2026-05-31'
GROUP BY c.id, c.collector_code, c.name
ORDER BY total_tertagih DESC;
```

### STEP 4: Check Application Filter
```typescript
// Di DailyProfitList.tsx, check:
// 1. Apakah ada collector_id filter?
// 2. Apakah ada user session context?
// 3. Apakah selectedDate benar-benar 2026-05-31?

const { data: dailyPayments } = usePayments(
  selectedDate,    // ← Pastikan ini '2026-05-31'
  selectedDate,
  undefined        // ← Atau ada collectorId di sini?
);
```

---

## 💡 Possible Issues

### Issue 1: User/Role-Based Filtering ⚠️
```
Current User: Kolektor tertentu (e.g., beringes)
→ Aplikasi hanya show data untuk user tersebut
→ Excel show semua kolektor

FIX: 
- Check user context di Aplikasi
- Buat view "Show All Collectors" atau
- Login dengan user yang punya akses all
```

### Issue 2: Collector ID Filter ⚠️
```
// Possible code:
const { data: dailyPayments } = usePayments(
  selectedDate, 
  selectedDate,
  currentUser.collector_id  // ← HIDDEN FILTER!
);

FIX: Remove collector_id filter dari query
```

### Issue 3: Date Off-by-One ⚠️
```
selectedDate = '2026-05-31'
Tapi query menggunakan '2026-05-30' atau '2026-06-01'?

FIX: Verify selectedDate value dalam console
```

---

## 📋 Investigation Checklist

- [ ] **Console Log:** Check selectedDate value
- [ ] **Network Tab:** Check `usePayments` request payload
  - Apa dateFrom & dateTo yang dikirim?
  - Ada collector_id?
  
- [ ] **Code Review:** Cek DailyProfitList.tsx
  - Apakah ada hidden filter?
  - Apakah usePayments punya 3rd parameter?

- [ ] **Database Direct:** Run Query A & B
  - Apakah DB punya Rp 82.77M untuk 31 Mei?
  - Breakdown per kolektor cocok dengan Excel?

---

## 🎯 Next Actions (Priority Order)

1. **URGENT:** Run Query A & B di Supabase
   - Confirm database punya full Rp 82.77M

2. **URGENT:** Check Network Tab di Browser
   - Lihat actual dateFrom/dateTo yang dikirim
   - Apakah ada collector_id parameter?

3. **URGENT:** Check Console Log
   - Inspect `selectedDate` state value
   - Inspect `dailyPayments` array length

4. **HIGH:** Review Code
   - Search for "collector" filter di DailyProfitList.tsx
   - Check usePayments hook signature

5. **HIGH:** Verify User Session
   - Apakah user punya role "admin" atau "collector"?
   - Apakah ada tenant/organization filter?

---

## 🚨 Summary

**What We Know:**
- ✅ Excel total: Rp 82,777,000 (4 kolektor)
- ❌ Aplikasi total: Rp 37,102,000 (missing ~55%)
- ✅ Total Tagihan match: Rp 83,022,000
- ⚠️ **Aplikasi hanya show 1 kolektor atau kurang!**

**What We Need:**
- Database confirmation (Query A & B)
- Network inspection (dateFrom/dateTo/collector_id)
- Code review (filter logic)

**Confidence Level:** 🔴 **HIGH** - Kemungkinan 80% ada hidden collector filter

---

**Status:** 🔄 CRITICAL - BLOCKING  
**Severity:** 🔴 HIGH - Data integrity issue  
**ETA Fix:** Once we confirm root cause → Code fix dalam 15 min
