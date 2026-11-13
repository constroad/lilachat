import { describe, expect, it } from 'vitest';
import plugin from './withCallPictureInPicture';

const { addUserLeaveHint, allowPictureInPicture } = plugin;

const GENERATED = `package com.lilachat.app

import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
  override fun getMainComponentName(): String = "main"
}
`;

// José 13/11: «al cambiar de ventana se cuelga la videollamada; debería minimizarse como WhatsApp».
describe('withCallPictureInPicture', () => {
  it('leaving the app asks Pip, inside the class', () => {
    const patched = addUserLeaveHint(GENERATED);
    expect(patched).toMatch(/override fun onUserLeaveHint\(\) \{\n {4}super\.onUserLeaveHint\(\)\n {4}expo\.modules\.llamadaentrante\.Pip\.enterIfArmed\(this\)\n {2}\}/);
    expect(patched.trimEnd().endsWith('}')).toBe(true);
  });

  it('a second run changes nothing; someone else\'s override stops the build', () => {
    const once = addUserLeaveHint(GENERATED);
    expect(addUserLeaveHint(once)).toBe(once);
    const theirs = GENERATED.replace('override fun getMainComponentName', 'override fun onUserLeaveHint() {}\n  override fun getMainComponentName');
    expect(() => addUserLeaveHint(theirs)).toThrow(/merge Pip by hand/);
  });

  it('the main activity supports the small window; a manifest without it stops the build', () => {
    const manifest = { manifest: { application: [{ activity: [{ $: { 'android:name': '.MainActivity' } }] }] } };
    expect(allowPictureInPicture(manifest).manifest.application[0].activity[0].$['android:supportsPictureInPicture']).toBe('true');
    expect(() => allowPictureInPicture({ manifest: { application: [{ activity: [] }] } })).toThrow(/no \.MainActivity/);
  });
});
