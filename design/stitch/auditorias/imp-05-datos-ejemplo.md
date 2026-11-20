# Auditoría imp-05-datos-ejemplo · Aviso «Completar datos de ejemplo» (móvil)

Stitch: `.stitch-work/out_v2/mobile/imp-05-datos-ejemplo.stitch.png` (+ `.html`) del checkout principal. Aprobado por José 20/11.
Código: `shared/src/reportExamples.ts`, `shared/src/reportScreen.ts` (`fillExamples`), `web/src/spaces/clients/reports/ExampleBannerWeb.tsx`, `app/src/spaces/clients/reports/ExampleBanner.tsx`, una línea en `ReportDocumentWeb.tsx` y `ReportDocumentScreen.tsx`.
Captura: design/stitch/capturas/imp-05-datos-ejemplo.png (móvil 390, oscuro) · Huella: 27096756a291
Revisor: subagente independiente
Fecha: 2026-11-20 09:40

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Aviso arriba de las secciones | ícono, «¿Probando?…», botón, cerrar | igual; solo en borrador con algún ejemplo | diferencia justificada: en dos filas (texto arriba, botón a lo ancho); en una fila a 390 px el texto se cortaba (§4 de constroad-premium-ui: nada cortado) |
| Botón | «Completar datos de ejemplo» | llena cada sección con ejemplo, una tras otra, por la cola de siempre; dice el avance y el resultado | igual |
| Cerrar | X | se recuerda en el dispositivo por servicio y tipo, y por informe | igual |
| Chip «EJEMPLO» en la sección | sí | no va | diferencia justificada: no se puede saber qué valores vinieron del ejemplo |
| «Expediente técnico CONS-7K3P» | sí | no va | diferencia justificada: inventado por Stitch (pedido de José) |
| Subtítulos de las secciones | sí | no van | diferencia justificada: fuera del pedido |
| Tarjeta de ayuda al pie | sí | no va | diferencia justificada: fuera del pedido |
| «Falta: …» sobre «Publicar» | sí | la línea de siempre, sin cambios | igual |
