# Pendientes y diseños de Stitch — Lilachat (auditoría del 17/11/2026)

Pregunta de José: «¿ya terminaste de implementar todos los diseños de Stitch que tenías
pendientes? ¿ya no tienes tareas pendientes?». **Respuesta corta: no.** La mayoría está
hecha, pero quedan diseños sin implementar y tareas abiertas. Abajo va cada una con su evidencia.

Cómo se auditó: solo lectura. Se cruzó `design/stitch/INVENTARIO.md` y `registro.jsonl` con
el código (`grep` de slugs, `testID` y textos en `app/src` y `web/src`), los specs y
`git log` de las últimas 7 semanas. No se corrieron builds, tests ni emuladores.
«HECHO» quiere decir que está en el código con su commit. Muchos de esos siguen
«sin verificar en el teléfono de José», según sus propios specs.

**Ojo: el inventario está desactualizado.** Dice «sin implementar» en `dl-*` (Dali), que
se implementó el 17/11 en web y APK. También dice «espera a agentes» en `f-04`…`f-08`, ya hechos
del 30/10 al 05/11. Hay que corregirlo.

## Resumen

**A · Diseños de Stitch (59 filas por familia):** 40 hechos · 6 parciales ·
4 sin implementar (`legado`, `pla-04…09`, `fp-*`/`rc-*`, `la-08`/`la-09`) · 1 depende de Portal
(PDF `o-14…o-17`) · 7 obsoletos, sustituidos o descartados · 1 referencia general.

**B · Tareas (52):** 27 HECHO · 16 PARCIAL · 3 PENDIENTE · 5 DEPENDE DE OTRO · 1 OBSOLETO.

### Lo que puedo hacer yo (Lilachat)

1. **254** Que la cuenta creada por correo agregue o cambie su teléfono con código. No empezó.
2. **Llamada colgada (José 17/11)**: Wilson quedó en llamada tras el «no contestó» de José, y la
   rellamada dio «está en otra llamada». Arreglado el 17/11 (`llamadas.md` §2): server y web con el
   push `18cc63cc`, APK con la OTA `51d924d0` del 18/11. Falta probarlo entre dos teléfonos
   (José y Wilson: cerrar y abrir la app dos veces para que entre la OTA).
2a. **Editor 2.0 desde la web (18/11)**: SOL-IMP, APR-ADI, VAL-SRV y LIQ-SRV se crean en el editor
   (`18cc63cc`). En agentes, 3 herramientas de Portal quedaban fuera por el tope `MAX_TOOLS = 96`
   (Portal publica 99). Agentes lo subió a 160 (`152ad08`); José reaprobó solo `crear_informe_en_editor`
   (las otras dos no cambiaron de huella). Falta el E2E en Test: abrir un informe, crear VAL y LIQ,
   sincronizar LIQ, y que un miembro sin plata no vea ninguno. Limpiar por el camino de la app.
2c. **Crear los informes de la página pública de Portal en el canal de cliente (José 18/11)**: el APK
   y la PWA móvil (menos de 1024 px, `createsInEmbed` falso) ofrecen los tipos con `isPublic` de
   Portal. Hecho en código el 18/11, sin E2E:
   - **Lilachat:** SOL-IMP y APR-ADI con `opensHere` (`REPORT_TYPE_OPTIONS`). APR-ADI es `money`: el
     picker del canal (`fieldPickerReportTypes`, APK y web) lo da solo a quien ve la plata; salió de
     `EDITOR_REPORT_TYPE_OPTIONS` (en la web ancha sigue naciendo en el editor por `EMBED_CREATE_TYPES`).
   - **Portal** (rama `feat/field-docs-lilachat`, `ce8591dfb` y `9e57da788`): `informe_de_campo`
     lee SOL-IMP y APR-ADI; los guarda `guardar_seccion_de_acta` (herramienta propia: la compartida
     pasaba de 8 KB). APR-ADI sin cobranza no se lee, crea, guarda ni publica. FRE-PAV nace con los
     tramos del mapa (`buildFresadoSeed`) y es uno por día: crear refresca el del día de quien sea.
     Sin plano: lo dibuja solo el navegador.
   - **agentes** `23159fa`: `guardar_seccion_de_acta` en `FIELD_REPORT_WRITES`.
   - **Falta:** desplegar Portal, que José apruebe `guardar_seccion_de_acta` y reapruebe
     `informe_de_campo` (cambió su enum: hasta reaprobarla, los informes de campo no abren), publicar
     Lilachat (server, web y OTA) y el E2E en APK y web de 390 px con limpieza QA.
   - **REG-OBS sin empezar:** solo nace al registrar una observación nueva. Crearlo con las
     observaciones que ya están en el mapa pide una escritura nueva (herramienta en Portal, agentes y
     botón en Lilachat). Decisión de José.
   - El responsable de IAA, REG-OBS, LEV-OBS y RCP-CAM sale del usuario de la sesión (regla de campo).
