import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Send, X } from 'lucide-react-native';
import type { Contact } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { useMargenes } from '../ui/useMargenes';
import { compartirInvitacion } from './compartirInvitacion';
import { invitarContacto, listContacts } from './contactsApi';
import { useAgendaParaInvitar } from './useAgendaParaInvitar';
import { buscarEn, indexarParaBuscar } from './busqueda';
import { useConsultaDiferida } from '../ui/useConsultaDiferida';
import { useColores } from '../ui/tema';
import { Avatar } from '../ui/Avatar';
import { CabeceraDeInvitar } from './CabeceraDeInvitar';

/** El avatar de cada contacto (dp): 44, el mismo en toda lista de personas. */
const AVATAR_DE_CONTACTO = 44;
/** La línea entre filas arranca donde arranca el nombre: 16 de margen + avatar + 12. */
const SANGRIA_DE_LA_LINEA = 16 + AVATAR_DE_CONTACTO + 12;

/**
 * Invitar a alguien de la agenda del teléfono.
 *
 * **Los contactos NO viajan.** Se leen en el aparato y se cruzan contra los
 * registrados que el server ya nos dio; lo único que sale de acá es el mensaje
 * que la persona decide compartir.
 *
 * Nació mostrando esqueletos para siempre: la lectura de la agenda fallaba y
 * «cargando» era la ausencia de datos, así que el fallo tenía la misma cara que
 * una carga lenta. Ahora los cuatro estados —cargando, sin permiso, error y
 * listo— muestran cosas distintas, y ninguno es el vacío.
 */
export function InviteScreen({
  visible,
  credential,
  onClose,
}: {
  visible: boolean;
  credential: Credential;
  onClose: () => void;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  const [registrados, setRegistrados] = useState<Contact[] | null>(null);
  const [consulta, setConsulta] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);

  const cargarRegistrados = useCallback(async () => {
    const resultado = await listContacts(credential.jwt);
    // Si el server no contesta se sigue igual: sin la lista se ofrece invitar a
    // TODA la agenda, que es peor que nada pero mucho mejor que una pantalla
    // que no hace nada.
    setRegistrados(resultado.ok ? resultado.data.groups.flatMap((grupo) => grupo.contacts) : []);
  }, [credential.jwt]);

  useEffect(() => {
    if (!visible) return;
    void cargarRegistrados();
  }, [visible, cargarRegistrados]);

  const agenda = useAgendaParaInvitar(registrados);

  /**
   * Invitar de verdad: primero se CREA la admisión y recién después se comparte
   * el enlace. Al revés —o sin el primer paso, que es como nació— la persona
   * instala la app y no puede entrar: el server no le manda el código a alguien
   * sin admisión, y contesta 200 igual para no revelar quién existe.
   */
  const invitar = async (contacto: { nombre: string; telefono: string } | null) => {
    if (contacto) {
      const alta = await invitarContacto(credential.jwt, contacto.telefono);
      if (!alta.ok) {
        // Se avisa y NO se comparte: mandar el enlace sabiendo que no va a poder
        // entrar es hacerle perder el tiempo a dos personas.
        setAviso(alta.message ?? 'No se pudo habilitar a esa persona. Prueba de nuevo.');
        return;
      }
      setAviso(null);
    }

    await compartirInvitacion(contacto);
  };

  // La clave se calcula una vez y la búsqueda espera a que se deje de tipear:
  // con 600 contactos, filtrar en cada tecla trababa el teclado.
  const indexados = useMemo(
    () => indexarParaBuscar(agenda.estado === 'listo' ? agenda.paraInvitar : []),
    [agenda]
  );
  const diferida = useConsultaDiferida(consulta);
  const visibles = useMemo(() => buscarEn(indexados, diferida), [indexados, diferida]);
  const aguja = diferida.trim();
  const filas = agenda.estado === 'listo' ? visibles : [];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-background" testID="pantalla-invitar">
        <View
          className="flex-row items-center gap-2 px-4 pb-3"
          style={{ paddingTop: margenes.cabecera }}
        >
          <Pressable
            onPress={onClose}
            testID="btn-cerrar-invitar"
            className="h-11 w-11 items-center justify-center rounded-full"
          >
            <X size={22} color={colores["on-surface"]} />
          </Pressable>
          <Text className="flex-1 text-xl font-bold text-on-surface">Invitar</Text>
        </View>

        {/* FlashList y no ScrollView: con 633 contactos, un ScrollView monta
            las 633 filas de una y la pantalla tarda segundos en aparecer.
            UNA sola lista para todos los estados: la cabecera (con el
            buscador) no se desmonta cuando nadie coincide. */}
        <FlashList
          data={filas}
          testID="lista-invitables"
          keyExtractor={(contacto) => contacto.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: margenes.pie + 16 }}
          ListHeaderComponent={
            <CabeceraDeInvitar
              aviso={aviso}
              porInvitar={agenda.estado === 'listo' ? indexados.length : null}
              consulta={consulta}
              onConsulta={setConsulta}
              onCompartir={() => void invitar(null)}
            />
          }
          ListEmptyComponent={<SinFilas estado={agenda} buscando={Boolean(aguja)} />}
          renderItem={({ item, index }) => (
            <FilaInvitable
              contacto={item}
              primera={index === 0}
              ultima={index === filas.length - 1}
              onInvitar={() => void invitar(item)}
            />
          )}
        />
      </View>
    </Modal>
  );
}

