# Backup manual de la base de datos (Supabase, plan Free)

El proyecto está en plan Free de Supabase, que **no incluye backups**
("Free Plan does not include project backups", confirmado en el dashboard).
La base contiene datos de alumnos menores, familias, histórico económico de
Lyceo y fichajes con valor legal (RDL 8/2019). Hasta la migración a
Supabase Pro (prevista para septiembre 2026), `scripts/backup-db.sh` es la
**única** copia de seguridad que existe.

## Investigación previa (conexión y flags)

Antes de escribir el script se comprobó contra la documentación real de
Supabase, no se asumió:

- **Conexión recomendada para `pg_dump`: puerto 5432** (conexión directa o
  *session pooler*), nunca el *transaction pooler* (puerto 6543) — ese modo
  no soporta sentencias preparadas y puede cortar sesiones largas, algo que
  `pg_dump` necesita para completar el volcado. ([Supabase — Connecting to
  Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres))
- En plan Free, la **conexión directa** (`db.[project-id].supabase.co:5432`)
  requiere IPv6 (IPv4 es un add-on de pago). El **session pooler**
  (`aws-[region].pooler.supabase.com:5432`) funciona con IPv4 en todos los
  planes, incluido Free — es la opción práctica por defecto para la mayoría
  de redes domésticas/oficina.
- `--no-owner --no-privileges`: necesarios porque los roles del proyecto de
  origen no existen igual en un proyecto Supabase distinto — sin estos
  flags, restaurar en un proyecto nuevo falla o deja dueños/permisos mal
  asignados.
- El volcado se limita al esquema `public` (verificado contra el esquema
  real de este proyecto: `public` es el único esquema de aplicación: el
  resto — `auth`, `storage`, `realtime`, `extensions`, `graphql`,
  `graphql_public`, `cron`, `vault`, `supabase_migrations` — los gestiona
  Supabase internamente). Mismo criterio que usa `supabase db dump` por
  defecto: volcar esos esquemas gestionados puede chocar con lo que el
  proyecto de destino ya provisiona por sí mismo.

## Qué NO cubre este backup

- **Supabase Storage** (adjuntos, PDFs generados, fotos de gastos...) — son
  objetos en un bucket, no filas de Postgres. `pg_dump` no los toca.
- **El esquema `auth`** (credenciales de login) — se excluye a propósito.
  Restaurar este backup en un proyecto nuevo recupera los DATOS, pero no
  las cuentas de login: alumnos/familias/profesores necesitarían
  reinvitación o reset de contraseña, no entrarían directamente.

## Cómo ejecutarlo

```bash
export SUPABASE_DB_URL="postgresql://postgres.xxxx:CONTRASEÑA@aws-REGION.pooler.supabase.com:5432/postgres"
./scripts/backup-db.sh
```

O define `SUPABASE_DB_URL` en un archivo `.env` en la raíz del repo (nunca
se commitea — ya está en `.gitignore`).

De dónde sale la cadena de conexión: dashboard de Supabase → el proyecto →
botón **Connect** (arriba) → pestaña **Session pooler** → copiar el URI y
sustituir `[YOUR-PASSWORD]` por la contraseña real de la base de datos.

Destino del archivo: `$BACKUP_DEST_DIR` si está definida, si no
`~/tutordigital-backups/` (fuera del repo siempre, por diseño — nunca puede
acabar commiteado por accidente).

## Cómo restaurarlo en un proyecto de prueba (verificación)

**Un backup que nunca se ha restaurado no es un backup — es un archivo que
esperas que funcione.** El único momento en que sabes de verdad que un
volcado sirve es cuando lo restauras y compruebas los datos.

1. Crea un proyecto Supabase nuevo y vacío, solo para esta prueba (no
   reutilices uno con datos reales).
2. Consigue su cadena de conexión igual que arriba (Connect → Session
   pooler) — llámala `TEST_DB_URL`.
3. Restaura el volcado:

   ```bash
   pg_restore \
     --dbname="$TEST_DB_URL" \
     --no-owner \
     --no-privileges \
     --verbose \
     ~/tutordigital-backups/tutordigital_YYYYMMDD_HHMMSS.dump
   ```

4. Verifica de verdad, no solo que el comando no dio error:
   - Conecta con `psql "$TEST_DB_URL"` y comprueba `\dt public.*` — deben
     aparecer todas las tablas esperadas (`tenants`, `students`,
     `academia_*`, etc.).
   - Cuenta filas de alguna tabla grande y compara con el proyecto real:
     `SELECT count(*) FROM tenants;` (o la que corresponda) — deben
     coincidir.
   - Si algo falla o los números no cuadran, el backup NO sirve — averigua
     por qué antes de confiar en el siguiente.
5. Borra el proyecto de prueba cuando termines — no dejes una copia de
   datos reales de menores en un segundo proyecto sin necesidad.

## Buenas prácticas mientras tanto

- Guarda cada `.dump` cifrado (volumen APFS/FileVault cifrado, o cifrado
  aparte con `age`/`gpg`) — contiene datos personales de menores.
- No lo subas sin cifrar a un servicio de almacenamiento en la nube de
  terceros.
- Repite la restauración de prueba de vez en cuando, no solo la primera
  vez — un backup que servía hace 3 meses no garantiza que sirva hoy si el
  esquema ha cambiado.
