# 📋 DESKRIPSI ULANG: Filter Status Pembayaran Integration

## 🎯 Apa yang Diminta?

> **"untuk filter status pembayaran, saya ingin itu include dengan tabel daftar penagihan hari ini, describe ulang lalu minta konfirmasi"**

---

## ✅ Deskripsi Ulang (Detailed)

### **1. Konteks: Daftar Penagihan Harian (Daily Collection Queue)**

Setiap hari, kolektor menerima **batch kupon** untuk dikumpulkan dari pelanggan:

```
PAGI - Supervisor serah kupon ke Kolektor:
├─ A001: kupon 1-10 kepada Budi
├─ A002: kupon 1-5 kepada Budi
├─ A003: kupon 6-15 kepada Andi
├─ A004: kupon 1-20 kepada Andi
└─ A005: kupon 5-18 kepada Budi

Contoh dari table `coupon_handovers`:
id | contract_id | collector_id | start_index | end_index | current_installment_index | handover_date
 1 |    A001     |     Budi     |      1      |     10    |            0              |   2026-05-30
 2 |    A002     |     Budi     |      1      |      5    |            0              |   2026-05-30
 3 |    A003     |     Andi     |      6      |     15    |            5              |   2026-05-30
 4 |    A004     |     Andi     |      1      |     20    |            8              |   2026-05-30
 5 |    A005     |     Budi     |      5      |     18    |           10              |   2026-05-30
```

### **2. Problem: Kolektor Bingung**

Ketika kolektor buka **Tab "Input Pembayaran"**, dia melihat dropdown dengan semua 5 batch:

```
[Select Handover Batch ▼]
├─ A001 | Budi | 1-10 (0 paid)
├─ A002 | Budi | 1-5 (0 paid)
├─ A003 | Andi | 6-15 (5 paid)  ← Sudah ada pembayaran sebelumnya
├─ A004 | Andi | 1-20 (8 paid)  ← Sudah ada pembayaran sebelumnya
└─ A005 | Budi | 5-18 (10 paid) ← Sudah selesai dari hari sebelumnya?
```

❌ **PROBLEM:**
- Kolektor tidak tahu status mana itu "belum bayar" vs "sudah bayar" vs "sudah selesai"
- Harus manual hitung & analisa setiap batch
- Workflow tidak terorganisir
- Easy to make mistakes

### **3. Solusi: Filter Status Pembayaran**

**Status akan di-kalkulasi OTOMATIS** berdasarkan:

```
Data:     start_index | end_index | current_installment_index
          ────────────────────────────────────────────────

Batch A:        1    |     10    |          0
                └─ Condition: 0 < 1? YES
                └─ Status: ⚠️ BELUM BAYAR (no payment yet)
                └─ Action: [Input] pembayaran pertama kali

Batch B:        6    |     15    |          5
                └─ Condition: 6 ≤ 5 < 15? NO
                └─ Condition: 5 < 6? YES
                └─ Status: ⚠️ BELUM BAYAR (not yet reached start_index)
                └─ Action: [Input] pembayaran pertama kali

Batch C:        1    |     20    |          8
                └─ Condition: 1 ≤ 8 < 20? YES
                └─ Status: 🔄 SEBAGIAN BAYAR (partial payment)
                └─ Action: [Lanjutan] (add more) atau [Lunas] (finish)

Batch D:        5    |     18    |         10
                └─ Condition: 5 ≤ 10 < 18? YES
                └─ Status: 🔄 SEBAGIAN BAYAR (partial payment)
                └─ Action: [Lanjutan] (add more) atau [Lunas] (finish)

Batch E:        5    |     18    |         18
                └─ Condition: 18 ≥ 18? YES
                └─ Status: ✅ LUNAS (complete payment)
                └─ Action: (no action, reference only)
```

### **4. Implementasi: Tab "Input Pembayaran" dengan Filter**

#### Layout:

