interface Props {
  mode: "chat" | "assess";
  onEndSession: () => void;
  onStartAssess: () => void;
  onBackToStudy: () => void;
}

export default function SessionBar({ mode, onEndSession, onStartAssess, onBackToStudy }: Props) {
  return (
    <header className="session-bar">
      <span className="session-title">cn-tutor</span>
      <span className="session-subtitle">
        {mode === "assess" ? "Mandarin · Proficiency Assessment" : "Mandarin · Personal Tutor"}
      </span>
      <div className="session-controls">
        {mode === "chat" ? (
          <>
            <button className="btn btn-sm" onClick={onStartAssess} title="Test your proficiency level">
              Test Level
            </button>
            <button className="btn btn-danger" onClick={onEndSession} title="Save session summary and end">
              End Session
            </button>
          </>
        ) : (
          <button className="btn btn-sm" onClick={onBackToStudy} title="Return to study mode">
            Back to Study
          </button>
        )}
      </div>
    </header>
  );
}
