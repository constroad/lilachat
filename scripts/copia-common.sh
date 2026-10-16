#!/bin/bash
# Config y utilidades compartidas por copia-a-la-mini.sh, verificar-copia.sh e
# instalar-agentes.sh. Patrón copiado de lila-app/scripts/backup-common.sh:
# nada de rutas absolutas a /Users ni /opt; todo se DERIVA o se descubre.
#
# COPIADO DE LILAFOTOS (scripts/copia-common.sh, 15/09/2026) para los respaldos
# de conversaciones de Lilachat (spec §44, F12.1). LA DIRECCIÓN ES LA INVERSA
# que la de lila-app: los respaldos que suben los teléfonos viven en el disco
# EXTERNO, así que su copia va al disco de la MINI. Un disco USB es exactamente
# el hardware que se desmonta y falla: sin esta copia, el respaldo de los chats
# es «una forma elegante de perder las conversaciones dos veces».

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# En la mini las variables viven en `deploys/chat/shared/.env` (Torre), no en
# el repo: sin este respaldo el token de Telegram quedaba vacío y las alertas de
# la copia no salían, sin aviso.
ENV_FILE_POR_DEFECTO="${REPO_DIR}/.env"
[ -f "$ENV_FILE_POR_DEFECTO" ] || ENV_FILE_POR_DEFECTO="${REPO_DIR}/../shared/.env"
ENV_FILE="${LILACHAT_ENV_FILE:-$ENV_FILE_POR_DEFECTO}"
LOG_DIR="${LILACHAT_LOG_DIR:-${REPO_DIR}/logs}"
CONFIG_DIR="${LILACHAT_CONFIG_DIR:-$HOME/.config/constroad-backup}"
# Clave PROPIA del repositorio (no la de restic-media): perder una no compromete
# la otra, y esta copia se restaura en un escenario distinto (murió el externo).
PASSWORD_FILE="${LILACHAT_PASSWORD_FILE:-${CONFIG_DIR}/restic-lilachat.pass}"

# Mismo canal errors-tracking que el server y que lilachat: constante, no
# variable — una variable ausente deja el sistema mudo sin dar señal.
TELEGRAM_CANAL="-1003063986345"

env_get() {
  [ -r "$ENV_FILE" ] || return 0
  grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'"
}

descubrir_binario() {
  local nombre="$1" ruta
  ruta=$(command -v "$nombre" 2>/dev/null) && { echo "$ruta"; return 0; }
  for base in /opt/homebrew/bin /usr/local/bin /usr/bin; do
    [ -x "${base}/${nombre}" ] && { echo "${base}/${nombre}"; return 0; }
  done
  return 1
}

RESTIC="${RESTIC_BIN:-$(descubrir_binario restic || echo '')}"

# El ORIGEN es la raíz de datos del server, leída del MISMO .env que usa el
# server: si mañana cambia la raíz, la copia la sigue sola.
resolver_origen() {
  if [ -n "${LILACHAT_ORIGEN:-}" ]; then echo "$LILACHAT_ORIGEN"; return 0; fi
  local raiz
  raiz=$(env_get RESPALDOS_RAIZ)
  echo "${raiz:-/Volumes/CONSTROAD-BACKUP/lilachat-datos}"
}

# El DESTINO es el disco de la mini (343 GB libres contra 7 GB iniciales).
resolver_destino() {
  if [ -n "${LILACHAT_DESTINO:-}" ]; then echo "$LILACHAT_DESTINO"; return 0; fi
  echo "$HOME/backups/restic-lilachat"
}

# Lo que el server escribe/lee para mostrar «Copia del disco a la mini: ayer ✓»
# (estadoRoutes.ts, ARCHIVO_DE_COPIA). Vive en la raíz de datos, al lado de lo
# que describe.
archivo_de_estado() { echo "$(resolver_origen)/.copia-a-la-mini.json"; }

registrar() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" | tee -a "${LOG_FILE:-/dev/null}"
}

