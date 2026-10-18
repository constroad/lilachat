import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Activity, ArrowLeft, Send, Trash2 } from 'lucide-react-native';
import { useColores } from '../ui/tema';
import { FilaDeAjuste } from '../ui/FilaDeAjuste';
import { useMargenes } from '../ui/useMargenes';
import { enviarDiagnostico, leerDiagnostico, limpiarDiagnostico } from './diagnostico';
import type { EntradaDiagnostico } from './motor';

const MS_LENTO = 1_000;

const FRASE_DE_ENVIO = {
  ok: 'Enviado. Ya se puede mirar en LilaStore.',
  vacio: 'Todavía no hay nada para enviar.',
  sin_red: 'Sin conexión. Prueba de nuevo con wifi.',
  rechazado: 'No se pudo enviar. Prueba más tarde.',
} as const;

/**
 * Ajustes → Diagnóstico (rn-app-loop §10): los errores y tiempos de ESTE
 * teléfono, con «Enviar problema» para forzar el envío. El envío normal es
 * automático; esto es para cuando alguien dice «me anda lento» y se quiere ya.
 */
export function DiagnosticoAjuste() {
  const colores = useColores();
  const margenes = useMargenes();
  const [abierto, setAbierto] = useState(false);
  const [entradas, setEntradas] = useState<EntradaDiagnostico[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');

  const abrir = useCallback(() => {
    setAviso('');
    setAbierto(true);
    // Lo más nuevo arriba.
    void leerDiagnostico().then((leidas) => setEntradas([...leidas].reverse()));
  }, []);

  const enviar = async () => {
    if (enviando) return;
    setEnviando(true);
    const resultado = await enviarDiagnostico();
    setAviso(FRASE_DE_ENVIO[resultado.ok ? 'ok' : resultado.motivo]);
    setEnviando(false);
  };

  return (
    <>
      <FilaDeAjuste
        testID="btn-diagnostico"
        icono={Activity}
        titulo="Diagnóstico"
        detalle="Errores y rendimiento de este teléfono"
        onPress={abrir}
      />

      <Modal visible={abierto} animationType="slide" onRequestClose={() => setAbierto(false)}>
        <View className="flex-1 bg-background">
          <View
            className="flex-row items-center gap-2 border-b border-outline/10 bg-surface px-4 pb-3"
            style={{ paddingTop: margenes.cabecera }}
          >
            <Pressable testID="btn-cerrar-diagnostico" onPress={() => setAbierto(false)} className="h-11 w-11 items-center justify-center">
              <ArrowLeft size={22} color={colores['on-surface']} />
            </Pressable>
            <Text className="flex-1 text-lg font-bold text-on-surface">Diagnóstico</Text>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: margenes.pie, gap: 8 }}>
            <Text className="text-sm text-on-surface-variant">
              Errores y tiempos de la app en este teléfono. Nada personal: ni mensajes, ni números, ni contactos.
            </Text>
            <View className="flex-row gap-2">
              <Pressable
                testID="diag-enviar"
                onPress={() => void enviar()}
                className="min-h-[44px] flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-primary px-4"
              >
                {enviando ? <ActivityIndicator color={colores['on-primary']} /> : <Send size={16} color={colores['on-primary']} />}
                <Text className="text-sm font-semibold text-on-primary">Enviar problema</Text>
              </Pressable>
              {entradas.length > 0 ? (
                <Pressable
                  testID="diag-limpiar"
                  onPress={() => void limpiarDiagnostico().then(() => setEntradas([]))}
                  className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-lg bg-surface-variant px-4"
                >
                  <Trash2 size={16} color={colores.error} />
                  <Text className="text-sm font-semibold text-error">Borrar</Text>
                </Pressable>
              ) : null}
            </View>
            {aviso ? (
              <Text className="text-[12px] text-on-surface-variant" testID="diag-aviso">
                {aviso}
              </Text>
            ) : null}
            {entradas.length === 0 ? (
              <Text className="text-sm text-on-surface-variant" testID="diag-vacio">
                Todavía no se registró nada. Si algo falla o va lento, aparece acá.
              </Text>
            ) : (
              entradas.map((entrada) => <FilaDeDiagnostico key={`${entrada.cuando}-${entrada.tipo}`} entrada={entrada} />)
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function FilaDeDiagnostico({ entrada }: { entrada: EntradaDiagnostico }) {
  const cuando = new Date(entrada.cuando).toLocaleString('es');
  return (
    <View className="gap-1 rounded-lg border border-outline/10 bg-surface p-3">
      {entrada.tipo === 'error' ? (
        <>
          <Text className="text-[11px] font-semibold tracking-wide text-error">
            ERROR{entrada.origen ? ` · ${entrada.origen}` : ''}
          </Text>
          <Text className="text-sm text-on-surface">{entrada.mensaje}</Text>
        </>
      ) : (
        <>
          <Text className="text-[11px] font-semibold tracking-wide text-on-surface-variant">RENDIMIENTO</Text>
          <Text className={entrada.ms >= MS_LENTO ? 'text-sm font-semibold text-error' : 'text-sm text-on-surface'}>
            {entrada.op} · {entrada.ms} ms
          </Text>
        </>
      )}
      <Text className="text-[11px] text-on-surface-variant">{cuando}</Text>
    </View>
  );
}
