# Auditoría cc-05-drive · Servicio › Drive

Stitch: `.stitch-work/out_cc/{desktop,tablet,mobile}/cc-05-drive.stitch.png` del checkout principal (escritorio, tablet, móvil). Ids en INVENTARIO § «Canal de cliente y servicio, rediseño».
Código: `web/src/spaces/clients/ServiceDriveWeb.tsx`, `DriveParts.tsx`, `DriveFileMenu.tsx`, `useDrivePaste.ts`, `web/src/ui/FloatingNotice.tsx`, `app/src/spaces/clients/ServiceDrive.tsx`, `DriveHeader.tsx`, `DriveFileSheet.tsx`, `drivePaste.ts`, `shared/src/driveFileActions.ts`.
Captura: TODO escritorio (1440, mosaico por defecto, tras el arreglo del 20/11)
Captura: TODO tablet (768)
Captura: TODO móvil (390, mosaico y hoja inferior)
Revisor: pendiente (José 20/11: «estaba revisando el tab de drive de lilachat no está como lo diseñaste»; la revisión del 19/11 aprobó carpetas en lista y la vista lista por defecto, que no eran el diseño).
Fecha: 2026-11-20 (arreglo de carpetas, mosaico y cabecera; sin E2E todavía)

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Acciones | Pegar · cámara · Subir a la derecha de la barra | web: igual; APK: en la cabecera del Drive bajo la barra | diferencia justificada: React Native sin portales (as-is canal § APK) |
| Franja de pegar | «Pega aquí una imagen o un archivo (Ctrl+V) o arrástralo» | igual en computadora (`md`); en el teléfono no | igual |
| Cabecera «Drive del servicio · N archivos» | no existe; el buscador va bajo la franja de pegar | quitada (20/11; antes estaba) | igual |
| Buscador | a lo ancho, «Buscar en el Drive del servicio» | igual | igual |
| Chips | Todo · Fotos · Videos · Documentos + lista/cuadrícula a la derecha | igual; el selector pasó de la cabecera a la fila de chips (20/11) | igual |
| Vista por defecto | mosaico | mosaico (20/11; antes lista); la lista se recuerda solo si se elige | igual |
| Carpetas | tarjetas en fila: ícono, nombre, «41 archivos»; 4 por fila en escritorio | tarjetas `FolderCardsWeb` / `FolderCards` en lista y en mosaico, «N archivos» (`driveFilesLabel`); 2, 3 o 4 por fila (20/11; antes filas de lista) | igual |
| Mosaico | por día «HOY · 19 NOV»; etiqueta JPG/MP4/PDF/XLSX/DOCX arriba a la izquierda, miniatura o ícono, nombre, «hoy 08:30 · 2.1 MB», «⋮»; 5 por fila | igual (`driveTypeTag`, `driveTileLine`); sin título «Recientes»; 2, 3 o 5 por fila; APK: «⋮» y toque largo (20/11) | igual |
| Duración del video («0:38») | sobre la miniatura | no va | diferencia justificada: Portal no manda la duración |
| Ícono del documento | PDF rojo, XLSX verde, DOCX azul | PDF `error`, hoja de cálculo `en-linea` (APK `secondary`), otros `primary` | igual (tokens, sin hex) |
| «Drive 58» en la pestaña | sí | no | diferencia justificada: Portal no manda el conteo a la pestaña (as-is obra-drive §6); el Drive se pide al abrirla |
| Conteos en los chips («Todo 58», móvil) | sí | no | pendiente: se puede contar con la lista ya traída; no entró en este arreglo |
| Menú del archivo (escritorio) | Abrir, Copiar enlace, Copiar archivo, Descargar, Marcar antes/después, Mover a carpeta | menú flotante con todo menos «Mover a carpeta», y «Compartir» donde el navegador lo tiene | diferencia justificada: Portal no tiene herramienta para mover (as-is obra-drive §2) |
| Menú del archivo (móvil) | hoja inferior: miniatura, nombre, «Hoy 09:40 · Fotos de obra · 1.8 MB», ✕; Abrir vista previa, Copiar enlace, Copiar archivo, Compartir con el equipo, Marcar como antes / después con su segunda línea, Descargar original | hoja inferior igual en web (`DriveFileSheetWeb`) y APK (`DriveFileSheet`); «Compartir» y «Descargar» sin «con el equipo» ni «original» | diferencia justificada: José 19/11 pidió «Compartir» y «Descargar»; comparte el enlace por la hoja del sistema |
| Hoja en «Medios» del espacio | — | la misma hoja (web y APK) con «Ver en el chat» | igual (José 19/11: mismo componente) |
| Aviso «Enlace copiado» | toast abajo con check | web: aviso flotante abajo al centro con check (`FloatingNotice`); APK: toast de Android (sin ícono) | diferencia justificada: José 19/11 pidió reusar el aviso que la app ya tiene; el toast de Android no lleva ícono |
| Cabecera «Canal Obras Carreter… · Vías MTC» (móvil) | sí | no va | diferencia justificada: error de Stitch (brief del 19/11 e INVENTARIO § cc) |


## Revisión de tablet y móvil (19/11, revisor independiente)

Pasa con observaciones. Diferencias por datos que Portal no manda (código PED, «Volquete», totales y contadores: van con las cifras del lote siguiente), por piezas de la pantalla actual que se conservan («Etapas · X de N», «Generar informe de servicio») y por inventos de Stitch (tarjetas de resumen de Informes, «Total emitidos», «Nueva carpeta», ⌘K). En el teléfono el estado y el PDF del informe bajan bajo el título para que no se corte (6accd568).


## Revisión tras el lote de José (20/11, revisor independiente)

Pasa con observaciones en Servicios (escritorio y móvil), Mapa, hoja del Drive y Pendientes. Cifras, «N etapas» y último movimiento salen «—» u ocultos hasta que se desplieguen Portal y Agentes (ramas `feat/service-counts-lilachat`). Diferencias justificadas: «Drive del cliente», el kicker «SERVICIO 01 · VIAL», la escala y la brújula del mapa, «Requeridos para faena» y «Agregar nueva tarea» los dibujó Stitch sin pedido ni dato; «Enlace del servicio», chips de días, «Trabajo» y «Registrar avance» son de la pantalla actual (memoria «Rediseño conserva lo de la pantalla actual»). Pendiente menor: «Compartir» en la hoja del Drive solo aparece donde el navegador lo soporta.
