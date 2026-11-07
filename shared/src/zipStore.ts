/**
 * One file inside a zip, stored without compression. A KMZ is exactly that: a zip that holds
 * `doc.kml`, and Google Earth reads the stored method. PURE and with no dependency, so the APK
 * and the web write the same bytes.
 */
const CRC_POLYNOMIAL = 0xedb88320;
const BYTE_VALUES = 256;
const BITS_PER_BYTE = 8;
const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;
const LOCAL_HEADER_BYTES = 30;
const CENTRAL_HEADER_BYTES = 46;
const END_BYTES = 22;
/** Version 2.0: the oldest that every reader opens. */
const ZIP_VERSION = 20;
/** Bit 11: the name is UTF-8. */
const UTF8_NAME_FLAG = 0x0800;
const STORED = 0;
/** 1 January 1980, the first day a zip can say. A fixed date keeps the same bytes for the same map. */
const FIRST_ZIP_DAY = (1 << 5) | 1;

const CRC_TABLE = Array.from({ length: BYTE_VALUES }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < BITS_PER_BYTE; bit += 1) crc = crc & 1 ? CRC_POLYNOMIAL ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> BITS_PER_BYTE);
  return (crc ^ 0xffffffff) >>> 0;
}

type Entry = { name: Uint8Array; content: Uint8Array; crc: number };

/** The fields the local and the central headers share, from «version needed» to the name's length. */
function writeShared(view: DataView, at: number, entry: Entry): void {
  view.setUint16(at, ZIP_VERSION, true);
  view.setUint16(at + 2, UTF8_NAME_FLAG, true);
  view.setUint16(at + 4, STORED, true);
  view.setUint16(at + 6, 0, true);
  view.setUint16(at + 8, FIRST_ZIP_DAY, true);
  view.setUint32(at + 10, entry.crc, true);
  view.setUint32(at + 14, entry.content.length, true);
  view.setUint32(at + 18, entry.content.length, true);
  view.setUint16(at + 22, entry.name.length, true);
}

export function zipOneFile(fileName: string, content: Uint8Array): Uint8Array<ArrayBuffer> {
  const entry: Entry = { name: new TextEncoder().encode(fileName), content, crc: crc32(content) };
  const localSize = LOCAL_HEADER_BYTES + entry.name.length + content.length;
  const centralSize = CENTRAL_HEADER_BYTES + entry.name.length;
  const zip = new Uint8Array(localSize + centralSize + END_BYTES);
  const view = new DataView(zip.buffer);
  view.setUint32(0, LOCAL_SIGNATURE, true);
  writeShared(view, 4, entry);
  zip.set(entry.name, LOCAL_HEADER_BYTES);
  zip.set(content, LOCAL_HEADER_BYTES + entry.name.length);
  view.setUint32(localSize, CENTRAL_SIGNATURE, true);
  view.setUint16(localSize + 4, ZIP_VERSION, true);
  writeShared(view, localSize + 6, entry);
  zip.set(entry.name, localSize + CENTRAL_HEADER_BYTES);
  const end = localSize + centralSize;
  view.setUint32(end, END_SIGNATURE, true);
  view.setUint16(end + 8, 1, true);
  view.setUint16(end + 10, 1, true);
  view.setUint32(end + 12, centralSize, true);
  view.setUint32(end + 16, localSize, true);
  return zip;
}
