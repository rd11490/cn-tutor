import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ensureLoaded, lookupWord, segmentText, isChinese, type DictEntry } from "../lib/dictionary";

interface WordPopup {
  word: string;
  entry: DictEntry | null;
  x: number;
  y: number;
}

interface ChineseSpanProps {
  text: string;
  onLookup: (word: string, entry: DictEntry | null, x: number, y: number) => void;
}

function ChineseSpan({ text, onLookup }: ChineseSpanProps) {
  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    onLookup(text, lookupWord(text), rect.left, rect.bottom + 8);
  };
  return (
    <span className="cn-word" onMouseEnter={handleMouseEnter} onMouseLeave={() => onLookup("", null, 0, 0)}>
      {text}
    </span>
  );
}

interface ToolEventProps {
  name: string;
  status: "running" | "done";
}

function ToolEvent({ name, status }: ToolEventProps) {
  const labels: Record<string, string> = {
    lookup_word: "Looking up word",
    check_anki_card: "Checking Anki",
    create_anki_card: "Creating Anki card",
    sync_anki: "Syncing Anki",
    save_vocab_note: "Saving vocab note",
    save_grammar_note: "Saving grammar note",
    end_session: "Saving session",
  };
  return (
    <div className={`tool-event tool-event--${status}`}>
      {status === "running" ? "⟳" : "✓"} {labels[name] ?? name}
    </div>
  );
}

export interface MessageProps {
  role: "user" | "assistant";
  content: string;
  toolEvents?: Array<{ name: string; status: "running" | "done" }>;
}

export default function Message({ role, content, toolEvents }: MessageProps) {
  const [popup, setPopup] = useState<WordPopup | null>(null);
  const [dictReady, setDictReady] = useState(false);

  useEffect(() => {
    ensureLoaded().then(() => setDictReady(true));
  }, []);

  function handleLookup(word: string, entry: DictEntry | null, x: number, y: number) {
    if (!word) { setPopup(null); return; }
    setPopup({ word, entry, x, y });
  }

  function renderText(text: string): React.ReactNode {
    if (!dictReady) return text;
    return segmentText(text).map((seg, i) =>
      isChinese(seg[0]) ? (
        <ChineseSpan key={i} text={seg} onLookup={handleLookup} />
      ) : (
        <span key={i}>{seg}</span>
      )
    );
  }

  return (
    <div className={`message message--${role}`}>
      <div className="message-content">
        {toolEvents && toolEvents.length > 0 && (
          <div className="tool-events">
            {toolEvents.map((te, i) => (
              <ToolEvent key={i} name={te.name} status={te.status} />
            ))}
          </div>
        )}
        <div className="message-text">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p>{processChildren(children, renderText)}</p>,
              li: ({ children }) => <li>{processChildren(children, renderText)}</li>,
              td: ({ children }) => <td>{processChildren(children, renderText)}</td>,
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>

      {popup && popup.word && (
        <div className="word-popup" style={{ left: popup.x, top: popup.y }}>
          <div className="word-popup-word">{popup.word}</div>
          {popup.entry ? (
            <>
              <div className="word-popup-pinyin">{popup.entry.pinyin}</div>
              <ul className="word-popup-defs">
                {popup.entry.definitions.slice(0, 3).map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </>
          ) : (
            <div className="word-popup-pinyin">Not in dictionary</div>
          )}
        </div>
      )}
    </div>
  );
}

function processChildren(
  children: React.ReactNode,
  renderText: (s: string) => React.ReactNode
): React.ReactNode {
  if (typeof children === "string") return renderText(children);
  if (Array.isArray(children)) return children.map((c) => processChildren(c, renderText));
  return children;
}
