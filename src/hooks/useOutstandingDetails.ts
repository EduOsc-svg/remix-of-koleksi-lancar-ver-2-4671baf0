import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, startOfYear, endOfYear, format } from 'date-fns';

export interface OutstandingContractDetail {
  contract_id: string;
  contract_ref: string;
  customer_name: string;
  customer_phone: string | null;
  sales_id: string | null;
  sales_name: string;
  sales_code: string;
  start_date: string;
  contract_total: number;     // daily_installment_amount × tenor_days
  paid_amount: number;        // ALL TIME payments
  outstanding: number;        // contract_total − paid_amount (>=0)
  status: string;
}

export interface OutstandingBySales {
  sales_id: string | null;
  sales_name: string;
  sales_code: string;
  contract_count: number;
  total_outstanding: number;
  total_contract: number;
  total_paid: number;
}

export interface OutstandingDetailsSummary {
  scope: 'monthly' | 'yearly';
  period_label: string;
  total_outstanding: number;
  total_contract_value: number;
  total_paid: number;
  contracts_count: number;
  by_sales: OutstandingBySales[];
  contracts: OutstandingContractDetail[];
}

/**
 * Detail sisa tagihan per kontrak untuk periode (bulan/tahun).
 * Selaras dengan rumus di useMonthlyPerformance & useYearlyFinancialSummary:
 *   Sisa = (daily_installment_amount × tenor_days) − pembayaran ALL TIME
 *   Hanya kontrak start_date di periode, status != 'returned'.
 */
const fetchOutstandingDetails = async (
  scope: 'monthly' | 'yearly',
  periodDate: Date,
): Promise<OutstandingDetailsSummary> => {
  const start = scope === 'monthly'
    ? format(startOfMonth(periodDate), 'yyyy-MM-dd')
    : format(startOfYear(periodDate), 'yyyy-MM-dd');
  const end = scope === 'monthly'
    ? format(endOfMonth(periodDate), 'yyyy-MM-dd')
    : format(endOfYear(periodDate), 'yyyy-MM-dd');

  const [
    { data: contracts, error: cErr },
    { data: allPayments, error: pErr },
    { data: agents, error: aErr },
  ] = await Promise.all([
    supabase
      .from('credit_contracts')
      .select('id, contract_ref, start_date, status, sales_agent_id, total_loan_amount, daily_installment_amount, tenor_days, customers(name, phone)')
      .neq('status', 'returned')
      .gte('start_date', start)
      .lte('start_date', end),
    supabase.from('payment_logs').select('amount_paid, contract_id'),
    supabase.from('sales_agents').select('id, name, agent_code'),
  ]);

  if (cErr) throw cErr;
  if (pErr) throw pErr;
  if (aErr) throw aErr;

  const paidByContract = new Map<string, number>();
  (allPayments || []).forEach((p: any) => {
    paidByContract.set(p.contract_id, (paidByContract.get(p.contract_id) || 0) + Number(p.amount_paid || 0));
  });

  const agentLookup = new Map<string, { name: string; code: string }>();
  (agents || []).forEach((a: any) => agentLookup.set(a.id, { name: a.name, code: a.agent_code }));

  const details: OutstandingContractDetail[] = [];
  const bySalesMap = new Map<string, OutstandingBySales>();
  let totalOutstanding = 0;
  let totalContractValue = 0;
  let totalPaid = 0;

  (contracts || []).forEach((c: any) => {
    // Sinkron dengan useMonthlyPerformance & useYearlyFinancialSummary
    const contractTotal = Number(c.total_loan_amount || 0);
    const paid = paidByContract.get(c.id) || 0;
    const outstanding = Math.max(0, contractTotal - paid);
    if (outstanding <= 0) return; // Hanya yang masih punya sisa

    const agentInfo = c.sales_agent_id ? agentLookup.get(c.sales_agent_id) : null;
    const salesName = agentInfo?.name || 'Tanpa Sales';
    const salesCode = agentInfo?.code || '-';

    details.push({
      contract_id: c.id,
      contract_ref: c.contract_ref || c.id,
      customer_name: c.customers?.name || '-',
      customer_phone: c.customers?.phone || null,
      sales_id: c.sales_agent_id || null,
      sales_name: salesName,
      sales_code: salesCode,
      start_date: c.start_date,
      contract_total: contractTotal,
      paid_amount: paid,
      outstanding,
      status: c.status,
    });

    totalOutstanding += outstanding;
    totalContractValue += contractTotal;
    totalPaid += paid;

    const key = c.sales_agent_id || 'none';
    const existing = bySalesMap.get(key) || {
      sales_id: c.sales_agent_id || null,
      sales_name: salesName,
      sales_code: salesCode,
      contract_count: 0,
      total_outstanding: 0,
      total_contract: 0,
      total_paid: 0,
    };
    existing.contract_count += 1;
    existing.total_outstanding += outstanding;
    existing.total_contract += contractTotal;
    existing.total_paid += paid;
    bySalesMap.set(key, existing);
  });

  details.sort((a, b) => b.outstanding - a.outstanding);
  const by_sales = Array.from(bySalesMap.values()).sort((a, b) => b.total_outstanding - a.total_outstanding);

  return {
    scope,
    period_label: scope === 'monthly'
      ? format(periodDate, 'yyyy-MM')
      : String(periodDate.getFullYear()),
    total_outstanding: totalOutstanding,
    total_contract_value: totalContractValue,
    total_paid: totalPaid,
    contracts_count: details.length,
    by_sales,
    contracts: details,
  };
};

export const useOutstandingDetailsMonthly = (month: Date = new Date()) => {
  const start = format(startOfMonth(month), 'yyyy-MM-dd');
  return useQuery({
    queryKey: ['outstanding_details_monthly', start],
    queryFn: () => fetchOutstandingDetails('monthly', month),
  });
};

export const useOutstandingDetailsYearly = (year: Date = new Date()) => {
  const yr = year.getFullYear();
  return useQuery({
    queryKey: ['outstanding_details_yearly', yr],
    queryFn: () => fetchOutstandingDetails('yearly', year),
  });
};