2b. **265** Las llamadas siguen la regla vieja del push. `server/src/pushService.ts:258`
   (`avisarLlamada`) calla el teléfono si hay cualquier socket vivo. Hay que igualarla a la de
   los mensajes (`:97`, que solo salta el navegador web). Hallazgo nuevo: no está en ningún spec.
3. **199** Los 3 renders de `ChatScreen` por envío. Quedó pausado hasta medir con la Mac libre.
4. **268** Guiños en Lottie con sonido aparte (fase 4). Solo existe el conversor.
5. **241** Video en los formularios de tanque y materiales. Pide módulo nativo y APK nuevo.
6. **304** Pantallas `fp-01…04` (FRE-PAV) y `rc-01…03` (RCP-CAM). Falta el E2E de RCP-CAM.
7. **302** Producción de planta `pla-04…09` en el ⚡. Hoy solo cubicar (`pla-02`) está hecho.
8. **IAA**: `la-08` (revisar y enviar) y `la-09` (zonas en el mapa), sin implementar. `la-10`
   (croquis) no existe en el APK.
9. **251** Guiones 4 (CTL-PIS), 5, 6 (CTL-IMP), 7–10 (mapa) y 11 (Drive), y el visor «Ayuda».
10. **250** Semilla de `o-09`: falta el día 2 y aprobar los dos días (con el OK de José).
11. **276** Auditar la carga de fotos y el llenado de CTL-IMP, Registro y Levantamiento de
    observaciones. Falta medir el ANR de la pantalla de unidades.
12. **296** Una suite de Playwright en el repo. Hoy los E2E web son a mano.
13. **310** Revisar en producción las tarjetas 318/330/265/270 y el «Ver PDF» de la 265.
14. **316** APK nuevo: que tocar el aviso abra el mensaje o el hilo exacto, y apagar el aviso
    con la app cerrada. El teclado del hilo no se reprodujo: falta la captura de José.
15. **306** E2E en el APK de la hoja sin hueco y de «Compartir». Falta precisar qué era el «checklist».
16. **322** Embudo de Dali en el teléfono: hoy repite cifras. Van las baldosas de `dl-08 v5`.
17. `gst-01`: falta la auditoría contra la captura. `sc-04`: falta la página central de
    la invitación. `sc-05`: buscar también por teléfono.
18. **111**: tachar los ítems 75, 85, 87 y 88 del backlog. agentes confirmó el 17/11 que están hechos.

### Necesita decisión de José

- **32 / backlog 82**: correr `npm run medios:init -w server` en la mini y elegir el disco.
  Hasta entonces todo sigue subiendo a lila.
- **257**: llave de Google Maps Platform con facturación para el mapa base.
- **243**: encender «Cubicar» en los espacios reales (hoy solo está en Test).
- **302**: regenerar `pla-04` (y lo que Stitch cortó en `pla-05…09`).
- **268**: aprobar el arte nuevo de los guiños.
- **dl-06**: los accesos de Meta (Conversions API) para avisar quién compró.
- **Legado Digital** (diseño `legado`, F14 ⬜): ¿sigue en alcance?
- **50**: ¿siguen vigentes los diseños de detalle de `/mantenimiento`, `/deudas`, `/pagos`,
  `/planilla` y `/asistencia`? No se generaron en ningún inventario.
