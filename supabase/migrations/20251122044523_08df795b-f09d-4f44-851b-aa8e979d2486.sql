-- Fix security warnings

-- Fix 1: Update handle_updated_at function with search_path
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix 2: Recreate stock_balances as a regular view (no SECURITY DEFINER)
DROP VIEW IF EXISTS public.stock_balances;
CREATE VIEW public.stock_balances AS
SELECT 
  product_id,
  warehouse_id,
  SUM(quantity) as quantity
FROM public.stock_movements
GROUP BY product_id, warehouse_id;
