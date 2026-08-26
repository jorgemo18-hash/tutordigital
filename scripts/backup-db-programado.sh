#!/usr/bin/env bash
set -uo pipefail

# scripts/backup-db-programado.sh — copia de seguridad DESATENDIDA.
#
# Envuelve a backup-db.sh (que hace el pg_dump y no cambia) y le añade las
# tres cosas que hacen falta cuando nadie está mirando la pantalla:
#
#   1. ROTACIÓN — se queda con las N copias más recientes y borra el resto.
#      Sin esto la carpeta crece para siempre.
#   2. RASTRO VISIBLE — un archivo ULTIMO-BACKUP-OK.txt con la fecha del
#      último volcado correcto, y un log con lo que pasó cada vez.
#   3. AVISO CUANDO FALLA — y, sobre todo, cuando lleva demasiados días sin
#      salir bien.
#
# El punto 3 es la razón de ser de este archivo. Un backup automático que
# falla en silencio es PEOR que no tener ninguno: te crees cubierto y no lo
# estás. Aquí un fallo grita (notificación de macOS), y además se comprueba
# la antigüedad de la última copia buena: si el script dejara de ejecutarse
# del todo (se desinstaló la tarea, se movió el repo, cambió la contraseña
# de la base), el aviso salta igualmente la próxima vez que corra.
#
# Uso manual (para probar):
#   ./scripts/backup-db-programado.sh
#
# Programado: ver scripts/instalar-backup-programado.sh
#
# Variables (todas opcionales, con valores por defecto sensatos):
#   BACKUP_DEST_DIR   carpeta destino        (def. $HOME/tutordigital-backups)
#   BACKUP_RETENER    cuántas copias guardar (def. 12)
#   BACKUP_MAX_DIAS   días sin copia buena antes de avisar (def. 10)
#   BACKUP_SCRIPT     script de volcado     (def. scripts/backup-db.sh)
#   NOTIFICAR_CMD     comando de aviso      (def. notificación de macOS)
#
# BACKUP_SCRIPT y NOTIFICAR_CMD existen para poder probar este archivo sin
# base de datos real y sin llenar la pantalla de notificaciones — misma
# idea que inyectar dependencias en el código JS del proyecto.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BACKUP_DEST_DIR="${BACKUP_DEST_DIR:-$HOME/tutordigital-backups}"
BACKUP_RETENER="${BACKUP_RETENER:-12}"
BACKUP_MAX_DIAS="${BACKUP_MAX_DIAS:-10}"
BACKUP_SCRIPT="${BACKUP_SCRIPT:-$REPO_ROOT/scripts/backup-db.sh}"

LOG_FILE="$BACKUP_DEST_DIR/backup.log"
MARCA_OK="$BACKUP_DEST_DIR/ULTIMO-BACKUP-OK.txt"

mkdir -p "$BACKUP_DEST_DIR"

registrar() {
  printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >>"$LOG_FILE"
}

# Aviso al usuario. Por defecto una notificación de macOS; se puede
# sustituir por cualquier comando que acepte el mensaje como $1.
avisar() {
  local mensaje="$1"
  registrar "AVISO: $mensaje"
  if [[ -n "${NOTIFICAR_CMD:-}" ]]; then
    "$NOTIFICAR_CMD" "$mensaje"
    return
  fi
  if command -v osascript >/dev/null 2>&1; then
    # El mensaje va como argumento, no interpolado en el AppleScript: unas
    # comillas dentro del texto romperían el script y el aviso se perdería
    # justo cuando más falta hace.
    osascript -e 'on run {msg}' \
              -e 'display notification msg with title "TutorDigital — backup"' \
              -e 'end run' -- "$mensaje" >/dev/null 2>&1 || true
  fi
}

