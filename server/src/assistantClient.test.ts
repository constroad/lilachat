import { describe, expect, it, vi } from 'vitest';
import type { ModelAsker } from './agentesModel.js';
import { buildAssistantClient } from './assistantClient.js';

const params = { task: 'assistant.mention' as const, memberIds: ['u1', 'u2'], system: 'Eres Lila.', prompt: '¿Qué se decidió?' };

describe('buildAssistantClient: Lila asks agentes, never a provider', () => {
  it('sends the task, the system and the prompt as text, and gives back the text', async () => {
    // Arrange
    const ask = vi.fn<ModelAsker>(async () => ({ ok: true, json: null, text: 'El vaciado va el lunes.' }));
    // Act
    const outcome = await buildAssistantClient(ask).ask(params);
    // Assert
    expect(outcome).toEqual({ ok: true, text: 'El vaciado va el lunes.' });
    expect(ask).toHaveBeenCalledWith(['u1', 'u2'], { task: 'assistant.mention', system: 'Eres Lila.', input: '¿Qué se decidió?' });
    expect(JSON.stringify(ask.mock.calls)).not.toMatch(/claude|haiku|opus|anthropic/i);
  });

  it('says it is not configured when agentes has no model, without naming any key', async () => {
    const outcome = await buildAssistantClient(async () => ({ ok: false, reason: 'not_configured' })).ask(params);
    expect(outcome).toMatchObject({ ok: false, code: 'sin_configurar' });
    expect(JSON.stringify(outcome)).not.toMatch(/API_KEY|ANTHROPIC/);
  });

  it('turns a failure into «rechazado»', async () => {
    await expect(buildAssistantClient(async () => ({ ok: false, reason: 'failed' })).ask(params)).resolves.toMatchObject({ ok: false, code: 'rechazado' });
  });

  it('treats an empty text as no answer', async () => {
    await expect(buildAssistantClient(async () => ({ ok: true, json: null, text: '   ' })).ask(params)).resolves.toMatchObject({ ok: false, code: 'rechazado' });
  });
});
