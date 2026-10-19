import { describe, expect, it } from 'vitest';
import { textoDeEncuestaEnElChat, textoDeEventoEnElChat } from './enElChat.js';

/**
 * El texto del mensaje que publica una encuesta o un evento en su chat (José,
 * 18/10). Es lo que se ve en la notificación y en la vista previa de la lista;
 * en la conversación se dibuja la tarjeta.
 */
describe('textos en el chat', () => {
  it('la encuesta dice que es una encuesta y cuál es la pregunta', () => {
    expect(textoDeEncuestaEnElChat('  ¿Pizza o pollo? ')).toBe('Encuesta: ¿Pizza o pollo?');
  });

  it('el evento dice que es un evento y cómo se llama', () => {
    expect(textoDeEventoEnElChat(' Almuerzo ')).toBe('Evento: Almuerzo');
  });
});
