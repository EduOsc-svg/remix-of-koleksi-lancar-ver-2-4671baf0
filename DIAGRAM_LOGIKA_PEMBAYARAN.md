# DIAGRAM LOGIKA PEMBAYARAN BARU

## 1️⃣ Decision Tree - Kontrak Lunas vs Belum Lunas

```
┌─────────────────────────────────────────────────────────────┐
│ KONTRAK MASUK (dari Kolektor/Closing)                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │ System: Cek Status Kontrak            │
        │ Bandingkan:                           │
        │ current_installment_index vs tenor_days
        └──────────────┬───────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
    SAMA? YES                    SAMA? NO
          │                         │
          ▼                         ▼
    ┌──────────────┐         ┌──────────────┐
    │ ✅ LUNAS     │         │ ⚠️ BELUM     │
    │ (Lengkap)    │         │ (Kurang)     │
    └──────┬───────┘         └──────┬───────┘
           │                         │
           ▼                         ▼
    ┌────────────────┐      ┌─────────────────┐
    │ AUTO-PROCESS   │      │ MANUAL INPUT    │
    │ (No User)      │      │ (User Click)    │
    └────────────────┘      └─────────────────┘
```

---

## 2️⃣ Parallel Processing - Auto vs Manual

```
                    PEMBAYARAN MASUK
                          │
        ┌─────────────────┴──────────────────┐
        │                                    │
        ▼                                    ▼
    ANALYZE (5 sec)                    ANALYZE (5 sec)
        │                                    │
    ┌───┴───────────┐                  ┌────┴────────┐
    │ 6 LUNAS       │                  │ 4 BELUM     │
    │ (A001-A006)   │                  │ (A007-A010) │
    └───┬───────────┘                  └────┬────────┘
        │                                    │
        ▼                                    ▼
    AUTO-PROCESS                        DISPLAY LIST
    (0 sec user time)              [Belum Lunas] Buttons
        │                                    │
    BATCH INSERT:                       USER CLICKS:
    - 2160 payment records              ├─ A007 → Form
    - 2160 coupon updates               ├─ A008 → Form
    - 6 contract updates                ├─ A009 → Form
    - 6 activity logs                   └─ A010 → Form
        │                                    │
        ▼                                    ▼
    DONE! ✅                          INPUT MANUAL
    Toast: "6 auto"                  (2-3 min)
                                            │
                                            ▼
                                      BATCH INSERT
                                      (Per kontrak)
                                            │
                                            ▼
                                      DONE! ✅
                                      Status update

TOTAL TIME: ~2-3 min vs 20-30 min (OLD)
```

---

## 3️⃣ Manual Form Options (When User Click [Belum Lunas])

```
┌──────────────────────────────────────────────────────┐
│ A007 - PT STU | Sudah Bayar: 250 | Sisa: 110        │
├──────────────────────────────────────────────────────┤
│                                                      │
│ OPSI 1: Lanjutan (Pembayaran Parsial)               │
│ ─────────────────────────────────────────────────   │
│ Keterangan: Bayar sebagian, masih ada sisa          │
│                                                      │
│ ┌─────────────────────────────────────────┐         │
│ │ Kupon ke-:      251                     │ (auto)  │
│ │ Jumlah kupon:   [50]  (user input)      │         │
│ │ Tanggal:        2026-05-30              │         │
│ │ Nominal/kupon:  1.500.000               │         │
│ │                                         │         │
│ │ → Kupon 251-300 (50 kupon)              │         │
│ │ → Total: Rp 75.000.000                  │         │
│ │ → Sisa: 60 kupon                        │         │
│ │ → Status: Masih ⚠️ BELUM                │         │
│ └─────────────────────────────────────────┘         │
│                                                      │
│ ────────────────────────────────────────────────    │
│                                                      │
│ OPSI 2: Lunas (Pembayaran Lengkap)                 │
│ ─────────────────────────────────────────────────   │
│ Keterangan: Bayar semua sisa, kontrak selesai      │
│                                                      │
│ ┌─────────────────────────────────────────┐         │
│ │ Kupon dari:     251                     │ (auto)  │
│ │ Kupon sampai:   360                     │ (auto)  │
│ │ Total kupon:    110                     │ (auto)  │
│ │ Tanggal:        2026-05-30              │         │
│ │ Nominal/kupon:  1.500.000               │         │
│ │                                         │         │
│ │ → Kupon 251-360 (110 kupon)             │         │
│ │ → Total: Rp 165.000.000                 │         │
│ │ → Sisa: 0 kupon ✅                      │         │
│ │ → Status: ✅ LUNAS SELESAI              │         │
│ └─────────────────────────────────────────┘         │
│                                                      │
│                [Catat Pembayaran]  [Batal]          │
└──────────────────────────────────────────────────────┘
```

