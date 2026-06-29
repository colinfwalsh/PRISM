import { DiffFile } from "../api";
import { Selection } from "../types";
import FileBlock from "./FileBlock";

interface DiffViewProps {
  files: DiffFile[];
  selection: Selection | null;
  onLineMouseDown: (file: string, side: "old" | "new", line: number, shiftKey: boolean) => void;
  onLineEnter: (file: string, side: "old" | "new", line: number) => void;
}

export default function DiffView({
  files,
  selection,
  onLineMouseDown,
  onLineEnter,
}: DiffViewProps) {
  if (files.length === 0) {
    return <p className="no-changes">No changes.</p>;
  }
  return (
    <div className="diff-view">
      {files.map((file, i) => (
        <FileBlock
          key={i}
          file={file}
          selection={selection}
          onLineMouseDown={onLineMouseDown}
          onLineEnter={onLineEnter}
        />
      ))}
    </div>
  );
}
