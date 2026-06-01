# 📊 ANALISA TOTAL TERTAGIH - Tab Keuntungan Harian

**Date:** June 1, 2026  
**Purpose:** Analisa dan sinkronisasi data "Total Tertagih" pada tab Keuntungan Harian dengan Excel sebagai acuan  

---

## 🎯 Tujuan Analisa

1. Memahami logika perhitungan "Total Tertagih" di aplikasi
2. Mengidentifikasi sumber data (payment logs)
3. Membandingkan dengan data Excel sebagai acuan
4. Memastikan sinkronisasi data yang akurat
5. Dokumentasi untuk QA/audit

---

## 📍 Lokasi Kode

**File:** `src/components/collection/DailyProfitList.tsx`  
**Component:** `DailyProfitList()`  
**Lines:** 320-360 (KPI Summary), 200-250 (Calculation Logic)

---

## 🔍 ANALISA PERHITUNGAN

### A. Definisi "Total Tertagih"

**Total Tertagih** = Jumlah uang yang benar-benar diterima dari pelanggan pada tanggal/bulan tertentu.

```
Total Tertagih = Σ(amount_paid) dari semua payment_logs pada periode tersebut
```

### B. Sumber Data

| Field | Sumber Database | Deskripsi |
|-------|-----------------|-----------|
| `amount_paid` | `payment_logs.amount_paid` | Jumlah uang yang diterima per pembayaran |
| `payment_date` | `payment_logs.payment_date` | Tanggal pembayaran dicatat |
| `contract_id` | `payment_logs.contract_id` | Kontrak mana yang dibayar |

### C. Data Flow

```
DATABASE (payment_logs)
    ↓
usePayments hook (fetch dengan filter date)
    ↓
DailyProfitList component
    ↓
dailyTotals.collected (Daily View)
monthlySummary.totalCollected (Monthly View)
    ↓
UI → Display "Total Tertagih"
```

---

## 📋 LOGIKA PERHITUNGAN DETAIL

### 1. DAILY VIEW (Harian)

**Query Fetch:**
```javascript
const { data: dailyPayments } = usePayments(selectedDate, selectedDate);
// Fetch semua payment_logs dengan payment_date = selectedDate
```

**Calculation:**
```javascript
dailyRows.forEach((row) => {
  acc.collected += row.collected;  // Sum dari amount_paid
});

dailyTotals.collected = Σ(amount_paid) untuk selectedDate
```

**Display:**
```
KPI Card: "Total Tertagih" → formatRupiah(dailyTotals.collected)
```

**Formula:**
```
Total Tertagih (Harian) = SUM(payment_logs.amount_paid) 
                          WHERE payment_date = [Selected Date]
```

---

### 2. MONTHLY VIEW (Bulanan)

**Query Fetch:**
```javascript
const { data: monthlyPayments } = usePayments(
  format(monthStart, "yyyy-MM-dd"),
  format(monthEnd, "yyyy-MM-dd")
);
// Fetch semua payment_logs antara start & end of month
```

**Calculation:**
```javascript
monthlyPayments.forEach((p) => {
  const dateStr = p.payment_date;  // Tanggal pembayaran
  const daily = map.get(dateStr);
  daily.collected += Number(p.amount_paid || 0);
});

monthlySummary.totalCollected = Σ(totalCollected per hari)
```

**Display:**
```
KPI Card di bulan view: "Total Tertagih" → formatRupiah(monthlySummary.totalCollected)
```

**Formula:**
```
Total Tertagih (Bulanan) = SUM(daily.collected untuk setiap hari)
                         = SUM(payment_logs.amount_paid) 
                           WHERE payment_date BETWEEN [Month Start] AND [Month End]
```

---

## 📊 FIELD YANG DITAMPILKAN

### Daily KPI Summary
```
┌─────────────────────────────────────────┐
│ Kupon Tertagih    │ 5 kupon             │
├─────────────────────────────────────────┤
│ Total Tertagih    │ Rp 2,500,000        │ ← FOKUS ANALISA
├─────────────────────────────────────────┤
│ Total Tagihan     │ Rp 2,650,000        │
├─────────────────────────────────────────┤
│ Porsi Modal       │ Rp 1,250,000        │
├─────────────────────────────────────────┤
│ Keuntungan        │ Rp 1,250,000 (50%) │
└─────────────────────────────────────────┘
```

