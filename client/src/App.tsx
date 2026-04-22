import { useRef } from "react";
import Chat, { type ChatHandle } from "./components/Chat";
import SessionBar from "./components/SessionBar";

export default function App() {
  const chatRef = useRef<ChatHandle>(null);

  return (
    <div className="app">
      <SessionBar onEndSession={() => chatRef.current?.endSession()} />
      <main className="chat-pane">
        <Chat ref={chatRef} />
      </main>
    </div>
  );
}
