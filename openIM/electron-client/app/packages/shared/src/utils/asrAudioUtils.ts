// Purpose: prepare audio for ASR (speech-to-text) by sniffing, normalizing,
// and exporting Base64.
//
// ASR input requirements (key points):
// - mono channel
// - 16-bit samples
// - 8 kHz or 16 kHz sample rate
// - formats like PCM/PCM-WAV/MP3/AAC/OGG(OPUS/SPEEX)/AMR ...
//
// Strategy:
// 1) Fast sniff WAV/MP3 to see if they already match (mono + 8k/16k, WAV must be PCM16)
// 2) If not, decode with Web Audio API -> resample -> export PCM16 mono WAV
// 3) Return Base64 (default without data: prefix)
//
// Recommended usage:
// - normalizeAudioToAsrBase64(blobOrArrayBuffer, { targetSampleRate: 16000 })
//   -> { base64, format, mime, sampleRate, wasTranscoded, ... }
//
// Notes:
// - Requires AudioContext / OfflineAudioContext; best in Electron renderer.
// - MP3 sniff is best-effort (reads first frame header); falls back to decode on failure.

export type AllowedSampleRate = 8000 | 16000;

export type SniffedAudioFormat = "wav" | "mp3" | "unknown";

export interface WavHeaderInfo {
  audioFormat: number; // 1=PCM, 3=float, 0xFFFE=WAVE_FORMAT_EXTENSIBLE
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
  isPcm: boolean; // PCM or extensible PCM
}

export interface Mp3HeaderInfo {
  sampleRate: number;
  numChannels: 1 | 2;
  mpegVersion: "1" | "2" | "2.5";
  layer: 1 | 2 | 3;
  headerOffset: number; // position of the first frame header
}

export interface NormalizeAsrOptions {
  // Target sample rate (ASR usually prefers 16000)
  targetSampleRate?: AllowedSampleRate;

  // Allowed sample rates (default [8000, 16000])
  allowedSampleRates?: AllowedSampleRate[];

  // Prefer passthrough when already compatible:
  // - true: WAV/MP3 already meets mono + 8k/16k (WAV must be PCM16) -> return raw base64
  // - false: always transcode to PCM16 mono WAV (more stable, extra work)
  preferPassthroughIfCompatible?: boolean;

  // Whether to include data URL prefix
  // - false: plain base64 (default, good for JSON)
  // - true: data:<mime>;base64,... (good for audio.src)
  returnDataUrl?: boolean;
}

export interface NormalizedAudioResult {
  base64: string; // base64 (data: prefix depends on options.returnDataUrl)
  mime: string; // "audio/wav" or "audio/mpeg"
  format: "wav" | "mp3"; // final output format
  sampleRate: number; // final sample rate (WAV output is always 8k/16k)
  numChannels: number; // WAV output is always mono; MP3 passthrough is best-effort
  wasTranscoded: boolean; // whether decode/resample/export happened
  debug?: {
    sniffedFormat: SniffedAudioFormat;
    wavHeader?: WavHeaderInfo | null;
    mp3Header?: Mp3HeaderInfo | null;
  };
}

/* ============================================================
 *  Entry: Blob/ArrayBuffer -> ASR-compatible audio -> Base64
 * ============================================================ */

/**
 * Main entry: normalize input audio to ASR-compatible format and return base64.
 *
 * - If input is already compatible (WAV/MP3 best-effort) and preferPassthroughIfCompatible=true,
 *   return raw base64 (no transcode).
 * - Otherwise, transcode to mono + PCM16 + WAV + 8k/16k.
 */
