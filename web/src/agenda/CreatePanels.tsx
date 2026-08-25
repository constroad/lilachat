import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  planTargetChat,
  validatePoll,
  type Contact,
  type ContactGroup,
} from '@lilachat/shared';
import { api } from '../api';
import { ContactPicker } from '../contacts/ContactPicker';
import { FieldError, Overlay, PrimaryButton } from '../ui/Overlay';

/**
 * Todo lo que la web puede CREAR: chat, grupo, evento y encuesta.
 *
 * Viven juntos porque comparten las tres mismas piezas —el modal, el selector de
 * contactos y el plan de conversación destino de `planTargetChat`— y separarlos
 * en cuatro archivos habría duplicado ese cableado cuatro veces.
 *
 * Las dos formas de llegar acá son deliberadas y distintas:
 *
 * - desde el menú de la lista: se eligen CONTACTOS, y la conversación se crea
 *   sola (uno = chat directo; varios = grupo con el nombre del evento).
 * - desde adentro de un chat (el «+» del composer, como en WhatsApp): la
 *   conversación ya está decidida y no se pregunta nada.
 */
export type ChatDestino = { id: string; name?: string | null };

/** Los contactos, pedidos una vez por apertura del modal. */
function useContactos(jwt: string, activo: boolean) {
  const [groups, setGroups] = useState<ContactGroup[] | null>(null);

  useEffect(() => {
    if (!activo) return;
    let vigente = true;
    void (async () => {
      const resultado = await api<{ groups: ContactGroup[] }>('/contacts', { jwt });
      if (vigente) setGroups(resultado.ok ? resultado.data.groups : []);
    })();
    return () => {
      vigente = false;
    };
  }, [jwt, activo]);

  return groups;
}

function useSeleccion(multiple: boolean) {
  const [selected, setSelected] = useState<Contact[]>([]);
  const toggle = (contacto: Contact) =>
    setSelected((actual) => {
      const yaEsta = actual.some((uno) => uno.id === contacto.id);
      if (yaEsta) return actual.filter((uno) => uno.id !== contacto.id);
      return multiple ? [...actual, contacto] : [contacto];
    });
  return { selected, toggle };
}

/** Crea el chat que haga falta y devuelve su id, o el mensaje de por qué no. */
async function resolverChat(params: {
  jwt: string;
  fixedChatId?: string | null;
  invitados: Contact[];
  groupName: string;
}): Promise<{ ok: true; chatId: string } | { ok: false; message: string }> {
  const plan = planTargetChat({
    fixedChatId: params.fixedChatId,
    inviteeIds: params.invitados.map((contacto) => contacto.id),
    groupName: params.groupName,
  });

  if (plan.kind === 'invalid') return { ok: false, message: plan.message };
  if (plan.kind === 'existing') return { ok: true, chatId: plan.chatId };

  const creado = await api<{ chatId: string }>('/chats', { jwt: params.jwt, body: plan.chat });
  if (!creado.ok) return { ok: false, message: creado.message };
  return { ok: true, chatId: creado.data.chatId };
}

