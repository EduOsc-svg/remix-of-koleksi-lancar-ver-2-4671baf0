import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calculateTieredCommission, CommissionTier } from './useCommissionTiers';

export interface CommissionPayment {
  id: string;
  sales_agent_id: string;
  contract_id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
  created_at: string;
}

export interface CommissionPaymentWithDetails extends CommissionPayment {
  contract_ref?: string;
  customer_name?: string;
  contract_amount?: number;
  commission_percentage?: number;
}

// Fetch all commission payments for a sales agent
export const useCommissionPayments = (salesAgentId: string | null, periodStart?: string | null, periodEnd?: string | null) => {
  return useQuery({
    queryKey: ['commission_payments', salesAgentId, periodStart || null, periodEnd || null],
    queryFn: async () => {
      if (!salesAgentId) return [];

      let query = supabase
        .from('commission_payments')
        .select(`
          *,
          credit_contracts!inner(
            contract_ref,
            customers(name)
          )
        `)
        .eq('sales_agent_id', salesAgentId)
        .order('payment_date', { ascending: false });

      if (periodStart) {
        query = query.gte('payment_date', periodStart);
      }
      if (periodEnd) {
        query = query.lte('payment_date', periodEnd);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((payment: any) => ({
        ...payment,
        contract_ref: payment.credit_contracts?.contract_ref,
        customer_name: payment.credit_contracts?.customers?.name,
      })) as CommissionPaymentWithDetails[];
    },
    enabled: !!salesAgentId,
  });
};

// Normalisasi no HP: hilangkan non-digit, samakan prefix 62 → 0
const normalizePhone = (phone: string | null | undefined): string => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return '0' + digits.slice(2);
  if (digits.startsWith('0')) return digits;
  return digits;
};

const normalizeName = (name: string | null | undefined): string => {
  if (!name) return '';
  return String(name).trim().toLowerCase().replace(/\s+/g, ' ');
};

// Fetch unpaid commissions (contracts without commission payment)
export const useUnpaidCommissions = (salesAgentId: string | null, periodStart?: string | null, periodEnd?: string | null) => {
  return useQuery({
    queryKey: ['unpaid_commissions', salesAgentId, periodStart || null, periodEnd || null],
    queryFn: async () => {
      if (!salesAgentId) return [];

      // Build contract query for this agent with optional period filter
      let contractQuery = supabase
        .from('credit_contracts')
        .select(`
          id,
          contract_ref,
          total_loan_amount,
          omset,
          customer_id,
          customers(name, phone),
          start_date
        `)
        .eq('sales_agent_id', salesAgentId);

      if (periodStart) contractQuery = contractQuery.gte('start_date', periodStart);
      if (periodEnd) contractQuery = contractQuery.lte('start_date', periodEnd);

      const { data: contracts, error: contractsError } = await contractQuery;

      if (contractsError) throw contractsError;

      // Build normalized keys (phone/name) from agent's contracts so we can lookup duplicates across DB
      const phoneKeys = Array.from(new Set((contracts || []).map((c: any) => normalizePhone(c.customers?.phone)).filter(Boolean)));
      const nameKeys = Array.from(new Set((contracts || []).map((c: any) => normalizeName(c.customers?.name)).filter(Boolean)));

      // Klasifikasi Baru/Lama harus konsisten dengan tabel Sales Agents
      // (lihat useAgentCustomerCounts): hitung lifetime kontrak per pelanggan
      // di SELURUH histori, lintas agen.
      void phoneKeys; void nameKeys;
      const { data: allContractsForCount, error: allErr } = await supabase
        .from('credit_contracts')
        .select('customer_id, customers(name, phone)');
      if (allErr) throw allErr;

      const contractCountByKey = new Map<string, number>();
      const keyByCustomerId = new Map<string, string>();
      (allContractsForCount || []).forEach((row: any) => {
        const phoneKey = normalizePhone(row.customers?.phone);
        const nameKey = normalizeName(row.customers?.name);
        const key = phoneKey ? `p:${phoneKey}` : nameKey ? `n:${nameKey}` : null;
        if (!key) return;
        contractCountByKey.set(key, (contractCountByKey.get(key) || 0) + 1);
        if (row.customer_id) keyByCustomerId.set(row.customer_id, key);
      });

      // Get all paid commissions for this agent — but to decide unpaid for contracts in the
      // selected period we should check payments by contract_id (payments may occur outside period)
      const { data: paidCommissionsAll, error: commissionsError } = await supabase
        .from('commission_payments')
        .select('contract_id')
        .eq('sales_agent_id', salesAgentId);

      if (commissionsError) throw commissionsError;

  const paidContractIds = new Set((paidCommissionsAll || []).map(c => c.contract_id));

      // Get agent's settings
      const { data: agent, error: agentError } = await supabase
        .from('sales_agents')
        .select('commission_percentage, use_tiered_commission')
        .eq('id', salesAgentId)
        .single();

      if (agentError) throw agentError;

      const useTiered = agent?.use_tiered_commission ?? true;
      const fixedPct = agent?.commission_percentage || 0;

      // Get commission tiers if using tiered system
      let tiers: CommissionTier[] = [];
      if (useTiered) {
        const { data: tierData, error: tierError } = await supabase
          .from('commission_tiers')
          .select('*')
          .order('min_amount', { ascending: true });
        
        if (!tierError && tierData) {
          tiers = tierData as CommissionTier[];
        }
      }

      // Filter unpaid and calculate commission
      return (contracts || [])
        .filter(c => !paidContractIds.has(c.id))
        .map((contract: any) => {
          const contractAmount = Number(contract.total_loan_amount || 0);

          // Calculate commission based on system type
          const commissionPct = useTiered
            ? calculateTieredCommission(contractAmount, tiers)
            : fixedPct;
          const commission = (contractAmount * commissionPct) / 100;

          // Status pelanggan: Lama jika ≥2 kontrak lifetime (lintas agen)
          let key = keyByCustomerId.get(contract.customer_id) || null;
          if (!key) {
            const p = normalizePhone(contract.customers?.phone);
            const n = normalizeName(contract.customers?.name);
            key = p ? `p:${p}` : n ? `n:${n}` : null;
          }
          const totalContractsForCustomer = key ? (contractCountByKey.get(key) || 1) : 1;
          const customer_status: 'baru' | 'lama' = totalContractsForCustomer >= 2 ? 'lama' : 'baru';

          return {
            contract_id: contract.id,
            contract_ref: contract.contract_ref,
            customer_name: contract.customers?.name || '-',
            customer_phone: contract.customers?.phone || null,
            customer_status,
            omset: contractAmount,
            commission,
            commission_percentage: commissionPct,
          };
        });
    },
    enabled: !!salesAgentId,
  });
};

