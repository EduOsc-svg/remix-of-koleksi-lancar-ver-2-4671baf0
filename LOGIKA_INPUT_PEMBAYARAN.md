# Logika Input Pembayaran (Payment Entry Logic) - V2

## 📋 Overview - LOGIKA BARU
Sistem pencatatan pembayaran dengan **AUTO-BULK untuk kontrak LUNAS** + **Manual input untuk BELUM LUNAS**:
- **Auto-Bulk Payment**: Kontrak yang semua kupon sudah lunas → otomatis catat bulk payment tanpa user input
- **Manual Input Required**: Kontrak belum lunas → tampilkan di daftar dengan action "Belum Lunas" untuk input manual
- **Contract List View**: Display all contracts dengan status LUNAS/BELUM LUNAS
- **Offline support**: Queue jika jaringan tidak tersedia
- **Late payment detection**: Deteksi pembayaran terlambat berdasarkan due date

---

## 🎯 LOGIKA BARU: AUTO-BULK vs MANUAL

### **Skenario Kasus Nyata**

Misalkan hari ini (2026-05-30) adalah closing day, ada 10 kontrak yang dilaporkan lunas oleh kolektor:

```
DAFTAR KONTRAK YANG DILAPORKAN LUNAS (Batch):
┌─────────────────────────────────────────────────────────────────┐
│ Kontrak | Customer    | Total Tenor | Status        | Action    │
├─────────────────────────────────────────────────────────────────┤
│ A001    | PT ABC      | 360 hari    | ✅ LUNAS      | (auto)    │
│ A002    | PT DEF      | 360 hari    | ✅ LUNAS      | (auto)    │
│ A003    | PT GHI      | 360 hari    | ✅ LUNAS      | (auto)    │
│ A004    | PT JKL      | 360 hari    | ✅ LUNAS      | (auto)    │
│ A005    | PT MNO      | 360 hari    | ✅ LUNAS      | (auto)    │
│ A006    | PT PQR      | 360 hari    | ✅ LUNAS      | (auto)    │
│ A007    | PT STU      | 360 hari    | ⚠️  BELUM    | Belum Lunas │
│ A008    | PT VWX      | 360 hari    | ⚠️  BELUM    | Belum Lunas │
│ A009    | PT YZA      | 360 hari    | ⚠️  BELUM    | Belum Lunas │
│ A010    | PT BCD      | 360 hari    | ⚠️  BELUM    | Belum Lunas │
└─────────────────────────────────────────────────────────────────┘

HASIL PROCESSING:

1️⃣  AUTO-BULK PAYMENT (6 kontrak LUNAS)
   System otomatis catat bulk payment untuk:
   - A001: Kupon 1-360 (360 kupon) → Done ✅
   - A002: Kupon 1-360 (360 kupon) → Done ✅
   - A003: Kupon 1-360 (360 kupon) → Done ✅
   - A004: Kupon 1-360 (360 kupon) → Done ✅
   - A005: Kupon 1-360 (360 kupon) → Done ✅
   - A006: Kupon 1-360 (360 kupon) → Done ✅
   
   ✨ User TIDAK perlu input apapun, sistem handle semua!

2️⃣  MANUAL INPUT REQUIRED (4 kontrak BELUM LUNAS)
   System tampilkan di list dengan action "Belum Lunas":
   - A007: [Belum Lunas] → Click action → Open form input manual
   - A008: [Belum Lunas] → Click action → Open form input manual
   - A009: [Belum Lunas] → Click action → Open form input manual
   - A010: [Belum Lunas] → Click action → Open form input manual
   
   🔧 User bisa:
   a) Click [Belum Lunas] untuk input manually berapa kupon yang lunas
   b) Contoh A007: Input 250 kupon → System catat bulk 250 kupon untuk A007
```

---

## 🏗️ Perubahan Arsitektur

### **OLD FLOW (PaymentForm Manual)**
```
User manually input:
1. Pilih kontrak
2. Input jumlah kupon
3. Input tanggal & nominal
4. Click submit

❌ Tidak efisien untuk kontrak LUNAS (user harus set 360 kupon manual)
❌ Rawan human error (forgot input, salah nominal)
```

### **NEW FLOW (Auto-Bulk + Manifest List)**

