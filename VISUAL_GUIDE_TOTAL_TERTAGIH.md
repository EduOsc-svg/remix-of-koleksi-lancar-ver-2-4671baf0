# 📊 VISUAL GUIDE - Total Tertagih Analysis

---

## 🎯 KONSEP DASAR

### Apa itu "Total Tertagih"?

```
┌─────────────────────────────────────────────────────────┐
│                    KONTRAK HARIAN                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Start: Setor KB → Pelanggan membayar → Catat di DB   │
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐         │
│  │ Kontrak  │    │ Payment  │    │ Database │         │
│  │          │───▶│ Amount   │───▶│ Recorded │         │
│  │ KON-001  │    │ Rp 500K  │    │ 500.000  │         │
│  └──────────┘    └──────────┘    └──────────┘         │
│                                                         │
│  Total Tertagih = SUM(semua payment amount yang diterima)
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📈 DATA FLOW - Dari Entry hingga Display

### 1. PAYMENT ENTRY

```
User Action: "Terima pembayaran Rp 500.000"
    ↓
Database Record:
{
  contract_id: "abc-123",
  payment_date: "2026-06-01",
  amount_paid: 500000,
  installment_index: 1
}
```

### 2. DATA AGGREGATION (Daily)

```
Payment Logs untuk 2026-06-01:
┌─────────────────────────────────────────┐
│ contract_id | amount_paid | payment_date │
├─────────────────────────────────────────┤
│ KON-001     | 500,000     | 2026-06-01  │
│ KON-002     | 1,000,000   | 2026-06-01  │
│ KON-001     | 500,000     | 2026-06-01  │
│ KON-003     | 500,000     | 2026-06-01  │
└─────────────────────────────────────────┘
         ↓
    SUM(amount_paid)
         ↓
   TOTAL TERTAGIH = Rp 2,500,000
```

### 3. APPLICATION DISPLAY

```
Tab: "Keuntungan Harian" → Select Date "2026-06-01"
         ↓
    Query Database
         ↓
    Aggregate Results
         ↓
    Display KPI:
    ┌─────────────────────────┐
    │ Total Tertagih          │
    │ Rp 2,500,000            │ ← CALCULATED FROM ABOVE
    └─────────────────────────┘
```

---

## 🔄 COMPARISON: Aplikasi vs Excel

### Scenario: Verifikasi Daily Total

**Tanggal:** 2026-06-01

#### Aplikasi shows:
```
┌──────────────────────────────────────┐
│  Keuntungan Harian                   │
│  2026-06-01                          │
├──────────────────────────────────────┤
│  Kupon Tertagih:     5               │
│  Total Tertagih:     Rp 2,500,000   │ ← VALUE TO VERIFY
│  Total Tagihan:      Rp 2,750,000   │
│  Porsi Modal:        Rp 1,250,000   │
│  Keuntungan:         Rp 1,250,000   │
│  Margin:             50.0%           │
└──────────────────────────────────────┘
```

#### Excel data:
```
Date       | Kontrak | Amount     | Row Total
2026-06-01 | KON-001 | 500,000    |
2026-06-01 | KON-002 | 1,000,000  |
2026-06-01 | KON-001 | 500,000    |
2026-06-01 | KON-003 | 500,000    |
           |         | TOTAL:     | Rp 2,500,000
```

#### Verification:
```
Aplikasi: Rp 2,500,000
Excel:    Rp 2,500,000
         ✓ MATCH!
```

---

## 🎯 WHERE DISCREPANCIES HAPPEN

### Common Issues & How to Spot Them

```
┌──────────────────────────────────────────────────────────┐
│ SCENARIO 1: Missing Payment Records                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Excel shows:    Rp 2,500,000 (5 payments)               │
│ Aplikasi shows: Rp 2,000,000 (4 payments)               │
│ Difference:     Rp 500,000                              │
│                                                          │
│ ROOT CAUSE: One payment not yet saved to database       │
│                                                          │
│ ACTION: Check if 5th payment entry is pending/unsaved   │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ SCENARIO 2: Wrong Payment Date                           │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Excel: Payment dated 2026-06-01                          │
│ DB:    Payment dated 2026-05-31 (wrong date)            │
│                                                          │
│ When query for 2026-06-01 → Missing the payment          │
│                                                          │
│ ACTION: Correct payment_date in database                 │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ SCENARIO 3: Rounding/Format Difference                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Aplikasi: Rp 2,500,000                                  │
│ Excel:    Rp 2,500,000.50 (shown as 2.5M with decimals) │
│                                                          │
│ ACTION: Check if there's precision loss or rounding      │
└──────────────────────────────────────────────────────────┘
```

---

## 📊 MONTHLY VIEW CALCULATION

### How Monthly Total is Built

```
June 2026 Breakdown:

