import { differenceInDays } from 'date-fns';

/**
 * Hitung hari keterlambatan dari due date
 * @param dueDate - Tanggal jatuh tempo kupon berikutnya
 * @returns Jumlah hari terlambat (0 jika belum jatuh tempo)
 */
export const calculateLateDays = (dueDate: string | null | undefined): number => {
  if (!dueDate) return 0;
  
  const due = new Date(dueDate);
  const today = new Date();
  const lateDays = differenceInDays(today, due);
  
  return Math.max(0, lateDays);
};

/**
 * Hitung hari tanpa pembayaran sejak last payment
 * @param lastPaymentDate - Tanggal pembayaran terakhir
 * @returns Jumlah hari sejak pembayaran terakhir
 */
export const calculateDaysSinceLastPayment = (lastPaymentDate: string | null | undefined): number => {
  if (!lastPaymentDate) return 0;
  
  const lastPayment = new Date(lastPaymentDate);
  const today = new Date();
  const daysSince = differenceInDays(today, lastPayment);
  
  return Math.max(0, daysSince);
};

/**
 * Status Kontrak berdasarkan keterlambatan pembayaran
 * - sangat_lancar: Tidak ada keterlambatan sama sekali (0 hari terlambat)
 * - lancar: Terlambat 1-3 hari
 * - kurang_lancar: Terlambat 4-19 hari
 * - macet: Terlambat 20+ hari ATAU 6+ hari tanpa pembayaran
 */
export type ContractStatus = 'completed' | 'sangat_lancar' | 'lancar' | 'kurang_lancar' | 'macet';

export interface ContractStatusInput {
  status: string; // 'completed', 'active', 'returned'
  lateDays?: number; // Hari terlambat pembayaran
  daysSinceLastPayment?: number; // Hari tanpa pembayaran
  createdAt?: string; // Tanggal pembuatan kontrak (fallback untuk first payment)
}

/**
 * Tentukan status kontrak berdasarkan keterlambatan
 * @param input - Objek berisi data keterlambatan
 * @returns Status kontrak
 */
export const determineContractStatus = (input: ContractStatusInput): ContractStatus => {
  // Jika kontrak selesai
  if (input.status === 'completed') return 'completed';
  
  const lateDays = input.lateDays ?? 0;
  const daysSinceLastPayment = input.daysSinceLastPayment ?? 0;
  
  // Rule 1: Jika 6+ hari tanpa pembayaran → macet (konsekutif = tidak boleh ada pembayaran)
  if (daysSinceLastPayment >= 6) return 'macet';
  
  // Rule 2: Berdasarkan hari keterlambatan pembayaran
  if (lateDays === 0) return 'sangat_lancar';
  if (lateDays <= 3) return 'lancar';
  if (lateDays <= 19) return 'kurang_lancar';
  return 'macet'; // 20+ hari
};

/**
 * Legacy: calculateContractStatus untuk backward compatibility
 * Menggunakan heuristik jika tidak ada data pembayaran real-time
 * @deprecated Gunakan determineContractStatus dengan data real-time
 */
export const calculateContractStatusLegacy = (contract: {
  status: string;
  current_installment_index: number;
  created_at: string;
}): 'completed' | 'sangat_lancar' | 'lancar' | 'kurang_lancar' | 'macet' => {
  if (contract.status === 'completed') return 'completed';
  
  const daysSinceCreation = differenceInDays(new Date(), new Date(contract.created_at));
  const installmentsPaid = contract.current_installment_index;
  
  // Jika belum ada pembayaran sama sekali
  if (installmentsPaid === 0) {
    // Asumsi: kontrak baru belum harus membayar
    if (daysSinceCreation <= 1) return 'sangat_lancar';
    if (daysSinceCreation <= 3) return 'lancar';
    if (daysSinceCreation <= 19) return 'kurang_lancar';
    return 'macet';
  }
  
  // Heuristik: rata-rata hari per cicilan
  const daysPerDue = daysSinceCreation / installmentsPaid;
  const estimatedLateDays = Math.max(0, daysPerDue - 1) * 30; // Perkiraan kasar
  
  if (estimatedLateDays === 0) return 'sangat_lancar';
  if (estimatedLateDays <= 3) return 'lancar';
  if (estimatedLateDays <= 19) return 'kurang_lancar';
  return 'macet';
};

/**
 * Get label status dalam Bahasa Indonesia
 */
export const getStatusLabel = (status: ContractStatus): string => {
  const labels: Record<ContractStatus, string> = {
    completed: 'Lunas',
    sangat_lancar: 'Sangat Lancar',
    lancar: 'Lancar',
    kurang_lancar: 'Kurang Lancar',
    macet: 'Macet'
  };
  return labels[status] || status;
};

/**
 * Get color class untuk Badge
 */
export const getStatusBadgeClass = (status: ContractStatus): string => {
  const classes: Record<ContractStatus, string> = {
    completed: 'bg-blue-100 text-blue-700',
    sangat_lancar: 'bg-green-100 text-green-700',
    lancar: 'bg-green-50 text-green-600',
    kurang_lancar: 'bg-yellow-100 text-yellow-700',
    macet: 'bg-red-100 text-red-700'
  };
  return classes[status] || 'bg-gray-100 text-gray-700';
};
