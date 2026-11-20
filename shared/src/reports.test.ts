import { describe, expect, it } from 'vitest';
import {
  REPORT_NOTE_MAX,
  REPORT_REASONS,
  canReportMessage,
  canSendReport,
  reportNoticeText,
  reportPriorityOf,
  reportReasonLabel,
  sortReportQueue,
  validateReportInput,
} from './reports.js';

const USER_ID = 'a'.repeat(24);
const CHAT_ID = 'b'.repeat(24);

/** Google Play (José 19/11): report a person or a message from inside the app. */
describe('report reasons', () => {
  it('offers the seven reasons, «Otro» last', () => {
    // Arrange / Act
    const ids = REPORT_REASONS.map((reason) => reason.id);
    // Assert
    expect(ids).toEqual(['spam', 'harassment', 'sexual', 'child_abuse', 'violence', 'impersonation', 'other']);
    expect(reportReasonLabel('child_abuse')).toBe('Abuso infantil');
  });

  it('child abuse is high priority; everything else normal', () => {
    expect(reportPriorityOf('child_abuse')).toBe('high');
    expect(reportPriorityOf('spam')).toBe('normal');
    expect(reportPriorityOf('other')).toBe('normal');
  });
});

describe('validateReportInput', () => {
  it('a message report needs its chat and seq; the person comes from the server', () => {
    // Act
    const outcome = validateReportInput({ target: 'message', chatId: CHAT_ID, seq: 12, reason: 'spam', alsoBlock: true });
    // Assert
    expect(outcome).toEqual({ ok: true, value: { target: 'message', chatId: CHAT_ID, seq: 12, reason: 'spam', note: '', alsoBlock: true } });
  });

  it('a person report needs the person; the chat is optional', () => {
    expect(validateReportInput({ target: 'user', userId: USER_ID, reason: 'harassment' })).toEqual({ ok: true, value: { target: 'user', userId: USER_ID, reason: 'harassment', note: '', alsoBlock: false } });
    expect(validateReportInput({ target: 'user', userId: USER_ID, chatId: CHAT_ID, reason: 'violence', note: '  me amenazó  ' })).toEqual({
      ok: true,
      value: { target: 'user', userId: USER_ID, chatId: CHAT_ID, reason: 'violence', note: 'me amenazó', alsoBlock: false },
    });
  });

  it('rejects an unknown reason, a missing target and a bad seq', () => {
    expect(validateReportInput({ target: 'user', userId: USER_ID, reason: 'aburrido' }).ok).toBe(false);
    expect(validateReportInput({ target: 'nadie', reason: 'spam' }).ok).toBe(false);
    expect(validateReportInput({ target: 'user', userId: 'x', reason: 'spam' }).ok).toBe(false);
    expect(validateReportInput({ target: 'message', chatId: CHAT_ID, seq: 0, reason: 'spam' }).ok).toBe(false);
    expect(validateReportInput({ target: 'message', chatId: CHAT_ID, seq: 1.5, reason: 'spam' }).ok).toBe(false);
    expect(validateReportInput({ target: 'message', seq: 3, reason: 'spam' }).ok).toBe(false);
    expect(validateReportInput(null).ok).toBe(false);
  });

  it('«Otro» needs a text; a note longer than the limit is refused', () => {
    expect(validateReportInput({ target: 'user', userId: USER_ID, reason: 'other', note: '   ' })).toEqual({ ok: false, reason: 'Cuéntanos qué pasó.' });
    expect(validateReportInput({ target: 'user', userId: USER_ID, reason: 'spam', note: 'x'.repeat(REPORT_NOTE_MAX + 1) }).ok).toBe(false);
    expect(validateReportInput({ target: 'user', userId: USER_ID, reason: 'spam', note: 'x'.repeat(REPORT_NOTE_MAX) }).ok).toBe(true);
  });

  it('a note that is not text is ignored, not an error', () => {
    expect(validateReportInput({ target: 'user', userId: USER_ID, reason: 'spam', note: 42 })).toMatchObject({ ok: true, value: { note: '' } });
  });
});

describe('canReportMessage', () => {
  it('only someone else’s live message, never a notice of the system', () => {
    expect(canReportMessage({ mine: false, deleted: false, kind: 'text' })).toBe(true);
    expect(canReportMessage({ mine: true, deleted: false, kind: 'text' })).toBe(false);
    expect(canReportMessage({ mine: false, deleted: true, kind: 'image' })).toBe(false);
    expect(canReportMessage({ mine: false, deleted: false, kind: 'system' })).toBe(false);
  });
});

describe('sortReportQueue', () => {
  it('open first, child abuse on top of them, newest first within each group', () => {
    // Arrange
    const reports = [
      { id: 'old-spam', status: 'open' as const, priority: 'normal' as const, createdAt: '2026-11-18T10:00:00.000Z' },
      { id: 'closed-abuse', status: 'resolved' as const, priority: 'high' as const, createdAt: '2026-11-19T12:00:00.000Z' },
      { id: 'new-spam', status: 'open' as const, priority: 'normal' as const, createdAt: '2026-11-19T10:00:00.000Z' },
      { id: 'abuse', status: 'open' as const, priority: 'high' as const, createdAt: '2026-11-17T10:00:00.000Z' },
    ];
    // Act
    const order = sortReportQueue(reports).map((report) => report.id);
    // Assert
    expect(order).toEqual(['abuse', 'new-spam', 'old-spam', 'closed-abuse']);
  });
});

describe('reportNoticeText', () => {
  it('says where and why, never what was written', () => {
    expect(reportNoticeText({ reason: 'spam', place: 'Inframaq' })).toEqual({ title: 'Nueva denuncia', body: 'Spam en Inframaq. Revísala en el panel.' });
    expect(reportNoticeText({ reason: 'child_abuse', place: null })).toEqual({ title: 'Denuncia urgente', body: 'Abuso infantil. Revísala en el panel.' });
    expect(reportNoticeText({ reason: 'harassment', place: 'Inframaq', forSpaceAdmins: true })).toEqual({ title: 'Nueva denuncia', body: 'Acoso o intimidación en Inframaq. El equipo de Lilachat la revisa.' });
  });
});

describe('canSendReport', () => {
  it('needs a reason; «Otro» needs a text; the limit holds', () => {
    // Arrange
    const tooLong = 'x'.repeat(REPORT_NOTE_MAX + 1);
    // Act / Assert
    expect(canSendReport(null, '')).toBe(false);
    expect(canSendReport('spam', '')).toBe(true);
    expect(canSendReport('other', '  ')).toBe(false);
    expect(canSendReport('other', 'me escribe de noche')).toBe(true);
    expect(canSendReport('spam', tooLong)).toBe(false);
  });
});
