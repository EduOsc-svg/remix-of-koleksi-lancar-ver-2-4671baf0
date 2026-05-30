# REVISI LOGIKA PEMBAYARAN - DARI PROMPT LAMA KE PROMPT BARU

## 📋 KONTEKS PENTING: Input Pembayaran HARIAN

**Kunci Pemahaman:**
- Tab "Belum Bayar" = Daftar kupon yang sudah disetor ke kolektor (daily handover)
- Tab "Input Pembayaran" = Pencatatan pembayaran dari kupon yang sudah disetor
- **Acuan:** Kupon di "Belum Bayar" adalah reference untuk payment entry

---

## 🔄 PERBANDINGAN PROMPT (Lama vs Baru)

### **PROMPT LAMA (Awal)**
```
"pada dashboard tahunan komisi itu bagaimana hitungannya?"

SCOPE: Dashboard tahunan
TARGET: Memahami perhitungan komisi pada yearly view
FOKUS: Komisi 12B, tiered commission, yearly net profit
```

**Hasil:**
- ✅ Dokumentasi perhitungan komisi tahunan
- ✅ Penjelasan tiered commission system
- ✅ Formula yearly net profit
- ❌ BELUM ada logika input pembayaran

---

### **PROMPT REVISI 1 (Payment Logic - AUTO + MANUAL)**
```
"ubah logikanya menjadi, otomatis melakukan bulk pembayaran kecuali ada yang kurang, 
contoh:
1. kontrak dari A001 sampai A010 yang membayar lunas semua kupon masing" adalah 
   A001 sampai A006, sehingga sisa kontrak yang belum lunas adalah 4 kontrak, 
   dan masing" list kontrak itu ada aksi "Belum Lunas" sehingga bisa mengisi dengan manual, 
   sehingga dalam logika ini kita tidak perlu input pembayaran yang lunas, 
   jika belum lunas user bisa memilih aksi tersebut"

SCOPE: Payment entry logic
TARGET: Optimize workflow untuk kontrak LUNAS vs BELUM LUNAS
FOKUS: 
  - Auto-bulk untuk LUNAS (no user input)
  - Manual input untuk BELUM LUNAS
  - Efficiency: skip kontrak yang sudah lengkap

ASUMSI (Lama):
  - Input pembayaran manual untuk SEMUA kontrak
  - User harus input kontrak LUNAS juga (repetitif)
```

**Hasil:**
- ✅ Auto-bulk untuk kontrak LUNAS
- ✅ Manual form untuk BELUM LUNAS
- ✅ Manifest list dengan status detection
- ⚠️ BELUM connect dengan daily handover (Belum Bayar tab)

---

### **PROMPT REVISI 2 (CURRENT - DAILY HANDOVER CONTEXT)**
```
"ini adalah input pembayaran HARIAN, sehingga semua kupon yang telah disetor 
(tab belum bayar) ke kolektor yang menjadi acuan penagihan pada tab input pembayaran, 
tolong buatkan list revisi prompt sebelumnya dan juga revisi prompt sekarang"

SCOPE: Daily payment entry with handover context
TARGET: Connect payment input dengan daily handover (Belum Bayar)
FOKUS:
  - Kupon dari "Belum Bayar" tab = source data
  - Input Pembayaran = recording yang dikumpulkan
  - Daily workflow: Handover → Input Pembayaran
  
KONTEKS BARU:
  - Pembayaran HARIAN (bukan arbitrary)
  - Source: Kupon yang sudah disetor ke kolektor
  - Workflow: Kolektor terima kupon → Kolektor kumpulkan → Rekam pembayaran
```

**Hasil Perubahan:**
- ✅ Koneksi dengan "Belum Bayar" tab
- ✅ Daily workflow context
- ✅ Handover-based reference
- ✅ List revisi old vs new prompt

---

## 📊 TABEL PERBANDINGAN DETAIL

