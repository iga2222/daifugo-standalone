// Standalone server for the external (Render) deployment of 大富豪.
//
// One Bun process serves everything:
//   - POST /actions  — the game API (same action names and response shapes
//     as the Muse artifact's server actions; the game logic in ./game.ts
//     is the identical engine)
//   - GET  /health   — health check for Render
//   - GET  /*        — the built client (./public) with SPA fallback
//
// The port comes from the PORT environment variable (Render sets it).
//
// Storage: rooms live in memory (a Map). That keeps the deployment free of
// any external database, at the cost of losing in-progress rooms when the
// process restarts — on Render's free plan the service sleeps after a
// period of inactivity and wakes with empty memory, so treat rooms as
// per-session. See README-DEPLOY.md for the trade-off and alternatives.

import { join } from "node:path";
import {
  DEFAULT_RULES,
  advanceBots,
  applyPass,
  applyPlay,
  createGame,
  discardGroupsFromHistory,
  normalizeRules,
  resolveExchange,
  resolvePending,
  type GameState,
  type Rules,
} from "./game";

// ---------- room state (ported from the Muse artifact's actions) ----------

interface RosterPlayer {
  id: string;
  name: string;
  isBot: boolean;
  avatar?: string | null;
}

interface RoomData {
  hostId: string;
  status: "lobby" | "playing" | "finished";
  rules: Rules;
  roster: RosterPlayer[];
  game: GameState | null;
  prevWinnerId: string | null;
  prevRanks: Record<string, number> | null;
  scores: Record<string, number>;
  gameNumber: number;
  scored: boolean;
  matchEnded: boolean;
}

function sanitizeAvatar(v: unknown): string | null {
  if (typeof v !== "string") return null;
  if (!v.startsWith("data:image/")) return null;
  if (v.length > 200_000) return null;
  return v;
}

/** Fills defaults for game states saved by older versions. */
function normalizeGame(game: GameState | null): GameState | null {
  if (!game) return null;
  game.direction = game.direction === -1 ? -1 : 1;
  game.lockSuit = game.lockSuit ?? null;
  game.history = Array.isArray(game.history) ? game.history : [];
  game.pending = game.pending ?? null;
  game.exchange = game.exchange ?? null;
  if (game.exchange) {
    for (const s of game.exchange.steps) s.backIds = s.backIds ?? null;
  }
  game.prevChampionId = game.prevChampionId ?? null;
  game.prevRanks = game.prevRanks ?? null;
  game.prevLastId = game.prevLastId ?? null;
  game.numberLock = game.numberLock ?? false;
  game.suitStreak = typeof game.suitStreak === "number" ? game.suitStreak : 0;
  game.suitStreakSuit = game.suitStreakSuit ?? null;
  game.strongBack = game.strongBack ?? false;
  game.omen = game.omen ?? false;
  if (game.field) {
    game.field.kind = game.field.kind ?? "normal";
    game.field.suit = game.field.suit ?? null;
    game.field.low = game.field.low ?? game.field.rank;
    game.field.actualTop = game.field.actualTop ?? game.field.rank;
  }
  return game;
}

function capturePrev(data: RoomData) {
  const game = data.game;
  if (game && game.status === "finished") {
    data.prevWinnerId = game.finishOrder[0] ?? null;
    const ranks: Record<string, number> = {};
    for (const p of game.players) {
      if (p.finishRank !== null) ranks[p.id] = p.finishRank;
    }
    data.prevRanks = ranks;
    if (!data.scored) {
      const total = game.players.length;
      for (const p of game.players) {
        if (p.finishRank !== null) {
          data.scores[p.id] = (data.scores[p.id] ?? 0) + (total - p.finishRank + 1);
        }
      }
      data.scored = true;
    }
  }
}

// ---------- in-memory store ----------

const rooms = new Map<string, RoomData>();
const touchedAt = new Map<string, number>();
const ROOM_TTL_MS = 12 * 60 * 60 * 1000;

function sweepOldRooms() {
  const now = Date.now();
  for (const [code, at] of touchedAt) {
    if (now - at > ROOM_TTL_MS) {
      rooms.delete(code);
      touchedAt.delete(code);
    }
  }
}

/** Returns a deep copy, mirroring the Muse version's DB round-trip. */
function loadRoom(code: string): RoomData | null {
  const data = rooms.get(code);
  if (!data) return null;
  const copy = JSON.parse(JSON.stringify(data)) as RoomData;
  copy.rules = normalizeRules(copy.rules);
  copy.game = normalizeGame(copy.game);
  copy.prevWinnerId = copy.prevWinnerId ?? null;
  copy.prevRanks = copy.prevRanks ?? null;
  copy.scores = copy.scores ?? {};
  copy.gameNumber = copy.gameNumber ?? 1;
  copy.scored = copy.scored ?? false;
  copy.matchEnded = copy.matchEnded ?? false;
  return copy;
}