# Escribe el JSON de estado sin pisar lo que no cambió: un fallo conserva la
# fecha de la última copia buena, que es justo lo que la app tiene que mostrar.
# $1 = clave (ultimaEn|verificadaEn|ok|fallo) · $2 = valor JSON ya formateado
actualizar_estado() {
  local archivo clave="$1" valor="$2" actual
  archivo=$(archivo_de_estado)
  [ -d "$(dirname "$archivo")" ] || return 0
  actual=$(cat "$archivo" 2>/dev/null); [ -n "$actual" ] || actual='{}'
  printf '%s' "$actual" | /usr/bin/python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
except Exception:
    d={}
d[sys.argv[1]]=json.loads(sys.argv[2])
print(json.dumps(d))
" "$clave" "$valor" > "${archivo}.tmp" && mv "${archivo}.tmp" "$archivo"
}

notificar() {
  local token
  token=$(env_get TELEGRAM_BOT_TOKEN)
  [ -z "$token" ] && return 0
  /usr/bin/curl -sS -o /dev/null --max-time 15 \
    -d "chat_id=${TELEGRAM_CANAL}" --data-urlencode "text=$1" \
    "https://api.telegram.org/bot${token}/sendMessage" 2>/dev/null || true
}

# Alertas con dedupe (mismo esquema que lila-app): un fallo NUEVO avisa
# siempre; el mismo fallo se repite cada 6 h; y se avisa al RECUPERAR.
ALERT_REPEAT_SECONDS="${LILACHAT_ALERT_REPEAT_SECONDS:-21600}"

notificar_fallo() {
  local job="$1" mensaje="$2" estado firma ahora previa_firma previa_ts
  estado="${CONFIG_DIR}/alert-state-lilachat-${job}"
  firma=$(printf '%s' "$mensaje" | head -3 | shasum -a 256 | cut -c1-16)
  ahora=$(date +%s)
  if [ -r "$estado" ]; then
    previa_firma=$(cut -d' ' -f1 < "$estado" 2>/dev/null)
    previa_ts=$(cut -d' ' -f2 < "$estado" 2>/dev/null)
    if [ "$firma" = "$previa_firma" ] && [ -n "$previa_ts" ] \
       && [ $((ahora - previa_ts)) -lt "$ALERT_REPEAT_SECONDS" ]; then
      registrar "Alerta silenciada (mismo fallo)"
      return 0
    fi
  fi
  mkdir -p "$CONFIG_DIR"
  echo "$firma $ahora" > "$estado"
  notificar "$mensaje"
}

notificar_recuperacion() {
  local job="$1" mensaje="$2" estado="${CONFIG_DIR}/alert-state-lilachat-${1}"
  [ -r "$estado" ] || return 0
  rm -f "$estado"
  notificar "$mensaje"
}

verificar_binarios() {
  [ -n "$RESTIC" ] && [ -x "$RESTIC" ] || {
    echo "restic no encontrado. Instalar con: brew install restic"; return 1; }
}

# El origen tiene que estar MONTADO de verdad: la marca `.lilachat` la crea
# `npm run disco:init` solo con el disco puesto. Un `/Volumes/…` vacío en el
# disco de arranque haría una «copia» de nada y terminaría en verde.
verificar_origen() {
  local origen; origen=$(resolver_origen)
  [ -f "${origen}/.lilachat" ] || {
    echo "El disco de los respaldos NO está montado (falta ${origen}/.lilachat).
¿Está conectado el SSD CONSTROAD-BACKUP?"; return 1; }
}

verificar_clave() {
  [ -r "$PASSWORD_FILE" ] || {
    echo "No se puede leer la clave del repositorio: $PASSWORD_FILE
Crearla UNA vez (y guardar copia FUERA de esta máquina):
  mkdir -p $(dirname "$PASSWORD_FILE") && openssl rand -base64 32 > $PASSWORD_FILE && chmod 600 $PASSWORD_FILE"; return 1; }
  local perms; perms=$(stat -f "%OLp" "$PASSWORD_FILE" 2>/dev/null || echo "???")
  [ "$perms" = "600" ] || registrar "AVISO: $PASSWORD_FILE tiene permisos $perms (deberían ser 600)"
}
