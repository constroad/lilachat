#!/bin/bash
# Verificación semanal de la copia (Lilafotos spec §3.1: «un backup que nunca se restauró
# no es un backup»). Tres niveles, como verify-backups.sh de lila-app:
#   1. `restic check`                → estructura y metadata.
#   2. `check --read-data-subset=10%`→ LEE bloques reales (lo único que ve bit rot).
#   3. Simulacro: restaura N archivos al azar y compara SHA-256 con el origen.
# En éxito escribe `verificadaEn` en `.copia-a-la-mini.json`: la app lo muestra.

set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/copia-common.sh"

ORIGEN="$(resolver_origen)"
DESTINO="$(resolver_destino)"
LOG_FILE="${LILACHAT_VERIFY_LOG_FILE:-${LOG_DIR}/verificar-copia.log}"
MUESTRA="${LILACHAT_VERIFY_MUESTRA:-25}"
PORCENTAJE="${LILACHAT_VERIFY_PCT:-10}"
TRABAJO=""
PROBLEMAS=()

problema() { PROBLEMAS+=("$1"); registrar "❌ $1"; }
limpiar() { [ -n "$TRABAJO" ] && [ -d "$TRABAJO" ] && rm -rf "$TRABAJO"; }

main() {
  mkdir -p "$(dirname "$LOG_FILE")"
  registrar "=== Verificación de la copia: inicio ==="
  local motivo
  motivo=$(verificar_binarios) || { problema "$motivo"; cerrar; }
  motivo=$(verificar_origen) || { problema "$motivo"; cerrar; }
  motivo=$(verificar_clave) || { problema "$motivo"; cerrar; }
  export RESTIC_REPOSITORY="$DESTINO" RESTIC_PASSWORD_FILE="$PASSWORD_FILE"

  "$RESTIC" cat config >/dev/null 2>&1 || { problema "el repositorio no existe o la clave no lo abre ($DESTINO)"; cerrar; }

  registrar "Nivel 1: check"
  "$RESTIC" check >>"$LOG_FILE" 2>&1 || problema "restic check encontró errores de estructura"

  registrar "Nivel 2: check --read-data-subset=${PORCENTAJE}%"
  "$RESTIC" check --read-data-subset="${PORCENTAJE}%" >>"$LOG_FILE" 2>&1 || problema "bloques dañados al leer el ${PORCENTAJE}% de los datos"

  registrar "Nivel 3: simulacro de restauración (${MUESTRA} archivos)"
  TRABAJO=$(mktemp -d /tmp/lilachat-verify.XXXXXX)
  trap limpiar EXIT
  local lista
  lista=$("$RESTIC" ls latest 2>/dev/null | grep -E '\.lcb$' | grep -v '/\.papelera/' | sort -R | head -n "$MUESTRA")
  [ -n "$lista" ] || problema "el último snapshot no tiene archivos para restaurar"
  local inicio comparados=0 distintos=0
  inicio=$(date +%s)
  if [ -n "$lista" ]; then
    local includes=()
    while IFS= read -r ruta; do includes+=(--include "$ruta"); done <<< "$lista"
    "$RESTIC" restore latest --target "$TRABAJO" "${includes[@]}" >>"$LOG_FILE" 2>&1 || problema "restic restore falló"
    while IFS= read -r ruta; do
      local restaurado="${TRABAJO}${ruta}" original="$ruta"
      [ -f "$restaurado" ] || { problema "no se restauró: $ruta"; continue; }
      comparados=$((comparados + 1))
      if [ "$(shasum -a 256 "$restaurado" | cut -d' ' -f1)" != "$(shasum -a 256 "$original" | cut -d' ' -f1)" ]; then
        distintos=$((distintos + 1)); problema "difiere del origen: $ruta"
      fi
    done <<< "$lista"
  fi
  registrar "Simulacro: ${comparados} comparados, ${distintos} distintos, $(( $(date +%s) - inicio ))s"
  cerrar
}

cerrar() {
  if [ ${#PROBLEMAS[@]} -eq 0 ]; then
    actualizar_estado verificadaEn "\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\""
    registrar "=== Verificación OK ==="
    notificar_recuperacion verificar "✅ LILACHAT: la verificación de la copia volvió a pasar."
    exit 0
  fi
  registrar "=== Verificación con ${#PROBLEMAS[@]} problema(s) ==="
  notificar_fallo verificar "🔴 LILACHAT: la verificación de la copia FALLÓ

$(printf '%s\n' "${PROBLEMAS[@]}")

Una copia que no se puede restaurar no es una copia."
  exit 1
}

main "$@"