function saveRoom(code: string, data: RoomData) {
  rooms.set(code, JSON.parse(JSON.stringify(data)) as RoomData);
  touchedAt.set(code, Date.now());
}

function makeCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// ---------- view (same shape the client expects) ----------

function toView(code: string, data: RoomData, playerId: string) {
  const game = data.game;
  const roster = game
    ? game.players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot }))
    : data.roster;
  const me = game?.players.find((p) => p.id === playerId);
  return {
    found: true,
    code,
    status: data.status,
    isHost: data.hostId === playerId,
    inRoom: roster.some((p) => p.id === playerId),
    rules: data.rules,
    players: roster.map((p) => {
      const gp = game?.players.find((g) => g.id === p.id);
      const rosterEntry = data.roster.find((r) => r.id === p.id);
      return {
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        isHost: data.hostId === p.id,
        cardCount: gp ? gp.hand.length : 0,
        finishRank: gp ? gp.finishRank : null,
        avatar: rosterEntry?.avatar ?? null,
      };
    }),
    myHand: me ? me.hand : [],
    field: game?.field
      ? { cards: game.field.cards, ownerId: game.field.ownerId }
      : null,
    currentPlayerId: game ? (game.players[game.current]?.id ?? null) : null,
    revolution: game ? game.revolution : false,
    backActive: game ? game.backActive : false,
    direction: game ? game.direction : 1,
    lockSuit: game ? game.lockSuit : null,
    numberLock: game ? game.numberLock : false,
    omen: game ? game.omen : false,
    passedIds: game ? game.passed : [],
    finishOrder: game ? game.finishOrder : [],
    log: game ? game.log.slice(-10) : [],
    history: game
      ? game.history.map((h) => ({
          playerId: h.playerId,
          name: h.name,
          cards: h.cards,
          note: h.note ?? null,
          flow: h.flow ?? false,
        }))
      : [],
    pending: game?.pending
      ? {
          type: game.pending.type,
          playerId: game.pending.playerId,
          maxCount: game.pending.maxCount,
        }
      : null,
    exchange: game?.exchange
      ? {
          mode: game.exchange.mode,
          pending: (game.exchange.mode === "order"
            ? [game.exchange.steps[game.exchange.index]]
            : game.exchange.steps.filter(
                (s) => s.giveIds == null || s.backIds == null,
              )
          )
            .filter((s): s is NonNullable<typeof s> => !!s)
            .filter((s) => s.giveIds == null || s.backIds == null)
            .map((s) => ({
              giverId: s.giverId,
              receiverId: s.receiverId,
              count: s.count,
              giveDone: s.giveIds != null,
              backDone: s.backIds != null,
            })),
        }
      : null,
    scores: data.scores,
    gameNumber: data.gameNumber,
    matchEnded: data.matchEnded,
  };
}

function emptyView(code: string) {
  return {
    found: false,
    code,
    status: "lobby" as const,
    isHost: false,
    inRoom: false,
    rules: { ...DEFAULT_RULES },
    players: [],
    myHand: [],
    field: null,
    currentPlayerId: null,
    revolution: false,
    backActive: false,
    direction: 1,
    lockSuit: null,
    numberLock: false,
    omen: false,
    passedIds: [],
    finishOrder: [],
    log: [],
    history: [],
    pending: null,
    exchange: null,
    scores: {},
    gameNumber: 1,
    matchEnded: false,
  };
}

// ---------- actions ----------

type Args = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" ? v : 0);

