import { Component, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { reportarError } from './reportarError';

/**
 * La red de seguridad de la app.
 *
 * Sin esto, un error al renderizar cualquier pantalla deja **la pantalla en
 * blanco o la app cerrada**, sin explicación para la persona y sin una línea
 * para nosotros. Es lo que pasó el 26/08/2026 con «Invitar»: no pasaba nada y
 * nadie —ni el usuario ni el server ni Torre— se enteraba.
 *
 * Tiene que ser una clase: `componentDidCatch` no existe como hook.
 */
type Props = { children: ReactNode; pantalla: string };
type Estado = { rompio: boolean };

export class ErrorBoundary extends Component<Props, Estado> {
  state: Estado = { rompio: false };

  static getDerivedStateFromError(): Estado {
    return { rompio: true };
  }

  componentDidCatch(error: unknown): void {
    reportarError(this.props.pantalla, error);
  }

  render(): ReactNode {
    if (!this.state.rompio) return this.props.children;

    return (
      <View className="flex-1 items-center justify-center bg-background px-8" testID="pantalla-rota">
        <Text className="text-center text-base font-semibold text-on-surface">
          Algo se rompió en esta pantalla
        </Text>
        {/* No se muestra el error crudo: a la persona no le dice nada y puede
            arrastrar datos suyos. El detalle ya viajó al log. */}
        <Text className="mt-2 text-center text-sm leading-5 text-on-surface-variant">
          Ya nos avisó solo. Podés volver a intentarlo.
        </Text>
        <Pressable
          testID="btn-reintentar-pantalla"
          onPress={() => this.setState({ rompio: false })}
          className="mt-6 min-h-[48px] items-center justify-center rounded-xl bg-primary px-6"
        >
          <Text className="text-sm font-semibold text-on-primary">Reintentar</Text>
        </Pressable>
      </View>
    );
  }
}
