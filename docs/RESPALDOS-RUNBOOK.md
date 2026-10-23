# Runbook — los respaldos de conversaciones en la mini (F12.1)

Documento **operativo**. El porqué está en `specs/ARCHITECTURE.spec.md` §44.
Calcado del `docs/COPIA-RUNBOOK.md` de Lilafotos: mismo disco, mismo patrón,
raíz y repo restic propios.

> Cada teléfono sube su respaldo **cifrado con la passphrase del usuario** a
> `/Volumes/CONSTROAD-BACKUP/lilachat-datos/<teléfono>/respaldos/`. El server
> no lo puede abrir; lo guarda, lo deduplica y lo devuelve. La copia de ese
> disco va al disco de la mini (`~/backups/restic-lilachat`): un USB es
> exactamente el hardware que se desmonta y falla.

**Lo único imprescindible del lado de la mini:** la clave del repositorio,
`~/.config/constroad-backup/restic-lilachat.pass`. Es PROPIA (no la de
`restic-lilafotos` ni la de `restic-media`) y debe existir una copia fuera de
la mini (gestor de contraseñas). Sin ella la copia es irrecuperable.

**Lo único imprescindible del lado de cada persona:** su passphrase. El server
no la tiene. **Passphrase perdida = respaldo irrecuperable**, y la app lo dice.

## Alta, una vez, en la mini

```bash
echo 'RESPALDOS_RAIZ=/Volumes/CONSTROAD-BACKUP/lilachat-datos' >> ~/deploys/chat/shared/.env   # y reiniciar el server
```

```bash
mkdir -p ~/.config/constroad-backup && openssl rand -base64 32 > ~/.config/constroad-backup/restic-lilachat.pass && chmod 600 ~/.config/constroad-backup/restic-lilachat.pass
```

⚠️ copiar esa clave al gestor de contraseñas AHORA.

> `~/deploys/chat/repo` es el espejo *bare* de Torre, sin árbol de trabajo: los comandos van en `current` (lo corrigió lila-2 al correr el alta el 23/10).

```bash
cd ~/deploys/chat/current && RESPALDOS_RAIZ=/Volumes/CONSTROAD-BACKUP/lilachat-datos npm run disco:init -w server
```

```bash
cd ~/deploys/chat/current && bash scripts/instalar-agentes.sh
```

```bash
launchctl kickstart gui/$(id -u)/com.constroad.lilachat.copia
```

Copia diaria **02:00** (lila-app 00:30 y Lilafotos 01:30 al mismo disco: no se
pisan), verificación domingos **04:00**. La primera corrida inicializa el
repositorio y avisa por Telegram (errors-tracking). Después, **el silencio es
la señal**: solo se avisa al fallar y al recuperarse.

## Qué mirar

| Dónde | Qué dice |
| --- | --- |
| Ajustes → **Respaldo** en la app | último respaldo, tamaño, y «Copia a la mini: ayer ✓» (`GET /api/respaldos/estado`) |
| `<raíz>/.copia-a-la-mini.json` | `ultimaEn`, `verificadaEn`, `ok`, `fallo` |
| `logs/copia-a-la-mini.log`, `logs/verificar-copia.log` | el detalle de cada corrida |
| `~/.config/constroad-backup/last-lilachat-copia` | heartbeat de la última copia buena |
| `GET /api/health` | sigue en 200 sin disco: el chat no depende del respaldo |

`PUT /api/respaldos` contesta **507 `disco_ausente`** sin marca y **507
`disco_colgado`** si la escritura de prueba no vuelve en 3 s. Un USB colgado se
DICE en vez de colgar el server (lección del 15/09/2026, Lilafotos §15.1).

## Emergencia: murió el disco externo

```bash
export RESTIC_PASSWORD_FILE=~/.config/constroad-backup/restic-lilachat.pass RESTIC_REPOSITORY=~/backups/restic-lilachat && restic snapshots
```

```bash
restic restore latest --target /tmp/rec-lilachat
```

Con el disco nuevo montado y `disco:init` hecho:

```bash
rsync -a /tmp/rec-lilachat/Volumes/CONSTROAD-BACKUP/lilachat-datos/ /Volumes/CONSTROAD-BACKUP/lilachat-datos/
```

El índice de Mongo (`respaldos`) apunta a las mismas rutas relativas: la app
vuelve a ver sus respaldos sin re-subir nada.

## Qué NO cubre

- **Incendio, robo, ransomware que alcance las dos unidades.** Igual que
  lila-app y Lilafotos: origen y copia están en la misma casa.
- **El índice de Mongo.** Vive en Atlas; `backup-db.sh` de lila-app respalda
  las bases del cluster.
- **Una passphrase olvidada.** No hay puerta de atrás, a propósito.
