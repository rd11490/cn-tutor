import type { SessionData } from "../harness/session.js";
import type Anthropic from "@anthropic-ai/sdk";
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

function formatTranscript(messages: Anthropic.MessageParam[]): string {
  const lines: string[] = [];
  for (const msg of messages) {
    const label = msg.role === "user" ? "### You" : "### Tutor";
    let text = "";
    if (typeof msg.content === "string") {
      text = msg.content;
    } else {
      text = (msg.content as Array<{ type: string; text?: string }>)
        .filter((b) => b.type === "text" && b.text)
        .map((b) => b.text!)
        .join("\n");
    }
    if (text.trim()) lines.push(`${label}\n\n${text.trim()}`);
  }
  return lines.join("\n\n---\n\n");
}

export function buildSessionContent(
  timestamp: string,
  date: string,
  input: EndSessionInput,
  vocabNotes: SessionData["vocabNotes"],
  grammarNotes: SessionData["grammarNotes"],
  messages: Anthropic.MessageParam[]
): string {
  const transcript = formatTranscript(messages);
  return `# Session — ${timestamp}

## Summary
${input.summary}

## Vocabulary Covered
${input.vocab_learned.map((w) => `- ${w}`).join("\n") || "None recorded."}

## Grammar Concepts
${input.grammar_concepts.map((g) => `- ${g}`).join("\n") || "None recorded."}

${input.next_session_notes ? `## Next Session\n${input.next_session_notes}\n` : ""}
---

## Full Transcript

${transcript || "_No transcript available._"}
`;
}

export function endSession(
  session: SessionData,
  input: EndSessionInput
): { success: boolean; message: string } {
  if (session.ended) {
    return { success: false, message: "Session already ended." };
  }

  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const hhmm = now.toTimeString().slice(0, 5).replace(":", "");
  const timestamp = now.toLocaleString();
  const filename = `${date}-${hhmm}`;

  const sessionContent = buildSessionContent(
    timestamp,
    date,
    input,
    session.vocabNotes,
    session.grammarNotes,
    session.messages
  );

  writeSessionFile(filename, sessionContent);

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
  return { success: true, message: `Session saved to progress/sessions/${filename}.md` };
}
