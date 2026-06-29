import { DiffLine } from "../api";
import { Selection } from "../types";

interface HunkRowProps {
  row: { left: DiffLine | null; right: DiffLine | null };
  fileKey: string;
  selection: Selection | null;
  onLineMouseDown: (file: string, side: "old" | "new", line: number, shiftKey: boolean) => void;
  onLineEnter: (file: string, side: "old" | "new", line: number) => void;
  leftHtml: string | null;
  rightHtml: string | null;
}

function inSelection(
  selection: Selection | null,
  fileKey: string,
  side: "old" | "new",
  lineNo: number
): boolean {
  if (!selection) return false;
  return (
    selection.file === fileKey &&
    selection.side === side &&
    lineNo >= selection.startLine &&
    lineNo <= selection.endLine
  );
}

export default function HunkRow({
  row,
  fileKey,
  selection,
  onLineMouseDown,
  onLineEnter,
  leftHtml,
  rightHtml,
}: HunkRowProps) {
  const { left, right } = row;

  const leftLineNo = left?.oldLineNo ?? null;
  const rightLineNo = right?.newLineNo ?? null;

  const leftSelectable = left !== null && leftLineNo !== null;
  const rightSelectable = right !== null && rightLineNo !== null;

  const leftSelected = leftSelectable && inSelection(selection, fileKey, "old", leftLineNo!);
  const rightSelected = rightSelectable && inSelection(selection, fileKey, "new", rightLineNo!);

  return (
    <tr className="diff-row">
      <td className="line-no">{leftLineNo !== null ? leftLineNo : ""}</td>

      {left === null ? (
        <td className="cell-code cell-filler" />
      ) : leftSelectable ? (
        <td
          className={`cell-code cell-${left.type}${leftSelected ? " selected" : ""}`}
          data-file={fileKey}
          data-side="old"
          data-line={leftLineNo!}
          onMouseDown={(e) => {
            e.preventDefault();
            onLineMouseDown(fileKey, "old", leftLineNo!, e.shiftKey);
          }}
          onMouseEnter={() => onLineEnter(fileKey, "old", leftLineNo!)}
          dangerouslySetInnerHTML={{ __html: leftHtml ?? "" }}
        />
      ) : (
        <td className={`cell-code cell-${left.type}`} dangerouslySetInnerHTML={{ __html: leftHtml ?? "" }} />
      )}

      <td className="line-no">{rightLineNo !== null ? rightLineNo : ""}</td>

      {right === null ? (
        <td className="cell-code cell-filler" />
      ) : rightSelectable ? (
        <td
          className={`cell-code cell-${right.type}${rightSelected ? " selected" : ""}`}
          data-file={fileKey}
          data-side="new"
          data-line={rightLineNo!}
          onMouseDown={(e) => {
            e.preventDefault();
            onLineMouseDown(fileKey, "new", rightLineNo!, e.shiftKey);
          }}
          onMouseEnter={() => onLineEnter(fileKey, "new", rightLineNo!)}
          dangerouslySetInnerHTML={{ __html: rightHtml ?? "" }}
        />
      ) : (
        <td className={`cell-code cell-${right.type}`} dangerouslySetInnerHTML={{ __html: rightHtml ?? "" }} />
      )}
    </tr>
  );
}
