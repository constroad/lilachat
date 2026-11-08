# Tutoriales del canal de cliente

> José, 08/11/2026: «créame tutoriales para el canal del cliente: cómo crear los informes (los 2
> que tenemos), el mapa al 100 % sin omitir nada, y el Drive. Me parece que no tiene las buenas
> prácticas de cómo dibujar un mapa de obra, sobre todo el progreso por capas».
> Método: skill `tutorial-video-loop` (Portal, `ACADEMY-TUTORIALS.as-is.md` §9).

## 1. Estado

- Lilachat no tenía tutoriales: ni grabador, ni guiones, ni lugar donde verlos. Esto es el
  catálogo y la guía. El grabador y el visor son la fase siguiente (§5).
- Cada video HACE la tarea en el espacio Test y se graba en móvil (390×844), porque el canal de
  cliente se usa en obra.

## 2. Catálogo (en el orden del trabajo)

| # | Tutorial | Hace | Queda en la base | Min |
| --- | --- | --- | --- | --- |
| 1 | Dibujar la calle de la obra | Busca el lugar o pega el enlace del cliente, toca la calle, arrastra los extremos, pone el ancho y la etapa, y guarda | Una calle | 3 |
| 2 | Partir la obra en etapas y trabajos | Crea la etapa y el trabajo; con «Tocar calles» los pinta sobre cada calle | Etapa, trabajo, tramos | 3 |
| 3 | Tramos de una calle | En «Ver tramos», agrega un tramo de 0+000 a 0+120 con sus trabajos y su ancho | Un tramo | 2½ |
| 4 | Control de pista (CTL-PIS) | Crea el informe, elige el pedido y las unidades, y por cada unidad registra llegada, temperaturas y sus 4 fotos con GPS; después publica | Informe y fotos ubicadas | 4½ |
| 5 | Confirmar el avance de las unidades | Lee «Avance que marcan las unidades», ajusta el tramo si hace falta y confirma | Avance pendiente de aprobar | 2 |
| 6 | Control de imprimación (CTL-IMP) | Crea el informe, registra la tasa de riego por tramo con bandejas y fotos, y publica | Informe y fotos ubicadas | 4 |
| 7 | Registrar avance a mano | Elige la calle y el trabajo, y marca hasta dónde con ±10 m o «Mi GPS», con foto | Avance pendiente | 2½ |
| 8 | Caminar la calle con GPS | Usa «Empezar», «Pausa», «Seguir», «Deshacer» y «Terminar» | Una calle | 2 |
| 9 | Ver la obra: filtros, fotos y avance | Recorre los filtros de etapa, trabajo y fecha, y la capa «Fotos»; abre las fotos de un punto | Nada: es un recorrido | 2 |
| 10 | Compartir y exportar el avance | Elige un corte, crea el enlace seguro y lo suma al PDF del informe; después exporta | Un enlace y una hoja en el PDF | 3 |
| 11 | El Drive del servicio | Sube fotos y videos, los agrega desde el Drive a un informe y ve quién subió qué | Archivos en el Drive | 2½ |

El 9 es un recorrido: el mapa de lectura no tiene una acción principal.

## 3. Buenas prácticas para dibujar el mapa (van en los guiones 1–3 y 7)

1. **Primero el lugar, después la calle.**
   - Pega el enlace de Google Maps que mandó el cliente, o busca la dirección.
   - Si el servicio ya trae su ubicación, el mapa abre ahí.
   - No dibujes desde la oficina guiándote por el GPS del teléfono.
2. **Una calle del mapa = una vía real.**
   - Usa «Tocar la calle»: sigue el eje real y le pone su nombre.
   - Usa «A mano» solo para un pasaje que el mapa no tiene.
   - Usa «Caminar GPS» cuando el eje no se ve en el mapa (trocha, obra nueva).
3. **Recorta, no inventes.**
   - La calle se toca entera y se arrastran los extremos hasta donde va la obra.
   - Los ±10 m sirven para el ajuste fino.
   - El 0+000 es TU inicio, no el inicio de la vía en el mapa.
4. **El ancho va siempre.** Sin ancho no hay m² ni volumen, y Portal no puede calcular el metrado.
5. **Etapas para el tiempo, trabajos para las capas.**
   - Etapa: el frente o la fase del contrato («Etapa 1 · Cuadras 1–5»).
   - Trabajo: cada capa que se mide por separado: base, imprimación, carpeta asfáltica.
   - Una calle lleva varios trabajos, y cada uno avanza por su cuenta.
