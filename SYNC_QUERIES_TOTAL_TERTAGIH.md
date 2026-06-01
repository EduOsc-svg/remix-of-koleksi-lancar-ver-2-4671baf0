# 🔍 SYNC QUERIES - Total Tertagih Verification

**Purpose:** SQL queries untuk verifikasi & sinkronisasi data Total Tertagih dengan Excel

---

## ✅ VERIFICATION QUERIES

### 1. Daily Total Tertagih

**For Single Date:**
```sql
-- Get total collected for a specific date
SELECT 
  DATE(payment_date) as tanggal,
  COUNT(*) as kupon_count,
  SUM(amount_paid) as total_tertagih,
  SUM(amount_paid) / COUNT(*) as rata_rata_kupon
FROM payment_logs
WHERE DATE(payment_date) = '2026-06-01'
GROUP BY DATE(payment_date);
```

**Expected Result:**
```
tanggal    | kupon_count | total_tertagih | rata_rata_kupon
2026-06-01 | 5           | 2500000        | 500000
```

---

### 2. Daily Total Tertagih with Contract Details

**For Detailed Breakdown:**
```sql
-- Get daily totals with contract info
SELECT 
  p.payment_date,
  cc.contract_ref,
  c.name as customer_name,
  COUNT(*) as kupon_count,
  SUM(p.amount_paid) as total_tertagih,
  SUM(cc.daily_installment_amount) as total_tagihan_harapan,
  SUM(p.amount_paid) - SUM(cc.daily_installment_amount * COUNT(*)) as variance
FROM payment_logs p
JOIN credit_contracts cc ON p.contract_id = cc.id
JOIN customers c ON cc.customer_id = c.id
WHERE DATE(p.payment_date) = '2026-06-01'
GROUP BY 
  p.payment_date, 
  cc.contract_ref, 
  c.name
ORDER BY p.payment_date DESC, cc.contract_ref;
```

**Expected Result:**
```
payment_date | contract_ref | customer_name | kupon_count | total_tertagih | total_tagihan_harapan | variance
2026-06-01   | KON-001      | Andi         | 2           | 1000000        | 1000000               | 0
2026-06-01   | KON-002      | Budi         | 3           | 1500000        | 1500000               | 0
```

---

### 3. Monthly Total Tertagih

**For Entire Month:**
```sql
-- Get monthly totals
SELECT 
  DATE_TRUNC('month', payment_date) as bulan,
  COUNT(*) as total_kupon,
  COUNT(DISTINCT DATE(payment_date)) as hari_aktif,
  SUM(amount_paid) as total_tertagih,
  SUM(amount_paid) / COUNT(DISTINCT DATE(payment_date)) as rata_rata_harian
FROM payment_logs
WHERE DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', '2026-06-01'::date)
GROUP BY DATE_TRUNC('month', payment_date);
```

**Expected Result:**
```
bulan    | total_kupon | hari_aktif | total_tertagih | rata_rata_harian
2026-06  | 150         | 20         | 75000000       | 3750000
```

---

### 4. Daily Breakdown with Modal & Profit

**Complete Daily Analysis:**
```sql
-- Daily totals including modal & profit breakdown
SELECT 
  DATE(p.payment_date) as tanggal,
  COUNT(DISTINCT p.contract_id) as jumlah_kontrak,
  COUNT(*) as kupon_tertagih,
  SUM(p.amount_paid) as total_tertagih,
  ROUND(SUM(cc.omset / cc.tenor_days)::numeric, 0) as porsi_modal,
  ROUND(SUM((cc.total_loan_amount - cc.omset) / cc.tenor_days)::numeric, 0) as porsi_keuntungan,
  ROUND((SUM(p.amount_paid) - SUM(cc.omset / cc.tenor_days)) / SUM(p.amount_paid) * 100, 2) as margin_persen
FROM payment_logs p
JOIN credit_contracts cc ON p.contract_id = cc.id
WHERE DATE(p.payment_date) = '2026-06-01'
GROUP BY DATE(p.payment_date)
ORDER BY DATE(p.payment_date) DESC;
```

**Expected Result:**
```
tanggal    | jumlah_kontrak | kupon_tertagih | total_tertagih | porsi_modal | porsi_keuntungan | margin_persen
2026-06-01 | 5              | 5              | 2500000        | 1250000     | 1250000          | 50.00
```

---

### 5. Compare Daily Data (Aplikasi vs Expected)

