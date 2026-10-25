const { withGradleProperties } = require('expo/config-plugins');

/**
 * More Metaspace for the Gradle and Kotlin daemons.
 *
 * `expo prebuild` writes `org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m`, and `android/` is
 * regenerated at every `apk build`, so editing that file by hand is lost. With `expo-updates` (0.1.171)
 * the KSP step of its Kotlin module exhausted the 512 MB (`OutOfMemoryError: Metaspace`, 25/10/2026).
 * The heap stays as it was: only the class metadata area grows.
 */
const GRADLE_JVM_ARGS = '-Xmx2048m -XX:MaxMetaspaceSize=1024m';
const KOTLIN_DAEMON_JVM_ARGS = '-Xmx2048m -XX:MaxMetaspaceSize=1024m';

function setProperty(properties, key, value) {
  const existing = properties.find((item) => item.type === 'property' && item.key === key);
  if (existing) existing.value = value;
  else properties.push({ type: 'property', key, value });
}

module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (gradleConfig) => {
    setProperty(gradleConfig.modResults, 'org.gradle.jvmargs', GRADLE_JVM_ARGS);
    setProperty(gradleConfig.modResults, 'kotlin.daemon.jvmargs', KOTLIN_DAEMON_JVM_ARGS);
    return gradleConfig;
  });
};
