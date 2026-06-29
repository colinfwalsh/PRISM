import { useEffect, useRef, useState } from "react";
import { Selection } from "../types";

interface SelectionPopoverProps {
  selection: Selection;
  onAsk: (text: string) => void;
  onRequest: (text: string) => void;
  onCancel: () => void;
  busy?: boolean;
}

export default function SelectionPopover({
  selection,
  onAsk,
  onRequest,
  onCancel,
  busy,
}: SelectionPopoverProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const rangeLabel =
    selection.startLine === selection.endLine
      ? `L${selection.startLine}`
      : `L${selection.startLine}–L${selection.endLine}`;

  const label = `${selection.file} · ${selection.side} · ${rangeLabel}`;
  const disabled = !text.trim() || !!busy;

  return (
    <div className="popover">
      <div className="popover-label">{label}</div>
      <textarea
        ref={textareaRef}
        className="popover-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter your comment…"
        rows={4}
      />
      <div className="popover-buttons">
        <button
          className="btn btn-ask"
          onClick={() => onAsk(text)}
          disabled={disabled}
        >
          Ask question
        </button>
        <button
          className="btn btn-request"
          onClick={() => onRequest(text)}
          disabled={disabled}
        >
          Request change
        </button>
        <button className="btn btn-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
