import { readFile, writeFile } from "node:fs/promises";

const MOJIBAKE_PATTERNS = [
  /\uFFFD/,
  /Ã[\x80-\xBF]/,
  /Â[\x80-\xBF]?/,
  /ì[\x80-\xBF]{1,2}/,
  /í[\x80-\xBF]{1,2}/,
  /ë[\x80-\xBF]{1,2}/
];

export async function readUtf8(path) {
  return readFile(path, { encoding: "utf8" });
}

// Decode a raw file buffer to text, honoring a leading byte-order mark. A
// manifest saved as UTF-16 (common on Windows, e.g. a PowerShell-redirected
// `requirements.txt`) read as plain UTF-8 turns into mojibake, which makes
// detection miss framework keywords and mis-type the project. Recognizing the
// BOM (UTF-16LE FF FE, UTF-16BE FE FF, UTF-8 EF BB BF) fixes that. Files with no
// BOM decode as UTF-8 exactly as before (byte-identical). Node built-ins only
// (zero-dependency); Node has no native utf16be, so a BE buffer is byte-swapped
// to LE before decoding.
export function decodeWithBom(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.toString("utf16le", 2);
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const body = buffer.subarray(2);
    const even = body.length % 2 === 0 ? body : body.subarray(0, body.length - 1);
    const swapped = Buffer.from(even);
    swapped.swap16();
    return swapped.toString("utf16le");
  }
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.toString("utf8", 3);
  }
  return buffer.toString("utf8");
}

// BOM-aware text read for manifest/source inspection in the detector. Unlike
// readUtf8 (used for wiki docs, where raw UTF-8 must be preserved so the encoding
// scan can catch mojibake), this transparently decodes UTF-16/UTF-8-BOM files.
export async function readTextAuto(path) {
  return decodeWithBom(await readFile(path));
}

export async function writeUtf8(path, content) {
  await writeFile(path, content, { encoding: "utf8" });
}

export function hasUtf8Bom(content) {
  return content.charCodeAt(0) === 0xfeff;
}

export function findMojibakeIndicators(content) {
  return MOJIBAKE_PATTERNS.filter((pattern) => pattern.test(content)).map((pattern) => pattern.source);
}
