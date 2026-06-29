import ReactMarkdown from "react-markdown";
import { Question } from "../types";

interface ThreadProps {
  question: Question;
}

export default function Thread({ question }: ThreadProps) {
  const rangeLabel =
    question.startLine === question.endLine
      ? `L${question.startLine}`
      : `L${question.startLine}–L${question.endLine}`;

  const anchor = `${question.file} · ${question.side} · ${rangeLabel}`;

  return (
    <div className="thread-card">
      <div className="thread-anchor">{anchor}</div>
      <div className="thread-question">{question.text}</div>
      {question.status === "pending" ? (
        <div className="thread-pending">🤔 agent is thinking…</div>
      ) : (
        <div className="thread-answer">
          <ReactMarkdown>{question.answer ?? ""}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
