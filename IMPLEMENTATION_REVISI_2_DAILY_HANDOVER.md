# IMPLEMENTATION GUIDE: PAYMENT LOGIC REVISI 2
## Daily Handover-Based Payment Entry

---

## 🎯 QUICK START: Apa yang Berubah?

**Dari:**
```
Tab Input Pembayaran → Manual input all contracts (arbitrary)
```

**Menjadi:**
```
Tab Belum Bayar (Handover) → Kupon disetor hari ini
              ↓ (Reference)
Tab Input Pembayaran → Catat pembayaran dari kupon handover
              ├─ Auto untuk LUNAS (remaining = 0)
              └─ Manual untuk BELUM (remaining > 0)
```

---

## 📐 DATA FLOW: Daily Handover → Payment Entry

```
MORNING (Handover):
┌────────────────────────┐
│ Kolektor serah kupon   │
│ A001-A010 (10 kontrak) │
└────────────┬───────────┘
             ↓
    ┌────────────────────────┐
    │ System record:         │
    │ coupon_handovers       │
    │ - handover_date: TODAY │
    │ - kontrak: A001-A010   │
    │ - kupon: 1-360 each    │
    └────────────┬───────────┘
                 ↓
             ┌──────────────────┐
             │ UI Tab:          │
             │ "Belum Bayar"    │
             │ Shows: 10 kontrak│
             └──────────────────┘

AFTERNOON (Payment Entry):
                 ↓ (Reference)
    ┌────────────────────────┐
    │ Input Pembayaran:      │
    │ Filter: FROM handover  │
    │ Detect: LUNAS/BELUM    │
    │ Process: Auto + Manual │
    └────────────┬───────────┘
                 ↓
    ┌────────────────────────┐
    │ System record:         │
    │ payment_logs           │
    │ + handover_id (FK)     │
    │ Status: PAID           │
    └────────────┬───────────┘
                 ↓
             ┌──────────────────┐
             │ Reconciliation:  │
             │ Handover = Paid? │
             │ ✅ or ⚠️ pending │
             └──────────────────┘
```

---

## 🗄️ DATABASE SCHEMA CHANGES

### **NEW TABLE: coupon_handovers**
```sql
CREATE TABLE coupon_handovers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    collector_id UUID NOT NULL REFERENCES collectors(id),
    handover_date DATE NOT NULL DEFAULT CURRENT_DATE,
    handover_type VARCHAR(50), -- 'daily', 'weekly'
    total_coupons INT,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'reconciled', 'partial'
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_coupon_handovers_date ON coupon_handovers(handover_date);
CREATE INDEX idx_coupon_handovers_collector ON coupon_handovers(collector_id);
```

### **NEW TABLE: handover_coupon_details**
```sql
CREATE TABLE handover_coupon_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    handover_id UUID NOT NULL REFERENCES coupon_handovers(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES credit_contracts(id),
    coupon_range_start INT, -- Starting coupon index
    coupon_range_end INT,   -- Ending coupon index
    coupon_count INT,       -- Total coupons for this contract
    amount_total DECIMAL(15, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_handover_details_handover ON handover_coupon_details(handover_id);
CREATE INDEX idx_handover_details_contract ON handover_coupon_details(contract_id);
```

### **MODIFIED TABLE: payment_logs**
```sql
-- Add handover reference
ALTER TABLE payment_logs ADD COLUMN handover_id UUID REFERENCES coupon_handovers(id);
ALTER TABLE payment_logs ADD COLUMN is_auto_processed BOOLEAN DEFAULT false;
ALTER TABLE payment_logs ADD COLUMN reconciliation_date TIMESTAMP;

CREATE INDEX idx_payment_logs_handover ON payment_logs(handover_id);
```

### **DATA RELATIONSHIPS**
```
coupon_handovers
  ├─ 1:N → handover_coupon_details (detail kontrak di handover)
  ├─ 1:N → payment_logs (pembayaran dari handover)
  └─ FK → collectors

handover_coupon_details
  ├─ N:1 → coupon_handovers
  └─ N:1 → credit_contracts

payment_logs (updated)
  ├─ N:1 → coupon_handovers (reference)
  └─ is_auto_processed flag
```

