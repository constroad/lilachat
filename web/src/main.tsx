import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AppBoundary } from './ui/ErrorBoundary';
import './index.css';
import { prepararSonidos } from './sonidos/sonidoDeMensaje';
import { applyTheme, followSystemTheme, readThemeChoice } from './ui/tema';
import { applyChatFont, readChatFont } from './ui/chatFont';
import { catchJoinLink } from './spaces/pendingJoin';
import { catchCallLink } from './calls/pendingCallLink';

// El navegador deja sonar recién después del primer gesto (20/10).
prepararSonidos();

// The theme: already applied before paint by `tema-inicial.js`; from here it follows the system when it switches.
applyTheme(readThemeChoice());
followSystemTheme();
// The chat's font size this browser chose (backlog 1).
applyChatFont(readChatFont());
// A space's join link (pending 47): its code waits through the sign-in.
catchJoinLink();
catchCallLink();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppBoundary>
      <App />
    </AppBoundary>
  </StrictMode>
);
