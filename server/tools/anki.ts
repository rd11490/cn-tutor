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
