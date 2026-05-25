import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Ensure env vars are loaded: if not present, try to read .env in project root
const envUrlKey = 'VITE_SUPABASE_URL';
const envKeyKey = 'VITE_SUPABASE_PUBLISHABLE_KEY';
if (!process.env[envUrlKey] || !process.env[envKeyKey]) {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    const raw = fs.readFileSync(envPath, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(.*?))\s*$/);
      if (!m) return;
      const k = m[1];
      const v = m[2] ?? m[3] ?? m[4] ?? '';
      if (!process.env[k]) process.env[k] = v;
    });
  } catch (e) {
    // ignore — will error below if still missing
  }
}

const SUPABASE_URL = process.env[envUrlKey];
const SUPABASE_KEY = process.env[envKeyKey];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY in environment and .env not found/invalid.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run(year = 2026) {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  // total commission paid (payments recorded)
  const { data: paidRows, error: paidErr } = await supabase
    .from('commission_payments')
    .select('amount')
    .gte('payment_date', start)
    .lte('payment_date', end);
  if (paidErr) {
    console.error('Error fetching commission_payments:', paidErr);
    process.exit(1);
  }
  const totalPaid = (paidRows || []).reduce((s, r) => s + Number(r.amount || 0), 0);

  // total omset (contract basis)
  const { data: omsetRows, error: omsetErr } = await supabase
    .from('credit_contracts')
    .select('total_loan_amount')
    .gte('start_date', start)
    .lte('start_date', end)
    .neq('status', 'returned');
  if (omsetErr) {
    console.error('Error fetching credit_contracts:', omsetErr);
    process.exit(1);
  }
  const totalOmset = (omsetRows || []).reduce((s, r) => s + Number(r.total_loan_amount || 0), 0);
  const commission08 = totalOmset * 0.008;

  console.log(JSON.stringify({ year, total_commission_paid: totalPaid, total_omset: totalOmset, commission_0_8pct: commission08 }, null, 2));
}

const yearArg = process.argv[2] ? Number(process.argv[2]) : 2026;
run(yearArg).catch(e => { console.error(e); process.exit(1); });
