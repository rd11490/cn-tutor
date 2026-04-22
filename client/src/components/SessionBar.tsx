interface Props {
  onEndSession: () => void;
}

export default function SessionBar({ onEndSession }: Props) {
  return (
    <header className="session-bar">
      <span className="session-title">cn-tutor</span>
      <span className="session-subtitle">Mandarin · Personal Tutor</span>
      <div className="session-controls">
        <button
          className="btn btn-danger"
          onClick={onEndSession}
          title="Save session summary and end"
        >
          End Session
        </button>
      </div>
    </header>
  );
}
