#!/bin/bash
# Copia diaria de lilachat-datos (disco externo) → restic en el disco de la
# mini. La dirección INVERSA al backup de lila-app (Lilafotos spec §3.1; acá spec §44).
#
# POR QUÉ RESTIC: mismo argumento que backup-media.sh de lila-app — los medios
# no comprimen, rsync es un espejo (replica un borrado o un cifrado), y restic
# es incremental-forever con dedupe por contenido, cifrado y versionado.
#
# FALLA RUIDOSO: el modo de fallo clásico de un backup es «terminó bien» sin
# haber respaldado nada. Todo preflight alerta por Telegram y sale con ≠ 0.
# Y deja rastro donde la app lo mira: `.copia-a-la-mini.json` en la raíz de
# datos, que el server sirve en `GET /api/estado` → «Copia del disco a la
# mini: ayer ✓» en la pestaña Respaldo.

set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/copia-common.sh"

ORIGEN="$(resolver_origen)"
DESTINO="$(resolver_destino)"
LOG_FILE="${LILACHAT_LOG_FILE:-${LOG_DIR}/copia-a-la-mini.log}"
HEARTBEAT_FILE="${LILACHAT_HEARTBEAT_FILE:-${CONFIG_DIR}/last-lilachat-copia}"
LOCK_FILE="/tmp/lilachat-copia.lock"

# Retención: 7 diarios / 4 semanales / 12 mensuales. La papelera de la app ya
# cubre 30 días de arrepentimiento; esto cubre que el externo muera o que algo
# cifre el origen — por eso llega a un año.
KEEP_DAILY="${LILACHAT_KEEP_DAILY:-7}"
KEEP_WEEKLY="${LILACHAT_KEEP_WEEKLY:-4}"
KEEP_MONTHLY="${LILACHAT_KEEP_MONTHLY:-12}"

# `.miniaturas` se regenera on-demand; `.tmp` es basura de subidas a medias;
# `.copia-a-la-mini.json` describe ESTA copia y no tiene sentido adentro.
EXCLUDES=(
  --exclude "*.pass"
  --exclude ".miniaturas"
  --exclude ".tmp"
  --exclude ".copia-a-la-mini.json"
  --exclude ".DS_Store"
  --exclude "._*"
  --exclude ".fseventsd"
  --exclude ".Spotlight-V100"
)

fallar() {
  registrar "ERROR: $1"
  actualizar_estado ok 'false'
  actualizar_estado fallo "$(printf '%s' "$1" | head -1 | /usr/bin/python3 -c 'import json,sys;print(json.dumps(sys.stdin.read().strip()))')"
  notificar_fallo copia "🔴 LILACHAT: la copia del disco a la mini FALLÓ

$1

Las fotos siguen en copia ÚNICA en el disco externo."
  liberar_lock
  exit 1
}

tomar_lock() {
  if [ -e "$LOCK_FILE" ]; then
    local pid; pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      registrar "Ya hay una copia corriendo (PID $pid) — salgo"; exit 0
    fi
    registrar "Lock huérfano de PID ${pid:-?} — lo reclamo"
  fi
  echo $$ > "$LOCK_FILE"
}
liberar_lock() { rm -f "$LOCK_FILE"; }

main() {
  mkdir -p "$(dirname "$LOG_FILE")" "$CONFIG_DIR" "$(dirname "$DESTINO")"
  tomar_lock
  trap liberar_lock EXIT

  registrar "=== Copia a la mini: inicio ==="
  local motivo
  motivo=$(verificar_binarios) || fallar "$motivo"
  motivo=$(verificar_origen) || fallar "$motivo"
  motivo=$(verificar_clave) || fallar "$motivo"

  export RESTIC_REPOSITORY="$DESTINO" RESTIC_PASSWORD_FILE="$PASSWORD_FILE"

  if ! "$RESTIC" cat config >/dev/null 2>&1; then
    registrar "Repositorio no encontrado — inicializando en $DESTINO"
    "$RESTIC" init >>"$LOG_FILE" 2>&1 || fallar "No se pudo inicializar el repositorio en $DESTINO"
    notificar "🆕 LILACHAT: repositorio de copia creado en $DESTINO

Guardá la clave ($PASSWORD_FILE) FUERA de esta máquina. Sin ella la copia es irrecuperable."
  fi
  "$RESTIC" unlock >>"$LOG_FILE" 2>&1 || true

  local inicio salida rc
  inicio=$(date +%s)
  registrar "Copiando $ORIGEN → $DESTINO"
  salida=$("$RESTIC" backup "$ORIGEN" "${EXCLUDES[@]}" --tag lilachat --tag automatico --exclude-caches 2>&1)
  rc=$?
  echo "$salida" >> "$LOG_FILE"
  [ $rc -eq 0 ] || fallar "restic backup falló (código $rc). Últimas líneas:
$(echo "$salida" | tail -5)"

  local segundos archivos agregado
  segundos=$(( $(date +%s) - inicio ))
  archivos=$(echo "$salida" | grep -oE "processed [0-9]+ files" | head -1 | awk '{print $2}' || echo "?")
  agregado=$(echo "$salida" | grep -oE "Added to the repository: [0-9.]+ [KMGT]?i?B" | head -1 | cut -d: -f2- | xargs || echo "?")
  registrar "Copia OK — ${archivos} archivos, ${agregado} nuevos, ${segundos}s"

  "$RESTIC" forget --keep-daily "$KEEP_DAILY" --keep-weekly "$KEEP_WEEKLY" --keep-monthly "$KEEP_MONTHLY" --prune >>"$LOG_FILE" 2>&1 \
    || registrar "AVISO: la retención falló (la copia de hoy SÍ se guardó)"

  # Heartbeat (dead man's switch) y estado para la app. SOLO en éxito: el
  # silencio es la señal.
  date +%s > "$HEARTBEAT_FILE"
  actualizar_estado ultimaEn "\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\""
  actualizar_estado ok 'true'
  actualizar_estado fallo 'null'
  notificar_recuperacion copia "✅ LILACHAT: la copia a la mini volvió a funcionar (${archivos} archivos, ${segundos}s)."

  registrar "=== Copia a la mini: fin (${segundos}s) ==="
  liberar_lock
  trap - EXIT
}

main "$@"
