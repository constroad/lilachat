import { useContext, type ReactNode } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { AccionesDeTarjetaContext } from '../../chat/accionesDeTarjeta';
import { BottomRoom } from '../../chat/useScrollConTeclado';

/**
 * An overlay is drawn by its `OverlayHost`, higher in the tree than where it
 * was asked for. React context flows by tree position, so every provider that
 * sits BETWEEN the host and the call site would be lost (a native `Modal`
 * kept them: it is a portal). These are the ones that exist today (02/11):
 * the card actions and the bottom room of the chat, and the insets the chat
 * panel overrides on a tablet. A new context provided inside a screen that
 * has a host above it goes on this list.
 */
export type ContextBridge = (children: ReactNode) => ReactNode;

export function useContextBridge(): ContextBridge {
  const cardActions = useContext(AccionesDeTarjetaContext);
  const bottomRoom = useContext(BottomRoom);
  const insets = useContext(SafeAreaInsetsContext);
  return (children) => (
    <SafeAreaInsetsContext.Provider value={insets}>
      <BottomRoom.Provider value={bottomRoom}>
        <AccionesDeTarjetaContext.Provider value={cardActions}>{children}</AccionesDeTarjetaContext.Provider>
      </BottomRoom.Provider>
    </SafeAreaInsetsContext.Provider>
  );
}
