# Auditoría cc-05-drive · Servicio › Drive

Stitch: `.stitch-work/out_cc/{desktop,tablet,mobile}/cc-05-drive.stitch.png` del checkout principal (escritorio, tablet, móvil). Ids en INVENTARIO § «Canal de cliente y servicio, rediseño».
Código: `web/src/spaces/clients/ServiceDriveWeb.tsx`, `DriveParts.tsx`, `DriveFileMenu.tsx`, `useDrivePaste.ts`, `app/src/spaces/clients/ServiceDrive.tsx`, `DriveHeader.tsx`, `DriveFileSheet.tsx`, `drivePaste.ts`.
Captura: design/stitch/capturas/cc-05-impl-escritorio.jpg (escritorio, web local con la API de producción, tema oscuro)
Captura: design/stitch/capturas/cc-05-impl-movil.jpg (móvil, web local con la API de producción, tema oscuro)
Captura: design/stitch/capturas/cc-05-impl-movil-menu.jpg (móvil, web local con la API de producción, tema oscuro)
Captura: design/stitch/capturas/cc-05-impl-tablet.jpg (tablet, web local con la API de producción, tema oscuro; con datos de OBRA GRAU)
Revisor: subagente independiente (solo vio las imágenes de Stitch y de la implementación; 19/11).
Veredicto del revisor: pasa con observaciones: en el teléfono el menú es flotante y Stitch dibuja hoja inferior (José 19/11: hoja inferior, lote siguiente); carpetas en lista como el Drive del espacio.
Fecha: 2026-11-20 00:40 (E2E en web a 1440, 1024 y 390 px; main d9aa2e91)

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Acciones | Pegar · cámara · Subir a la derecha de la barra | web: igual; APK: en la cabecera del Drive bajo la barra | diferencia justificada: React Native sin portales (as-is canal § APK) |
| Franja de pegar | «Pega aquí una imagen o un archivo (Ctrl+V) o arrástralo» | igual en computadora (`md`); en el teléfono no | igual |
| Buscador | a lo ancho | igual | igual |
| Chips | Todo · Fotos · Videos · Documentos + lista/cuadrícula | igual | igual |
| Carpetas | tarjetas con conteo | igual (`FolderCardsWeb`) | igual |
| Mosaico | etiqueta JPG/PDF, miniatura, nombre, «hoy 08:30 · 2.1 MB», «⋮» | miniatura, etiqueta, nombre, `driveFileLine` (carpeta · peso · día) y «⋮» (APK: toque largo) | igual |
| Menú del archivo | Abrir, Copiar enlace, Copiar archivo, Descargar, Marcar antes/después, Mover a carpeta | todo menos «Mover a carpeta» | diferencia justificada: Portal no tiene herramienta para mover (as-is obra-drive §2) |
| Aviso «Enlace copiado» | toast abajo a la derecha | línea de estado bajo la cabecera | diferencia justificada: José 19/11 eligió el aviso flotante; va en el lote siguiente (en implementación) |
| Cabecera «Canal Obras Carreter… · Vías MTC» (móvil) | sí | no va | diferencia justificada: error de Stitch (brief del 19/11 e INVENTARIO § cc) |


## Revisión de tablet y móvil (19/11, revisor independiente)

Pasa con observaciones. Diferencias por datos que Portal no manda (código PED, «Volquete», totales y contadores: van con las cifras del lote siguiente), por piezas de la pantalla actual que se conservan («Etapas · X de N», «Generar informe de servicio») y por inventos de Stitch (tarjetas de resumen de Informes, «Total emitidos», «Nueva carpeta», ⌘K). En el teléfono el estado y el PDF del informe bajan bajo el título para que no se corte (6accd568).