/** Nuevo chat (uno a uno) o nuevo grupo, según `kind`. */
export function NewChatOverlay({
  jwt,
  kind,
  onClose,
  onCreated,
}: {
  jwt: string;
  kind: 'direct' | 'group';
  onClose: () => void;
  onCreated: (chatId: string) => void;
}) {
  const groups = useContactos(jwt, true);
  const { selected, toggle } = useSeleccion(kind === 'group');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const crear = async () => {
    if (guardando) return;
    if (selected.length === 0) return setError('Elige con quién quieres hablar.');
    if (kind === 'group' && !name.trim()) return setError('Ponle un nombre al grupo.');

    setGuardando(true);
    setError('');
    const resultado = await api<{ chatId: string }>('/chats', {
      jwt,
      body: {
        kind,
        memberIds: selected.map((contacto) => contacto.id),
        ...(kind === 'group' ? { name: name.trim() } : {}),
      },
    });
    setGuardando(false);

    if (!resultado.ok) return setError(resultado.message);
    onCreated(resultado.data.chatId);
  };

  return (
    <Overlay
      title={kind === 'group' ? 'Nuevo grupo' : 'Nuevo chat'}
      onClose={onClose}
      footer={
        <>
          <PrimaryButton testId="btn-crear-chat" onClick={() => void crear()} disabled={guardando}>
            {kind === 'group' ? 'Crear grupo' : 'Empezar a chatear'}
          </PrimaryButton>
          <FieldError>{error}</FieldError>
        </>
      }
    >
      {kind === 'group' ? (
        <label className="mb-3 block">
          <span className="text-[12px] font-semibold text-on-surface-variant">
            Nombre del grupo <span className="text-error">*</span>
          </span>
          <input
            data-testid="nombre-grupo"
            value={name}
            onChange={(evento) => {
              setName(evento.target.value);
              setError('');
            }}
            placeholder="Familia, Viaje a Cusco…"
            aria-invalid={Boolean(error) && !name.trim()}
            className="mt-1 h-11 w-full rounded-xl border border-outline/25 bg-background px-3 text-sm outline-none focus:border-primary aria-[invalid=true]:border-error"
          />
        </label>
      ) : null}

      <ContactPicker
        groups={groups ?? []}
        selected={selected}
        onToggle={(contacto) => {
          toggle(contacto);
          setError('');
        }}
        loading={groups === null}
        multiple={kind === 'group'}
      />
    </Overlay>
  );
}

/** Cuándo es el evento, en pasos que la gente usa de verdad. */
const CUANDO = [
  { label: 'En 1 hora', horas: 1 },
  { label: 'Esta tarde', horas: 6 },
  { label: 'Mañana', horas: 24 },
  { label: 'El fin de semana', horas: 72 },
];

