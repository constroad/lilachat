import { useState } from 'react';
import { CHAT_FONT, CHAT_FONT_CHOICES, type ChatFontChoice as Choice } from '@lilachat/shared';
import { chatFontPixels, readChatFont, saveChatFont } from './chatFont';

/** «Tamaño de la letra: Pequeña · Mediana · Grande», each «Aa» at its size (backlog 1; design `f-01-tamano-de-letra`). */
export function ChatFontChoice() {
  const [choice, setChoice] = useState<Choice>(readChatFont);
  return (
    <div className="mb-1 border-b border-outline/15 px-2 pb-3 pt-1">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">Tamaño de la letra</p>
      <div role="radiogroup" aria-label="Tamaño de la letra" className="grid grid-cols-3 gap-1 rounded-lg border border-outline/15 p-1">
        {CHAT_FONT_CHOICES.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={choice === value}
            data-testid={`letra-${value}`}
            onClick={() => {
              setChoice(value);
              saveChatFont(value);
            }}
            className={`flex min-h-[52px] flex-col items-center justify-center rounded-md border ${choice === value ? 'border-primary bg-primary/[0.06] text-primary' : 'border-transparent text-on-surface-variant hover:bg-background'}`}
          >
            <span className="font-bold leading-none" style={{ fontSize: chatFontPixels(value).size + 3 }}>Aa</span>
            <span className="mt-1 text-[12px] font-semibold">{CHAT_FONT[value].label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
