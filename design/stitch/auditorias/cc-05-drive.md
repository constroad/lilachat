# Auditoría cc-05-drive · Servicio › Drive

Stitch: `.stitch-work/out_cc/{desktop,tablet,mobile}/cc-05-drive.stitch.png` del checkout principal (escritorio, tablet, móvil). Ids en INVENTARIO § «Canal de cliente y servicio, rediseño».
Código: `web/src/spaces/clients/ServiceDriveWeb.tsx`, `DriveParts.tsx`, `DriveFileMenu.tsx`, `useDrivePaste.ts`, `web/src/ui/FloatingNotice.tsx`, `app/src/spaces/clients/ServiceDrive.tsx`, `DriveHeader.tsx`, `DriveFileSheet.tsx`, `drivePaste.ts`, `shared/src/driveFileActions.ts`.
Captura: design/stitch/capturas/cc-05-impl-escritorio.jpg (escritorio, web local con la API de producción, tema oscuro)
Captura: design/stitch/capturas/cc-05-impl-movil.jpg (móvil, web local con la API de producción, tema oscuro)
Captura: design/stitch/capturas/cc-05-impl-movil-menu.jpg (móvil, web local con la API de producción, tema oscuro)
Captura: design/stitch/capturas/cc-05-impl-tablet.jpg (tablet, web local con la API de producción, tema oscuro; con datos de OBRA GRAU)
Revisor: subagente independiente (solo vio las imágenes de Stitch y de la implementación; 19/11).
Veredicto del revisor: pasa con observaciones: en el teléfono el menú es flotante y Stitch dibuja hoja inferior (José 19/11: hoja inferior, lote siguiente); carpetas en lista como el Drive del espacio.
Fecha: 2026-11-20 01:30 (E2E del lote 2 en web a 1440 y 390 px; main f217270b)

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Acciones | Pegar · cámara · Subir a la derecha de la barra | web: igual; APK: en la cabecera del Drive bajo la barra | diferencia justificada: React Native sin portales (as-is canal § APK) |
| Franja de pegar | «Pega aquí una imagen o un archivo (Ctrl+V) o arrástralo» | igual en computadora (`md`); en el teléfono no | igual |
| Buscador | a lo ancho | igual | igual |
| Chips | Todo · Fotos · Videos · Documentos + lista/cuadrícula | igual | igual |
| Carpetas | tarjetas con conteo | igual (`FolderCardsWeb`) | igual |
| Mosaico | etiqueta JPG/PDF, miniatura, nombre, «hoy 08:30 · 2.1 MB», «⋮» | miniatura, etiqueta, nombre, `driveFileLine` (carpeta · peso · día) y «⋮» (APK: toque largo) | igual |
| Menú del archivo (escritorio) | Abrir, Copiar enlace, Copiar archivo, Descargar, Marcar antes/después, Mover a carpeta | menú flotante con todo menos «Mover a carpeta», y «Compartir» donde el navegador lo tiene | diferencia justificada: Portal no tiene herramienta para mover (as-is obra-drive §2) |
| Menú del archivo (móvil) | hoja inferior: miniatura, nombre, «Hoy 09:40 · Fotos de obra · 1.8 MB», ✕; Abrir vista previa, Copiar enlace, Copiar archivo, Compartir con el equipo, Marcar como antes / después con su segunda línea, Descargar original | hoja inferior igual en web (`DriveFileSheetWeb`) y APK (`DriveFileSheet`); «Compartir» y «Descargar» sin «con el equipo» ni «original» | diferencia justificada: José 19/11 pidió «Compartir» y «Descargar»; comparte el enlace por la hoja del sistema |
| Hoja en «Medios» del espacio | — | la misma hoja (web y APK) con «Ver en el chat» | igual (José 19/11: mismo componente) |
| Aviso «Enlace copiado» | toast abajo con check | web: aviso flotante abajo al centro con check (`FloatingNotice`); APK: toast de Android (sin ícono) | diferencia justificada: José 19/11 pidió reusar el aviso que la app ya tiene; el toast de Android no lleva ícono |
| Cabecera «Canal Obras Carreter… · Vías MTC» (móvil) | sí | no va | diferencia justificada: error de Stitch (brief del 19/11 e INVENTARIO § cc) |


## Revisión de tablet y móvil (19/11, revisor independiente)

Pasa con observaciones. Diferencias por datos que Portal no manda (código PED, «Volquete», totales y contadores: van con las cifras del lote siguiente), por piezas de la pantalla actual que se conservan («Etapas · X de N», «Generar informe de servicio») y por inventos de Stitch (tarjetas de resumen de Informes, «Total emitidos», «Nueva carpeta», ⌘K). En el teléfono el estado y el PDF del informe bajan bajo el título para que no se corte (6accd568).


## Revisión tras el lote de José (20/11, revisor independiente)

Pasa con observaciones en Servicios (escritorio y móvil), Mapa, hoja del Drive y Pendientes. Cifras, «N etapas» y último movimiento salen «—» u ocultos hasta que se desplieguen Portal y Agentes (ramas `feat/service-counts-lilachat`). Diferencias justificadas: «Drive del cliente», el kicker «SERVICIO 01 · VIAL», la escala y la brújula del mapa, «Requeridos para faena» y «Agregar nueva tarea» los dibujó Stitch sin pedido ni dato; «Enlace del servicio», chips de días, «Trabajo» y «Registrar avance» son de la pantalla actual (memoria «Rediseño conserva lo de la pantalla actual»). Pendiente menor: «Compartir» en la hoja del Drive solo aparece donde el navegador lo soporta.
