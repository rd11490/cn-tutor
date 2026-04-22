import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROGRESS_DIR = path.join(__dirname, "..", "..", "progress");

function read(p: string): string {
  return fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : "";
}

export interface AnkiSnapshot {
  total: number;
  confident: number;
  learning: number;
  shaky: number;
  confidentWords: string;
  learningWords: string;
  shakyWords: string;
}

export function loadAnkiSnapshot(): AnkiSnapshot | null {
  const snapshotPath =
    process.env.ANKI_SNAPSHOT_PATH ??
    path.join(PROGRESS_DIR, "anki-snapshot.md");

  const text = read(snapshotPath);
  if (!text) return null;

  const statsMatch = text.match(
    /\*\*Total reviewed:\*\* (\d+).*?\*\*Confident:\*\* (\d+).*?\*\*Learning:\*\* (\d+).*?\*\*Shaky:\*\* (\d+)/s
  );
  if (!statsMatch) return null;

  const [, total, confident, learning, shaky] = statsMatch;

  const sections: Record<string, string[]> = {};
  let current = "";
  for (const line of text.split("\n")) {
    if (line.startsWith("## Confident")) current = "confident";
    else if (line.startsWith("## Learning")) current = "learning";
    else if (line.startsWith("## Shaky")) current = "shaky";
    else if (line.startsWith("##") || line.startsWith("---")) current = "";
    else if (current && line.trim() && !line.startsWith("_")) {
      (sections[current] ??= []).push(line.trim());
    }
  }

  return {
    total: Number(total),
    confident: Number(confident),
    learning: Number(learning),
    shaky: Number(shaky),
    confidentWords: sections.confident?.join(" ") ?? "",
    learningWords: sections.learning?.join(" ") ?? "",
    shakyWords: sections.shaky?.join(" ") ?? "",
  };
}

export function loadGrammarHistory(): string {
  return read(path.join(PROGRESS_DIR, "grammar-history.md"));
}

export function loadVocabHistory(): string {
  return read(path.join(PROGRESS_DIR, "vocab-history.md"));
}

export function loadRecentSessions(count = 3): string[] {
  const sessionsDir = path.join(PROGRESS_DIR, "sessions");
  if (!fs.existsSync(sessionsDir)) return [];

  return fs
    .readdirSync(sessionsDir)
    .filter((f) => f.endsWith(".md") && f !== ".gitkeep")
    .sort()
    .slice(-count)
    .map((f) => read(path.join(sessionsDir, f)));
}

export function appendVocabHistory(entry: string): void {
  const p = path.join(PROGRESS_DIR, "vocab-history.md");
  fs.appendFileSync(p, `\n${entry}\n`);
}

export function appendGrammarHistory(entry: string): void {
  const p = path.join(PROGRESS_DIR, "grammar-history.md");
  fs.appendFileSync(p, `\n${entry}\n`);
}

export function writeSessionFile(date: string, content: string): void {
  const sessionsDir = path.join(PROGRESS_DIR, "sessions");
  fs.mkdirSync(sessionsDir, { recursive: true });
  fs.writeFileSync(path.join(sessionsDir, `${date}.md`), content);
}