### Monthly KPI Summary
```
Same 5 KPI fields, but aggregated for entire month
```

---

## 🔄 SINKRONISASI DENGAN EXCEL

### Step-by-Step Verification

**Step 1: Export Data dari Aplikasi**
```javascript
// Di Daily View, select tanggal tertentu
// Lihat "Total Tertagih" → Rp X
// Catat semua kontrak + payment amounts
```

**Step 2: Cross-Check dengan Excel**
```
Excel formula:
=SUMIF(Payment_Date, [Selected Date], Amount_Paid)

Hasil Excel harus = Hasil Aplikasi
```

**Step 3: Identifikasi Discrepancies**
```
JIKA Aplikasi ≠ Excel:
├─ Check payment_logs records di database
├─ Verify payment_date format (YYYY-MM-DD)
├─ Confirm amount_paid values
└─ Check filter date range
```

---

## 💡 AUDIT TRAIL

### Untuk memverifikasi data:

**1. Query Database Langsung**
```sql
-- Check payment logs untuk tanggal tertentu
SELECT 
  payment_date,
  SUM(amount_paid) as total_tertagih,
  COUNT(*) as kupon_count
FROM payment_logs
WHERE payment_date = '2026-06-01'
GROUP BY payment_date;
```

**2. Bandingkan dengan Aplikasi**
```
Aplikasi: Rp 2,500,000
Database: Rp 2,500,000
Excel: Rp 2,500,000
✓ MATCH!
```

**3. Jika Tidak Match**
```
Kemungkinan:
- Data belum di-sync ke database
- Filter date range berbeda
- Timezone issue (payment_date stored as UTC)
- Rounding differences
```

---

## 📈 RELATED FIELDS (Context)

### Fields yang berkontribusi ke Total Tertagih:

| Field | Role | Formula |
|-------|------|---------|
| `Total Tagihan` | Harapan | KB × Cicilan Harian |
| `Total Tertagih` | Realisasi | Actual payments received |
| `Kupon Tertagih` | Count | Jumlah kupon yang dibayar |
| `Porsi Modal` | Breakdown | Total Tertagih × (Modal/Omset) per kupon |
| `Keuntungan` | Margin | Total Tertagih - Porsi Modal |
| `Margin %` | Efficiency | Keuntungan / Total Tertagih × 100% |

---

## ✅ CHECKLIST SINKRONISASI

- [ ] Verify payment_logs table di database
- [ ] Check payment_date column format
- [ ] Confirm amount_paid values accuracy
- [ ] Compare Daily totals dengan Excel
- [ ] Compare Monthly totals dengan Excel
- [ ] Check for missing or duplicate payments
- [ ] Verify date range filters
- [ ] Test with sample date (known data)
- [ ] Document any discrepancies
- [ ] Create audit report

---

## 🎯 KESIMPULAN

### Total Tertagih adalah:
✅ **CASH-Based** - Actual money received  
✅ **Date-Based** - Filtered by payment_date  
✅ **Sum of amount_paid** - Direct dari payment_logs  
✅ **Real-time** - Updated saat payment entry dicatat  

### Untuk sinkronisasi dengan Excel:
1. Export both datasets (Aplikasi & Excel)
2. Use common key: payment_date + amount_paid
3. Aggregate by date
4. Compare totals
5. Investigate mismatches jika ada
6. Document root cause

---

## 📁 Related Files

| File | Purpose |
|------|---------|
| `src/components/collection/DailyProfitList.tsx` | Daily profit calculation & display |
| `src/hooks/usePayments.ts` | Payment logs fetching |
| `MONTHLY_PROFIT_DOCUMENTATION.md` | Feature documentation |
| Database: `payment_logs` table | Source of truth |

---

## 🔗 Additional References

- Payment Log Structure: `src/hooks/usePayments.ts` line 7-10
- DailyTotals Calculation: `src/components/collection/DailyProfitList.tsx` line 156-169
- Monthly Summary Calculation: line 261-279

---

**Status:** ✅ DOCUMENTED - Ready for implementation & verification

Next Step: Run audit verification with actual Excel data
