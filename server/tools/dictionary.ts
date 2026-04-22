import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { gzipSync } from "zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface DictEntry {
  simplified: string;
  traditional: string;
  pinyin: string;
  definitions: string[];
}

const dict = new Map<string, DictEntry>();

export function loadDictionary(): void {
  const cedictPath =
    process.env.CEDICT_PATH ??
    path.join(__dirname, "..", "..", "data", "cedict_ts.u8");

  if (!fs.existsSync(cedictPath)) {
    console.warn(`CC-CEDICT not found at ${cedictPath}. Set CEDICT_PATH in .env.`);
    return;
  }

  const lines = fs.readFileSync(cedictPath, "utf-8").split("\n");
  let count = 0;
  for (const line of lines) {
    if (line.startsWith("#") || !line.trim()) continue;
    const match = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/\s*$/);
    if (!match) continue;
    const [, traditional, simplified, pinyin, defs] = match;
    if (!dict.has(simplified)) {
      dict.set(simplified, {
        simplified,
        traditional,
        pinyin,
        definitions: defs.split("/").filter(Boolean),
      });
      count++;
    }
  }
  console.log(`Dictionary loaded: ${count} entries`);
}

export function lookupWord(word: string): DictEntry | null {
  return dict.get(word) ?? null;
}

// Compact format for browser: { simplified: [pinyin, definitions[]] }
// Pre-gzipped at first call and cached.
let _compressedDict: Buffer | null = null;

export function getCompressedDictionary(): Buffer {
  if (!_compressedDict) {
    const obj: Record<string, [string, string[]]> = {};
    dict.forEach((entry, key) => {
      obj[key] = [entry.pinyin, entry.definitions];
    });
    _compressedDict = gzipSync(JSON.stringify(obj));
  }
  return _compressedDict;
}

const CHINESE_RE = /[一-鿿㐀-䶿]/;

export function segmentText(text: string): string[] {
  const MAX = 6;
  const result: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (CHINESE_RE.test(text[i])) {
      let matched = false;
      for (let len = Math.min(MAX, text.length - i); len >= 1; len--) {
        const cand = text.slice(i, i + len);
        if (dict.has(cand)) {
          result.push(cand);
          i += len;
          matched = true;
          break;
        }
      }
      if (!matched) { result.push(text[i]); i++; }
    } else {
      let j = i;
      while (j < text.length && !CHINESE_RE.test(text[j])) j++;
      if (j > i) result.push(text.slice(i, j));
      i = j;
    }
  }
  return result;
}
