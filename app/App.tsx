// PRIMERO: enchufa `crypto.getRandomValues` en Hermes, antes de que algo cifre.
import './src/crypto/polyfill';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { FunScreen } from './src/chat/FunScreen';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { ErrorBoundary } from './src/ui/ErrorBoundary';
import './global.css';
import { listChats, olvidarPushDeEsteTelefono, refreshSession } from './src/api/client';
import { olvidarCola } from './src/chat/outboxStore';
import { olvidarArchivos } from './src/chat/colaDeArchivos';
import { olvidarBorradores } from './src/chat/borradores';
import {
  clearCredential,
  loadCredential,
  saveCredential,
  type Credential,
} from './src/auth/credentialStore';
import { PhoneScreen } from './src/onboarding/PhoneScreen';
import { OtpScreen } from './src/onboarding/OtpScreen';
import { NavegacionDeSesion } from './src/ui/NavegacionDeSesion';
import { conCredencialNueva, entraSinEsperar } from './src/auth/arranque';
import { connectSocket, disconnectSocket, pauseSocket, resumeSocket } from './src/chat/socketClient';
import { leerChatsGuardados, olvidarChats } from './src/chat/chatsGuardados';
import { avisarMensaje } from './src/chat/avisoLocal';
import { sonarPorMensaje } from './src/chat/sonarPorMensaje';
import { guardarMensajes, olvidarMensajes } from './src/chat/mensajesGuardados';
import { hidratarTodo } from './src/chat/hidratador';
import { desregistrarTareaDeFondo, registrarTareaDeFondo } from './src/respaldo/tareaDeFondo';
import { leerPassphrase, olvidarPassphrase } from './src/respaldo/passphraseDeRespaldo';
import { olvidarLibro } from './src/respaldo/libroDeRespaldos';
import { olvidarEstadoDeRespaldo } from './src/respaldo/estadoDeRespaldo';
import { marcarOfrecido, respaldoAOfrecer, type RespaldoEnLaMini } from './src/respaldo/restaurar';
import { RestaurarRespaldo } from './src/settings/RestaurarRespaldo';
import type { ChatMessage } from './src/chat/useChat';
import { decidirServicio } from './src/chat/servicioDeConexion';
import { agendaPorTelefono, olvidarAgenda, precargarAgenda } from './src/contacts/agendaEnMemoria';
import { nombreDeContacto } from '@lilachat/shared';
import { ProveedorTema, useColores, useTema } from './src/ui/tema';
import {
  guardarSegundoPlano,
  leerSegundoPlano,
  SEGUNDO_PLANO_POR_DEFECTO,
} from './src/settings/preferencias';
import { detenerServicio, iniciarServicio } from './modules/servicio-socket/src';
import type { ChatSummary } from './src/api/client';
import { ANCHO_MAXIMO_DE_FORMULARIO } from './src/ui/disposicion';

/**
 * Boot (F1): credencial guardada → refrescar sesión → adentro.
 *
 * La regla que ordena el arranque: **la ausencia de respuesta NO revoca**.
 * Solo un 401 REAL del server borra la credencial; un 503 o falta de red dejan
 * pasar con la sesión anterior — quedarse sin chat porque la red está mal es
 * exactamente lo que esta app existe para evitar.
 */
/**
 * Cuánto espera el hidratador (F12.0b) después de ganar la sesión: la lista de
 * chats y la agenda cargan primero; completar el historial es trabajo de fondo.
 */
const ESPERA_ANTES_DE_HIDRATAR_MS = 4_000;
/** La entrada en tablet: centrada, con ancho de formulario (FL10). */
const FORMULARIO_CENTRADO = { flex: 1, width: '100%' as const, maxWidth: ANCHO_MAXIMO_DE_FORMULARIO, alignSelf: 'center' as const };

