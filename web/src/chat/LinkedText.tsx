import { partirEnEnlaces } from '@lilachat/shared';

/**
 * A text with its links, mails and phones that open: a message's bubble and an
 * app's answer («Solo tú ves esto», E2E 28/10: the quote's link could not be
 * opened). `own` is my bubble: the link takes the text's colour there.
 */
export function LinkedText({ text, own }: { text: string; own: boolean }) {
  return (
    <>
      {partirEnEnlaces(text).map((part, index) =>
        part.tipo === 'texto' ? (
          <span key={index}>{part.texto}</span>
        ) : (
          <a key={index} href={part.destino} target={part.tipo === 'url' ? '_blank' : undefined} rel="noopener noreferrer" className={`underline underline-offset-2 ${own ? '' : 'text-primary'}`}>
            {part.texto}
          </a>
        )
      )}
    </>
  );
}
