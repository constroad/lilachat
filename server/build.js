import { build } from 'esbuild';

/**
 * El bundle del server.
 *
 * **Existe por cómo despliega Torre**, no por gusto: Torre MUEVE `node_modules`
 * a un almacén compartido y lo enlaza de vuelta a la release. Con npm
 * workspaces, `node_modules/@lilachat/shared` es un symlink relativo a
 * `../../shared`, y desde el almacén ese camino no lleva a ningún lado — queda
 * colgado. El síntoma en el deploy fue «Cannot find module '@lilachat/shared'»
 * en diez archivos a la vez (24/08/2026, primer deploy).
 *
 * La solución no es pelear con el almacén: es que la release NO dependa del
 * enlace. `shared` se compila ADENTRO del bundle —vía el alias de abajo— y el
 * `dist` resultante no importa `@lilachat/shared` en ningún lado.
 *
 * **Todo lo demás queda externo** (`packages: 'external'`). Empaquetar express,
 * mongoose o socket.io no arregla nada y trae los problemas de siempre con sus
 * `require` dinámicos; esas sí viven en `node_modules`, que es exactamente lo
 * que el almacén de Torre sirve bien.
 */
await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: 'dist/index.js',
  packages: 'external',
  // El alias convierte el import de paquete en uno relativo, y por eso SÍ entra
  // al bundle pese a `packages: 'external'`.
  alias: { '@lilachat/shared': '../shared/src/index.ts' },
  // SIN banner de `createRequire`: `app.ts` ya lo declara para leer su
  // package.json, y el banner lo declaraba una segunda vez — «Identifier
  // 'createRequire' has already been declared», que mata el arranque.
  logLevel: 'info',
});