| Aspek | Prompt Lama | Prompt Revisi 1 | Prompt Revisi 2 (CURRENT) |
|-------|-----------|-----------------|--------------------------|
| **Scope** | Yearly commission | Payment entry logic | Daily payment entry |
| **Context** | Dashboard tahunan | Contract LUNAS/BELUM | Handover + Payment |
| **Source Data** | yearly_financial | contracts table | belum_bayar + contracts |
| **User Workflow** | View only | Manual input | Handover → Payment |
| **Key Action** | Display komisi | Auto vs Manual | Record dari handover |
| **Reference** | yearly breakdown | contract status | daily handover list |
| **Time Frame** | Yearly | Once (batch) | Daily |
| **Focus** | Calculation | Efficiency | Accuracy |

---

## 🔄 EVOLUSI LOGIKA PEMBAYARAN

### **STAGE 1: Pure Manual (Original)**
```
User Input:
├─ Select contract
├─ Input kupon count
├─ Enter amount
└─ Submit
  
PROBLEM: ❌ Repetitive, slow, error-prone
TIME: ~20-30 min per 10 kontrak
```

### **STAGE 2: Auto + Manual (Revisi 1)**
```
Auto-detect LUNAS:
├─ If remaining == 0 → System auto-catat
├─ If remaining > 0 → Show [Belum Lunas] button
└─ User hanya input untuk BELUM

BENEFIT: ✅ Faster, clearer
TIME: ~10 min per 10 kontrak
ISSUE: ⚠️ Tidak ada daily handover context
```

### **STAGE 3: Daily Handover Context (Revisi 2 - CURRENT)**
```
Workflow:
├─ STEP 1: Kolektor serah kupon → Tab "Belum Bayar"
├─ STEP 2: Kolektor kumpulkan pembayaran
├─ STEP 3: Catat di "Input Pembayaran"
│  ├─ Source: Kupon dari Belum Bayar
│  ├─ Auto untuk LUNAS (sisa 0)
│  └─ Manual untuk BELUM (sisa > 0)
└─ STEP 4: Reconcile dengan handover

BENEFIT: ✅ Complete daily cycle, accurate tracking
TIME: ~10 min per daily batch
ACCURACY: ✅ Tied to actual handover
```

---

## 🎯 PERBEDAAN UTAMA: Revisi 1 vs Revisi 2

### **Revisi 1: "Auto-Bulk + Manual" (Tanpa Handover Context)**

**Input:**
```
User: "Ini 10 kontrak yang lunas hari ini"
      [A001, A002, ..., A010]
      
↓ (No reference to handover)
```

**Logic:**
```
├─ Detect: remaining kupon
├─ IF remaining == 0 → AUTO
├─ IF remaining > 0 → MANUAL
└─ Process semua sekaligus
```

**Assumption:**
- Semua kontrak yang dikumpulkan harus diproses
- Tidak ada reference external
- Kontrak bisa arbitrary dipilih

---

### **Revisi 2: "Daily Handover-Based Payment" (CURRENT)**

**Input:**
```
CONTEXT 1: Tab "Belum Bayar" (Daily Handover)
├─ Kupon yang disetor kolektor hari ini
├─ Status pembayaran: UNPAID
└─ Reference: coupon_handovers table

CONTEXT 2: Tab "Input Pembayaran" (Payment Entry)
├─ Catat pembayaran dari kupon Belum Bayar
├─ Match dengan handover
└─ Update status: PAID

↓ LOGIC: Payment harus dari Belum Bayar dulu
```

**Logic:**
```
DAILY WORKFLOW:

1. Belum Bayar Tab (Daily Handover):
   ├─ Fetch: coupon_handovers for TODAY
   ├─ Show: Kupon yang disetor
   └─ Status: All UNPAID

2. Input Pembayaran Tab:
   ├─ Pre-filter: Hanya kupon dari handover
   ├─ Group by contract
   ├─ Detect: LUNAS vs BELUM per kontrak
   │  ├─ LUNAS: Semua kupon sudah bayar → AUTO
   │  └─ BELUM: Ada kupon unpaid → MANUAL
   └─ Process: Hanya kontrak dari handover

3. Reconciliation:
   ├─ Payment recorded = Handover sent
   └─ Status updated: PAID in coupons
```