- **Backlog 16** (catálogo y publicidad), **50** (Google Play) y **67** (F12.3 bloqueado por D1,
  disco de respaldos, F13 redefinido).
- **265**: reproducirlo necesita dos cuentas reales.
- Pruebas en su teléfono: IAA con wincha real (307–309), videollamada al cambiar de app (294),
  CTL-PIS (214), WhatsApp por foto (231), barra a 390 px (216).

### Depende de otro sistema

- **agentes** (respuesta del 17/11): 309 (`ar` en `metodo`, `ff9de68`), 311 (`link.mime` en los
  PDF, `cbd14ed`) y 111 ya están hechos. Dali no va en Test (José, vía agentes 18/11): corre en el espacio «Dali» desde el 17/11; el E2E
  de prospectos se hace ahí. La lectura de archivos del cliente quedó encendida el 18/11 11:17Z;
  agentes pasa el `prospect_id` cuando llegue el KML de José. Las tarjetas de la tarea 50.
- **Reparto de informes con Portal (editor 2.0, 17/11)**: Lilachat toma 304, 276 y `la-08`/`la-09`.
  Portal suma VAL-SRV y LIQ-SRV al editor; Lilachat los agrega a `EMBED_CREATE_TYPES` con `money`
  cuando llegue el sha, junto con APR-ADI y SOL-IMP. 293, 317 y 273 quedan para Portal.
- **Portal**: puntos 3 y 6 de José del 12/11 (273); «0 de 0» y escantillón (276); que el autollenado
  de CTL-IMP marque `horaInicio`/`temperaturaAmbiente` (293); dibujar los contornos AR en el
  croquis (317); línea de tiempo y filtro de `o-09`; PDF `o-14`/`o-15`; texto de `gst-01`;
  «Corregir datos» de `gst-02`. El expediente del backlog 21 es de Portal y agentes.
- **Inframaq**: homologación de placas (243); tanques, agregados en tránsito y aviso a #agregados (258).
- **LilaStore**: backlog 48 (capturas), 50 (aviso de «archivo dañino») y 55 (instalar con sesión).

## A · Diseños de Stitch

APK y Web: «sí», «no», «parcial» o «—» (no aplica a ese cliente).