```
PEMBAYARAN MASUK
      ↓
SISTEM ANALISIS SEMUA KONTRAK
      ├─ Cek: Apakah SEMUA kupon sudah paid?
      │
      ├─ YES (LUNAS)
      │   ├─ Auto-catat BULK PAYMENT
      │   ├─ Kupon: 1 to tenor_days
      │   ├─ Amount: daily_installment × tenor_days
      │   ├─ Notes: "Auto-bulk lunas (closing day)"
      │   └─ Status: ✅ DONE (tidak perlu user input)
      │
      └─ NO (BELUM LUNAS)
          ├─ Tampilkan di MANIFEST LIST
          ├─ Status: ⚠️  "Belum Lunas"
          ├─ Action Button: [Belum Lunas]
          ├─ User bisa click untuk input:
          │  ├─ Jumlah kupon yang lunas (e.g., 250 dari 360)
          │  ├─ Tanggal pembayaran
          │  └─ Nominal per kupon
          └─ System catat BULK untuk jumlah yang diinput
```

---

## 📊 UI Components - NEW

### **1. Contract Manifest List (Auto Status Detection)**

```
MANIFEST KONTRAK (Collected Today)
┌──────────────────────────────────────────────────────────┐
│ [Filter: All | Lunas | Belum Lunas]                      │
├──────────────────────────────────────────────────────────┤
│ Contract│Customer │Tenor│Paid│Remaining│Status│Action    │
├──────────────────────────────────────────────────────────┤
│ A001    │PT ABC   │360  │360 │0        │✅    │(Done)     │
│ A002    │PT DEF   │360  │360 │0        │✅    │(Done)     │
│ A003    │PT GHI   │360  │360 │0        │✅    │(Done)     │
│ A004    │PT JKL   │360  │360 │0        │✅    │(Done)     │
│ A005    │PT MNO   │360  │360 │0        │✅    │(Done)     │
│ A006    │PT PQR   │360  │360 │0        │✅    │(Done)     │
│ A007    │PT STU   │360  │250 │110      │⚠️   │[Belum Lunas]
│ A008    │PT VWX   │360  │200 │160      │⚠️   │[Belum Lunas]
│ A009    │PT YZA   │360  │180 │180      │⚠️   │[Belum Lunas]
│ A010    │PT BCD   │360  │100 │260      │⚠️   │[Belum Lunas]
└──────────────────────────────────────────────────────────┘

COLUMNS EXPLANATION:
- Contract: Contract ref (A001, A002, ...)
- Customer: Customer name
- Tenor: Total installments (days)
- Paid: Current installment index (sudah dibayar sampai kupon ke berapa)
- Remaining: tenor - paid (sisa kupon yang belum dibayar)
- Status: ✅ LUNAS (paid == tenor) | ⚠️ BELUM LUNAS (paid < tenor)
- Action: 
  * LUNAS: "(Done)" - no action needed
  * BELUM: "[Belum Lunas]" button - click untuk input manual
```

### **2. Logic untuk Detect Status**

```typescript
// In Manifest component
const detectStatus = (contract) => {
  const paid = contract.current_installment_index;
  const tenor = contract.tenor_days;
  const remaining = tenor - paid;
  
  return {
    isComplete: remaining === 0, // LUNAS
    paidCount: paid,
    remainingCount: remaining,
    status: remaining === 0 ? 'LUNAS' : 'BELUM_LUNAS'
  };
};

// Render action based on status
{status === 'LUNAS' ? (
  <Badge variant="success">(Done)</Badge>
) : (
  <Button onClick={() => openManualPaymentForm(contract)}>
    Belum Lunas ({remainingCount} kupon)
  </Button>
)}
```

### **3. Manual Payment Form (Belum Lunas Only)**

```
Saat user klik [Belum Lunas] button:

┌─────────────────────────────────────────────────┐
│ INPUT PEMBAYARAN BELUM LUNAS                    │
├─────────────────────────────────────────────────┤
│ Kontrak: A007 - PT STU                          │
│ Status: Sudah bayar kupon 1-250 dari 360       │
│ Sisa: 110 kupon                                 │
│                                                 │
│ Pilihan Input:                                  │
│ ○ Tambah lanjutan (input kupon ke berapa)      │
│ ○ Bayar langsung/lunas (otomatis 360)          │
│                                                 │
│ [Pilihan 1] Lanjutan:                          │
│ Kupon ke: [251] (auto-increment dari paid)     │
│ Jumlah kupon: [50]                             │
│ Tanggal pembayaran: [2026-05-30]                │
│ Nominal per kupon: [1500000]                    │
│                                                 │
│ [Pilihan 2] Lunas:                             │
│ Total kupon untuk dilunas: 360                  │
│ Dari kupon: 251 - Sampai: 360 (110 kupon)      │
│ Tanggal pembayaran: [2026-05-30]                │
│ Nominal per kupon: [1500000]                    │
│                                                 │
│ [Catat Pembayaran] [Cancel]                    │
└─────────────────────────────────────────────────┘
```