async function normalizeAudioToAsrBase64(
  input: Blob | ArrayBuffer,
  options: NormalizeAsrOptions = {},
): Promise<NormalizedAudioResult> {
  const targetSampleRate = options.targetSampleRate ?? 16000;
  const allowedRates = options.allowedSampleRates ?? [8000, 16000];
  const preferPassthrough = options.preferPassthroughIfCompatible ?? true;
  const returnDataUrl = options.returnDataUrl ?? false;

  const ab = input instanceof ArrayBuffer ? input : await input.arrayBuffer();
  const sniffed = sniffAudioFormat(ab);

  // --- WAV fast path: check fmt chunk for PCM16 mono + 8k/16k
  if (sniffed === "wav") {
    const header = parseWavHeader(ab);
    const wavOk = header ? isAsrCompatibleWavHeader(header, allowedRates) : false;

    if (preferPassthrough && wavOk) {
      const rawBase64 = arrayBufferToBase64(ab);
      const base64 = returnDataUrl ? toDataUrl(rawBase64, "audio/wav") : rawBase64;
      return {
        base64,
        mime: "audio/wav",
        format: "wav",
        sampleRate: header!.sampleRate,
        numChannels: header!.numChannels,
        wasTranscoded: false,
        debug: { sniffedFormat: sniffed, wavHeader: header, mp3Header: null },
      };
    }

    // Not compatible or passthrough disabled: decode -> resample -> export WAV
    const outWavAb = await transcodeAnyAudioArrayBufferToPcm16MonoWav(
      ab,
      targetSampleRate,
    );
    const rawBase64 = arrayBufferToBase64(outWavAb);
    const base64 = returnDataUrl ? toDataUrl(rawBase64, "audio/wav") : rawBase64;
    return {
      base64,
      mime: "audio/wav",
      format: "wav",
      sampleRate: targetSampleRate,
      numChannels: 1,
      wasTranscoded: true,
      debug: { sniffedFormat: sniffed, wavHeader: header, mp3Header: null },
    };
  }

  // --- MP3 fast path: read first frame header (best-effort)
  if (sniffed === "mp3") {
    const mp3Header = parseMp3Header(ab);
    const mp3Ok =
      mp3Header &&
      mp3Header.numChannels === 1 &&
      allowedRates.includes(mp3Header.sampleRate as AllowedSampleRate);

    if (preferPassthrough && mp3Ok) {
      const rawBase64 = arrayBufferToBase64(ab);
      const base64 = returnDataUrl ? toDataUrl(rawBase64, "audio/mpeg") : rawBase64;
      return {
        base64,
        mime: "audio/mpeg",
        format: "mp3",
        sampleRate: mp3Header!.sampleRate,
        numChannels: mp3Header!.numChannels,
        wasTranscoded: false,
        debug: { sniffedFormat: sniffed, wavHeader: null, mp3Header },
      };
    }

    // Not compatible or passthrough disabled: transcode to WAV (PCM16 mono + 8k/16k)
    const outWavAb = await transcodeAnyAudioArrayBufferToPcm16MonoWav(
      ab,
      targetSampleRate,
    );
    const rawBase64 = arrayBufferToBase64(outWavAb);
    const base64 = returnDataUrl ? toDataUrl(rawBase64, "audio/wav") : rawBase64;
    return {
      base64,
      mime: "audio/wav",
      format: "wav",
      sampleRate: targetSampleRate,
      numChannels: 1,
      wasTranscoded: true,
      debug: { sniffedFormat: sniffed, wavHeader: null, mp3Header },
    };
  }

  // --- Unknown: try WebAudio decode (AAC/OGG/AMR if Chromium supports it).
  // If decode fails, let the error bubble up.
  const outWavAb = await transcodeAnyAudioArrayBufferToPcm16MonoWav(
    ab,
    targetSampleRate,
  );
  const rawBase64 = arrayBufferToBase64(outWavAb);
  const base64 = returnDataUrl ? toDataUrl(rawBase64, "audio/wav") : rawBase64;
  return {
    base64,
    mime: "audio/wav",
    format: "wav",
    sampleRate: targetSampleRate,
    numChannels: 1,
    wasTranscoded: true,
    debug: { sniffedFormat: sniffed, wavHeader: null, mp3Header: null },
  };
}

