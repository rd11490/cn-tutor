import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = path.join(__dirname, "..", "..", "progress", "anki-snapshot.md");

const CONFIDENT_INTERVAL = 21;
const CONFIDENT_EASE = 2.5;
const LEARNING_INTERVAL = 7;
const LEARNING_EASE = 2.0;

const ANKI_URL = () => process.env.ANKI_CONNECT_URL ?? "http://localhost:8765";

async function ankiRequest<T = unknown>(action: string, params: object = {}): Promise<T> {
  const res = await fetch(ANKI_URL(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, version: 6, params }),
  });
  const data = (await res.json()) as { result: T; error: string | null };
  if (data.error) throw new Error(`AnkiConnect error: ${data.error}`);
  return data.result;
}

export async function syncAnki(): Promise<{ success: boolean; message: string }> {
  try {
    await ankiRequest("sync");
    return { success: true, message: "Anki synced with AnkiWeb successfully." };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

export async function checkAnkiCard(
  word: string
): Promise<{ exists: boolean; interval?: number; ease?: number; due?: number }> {
  try {
    const noteIds = await ankiRequest<number[]>("findNotes", {
      query: `"Simplified:${word}"`,
    });
    if (!noteIds || noteIds.length === 0) return { exists: false };

    const cards = await ankiRequest<Array<{
      interval: number;
      factor: number;
      due: number;
    }>>("cardsInfo", {
      cards: await ankiRequest<number[]>("findCards", {
        query: `"Simplified:${word}"`,
      }),
    });

    if (!cards || cards.length === 0) return { exists: true };

    const card = cards[0];
    return {
      exists: true,
      interval: card.interval,
      ease: card.factor / 1000,
      due: card.due,
    };
  } catch {
    return { exists: false };
  }
}

export interface CreateCardInput {
  word: string;
  pinyin: string;
  meaning: string;
  part_of_speech?: string;
  example_cn: string;
  example_en: string;
}

export async function refreshAnkiSnapshot(): Promise<{ success: boolean; message: string; stats?: object }> {
  try {
    const cardIds = await ankiRequest<number[]>("findCards", { query: 'deck:"Chinese Vocabulary"' });
    const cards = cardIds.length
      ? await ankiRequest<Array<{ fields: Record<string, { value: string }>; interval: number; factor: number; reps: number }>>("cardsInfo", { cards: cardIds })
      : [];

    const confident: string[] = [];
    const learning: string[] = [];
    const shaky: string[] = [];
    let skippedNew = 0;

    for (const card of cards) {
      const word = card.fields?.Simplified?.value?.trim();
      if (!word) continue;
      if (card.reps === 0) { skippedNew++; continue; }

      const ease = card.factor / 1000;
      if (card.interval >= CONFIDENT_INTERVAL && ease >= CONFIDENT_EASE) confident.push(word);
      else if (card.interval < LEARNING_INTERVAL || ease < LEARNING_EASE) shaky.push(word);
      else learning.push(word);
    }

    confident.sort();
    learning.sort();
    shaky.sort();

    const today = new Date().toISOString().slice(0, 10);
    const total = confident.length + learning.length + shaky.length;
    const topLearning = learning.slice(0, 20).join(", ") || "n/a";
    const topShaky = shaky.slice(0, 10).join(", ") || "n/a";
    const personalization =
      `I'm learning Mandarin. I know ~${confident.length} words confidently in Anki. ` +
      `Currently learning: ${topLearning}. Shaky (need review): ${topShaky}.`;

    const snapshot = [
      `# Anki Vocab Snapshot — ${today}`,
      "",
      `**Total reviewed:** ${total} | **Confident:** ${confident.length} | **Learning:** ${learning.length} | **Shaky:** ${shaky.length} | **Never reviewed (excluded):** ${skippedNew}`,
      "",
      `## Confident (interval ≥${CONFIDENT_INTERVAL}d, ease ≥${CONFIDENT_EASE})`,
      "",
      confident.length ? confident.join(", ") : "_none yet_",
      "",
      "## Learning",
      "",
      learning.length ? learning.join(", ") : "_none yet_",
      "",
      "## Shaky (review soon)",
      "",
      shaky.length ? shaky.join(", ") : "_none yet_",
      "",
      "---",
      "",
      "_Claude Personalization Block (paste monthly):_",
      "",
      `> ${personalization}`,
      "",
    ].join("\n");

    fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
    fs.writeFileSync(SNAPSHOT_PATH, snapshot, "utf-8");

    return {
      success: true,
      message: `Snapshot updated. ${total} cards reviewed (${confident.length} confident, ${learning.length} learning, ${shaky.length} shaky).`,
      stats: { total, confident: confident.length, learning: learning.length, shaky: shaky.length, skippedNew },
    };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

export async function createAnkiCard(
  input: CreateCardInput
): Promise<{ success: boolean; message: string; noteId?: number }> {
  try {
    const noteId = await ankiRequest<number>("addNote", {
      note: {
        deckName: "Chinese Vocabulary::NonHSK",
        modelName: "HSK",
        fields: {
          Key: input.word,
          Simplified: input.word,
          "Pinyin.1": input.pinyin,
          Meaning: input.meaning,
          "Part of speech": input.part_of_speech ?? "",
          Audio: "",
          SentenceSimplified: input.example_cn,
          "SentencePinyin.1": "",
          SentenceMeaning: input.example_en,
          SentenceAudio: "",
          Tags: "cn-tutor",
        },
        options: { allowDuplicate: false },
        tags: ["cn-tutor"],
      },
    });
    return { success: true, message: `Card created for ${input.word}.`, noteId };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}
