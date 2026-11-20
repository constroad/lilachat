# Auditoría cc-04-mapa · Servicio › Mapa

Stitch: `.stitch-work/out_cc/{desktop,tablet,mobile}/cc-04-mapa.stitch.png` del checkout principal (escritorio, tablet, móvil). Ids en INVENTARIO § «Canal de cliente y servicio, rediseño».
Código: `web/src/spaces/clients/workMap/WorkMapBoard.tsx`, `MapLayersPanel.tsx`, `WorkMapPanel.tsx`, `app/src/spaces/clients/workMap/WorkMapBoard.tsx`, `MapLayersPanel.tsx`.
Captura: design/stitch/capturas/cc-04-impl-escritorio.jpg (escritorio, web local con la API de producción, tema oscuro)
Captura: design/stitch/capturas/cc-04-impl-tablet.jpg (tablet, web local con la API de producción, tema oscuro)
Captura: design/stitch/capturas/cc-04-impl-movil.jpg (móvil, web local con la API de producción, tema oscuro)
Revisor: subagente independiente (solo vio las imágenes de Stitch y de la implementación; 19/11).
Veredicto del revisor: pasa con observaciones: partidas con color e interruptor verificadas (al apagar la carpeta aparece la imprimación); en tablet con la lista abierta el panel va detrás de «Capas»; «Hasta hoy», «Trabajo» y los chips de fecha son de la pantalla actual.
Fecha: 2026-11-20 00:40 (E2E en web a 1440, 1024 y 390 px; main d9aa2e91)

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
| Chip «JR CONCHUCOS» y «Filtrar tramo» | sí | no van | diferencia justificada: INVENTARIO § cc, Stitch no tiene esa función en la app |
| Tarjeta de un dibujo | área, nota, fotos antes/corte, Cerrar | la tarjeta existente (`MapCardView`) | igual |
| Partidas y colores reales | tres partidas inventadas | las del mapa de Portal | diferencia justificada: INVENTARIO § cc (PROPUESTA) |
