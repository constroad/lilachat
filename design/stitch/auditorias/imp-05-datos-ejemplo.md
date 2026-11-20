# Auditoría imp-05-datos-ejemplo · Aviso «Completar datos de ejemplo» (móvil)

Stitch: `.stitch-work/out_v2/mobile/imp-05-datos-ejemplo.stitch.png` (+ `.html`) del checkout principal. Aprobado por José 20/11.
Código: `shared/src/reportExamples.ts`, `shared/src/reportScreen.ts` (`fillExamples`), `web/src/spaces/clients/reports/ExampleBannerWeb.tsx`, `app/src/spaces/clients/reports/ExampleBanner.tsx`, una línea en `ReportDocumentWeb.tsx` y `ReportDocumentScreen.tsx`.
Captura: TODO
Revisor: pendiente
Fecha: 2026-11-20 (sin E2E: tests de shared y de render web)

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Aviso arriba de las secciones | ícono, «¿Probando?…», botón, cerrar | igual; solo en borrador con algún ejemplo | igual |
| Botón | «Completar datos de ejemplo» | llena cada sección con ejemplo, una tras otra, por la cola de siempre; dice el avance y el resultado | igual |
| Cerrar | X | se recuerda en el dispositivo por servicio y tipo, y por informe | igual |
| Chip «EJEMPLO» en la sección | sí | no va | diferencia justificada: no se puede saber qué valores vinieron del ejemplo |
| «Expediente técnico CONS-7K3P» | sí | no va | diferencia justificada: inventado por Stitch (pedido de José) |
| Subtítulos de las secciones | sí | no van | diferencia justificada: fuera del pedido |
| Tarjeta de ayuda al pie | sí | no va | diferencia justificada: fuera del pedido |
| «Falta: …» sobre «Publicar» | sí | la línea de siempre, sin cambios | igual |
