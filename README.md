# Lilachat

Mensajería propia: Android (RN) + web + backend en infraestructura nuestra.
Independencia de WhatsApp/Telegram, datos propios, backups navegables y
asistente IA. Arranca con acceso por invitación y evoluciona a producto
público.

**El spec canónico es [`specs/ARCHITECTURE.spec.md`](specs/ARCHITECTURE.spec.md).**
Nada se decide acá que contradiga eso.

## Estructura

| Carpeta | Qué es |
| --- | --- |
| `server/` | Express 4 + Socket.IO — API, WS y (en F6) la SPA web. UN solo proceso. |
| `shared/` | Motores puros TS compartidos (tokens, outbox, cursors). Sin deps de RN ni de DOM. |
| `web/` | SPA React (Vite + shadcn) — se scaffoldea en F6. |
| `app/` | App RN/Expo — se scaffoldea en F1. **Fuera de los npm workspaces** a propósito: Metro + hoisting de dependencias es la pelea que ya perdimos con dos apps RN; la app maneja su propio `node_modules`. |
| `design/` | Diseños de Stitch (`stitch/`) y marca (`brand/`). |

## Comandos

```bash
npm install        # workspaces: shared + server
npm test           # suite del server (vitest)
npm run dev        # server en desarrollo (tsx watch)
npm run build      # compila el server a dist/
npm run emit-tokens  # regenera shared/tokens.json tras tocar src/tokens.ts
```

La app (`app/`, node_modules propio): `npm test` (motores puros) y
`npx expo run:android --port 8092` — puerto 8092 SIEMPRE: es la tercera app RN
de la máquina y Metro en 8081 sirve el bundle de otra (lección Timón).

## Variables de entorno (`.env`, NUNCA commiteado)

No hay `.env.example` a propósito: un example commiteado con valores de
desarrollo es una bomba de tiempo en el build (lección `deploy-mini` §7.6).
Las variables se documentan acá y el `.env` real vive en `shared/` de la mini.

| Variable | Qué es | ¿Default en código? |
| --- | --- | --- |
| `PORT` | puerto del server | 4003 (constante) |
| `MONGO_URL` | Atlas, base `lilachat_db` (URI con credenciales) | — fail-closed |
| `CONSTROAD_AUTH_URL` | constroad-auth | `http://127.0.0.1:4002` |
| `CONSTROAD_AUTH_KEY` | llave de servicio (la emite Torre) | — fail-closed |
| `LILA_SERVER_URL` | storage de media | — fail-closed en prod |

## Deploy

- **server (+web)**: Torre / deploy-mini — una sola entrada `lilachat` en
  `torre.apps.json` (ver spec §12). Se registra por PR cuando el server exista.
- **app**: NO pasa por Torre. Se publica en LilaStore como app pública con
  `lila-cli` (skill `publicar-apk`).
