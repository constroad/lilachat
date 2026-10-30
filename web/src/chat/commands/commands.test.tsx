import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CommandGroup, EphemeralAnswer } from '@lilachat/shared';
import { Composer } from '../Composer';
import { CommandPanel } from './CommandPanel';
import { EphemeralAnswers } from './EphemeralAnswers';
import type { ChatCommands } from './useChatCommands';

const groups: CommandGroup[] = [
  { appId: 'a1', appName: 'Inframaq', commands: [{ command: 'clima', description: 'Clima de la planta', usageHint: '[mañana]' }, { command: 'tanques', description: 'Nivel de los tanques' }] },
  { appId: 'a2', appName: 'Portal', commands: [{ command: 'asistencia', description: 'Quién marcó hoy' }] },
];

const stubCommands = (overrides: Partial<ChatCommands> = {}): ChatCommands => ({
  enabled: true,
  suggestions: [],
  activeCommand: null,
  onType: vi.fn(),
  onKey: vi.fn(() => false),
  runIfCommand: vi.fn(async () => 'not-command' as const),
  answers: [],
  dismiss: vi.fn(),
  appAnswers: { answers: [], track: vi.fn(), runAction: vi.fn(), uploadPhoto: vi.fn(), submitForm: vi.fn(), refreshForm: vi.fn(), previewForm: vi.fn(), dismiss: vi.fn(), removeAnswer: vi.fn(), say: vi.fn(), openForm: null, showForm: vi.fn() },
  actions: [],
  loadActions: vi.fn(async () => null),
  share: undefined,
  jwt: 'jwt',
  chatId: 'c1',
  ...overrides,
});

const composer = (commands: ChatCommands, onSend = vi.fn()) =>
  render(<Composer chatId="c1" onSend={onSend} onCreateEvent={() => undefined} onCreatePoll={() => undefined} onElegirArchivos={() => undefined} commands={commands} />);