---

## 🧠 CORE LOGIC CHANGES

### **LOGIC 1: Detect Contract Status (LUNAS vs BELUM)**

**Input:** Contract from handover  
**Process:**
```javascript
function detectContractStatus(contract, handover) {
  // Get handover detail untuk kontrak ini
  const handoverDetail = getHandoverDetail(handover.id, contract.id);
  
  // Hitung sisa kupon
  const couponsPaid = contract.current_installment_index - 1;
  const totalCoupons = contract.tenor_days; // or dari contract.durations
  const couponRemaining = totalCoupons - couponsPaid;
  
  // Determine status
  if (couponRemaining === 0) {
    return {
      status: 'LUNAS',
      remaining: 0,
      action: 'AUTO_PROCESS'
    };
  } else {
    return {
      status: 'BELUM_LUNAS',
      remaining: couponRemaining,
      action: 'MANUAL_INPUT'
    };
  }
}
```

**Output:**
```javascript
{
  status: 'LUNAS' | 'BELUM_LUNAS',
  remaining: number,
  action: 'AUTO_PROCESS' | 'MANUAL_INPUT'
}
```

---

### **LOGIC 2: Auto-Process LUNAS Contracts**

**Trigger:** When Input Pembayaran tab loads  
**Process:**
```javascript
async function autoProcessLunasContracts(handover) {
  // 1. Get all kontrak from handover
  const contracts = await getHandoverContracts(handover.id);
  
  // 2. Detect status for each
  const lunas = contracts.filter(c => detectContractStatus(c).status === 'LUNAS');
  const belum = contracts.filter(c => detectContractStatus(c).status === 'BELUM_LUNAS');
  
  // 3. For LUNAS: Auto-generate payment records
  const autoPayments = lunas.map(contract => {
    const handoverDetail = getHandoverDetail(handover.id, contract.id);
    
    return {
      contract_id: contract.id,
      handover_id: handover.id,
      payment_date: handover.handover_date,
      collector_id: handover.collector_id,
      installment_index: contract.current_installment_index,
      coupon_count: handoverDetail.coupon_count,
      amount_paid: handoverDetail.amount_total,
      payment_method: 'auto_bulk',
      is_auto_processed: true,
      notes: `Auto-processed from handover ${handover.id}`
    };
  });
  
  // 4. Batch insert payments
  await batchInsertPayments(autoPayments);
  
  // 5. Update contract status
  await Promise.all(
    lunas.map(c => updateContractStatus(c.id, 'PAID_COMPLETE'))
  );
  
  // 6. Return: untuk UI display
  return {
    auto_count: lunas.length,
    manual_count: belum.length,
    auto_processed: autoPayments,
    pending_manual: belum
  };
}
```

**Result:**
```javascript
{
  auto_count: 6,           // 6 kontrak LUNAS
  manual_count: 4,         // 4 kontrak BELUM
  auto_processed: [
    {payment_1...},
    {payment_2...},
    ...
  ],
  pending_manual: [
    {contract_A007...},
    {contract_A008...},
    ...
  ]
}
```

---

### **LOGIC 3: Manual Input for BELUM LUNAS**

**Trigger:** User clicks [Belum Lunas] action button  
**Process:**
```javascript
async function handleManualPaymentInput(contract, handover, userInput) {
  // 1. Validate input
  const validation = validatePaymentInput({
    contract,
    handover,
    coupon_count: userInput.coupon_count,
    amount: userInput.amount
  });
  
  if (!validation.valid) {
    return { error: validation.errors };
  }
  
  // 2. Determine payment type
  const couponRemaining = contract.tenor_days - contract.current_installment_index;
  const paymentType = userInput.coupon_count === couponRemaining ? 'LUNAS' : 'LANJUTAN';
  
  // 3. Create payment record
  const payment = {
    contract_id: contract.id,
    handover_id: handover.id,
    payment_date: handover.handover_date,
    collector_id: handover.collector_id,
    installment_index: contract.current_installment_index,
    coupon_count: userInput.coupon_count,
    amount_paid: userInput.amount,
    payment_method: paymentType, // 'LUNAS' or 'LANJUTAN'
    is_auto_processed: false,
    user_notes: userInput.notes,
    notes: `Manual input - ${paymentType}`
  };
  
  // 4. Insert payment
  const paymentId = await insertPayment(payment);
  
  // 5. Update contract
  await updateContract(contract.id, {
    current_installment_index: contract.current_installment_index + userInput.coupon_count,
    last_payment_date: handover.handover_date
  });
  
  // 6. If LUNAS: Update contract status
  if (paymentType === 'LUNAS') {
    await updateContractStatus(contract.id, 'PAID_COMPLETE');
  }
  
  return { success: true, payment_id: paymentId };
}
```