/**
 * Simple API for business usage:
 * always output PCM16 mono WAV and return full result.
 * This hides the detailed options from callers.
 */
export async function normalizeAudioToPcmWavBase64(
  input: Blob | ArrayBuffer,
  targetSampleRate: AllowedSampleRate = 16000,
  returnDataUrl = false,
): Promise<NormalizedAudioResult> {
  return normalizeAudioToAsrBase64(input, {
    targetSampleRate,
    preferPassthroughIfCompatible: false,
    returnDataUrl,
  });
}

/* ============================================================
 *  Quick sniff: WAV / MP3
 * ============================================================ */

/**
 * Rough container sniff by magic bytes:
 * - WAV: "RIFF"...."WAVE"
 * - MP3: "ID3" or an MPEG frame sync
 */
function sniffAudioFormat(arrayBuffer: ArrayBuffer): SniffedAudioFormat {
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes.length >= 12) {
    const riff = ascii(bytes, 0, 4);
    const wave = ascii(bytes, 8, 4);
    if (riff === "RIFF" && wave === "WAVE") return "wav";
  }

  if (bytes.length >= 3) {
    const id3 = ascii(bytes, 0, 3);
    if (id3 === "ID3") return "mp3";
  }

  // Scan for MPEG frame sync 0xFF Ex
  const off = skipId3Tag(bytes) ?? 0;
  const hdr = findMp3FrameHeader(bytes, off);
  if (hdr !== null) return "mp3";

  return "unknown";
}

/* ============================================================
 *  WAV parsing / checks
 * ============================================================ */

/**
 * Parse WAV header (RIFF/WAVE + fmt chunk).
 * Returns null if not WAV or header is incomplete.
 */
function parseWavHeader(arrayBuffer: ArrayBuffer): WavHeaderInfo | null {
  const v = new DataView(arrayBuffer);

  const str = (o: number, n: number) =>
    String.fromCharCode(...new Uint8Array(arrayBuffer, o, n));

  if (v.byteLength < 44) return null;
  if (str(0, 4) !== "RIFF" || str(8, 4) !== "WAVE") return null;

  let offset = 12;
  let audioFormat: number | undefined;
  let numChannels: number | undefined;
  let sampleRate: number | undefined;
  let bitsPerSample: number | undefined;
  let isPcm = false;

  while (offset + 8 <= v.byteLength) {
    const chunkId = str(offset, 4);
    const chunkSize = v.getUint32(offset + 4, true);

    if (chunkId === "fmt ") {
      if (offset + 8 + 16 > v.byteLength) return null;

      audioFormat = v.getUint16(offset + 8, true);
      numChannels = v.getUint16(offset + 10, true);
      sampleRate = v.getUint32(offset + 12, true);
      bitsPerSample = v.getUint16(offset + 22, true);

      // PCM
      if (audioFormat === 1) isPcm = true;

      // WAVE_FORMAT_EXTENSIBLE: read SubFormat to confirm PCM
      if (audioFormat === 0xfffe) {
        if (chunkSize >= 40 && offset + 8 + 40 <= v.byteLength) {
          const subFormatOffset = offset + 8 + 24;
          const sub = new Uint8Array(arrayBuffer, subFormatOffset, 16);

          // {00000001-0000-0010-8000-00AA00389B71}
          const PCM_GUID = Uint8Array.from([
            0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x80, 0x00, 0x00, 0xaa,
            0x00, 0x38, 0x9b, 0x71,
          ]);

          isPcm = equalBytes(sub, PCM_GUID);
        } else {
          isPcm = false;
        }
      }

      break;
    }

    offset += 8 + chunkSize + (chunkSize % 2);
  }

  if (
    audioFormat === undefined ||
    numChannels === undefined ||
    sampleRate === undefined ||
    bitsPerSample === undefined
  ) {
    return null;
  }

  return { audioFormat, numChannels, sampleRate, bitsPerSample, isPcm };
}

