# 🔍 DEBUG - Total Tertagih 31 Mei 2026

**Excel Data: Rp 82,777,000** (Ringkasan per kolektor)

---

## SQL Queries untuk Verifikasi

### Query 1: Total Tertagih pada 31 Mei 2026 (Seluruh DB)
```sql
SELECT 
  DATE(payment_date) as tanggal,
  COUNT(*) as kupon_count,
  SUM(amount_paid) as total_tertagih,
  COUNT(DISTINCT contract_id) as kontrak_count
FROM payment_logs
WHERE DATE(payment_date) = '2026-05-31'
GROUP BY DATE(payment_date);
```

**Expected:** Harus sama dengan Rp 82,777,000

---

### Query 2: Breakdown per Kolektor (31 Mei)
```sql
SELECT 
  c.collector_code,
  c.name as kolektor_name,
  COUNT(pl.id) as kupon_count,
  SUM(pl.amount_paid) as total_tertagih
FROM payment_logs pl
JOIN collectors c ON pl.collector_id = c.id
WHERE DATE(pl.payment_date) = '2026-05-31'
GROUP BY c.id, c.collector_code, c.name
ORDER BY total_tertagih DESC;
```

**Expected Breakdown:**
- beringes (K002): Rp 29,848,000
- CALVIN (K004): Rp 23,825,000
- riski (K001): Rp 28,762,000
- tobi (K003): Rp 342,000

---

### Query 3: Detail Setiap Payment (31 Mei)
```sql
SELECT 
  pl.id,
  pl.payment_date,
  pl.contract_id,
  cc.contract_ref,
  cst.name as customer_name,
  c.collector_code,
  c.name as kolektor_name,
  pl.amount_paid,
  pl.created_at
FROM payment_logs pl
JOIN credit_contracts cc ON pl.contract_id = cc.id
JOIN customers cst ON cc.customer_id = cst.id
JOIN collectors c ON pl.collector_id = c.id
WHERE DATE(pl.payment_date) = '2026-05-31'
ORDER BY c.collector_code, cc.contract_ref;
```

**Untuk verify:** Lihat apakah total amount_paid per kolektor cocok dengan Excel

---

### Query 4: Check untuk tanggal lain (May 2026)
```sql
SELECT 
  DATE(payment_date) as tanggal,
  COUNT(*) as kupon_count,
  SUM(amount_paid) as total_tertagih
FROM payment_logs
WHERE DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', '2026-05-31'::date)
GROUP BY DATE(payment_date)
ORDER BY tanggal DESC;
```

**Untuk identify:** Apakah ada pembayaran di tanggal lain yang seharusnya di 31 Mei

---

### Query 5: Check untuk Excel report date
```sql
SELECT 
  DATE(payment_date) as tanggal,
  SUM(amount_paid) as total_tertagih,
  COUNT(*) as kupon_count
FROM payment_logs
WHERE payment_date >= '2026-05-31'::date 
  AND payment_date < '2026-06-01'::date
GROUP BY DATE(payment_date);
```

---

## 🔧 Kemungkinan Root Causes

### 1. **Filter Date Berbeda** ❌
Aplikasi mungkin filter berdasarkan `created_at` atau `updated_at` bukan `payment_date`

**Cek:**
```sql
-- Cek apakah ada payment dengan payment_date ≠ created_at
SELECT 
  DATE(payment_date) as payment_date,
  DATE(created_at) as created_date,
  COUNT(*) as count,
  SUM(amount_paid) as total
FROM payment_logs
WHERE ABS(EXTRACT(DAY FROM payment_date) - EXTRACT(DAY FROM created_at)) > 0
GROUP BY payment_date, created_at;
```

---

### 2. **Timezone Issue** ⏰
Payment tercatat dengan waktu, tapi date boundary berbeda

**Cek:**
```sql
SELECT 
  DATE(payment_date AT TIME ZONE 'UTC') as utc_date,
  DATE(payment_date AT TIME ZONE 'Asia/Jakarta') as local_date,
  COUNT(*) as count
FROM payment_logs
WHERE payment_date >= '2026-05-31'::date 
  AND payment_date < '2026-06-02'::date
GROUP BY utc_date, local_date;
```

---

### 3. **Soft Delete / Archive** 🗑️
Ada payment yang di-soft delete atau di-archive?

**Cek:**
```sql
-- Check jika ada deleted_at atau status field
SELECT *
FROM payment_logs
WHERE deleted_at IS NOT NULL
  AND DATE(payment_date) = '2026-05-31'
LIMIT 10;
```

---

### 4. **Filter Kolektor di Aplikasi** 👤
Aplikasi hanya menampilkan untuk kolektor tertentu?

**Cek:** Di `DailyProfitList.tsx` apakah ada filter collector?

---

### 5. **Data Entry Issue** ⚠️
Ada payment di Excel tapi belum di-entry ke aplikasi?

**Cek:** Bandingkan Excel dengan hasil Query #2 & #3

---

## 📋 Verification Checklist

- [ ] Run Query 1 → Compare result dengan Rp 82,777,000
- [ ] Run Query 2 → Bandingkan breakdown per kolektor
- [ ] Run Query 3 → List semua payment dan verify amounts
- [ ] Run Query 4 → Check tanggal2 lain di Mei
- [ ] Run Query 5 → Double check date boundary
- [ ] Check `DailyProfitList.tsx` apakah ada collector filter
- [ ] Verify `usePayments` hook date filtering
- [ ] Check apakah ada timezone conversion issues

---

## 🎯 Next Steps

1. **Run Query 1** → Dapatkan total tertagih dari database untuk 31 Mei
2. **Compare dengan Excel** → Apakah cocok?
   - **Jika cocok:** Issue ada di UI filtering/display
   - **Jika tidak cocok:** Issue ada di data entry
3. **Run Query 2** → Verifikasi breakdown per kolektor
4. **Investigate:** Berdasarkan findings, cek salah satu dari 5 root causes

---

**Created:** 2026-06-01  
**For Date:** 2026-05-31  
**Target:** Reconcile Total Tertagih antara Excel (Rp 82,777,000) dengan Aplikasi