| Diseño | Familia | APK | Web | Estado | Evidencia |
| --- | --- | --- | --- | --- | --- |
| `chats-claro`, `chats-oscuro`, `lilachat-claro`, `lilachat-chats-oscuro`, `lilachat-info-grupo`, `chat-grupo`, `info-grupo-alpha`, `web-claro`, `nexchat-web-oscuro` | Primeros mockups (20/08) | — | — | Referencia general | ARCH §2.2: se eligió el par Lilachat; `nexchat` solo como layout oscuro. F2/F6 ✅ (§45.1) |
| `registro`, `otp`, `invitar-amigos` | Chat básico F1 | sí | sí | Hecho | §45.1 F1 ✅ |
| `multimedia-emojis`, `visor-archivos`, `busqueda-archivos`, `galeria-foto-grupo` | Chat básico F3 | sí | sí | Hecho | F3 ✅; §162 «Medios: Todo y búsqueda»; §163 foto del grupo |
| `crear-evento`, `recordatorios`, `crear-encuesta` | Chat básico F5 | sí | sí | Hecho | F5 ✅; §166 agenda web |
| `nuevo-grupo-contactos`, `nuevo-grupo-info`, `permisos-admin` | Grupos | sí | sí | Hecho | §163, §164 |
| `backup`, `configuracion-backup`, `restaurar` | Respaldo F12 | sí | parcial | Hecho (🟡) | F12.0–2 `943d293`. Falta el alta del disco en la mini (José) |
| `llamada-voz`, `video-llamada` | Llamadas F10 | sí | sí | Hecho (🟡) | F10; §154, §159 malla de 4 |
| `automatizaciones` | F11 | sí | sí | Hecho | §168 (silenciar por horario, «recordar») |
| `legado` | Legado Digital F14 | no | no | Sin implementar | §45.1: F14 ⬜. Decide José si sigue |
| `fl6-conversacion`, `fl6-lista`, `fl6-editar-recordatorio` | FL6 | sí | sí | Hecho | FL6/FL7 (§45.3) |
| `w5-web-vincular`, `w5-app-vinculados`, `w5-app-escaner` | Vincular web | sí | sí | Hecho | «Dispositivos vinculados» en `app/src` y `web/src` |
| `w3-web-lista`, `w3-web-info-grupo`, `w3c-web-*` | Web W3 | — | sí | Hecho | §61, §166 |
| `fm-*`, `f1-*` | Fijar, reacciones, reenviar | sí | sí | Hecho | «Mensajes fijados» en los dos clientes; reenvío en AS-IS-0.1.170:506 |
| `e3-app-chip-hilo`, `e3-app-hilo`, `e3-web-hilo` | Hilos | sí | sí | Hecho | Backlog 18; `8d6cba40`, `f2a0a543` (16/11) |
| `f2-app-camara` | Cámara del chat | sí | — | Sustituido | Lo reemplazó la cámara con sello `cam-*` (`03f56908`) |
| `s1-*` (stickers, pack «Lila») | Stickers | sí | sí | Hecho | Backlog 2 y 31 (§63, §81); Lottie `350b3302` |
| `c1-app-cumpleanos` | Cumpleaños | sí | sí | Hecho | «Saludar en el grupo» en los dos; backlog 17 |
| `m-01`…`m-05` | Clip y guiños | sí | sí | Hecho | §74 (`m-03` es referencia) |
| `x-a…e`, `y-a…c` | Personajes de guiños | sí | sí | Hecho | Fuente de `shared/winkArt.ts`, `WINK_PROPS` (§77) |
| `w-a…e` | Personajes chibi | — | — | Descartado | Rechazado por infantil (§74) |
| `s-01`, `s-02`, `s-04` | Formato Slack | sí | sí | Hecho | `496ad4e0` grupos como lista; hilo grande |
| `s-03-lista-con-secciones`, `r154-secciones` | Secciones | — | — | Obsoleto | Secciones quitadas en la 0.1.156 (§120) |
| `k-01`, `k-02` | Checklist | sí | sí | Hecho | §80, §81 |
| `e-01`…`e-35` | Espacios, apps, asistencia, clima | sí | sí | Hecho | `e-01` §161; `e-28`/`e-32` §127; `e-33` `3e7f132b`; `e-23`…`e-26` §151; `e-02`…`e-04` «ya existe» (INGRESO §2) |
| `c-01`…`c-07` | Chips, videollamada, detalle de app, emojis propios | sí | sí | Hecho | §150, §154, §151 |
| `d-01`…`d-03` | Comandos y horarios | sí | sí | Hecho | §152 (`67ccf009`) |
| `f-01`…`f-03` | Clientes y Archivados | sí | sí | Hecho | §157 |
| `f-04`, `f-05`, `f-06`, `f-08` | Servicio, cobranza, Drive, cuenta | sí | sí | Hecho | §169, §171, §173, `bd09ddb4`. El inventario dice «espera agentes»: desactualizado |
| `f-07-canal-nace-cotizacion` | Canal de cliente | — | — | Descartado | José 29/10 (regla de movimientos) |
| `h-01`…`h-04` | Consumo de combustible | sí | sí | Hecho | §176 |
| `r148`…`r153`, `r154-rockero` | Álbum, estado, almacenamiento, guiños de temporada | sí | sí | Hecho | §110–§116 |
| `r155-*` | Avisos de las apps (§118) | parcial | parcial | Parcial | Bloques `BlockTank`, `BlockChart` y `weather` dibujados; el contenido lo manda agentes. `r155-gastos-cola` y `-vista-previa` los reemplazó `gst-*`. `r155-web-planta`: sin evidencia del panel derecho |
| `r156-*` | Consentimiento y canal por tema | sí | sí | Hecho | §126 |
| `r02nov-telenovela-*` | Guiños | — | — | Descartado | Rechazados por José el 02/11 |
| `r02nov-ataque-*` | Guiños «Te ataco» | sí | sí | Hecho | §185 |
| `i-01`…`i-04` | Ingreso por correo | sí | sí | Hecho | `app/src/onboarding/SignInFlow.tsx`, `web/src/auth/EmailSignIn.tsx`, `web/src/spaces/YourSpacesPage.tsx` |
| `j-01`…`j-06`, `j-07b` | Informes desde Lilachat | sí | sí | Hecho | INFORMES F1 y §8. `j-07a`/`j-07c` descartados (José 07/11) |
| `o-01`…`o-08`, `o-10`, `o-12`, `o-13` | Mapa de obra | sí | sí | Hecho | MAPA-OBRA; `9c24a35f`, `e5561e5f`, `078040c5`, `95ca68fb`, `279db100`. El mapa base de Google lo decide José |
| `o-09`, `o-11` | Vista del cliente (Portal) | — | parcial | Parcial | MAPA-OBRA:745: la página de Portal no tiene línea de tiempo ni filtro por etapa (Portal) |
| `o-14`, `o-15`, `o-16`, `o-17` | PDF de avance | — | — | Depende de Portal | MAPA-OBRA:700: «El PDF lo arma Portal» (pedido el 08/11) |
| `ob-01`…`ob-07b` | Observaciones | sí | sí | Hecho | `d59e9cdc`, `8557161f` (E2E en producción) |
| `cam-01`…`cam-06` | Cámara con sello | sí | sí (móvil) | Hecho | `03f56908`, `df91d847`, `f62fcaca`; INFORMES §19 |
| `sc-01`…`sc-05` | Canales compartidos | sí | sí | Parcial | `8ca79f89`. Falta la página central de `sc-04`; `sc-05` busca solo por nombre (ARCH ~l.16009) |
| `t-01-claro-riel-oscuro` | Modo claro | sí | sí | Hecho | `b924472c` (opción A) |
| `drv-01`…`drv-03` | Drive del servicio | sí | sí | Hecho | `b19c8322`, `88864dcf`. `drv-03`: el progreso por archivo quedó como línea de estado |
| `gst-01-tarjetas` | Gasto | sí | sí | Parcial | `48f94dc6`. Falta el texto de Portal y la auditoría contra la captura |
| `gst-02-completar-v2` | Gasto | sí | sí | Hecho | `ee930372`, `58eb1f36`; verificado el 14/11 (AS-IS-0.1.170:777) |
| `inc-02-selector` | Incógnito | — | — | Sustituido | José 13/11: va en Ajustes → Superadmin (AS-IS-0.1.170:787) |
| `pla-01`, `pla-02`, `pla-03` | Planta en el ⚡ (cubicar) | parcial | parcial | Parcial | Cubicar con `x-cards` (`c68811c1`) y E2E en Test (AS-IS-0.1.170:839). `pla-01` y `pla-03` sin pantalla propia |
| `pla-04`…`pla-09` | Planta: producción, bitácora, temperatura… | no | no | Sin implementar | Varios cortados o «en generación» sin id (INVENTARIO); regenerar es de José |
| `fp-01`…`fp-04`, `rc-01`…`rc-03` | FRE-PAV y RCP-CAM en campo | no | no | Sin implementar | Solo `fp-01`, `fp-04` y `rc-02` tienen id. Hoy se llenan con el formulario del canal (`3a842f16`); en escritorio va el editor 2.0 |
| `lv01`…`lv03` | Visita técnica | sí | sí | Hecho | `7020b8c0`, `6c4916bf`; `design/stitch/auditorias/lv0*.md`; E2E (AS-IS-0.1.170:974) |
| `adm-01-usuarios-por-espacio` | Superadmin | — | sí | Hecho | `d14c8ac9`, auditoría en `auditorias/`. Sin verificar a 390 px |
| `la-01`…`la-03`, `la-05`, `la-06`, `la-07-v2` | IAA en el APK | sí | — | Hecho | `b86d2ac9`, `f285d7c2`, `802b425d`; APK 0.1.184–0.1.189 |
| `la-11-pwa-mide-en-apk` | IAA en la PWA | — | sí | Hecho | `c112973a` |
| `la-04-pwa-lienzo-v2` | IAA en la PWA | — | — | Sustituido | La reemplazó `la-11` (15/11) |
| `la-08-enviar-iaa`, `la-09-mapa-zonas` | IAA en el APK | no | — | Sin implementar | Sin código; INFORMES:1093 «falta revisar y enviar (la-08)» |
| `la-10-croquis-editor` | IAA croquis | no | parcial | Parcial | Web: «Editar croquis» abre el mapa de obra sobre el editor (`04add29d`). APK: no existe |
| `dl-01`…`dl-13` | Dali · prospectos | sí | sí | Hecho | `0053a7c8` (web), `5978413e` (APK), `e5d3f680` (fase 3). Falta: baldosas de `dl-08 v5` en el teléfono, aviso a Meta de `dl-06` (José), E2E con agentes reales |

