import { describe, expect, it } from 'vitest';
import plugin from './withMainActivityNewIntent';

const { addNewIntentOverride } = plugin;

/** The shape `expo prebuild` writes (SDK of the 0.1.171 APK), trimmed. */
const GENERATED = `package com.lilachat.app

import android.os.Build
import android.os.Bundle

import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
  }

  override fun getMainComponentName(): String = "main"
}
`;

/**
 * B4 E2E (25/10/2026): a notice tapped with the process dead and the task alive opened
 * nothing. Expo drops an `onNewIntent` that arrives before the app loaded (expo-updates
 * delays it on purpose), so MainActivity keeps the newest intent for `onResume`.
 */
describe('addNewIntentOverride', () => {
  it('adds an onNewIntent that calls super and keeps the intent', () => {
    const patched = addNewIntentOverride(GENERATED);
    expect(patched).toMatch(/override fun onNewIntent\(intent: Intent\) \{\n {4}super\.onNewIntent\(intent\)\n {4}setIntent\(intent\)\n {2}\}/);
  });

  it('places it inside the class, before its closing brace', () => {
    const patched = addNewIntentOverride(GENERATED);
    expect(patched.trimEnd().endsWith('}')).toBe(true);
    expect(patched.indexOf('override fun onNewIntent')).toBeGreaterThan(patched.indexOf('class MainActivity'));
    expect(patched.indexOf('override fun onNewIntent')).toBeGreaterThan(patched.indexOf('getMainComponentName'));
  });

  it('imports Intent next to the other android imports', () => {
    const patched = addNewIntentOverride(GENERATED);
    expect(patched).toContain('import android.content.Intent\nimport android.os.Build');
  });

  it('does not import Intent twice when it is already there', () => {
    const withImport = GENERATED.replace('import android.os.Build', 'import android.content.Intent\nimport android.os.Build');
    const patched = addNewIntentOverride(withImport);
    expect(patched.match(/import android\.content\.Intent/g)).toHaveLength(1);
  });

  it('is idempotent: a second prebuild pass changes nothing', () => {
    const once = addNewIntentOverride(GENERATED);
    expect(addNewIntentOverride(once)).toBe(once);
  });

  it('leaves alone a MainActivity that already has its own onNewIntent', () => {
    const own = GENERATED.replace('  override fun getMainComponentName', '  override fun onNewIntent(intent: Intent) { super.onNewIntent(intent) }\n\n  override fun getMainComponentName');
    expect(() => addNewIntentOverride(own)).toThrow(/onNewIntent/);
  });

  it('refuses a file that is not the expected MainActivity', () => {
    expect(() => addNewIntentOverride('package x\n\nclass Other {}\n')).toThrow(/MainActivity/);
  });
});
