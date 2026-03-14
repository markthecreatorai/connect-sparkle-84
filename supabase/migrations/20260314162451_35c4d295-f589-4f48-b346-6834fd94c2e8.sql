
CREATE TABLE public.task_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_id text NOT NULL,
  title text NOT NULL,
  vip_level_code text DEFAULT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.task_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage task_videos" ON public.task_videos
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read active task_videos" ON public.task_videos
  FOR SELECT TO authenticated USING (is_active = true);

-- Seed with existing 30 videos
INSERT INTO public.task_videos (youtube_id, title, sort_order) VALUES
  ('dQw4w9WgXcQ', 'Estratégias de Marketing Digital', 1),
  ('jNQXAC9IVRw', 'Primeiros Passos no Empreendedorismo', 2),
  ('9bZkp7q19f0', 'Como Conquistar Clientes Online', 3),
  ('kJQP7kiw5Fk', 'Técnicas de Vendas Avançadas', 4),
  ('RgKAFK5djSk', 'Mindset de Sucesso Financeiro', 5),
  ('fJ9rUzIMcZQ', 'Planejamento Financeiro Pessoal', 6),
  ('CevxZvSJLk8', 'Liderança e Gestão de Equipes', 7),
  ('OPf0YbXqDm0', 'Inteligência Emocional nos Negócios', 8),
  ('hT_nvWreIhg', 'Renda Extra: Guia Completo', 9),
  ('kXYiU_JCYtU', 'Investimentos para Iniciantes', 10),
  ('JGwWNGJdvx8', 'Motivação e Produtividade', 11),
  ('YQHsXMglC9A', 'Networking Profissional Eficaz', 12),
  ('lp-EO5I60KA', 'Como Criar uma Marca Pessoal', 13),
  ('e-ORhEE9VVg', 'Finanças: Controle de Gastos', 14),
  ('09R8_2nJtjg', 'Metas e Objetivos SMART', 15),
  ('pRpeEdMmmQ0', 'E-commerce: Como Começar', 16),
  ('60ItHLz5WEA', 'Comunicação Persuasiva', 17),
  ('YykjpeuMNEk', 'Gestão do Tempo Eficiente', 18),
  ('fLexgOxsZu0', 'Marketing de Indicação', 19),
  ('nfWlot6h_JM', 'Como Montar um Pitch de Vendas', 20),
  ('bx1Bh8ZvH84', 'Resiliência nos Negócios', 21),
  ('M7lc1UVf-VE', 'Educação Financeira Básica', 22),
  ('2Vv-BfVoq4g', 'Atendimento ao Cliente Premium', 23),
  ('FTQbiNvZqaY', 'Análise de Mercado e Tendências', 24),
  ('RK1K2bCg4J8', 'Trabalho em Equipe de Alta Performance', 25),
  ('PT2_F-1esPk', 'Como Escalar seu Negócio', 26),
  ('Zi_XLOBDo_Y', 'Mentalidade Empreendedora', 27),
  ('L_jWHffIx5E', 'Gatilhos Mentais em Vendas', 28),
  ('oHg5SJYRHA0', 'Fidelização de Clientes', 29),
  ('QH2-TGUlwu4', 'Estratégias de Crescimento Rápido', 30);
