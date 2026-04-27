import type Anthropic from "@anthropic-ai/sdk";
import type { SessionData } from "../harness/session.js";
import { syncAnki, checkAnkiCard, createAnkiCard, refreshAnkiSnapshot } from "./anki.js";
import { lookupWord } from "./dictionary.js";
import { saveVocabNote, saveGrammarNote, endSession } from "./session-tools.js";
import type { EndSessionInput } from "./session-tools.js";
import { saveHskLevel } from "./profile.js";
import type { LevelResult } from "../lib/context.js";

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "lookup_word",
    description:
      "Look up a Chinese word in the CC-CEDICT dictionary. Returns pinyin, meaning, and definitions. Use when a word needs clarification or when building a card.",
    input_schema: {
      type: "object",
      properties: {
        word: { type: "string", description: "The Chinese word or characters to look up" },
      },
      required: ["word"],
    },
  },
  {
    name: "check_anki_card",
    description:
      "Check if an Anki flashcard already exists for a word and get its study stats (interval in days, ease factor). Always call this before create_anki_card to avoid duplicates.",
    input_schema: {
      type: "object",
      properties: {
        word: { type: "string", description: "The Chinese word to check in Anki" },
      },
      required: ["word"],
    },
  },
  {
    name: "create_anki_card",
    description:
      "Create an Anki flashcard for a Chinese word in the Chinese Vocabulary::NonHSK deck. Always call check_anki_card first.",
    input_schema: {
      type: "object",
      properties: {
        word: { type: "string", description: "The Chinese word (simplified characters)" },
        pinyin: { type: "string", description: "Pinyin with tone marks (e.g., nǔlì)" },
        meaning: { type: "string", description: "English meaning/definition" },
        part_of_speech: { type: "string", description: "Part of speech: noun, verb, adj, adv, etc." },
        example_cn: { type: "string", description: "Natural example sentence in Chinese" },
        example_en: { type: "string", description: "English translation of the example sentence" },
      },
      required: ["word", "pinyin", "meaning", "example_cn", "example_en"],
    },
  },
  {
    name: "sync_anki",
    description:
      "Sync Anki with AnkiWeb to pull the latest card data. Call at the start of the first lesson in a session.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "refresh_anki_snapshot",
    description:
      "Fetch all cards from the Chinese Vocabulary deck, categorize by confidence, and update the local anki-snapshot.md. Call this to get up-to-date stats on what the student knows.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "save_vocab_note",
    description:
      "Record a vocabulary word covered in this session with context or memory notes. Persists to the session summary.",
    input_schema: {
      type: "object",
      properties: {
        word: { type: "string" },
        notes: { type: "string", description: "Usage context, memory aid, or key nuance" },
      },
      required: ["word", "notes"],
    },
  },
  {
    name: "save_grammar_note",
    description:
      "Record a grammar concept covered in this session. Persists to the grammar history so future sessions build on it.",
    input_schema: {
      type: "object",
      properties: {
        concept: { type: "string", description: "Grammar concept name, e.g. '把 construction'" },
        explanation: { type: "string", description: "Clear English explanation" },
        example: { type: "string", description: "Chinese example with English translation" },
      },
      required: ["concept", "explanation", "example"],
    },
  },
  {
    name: "end_session",
    description:
      "End the study session and save a structured summary to disk. Call when the student ends the session or when a lesson's wrap-up phase is complete.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "2-3 sentence summary of the session" },
        vocab_learned: {
          type: "array",
          items: { type: "string" },
          description: "New vocabulary words introduced or drilled",
        },
        grammar_concepts: {
          type: "array",
          items: { type: "string" },
          description: "Grammar concepts covered or reviewed",
        },
        next_session_notes: {
          type: "string",
          description: "What to prioritize next session",
        },
      },
      required: ["summary", "vocab_learned", "grammar_concepts"],
    },
  },
];

export const ASSESS_TOOLS: Anthropic.Tool[] = [
  {
    name: "save_hsk_level",
    description:
      "Save the final assessed HSK level and full per-level score breakdown. Call ONLY after all levels have been tested and graded.",
    input_schema: {
      type: "object",
      properties: {
        final_level: {
          type: "number",
          description: "Highest HSK level the student passed (0 if failed HSK 1)",
        },
        reasoning: {
          type: "string",
          description: "1–2 sentence summary of overall performance across all tested levels",
        },
        level_results: {
          type: "array",
          description: "Score breakdown for every level that was tested",
          items: {
            type: "object",
            properties: {
              level:          { type: "number", description: "HSK level number (1–6)" },
              vocab_score:    { type: "number", description: "Vocabulary section score 0–100" },
              grammar_score:  { type: "number", description: "Grammar section score 0–100" },
              reading_score:  { type: "number", description: "Reading section score 0–100" },
              writing_score:  { type: "number", description: "Writing section score 0–100 (omit for HSK 1–2)" },
              overall_score:  { type: "number", description: "Overall score for this level 0–100" },
              passed:         { type: "boolean", description: "Whether the student passed this level" },
            },
            required: ["level", "vocab_score", "grammar_score", "reading_score", "overall_score", "passed"],
          },
        },
      },
      required: ["final_level", "reasoning", "level_results"],
    },
  },
];

type ToolInput = Record<string, unknown>;

export async function executeTool(
  session: SessionData,
  name: string,
  input: ToolInput
): Promise<unknown> {
  switch (name) {
    case "lookup_word":
      return lookupWord(input.word as string) ?? { error: "Word not found in dictionary." };

    case "check_anki_card":
      return checkAnkiCard(input.word as string);

    case "create_anki_card":
      return createAnkiCard(input as unknown as Parameters<typeof createAnkiCard>[0]);

    case "sync_anki":
      return syncAnki();

    case "refresh_anki_snapshot":
      return refreshAnkiSnapshot();

    case "save_vocab_note":
      return saveVocabNote(session, input.word as string, input.notes as string);

    case "save_grammar_note":
      return saveGrammarNote(
        session,
        input.concept as string,
        input.explanation as string,
        input.example as string
      );

    case "end_session":
      return endSession(session, input as unknown as EndSessionInput);

    case "save_hsk_level":
      return saveHskLevel(
        session,
        input.final_level as number,
        input.reasoning as string,
        input.level_results as Parameters<typeof saveHskLevel>[3]
      );

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
