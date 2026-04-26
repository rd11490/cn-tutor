import type { SessionData } from "../harness/session.js";
import {
  appendVocabHistory,
  appendGrammarHistory,
  writeSessionFile,
} from "../lib/context.js";
import { markEnded } from "../harness/session.js";

export function saveVocabNote(
  session: SessionData,
  word: string,
  notes: string
): { success: boolean } {
  session.vocabNotes.push({ word, notes });
  return { success: true };
}

export function saveGrammarNote(
  session: SessionData,
  concept: string,
  explanation: string,
  example: string
): { success: boolean } {
  session.grammarNotes.push({ concept, explanation, example });
  return { success: true };
}

export interface EndSessionInput {
  summary: string;
  vocab_learned: string[];
  grammar_concepts: string[];
  next_session_notes?: string;
}

export function endSession(
  session: SessionData,
  input: EndSessionInput
): { success: boolean; message: string } {
  if (session.ended) {
    return { success: false, message: "Session already ended." };
  }

  const date = new Date().toISOString().slice(0, 10);
  const timestamp = new Date().toLocaleString();

  // Write session file
  const sessionContent = `# Session — ${timestamp}

## Summary
${input.summary}

## Vocabulary Covered
${input.vocab_learned.map((w) => `- ${w}`).join("\n") || "None recorded."}

## Grammar Concepts
${input.grammar_concepts.map((g) => `- ${g}`).join("\n") || "None recorded."}

${input.next_session_notes ? `## Next Session\n${input.next_session_notes}` : ""}
`;

  writeSessionFile(date, sessionContent);

  // Append to running vocab history
  if (session.vocabNotes.length > 0) {
    const vocabEntry = `## ${date}\n${session.vocabNotes
      .map((n) => `- **${n.word}**: ${n.notes}`)
      .join("\n")}`;
    appendVocabHistory(vocabEntry);
  }

  // Append to running grammar history
  if (session.grammarNotes.length > 0) {
    const grammarEntry = session.grammarNotes
      .map(
        (n) =>
          `## ${n.concept} (${date})\n${n.explanation}\n\n*Example:* ${n.example}`
      )
      .join("\n\n");
    appendGrammarHistory(grammarEntry);
  }

  markEnded(session.id);
  return { success: true, message: `Session saved to progress/sessions/${date}.md` };
}
