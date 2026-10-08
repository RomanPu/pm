import type { BoardData } from "@/lib/kanban";

export const fetchBoard = async (): Promise<BoardData> => {
  const response = await fetch("/api/board");
  if (!response.ok) {
    throw new Error(`Failed to load board (${response.status})`);
  }
  return response.json();
};

export const saveBoard = async (board: BoardData) => {
  const response = await fetch("/api/board", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(board),
  });
  if (!response.ok) {
    throw new Error(`Failed to save board (${response.status})`);
  }
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatResult = { reply: string; board_updated: boolean; board: BoardData };

export const sendChat = async (message: string, history: ChatMessage[]): Promise<ChatResult> => {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  if (!response.ok) {
    throw new Error(`Chat failed (${response.status})`);
  }
  return response.json();
};

export const getMe = async (): Promise<string | null> => {
  const response = await fetch("/api/me");
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  return data.username;
};

export const login = async (username: string, password: string): Promise<boolean> => {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return response.ok;
};

export const logout = async () => {
  await fetch("/api/logout", { method: "POST" });
};