**Untuk validasi:**
```sql
-- Actual vs Expected comparison
SELECT 
  DATE(p.payment_date) as tanggal,
  -- Aplikasi calculation
  SUM(p.amount_paid) as aplikasi_total_tertagih,
  
  -- Expected calculation (sum of tagihan harapan per kupon)
  ROUND(SUM(cc.daily_installment_amount)::numeric, 0) as harapan_total_tagihan,
  
  -- Variance
  SUM(p.amount_paid) - SUM(cc.daily_installment_amount) as variance,
  
  -- Match indicator
  CASE 
    WHEN SUM(p.amount_paid) = SUM(cc.daily_installment_amount) THEN 'MATCH ✓'
    WHEN ABS(SUM(p.amount_paid) - SUM(cc.daily_installment_amount)) < 1000 THEN 'MINOR'
    ELSE 'MISMATCH ✗'
  END as status
FROM payment_logs p
JOIN credit_contracts cc ON p.contract_id = cc.id
WHERE DATE(p.payment_date) BETWEEN '2026-06-01' AND '2026-06-30'
GROUP BY DATE(p.payment_date)
ORDER BY DATE(p.payment_date);
```

---

## 🔄 MONTHLY COMPARISON

### 6. Month-over-Month Trend

**Identify patterns:**
```sql
-- Monthly comparison for trend analysis
SELECT 
  DATE_TRUNC('month', payment_date)::date as bulan,
  COUNT(*) as total_kupon,
  COUNT(DISTINCT DATE(payment_date)) as hari_kerja,
  COUNT(DISTINCT contract_id) as jumlah_kontrak,
  SUM(amount_paid) as total_tertagih,
  ROUND(AVG(amount_paid)::numeric, 0) as rata_rata_kupon,
  ROUND((SUM(amount_paid) / COUNT(DISTINCT DATE(payment_date)))::numeric, 0) as rata_rata_harian
FROM payment_logs
WHERE payment_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '6 months')
GROUP BY DATE_TRUNC('month', payment_date)
ORDER BY DATE_TRUNC('month', payment_date) DESC;
```

---

## 🎯 QUICK AUDIT TEMPLATE

**Copy-paste untuk quick verification:**

```sql
-- AUDIT QUERY: Total Tertagih untuk tanggal tertentu
-- Ganti '2026-06-01' dengan tanggal yang ingin di-check
SELECT 
  'Tanggal' as metric,
  '2026-06-01' as value
UNION ALL
SELECT 
  'Total Kupon Dibayar',
  COUNT(*)::text
FROM payment_logs
WHERE DATE(payment_date) = '2026-06-01'
UNION ALL
SELECT 
  'Total Tertagih (Rp)',
  FORMAT('Rp %s', TO_CHAR(SUM(amount_paid), '999,999,999'))
FROM payment_logs
WHERE DATE(payment_date) = '2026-06-01'
UNION ALL
SELECT 
  'Rata-rata per Kupon (Rp)',
  FORMAT('Rp %s', TO_CHAR(AVG(amount_paid), '999,999,999'))
FROM payment_logs
WHERE DATE(payment_date) = '2026-06-01'
UNION ALL
SELECT 
  'Min Kupon (Rp)',
  FORMAT('Rp %s', TO_CHAR(MIN(amount_paid), '999,999,999'))
FROM payment_logs
WHERE DATE(payment_date) = '2026-06-01'
UNION ALL
SELECT 
  'Max Kupon (Rp)',
  FORMAT('Rp %s', TO_CHAR(MAX(amount_paid), '999,999,999'))
FROM payment_logs
WHERE DATE(payment_date) = '2026-06-01';
```

---

## 📋 DATA VALIDATION CHECKLIST

### Check untuk setiap query:

- [ ] Date format: YYYY-MM-DD
- [ ] Amount_paid values: Positive numbers
- [ ] No NULL values: amount_paid should not be NULL
- [ ] Contract reference: Valid contract_id
- [ ] Currency: Consistent (IDR)
- [ ] Consistency: Daily totals match monthly breakdown
- [ ] Duplicate check: No duplicate payment entries
- [ ] Outliers: Check unusually high/low amounts

---

## 🔗 SQL SAMPLES

### Finding Discrepancies

**Payments outside expected range:**
```sql
SELECT 
  contract_id,
  payment_date,
  amount_paid,
  (SELECT daily_installment_amount FROM credit_contracts WHERE id = payment_logs.contract_id) as expected
FROM payment_logs
WHERE amount_paid > (SELECT daily_installment_amount * 1.2 FROM credit_contracts WHERE id = payment_logs.contract_id)
  OR amount_paid < (SELECT daily_installment_amount * 0.8 FROM credit_contracts WHERE id = payment_logs.contract_id)
ORDER BY payment_date DESC
LIMIT 20;
```

---

## ✅ SUCCESS CRITERIA

**Data is SYNCED correctly when:**
- ✓ Aplikasi Total Tertagih = SUM(payment_logs.amount_paid) untuk periode
- ✓ Aplikasi Total Tertagih = Excel Grand Total untuk periode
- ✓ No NULL values di amount_paid
- ✓ Payment dates format konsisten
- ✓ Currency consistent (IDR)
- ✓ Daily breakdown aggregates to monthly
- ✓ Margin calculation consistent: Profit / Tertagih × 100%

---

**Ready to audit!** 🚀
