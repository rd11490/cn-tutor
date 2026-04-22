import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import Message, { type MessageProps } from "./Message";

export interface ChatHandle {
  endSession: () => void;
}

interface ChatMessage extends MessageProps {
  id: string;
}

interface ToolEvent {
  name: string;
  status: "running" | "done";
}

async function streamChat(
  message: string,
  sessionId: string | null,
  onSessionId: (id: string) => void,
  onChunk: (text: string) => void,
  onToolStart: (name: string) => void,
  onToolDone: (name: string, result: unknown) => void,
  onDone: () => void,
  onError: (msg: string) => void
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId }),
  });

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6);
      if (raw === "[DONE]") { onDone(); return; }
      try {
        const ev = JSON.parse(raw);
        if (ev.type === "session_id") onSessionId(ev.sessionId);
        else if (ev.type === "text") onChunk(ev.text);
        else if (ev.type === "tool_start") onToolStart(ev.name);
        else if (ev.type === "tool_done") onToolDone(ev.name, ev.result);
        else if (ev.type === "done") { onDone(); return; }
        else if (ev.type === "error") onError(ev.message);
      } catch { /* skip malformed lines */ }
    }
  }
  onDone();
}

let msgCounter = 0;
const nextId = () => String(++msgCounter);

const Chat = forwardRef<ChatHandle>((_, ref) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-save beacon on window close
  useEffect(() => {
    function handleUnload() {
      if (sessionId) {
        navigator.sendBeacon(
          "/api/session-beacon",
          JSON.stringify({ sessionId })
        );
      }
    }
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || streaming) return;

    const userMsgId = nextId();
    const assistantMsgId = nextId();

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: text, toolEvents: [] },
      { id: assistantMsgId, role: "assistant", content: "", toolEvents: [] },
    ]);
    setStreaming(true);

    let currentSessionId = sessionId;

    await streamChat(
      text,
      currentSessionId,
      (id) => { setSessionId(id); currentSessionId = id; },
      (chunk) => {
        setMessages((prev) => {
          const last = prev.at(-1)!;
          return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
        });
      },
      (name) => {
        setMessages((prev) => {
          const last = prev.at(-1)!;
          const events = [...(last.toolEvents ?? []), { name, status: "running" as const }];
          return [...prev.slice(0, -1), { ...last, toolEvents: events }];
        });
      },
      (name) => {
        setMessages((prev) => {
          const last = prev.at(-1)!;
          const events = (last.toolEvents ?? []).map((te) =>
            te.name === name && te.status === "running" ? { ...te, status: "done" as const } : te
          );
          return [...prev.slice(0, -1), { ...last, toolEvents: events }];
        });
      },
      () => setStreaming(false),
      (msg) => {
        setMessages((prev) => {
          const last = prev.at(-1)!;
          return [...prev.slice(0, -1), { ...last, content: last.content + `\n\n_Error: ${msg}_` }];
        });
        setStreaming(false);
      }
    );
  }

  function endSession() {
    send("Please end and save this session with a proper summary.");
  }

  useImperativeHandle(ref, () => ({ endSession }));

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input.trim());
      setInput("");
    }
  }

  function handleSend() {
    send(input.trim());
    setInput("");
  }

  function newConversation() {
    setMessages([]);
    setSessionId(null);
  }

  return (
    <div className="chat">
      <div className="messages">
        {messages.length === 0 && (
          <div className="messages-empty">
            Say <em>"start a lesson"</em> for a structured class, or ask anything about Mandarin.
          </div>
        )}
        {messages.map((msg) => (
          <Message
            key={msg.id}
            role={msg.role}
            content={msg.content}
            toolEvents={msg.toolEvents}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="input-area">
        <button
          className="btn btn-sm"
          onClick={newConversation}
          title="Clear chat (does not end the session)"
        >
          New
        </button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message… (Enter to send, Shift+Enter for newline)"
          rows={3}
          disabled={streaming}
        />
        <button
          className="btn btn-primary"
          onClick={handleSend}
          disabled={streaming || !input.trim()}
        >
          {streaming ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
});

Chat.displayName = "Chat";
export default Chat;