// Create commission payment
export const useCreateCommissionPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      sales_agent_id: string;
      contract_id: string;
      amount: number;
      payment_date?: string;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from('commission_payments')
        .insert({
          sales_agent_id: data.sales_agent_id,
          contract_id: data.contract_id,
          amount: data.amount,
          payment_date: data.payment_date || new Date().toISOString().split('T')[0],
          notes: data.notes || null,
        });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['commission_payments', variables.sales_agent_id] });
      queryClient.invalidateQueries({ queryKey: ['unpaid_commissions', variables.sales_agent_id] });
      queryClient.invalidateQueries({ queryKey: ['agent_omset'] });
      queryClient.invalidateQueries({ queryKey: ['agent_performance'] });
      queryClient.invalidateQueries({ queryKey: ['commission_summary', variables.sales_agent_id] });
    },
  });
};

// Bulk create commission payments (pay all)
export const useBulkCreateCommissionPayments = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      sales_agent_id: string;
      payments: Array<{
        contract_id: string;
        amount: number;
      }>;
      payment_date?: string;
      notes?: string;
    }) => {
      const paymentDate = data.payment_date || new Date().toISOString().split('T')[0];
      
      // Insert all payments at once
      const insertData = data.payments.map(p => ({
        sales_agent_id: data.sales_agent_id,
        contract_id: p.contract_id,
        amount: p.amount,
        payment_date: paymentDate,
        notes: data.notes || null,
      }));

      const { error } = await supabase
        .from('commission_payments')
        .insert(insertData);

      if (error) throw error;
      
      return { count: data.payments.length, salesAgentId: data.sales_agent_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['commission_payments', result.salesAgentId] });
      queryClient.invalidateQueries({ queryKey: ['unpaid_commissions', result.salesAgentId] });
      queryClient.invalidateQueries({ queryKey: ['agent_omset'] });
      queryClient.invalidateQueries({ queryKey: ['agent_performance'] });
      queryClient.invalidateQueries({ queryKey: ['commission_summary', result.salesAgentId] });
    },
  });
};

// Delete commission payment
export const useDeleteCommissionPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, salesAgentId }: { id: string; salesAgentId: string }) => {
      const { error } = await supabase
        .from('commission_payments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { salesAgentId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['commission_payments', result.salesAgentId] });
      queryClient.invalidateQueries({ queryKey: ['unpaid_commissions', result.salesAgentId] });
      queryClient.invalidateQueries({ queryKey: ['agent_omset'] });
      queryClient.invalidateQueries({ queryKey: ['agent_performance'] });
    },
  });
};

