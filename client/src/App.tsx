import { useRef, useState } from "react";
import Chat, { type ChatHandle } from "./components/Chat";
import SessionBar from "./components/SessionBar";

type Mode = "chat" | "assess";

export default function App() {
  const chatRef = useRef<ChatHandle>(null);
  const [mode, setMode] = useState<Mode>("chat");
  const [assessedLevel, setAssessedLevel] = useState<number | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setAssessedLevel(null);
  }

  return (
    <div className="app">
      <SessionBar
        mode={mode}
        onEndSession={() => chatRef.current?.endSession()}
        onStartAssess={() => switchMode("assess")}
        onBackToStudy={() => switchMode("chat")}
      />
      {assessedLevel !== null && (
        <div className="assessed-banner">
          Assessment complete — estimated level: <strong>HSK {assessedLevel}</strong>.{" "}
          <button className="btn btn-sm" onClick={() => switchMode("chat")}>
            Start Studying
          </button>
        </div>
      )}
      <main className="chat-pane">
        <Chat
          key={mode}
          ref={chatRef}
          mode={mode}
          onLevelAssessed={(level) => setAssessedLevel(level)}
        />
      </main>
    </div>
  );
}