---

### **LOGIC 4: Reconciliation (Handover vs Payment)**

**Trigger:** End of day or manual check  
**Process:**
```javascript
async function reconcileHandover(handover) {
  // 1. Get all detail kontrak di handover
  const handoverDetails = await getHandoverDetails(handover.id);
  
  // 2. Get all payment dari handover
  const payments = await getPaymentsFromHandover(handover.id);
  
  // 3. For each kontrak: check if fully paid
  const reconciliation = handoverDetails.map(detail => {
    const contractPayments = payments.filter(p => p.contract_id === detail.contract_id);
    const totalPaid = contractPayments.reduce((sum, p) => sum + p.coupon_count, 0);
    
    return {
      contract_id: detail.contract_id,
      handover_coupons: detail.coupon_count,
      paid_coupons: totalPaid,
      remaining_coupons: detail.coupon_count - totalPaid,
      status: totalPaid === detail.coupon_count ? 'COMPLETE' : 'PENDING',
      payments: contractPayments
    };
  });
  
  // 4. Calculate summary
  const summary = {
    total_contracts: reconciliation.length,
    complete: reconciliation.filter(r => r.status === 'COMPLETE').length,
    pending: reconciliation.filter(r => r.status === 'PENDING').length,
    total_coupons_handover: handoverDetails.reduce((sum, d) => sum + d.coupon_count, 0),
    total_coupons_paid: payments.reduce((sum, p) => sum + p.coupon_count, 0)
  };
  
  // 5. Update handover status
  const handoverStatus = summary.pending === 0 ? 'reconciled' : 'partial';
  await updateHandoverStatus(handover.id, handoverStatus);
  
  return { reconciliation, summary };
}
```

---

## 🖥️ COMPONENT ARCHITECTURE

### **COMPONENT 1: Belum Bayar Tab (Handover Display)**

**File:** `src/pages/Collection.tsx` → Add Tab or `src/components/BelumBayarTab.tsx`

**Purpose:** Display kupon yang disetor hari ini

**Props:**
```typescript
interface BelumBayarTabProps {
  handover: IHandover;
  collector: ICollector;
}
```

**Features:**
- Display date: "Kupon Disetor: 2026-05-30"
- List: Kontrak, Kupon, Amount
- Summary: "10 kontrak, 3600 kupon total"
- Status indicator: All UNPAID

**UI:**
```
┌──────────────────────────────────────────────┐
│ BELUM BAYAR (Handover - 2026-05-30)          │
├──────────────────────────────────────────────┤
│ Kontrak │ Customer      │ Kupon  │ Amount    │
├──────────────────────────────────────────────┤
│ A001    │ PT ABC        │ 1-360  │ Rp 36.0M  │
│ A002    │ PT DEF        │ 1-360  │ Rp 36.0M  │
│ A003    │ PT GHI        │ 1-360  │ Rp 36.0M  │
│ ...     │ ...           │ ...    │ ...       │
│ A010    │ PT BCD        │ 1-360  │ Rp 36.0M  │
├──────────────────────────────────────────────┤
│ Total: 10 kontrak │ 3600 kupon │ 360.0M    │
└──────────────────────────────────────────────┘
```

---

### **COMPONENT 2: Input Pembayaran Tab (Filtered by Handover)**

**File:** `src/pages/Collection.tsx` → Updated Tab

**Purpose:** Input pembayaran dari kupon yang sudah disetor

