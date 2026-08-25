const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Hace que el build de RELEASE use la keystore de producción.
 *
 * **Existe por una trampa que no se nota hasta que es tarde:** `android/` se
 * regenera con `expo prebuild`, y la plantilla deja
 * `release { signingConfig signingConfigs.debug }`. O sea que declarar la
 * keystore en `gradle.properties` **no sirve de nada** por sí solo — el APK sale
 * firmado con la de debug, se instala perfecto, y el problema aparece el día del
 * primer release de verdad: Android rechaza la actualización y hay que
 * desinstalar en todos los teléfonos.
 *
 * Las credenciales NO viven acá ni en el repo: se leen de
 * `~/.gradle/gradle.properties`. Si no están declaradas, el bloque no se agrega
 * y el build sigue usando la de debug — que es lo correcto para desarrollo.
 *
 * Es el mismo plugin que LilaStore y Timón, con el prefijo cambiado.
 */
const BLOQUE = `
        release {
            if (project.hasProperty('LILACHAT_UPLOAD_STORE_FILE')) {
                storeFile file(LILACHAT_UPLOAD_STORE_FILE)
                storePassword LILACHAT_UPLOAD_STORE_PASSWORD
                keyAlias LILACHAT_UPLOAD_KEY_ALIAS
                keyPassword LILACHAT_UPLOAD_KEY_PASSWORD
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    let contents = gradleConfig.modResults.contents;

    // 1) Declarar el signingConfig `release` junto al `debug` de la plantilla.
    if (!contents.includes('LILACHAT_UPLOAD_STORE_FILE')) {
      contents = contents.replace(/(signingConfigs\s*\{)/, `$1${BLOQUE}`);
    }

    // 2) Que el buildType release lo USE. Solo si la keystore está declarada:
    //    si no, se deja debug para que se pueda compilar sin credenciales.
    contents = contents.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig\s+)signingConfigs\.debug/,
      `$1project.hasProperty('LILACHAT_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`
    );

    gradleConfig.modResults.contents = contents;
    return gradleConfig;
  });
};
