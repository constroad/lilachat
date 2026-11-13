const { withAndroidManifest, withMainActivity } = require('expo/config-plugins');

/**
 * A video call shrinks to a small window when the app is left, as in WhatsApp (José 13/11: the
 * call hung up when he switched apps).
 *
 * The main activity declares `supportsPictureInPicture`, and its `onUserLeaveHint` (the Home button
 * or another app) asks `Pip` of the llamada-entrante module, which only enters while JS armed it
 * for an answered video call. Android 12+ also enters by itself (auto-enter in `Pip`).
 *
 * `android/` is regenerated at every `apk build`, so this is a plugin and not an edit.
 */
const OVERRIDE = `
  /** Leaving the app during an answered video call shrinks it to the small window (José 13/11). */
  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    expo.modules.llamadaentrante.Pip.enterIfArmed(this)
  }
`;

const OWN_OVERRIDE = /expo\.modules\.llamadaentrante\.Pip\.enterIfArmed\(this\)/;
const ANY_OVERRIDE = /override fun onUserLeaveHint\(/;

/** The generated MainActivity with the override; the same text when it already has it. */
function addUserLeaveHint(source) {
  if (!/class MainActivity\b/.test(source)) throw new Error('withCallPictureInPicture: this is not the expected MainActivity');
  if (OWN_OVERRIDE.test(source)) return source;
  // Someone else's onUserLeaveHint: merging blindly could drop theirs or ours, so the build stops here.
  if (ANY_OVERRIDE.test(source)) throw new Error('withCallPictureInPicture: MainActivity already overrides onUserLeaveHint; merge Pip by hand');
  const classEnd = source.lastIndexOf('}');
  return `${source.slice(0, classEnd).trimEnd()}\n${OVERRIDE}${source.slice(classEnd)}`;
}

/** The main activity of the manifest says it supports the small window. */
function allowPictureInPicture(manifest) {
  const activities = manifest.manifest.application?.[0]?.activity ?? [];
  const main = activities.find((activity) => activity.$['android:name'] === '.MainActivity');
  if (!main) throw new Error('withCallPictureInPicture: the manifest has no .MainActivity');
  main.$['android:supportsPictureInPicture'] = 'true';
  return manifest;
}

function withCallPictureInPicture(config) {
  const withManifest = withAndroidManifest(config, (manifestConfig) => {
    manifestConfig.modResults = allowPictureInPicture(manifestConfig.modResults);
    return manifestConfig;
  });
  return withMainActivity(withManifest, (activityConfig) => {
    if (activityConfig.modResults.language !== 'kt') throw new Error('withCallPictureInPicture: expected a Kotlin MainActivity');
    activityConfig.modResults.contents = addUserLeaveHint(activityConfig.modResults.contents);
    return activityConfig;
  });
}

module.exports = withCallPictureInPicture;
module.exports.addUserLeaveHint = addUserLeaveHint;
module.exports.allowPictureInPicture = allowPictureInPicture;