**Props:**
```typescript
interface InputPembayaranTabProps {
  handover: IHandover;
  pendingManual: IContract[];
  autoProcessed: IPayment[];
}
```

**Features:**
1. **Summary Card:**
   ```
   Handover: 10 kontrak | Auto: 6 ✅ | Manual: 4 ⚠️
   ```

2. **Auto-Processed Section:**
   ```
   ✅ LUNAS (Auto-Processed) - 6
   ├─ A001 PT ABC    360/360 ✅
   ├─ A002 PT DEF    360/360 ✅
   ├─ A003 PT GHI    360/360 ✅
   ├─ A004 PT JKL    360/360 ✅
   ├─ A005 PT MNO    360/360 ✅
   └─ A006 PT PQR    360/360 ✅
   ```

3. **Manual Input Section:**
   ```
   ⚠️ BELUM LUNAS (Manual Input) - 4
   ├─ A007 PT STU    250/360 [Belum Lunas - 110]
   ├─ A008 PT VWX    200/360 [Belum Lunas - 160]
   ├─ A009 PT YZA    180/360 [Belum Lunas - 180]
   └─ A010 PT BCD    100/360 [Belum Lunas - 260]
   ```

---

### **COMPONENT 3: Manual Payment Modal**

**File:** `src/components/ManualPaymentModal.tsx`

**Purpose:** Form untuk input pembayaran BELUM LUNAS

**Props:**
```typescript
interface ManualPaymentModalProps {
  contract: IContract;
  handover: IHandover;
  onSubmit: (input: IPaymentInput) => Promise<void>;
  onCancel: () => void;
}
```

**Form Fields:**
```
├─ Contract Info (Read-only):
│  ├─ Contract ID: A007
│  ├─ Customer: PT STU
│  ├─ Paid: 250/360
│  └─ Remaining: 110
│
├─ Payment Input:
│  ├─ Payment Method: ◉ Lanjutan ◯ Lunas
│  ├─ Kupon Count: [___] (1-110)
│  └─ Amount: Rp [___________] (auto-calculate)
│
└─ Actions:
   ├─ [Submit] → Process
   └─ [Cancel]
```

**Logic:**
- If "Lanjutan": Allow 1 to remaining_count
- If "Lunas": Auto-fill remaining_count
- Auto-calculate amount based on daily_installment_amount

---

### **COMPONENT 4: Reconciliation Card**

**File:** `src/components/ReconciliationCard.tsx` or Tab

**Purpose:** Show status handover vs payment

**Features:**
```
RECONCILIATION (Handover 2026-05-30)

Status: ✅ COMPLETE (All paid)

├─ A001: ✅ 360/360 paid
├─ A002: ✅ 360/360 paid
├─ ...
├─ A007: ⏳ 310/360 paid (50 pending)
├─ ...
└─ A010: ⏳ 260/360 paid (100 pending)

Summary:
├─ Total Coupons: 3600
├─ Paid: 3400
├─ Pending: 200
└─ Completion: 94.4%
```

---

## 🔄 WORKFLOW SEQUENCE

### **SEQUENCE 1: Morning (Handover)**
```
1. Kolektor serah kupon
   → Manual entry atau system import
   
2. Create coupon_handovers record
   ├─ collector_id
   ├─ handover_date: TODAY
   └─ handover_type: 'daily'
   
3. Create handover_coupon_details
   ├─ contract_id: A001-A010
   ├─ coupon_range_start, end
   └─ amount_total per kontrak
   
4. UI Display: Tab "Belum Bayar"
   └─ Show: 10 kontrak dari handover
```

---

### **SEQUENCE 2: Afternoon (Payment Entry)**
```
1. User go to Tab: Input Pembayaran
   
2. System auto-load handover (TODAY)
   ├─ Filter: handover_date = TODAY
   └─ Get: handover_coupon_details
   
3. System detect status untuk setiap kontrak
   ├─ LUNAS (6): remaining = 0
   └─ BELUM (4): remaining > 0
   
4. AUTO-PROCESS LUNAS:
   ├─ Generate payment_logs (6 records)
   ├─ is_auto_processed = true
   ├─ payment_date = TODAY
   ├─ Batch insert
   └─ Show: "6 Auto-processed ✅"
   
5. Manual input BELUM:
   ├─ Show [Belum Lunas] buttons (4)
   ├─ User click A007 → Modal form
   ├─ User input: 50 kupon, Rp...
   ├─ System insert payment_logs
   ├─ Update contract.current_installment_index
   └─ Repeat for A008, A009, A010
```

