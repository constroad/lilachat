import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConversacionContext, type ContextoDeLaConversacion } from '../contextoDeLaConversacion';
import type { ChatSummary } from '../types';
import { workPlanSummary, type WorkStage } from '@lilachat/shared';
import { WorkPlanWeb, type WorkPlanWebState } from './WorkPlanWeb';

/** Pending 21: the «Checklist» tab of a channel on the web. */
const task = (id: string, done: boolean) => ({ id, text: id, doneBy: done ? 'u1' : null, doneAt: done ? '2026-10-20T00:00:00Z' : null });
const stages: WorkStage[] = [
  { _id: 's1', title: 'Cotización', stage: 1, items: [task('a', true)] },
  { _id: 's2', title: 'Orden de compra y servicio', stage: 2, items: [task('b', false), task('c', false)] },
];
const planOf = (list: WorkStage[] | null, start = vi.fn(async () => null)): WorkPlanWebState => ({ stages: list, summary: list ? workPlanSummary(list, new Date('2026-10-28T12:00:00Z')) : null, failed: false, start, reload: vi.fn(async () => undefined) });

const channel: ChatSummary = { id: 'c9', kind: 'group', name: 'obra', workspaceId: 'w1', memberIds: ['yo'], lastSeq: 0, unread: 0, lastMessage: null, othersReadSeq: 0, othersDeliveredSeq: 0 };
const context: ContextoDeLaConversacion = { yo: 'yo', jwt: 'j', chat: channel, detalle: null, nombres: new Map(), citado: () => undefined, onAccion: vi.fn(), onVerFoto: vi.fn(), puedeFijar: false, fijados: new Set() };
const renderPlan = (plan: WorkPlanWebState) => render(<ConversacionContext.Provider value={context}><WorkPlanWeb plan={plan} onOpenTask={vi.fn()} /></ConversacionContext.Provider>);

afterEach(() => vi.unstubAllGlobals());

describe('WorkPlanWeb', () => {
  it('a channel without a plan offers to start it with its stages', () => {
    const start = vi.fn(async () => null);
    renderPlan(planOf([], start));

    fireEvent.click(screen.getByTestId('btn-armar-checklist-de-obra'));
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('shows the current stage, the progress and each stage with its state', () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'x' }), { status: 404 })));
    renderPlan(planOf(stages));

    const summary = screen.getByTestId('resumen-de-obra');
    expect(summary).toHaveTextContent('Orden de compra y servicio');
    expect(summary).toHaveTextContent('33%');
    expect(screen.getByTestId('etapa-1')).toHaveTextContent('HECHO');
    expect(screen.getByTestId('etapa-2')).toHaveTextContent('0 de 2 ítems completados');
  });
});
