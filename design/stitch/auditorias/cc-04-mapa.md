# Auditoría cc-04-mapa · Servicio › Mapa

Stitch: `.stitch-work/out_cc/{desktop,tablet,mobile}/cc-04-mapa.stitch.png` del checkout principal (escritorio, tablet, móvil). Ids en INVENTARIO § «Canal de cliente y servicio, rediseño».
Código: `web/src/spaces/clients/workMap/WorkMapBoard.tsx`, `MapLayersPanel.tsx`, `WorkMapPanel.tsx`, `app/src/spaces/clients/workMap/WorkMapBoard.tsx`, `MapLayersPanel.tsx`.
Captura de la implementación: **pendiente** (sin navegador, dev server ni emulador en esta tarea: Mac compartida). Esta lectura es
de código contra cada captura de Stitch, abierta en la sesión del 19/11. Falta capturar a 1440 / 1024 / 390 px (web) y en teléfono y
tablet (APK) y que un subagente independiente compare imagen contra imagen, con medidas en px.
Revisor: pendiente (no aprobado).
Fecha: 2026-11-19 21:10 (lectura de código; ramas 988a209a y 9d074e71)

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Acciones | Capas · Editar croquis · Compartir avance · Más, a la derecha de la barra | pantalla completa · Capas · Editar croquis · Más · Compartir avance · Registrar avance | diferencia justificada: «Registrar avance» y pantalla completa son de la pantalla actual (as-is obra-mapa §2, memoria «Rediseño conserva lo de la pantalla actual») |
| Editar croquis en móvil | botón sobre el mapa | APK: pastilla con texto sobre el mapa; web angosta: en la barra propia del mapa con su texto | igual |
| Corte | «Hasta hoy (19 nov)» flotando | «Hasta hoy» flotando + selector de trabajo | diferencia justificada: el selector de trabajo cambia cifras y exportación (as-is obra-mapa «Sale lo que ves») |
| Panel | «CAPAS Y LEYENDA · Control de visualización» arriba, avance abajo | «Capas y leyenda» arriba, avance y calles abajo | igual |
| Partidas | color, nombre, %, interruptor | igual (`layerRowsOf`) | igual |
| Etapas | chips Todas · Etapa 1… | igual (`capas-etapa-*`) | igual |
| Dibujos | «Áreas · 33 (Parches 1 al 33)» con interruptor | por tipo con su número e interruptor | igual |
| Observaciones / Fotos (tablet) | Pendientes (24) · Levantadas (6) · Fotos | igual, con los números reales | igual |
| Fotos por tipo de informe | una sola fila «Fotos» | «Fotos» con una sub-fila por tipo de informe (interruptor y cuenta) y «Otras fotos de campo» al final | diferencia justificada: José 19/11 (vía Portal f080f7c6a), mismas sub-capas que el mapa de Portal |
| Chip «JR CONCHUCOS» y «Filtrar tramo» | sí | no van | diferencia justificada: INVENTARIO § cc, Stitch no tiene esa función en la app |
| Tarjeta de un dibujo | área, nota, fotos antes/corte, Cerrar | la tarjeta existente (`MapCardView`) | igual |
| Partidas y colores reales | tres partidas inventadas | las del mapa de Portal | diferencia justificada: INVENTARIO § cc (PROPUESTA) |
| Encuadre inicial | el tramo de la obra entero a la vista | calles, dibujos y observaciones del servicio juntos, con un tamaño mínimo (`workMapView` › `frameOf`) | igual (José 19/11, E2E OBRA GRAU) |
