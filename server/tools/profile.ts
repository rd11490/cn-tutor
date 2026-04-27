import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type Anthropic from "@anthropic-ai/sdk";
import type { SessionData } from "../harness/session.js";
import { loadProfile, saveProfile, type LevelResult } from "../lib/context.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRANSCRIPTS_DIR = path.join(__dirname, "..", "..", "progress", "sessions", "transcripts");

function writeAssessmentTranscript(filename: string, messages: Anthropic.MessageParam[]): void {
  const lines: string[] = [];
  for (const msg of messages) {
    const label = msg.role === "user" ? "**Student:**" : "**Assessor:**";
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
  const content = `# Assessment Transcript — ${new Date().toLocaleString()}\n\n${lines.join("\n\n---\n\n")}\n`;
  fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(TRANSCRIPTS_DIR, `${filename}.md`), content, "utf-8");
}

export function saveHskLevel(
  session: SessionData,
  finalLevel: number,
  reasoning: string,
  levelResults: LevelResult[]
): { success: boolean; level: number; message: string } {
  const profile = loadProfile();
  const date = new Date().toISOString().slice(0, 10);

  saveProfile({
    ...profile,
    hskLevel: finalLevel,
    assessedAt: date,
    assessmentReasoning: reasoning,
    levelResults,
  });

  const now = new Date();
  const hhmm = now.toTimeString().slice(0, 5).replace(":", "");
  writeAssessmentTranscript(`${date}-${hhmm}-assessment`, session.messages);

  return {
    success: true,
    level: finalLevel,
    message: `HSK ${finalLevel} saved. ${reasoning}`,
  };
}