## B · Tareas abiertas de la sesión

| # | Tarea | Estado | Evidencia / qué falta |
| --- | --- | --- | --- |
| 32 | Piloto Inframaq: `medios:init`, agentes↔Lilachat | DEPENDE DE OTRO (José) | Código `2be95e78`, `server/src/mediaInit.ts`. No hay marca `.lilachat-medios`: José no corrió el `medios:init` en la mini. El piloto de clima y líquidos va en vivo (§118.8) |
| 50 | Diseños de detalle de `/mantenimiento`, `/deudas`, `/pagos`, `/planilla`, `/asistencia` | DEPENDE DE OTRO (agentes) | No es de Portal. No hay diseños en los inventarios de Lilachat, Inframaq ni Portal. «R160/R161» son las versiones 0.1.160/161 (formularios). Las tarjetas las arma agentes con los bloques de Lilachat. José decide si sigue |
| 58 | E2E con agentes, Inframaq y Portal | PARCIAL | Hechos: gastos `b5edb59`, cubicar `21c3323c`, CTL-PIS, visita `e1d55fc2`, IAA `646810c5`. Falta el no admin en iPhone y la foto real de CTL-IMP en Test |
| 104 | Resto del backlog abierto | DEPENDE DE OTRO | Abiertos: 16 y 79 (José), 21 (agentes + Portal), 33 (el MCP es de agentes), 48, 50 y 55 (LilaStore), 67 (José), 75, 85, 87 y 88 (agentes), 82 (José) |
| 111 | Backlog 75, 85, 87, 88 | DEPENDE DE OTRO (agentes) | Lo de Lilachat está hecho (§149, PATCH, `thread_of`). Falta tacharlos en el backlog |
| 170 | Canal de cliente del 31/10 | HECHO | `65d0283c`, `2875622e`, §181, liquidación `7e7f17e2`. Portal no definió si regenerar pisa una liquidación editada a mano |
| 199 | F4: 3 renders de `ChatScreen` por envío | PENDIENTE | `54952cb6` solo bajó las celdas (147→4). PLANES-FLUIDEZ:615 y 823: pausado hasta medir con la Mac libre |
| 207 | José 04/11 noche | HECHO | `29b283e2`, `5eeea35a`, OTA `5179d0eb`. Falta la videollamada en un teléfono real |
| 214 | CTL-PIS F5 | HECHO | `j-05`/`j-06` v2; `985d857b`, `378ada66`, `e4063585`. Falta probarlo en el teléfono de José |
| 216 | Web móvil sin riel e «Instalar» | HECHO | `5909c672`, `fce79229`. Falta verlo a 390 px en un teléfono |
| 222 | ⚡ y «/» mostraban cosas distintas | HECHO | `b845cf50`: un solo ⚡ (ARCH:15520) |
| 223 | Marcar asistencia por tarjetas | HECHO | `b845cf50`: chips, dirección por Nominatim. Sin E2E en el teléfono |
| 226 | Web móvil: selector y modo empresa como el APK | HECHO | `b845cf50`. Falta verlo en el teléfono |
| 231 | WhatsApp por foto; Test al grupo de errores | HECHO | Portal `0b9a77c13`, `bea3bdcb0`; Lilachat `de8c4594`. Falta que José lo confirme en su teléfono |
| 234 | Fecha y hora en fotos de tanque y materiales | HECHO | `7a8f61be`, `shared/src/photoStamp.ts` |
| 237 | Borrador, ⚡, filas en espera, «Llegó» en planta | HECHO | `7a8f61be`, `59ee6eec`. José decide qué pasa si un carro llega sin estar despachado |
| 238 | Mapa de obra: módulo Stitch | HECHO | `o-01…o-15`, MAPA-OBRA §6 |
| 241 | Tanque y materiales: galería, video, fecha, lugar, compresión | PARCIAL | `d10f1ffe`, `ca2a1211`, gate `5e38550b`. Falta video: módulo nativo, APK y contrato con agentes, Portal e Inframaq |
| 243 | Cubicar en el ⚡ y homologar unidades | HECHO | `c68811c1`, E2E en Test. Encenderlo en espacios reales: José. Homologar placas: Inframaq |
| 244 | Crear el mapa desde Lilachat (`o-10`, `o-02…o-05`) | HECHO | `9c24a35f`, `e5561e5f`, `078040c5` |
| 247 | Tramos, etapas, trabajos, GPS, restaurar | HECHO | `078040c5`, `95ca68fb`, `475e703c`, E2E `8f46119a` |
| 250 | Semilla de `o-09` en Test | PARCIAL | Calle 2 `6af0add1…` y día 1 hechos (MAPA-OBRA:1015, 1046). Faltan el día 2 y aprobar los dos días |
| 251 | Tutoriales del canal de cliente | PARCIAL | Grabador `c6499a0f`; tutoriales 1–3 del mapa. Faltan 4, 5, 6, 7–10 y 11, el visor «Ayuda» y dónde se publican (José) |
| 253 | CTL-IMP: avance sugerido por el riego | HECHO | `b4fb3cdd`, `shared/src/workPrimeCoat.ts`. Sin un CTL-IMP real con fotos en Test |
| 254 | Correo: agregar o cambiar el teléfono con código | PENDIENTE | `profileRoutes.ts` no tiene ruta de teléfono. Ojo: `users.phone` es la identidad (INGRESO §4) |
| 257 | Usabilidad del mapa | PARCIAL | `279db100`, `df39b161`, `a73d64e3`. Mapa base de Google: José (llave con facturación, MAPA-OBRA:1381). Regrabar los tutoriales 1–3 |
| 258 | Tanques, agregados en tránsito, #agregados, servicios | HECHO (Lilachat) | `d1094afc`, `956bb267`, `f3901302`. Los datos son de Inframaq y agentes |
| 262 | Stickers animados como Telegram | HECHO | `350b3302`, `2d54bcf5`. La fase 3 (arte que se deforma) sigue pendiente (ARCH:567) |
| 265 | La llamada suena en el APK con la web abierta | PARCIAL | `870a9c2f` solo arregló los mensajes. `pushService.ts:258` sigue callando la llamada. Reproducir necesita dos cuentas (José) |
| 268 | Guiños en Lottie con sonido aparte | PENDIENTE | ARCH:568, fase 4. Solo el conversor `92721610`. El arte lo aprueba José |
| 271 | IAA en iPhone (opción B) | OBSOLETO | Retirada el 15/11 (INFORMES §14). La reemplazó `la-11` (`c112973a`) |
| 273 | José 12/11: 9 puntos | PARCIAL | Puntos 1, 2, 5, 7, 8 y 9 hechos (`c5e2ed44`, `2689abe9`, `272da5fb`). Los puntos 3 y 6 son de Portal; el 4 sin probar (INFORMES:1620) |
| 276 | Auditoría de fotos y llenado (APK = PWA) | PARCIAL | CTL-PIS auditado (`e4063585`). Faltan CTL-IMP, Registro y Levantamiento, y medir el ANR. Portal: «0 de 0» y escantillón |
| 292 | Rediseño del Drive | HECHO | `b19c8322`, `88864dcf`, `f62fcaca`. Falta el tutorial del Drive |
| 293 | Sello, cámara del Drive, informes, autollenado, gasto | PARCIAL | `f62fcaca`, `03f56908`, `48f94dc6`. Autollenado de CTL-IMP: Portal. Auditoría de `gst-01`: Lilachat |
| 294 | José 13/11 noche: 11 arreglos | HECHO | `2cc94715`, `3fe2d235`, APK 0.1.183 `4ceafd00` (AS-IS-0.1.170:504). Falta probar el .6x y la videollamada al salir de la app en un teléfono |
| 296 | E2E web con Playwright en cada iteración | PARCIAL | Solo E2E a mano (`b4bbd4cb`, `b5ccc937`). No hay suite en `web/package.json` |
| 298 | Gasto fiel a `gst-02-completar-v2` | HECHO | `ee930372`, `58eb1f36`, `82206e2e`. «Corregir datos» plegable: Portal |
| 302 | Cubicaje y producción de Portal al ⚡ | PARCIAL | Cubicar hecho. `pla-04…09` sin código y con diseños cortados |
| 303 | Bloque de mapa con ruta hasta 31 puntos | HECHO | `010b8989`, `d7822830`. Falta verlo con una tarjeta real de agentes |
| 304 | FRE-PAV y RCP-CAM en Lilachat | PARCIAL | Formulario `3a842f16`, editor 2.0 `8a2b1aef`, E2E FRE-PAV. Faltan `fp-*`/`rc-*` y el E2E de RCP-CAM |
| 305 | Visita técnica `lv01–lv03` | HECHO | `7020b8c0`, `6c4916bf`, `22c51989`; auditorías y E2E |
| 306 | José 14/11 tarde: 7 pedidos | PARCIAL | Hoja `3bf4a05b`, Compartir `f994375d`, croquis `210dd820`, `adm-01` `d14c8ac9`, cumpleaños `a7a43fbd`, #gastos `59f89674`. «Checklist» sin rastro: hay que preguntarle a José. Falta el E2E en el APK |
| 307 | IAA AR: motor, ARCore, pantallas | HECHO | `b86d2ac9`, APK 0.1.184 `c8fa0d2e` |
| 308 | IAA AR: lo que vio José en la prueba v2 | HECHO | `47305882`, `8906c3ae`, 0.1.185/186 |
| 309 | 0.1.187 tipo ARPlan; método `ar` | HECHO | `16386113`, `a9e89f4c`, `e07511da`, `a915ddef`. agentes no tiene `ar` en su lista de `metodo` |
| 310 | Revisar #cotizaciones y #admin de Constroad | PARCIAL | `21195906`, `11f54d62`. Falta revisar en producción las tarjetas 318/330/265/270 y el «Ver PDF» de la 265 |
| 311 | Pedidos de agentes del 15/11 | DEPENDE DE OTRO (agentes) | Visor `3e7f3960` y `link.mime` (BOTS:1382). agentes debe mandar `link.mime`. El contrato del checklist está en BOTS:1247 (06/11): confirmar si es el pedido del 15/11 |
| 316 | Notificaciones | PARCIAL | `870a9c2f`, `f2a0a543`, `8d6cba40`, APK 0.1.189 `bd80fe37`. Falta un APK nuevo para abrir el mensaje o el hilo exacto; el teclado del hilo no se reprodujo |
| 317 | Croquis del IAA en el editor compartido | PARCIAL | `04add29d`, `03846536`. Los contornos AR en el croquis son de Portal. Sin E2E; no existe en el APK |
| 319 | Dali fase 1 | HECHO | `7ffc52c4`, `3dd01eb2`. Sin E2E con la app Dali real; va en el espacio «Dali», no en Test (18/11) |
| 322 | Dali fase 2 (y 3) | HECHO | `1ecd5383`, `0053a7c8`, `5978413e`, `36206b42`, `e5d3f680`, índices `82d46300`. Faltan las baldosas de `dl-08 v5` y el E2E con agentes |
