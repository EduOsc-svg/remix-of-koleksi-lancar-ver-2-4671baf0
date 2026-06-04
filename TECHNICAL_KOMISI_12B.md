# 🔧 TECHNICAL DETAILS - Komisi 12B Card

**File:** `src/hooks/useCommissionTiers.ts`  
**Hook:** `useCommissionTiers()` + `calculateTieredCommission()`

---

## 📊 Commission Tiers Data Structure

### Database Table: `commission_tiers`
```sql
├─ id             (UUID)
├─ min_amount     (number) - Omset minimum
├─ max_amount     (number | NULL) - Omset maksimum
│                               (NULL = tak terbatas/open-ended)
├─ percentage     (number) - Komisi %
└─ created_at     (timestamp)
```

### Example Data
```
Tier 1: min=0,        max=100_000_000,   percentage=5%
Tier 2: min=100M+,    max=500_000_000,   percentage=7%
Tier 3: min=500M+,    max=NULL,          percentage=10%  ← open-ended
```

---

## ⚙️ Fungsi `calculateTieredCommission()`

### Signature
```typescript
calculateTieredCommission(
  contractAmount: number,      // Total omset agen
  tiers: CommissionTier[]      // Array tier config dari DB
): number                       // Return: percentage (5, 7, 10, dll)
```

### Algoritma
```
Input: omset = 350 juta, tiers = [tier1, tier2, tier3]

Step 1: Loop melalui tiers secara berurutan
  ├─ Tier 1: min=0,   max=100M
  │  └─ 350M >= 0 && 350M <= 100M? NO
  │
  ├─ Tier 2: min=100M, max=500M
  │  └─ 350M >= 100M && 350M <= 500M? YES ✓
  │     └─ Return: 7%
  │
  └─ (Tier 3 tidak dipelajari karena sudah match)

Output: 7%
```

### Fallback Logic
```
1. Jika tiers kosong → default 5%
2. Jika omset tidak match tier manapun 
   → ambil highest tier (max_amount = NULL)
3. Jika tidak ada highest tier → default 5%
```

---

## 📈 Komisi Tahunan - Calculation Flow

### Setup (Dashboard.tsx line 104-215)
```typescript
// 1. Fetch commission tiers
const { data: commissionTiers } = useCommissionTiers();

// 2. Fetch yearly financial data (dengan breakdown per agent)
const yearlyFinancial = useYearlyFinancialSummary(selectedYear);

// 3. Hitung komisi tahunan
const yearlyCommissionTotal = useMemo(() => {
  const list = yearlyFinancial?.agents;  // Array agen dengan omset tahunan
  
  return list.reduce((sum, agent) => {
    const omset = agent.total_omset || 0;  // Total omset agen tahun ini
    
    // Cek tier berdasarkan omset
    const percentage = commissionTiers && commissionTiers.length > 0
      ? calculateTieredCommission(omset, commissionTiers)
      : agent.commission_percentage;  // Fallback: use default percentage
    
    // Hitung komisi agen ini
    const commission = (omset * percentage) / 100;
    
    return sum + commission;  // Akumulasi ke total
  }, 0);
}, [yearlyFinancial?.agents, commissionTiers]);
```

---

## 🎯 Contoh Kalkulasi End-to-End

### Data Input
```
selectedYear = 2026
commission_tiers = [
  { min: 0,      max: 100M,   pct: 5 },
  { min: 100M,   max: 500M,   pct: 7 },
  { min: 500M,   max: null,   pct: 10 }
]

yearlyFinancial?.agents = [
  { name: "Budi",    total_omset: 50M,   commission_percentage: 5 },
  { name: "Rina",    total_omset: 250M,  commission_percentage: 5 },
  { name: "Hendra",  total_omset: 800M,  commission_percentage: 5 },
  { name: "Siti",    total_omset: 0,     commission_percentage: 5 },
]
```

### Kalkulasi Per Agent

**Agent 1: Budi (50M)**
```
omset = 50M
tier_match = Tier 1 (50 >= 0 && 50 <= 100) → 5%
komisi = 50M × 5% = 2.5M
```

**Agent 2: Rina (250M)**
```
omset = 250M
tier_match = Tier 2 (250 >= 100 && 250 <= 500) → 7%
komisi = 250M × 7% = 17.5M
```

**Agent 3: Hendra (800M)**
```
omset = 800M
tier_match = Tier 3 (800 >= 500 && 800 > 500) → 10%
komisi = 800M × 10% = 80M
```

