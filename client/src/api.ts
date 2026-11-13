// Standalone RPC client for the external (Render) deployment.
//
// Same contract as the Muse version — POST { action, args } to ./actions —
// but implemented with plain fetch so it runs anywhere, with no Muse SDK.
// The server (server/index.ts) implements the same action names and
// response shapes as the Muse artifact's server actions.

import type { Card, Rules } from "./game";

export interface RoomViewPlayer {
  id: string;
  name: string;
  isBot: boolean;
  isHost: boolean;
  cardCount: number;
  finishRank: number | null;
  avatar: string | null;
}

export interface RoomView {
  found: boolean;
  code: string;
  status: "lobby" | "playing" | "finished";
  isHost: boolean;
  inRoom: boolean;
  rules: Rules;
  players: RoomViewPlayer[];
  myHand: Card[];
  field: { cards: Card[]; ownerId: string } | null;
  currentPlayerId: string | null;
  revolution: boolean;
  backActive: boolean;
  direction: number;
  lockSuit: Card["suit"] | null;
  numberLock: boolean;
  omen: boolean;
  passedIds: string[];
  finishOrder: string[];
  log: string[];
  history: {
    playerId: string;
    name: string;
    cards: Card[] | null;
    note: string | null;
    flow: boolean;
  }[];
  pending: {
    type: "sevenPass" | "tenDiscard" | "qBomber" | "fourStop";
    playerId: string;
    maxCount: number;
  } | null;
  exchange: {
    mode: "simultaneous" | "order";
    pending: {
      giverId: string;
      receiverId: string;
      count: number;
      giveDone: boolean;
      backDone: boolean;
    }[];
  } | null;
  scores: Record<string, number>;
  gameNumber: number;
  matchEnded: boolean;
  gameHistory: {
    gameNo: number;
    entries: { id: string; name: string; finishRank: number; points: number }[];
  }[];
}

export interface OkReason {
  ok: boolean;
  reason: string;
}

async function rpc<T>(action: string, args: unknown): Promise<T> {
  const res = await fetch("./actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, args }),
  });
  if (!res.ok) throw new Error(`actions request failed: ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  createRoom: (args: {
    playerId: string;
    name: string;
    rules: Rules;
    avatar?: string;
  }) => rpc<{ code: string }>("createRoom", args),
  joinRoom: (args: {
    playerId: string;
    name: string;
    code: string;
    avatar?: string;
  }) => rpc<OkReason>("joinRoom", args),
  getRoom: (args: { code: string; playerId: string }) =>
    rpc<RoomView>("getRoom", args),
  startGame: (args: { code: string; playerId: string; botCount: number }) =>
    rpc<OkReason>("startGame", args),
  nextGame: (args: { code: string; playerId: string }) =>
    rpc<OkReason>("nextGame", args),
  endMatch: (args: { code: string; playerId: string }) =>
    rpc<OkReason>("endMatch", args),
  playCards: (args: {
    code: string;
    playerId: string;
    cardIds: string[];
    revolution?: boolean;
  }) => rpc<OkReason>("playCards", args),
  passTurn: (args: { code: string; playerId: string }) =>
    rpc<OkReason>("passTurn", args),
  resolvePending: (args: {
    code: string;
    playerId: string;
    cardIds?: string[];
    rank?: number;
  }) => rpc<OkReason>("resolvePending", args),
  submitExchange: (args: {
    code: string;
    playerId: string;
    cardIds: string[];
  }) => rpc<OkReason>("submitExchange", args),
  backToLobby: (args: { code: string; playerId: string }) =>
    rpc<OkReason>("backToLobby", args),
  leaveRoom: (args: { code: string; playerId: string }) =>
    rpc<OkReason>("leaveRoom", args),
};

// Compatibility helpers so App.tsx can keep deriving types from the client:
//   type RoomView = ApiResponse<typeof api, "getRoom">
export type ApiRequest<TApi, K extends keyof TApi> =
  TApi[K] extends (args: infer A) => unknown ? A : never;
export type ApiResponse<TApi, K extends keyof TApi> =
  TApi[K] extends (...args: never[]) => Promise<infer R> ? R : never;