/**
 * Los chats que el hidratador recorre: la lista guardada, y si todavía no hay
 * (instalación nueva, o un teléfono lento que no la cargó en 4 s), la del
 * server. Con la guardada vacía el hidratador no hacía nada en toda la sesión.
 */
async function chatsParaHidratar(jwt: string): Promise<ChatSummary[]> {
  const guardados = await leerChatsGuardados();
  if (guardados && guardados.length > 0) return guardados;
  const delServer = await listChats(jwt);
  return delServer.ok ? delServer.data.chats : [];
}

type Boot =
  | { phase: 'loading' }
  | { phase: 'email' }
  | { phase: 'otp'; phone: string }
  | { phase: 'home'; credential: Credential };

/**
 * La raíz: solo monta los proveedores.
 *
 * `Contenido` se separó al agregar el modo oscuro (27/08/2026) por una razón
 * mecánica — `useColores()` necesita el proveedor POR ENCIMA, y un componente no
 * puede consumir un contexto que él mismo monta. Sin el corte, el `StatusBar` y
 * el indicador de carga de esta pantalla se quedaban en claro para siempre.
 */
export default function App() {
  return (
    // El proveedor es lo que hace que `useSafeAreaInsets` devuelva algo distinto
    // de cero. Sin él, todas las pantallas creen que no hay barras y el botón
    // del pie termina debajo de la de Android.
    // Gestos y teclado en el hilo nativo (FL2b): sin estos proveedores el
    // deslizar-para-responder y el teclado sincronizado no funcionan.
    <GestureHandlerRootView style={{ flex: 1 }}>
    <KeyboardProvider>
    <SafeAreaProvider>
      <ProveedorTema>
        {/* Envuelve TODO: un error de render dejaba la pantalla en blanco sin
            explicación para nadie, ni siquiera para nosotros. */}
        <ErrorBoundary pantalla="app">
          <FunScreen>
            <Contenido />
          </FunScreen>
        </ErrorBoundary>
      </ProveedorTema>
    </SafeAreaProvider>
    </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function Contenido() {
  const { oscuro } = useTema();
  const colores = useColores();
  const [boot, setBoot] = useState<Boot>({ phase: 'loading' });

  /**
   * El servicio en primer plano que sostiene el socket.
   *
   * Con la app atrás, Android suspende el proceso y el socket se cae: los
   * mensajes entran recién al volver a abrir. WhatsApp lo evita con FCM, que es
   * un canal del sistema; sin Firebase, la única forma de que un socket propio
   * sobreviva es este servicio — y su precio es la notificación permanente que
   * Android exige a cambio.
   *
   * Se enciende con la sesión, no al pasar a segundo plano: esperar deja una
   * ventana en la transición —el momento más frágil— donde el proceso puede
   * morir antes de que el servicio arranque.
   */
  const haySesion = boot.phase === 'home';
  /**
   * El chat que está arriba del stack (FL1). Antes era una fase del arranque;
   * con navegación nativa la lista sigue montada debajo y esto lo dice el
   * navegador.
   */
  const [chatAbierto, setChatAbierto] = useState<string | null>(null);

  /**
   * `null` mientras se lee la preferencia del disco.
   *
   * Se espera a saberla antes de decidir: arrancar el servicio y apagarlo medio
   * segundo después publica la notificación permanente y la borra, y ese
   * parpadeo en la bandeja es justo lo que se está tratando de sacar.
   */
  const [segundoPlano, setSegundoPlano] = useState<boolean | null>(null);

  useEffect(() => {
    void leerSegundoPlano().then(setSegundoPlano);
  }, []);

  /**
   * La agenda se lee APENAS hay sesión, no al tocar el lápiz.
   *
   * Reclamo de José (27/08/2026): «al lápiz ya me debería aparecer precargado
   * los contactos y no recién allí ponerme a cargar». Leerlos acá es leerlos
   * mientras mira la lista de chats — un rato en el que no está esperando nada.
   */
  useEffect(() => {
    if (haySesion) void precargarAgenda();
  }, [haySesion]);

  /**
   * El socket sigue el foreground de la app, salvo con «Conexión permanente».
   *
   * En background y sin servicio en primer plano, se PAUSA el socket: así el
   * server marca al usuario offline y el próximo mensaje llega por push (FCM).
   * Sin esto, la app en background quedaba «en línea» y no se notificaba nada
   * (José, 30/08/2026). Con «Conexión permanente» encendida se queda conectado
   * a propósito, para recibir por socket sin depender del push.
   */
  useEffect(() => {
    if (!haySesion) return;
    const permanente = segundoPlano === true;
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') resumeSocket();
      else if (!permanente) pauseSocket();
    });
    // Y aplicar el estado ACTUAL al montar/cambiar la preferencia.
    if (AppState.currentState === 'active') resumeSocket();
    else if (!permanente) pauseSocket();
    return () => sub.remove();
  }, [haySesion, segundoPlano]);

  useEffect(() => {
    if (segundoPlano === null) return;
    const decision = decidirServicio({
      haySesion,
      estado: AppState.currentState,
      enSegundoPlano: segundoPlano,
    });
    if (decision === 'encender') iniciarServicio();
    else detenerServicio();
  }, [haySesion, segundoPlano]);

  /**
   * El TONO de un mensaje mientras estás DENTRO de un chat (paridad WhatsApp).
   *
   * El aviso de la lista lo dispara `TabsShell`, pero esa pantalla se desmonta al
   * abrir un chat, así que sin esto no sonaba nada estando adentro de uno. Este
   * listener vive acá —siempre montado— y actúa SOLO con un chat abierto, así no
   * se pisa con el de la lista (fases excluyentes, cero doble aviso). Omite el
   * chat que estás mirando: `sonarPorMensaje`. El nombre sale del cache guardado;
   * la burbuja va sin banner (la suprime el handler), así solo suena/vibra.
   */
  useEffect(() => {
    if (boot.phase !== 'home' || !chatAbierto) return;
    const yo = boot.credential.userId;
    const abierto = chatAbierto;
    const socket = connectSocket(boot.credential.jwt);
    const onNew = async (mensaje: {
      chatId: string;
      senderId: string;
      kind: 'text' | 'image' | 'video' | 'audio' | 'file';
      body?: string;
      envelope?: unknown;
    }) => {
      if (!sonarPorMensaje({ senderId: mensaje.senderId, chatId: mensaje.chatId, yo, chatAbierto: abierto }))
        return;
      const cache = (await leerChatsGuardados()) ?? [];
      const chat = cache.find((uno) => uno.id === mensaje.chatId);
      await avisarMensaje({
        chatId: mensaje.chatId,
        chatName:
          nombreDeContacto({
            delServidor: chat?.name,
            telefono: chat?.phone,
            agenda: agendaPorTelefono(),
          }) || 'Lilachat',
        senderName: null,
        esGrupo: chat?.kind === 'group',
        kind: mensaje.kind,
        body: mensaje.body ?? '',
        cifrado: Boolean(mensaje.envelope),
      });
    };
    socket.on('msg.new', onNew);
    // Named off: NO `socket.off('msg.new')` a secas — borraría también el de
    // `useChat` que muestra los mensajes del chat abierto.
    return () => {
      socket.off('msg.new', onNew);
    };
  }, [boot, chatAbierto]);

  /**
   * El almacén del teléfono se llena SIEMPRE, no solo con el chat abierto (F12.0).
   *
   * Un mensaje de un chat cerrado antes solo existía en el server hasta que se
   * abría ese chat. Con el historial viviendo en el teléfono —de ahí sale el
   * respaldo—, se guarda al llegar, esté abierto o no. El chat ABIERTO ya lo
   * guarda `useChat` por el mismo camino: se saltea para no escribir dos veces.
   */
  useEffect(() => {
    if (boot.phase !== 'home') return;
    const abierto = chatAbierto;
    const socket = connectSocket(boot.credential.jwt);
    const guardar = (mensaje: ChatMessage) => {
      if (mensaje.chatId === abierto) return;
      void guardarMensajes(mensaje.chatId, [mensaje]);
    };
    socket.on('msg.new', guardar);
    return () => {
      socket.off('msg.new', guardar);
    };
  }, [boot, chatAbierto]);

  /**
   * Y lo que falta se pide (F12.0b): al arrancar con sesión, el hidratador
   * completa cada chat hasta su primer mensaje, del más nuevo al más viejo, con
   * los `lastSeq` de la lista guardada. Corre una vez por sesión y de a un chat;
   * si el historial ya está entero, no gasta ni un pedido.
   */
  useEffect(() => {
    if (boot.phase !== 'home') return;
    let vigente = true;
    const jwt = boot.credential.jwt;
    // Un respiro para que la lista de chats cargue primero: la pantalla manda.
    const timer = setTimeout(() => {
      void (async () => {
        const chats = await chatsParaHidratar(jwt);
        if (vigente) await hidratarTodo(chats, jwt, () => vigente);
      })();
    }, ESPERA_ANTES_DE_HIDRATAR_MS);
    return () => {
      vigente = false;
      clearTimeout(timer);
    };
    // Solo al ganar la sesión: cambiar de pantalla no relanza la hidratación.
  }, [haySesion]);

  /**
   * Restaurar en un teléfono nuevo (F12.2): con sesión y el almacén vacío, se
   * pregunta a la mini si hay un respaldo de este número y se ofrece UNA vez.
   * Con historial en el teléfono no se ofrece sola (Ajustes → Respaldo).
   */
  const [oferta, setOferta] = useState<RespaldoEnLaMini | null>(null);
  useEffect(() => {
    if (boot.phase !== 'home') return;
    let vigente = true;
    void respaldoAOfrecer(boot.credential.jwt).then((respaldo) => {
      if (vigente && respaldo) setOferta(respaldo);
    });
    return () => {
      vigente = false;
    };
    // Solo al ganar la sesión, no en cada cambio de pantalla.
  }, [haySesion]);

  /**
   * El respaldo de fondo (F12.1) se registra con la sesión, solo si ya hay
   * passphrase: sin ella la tarea no tendría qué hacer y despertaría el
   * teléfono cada hora para nada. Al crearla, la pantalla lo registra ella.
   */
  useEffect(() => {
    if (!haySesion) return;
    void leerPassphrase().then((passphrase) => {
      if (passphrase) void registrarTareaDeFondo();
    });
  }, [haySesion]);

  const start = useCallback(async () => {
    const stored = await loadCredential();
    if (!stored) {
      setBoot({ phase: 'email' });
      return;
    }
    // Se entra YA con lo guardado: la lista pinta desde el disco y el refresh
    // concilia por detrás. Antes se esperaba al server —hasta 15 s con mala
    // señal— con un spinner en pantalla.
    const sinEsperar = entraSinEsperar(stored);
    if (sinEsperar) setBoot({ phase: 'home', credential: stored });

    const session = await refreshSession({
      deviceId: stored.deviceId,
      deviceSecret: stored.deviceSecret,
    });
    if (session.ok) {
      // El refresh también REPARA: una credencial guardada por una versión
      // vieja puede no tener `userId`, y sin él la pantalla no distingue los
      // mensajes propios de los ajenos — se veían todos como recibidos.
      const refreshed = {
        ...stored,
        jwt: session.data.jwt,
        ...(session.data.user
          ? { userId: session.data.user.id, name: session.data.user.name, avatarUrl: session.data.user.avatarUrl ?? null }
          : {}),
      };
      await saveCredential(refreshed);
      if (sinEsperar) setBoot((actual) => conCredencialNueva(actual, refreshed));
      else setBoot({ phase: 'home', credential: refreshed });
      return;
    }
    if (session.status === 401) {
      // Revocado de verdad: se vuelve al alta, sin llaves que no abren.
      // La caché de chats se borra con la credencial: la lista de con quién
      // habla alguien no se hereda al siguiente que entre en este teléfono.
      disconnectSocket();
      await Promise.all([
        clearCredential(),
        olvidarChats(),
        olvidarMensajes(),
        olvidarBorradores(),
        olvidarPassphrase(),
        olvidarLibro(),
        olvidarEstadoDeRespaldo(),
        desregistrarTareaDeFondo(),
      ]);
      setBoot({ phase: 'email' });
      return;
    }
    // 503 / sin red: se sigue con lo que hay.
    if (!sinEsperar) setBoot({ phase: 'home', credential: stored });
  }, []);

  useEffect(() => {
    void start();
  }, [start]);

  return (
      <View className="flex-1 bg-background">
      {/* La hora y la batería: con fondo navy tienen que ser CLARAS o
          desaparecen contra la barra. Es lo único del chrome del sistema que no
          se resuelve con una clase de Tailwind. */}
      <StatusBar style={oscuro ? 'light' : 'dark'} />
      {boot.phase === 'loading' ? (
        <View className="flex-1 items-center justify-center" testID="pantalla-cargando">
          <ActivityIndicator color={colores.primary} size="large" />
        </View>
      ) : boot.phase === 'email' ? (
        // En tablet, la entrada centrada con ancho de formulario (FL10).
        <View style={FORMULARIO_CENTRADO}>
          <PhoneScreen onCodeRequested={(phone) => setBoot({ phase: 'otp', phone })} />
        </View>
      ) : boot.phase === 'otp' ? (
        <View style={FORMULARIO_CENTRADO}>
          <OtpScreen
            phone={boot.phone}
            onBack={() => setBoot({ phase: 'email' })}
            onDone={(credential) => setBoot({ phase: 'home', credential })}
          />
        </View>
      ) : boot.phase === 'home' ? (
        <>
        <NavegacionDeSesion
          credential={boot.credential}
          // Mientras se lee la preferencia se asume el defecto: el interruptor
          // no puede mostrarse apagado un instante y saltar a encendido.
          segundoPlano={segundoPlano ?? SEGUNDO_PLANO_POR_DEFECTO}
          onSegundoPlano={(activo) => {
            setSegundoPlano(activo);
            void guardarSegundoPlano(activo);
          }}
          chatAbierto={chatAbierto}
          onChatAbierto={setChatAbierto}
          onLogout={() => {
            // El socket se cierra ANTES de borrar la credencial: si no, queda
            // vivo con un JWT que ya no vale y reconecta en bucle.
            // El server deja de empujar a este teléfono ANTES de soltar el JWT.
            void olvidarPushDeEsteTelefono(boot.credential.jwt);
            disconnectSocket();
            setChatAbierto(null);
            void olvidarCola();
            void olvidarArchivos();
            void olvidarChats();
            void olvidarMensajes();
            void olvidarBorradores();
            void olvidarPassphrase();
            void olvidarLibro();
            void olvidarEstadoDeRespaldo();
            void desregistrarTareaDeFondo();
            // La agenda también: otro teléfono, otra persona. Dejarla cargada
            // le mostraría a quien entre después los contactos del anterior.
            olvidarAgenda();
            void clearCredential().then(() => setBoot({ phase: 'email' }));
          }}
        />
        {oferta ? (
          <RestaurarRespaldo
            jwt={boot.credential.jwt}
            respaldo={oferta}
            onCerrar={() => {
              setOferta(null);
              void marcarOfrecido();
            }}
            onRestaurado={() => void marcarOfrecido()}
          />
        ) : null}
        </>
      ) : null}
      </View>
  );
}
