-- 100_ai_token_usage.sql
-- Consumo real de tokens de Claude API por tenant — una fila por llamada
-- real (tutor Socrático + Agente Guía, Fases 1 y 2), no agregado por
-- día/tenant. El volumen está acotado por el uso real de Claude, no es un
-- evento sintético de alta frecuencia: con datos reales de producción a
-- 2026-07-27 (3 tenants activos, 6 sesiones de tutor en total desde el
-- 18 de junio) incluso una proyección muy generosa a 2 años no acerca esta
-- tabla a un tamaño impracticable para Postgres con los índices de abajo.
-- Fila-por-llamada da flexibilidad total para análisis futuro (coste por
-- sesión, por modelo, auditar una llamada concreta) sin adivinar ahora qué
-- agregación hará falta — se puede agregar en la consulta, no al revés.
-- Si el volumen se dispara de verdad más adelante, el remedio estándar es
-- particionado declarativo por mes sobre created_at, añadible después sin
-- tocar el código de la aplicación.
--
-- Sin trigger de append-only (a diferencia de academia_fichajes, 093): esa
-- tabla lo tiene por una obligación legal (RDL 8/2019) de registro
-- inalterable; esta es una tabla de coste/analítica sin ese mandato.
create table if not exists public.ai_token_usage (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- on delete set null (no cascade): si la sesión se borra alguna vez, el
  -- registro de coste debe seguir existiendo — no tiene sentido que un
  -- historial de facturación desaparezca porque se limpió una sesión vieja.
  session_id uuid references public.tutor_sessions(id) on delete set null,
  -- Los 3 puntos de captura reales del código (server/lib/chat.js,
  -- server/lib/agents/guide.js Fase 1 y Fase 2) — permite desglosar coste
  -- por función sin tener que inferirlo del modelo.
  source text not null check (source in ('chat', 'guide_detect', 'guide_steps')),
  -- String literal del modelo tal cual lo devuelve el SDK (no un enum) —
  -- se sigue aceptando cualquier valor nuevo sin migración cuando se suba
  -- de versión de modelo (ver SONNET_MODEL/OPUS_MODEL en server/lib/anthropic.js).
  model text not null,
  input_tokens integer not null check (input_tokens >= 0),
  output_tokens integer not null check (output_tokens >= 0),
  -- guide.js usa prompt caching de verdad (Fase 2 reutiliza el documento
  -- cacheado por Fase 1) — Anthropic factura la lectura de caché a ~10% del
  -- precio normal y la escritura por encima del precio normal. Sin estas
  -- dos columnas, el coste en cost_eur saldría sistemáticamente mal para el
  -- Guía, que es justo donde más se usa. default 0 para que el resto de
  -- llamadas (sin caching) no necesiten mandarlas.
  cache_creation_input_tokens integer not null default 0 check (cache_creation_input_tokens >= 0),
  cache_read_input_tokens integer not null default 0 check (cache_read_input_tokens >= 0),
  -- Coste en EUR calculado por recordTokenUsage() en el momento del INSERT
  -- con la tarifa vigente entonces (server/lib/aiPricing.js) — congelado al
  -- escribir, nunca recalculado al leer: si Anthropic cambia precios más
  -- adelante, el coste histórico de este mes no debe cambiar retroactivamente
  -- con una tarifa que nunca se aplicó de verdad. NULL si el modelo no
  -- estaba en la tabla de precios en ese momento (los tokens se guardan
  -- igual — nunca se bloquea la captura por un precio que falte).
  cost_eur numeric(12, 6),
  created_at timestamptz not null default now()
);

-- (tenant_id, created_at): consultas por tenant en un rango de fechas (futuro
-- desglose de coste por tenant). created_at solo: el rollup GLOBAL de
-- superadmin no filtra por tenant, así que el índice compuesto no le sirve
-- (tenant_id es la columna líder).
create index if not exists idx_ai_token_usage_tenant_created
  on public.ai_token_usage(tenant_id, created_at);
create index if not exists idx_ai_token_usage_created
  on public.ai_token_usage(created_at);

alter table public.ai_token_usage enable row level security;

-- El backend usa service_role (bypasa RLS) para todo lo de hoy — igual que
-- el resto de tablas de este proyecto (ver academia_fichajes, 093), estas
-- políticas son la red de seguridad por si en el futuro se expone acceso
-- directo del frontend a PostgREST, no el mecanismo real de escritura.
--
-- Sin ninguna política de INSERT: nadie salvo el backend (service_role)
-- debe escribir aquí jamás — sin política, Postgres deniega esa operación a
-- `authenticated` por defecto. No hace falta redundar eso con una política
-- explícita como sí tiene academia_fichajes (que sí permite insertar al
-- propio trabajador).
drop policy if exists ai_token_usage_admin_select on public.ai_token_usage;
create policy ai_token_usage_admin_select
on public.ai_token_usage
for select
to authenticated
using (public.has_active_role(tenant_id, array['admin']));

-- Sin política específica de superadmin: su ruta ya usa service_role
-- directamente (ver server/routes/v1/superadmin.stats.routes.js), mismo
-- criterio que academia_fichajes.
