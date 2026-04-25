import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createSession, getSession } from "./harness/session.js";
import { runTurn } from "./harness/tool-loop.js";
import { lookupWord, segmentText, loadDictionary, getCompressedDictionary } from "./tools/dictionary.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

loadDictionary();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ── Chat ─────────────────────────────────────────────────────────────────────
//
// Client sends:  POST /api/chat  { message, sessionId? }
// Server sends SSE events:
//   { type: "session_id", sessionId }   — first response only
//   { type: "text", text }              — streamed text deltas
//   { type: "tool_start", name }        — tool being executed
//   { type: "tool_done", name, result } — tool result
//   { type: "done" }                    — turn complete
//   { type: "error", message }          — error

app.post("/api/chat", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const { message, sessionId } = req.body as {
    message: string;
    sessionId?: string;
  };

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  let session = sessionId ? getSession(sessionId) : undefined;
  if (!session) {
    session = createSession();
    send({ type: "session_id", sessionId: session.id });
  }

  const capturedSession = session;

  runTurn(capturedSession, message, (event) => {
    send(event);
    if (event.type === "done" || event.type === "error") res.end();
  }).catch((err) => {
    send({ type: "error", message: String(err) });
    res.end();
  });

  res.on("close", () => {
    if (!res.writableEnded) res.end();
  });
});

// ── Auto-save on window close ─────────────────────────────────────────────────
// Browser sends navigator.sendBeacon('/api/session-beacon') when closing.
// We do a lightweight save without a Claude call — just flush whatever
// vocab/grammar notes have been collected in this session.

app.post("/api/session-beacon", express.text({ type: "*/*" }), async (req, res) => {
  try {
    const { sessionId } = JSON.parse(req.body as string) as { sessionId: string };
    const session = getSession(sessionId);
    if (session && !session.ended && session.messages.length > 0) {
      const { writeSessionFile } = await import("./lib/context.js");
      const now = new Date();
      const date = now.toISOString().slice(0, 10);
      const hhmm = now.toTimeString().slice(0, 5).replace(":", "");
      const ts = now.toLocaleString();

      const { buildSessionContent } = await import("./tools/session-tools.js");
      const content = buildSessionContent(
        `${ts} (auto-saved)`,
        date,
        {
          summary: "_Session closed without explicit end._",
          vocab_learned: session.vocabNotes.map((n) => n.word),
          grammar_concepts: session.grammarNotes.map((n) => n.concept),
        },
        session.vocabNotes,
        session.grammarNotes,
        session.messages
      );

      writeSessionFile(`${date}-${hhmm}-auto`, content);
    }
    res.sendStatus(204);
  } catch {
    res.sendStatus(204);
  }
});

// ── Dictionary ────────────────────────────────────────────────────────────────

// Full dictionary for browser-side segmentation + lookup (gzip-compressed, cached).
app.get("/api/dictionary/all", (_req, res) => {
  const buf = getCompressedDictionary();
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Encoding", "gzip");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(buf);
});

app.get("/api/dictionary/:word", (req, res) => {
  const entry = lookupWord(decodeURIComponent(req.params.word));
  res.json(entry ?? null);
});

app.post("/api/segment", (req, res) => {
  const { text } = req.body as { text: string };
  res.json({ segments: segmentText(text) });
});

// ── Static (production) ───────────────────────────────────────────────────────

const clientDist = path.join(__dirname, "..", "dist", "client");
if (process.env.NODE_ENV === "production") {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

const PORT = Number(process.env.WEB_PORT ?? 3001);
app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
