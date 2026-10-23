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
  isCommand: vi.fn(() => false),
  run: vi.fn(async () => true),
  answers: [],
  dismiss: vi.fn(),
  jwt: 'jwt',
  chatId: 'c1',
  ...overrides,
});

const composer = (commands: ChatCommands, onSend = vi.fn()) =>
  render(<Composer onSend={onSend} onCreateEvent={() => undefined} onCreatePoll={() => undefined} onElegirArchivos={() => undefined} commands={commands} />);

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

  it('working, failed and answered, each one only for me, and each can be dismissed', () => {
    // Arrange
    const onDismiss = vi.fn();
    render(<EphemeralAnswers answers={answers} onDismiss={onDismiss} chatId="c1" jwt="jwt" />);
    // Act
    fireEvent.click(screen.getAllByTestId('btn-descartar-efimera')[2]!);
    // Assert
    expect(screen.getByText('Inframaq está trabajando…')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Portal no pudo responder.');
    expect(screen.getByText('Tanque 1: 81 %')).toBeInTheDocument();
    expect(screen.getAllByText(/Solo tú ves esto/)).toHaveLength(3);
    expect(onDismiss).toHaveBeenCalledWith('c3');
  });
});

describe('Composer with commands', () => {
  it('a known command goes to the app, not to the chat', async () => {
    // Arrange
    const onSend = vi.fn();
    const commands = stubCommands({ isCommand: vi.fn(() => true) });
    composer(commands, onSend);
    // Act
    fireEvent.change(screen.getByTestId('input-mensaje'), { target: { value: '/clima mañana' } });
    fireEvent.keyDown(screen.getByTestId('input-mensaje'), { key: 'Enter' });
    // Assert
    expect(commands.onType).toHaveBeenCalledWith('/clima mañana');
    expect(commands.run).toHaveBeenCalledWith('/clima mañana');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('an unknown slash is a normal message', () => {
    const onSend = vi.fn();
    composer(stubCommands(), onSend);
    fireEvent.change(screen.getByTestId('input-mensaje'), { target: { value: '/no-existe' } });
    fireEvent.keyDown(screen.getByTestId('input-mensaje'), { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('/no-existe', undefined);
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