---

## 🔄 Detailed Flow - BARU

### **FLOW 1: AUTO-BULK Payment (Kontrak LUNAS)**

```
INPUT: Batch kontrak dari closing report
       [A001, A002, ..., A010]

STEP 1: Analyze each contract
   FOR each kontrak:
   ├─ Get current_installment_index (paid)
   ├─ Get tenor_days (total)
   ├─ Calculate remaining = tenor_days - current_installment_index
   │
   └─ IF remaining === 0:
       └─ CONTRACT IS LUNAS ✅

STEP 2: Auto-bulk for LUNAS contracts
   FOR each LUNAS contract:
   ├─ Calculate:
   │  ├─ start_index = current_installment_index + 1
   │  ├─ coupon_count = 0 (already paid to tenor)
   │  └─ amount_per_coupon = daily_installment_amount
   │
   └─ Call auto-createBulkPayment({
        contract_id: X,
        payment_date: TODAY,
        start_index: (already at tenor),
        coupon_count: 0,
        amount_per_coupon: daily_installment,
        collector_id: from contract,
        notes: "Auto-bulk lunas (closing report)",
      })

STEP 3: Show progress
   ├─ Toast: "6 kontrak LUNAS diproses otomatis ✅"
   ├─ Update manifest list: Mark as (Done)
   └─ Remove from "Belum Lunas" list

RESULT: ✅ DONE
   - A001-A006: All installments marked PAID
   - Activity logged: "Auto-bulk final payment"
   - No user interaction needed!
```

### **FLOW 2: MANUAL Payment (Kontrak BELUM LUNAS)**

```
INPUT: Click [Belum Lunas] on contract A007

STEP 1: Open Manual Form
   ├─ Pre-fill:
   │  ├─ Contract: A007
   │  ├─ Current paid: 250
   │  ├─ Remaining: 110
   │  ├─ Next coupon: 251
   │  └─ Max coupon: 360
   │
   └─ Show options:
      ├─ Option A: Lanjutan (input next payment count)
      └─ Option B: Lunas (input remaining count or confirm 360)

STEP 2: User Input
   Example 1 - Lanjutan:
   ├─ Jumlah kupon: 50 (user input)
   ├─ Tanggal: 2026-05-30
   ├─ Nominal: 1500000
   ├─ Calculate end = 251 + 50 - 1 = 300
   └─ Notes: "Pembayaran kupon 251-300"

   Example 2 - Lunas Langsung:
   ├─ Jumlah kupon: 110 (auto-filled)
   ├─ Tanggal: 2026-05-30
   ├─ Nominal: 1500000
   ├─ Calculate end = 251 + 110 - 1 = 360
   └─ Notes: "Auto-lunas pembayaran kupon 251-360"

STEP 3: Submit
   ├─ Validate:
   │  ├─ start_index ≥ current + 1
   │  ├─ coupon_count ≤ remaining
   │  └─ amount > 0
   │
   └─ Call createBulkPayment({
        contract_id: A007,
        payment_date: 2026-05-30,
        start_index: 251,
        coupon_count: 50,
        amount_per_coupon: 1500000,
        collector_id: ...,
        notes: "Pembayaran kupon 251-300",
      })

STEP 4: Update
   ├─ Mark A007 as updated
   ├─ Current: 250 → 300 (after option 1)
   ├─ Remaining: 110 → 60
   ├─ Status: Still ⚠️ BELUM LUNAS (unless becomes 360)
   └─ If remaining === 0 after payment:
      └─ Mark as ✅ LUNAS (Done)

RESULT: ✅ 50 kupon dicatat
   - Activity logged: "Manual bulk payment 251-300"
   - A007 dapat diupdate lagi jika masih ada sisa
```

---

## 💾 Database Schema - NEW

### **Key Tables untuk Logic Baru**

