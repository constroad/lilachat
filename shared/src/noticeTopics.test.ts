import { describe, expect, it } from 'vitest';
import { validateAppManifest } from './botManifest.js';
import { validateTopicChannels } from './noticeTopics.js';
import { validateBotPost } from './bots.js';

/** Notice topics (R160, design e-31): the app declares them, the space's admin picks a channel for each. */
const manifest = { key: 'inframaq', name: 'Inframaq', redirect_uri: 'https://agentes.example.com/vuelta', webhook_url: 'https://agentes.example.com/events' };
const SPACE_CHANNEL = '6ad8b0cb30ce97957f4acc04';

describe('the topics an app declares in its manifest', () => {
  it('keeps key, name, description and an icon of the fixed set; an unknown icon is dropped, not refused', () => {
    // Arrange
    const topics = [
      { key: 'asistencia', name: 'Asistencia', description: 'Ingresos, refrigerio y salida', icon: 'attendance' },
      { key: 'caja', name: 'Caja', icon: 'piggy' },
    ];
    // Act
    const result = validateAppManifest({ ...manifest, notice_topics: topics });
    // Assert
    expect(result.ok && result.manifest.noticeTopics).toEqual([
      { key: 'asistencia', name: 'Asistencia', description: 'Ingresos, refrigerio y salida', icon: 'attendance' },
      { key: 'caja', name: 'Caja' },
    ]);
  });

  it('none means none (a retired topic goes away); a bad key, a repeated one or more than 10 refuse the manifest', () => {
    expect(validateAppManifest(manifest).ok && (validateAppManifest(manifest) as { manifest: { noticeTopics: unknown[] } }).manifest.noticeTopics).toEqual([]);
    expect(validateAppManifest({ ...manifest, notice_topics: [{ key: 'Mal', name: 'x' }] }).ok).toBe(false);
    expect(validateAppManifest({ ...manifest, notice_topics: [{ key: 'caja', name: 'Caja' }, { key: 'caja', name: 'Otra' }] }).ok).toBe(false);
    expect(validateAppManifest({ ...manifest, notice_topics: Array.from({ length: 11 }, (_, i) => ({ key: `t${i}`, name: `T${i}` })) }).ok).toBe(false);
  });
});

describe('the channel of each topic (a partial map: what is not sent keeps its value)', () => {
  it('takes a channel id or null («Sin canal») for known topics', () => {
    expect(validateTopicChannels({ asistencia: SPACE_CHANNEL, caja: null }, ['asistencia', 'caja', 'clima'])).toEqual({ ok: true, channels: { asistencia: SPACE_CHANNEL, caja: null } });
  });

  it('refuses a topic the app does not have, or a value that is not an id', () => {
    const unknown = validateTopicChannels({ planilla: SPACE_CHANNEL }, ['asistencia']);
    expect(unknown.ok ? '' : unknown.message).toMatch(/planilla/);
    expect(validateTopicChannels({ asistencia: '#planta' }, ['asistencia']).ok).toBe(false);
    expect(validateTopicChannels([SPACE_CHANNEL], ['asistencia']).ok).toBe(false);
  });
});

describe('posting by topic', () => {
  it('a message may go to a topic instead of a channel or a person, one destination only', () => {
    const byTopic = validateBotPost({ topic: 'asistencia', text: 'Hola', idempotency_key: 'k1' });
    expect(byTopic.ok && byTopic.post.target).toEqual({ topic: 'asistencia' });
    expect(validateBotPost({ topic: 'asistencia', channel_id: SPACE_CHANNEL, text: 'x', idempotency_key: 'k2' }).ok).toBe(false);
    expect(validateBotPost({ topic: 'Mal Tema', text: 'x', idempotency_key: 'k3' }).ok).toBe(false);
  });
});
