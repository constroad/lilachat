/**
 * The name a voice note keeps on the phone once it is downloaded (José, 21/10:
 * «en Lilachat carga y luego reproduce; en WhatsApp reproduce al toque»). Its
 * storage name made safe for the disk, after a short hash of its whole path so
 * two notes with the same last segment never share a file. PURE.
 */
const shortHash = (text: string): string => {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) hash = ((hash * 33) ^ text.charCodeAt(index)) >>> 0;
  return hash.toString(36);
};

export function voiceNoteFileName(url: string): string | null {
  const path = url.split(/[?#]/)[0] ?? '';
  const last = path.split('/').filter(Boolean).pop();
  if (!last) return null;
  const safe = last.replace(/[^A-Za-z0-9._-]/g, '_');
  return `${shortHash(path)}-${/\.[A-Za-z0-9]{2,4}$/.test(safe) ? safe : `${safe}.m4a`}`;
}
