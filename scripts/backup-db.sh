#!/usr/bin/env bash
set -euo pipefail

# scripts/backup-db.sh — copia de seguridad manual de la base de datos
# Supabase de este proyecto.
#
# Por qué existe: el proyecto está en plan Free de Supabase, que NO incluye
# backups ("Free Plan does not include project backups", confirmado en el
# dashboard). La base contiene datos de alumnos menores, familias, histórico
# económico y fichajes con valor legal (RDL 8/2019). Hasta la migración a
# Supabase Pro (prevista para septiembre 2026), este script es la ÚNICA
# copia de seguridad que existe — no hay red de seguridad de la plataforma.
#
# Uso:
#   ./scripts/backup-db.sh
#
# Requiere SUPABASE_DB_URL en el entorno o en un archivo .env en la raíz
# del repo (ver .env.example). Dónde conseguirla: dashboard de Supabase ->
# el proyecto -> botón "Connect" (o Project Settings -> Database) ->
# pestaña "Session pooler" (puerto 5432) -> copiar el URI y sustituir
# [YOUR-PASSWORD] por la contraseña real de la base de datos.
#
# Qué NO cubre este backup (léelo antes de confiar en él):
#   - Los archivos de Supabase Storage (adjuntos, PDFs generados, fotos de
#     gastos...) NO están aquí — pg_dump vuelca tablas de Postgres, no
#     objetos de un bucket. Necesitarían su propio mecanismo de copia.
#   - El esquema `auth` (credenciales de login) se excluye a propósito,
#     igual que hace `supabase db dump` — restaurarlo en un proyecto nuevo
#     puede chocar con el `auth` que Supabase ya provisiona él mismo ahí.
#     Tras restaurar este backup en un proyecto nuevo, los usuarios
#     necesitarían reinvitación/reset de contraseña, no login inmediato.
#   - Solo vuelca el esquema `public` (donde vive todo el dato de la app en
#     este proyecto — verificado contra el esquema real, no asumido). Si en
#     el futuro se añade otro esquema de aplicación, hay que sumarlo a
#     PG_DUMP_SCHEMAS más abajo.
#
# Ver scripts/README-backup-db.md para el comando exacto de restauración
# (pg_restore) y por qué un backup no verificado no cuenta como backup.

# ── 1. Cargar SUPABASE_DB_URL: del entorno, o de .env en la raíz ───────────

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"