```
credit_contracts:
├─ id: UUID
├─ contract_ref: STRING (A001, A007, ...)
├─ tenor_days: INTEGER (360, ...)
├─ current_installment_index: INTEGER (paid so far)
├─ daily_installment_amount: NUMERIC
└─ collector_id: UUID

installment_coupons:
├─ id: UUID
├─ contract_id: UUID
├─ installment_index: INTEGER (1, 2, 3, ..., 360)
├─ due_date: DATE
├─ status: ENUM('unpaid', 'paid')
└─ amount: NUMERIC

payment_logs:
├─ id: UUID
├─ contract_id: UUID
├─ payment_date: DATE
├─ installment_index: INTEGER
├─ amount_paid: NUMERIC
├─ collector_id: UUID
└─ notes: TEXT
```

### **Computation untuk Status Detection**

```sql
-- Detect LUNAS contracts
SELECT 
  cc.id,
  cc.contract_ref,
  cc.tenor_days,
  cc.current_installment_index as paid,
  (cc.tenor_days - cc.current_installment_index) as remaining,
  CASE 
    WHEN cc.current_installment_index >= cc.tenor_days THEN 'LUNAS'
    ELSE 'BELUM_LUNAS'
  END as status
FROM credit_contracts cc
WHERE cc.status != 'returned'
ORDER BY remaining DESC;

RESULT:
┌────────────────────────────────────────────────────┐
│ id  │ ref  │ tenor │ paid │ remaining │ status      │
├────────────────────────────────────────────────────┤
│ 001 │ A001 │ 360  │ 360  │ 0        │ LUNAS       │
│ 002 │ A002 │ 360  │ 360  │ 0        │ LUNAS       │
│ 007 │ A007 │ 360  │ 250  │ 110      │ BELUM_LUNAS │
│ 008 │ A008 │ 360  │ 200  │ 160      │ BELUM_LUNAS │
└────────────────────────────────────────────────────┘
```

---

## 🎯 Implementation Tasks

### **Komponen Baru Diperlukan:**

```
1. ContractManifestWithAutoDetection Component
   ├─ Display all contracts
   ├─ Auto-detect LUNAS vs BELUM_LUNAS status
   ├─ Show action buttons per status
   └─ Filter options (All, Lunas, Belum Lunas)

2. ManualPaymentForm (Revised)
   ├─ Pre-fill contract details
   ├─ Show remaining kupon
   ├─ Option A: Lanjutan (next payment)
   ├─ Option B: Lunas (complete payment)
   └─ Calculate automatically

3. AutoBulkPaymentService
   ├─ Detect LUNAS contracts
   ├─ Generate bulk payment payloads
   ├─ Execute batch insert (if all payments at once)
   └─ Log activity for each auto-payment

4. Utility Functions
   ├─ detectContractStatus(contract)
   ├─ calculateRemainingCoupons(paid, tenor)
   ├─ generateAutoPaymentNote(isLunas, status)
   └─ validateManualPaymentInput(input, contract)
```

---

## 📝 Contoh Kasus Lengkap

### **Skenario: Closing Day 30 Mei 2026**

**Input dari Kolektor:**
```
Daftar kontrak yang dikumpulkan:
- A001 s/d A010 (10 kontrak)
```

**Sistem Processing:**

