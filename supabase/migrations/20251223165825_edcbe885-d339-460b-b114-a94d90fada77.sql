-- Create holidays table for skipping dates during coupon generation
CREATE TABLE public.holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  holiday_date DATE NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on holidays
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- RLS policies for holidays
CREATE POLICY "Authenticated users can view holidays" 
ON public.holidays FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert holidays" 
ON public.holidays FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update holidays" 
ON public.holidays FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete holidays" 
ON public.holidays FOR DELETE USING (true);

-- Add start_date to credit_contracts
ALTER TABLE public.credit_contracts 
ADD COLUMN start_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Create installment_coupons table
CREATE TABLE public.installment_coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.credit_contracts(id) ON DELETE CASCADE,
  installment_index INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(contract_id, installment_index)
);

-- Enable RLS on installment_coupons
ALTER TABLE public.installment_coupons ENABLE ROW LEVEL SECURITY;

-- RLS policies for installment_coupons
CREATE POLICY "Authenticated users can view coupons" 
ON public.installment_coupons FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert coupons" 
ON public.installment_coupons FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update coupons" 
ON public.installment_coupons FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete coupons" 
ON public.installment_coupons FOR DELETE USING (true);

-- Add coupon_id to payment_logs
ALTER TABLE public.payment_logs 
ADD COLUMN coupon_id UUID REFERENCES public.installment_coupons(id);

-- Create function to generate holiday-aware coupons (idempotent)
CREATE OR REPLACE FUNCTION public.generate_installment_coupons(
  p_contract_id UUID,
  p_start_date DATE,
  p_tenor_days INTEGER,
  p_daily_amount NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_date DATE := p_start_date;
  v_coupon_index INTEGER := 1;
  v_holidays DATE[];
BEGIN
  -- Fetch holiday dates into an array
  SELECT ARRAY_AGG(holiday_date) INTO v_holidays FROM public.holidays;
  IF v_holidays IS NULL THEN
    v_holidays := ARRAY[]::DATE[];
  END IF;

  -- Make operation idempotent: remove any existing coupons for this contract
  DELETE FROM public.installment_coupons WHERE contract_id = p_contract_id;

  -- Generate coupons respecting holidays. Use ON CONFLICT DO NOTHING as extra safety.
  WHILE v_coupon_index <= p_tenor_days LOOP
    IF v_current_date = ANY(v_holidays) THEN
      v_current_date := v_current_date + INTERVAL '1 day';
      CONTINUE;
    END IF;

    INSERT INTO public.installment_coupons (
      contract_id,
      installment_index,
      due_date,
      amount,
      status
    ) VALUES (
      p_contract_id,
      v_coupon_index,
      v_current_date,
      p_daily_amount,
      'unpaid'
    ) ON CONFLICT (contract_id, installment_index) DO NOTHING;

    v_coupon_index := v_coupon_index + 1;
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  -- Helpful debug notice to surface errors in logs; re-raise to let caller see the error
  RAISE NOTICE 'generate_installment_coupons failed for contract %: %', p_contract_id, SQLERRM;
  RAISE;
END;
$$;

-- Create indexes for performance
CREATE INDEX idx_installment_coupons_contract ON public.installment_coupons(contract_id);
CREATE INDEX idx_installment_coupons_due_date ON public.installment_coupons(due_date);
CREATE INDEX idx_installment_coupons_status ON public.installment_coupons(status);
CREATE INDEX idx_holidays_date ON public.holidays(holiday_date);