6. **Avance por capas, en el orden de la obra.**
   - Primero la base, después la imprimación y al final la carpeta.
   - Una capa no puede ir más adelante que la de abajo. Si el mapa lo muestra así, está mal
     registrado.
7. **El avance sale de la evidencia.**
   - Cada foto de informe va con su ubicación.
   - En el Control de pista, las fotos de cada unidad ya marcan el tramo; solo hay que
     confirmarlo.
   - En el Control de imprimación, las fotos del riego marcarán el tramo cuando Portal lo active
     (`MAPA-OBRA.spec.md`, propuesta del 08/11).
   - El avance a mano queda para lo que no tiene informe.
8. **Nada suma hasta que se confirma.**
   - Lo que sugieren las unidades está pendiente hasta que el ingeniero lo confirma.
   - Lo confirmado lo aprueba el residente en Portal.
9. **Revisa con la capa «Fotos»** que cada tramo con avance tenga fotos encima. Un tramo sin
   fotos es avance sin respaldo.

## 4. La data del espacio Test que hace verdadero lo narrado

- Servicio QA-CTLPIS, con el cliente Consorcio Vial del Pacífico.
- «QA-MAPA calle — borrar»: 191 m, con un tramo de 0 a 120 m y el trabajo «Asfalto QA».
- «QA-MAPA calle 2 — borrar»: 103 m, en Jirón Moquegua, sin etapa.
- «Etapa QA», y un Control de pista con 4 unidades: 3 en la calle y 1 fuera.
- Falta: un Control de imprimación con fotos ubicadas y dos días de avance aprobado (o-09).
- En cámara no puede verse «QA» ni «borrar». El grabador renombra para cámara (skill §6) o se
  siembra un servicio demo con nombres reales de obra.

## 5. Lo que falta construir (fase siguiente)

- **Grabador**:
  - Playwright con Chrome for Testing, overlay con los tokens de la app y voz `say` (Paulina);
  - WebM, después MP4 en el server;
  - portado de Portal con su motor puro y sus tests.
- **Dónde se ven**: en el media de Lilachat, no en el repo. Falta decidir el lugar del canal
  donde aparecen (ver §6).
- **Ensayo**: cada guion corre como E2E sin voz cuando cambia su pantalla.

## 6. Abierto (decisión de José)

- Dónde aparecen en el canal de cliente: una pestaña «Ayuda» del servicio, un botón «?» en cada
  pantalla, o la Academia de Portal.

## 7. Grabador (08/11, José: «sí a ambos»)

José eligió las dos opciones: una pestaña «Ayuda» en el servicio y un botón «?» en cada
pantalla. El visor todavía no está. Esto es lo que ya existe:

- **Motor puro** `shared/src/tutorialScript.ts` (10 tests). Porta el de Portal con las reglas de
  la skill:
  - cartel = voz + 250 ms;
  - mínimo 12 y máximo 38 palabras por cartel;
  - voseo rechazado;
  - tope de 5 min, validado antes de grabar;
  - acciones `goto · click · hover · highlight · scrollTo · type · press · drag · dragToward ·
    pause`. `dragToward` mueve un extremo de la calle hacia el otro, a lo largo de la vía.
- **Grabador** `scripts/tutorials/record.ts`, con `overlay.ts`, `steps.ts`, `media.ts` y
  `session.ts`:
  - Levanta la app y el socket en el mismo proceso, **sin los crons** (recordatorios, respaldos,
    cumpleaños, bots). La base es la misma de producción: un segundo server con crons mandaría
    cada recordatorio dos veces.
  - La sesión se firma en el proceso, con el secreto con que ese mismo proceso verifica. No se
    escribe nada, no hay contraseña y el token no sale del proceso. Usa el dispositivo
    `tutorial-recorder` y la cuenta de QA.
  - Abre en el espacio Test (`spaceId` del guion), así los chats personales nunca salen en
    cámara.
  - Antes de grabar cierra «Novedades», el aviso de notificaciones y la oferta de instalar.
  - `cameraNames` cambia los nombres de QA en todo el documento: «QA-CTLPIS — borrar» sale como
    «Pavimentación Jirón Lampa».
  - Puppeteer y ffmpeg salen de lila-app; la voz es `say` con Paulina a 195 palabras por minuto.
  - El resultado es WebM VP9 de 4 MB como máximo, codificado a 780 px de ancho, y un `.json` con
    los carteles y sus tiempos. Ese `.json` sirve para el `.srt`.
  - `--ensayo` corre el guion como E2E: sin voz y sin codificar, con una captura por paso.