const handlers: Record<string, (args: Args) => unknown> = {
  createRoom(args) {
    sweepOldRooms();
    const playerId = str(args.playerId).slice(0, 64);
    const name = str(args.name).slice(0, 16) || "プレイヤー";
    if (!playerId) return { ok: false, reason: "プレイヤー情報がありません" };
    let code = makeCode();
    for (let i = 0; i < 10; i++) {
      if (!rooms.has(code)) break;
      code = makeCode();
    }
    const data: RoomData = {
      hostId: playerId,
      status: "lobby",
      rules: normalizeRules(args.rules as Rules),
      roster: [
        { id: playerId, name, isBot: false, avatar: sanitizeAvatar(args.avatar) },
      ],
      game: null,
      prevWinnerId: null,
      prevRanks: null,
      scores: {},
      gameNumber: 1,
      scored: false,
      matchEnded: false,
    };
    saveRoom(code, data);
    return { code };
  },

  joinRoom(args) {
    const code = str(args.code);
    const playerId = str(args.playerId).slice(0, 64);
    const name = str(args.name).slice(0, 16) || "プレイヤー";
    const data = loadRoom(code);
    if (!data) return { ok: false, reason: "その合言葉の部屋が見つかりません" };
    const existing = data.roster.find((p) => p.id === playerId);
    if (existing) {
      existing.avatar = sanitizeAvatar(args.avatar);
      existing.name = name;
      saveRoom(code, data);
      return { ok: true, reason: "" };
    }
    if (data.status !== "lobby") {
      return { ok: false, reason: "対局が始まっているため入れません" };
    }
    if (data.roster.length >= 6) {
      return { ok: false, reason: "部屋がいっぱいです（最大6人）" };
    }
    data.roster.push({
      id: playerId,
      name,
      isBot: false,
      avatar: sanitizeAvatar(args.avatar),
    });
    saveRoom(code, data);
    return { ok: true, reason: "" };
  },

  getRoom(args) {
    const code = str(args.code);
    const data = loadRoom(code);
    if (!data) return emptyView(code);
    return toView(code, data, str(args.playerId));
  },

  startGame(args) {
    const code = str(args.code);
    const playerId = str(args.playerId);
    const data = loadRoom(code);
    if (!data) return { ok: false, reason: "部屋が見つかりません" };
    if (data.hostId !== playerId) {
      return { ok: false, reason: "ホストだけが開始できます" };
    }
    const humans = data.roster.filter((p) => !p.isBot);
    const botCount = Math.max(0, Math.min(5, Math.floor(num(args.botCount))));
    const total = humans.length + botCount;
    if (total < 2) return { ok: false, reason: "2人以上で始めてください" };
    if (total > 6) return { ok: false, reason: "最大6人までです" };
    const roster: RosterPlayer[] = [...humans];
    for (let i = 0; i < botCount; i++) {
      roster.push({ id: `bot-${i + 1}`, name: `CPU ${i + 1}`, isBot: true });
    }
    data.roster = roster;
    data.scores = {};
    data.gameNumber = 1;
    data.scored = false;
    data.matchEnded = false;
    data.game = createGame(roster, data.rules, {
      winnerId: data.prevWinnerId,
      ranks: data.prevRanks ?? undefined,
      discardGroups: data.game
        ? discardGroupsFromHistory(data.game)
        : undefined,
    });
    data.status = "playing";
    advanceBots(data.game, data.rules);
    if (data.game.status === "finished") {
      data.status = "finished";
      capturePrev(data);
    }
    saveRoom(code, data);
    return { ok: true, reason: "" };
  },

  nextGame(args) {
    const code = str(args.code);
    const playerId = str(args.playerId);
    const data = loadRoom(code);
    if (!data) return { ok: false, reason: "部屋が見つかりません" };
    if (data.hostId !== playerId) {
      return { ok: false, reason: "ホストだけが開始できます" };
    }
    if (data.status !== "finished" || !data.game) {
      return { ok: false, reason: "対局が終わってから次のゲームへ進めます" };
    }
    capturePrev(data);
    data.game = createGame(data.roster, data.rules, {
      winnerId: data.prevWinnerId,
      ranks: data.prevRanks ?? undefined,
      discardGroups: discardGroupsFromHistory(data.game),
    });
    data.status = "playing";
    data.gameNumber += 1;
    data.scored = false;
    data.matchEnded = false;
    advanceBots(data.game, data.rules);
    if (data.game.status === "finished") {
      data.status = "finished";
      capturePrev(data);
    }
    saveRoom(code, data);
    return { ok: true, reason: "" };
  },

  endMatch(args) {
    const code = str(args.code);
    const data = loadRoom(code);
    if (!data) return { ok: false, reason: "部屋が見つかりません" };
    if (data.hostId !== str(args.playerId)) {
      return { ok: false, reason: "ホストだけが操作できます" };
    }
    capturePrev(data);
    data.matchEnded = true;
    saveRoom(code, data);
    return { ok: true, reason: "" };
  },

  playCards(args) {
    const code = str(args.code);
    const data = loadRoom(code);
    if (!data || !data.game) return { ok: false, reason: "対局がありません" };
    const game = data.game;
    const idx = game.players.findIndex((p) => p.id === str(args.playerId));
    if (idx < 0) return { ok: false, reason: "部屋のメンバーではありません" };
    const cardIds = Array.isArray(args.cardIds) ? (args.cardIds as string[]) : [];
    const res = applyPlay(game, data.rules, idx, cardIds, {
      revolution: typeof args.revolution === "boolean" ? args.revolution : undefined,
    });
    if (!res.ok) return res;
    advanceBots(game, data.rules);
    if (game.status === "finished") {
      data.status = "finished";
      capturePrev(data);
    }
    saveRoom(code, data);
    return { ok: true, reason: "" };
  },

  passTurn(args) {
    const code = str(args.code);
    const data = loadRoom(code);
    if (!data || !data.game) return { ok: false, reason: "対局がありません" };
    const game = data.game;
    const idx = game.players.findIndex((p) => p.id === str(args.playerId));
    if (idx < 0) return { ok: false, reason: "部屋のメンバーではありません" };
    const res = applyPass(game, idx, data.rules);
    if (!res.ok) return res;
    advanceBots(game, data.rules);
    if (game.status === "finished") {
      data.status = "finished";
      capturePrev(data);
    }
    saveRoom(code, data);
    return { ok: true, reason: "" };
  },

  resolvePending(args) {
    const code = str(args.code);
    const data = loadRoom(code);
    if (!data || !data.game) return { ok: false, reason: "対局がありません" };
    const game = data.game;
    const idx = game.players.findIndex((p) => p.id === str(args.playerId));
    if (idx < 0) return { ok: false, reason: "部屋のメンバーではありません" };
    const res = resolvePending(game, data.rules, idx, {
      cardIds: Array.isArray(args.cardIds) ? (args.cardIds as string[]) : undefined,
      rank: typeof args.rank === "number" ? args.rank : undefined,
    });
    if (!res.ok) return res;
    advanceBots(game, data.rules);
    if (game.status === "finished") {
      data.status = "finished";
      capturePrev(data);
    }
    saveRoom(code, data);
    return { ok: true, reason: "" };
  },

  submitExchange(args) {
    const code = str(args.code);
    const data = loadRoom(code);
    if (!data || !data.game) return { ok: false, reason: "対局がありません" };
    const game = data.game;
    const cardIds = Array.isArray(args.cardIds) ? (args.cardIds as string[]) : [];
    const res = resolveExchange(game, data.rules, str(args.playerId), cardIds);
    if (!res.ok) return res;
    advanceBots(game, data.rules);
    if (game.status === "finished") {
      data.status = "finished";
      capturePrev(data);
    }
    saveRoom(code, data);
    return { ok: true, reason: "" };
  },

  backToLobby(args) {
    const code = str(args.code);
    const data = loadRoom(code);
    if (!data) return { ok: false, reason: "部屋が見つかりません" };
    if (data.hostId !== str(args.playerId)) {
      return { ok: false, reason: "ホストだけが操作できます" };
    }
    data.roster = data.roster.filter((p) => !p.isBot);
    data.game = null;
    data.status = "lobby";
    data.scores = {};
    data.gameNumber = 1;
    data.scored = false;
    data.matchEnded = false;
    saveRoom(code, data);
    return { ok: true, reason: "" };
  },

  leaveRoom(args) {
    const code = str(args.code);
    const data = loadRoom(code);
    if (!data) return { ok: false, reason: "部屋が見つかりません" };
    if (data.status === "lobby") {
      data.roster = data.roster.filter((p) => p.id !== str(args.playerId));
      saveRoom(code, data);
    }
    return { ok: true, reason: "" };
  },
};

