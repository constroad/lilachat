import { useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { Interruptor } from '../ui/Interruptor';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { BellRing, CloudUpload, HardDrive, Images, LogOut, Star, UserPlus } from 'lucide-react-native';
import { StorageScreen } from './storage/StorageScreen';
import type { Credential } from '../auth/credentialStore';
import { DiagnosticoAjuste } from '../diagnostico/DiagnosticoAjuste';
import { AvisoDePantallaCompleta } from '../ui/AvisoDePantallaCompleta';
import { FilaDeAjuste, GrupoDeAjustes } from '../ui/FilaDeAjuste';
import { Rotulo } from '../ui/Rotulo';
import { AparienciaAjuste } from './AparienciaAjuste';
import { ChatFontSetting } from './ChatFontSetting';
import { GroupsAsListSetting } from './GroupsAsListSetting';
import { AutoRespuestaAjuste } from './AutoRespuestaAjuste';
import { AppLockSetting } from './AppLockSetting';
import { BlockedContactsSetting } from './BlockedContactsSetting';
import { PresenceSetting } from './presence/PresenceSetting';
import { BuscarActualizacionesAjuste } from './BuscarActualizacionesAjuste';
import { DispositivosVinculadosAjuste } from './DispositivosVinculadosAjuste';
import { PerfilAjuste } from './PerfilAjuste';
import { RespaldoAjuste } from './RespaldoAjuste';
import type { ResultadoDelChequeo } from './actualizacion';
import type { EstadoActualizacion } from './useActualizador';
import { ListaDeDestacados } from '../chat/destacados/ListaDeDestacados';
import type { ClientWorkspace, MediaLibraryItem } from '@lilachat/shared';
import { SpaceSettingsSection, type SpaceSettingsLink } from '../spaces/SpaceSettingsSection';
import { MediaScreen } from '../media/MediaScreen';
import { ReadReceiptsSetting } from './ReadReceiptsSetting';
import { NoticePreviewSetting } from './NoticePreviewSetting';

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
  /** Abrir el chat de un destacado en ese mensaje (20/10). */
  onAbrirDestacado: (chatId: string, seq: number) => void;
  /** «Medios» of the personal chats or of the space open (pending 38): its chat at that message. */
  media: { spaceId: string | null; spaceName?: string; onOpen: (item: MediaLibraryItem) => void };
  /** The space open goes first (José, 24/10: the space's settings belong in this tab). */
  space: { space: ClientWorkspace; apps: readonly string[]; open: (link: Exclude<SpaceSettingsLink, 'media'>) => void } | null;
}) {
  const { credential, actualizaciones } = props;
  const [verDestacados, setVerDestacados] = useState(false);
  const [verMedios, setVerMedios] = useState(false);
  const [showStorage, setShowStorage] = useState(false);
  return (
    // `padding` también en Android: el texto de la auto-respuesta quedaba
    // tapado por el teclado (mismo motivo que en ChatScreen).
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <MediaScreen visible={verMedios} jwt={credential.jwt} spaceId={props.media.spaceId} spaceName={props.media.spaceName} onOpen={(item) => { setVerMedios(false); props.media.onOpen(item); }} onClose={() => setVerMedios(false)} />
      <StorageScreen visible={showStorage} jwt={credential.jwt} onClose={() => setShowStorage(false)} />
      <ListaDeDestacados visible={verDestacados} jwt={credential.jwt} yo={credential.userId} onIr={(destacado) => props.onAbrirDestacado(destacado.chatId, destacado.seq)} onCerrar={() => setVerDestacados(false)} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        testID="pantalla-ajustes"
      >
        {props.space ? <SpaceSettingsSection space={props.space.space} apps={props.space.apps} onOpen={(link) => (link === 'media' ? setVerMedios(true) : props.space?.open(link))} /> : null}
        {props.space ? <Rotulo>Tu cuenta</Rotulo> : null}
        <PerfilAjuste credential={credential} />
        <GrupoDeAjustes>
          <PresenceSetting jwt={credential.jwt} name={credential.name ?? 'Tú'} />
        </GrupoDeAjustes>

        <AparienciaAjuste />

        <ChatFontSetting />

        <Rotulo>Privacidad</Rotulo>
        <GrupoDeAjustes>
          <AppLockSetting />
          <ReadReceiptsSetting jwt={credential.jwt} />
          <NoticePreviewSetting jwt={credential.jwt} />
          <BlockedContactsSetting jwt={credential.jwt} />
        </GrupoDeAjustes>

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

        {/* Usar Lilachat en la computadora con el QR (W5): la web dice «Ajustes → Dispositivos vinculados». */}
        <Rotulo>Computadora</Rotulo>
        <GrupoDeAjustes>
          <DispositivosVinculadosAjuste jwt={credential.jwt} />
        </GrupoDeAjustes>

        <Rotulo>Chats</Rotulo>
        <GrupoDeAjustes>
          {/* La estrella personal (20/10), como WhatsApp: todos los que destaqué, de todos los chats. */}
          <GroupsAsListSetting />
          {props.space ? null : <FilaDeAjuste testID="btn-medios" icono={Images} titulo="Medios" detalle="Fotos, videos, documentos y enlaces de tus chats" onPress={() => setVerMedios(true)} />}
          <FilaDeAjuste testID="btn-almacenamiento" icono={HardDrive} titulo="Almacenamiento" detalle="Cuánto ocupa Lilachat y qué liberar" onPress={() => setShowStorage(true)} />
          <FilaDeAjuste testID="btn-destacados" icono={Star} titulo="Mensajes destacados" detalle="Los que guardaste con la estrella · solo tú los ves" onPress={() => setVerDestacados(true)} />
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
                'Se borran de este teléfono el historial y la clave del respaldo, y deja de recibir avisos. Tus chats vuelven al entrar; el historial, si tienes respaldo.',
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
