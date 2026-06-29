import { ChangeRequest } from "../api";

interface SubmitBarProps {
  changeRequests: ChangeRequest[];
  submitting: boolean;
  onRemove: (id: number) => void;
  onSubmit: () => void;
  onFinish: () => void;
}

export default function SubmitBar({
  changeRequests,
  submitting,
  onRemove,
  onSubmit,
  onFinish,
}: SubmitBarProps) {
  return (
    <div className="submit-bar">
      <div className="submit-bar-title">Change Requests</div>
      <div className="submit-bar-queue">
        {changeRequests.length === 0 ? (
          <div className="submit-bar-empty">No queued changes.</div>
        ) : (
          changeRequests.map((cr) => {
            const rangeLabel =
              cr.startLine === cr.endLine
                ? `L${cr.startLine}`
                : `L${cr.startLine}–L${cr.endLine}`;
            const anchor = `${cr.file} · ${cr.side} · ${rangeLabel}`;
            return (
              <div key={cr.id} className="cr-row">
                <div className="cr-row-content">
                  <div className="cr-anchor">{anchor}</div>
                  <div className="cr-text">{cr.text}</div>
                </div>
                <button
                  className="cr-remove"
                  onClick={() => onRemove(cr.id)}
                  disabled={submitting}
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>
      <div className="submit-bar-actions">
        <button
          className="btn btn-submit"
          onClick={onSubmit}
          disabled={changeRequests.length === 0 || submitting}
        >
          {submitting ? "Applying…" : "Submit"}
        </button>
        <button className="btn btn-finish" onClick={onFinish}>
          Finish
        </button>
      </div>
    </div>
  );
}
