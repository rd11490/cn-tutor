import { v4 as uuidv4 } from "uuid";
import type Anthropic from "@anthropic-ai/sdk";

export interface VocabNote {
  word: string;
  notes: string;
}

export interface GrammarNote {
  concept: string;
  explanation: string;
  example: string;
}

export interface SessionData {
  id: string;
  messages: Anthropic.MessageParam[];
  vocabNotes: VocabNote[];
  grammarNotes: GrammarNote[];
  createdAt: Date;
  ended: boolean;
}

const sessions = new Map<string, SessionData>();

export function createSession(): SessionData {
  const session: SessionData = {
    id: uuidv4(),
    messages: [],
    vocabNotes: [],
    grammarNotes: [],
    createdAt: new Date(),
    ended: false,
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): SessionData | undefined {
  return sessions.get(id);
}

export function markEnded(id: string): void {
  const s = sessions.get(id);
  if (s) s.ended = true;
}