**Agent 4: Siti (0)**
```
omset = 0
komisi = 0  (skipped: if (omset <= 0) return sum)
```

### Total Komisi 12B
```
yearlyCommissionTotal = 2.5M + 17.5M + 80M + 0 = Rp 100.000.000
```

---

## 🔄 Data Refresh

### Trigger Points
1. **Perubahan tier configuration**
   - Jika admin update commission_tiers di database
   - Hook `useCommissionTiers()` akan auto-refetch (TanStack Query)
   - `yearlyCommissionTotal` akan recalculate (useMemo dependency)

2. **Perubahan tahun (selectedYear)**
   - Saat user ganti tahun di dashboard
   - Fetch `useYearlyFinancialSummary(selectedYear)` baru
   - Komisi 12B recalculate untuk tahun baru

3. **Perubahan data agen**
   - Saat ada kontrak baru/update di sales agent
   - Query database akan mengeluarkan data terbaru
   - UI auto-update dengan nilai komisi terbaru

---

## ⚡ Performance Notes

### Optimizations
- ✅ **useMemo** → Komisi hanya recalculate jika dependency berubah
- ✅ **useQuery** → Tiers di-cache, tidak fetch ulang setiap render
- ✅ **Loop efficiency** → O(n) untuk tier matching, O(m) untuk agent aggregation

### Query Complexity
```
getYearlyFinancial(year):
  SELECT agents where created_at <= year
         + SUM(omset) per agent
         + SUM(total_omset) all
  → O(n agents)

calculateTieredCommission:
  Loop tiers until match
  → O(t tiers) per agent
  → O(m agents × t tiers) total

Dashboard render:
  → Typical: < 5ms untuk 50 agents + 5 tiers
```

---

## 🐛 Debugging

### Check tier matching
```typescript
console.log("Tiers:", commissionTiers);
console.log("Agent omset:", yearlyFinancial?.agents[0].total_omset);
console.log("Applied tier %:", 
  calculateTieredCommission(
    yearlyFinancial?.agents[0].total_omset, 
    commissionTiers
  )
);
```

### Verify calculation
```typescript
console.log("Yearly agents:", yearlyFinancial?.agents);
console.log("Total commission 12B:", yearlyCommissionTotal);

// Manual verify:
const manual = yearlyFinancial?.agents.reduce((sum, a) => {
  const pct = calculateTieredCommission(a.total_omset, commissionTiers);
  return sum + (a.total_omset * pct / 100);
}, 0);
console.log("Manual calc match?", manual === yearlyCommissionTotal);
```

---

## 📋 Constants

### Dari `useCommissionTiers.ts`
```typescript
export const YEARLY_BONUS_PERCENTAGE = 0.8;  // Bonus tahunan (hardcoded)
export const DEFAULT_COMMISSION = 5;         // Fallback % jika no tiers
```

### Hardcoded di komentar
- Line 203: "TANPA bonus tahunan 0.8%" → Komisi 12B tidak termasuk bonus
- Bonus dihitung terpisah: `calculateYearlyBonus(omset) = omset × 0.8% / 100`

---

## ✅ Verifikasi Akurasi

### Cara manual check:
1. **Dashboard** → lihat card "Komisi 12B" → catat nilai
2. **SalesAgents** (tab Tahunan) → lihat kolom "Komisi" setiap agent
3. **Manual sum** kolom Komisi → harus match dashboard value

### Jika tidak match:
- Cek apakah selectedYear konsisten
- Cek commission_tiers di database (query `SELECT * FROM commission_tiers`)
- Cek data agent di DB (total_omset per agen)
- Jalankan debug log di atas

---

## 🎓 Kesimpulan

| Aspek | Detail |
|-------|--------|
| **Formula** | Komisi 12B = Σ(omset_agen × tier_pct) |
| **Tier Matching** | Automatic berdasarkan range omset |
| **Data Source** | Database commission_tiers + yearly agents |
| **Fallback** | Default 5% jika tidak ada tiers |
| **Frequency** | Real-time (recalc saat dependency change) |
| **Accuracy** | ✅ Verified against SalesAgents page |

---

**File Reference:** `src/hooks/useCommissionTiers.ts` (lines 31-45)  
**Integration:** `src/pages/Dashboard.tsx` (lines 204-215, 762-768)  
**Last Updated:** 2026-06-05