```
STEP 1: ANALYZE
   Scan semua 10 kontrak:
   ├─ A001: tenor=360, current=360, remaining=0 → LUNAS ✅
   ├─ A002: tenor=360, current=360, remaining=0 → LUNAS ✅
   ├─ A003: tenor=360, current=360, remaining=0 → LUNAS ✅
   ├─ A004: tenor=360, current=360, remaining=0 → LUNAS ✅
   ├─ A005: tenor=360, current=360, remaining=0 → LUNAS ✅
   ├─ A006: tenor=360, current=360, remaining=0 → LUNAS ✅
   ├─ A007: tenor=360, current=250, remaining=110 → BELUM ⚠️
   ├─ A008: tenor=360, current=200, remaining=160 → BELUM ⚠️
   ├─ A009: tenor=360, current=180, remaining=180 → BELUM ⚠️
   └─ A010: tenor=360, current=100, remaining=260 → BELUM ⚠️

STEP 2: AUTO-PROCESS LUNAS (6 kontrak)
   System auto-execute:
   ├─ A001: Catat bulk (sudah lengkap, no new payment)
   ├─ A002: Catat bulk (sudah lengkap, no new payment)
   ├─ A003: Catat bulk (sudah lengkap, no new payment)
   ├─ A004: Catat bulk (sudah lengkap, no new payment)
   ├─ A005: Catat bulk (sudah lengkap, no new payment)
   └─ A006: Catat bulk (sudah lengkap, no new payment)
   
   ✅ DONE - 6 contracts processed automatically

STEP 3: DISPLAY BELUM LUNAS (4 kontrak)
   Show manifest list:
   ├─ A007: [Belum Lunas - 110 kupon sisa] ← User click untuk input
   ├─ A008: [Belum Lunas - 160 kupon sisa] ← User click untuk input
   ├─ A009: [Belum Lunas - 180 kupon sisa] ← User click untuk input
   └─ A010: [Belum Lunas - 260 kupon sisa] ← User click untuk input

STEP 4: USER INPUT MANUAL (A007 example)
   User: Click [Belum Lunas] on A007
   
   Form options:
   Option A - Lanjutan (bayar sebagian):
   ├─ Input: "Bayar 50 kupon lebih"
   ├─ Next: Kupon 251-300
   ├─ Amount: 50 × 1500000 = 75.000.000
   └─ Status: Masih BELUM (110-50=60 sisa)

   Option B - Lunas (bayar semua sisa):
   ├─ Input: "Bayar 110 kupon sisa"
   ├─ Next: Kupon 251-360
   ├─ Amount: 110 × 1500000 = 165.000.000
   └─ Status: Jadi LUNAS ✅

   User pilih Option B:
   ├─ System generate bulk payment: start=251, count=110
   ├─ Insert 110 payment records (satu per kupon)
   ├─ Update A007 current_installment_index = 360
   ├─ Mark all coupons 251-360 as 'paid'
   └─ Activity log: "Manual-lunas A007: kupon 251-360 (110 kupon)"

FINAL RESULT:
┌─────────────────────────────────┐
│ Ringkasan Pembayaran:           │
├─────────────────────────────────┤
│ ✅ Auto-lunas: 6 kontrak        │
│ ⚠️  Manual-lunas: 1 kontrak (A007)
│ ⚠️  Masih belum: 3 kontrak      │
│                                 │
│ Total: 10 kontrak               │
└─────────────────────────────────┘

Manifest updated:
┌──────────────────────────────────────────────┐
│ A001 │ PT ABC  │ 360│360│0  │✅ LUNAS  │Done │
│ A002 │ PT DEF  │ 360│360│0  │✅ LUNAS  │Done │
│ A003 │ PT GHI  │ 360│360│0  │✅ LUNAS  │Done │
│ A004 │ PT JKL  │ 360│360│0  │✅ LUNAS  │Done │
│ A005 │ PT MNO  │ 360│360│0  │✅ LUNAS  │Done │
│ A006 │ PT PQR  │ 360│360│0  │✅ LUNAS  │Done │
│ A007 │ PT STU  │ 360│360│0  │✅ LUNAS  │Done │ ← Updated
│ A008 │ PT VWX  │ 360│200│160│⚠️ BELUM │[BL] │
│ A009 │ PT YZA  │ 360│180│180│⚠️ BELUM │[BL] │
│ A010 │ PT BCD  │ 360│100│260│⚠️ BELUM │[BL] │
└──────────────────────────────────────────────┘
```

---

## ✅ Keuntungan Logika Baru

| Aspek | OLD (Manual) | NEW (Auto+Manual) |
|-------|------------|------------------|
| **Input untuk kontrak LUNAS** | User harus input 360 kupon manual ❌ | Otomatis, 0 input user ✅ |
| **Error rate** | Tinggi (human error) ❌ | Rendah (auto-process) ✅ |
| **Efisiensi** | Lambat (input satu-satu) ❌ | Cepat (batch process) ✅ |
| **Focus User** | Semua kontrak | Hanya BELUM LUNAS ⚠️ |
| **Clarity** | Membingungkan | Jelas: LUNAS vs BELUM ✅ |
| **Speed** | 1 kontrak LUNAS ≈ 2 menit | 1 kontrak LUNAS ≈ 0 menit ✅ |

---

## 🚨 Validasi & Error Handling

```
Saat Auto-Process LUNAS:
├─ Cek: Apakah sudah semua kupon paid? 
│  └─ Jika tidak semua: SKIP (tampilkan sebagai BELUM)
├─ Cek: Apakah data integrity ok?
│  └─ Jika error: Fallback ke queue, notify user
└─ Success: Mark as processed

Saat Manual Input BELUM LUNAS:
├─ Validasi: start_index harus > current_installment_index
├─ Validasi: coupon_count ≤ remaining
├─ Validasi: amount > 0
└─ Validasi: payment_date valid
```

---