/**
 * Una fila de la agenda. Aparte para que la lista virtualizada la recicle.
 * Las filas forman UNA tarjeta (auditoría §48): la primera y la última
 * redondean las puntas y entre medio va una línea fina.
 */
function FilaInvitable({
  contacto,
  primera,
  ultima,
  onInvitar,
}: {
  contacto: { id: string; nombre: string; telefono: string };
  primera: boolean;
  ultima: boolean;
  onInvitar: () => void;
}) {
  const colores = useColores();
  return (
    <View className={`bg-surface ${primera ? 'rounded-t-2xl' : ''} ${ultima ? 'rounded-b-2xl' : ''}`}>
      {primera ? null : <View className="h-px bg-outline/10" style={{ marginLeft: SANGRIA_DE_LA_LINEA }} />}
      <View testID={`contacto-tel-${contacto.id}`} className="min-h-[64px] flex-row items-center gap-3 px-4 py-2.5">
        <Avatar nombre={contacto.nombre} tamano={AVATAR_DE_CONTACTO} />
        <View className="min-w-0 flex-1">
          <Text className="text-[15px] font-semibold text-on-surface" numberOfLines={1}>
            {contacto.nombre}
          </Text>
          <Text className="text-[13px] text-on-surface-variant" numberOfLines={1}>
            {contacto.telefono}
          </Text>
        </View>
        <Pressable
          testID={`invitar-${contacto.id}`}
          onPress={onInvitar}
          hitSlop={{ top: 4, bottom: 4 }}
          className="min-h-[36px] flex-row items-center gap-1.5 rounded-full bg-primary/10 px-3.5"
        >
          <Send size={14} color={colores.primary} />
          <Text className="text-[13px] font-semibold text-primary">Invitar</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Los estados que no son una lista. Ninguno deja la pantalla en blanco. */
function SinFilas({ estado, buscando }: { estado: ReturnType<typeof useAgendaParaInvitar>; buscando: boolean }) {
  if (estado.estado === 'cargando') {
    return (
      <View className="mt-6 gap-2">
        {[0, 1, 2, 3].map((indice) => (
          <View key={indice} className="h-16 rounded-2xl bg-surface" />
        ))}
      </View>
    );
  }
  if (estado.estado === 'denegado') {
    return (
      <Aviso
        titulo="Sin acceso a tus contactos"
        cuerpo="Lilachat necesita leer tu agenda para mostrarte a quién invitar. Se lee en el teléfono y no se envía a ningún lado. Igual puedes compartir el enlace."
      />
    );
  }
  // El detalle va a la vista, no solo al log: sin él, «no se pudo» es
  // indistinguible de «no hay nadie» para quien reporta el problema.
  if (estado.estado === 'error') {
    return <Aviso titulo="No pudimos leer tu agenda" cuerpo={`Ya nos avisó solo. Igual puedes compartir el enlace.\n\n(${estado.mensaje})`} />;
  }
  return buscando ? (
    <Aviso titulo="Nadie coincide" cuerpo="Nadie de tu agenda coincide con lo que buscas." />
  ) : (
    <Aviso titulo="Toda tu agenda ya está" cuerpo="No encontramos a nadie de tu agenda que falte invitar." />
  );
}

function Aviso({ titulo, cuerpo }: { titulo: string; cuerpo: string }) {
  return (
    <View className="items-center px-4 pt-8">
      <Text className="text-center text-base font-semibold text-on-surface">{titulo}</Text>
      <Text className="mt-2 text-center text-sm leading-5 text-on-surface-variant">{cuerpo}</Text>
    </View>
  );
}
