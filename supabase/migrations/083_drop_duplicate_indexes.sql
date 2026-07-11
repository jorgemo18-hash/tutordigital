-- Elimina los 2 pares de índices duplicados exactos señalados por el
-- Advisor de performance (duplicate_index). Confirmado contra pg_indexes
-- antes de aplicar — ver informe.

-- 1. groups: groups_tenant_normalized_name_uniq vs idx_groups_tenant_normalized
--    Ambos son CREATE UNIQUE INDEX idénticos sobre (tenant_id, normalized_name),
--    ninguno respaldado por una constraint con nombre — se puede DROP INDEX
--    directo. Se conserva idx_groups_tenant_normalized (sigue la convención
--    idx_<tabla>_<col> ya usada por los demás índices de esta tabla:
--    idx_groups_tenant, idx_groups_join_code_hash).
--
--    HALLAZGO APARTE (no se toca aquí, fuera de alcance de esta migración):
--    la migración 016_add_variant_to_groups.sql pretendía sustituir este
--    índice de 2 columnas por groups_tenant_variant_normalized_name_uniq
--    (3 columnas: tenant_id, variant, normalized_name) al añadir la
--    columna `variant`. La columna existe y el otro índice de esa
--    migración (groups_tenant_stage_year_track_variant_uniq) también
--    existe, pero groups_tenant_variant_normalized_name_uniq NUNCA se creó
--    — la migración 016 quedó aplicada solo a medias. Hoy la unicidad de
--    nombre normalizado sigue siendo por (tenant_id, normalized_name) SIN
--    variant, lo cual puede ser más restrictivo de lo que 016 pretendía
--    (dos grupos con el mismo nombre en variants distintas del mismo
--    tenant serían rechazados como duplicados). Requiere decisión
--    explícita — ver informe.
DROP INDEX IF EXISTS public.groups_tenant_normalized_name_uniq;

-- 2. teacher_group_subjects: dos UNIQUE CONSTRAINTS (no solo índices)
--    idénticos sobre (teacher_profile_id, group_id, subject_id).
--    teacher_group_subjects_profile_group_subject_key es el definido en
--    migraciones (041_teacher_group_subjects_unique.sql); el otro
--    (nombre truncado por Postgres, típico de un ALTER TABLE ADD
--    CONSTRAINT UNIQUE sin nombre explícito aplicado directamente, fuera
--    de las migraciones versionadas) es el redundante. Al estar respaldados
--    por una constraint con nombre, hace falta DROP CONSTRAINT (no basta
--    DROP INDEX) — Postgres lo rechaza si el índice pertenece a una
--    constraint.
ALTER TABLE public.teacher_group_subjects
  DROP CONSTRAINT IF EXISTS teacher_group_subjects_teacher_profile_id_group_id_subject__key;