## 📋 Ringkasan Cepat (TL;DR)

**Lama:** User input manual semua pembayaran (single atau bulk)  
**Sekarang:** 
- ✅ **LUNAS**: Sistem otomatis catat, user tidak perlu input apapun
- ⚠️ **BELUM LUNAS**: User click "Belum Lunas" → input manual jumlah kupon yang dibayar

**Benefit:**
- Kontrak LUNAS 0 input → Instant processing
- Fokus user hanya pada kontrak yang belum lunas
- Error minimal (auto untuk LUNAS)
- Speed 10x lebih cepat

### **FLOW 1: Auto-Process (Kontrak LUNAS)**
```
System detects: remaining_coupons === 0
    ↓
Auto-execute bulk payment
    ├─ No user input needed
    ├─ Payment logged as "Auto-lunas"
    └─ Mark as ✅ DONE
    ↓
Show success notification
├─ "6 kontrak LUNAS diproses otomatis ✅"
└─ Update manifest list instantly
```

### **FLOW 2: Manual Input (Kontrak BELUM LUNAS)**
```
User sees: [Belum Lunas] button on manifest
    ↓
User clicks: [Belum Lunas - NN kupon sisa]
    ↓
Manual payment form opens
├─ Pre-fill: Contract, current paid, remaining, next coupon
├─ Show 2 options:
│  ├─ Lanjutan: Input partial payment (N kupon)
│  └─ Lunas: Input remaining (atau auto confirm semua)
│
└─ User select option & enter amount
    ↓
Validation
├─ start_index ≥ current + 1 ✓
├─ coupon_count ≤ remaining ✓
└─ amount > 0 ✓
    ↓
Submit bulk payment
├─ If ONLINE: createBulkPayment.mutateAsync(data)
├─ If OFFLINE: addToQueue('bulk_payment', data)
└─ Update manifest & show success
    ↓
Contract status updated:
├─ A007: current 250 → 300 (after lanjutan)
├─ Remaining: 110 → 60
└─ Still ⚠️ BELUM LUNAS (until 360)
```

---

## � Related Hooks & Functions (Updated)

| Function | File | Purpose |
|----------|------|---------|
| `detectContractStatus()` | (NEW) `utils/paymentStatus.ts` | Detect LUNAS vs BELUM LUNAS |
| `autoProcessLunasContracts()` | (NEW) `services/autoBulkPayment.ts` | Auto-execute for LUNAS |
| `useCreateBulkPayment()` | `usePayments.ts` | Create bulk payment (both auto & manual) |
| `calculateRemainingCoupons()` | (NEW) `utils/paymentStatus.ts` | Get remaining = tenor - paid |
| `validateManualPaymentInput()` | (NEW) `utils/paymentValidation.ts` | Validate user input |
| `useLastPaymentDate()` | `useLastPaymentDate.ts` | Fetch last payment (untuk late detection) |
| `useNextCouponDueDate()` | `useLastPaymentDate.ts` | Fetch next due date |
| `calculateLateNoteFromDueDate()` | `useLastPaymentDate.ts` | Late calculation (still needed for manual) |
| `addToQueue()` | `offlineQueue.ts` | Queue if offline |

---

## 📊 Perubahan Component (Summary)

| Component | OLD | NEW |
|-----------|-----|-----|
| **PaymentForm.tsx** | Manual input semua | REMOVED (hanya manual untuk BELUM LUNAS) |
| **Collection.tsx** | Manual form + payments | Manifest list + auto + manual form |
| **(NEW) ContractManifest.tsx** | N/A | List kontrak dengan status LUNAS/BELUM |
| **(NEW) ManualPaymentModal.tsx** | N/A | Form manual untuk BELUM LUNAS only |
| **(NEW) AutoBulkService.ts** | N/A | Service untuk auto-process LUNAS |

---

## 🎯 Implementation Priority

```
PRIORITY 1 (Critical):
├─ ContractManifest component dengan status detection
├─ detectContractStatus() utility function
└─ Display LUNAS vs BELUM LUNAS properly

PRIORITY 2 (Core):
├─ ManualPaymentModal untuk BELUM LUNAS
├─ autoProcessLunasContracts() service
└─ Integration dengan Collection page

PRIORITY 3 (Enhancement):
├─ Late payment detection (untuk manual)
├─ Offline support (queue handling)
└─ Activity logging
```

---

**Last Updated:** May 30, 2026  
**Status:** Design Approved - Ready for Development