describe('CommandPanel (design e-20)', () => {
  it('groups the commands by app; the active one shows its example and Enter', () => {
    // Arrange
    const onPick = vi.fn();
    render(<CommandPanel groups={groups} active="clima" onPick={onPick} />);
    // Act
    fireEvent.click(screen.getByTestId('comando-asistencia'));
    // Assert
    expect(screen.getByText('Inframaq')).toBeInTheDocument();
    expect(screen.getByText('Portal')).toBeInTheDocument();
    expect(screen.getByText('Ejemplo de uso:')).toBeInTheDocument();
    expect(screen.getByTestId('comando-clima')).toHaveAttribute('aria-selected', 'true');
    expect(onPick).toHaveBeenCalledWith('asistencia');
  });

  it('nothing to suggest, nothing drawn', () => {
    const { container } = render(<CommandPanel groups={[]} active={null} onPick={() => undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('EphemeralAnswers', () => {
  const answers: EphemeralAnswer[] = [
    { commandId: 'c1', appName: 'Inframaq', command: 'clima', state: 'pending' },
    { commandId: 'c2', appName: 'Portal', command: 'asistencia', state: 'failed', message: 'Portal no pudo responder.' },
    { commandId: 'c3', appName: 'Inframaq', command: 'tanques', state: 'answered', response: { responseType: 'ephemeral', text: 'Tanque 1: 81 %' } },
  ];

  it('a stack like Claude\'s chips: the newest open, the others folded in one line, each can be dismissed (pending 104)', () => {
    // Arrange
    const onDismiss = vi.fn();
    render(<EphemeralAnswers answers={answers} onDismiss={onDismiss} chatId="c1" jwt="jwt" />);
    // Act
    fireEvent.click(screen.getAllByTestId('btn-descartar-efimera')[2]!);
    // Assert
    expect(screen.getByText('Solo tú ves esto · 3')).toBeInTheDocument();
    expect(screen.getByText('Tanque 1: 81 %')).toBeInTheDocument();
    expect(screen.getByText('Inframaq está trabajando…')).toBeInTheDocument();
    expect(screen.getByText('Portal no pudo responder.')).toBeInTheDocument();
    expect(screen.queryByTestId('efimera-pensando')).toBeNull();
    expect(onDismiss).toHaveBeenCalledWith('c3');
    expect(screen.queryByTestId('btn-enviar-al-canal')).toBeNull();
  });

  it('tapping a folded chip opens it and folds the open one; «Cerrar todas» dismisses every answer', () => {
    // Arrange
    const onDismiss = vi.fn();
    render(<EphemeralAnswers answers={answers} onDismiss={onDismiss} chatId="c1" jwt="jwt" />);
    // Act
    fireEvent.click(screen.getByTestId('efimera-plegar-c1'));
    fireEvent.click(screen.getByTestId('btn-cerrar-todas-efimeras'));
    // Assert
    expect(screen.getByTestId('efimera-pensando')).toBeInTheDocument();
    expect(screen.getByTestId('efimera-plegar-c1')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('efimera-plegar-c3')).toHaveAttribute('aria-expanded', 'false');
    expect(onDismiss.mock.calls.map(([id]) => id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('a single answer has no «Cerrar todas»', () => {
    render(<EphemeralAnswers answers={[answers[2]!]} onDismiss={() => undefined} chatId="c1" jwt="jwt" />);
    expect(screen.queryByTestId('btn-cerrar-todas-efimeras')).toBeNull();
    expect(screen.getByText('Solo tú ves esto · 1')).toBeInTheDocument();
  });

  it('in a channel an answer can be sent there; if it cannot, the card says why', async () => {
    // Arrange
    const onShare = vi.fn(async () => 'La app no está en este canal.');
    render(<EphemeralAnswers answers={answers} onDismiss={() => undefined} onShare={onShare} chatId="c1" jwt="jwt" />);
    // Act
    fireEvent.click(screen.getByTestId('btn-enviar-al-canal'));
    // Assert
    expect(screen.getAllByTestId('btn-enviar-al-canal')).toHaveLength(1);
    expect(onShare).toHaveBeenCalledWith('c3');
    expect(await screen.findByText('La app no está en este canal.')).toBeInTheDocument();
  });

  it('a link in the answer opens (E2E 28/10: the quote\'s link could not be tapped)', () => {
    // Arrange
    const quote: EphemeralAnswer = { commandId: 'c4', appName: 'Portal', command: '', state: 'answered', response: { responseType: 'ephemeral', text: 'Cotización N° 20260064. Ábrela: https://constroad.com/admin/cotizar/editor/simple/6ae1f5774b5867096e4bf9b7' } };
    // Act
    render(<EphemeralAnswers answers={[quote]} onDismiss={() => undefined} chatId="c1" jwt="jwt" />);
    // Assert
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://constroad.com/admin/cotizar/editor/simple/6ae1f5774b5867096e4bf9b7');
    expect(screen.getByText(/Cotización N° 20260064/)).toBeInTheDocument();
  });
});

describe('Composer with commands', () => {
  it('a known command goes to the app, not to the chat', async () => {
    // Arrange
    const onSend = vi.fn();
    const commands = stubCommands({ runIfCommand: vi.fn(async () => true) });
    composer(commands, onSend);
    // Act
    fireEvent.change(screen.getByTestId('input-mensaje'), { target: { value: '/clima mañana' } });
    fireEvent.keyDown(screen.getByTestId('input-mensaje'), { key: 'Enter' });
    await Promise.resolve();
    // Assert
    expect(commands.onType).toHaveBeenCalledWith('/clima mañana');
    expect(commands.runIfCommand).toHaveBeenCalledWith('/clima mañana');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('in a space chat the field says that «/» brings the commands; elsewhere it does not', () => {
    const { unmount } = composer(stubCommands());
    expect(screen.getByTestId('input-mensaje')).toHaveAttribute('placeholder', 'Escribe un mensaje o / para comandos');
    unmount();
    composer(stubCommands({ enabled: false }));
    expect(screen.getByTestId('input-mensaje')).toHaveAttribute('placeholder', 'Escribe un mensaje...');
  });

  it('an unknown slash is a normal message, once the space\'s commands are known', async () => {
    const onSend = vi.fn();
    composer(stubCommands(), onSend);
    fireEvent.change(screen.getByTestId('input-mensaje'), { target: { value: '/no-existe' } });
    fireEvent.keyDown(screen.getByTestId('input-mensaje'), { key: 'Enter' });
    await vi.waitFor(() => expect(onSend).toHaveBeenCalledWith('/no-existe', undefined));
  });

  it('picking a suggestion writes «/command » and keeps the field', () => {
    // Arrange
    const commands = stubCommands({ suggestions: groups, activeCommand: 'clima' });
    composer(commands);
    // Act
    fireEvent.click(screen.getByTestId('comando-tanques'));
    // Assert
    expect(screen.getByTestId('input-mensaje')).toHaveValue('/tanques ');
    expect(commands.onType).toHaveBeenCalledWith('/tanques ');
  });
});

describe('the apps\' actions live in the ⚡, not in the «+» (pending 111, José 28/10)', () => {
  it('the «+» shows only what to share and organize: no app actions, nothing asked for them', () => {
    // Arrange
    const row = { kind: 'shortcut' as const, appId: 'a1', appName: 'Inframaq', key: 'marcar_asistencia', name: 'Marcar asistencia' };
    const commands = stubCommands({ actions: [row] });
    composer(commands);
    // Act
    fireEvent.click(screen.getByTestId('btn-mas'));
    // Assert
    expect(screen.getByTestId('btn-archivo-chat')).toBeInTheDocument();
    expect(screen.queryByTestId('acciones-de-apps')).toBeNull();
    expect(screen.queryByTestId('accion-marcar_asistencia')).toBeNull();
    expect(commands.loadActions).not.toHaveBeenCalled();
  });

  it('an answer marked shareable:false has no «Enviar al canal»; a pending form can be reopened', () => {
    const onOpenForm = vi.fn();
    const privateAnswer: EphemeralAnswer = { commandId: 'c9', appName: 'Portal', command: 'deudas', state: 'answered', response: { responseType: 'ephemeral', text: 'Debes S/ 120', shareable: false } };
    const form: EphemeralAnswer = { commandId: 'c8', appName: 'Inframaq', command: '', action: 'Marcar asistencia', state: 'form', response: { responseType: 'form', form: { id: 'registrar_marca', title: 'Marcar asistencia', schema: { type: 'object', properties: {} } } } };
    render(<EphemeralAnswers answers={[privateAnswer, form]} onDismiss={() => undefined} onShare={vi.fn()} onOpenForm={onOpenForm} chatId="c1" jwt="jwt" />);
    fireEvent.click(screen.getByTestId('btn-abrir-formulario'));
    expect(screen.getByText('Marcar asistencia')).toBeInTheDocument();
    expect(onOpenForm).toHaveBeenCalledWith('c8');
    fireEvent.click(screen.getByTestId('efimera-plegar-c9'));
    expect(screen.getByText('Debes S/ 120')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-enviar-al-canal')).toBeNull();
  });
});