if [[ -z "${SUPABASE_DB_URL:-}" && -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  cat >&2 <<'EOF'
✗ Falta SUPABASE_DB_URL.

No está definida en el entorno ni en un archivo .env en la raíz del repo.

De dónde sacarla: dashboard de Supabase -> este proyecto -> botón "Connect"
(arriba) o Project Settings -> Database -> "Connection string" -> pestaña
"Session pooler" (puerto 5432 — funciona con IPv4, a diferencia de la
conexión directa que en plan Free requiere IPv6). Copia el URI y sustituye
[YOUR-PASSWORD] por la contraseña real de la base de datos.

Luego, o bien:
  export SUPABASE_DB_URL="postgresql://postgres.xxxx:CONTRASEÑA@aws-REGION.pooler.supabase.com:5432/postgres"
  ./scripts/backup-db.sh

o añádela a un archivo .env en la raíz (NUNCA lo commitees — ya está en
.gitignore, pero comprueba con `git check-ignore .env` si tienes dudas).
EOF
  exit 1
fi

# Aviso, no bloqueo: el pooler en modo TRANSACTION (puerto 6543) no soporta
# sentencias preparadas y puede cortar sesiones largas — pg_dump necesita
# una sesión persistente. Puerto 5432 (conexión directa o session pooler)
# es lo que Supabase recomienda para pg_dump/pg_restore/migraciones.
if [[ "$SUPABASE_DB_URL" == *:6543* ]]; then
  echo "⚠ SUPABASE_DB_URL usa el puerto 6543 (transaction pooler) — no es fiable para pg_dump." >&2
  echo "  Usa el puerto 5432 (conexión directa o session pooler) en su lugar." >&2
fi

# ── 2. Comprobar que pg_dump y psql existen ─────────────────────────────────

if ! command -v pg_dump >/dev/null 2>&1 || ! command -v psql >/dev/null 2>&1; then
  cat >&2 <<'EOF'
✗ pg_dump y/o psql no están instalados (o no están en el PATH).

Instalar en macOS con Homebrew (solo las herramientas cliente, sin montar
un servidor Postgres local):
  brew install libpq
  echo 'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >> ~/.zshrc
  source ~/.zshrc

Verifica con: pg_dump --version
EOF
  exit 1
fi

# ── 3. Comprobar compatibilidad de versión con el servidor ─────────────────
# Regla de pg_dump: la versión LOCAL debe ser igual o mayor que la del
# servidor. Un pg_dump más antiguo que el servidor puede fallar o volcar
# datos incompletos sin avisar claramente — se comprueba contra la versión
# real del servidor en cada ejecución, no contra un número fijo en este
# script (Supabase puede subir de versión de Postgres con el tiempo).

LOCAL_PG_MAJOR="$(pg_dump --version | grep -oE '[0-9]+' | head -1)"
SERVER_VERSION="$(psql "$SUPABASE_DB_URL" -tAc "SHOW server_version;" 2>/dev/null | tr -d '[:space:]' || true)"

if [[ -z "$SERVER_VERSION" ]]; then
  echo "✗ No se pudo conectar a la base de datos para comprobar su versión. Revisa SUPABASE_DB_URL." >&2
  exit 1
fi

SERVER_MAJOR="${SERVER_VERSION%%.*}"

if [[ "$LOCAL_PG_MAJOR" -lt "$SERVER_MAJOR" ]]; then
  cat >&2 <<EOF
✗ pg_dump local (versión $LOCAL_PG_MAJOR) es más antiguo que el servidor (Postgres $SERVER_VERSION).

Actualiza las herramientas cliente en macOS:
  brew upgrade libpq
  brew unlink libpq && brew link --force libpq
EOF
  exit 1
fi

# ── 4. Preparar destino — FUERA del repo por defecto ────────────────────────
# No usar una carpeta dentro del repo como default: aunque esté en
# .gitignore, un descuido (gitignore mal editado, `git add -f`) podría
# acabar commiteando un volcado con datos de menores. $HOME está
# estructuralmente fuera del árbol del repo, no solo excluido por config.

BACKUP_DEST_DIR="${BACKUP_DEST_DIR:-$HOME/tutordigital-backups}"
mkdir -p "$BACKUP_DEST_DIR"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="$BACKUP_DEST_DIR/tutordigital_${TIMESTAMP}.dump"

# Array, no un string plano: pg_dump necesita un --schema por cada esquema
# (no admite una lista separada por comas). Añadir aquí si algún día hay
# más de un esquema de aplicación.
PG_DUMP_SCHEMAS=(public)
SCHEMA_FLAGS=()
for schema in "${PG_DUMP_SCHEMAS[@]}"; do
  SCHEMA_FLAGS+=(--schema="$schema")
done

echo "→ Volcando esquema(s): ${PG_DUMP_SCHEMAS[*]}"
echo "→ Servidor: Postgres $SERVER_VERSION"
echo "→ Destino: $OUT_FILE"

# ── 5. pg_dump ───────────────────────────────────────────────────────────
# -Fc (formato custom): comprimido y restaurable de forma selectiva/paralela
# con pg_restore, a diferencia de un volcado plano en texto.
# --no-owner --no-privileges: los roles de origen no existen igual en un
# proyecto Supabase distinto — sin esto, restaurar falla o dueños/permisos
# quedan mal asignados. Aplicado aquí (al volcar), no al restaurar, para
# que el archivo ya sea portable sin tener que acordarse del flag después.

pg_dump "$SUPABASE_DB_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  "${SCHEMA_FLAGS[@]}" \
  --file="$OUT_FILE"

# ── 6. Confirmación ──────────────────────────────────────────────────────

SIZE="$(du -h "$OUT_FILE" | cut -f1)"
echo ""
echo "✓ Backup completado: $OUT_FILE ($SIZE)"
echo ""
echo "⚠ Contiene datos personales de menores (alumnos), familias e histórico"
echo "  económico/fichajes con valor legal. Guárdalo cifrado (p.ej. dentro de"
echo "  un volumen APFS/FileVault cifrado, o cifrado aparte con"
echo "  'age'/'gpg') y nunca en una carpeta sincronizada sin cifrar a un"
echo "  servicio en la nube de terceros."
echo ""
echo "  Un backup sin verificar no cuenta como backup — ver el paso de"
echo "  restauración de prueba en scripts/README-backup-db.md."
