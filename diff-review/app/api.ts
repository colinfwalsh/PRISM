// --- Shared types ---

export type DiffLineType = "context" | "add" | "del";

export interface DiffLine {
  type: DiffLineType;
  oldLineNo: number | null;
  newLineNo: number | null;
  content: string;
}

export interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: DiffLine[];
}

export type FileStatus = "added" | "deleted" | "modified" | "renamed";

export interface DiffFile {
  oldPath: string | null;
  newPath: string | null;
  status: FileStatus;
  hunks: Hunk[];
}

export interface DiffResponse {
  round: number;
  baseRef: string | null;
  files: DiffFile[];
}

export interface ChangeRequest {
  id: number;
  file: string;
  side: "old" | "new";
  startLine: number;
  endLine: number;
  text: string;
}

export interface Answer {
  seq: number;
  questionId: number;
  markdown: string;
  ts: number;
}

export interface Annotation {
  file: string;
  side: "old" | "new";
  startLine: number;
  endLine: number;
  text: string;
}

export interface NotifyEvent {
  seq: number;
  message: string;
  kind: string;
  ts: number;
}

// --- Fetch wrappers ---

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  return res.json() as Promise<T>;
}

export function getDiff(): Promise<DiffResponse> {
  return apiFetch<DiffResponse>("/api/diff");
}

export function postQuestion(a: Annotation): Promise<{ id: number }> {
  return apiFetch<{ id: number }>("/api/questions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(a),
  });
}

export function getChangeRequests(): Promise<{ changeRequests: ChangeRequest[] }> {
  return apiFetch<{ changeRequests: ChangeRequest[] }>("/api/change-requests");
}

export function postChangeRequest(a: Annotation): Promise<{ id: number }> {
  return apiFetch<{ id: number }>("/api/change-requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(a),
  });
}

export function deleteChangeRequest(id: number): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/api/change-requests/${id}`, {
    method: "DELETE",
  });
}

export function getAnswers(
  since: number
): Promise<{ answers: Answer[]; cursor: number; heartbeat?: boolean }> {
  return apiFetch<{ answers: Answer[]; cursor: number; heartbeat?: boolean }>(
    `/api/answers?since=${since}`
  );
}

export function getNotifications(
  since: number
): Promise<{ notifications: NotifyEvent[]; cursor: number }> {
  return apiFetch<{ notifications: NotifyEvent[]; cursor: number }>(
    `/api/notifications?since=${since}`
  );
}

export function submit(): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>("/api/submit", { method: "POST" });
}

export function finish(): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>("/api/finish", { method: "POST" });
}