/**
 * Check whether a WAV header matches ASR requirements
 * (mono + 16-bit + PCM + 8k/16k).
 */
function isAsrCompatibleWavHeader(
  header: WavHeaderInfo,
  allowedRates: AllowedSampleRate[] = [8000, 16000],
): boolean {
  return (
    header.isPcm === true &&
    header.numChannels === 1 &&
    header.bitsPerSample === 16 &&
    allowedRates.includes(header.sampleRate as AllowedSampleRate)
  );
}

/* ============================================================
 *  MP3 parsing (best-effort)
 * ============================================================ */

/**
 * Best-effort MP3 parse: skip ID3, read first frame header for
 * sample rate and channel count. Returns null on failure (falls
 * back to WebAudio decode).
 */
function parseMp3Header(arrayBuffer: ArrayBuffer): Mp3HeaderInfo | null {
  const bytes = new Uint8Array(arrayBuffer);

  const start = skipId3Tag(bytes) ?? 0;
  const headerOffset = findMp3FrameHeader(bytes, start);
  if (headerOffset === null) return null;

  // MPEG header: 4 bytes
  const b1 = bytes[headerOffset];
  const b2 = bytes[headerOffset + 1];
  const b3 = bytes[headerOffset + 2];
  const b4 = bytes[headerOffset + 3];

  // Frame sync check
  if (b1 !== 0xff || (b2 & 0xe0) !== 0xe0) return null;

  const versionBits = (b2 >> 3) & 0x03; // 00=2.5, 01=reserved, 10=2, 11=1
  const layerBits = (b2 >> 1) & 0x03; // 01=Layer III, 10=Layer II, 11=Layer I, 00=reserved
  if (versionBits === 0x01 || layerBits === 0x00) return null;

  const sampleRateIndex = (b3 >> 2) & 0x03; // 00,01,02 valid, 11 reserved
  if (sampleRateIndex === 0x03) return null;

  const channelMode = (b4 >> 6) & 0x03; // 3 = mono
  const numChannels = channelMode === 3 ? 1 : 2;

  const mpegVersion = versionBits === 0x03 ? "1" : versionBits === 0x02 ? "2" : "2.5";
  const layer = layerBits === 0x03 ? 1 : layerBits === 0x02 ? 2 : 3;

  const sampleRate = mp3SampleRate(mpegVersion, sampleRateIndex);
  if (!sampleRate) return null;

  return {
    sampleRate,
    numChannels: numChannels as 1 | 2,
    mpegVersion,
    layer,
    headerOffset,
  };
}

/* ============================================================
 *  WebAudio transcode: any decodable audio -> PCM16 mono WAV
 * ============================================================ */

/**
 * For any WebAudio-decodable audio ArrayBuffer:
 * - decodeAudioData -> AudioBuffer
 * - OfflineAudioContext resample to 8k/16k
 * - export to mono PCM16 WAV ArrayBuffer
 */
async function transcodeAnyAudioArrayBufferToPcm16MonoWav(
  arrayBuffer: ArrayBuffer,
  targetSampleRate: AllowedSampleRate,
): Promise<ArrayBuffer> {
  const decoded = await decodeToAudioBuffer(arrayBuffer);
  const resampled = await resampleAudioBuffer(decoded, targetSampleRate);
  return audioBufferToPcm16MonoWavArrayBuffer(resampled);
}

/**
 * Decode ArrayBuffer into AudioBuffer (Chromium decoder).
 */
async function decodeToAudioBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  try {
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await ctx.close();
  }
}

/**
 * OfflineAudioContext resample to target sample rate.
 */
async function resampleAudioBuffer(
  audioBuffer: AudioBuffer,
  targetSampleRate: AllowedSampleRate,
): Promise<AudioBuffer> {
  const ch = audioBuffer.numberOfChannels;
  const targetLength = Math.ceil(audioBuffer.duration * targetSampleRate);

  const offline = new OfflineAudioContext(ch, targetLength, targetSampleRate);
  const source = offline.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offline.destination);
  source.start(0);

  return await offline.startRendering();
}