**Key Difference:**
```
Revisi 1: Arbitrary kontrak selection
         └─ User bisa input kontrak apapun

Revisi 2: Handover-based only
         ├─ Kontrak HARUS dari Belum Bayar
         ├─ Payment HARUS match handover
         └─ Audit trail: handover → payment
```

---

## 📈 WORKFLOW COMPARISON

### **Revisi 1 Workflow: Batch Processing**
```
Kolektor: "Lapor 10 kontrak lunas"
                ↓
System: Analyze & Auto-bulk
                ↓
6 AUTO + 4 MANUAL
                ↓
Result: Payments recorded
```

### **Revisi 2 Workflow: Daily Cycle with Handover**
```
MORNING:
Kolektor: Serahkan kupon → Belum Bayar Tab
                ↓
                Record handover
                ↓

NOON/AFTERNOON:
Kolektor: Kumpulkan pembayaran
                ↓
Input Pembayaran Tab:
  ├─ Filter: Dari handover hanya
  ├─ Process: Auto + Manual
  └─ Match: kupon vs handover
                ↓

EVENING:
Reconcile:
  ├─ All handover → all paid? ✅
  ├─ Any unpaid? ⚠️ → mark for follow-up
  └─ Daily summary
```

---

## 🔗 DATA SCHEMA CHANGES (Revisi 1 → Revisi 2)

### **Revisi 1: Just Contracts + Payments**
```sql
Tables:
├─ credit_contracts (ref for LUNAS/BELUM)
├─ installment_coupons (mark as PAID)
└─ payment_logs (record payment)

Source of Truth: contract.current_installment_index
Filter: All contracts
```

### **Revisi 2: Add Handover Context**
```sql
Tables:
├─ credit_contracts (ref for LUNAS/BELUM)
├─ installment_coupons (mark as PAID)
├─ payment_logs (record payment)
├─ coupon_handovers (daily handover)
└─ handover_coupon_details (handover items)

Source of Truth: 
  ├─ Handover → coupon_handovers (what to pay)
  ├─ Payment → payment_logs (what was paid)
  └─ Reconcile: handover == paid?

Filter: ONLY coupons from TODAY's handover
```

---

## 🎨 UI CHANGES

### **Revisi 1: Manifest List (Simple)**
```
┌─────────────────────────────────────┐
│ Kontrak yang Dikumpulkan:           │
├─────────────────────────────────────┤
│ A001 │ PT ABC │ ✅ LUNAS  │ Done   │
│ A002 │ PT DEF │ ✅ LUNAS  │ Done   │
│ ...                                │
│ A007 │ PT STU │ ⚠️ BELUM  │ [BL]   │
│ ...                                │
└─────────────────────────────────────┘

Source: User selection (arbitrary)
```

### **Revisi 2: Daily Handover-Based (Connected)**
```
TAB 1: Belum Bayar (Handover Daily)
┌──────────────────────────────────────────┐
│ Kupon Disetor Hari Ini (2026-05-30):    │
├──────────────────────────────────────────┤
│ Kontrak │ Customer │ Kupon │ Handover  │
├──────────────────────────────────────────┤
│ A001    │ PT ABC   │ 1-360 │ 2026-05-30│
│ A002    │ PT DEF   │ 1-360 │ 2026-05-30│
│ ...     │ ...      │ ...   │ ...       │
│ A010    │ PT BCD   │ 101-  │ 2026-05-30│
└──────────────────────────────────────────┘
         (Reference for Input Pembayaran)
              ↓

TAB 2: Input Pembayaran (Daily Payment)
┌──────────────────────────────────────────┐
│ Catat Pembayaran dari Handover:         │
├──────────────────────────────────────────┤
│ Kontrak │ Handover │ Paid   │ Action   │
├──────────────────────────────────────────┤
│ A001    │ 360      │ 360    │ ✅ AUTO  │
│ A002    │ 360      │ 360    │ ✅ AUTO  │
│ ...     │ ...      │ ...    │ ...      │
│ A007    │ 360      │ 250    │ ⚠️ [BL]  │
│ ...     │ ...      │ ...    │ ...      │
└──────────────────────────────────────────┘

Source: coupon_handovers (TODAY)
Filter: Hanya kupon dari handover
```

