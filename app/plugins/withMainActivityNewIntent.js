const { withMainActivity } = require('expo/config-plugins');

/**
 * MainActivity keeps the newest intent as its own (B4 E2E, 25/10/2026).
 *
 * **Why it exists.** With `expo-updates` (APK 0.1.171) the app loads late on purpose
 * (`delayLoadApp`). When a notice is tapped with the process dead and the task alive,
 * Android relaunches MainActivity and hands the tap over through `onNewIntent` right
 * after `onCreate`, before that load ends, and Expo's `ReactActivityDelegateWrapper`
 * drops it (`if (!loadAppReady.isCompleted) return false`) without telling any
 * listener. `onCreate` only sees the task's old intent, so the tap opened nothing.
 * Keeping the intent here lets the `llamada-entrante` listener attend it in
 * `onResume`, which Expo does run once the app has loaded. The same path carries a
 * reminder's full screen and a call's «Contestar».
 *
 * `android/` is regenerated at every `apk build`, so this is a plugin and not an edit.
 */
const OVERRIDE = `
  /**
   * The newest intent becomes the activity's: Expo drops an onNewIntent that arrives
   * before the app loaded (expo-updates delays it), and onResume attends it from here.
   */
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
  }
`;

const OWN_OVERRIDE = /override fun onNewIntent\(intent: Intent\) \{\n {4}super\.onNewIntent\(intent\)\n {4}setIntent\(intent\)\n {2}\}/;
const ANY_OVERRIDE = /override fun onNewIntent\(/;
const INTENT_IMPORT = /^import android\.content\.Intent$/m;
const FIRST_ANDROID_IMPORT = /^import android\./m;

function addIntentImport(source) {
  if (INTENT_IMPORT.test(source)) return source;
  const at = source.search(FIRST_ANDROID_IMPORT);
  if (at === -1) throw new Error('withMainActivityNewIntent: MainActivity has no android import to place Intent next to');
  return `${source.slice(0, at)}import android.content.Intent\n${source.slice(at)}`;
}

/** The generated MainActivity with the override; the same text when it already has it. */
function addNewIntentOverride(source) {
  if (!/class MainActivity\b/.test(source)) throw new Error('withMainActivityNewIntent: this is not the expected MainActivity');
  if (OWN_OVERRIDE.test(source)) return source;
  // Someone else's onNewIntent: merging blindly could drop theirs or ours, so the build stops here.
  if (ANY_OVERRIDE.test(source)) throw new Error('withMainActivityNewIntent: MainActivity already overrides onNewIntent; merge setIntent by hand');
  const withImport = addIntentImport(source);
  const classEnd = withImport.lastIndexOf('}');
  return `${withImport.slice(0, classEnd).trimEnd()}\n${OVERRIDE}${withImport.slice(classEnd)}`;
}

function withMainActivityNewIntent(config) {
  return withMainActivity(config, (activityConfig) => {
    if (activityConfig.modResults.language !== 'kt') {
      throw new Error('withMainActivityNewIntent: expected a Kotlin MainActivity');
    }
    activityConfig.modResults.contents = addNewIntentOverride(activityConfig.modResults.contents);
    return activityConfig;
  });
}

module.exports = withMainActivityNewIntent;
module.exports.addNewIntentOverride = addNewIntentOverride;
