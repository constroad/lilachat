const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Dejar que Lilachat pueda ABRIR LilaStore.
 *
 * **Por qué existe (30/08/2026).** La banda de «hay versión nueva» ofrece
 * actualizar desde la tienda, y en el teléfono de José el botón terminaba en el
 * navegador bajando un APK suelto («Download anyway») en vez de abrir LilaStore.
 * No era el `Linking` ni el enlace: desde Android 11 una app **no ve** a las
 * demás salvo que declare cuáles, y sin eso `openURL('lilastore://')` no
 * encuentra a nadie, tira y cae al respaldo. El respaldo funcionaba; el camino
 * bueno no existía.
 *
 * Se declara lo MÍNIMO: el esquema de la tienda y su paquete. NO
 * `QUERY_ALL_PACKAGES` — ese es el permiso que, junto con
 * `REQUEST_INSTALL_PACKAGES`, hizo que Play Protect bloqueara a LilaStore. Ver
 * todas las apps del teléfono es exactamente lo que Lilachat no necesita ni
 * quiere pedir.
 *
 * Si la tienda no está instalada esto no cambia nada: la consulta no encuentra
 * el paquete y la banda sigue cayendo al navegador, que es el camino correcto
 * para quien instaló la app suelta.
 */
const PAQUETE_TIENDA = 'com.constroad.lilastore';
const ESQUEMA_TIENDA = 'lilastore';

module.exports = function withConsultaDeLilaStore(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // `queries` es hermano de `application`, no hijo: puesto adentro, Android lo
    // ignora en silencio y la consulta sigue fallando sin decir por qué.
    manifest.queries = manifest.queries ?? [{}];
    const queries = manifest.queries[0];

    // El paquete, para poder preguntarle a Android si la tienda está.
    const paquetes = queries.package ?? [];
    if (!paquetes.some((uno) => uno?.$?.['android:name'] === PAQUETE_TIENDA)) {
      paquetes.push({ $: { 'android:name': PAQUETE_TIENDA } });
    }
    queries.package = paquetes;

    // Y el esquema, que es lo que resuelve `Linking.openURL('lilastore://')`.
    // Expo ya declara acá el intent de `https`; este se SUMA, no lo reemplaza.
    const intents = queries.intent ?? [];
    const yaEsta = intents.some((uno) =>
      (uno?.data ?? []).some((dato) => dato?.$?.['android:scheme'] === ESQUEMA_TIENDA)
    );
    if (!yaEsta) {
      intents.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        category: [{ $: { 'android:name': 'android.intent.category.BROWSABLE' } }],
        data: [{ $: { 'android:scheme': ESQUEMA_TIENDA } }],
      });
    }
    queries.intent = intents;

    return cfg;
  });
};
