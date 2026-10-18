import { Alert, ScrollView } from 'react-native';
import { Interruptor } from '../ui/Interruptor';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { BellRing, CloudUpload, LogOut, UserPlus } from 'lucide-react-native';
import type { Credential } from '../auth/credentialStore';
import { DiagnosticoAjuste } from '../diagnostico/DiagnosticoAjuste';
import { AvisoDePantallaCompleta } from '../ui/AvisoDePantallaCompleta';
import { FilaDeAjuste, GrupoDeAjustes } from '../ui/FilaDeAjuste';
import { Rotulo } from '../ui/Rotulo';
import { AparienciaAjuste } from './AparienciaAjuste';
import { AutoRespuestaAjuste } from './AutoRespuestaAjuste';
import { BuscarActualizacionesAjuste } from './BuscarActualizacionesAjuste';
import { PerfilAjuste } from './PerfilAjuste';
import { RespaldoAjuste } from './RespaldoAjuste';
import type { ResultadoDelChequeo } from './actualizacion';
import type { EstadoActualizacion } from './useActualizador';

/**
 * La pestaña Ajustes (salió de `TabsShell`, que pasaba de 560 líneas). Listas
 * AGRUPADAS como Android y WhatsApp (auditoría §48): una tarjeta por bloque y
 * líneas finas entre filas, en vez de una tarjeta con borde por fila. Cerrar
 * sesión va solo, al final y en rojo: es lo único que no se deshace.
 */
export function PantallaDeAjustes(props: {
  credential: Credential;
  visible: boolean;
  esOperador: boolean;
  segundoPlano: boolean;
  onSegundoPlano: (activo: boolean) => void;
  actualizaciones: {
    chequeo: ResultadoDelChequeo | null;
    estado: EstadoActualizacion;
    verificando: boolean;
    verificar: () => Promise<unknown>;
  };
  onInvitar: () => void;
  onRespaldoDelServidor: () => void;
  onLogout: () => void;
}) {
  const { credential, actualizaciones } = props;
  return (
    // `padding` también en Android: el texto de la auto-respuesta quedaba
    // tapado por el teclado (mismo motivo que en ChatScreen).
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        testID="pantalla-ajustes"
      >
        <PerfilAjuste credential={credential} />

        <AparienciaAjuste />

        <Rotulo>Notificaciones</Rotulo>
        {/* Solo aparece si Android las negó: es un aviso, no un ajuste más. */}
        <AvisoDePantallaCompleta visible={props.visible} />
        <GrupoDeAjustes>
          {/**
           * El interruptor de la notificación permanente (José, 27/08/2026).
           * Android la exige a cambio de dejar vivo el socket; la decisión es
           * de quien la ve todos los días, con el costo escrito.
           */}
          <FilaDeAjuste
            icono={BellRing}
            titulo="Conexión permanente"
            detalle={
              props.segundoPlano
                ? 'Android muestra un aviso fijo y gasta más batería'
                : 'No hace falta: los mensajes llegan por notificación'
            }
            derecha={<Interruptor testID="sw-segundo-plano" value={props.segundoPlano} onValueChange={props.onSegundoPlano} />}
          />
        </GrupoDeAjustes>

        <Rotulo>Chats</Rotulo>
        <GrupoDeAjustes>
          <RespaldoAjuste credential={credential} />
          <AutoRespuestaAjuste jwt={credential.jwt} />
          {/* El volcado de la base entera es de operadores (FL10). */}
          {props.esOperador ? (
            <FilaDeAjuste
              testID="btn-respaldo"
              icono={CloudUpload}
              titulo="Respaldo del servidor"
              detalle="La base entera, cada noche · operadores"
              onPress={props.onRespaldoDelServidor}
            />
          ) : null}
        </GrupoDeAjustes>

        <Rotulo>Lilachat</Rotulo>
        <GrupoDeAjustes>
          <FilaDeAjuste
            testID="btn-invitar"
            icono={UserPlus}
            titulo="Invitar a alguien"
            detalle="Por WhatsApp, con el enlace para descargarla"
            onPress={props.onInvitar}
          />
          <DiagnosticoAjuste />
          <BuscarActualizacionesAjuste
            chequeo={actualizaciones.chequeo}
            estado={actualizaciones.estado}
            verificando={actualizaciones.verificando}
            onVerificar={() => void actualizaciones.verificar()}
          />
        </GrupoDeAjustes>

        <Rotulo>Cuenta</Rotulo>
        <GrupoDeAjustes>
          <FilaDeAjuste
            testID="btn-salir"
            icono={LogOut}
            tono="peligro"
            titulo="Cerrar sesión"
            derecha={false}
            onPress={() =>
              // Con un toque borraba historial y passphrase sin preguntar (FL8).
              Alert.alert(
                'Cerrar sesión',
                'Se borran de este teléfono el historial y la passphrase del respaldo, y deja de recibir avisos. Tus chats vuelven al entrar; el historial, si tienes respaldo.',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Cerrar sesión', style: 'destructive', onPress: props.onLogout },
                ]
              )
            }
          />
        </GrupoDeAjustes>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
