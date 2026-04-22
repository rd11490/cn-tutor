export interface DictEntry {
  pinyin: string;
  definitions: string[];
}

// Compact wire format: { simplified: [pinyin, definitions[]] }
type CompactDict = Record<string, [string, string[]]>;

const CHINESE_RE = /[一-鿿㐀-䶿]/;
const MAX_WORD_LEN = 6;

let dict: Map<string, [string, string[]]> | null = null;
let loadPromise: Promise<void> | null = null;

export function ensureLoaded(): Promise<void> {
  if (dict) return Promise.resolve();
  if (!loadPromise) {
    loadPromise = fetch("/api/dictionary/all")
      .then((r) => r.json() as Promise<CompactDict>)
      .then((data) => {
        dict = new Map(Object.entries(data));
      });
  }
  return loadPromise;
}

export function lookupWord(word: string): DictEntry | null {
  const entry = dict?.get(word);
  if (!entry) return null;
  return { pinyin: entry[0], definitions: entry[1] };
}

export function isChinese(ch: string): boolean {
  return CHINESE_RE.test(ch);
}

export function segmentText(text: string): string[] {
  if (!dict) return [text];
  const result: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (CHINESE_RE.test(text[i])) {
      let matched = false;
      for (let len = Math.min(MAX_WORD_LEN, text.length - i); len >= 1; len--) {
        const cand = text.slice(i, i + len);
        if (dict.has(cand)) {
          result.push(cand);
          i += len;
          matched = true;
          break;
        }
      }
      if (!matched) {
        result.push(text[i]);
        i++;
      }
    } else {
      let j = i;
      while (j < text.length && !CHINESE_RE.test(text[j])) j++;
      if (j > i) result.push(text.slice(i, j));
      i = j;
    }
  }
  return result;
}