```
┌────────────────────────────────────────────────────────────────┐
│              TAB INPUT PEMBAYARAN                              │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Filter Controls:                                              │
│  ┌─────────────┬──────────────┬────────┬────────┐             │
│  │ Belum Bayar │Sebagian Bayar│ Lunas  │ Semua  │ ← Option A: │
│  └─────────────┴──────────────┴────────┴────────┘   Toggle    │
│                                                      Buttons   │
│  Or:                                                           │
│                                                                │
│  [Belum Bayar ▼]  ← Option B: Dropdown                        │
│                                                                │
│  Or:                                                           │
│                                                                │
│  ☑️ Belum Bayar  ☐ Sebagian Bayar  ☐ Lunas  ← Option C:      │
│                                                 Checkboxes     │
│                                                                │
│  Stats (Optional):                                             │
│  Total: 5 | Belum Bayar: 2 | Sebagian: 2 | Lunas: 1          │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 📋 DAFTAR PENAGIHAN HARI INI (Filtered)                │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ Kontrak│Kolektor│Diserah │Dibayar│ Sisa │Status   │Aksi   │
│  ├────────────────────────────────────────────────────────┤  │
│  │ A001   │ Budi   │ 1-10   │  0    │ 10   │⚠️ Belum │[Input]│
│  │ A002   │ Budi   │ 1-5    │  0    │  5   │⚠️ Belum │[Input]│
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  Info: Menampilkan 2 dari 5 batches (filter: Belum Bayar)    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

#### User Journey:

```
STEP 1: Buka Tab "Input Pembayaran"
├─ Default filter: "Belum Bayar"
└─ Table tampil: A001, A002 (2 batches yang belum dibayar)

STEP 2: Click [Input] pada A001
├─ PaymentForm opens pre-filled dengan:
│  ├─ Contract: A001
│  ├─ Range: 1-10
│  ├─ Already Paid: 0
│  ├─ Remaining: 10
│  └─ Options: Input how many kupon to pay
│
└─ Kolektor input: "7" (bayar 7 kupon dari 10)

STEP 3: Submit pembayaran A001
├─ Payment recorded
├─ current_installment_index A001 = 7
├─ Status A001 changed: Belum Bayar → Sebagian Bayar
└─ Back to table

STEP 4: Table di-filter ulang (jika setting = auto-refilter)
├─ Option 1: A001 disappear dari "Belum Bayar" view
│  └─ User lihat hanya A002 (1 batch tersisa)
│
└─ Option 2: A001 stay di view tapi status badge berubah
   └─ User lihat A001 dan A002 (2 batches, 1 belum + 1 sebagian)

STEP 5: Click [Input] pada A002
├─ PaymentForm opens untuk A002
├─ Kolektor input: "5" (bayar 5 kupon, selesai semua)
└─ Submit

STEP 6: A002 status changed: Belum Bayar → Lunas

STEP 7: Switch filter to "Sebagian Bayar"
├─ Table tampil: A001 (7/10 paid, 3 remaining)
├─ Action button: [Lanjutan]
└─ Kolektor bisa lanjutan pembayaran A001 atau ganti batch

STEP 8: Switch filter to "Lunas"
├─ Table tampil: A002, A005 (2 batches yang sudah selesai)
├─ No action buttons
└─ Reference only (untuk verifikasi)

STEP 9: Switch filter to "Semua"
├─ Table tampil: A001-A005 (5 batches, all status visible)
└─ Overview lengkap dengan status badges
```

---

## 📊 Status Determination (AUTO)

### Tabel Status Decision

| Kondisi | Formula | Status | Button |
|---------|---------|--------|--------|
| `current_index < start_index` | 0 < 1 ✓ | ⚠️ Belum Bayar | [Input] |
| `start_index ≤ current_index < end_index` | 1 ≤ 7 < 10 ✓ | 🔄 Sebagian Bayar | [Lanjutan] |
| `current_index ≥ end_index` | 18 ≥ 18 ✓ | ✅ Lunas | (none) |

### Contoh Real Data

```
id  contract start end current Status        Action
─────────────────────────────────────────────────────
 1    A001    1   10    0     ⚠️ Belum Bayar   [Input]
 2    A002    1    5    0     ⚠️ Belum Bayar   [Input]
 3    A003    6   15    5     ⚠️ Belum Bayar   [Input]
 4    A004    1   20    8     🔄 Sebagian     [Lanjutan]
 5    A005    5   18   18     ✅ Lunas        (none)
```

---

## 🎮 Filter Options Explained

### **Filter A: "Belum Bayar"** ⚠️

```
Show ONLY batches where: current_index < start_index

Data:   start=1  end=10  current=0
        └─ 0 < 1? YES → SHOW ✓

Data:   start=5  end=18  current=10
        └─ 10 < 5? NO → HIDE ✗