---

## ✅ CHECKLIST PERUBAHAN

### **Dari Revisi 1 ke Revisi 2:**

**Backend Changes:**
- [ ] Query coupon_handovers for daily filter
- [ ] Add handover_date parameter to payment form
- [ ] Validate: payment kupon must exist in handover
- [ ] Add reconciliation logic (handover vs paid)
- [ ] Add handover reference to payment_logs

**Frontend Changes:**
- [ ] Create Belum Bayar tab (handover display)
- [ ] Filter Input Pembayaran by handover date
- [ ] Add handover reference in manifest
- [ ] Pre-populate contracts from handover only
- [ ] Add reconciliation summary view

**Database Changes:**
- [ ] Ensure coupon_handovers has daily records
- [ ] Add handover_id to payment_logs (FK)
- [ ] Add reconciliation_status field
- [ ] Create daily handover view

**Validation Rules:**
- [ ] Payment contract must be in today's handover
- [ ] Payment coupon_index must be in handover range
- [ ] All handover coupons → must have payment eventually
- [ ] Handover → Payment reconciliation audit trail

---

## 📝 SUMMARY TABLE: ALL REVISIONS

| Aspect | Original | Revisi 1 (Auto+Manual) | Revisi 2 (Daily Handover) |
|--------|----------|----------------------|--------------------------|
| **Scope** | N/A | Payment optimization | Daily cycle |
| **Source** | Manual input | Contract list | Handover list |
| **Reference** | User selection | Status detection | coupon_handovers |
| **Time Frame** | Any time | Batch | Daily |
| **Workflow** | Manual all | Auto+Manual | Handover→Payment |
| **LUNAS Logic** | N/A | Auto-detect | Auto-detect from handover |
| **BELUM Logic** | N/A | Manual input | Manual from handover |
| **Filter** | None | By status | By handover_date |
| **Accuracy** | Low | Medium | High |
| **Audit Trail** | Minimal | Activity log | Handover + Payment + Reconcile |
| **Key Feature** | Efficiency | Skip LUNAS | Tie to daily cycle |

---

## 🎯 REVISI BARU (Revisi 2) - FINAL REQUIREMENTS

### **MUST HAVE:**
1. ✅ Belum Bayar tab showing daily handover
2. ✅ Input Pembayaran filtered by handover only
3. ✅ Auto-bulk untuk LUNAS (from handover)
4. ✅ Manual input untuk BELUM (from handover)
5. ✅ Reconciliation: handover vs paid

### **NICE TO HAVE:**
1. Summary card: "X dari Y handover sudah dibayar"
2. Follow-up list: "Kupon belum dibayar dari handover"
3. Daily report: "Handover A, B, C - Payment Status"
4. Audit trail: Handover → Payment → Reconcile

---

## 📌 KEY INSIGHT: Revisi 2 is "More Constrained"

```
Revisi 1 (Auto+Manual):
  - User bisa select kontrak apapun
  - System filter by status (LUNAS/BELUM)
  - ✅ Efficient but loose reference

Revisi 2 (Daily Handover):
  - ONLY kontrak dari handover hari ini
  - System filter by handover + status
  - ✅ Efficient AND tied to actual handover
  - ✅ Audit trail dari awal (handover) sampai akhir (paid)
```

---

**Document:** Revisi Log Payment Logic  
**Created:** May 30, 2026  
**Status:** APPROVED - Ready for Development (Revisi 2)