// Get commission summary for a sales agent
export const useCommissionSummary = (salesAgentId: string | null, periodStart?: string | null, periodEnd?: string | null) => {
  return useQuery({
    queryKey: ['commission_summary', salesAgentId, periodStart || null, periodEnd || null],
    queryFn: async () => {
      if (!salesAgentId) return { 
        totalPaid: 0, 
        totalUnpaid: 0, 
        totalContracts: 0, 
        paidContracts: 0,
        yearlyOmset: 0,
        yearlyBonus: 0,
      };

      // Get agent info
      const { data: agent, error: agentError } = await supabase
        .from('sales_agents')
        .select('commission_percentage, use_tiered_commission')
        .eq('id', salesAgentId)
        .single();

      if (agentError) throw agentError;

      const useTiered = agent?.use_tiered_commission ?? true;
      const fixedPct = agent?.commission_percentage || 0;

      // Get commission tiers if using tiered system
      let tiers: CommissionTier[] = [];
      if (useTiered) {
        const { data: tierData } = await supabase
          .from('commission_tiers')
          .select('*')
          .order('min_amount', { ascending: true });
        
        if (tierData) {
          tiers = tierData as CommissionTier[];
        }
      }

      // Get all contracts for this agent (optional period filter)
      // include start_date because yearly calculations rely on contract.start_date
      let contractQuery = supabase
        .from('credit_contracts')
        .select('id, total_loan_amount, start_date')
        .eq('sales_agent_id', salesAgentId);
      if (periodStart) contractQuery = contractQuery.gte('start_date', periodStart);
      if (periodEnd) contractQuery = contractQuery.lte('start_date', periodEnd);

      const { data: contracts, error: contractsError } = await contractQuery;

      if (contractsError) throw contractsError;

      // Get paid commissions (all time) — payments for contracts may occur outside period
      const { data: paidCommissions, error: commissionsError } = await supabase
        .from('commission_payments')
        .select('contract_id, amount')
        .eq('sales_agent_id', salesAgentId);

      if (commissionsError) throw commissionsError;

      const paidContractIds = new Set((paidCommissions || []).map(c => c.contract_id));
      const totalPaid = (paidCommissions || []).reduce((sum, c) => sum + Number(c.amount), 0);

      // Calculate total expected commission using tiered or fixed system
      const totalExpected = (contracts || []).reduce((sum, c) => {
        const contractAmount = Number(c.total_loan_amount || 0);
        const pct = useTiered 
          ? calculateTieredCommission(contractAmount, tiers)
          : fixedPct;
        return sum + (contractAmount * pct) / 100;
      }, 0);

      // Calculate yearly omset for bonus (current year contracts) - unaffected by period filter.
      // Business rule: Bonus Tahunan = 0.8% × total omset tahun berjalan.
      // Important: this is calculated on the total yearly omset (sum of contract amounts for the year)
      // and NOT by taking 0.8% of each month's omset and summing those monthly bonuses. Using the
      // yearly total avoids double-counting and matches the financial dashboard behavior.
      const currentYear = new Date().getFullYear();
      // Use contract.start_date to determine which contracts count for the year (consistent with yearly summaries)
      const yearlyOmset = (contracts || [])
        .filter(c => new Date(c.start_date).getFullYear() === currentYear)
        .reduce((sum, c) => sum + Number(c.total_loan_amount || 0), 0);

      // YEARLY_BONUS_PERCENTAGE is applied as percent (0.8 means 0.8%)
      const yearlyBonus = (yearlyOmset * 0.8) / 100; // 0.8% yearly bonus

      return {
        totalPaid,
        totalUnpaid: totalExpected - totalPaid,
        totalContracts: (contracts || []).length,
        paidContracts: paidContractIds.size,
        yearlyOmset,
        yearlyBonus,
      };
    },
    enabled: !!salesAgentId,
  });
};

// Fetch total commission paid in a period (all agents)
export const useTotalCommissionPaid = (periodStart?: string | null, periodEnd?: string | null) => {
  return useQuery({
    queryKey: ['commission_paid_total', periodStart || null, periodEnd || null],
    queryFn: async () => {
      let query = supabase.from('commission_payments').select('amount');
      if (periodStart) query = query.gte('payment_date', periodStart);
      if (periodEnd) query = query.lte('payment_date', periodEnd);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    },
  });
};