/**
 * AudioBuffer -> mono PCM16 WAV (ArrayBuffer)
 * - downmix channels by averaging
 * - Float32 [-1,1] -> Int16 LE
 */
function audioBufferToPcm16MonoWavArrayBuffer(buffer: AudioBuffer): ArrayBuffer {
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const numChannels = buffer.numberOfChannels;

  const bytesPerSample = 2;
  const dataSize = length * bytesPerSample;
  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);

  const writeStr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");

  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);

  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < length; i++) {
    let s = 0;
    for (let c = 0; c < numChannels; c++) s += channels[c][i];
    s /= numChannels;

    s = Math.max(-1, Math.min(1, s));
    const int16 = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, int16, true);
    offset += 2;
  }

  return out;
}

/* ============================================================
 *  Base64 helpers
 * ============================================================ */

/**
 * ArrayBuffer -> Base64 (no data: prefix)
 * - Use Buffer in Electron when available (fastest).
 */
function arrayBufferToBase64(arrayBuffer: ArrayBuffer): string {
  const AnyGlobal = globalThis as any;

  if (typeof AnyGlobal.Buffer !== "undefined") {
    return AnyGlobal.Buffer.from(new Uint8Array(arrayBuffer)).toString("base64");
  }

  // Fallback: chunk to avoid huge string concatenation.
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/**
 * Plain base64 -> data URL.
 */
function toDataUrl(base64: string, mime: string): string {
  return `data:${mime};base64,${base64}`;
}

/* ============================================================
 *  Internal helpers (bytes / MP3)
 * ============================================================ */

function ascii(bytes: Uint8Array, offset: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[offset + i] ?? 0);
  return s;
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * If an ID3 tag exists, return the offset after it; otherwise null.
 * ID3 size is synchsafe (4 bytes, 7 bits each).
 */
function skipId3Tag(bytes: Uint8Array): number | null {
  if (bytes.length < 10) return null;
  if (ascii(bytes, 0, 3) !== "ID3") return null;

  const size =
    ((bytes[6] & 0x7f) << 21) |
    ((bytes[7] & 0x7f) << 14) |
    ((bytes[8] & 0x7f) << 7) |
    (bytes[9] & 0x7f);

  const end = 10 + size;
  return end <= bytes.length ? end : null;
}

/**
 * Find an MP3 frame header (frame sync) starting at offset.
 * Returns header offset or null if not found.
 */
function findMp3FrameHeader(bytes: Uint8Array, offset: number): number | null {
  const maxScan = Math.min(bytes.length - 4, offset + 256 * 1024); // scan up to 256KB
  for (let i = offset; i < maxScan; i++) {
    if (bytes[i] === 0xff && (bytes[i + 1] & 0xe0) === 0xe0) {
      // Extra validation: version/layer/sampleRate index must be valid.
      const b2 = bytes[i + 1];
      const b3 = bytes[i + 2];

      const versionBits = (b2 >> 3) & 0x03;
      const layerBits = (b2 >> 1) & 0x03;
      const sampleRateIndex = (b3 >> 2) & 0x03;

      if (versionBits !== 0x01 && layerBits !== 0x00 && sampleRateIndex !== 0x03) {
        return i;
      }
    }
  }
  return null;
}

/**
 * MP3 sample rate table (based on MPEG version + sampleRateIndex).
 */
function mp3SampleRate(version: "1" | "2" | "2.5", idx: number): number | null {
  const table: Record<typeof version, number[]> = {
    "1": [44100, 48000, 32000],
    "2": [22050, 24000, 16000],
    "2.5": [11025, 12000, 8000],
  };
  const arr = table[version];
  return arr[idx] ?? null;
}
