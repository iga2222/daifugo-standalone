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
// Storage: rooms are kept in memory (a Map) AND written through to a JSON
// file on disk (data/rooms.json next to this package, or $ROOMS_FILE).
// The file is reloaded at boot, so rooms survive the process going away —
// on Render's free plan the service sleeps after a period of inactivity
// and used to wake with empty memory, which made friends hit
// "その合言葉の部屋が見つかりません" for rooms the host had just created.
// A full redeploy may still reset the filesystem, so treat rooms as
// long-lived but not eternal. See README-DEPLOY.md.

import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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

/** 部屋チャットの1メッセージ。 */
interface ChatMessage {
  id: string;
  playerId: string;
  name: string;
  text: string;
  at: number; // epoch ms
}

/** 1ゲーム分の最終順位の記録（対戦終了画面の「ゲームごとの順位」用）。 */
interface GameResultRecord {
  gameNo: number;
  entries: { id: string; name: string; finishRank: number; points: number }[];
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
  gameHistory: GameResultRecord[];
  chat: ChatMessage[];
  isPermanent?: boolean;
  waiting?: RosterPlayer[];
}

const PERMANENT_ROOM_CODE = "BEP1";
const PERMANENT_ROOM_NAME = "別班";
/** 隠れ部屋「別班」への秘密の言葉。変更はこの1か所だけ。 */
const PERMANENT_ROOM_SECRET = "別班";

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
      data.gameHistory = data.gameHistory ?? [];
      if (!data.gameHistory.some((g) => g.gameNo === data.gameNumber)) {
        data.gameHistory.push({
          gameNo: data.gameNumber,
          entries: game.players
            .filter((p) => p.finishRank !== null)
            .map((p) => ({
              id: p.id,
              name: p.name,
              finishRank: p.finishRank!,
              points: total - p.finishRank! + 1,
            }))
            .sort((a, b) => a.finishRank - b.finishRank),
        });
      }
      data.scored = true;
    }
  }
}

// ---------- room store (memory + write-through disk snapshot) ----------

const rooms = new Map<string, RoomData>();
const touchedAt = new Map<string, number>();
const ROOM_TTL_MS = 12 * 60 * 60 * 1000;

const ROOMS_FILE =
  process.env.ROOMS_FILE ?? join(import.meta.dir, "..", "data", "rooms.json");

/** Snapshots every room to disk so a sleep/restart does not wipe them. */
function persistRooms() {
  try {
    mkdirSync(dirname(ROOMS_FILE), { recursive: true });
    const tmp = `${ROOMS_FILE}.tmp`;
    writeFileSync(
      tmp,
      JSON.stringify({
        rooms: [...rooms.entries()],
        touchedAt: [...touchedAt.entries()],
      }),
    );
    renameSync(tmp, ROOMS_FILE);
  } catch (err) {
    // 保存できなくても対局は止めない（メモリ上では継続できる）
    console.error("部屋データの保存に失敗しました", err);
  }
}

/** Reloads the disk snapshot at boot (no-op when there is none yet). */
function restoreRooms() {
  try {
    const parsed = JSON.parse(readFileSync(ROOMS_FILE, "utf8")) as {
      rooms?: [string, RoomData][];
      touchedAt?: [string, number][];
    };
    for (const [code, data] of parsed.rooms ?? []) rooms.set(code, data);
    for (const [code, at] of parsed.touchedAt ?? []) touchedAt.set(code, at);
  } catch {
    /* スナップショットが無い／壊れている場合は空から始める */
  }
}

function createEmptyPermanentRoom(): RoomData {
  return {
    hostId: "",
    status: "lobby",
    rules: { ...DEFAULT_RULES },
    roster: [],
    game: null,
    prevWinnerId: null,
    prevRanks: null,
    scores: {},
    gameNumber: 1,
    scored: false,
    matchEnded: false,
    gameHistory: [],
    chat: [],
    isPermanent: true,
    waiting: [],
  };
}
function ensurePermanentRoom(): RoomData {
  const existing = loadRoom(PERMANENT_ROOM_CODE);
  if (existing) return existing;
  const data = createEmptyPermanentRoom();
  saveRoom(PERMANENT_ROOM_CODE, data);
  return data;
}
function syncPermanentHost(data: RoomData) {
  if (!data.isPermanent) return;
  const humans = data.roster.filter((p) => !p.isBot);
  data.hostId = humans[0]?.id ?? "";
}
/** 誰もいなくなった常設ルームは初期状態に戻す（部屋自体は消さない）。
 * ロビー状態だけでなく、対戦終了（最終結果表示）のまま全員が抜けた場合も
 * 対象にする：合計点・ゲームごとの順位履歴・チャットまで消して、次の対戦が
 * 必ず0点から始まるようにする。初期化したら true を返す。 */
