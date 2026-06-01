# 🔧 DIRECT DATABASE CHECK

## SQL Queries untuk Verifikasi

Jalankan queries ini di **Supabase SQL Editor** untuk confirm root cause:

---

## Query 1: Total untuk 31 Mei SEMUA DATA
```sql
SELECT 
  DATE(payment_date) as tanggal,
  COUNT(*) as kupon_count,
  SUM(amount_paid) as total_tertagih
FROM payment_logs
WHERE DATE(payment_date) = '2026-05-31'
GROUP BY DATE(payment_date);
```

**Expected Result:** Rp 82,777,000 (match Excel)  
**If Different:** Database punya data berbeda dari Excel

---

## Query 2: Breakdown per Collector
```sql
SELECT 
  c.collector_code,
  c.name as kolektor_name,
  COUNT(*) as kupon_count,
  SUM(pl.amount_paid) as total_tertagih
FROM payment_logs pl
LEFT JOIN collectors c ON pl.collector_id = c.id
WHERE DATE(pl.payment_date) = '2026-05-31'
GROUP BY c.id, c.collector_code, c.name
ORDER BY total_tertagih DESC;
```

**Expected Breakdown:**
- K002 (beringes): Rp 29,848,000
- K004 (CALVIN): Rp 23,825,000
- K001 (riski): Rp 28,762,000
- K003 (tobi): Rp 342,000

---

## Query 3: Check NULL Collectors
```sql
SELECT 
  COUNT(*) as null_collector_count,
  SUM(amount_paid) as total_from_null_collectors
FROM payment_logs
WHERE DATE(payment_date) = '2026-05-31'
  AND collector_id IS NULL;
```

**If Result > 0:** Ada payment tanpa collector!

---

## Query 4: Payment Timestamps (untuk check date offset)
```sql
SELECT 
  id,
  payment_date,
  amount_paid,
  collector_id,
  created_at,
  (created_at AT TIME ZONE 'Asia/Jakarta') as created_jakarta,
  (payment_date AT TIME ZONE 'Asia/Jakarta') as payment_jakarta
FROM payment_logs
WHERE DATE(payment_date) = '2026-05-31'
LIMIT 5;
```

**To check:** Apakah ada timezone issue?

---

## Query 5: Kontrak Info untuk Total Tagihan
```sql
SELECT 
  COUNT(DISTINCT cc.id) as kontrak_count,
  SUM(cc.daily_installment_amount) as expected_tagihan
FROM payment_logs pl
JOIN credit_contracts cc ON pl.contract_id = cc.id
WHERE DATE(pl.payment_date) = '2026-05-31';
```

**Expected:** Rp 83,022,000 (match aplikasi!)

---

## Query 6: COMPLETE DATA DUMP untuk 31 Mei
```sql
SELECT 
  pl.id,
  pl.contract_id,
  cc.contract_ref,
  cst.name as customer_name,
  c.collector_code,
  c.name as kolektor_name,
  pl.payment_date,
  pl.amount_paid,
  cc.daily_installment_amount,
  pl.created_at
FROM payment_logs pl
JOIN credit_contracts cc ON pl.contract_id = cc.id
JOIN customers cst ON cc.customer_id = cst.id
LEFT JOIN collectors c ON pl.collector_id = c.id
WHERE DATE(pl.payment_date) = '2026-05-31'
ORDER BY c.collector_code, cc.contract_ref;
```

**Export hasil ke CSV untuk manual verification dengan Excel**

---

## 📊 Expected Results Summary

| Query | Expected Value | Actual Value |
|-------|---|---|
| Query 1 - Total | Rp 82,777,000 | Rp ? |
| Query 2 - Beringes | Rp 29,848,000 | Rp ? |
| Query 2 - CALVIN | Rp 23,825,000 | Rp ? |
| Query 2 - Riski | Rp 28,762,000 | Rp ? |
| Query 2 - Tobi | Rp 342,000 | Rp ? |
| Query 5 - Tagihan | Rp 83,022,000 | Rp ? |

---

## 💡 Next Steps After Running Queries

**IF Database = Rp 82,777,000:**
```
→ Problem di Aplikasi (display/filter bug)
→ Need to debug usePayments or DailyProfitList logic
```

**IF Database < Rp 82,777,000:**
```
→ Problem di Data Entry
→ Excel lebih lengkap dari Database
→ Need to import missing data ke Database
```

**IF Database > Rp 82,777,000:**
```
→ Excel tidak lengkap
→ Database punya data lebih
→ Need to verify with manual receipt check
```

---

**Once you run these queries, I can identify the EXACT root cause!** 🎯
