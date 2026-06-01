# 🔎 INVESTIGASI - Discrepancy Total Tertagih 31 Mei 2026

**Issue:** Excel menunjukkan **Rp 82,777,000** tetapi card di aplikasi berbeda

---

## 📊 Data dari Excel

**Laporan:** Input Pembayaran - Ringkasan Per Kolektor  
**Tanggal:** 31 Mei 2026

| No | Kolektor | Kode | Konsumen | Total Kupon | Total Dibayar | Total Tertagih |
|----|----------|------|----------|-------------|---------------|----------------|
| 1 | beringes | K002 | 57 | 809 | 799 | **Rp 29,848,000** |
| 2 | CALVIN | K004 | 36 | 556 | 556 | **Rp 23,825,000** |
| 3 | riski | K001 | 41 | 805 | 805 | **Rp 28,762,000** |
| 4 | tobi | K003 | 1 | 19 | 19 | **Rp 342,000** |
| **TOTAL** | | | | | | **Rp 82,777,000** |

---

## 🔍 Apa yang Harus Diverifikasi

### Kemungkinan 1: **Aplikasi Menampilkan Angka Berbeda**
- **Jika Aplikasi ≠ Rp 82,777,000:** 
  - Cek apakah filter date, timezone, atau soft-delete
  - Lihat Data Source di DB Query

### Kemungkinan 2: **Excel Menggunakan Definisi Berbeda**
- **"Total Dibayar"** di Excel vs **"Total Tertagih"** di Aplikasi
  - Apakah Excel menambah kolom yang Aplikasi tidak punya?
  - Apakah ada pembayaran yang di-exclude di salah satu sumber?

### Kemungkinan 3: **Data Entry Timing Issue**
- Payment di Excel tapi belum di-sync ke DB?
- Payment di DB tapi dengan payment_date berbeda?

---

## 🛠️ Debugging Steps

### STEP 1: Identifikasi Nilai di Aplikasi
```
📍 Tab Keuntungan Harian → Pilih Tanggal 31 Mei 2026
📸 Screenshot card "Total Tertagih"
```

**Catat nilai:** Rp ?

---

### STEP 2: Run Query Verifikasi DB

**Execute di Supabase SQL Editor:**

```sql
-- Query A: Total seluruh tertagih 31 Mei
SELECT 
  DATE(payment_date) as tanggal,
  COUNT(*) as kupon_count,
  SUM(amount_paid) as total_tertagih
FROM payment_logs
WHERE DATE(payment_date) = '2026-05-31'
GROUP BY DATE(payment_date);
```

**Expected Result:** Harus match dengan Rp 82,777,000 atau match dengan Aplikasi

---

```sql
-- Query B: Breakdown per Kolektor (31 Mei)
SELECT 
  c.collector_code,
  c.name as kolektor_name,
  COUNT(pl.id) as kupon_count,
  SUM(pl.amount_paid) as total_tertagih
FROM payment_logs pl
JOIN collectors c ON pl.collector_id = c.id
WHERE DATE(pl.payment_date) = '2026-05-31'
GROUP BY c.id, c.collector_code, c.name
ORDER BY c.collector_code;
```

**Expected Result:** Breakdown cocok dengan tabel Excel

---

### STEP 3: Analisis Hasil

**Scenario A: DB Match Excel (Rp 82,777,000)**
```
Database   : Rp 82,777,000 ✅
Excel      : Rp 82,777,000 ✅
Aplikasi   : Rp ? 

→ Issue di UI/Display Logic
→ Cek usePayments filter atau dailyTotals calculation
```

**Scenario B: DB ≠ Excel**
```
Database   : Rp X (bukan 82,777,000)
Excel      : Rp 82,777,000

→ Issue di Data Entry atau Date Filtering
→ Check apakah:
  - Ada payment dengan payment_date ≠ created_at
  - Ada soft-deleted records
  - Timezone mismatch
```

**Scenario C: Aplikasi Match Excel tapi Data Berbeda**
```
Aplikasi   : Rp 82,777,000 ✅
Excel      : Rp 82,777,000 ✅
Database   : Rp Y (beda)

→ Cache issue atau timing lag
→ Refresh data di Aplikasi
```

---

## 📋 Quick Debugging Checklist

### Check 1: Date Filter pada selectedDate
```typescript
// Cek di DailyProfitList.tsx line 40-50
const [selectedDate, setSelectedDate] = useState(today);
// ↑ Apakah ini menggunakan 2026-05-31 atau tanggal lain?

// usePayments call line 48
const { data: dailyPayments } = usePayments(selectedDate, selectedDate);
// ↑ Apakah parameter date ini correct?
```

---

### Check 2: usePayments Hook Filtering
```typescript
// Cek di src/hooks/usePayments.ts
// Apakah ada timezone conversion?
if (dateFrom) query = query.gte('payment_date', dateFrom);
if (dateTo) query = query.lte('payment_date', dateTo);
// ↑ Apakah ini menggunakan UTC atau local timezone?
```

---

### Check 3: Aggregation Logic
```typescript
// Cek di DailyProfitList.tsx line 180-190
const dailyTotals = dailyRows.reduce((acc, r) => {
  acc.collected += r.collected;  // ← Apakah ini sum dengan benar?
  return acc;
}, { ..., collected: 0, ... });
// ↑ Apakah ada data yang di-exclude?
```

---

## 🎯 Final Action Items

1. **PRIORITY 1:** Screenshot nilai di Aplikasi untuk 31 Mei
   - Apa yang tertera di card "Total Tertagih"?

2. **PRIORITY 2:** Run Query A & B di Supabase
   - Bandingkan hasil dengan Excel

3. **PRIORITY 3:** Berdasarkan hasil:
   - Jika match: cek UI filtering issue
   - Jika tidak match: cek data entry atau date conversion issue

4. **PRIORITY 4:** Create Root Cause Analysis doc

---

## 📞 Root Cause Candidates

| # | Cause | Symptom | Check |
|---|-------|---------|-------|
| 1 | Wrong payment_date | Aplikasi ≠ DB ≠ Excel | Query A result vs Excel |
| 2 | Timezone issue | All different by X hours | Check UTC vs local dates |
| 3 | Soft delete | Aplikasi < DB < Excel | Query with `deleted_at IS NOT NULL` |
| 4 | Filter bug | Aplikasi shows per-kolektor | Check DailyProfitList props |
| 5 | Cache stale | Aplikasi stuck at old value | Refresh browser & clear cache |
| 6 | Data sync delay | Excel newer than Aplikasi | Check created_at timestamps |

---

**Created:** 2026-06-01  
**Status:** 🔄 WAITING FOR INPUT
- [ ] Aplikasi value untuk 31 Mei
- [ ] Query A result
- [ ] Query B result  
- [ ] Root cause analysis

Once you provide these, I can pin-point exactly where the discrepancy comes from! 🎯