function resetPermanentIfEmpty(data: RoomData): boolean {
  if (!data.isPermanent) return false;
  const humans = data.roster.filter((p) => !p.isBot).length;
  if (
    humans === 0 &&
    (data.waiting ?? []).length === 0 &&
    (data.status === "lobby" || data.status === "finished")
  ) {
    const fresh = createEmptyPermanentRoom();
    data.hostId = fresh.hostId;
    data.status = "lobby";
    data.rules = fresh.rules;
    data.game = null;
    data.scores = {};
    data.gameNumber = 1;
    data.scored = false;
    data.matchEnded = false;
    data.gameHistory = [];
    data.chat = [];
    data.prevWinnerId = null;
    data.prevRanks = null;
    return true;
  }
  return false;
}
function joinPermanentRoomData(
  data: RoomData,
  playerId: string,
  name: string,
  avatar: unknown,
  rules?: Rules,
): { ok: boolean; reason: string } {
  const av = sanitizeAvatar(avatar);
  const inRoster = data.roster.find((p) => p.id === playerId);
  if (inRoster) { inRoster.avatar = av; inRoster.name = name; return { ok: true, reason: "" }; }
  data.waiting = Array.isArray(data.waiting) ? data.waiting : [];
  const inWaiting = data.waiting.find((p) => p.id === playerId);
  if (inWaiting) { inWaiting.avatar = av; inWaiting.name = name; return { ok: true, reason: "" }; }
  if (data.status === "lobby") {
    if (data.roster.filter((p) => !p.isBot).length >= 6) return { ok: false, reason: "別班は満員です（最大6人）" };
    const wasEmpty = data.roster.filter((p) => !p.isBot).length === 0;
    data.roster.push({ id: playerId, name, isBot: false, avatar: av });
    if (wasEmpty) { data.hostId = playerId; if (rules) data.rules = normalizeRules(rules); } else syncPermanentHost(data);
    return { ok: true, reason: "" };
  }
  const inGameCount = data.game ? data.game.players.length : data.roster.length;
  if (inGameCount + data.waiting.length >= 6) return { ok: false, reason: "別班は満員です（最大6人）" };
  data.waiting.push({ id: playerId, name, isBot: false, avatar: av });
  return { ok: true, reason: "" };
}

function sweepOldRooms() {
  const now = Date.now();
  let removed = false;
  for (const [code, at] of touchedAt) {
    if (code === PERMANENT_ROOM_CODE) continue;
    if (now - at > ROOM_TTL_MS) {
      rooms.delete(code);
      touchedAt.delete(code);
      removed = true;
    }
  }
  if (removed) persistRooms();
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
  copy.gameHistory = Array.isArray(copy.gameHistory) ? copy.gameHistory : [];
  copy.chat = Array.isArray(copy.chat) ? copy.chat : [];
  copy.waiting = Array.isArray(copy.waiting) ? copy.waiting : [];
  copy.isPermanent = copy.isPermanent ?? code === PERMANENT_ROOM_CODE;
  return copy;
}

function saveRoom(code: string, data: RoomData) {
  rooms.set(code, JSON.parse(JSON.stringify(data)) as RoomData);
  touchedAt.set(code, Date.now());
  persistRooms();
}

function makeCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// ---------- view (same shape the client expects) ----------

