# Auditoría imp-04-firmas · «Responsables y firmas» del CTL-IMP (móvil)

Stitch: `.stitch-work/out_v2/mobile/imp-04-firmas.stitch.png` (+ `.html`) del checkout principal. Aprobado por José 20/11.
Código: `shared/src/compactReportForms.ts` (`SIGNER_HINTS`, `compactSubmitLabelOf`), `shared/src/roleCards.ts`, `shared/src/fieldDocument.ts` (`sectionFormOf`), `web/src/chat/commands/CompactFields.tsx` (`RoleCardsWeb`), `web/src/chat/commands/AppFormDialog.tsx`, `app/src/chat/commands/CompactFields.tsx` (`RoleCardsView`), `app/src/chat/commands/AppFormSheet.tsx`.
Captura: design/stitch/capturas/imp-04-firmas.png (móvil 390, oscuro) · Huella: 3370b50dc5d0
Revisor: subagente independiente
Fecha: 2026-11-20 09:40

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Tres tarjetas por rol | Responsable, Supervisado por, Cliente | igual (`x-section` por prefijo del campo) | igual |
| Una abierta a la vez | sí | acordeón; un error abre su tarjeta | igual |
| Tarjeta abierta | borde izquierdo de acento, rótulo del rol, chevron | igual | igual |
| Nombre, cargo, empresa, CIP de a dos | sí | igual, 44 px | igual |
| Tarjeta plegada | iniciales, rol, «nombre · cargo» | igual; «Sin datos» si está vacía | igual |
| Pastilla «SIN FIRMA» / «FIRMA EN PDF» | sí | no va | diferencia justificada: Lilachat no tiene dato de firma |
| «Firma digital registrada» y «Volver a firmar» | sí | no va | diferencia justificada: Lilachat no captura firmas en este formulario |
| «(opcional)» por rol | sí | una nota arriba: «Todo es opcional · toca una tarjeta para editar» | diferencia justificada: pedido de José 20/11 |
| Chip «De tu perfil» | sí | no va | diferencia justificada: no se sabe de dónde vino el valor |
| Nota al pie del CIP | sí | no va | diferencia justificada: el CIP no sale del perfil en Lilachat |
| Botón principal | «Listo» | «Listo», 52 px | igual |
| Lo guardado | mismos campos | mismos nombres y valores | igual |
