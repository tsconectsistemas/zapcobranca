-- Sistema de Vouchers
CREATE TABLE IF NOT EXISTS public.vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
    discount_value NUMERIC NOT NULL,
    plan_id TEXT, -- Se NULL, vale para todos
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    valid_from TIMESTAMPTZ DEFAULT now(),
    valid_until TIMESTAMPTZ,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage vouchers" ON public.vouchers FOR ALL USING (public.is_admin());

-- Gestão de Planos SaaS
CREATE TABLE IF NOT EXISTS public.saas_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price_monthly NUMERIC NOT NULL,
    price_yearly NUMERIC,
    max_customers INTEGER,
    features JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.saas_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active plans" ON public.saas_plans FOR SELECT USING (is_active = true);
CREATE POLICY "Admin can manage plans" ON public.saas_plans FOR ALL USING (public.is_admin());

-- Conteúdo da Landing Page
CREATE TABLE IF NOT EXISTS public.landing_content (
    id TEXT PRIMARY KEY,
    section TEXT NOT NULL,
    content JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES public.admin_users(id)
);

ALTER TABLE public.landing_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view landing content" ON public.landing_content FOR SELECT USING (true);
CREATE POLICY "Admin can manage landing content" ON public.landing_content FOR ALL USING (public.is_admin());

-- Dados iniciais para Planos
INSERT INTO public.saas_plans (id, name, description, price_monthly, price_yearly, max_customers, features, is_featured, sort_order)
VALUES 
('free', 'Gratuito', 'Para quem está começando', 0, 0, 10, '["Até 10 clientes", "Notificações básicas", "Suporte via email"]', false, 0),
('pro', 'Profissional', 'Ideal para revendas em crescimento', 47.00, 470.00, 100, '["Até 100 clientes", "WhatsApp Ilimitado", "Suporte Prioritário", "Relatórios Avançados"]', true, 1),
('business', 'Business', 'Escala total para grandes operações', 97.00, 970.00, 1000, '["Até 1000 clientes", "API de Integração", "Gerente de Contas", "White Label"]', false, 2)
ON CONFLICT (id) DO NOTHING;

-- Dados iniciais para Landing Page
INSERT INTO public.landing_content (id, section, content)
VALUES 
('hero', 'hero', '{
    "badge": "Lançamento v2.0",
    "title": "Automatize suas cobranças via WhatsApp",
    "subtitle": "A plataforma completa para revendas IPTV, Provedores e SaaS gerenciarem seus clientes com recorrência.",
    "cta_primary": "Começar agora",
    "cta_secondary": "Ver planos"
}'),
('stats', 'stats', '{
    "items": [
        {"value": "5k+", "label": "Clientes Ativos"},
        {"value": "R$ 2M", "label": "Processados"},
        {"value": "99.9%", "label": "Uptime"}
    ]
}'),
('features', 'features', '{
    "items": [
        {"title": "Cobrança Automática", "desc": "Envie lembretes antes, no dia e após o vencimento sem mover um dedo."},
        {"title": "Pix Automático", "desc": "Confirmação instantânea e liberação de acesso imediata via API Asaas."},
        {"title": "Painel Revenda", "desc": "Painel completo para você gerenciar seus assinantes com facilidade."}
    ]
}')
ON CONFLICT (id) DO NOTHING;
