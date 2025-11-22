-- Create enum types
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'staff');
CREATE TYPE public.stock_status AS ENUM ('draft', 'waiting', 'ready', 'done', 'canceled');
CREATE TYPE public.movement_type AS ENUM ('receipt', 'delivery', 'transfer', 'adjustment');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create warehouses table
CREATE TABLE public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  unit_of_measure TEXT NOT NULL DEFAULT 'unit',
  reorder_level NUMERIC(10,2) DEFAULT 0,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create receipts table (incoming stock)
CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE RESTRICT NOT NULL,
  supplier_name TEXT NOT NULL,
  status stock_status NOT NULL DEFAULT 'draft',
  scheduled_date DATE,
  received_date TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create receipt_lines table
CREATE TABLE public.receipt_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID REFERENCES public.receipts(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  received_quantity NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create deliveries table (outgoing stock)
CREATE TABLE public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE RESTRICT NOT NULL,
  customer_name TEXT NOT NULL,
  status stock_status NOT NULL DEFAULT 'draft',
  scheduled_date DATE,
  delivered_date TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create delivery_lines table
CREATE TABLE public.delivery_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID REFERENCES public.deliveries(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  delivered_quantity NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create stock_movements table (ledger)
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT NOT NULL,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE RESTRICT NOT NULL,
  movement_type movement_type NOT NULL,
  reference_id UUID,
  quantity NUMERIC(10,2) NOT NULL,
  balance_after NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create stock_balances view for current stock levels
CREATE OR REPLACE VIEW public.stock_balances AS
SELECT 
  product_id,
  warehouse_id,
  SUM(quantity) as quantity
FROM public.stock_movements
GROUP BY product_id, warehouse_id;

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for profiles
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for user_roles (only admins can manage)
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for warehouses (authenticated users can view, admins can modify)
CREATE POLICY "Authenticated users can view warehouses"
  ON public.warehouses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert warehouses"
  ON public.warehouses FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update warehouses"
  ON public.warehouses FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for categories
CREATE POLICY "Authenticated users can view categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage categories"
  ON public.categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for products
CREATE POLICY "Authenticated users can view products"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers and admins can insert products"
  ON public.products FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Managers and admins can update products"
  ON public.products FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- RLS Policies for receipts
CREATE POLICY "Authenticated users can view receipts"
  ON public.receipts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can create receipts"
  ON public.receipts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can update own receipts or managers/admins can update all"
  ON public.receipts FOR UPDATE
  USING (
    created_by = auth.uid() OR
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- RLS Policies for receipt_lines
CREATE POLICY "Authenticated users can view receipt lines"
  ON public.receipt_lines FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert receipt lines"
  ON public.receipt_lines FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update receipt lines"
  ON public.receipt_lines FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for deliveries (similar to receipts)
CREATE POLICY "Authenticated users can view deliveries"
  ON public.deliveries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can create deliveries"
  ON public.deliveries FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can update own deliveries or managers/admins can update all"
  ON public.deliveries FOR UPDATE
  USING (
    created_by = auth.uid() OR
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- RLS Policies for delivery_lines
CREATE POLICY "Authenticated users can view delivery lines"
  ON public.delivery_lines FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert delivery lines"
  ON public.delivery_lines FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update delivery lines"
  ON public.delivery_lines FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for stock_movements (ledger - read-only for most, write for system)
CREATE POLICY "Authenticated users can view stock movements"
  ON public.stock_movements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert stock movements"
  ON public.stock_movements FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Insert default warehouse
INSERT INTO public.warehouses (name, code, address) 
VALUES ('Main Warehouse', 'WH-MAIN', '123 Warehouse Street');

-- Insert default categories
INSERT INTO public.categories (name, description) VALUES
  ('Raw Materials', 'Basic materials for production'),
  ('Finished Goods', 'Ready to ship products'),
  ('Components', 'Parts and components');
