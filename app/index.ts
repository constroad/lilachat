import { registerRootComponent } from 'expo';
import {
  instalarCapturaGlobal,
  instalarDetectorDeTrabas,
  instalarEnvioAutomatico,
} from './src/diagnostico/diagnostico';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
// Diagnóstico a LilaStore (rn-app-loop §10): síncrono y antes de registrar,
// para que el primer error del arranque ya quede anotado.
instalarCapturaGlobal();
instalarDetectorDeTrabas();
instalarEnvioAutomatico();

registerRootComponent(App);
