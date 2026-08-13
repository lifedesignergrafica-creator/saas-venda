-- SaaS Venda — Loja Online (schema Supabase/Postgres)
-- Execute este arquivo no SQL Editor do seu projeto Supabase.

create extension if not exists "pgcrypto";

-- ---------- plans ----------
-- Catálogo de planos de assinatura. "slug" é o identificador estável usado no
-- código (ex: checagem de limites); price/limits podem ser ajustados aqui
-- sem precisar alterar código.
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  price_cents integer not null,       -- valor mensal em centavos (BRL)
  max_products integer,               -- null = ilimitado
  max_orders_per_month integer,       -- null = ilimitado
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into plans (slug, name, price_cents, max_products, max_orders_per_month)
values
  ('basico', 'Básico', 4990, 50, 100),
  ('pro', 'Pro', 9990, 300, 1000),
  ('ilimitado', 'Ilimitado', 19990, null, null)
on conflict (slug) do nothing;

-- ---------- stores ----------
create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'suspended');

create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_email text not null,
  notification_email text not null, -- para onde vão os avisos de novo pedido
  plan_id uuid references plans(id),
  subscription_status subscription_status not null default 'trialing',
  trial_ends_at timestamptz default (now() + interval '14 days'),
  mp_preapproval_id text,             -- id da assinatura recorrente no Mercado Pago
  created_at timestamptz not null default now()
);

create index if not exists idx_stores_owner_email on stores(owner_email);
create index if not exists idx_stores_mp_preapproval on stores(mp_preapproval_id);

-- ---------- products ----------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  image_url text,
  price numeric(10,2) not null default 0,
  stock_quantity integer not null default 0,
  min_stock_alert integer not null default 5,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- customers ----------
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  created_at timestamptz not null default now()
);

-- ---------- orders ----------
create type payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type fulfillment_type as enum ('PICKUP', 'DELIVERY');
create type order_status as enum ('RECEIVED', 'IN_PRODUCTION', 'SHIPPED', 'READY_FOR_PICKUP', 'DONE');

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  customer_id uuid not null references customers(id),
  total_amount numeric(10,2) not null default 0,
  payment_method text not null default 'PIX',
  payment_status payment_status not null default 'pending',
  fulfillment_type fulfillment_type not null default 'PICKUP',
  delivery_address jsonb,
  status order_status not null default 'RECEIVED',
  gateway_payment_id text,
  gateway_preference_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- order_items ----------
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id),
  product_name text not null,
  quantity integer not null,
  unit_price numeric(10,2) not null
);

-- ---------- order_status_history ----------
create table if not exists order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  status order_status not null,
  notified_at timestamptz, -- preenchido quando o e-mail de aviso foi enviado com sucesso
  created_at timestamptz not null default now()
);

-- Baixa de estoque atômica (evita condição de corrida quando dois pedidos
-- do mesmo produto são pagos quase ao mesmo tempo).
create or replace function decrement_stock(p_product_id uuid, p_quantity integer)
returns void as $$
begin
  update products
  set stock_quantity = greatest(0, stock_quantity - p_quantity),
      updated_at = now()
  where id = p_product_id;
end;
$$ language plpgsql;

create index if not exists idx_products_store on products(store_id);
create index if not exists idx_orders_store on orders(store_id);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_order_items_order on order_items(order_id);
create index if not exists idx_status_history_order on order_status_history(order_id);

-- RLS: os dados públicos da vitrine (produtos ativos) podem ser lidos por qualquer um;
-- todo o resto passa exclusivamente pela service role key (usada só no backend, nunca no navegador do cliente).
alter table stores enable row level security;
alter table products enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_status_history enable row level security;

create policy "Produtos ativos são públicos para leitura"
  on products for select
  using (active = true);

create policy "Lojas são públicas para leitura (dados básicos)"
  on stores for select
  using (true);

-- Nenhuma policy de insert/update/delete é criada para o público:
-- toda escrita (criar pedido, mudar status, etc.) passa pela service role key no backend.

-- ---------- subscription_events ----------
-- Log de cada notificação de assinatura recebida do Mercado Pago (auditoria e
-- depuração — nunca é a fonte da verdade sozinha, sempre rebuscamos o status
-- real na API do Mercado Pago antes de mudar o acesso da loja).
create table if not exists subscription_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete set null,
  mp_preapproval_id text,
  status text,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_subscription_events_store on subscription_events(store_id);

alter table plans enable row level security;
create policy "Planos são públicos para leitura"
  on plans for select
  using (is_active = true);