export function CreateEventOverlay({
  jwt,
  chat,
  onClose,
  onCreated,
}: {
  jwt: string;
  /** Si viene, el evento cuelga de ESE chat y no se piden invitados. */
  chat?: ChatDestino | null;
  onClose: () => void;
  onCreated: (chatId: string) => void;
}) {
  const groups = useContactos(jwt, !chat);
  const { selected, toggle } = useSeleccion(true);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [horas, setHoras] = useState(24);
  const [cuandoExacto, setCuandoExacto] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const crear = async () => {
    if (guardando) return;
    if (!title.trim()) return setError('Ponle un nombre al evento.');

    setGuardando(true);
    setError('');
    const destino = await resolverChat({
      jwt,
      fixedChatId: chat?.id,
      invitados: selected,
      groupName: title,
    });
    if (!destino.ok) {
      setGuardando(false);
      return setError(destino.message);
    }

    // La fecha exacta gana sobre el atajo: quien se tomó el trabajo de escribir
    // el día y la hora no quiere «en 24 horas».
    const startsAt = cuandoExacto
      ? new Date(cuandoExacto)
      : new Date(Date.now() + horas * 3_600_000);

    const resultado = await api<{ id: string }>('/agenda/events', {
      jwt,
      body: {
        chatId: destino.chatId,
        title: title.trim(),
        location: location.trim() || undefined,
        startsAt: startsAt.toISOString(),
      },
    });
    setGuardando(false);

    if (!resultado.ok) return setError(resultado.message);
    onCreated(destino.chatId);
  };

  return (
    <Overlay
      title="Nuevo evento"
      onClose={onClose}
      footer={
        <>
          <PrimaryButton testId="btn-crear-evento" onClick={() => void crear()} disabled={guardando}>
            Crear evento
          </PrimaryButton>
          <FieldError>{error}</FieldError>
        </>
      }
    >
      <label className="block">
        <span className="text-[12px] font-semibold text-on-surface-variant">
          ¿Qué es? <span className="text-error">*</span>
        </span>
        <input
          data-testid="titulo-evento"
          value={title}
          onChange={(evento) => {
            setTitle(evento.target.value);
            setError('');
          }}
          placeholder="Almuerzo del domingo"
          aria-invalid={Boolean(error) && !title.trim()}
          className="mt-1 h-11 w-full rounded-xl border border-outline/25 bg-background px-3 text-sm outline-none focus:border-primary aria-[invalid=true]:border-error"
        />
      </label>

      <label className="mt-3 block">
        <span className="text-[12px] font-semibold text-on-surface-variant">¿Dónde?</span>
        <input
          data-testid="lugar-evento"
          value={location}
          onChange={(evento) => setLocation(evento.target.value)}
          placeholder="Casa de la abuela"
          className="mt-1 h-11 w-full rounded-xl border border-outline/25 bg-background px-3 text-sm outline-none focus:border-primary"
        />
      </label>

      <fieldset className="mt-4">
        <legend className="text-[12px] font-semibold text-on-surface-variant">¿Cuándo?</legend>
        {/* Rejilla y no una fila: en una sola línea «El fin de semana» se elide,
            y un atajo que no se lee entero no es un atajo. */}
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          {CUANDO.map((opcion) => (
            <button
              key={opcion.horas}
              type="button"
              aria-pressed={!cuandoExacto && horas === opcion.horas}
              onClick={() => {
                setHoras(opcion.horas);
                setCuandoExacto('');
              }}
              className={`min-h-[44px] min-w-0 rounded-xl px-2 text-[12px] font-medium transition-colors ${
                !cuandoExacto && horas === opcion.horas
                  ? 'bg-primary text-on-primary'
                  : 'bg-background text-on-surface-variant hover:bg-primary/10'
              }`}
            >
              <span className="block truncate">{opcion.label}</span>
            </button>
          ))}
        </div>
        <input
          type="datetime-local"
          data-testid="fecha-evento"
          value={cuandoExacto}
          onChange={(evento) => setCuandoExacto(evento.target.value)}
          className="mt-2 h-11 w-full rounded-xl border border-outline/25 bg-background px-3 text-sm outline-none focus:border-primary"
        />
      </fieldset>

      {chat ? (
        <p className="mt-4 rounded-xl bg-background px-3 py-2.5 text-[12px] leading-4 text-on-surface-variant">
          Se avisa en <strong className="font-semibold">{chat.name ?? 'esta conversación'}</strong>.
        </p>
      ) : (
        <div className="mt-4">
          <p className="text-[12px] font-semibold text-on-surface-variant">
            ¿A quién invitas? <span className="text-error">*</span>
          </p>
          <div className="mt-1">
            <ContactPicker
              groups={groups ?? []}
              selected={selected}
              onToggle={(contacto) => {
                toggle(contacto);
                setError('');
              }}
              loading={groups === null}
              multiple
            />
          </div>
        </div>
      )}
    </Overlay>
  );
}

