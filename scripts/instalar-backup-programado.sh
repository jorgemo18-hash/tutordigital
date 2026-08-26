#!/usr/bin/env bash
set -euo pipefail

# scripts/instalar-backup-programado.sh — deja la copia de seguridad
# corriendo sola en este Mac, una vez por semana.
#
# Usa launchd (el sistema de tareas programadas de macOS) y no cron: cron
# está desaconsejado en macOS desde hace años, y launchd sabe ejecutar una
# tarea que se perdió porque el portátil estaba apagado a esa hora — que es
# exactamente lo que pasa con un Mac que se cierra por las noches. Con cron,
# una tarea que cae mientras el equipo duerme simplemente no se hace y nadie
# se entera.
#
# Se instala como LaunchAgent del usuario (no del sistema): no pide
# contraseña de administrador y corre dentro de tu sesión, que es lo que
# permite que las notificaciones de aviso lleguen a la pantalla.
#
# Uso:
#   ./scripts/instalar-backup-programado.sh          instala/actualiza
#   ./scripts/instalar-backup-programado.sh --quitar desinstala
#
# Variables opcionales:
#   BACKUP_DIA   0=domingo … 6=sábado   (def. 1, lunes)
#   BACKUP_HORA  hora en 24h            (def. 9)
#   BACKUP_DEST_DIR                     (def. $HOME/tutordigital-backups)

ETIQUETA="com.tutordigital.backup"
PLIST="$HOME/Library/LaunchAgents/$ETIQUETA.plist"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/backup-db-programado.sh"

BACKUP_DIA="${BACKUP_DIA:-1}"
BACKUP_HORA="${BACKUP_HORA:-9}"
BACKUP_DEST_DIR="${BACKUP_DEST_DIR:-$HOME/tutordigital-backups}"

descargar_si_existe() {
  # launchctl bootout falla si no estaba cargada; no es un error aquí.
  launchctl bootout "gui/$(id -u)/$ETIQUETA" 2>/dev/null || true
}

if [[ "${1:-}" == "--quitar" ]]; then
  descargar_si_existe
  rm -f "$PLIST"
  echo "✓ Tarea de backup desinstalada. Las copias ya hechas siguen en $BACKUP_DEST_DIR."
  exit 0
fi

if [[ ! -f "$SCRIPT" ]]; then
  echo "✗ No encuentro $SCRIPT — ¿estás ejecutando esto desde el repo?" >&2
  exit 1
fi
chmod +x "$SCRIPT" "$REPO_ROOT/scripts/backup-db.sh"

# Comprobación temprana, con mensaje claro: sin esto la tarea se instalaría
# igual y fallaría en silencio cada semana hasta que alguien mirase el log.
if [[ ! -f "$REPO_ROOT/.env" ]] && [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  cat >&2 <<EOF
✗ Falta la cadena de conexión a la base de datos.

Crea un archivo .env en $REPO_ROOT con esta línea:

  SUPABASE_DB_URL="postgresql://postgres.XXXX:CONTRASEÑA@aws-REGION.pooler.supabase.com:5432/postgres"

De dónde sacarla: dashboard de Supabase -> el proyecto -> botón "Connect"
-> pestaña "Session pooler" (puerto 5432) -> copiar el URI y sustituir
[YOUR-PASSWORD] por la contraseña real de la base de datos.

El .env ya está en .gitignore: no se sube a GitHub.
EOF
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$BACKUP_DEST_DIR"

# RunAtLoad=false a propósito: instalar la tarea no debe disparar un volcado
# en ese instante. La prueba manual se hace explícitamente (ver el mensaje
# final), para que se vea el resultado en vez de que ocurra a escondidas.
cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$ETIQUETA</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$SCRIPT</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>BACKUP_DEST_DIR</key><string>$BACKUP_DEST_DIR</string>
    <!-- libpq de Homebrew: launchd arranca con un PATH mínimo que NO
         incluye /opt/homebrew, así que sin esto pg_dump no se encuentra
         aunque funcione perfectamente en tu terminal. -->
    <key>PATH</key><string>/opt/homebrew/opt/libpq/bin:/usr/local/opt/libpq/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key><integer>$BACKUP_DIA</integer>
    <key>Hour</key><integer>$BACKUP_HORA</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>$BACKUP_DEST_DIR/launchd.out.log</string>
  <key>StandardErrorPath</key><string>$BACKUP_DEST_DIR/launchd.err.log</string>
</dict>
</plist>
EOF

descargar_si_existe
launchctl bootstrap "gui/$(id -u)" "$PLIST"

DIAS=(domingo lunes martes miércoles jueves viernes sábado)
echo "✓ Tarea instalada: cada ${DIAS[$BACKUP_DIA]} a las ${BACKUP_HORA}:00"
echo "  Destino: $BACKUP_DEST_DIR"
echo ""
echo "Pruébala ahora mismo (no esperes una semana para descubrir que falla):"
echo "  $SCRIPT"
echo ""
echo "Y comprueba cuándo fue la última copia buena con:"
echo "  cat $BACKUP_DEST_DIR/ULTIMO-BACKUP-OK.txt"
