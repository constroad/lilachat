import { describe, expect, it } from 'vitest';
import { editedMessageOf } from './editedMessage';

/** A bot's edit as it reaches the phone (`msg.edited`); an old visit card gains its refs (agentes 14/11). */
describe('an edited message', () => {
  const message = { seq: 7, body: 'Visita técnica', card: { title: 'Antes', fields: [] } };

  it('takes the new text, card and the visit it points to', () => {
    // Act
    const edited = editedMessageOf(message, { body: 'Visita técnica · 1 punto', card: { title: 'Después', fields: [] }, clientRef: { visitId: '65f0000000000000000000a2' } });
    // Assert
    expect(edited).toMatchObject({ body: 'Visita técnica · 1 punto', card: { title: 'Después' }, clientRef: { visitId: '65f0000000000000000000a2' } });
  });

  it('keeps what the edit does not bring', () => {
    const withRef = { ...message, clientRef: { visitId: '65f0000000000000000000a1' } };
    expect(editedMessageOf(withRef, { body: 'x' })).toMatchObject({ card: { title: 'Antes' }, clientRef: { visitId: '65f0000000000000000000a1' } });
  });

  it('a notes chat link card (`msg.link`, José 18/11) changes only the card, never the text', () => {
    // Arrange
    const saved = { ...message, link: { url: 'https://www.instagram.com/reel/DQx1aBcD2eF/', platform: 'instagram' as const, format: 'reel' as const, status: 'pending' as const } };
    // Act
    const sorted = editedMessageOf(saved, { link: { ...saved.link, status: 'ready', categoryId: '673b1f0e9d2c4a0012ab34c1', categoryBy: 'lila' } });
    // Assert
    expect(sorted).toMatchObject({ body: 'Visita técnica', card: { title: 'Antes' }, link: { status: 'ready', categoryId: '673b1f0e9d2c4a0012ab34c1' } });
    expect(sorted).not.toHaveProperty('editedAt');
  });
});
