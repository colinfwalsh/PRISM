import { Fragment, useMemo } from "react";
import { DiffFile, DiffLine, Hunk } from "../api";
import { Selection } from "../types";
import HunkRow from "./HunkRow";
import { languageForPath, highlightLine } from "../highlight";

interface Row {
  left: DiffLine | null;
  right: DiffLine | null;
}

function pairLines(hunk: Hunk): Row[] {
  const rows: Row[] = [];
  let delBuf: DiffLine[] = [];
  let addBuf: DiffLine[] = [];

  function flush() {
    const len = Math.max(delBuf.length, addBuf.length);
    for (let i = 0; i < len; i++) {
      rows.push({ left: delBuf[i] ?? null, right: addBuf[i] ?? null });
    }
    delBuf = [];
    addBuf = [];
  }

  for (const line of hunk.lines) {
    if (line.type === "context") {
      flush();
      rows.push({ left: line, right: line });
    } else if (line.type === "del") {
      delBuf.push(line);
    } else {
      addBuf.push(line);
    }
  }
  flush();
  return rows;
}

interface FileBlockProps {
  file: DiffFile;
  selection: Selection | null;
  onLineMouseDown: (file: string, side: "old" | "new", line: number, shiftKey: boolean) => void;
  onLineEnter: (file: string, side: "old" | "new", line: number) => void;
}

export default function FileBlock({
  file,
  selection,
  onLineMouseDown,
  onLineEnter,
}: FileBlockProps) {
  const fileKey = file.newPath ?? file.oldPath ?? "(unknown)";
  const lang = languageForPath(fileKey);

  const hunkRows = useMemo(
    () => file.hunks.map((hunk) =>
      pairLines(hunk).map((row) => ({
        ...row,
        leftHtml: row.left ? highlightLine(row.left.content, lang) : null,
        rightHtml: row.right ? highlightLine(row.right.content, lang) : null,
      }))),
    [file, lang]
  );

  const pathDisplay =
    file.status === "renamed" ? (
      <span className="file-path">
        {file.oldPath} → {file.newPath}
      </span>
    ) : (
      <span className="file-path">{fileKey}</span>
    );

  return (
    <div className="file-block">
      <div className="file-header">
        <span className={`status-badge status-${file.status}`}>{file.status}</span>
        {pathDisplay}
      </div>
      <table className="diff-table">
        <colgroup>
          <col className="col-lineno" />
          <col className="col-code" />
          <col className="col-lineno" />
          <col className="col-code" />
        </colgroup>
        <tbody>
          {file.hunks.map((hunk, hi) => (
            <Fragment key={hi}>
              <tr className="hunk-header-row">
                <td colSpan={4} className="hunk-header-cell">
                  {hunk.header}
                </td>
              </tr>
              {hunkRows[hi].map((row, ri) => (
                <HunkRow
                  key={`${hi}-${ri}`}
                  row={row}
                  fileKey={fileKey}
                  selection={selection}
                  onLineMouseDown={onLineMouseDown}
                  onLineEnter={onLineEnter}
                  leftHtml={row.leftHtml}
                  rightHtml={row.rightHtml}
                />
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
