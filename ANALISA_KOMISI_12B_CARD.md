# 📊 ANALISA CARD KOMISI 12B

**File:** `src/pages/Dashboard.tsx`  
**Card Location:** Line 762 (Yearly section - tab tahunan)  
**Status:** Sudah ada & berfungsi

---

## 🎯 Definisi "Komisi 12B"

**"12B" = 12 Bulan (Tahunan)**

Card ini menampilkan **Total Komisi Sales Agents untuk 1 tahun penuh** (12 bulan).

---

## 📐 Formula Perhitungan

### Source Code (Lines 204-215)
```typescript
const yearlyCommissionTotal = useMemo(() => {
  const list = yearlyFinancial?.agents;
  if (!Array.isArray(list) || list.length === 0) return 0;
  return list.reduce((sum, a) => {
    const omset = a.total_omset || 0;
    if (omset <= 0) return sum;
    const pct = commissionTiers && commissionTiers.length > 0
      ? calculateTieredCommission(omset, commissionTiers)  // ← TIER BASED
      : (a.commission_percentage || 0);
    return sum + (omset * pct) / 100;  // ← KOMISI PER AGEN
  }, 0);
});
```

### Langkah-Langkah:

1. **Ambil data agen dari yearlyFinancial** (hasil query tahunan)
   - Source: `yearlyFinancial?.agents` (dari hook/database query)
   - Fields: `total_omset`, `commission_percentage`

2. **Untuk setiap agen, hitung komisi individu:**
   ```
   Komisi per Agen = (Total Omset Agen) × (Persentase Komisi) / 100
   ```

3. **Persentase komisi ditentukan oleh:**
   - Jika ada **Commission Tiers** (sistem bertingkat):
     - Gunakan `calculateTieredCommission(omset, commissionTiers)`
     - Otomatis pilih tier berdasarkan besarnya omset
   - Jika TIDAK ada tiers:
     - Gunakan `a.commission_percentage` (nilai komisi default per agen)

4. **Total Komisi 12B:**
   ```
   Komisi 12B = SUM (Komisi setiap Agen)
   ```

---

## 📊 Contoh Perhitungan

### Skenario: 3 Agen, Ada Commission Tiers

**Commission Tiers:**
```
Tier 1: Omset 0 - 100M      → 5%
Tier 2: Omset 100M - 500M   → 7%
Tier 3: Omset > 500M        → 10%
```

**Data Agen Tahun 2026:**
```
Agen 1 "Budi"
├─ Total Omset: Rp 80.000.000
├─ Tier Applied: Tier 1 (5%)
└─ Komisi = 80M × 5% = Rp 4.000.000

Agen 2 "Rina"
├─ Total Omset: Rp 300.000.000
├─ Tier Applied: Tier 2 (7%)
└─ Komisi = 300M × 7% = Rp 21.000.000

Agen 3 "Hendra"
├─ Total Omset: Rp 600.000.000
├─ Tier Applied: Tier 3 (10%)
└─ Komisi = 600M × 10% = Rp 60.000.000
```

**Hasil Komisi 12B = Rp 4M + 21M + 60M = Rp 85.000.000**

---

## 🔗 Data Flow

```
Database (credit_contracts table)
        ↓
Query yearly financial summary
        ↓
Aggregate per sales_agent:
├─ Total Omset (SUM omset)
├─ Komisi Percentage (dari tier atau default)
└─ Status (active/inactive)
        ↓
Hook: useYearlyFinancialSummary
        ↓
Dashboard.tsx: yearlyFinancial?.agents[]
        ↓
Calculate yearlyCommissionTotal (loop & sum)
        ↓
StatCard Display: "Komisi 12B" = Rp XXX.XXX.XXX
```

---

## 📍 Lokasi Terkait

### 1. **Hook untuk data tahunan:**
   - File: `src/hooks/useYearlyFinancialSummary.ts`
   - Fungsi: Fetch data per agen + omset tahunan

### 2. **Commission Tiers configuration:**
   - Hook: `useCommissionTiers()` (line 6 Dashboard.tsx)
   - File: `src/hooks/useCommissionTiers.ts`
   - Fungsi: `calculateTieredCommission(omset, tiers)`

### 3. **Display card di Dashboard:**
   - File: `src/pages/Dashboard.tsx`
   - Line 762: StatCard dengan label "Komisi 12B"
   - Value: `yearlyCommissionTotal`

### 4. **Related KPI yang menggunakan Komisi 12B:**
   - **Keuntungan Bersih Tahunan** (line 847):
     ```
     = Keuntungan Kotor 
       − Komisi 12B 
       − Biaya Operasional (ex. Gaji)
       − Gaji Kolektor
     ```

---

## ⚙️ Konfigurasi Commission Tiers

### Fungsi: `calculateTieredCommission(omset, tiers)`
```typescript
// Dari useCommissionTiers.ts
// Input: omset (total penjualan), tiers (array tier config)
// Output: percentage komisi yang sesuai

// Contoh tier config:
// [
//   { min: 0, max: 100_000_000, percentage: 5 },
//   { min: 100_000_001, max: 500_000_000, percentage: 7 },
//   { min: 500_000_001, max: Infinity, percentage: 10 }
// ]
```

---

## 📝 Poin Penting

### ✅ Yang Sudah Tercakup
- Komisi dihitung dari **data real bulanan** (bukan estimasi)
- Menggunakan **sistem tier** untuk akurasi
- **Auto-update** saat data agen/omset berubah
- **Per-year filtering** (hanya omset tahun yang dipilih)

### ⚠️ Catatan Khusus
- **Komisi belum dibayar:** Nilai di card adalah perhitungan, belum status pembayaran
- **Bonus tahunan 0.8% TIDAK dimasukkan:** Komentar di line 203 menjelaskan, hanya komisi tier
- **Sum dari per-baris Tabel Agen:** Nilai di card = sum dari kolom "Komisi" di halaman SalesAgents (tab tahunan)

### 🔍 Verifikasi
Untuk cross-check apakah perhitungan benar:
1. Buka halaman **SalesAgents** → tab **Tahunan** → pilih tahun sama
2. Lihat kolom **Komisi** setiap baris agen
3. Jumlahkan manual semua nilai Komisi
4. Bandingkan dengan nilai di card "Komisi 12B" di Dashboard
5. Harus **100% MATCH** ✅

---

## 📊 Visualisasi Rumus

```
┌─────────────────────────────────────────────────┐
│         KOMISI 12B = Annual Commission          │
├─────────────────────────────────────────────────┤
│                                                 │
│  For Each Agent in Tahun [Year]:               │
│  ┌───────────────────────────────────────────┐ │
│  │ Commission = Omset × Tier % / 100         │ │
│  │             ↑         ↑                    │ │
│  │        From DB   From Tier Config         │ │
│  └───────────────────────────────────────────┘ │
│                  ↓                             │
│  Sum All Agent Commissions                    │
│             ↓                                 │
│  Total Komisi 12B                            │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 🎯 Kesimpulan

**Komisi 12B = Sum dari komisi semua sales agents untuk 1 tahun penuh**

**Rumus:** ∑(Omset_agen × Pct_tier) untuk semua agen dalam tahun terpilih

**Source:** Calculated real-time dari data agents di yearlyFinancial

**Verifikasi:** Bandingkan dengan SalesAgents tab Tahunan (kolom Komisi)

---

**Status:** ✅ Akurat & Terdokumentasi  
**Last Verified:** 2026-06-05  
**Related Issue:** None (sudah berfungsi baik)
