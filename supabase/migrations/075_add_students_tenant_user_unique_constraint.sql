-- 075_add_students_tenant_user_unique_constraint.sql
-- provisionarAccesoAlumno() (server/lib/academiaAlumnoAcceso.js) hace
-- upsert(...).onConflict("tenant_id,user_id") sobre students, pero no
-- existía ningún constraint único que respaldara ese par de columnas —
-- Postgres devolvía 42P10 ("no unique or exclusion constraint matching
-- the ON CONFLICT specification"). Verificado antes de aplicar que no hay
-- filas duplicadas (tenant_id, user_id) con user_id no nulo en producción.
ALTER TABLE students
ADD CONSTRAINT students_tenant_id_user_id_key
UNIQUE (tenant_id, user_id);
