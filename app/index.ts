import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';
import {
  instalarCapturaGlobal,
  instalarDetectorDeTrabas,
  instalarEnvioAutomatico,
} from './src/diagnostico/diagnostico';

import { setAppBuild } from './src/api/appBuild';
import { versionCodeActual } from './src/settings/versionApi';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
// Diagnóstico a LilaStore (rn-app-loop §10): síncrono y antes de registrar,
// para que el primer error del arranque ya quede anotado.
instalarCapturaGlobal();
instalarDetectorDeTrabas();
instalarEnvioAutomatico();
// Every request says its build: below LilaStore's minimum the server answers 426 (backlog 32).
setAppBuild(versionCodeActual());

// El panel de emojis (`rn-emoji-keyboard`) usa `InteractionManager`, que RN
// deprecó: funciona igual y el aviso solo tapa la barra de escribir en desarrollo.
LogBox.ignoreLogs(['InteractionManager has been deprecated']);

registerRootComponent(App);