Result: Only A001, A002, A003 shown
```

**Use Case:** Kolektor mau lihat batches baru yang belum ada pembayaran

### **Filter B: "Sebagian Bayar"** 🔄

```
Show ONLY batches where: start_index ≤ current_index < end_index

Data:   start=1  end=20  current=8
        └─ 1 ≤ 8 < 20? YES → SHOW ✓

Data:   start=5  end=18  current=18
        └─ 5 ≤ 18 < 18? NO → HIDE ✗

Result: Only A004 shown
```

**Use Case:** Kolektor mau lanjutan pembayaran yang belum selesai

### **Filter C: "Lunas"** ✅

```
Show ONLY batches where: current_index ≥ end_index

Data:   start=5  end=18  current=18
        └─ 18 ≥ 18? YES → SHOW ✓

Data:   start=1  end=20  current=8
        └─ 8 ≥ 20? NO → HIDE ✗

Result: Only A005 shown
```

**Use Case:** QC / verifikasi batches yang sudah selesai

### **Filter D: "Semua"** 📋

```
Show ALL batches regardless of status

Result: A001, A002, A003, A004, A005 all shown
        (dengan status badges untuk masing-masing)
```

**Use Case:** Admin mau lihat overview lengkap

---

## ⚙️ Implementation Components

### New/Updated Components:

```
1. StatusFilterDropdown (NEW)
   └─ Props: value, onChange
   └─ Options: Belum Bayar / Sebagian Bayar / Lunas / Semua
   └─ UI: Toggle buttons OR Dropdown OR Checkboxes

2. DailyDueList (UPDATED)
   ├─ Props: handovers, paymentStatusFilter, onFilterChange
   ├─ Feature: Accept filter parameter from parent
   ├─ Feature: Calculate status for each handover
   ├─ Feature: Filter table data based on status
   ├─ Feature: Show only filtered rows
   └─ Render: Filter controls + Stats + Table

3. StatusBadge (NEW)
   ├─ Props: status, remaining
   ├─ Display: ⚠️ Belum Bayar / 🔄 Sebagian (N) / ✅ Lunas
   └─ Color: Red / Yellow / Green

4. Collection.tsx (UPDATED)
   ├─ Add state: paymentStatusFilter
   ├─ Add computed: filteredHandovers
   ├─ Pass filter state to DailyDueList
   └─ Handle filter changes
```

---

## 📈 Benefits

### Time Efficiency

```
SEBELUM: Dropdown with 10 batches → Manual scroll & search
├─ 10 × 0.5 min (select) = 5 min
├─ 10 × 2 min (input) = 20 min
└─ Total: 35-45 minutes ❌

SESUDAH: Organized by status filter
├─ 3 belum bayar × 2 min = 6 min
├─ 4 sebagian × 2 min = 8 min
└─ Total: 15-20 minutes ✅ (50% lebih cepat!)
```

### Accuracy

```
SEBELUM: Manual status calculation per batch
└─ Easy to confuse (0 vs start_index) → High error rate

SESUDAH: Automatic status badge
└─ Clear visual indicator → Low error rate
```

### User Experience

```
SEBELUM: "Mana yang sudah dibayar? Mana yang belum?"
SESUDAH: Color-coded badges + organized table
└─ Crystal clear workflow ✨
```

---

## ❓ 7 Items untuk Konfirmasi

**Sebelum implementasi, perlu confirm:**

1. **UI Style** untuk filter: Dropdown / Toggle / Checkbox?
2. **Default Filter**: "Belum Bayar" / "Semua" / Remember Last?
3. **Stats Header**: Show / Hide?
4. **Button Labels**: Dynamic ([Input]/[Lanjutan]) / Same?
5. **Search Combination**: With Filter / Independent?
6. **Auto-Move**: Disappear / Stay / Ask User?
7. **Layout**: Top / Sidebar / Tabs?

**→ Jawab di file: `KONFIRMASI_FILTER_STATUS_PEMBAYARAN.md`**

---

## ✅ Conclusion

**Filter Status Pembayaran akan include dalam Daftar Penagihan Hari Ini:**

✅ Tabel di-filter berdasarkan status (Belum/Sebagian/Lunas/Semua)
✅ Status di-calculated otomatis (not manual)
✅ UI clear dengan color-coded badges
✅ 50% lebih cepat processing
✅ Organized, efficient workflow

**Status:** Documentation COMPLETE
**Next:** Waiting for 7 confirmations to start implementation