export function CreatePollOverlay({
  jwt,
  chat,
  onClose,
  onCreated,
}: {
  jwt: string;
  chat?: ChatDestino | null;
  onClose: () => void;
  onCreated: (chatId: string) => void;
}) {
  const groups = useContactos(jwt, !chat);
  const { selected, toggle } = useSeleccion(true);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cambiarOpcion = (indice: number, valor: string) => {
    setOptions((actual) => actual.map((texto, i) => (i === indice ? valor : texto)));
    setError('');
  };

  const crear = async () => {
    if (guardando) return;
    // La MISMA validación que corre el server: si acá pasara algo que allá se
    // rechaza, el formulario se llena para morir al enviar.
    const invalido = validatePoll({ question, options });
    if (invalido) return setError(invalido);

    setGuardando(true);
    setError('');
    const destino = await resolverChat({
      jwt,
      fixedChatId: chat?.id,
      invitados: selected,
      groupName: question,
    });
    if (!destino.ok) {
      setGuardando(false);
      return setError(destino.message);
    }

    const resultado = await api<{ id: string }>('/agenda/polls', {
      jwt,
      body: {
        chatId: destino.chatId,
        question: question.trim(),
        options: options.map((texto) => texto.trim()).filter(Boolean),
        allowMultiple,
      },
    });
    setGuardando(false);

    if (!resultado.ok) return setError(resultado.message);
    onCreated(destino.chatId);
  };

  return (
    <Overlay
      title="Nueva encuesta"
      onClose={onClose}
      footer={
        <>
          <PrimaryButton
            testId="btn-crear-encuesta"
            onClick={() => void crear()}
            disabled={guardando}
          >
            Crear encuesta
          </PrimaryButton>
          <FieldError>{error}</FieldError>
        </>
      }
    >
      <label className="block">
        <span className="text-[12px] font-semibold text-on-surface-variant">
          Pregunta <span className="text-error">*</span>
        </span>
        <input
          data-testid="pregunta-encuesta"
          value={question}
          onChange={(evento) => {
            setQuestion(evento.target.value);
            setError('');
          }}
          placeholder="¿Dónde almorzamos el domingo?"
          aria-invalid={Boolean(error) && !question.trim()}
          className="mt-1 h-11 w-full rounded-xl border border-outline/25 bg-background px-3 text-sm outline-none focus:border-primary aria-[invalid=true]:border-error"
        />
      </label>

      <fieldset className="mt-4">
        <legend className="text-[12px] font-semibold text-on-surface-variant">
          Opciones <span className="text-error">*</span>
        </legend>
        {options.map((texto, indice) => (
          <div key={indice} className="mt-1.5 flex items-center gap-2">
            <input
              data-testid={`opcion-${indice}`}
              value={texto}
              onChange={(evento) => cambiarOpcion(indice, evento.target.value)}
              placeholder={`Opción ${indice + 1}`}
              className="h-11 min-w-0 flex-1 rounded-xl border border-outline/25 bg-background px-3 text-sm outline-none focus:border-primary"
            />
            {options.length > 2 ? (
              <button
                type="button"
                aria-label={`Quitar opción ${indice + 1}`}
                onClick={() => setOptions((actual) => actual.filter((_, i) => i !== indice))}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-on-surface-variant hover:bg-background"
              >
                <Trash2 size={16} />
              </button>
            ) : null}
          </div>
        ))}
        {options.length < 10 ? (
          <button
            type="button"
            data-testid="agregar-opcion"
            onClick={() => setOptions((actual) => [...actual, ''])}
            className="mt-2 text-[13px] font-semibold text-primary"
          >
            + Agregar opción
          </button>
        ) : null}
      </fieldset>

      <label className="mt-4 flex items-center gap-3">
        <input
          type="checkbox"
          data-testid="varias-respuestas"
          checked={allowMultiple}
          onChange={(evento) => setAllowMultiple(evento.target.checked)}
          className="h-4 w-4 accent-[currentColor] text-primary"
        />
        <span className="text-sm">Se puede votar por varias</span>
      </label>

      {chat ? (
        <p className="mt-4 rounded-xl bg-background px-3 py-2.5 text-[12px] leading-4 text-on-surface-variant">
          Se pregunta en{' '}
          <strong className="font-semibold">{chat.name ?? 'esta conversación'}</strong>.
        </p>
      ) : (
        <div className="mt-4">
          <p className="text-[12px] font-semibold text-on-surface-variant">
            ¿A quién le preguntas? <span className="text-error">*</span>
          </p>
          <div className="mt-1">
            <ContactPicker
              groups={groups ?? []}
              selected={selected}
              onToggle={(contacto) => {
                toggle(contacto);
                setError('');
              }}
              loading={groups === null}
              multiple
            />
          </div>
        </div>
      )}
    </Overlay>
  );
}