---

## 4️⃣ Data Flow - Complete Journey

```
╔════════════════════════════════════════════════════════════════╗
║                    PEMBAYARAN MASUK (Closing)                  ║
║                   [A001...A010 dari Kolektor]                  ║
╚═════════════════════════┬══════════════════════════════════════╝
                          │
                          ▼
        ╔════════════════════════════════════════╗
        ║ STEP 1: Analyze & Classify             ║
        ║ ├─ Scan current_installment_index     ║
        ║ ├─ Compare with tenor_days             ║
        ║ └─ Mark as LUNAS or BELUM              ║
        ╚═════════════════┬══════════════════════╝
                          │
        ┌─────────────────┴─────────────────┐
        │                                   │
        ▼                                   ▼
  ╔──────────────────╗             ╔──────────────────╗
  ║  LUNAS GROUP     ║             ║  BELUM GROUP     ║
  ║  (6 kontrak)     ║             ║  (4 kontrak)     ║
  ║  A001-A006       ║             ║  A007-A010       ║
  ╚────────┬─────────╝             ╚────────┬─────────╝
           │                                 │
           ▼                                 ▼
  ╔──────────────────────────╗    ╔──────────────────────────╗
  ║ STEP 2A: Auto-Process    ║    ║ STEP 2B: Prepare UI      ║
  ║                          ║    ║                          ║
  ║ For each LUNAS:          ║    ║ Build Manifest List      ║
  ║ ├─ Generate payments     ║    ║ ├─ Show [Belum Lunas]    ║
  ║ │  (1 per kupon)         ║    ║ │  button per kontrak    ║
  ║ ├─ Batch insert          ║    ║ ├─ Display sisa kupon    ║
  ║ │  (2160 records)        ║    ║ │  (110, 160, 180, 260)  ║
  ║ ├─ Update coupons        ║    ║ └─ Ready for user click  ║
  ║ │  (status = 'paid')     ║    ║                          ║
  ║ ├─ Update contracts      ║    ║ WAITING FOR USER:        ║
  ║ │  (current_index=360)   ║    ║ "Click [Belum Lunas] →  ║
  ║ └─ Log activity          ║    ║  Input form akan terbuka"║
  ║    (6 entries)           ║    ║                          ║
  ║                          ║    ║ [Manifest List Rendered] ║
  ║ ✅ DONE (Instant)        ║    ║                          ║
  ╚──────────┬───────────────╝    ╚────────┬─────────────────╝
             │                              │
             ▼                              ▼
  ╔──────────────────────╗      (User clicks)
  ║ Update UI            ║             │
  ║                      ║             ▼
  ║ Toast:               ║      ╔────────────────────╗
  ║ "6 kontrak lunas"    ║      ║ Manual Form Opens  ║
  ║                      ║      ║ (for A007, A008, ..)
  ║ Manifest List:       ║      ║                    ║
  ║ ├─ A001: ✅ Done     ║      ║ User input:        ║
  ║ ├─ A002: ✅ Done     ║      ║ ├─ Select kupon    ║
  ║ ├─ A003: ✅ Done     ║      ║ ├─ Enter amount    ║
  ║ ├─ A004: ✅ Done     ║      ║ └─ Confirm date    ║
  ║ ├─ A005: ✅ Done     ║      ║                    ║
  ║ ├─ A006: ✅ Done     ║      ║ Submit             ║
  ║ ├─ A007: ⚠️ [BL]     ║      └────────┬───────────┘
  ║ ├─ A008: ⚠️ [BL]     ║               │
  ║ ├─ A009: ⚠️ [BL]     ║               ▼
  ║ └─ A010: ⚠️ [BL]     ║      ╔──────────────────────╗
  ║                      ║      ║ STEP 2B: Manual Bulk ║
  ╚──────────────────────╝      ║                      ║
                                ║ Generate payments    ║
                                ║ (N kupon)            ║
                                ║                      ║
                                ║ Batch insert         ║
                                ║ Update coupons       ║
                                ║ Update contract      ║
                                ║ Log activity         ║
                                ║                      ║
                                ║ ✅ DONE (per form)   ║
                                └────────┬─────────────┘
                                         │
                                         ▼
                                ╔──────────────────────╗
                                ║ Update Contract      ║
                                ║ Status               ║
                                ║                      ║
                                ║ If sisa == 0:        ║
                                ║ └─ Change to ✅      ║
                                ║                      ║
                                ║ Update Manifest      ║
                                ║ (remove from list)   ║
                                ╚──────────────────────╝


╔════════════════════════════════════════════════════════════════╗
║                     FINAL MANIFEST STATE                       ║
├────────────────────────────────────────────────────────────────┤
║ ✅ A001: Done (auto)                                           ║
║ ✅ A002: Done (auto)                                           ║
║ ✅ A003: Done (auto)                                           ║
║ ✅ A004: Done (auto)                                           ║
║ ✅ A005: Done (auto)                                           ║
║ ✅ A006: Done (auto)                                           ║
║ ✅ A007: Done (manual - 251-360)                              ║
║ ✅ A008: Done (manual - 201-360)                              ║
║ ⚠️  A009: Belum (manual - 181-280, sisa 80)                  ║
║ ⚠️  A010: Belum (manual - 101-360, sisa 0) → ✅ (if user input)
║                                                                ║
║ SUMMARY:                                                       ║
║ ├─ Total kontrak: 10                                          ║
║ ├─ Auto-processed: 6                                          ║
║ ├─ Manual-input: 4                                            ║
║ └─ Status: 8 LUNAS, 2 BELUM                                   ║
╚════════════════════════════════════════════════════════════════╝
```

