# Auditoría cc-05-drive · Servicio › Drive

Stitch: `.stitch-work/out_cc/{desktop,tablet,mobile}/cc-05-drive.stitch.png` del checkout principal (escritorio, tablet, móvil). Ids en INVENTARIO § «Canal de cliente y servicio, rediseño».
Código: `web/src/spaces/clients/ServiceDriveWeb.tsx`, `DriveParts.tsx`, `DriveFileMenu.tsx`, `useDrivePaste.ts`, `app/src/spaces/clients/ServiceDrive.tsx`, `DriveHeader.tsx`, `DriveFileSheet.tsx`, `drivePaste.ts`.
Captura de la implementación: **pendiente** (sin navegador, dev server ni emulador en esta tarea: Mac compartida). Esta lectura es
de código contra cada captura de Stitch, abierta en la sesión del 19/11. Falta capturar a 1440 / 1024 / 390 px (web) y en teléfono y
tablet (APK) y que un subagente independiente compare imagen contra imagen, con medidas en px.
Revisor: pendiente (no aprobado).
Fecha: 2026-11-19 21:10 (lectura de código; ramas 988a209a y 9d074e71)

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Acciones | Pegar · cámara · Subir a la derecha de la barra | web: igual; APK: en la cabecera del Drive bajo la barra | diferencia justificada: React Native sin portales (as-is canal § APK) |
| Franja de pegar | «Pega aquí una imagen o un archivo (Ctrl+V) o arrástralo» | igual en computadora (`md`); en el teléfono no | igual |
| Buscador | a lo ancho | igual | igual |
| Chips | Todo · Fotos · Videos · Documentos + lista/cuadrícula | igual | igual |
| Carpetas | tarjetas con conteo | igual (`FolderCardsWeb`) | igual |
| Mosaico | etiqueta JPG/PDF, miniatura, nombre, «hoy 08:30 · 2.1 MB», «⋮» | miniatura, etiqueta, nombre, `driveFileLine` (carpeta · peso · día) y «⋮» (APK: toque largo) | igual |
| Menú del archivo | Abrir, Copiar enlace, Copiar archivo, Descargar, Marcar antes/después, Mover a carpeta | todo menos «Mover a carpeta» | diferencia justificada: Portal no tiene herramienta para mover (as-is obra-drive §2) |
| Aviso «Enlace copiado» | toast abajo a la derecha | línea de estado bajo la cabecera | falta: decidir con José si va como toast |
| Cabecera «Canal Obras Carreter… · Vías MTC» (móvil) | sí | no va | diferencia justificada: error de Stitch (brief del 19/11 e INVENTARIO § cc) |
