import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';
import {
  instalarCapturaGlobal,
  instalarDetectorDeTrabas,
  instalarEnvioAutomatico,
} from './src/diagnostico/diagnostico';

import * as Updates from 'expo-updates';
import { setAppBuild, setAppUpdateId } from './src/api/appBuild';
import { enviarReportesPendientes, reportarAlServidor } from './src/ui/reportarError';
import { emptyUpdatesLog } from './src/updates/updatesLogFile';
import { versionCodeActual } from './src/settings/versionApi';
import App from './App';
// Live location (pending 11): the background task must exist before any fix arrives, even with the app closed.
import './src/chat/location/liveLocationTask';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
// Diagnóstico a LilaStore (rn-app-loop §10): síncrono y antes de registrar,
// para que el primer error del arranque ya quede anotado.
// First of all (José, 30/10): a huge expo-updates log filled the heap at every launch; blank it before anything mounts.
if (Updates.isEnabled) emptyUpdatesLog();
instalarCapturaGlobal(reportarAlServidor);
instalarDetectorDeTrabas();
instalarEnvioAutomatico();
// Every request says its build: below LilaStore's minimum the server answers 426 (backlog 32).
setAppBuild(versionCodeActual());
// ...and which OTA update runs (`embedded` = the code inside the APK): a report tells the code from the installed build.
setAppUpdateId(Updates.updateId);
// A report the last run could not send (it closed, or had no signal) goes now.
void enviarReportesPendientes();

// El panel de emojis (`rn-emoji-keyboard`) usa `InteractionManager`, que RN
// deprecó: funciona igual y el aviso solo tapa la barra de escribir en desarrollo.
LogBox.ignoreLogs(['InteractionManager has been deprecated']);

registerRootComponent(App);