---

## 5️⃣ State Transition Diagram

```
┌─────────────┐
│  CONTRACT   │
│  INPUT      │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────┐
│ Initial State:              │
│ • current = ?               │
│ • tenor = 360               │
│ • status = UNKNOWN          │
│ • remaining = ?             │
└──────┬──────────────────────┘
       │
       ▼
   ┌───┴────────────────┐
   │ Analyze            │
   └──┬──────────────┬──┘
      │              │
   remaining=0     remaining>0
      │              │
      ▼              ▼
   ┌─────┐        ┌──────┐
   │LUNAS│        │BELUM │
   └──┬──┘        └──┬───┘
      │               │
      ▼               ▼
   AUTO        WAITING FOR
   (instant)   USER INPUT
      │               │
      ▼               ▼
   DONE ✅     FORM SUBMITTED
    │              │
    │              ▼
    │         MANUAL BULK
    │         (process)
    │              │
    └──────┬───────┘
           │
           ▼
      ┌────────┐
      │ LOGGED │
      │ IN DB  │
      └────────┘
```

---

## 6️⃣ Time Comparison

```
OLD APPROACH (Manual Everything):
┌─────────────────────────────────────────────────────────┐
│ A001 [2 min] ──────────────────────                    │
│ A002 [2 min] ──────────────────────                    │
│ A003 [2 min] ──────────────────────                    │
│ A004 [2 min] ──────────────────────                    │
│ A005 [2 min] ──────────────────────                    │
│ A006 [2 min] ──────────────────────                    │
│ A007 [3 min] ────────────────────────                  │
│ A008 [3 min] ────────────────────────                  │
│ A009 [3 min] ────────────────────────                  │
│ A010 [3 min] ────────────────────────                  │
│                                                         │
│ TOTAL: ~25 minutes ❌                                   │
└─────────────────────────────────────────────────────────┘

NEW APPROACH (Auto + Manual):
┌─────────────────────────────────────────────────────────┐
│ A001-A006   [instant] ──                               │
│ A007 [3 min] ────────────────────────                  │
│ A008 [3 min] ────────────────────────                  │
│ A009 [2 min] ──────────────────                        │
│ A010 [2 min] ──────────────────                        │
│                                                         │
│ TOTAL: ~10 minutes ✅                                   │
│ FASTER: 60% time saved! 🚀                             │
└─────────────────────────────────────────────────────────┘
```

---

**Diagram Created:** May 30, 2026  
**Version:** Final  
**Status:** Ready for Development
