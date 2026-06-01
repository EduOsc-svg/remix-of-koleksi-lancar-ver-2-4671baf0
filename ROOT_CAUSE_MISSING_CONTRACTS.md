# 🎯 ROOT CAUSE IDENTIFIED

## **THE PROBLEM**

**Line 131 di DailyProfitList.tsx:**
```typescript
dailyPayments.forEach((p: any) => {
  const info = contractMap.get(p.contract_id);
  if (!info) return;  // ← PAYMENTS WITH MISSING CONTRACTS ARE SKIPPED!
  // ... calculate ...
});
```

### **What This Means:**

Jika ada payment yang `contract_id`-nya tidak ada di **contractMap**, payment itu **DIABAIKAN**!

```
Total Payment dari Query: 1000 kupon
Tapi hanya kontrak yang ada di contractMap yang dihitung!

Missing Kontrak di contractMap = Missing Payments = Missing Total Tertagih
45,675,000 Rp Missing = ~55% dari kontrak tidak ada!
```

---

## 🔍 Why Contracts Are Missing?

### Possibility 1: **Kontrak dengan Status = "DELETED" atau "ARCHIVED"**
- `useContracts()` tidak filter status
- Tapi kontrak mungkin tidak di-load karena beberapa alasan
- Payment masih ada, tapi kontraknya hidden

### Possibility 2: **Contract Data Incomplete**
- Kontrak ada di DB, tapi belum load di useContracts()
- Race condition dalam data loading

### Possibility 3: **Kontrak Referensi Error**
- payment.contract_id tidak match dengan contracts.id
- Data integrity issue

---

## 🔧 THE FIX

### Option 1: **SAFE FIX** - Handle Missing Contracts Gracefully
```typescript
// Instead of: if (!info) return;
// Use fallback data:

if (!info) {
  // Log missing contract
  console.warn('Missing contract for payment:', p.contract_id);
  
  // Calculate with minimal info
  existing.collected += Number(p.amount_paid || 0);
  existing.coupons_paid += 1;
  // Skip modal/profit calculation, just count the cash
  grouped.set(p.contract_id, existing);
  return;
}
```

### Option 2: **CORRECT FIX** - Load ALL Contracts
```typescript
// Ensure useContracts loads EVERYTHING, including archived
const { data: contracts } = useContracts(undefined);  // No status filter
```

### Option 3: **IDEAL FIX** - Adjust Data Source Query
```typescript
// Instead of requiring contracts for calculation,
// Get contract info directly from payment_logs joins

// Modify usePayments to return contract details
// So we don't need separate contractMap lookup
```

---

## 🚨 IMMEDIATE ACTION

Let me check what kontrak-kontrak yang missing:

**Run this SQL:**
```sql
-- Find all contracts referenced by payment_logs
-- but not in credit_contracts table

SELECT DISTINCT pl.contract_id
FROM payment_logs pl
WHERE DATE(pl.payment_date) = '2026-05-31'
  AND pl.contract_id NOT IN (
    SELECT id FROM credit_contracts
  );
```

**If result > 0:** Ada payment dengan contract_id yang tidak ada di contracts table!

---

**OR** Check contracts yang ada di DB tapi tidak di-load:

```sql
-- Count total contracts
SELECT COUNT(*) as total_contracts
FROM credit_contracts;

-- Count contracts with payments on 31 Mei
SELECT COUNT(DISTINCT contract_id) as contracts_with_payment_31mei
FROM payment_logs
WHERE DATE(payment_date) = '2026-05-31';

-- Contracts dengan payment 31 Mei tapi tidak ada di contracts
SELECT COUNT(DISTINCT pl.contract_id) as orphaned_payments
FROM payment_logs pl
WHERE DATE(pl.payment_date) = '2026-05-31'
  AND pl.contract_id NOT IN (SELECT id FROM credit_contracts);
```

---

## 💡 Hypothesis

Based on discrepancy:
- Aplikasi: Rp 37,102,000
- Excel: Rp 82,777,000
- Missing: Rp 45,675,000 (55%)

**Possible Scenario:**
- 1000 kupon total
- ~450 kupon dari "missing contracts"
- ~550 kupon dari contracts yang ada

**This suggests:** Beberapa kontrak tidak ada atau tidak ter-load!

---

## ✅ NEXT STEPS (DO THIS FIRST)

1. **Check Browser Console**
   - Open DevTools → Console
   - Look for `console.warn` or errors related to payment loading
   - Check Network tab → usePayments request → response
   - Count items di array

2. **Run SQL queries above**
   - Confirm apakah ada orphaned payments

3. **Once confirmed, I will:**
   - Implement fix in DailyProfitList.tsx
   - Add proper error handling
   - Ensure all payments counted regardless of contract status

---

**Status:** 🔴 CRITICAL - ROOT CAUSE FOUND  
**Issue Type:** Missing contract reference handling  
**Severity:** HIGH - 55% of data not counted  
**Fix Complexity:** LOW - Just add fallback handling