# Días transcurridos desde la última copia correcta, o "" si no se puede
# saber (no hay marca todavía, o está corrupta).
#
# La fecha se lee del CONTENIDO del archivo, no de su fecha de modificación:
# `stat` tiene banderas incompatibles entre macOS (-f) y Linux (-c), y `date`
# tampoco convierte texto a epoch igual en los dos. Escribiendo nosotros el
# epoch en la segunda línea, leerlo es igual en cualquier sitio. (La primera
# versión usaba stat y en Linux devolvía texto en vez de un número, que en
# contexto aritmético reventaba — detectado al probarlo.)
dias_desde_ultimo_ok() {
  [[ -f "$MARCA_OK" ]] || return 0
  local ahora marca
  ahora="$(date +%s)"
  marca="$(sed -n '2p' "$MARCA_OK" 2>/dev/null | tr -d '[:space:]')"
  # Solo dígitos: cualquier otra cosa es una marca corrupta y se trata como
  # "no se sabe", nunca como un número raro que falsee la cuenta.
  [[ "$marca" =~ ^[0-9]+$ ]] || return 0
  echo $(( (ahora - marca) / 86400 ))
}

escribir_marca_ok() {
  {
    date '+%Y-%m-%d %H:%M:%S'
    date +%s
  } >"$MARCA_OK"
}

# Lista de copias existentes, de más nueva a más vieja. Se ordena por
# NOMBRE, que empieza por la fecha (tutordigital_AAAAMMDD_HHMMSS.dump), no
# por fecha de modificación: mover o copiar los archivos de sitio cambia el
# mtime y desordenaría la rotación justo cuando alguien reorganiza carpetas.
# Glob a un array en vez de `ls`: así una carpeta destino con espacios en el
# nombre (/Volumes/Mi Disco/…) no parte los nombres en trozos.
copias_existentes() {
  local archivos=()
  shopt -s nullglob
  archivos=("$BACKUP_DEST_DIR"/tutordigital_*.dump)
  shopt -u nullglob
  [[ ${#archivos[@]} -gt 0 ]] || return 0
  printf '%s\n' "${archivos[@]}" | sort -r
}

# Se queda con las $BACKUP_RETENER más recientes y borra el resto.
rotar() {
  local n=0 viejo
  while IFS= read -r viejo; do
    n=$((n + 1))
    [[ $n -gt $BACKUP_RETENER ]] || continue
    rm -f "$viejo" && registrar "rotación: borrado $(basename "$viejo")"
  done < <(copias_existentes)
}

registrar "--- inicio ---"

# Se mide ANTES de tocar la marca: después de una copia correcta el
# contador se pone a cero y ya no se podría saber cuánto tiempo estuvo la
# tarea caída.
DIAS_PREVIOS="$(dias_desde_ultimo_ok)"

if [[ ! -x "$BACKUP_SCRIPT" ]]; then
  avisar "No encuentro el script de backup ($BACKUP_SCRIPT). La copia NO se ha hecho."
  exit 1
fi

SALIDA="$(BACKUP_DEST_DIR="$BACKUP_DEST_DIR" "$BACKUP_SCRIPT" 2>&1)"
CODIGO=$?
printf '%s\n' "$SALIDA" >>"$LOG_FILE"

if [[ $CODIGO -ne 0 ]]; then
  if [[ -z "$DIAS_PREVIOS" ]]; then
    avisar "La copia de seguridad ha fallado y NO hay ninguna copia previa. Revisa $LOG_FILE"
  else
    avisar "La copia de seguridad ha fallado. La última buena es de hace $DIAS_PREVIOS días. Revisa $LOG_FILE"
  fi
  registrar "--- fin (fallo) ---"
  exit 1
fi

escribir_marca_ok
rotar

COPIAS="$(copias_existentes | grep -c . || true)"
registrar "OK — $COPIAS copia(s) en $BACKUP_DEST_DIR"

# Aunque esta vez haya ido bien: si la anterior copia buena era muy
# antigua, la tarea estuvo caída sin que nadie se enterara, y eso hay que
# decirlo aunque el resultado de hoy sea correcto. Es el único momento en
# que se puede detectar un "llevaba tres meses sin hacerse".
if [[ -n "$DIAS_PREVIOS" && "$DIAS_PREVIOS" -gt "$BACKUP_MAX_DIAS" ]]; then
  avisar "Copia hecha, pero la anterior era de hace $DIAS_PREVIOS días: la tarea automática estuvo parada."
fi

registrar "--- fin ---"
exit 0
