#!/bin/bash
# Instala (o reinstala) los agentes launchd de la copia diaria y la
# verificación semanal. El plist vive FUERA del repo: migrar la máquina no
# migra el agendado, y esto es la pieza versionada que lo reconstruye.
#
# POR QUÉ launchd Y NO cron: TCC. Con cron como padre, macOS niega el acceso a
# un volumen externo EN SILENCIO — el peor modo de fallo para un backup. Y si
# la mini duerme a esa hora, launchd corre al despertar; cron lo saltea.
#
# HORARIO: 02:00 la copia (lila-app respalda a las 00:30 y Lilafotos a la 01:30
# al MISMO disco externo; no se pisan). Verificación: domingos 04:00.

set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/copia-common.sh"

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"
UID_NUM=$(id -u)

instalar() {
  local label="$1" script="$2" calendario="$3" descripcion="$4"
  local plist="$HOME/Library/LaunchAgents/${label}.plist"
  echo "→ ${label} (${descripcion})"
  [ -x "$script" ] || { echo "ERROR: no existe o no es ejecutable: $script"; exit 1; }
  # RunAtLoad=false: instalar no dispara una corrida (sorprende y puede pisar una manual).
  cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>${script}</string></array>
  <key>StartCalendarInterval</key>${calendario}
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>${LOG_DIR}/${label##*.}.launchd.log</string>
  <key>StandardErrorPath</key><string>${LOG_DIR}/${label##*.}.launchd.err</string>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
PLIST
  launchctl bootout "gui/${UID_NUM}/${label}" 2>/dev/null || true
  launchctl bootstrap "gui/${UID_NUM}" "$plist" || { echo "ERROR: launchctl bootstrap falló para $label"; exit 1; }
  echo "  instalado: $plist"
}

instalar com.constroad.lilachat.copia "${REPO_DIR}/scripts/copia-a-la-mini.sh" \
  "<dict><key>Hour</key><integer>2</integer><key>Minute</key><integer>0</integer></dict>" \
  "copia diaria 02:00"
instalar com.constroad.lilachat.verificar "${REPO_DIR}/scripts/verificar-copia.sh" \
  "<dict><key>Weekday</key><integer>0</integer><key>Hour</key><integer>4</integer><key>Minute</key><integer>0</integer></dict>" \
  "verificación domingos 04:00"

echo
echo "Para probar ahora:  launchctl kickstart gui/${UID_NUM}/com.constroad.lilachat.copia"
echo "Logs en:            ${LOG_DIR}/"
