import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { prepararSonidos } from './sonidos/sonidoDeMensaje';

// El navegador deja sonar recién después del primer gesto (20/10).
prepararSonidos();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
