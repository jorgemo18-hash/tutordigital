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

---

# Copia automática semanal (macOS)

`scripts/backup-db.sh` es manual: sirve mientras te acuerdes de lanzarlo.
Lo que hay debajo lo deja corriendo solo.

- **`scripts/backup-db-programado.sh`** — envuelve al anterior y añade
  rotación, un rastro visible de la última copia buena, y avisos cuando
  algo falla.
- **`scripts/instalar-backup-programado.sh`** — instala (o quita) la tarea
  semanal en launchd.

## Por qué existe el envoltorio

Un backup automático que **falla en silencio es peor que no tener
ninguno**: te crees cubierto y no lo estás, y solo te enteras el día que
necesitas restaurar. Por eso el envoltorio hace tres cosas que el script
manual no necesita:

1. **Rotación** — guarda las N copias más recientes (12 por defecto) y
   borra las viejas. Ordena por el nombre del archivo, que empieza por la
   fecha, no por su fecha de modificación: mover los archivos de carpeta
   cambia el mtime y desordenaría la rotación.
2. **Rastro visible** — `ULTIMO-BACKUP-OK.txt` en la carpeta destino, con
   la fecha de la última copia correcta (y su epoch en la segunda línea,
   que es lo que lee el script: `stat` y `date` tienen banderas distintas
   en macOS y en Linux, y leer el número que escribimos nosotros funciona
   igual en los dos). Más `backup.log` con lo que pasó cada vez.
3. **Avisos** — notificación de macOS cuando el volcado falla, y también
   cuando **sale bien pero la copia anterior era muy antigua**: eso último
   es la única forma de detectar que la tarea llevaba meses parada sin que
   nadie se diera cuenta.

## Instalación

```bash
cd ~/Projects/tutordigital
./scripts/instalar-backup-programado.sh
```

Por defecto: **lunes a las 9:00**, en `~/tutordigital-backups`. Se puede
cambiar:

```bash
BACKUP_DIA=5 BACKUP_HORA=20 ./scripts/instalar-backup-programado.sh   # viernes a las 20:00
BACKUP_DEST_DIR="/Volumes/MiDisco/tutordigital" ./scripts/instalar-backup-programado.sh
```

Para quitarla: `./scripts/instalar-backup-programado.sh --quitar`
(las copias ya hechas no se tocan).

**Pruébala a mano nada más instalarla.** No esperes una semana para
descubrir que faltaba `pg_dump` o que la contraseña estaba mal:

```bash
./scripts/backup-db-programado.sh
cat ~/tutordigital-backups/ULTIMO-BACKUP-OK.txt
```

## launchd, no cron

En macOS cron está desaconsejado desde hace años. Además, launchd ejecuta
una tarea que se perdió porque el equipo estaba apagado a esa hora — que es
justo lo que pasa con un portátil que se cierra por las noches. Con cron,
esa ejecución simplemente no ocurre y nadie se entera.

Se instala como **LaunchAgent del usuario**, no del sistema: no pide
contraseña de administrador y corre dentro de la sesión, que es lo que
permite que las notificaciones lleguen a la pantalla.

El `plist` fija un `PATH` explícito con `/opt/homebrew/opt/libpq/bin`.
launchd arranca con un PATH mínimo que **no** incluye Homebrew: sin eso,
`pg_dump` no se encuentra aunque funcione perfectamente en tu terminal.

## Sobre el cifrado

Estos volcados llevan datos personales de menores. La recomendación
sensata **no** es cifrarlos aparte con `gpg`/`age` si se quedan en el Mac:
si FileVault está activado, el disco entero ya está cifrado en reposo, y
añadir una contraseña más solo añade una forma nueva de perder el backup
(si la olvidas, el archivo no sirve para nada).

Comprueba que FileVault está activo:

```bash
fdesetup status
```

El cifrado aparte **sí** hace falta el día que una copia salga del Mac:
disco externo que viaja, Drive, correo. En ese momento, y no antes.

## Lo que esta automatización sigue sin cubrir

- **Supabase Storage** (PDFs generados, logo, fotos de facturas de gastos)
  — sigue fuera, igual que en el script manual.
- **Un solo sitio.** Con el destino por defecto, las copias viven en el
  mismo Mac que las genera. Protege de un borrado accidental en la app, no
  de que el portátil muera, se pierda o lo roben. Para eso hace falta un
  segundo destino (disco externo o Drive de la academia, cifrado).
- **La restauración de prueba** sigue siendo manual y sigue siendo
  obligatoria. Ver la sección de arriba.