Day 1:  Rp 500,000   ──────┐
Day 2:  Rp 750,000   ──────┤
Day 3:  Rp 0         ──────┤
Day 4:  Rp 1,000,000 ──────┤─ SUM(Daily) = Monthly Total
Day 5:  Rp 250,000   ──────┤
...                         │
Day 30: Rp 300,000   ──────┘

                    ↓
            TOTAL BULAN JUNI
            = Rp 75,000,000
```

---

## 🔍 STEP-BY-STEP VERIFICATION

### Daily Verification Process

```
STEP 1: APLIKASI
════════════════════════════════════════════════════════
┌─────────────────────────────────────────────────────┐
│ Collection → Keuntungan Harian Tab                  │
│ Select: 2026-06-01                                  │
│ Record: Total Tertagih = Rp 2,500,000              │
│         Kupon = 5                                   │
└─────────────────────────────────────────────────────┘
                    ↓
Collect these details:
- Total amount
- Number of coupons
- Individual contract amounts
- Collector codes


STEP 2: EXCEL
════════════════════════════════════════════════════════
┌─────────────────────────────────────────────────────┐
│ Filter by Date: 2026-06-01                          │
│ Create formula: =SUMIF(Date Col, "2026-06-01", Amount Col)
│ Result: Rp 2,500,000                               │
└─────────────────────────────────────────────────────┘
                    ↓
Compare detail:
- Total matches?
- Individual amounts match?
- Reconcile per contract


STEP 3: DATABASE QUERY
════════════════════════════════════════════════════════
SELECT 
  SUM(amount_paid) as total_tertagih,
  COUNT(*) as kupon_count
FROM payment_logs
WHERE DATE(payment_date) = '2026-06-01';

Result:
total_tertagih | kupon_count
─────────────────────────────
2,500,000      | 5
════════════════════════════════════════════════════════
                    ↓
VERIFICATION
════════════════════════════════════════════════════════
Aplikasi: Rp 2,500,000 ✓
Excel:    Rp 2,500,000 ✓
Database: Rp 2,500,000 ✓
                    ↓
        ✅ ALL MATCH - DATA SYNCED!
════════════════════════════════════════════════════════
```

---

## 📋 CHECKLIST FOR AUDITOR

### Daily Audit Template

**Date:** ___________

**Quick Check:**
```
□ Log in to aplikasi
□ Go to Keuntungan Harian tab
□ Select date: ___________
□ Record "Total Tertagih": ___________ Rp
□ Record "Kupon Count": ___________ 
□ Scroll down and list all contracts + amounts
```

**Excel Verification:**
```
□ Open Excel data for same date
□ Create formula: =SUMIF(Date, "___", Amount)
□ Record Excel Total: ___________ Rp
□ Record Excel Count: ___________
□ List all contracts + amounts from Excel
```

**Reconciliation:**
```
Aplikasi Total:  Rp ___________
Excel Total:     Rp ___________
Difference:      Rp ___________

□ Match?    YES / NO
□ If NO, investigate:
  - Missing payments?
  - Wrong dates?
  - Rounding issues?
  - Duplicate entries?

Root Cause: _______________________________
Action Taken: ______________________________
Approved by: ________________________________ Date: _____
```

---

## 🎓 BEST PRACTICES

1. **Always audit with a known/complete day first**
   - Start with day that has lots of transactions
   - Easy to spot if something's wrong

2. **Compare 3 sources**
   - Aplikasi
   - Excel
   - Database query
   - All 3 must match!

3. **Check edge cases**
   - First day of month
   - Last day of month
   - Holidays/non-working days
   - Day with no transactions

4. **Document everything**
   - Record the verification date
   - Note any issues found
   - Action taken to fix
   - Who approved the fix

---

**READY FOR AUDIT!** ✨
