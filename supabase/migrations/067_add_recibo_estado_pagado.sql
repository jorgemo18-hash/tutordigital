-- 067_add_recibo_estado_pagado.sql
-- academia_recibos.estado es text, pero SÍ tiene un check constraint
-- (academia_recibos_estado_check, de la migración 059) que solo permite
-- 'borrador'/'enviado' — sin ampliarlo, el UPDATE a estado='pagado' falla
-- en la base de datos antes de llegar a ninguna validación Zod. Hay que
-- ampliar el constraint, no solo el backend.

alter table public.academia_recibos
  add column if not exists fecha_pago date;

alter table public.academia_recibos drop constraint if exists academia_recibos_estado_check;
alter table public.academia_recibos add constraint academia_recibos_estado_check
  check (estado = any (array['borrador'::text, 'enviado'::text, 'pagado'::text]));

-- "Marca como pagado y envía el recibo automáticamente" — Ajustes ›
-- Facturación › Recibos.
alter table public.academia_config
  add column if not exists enviar_recibo_al_pagar boolean not null default false;