- **Guion piloto** `scripts/tutorials/guiones/dibujar-calle.ts` (tutorial 1): 16 pasos, unos
  2:45 estimados. Dice las buenas prácticas 1 a 4.

**El ensayo encontró un defecto de la app, y se arregló en la app.**
- Al tocar una calle de 1,5 km (Jr. Lampa), sus extremos quedaban fuera de la pantalla y no se
  podían arrastrar.
- Ahora el mapa encuadra la calle entera apenas se toca, en web y APK (`pickedStreetFrame`, con
  tests).
- En el segundo ensayo el arrastre recortó la calle de 1 577 a 1 106 m y «−10 m» la dejó en
  1 096 m.

**Falta:**
- la grabación con voz, con los chequeos de la skill §7: el efecto en la base, la duración del
  archivo igual a la del `.json`, la hoja de contacto y verlo con sonido;
- borrar la calle grabada por el camino de la app;
- el visor «Ayuda» y el botón «?», con los videos en el media de Lilachat;
- los otros 10 guiones.

**Primera grabación con voz (08/11): no se publica.**
- El archivo dura 2:12,5, igual que el `.json` (132 513 ms). Pesa 3,3 MB y sale a 780×1688 con
  audio Opus.
- La hoja de contacto mostró el defecto: al guardar Jr. Lampa recortada a 1 096 m, la respuesta
  fue «Más de 200 caracteres, no entra en la tarjeta para confirmar». La calle no se guardó.
- El texto no está en Lilachat ni en Portal; se le preguntó a Agentes. Las calles cortas (103 m)
  se guardan bien.
- El grabador dio «sin avisos» porque el último paso miraba el mapa. Ahora el último paso espera
  «Calle guardada» (skill §4: el último paso espera su dato). Si no se guarda, el ensayo avisa.
- No quedó nada que limpiar en la base.

**Tercera grabación (08/11, 19:2xZ): lista para subir.** Agentes resumió el trazo en su tarjeta:
«84 puntos» en vez de las coordenadas (d33009d, desde 19:06Z).
- La segunda grabación (19:06Z) guardó la calle, pero el último paso no encontró «Calle
  guardada». El editor se cerraba **sin decir nada**: el mensaje existía y nadie lo mostraba.
  Ahora el mapa muestra el aviso arriba (`mapa-aviso`), en web y APK (test en
  `ServiceMapWeb.test.tsx`).
- Resultado de la tercera:
  - dura 2:15,2, igual que el `.json` (135 231 ms), y pesa 3,4 MB;
  - 0 avisos;
  - el último cuadro muestra «Calle guardada» sobre el mapa con 3 calles;
  - audio con volumen medio de −18,7 dB y pico de −3,9 dB, sin silencios de más de 8 s.
- Efecto en la base: «Jirón Lampa» de 1 096 m apareció en el mapa del servicio (3 calles).
- Limpieza por el camino de la app («Borrar calle» y confirmar, con un guion de ensayo que no
  va al repo): el mapa volvió a 2 calles. Se hizo después de cada grabación que guardó.
- El video y su `.json` quedan en `.tutorials-out/`, ignorado por git, hasta que exista el
  media de tutoriales de Lilachat. Falta verlo con sonido (José).
- El grabador acepta `xpath:` para el botón de una fila por el texto de esa fila.

**Tutorial 1 regrabado con la pantalla corregida (08/11, después del comentario de José).**
- La leyenda va en una fila arriba del mapa y el aviso «Calle «Jirón Lampa» guardada: 1096 m.»
  sale fuera del mapa. Nada tapa las calles.
- Defecto del video anterior: «Aquí ves las calles…» se decía con el mapa todavía gris (unos
  3 s). Ahora un paso puede llevar `waitFor`: la voz espera a que ese elemento esté en pantalla.
  Este guion espera `mapa-lienzo` con `data-listo=true`.
- Dura 2:18,8, igual que el `.json` (138 802 ms). Pesa 3,5 MB. 0 avisos. Audio con volumen medio
  de −18,8 dB y pico de −4,0 dB.
- La calle grabada se borró por «Borrar calle» y el mapa volvió a 2 calles. También se borró la
  de la grabación descartada.