---

### **SEQUENCE 3: End of Day (Reconciliation)**
```
1. Manual or auto: Run reconciliation
   
2. For handover TODAY:
   ├─ Get: handover_coupon_details (10 kontrak, 3600 kupon)
   ├─ Get: payment_logs from handover (auto + manual)
   ├─ Calculate: paid vs handover
   
3. Check each kontrak:
   ├─ A001-A006: 360/360 ✅ Complete
   ├─ A007: 310/360 ⏳ Pending 50
   ├─ A008: 360/360 ✅ Complete
   ├─ A009: 180/360 ⏳ Pending 180
   └─ A010: 260/360 ⏳ Pending 100
   
4. Update handover status:
   ├─ Total: 10 kontrak
   ├─ Complete: 7
   ├─ Pending: 3
   └─ Status: 'partial'
   
5. Create report:
   └─ "7 dari 10 kontrak sudah lunas, 3 pending"
```

---

## 📋 IMPLEMENTATION CHECKLIST

### **Phase 1: Database (2-3 days)**
- [ ] Create coupon_handovers table
- [ ] Create handover_coupon_details table
- [ ] Modify payment_logs (add handover_id, is_auto_processed)
- [ ] Create indexes
- [ ] Create migration script
- [ ] Run migration & verify

### **Phase 2: Backend Logic (5-7 days)**
- [ ] Implement detectContractStatus()
- [ ] Implement autoProcessLunasContracts()
- [ ] Implement handleManualPaymentInput()
- [ ] Implement reconcileHandover()
- [ ] Create API endpoints:
  - [ ] GET /handovers/today
  - [ ] POST /handovers/create
  - [ ] POST /payments/auto-process
  - [ ] POST /payments/manual-input
  - [ ] GET /reconciliation/:handover_id

### **Phase 3: Frontend Components (7-10 days)**
- [ ] BelumBayarTab.tsx (display handover)
- [ ] InputPembayaranTab.tsx (updated - filtered by handover)
- [ ] ManualPaymentModal.tsx (form for BELUM)
- [ ] ReconciliationCard.tsx (status display)
- [ ] Hooks: useHandovers(), useAutoProcessPayments(), useReconciliation()

### **Phase 4: Integration & Testing (5-7 days)**
- [ ] Integrate components with Collection page
- [ ] Test workflow: Morning → Auto → Manual → Reconcile
- [ ] Test validation: Payment must from handover
- [ ] Test edge cases: Partial payment, multiple days
- [ ] Test offline queue
- [ ] User acceptance testing

### **Phase 5: Deployment & Monitoring (2-3 days)**
- [ ] Code review
- [ ] Merge to main branch
- [ ] Deploy to staging
- [ ] Monitor & verify
- [ ] Deploy to production

---

## 🚨 VALIDATION RULES

### **Payment Input Validation:**
```javascript
const rules = {
  // 1. Kontrak must be dari TODAY's handover
  contract_in_handover: {
    rule: "payment.contract_id must exist in handover_coupon_details",
    error: "Kontrak tidak ada di handover hari ini"
  },
  
  // 2. Kupon count must be valid
  kupon_count_valid: {
    rule: "1 <= kupon_count <= remaining_coupons",
    error: "Jumlah kupon tidak valid"
  },
  
  // 3. Amount must match calculation
  amount_valid: {
    rule: "amount = kupon_count * daily_installment_amount",
    error: "Nominal pembayaran tidak sesuai"
  },
  
  // 4. Status consistency
  status_consistency: {
    rule: "If kupon_count == remaining → status must be LUNAS",
    error: "Status pembayaran tidak konsisten"
  }
};
```

---

**Document:** Implementation Guide Revisi 2  
**Created:** May 30, 2026  
**Status:** READY FOR DEVELOPMENT