// ---------- HTTP server ----------

const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC_DIR = join(import.meta.dir, "..", "public");

const server = Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/health") {
      return new Response("ok", { headers: { "content-type": "text/plain" } });
    }

    if (url.pathname === "/actions" && req.method === "POST") {
      let body: { action?: unknown; args?: unknown };
      try {
        body = (await req.json()) as { action?: unknown; args?: unknown };
      } catch {
        return Response.json(
          { ok: false, reason: "リクエスト形式が正しくありません" },
          { status: 400 },
        );
      }
      const action = typeof body.action === "string" ? body.action : "";
      const handler = handlers[action];
      if (!handler) {
        return Response.json(
          { ok: false, reason: "不明な操作です" },
          { status: 404 },
        );
      }
      try {
        const args = (body.args ?? {}) as Args;
        return Response.json(handler(args) ?? { ok: true, reason: "" });
      } catch (err) {
        console.error(`action ${action} failed`, err);
        return Response.json(
          { ok: false, reason: "サーバーでエラーが発生しました" },
          { status: 500 },
        );
      }
    }

    // Static files (built client) with SPA fallback.
    const pathname = decodeURIComponent(url.pathname);
    const rel = pathname === "/" ? "/index.html" : pathname;
    const file = Bun.file(join(PUBLIC_DIR, rel));
    if (await file.exists()) return new Response(file);
    if (!/\.[a-zA-Z0-9]+$/.test(pathname)) {
      const index = Bun.file(join(PUBLIC_DIR, "index.html"));
      if (await index.exists()) {
        return new Response(index, {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
    }
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`大富豪 standalone server listening on http://0.0.0.0:${server.port}`);