function toView(code: string, data: RoomData, playerId: string) {
  const game = data.game;
  const waiting = data.waiting ?? [];
  const baseRoster = game
    ? game.players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot }))
    : data.roster;
  const roster = [
    ...baseRoster,
    ...waiting.filter((w) => !baseRoster.some((p) => p.id === w.id)),
  ];
  const me = game?.players.find((p) => p.id === playerId);
  // 覗き見（上がった人だけ）: 取得者本人が上がり済みで対局が続いている間
  // だけ、他の全員の残り手札を渡す。上がり済みの相手は空配列（0枚）になる。
  // 未上がりの人には他人の手札を一切送らない。
  const peekHands: Record<string, { id: string; suit: string; rank: number }[]> = {};
  if (
    game &&
    data.status === "playing" &&
    game.status === "playing" &&
    me &&
    me.finishRank !== null
  ) {
    for (const p of game.players) {
      if (p.id !== playerId) peekHands[p.id] = [...p.hand];
    }
  }
  return {
    found: true,
    code,
    status: data.status,
    isHost: data.hostId === playerId,
    inRoom:
      roster.some((p) => p.id === playerId) ||
      data.roster.some((p) => p.id === playerId),
    rules: data.rules,
    players: roster.map((p) => {
      const gp = game?.players.find((g) => g.id === p.id);
      const rosterEntry =
        data.roster.find((r) => r.id === p.id) ??
        waiting.find((r) => r.id === p.id);
      return {
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        isHost: data.hostId === p.id,
        cardCount: gp ? gp.hand.length : 0,
        finishRank: gp ? gp.finishRank : null,
        prevRank: gp ? (game?.prevRanks?.[gp.id] ?? null) : null,
        avatar: rosterEntry?.avatar ?? null,
      };
    }),
    myHand: me ? me.hand : [],
    peekHands,
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
    gameHistory: data.gameHistory ?? [],
    chat: data.chat ?? [],
    isPermanent: !!data.isPermanent || code === PERMANENT_ROOM_CODE,
    roomName:
      !!data.isPermanent || code === PERMANENT_ROOM_CODE
        ? PERMANENT_ROOM_NAME
        : null,
    waitingIds: waiting.map((w) => w.id),
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
    peekHands: {},
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
    gameHistory: [],
    chat: [],
    isPermanent: false,
    roomName: null,
    waitingIds: [],
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
    // 空いている合言葉が見つかるまで引き直す（上限まで引いても重なったら
    // 既存の部屋を上書きせず、作成エラーとして返す）
    let code = makeCode();
    for (let i = 0; i < 500 && rooms.has(code); i++) {
      code = makeCode();
    }
    if (rooms.has(code)) {
      return { ok: false, reason: "部屋を作れませんでした。もう一度お試しください" };
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
      gameHistory: [],
      chat: [],
      isPermanent: false,
      waiting: [],
    };
    saveRoom(code, data);
    return { code };
  },

  joinRoom(args) {
    const input = str(args.code).trim();
    // 秘密の言葉の判定は通常の部屋検索より先に行う
    if (input === PERMANENT_ROOM_SECRET || input === PERMANENT_ROOM_CODE) {
      const pdata = ensurePermanentRoom();
      // 誰もいないのに前の対戦の記録が残っていたら、入室前に初期化する
      resetPermanentIfEmpty(pdata);
      const res = joinPermanentRoomData(
        pdata,
        str(args.playerId).slice(0, 64),
        str(args.name).slice(0, 16) || "プレイヤー",
        args.avatar,
      );
      if (res.ok) saveRoom(PERMANENT_ROOM_CODE, pdata);
      return { ...res, code: PERMANENT_ROOM_CODE };
    }
    if (!/^\d{4}$/.test(input)) {
      return { ok: false, reason: "その合言葉の部屋が見つかりません", code: "" };
    }
    const code = input;
    const playerId = str(args.playerId).slice(0, 64);
    const name = str(args.name).slice(0, 16) || "プレイヤー";
    const data = loadRoom(code);
    if (!data) return { ok: false, reason: "その合言葉の部屋が見つかりません", code: "" };
    const existing = data.roster.find((p) => p.id === playerId);
    if (existing) {
      existing.avatar = sanitizeAvatar(args.avatar);
      existing.name = name;
      saveRoom(code, data);
      return { ok: true, reason: "", code };
    }
    if (data.status !== "lobby") {
      return { ok: false, reason: "対局が始まっているため入れません", code: "" };
    }
    if (data.roster.length >= 6) {
      return { ok: false, reason: "部屋がいっぱいです（最大6人）", code: "" };
    }
    data.roster.push({
      id: playerId,
      name,
      isBot: false,
      avatar: sanitizeAvatar(args.avatar),
    });
    saveRoom(code, data);
    return { ok: true, reason: "", code };
  },

  getRoom(args) {
    const code = str(args.code);
    if (code === PERMANENT_ROOM_CODE) {
      const pdata = ensurePermanentRoom();
      // 対戦終了のまま全員抜けた部屋が残っていたら、表示前に初期化する
      // （前の対戦の合計点や順位履歴を次の人に見せない）
      if (resetPermanentIfEmpty(pdata)) saveRoom(PERMANENT_ROOM_CODE, pdata);
      return toView(code, pdata, str(args.playerId));
    }
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
    const waitingHumans = (data.waiting ?? []).filter((p) => !p.isBot);
    const humans = [
      ...data.roster.filter((p) => !p.isBot),
      ...waitingHumans.filter((w) => !data.roster.some((p) => p.id === w.id)),
    ];
    const botCount = Math.max(0, Math.min(5, Math.floor(num(args.botCount))));
    const total = humans.length + botCount;
    if (total < 2) return { ok: false, reason: "2人以上で始めてください" };
    if (total > 6) return { ok: false, reason: "最大6人までです" };
    const roster: RosterPlayer[] = [...humans];
    for (let i = 0; i < botCount; i++) {
      roster.push({ id: `bot-${i + 1}`, name: `CPU ${i + 1}`, isBot: true });
    }
    data.roster = roster;
    data.waiting = [];
    data.scores = {};
    data.gameNumber = 1;
    data.scored = false;
    data.matchEnded = false;
    data.gameHistory = [];
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
    if (data.waiting && data.waiting.length > 0) {
      const bots = data.roster.filter((p) => p.isBot);
      const humansIn = data.roster.filter((p) => !p.isBot);
      data.roster = [
        ...humansIn,
        ...data.waiting.filter((w) => !humansIn.some((p) => p.id === w.id)),
        ...bots,
      ].slice(0, 6);
      data.waiting = [];
    }
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
    data.roster = [
      ...data.roster.filter((p) => !p.isBot),
      ...(data.waiting ?? []).filter(
        (w) => !data.roster.some((p) => p.id === w.id),
      ),
    ];
    data.waiting = [];
    data.game = null;
    data.status = "lobby";
    data.scores = {};
    data.gameNumber = 1;
    data.scored = false;
    data.matchEnded = false;
    data.gameHistory = [];
    saveRoom(code, data);
    return { ok: true, reason: "" };
  },

  sendChat(args) {
    const code = str(args.code);
    const playerId = str(args.playerId).slice(0, 64);
    const text = str(args.text).trim().slice(0, 200);
    const data = loadRoom(code);
    if (!data) return { ok: false, reason: "部屋が見つかりません" };
    if (!text) return { ok: false, reason: "メッセージが空です" };
    const me =
      data.roster.find((p) => p.id === playerId && !p.isBot) ??
      (data.waiting ?? []).find((p) => p.id === playerId && !p.isBot);
    if (!me) return { ok: false, reason: "部屋のメンバーではありません" };
    data.chat = Array.isArray(data.chat) ? data.chat : [];
    data.chat.push({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      playerId,
      name: me.name,
      text,
      at: Date.now(),
    });
    if (data.chat.length > 100) data.chat = data.chat.slice(-100);
    saveRoom(code, data);
    return { ok: true, reason: "" };
  },

  getBeppanStatus() {
    const data = ensurePermanentRoom();
    const waitingCount = (data.waiting ?? []).length;
    const humanCount = data.roster.filter((p) => !p.isBot).length + waitingCount;
    const inGameCount = data.game ? data.game.players.length : data.roster.length;
    const isFull =
      data.status === "lobby"
        ? data.roster.filter((p) => !p.isBot).length >= 6
        : inGameCount + waitingCount >= 6;
    const host = data.roster.find((p) => p.id === data.hostId);
    return {
      playerCount: humanCount,
      waitingCount,
      status: data.status,
      isFull,
      hostName: host ? host.name : null,
    };
  },

  joinBeppan(args) {
    const data = ensurePermanentRoom();
    // 誰もいないのに前の対戦の記録が残っていたら、入室前に初期化する
    resetPermanentIfEmpty(data);
    const res = joinPermanentRoomData(
      data,
      str(args.playerId).slice(0, 64),
      str(args.name).slice(0, 16) || "プレイヤー",
      args.avatar,
      args.rules as Rules | undefined,
    );
    if (res.ok) saveRoom(PERMANENT_ROOM_CODE, data);
    return { ...res, code: PERMANENT_ROOM_CODE };
  },

  updateRoomRules(args) {
    const code = str(args.code);
    const data =
      code === PERMANENT_ROOM_CODE ? ensurePermanentRoom() : loadRoom(code);
    if (!data) return { ok: false, reason: "部屋が見つかりません" };
    if (data.hostId !== str(args.playerId)) {
      return { ok: false, reason: "ホストだけがルールを変更できます" };
    }
    if (data.status !== "lobby") {
      return { ok: false, reason: "ロビーでのみ変更できます" };
    }
    data.rules = normalizeRules(args.rules as Rules);
    saveRoom(code, data);
    return { ok: true, reason: "" };
  },

  leaveRoom(args) {
    const code = str(args.code);
    if (code === PERMANENT_ROOM_CODE) {
      const data = ensurePermanentRoom();
      const playerId = str(args.playerId);
      const beforeWaiting = (data.waiting ?? []).length;
      data.waiting = (data.waiting ?? []).filter((p) => p.id !== playerId);
      let changed = data.waiting.length !== beforeWaiting;
      if (data.status === "lobby" || data.status === "finished") {
        const before = data.roster.length;
        data.roster = data.roster.filter((p) => p.id !== playerId);
        changed = changed || data.roster.length !== before;
        if (changed) {
          syncPermanentHost(data);
          // ロビーでも対戦終了状態でも、最後の1人が抜けたら初期化する
          resetPermanentIfEmpty(data);
        }
      }
      if (changed) saveRoom(code, data);
      return { ok: true, reason: "" };
    }
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

restoreRooms();
sweepOldRooms();
ensurePermanentRoom();

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

    const pathname = decodeURIComponent(url.pathname);

    // iOS home-screen icons at fixed root paths. Safari looks for
    // /apple-touch-icon.png (and the -precomposed variant) at the site root
    // in addition to the <link> in the HTML; serving the current 180px icon
    // there keeps "Add to Home Screen" from falling back to a stale cached
    // icon or a page screenshot. The HTML link itself points at
    // /apple-touch-icon-v2.png — a path no older icon ever used — so caches
    // keyed to the previous icon URL cannot hand back a stale icon.
    // Fixed-name copies live in public/; after a client rebuild wipes them,
    // fall back to the bundled hashed asset.
    if (
      pathname === "/apple-touch-icon.png" ||
      pathname === "/apple-touch-icon-precomposed.png" ||
      pathname === "/apple-touch-icon-v2.png"
    ) {
      const iconHeaders = {
        "content-type": "image/png",
        "cache-control": "no-cache",
      };
      const direct = Bun.file(join(PUBLIC_DIR, "apple-touch-icon.png"));
      if (await direct.exists()) return new Response(direct, { headers: iconHeaders });
      try {
        const asset = readdirSync(join(PUBLIC_DIR, "assets")).find(
          (n) => n.startsWith("icon-180-") && n.endsWith(".png"),
        );
        if (asset) {
          return new Response(Bun.file(join(PUBLIC_DIR, "assets", asset)), {
            headers: iconHeaders,
          });
        }
      } catch {
        // fall through to 404
      }
      return new Response("Not Found", { status: 404 });
    }

    // Static files (built client) with SPA fallback. HTML is served with
    // Cache-Control: no-cache so updated builds (and the icon links inside
    // them) reach devices promptly; hashed assets keep default caching.
    const rel = pathname === "/" ? "/index.html" : pathname;
    const file = Bun.file(join(PUBLIC_DIR, rel));
    if (await file.exists()) {
      if (rel.endsWith(".html")) {
        return new Response(file, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-cache",
          },
        });
      }
      return new Response(file);
    }
    if (!/\.[a-zA-Z0-9]+$/.test(pathname)) {
      const index = Bun.file(join(PUBLIC_DIR, "index.html"));
      if (await index.exists()) {
        return new Response(index, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-cache",
          },
        });
      }
    }
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`大富豪 standalone server listening on http://0.0.0.0:${server.port}`);
