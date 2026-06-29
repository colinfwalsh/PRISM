export interface Selection {
  file: string;
  side: "old" | "new";
  startLine: number;
  endLine: number;
}

export interface Question {
  id: number;
  file: string;
  side: "old" | "new";
  startLine: number;
  endLine: number;
  text: string;
  status: "pending" | "answered";
  answer?: string;
}
