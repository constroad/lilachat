const { withMainApplication } = require('expo/config-plugins');

/**
 * What MainApplication does before Expo's modules start (APK 0.1.175).
 *
 * **Screen sharing.** react-native-webrtc ships its own `mediaProjection` foreground
 * service (Android 10+ asks for one while capturing the screen), but it only starts it
 * when `enableMediaProjectionService` is on, and that has to be set before the module loads.
 *
 * **The expo-updates log (lilachat 0.1.174, 30/10/2026).** At launch expo-updates purges
 * its log by reading every line into memory. Once the log outgrew the heap, the purge
 * always failed, the log never shrank, and the app closed on opening. The JS empties it at
 * every start (`app/src/updates/updatesLogFile.ts`), but an app that dies before its JS
 * runs never gets there: here it is emptied, without reading it, before expo-updates starts.
 *
 * `android/` is regenerated at every `apk build`, so this is a plugin and not an edit.
 */
const CALL = '    prepareNativeStartup()\n';
const SUPER_ON_CREATE = /( {4}super\.onCreate\(\)\n)/;
const IMPORT = 'import com.oney.WebRTCModule.WebRTCModuleOptions';
const BODY = `
  /** Screen sharing's service on, and an oversized expo-updates log emptied before expo-updates reads it (APK 0.1.175). */
  private fun prepareNativeStartup() {
    WebRTCModuleOptions.getInstance().enableMediaProjectionService = true
    try {
      val log = java.io.File(filesDir, "dev.expo.modules.core.logging.dev.expo.updates")
      if (log.length() > UPDATES_LOG_MAX_BYTES) log.writeText("")
    } catch (error: Exception) {
      android.util.Log.w("lilachat", "could not trim the updates log", error)
    }
  }

  companion object {
    private const val UPDATES_LOG_MAX_BYTES = 1_000_000L
  }
`;

function addImport(source) {
  if (source.includes(IMPORT)) return source;
  const at = source.search(/^import expo\./m);
  if (at === -1) throw new Error('withNativeStartup: MainApplication has no expo import to place WebRTCModuleOptions next to');
  return `${source.slice(0, at)}${IMPORT}\n${source.slice(at)}`;
}

/** The generated MainApplication with the startup; the same text when it already has it. */
function addNativeStartup(source) {
  if (!/class MainApplication\b/.test(source)) throw new Error('withNativeStartup: this is not the expected MainApplication');
  if (source.includes('private fun prepareNativeStartup()')) return source;
  if (!SUPER_ON_CREATE.test(source)) throw new Error('withNativeStartup: onCreate has no super.onCreate() to run after');
  const withCall = addImport(source).replace(SUPER_ON_CREATE, `$1${CALL}`);
  const classEnd = withCall.lastIndexOf('}');
  return `${withCall.slice(0, classEnd).trimEnd()}\n${BODY}${withCall.slice(classEnd)}`;
}

function withNativeStartup(config) {
  return withMainApplication(config, (appConfig) => {
    if (appConfig.modResults.language !== 'kt') throw new Error('withNativeStartup: expected a Kotlin MainApplication');
    appConfig.modResults.contents = addNativeStartup(appConfig.modResults.contents);
    return appConfig;
  });
}

module.exports = withNativeStartup;
module.exports.addNativeStartup = addNativeStartup;
