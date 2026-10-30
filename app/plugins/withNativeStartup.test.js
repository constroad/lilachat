import { describe, expect, it } from 'vitest';
import plugin from './withNativeStartup';

const { addNativeStartup } = plugin;

/** The shape `expo prebuild` writes for SDK 54 (the 0.1.174 APK), trimmed. */
const GENERATED = `package com.lilachat.app

import android.app.Application
import android.content.res.Configuration

import expo.modules.ApplicationLifecycleDispatcher

class MainApplication : Application(), ReactApplication {
  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
  }
}
`;

/**
 * APK 0.1.175: before Expo's modules start, the app turns on react-native-webrtc's
 * mediaProjection service (screen sharing) and empties an oversized expo-updates log,
 * whose purge at launch reads every line into memory (lilachat 0.1.174, 30/10/2026).
 */
describe('addNativeStartup', () => {
  it('calls the startup right after super.onCreate, before Expo starts its modules', () => {
    const patched = addNativeStartup(GENERATED);
    const call = patched.indexOf('prepareNativeStartup()\n');
    expect(call).toBeGreaterThan(patched.indexOf('super.onCreate()'));
    expect(call).toBeLessThan(patched.indexOf('ApplicationLifecycleDispatcher.onApplicationCreate(this)'));
  });

  it('turns on the media projection service and trims the updates log over 1 MB without reading it', () => {
    const patched = addNativeStartup(GENERATED);
    expect(patched).toContain('import com.oney.WebRTCModule.WebRTCModuleOptions');
    expect(patched).toContain('WebRTCModuleOptions.getInstance().enableMediaProjectionService = true');
    expect(patched).toContain('"dev.expo.modules.core.logging.dev.expo.updates"');
    expect(patched).toMatch(/if \(log\.length\(\) > UPDATES_LOG_MAX_BYTES\) log\.writeText\(""\)/);
    expect(patched).toContain('UPDATES_LOG_MAX_BYTES = 1_000_000L');
  });

  it('is idempotent: a second prebuild pass leaves it as it was', () => {
    const once = addNativeStartup(GENERATED);
    expect(addNativeStartup(once)).toBe(once);
  });

  it('stops the build when MainApplication is not the expected one', () => {
    expect(() => addNativeStartup('class Other {}')).toThrow(/not the expected MainApplication/);
    expect(() => addNativeStartup(GENERATED.replace('    super.onCreate()\n', ''))).toThrow(/super\.onCreate/);
  });
});
