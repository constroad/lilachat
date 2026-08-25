const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// `shared/` vive FUERA de app/: sin esto Metro no lo observa y un cambio en un
// motor puro no recarga. La app queda igual fuera de los npm workspaces (su
// node_modules es propio) — esto es solo visibilidad de archivos.
config.watchFolders = [path.resolve(workspaceRoot, 'shared')];

/**
 * Dónde busca Metro los `node_modules` de un import que sale de `shared/`.
 *
 * Un módulo importado DESDE `shared/src` se resuelve relativo a `shared/`, y sus
 * dependencias están hoisteadas en el `node_modules` de la RAÍZ del monorepo —
 * que Metro no observa. El síntoma fue «Unable to resolve @noble/ciphers/aes.js»
 * con el paquete instalado y visible desde Node: instalarlo también en `app/`
 * NO lo arregla, porque el import no nace en `app/`.
 */
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.watchFolders.push(path.resolve(workspaceRoot, 'node_modules'));
// Apunta al FUENTE (src), no a `shared/dist`: el dist lo produce el build del
// server y la app bundlearía código viejo sin ninguna señal de que quedó atrás.
config.resolver.extraNodeModules = {
  '@lilachat/shared': path.resolve(workspaceRoot, 'shared/src'),
};

/**
 * `shared/` está escrito en ESM de Node (`import './x.js'` apuntando a un
 * `.ts`) porque el server lo compila con NodeNext. Metro no entiende ese
 * mapeo y falla con «Unable to resolve ./tokens.js».
 *
 * Se resuelve acá y no cambiando los imports de shared: quitarles la extensión
 * rompería al server en producción, que es donde de verdad duele.
 */
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const fromShared = context.originModulePath?.includes(`${path.sep}shared${path.sep}src`);
  if (fromShared && moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    return context.resolveRequest(context, moduleName.slice(0, -3), platform);
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
