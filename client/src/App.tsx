import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "./api";
import { isStandalone } from "./pwa";
import {
DEFAULT_RULES,
advanceExchange,
aiChoosePlay,
applyPass,
applyPlay,
botResolvePending,
canPlay,
cardLabel,
checkRevolutionTrigger,
createGame,
discardGroupsFromHistory,
emperorInfo,
ensureActiveCurrent,
exchangeDecider,
isForbiddenFinishPlay,
legalSets,
normalizeRules,
resolveExchange,
resolvePending as resolvePendingEngine,
sequenceInfo,
setRank,
setSuit,
strongestGiveCards,
weakestGiveCards,
type Card,
type GameState,
type Rules,
} from "./game";

// ---------- shared bits ----------

const SUIT_SYM: Record<Card["suit"], string> = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
  J: "★",
};

const SUIT_NAME: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣", J: "ジョーカー" };

function rankStr(rank: number): string {
  if (rank === 11) return "J";
  if (rank === 12) return "Q";
  if (rank === 13) return "K";
  if (rank === 14) return "A";
  if (rank === 15) return "2";
  return String(rank);
}

function rankLabel(rankPos: number, total: number): string {
  if (rankPos === 1) return "大富豪";
  if (rankPos === total) return "大貧民";
  if (total >= 4 && rankPos === 2) return "富豪";
  if (total >= 4 && rankPos === total - 1) return "貧民";
  return "平民";
}

export function PlayingCardView({
  card,
  size = "hand",
  selected = false,
  onClick,
  style,
}: {
  card: Card;
  size?: "mini" | "small" | "hand" | "field" | "pile";
  selected?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  const isRed = card.suit === "H" || card.suit === "D";
  const isJoker = card.suit === "J";
  const dims =
    size === "mini"
      ? "w-6 h-9 rounded-[4px]"
      : size === "small"
        ? "w-9 h-[52px] rounded-md"
        : size === "field"
          ? "w-[74px] h-[106px] rounded-[10px] sm:w-20 sm:h-28"
          : size === "pile"
            ? "w-[62px] h-[90px] rounded-lg"
            : "w-[60px] h-[88px] rounded-lg sm:w-[66px] sm:h-[96px]";
  const cornerRank =
    size === "mini"
      ? "text-[10px]"
      : size === "small"
        ? "text-xs"
        : size === "pile"
          ? "text-base"
          : "text-lg sm:text-xl";
  const cornerSuit =
    size === "mini"
      ? "text-[9px]"
      : size === "small"
        ? "text-[11px]"
        : size === "pile"
          ? "text-xs"
          : "text-base sm:text-lg";
  const centerSuit =
    size === "mini"
      ? "text-xs"
      : size === "small"
        ? "text-xl"
        : size === "field"
          ? "text-5xl"
          : size === "pile"
            ? "text-3xl"
            : "text-4xl";
  const content = isJoker ? (
    <>
      <span className="absolute top-0.5 left-0 right-0 text-center font-extrabold tracking-tight text-[#8b2fc9] text-[9px] sm:text-[10px]">
        JOKER
      </span>
      <span className={`absolute inset-0 flex items-center justify-center text-[#8b2fc9] ${centerSuit}`}>
        ★
      </span>
    </>
  ) : (
    <>
      <span
        className={`absolute top-0.5 left-1 flex flex-col items-center leading-none ${
          isRed ? "text-[#c0392b]" : "text-[#1a1a2e]"
        }`}
      >
        <span className={`font-extrabold ${cornerRank}`}>{rankStr(card.rank)}</span>
        <span className={cornerSuit}>{SUIT_SYM[card.suit]}</span>
      </span>
      <span
        className={`absolute inset-x-0 bottom-1 text-center leading-none ${
          isRed ? "text-[#c0392b]" : "text-[#1a1a2e]"
        } ${centerSuit}`}
      >
        {SUIT_SYM[card.suit]}
      </span>
    </>
  );
  const cls = `${dims} relative shrink-0 bg-[#fffef7] border flex font-rounded select-none hand-card-shadow ${
    isJoker ? "border-[#c4b5fd]" : "border-[#ddd3c0]"
  } ${selected ? "ring-[3px] ring-[#ffd34d]" : ""} ${
    onClick ? "cursor-pointer active:scale-95 transition-transform" : ""
  }`;
  if (onClick) {
    return (
      <button
        type="button"
        aria-label={`カード ${card.id}`}
        aria-pressed={selected}
        onClick={onClick}
        className={cls}
        style={{ padding: 0, minHeight: 0, ...style }}
      >
        {content}
      </button>
    );
  }
  return (
    <div className={cls} style={style}>
      {content}
    </div>
  );
}

interface BoardPlayer {
  id: string;
  name: string;
  isBot: boolean;
  cardCount: number;
  finishRank: number | null;
  isHost?: boolean;
  avatar?: string | null;
}

// ---------- browser persistence (rules / profile image) ----------

const RULES_STORAGE_KEY = "daifugo-rules";
const AVATAR_STORAGE_KEY = "daifugo-avatar";
export const STORAGE_NOTE =
  "ルール設定と画像は、この端末のこのブラウザの中に保存されます。ブラウザのデータを消すと消え、別の端末には引き継がれません。オンライン対戦で「画像を部屋で共有」をONにしたときだけ、圧縮した画像が部屋のサーバーへ送られ、参加メンバーにも表示されます。";

function loadSavedRules(): Rules {
  try {
    const raw = localStorage.getItem(RULES_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_RULES };
    return normalizeRules(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_RULES };
  }
}

function saveRulesToBrowser(rules: Rules): boolean {
  try {
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
    return true;
  } catch {
    return false;
  }
}

function loadSavedAvatar(): string | null {
  try {
    const v = localStorage.getItem(AVATAR_STORAGE_KEY);
    return v && v.startsWith("data:image/") ? v : null;
  } catch {
    return null;
  }
}

/** Picked photo -> center-cropped square, max 256x256, compressed data URL. */
function processAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        if (!side) throw new Error("empty image");
        const size = Math.min(256, side);
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no canvas");
        const sx = (img.naturalWidth - side) / 2;
        const sy = (img.naturalHeight - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        let out = canvas.toDataURL("image/webp", 0.82);
        if (!out.startsWith("data:image/webp")) out = canvas.toDataURL("image/jpeg", 0.82);
        // Safety: if still unexpectedly large, re-encode smaller as JPEG.
        if (out.length > 180_000) {
          const c2 = document.createElement("canvas");
          c2.width = 160;
          c2.height = 160;
          c2.getContext("2d")?.drawImage(canvas, 0, 0, 160, 160);
          out = c2.toDataURL("image/jpeg", 0.78);
        }
        resolve(out);
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("load failed"));
    };
    img.src = url;
  });
}

function ProfileImageField({
  avatar,
  name,
  saveError,
  onAvatarChange,
}: {
  avatar: string | null;
  name: string;
  saveError: string;
  onAvatarChange: (dataUrl: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");
  const displayName = name.trim() || "あなた";
  return (
    <div>
      <p className="text-sm font-bold text-[var(--text)] mb-2">あなたのアイコン画像</p>
      <div className="flex items-center gap-3">
        <span
          className="relative w-14 h-14 rounded-full overflow-hidden flex-none border-2 border-[#ffe9a8] flex items-center justify-center font-extrabold text-xl text-white"
          style={{ background: avatar ? "#0a3524" : avatarGradient("me" + displayName) }}
        >
          {avatar ? (
            <img src={avatar} alt="設定中のアイコン画像" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            displayName.slice(0, 1)
          )}
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="rounded-xl bg-[var(--surface)] border border-[var(--border)] px-4 py-2.5 text-sm font-extrabold text-[var(--text)] disabled:opacity-50"
          >
            {busy ? "読み込み中…" : avatar ? "画像を変更" : "画像を設定"}
          </button>
          {avatar && (
            <button
              type="button"
              onClick={() => {
                setLocalError("");
                onAvatarChange(null);
              }}
              className="rounded-xl bg-white/10 border border-white/30 px-4 py-2.5 text-sm font-extrabold text-white"
            >
              画像を削除
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          aria-label="アイコン画像を選ぶ"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBusy(true);
            setLocalError("");
            try {
              const dataUrl = await processAvatarFile(file);
              onAvatarChange(dataUrl);
            } catch {
              setLocalError("画像を読み込めませんでした。別の画像でお試しください");
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
      <p className="mt-2 text-xs font-bold text-[var(--dim)] leading-5">
        端末の写真から選べます。中央を正方形に切り抜いて小さく保存します。
      </p>
      {(localError || saveError) && (
        <p className="mt-1 text-xs font-extrabold text-[#ff9d7a]">{localError || saveError}</p>
      )}
    </div>
  );
}

interface HistoryView {
  playerId: string;
  name: string;
  cards: Card[] | null;
  note: string | null;
  flow?: boolean; // true = 「場が流れた」マーカー（この手まで再生してから山が退場する）
}

interface PendingView {
  type: "sevenPass" | "tenDiscard" | "qBomber" | "fourStop";
  playerId: string;
  maxCount: number;
}

interface ExchangePendingView {
  giverId: string;
  receiverId: string;
  count: number;
  giveDone: boolean;
  backDone: boolean;
}

const AVATAR_GRADIENTS = [
  "linear-gradient(140deg,#f6c453,#e07b39)",
  "linear-gradient(140deg,#7bc6f0,#3a6fd8)",
  "linear-gradient(140deg,#f28bb4,#c2437e)",
  "linear-gradient(140deg,#8fe0a8,#2e9e5b)",
  "linear-gradient(140deg,#c9a7f5,#7a4fd0)",
  "linear-gradient(140deg,#f5e08a,#c9a227)",
];

function avatarGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length]!;
}

/** Wooden-framed seat like the reference design: name plate, avatar, seat badge, card count. */
function SeatFrame({
  player,
  seatNo,
  isTurn,
  glow = false,
  fx = null,
  passed,
  totalPlayers,
  large = false,
  gauge = null,
}: {
  player: BoardPlayer;
  seatNo: number;
  isTurn: boolean;
  /** 今の手番の席を金色に強く光らせる（表示中の手番に連動）。isTurn の控えめなリングより優先。 */
  glow?: boolean;
  /** 席替えイントロの質感（寄る／戻る）。位置の移動は OpponentSeats の FLIP が担当。 */
  fx?: "gather" | "settle" | null;
  passed: boolean;
  totalPlayers: number;
  large?: boolean;
  /** 持ち時間ゲージ（0〜1 = 残り割合）。手番プレイヤーのアバター周りに表示。 */
  gauge?: number | null;
}) {
  return (
    <div
      className={`relative flex flex-col items-center ${passed ? "opacity-55" : ""} ${
        fx === "gather" ? "seat-gather" : fx === "settle" ? "seat-settle" : ""
      }`}
    >
      {/* blue card backs fanning out behind the frame */}
      <div aria-hidden className="absolute left-1/2 top-[46%] -translate-x-1/2 z-0 flex">
        {[-20, 0, 20].map((deg) => (
          <span
            key={deg}
            className="card-back-blue block w-6 h-9 -mx-1"
            style={{ transform: `rotate(${deg}deg)`, transformOrigin: "50% 0%" }}
          />
        ))}
      </div>
      <div
        className={`wood-frame relative z-10 ${large ? "w-[88px]" : "w-[66px]"} ${
          glow ? "turn-glow" : isTurn ? "turn-ring" : ""
        }`}
      >
        <div className={`wood-plate px-1 py-0.5 text-center ${glow ? "turn-plate" : ""}`}>
          <span className={`block truncate font-bold ${large ? "text-[13px]" : "text-[10px]"}`}>
            {player.name}
          </span>
        </div>
        <div
          className={`relative m-1 rounded-md flex items-center justify-center ${
            large ? "h-[54px]" : "h-[38px]"
          }`}
          style={{ background: avatarGradient(player.id + player.name) }}
        >
          {player.avatar ? (
            <img
              src={player.avatar}
              alt=""
              className="absolute inset-0 h-full w-full object-cover rounded-md"
            />
          ) : null}
          {gauge !== null && isTurn && (
            <svg
              aria-hidden
              className="absolute pointer-events-none"
              style={{ inset: -4, width: "calc(100% + 8px)", height: "calc(100% + 8px)" }}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <ellipse
                cx="50"
                cy="50"
                rx="46"
                ry="46"
                pathLength={100}
                fill="none"
                stroke="rgba(0,0,0,0.45)"
                strokeWidth="6"
              />
              <ellipse
                cx="50"
                cy="50"
                rx="46"
                ry="46"
                pathLength={100}
                fill="none"
                stroke={gauge > 0.5 ? "#7be495" : gauge > 0.25 ? "#ffd34d" : "#ff7a59"}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray="100"
                strokeDashoffset={(1 - Math.max(0, Math.min(1, gauge))) * 100}
                transform="rotate(-90 50 50)"
                style={{ transition: "stroke-dashoffset 200ms linear" }}
              />
            </svg>
          )}
          {!player.avatar && (
            <span
              className={`font-extrabold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] ${
                large ? "text-2xl" : "text-lg"
              }`}
            >
              {player.name.slice(0, 1)}
            </span>
          )}
          <span
            className={`seat-badge absolute -bottom-1.5 -right-1.5 rounded-full flex items-center justify-center font-extrabold ${
              large ? "w-6 h-6 text-xs" : "w-5 h-5 text-[11px]"
            }`}
          >
            {seatNo}
          </span>
        </div>
      </div>
      <p
        className={`count-label relative z-10 mt-0.5 ${large ? "text-sm" : "text-xs"}`}
        style={
          player.finishRank === null && player.cardCount > 0 && player.cardCount <= 3
            ? { color: "#ffd34d", transform: "scale(1.18)" }
            : undefined
        }
      >
        {player.finishRank !== null
          ? `${player.finishRank}位・${rankLabel(player.finishRank, totalPlayers)}`
          : passed
            ? "パス"
            : `${player.cardCount}枚`}
      </p>
    </div>
  );
}

const SEAT_ZONES: { left: string; top: string }[][] = [
  [{ left: "50%", top: "0%" }],
  [
    { left: "26%", top: "2%" },
    { left: "74%", top: "2%" },
  ],
  [
    { left: "12%", top: "44%" },
    { left: "50%", top: "0%" },
    { left: "88%", top: "44%" },
  ],
  [
    { left: "12%", top: "44%" },
    { left: "31%", top: "0%" },
    { left: "69%", top: "0%" },
    { left: "88%", top: "44%" },
  ],
  [
    { left: "12%", top: "44%" },
    { left: "29%", top: "0%" },
    { left: "50%", top: "0%" },
    { left: "71%", top: "0%" },
    { left: "88%", top: "44%" },
  ],
];

function OpponentSeats({
  players,
  viewerId,
  currentPlayerId,
  glowPlayerId,
  seatFx = null,
  passedIds,
}: {
  players: BoardPlayer[];
  viewerId: string;
  currentPlayerId: string | null;
  /** 強く光らせる席（表示中の手番）。カード交換中などは null で従来表示。 */
  glowPlayerId: string | null;
  /** 席替えイントロの段階。"settle" の瞬間に席ボックスを旧位置から新位置へ滑らせる。 */
  seatFx?: "gather" | "settle" | null;
  passedIds: string[];
}) {
  const viewerIdx = players.findIndex((p) => p.id === viewerId);
  const ordered: { player: BoardPlayer; seatNo: number }[] = [];
  for (let step = 1; step < players.length; step++) {
    const p = players[(viewerIdx + step) % players.length]!;
    ordered.push({ player: p, seatNo: ((viewerIdx + step) % players.length) + 1 });
  }
  const zones = SEAT_ZONES[Math.max(0, ordered.length - 1)] ?? SEAT_ZONES[0]!;

  // 席替え FLIP: 席ボックスの画面位置を毎レンダー記録しておき、"settle"
  // への切り替わり（= 並びが旧→新へ変わったレンダー）で、前回位置から
  // 新位置へ滑らせる。位置が変わっていない席は動かさない。
  const seatEls = useRef(new Map<string, HTMLElement>());
  const prevRects = useRef(new Map<string, { x: number; y: number }>());
  useLayoutEffect(() => {
    const next = new Map<string, { x: number; y: number }>();
    for (const [id, el] of seatEls.current) {
      const r = el.getBoundingClientRect();
      next.set(id, { x: r.left, y: r.top });
      const prev = prevRects.current.get(id);
      if (
        seatFx === "settle" &&
        prev &&
        (Math.abs(prev.x - r.left) > 3 || Math.abs(prev.y - r.top) > 3) &&
        typeof el.animate === "function"
      ) {
        el.animate(
          [
            { transform: `translate(${prev.x - r.left}px, ${prev.y - r.top}px)` },
            { transform: "translate(0px, 0px)" },
          ],
          { duration: 620, easing: "cubic-bezier(0.22, 0.9, 0.3, 1)" },
        );
      }
    }
    prevRects.current = next;
  });

  return (
    <div className="relative h-[118px] mx-1 shrink-0">
      {ordered.map(({ player, seatNo }, i) => {
        const zone = zones[Math.min(i, zones.length - 1)]!;
        return (
          <div
            key={player.id}
            data-seat-player={player.id}
            ref={(el) => {
              if (el) seatEls.current.set(player.id, el);
              else seatEls.current.delete(player.id);
            }}
            className="absolute -translate-x-1/2"
            style={{ left: zone.left, top: zone.top }}
          >
            <SeatFrame
              player={player}
              seatNo={seatNo}
              isTurn={player.id === currentPlayerId}
              glow={player.id === glowPlayerId}
              fx={seatFx}
              passed={passedIds.includes(player.id)}
              totalPlayers={players.length}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Center of the table: every card played this round as one overlapping pile.
 * Plays stack oldest (bottom) to newest (top), each shifted a little right and
 * down so the rank/suit corner of the cards underneath still peeks out. The
 * newest play sits on top, fully visible, with its player's name beside it.
 * Passes and special-action notes ride along the right side as small chips.
 * The history spans the whole game, split by flow markers: the pile shows
 * only the current field's segment (after the last marker), and when a
 * marker is revealed the finished pile exits before the new field starts.
 */
interface FlightState {
  key: string;
  cards: Card[];
  /** Target (pile-top) position in viewport px. */
  left: number;
  top: number;
  /** Offset from the source (seat / hand) center to the target center. */
  dx: number;
  dy: number;
  rot: number;
  go: boolean;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** 表示済み履歴（disp）だけから「いま画面に見えている革命状態」を復元する。
 * 革命の発生・鎮圧は各手の note に必ず残る（エンジン側で state.revolution の
 * 切り替えと同時に記録される）ため、再生キューがその手に到達した時点で
 * 初めて true / false が切り替わる。論理状態（最終状態）を直接使うと、
 * CPU の手を1手ずつ表示している途中で色が先に変わってしまう。
 * 途中参加・再読込で履歴が最初から全て表示済みの場合は、そのまま現在の
 * 革命状態と一致する。 */
function revolutionFromDisp(disp: HistoryView[]): boolean {
  let rev = false;
  for (const h of disp) {
    const note = h.note ?? "";
    if (note.includes("革命鎮圧")) rev = false;
    else if (note.includes("革命発生")) rev = true;
  }
  return rev;
}

/** 自分の手番が「実際に入力可能になった瞬間」を検知して、短いバナーを出す。
 * active は表示キューへの追いつき（revealCaughtUp）と配札完了まで含めた
 * 判定を親が渡す前提。false→true の立ち上がりでのみバナーを表示し、
 * 手番が終わったら即座に隠す（次の人の番に残らない）。 */
function useMyTurnNotice(active: boolean): { showBanner: boolean; seq: number } {
  const [showBanner, setShowBanner] = useState(false);
  const [seq, setSeq] = useState(0);
  const prevRef = useRef(false);
  const timerRef = useRef(0);
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = active;
    if (active && !prev) {
      setSeq((s) => s + 1);
      setShowBanner(true);
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setShowBanner(false), 1500);
    } else if (!active) {
      window.clearTimeout(timerRef.current);
      setShowBanner(false);
    }
  }, [active]);
  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
    },
    [],
  );
  return { showBanner, seq };
}

function FieldPile({
  disp,
  ghost,
  viewerId,
  fieldCards,
  ownerName,
  revolution,
  backActive,
  lockSuit,
  numberLockNext,
  direction,
}: {
  /** Sequentially revealed history entries (owned by Board's unified queue). */
  disp: HistoryView[];
  ghost: HistoryView[] | null;
  viewerId: string;
  fieldCards: Card[] | null;
  ownerName: string | null;
  revolution: boolean;
  backActive: boolean;
  lockSuit: string | null;
  numberLockNext: number | null;
  direction: number;
}) {

  // 履歴は対局全体ぶんで、場が流れるたび flow マーカーで区切られる。
  // 山とチップとして表示するのは、最後のマーカーより後ろ＝今の場の分だけ。
  let segStart = 0;
  for (let i = disp.length - 1; i >= 0; i--) {
    if (disp[i]!.flow) {
      segStart = i + 1;
      break;
    }
  }
  const segment = disp.slice(segStart);
  const plays = segment.filter((h) => h.cards && h.cards.length > 0);
  const sideEntries = segment.filter((h) => !h.cards || h.cards.length === 0);
  // Every play this round stays in the pile; the offsets and card size
  // shrink automatically as the pile grows so it always fits the center.
  const shown = plays;
  const inPlayOverlap = 26; // px hidden between cards of the same play
  const topPlay = shown[shown.length - 1];
  const topKey = topPlay
    ? `${topPlay.playerId}:${topPlay.cards!.map((c) => c.id).join(",")}`
    : null;

  const stackMetrics = (list: HistoryView[]) => {
    const n = list.length;
    const stepX = n > 1 ? Math.max(3, Math.min(10, Math.floor(44 / (n - 1)))) : 0;
    const stepY = n > 1 ? Math.max(3, Math.min(13, Math.floor(56 / (n - 1)))) : 0;
    const scale = n > 7 ? 0.8 : n > 4 ? 0.9 : 1;
    const cw = `calc(clamp(44px, 8.2dvh, 62px) * ${scale})`;
    const ch = `calc(clamp(64px, 12dvh, 90px) * ${scale})`;
    const maxCount = list.reduce((m, h) => Math.max(m, h.cards?.length ?? 0), 0);
    const w = `calc(${cw} * ${Math.max(1, maxCount)} - ${Math.max(0, maxCount - 1) * inPlayOverlap}px + ${Math.max(0, n - 1) * stepX}px)`;
    const hgt = `calc(${ch} + ${Math.max(0, n - 1) * stepY}px)`;
    return { stepX, stepY, cardW: cw, cardH: ch, pileW: w, pileH: hgt };
  };
  const metrics = stackMetrics(shown);
  const { cardW, cardH } = metrics;

  // --- play animation: new cards fly from the player's seat (or the viewer's
  // hand) into the pile; when the field flows, the old pile exits. ---
  const rootRef = useRef<HTMLDivElement>(null);
  const [flight, setFlight] = useState<FlightState | null>(null);
  const prevTopKeyRef = useRef<string | null>(topKey);
  const flightTimer = useRef(0);

  useEffect(() => {
    const prevTopKey = prevTopKeyRef.current;
    prevTopKeyRef.current = topKey;
    // A new top play was revealed: fly it in from its owner's seat / hand.
    if (!topPlay || !topKey || topKey === prevTopKey || prefersReducedMotion()) return;
    const root = rootRef.current;
    if (!root) return;
    const targetEl = root.querySelector<HTMLElement>("[data-top-cards]");
    if (!targetEl) return;
    const tRect = targetEl.getBoundingClientRect();
    let srcEl: HTMLElement | null = null;
    if (topPlay.playerId === viewerId) {
      srcEl = document.querySelector<HTMLElement>("[data-hand]");
    }
    if (!srcEl) {
      const seats = document.querySelectorAll<HTMLElement>("[data-seat-player]");
      for (let i = 0; i < seats.length; i++) {
        const el = seats[i];
        if (el && el.dataset.seatPlayer === topPlay.playerId) {
          srcEl = el;
          break;
        }
      }
    }
    if (!srcEl && topPlay.playerId === viewerId) {
      srcEl = document.querySelector<HTMLElement>("[data-seat-player]");
    }
    let dx = 0;
    let dy = 150;
    if (srcEl) {
      const s = srcEl.getBoundingClientRect();
      dx = s.left + s.width / 2 - (tRect.left + tRect.width / 2);
      dy = s.top + s.height / 2 - (tRect.top + tRect.height / 2);
    }
    const f: FlightState = {
      key: topKey,
      cards: topPlay.cards!,
      left: tRect.left,
      top: tRect.top,
      dx,
      dy,
      rot: (((shown.length - 1) % 3) - 1) * 1.4,
      go: false,
    };
    setFlight(f);
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFlight((cur) => (cur && cur.key === f.key ? { ...cur, go: true } : cur));
      });
    });
    window.clearTimeout(flightTimer.current);
    flightTimer.current = window.setTimeout(() => setFlight(null), 430);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disp]);

  useEffect(
    () => () => {
      window.clearTimeout(flightTimer.current);
    },
    [],
  );

  // 場が流れた瞬間（flow マーカーが再生されたとき）: 流れた場の山を
  // 退場アニメーションで見せてから消す。全員分の手（最後のパス含む）が
  // 再生し終わるまではマーカーが来ないので、山が早く消えることはない。
  const [flowGhost, setFlowGhost] = useState<HistoryView[] | null>(null);
  const flowGhostTimer = useRef(0);
  const prevDispRef = useRef(disp);
  useEffect(() => {
    const prev = prevDispRef.current;
    prevDispRef.current = disp;
    if (disp.length <= prev.length) return;
    const last = disp[disp.length - 1];
    if (!last?.flow || prefersReducedMotion()) return;
    let start = 0;
    for (let i = disp.length - 2; i >= 0; i--) {
      if (disp[i]!.flow) {
        start = i + 1;
        break;
      }
    }
    const ended = disp
      .slice(start, disp.length - 1)
      .filter((h) => h.cards && h.cards.length > 0);
    if (ended.length === 0) return;
    setFlowGhost(ended);
    window.clearTimeout(flowGhostTimer.current);
    flowGhostTimer.current = window.setTimeout(() => setFlowGhost(null), 340);
  }, [disp]);
  useEffect(
    () => () => {
      window.clearTimeout(flowGhostTimer.current);
    },
    [],
  );
  const exitGhost = ghost ?? flowGhost;

  const flightActive = flight !== null && topKey !== null && flight.key === topKey;

  /** One overlapping stack of plays (used for the live pile and the exiting ghost). */
  const renderStack = (list: HistoryView[], keyPrefix: string, hideTop: boolean) => {
    const m = stackMetrics(list);
    return (
      <div className="relative" style={{ width: m.pileW, height: m.pileH }}>
        {list.map((h, i) => {
          const isTop = i === list.length - 1;
          return (
            <div
              key={`${keyPrefix}-${i}-${h.playerId}-${h.cards!.map((c) => c.id).join(",")}`}
              className={`absolute ${isTop && !hideTop ? "card-pop" : ""}`}
              style={{
                left: i * m.stepX,
                top: i * m.stepY,
                zIndex: i + 1,
                transform: `rotate(${((i % 3) - 1) * 1.4}deg)`,
                visibility: isTop && hideTop ? "hidden" : undefined,
              }}
            >
              <span
                className={`absolute left-0 z-10 max-w-[76px] truncate rounded px-1 text-[9px] font-extrabold leading-[13px] ${
                  isTop
                    ? "bg-[#ffd34d] text-[#4a3205] shadow"
                    : "bg-black/55 text-white/90"
                }`}
                style={{ top: -6 }}
              >
                {h.name}
              </span>
              {h.note && (
                <span
                  className="absolute left-0 z-10 max-w-[110px] truncate rounded bg-[#7a2b12]/90 px-1 text-[8px] font-bold leading-[12px] text-amber-100"
                  style={{ top: "calc(100% - 5px)" }}
                >
                  {h.note}
                </span>
              )}
              <span className="flex" data-top-cards={isTop ? true : undefined}>
                {h.cards!.map((c, j) => (
                  <span key={c.id} style={{ marginLeft: j === 0 ? 0 : -inPlayOverlap }}>
                    <PlayingCardView
                      card={c}
                      size="pile"
                      style={{ width: m.cardW, height: m.cardH }}
                    />
                  </span>
                ))}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      ref={rootRef}
      className="flex-1 min-h-0 flex flex-col items-center justify-center px-2 py-0.5 relative"
    >
      <div className="flex flex-wrap justify-center gap-1.5 min-h-[20px]">
        {revolution && (
          <span className="text-[11px] font-extrabold bg-[#c0392b] text-white rounded-full px-2.5 py-0.5 shadow">
            革命中
          </span>
        )}
        {backActive && (
          <span className="text-[11px] font-extrabold bg-[#7c3aed] text-white rounded-full px-2.5 py-0.5 shadow">
            11バック中
          </span>
        )}
        {lockSuit && (
          <span className="text-[11px] font-extrabold bg-[#1d4ed8] text-white rounded-full px-2.5 py-0.5 shadow">
            {SUIT_NAME[lockSuit]}縛り中
          </span>
        )}
        {numberLockNext !== null && (
          <span className="text-[11px] font-extrabold bg-[#b45309] text-white rounded-full px-2.5 py-0.5 shadow">
            数縛り中
            {numberLockNext >= 3 && numberLockNext <= 15
              ? `：次は${rankStr(numberLockNext)}のみ`
              : ""}
          </span>
        )}
        {direction === -1 && (
          <span className="text-[11px] font-extrabold bg-[#0f766e] text-white rounded-full px-2.5 py-0.5 shadow">
            リバース中（逆回り）
          </span>
        )}
      </div>

      {shown.length > 0 ? (
        <>
          <div className="mt-1">{renderStack(shown, "pile", flightActive)}</div>
          <p className="mt-1 text-[11px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] text-center leading-4">
            {topPlay?.name ?? ownerName}さんが出しました
            {topPlay?.note && <span className="text-[#ffe9a8]"> ・ {topPlay.note}</span>}
          </p>
        </>
      ) : exitGhost ? (
        <div aria-hidden className="pile-exit mt-1">
          {renderStack(exitGhost, "ghost", false)}
        </div>
      ) : fieldCards && fieldCards.length > 0 ? (
        <div className="card-pop flex justify-center mt-1">
          {fieldCards.map((c, i) => (
            <div key={c.id} style={{ marginLeft: i === 0 ? 0 : -22 }}>
              <PlayingCardView card={c} size="pile" style={{ width: cardW, height: cardH }} />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-sm font-extrabold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] bg-black/25 rounded-full px-4 py-1.5 text-center">
          場は流れています — 好きなカードを出せます
        </p>
      )}

      {sideEntries.length > 0 && (
        <div className="mt-1 flex flex-wrap justify-center gap-1 px-1 max-w-full">
          {sideEntries.map((h, i) => (
            <span
              key={`${i}-${h.playerId}-chip`}
              className="chip-pop rounded-full bg-black/50 px-1.5 py-0.5 text-[8px] font-bold leading-3 text-white/90 shadow"
            >
              {h.name}：{h.note ?? "パス"}
            </span>
          ))}
        </div>
      )}

      {flight && (
        <div
          aria-hidden
          className="pointer-events-none fixed left-0 top-0 z-[70]"
          style={{
            transform: flight.go
              ? `translate(${flight.left}px, ${flight.top}px) rotate(${flight.rot}deg) scale(1)`
              : `translate(${flight.left + flight.dx}px, ${flight.top + flight.dy}px) rotate(${flight.rot - 16}deg) scale(0.55)`,
            transition: flight.go
              ? "transform 340ms cubic-bezier(0.22, 0.9, 0.3, 1)"
              : "none",
            transformOrigin: "50% 50%",
          }}
        >
          <span className="flex">
            {flight.cards.map((c, j) => (
              <span key={c.id} style={{ marginLeft: j === 0 ? 0 : -inPlayOverlap }}>
                <PlayingCardView
                  card={c}
                  size="pile"
                  style={{ width: cardW, height: cardH }}
                />
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

function LogList({ log }: { log: string[] }) {
  const items = log.slice(-2);
  if (items.length === 0) return null;
  return (
    <div className="mx-2 mb-1 shrink-0 rounded-lg bg-black/35 px-3 py-1 overflow-hidden">
      {items.map((l, i) => (
        <p
          key={`${i}-${l}`}
          className={`text-[10px] leading-[15px] truncate ${
            i === items.length - 1 ? "text-white font-bold" : "text-white/60"
          }`}
        >
          {l}
        </p>
      ))}
    </div>
  );
}

/** The whole game screen: felt table with ornate bands, round icon buttons at the edges. */
function GameScreen({
  statusText,
  exitLabel,
  onExit,
  rules,
  revolution = false,
  myTurn = false,
  showMyTurnBanner = false,
  myTurnBannerSeq = 0,
  children,
}: {
  statusText: string;
  exitLabel: string;
  onExit: () => void;
  rules: Rules;
  /** 表示キューに追いついた革命状態。true の間フェルトが赤くなる。 */
  revolution?: boolean;
  /** 自分が実際に入力可能な手番（ステータス表示を金色に強調）。 */
  myTurn?: boolean;
  /** 自分の手番開始バナーを表示するか（useMyTurnNotice が管理）。 */
  showMyTurnBanner?: boolean;
  myTurnBannerSeq?: number;
  children: React.ReactNode;
}) {
  const [showRules, setShowRules] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // The layout viewport (100dvh) can extend behind the browser's bottom
  // URL/tool bar (iOS Safari, in-app browsers), which hid the pass/play
  // buttons at the bottom. Size the table to the *visible* viewport via
  // visualViewport and follow it as the bars show/hide; the extra bottom
  // padding (safe-area inset + 16px) keeps the bottom controls clear of
  // the home indicator and any browser chrome in both browser and
  // home-screen (standalone) modes.
  useEffect(() => {
    const el = rootRef.current;
    const vv = window.visualViewport;
    if (!el || !vv) return;
    const update = () => {
      el.style.height = `${Math.round(vv.height)}px`;
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("orientationchange", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);
  return (
    <div
      ref={rootRef}
      className={`felt-table ${revolution ? "felt-table-revolution" : ""} h-dvh overflow-hidden flex flex-col relative`}
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
    >
      <div className={`ornate-band ${revolution ? "ornate-band-revolution" : ""}`} />
      <div className="flex items-center justify-between px-3 pt-1.5 pb-0.5 shrink-0">
        <button
          type="button"
          onClick={onExit}
          aria-label={exitLabel}
          className="icon-orb w-10 h-10 rounded-full flex items-center justify-center text-lg font-extrabold"
          style={{ minHeight: 0 }}
        >
          ←
        </button>
        <p className="flex-1 text-center text-base sm:text-lg font-extrabold text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.85)] px-2">
          {myTurn ? (
            <span className="my-turn-status inline-block">{statusText}</span>
          ) : (
            statusText
          )}
        </p>
        <button
          type="button"
          onClick={() => setShowRules((v) => !v)}
          aria-label="ルールを確認する"
          aria-expanded={showRules}
          className="icon-orb w-10 h-10 rounded-full flex items-center justify-center text-base font-extrabold"
          style={{ minHeight: 0 }}
        >
          R
        </button>
      </div>
      {showRules && (
        <div className="gold-frame panel-in mx-3 mb-2 rounded-2xl bg-[#07331a]/95 p-3 shadow-xl z-30 max-h-[46dvh] overflow-y-auto shrink-0">
          <p className="font-extrabold text-[#ffe9a8] text-sm mb-1.5">この対局のルール</p>
          <ul className="space-y-1">
            {activeRuleLabels(rules).map((l) => (
              <li key={l} className="text-xs font-bold text-white">
                ● {l}
              </li>
            ))}
          </ul>
          <p className="text-xs text-white/80 mt-1.5">
            ジョーカー：{rules.jokerCount}枚／開始：{startPlayerLabel(rules)}
          </p>
        </div>
      )}
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      <div className={`ornate-band ${revolution ? "ornate-band-revolution" : ""}`} />
      {showMyTurnBanner && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-[24%] z-[60] flex justify-center px-6"
        >
          <div
            key={myTurnBannerSeq}
            className="my-turn-banner rounded-2xl border-[3px] border-[#ffd34d] bg-[#3a2a05]/95 px-7 py-3 text-center shadow-2xl"
          >
            <p
              className="text-3xl sm:text-4xl font-extrabold tracking-wide text-[#ffe9a8]"
              style={{ textShadow: "0 2px 0 rgba(0,0,0,0.55)" }}
            >
              あなたの番です！
            </p>
            <p className="mt-0.5 text-xs font-extrabold text-white">
              出せるカードが光っています
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- special-effect banners (unified with the reveal queue) ----------

interface FxBanner {
  title: string;
  sub?: string;
  tone: "gold" | "red" | "blue" | "green";
  /** "finish" = あがり演出（プレイヤー名＋称号の2段組・大きめ・長め表示）。 */
  kind?: "effect" | "finish";
  /** あがり演出用: 上がった人の名前。 */
  playerName?: string;
  /** あがり演出用: 最終順位。 */
  rankPos?: number;
  /** あがり演出用: アバター画像（設定している人だけ名前の横に小さく出す）。 */
  avatar?: string | null;
  /** 重複排除キー（称号が同じ平民どうしでも1人ずつ表示するため）。 */
  dedupeKey?: string;
}

const BANNER_TONE: Record<FxBanner["tone"], string> = {
  gold: "border-[#ffd34d] text-[#ffe9a8]",
  red: "border-[#ff8a5c] text-[#ffb199]",
  blue: "border-[#7cc4ff] text-[#bfe3ff]",
  green: "border-[#7be495] text-[#c9f7d4]",
};

/** Banners triggered by one revealed history entry (note text + cards). */
function bannersForEntry(
  entry: HistoryView,
  prev: HistoryView | undefined,
  rules: Rules,
): FxBanner[] {
  const out: FxBanner[] = [];
  const note = entry.note ?? "";
  if (note.includes("革命鎮圧")) out.push({ title: "革命鎮圧！", tone: "red" });
  else if (note.includes("革命発生")) out.push({ title: "革命！", tone: "red" });
  if (note.includes("クーデター")) out.push({ title: "クーデター！", tone: "red" });
  if (note.includes("ナナサン革命")) out.push({ title: "ナナサン革命！", tone: "red" });
  if (note.includes("エンペラー")) out.push({ title: "エンペラー！", tone: "gold" });
  if (note.includes("オーメン")) out.push({ title: "オーメン！", sub: "以後、革命と他の効果は無効", tone: "red" });
  if (note.includes("11バック")) out.push({ title: "11バック！", tone: "blue" });
  if (note.includes("リバース")) out.push({ title: "リバース！", tone: "green" });
  if (note.includes("激縛り")) out.push({ title: "激縛り！", tone: "blue" });
  else if (note.includes("縛り")) {
    const m = note.match(/[♠♥♦♣]縛り|数縛り/);
    out.push({ title: m ? `${m[0]}！` : "縛り！", tone: "blue" });
  }
  const cards = entry.cards;
  if (cards && cards.length > 0) {
    const isSeq = sequenceInfo(cards) !== null || emperorInfo(cards) !== null;
    const fxSuppressed = isSeq && rules.stairs && !rules.stairsEffects;
    if (!fxSuppressed) {
      if (rules.eightCut && cards.some((c) => c.rank === 8 && c.suit !== "J")) {
        out.push({ title: "8切り！", tone: "gold" });
      } else if (rules.sandstorm && cards.length === 3 && cards.every((c) => c.rank === 3)) {
        out.push({ title: "砂嵐！", tone: "gold" });
      } else if (rules.ambulance && cards.length === 2 && cards.every((c) => c.rank === 9)) {
        out.push({ title: "救急車！", tone: "gold" });
      } else if (rules.rokurokubi && cards.length === 2 && cards.every((c) => c.rank === 6)) {
        out.push({ title: "ろくろ首！", tone: "gold" });
      }
      if (
        rules.skip &&
        ((rules.skip5 && cards.some((c) => c.rank === 5 && c.suit !== "J")) ||
          (rules.skip13 && cards.some((c) => c.rank === 13 && c.suit !== "J")))
      ) {
        out.push({ title: "スキップ！", tone: "green" });
      }
      if (rules.qBomber && cards.some((c) => c.rank === 12 && c.suit !== "J")) {
        out.push({ title: "12ボンバー！", tone: "red" });
      }
    }
    if (
      rules.spade3 &&
      cards.length === 1 &&
      cards[0]!.id === "S3" &&
      prev?.cards?.length === 1 &&
      prev.cards[0]!.suit === "J"
    ) {
      out.push({ title: "スペ3返し！", tone: "gold" });
    }
  }
  return out;
}

/** Board = opponents + center field + log, plus the unified animation queue:
 * history entries are revealed one by one (flights in FieldPile follow the
 * same `disp` state), and effect / finish banners are queued onto that same
 * timeline so nothing fires all at once or gets stuck behind another effect. */
function Board({
  players,
  viewerId,
  currentPlayerId,
  passedIds,
  fieldCards,
  ownerName,
  revolution,
  backActive,
  lockSuit,
  numberLockNext,
  direction,
  history,
  log,
  rules,
  onRevealSync,
  onDisplayedRevolution,
  onFinishFxBusy,
  replayKey = null,
  holdReveal = false,
  exchangeActive = false,
  seatFx = null,
  displayOrder = null,
}: {
  players: BoardPlayer[];
  viewerId: string;
  currentPlayerId: string | null;
  passedIds: string[];
  fieldCards: Card[] | null;
  ownerName: string | null;
  revolution: boolean;
  backActive: boolean;
  lockSuit: string | null;
  numberLockNext: number | null;
  direction: number;
  history: HistoryView[];
  log: string[];
  rules: Rules;
  /** 順次表示が最新の履歴に追いついたかどうかを親へ知らせる。
   * 結果表示や手札の発光は、この「表示上の現在」に合わせて開始する。 */
  onRevealSync?: (caughtUp: boolean) => void;
  /** 表示キューに追いついた時点の革命状態を親へ知らせる（場の色用）。
   * 論理状態をそのまま使うと、CPU の手の再生途中で色が先に変わってしまう
   * ため、革命バナーが出るタイミング（該当の手が表示された時点）に揃える。 */
  onDisplayedRevolution?: (rev: boolean) => void;
  /** あがり演出が表示待ち・表示中の間 true を親へ知らせる。
   * 親はその間、結果表示への切り替えを待つ（演出が結果画面に隠れないため）。 */
  onFinishFxBusy?: (busy: boolean) => void;
  /** このクライアントがゲーム開始を目撃したときに変わるキー（配札アニメと共通）。
   * 変わったら表示を空に戻し、開始直後の手（先行するCPUの手を含む）を
   * 最初から1手ずつ再生し直す。オンラインでは Board がロビー→対局の
   * 切り替えでマウントされた時点で履歴が完成済みのため、この再生し直しが
   * ないと「気づいたらCPUがもう出していた」状態になる。 */
  replayKey?: string | null;
  /** true の間は順次表示を進めない（配札アニメーションの再生中）。 */
  holdReveal?: boolean;
  /** カード交換フェーズ中は席の強い発光を止め、従来の表示を優先する。 */
  exchangeActive?: boolean;
  /** 席替えイントロの段階（useDealing から）。 */
  seatFx?: "gather" | "settle" | null;
  /** 席替えイントロの "gather" 中に席を表示する並び（前ゲームの席順）。 */
  displayOrder?: string[] | null;
}) {
  // --- sequential reveal (moved here from FieldPile so banners share it) ---
  const STEP_MS = 640;
  const sigOf = (h: HistoryView) =>
    `${h.playerId}|${h.cards ? h.cards.map((c) => c.id).join(",") : ""}|${h.note ?? ""}${h.flow ? "|F" : ""}`;
  const hasPrefix = (a: HistoryView[], b: HistoryView[]) =>
    a.length <= b.length &&
    a.every((h, i) => {
      const o = b[i];
      return o !== undefined && sigOf(h) === sigOf(o);
    });
  const historyRef = useRef(history);
  historyRef.current = history;
  const holdRef = useRef(false);
  holdRef.current = holdReveal;
  const [disp, setDisp] = useState<HistoryView[]>(history);
  const dispRef = useRef(disp);
  // あがり演出用: 順位が確定した人を「上がりの手が表示される位置（atDisp）」
  // と一緒に待ち行列へ入れ、表示キューがそこへ到達したらバナーを出す。
  const pendingFinishRef = useRef<
    {
      playerId: string;
      name: string;
      rank: number;
      total: number;
      avatar: string | null;
      atDisp: number;
    }[]
  >([]);
  const shownFinishRef = useRef<Set<string>>(new Set());
  // あがり演出の表示中は次の手の再生を止める（演出を見せてから次へ進む）。
  const finishHoldRef = useRef(false);
  const [ghost, setGhost] = useState<HistoryView[] | null>(null);
  const ghostTimer = useRef(0);
  const stepTimer = useRef(0);
  const steppingRef = useRef(false);

  const startStepping = (initialDelay: number) => {
    if (steppingRef.current || holdRef.current) return;
    steppingRef.current = true;
    const step = () => {
      if (holdRef.current) {
        // 配札アニメーション中は場の再生を待つ（配り終わってから手を見せる）
        stepTimer.current = window.setTimeout(step, 200);
        return;
      }
      if (finishHoldRef.current) {
        // あがり演出の表示中は次の手を見せない（演出→次の手の順で見せる）
        stepTimer.current = window.setTimeout(step, 200);
        return;
      }
      const target = historyRef.current;
      const cur = dispRef.current;
      const entry = hasPrefix(cur, target) ? target[cur.length] : undefined;
      if (!entry) {
        steppingRef.current = false;
        return;
      }
      const next = [...cur, entry];
      dispRef.current = next;
      setDisp(next);
      stepTimer.current = window.setTimeout(step, STEP_MS);
    };
    if (initialDelay > 0) {
      stepTimer.current = window.setTimeout(step, initialDelay);
    } else {
      step();
    }
  };

  // ゲーム開始を目撃したら、表示を空に戻して開始直後の手を最初から
  // 再生し直す（先行するCPUの手がすでに履歴に含まれていても見せるため）。
  const replayKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!replayKey || replayKey === replayKeyRef.current) return;
    replayKeyRef.current = replayKey;
    window.clearTimeout(stepTimer.current);
    steppingRef.current = false;
    dispRef.current = [];
    setDisp([]);
    setGhost(null);
    pendingFinishRef.current = [];
    shownFinishRef.current = new Set();
    startStepping(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey]);

  // 配札が終わった瞬間に、止めていた再生を開始する
  useEffect(() => {
    if (!holdReveal) startStepping(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdReveal]);

  useEffect(() => {
    const cur = dispRef.current;
    if (!hasPrefix(cur, history)) {
      window.clearTimeout(stepTimer.current);
      steppingRef.current = false;
      // 退場させるのは最後の場（最後の flow マーカーより後ろ）のカードだけ
      const lastFlowIdx = cur.reduce((acc, h, i) => (h.flow ? i : acc), -1);
      const oldPlays = cur
        .slice(lastFlowIdx + 1)
        .filter((h) => h.cards && h.cards.length > 0);
      dispRef.current = [];
      setDisp([]);
      pendingFinishRef.current = [];
      shownFinishRef.current = new Set();
      if (oldPlays.length > 0 && !prefersReducedMotion()) {
        setGhost(oldPlays);
        window.clearTimeout(ghostTimer.current);
        ghostTimer.current = window.setTimeout(() => setGhost(null), 340);
        startStepping(300);
        return;
      }
    }
    startStepping(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  useEffect(
    () => () => {
      window.clearTimeout(stepTimer.current);
      window.clearTimeout(ghostTimer.current);
    },
    [],
  );

  // 表示が最新の履歴に追いついているかを親へ伝える（追いついていない間は
  // まだCPUの手を表示している途中なので、結果表示や発光を始めない）。
  const revealSyncRef = useRef(onRevealSync);
  revealSyncRef.current = onRevealSync;
  useEffect(() => {
    revealSyncRef.current?.(
      disp.length === history.length && hasPrefix(disp, history),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disp, history]);

  // 画面に見えている革命状態: 再生が追いついているときは論理状態と一致する
  // （最終確認として論理状態を使う）。再生途中は表示済みの手の note から
  // 復元するので、革命バナーが表示されるのと同じタイミングで切り替わる。
  // 11バック（backActive）はここには一切含めない。
  const caughtUp = disp.length === history.length && hasPrefix(disp, history);
  const dispRevolution = caughtUp ? revolution : revolutionFromDisp(disp);

  // 画面に表示されている手番（席の発光用）: 再生中は「いま表示された
  // 一手」を出した人が手番として光る。論理上の手番をそのまま使うと、
  // サーバー側で先行した未来の手番が先に光ってしまうため、表示キューに
  // 追いついたときだけ論理上の手番（pending の人も含む）を使う。
  // 場が流れた直後も、最後に表示された一手の出し手 = 次のリードなので合う。
  const dispTurnId: string | null = caughtUp
    ? currentPlayerId
    : (() => {
        for (let i = disp.length - 1; i >= 0; i--) {
          const h = disp[i]!;
          if (!h.flow && h.playerId) return h.playerId;
        }
        // まだ1手も表示されていない間は、最初の手番の人を光らせる。
        const first = history.find((h) => !h.flow && h.playerId);
        return first ? first.playerId : currentPlayerId;
      })();
  const seatTurnId = exchangeActive ? currentPlayerId : dispTurnId;
  const seatGlowId = exchangeActive ? null : dispTurnId;
  const dispRevRef = useRef(onDisplayedRevolution);
  dispRevRef.current = onDisplayedRevolution;
  useEffect(() => {
    dispRevRef.current?.(dispRevolution);
  }, [dispRevolution]);

  // --- banner queue ---
  const queueRef = useRef<FxBanner[]>([]);
  const bannerRef = useRef<FxBanner | null>(null);
  const [banner, setBanner] = useState<FxBanner | null>(null);
  const [bannerSeq, setBannerSeq] = useState(0);
  const pushBanners = (bs: FxBanner[]) => {
    const reduced = prefersReducedMotion();
    for (const b of bs) {
      // モーション抑制時は効果バナーを出さない。あがり演出だけは順位の
      // お知らせとして静止表示する（アニメーションはCSS側で止まる）。
      if (reduced && b.kind !== "finish") continue;
      const q = queueRef.current;
      const keyOf = (x: FxBanner) => x.dedupeKey ?? x.title;
      if (bannerRef.current && keyOf(bannerRef.current) === keyOf(b)) continue;
      if (q[q.length - 1] && keyOf(q[q.length - 1]!) === keyOf(b)) continue;
      q.push(b);
    }
    if (!bannerRef.current) {
      const nxt = queueRef.current.shift();
      if (nxt) {
        bannerRef.current = nxt;
        setBanner(nxt);
        setBannerSeq((s) => s + 1);
      }
    }
  };
  const pushRef = useRef(pushBanners);
  pushRef.current = pushBanners;

  useEffect(() => {
    finishHoldRef.current = banner?.kind === "finish";
    if (!banner) return;
    const t = window.setTimeout(() => {
      const nxt = queueRef.current.shift() ?? null;
      bannerRef.current = nxt;
      setBanner(nxt);
      if (nxt) setBannerSeq((s) => s + 1);
    }, banner.kind === "finish" ? 1500 : 1180);
    return () => window.clearTimeout(t);
  }, [banner]);

  // あがり演出が待ち・表示中かどうかを親へ知らせる（結果表示を待たせるため）。
  const finishBusyRef = useRef(onFinishFxBusy);
  finishBusyRef.current = onFinishFxBusy;
  const lastFinishBusyRef = useRef(false);
  useEffect(() => {
    const busy =
      banner?.kind === "finish" ||
      queueRef.current.some((b) => b.kind === "finish") ||
      pendingFinishRef.current.length > 0;
    if (busy !== lastFinishBusyRef.current) {
      lastFinishBusyRef.current = busy;
      finishBusyRef.current?.(busy);
    }
  });

  // Effect banners, fired as each history entry is revealed.
  const prevDispRef = useRef<HistoryView[]>(disp);
  useEffect(() => {
    const prev = prevDispRef.current;
    if (hasPrefix(prev, disp)) {
      for (let i = prev.length; i < disp.length; i++) {
        pushRef.current(bannersForEntry(disp[i]!, disp[i - 1], rules));
      }
    }
    prevDispRef.current = disp;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disp]);

  // あがり演出: 順位の確定（finishRank が null → 順位）を検知したら、
  // その人の「上がりの手」が表示キューで表示される位置（atDisp）を記録
  // して待ち行列に入れ、表示がそこへ到達した時点でバナーキューへ流す。
  // 順位はエンジンが最終順位として確定させた値を使う: 都落ち・下剋上・
  // 残り1人の最下位確定も、原因となった上がりと同じ状態更新で一括して
  // 確定するため、ここで出す称号が後から食い違うことはない。
  // 同時に複数人確定した場合は、原因の手にそろえて順位順に1人ずつ出す。
  const flushPendingFinishes = () => {
    const pend = pendingFinishRef.current;
    if (pend.length === 0) return;
    const ready = pend
      .filter((f) => f.atDisp <= dispRef.current.length)
      .sort((a, b) => a.rank - b.rank);
    if (ready.length === 0) return;
    pendingFinishRef.current = pend.filter((f) => !ready.includes(f));
    pushRef.current(
      ready.map((f) => ({
        kind: "finish" as const,
        dedupeKey: `finish:${f.playerId}:${f.rank}`,
        title: rankLabel(f.rank, f.total),
        playerName: f.name,
        rankPos: f.rank,
        avatar: f.avatar,
        tone: "gold" as const,
      })),
    );
  };
  const flushFinishRef = useRef(flushPendingFinishes);
  flushFinishRef.current = flushPendingFinishes;

  const prevRanksRef = useRef<Map<string, number | null> | null>(null);
  useEffect(() => {
    const prev = prevRanksRef.current;
    const next = new Map(players.map((p) => [p.id, p.finishRank]));
    if (prev) {
      const fresh = players
        .filter(
          (p) =>
            p.finishRank !== null &&
            prev.get(p.id) === null &&
            !shownFinishRef.current.has(p.id),
        )
        .sort((a, b) => (a.finishRank ?? 0) - (b.finishRank ?? 0));
      if (fresh.length > 0) {
        const hist = historyRef.current;
        // 各人の最後の履歴エントリ = 上がりの手（7渡し・10捨ての受け渡し
        // エントリも含む）。専用エントリが無い決着（4止め等）は履歴末尾。
        const atOf = (playerId: string) => {
          for (let i = hist.length - 1; i >= 0; i--) {
            if (hist[i]!.playerId === playerId) return i + 1;
          }
          return hist.length;
        };
        // 同時確定は原因となった手の位置にそろえる（一番遅い位置を採用）。
        const batchAt = Math.max(...fresh.map((p) => atOf(p.id)));
        for (const p of fresh) {
          shownFinishRef.current.add(p.id);
          pendingFinishRef.current.push({
            playerId: p.id,
            name: p.name,
            rank: p.finishRank!,
            total: players.length,
            avatar: p.avatar ?? null,
            atDisp: batchAt,
          });
        }
        flushFinishRef.current();
      }
    }
    prevRanksRef.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players]);

  // 表示キューが進むたびに、到達したあがり演出をバナーキューへ流す。
  useEffect(() => {
    flushFinishRef.current();
  }, [disp]);

  // Log-driven banners （都落ち / 下剋上 / 4止め / 天変地異）: count-based so the
  // online log (last 10 lines) sliding window doesn't re-fire old lines.
  const logCountsRef = useRef<Record<string, number>>({});
  useEffect(() => {
    const marks: { key: string; title: string; tone: FxBanner["tone"] }[] = [
      { key: "都落ち", title: "都落ち！", tone: "red" },
      { key: "下剋上", title: "下剋上！", tone: "red" },
      { key: "4止め！", title: "4止め！", tone: "gold" },
      { key: "天変地異", title: "天変地異！", tone: "blue" },
    ];
    for (const m of marks) {
      const count = log.filter((l) => l.includes(m.key)).length;
      const prevCount = logCountsRef.current[m.key] ?? 0;
      if (count > prevCount) {
        pushRef.current([{ title: m.title, tone: m.tone }]);
      }
      logCountsRef.current[m.key] = count;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log]);

  // 席替えイントロの前半は、前ゲームの席順のまま席を表示する
  // （後半で新しい並びへ切り替わり、席ボックスが新しい位置へ滑る）。
  const seatPlayers = displayOrder
    ? [...players].sort(
        (a, b) => displayOrder.indexOf(a.id) - displayOrder.indexOf(b.id),
      )
    : players;

  return (
    <>
      <OpponentSeats
        players={seatPlayers}
        viewerId={viewerId}
        currentPlayerId={seatTurnId}
        glowPlayerId={seatGlowId}
        seatFx={seatFx}
        passedIds={passedIds}
      />
      <FieldPile
        disp={disp}
        ghost={ghost}
        viewerId={viewerId}
        fieldCards={fieldCards}
        ownerName={ownerName}
        revolution={dispRevolution}
        backActive={backActive}
        lockSuit={lockSuit}
        numberLockNext={numberLockNext}
        direction={direction}
      />
      <LogList log={log} />
      {banner &&
        (banner.kind === "finish" ? (
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 z-[66] flex items-center justify-center px-6"
          >
            <div
              key={bannerSeq}
              className="finish-banner gold-frame rounded-3xl bg-[#0a2e1c]/95 px-8 py-5 text-center shadow-2xl"
            >
              <div className="flex items-center justify-center gap-2.5">
                {banner.avatar && (
                  <img
                    src={banner.avatar}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-full border-2 border-[#ffd34d] object-cover"
                  />
                )}
                <p
                  className="text-2xl sm:text-3xl font-extrabold text-white"
                  style={{ textShadow: "0 2px 0 rgba(0,0,0,0.55)" }}
                >
                  {banner.playerName}
                </p>
              </div>
              <p
                className="gold-text mt-1 text-6xl sm:text-7xl font-extrabold tracking-wide"
                style={{
                  textShadow:
                    "0 3px 0 rgba(0,0,0,0.55), 0 0 30px rgba(255,211,77,0.45)",
                }}
              >
                {banner.title}
              </p>
              {banner.rankPos != null && (
                <p className="mt-1.5 text-sm font-extrabold text-[#ffe9a8]">
                  {banner.rankPos}位で上がり！
                </p>
              )}
            </div>
          </div>
        ) : (
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 z-[65] flex items-center justify-center px-6"
          >
            <div
              key={bannerSeq}
              className={`effect-banner rounded-2xl border-[3px] bg-[#0a2e1c]/95 px-7 py-3.5 text-center shadow-2xl ${BANNER_TONE[banner.tone]}`}
            >
              <p
                className="text-4xl sm:text-5xl font-extrabold tracking-wide"
                style={{ textShadow: "0 2px 0 rgba(0,0,0,0.55), 0 0 22px rgba(0,0,0,0.35)" }}
              >
                {banner.title}
              </p>
              {banner.sub && (
                <p className="mt-1 text-sm font-extrabold text-white">{banner.sub}</p>
              )}
            </div>
          </div>
        ))}
    </>
  );
}

/** Fanned (arched) hand at the bottom of the table. Card size and overlap
 * shrink automatically as the hand grows, so it never spills off-screen. */
function FanHand({
  cards,
  selected,
  onToggle,
  limit,
  playableIds,
  glowIds,
}: {
  cards: Card[];
  selected: string[];
  onToggle?: (id: string) => void;
  /** 配札アニメーション中だけ指定：先頭から何枚まで見せるか。 */
  limit?: number;
  /** 自分の手番のときだけ渡す「出せるカード」のID集合。nullなら通常表示。
   * 出せるカードは金の光枠＋グロー、出せないカードは暗く表示する。 */
  playableIds?: Set<string> | null;
  /** カード交換の献上確認などで「このカードを渡します」と示すID集合。
   * 出せるカードの発光と同じ金のグローだけを付け、他のカードは暗くしない。 */
  glowIds?: Set<string> | null;
}) {
  const shownCards = limit !== undefined ? cards.slice(0, Math.max(0, limit)) : cards;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [wrapW, setWrapW] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWrapW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = shownCards.length;
  const mid = (n - 1) / 2;
  // Measure the actual rendered width so the fan always fits its area.
  const avail = (wrapW > 0 ? wrapW : 360) - 6;
  let cardW = 58;
  let step = 0;
  if (n > 1) {
    step = Math.min(36, (avail - cardW) / (n - 1));
    if (step < 13) {
      // Too many cards: tighten to a 13px sliver and shrink the cards instead.
      step = 13;
      cardW = Math.max(38, avail - step * (n - 1));
    }
  }
  const cardH = Math.round(cardW * 1.45);
  const arc = (rel: number) => Math.min(Math.abs(rel) * Math.abs(rel) * 0.5, 16);

  return (
    <div
      ref={wrapRef}
      data-hand="true"
      className="relative mx-1 shrink-0"
      style={{ height: cardH + 22 }}
      aria-label="手札"
    >
      {shownCards.map((c, i) => {
        const rel = i - mid;
        const isSel = selected.includes(c.id);
        const rot = Math.max(-17, Math.min(17, rel * 3.2));
        const playable = playableIds ? playableIds.has(c.id) : null;
        const glowing = playable === true || (glowIds ? glowIds.has(c.id) : false);
        return (
          <div
            key={c.id}
            className={`absolute bottom-0.5 ${glowing ? "playable-glow" : ""}`}
            style={{
              left: `calc(50% + ${rel * step}px)`,
              transform: `translateX(-50%) rotate(${rot}deg) translateY(${arc(rel) + (isSel ? -20 : 0)}px)`,
              transformOrigin: "50% 130%",
              transition: "transform 180ms ease, left 180ms ease, filter 200ms ease",
              zIndex: isSel ? 40 : i + 1,
              filter:
                playable === false ? "brightness(0.52) saturate(0.5)" : undefined,
            }}
          >
            <PlayingCardView
              card={c}
              size="hand"
              selected={isSel}
              onClick={onToggle ? () => onToggle(c.id) : undefined}
              style={{ width: cardW, height: cardH }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ---------- dealing animation ----------

interface DealFlight {
  key: number;
  left: number;
  top: number;
  dx: number;
  dy: number;
  rot: number;
  go: boolean;
}

/**
 * ゲーム開始時の配札：中央の山札から各プレイヤーへ1枚ずつ順にカードが飛ぶ。
 * 全体の長さは約2.4秒に収め、タップで即完了できる。dealKey（ゲーム番号）が
 * 変わったときだけ再生し、参加者・手札枚数は開始時点の値をスナップショットする。
 */
function useDealing(
  dealKey: string | null,
  participants: { id: string }[],
  viewerId: string,
  handSize: number,
  enabled: boolean,
  intro?: {
    /** 今ゲームの席順（プレイヤーIDの並び）。 */
    orderIds: string[];
    /** 前ゲームの席順。席替えで並びが変わったときだけイントロを再生する。 */
    prevOrder: string[] | null;
    enabled: boolean;
  } | null,
) {
  const [active, setActive] = useState(false);
  const [viewerDealt, setViewerDealt] = useState(0);
  const [flight, setFlight] = useState<DealFlight | null>(null);
  // 席替えイントロ: "gather"（前ゲームの並びのまま席が寄る）→
  // "settle"（新しい並びへ切り替わり、席が新しい位置へ滑る）→ 配札開始。
  const [shufflePhase, setShufflePhase] = useState<"gather" | "settle" | null>(null);
  const [displayOrder, setDisplayOrder] = useState<string[] | null>(null);
  const timers = useRef<number[]>([]);
  const startedKey = useRef<string | null>(null);
  const skipRef = useRef<() => void>(() => {});
  const skipIntroRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!dealKey || startedKey.current === dealKey) return;
    startedKey.current = dealKey;
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setShufflePhase(null);
    setDisplayOrder(null);
    skipIntroRef.current = () => {};
    if (!enabled || handSize <= 0 || participants.length === 0 || prefersReducedMotion()) {
      setActive(false);
      setViewerDealt(handSize);
      setFlight(null);
      skipRef.current = () => {};
      return;
    }
    // 席替えイントロが必要か: 席替えON・前ゲームの並びがあり、
    // 新しい並びが前回と実際に違うときだけ（同じ並びなら演出なし）。
    const orderNow = intro?.orderIds ?? [];
    const prevOrder = intro?.prevOrder ?? null;
    const orderChanged =
      !!intro?.enabled &&
      !!prevOrder &&
      prevOrder.length === orderNow.length &&
      orderNow.length >= 2 &&
      orderNow.some((id, i) => prevOrder[i] !== id);
    if (orderChanged) {
      setShufflePhase("gather");
      setDisplayOrder(prevOrder);
      let introDone = false;
      const beginDealing = () => {
        if (introDone) return;
        introDone = true;
        setShufflePhase(null);
        setDisplayOrder(null);
        skipIntroRef.current = () => {};
        startDealing();
      };
      // 700ms で並びを新しい席順へ切り替え（displayOrder 解除）、その
      // レンダーで OpponentSeats の FLIP が席を旧位置→新位置へ滑らせる。
      // shufflePhase は配札開始まで "settle" のまま保持する。
      const t1 = window.setTimeout(() => {
        setDisplayOrder(null);
        setShufflePhase("settle");
      }, 700);
      const t2 = window.setTimeout(beginDealing, 1500);
      timers.current.push(t1, t2);
      skipIntroRef.current = () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
        beginDealing();
      };
      return;
    }
    startDealing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealKey]);

  function startDealing() {
    const seq: string[] = [];
    for (let r = 0; r < handSize; r++) {
      for (const p of participants) seq.push(p.id);
    }
    const interval = Math.max(30, Math.min(70, Math.floor(2300 / Math.max(1, seq.length))));
    setActive(true);
    setViewerDealt(0);
    let vDealt = 0;
    seq.forEach((pid, idx) => {
      const t = window.setTimeout(() => {
        if (pid === viewerId) {
          vDealt += 1;
          setViewerDealt(vDealt);
        }
        const deck = document.querySelector<HTMLElement>("[data-deck-anchor]");
        const seat = document.querySelector<HTMLElement>(
          `[data-seat-player="${pid}"]`,
        );
        if (deck && seat) {
          const d = deck.getBoundingClientRect();
          const s = seat.getBoundingClientRect();
          const f: DealFlight = {
            key: idx,
            left: s.left + s.width / 2 - 13,
            top: s.top + s.height / 2 - 19,
            dx: d.left + d.width / 2 - (s.left + s.width / 2),
            dy: d.top + d.height / 2 - (s.top + s.height / 2),
            rot: ((idx % 5) - 2) * 4,
            go: false,
          };
          setFlight(f);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setFlight((cur) => (cur && cur.key === idx ? { ...cur, go: true } : cur));
            });
          });
        }
        if (idx === seq.length - 1) {
          const t2 = window.setTimeout(() => {
            setActive(false);
            setFlight(null);
          }, 240);
          timers.current.push(t2);
        }
      }, 140 + idx * interval);
      timers.current.push(t);
    });
    skipRef.current = () => {
      timers.current.forEach((tt) => window.clearTimeout(tt));
      timers.current = [];
      setActive(false);
      setFlight(null);
      setViewerDealt(handSize);
    };
  }

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  return {
    active,
    viewerDealt,
    flight,
    skip: () => skipRef.current(),
    shufflePhase,
    displayOrder,
    skipIntro: () => skipIntroRef.current(),
  };
}

type DealState = ReturnType<typeof useDealing>;

/** 席替えイントロのバナー。配札の前に約1.5秒出て、タップで
 * イントロだけを飛ばして配札へ進める。 */
function SeatShuffleBanner({ deal }: { deal: DealState }) {
  if (!deal.shufflePhase) return null;
  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center px-6"
      role="button"
      aria-label="席替えアニメーションをスキップ"
      onClick={deal.skipIntro}
    >
      <div className="shuffle-banner gold-frame pointer-events-none rounded-3xl bg-[#0a2e1c]/95 px-8 py-5 text-center shadow-2xl">
        <p
          className="gold-text text-5xl font-extrabold tracking-wide"
          style={{
            textShadow:
              "0 3px 0 rgba(0,0,0,0.55), 0 0 30px rgba(255,211,77,0.45)",
          }}
        >
          席替え！
        </p>
        <p className="mt-1.5 text-sm font-bold text-white/90">
          席順が入れ替わりました
        </p>
      </div>
    </div>
  );
}

function DealOverlay({ deal }: { deal: DealState }) {
  if (!deal.active) return null;
  const f = deal.flight;
  return (
    <div
      className="fixed inset-0 z-[80]"
      role="button"
      aria-label="配札アニメーションをスキップ"
      onClick={deal.skip}
    >
      <div
        data-deck-anchor
        className="deck-pulse absolute left-1/2 top-[29%]"
        style={{ transform: "translate(-50%, -50%)" }}
      >
        <div className="relative w-14 h-20">
          <span className="card-back-blue absolute inset-0" style={{ transform: "rotate(-7deg) translate(-4px, 2px)" }} />
          <span className="card-back-blue absolute inset-0" style={{ transform: "rotate(5deg) translate(4px, 0)" }} />
          <span className="card-back-blue absolute inset-0" />
        </div>
        <p className="mt-2 w-32 -ml-9 text-center text-[11px] font-bold text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          配札中… タップでスキップ
        </p>
      </div>
      {f && (
        <div
          aria-hidden
          className="pointer-events-none fixed left-0 top-0 z-[81]"
          style={{
            transform: f.go
              ? `translate(${f.left}px, ${f.top}px) rotate(${f.rot}deg) scale(1)`
              : `translate(${f.left + f.dx}px, ${f.top + f.dy}px) rotate(${f.rot - 14}deg) scale(0.8)`,
            transition: f.go ? "transform 170ms ease-out" : "none",
          }}
        >
          <div className="card-back-blue w-[26px] h-[38px]" />
        </div>
      )}
    </div>
  );
}

function ActionButtons({
  canPass,
  canPlay,
  selectedCount,
  onPass,
  onPlay,
  revChoice = false,
  onPlayNoRev,
  highlight = false,
}: {
  canPass: boolean;
  canPlay: boolean;
  selectedCount: number;
  onPass: () => void;
  onPlay: () => void;
  revChoice?: boolean;
  onPlayNoRev?: () => void;
  /** 自分の手番（入力可能）な間、ボタン周りを金色に光らせる。 */
  highlight?: boolean;
}) {
  if (revChoice) {
    return (
      <div
        className={`px-4 pb-1.5 -mt-2 relative z-30 shrink-0 ${highlight ? "my-turn-actions" : ""}`}
      >
        <p className="text-center text-xs font-extrabold text-[#ffe9a8] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] mb-1">
          革命を起こせます。どうしますか？
        </p>
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={onPlay}
            disabled={!canPlay}
            aria-label="革命して出す"
            className="btn-orange flex-1 max-w-[170px] rounded-2xl font-extrabold py-2.5 text-base"
          >
            革命して出す
          </button>
          <button
            type="button"
            onClick={onPlayNoRev}
            disabled={!canPlay}
            aria-label="革命せずに出す"
            className="flex-1 max-w-[170px] rounded-2xl font-extrabold py-2.5 text-base bg-white/10 border-2 border-white/50 text-white disabled:opacity-50"
          >
            革命せず出す
          </button>
        </div>
      </div>
    );
  }
  return (
    <div
      className={`flex justify-center gap-3 px-4 pb-1.5 -mt-2 relative z-30 shrink-0 ${highlight ? "my-turn-actions" : ""}`}
    >
      <button
        type="button"
        onClick={onPass}
        disabled={!canPass}
        aria-label="パスする"
        className="btn-orange flex-1 max-w-[170px] rounded-2xl font-extrabold py-2.5 text-lg"
      >
        パス
      </button>
      <button
        type="button"
        onClick={onPlay}
        disabled={!canPlay}
        aria-label="選んだカードを出す"
        className="btn-orange flex-1 max-w-[190px] rounded-2xl font-extrabold py-2.5 text-lg"
      >
        出す（{selectedCount}枚）
      </button>
    </div>
  );
}

const PENDING_LABEL: Record<PendingView["type"], string> = {
  sevenPass: "7渡し",
  tenDiscard: "10捨て",
  qBomber: "Qボンバー",
  fourStop: "4止め",
};

function PendingPanel({
  pending,
  isMine,
  actorName,
  selectedCount,
  chosenRank,
  onChooseRank,
  onConfirm,
  onDecline,
  busy,
  exact = false,
}: {
  pending: PendingView;
  isMine: boolean;
  actorName: string;
  selectedCount: number;
  chosenRank: number | null;
  onChooseRank: (r: number) => void;
  onConfirm: () => void;
  onDecline?: () => void;
  busy?: boolean;
  exact?: boolean;
}) {
  return (
    <div className="gold-frame panel-in mx-3 mb-1.5 rounded-2xl bg-[#07331a]/95 p-2.5 shadow-xl relative z-30 shrink-0 max-h-[38dvh] overflow-y-auto">
      <p className="font-extrabold text-[#ffe9a8]">
        {PENDING_LABEL[pending.type]}
        {isMine ? "：あなたの番です" : `：${actorName}さんが対応中…`}
      </p>
      {isMine && pending.type === "qBomber" && (
        <>
          <p className="text-xs font-bold text-white mt-1">
            全員が捨てる数字を1つ選んでください（その数字のカードは全員の手札から捨てられます）
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((r) => (
              <button
                key={r}
                type="button"
                aria-label={`数字 ${rankStr(r)} を宣言`}
                aria-pressed={chosenRank === r}
                onClick={() => onChooseRank(r)}
                className={`w-10 h-10 rounded-full font-extrabold ${
                  chosenRank === r
                    ? "bg-[#ffd34d] text-[#4a3205]"
                    : "bg-white/15 text-white border border-white/40"
                }`}
                style={{ minHeight: 0 }}
              >
                {rankStr(r)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onConfirm}
            disabled={chosenRank === null || busy}
            className="btn-orange mt-3 w-full rounded-xl font-extrabold py-3 disabled:opacity-50"
          >
            {chosenRank !== null ? `「${rankStr(chosenRank)}」を宣言する` : "数字を選んでください"}
          </button>
        </>
      )}
      {isMine && pending.type === "fourStop" && (
        <>
          <p className="text-xs font-bold text-white mt-1">
            8切りの2倍の{pending.maxCount}枚の4を持っています。4止めすると8切りが無効になり、場が流れてあなたが親（次に最初に出す人）になります。
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className="btn-orange flex-1 rounded-xl font-extrabold py-3 disabled:opacity-50"
            >
              4止めする（4を{pending.maxCount}枚出す）
            </button>
            <button
              type="button"
              onClick={onDecline}
              disabled={busy}
              className="flex-1 rounded-xl bg-white/10 border border-white/40 text-white font-extrabold py-3 disabled:opacity-50"
            >
              止めない
            </button>
          </div>
        </>
      )}
      {isMine && pending.type !== "qBomber" && pending.type !== "fourStop" && (
        <>
          <p className="text-xs font-bold text-white mt-1">
            {exact
              ? pending.type === "sevenPass"
                ? `手札からちょうど${pending.maxCount}枚選んで、次の人に渡してください（枚数選択OFF）`
                : `手札からちょうど${pending.maxCount}枚選んで捨ててください（枚数選択OFF）`
              : pending.type === "sevenPass"
                ? `手札から最大${pending.maxCount}枚まで選んで、次の人に渡せます（渡さなくてもOK）`
                : `手札から最大${pending.maxCount}枚まで選んで捨てられます（捨てなくてもOK）`}
          </p>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="btn-orange mt-3 w-full rounded-xl font-extrabold py-3"
          >
            {pending.type === "sevenPass"
              ? selectedCount > 0
                ? `${selectedCount}枚渡す`
                : "渡さない"
              : selectedCount > 0
                ? `${selectedCount}枚捨てる`
                : "捨てない"}
          </button>
        </>
      )}
    </div>
  );
}

/** カード交換フェーズのパネル。
 * role="give" は貧民側の献上、role="back" は大富豪・富豪側が渡すカードの選択。
 * 献上側（人間）は、まず配られた手札を見て、光っている渡すカードを確認し、
 * 「カード交換する」を押して初めて交換が実行される。giveLabels は光っている
 * 献上カードの表示名、giveCanChange は「貧民のカード選択」ONでタップ変更可。 */
function ExchangePanel({
  step,
  role,
  isMine,
  deciderName,
  otherName,
  selectedCount,
  onConfirm,
  busy,
  giveLabels,
  giveCanChange,
}: {
  step: { count: number };
  role: "give" | "back";
  isMine: boolean;
  deciderName: string;
  otherName: string;
  selectedCount: number;
  onConfirm: () => void;
  busy?: boolean;
  giveLabels?: string | null;
  giveCanChange?: boolean;
}) {
  return (
    <div className="gold-frame panel-in mx-3 mb-1.5 rounded-2xl bg-[#07331a]/95 p-2.5 shadow-xl relative z-30 shrink-0">
      <p className="font-extrabold text-[#ffe9a8]">
        カード交換
        {isMine
          ? "：あなたの番です"
          : role === "give"
            ? `：${deciderName}さんの交換を待っています`
            : `：${deciderName}さんが選んでいます…`}
      </p>
      {isMine && role === "give" && (
        <>
          <p className="text-xs font-bold text-white mt-1 leading-5">
            配られた手札を確認してください。
            {giveLabels
              ? `このカード（${giveLabels}）を${otherName}さんへ渡します。`
              : `光っている${step.count}枚を${otherName}さんへ渡します。`}
            {giveCanChange
              ? "変えたいときは、光っているカードをタップして外し、別のカードを選べます。"
              : "渡すカードは最強のカードで決まっています。"}
          </p>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || selectedCount !== step.count}
            className="btn-orange mt-3 w-full rounded-xl font-extrabold py-3 disabled:opacity-50"
          >
            {selectedCount === step.count
              ? "カード交換する"
              : `あと${step.count - selectedCount}枚選んでください`}
          </button>
        </>
      )}
      {isMine && role === "back" && (
        <>
          <p className="text-xs font-bold text-white mt-1">
            {`${otherName}さんへ渡す「いらないカード」を、ちょうど${step.count}枚選んでください`}
          </p>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || selectedCount !== step.count}
            className="btn-orange mt-3 w-full rounded-xl font-extrabold py-3 disabled:opacity-50"
          >
            {selectedCount === step.count
              ? `${step.count}枚渡す`
              : `あと${step.count - selectedCount}枚選んでください`}
          </button>
        </>
      )}
      {!isMine && role === "give" && (
        <p className="text-xs font-bold text-white/85 mt-1">
          {deciderName}さんが手札を確認して、渡すカードを決めています…
        </p>
      )}
    </div>
  );
}

/** 持ち時間タイマー: turnKeyが変わるたびにリセットされ、0で onTimeout を1回呼ぶ。 */
function useTurnTimer(
  limitSec: number,
  turnKey: string,
  active: boolean,
  onTimeout: () => void,
): number | null {
  const [left, setLeft] = useState<number | null>(null);
  const cbRef = useRef(onTimeout);
  cbRef.current = onTimeout;
  useEffect(() => {
    if (!active || limitSec <= 0) {
      setLeft(null);
      return;
    }
    const deadline = Date.now() + limitSec * 1000;
    setLeft(limitSec);
    let fired = false;
    const iv = setInterval(() => {
      const remain = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setLeft(remain);
      if (remain <= 0 && !fired) {
        fired = true;
        cbRef.current();
      }
    }, 200);
    return () => clearInterval(iv);
  }, [turnKey, active, limitSec]);
  return left;
}

function TurnTimerBadge({ left }: { left: number | null }) {
  if (left === null) return null;
  return (
    <p
      className={`text-center text-xs font-extrabold drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] mb-1 ${
        left <= 5 ? "text-[#ff9d7a]" : "text-white/90"
      }`}
      aria-live="polite"
    >
      ⏱ 持ち時間 残り{left}秒
    </p>
  );
}

// ---------- rules editor ----------

type RuleItem =
  | { kind: "bool"; key: string; label: string; desc: string; uiOnly?: boolean }
  | {
      kind: "choice";
      key: string;
      label: string;
      desc: string;
      options: { value: string; label: string }[];
      uiOnly?: boolean;
    }
  | {
      kind: "number";
      key: string;
      label: string;
      desc: string;
      options: { value: number; label: string }[];
      uiOnly?: boolean;
    };

interface RuleCategory {
  id: string;
  title: string;
  masterKey?: string;
  items: RuleItem[];
}

const RULE_PANELS: RuleCategory[] = [
  {
    id: "revolution",
    title: "革命",
    masterKey: "revolution",
    items: [
      { kind: "bool", key: "revolution", label: "革命", desc: "同じ数字を4枚以上出すと、カードの強さが逆転します（ジョーカーは逆転中も最強のままです）" },
      { kind: "bool", key: "stairsRevolution", label: "階段革命", desc: "階段を5枚以上出しても革命が起きます" },
      { kind: "choice", key: "revolutionReturn", label: "革命返し", desc: "革命中に再び革命の条件を満たしたときの扱い。「即時」はその場で元の強さに戻ります", options: [{ value: "immediate", label: "即時" }, { value: "none", label: "なし" }] },
      { kind: "bool", key: "revolutionJoker", label: "ジョーカー含み", desc: "ジョーカーを含む組でも革命を起こせます" },
      { kind: "bool", key: "revolutionChoice", label: "革命選択", desc: "革命を起こせる場面で、起こすかどうかを出す人が選べます（CPUは手札を見て自動で判断します）" },
      { kind: "bool", key: "coupDetat", label: "クーデター", desc: "9を3枚出すと革命が起きます" },
      { kind: "bool", key: "omen", label: "オーメン", desc: "6を3枚出すと革命が起き、以後は革命が起きず、他のカード効果も無効になります" },
      { kind: "bool", key: "nanasanRevolution", label: "ナナサン革命", desc: "7を3枚出すと革命が起きます" },
    ],
  },
  {
    id: "stairs",
    title: "階段",
    masterKey: "stairs",
    items: [
      { kind: "bool", key: "stairs", label: "階段", desc: "同じマークの連番（例：♠4・5・6）も出せるようになります" },
      { kind: "number", key: "stairsMin", label: "階段枚数", desc: "階段として出せる最小の枚数です", options: [{ value: 3, label: "3枚〜" }, { value: 4, label: "4枚〜" }, { value: 5, label: "5枚〜" }] },
      { kind: "choice", key: "stairsStrength", label: "階段の強さ", desc: "階段同士の強弱の判定方法です。「トップ」は一番上の数字（ジョーカーで伸ばした分を含む）、「重なる」は重なった区間にある実際のカードの一番強い数字で比べます（ジョーカーで伸ばした分は数えません）", options: [{ value: "overlap", label: "重なる" }, { value: "top", label: "トップ" }] },
      { kind: "bool", key: "stairsEffects", label: "階段中のカード効果", desc: "ONだと、階段に含まれる8（8切り）・J（11バック）などの効果も発動します" },
      { kind: "bool", key: "emperor", label: "エンペラー", desc: "マークが全て異なる4枚の連番も出せる特殊な階段です。階段として受け・返しができ、出したときは革命が起きます" },
    ],
  },
  {
    id: "shibari",
    title: "縛り",
    masterKey: "shibari",
    items: [
      { kind: "bool", key: "shibari", label: "縛り", desc: "同じマークが続けて出ると、そのマークしか出せなくなります" },
      { kind: "bool", key: "numberShibari", label: "数しば", desc: "場の数字の1つ強い数字が続けて出されると数字縛りが発生し、次も1つ強い数字しか出せなくなります（場が流れるまで続きます）" },
      { kind: "bool", key: "gekiShibari", label: "激しば", desc: "縛りが発生すると、マーク縛りと数字縛りが同時にかかる厳しい縛りです" },
      { kind: "choice", key: "ryoShibari", label: "両しば", desc: "マークと数字の両方の縛りがかかっているときの出し方です。「両方」は両方の条件を満たす手だけ、「どちらか」は片方を満たせば出せます", options: [{ value: "both", label: "両方" }, { value: "either", label: "どちらか" }] },
      { kind: "number", key: "shibariCount", label: "縛り回数", desc: "同じマークが何回続いたら縛りが発生するかです", options: [{ value: 1, label: "1回" }, { value: 2, label: "2回" }, { value: 3, label: "3回" }] },
    ],
  },
  {
    id: "eight",
    title: "8切り",
    masterKey: "eightCut",
    items: [
      { kind: "bool", key: "eightCut", label: "8切り", desc: "8を含むと場が流れて、続けて自分が出せます" },
      { kind: "bool", key: "fourStop", label: "4止め", desc: "8切りが出たとき、その枚数の2倍の4を持つ人（最初に該当する人）が止めるか選べます。止めると8切りは無効になり、場が流れてその人が親になります" },
      { kind: "bool", key: "sandstorm", label: "砂嵐", desc: "3を3枚なら、場の枚数や強さに関係なく出せて、場が流れます" },
      { kind: "bool", key: "ambulance", label: "99車（救急車）", desc: "9を2枚出すと場が流れ、続けて自分が出せます" },
      { kind: "bool", key: "rokurokubi", label: "ろくろ首", desc: "6を2枚出すと場が流れ、続けて自分が出せます" },
    ],
  },
  {
    id: "eleven",
    title: "11バック",
    masterKey: "elevenBack",
    items: [
      { kind: "bool", key: "elevenBack", label: "11バック", desc: "Jを含むと、場が流れるまで強さが一時的に逆転します（ジョーカーは逆転中も最強のままです）" },
      { kind: "bool", key: "strongElevenBack", label: "強化11バック", desc: "場が流れても11バックの効果が続きます（もう一度Jが出るか、対局が終わるまで）" },
    ],
  },
  {
    id: "forbidden",
    title: "禁止あがり",
    masterKey: "forbiddenFinish",
    items: [
      { kind: "bool", key: "forbiddenFinish", label: "禁止あがり", desc: "指定したカードでは手札を0枚にして上がれなくなります。下の項目が対象です" },
      { kind: "bool", key: "forbid2", label: "2あがり禁止", desc: "2を含む出し方では上がれません" },
      { kind: "bool", key: "forbid8", label: "8切りあがり禁止", desc: "8を含む出し方では上がれません" },
      { kind: "choice", key: "forbidJoker", label: "Jokerあがり禁止", desc: "「やさしい」はジョーカー単体でのあがりだけ禁止、「全て」はジョーカーを含む全てのあがりを禁止します", options: [{ value: "off", label: "OFF" }, { value: "yasashii", label: "ON やさしい" }, { value: "all", label: "ON 全て" }] },
      { kind: "bool", key: "forbidSpade3", label: "スペ3あがり禁止", desc: "♠3単体では上がれません" },
      { kind: "bool", key: "forbidQBomber", label: "12ボンバーあがり禁止", desc: "Qを含む出し方では上がれません" },
      { kind: "bool", key: "forbid11Back", label: "11バックあがり禁止", desc: "Jを含む出し方では上がれません" },
      { kind: "bool", key: "forbid7Pass", label: "7渡しあがり禁止", desc: "7を含む出し方では上がれません" },
      { kind: "bool", key: "forbid10Discard", label: "10捨てあがり禁止", desc: "10を含む出し方では上がれません" },
    ],
  },
  {
    id: "miyako",
    title: "都落ち",
    masterKey: "miyakoOchi",
    items: [
      { kind: "bool", key: "miyakoOchi", label: "都落ち", desc: "前の大富豪が1位で上がれなかった場合、その場で大貧民に落ちて対局が終わります" },
      { kind: "bool", key: "gekokujo", label: "下剋上", desc: "前回の大貧民が1位で上がると、前回の大富豪がその場で大貧民に落ちて対局が終わります。次のゲームの順位・カード交換にもそのまま反映されます" },
    ],
  },
  {
    id: "joker",
    title: "Joker",
    items: [
      { kind: "number", key: "jokerCount", label: "Jokerの枚数", desc: "山札に入れるジョーカーの枚数です", options: [{ value: 0, label: "0枚" }, { value: 1, label: "1枚" }, { value: 2, label: "2枚" }] },
      { kind: "choice", key: "jokerEffect", label: "Jokerの効果", desc: "ジョーカーを何の代わりに使えるかです。「全て」は組にも階段にも使えます", options: [{ value: "all", label: "ON 全て" }, { value: "groups", label: "組のみ" }, { value: "stairs", label: "階段のみ" }] },
      { kind: "bool", key: "spade3", label: "スペ3返し", desc: "♠3だけは単体でジョーカーに勝てて、場が流れます" },
    ],
  },
  {
    id: "reverse",
    title: "リバース",
    masterKey: "reverse",
    items: [
      { kind: "bool", key: "reverse", label: "リバース", desc: "特定のカードを出すと、ターンの進む方向が逆になります" },
      { kind: "bool", key: "reverse9", label: "9リバース", desc: "9を出すと進行方向が逆になります" },
      { kind: "bool", key: "reverse12", label: "12リバース", desc: "Qを出すと進行方向が逆になります" },
    ],
  },
  {
    id: "skip",
    title: "スキップ",
    masterKey: "skip",
    items: [
      { kind: "bool", key: "skip", label: "スキップ", desc: "特定のカードを出すと、次の人が1回休みになります" },
      { kind: "bool", key: "skip5", label: "5スキップ", desc: "5を含むと、次の人が1回休みになります（2枚なら2人飛ばします）" },
      { kind: "bool", key: "skip13", label: "13スキップ", desc: "Kを含むと、次の人が1回休みになります" },
    ],
  },
  {
    id: "seven",
    title: "7渡し",
    masterKey: "sevenPass",
    items: [
      { kind: "bool", key: "sevenPass", label: "7渡し", desc: "7を出した枚数分まで、手札を次の人に渡せます" },
      { kind: "bool", key: "sevenPassChoice", label: "枚数選択", desc: "ONだと渡す枚数を自由に選べます。OFFだと出した7の枚数分ちょうど渡します" },
    ],
  },
  {
    id: "ten",
    title: "10捨て",
    masterKey: "tenDiscard",
    items: [
      { kind: "bool", key: "tenDiscard", label: "10捨て", desc: "10を出した枚数分まで、手札を捨てられます" },
      { kind: "bool", key: "tenDiscardChoice", label: "枚数選択", desc: "ONだと捨てる枚数を自由に選べます。OFFだと出した10の枚数分ちょうど捨てます" },
    ],
  },
  {
    id: "qbomber",
    title: "12ボンバー",
    masterKey: "qBomber",
    items: [
      { kind: "bool", key: "qBomber", label: "12ボンバー", desc: "Qを出すと数字を1つ宣言し、全員がその数字のカードを捨てます" },
    ],
  },
  {
    id: "down",
    title: "ダウンナンバー",
    masterKey: "downNumber",
    items: [
      { kind: "bool", key: "downNumber", label: "ダウンナンバー", desc: "場と同じマークなら、1つ弱いカードでも出せます" },
    ],
  },
  {
    id: "exchange",
    title: "カード交換",
    masterKey: "cardExchange",
    items: [
      { kind: "bool", key: "cardExchange", label: "カード交換", desc: "2ゲーム目以降、大貧民は最強2枚を大富豪へ・貧民は1枚を富豪へ献上し、大富豪・富豪は自分で選んだ「いらないカード」を同数返します" },
      { kind: "choice", key: "exchangeMode", label: "交換方式", desc: "「同時」は全員が一度に交換し、「順番」は大貧民側から1組ずつ順番に交換します", options: [{ value: "simultaneous", label: "ON 同時" }, { value: "order", label: "順番" }] },
      { kind: "bool", key: "exchangeChoice", label: "貧民のカード選択", desc: "ONだと貧民側が渡すカードを自分で選べます。OFFだと最強のカードが献上されますが、人間の貧民・大貧民は、まず配られた手札を見て、光った献上カードを確認し「カード交換する」を押してから交換します（CPUは自動）。大富豪・富豪側はこの設定によらず、常に自分で渡すカードを選べます" },
      { kind: "bool", key: "exchangeNoJoker", label: "Jokerを交換しない", desc: "ONだと、献上するカードの候補からジョーカーが除かれます" },
      { kind: "bool", key: "tenpenchii", label: "天変地異", desc: "配られた時点で大貧民の手札が全て10以下なら、大富豪と手札を全部入れ替えます" },
    ],
  },
  {
    id: "progress",
    title: "ゲームの進行",
    items: [
      { kind: "choice", key: "cpuLevel", label: "コンピューターの強さ", desc: "CPUの打ち回しの理論が変わります。「弱い」は初心者のように弱い手から出し、組を崩したり切り札（2・ジョーカー）を早めに使ったりします。「普通」は手札を出し切るまでの手数（組・階段の数）が減る手を弱い順に出し、切り札は終盤まで温存します（切り札でしか返せない場は序盤〜中盤ならパスもします）。「強い」は手数の最小化に加えて、出たカードを数えて残りの切り札を読み、相手の残り枚数に合わせた妨害や革命・11バックの損得判断までします", options: [{ value: "weak", label: "弱い" }, { value: "normal", label: "普通" }, { value: "strong", label: "強い" }] },
      { kind: "number", key: "timeLimit", label: "持ち時間", desc: "1手の持ち時間です。時間を過ぎると自動でパスします（親でパスできないときは自動で1手出し、受け渡しや交換も自動で処理されます）", options: [{ value: 0, label: "∞" }, { value: 10, label: "10秒" }, { value: 20, label: "20秒" }, { value: 30, label: "30秒" }, { value: 60, label: "60秒" }] },
      { kind: "choice", key: "startPlayer", label: "スタート", desc: "最初のゲームは♦3を持っている人から、2ゲーム目以降は選んだ条件の人から始まります。「大貧民から」は、2ゲーム目以降は前のゲームで大貧民（最下位）だった人から始まります（カード交換がある場合は交換が終わった後、その人が最初に出します）", options: [{ value: "daihinmin", label: "大貧民から" }, { value: "diamond3", label: "♦3" }, { value: "spade3", label: "♠3" }, { value: "winner", label: "前回の勝者" }] },
      { kind: "choice", key: "seatShuffle", label: "席替え", desc: "2ゲーム目以降、対局ごとに座席の並びをランダムに入れ替えます", options: [{ value: "random", label: "ON ランダム" }, { value: "off", label: "OFF" }] },
      { kind: "choice", key: "shuffleType", label: "シャッフル", desc: "カードの配り方です。「ランダム」は全てのカードをランダムにシャッフルして配ります。4種類の中で一番カードが偏りやすい配り方です。「リアリティ」は前のゲームの捨て札をもとにシャッフルして配ります。前のゲームでまとめて捨てられたカードはバラバラに配られる傾向があります（最初のゲームはランダムで配ります）。「セパレート」はカードを2つのグループ（グループ1「3〜9」、グループ2「10〜2・Joker」）に分けて、それぞれをシャッフルして配ります。配られたカードはそれぞれのグループがほぼ同数になります。「セパレート3」は3つのグループ（グループ1「3〜6」、グループ2「7〜11」、グループ3「12〜2・Joker」）に分けて同様に配ります", options: [{ value: "random", label: "ランダム" }, { value: "reality", label: "リアリティ" }, { value: "separate", label: "セパレート" }, { value: "separate3", label: "セパレート3" }] },
      { kind: "bool", key: "blindCard", label: "ブラインドカード", desc: "ONだと、割り切れない余りのカードを伏せて抜き、全員が同じ枚数で始めます" },
      { kind: "bool", key: "agariNagashi", label: "あがり流し", desc: "誰かが上がったら場を流して、次の人が親（最初に出す人）になります" },
      { kind: "bool", key: "passLimit", label: "パス制限", desc: "パスの扱いです。ONだと、一度パスしたらその場が流れるまでは出せなくなり、自分の番が来たら自動でパスになります（自動パスは履歴に表示されます）。OFFだと、一度パスしても場が流れるまでは次の自分の番でまたカードを出せます" },
    ],
  },
];

function startPlayerLabel(rules: Rules): string {
  switch (rules.startPlayer) {
    case "winner":
      return "前回の勝者";
    case "spade3":
      return "♠3を持った人";
    case "daihinmin":
      return "大貧民から";
    default:
      return "♦3を持った人";
  }
}

function activeRuleLabels(rules: Rules): string[] {
  const labels: string[] = [];
  for (const cat of RULE_PANELS) {
    for (const item of cat.items) {
      if (item.kind === "bool" && (rules as unknown as Record<string, unknown>)[item.key] === true) {
        labels.push(item.label);
      }
    }
  }
  return labels;
}

function RulesEditor({
  rules,
  onChange,
}: {
  rules: Rules;
  onChange: (r: Rules) => void;
}) {
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [helpKey, setHelpKey] = useState<string | null>(null);
  const get = (k: string) => (rules as unknown as Record<string, unknown>)[k];
  const set = (k: string, v: unknown) =>
    onChange({ ...rules, [k]: v } as Rules);
  const cat = RULE_PANELS.find((c) => c.id === openCat) ?? null;

  const onOffBtn = (active: boolean) =>
    `px-3 py-1.5 rounded-md border font-extrabold text-[13px] transition-transform active:translate-y-0.5 ${
      active
        ? "border-[#ffe9a8] bg-gradient-to-b from-[#6fe05a] to-[#2f9e2f] text-[#ffe9a8] shadow-[inset_0_2px_3px_rgba(255,255,255,0.55),0_0_10px_rgba(111,224,90,0.45)]"
        : "border-[#c9a86a]/35 bg-[#173d2a] text-white/45"
    }`;
  const chipBtn = (active: boolean) =>
    `px-2.5 py-1.5 rounded-md border font-extrabold text-[13px] transition-transform active:translate-y-0.5 ${
      active
        ? "border-[#ffe9a8] bg-gradient-to-b from-[#6fe05a] to-[#2f9e2f] text-[#ffe9a8] shadow-[inset_0_2px_3px_rgba(255,255,255,0.55),0_0_10px_rgba(111,224,90,0.45)]"
        : "border-[#c9a86a]/35 bg-[#173d2a] text-white/50"
    }`;

  return (
    <div>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="ルールのカテゴリ">
        {RULE_PANELS.map((c) => {
          const on = c.masterKey
            ? get(c.masterKey) === true
            : c.items.some((i) => i.kind === "bool" && get(i.key) === true);
          const selected = openCat === c.id;
          return (
            <button
              key={c.id}
              type="button"
              aria-label={`カテゴリ ${c.title} の詳細設定`}
              aria-expanded={selected}
              onClick={() => {
                setOpenCat(selected ? null : c.id);
                setHelpKey(null);
              }}
              className={`rounded-lg border-2 px-1 py-3 font-extrabold text-sm transition-transform active:translate-y-0.5 ${
                selected
                  ? "border-[#ffe9a8] bg-gradient-to-b from-[#3fae4a] to-[#1e7a2e] text-[#ffe9a8] shadow-[0_0_14px_rgba(111,224,90,0.5),inset_0_2px_3px_rgba(255,255,255,0.4)]"
                  : on
                    ? "border-[#c9a86a] bg-[#125239] text-[#ffe9a8] shadow-[inset_0_0_10px_rgba(0,0,0,0.35)]"
                    : "border-[#c9a86a]/40 bg-[#0a2e20] text-white/50"
              }`}
            >
              {c.title}
            </button>
          );
        })}
        <button
          type="button"
          aria-label="初期化（ルールを最初の設定に戻す）"
          onClick={() => onChange({ ...DEFAULT_RULES })}
          className="rounded-lg border-2 border-[#c9a86a]/50 bg-[#0a2e20] px-1 py-3 font-extrabold text-sm text-[#ff9d7a] transition-transform active:translate-y-0.5"
        >
          初期化
        </button>
      </div>

      {cat && (
        <div className="gold-frame panel-in mt-3 rounded-2xl bg-[#0d4430] p-3">
          <p className="gold-text font-extrabold text-lg mb-2">{cat.title}の設定</p>
          <div className="space-y-2">
            {cat.items.map((item) => {
              const value = get(item.key);
              return (
                <div key={item.key} className="rounded-lg border border-[#c9a86a]/45 bg-[#0a3524] px-2.5 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`${item.label}の説明`}
                      aria-expanded={helpKey === item.key}
                      onClick={() => setHelpKey(helpKey === item.key ? null : item.key)}
                      className="icon-orb w-7 h-7 rounded-md flex-none flex items-center justify-center text-xs font-extrabold"
                      style={{ minHeight: 0 }}
                    >
                      ?
                    </button>
                    <span className="flex-1 min-w-0 font-extrabold text-sm text-[var(--text)]">
                      {item.label}
                      {item.uiOnly && (
                        <span className="ml-1.5 rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] font-bold text-white/75">
                          設定のみ
                        </span>
                      )}
                    </span>
                    {item.kind === "bool" ? (
                      <span className="flex gap-1 flex-none">
                        <button
                          type="button"
                          aria-label={`${item.label} ON`}
                          aria-pressed={value === true}
                          onClick={() => set(item.key, true)}
                          className={onOffBtn(value === true)}
                          style={{ minHeight: 0 }}
                        >
                          ON
                        </button>
                        <button
                          type="button"
                          aria-label={`${item.label} OFF`}
                          aria-pressed={value === false}
                          onClick={() => set(item.key, false)}
                          className={onOffBtn(value === false)}
                          style={{ minHeight: 0 }}
                        >
                          OFF
                        </button>
                      </span>
                    ) : (
                      <span className="flex gap-1 flex-wrap justify-end">
                        {item.options.map((o) => {
                          const active =
                            item.kind === "number" ? value === o.value : value === o.value;
                          return (
                            <button
                              key={String(o.value)}
                              type="button"
                              aria-label={`${item.label} ${o.label}`}
                              aria-pressed={active}
                              onClick={() => set(item.key, o.value)}
                              className={chipBtn(active)}
                              style={{ minHeight: 0 }}
                            >
                              {o.label}
                            </button>
                          );
                        })}
                      </span>
                    )}
                  </div>
                  {helpKey === item.key && (
                    <p className="mt-1.5 text-xs leading-4 text-[var(--dim)]">{item.desc}</p>
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setOpenCat(null)}
            className="btn-orange mt-3 w-full rounded-xl font-extrabold py-2.5"
          >
            もどる
          </button>
        </div>
      )}
    </div>
  );
}

function CountPicker({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const options = [];
  for (let v = min; v <= max; v++) options.push(v);
  return (
    <div>
      <p className="text-sm font-bold text-[var(--text)] mb-2">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {options.map((v) => (
          <button
            key={v}
            type="button"
            aria-label={`${label} ${v}`}
            aria-pressed={v === value}
            onClick={() => onChange(v)}
            className={`w-11 h-11 rounded-full font-extrabold text-base ${
              v === value
                ? "bg-[#ffd34d] text-[#4a3205] shadow"
                : "bg-[var(--surface)] text-[var(--text)] border border-[var(--border)]"
            }`}
            style={{ minHeight: 0 }}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

function NameField({
  name,
  onChange,
}: {
  name: string;
  onChange: (n: string) => void;
}) {
  return (
    <div>
      <label htmlFor="player-name" className="text-sm font-bold text-[var(--text)] block mb-2">
        あなたの名前
      </label>
      <input
        id="player-name"
        value={name}
        onChange={(e) => onChange(e.target.value.slice(0, 12))}
        placeholder="なまえ"
        className="w-full rounded-xl bg-[var(--surface)] border border-[var(--border)] px-4 py-3 text-[var(--text)] font-bold placeholder:text-[var(--dim)]"
      />
    </div>
  );
}

/** Points for one game: last place 1 point, +1 per rank up, 1st place = player count. */
function pointsForRank(finishRank: number, total: number): number {
  return total - finishRank + 1;
}

interface ScoreRow {
  id: string;
  name: string;
  finishRank: number;
  points: number;
  total: number;
}

/** 1ゲーム分の最終順位の記録（対戦終了画面の「ゲームごとの順位」用）。 */
interface GameHistoryRecord {
  gameNo: number;
  entries: { id: string; name: string; finishRank: number; points: number }[];
}

/** One-line running totals shown during play. */
/** 「ホーム画面に追加」の案内。対応ブラウザでは実際のインストールボタンも出す。 */
function InstallGuide() {
  const [standalone] = useState(isStandalone);
  const [canPrompt, setCanPrompt] = useState(
    () => typeof window !== "undefined" && !!window.__dfInstallPrompt,
  );
  useEffect(() => {
    const check = () => setCanPrompt(!!window.__dfInstallPrompt);
    window.addEventListener("df-install-ready", check);
    return () => window.removeEventListener("df-install-ready", check);
  }, []);
  if (standalone) return null;
  return (
    <section className="gold-frame mt-6 max-w-lg mx-auto rounded-2xl bg-[var(--surface)] p-5">
      <h2 className="gold-text text-base font-extrabold">
        アプリのように使う（ホーム画面に追加）
      </h2>
      <p className="mt-1.5 text-sm font-bold text-[var(--dim)] leading-6">
        ホーム画面に追加すると、アイコンから全画面で起動できます。
      </p>
      {canPrompt && (
        <button
          type="button"
          className="btn-orange mt-3 w-full rounded-[var(--radius)] px-4 py-2.5 font-extrabold"
          onClick={async () => {
            const p = window.__dfInstallPrompt;
            if (!p) return;
            await p.prompt();
            window.__dfInstallPrompt = null;
            setCanPrompt(false);
          }}
        >
          アプリをインストール
        </button>
      )}
      <ul className="mt-3 space-y-1.5 text-sm font-bold text-[var(--text)] leading-6">
        <li>iPhone：Safariで開いて「共有」→「ホーム画面に追加」</li>
        <li>Android：Chromeのメニュー「︙」→「アプリをインストール」または「ホーム画面に追加」</li>
      </ul>
    </section>
  );
}

function ScoreStrip({
  gameNo,
  entries,
}: {
  gameNo: number;
  entries: { id: string; name: string; total: number }[];
}) {
  const sorted = [...entries].sort((a, b) => b.total - a.total);
  return (
    <p className="shrink-0 truncate px-3 text-center text-[10px] font-bold leading-4 text-white/85 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
      第{gameNo}ゲーム ｜ 合計 {sorted.map((e) => `${e.name} ${e.total}点`).join(" ・ ")}
    </p>
  );
}

function ResultsPanel({
  gameNo,
  rows,
  total,
  children,
}: {
  gameNo: number;
  rows: ScoreRow[];
  total: number;
  children?: React.ReactNode;
}) {
  const sorted = [...rows].sort((a, b) => a.finishRank - b.finishRank);
  return (
    <div className="gold-frame mx-3 mb-2 rounded-2xl bg-[#07331a]/95 p-4 shadow-xl min-h-0 overflow-y-auto">
      <h2 className="text-center text-xl font-extrabold text-[#ffe9a8]">
        第{gameNo}ゲームの結果
      </h2>
      <ol className="mt-3 space-y-2">
        {sorted.map((p, i) => (
          <li
            key={p.id}
            className="result-row flex items-center justify-between gap-2 rounded-xl bg-white/10 px-3.5 py-2"
            style={{ animationDelay: `${i * 140}ms` }}
          >
            <span className="font-extrabold text-white whitespace-nowrap">
              {p.finishRank}位 {p.name}
            </span>
            <span
              className={`text-sm font-extrabold whitespace-nowrap ${
                p.finishRank === 1
                  ? "text-[#ffd34d]"
                  : p.finishRank === total
                    ? "text-[#ff9d7a]"
                    : "text-white/70"
              }`}
            >
              {rankLabel(p.finishRank, total)}
            </span>
            <span className="text-sm font-extrabold text-[#8fe0a8] whitespace-nowrap">
              +{p.points}点
            </span>
            <span className="text-sm font-extrabold text-white whitespace-nowrap">
              合計{p.total}点
            </span>
          </li>
        ))}
      </ol>
      {children}
    </div>
  );
}

/** Final standings after 「対戦を終了する」: totals ranked, champion announced. */
function FinalResults({
  gameNo,
  entries,
  gameHistory,
  children,
}: {
  gameNo: number;
  entries: { id: string; name: string; total: number }[];
  gameHistory?: GameHistoryRecord[];
  children?: React.ReactNode;
}) {
  const sorted = [...entries].sort((a, b) => b.total - a.total);
  const top = sorted[0];
  const champions = top ? sorted.filter((e) => e.total === top.total) : [];
  return (
    <div className="gold-frame mx-3 mb-2 rounded-2xl bg-[#07331a]/95 p-4 shadow-xl min-h-0 overflow-y-auto">
      <h2 className="text-center text-xl font-extrabold text-[#ffe9a8]">最終結果</h2>
      <p className="mt-1 text-center text-xs font-bold text-white/75">
        全{gameNo}ゲームの合計点です
      </p>
      {top && (
        <p className="mt-3 text-center text-lg font-extrabold text-[#ffd34d]">
          総合優勝：{champions.map((c) => c.name).join("・")}さん（{top.total}点）
        </p>
      )}
      <ol className="mt-3 space-y-2">
        {sorted.map((e, i) => (
          <li
            key={e.id}
            className={`result-row flex items-center justify-between rounded-xl px-4 py-2.5 ${
              i === 0 ? "bg-[#ffd34d]/25 border border-[#ffd34d]/60" : "bg-white/10"
            }`}
            style={{ animationDelay: `${i * 140}ms` }}
          >
            <span className="font-extrabold text-white">
              {i + 1}位 {e.name}
            </span>
            <span className="font-extrabold text-white">{e.total}点</span>
          </li>
        ))}
      </ol>
      {gameHistory && gameHistory.length > 0 && (
        <div className="mt-5">
          <h3 className="text-center text-base font-extrabold text-[#ffe9a8]">
            ゲームごとの順位
          </h3>
          <div className="mt-2 max-h-60 space-y-3 overflow-y-auto pr-1">
            {[...gameHistory]
              .sort((a, b) => a.gameNo - b.gameNo)
              .map((g) => (
                <div key={g.gameNo} className="rounded-xl bg-white/5 px-3 py-2.5">
                  <p className="text-sm font-extrabold text-white/85">
                    第{g.gameNo}ゲーム
                  </p>
                  <ol className="mt-1.5 space-y-1">
                    {[...g.entries]
                      .sort((a, b) => a.finishRank - b.finishRank)
                      .map((e) => (
                        <li
                          key={e.id}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="whitespace-nowrap font-bold text-white">
                            {e.finishRank}位 {e.name}
                          </span>
                          <span className="whitespace-nowrap text-xs font-bold text-white/60">
                            {rankLabel(e.finishRank, g.entries.length)}
                          </span>
                          <span className="whitespace-nowrap font-extrabold text-[#8fe0a8]">
                            +{e.points}点
                          </span>
                        </li>
                      ))}
                  </ol>
                </div>
              ))}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

// ---------- local game (CPU / pass-and-play) ----------

function LocalGame({
  roster,
  rules,
  onExit,
  avatarMap,
}: {
  roster: { id: string; name: string; isBot: boolean }[];
  rules: Rules;
  onExit: () => void;
  avatarMap?: Record<string, string>;
}) {
  const [game, setGame] = useState<GameState>(() => createGame(roster, rules));
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [gameHistory, setGameHistory] = useState<GameHistoryRecord[]>([]);
  const [gameNo, setGameNo] = useState(1);
  const [matchEnded, setMatchEnded] = useState(false);
  const scoredRef = useRef(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [chosenRank, setChosenRank] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [dealNonce, setDealNonce] = useState(0);
  // 席替えイントロ用：前ゲームの席順（次のゲーム開始時に useDealing へ渡す）
  const prevOrderRef = useRef<string[] | null>(null);
  // Boardの順次表示が最新の状態に追いついているか。追いつくまでは
  // 結果表示・手札の発光・持ち時間タイマーを開始しない。
  const [revealCaughtUp, setRevealCaughtUp] = useState(true);
  // 表示キューに追いついた革命状態（場のフェルトの色はこちらで切り替える）
  const [dispRev, setDispRev] = useState(false);
  // あがり演出が表示待ち・表示中の間は結果表示への切り替えを待つ
  const [finishFxBusy, setFinishFxBusy] = useState(false);

  const current = game.players[game.current]!;
  const pending = game.pending;
  const pendingPlayer = pending
    ? game.players.find((p) => p.id === pending.playerId)
    : undefined;
  const exStep = game.exchange
    ? game.exchange.mode === "order"
      ? game.exchange.steps[game.exchange.index]
      : game.exchange.steps.find((s) => exchangeDecider(s) !== null)
    : undefined;
  const exDeciderId = exStep ? exchangeDecider(exStep) : null;
  const exDecider = exDeciderId
    ? game.players.find((p) => p.id === exDeciderId)
    : undefined;
  const exRole: "give" | "back" | null = exStep
    ? exStep.giveIds == null
      ? "give"
      : "back"
    : null;
  const isBotTurn =
    game.status === "playing" &&
    ((game.exchange == null &&
      pending == null &&
      (current.isBot || current.finishRank !== null)) ||
      (pending != null && pendingPlayer?.isBot === true) ||
      (game.exchange != null && exDecider?.isBot === true));

  // 配札アニメーション（ゲーム開始時のみ。参加者・枚数は開始時点を固定）
  const dealViewerId = roster[0]?.id ?? "";
  const deal = useDealing(
    `local-${gameNo}-${dealNonce}`,
    roster,
    dealViewerId,
    game.players.find((p) => p.id === dealViewerId)?.hand.length ?? 0,
    game.status === "playing" && game.history.length === 0,
    {
      orderIds: game.players.map((p) => p.id),
      prevOrder: prevOrderRef.current,
      enabled: rules.seatShuffle === "random" && gameNo >= 2,
    },
  );

  // Bot turns (including bot pending actions and bot card exchange)
  useEffect(() => {
    if (!isBotTurn || deal.active || deal.shufflePhase) return;
    const t = setTimeout(() => {
      setGame((prev) => {
        if (prev.status !== "playing") return prev;
        const next = structuredClone(prev) as GameState;
        if (next.exchange) {
          advanceExchange(next, rules);
          return next;
        }
        if (next.pending) {
          botResolvePending(next, rules);
          return next;
        }
        // 上がった人が手番に残っていたら次へ進める（固まり防止）
        if (ensureActiveCurrent(next)) return next;
        const cur = next.players[next.current]!;
        if (!cur.isBot) return next;
        const play = aiChoosePlay(next, rules, next.current);
        if (play) {
          const res = applyPlay(next, rules, next.current, play.map((c) => c.id));
          if (!res.ok) applyPass(next, next.current, rules);
        } else {
          applyPass(next, next.current, rules);
        }
        return next;
      });
      setTick((v) => v + 1);
    }, 950);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, isBotTurn, deal.active, deal.shufflePhase]);

  // 得点: ゲームが終わったら一度だけ、そのゲームの点数を合計へ加算。
  // ただし結果表示と同じく、順次表示が最後の手まで追いついてから加算する
  // （残りがCPU同士でも、対局を最後まで見てから合計点が動くように）。
  useEffect(() => {
    if (game.status !== "finished" || !revealCaughtUp || scoredRef.current >= gameNo) return;
    scoredRef.current = gameNo;
    const total = game.players.length;
    setTotals((prev) => {
      const next = { ...prev };
      for (const p of game.players) {
        if (p.finishRank !== null) {
          next[p.id] = (next[p.id] ?? 0) + pointsForRank(p.finishRank, total);
        }
      }
      return next;
    });
    // このゲームの最終順位を履歴へ一度だけ記録（対戦終了画面用）
    setGameHistory((prev) => {
      if (prev.some((g) => g.gameNo === gameNo)) return prev;
      return [
        ...prev,
        {
          gameNo,
          entries: game.players
            .filter((p) => p.finishRank !== null)
            .map((p) => ({
              id: p.id,
              name: p.name,
              finishRank: p.finishRank!,
              points: pointsForRank(p.finishRank!, total),
            }))
            .sort((a, b) => a.finishRank - b.finishRank),
        },
      ];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.status, gameNo, revealCaughtUp]);

  const myTurnHuman = !current.isBot && game.status === "playing" && !pending;

  const doPlay = (revolution?: boolean) => {
    if (selected.length === 0) return;
    const next = structuredClone(game) as GameState;
    const res = applyPlay(next, rules, next.current, selected, { revolution });
    if (!res.ok) {
      setError(res.reason);
      return;
    }
    setError("");
    setSelected([]);
    setChosenRank(null);
    setGame(next);
  };

  const doPass = () => {
    const next = structuredClone(game) as GameState;
    const res = applyPass(next, next.current, rules);
    if (!res.ok) {
      setError(res.reason);
      return;
    }
    setError("");
    setSelected([]);
    setGame(next);
  };

  const doResolve = () => {
    if (!pending) return;
    const idx = game.players.findIndex((p) => p.id === pending.playerId);
    if (idx < 0) return;
    const next = structuredClone(game) as GameState;
    const res = resolvePendingEngine(next, rules, idx, {
      cardIds: pending.type === "qBomber" ? [] : selected,
      rank: pending.type === "qBomber" ? (chosenRank ?? undefined) : undefined,
    });
    if (!res.ok) {
      setError(res.reason);
      return;
    }
    setError("");
    setSelected([]);
    setChosenRank(null);
    setGame(next);
  };

  /** 4止め: 止める（4を必要枚数出す）/ 止めない（8切り成立）。 */
  const doResolveFourStop = (stop: boolean) => {
    if (!pending || pending.type !== "fourStop") return;
    const idx = game.players.findIndex((p) => p.id === pending.playerId);
    if (idx < 0) return;
    const holder = game.players[idx]!;
    const fours = holder.hand.filter((c) => c.rank === 4 && c.suit !== "J");
    const next = structuredClone(game) as GameState;
    const res = resolvePendingEngine(next, rules, idx, {
      cardIds: stop ? fours.slice(0, pending.maxCount).map((c) => c.id) : [],
    });
    if (!res.ok) {
      setError(res.reason);
      return;
    }
    setError("");
    setSelected([]);
    setGame(next);
  };

  /** カード交換: 選んだカードを提出する（献上側・お返し側共通。ids省略時は現在の選択）。 */
  const doExchange = (ids?: string[]) => {
    if (!game.exchange || !exStep || !exDeciderId) return;
    const next = structuredClone(game) as GameState;
    const res = resolveExchange(next, rules, exDeciderId, ids ?? selected);
    if (!res.ok) {
      setError(res.reason);
      return;
    }
    setError("");
    setSelected([]);
    setGame(next);
  };

  const toggle = (id: string) => {
    // 献上確認で「貧民のカード選択」OFFのときは、渡すカードは最強カードで固定
    if (!pending && game.exchange && exRole === "give" && !rules.exchangeChoice)
      return;
    setError("");
    setSelected((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      // 通常の「出すカード」選択では、金色に光っている（出せる）カードだけ
      // 選べる。光っていないカードはタップしても反応しない（選択解除は常に可）。
      // カード交換・7渡し等の選択は従来どおり対象範囲で選べる。
      if (!pending && !game.exchange && !(playableIds?.has(id) ?? false))
        return s;
      if (
        pending &&
        pending.type !== "qBomber" &&
        pending.type !== "fourStop" &&
        s.length >= pending.maxCount
      )
        return s;
      if (!pending && game.exchange && exStep && s.length >= exStep.count) return s;
      return [...s, id];
    });
  };

  const selectionCheck = useMemo(() => {
    if (selected.length === 0 || !myTurnHuman || pending || game.exchange) return null;
    const cards = current.hand.filter((c) => selected.includes(c.id));
    return canPlay(game, rules, cards);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, game]);

  const players: BoardPlayer[] = game.players.map((p) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    cardCount: p.hand.length,
    finishRank: p.finishRank,
    avatar: avatarMap?.[p.id] ?? null,
  }));

  const viewerId = roster[0]?.id ?? "";
  const viewer = game.players.find((p) => p.id === viewerId) ?? current;
  // 席替えイントロの前半は前ゲームの並びで席番号を出す（相手席と揃える）
  const viewerSeatNo =
    (deal.displayOrder
      ? deal.displayOrder.indexOf(viewerId)
      : game.players.findIndex((p) => p.id === viewerId)) + 1;
  const ownerName = game.field
    ? (game.players.find((p) => p.id === game.field!.ownerId)?.name ?? null)
    : null;
  const pendingIsMine =
    pending != null &&
    pendingPlayer?.isBot === false &&
    pending.playerId === viewerId;

  const exchangeMine =
    !!exStep &&
    !!exDecider &&
    !exDecider.isBot &&
    exDeciderId === viewerId;

  // 献上確認（人間の貧民・大貧民）: まず配られた手札を全部見せたうえで、
  // 渡すカード（初期選択は最強カード。「Jokerを交換しない」ONならジョーカー
  // を除いた最強）を金色に光らせ、本人が「カード交換する」を押すまで交換しない。
  // 「貧民のカード選択」ONなら光っている初期選択をタップで変更できる。
  const exGiveMine = exchangeMine && exRole === "give";
  const exGiveKey =
    exGiveMine && exStep && exDecider
      ? `${gameNo}:${exStep.giverId}->${exStep.receiverId}:${exStep.count}`
      : null;
  const exGiveInitRef = useRef<string | null>(null);
  useEffect(() => {
    if (!exGiveKey || !exStep || !exDecider) return;
    if (exGiveInitRef.current === exGiveKey) return;
    exGiveInitRef.current = exGiveKey;
    const auto = strongestGiveCards(
      exDecider.hand,
      exStep.count,
      rules.exchangeNoJoker,
    );
    setSelected(auto.map((c) => c.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exGiveKey]);
  const exGiveGlowIds = useMemo(
    () => (exGiveMine ? new Set(selected) : null),
    [exGiveMine, selected],
  );
  const exGiveLabels =
    exGiveMine && exDecider
      ? exDecider.hand
          .filter((c) => selected.includes(c.id))
          .map(cardLabel)
          .join(" ")
      : null;

  // 革命選択: 選んだカードが革命を起こせるとき、出す前に選ばせる
  const revTrigger =
    rules.revolutionChoice &&
    myTurnHuman &&
    selected.length > 0 &&
    !(rules.revolutionReturn === "none" && game.revolution) &&
    checkRevolutionTrigger(
      rules,
      current.hand.filter((c) => selected.includes(c.id)),
      game.omen,
    );

  // リードパス: 場が空でも、出せる手が1つもないとき（最後の1枚が禁止あがり
  // 対象など）はパスしてリード権を次へ渡せる
  const canLeadPass =
    myTurnHuman &&
    !game.field &&
    legalSets(game, rules, game.current).every((s) =>
      isForbiddenFinishPlay(rules, current.hand.length, s),
    );

  // 自分の手番のとき、出せるカードを光らせる（組・階段の一部になれるカードも含む。
  // 判定はエンジンの合法手と一致させ、禁止あがりになる手は出せない扱い）。
  // ただし発光・減光は、Boardの順次表示が自分の手番まで追いついてから開始する
  // （CPUの手を表示している間は、論理的に自分の番でも光らせない）。
  const playableIds = useMemo(() => {
    if (
      !myTurnHuman ||
      pending ||
      game.exchange ||
      viewer.id !== current.id ||
      !revealCaughtUp
    ) {
      return null;
    }
    const sets = legalSets(game, rules, game.current).filter(
      (s) => !isForbiddenFinishPlay(rules, current.hand.length, s),
    );
    return new Set(sets.flatMap((s) => s.map((c) => c.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, rules, revealCaughtUp]);

  // 自分の手番の強調: 表示キューが追いつき、配札も終わって、実際に
  // 入力できるようになった瞬間だけを「自分の番」とする（再生途中で先行しない）。
  const myTurnActive =
    game.status === "playing" &&
    !game.exchange &&
    !pending &&
    myTurnHuman &&
    viewer.id === current.id &&
    revealCaughtUp &&
    !deal.active &&
    !deal.shufflePhase;
  const myTurnNotice = useMyTurnNotice(myTurnActive);

  // 持ち時間タイマー: 時間切れで状況に応じた自動処理（詰まらない形に）
  const timerActive =
    game.status === "playing" &&
    !matchEnded &&
    !deal.active &&
    !deal.shufflePhase &&
    revealCaughtUp &&
    (myTurnHuman || pendingIsMine || exchangeMine);
  const timeLeft = useTurnTimer(
    rules.timeLimit,
    [
      gameNo,
      game.status,
      game.current,
      pending?.type ?? "",
      pending?.playerId ?? "",
      game.exchange
        ? `${game.exchange.index}:${game.exchange.steps.map((s) => `${s.giveIds ? 1 : 0}${s.backIds ? 1 : 0}`).join(",")}`
        : "",
      game.history.length,
      game.passed.length,
      game.field?.ownerId ?? "",
    ].join("|"),
    timerActive,
    () => {
      if (game.exchange && exchangeMine && exStep && exDecider) {
        // 未選択のまま時間切れ → 献上側は最強カードが自動で、お返し側は最も弱いカードが自動で選ばれる
        const auto =
          exRole === "back"
            ? weakestGiveCards(exDecider.hand, exStep.count, rules.exchangeNoJoker)
            : strongestGiveCards(exDecider.hand, exStep.count, rules.exchangeNoJoker);
        doExchange(auto.map((c) => c.id));
        return;
      }
      if (pending && pendingIsMine) {
        const next = structuredClone(game) as GameState;
        if (botResolvePending(next, rules)) {
          setSelected([]);
          setChosenRank(null);
          setGame(next);
        }
        return;
      }
      if (myTurnHuman) {
        if (game.field) {
          doPass();
        } else {
          // 親でパスできないときは、自動で1手出して詰まらないようにする
          const play = aiChoosePlay(game, rules, game.current);
          if (play) {
            const next = structuredClone(game) as GameState;
            const res = applyPlay(next, rules, next.current, play.map((c) => c.id));
            if (res.ok) {
              setSelected([]);
              setGame(next);
            }
          } else {
            // 出せる手が1つもない場合はリードパスで次へ渡す
            doPass();
          }
        }
      }
    },
  );

  const restart = () => {
    setDispRev(false); // 次ゲームは緑から始める
    // 席替えイントロ用に、いま終わったゲームの席順を覚えておく
    prevOrderRef.current = game.players.map((p) => p.id);
    const ranks: Record<string, number> = {};
    for (const p of game.players) {
      if (p.finishRank !== null) ranks[p.id] = p.finishRank;
    }
    setGame(
      createGame(roster, rules, {
        winnerId: game.finishOrder[0] ?? null,
        ranks,
        // リアリティ配り用：前ゲームの捨て札の並びを土台にする
        discardGroups: discardGroupsFromHistory(game),
      }),
    );
    setGameNo((n) => n + 1);
    setSelected([]);
    setError("");
    setChosenRank(null);
    exGiveInitRef.current = null;
  };

  const resetMatch = () => {
    setDispRev(false);
    prevOrderRef.current = null;
    setTotals({});
    setGameHistory([]);
    setGameNo(1);
    setDealNonce((n) => n + 1);
    setMatchEnded(false);
    scoredRef.current = 0;
    setGame(createGame(roster, rules));
    setSelected([]);
    setError("");
    setChosenRank(null);
    exGiveInitRef.current = null;
  };

  const statusText =
    game.status === "finished"
      ? revealCaughtUp
        ? "対局終了"
        : "対局終了 — 最後の手まで表示しています…"
      : game.exchange
        ? exRole === "give"
          ? `カード交換中：${exDecider?.name ?? ""}さんが渡すカードを確認しています`
          : `カード交換中：${exDecider?.name ?? ""}さんが渡すカードを選んでいます`
        : pending
          ? `${pendingPlayer?.name ?? ""}さんが${PENDING_LABEL[pending.type]}中…`
          : current.isBot
            ? `${current.name}の番…`
            : "あなたの番です";

  return (
    <GameScreen
      statusText={statusText}
      exitLabel="やめる"
      onExit={onExit}
      rules={rules}
      revolution={dispRev}
      myTurn={myTurnActive}
      showMyTurnBanner={myTurnNotice.showBanner}
      myTurnBannerSeq={myTurnNotice.seq}
    >
      <ScoreStrip
        gameNo={gameNo}
        entries={game.players.map((p) => ({
          id: p.id,
          name: p.name,
          total: totals[p.id] ?? 0,
        }))}
      />
      <DealOverlay deal={deal} />
      <SeatShuffleBanner deal={deal} />
      <Board
        players={players}
        viewerId={viewerId}
        currentPlayerId={
          deal.shufflePhase
            ? null
            : game.status === "playing"
              ? (pending?.playerId ?? current.id)
              : null
        }
        passedIds={game.passed}
        fieldCards={game.field?.cards ?? null}
        ownerName={ownerName}
        revolution={game.revolution}
        backActive={game.backActive}
        lockSuit={game.lockSuit}
        numberLockNext={
          game.numberLock && game.field
            ? game.field.rank + (game.revolution !== game.backActive ? -1 : 1)
            : null
        }
        direction={game.direction}
        history={game.history}
        log={game.log}
        rules={rules}
        onRevealSync={setRevealCaughtUp}
        onDisplayedRevolution={setDispRev}
        onFinishFxBusy={setFinishFxBusy}
        holdReveal={deal.active || !!deal.shufflePhase}
        exchangeActive={!!game.exchange}
        seatFx={deal.shufflePhase}
        displayOrder={deal.displayOrder}
      />

      {matchEnded ? (
        <FinalResults
          gameNo={gameNo}
          entries={game.players.map((p) => ({
            id: p.id,
            name: p.name,
            total: totals[p.id] ?? 0,
          }))}
          gameHistory={gameHistory}
        >
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={resetMatch}
              className="btn-orange flex-1 rounded-xl font-extrabold py-3"
            >
              最初から対戦する
            </button>
            <button
              type="button"
              onClick={onExit}
              className="flex-1 rounded-xl bg-white/10 border border-white/40 text-white font-extrabold py-3"
            >
              ホームへ
            </button>
          </div>
        </FinalResults>
      ) : game.status === "finished" && revealCaughtUp && !finishFxBusy ? (
        <ResultsPanel
          gameNo={gameNo}
          total={game.players.length}
          rows={game.players
            .filter((p) => p.finishRank !== null)
            .map((p) => ({
              id: p.id,
              name: p.name,
              finishRank: p.finishRank!,
              points: pointsForRank(p.finishRank!, game.players.length),
              total: totals[p.id] ?? 0,
            }))}
        >
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={restart}
              className="btn-orange flex-1 rounded-xl font-extrabold py-3"
            >
              次のゲームへ
            </button>
            <button
              type="button"
              onClick={() => setMatchEnded(true)}
              className="flex-1 rounded-xl bg-white/10 border border-white/40 text-white font-extrabold py-3"
            >
              対戦を終了する
            </button>
          </div>
        </ResultsPanel>
      ) : (
        <div className="relative">
          <div className="absolute left-2 -top-1 z-20" data-seat-player={viewerId}>
            <SeatFrame
              player={
                players.find((p) => p.id === viewerId) ?? {
                  id: viewer.id,
                  name: viewer.name,
                  isBot: viewer.isBot,
                  cardCount: viewer.hand.length,
                  finishRank: viewer.finishRank,
                }
              }
              seatNo={viewerSeatNo}
              isTurn={current.id === viewerId && !pending && revealCaughtUp && !deal.active}
              glow={
                current.id === viewerId &&
                !pending &&
                revealCaughtUp &&
                !deal.active &&
                !deal.shufflePhase &&
                !game.exchange
              }
              fx={deal.shufflePhase}
              passed={game.passed.includes(viewerId)}
              totalPlayers={players.length}
              large
              gauge={
                timeLeft !== null && rules.timeLimit > 0
                  ? timeLeft / rules.timeLimit
                  : null
              }
            />
          </div>
          <div className={`pt-[84px] ${myTurnActive ? "my-turn-hand" : ""}`}>
            <FanHand
              cards={viewer.hand}
              selected={selected}
              playableIds={playableIds}
              glowIds={exGiveGlowIds}
              limit={deal.active || deal.shufflePhase ? deal.viewerDealt : undefined}
              onToggle={
                (myTurnHuman && viewer.id === current.id) ||
                (pendingIsMine &&
                  pending?.type !== "qBomber" &&
                  pending?.type !== "fourStop") ||
                exchangeMine
                  ? toggle
                  : undefined
              }
            />
          </div>
          {game.status === "finished" && !revealCaughtUp && (
            <p className="mx-4 mb-2 rounded-xl bg-black/45 px-3 py-2 text-center text-sm font-extrabold text-[#ffe9a8]">
              対局は終了しました。残りの対局を最後まで表示してから結果を出します
            </p>
          )}
          {error && (
            <p className="mx-4 mt-1 text-center text-sm font-extrabold text-[#ffe1ae] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              {error}
            </p>
          )}
          {selectionCheck && !selectionCheck.ok && selected.length > 0 && (
            <p className="mx-4 mt-1 text-center text-xs font-bold text-white/85 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              {selectionCheck.reason}
            </p>
          )}
          <TurnTimerBadge left={timeLeft} />
          {game.exchange && exStep ? (
            <ExchangePanel
              step={exStep}
              role={exRole ?? "give"}
              isMine={exchangeMine}
              deciderName={exDecider?.name ?? ""}
              otherName={
                game.players.find(
                  (p) =>
                    p.id ===
                    (exRole === "back" ? exStep.giverId : exStep.receiverId),
                )?.name ?? ""
              }
              selectedCount={selected.length}
              onConfirm={() => doExchange()}
              giveLabels={exGiveLabels}
              giveCanChange={rules.exchangeChoice}
            />
          ) : pending ? (
            <PendingPanel
              pending={pending}
              isMine={pendingIsMine && !pendingPlayer?.isBot}
              actorName={pendingPlayer?.name ?? ""}
              selectedCount={selected.length}
              chosenRank={chosenRank}
              onChooseRank={setChosenRank}
              onConfirm={
                pending.type === "fourStop" ? () => doResolveFourStop(true) : doResolve
              }
              onDecline={
                pending.type === "fourStop" ? () => doResolveFourStop(false) : undefined
              }
              exact={
                pending.type === "sevenPass"
                  ? !rules.sevenPassChoice
                  : pending.type === "tenDiscard"
                    ? !rules.tenDiscardChoice
                    : false
              }
            />
          ) : (
            <ActionButtons
              canPass={
                myTurnHuman &&
                viewer.id === current.id &&
                (!!game.field || canLeadPass)
              }
              canPlay={myTurnHuman && selected.length > 0 && viewer.id === current.id}
              selectedCount={selected.length}
              onPass={doPass}
              onPlay={() => doPlay(true)}
              revChoice={revTrigger}
              onPlayNoRev={() => doPlay(false)}
              highlight={myTurnActive}
            />
          )}
        </div>
      )}
    </GameScreen>
  );
}

// ---------- online game ----------

type RoomView = ApiResponse<typeof api, "getRoom">;

/** オンラインビューからローカル用GameStateの近似を作る（自分の手札だけ実物）。
 * 持ち時間切れ時の自動手や合法手チェックに使う。 */
function viewAsState(view: RoomView, playerId: string): GameState {
  let field: GameState["field"] = null;
  if (view.field) {
    const cards = view.field.cards;
    const r = setRank(cards);
    const s = sequenceInfo(cards) ?? emperorInfo(cards);
    field = {
      cards,
      ownerId: view.field.ownerId,
      rank: r ?? s?.top ?? 20,
      kind: r !== null ? "normal" : "sequence",
      suit: setSuit(cards) ?? sequenceInfo(cards)?.suit ?? null,
      low: s?.low ?? r ?? 20,
      actualTop: s?.actualTop ?? r ?? 20,
    };
  }
  return {
    players: view.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      hand: p.id === playerId ? view.myHand : [],
      finishRank: p.finishRank,
    })),
    field,
    current: Math.max(
      0,
      view.players.findIndex((p) => p.id === view.currentPlayerId),
    ),
    revolution: view.revolution,
    backActive: view.backActive,
    direction: view.direction === -1 ? -1 : 1,
    lockSuit: view.lockSuit as GameState["lockSuit"],
    numberLock: view.numberLock,
    passed: view.passedIds,
    finishOrder: view.finishOrder,
    status: view.status === "finished" ? "finished" : "playing",
    log: view.log,
    lastPlayBy: null,
    history: view.history.map((h) => ({ ...h })),
    pending: null,
    exchange: null,
    prevChampionId: null,
    prevRanks: null,
    prevLastId: null,
    suitStreak: 0,
    suitStreakSuit: null,
    strongBack: false,
    omen: view.omen,
  };
}

type ChatMsg = {
  id: string;
  playerId: string;
  name: string;
  text: string;
  at: number;
};

/** 部屋チャットのシート。開いている間も対局は止めない（表示だけの重ね表示）。 */
function ChatSheet({
  messages,
  playerId,
  draft,
  onDraftChange,
  onSend,
  sending,
  onClose,
}: {
  messages: ChatMsg[];
  playerId: string;
  draft: string;
  onDraftChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  onClose: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);
  const fmtTime = (at: number) => {
    const d = new Date(at);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col justify-end"
      role="dialog"
      aria-label="チャット"
    >
      <button
        type="button"
        aria-label="チャットを閉じる"
        className="absolute inset-0 bg-black/55"
        style={{ minHeight: 0 }}
        onClick={onClose}
      />
      <div
        className="panel-in relative mx-auto flex max-h-[74dvh] w-full max-w-lg flex-col rounded-t-3xl border-t-2 border-[#d8b25c] bg-[#07331a] shadow-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <p className="font-extrabold text-[#ffe9a8]">チャット</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="rounded-full bg-white/10 border border-white/30 text-white w-9 h-9 font-extrabold"
            style={{ minHeight: 0 }}
          >
            ×
          </button>
        </div>
        <div
          ref={listRef}
          className="min-h-[160px] flex-1 space-y-2 overflow-y-auto px-3 py-2"
        >
          {messages.length === 0 ? (
            <p className="py-8 text-center text-sm font-bold text-white/60">
              まだメッセージはありません
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.playerId === playerId;
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                >
                  <p className="px-1 text-[11px] font-bold text-white/60">
                    {mine ? "あなた" : m.name}・{fmtTime(m.at)}
                  </p>
                  <p
                    className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm font-bold ${
                      mine
                        ? "bg-[#ffd34d] text-[#4a3205] rounded-br-md"
                        : "bg-white/12 text-white rounded-bl-md"
                    }`}
                  >
                    {m.text}
                  </p>
                </div>
              );
            })
          )}
        </div>
        <form
          className="flex gap-2 border-t border-white/15 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSend();
          }}
        >
          <input
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            maxLength={200}
            placeholder="メッセージを入力（200文字まで）"
            aria-label="チャットメッセージ"
            className="min-w-0 flex-1 rounded-xl border border-white/25 bg-black/30 px-3 py-2 font-bold text-white placeholder:text-white/40"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="btn-orange flex-none rounded-xl px-5 font-extrabold disabled:opacity-40"
          >
            送信
          </button>
        </form>
      </div>
    </div>
  );
}

function getPlayerId(): string {
  const key = "daifugo-player-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `p-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function OnlineGame({
  initialName,
  initialRules,
  avatar,
  onRulesChange,
  onExit,
}: {
  initialName: string;
  initialRules: Rules;
  avatar: string | null;
  onRulesChange: (r: Rules) => void;
  onExit: () => void;
}) {
  const queryClient = useQueryClient();
  const [playerId] = useState(getPlayerId);
  const [name, setName] = useState(initialName);
  const [rules, setRulesState] = useState<Rules>(() => normalizeRules(initialRules));
  const setRules = (r: Rules) => {
    setRulesState(r);
    onRulesChange(r);
  };
  // 画像のオンライン共有は明示的なオプトイン制: ONにしたときだけ
  // createRoom / joinRoom に画像を載せる（初期値はOFF、選択は端末に記憶）。
  const [shareAvatar, setShareAvatar] = useState<boolean>(() => {
    try {
      return localStorage.getItem("daifugo-avatar-share") === "1";
    } catch {
      return false;
    }
  });
  const updateShareAvatar = (v: boolean) => {
    setShareAvatar(v);
    try {
      localStorage.setItem("daifugo-avatar-share", v ? "1" : "0");
    } catch {
      /* 記憶できなくても今回の選択は有効 */
    }
  };
  const sharedAvatar = shareAvatar && avatar ? avatar : undefined;
  const [code, setCode] = useState<string | null>(() =>
    localStorage.getItem("daifugo-room"),
  );
  const [joinCode, setJoinCode] = useState("");
  const [botCount, setBotCount] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [chosenRank, setChosenRank] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [dealToken, setDealToken] = useState(0);
  // Boardの順次表示が最新の状態に追いついているか。追いつくまでは
  // 結果表示・手札の発光・持ち時間タイマー・合計点の更新を始めない
  // （サーバー側で残りCPUの対局が一気に終わっても、表示は1手ずつ最後まで見せる）。
  const [revealCaughtUp, setRevealCaughtUp] = useState(true);
  // 表示キューに追いついた革命状態（場のフェルトの色はこちらで切り替える）
  const [dispRev, setDispRev] = useState(false);
  // あがり演出が表示待ち・表示中の間は結果表示への切り替えを待つ
  const [finishFxBusy, setFinishFxBusy] = useState(false);
  const [shownScores, setShownScores] = useState<Record<string, number>>({});
  // 部屋チャット（状態同期のポーリングに相乗りして届く。専用ポーリングは増やさない）
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [seenChatId, setSeenChatId] = useState<string | null>(null);

  const room = useQuery({
    queryKey: ["room", code, playerId],
    queryFn: () => api.getRoom({ code: code!, playerId }),
    enabled: !!code,
    // 同期の遅延を減らすため 1800ms → 900ms（半分）。Render無料枠でも
    // 部屋あたり毎秒1回強のリクエストに収まる範囲。
    refetchInterval: 900,
  });
  const view: RoomView | undefined = room.data;

  // チャットの未読数（最後に見たメッセージより後の、他人の発言）
  const chatMessages: ChatMsg[] = view?.chat ?? [];
  const lastChatId =
    chatMessages.length > 0
      ? (chatMessages[chatMessages.length - 1]?.id ?? null)
      : null;
  useEffect(() => {
    if (chatOpen && lastChatId) setSeenChatId(lastChatId);
  }, [chatOpen, lastChatId]);
  const seenChatIdx = seenChatId
    ? chatMessages.findIndex((m) => m.id === seenChatId)
    : -1;
  const unreadChat = chatMessages
    .slice(seenChatIdx + 1)
    .filter((m) => m.playerId !== playerId).length;

  // 端末に保存していた合言葉の部屋が消えていたら（サーバーの再起動などで
  // 消えることがある）、保存だけ先に消しておく。次に開いたときも同じ
  // 「見つかりません」画面に直行しないようにするため。
  const roomMissing = !!view && !view.found;
  useEffect(() => {
    if (!roomMissing) return;
    try {
      localStorage.removeItem("daifugo-room");
    } catch {
      /* ignore */
    }
  }, [roomMissing]);

  // ゲーム開始（lobby/finished → playing）を検知して配札トークンを進める
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!view) return;
    const prev = prevStatusRef.current;
    if (view.status === "playing" && prev !== "playing" && prev !== null) {
      setDealToken((t) => t + 1);
      setDispRev(false); // 次ゲームは緑から始める（Boardの再生が追いつくまで）
    }
    if (view.status === "playing" && prev === null && view.history.length === 0) {
      setDealToken((t) => t + 1);
      setDispRev(false);
    }
    prevStatusRef.current = view.status;
  }, [view?.status, view?.gameNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  // 席替えイントロ用：対局が終わるたびに、そのゲームの席順を覚えておく
  const prevOrderRefOnline = useRef<string[] | null>(null);
  useEffect(() => {
    if (view?.status === "finished") {
      prevOrderRefOnline.current = view.players.map((p) => p.id);
    }
  }, [view?.status, view?.gameNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  const deal = useDealing(
    view ? `online-${view.code}-${dealToken}` : null,
    view?.players ?? [],
    playerId,
    view?.myHand.length ?? 0,
    // CPUが先に動いたゲームでも配札アニメは再生する（履歴が空かどうかは見ない）。
    // 途中参加・再読込では dealToken が上がらないため、従来どおり再生されない。
    !!view && view.status === "playing" && dealToken > 0,
    {
      orderIds: view?.players.map((p) => p.id) ?? [],
      prevOrder: prevOrderRefOnline.current,
      enabled:
        !!view && view.rules.seatShuffle === "random" && view.gameNumber >= 2,
    },
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["room", code, playerId] });

  const create = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await api.createRoom({
        playerId,
        name: name.trim() || "プレイヤー",
        rules,
        avatar: sharedAvatar,
      });
      if (!res.code || res.code.length !== 4) {
        setError("部屋を作れませんでした。もう一度お試しください");
        return;
      }
      localStorage.setItem("daifugo-room", res.code);
      setCode(res.code);
    } catch {
      setError("部屋を作れませんでした。もう一度お試しください");
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    if (joinCode.length !== 4) {
      setError("4桁の合言葉を入力してください");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await api.joinRoom({
        playerId,
        name: name.trim() || "プレイヤー",
        code: joinCode,
        avatar: sharedAvatar,
      });
      if (!res.ok) {
        setError(res.reason);
        return;
      }
      localStorage.setItem("daifugo-room", joinCode);
      setCode(joinCode);
    } catch {
      setError("部屋に入れませんでした。もう一度お試しください");
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (code) {
      try {
        await api.leaveRoom({ code, playerId });
      } catch {
        /* ignore */
      }
    }
    localStorage.removeItem("daifugo-room");
    setCode(null);
    setSelected([]);
    onExit();
  };

  const start = async () => {
    if (!code) return;
    setBusy(true);
    try {
      const res = await api.startGame({ code, playerId, botCount });
      if (!res.ok) setError(res.reason);
      else setError("");
      invalidate();
    } finally {
      setBusy(false);
    }
  };

  const playMut = useMutation({
    mutationFn: async (payload: { cardIds: string[]; revolution?: boolean }) =>
      await api.playCards({ code: code!, playerId, ...payload }),
    onSuccess: (res) => {
      if (!res.ok) setError(res.reason);
      else {
        setError("");
        setSelected([]);
        setChosenRank(null);
      }
      invalidate();
    },
  });
  const passMut = useMutation({
    mutationFn: async () => await api.passTurn({ code: code!, playerId }),
    onSuccess: (res) => {
      if (!res.ok) setError(res.reason);
      else setError("");
      invalidate();
    },
  });
  const pendingMut = useMutation({
    mutationFn: async (payload: { cardIds?: string[]; rank?: number }) =>
      await api.resolvePending({ code: code!, playerId, ...payload }),
    onSuccess: (res) => {
      if (!res.ok) setError(res.reason);
      else {
        setError("");
        setSelected([]);
        setChosenRank(null);
      }
      invalidate();
    },
  });
  const exchangeMut = useMutation({
    mutationFn: async (cardIds: string[]) =>
      await api.submitExchange({ code: code!, playerId, cardIds }),
    onSuccess: (res) => {
      if (!res.ok) setError(res.reason);
      else {
        setError("");
        setSelected([]);
      }
      invalidate();
    },
  });
  const chatMut = useMutation({
    mutationFn: async (text: string) =>
      await api.sendChat({ code: code!, playerId, text }),
    onSuccess: (res) => {
      if (!res.ok) setError(res.reason);
      else setChatDraft("");
      invalidate();
    },
  });
  const sendChat = () => {
    const text = chatDraft.trim();
    if (!text || chatMut.isPending) return;
    chatMut.mutate(text.slice(0, 200));
  };

  // 持ち時間タイマー（自分の手番・受け渡し・交換のときだけ進む）
  const myExStepOnline = (view?.exchange?.pending ?? []).find(
    (s) =>
      (s.giverId === playerId && !s.giveDone) ||
      (s.receiverId === playerId && !s.backDone),
  );
  const myExRoleOnline: "give" | "back" | null = myExStepOnline
    ? myExStepOnline.giverId === playerId && !myExStepOnline.giveDone
      ? "give"
      : "back"
    : null;

  // 献上確認（人間の貧民・大貧民）: 配られた手札を全部見たうえで、渡すカード
  // （初期選択は最強カード。「Jokerを交換しない」ONならジョーカーを除いた
  // 最強）を金色に光らせ、本人が「カード交換する」を押すまで交換しない。
  // 「貧民のカード選択」ONなら光っている初期選択をタップで変更できる。
  // 他のプレイヤーの画面では ExchangePanel が「○○さんの交換を待っています」
  // という待機表示になる。
  const myExGiveOnline = !!myExStepOnline && myExRoleOnline === "give";
  const exGiveKeyOnline =
    myExGiveOnline && view
      ? `${view.gameNumber}:${dealToken}:${myExStepOnline.giverId}->${myExStepOnline.receiverId}:${myExStepOnline.count}`
      : null;
  const exGiveInitRefOnline = useRef<string | null>(null);
  useEffect(() => {
    if (!exGiveKeyOnline || !view || !myExStepOnline) return;
    if (exGiveInitRefOnline.current === exGiveKeyOnline) return;
    exGiveInitRefOnline.current = exGiveKeyOnline;
    const auto = strongestGiveCards(
      view.myHand,
      myExStepOnline.count,
      view.rules.exchangeNoJoker,
    );
    setSelected(auto.map((c) => c.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exGiveKeyOnline]);
  const exGiveGlowIdsOnline = myExGiveOnline ? new Set(selected) : null;
  const exGiveLabelsOnline =
    myExGiveOnline && view
      ? view.myHand
          .filter((c) => selected.includes(c.id))
          .map(cardLabel)
          .join(" ")
      : null;
  const timerActiveOnline =
    !!view &&
    view.status === "playing" &&
    !deal.active &&
    !deal.shufflePhase &&
    revealCaughtUp &&
    ((view.pending != null && view.pending.playerId === playerId) ||
      !!myExStepOnline ||
      (view.pending == null &&
        view.exchange == null &&
        view.currentPlayerId === playerId));
  const timeLeftOnline = useTurnTimer(
    view?.rules.timeLimit ?? 0,
    view
      ? [
          view.gameNumber,
          view.status,
          view.currentPlayerId ?? "",
          view.pending?.type ?? "",
          view.pending?.playerId ?? "",
          (view.exchange?.pending ?? [])
            .map((s) => `${s.giverId}:${s.giveDone ? 1 : 0}${s.backDone ? 1 : 0}`)
            .join(","),
          view.history.length,
          view.passedIds.length,
          view.field?.ownerId ?? "",
        ].join("|")
      : "none",
    timerActiveOnline,
    () => {
      const v = view;
      if (!v || v.status !== "playing") return;
      const myStep = (v.exchange?.pending ?? []).find(
        (s) =>
          (s.giverId === playerId && !s.giveDone) ||
          (s.receiverId === playerId && !s.backDone),
      );
      if (myStep) {
        // 未選択のまま時間切れ → 献上側は最強カードが、お返し側は最も弱いカードが自動で選ばれる
        const isBack = !(myStep.giverId === playerId && !myStep.giveDone);
        const auto = isBack
          ? weakestGiveCards(v.myHand, myStep.count, v.rules.exchangeNoJoker)
          : strongestGiveCards(v.myHand, myStep.count, v.rules.exchangeNoJoker);
        exchangeMut.mutate(auto.map((c) => c.id));
        return;
      }
      const pend = v.pending;
      if (pend && pend.playerId === playerId) {
        if (pend.type === "fourStop") {
          pendingMut.mutate({ cardIds: [] });
          return;
        }
        if (pend.type === "qBomber") {
          let best = 3;
          let bestCount = Infinity;
          for (let r = 3; r <= 15; r++) {
            const n = v.myHand.filter((c) => c.rank === r && c.suit !== "J").length;
            if (n < bestCount) {
              bestCount = n;
              best = r;
            }
          }
          pendingMut.mutate({ rank: best });
          return;
        }
        const choiceOn =
          pend.type === "sevenPass" ? v.rules.sevenPassChoice : v.rules.tenDiscardChoice;
        const count = choiceOn
          ? Math.min(pend.maxCount, Math.max(0, v.myHand.length - 1))
          : pend.maxCount;
        const sorted = [...v.myHand].sort((a, b) =>
          pend.type === "sevenPass" ? a.rank - b.rank : b.rank - a.rank,
        );
        pendingMut.mutate({ cardIds: sorted.slice(0, count).map((c) => c.id) });
        return;
      }
      if (v.currentPlayerId === playerId) {
        if (v.field) {
          passMut.mutate();
        } else {
          const st = viewAsState(v, playerId);
          const play = aiChoosePlay(st, v.rules, st.current);
          if (play) playMut.mutate({ cardIds: play.map((c) => c.id) });
          else passMut.mutate(); // 出せる手がない場合はリードパス
        }
      }
    },
  );

  // 自分の手番のとき、出せるカードを光らせる（オンライン。判定はエンジンの合法手と一致）。
  // 発光・減光は、Boardの順次表示が自分の手番まで追いついてから開始する
  // （CPUや相手の手を表示している間は、論理的に自分の番でも光らせない）。
  // 注意: この useMemo は早期リターンより前で必ず呼ぶこと。ロビー→対局中への
  // 画面遷移でフックの数が変わると React がツリー全体を落として白画面になる。
  const playableIdsOnline = useMemo(() => {
    if (
      !view ||
      view.status !== "playing" ||
      view.pending != null ||
      view.currentPlayerId !== playerId ||
      view.exchange ||
      !revealCaughtUp
    ) {
      return null;
    }
    const st = viewAsState(view, playerId);
    const sets = legalSets(st, view.rules, st.current).filter(
      (s) => !isForbiddenFinishPlay(view.rules, view.myHand.length, s),
    );
    return new Set(sets.flatMap((s) => s.map((c) => c.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, playerId, revealCaughtUp]);

  // 自分の手番の強調: サーバー側で自分の番になっていても、CPUの手の
  // 再生表示が追いついて実際に入力できるようになるまでは開始しない
  // （発光・タイマーと同じタイミングに揃える）。フックの数が変わらない
  // よう、早期リターンより前で必ず計算・呼び出しすること。
  const myTurnActiveOnline =
    !!view &&
    view.status === "playing" &&
    !view.pending &&
    !view.exchange &&
    view.currentPlayerId === playerId &&
    revealCaughtUp &&
    !deal.active &&
    !deal.shufflePhase;
  const myTurnNoticeOnline = useMyTurnNotice(myTurnActiveOnline);

  // 合計点の表示用スナップショット: 対局終了直後は、順次表示が最後まで
  // 追いつくまで合計点を更新しない（結果表示とタイミングをそろえる）。
  useEffect(() => {
    if (!view) return;
    if (view.status === "finished" && !revealCaughtUp) return;
    setShownScores(view.scores);
  }, [view, revealCaughtUp]);

  // ----- menu (no room yet) -----
  if (!code) {
    return (
      <div className="px-4 pb-8 pt-2 space-y-5 max-w-lg mx-auto">
        <button
          type="button"
          onClick={onExit}
          aria-label="ホームに戻る"
          className="rounded-full bg-[var(--surface)] border border-[var(--border)] px-4 py-1.5 text-sm font-bold text-[var(--text)]"
        >
          ← もどる
        </button>
        <NameField name={name} onChange={setName} />
        <div className="gold-frame rounded-2xl bg-[var(--surface)] p-4">
          <h2 className="gold-text font-extrabold text-base">アイコン画像を部屋で共有</h2>
          <p className="text-xs text-[var(--dim)] mt-1 leading-5">
            ONにすると、ホームで設定した圧縮済みのアイコン画像が部屋のサーバーへ送られ、参加メンバー全員の画面（ロビーと席）に表示されます。OFFのまま部屋を作る／入ると、画像はこの端末の外へ送られません。
          </p>
          <div className="mt-3 flex items-center gap-3">
            {avatar ? (
              <img
                src={avatar}
                alt="共有されるアイコン画像"
                className="w-10 h-10 rounded-full object-cover border-2 border-[#ffe9a8] flex-none"
              />
            ) : (
              <span className="text-xs font-bold text-[var(--dim)]">画像は未設定です（ホームで設定できます）</span>
            )}
            <span className="flex gap-1 flex-none ml-auto">
              <button
                type="button"
                aria-label="アイコン画像を部屋で共有 ON"
                aria-pressed={shareAvatar}
                disabled={!avatar}
                onClick={() => updateShareAvatar(true)}
                className={`px-3 py-1.5 rounded-md border font-extrabold text-[13px] disabled:opacity-40 ${
                  shareAvatar
                    ? "border-[#ffe9a8] bg-gradient-to-b from-[#6fe05a] to-[#2f9e2f] text-[#ffe9a8]"
                    : "border-[#c9a86a]/35 bg-[#173d2a] text-white/45"
                }`}
                style={{ minHeight: 0 }}
              >
                ON
              </button>
              <button
                type="button"
                aria-label="アイコン画像を部屋で共有 OFF"
                aria-pressed={!shareAvatar}
                onClick={() => updateShareAvatar(false)}
                className={`px-3 py-1.5 rounded-md border font-extrabold text-[13px] ${
                  !shareAvatar
                    ? "border-[#ffe9a8] bg-gradient-to-b from-[#6fe05a] to-[#2f9e2f] text-[#ffe9a8]"
                    : "border-[#c9a86a]/35 bg-[#173d2a] text-white/45"
                }`}
                style={{ minHeight: 0 }}
              >
                OFF
              </button>
            </span>
          </div>
        </div>
        <div className="gold-frame rounded-2xl bg-[var(--surface)] p-4">
          <h2 className="gold-text font-extrabold text-lg">友達と対戦</h2>
          <p className="text-xs text-[var(--dim)] mt-1">
            4桁の合言葉が発行されます。友達に教えて、同じ合言葉で入ってもらってください。下で選んだルールが全員に適用されます。
          </p>
        </div>
        <div id="online-rules-anchor">
          <RulesEditor rules={rules} onChange={setRules} />
          <p className="mt-2 text-[11px] font-bold leading-4 text-[var(--dim)]">{STORAGE_NOTE}</p>
        </div>
        {!confirmCreate ? (
          <button
            type="button"
            onClick={() => setConfirmCreate(true)}
            disabled={busy}
            className="btn-orange w-full rounded-xl font-extrabold py-3.5 text-base disabled:opacity-50"
          >
            このルールで部屋を作る
          </button>
        ) : (
          <div className="gold-frame panel-in rounded-2xl bg-[#0d4430] p-4">
            <div className="flex items-center gap-3">
              <span
                className="relative overflow-hidden w-12 h-12 rounded-lg border-2 border-[#ffe9a8] flex-none flex items-center justify-center font-extrabold text-xl text-white"
                style={{ background: avatarGradient(playerId + (name.trim() || "プレイヤー")) }}
              >
                {sharedAvatar ? (
                  <img src={sharedAvatar} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  (name.trim() || "プレイヤー").slice(0, 1)
                )}
              </span>
              <p className="font-extrabold text-[var(--text)] leading-6">
                「{name.trim() || "プレイヤー"}」の部屋を作成します。
                <br />
                このルールで作成しますか？
              </p>
            </div>
            <p className="mt-2 text-xs font-bold text-[var(--dim)] leading-5">
              {activeRuleLabels(rules).length > 0
                ? activeRuleLabels(rules).join("／")
                : "特殊ルールなし"}
              ／ジョーカー：{rules.jokerCount}枚／開始：{startPlayerLabel(rules)}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmCreate(false)}
                className="flex-1 rounded-xl bg-white/10 border border-white/40 text-white font-extrabold py-3"
              >
                もどる
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmCreate(false);
                  document
                    .getElementById("online-rules-anchor")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="flex-1 rounded-xl bg-white/10 border border-white/40 text-white font-extrabold py-3"
              >
                ルール変更
              </button>
              <button
                type="button"
                onClick={create}
                disabled={busy}
                className="btn-orange flex-1 rounded-xl font-extrabold py-3 disabled:opacity-50"
              >
                作成
              </button>
            </div>
          </div>
        )}
        <div className="gold-frame rounded-2xl bg-[var(--surface)] p-4">
          <h2 className="gold-text font-extrabold text-lg">部屋に入る</h2>
          <p className="text-xs text-[var(--dim)] mt-1 mb-3">
            友達から教えてもらった4桁の合言葉を入力してください。
          </p>
          <label htmlFor="join-code" className="sr-only">
            合言葉（4桁）
          </label>
          <input
            id="join-code"
            inputMode="numeric"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="例：4821"
            className="w-full rounded-xl bg-[var(--surface2)] border border-[var(--border)] px-4 py-3 text-center text-2xl font-extrabold tracking-[0.4em] text-[var(--text)] placeholder:text-[var(--dim)] placeholder:tracking-normal placeholder:text-base"
          />
          <button
            type="button"
            onClick={join}
            disabled={busy}
            className="btn-orange mt-3 w-full rounded-xl font-extrabold py-3.5 text-base disabled:opacity-50"
          >
            入室する
          </button>
        </div>
        {notice && (
          <p className="rounded-xl bg-[#ffd34d]/15 border border-[#ffd34d]/50 px-4 py-3 text-center text-sm font-bold text-[#ffe9a8]">
            {notice}
          </p>
        )}
        {error && <p className="text-center text-sm font-bold text-[#ff9d7a]">{error}</p>}
      </div>
    );
  }

  // ----- room -----
  if (room.isPending || !view) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-[var(--dim)] font-bold">部屋に接続中…</p>
        <button
          type="button"
          onClick={leave}
          className="mt-6 rounded-full bg-[var(--surface)] border border-[var(--border)] px-5 py-2 text-sm font-bold text-[var(--text)]"
        >
          やめる
        </button>
      </div>
    );
  }

  if (!view.found || !view.inRoom) {
    return (
      <div className="px-4 py-16 text-center space-y-4">
        <p className="font-extrabold text-[var(--text)]">
          {!view.found
            ? "その合言葉の部屋が見つかりませんでした"
            : "この部屋のメンバーではありません"}
        </p>
        <p className="text-sm font-bold text-[var(--dim)] leading-6 max-w-md mx-auto">
          {!view.found
            ? "作られてから時間がたっていたり、サーバーが再起動したりすると、部屋が消えていることがあります。ホストに合言葉を確認するか、新しい部屋を作ってください。"
            : "この端末のプレイヤー情報では、その部屋のメンバーとして登録されていません。部屋を作り直すか、合言葉を入力し直してください。"}
        </p>
        <div className="flex flex-col items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setCode(null);
              setSelected([]);
              setNotice(
                "前回の部屋は終了していました。新しい部屋を作るか、友達に合言葉を聞いて入力してください。",
              );
            }}
            className="btn-orange rounded-xl font-extrabold px-6 py-3"
          >
            部屋を作る・入る画面へ
          </button>
          <button
            type="button"
            onClick={leave}
            className="rounded-full bg-[var(--surface)] border border-[var(--border)] px-5 py-2 text-sm font-bold text-[var(--text)]"
          >
            ホームへもどる
          </button>
        </div>
      </div>
    );
  }

  // チャットボタン（未読バッジつき）とシート。ロビーと対局画面で共用する。
  const chatButton = (
    <button
      type="button"
      onClick={() => setChatOpen(true)}
      aria-label={
        unreadChat > 0 ? `チャットを開く（未読${unreadChat}件）` : "チャットを開く"
      }
      className="relative flex-none rounded-full border border-[#d8b25c] bg-[#0a3828] px-4 py-1.5 text-sm font-extrabold text-[#ffe9a8] shadow"
    >
      チャット
      {unreadChat > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e23c2e] px-1 text-[11px] font-extrabold text-white shadow">
          {unreadChat}
        </span>
      )}
    </button>
  );
  const chatSheet = chatOpen ? (
    <ChatSheet
      messages={chatMessages}
      playerId={playerId}
      draft={chatDraft}
      onDraftChange={setChatDraft}
      onSend={sendChat}
      sending={chatMut.isPending}
      onClose={() => setChatOpen(false)}
    />
  ) : null;

  // ----- lobby -----
  if (view.status === "lobby") {
    const humans = view.players.filter((p) => !p.isBot).length;
    const maxBots = Math.max(0, 6 - humans);
    return (
      <div className="pb-8">
        <div className="flex items-center justify-between px-4 pt-3">
          <button
            type="button"
            onClick={leave}
            aria-label="部屋を出る"
            className="rounded-full bg-[var(--surface)] border border-[var(--border)] px-4 py-1.5 text-sm font-bold text-[var(--text)]"
          >
            ← 退出
          </button>
          <p className="text-sm font-extrabold text-[var(--text)]">
            合言葉{" "}
            <span className="text-[#ffd34d] text-xl tracking-[0.2em]">{view.code}</span>
          </p>
          {chatButton}
        </div>
        <div className="px-4 mt-4 space-y-4 max-w-lg mx-auto">
          <div className="gold-frame rounded-2xl bg-[var(--surface)] p-4">
            <h2 className="gold-text font-extrabold">
              参加メンバー（{view.players.length}/6人）
            </h2>
            <ul className="mt-3 space-y-2">
              {view.players.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl bg-[var(--surface2)] px-3 py-2.5"
                >
                  <span
                    className="relative overflow-hidden w-9 h-9 rounded-full flex-none flex items-center justify-center font-extrabold text-sm text-white"
                    style={{ background: avatarGradient(p.id + p.name) }}
                  >
                    {p.avatar ? (
                      <img src={p.avatar} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      p.name.slice(0, 1)
                    )}
                  </span>
                  <span className="font-bold text-[var(--text)]">{p.name}</span>
                  {p.isHost && (
                    <span className="text-[11px] font-extrabold bg-[#ffd34d] text-[#4a3205] rounded-full px-2 py-0.5">
                      ホスト
                    </span>
                  )}
                  {p.id === playerId && (
                    <span className="text-[11px] text-[var(--dim)]">あなた</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-3 rounded-xl bg-[var(--surface2)] px-3 py-2.5">
              <p className="text-[11px] font-extrabold text-[#ffe9a8]">この部屋のルール（ホスト設定）</p>
              <p className="text-xs font-bold text-[var(--text)] mt-1 leading-5">
                {activeRuleLabels(view.rules).length > 0
                  ? activeRuleLabels(view.rules).join("／")
                  : "特殊ルールなし"}
              </p>
              <p className="text-xs text-[var(--dim)] mt-0.5">
                ジョーカー：{view.rules.jokerCount}枚／開始：
                {startPlayerLabel(view.rules)}
              </p>
            </div>
          </div>

          {view.isHost ? (
            <div className="gold-frame rounded-2xl bg-[var(--surface)] p-4 space-y-4">
              <CountPicker
                label="CPUを追加（空き席をうめる）"
                value={botCount}
                min={0}
                max={maxBots}
                onChange={setBotCount}
              />
              <p className="text-xs text-[var(--dim)]">
                合計 {humans + botCount}人で対局します（2〜6人）
              </p>
              <button
                type="button"
                onClick={start}
                disabled={busy || humans + botCount < 2}
                className="btn-orange w-full rounded-xl font-extrabold py-3.5 text-base disabled:opacity-40"
              >
                対局スタート
              </button>
            </div>
          ) : (
            <p className="text-center text-sm font-bold text-[var(--dim)]">
              ホストが対局を始めるのを待っています…
            </p>
          )}
          {error && <p className="text-center text-sm font-bold text-[#ff9d7a]">{error}</p>}
        </div>
        {chatSheet}
      </div>
    );
  }

  // ----- playing / finished -----
  const players: BoardPlayer[] = view.players.map((p) => ({ ...p }));
  const pending: PendingView | null = view.pending;
  const pendingPlayer = pending
    ? view.players.find((p) => p.id === pending.playerId)
    : undefined;
  const isMyTurn = view.status === "playing" && !pending && view.currentPlayerId === playerId;
  const pendingIsMine = pending != null && pending.playerId === playerId;
  const currentPlayer = view.players.find((p) => p.id === view.currentPlayerId);
  const ownerName = view.field
    ? (view.players.find((p) => p.id === view.field!.ownerId)?.name ?? null)
    : null;
  const mePlayer = view.players.find((p) => p.id === playerId);
  // 席替えイントロの前半は前ゲームの並びで席番号を出す（相手席と揃える）
  const mySeatNo =
    (deal.displayOrder
      ? deal.displayOrder.indexOf(playerId)
      : view.players.findIndex((p) => p.id === playerId)) + 1;

  const myExStep = myExStepOnline;
  const firstExStep = view.exchange?.pending[0];
  const activeExStep = myExStep ?? firstExStep;
  const activeExRole: "give" | "back" = myExStep
    ? (myExRoleOnline ?? "give")
    : activeExStep && activeExStep.giveDone
      ? "back"
      : "give";
  const activeExDeciderId = activeExStep
    ? activeExRole === "give"
      ? activeExStep.giverId
      : activeExStep.receiverId
    : null;
  const activeExOtherId = activeExStep
    ? activeExRole === "give"
      ? activeExStep.receiverId
      : activeExStep.giverId
    : null;
  // リードパス（オンライン）: 場が空でも出せる手が1つもないときはパスできる
  const canLeadPassOnline = (() => {
    if (!isMyTurn || view.field) return false;
    const st = viewAsState(view, playerId);
    return legalSets(st, view.rules, st.current).every((s) =>
      isForbiddenFinishPlay(view.rules, view.myHand.length, s),
    );
  })();

  const toggleCard = (id: string) => {
    // 献上確認で「貧民のカード選択」OFFのときは、渡すカードは最強カードで固定
    if (
      !pending &&
      myExStep &&
      myExRoleOnline === "give" &&
      !view.rules.exchangeChoice
    )
      return;
    setError("");
    setSelected((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      // 通常の「出すカード」選択では、金色に光っている（出せる）カードだけ
      // 選べる（オンライン）。光っていないカードはタップしても反応しない。
      if (!pending && !view.exchange && !(playableIdsOnline?.has(id) ?? false))
        return s;
      if (
        pending &&
        pending.type !== "qBomber" &&
        pending.type !== "fourStop" &&
        s.length >= pending.maxCount
      )
        return s;
      if (!pending && myExStep && s.length >= myExStep.count) return s;
      return [...s, id];
    });
  };

  // 革命選択: 選んだカードが革命を起こせるとき、出す前に選ばせる
  const revTrigger =
    view.rules.revolutionChoice &&
    isMyTurn &&
    view.exchange == null &&
    selected.length > 0 &&
    !(view.rules.revolutionReturn === "none" && view.revolution) &&
    checkRevolutionTrigger(
      view.rules,
      view.myHand.filter((c) => selected.includes(c.id)),
      view.omen,
    );

  const viewFieldRank = view.field
    ? (setRank(view.field.cards) ??
      sequenceInfo(view.field.cards)?.top ??
      emperorInfo(view.field.cards)?.top ??
      null)
    : null;

  const statusText =
    view.status === "finished"
      ? revealCaughtUp
        ? "対局終了"
        : "対局終了 — 最後の手まで表示しています…"
      : view.exchange
        ? activeExRole === "give"
          ? "カード交換中：渡すカードを確認しています"
          : "カード交換中：渡すカードを選んでいます"
        : pending
          ? `${pendingPlayer?.name ?? ""}さんが${PENDING_LABEL[pending.type]}中…`
          : isMyTurn
            ? "あなたの番です！"
            : `${currentPlayer?.name ?? ""}さんの番…`;

  return (
    <>
    <GameScreen
      statusText={statusText}
      exitLabel="部屋を出る"
      onExit={leave}
      rules={view.rules}
      revolution={dispRev}
      myTurn={myTurnActiveOnline}
      showMyTurnBanner={myTurnNoticeOnline.showBanner}
      myTurnBannerSeq={myTurnNoticeOnline.seq}
    >
      <div className="flex items-center justify-between px-3">
        <span className="w-[76px]" aria-hidden />
        <p className="text-center text-xs font-bold text-white/85 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          合言葉 <span className="text-[#ffe9a8] tracking-[0.25em] text-sm">{view.code}</span>
          （オンライン対戦中）
        </p>
        {chatButton}
      </div>
      <ScoreStrip
        gameNo={view.gameNumber}
        entries={view.players.map((p) => ({
          id: p.id,
          name: p.name,
          total: shownScores[p.id] ?? 0,
        }))}
      />
      <DealOverlay deal={deal} />
      <SeatShuffleBanner deal={deal} />
      <Board
        players={players}
        viewerId={playerId}
        currentPlayerId={
          deal.shufflePhase
            ? null
            : view.status === "playing"
              ? (pending?.playerId ?? view.currentPlayerId)
              : null
        }
        passedIds={view.passedIds}
        fieldCards={view.field?.cards ?? null}
        ownerName={ownerName}
        revolution={view.revolution}
        backActive={view.backActive}
        lockSuit={view.lockSuit}
        numberLockNext={
          view.numberLock && viewFieldRank !== null
            ? viewFieldRank + (view.revolution !== view.backActive ? -1 : 1)
            : null
        }
        direction={view.direction}
        history={view.history}
        log={view.log}
        rules={view.rules}
        onRevealSync={setRevealCaughtUp}
        onDisplayedRevolution={setDispRev}
        onFinishFxBusy={setFinishFxBusy}
        replayKey={dealToken > 0 ? `online-${view.code}-${dealToken}` : null}
        holdReveal={deal.active || !!deal.shufflePhase}
        exchangeActive={!!view.exchange}
        seatFx={deal.shufflePhase}
        displayOrder={deal.displayOrder}
      />

      {view.status === "finished" && view.matchEnded && revealCaughtUp && !finishFxBusy ? (
        <FinalResults
          gameNo={view.gameNumber}
          entries={view.players.map((p) => ({
            id: p.id,
            name: p.name,
            total: view.scores[p.id] ?? 0,
          }))}
          gameHistory={view.gameHistory}
        >
          {view.isHost ? (
            <button
              type="button"
              onClick={async () => {
                await api.backToLobby({ code, playerId });
                invalidate();
              }}
              className="btn-orange mt-4 w-full rounded-xl font-extrabold py-3"
            >
              ロビーに戻る
            </button>
          ) : (
            <p className="mt-3 text-center text-xs text-white/75">
              ホストがロビーに戻すと、新しい対戦を始められます
            </p>
          )}
        </FinalResults>
      ) : view.status === "finished" && revealCaughtUp && !finishFxBusy ? (
        <ResultsPanel
          gameNo={view.gameNumber}
          total={view.players.length}
          rows={view.players
            .filter((p) => p.finishRank !== null)
            .map((p) => ({
              id: p.id,
              name: p.name,
              finishRank: p.finishRank!,
              points: pointsForRank(p.finishRank!, view.players.length),
              total: view.scores[p.id] ?? 0,
            }))}
        >
          {view.isHost ? (
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  const res = await api.nextGame({ code, playerId });
                  if (!res.ok) setError(res.reason);
                  invalidate();
                }}
                className="btn-orange flex-1 rounded-xl font-extrabold py-3"
              >
                次のゲームへ
              </button>
              <button
                type="button"
                onClick={async () => {
                  await api.endMatch({ code, playerId });
                  invalidate();
                }}
                className="flex-1 rounded-xl bg-white/10 border border-white/40 text-white font-extrabold py-3"
              >
                対戦を終了する
              </button>
            </div>
          ) : (
            <p className="mt-3 text-center text-xs text-white/75">
              ホストが「次のゲームへ」を押すと、同じメンバー・ルールで続きます
            </p>
          )}
        </ResultsPanel>
      ) : (
        <div className="relative">
          <div className="absolute left-2 -top-1 z-20" data-seat-player={playerId}>
            <SeatFrame
              player={
                mePlayer
                  ? { ...mePlayer, cardCount: view.myHand.length }
                  : {
                      id: playerId,
                      name: name,
                      isBot: false,
                      cardCount: view.myHand.length,
                      finishRank: null,
                    }
              }
              seatNo={mySeatNo}
              isTurn={isMyTurn && revealCaughtUp && !deal.active}
              glow={
                isMyTurn &&
                revealCaughtUp &&
                !deal.active &&
                !deal.shufflePhase &&
                !view.exchange
              }
              fx={deal.shufflePhase}
              passed={view.passedIds.includes(playerId)}
              totalPlayers={players.length}
              large
              gauge={
                timeLeftOnline !== null && view.rules.timeLimit > 0
                  ? timeLeftOnline / view.rules.timeLimit
                  : null
              }
            />
          </div>
          <div className={`pt-[84px] ${myTurnActiveOnline ? "my-turn-hand" : ""}`}>
            <FanHand
              cards={view.myHand}
              selected={selected}
              playableIds={playableIdsOnline}
              glowIds={exGiveGlowIdsOnline}
              limit={deal.active || deal.shufflePhase ? deal.viewerDealt : undefined}
              onToggle={
                isMyTurn ||
                (pendingIsMine &&
                  pending?.type !== "qBomber" &&
                  pending?.type !== "fourStop") ||
                !!myExStep
                  ? toggleCard
                  : undefined
              }
            />
          </div>
          {view.status === "finished" && !revealCaughtUp && (
            <p className="mx-4 mb-2 rounded-xl bg-black/45 px-3 py-2 text-center text-sm font-extrabold text-[#ffe9a8]">
              対局は終了しました。残りの対局を最後まで表示してから結果を出します
            </p>
          )}
          <p className="text-center text-xs font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] -mt-2 mb-1">
            あなたの手札（{view.myHand.length}枚）
          </p>
          {error && (
            <p className="mx-4 mt-1 text-center text-sm font-extrabold text-[#ffe1ae] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              {error}
            </p>
          )}
          <TurnTimerBadge left={timeLeftOnline} />
          {view.exchange ? (
            <ExchangePanel
              step={activeExStep ?? { count: 0 }}
              role={activeExRole}
              isMine={!!myExStep}
              deciderName={
                view.players.find((p) => p.id === activeExDeciderId)?.name ?? ""
              }
              otherName={
                view.players.find((p) => p.id === activeExOtherId)?.name ?? ""
              }
              selectedCount={selected.length}
              onConfirm={() => {
                if (myExStep) exchangeMut.mutate(selected);
              }}
              busy={exchangeMut.isPending}
              giveLabels={exGiveLabelsOnline}
              giveCanChange={view.rules.exchangeChoice}
            />
          ) : pending ? (
            <PendingPanel
              pending={pending}
              isMine={pendingIsMine}
              actorName={pendingPlayer?.name ?? ""}
              selectedCount={selected.length}
              chosenRank={chosenRank}
              onChooseRank={setChosenRank}
              onConfirm={() => {
                if (pending.type === "fourStop") {
                  const fours = view.myHand.filter(
                    (c) => c.rank === 4 && c.suit !== "J",
                  );
                  pendingMut.mutate({
                    cardIds: fours.slice(0, pending.maxCount).map((c) => c.id),
                  });
                } else {
                  pendingMut.mutate(
                    pending.type === "qBomber"
                      ? { rank: chosenRank ?? undefined }
                      : { cardIds: selected },
                  );
                }
              }}
              onDecline={
                pending.type === "fourStop"
                  ? () => pendingMut.mutate({ cardIds: [] })
                  : undefined
              }
              busy={pendingMut.isPending}
              exact={
                pending.type === "sevenPass"
                  ? !view.rules.sevenPassChoice
                  : pending.type === "tenDiscard"
                    ? !view.rules.tenDiscardChoice
                    : false
              }
            />
          ) : (
            <ActionButtons
              canPass={isMyTurn && (!!view.field || canLeadPassOnline)}
              canPlay={isMyTurn && selected.length > 0}
              selectedCount={selected.length}
              onPass={() => passMut.mutate()}
              onPlay={() => playMut.mutate({ cardIds: selected, revolution: true })}
              revChoice={revTrigger}
              onPlayNoRev={() =>
                playMut.mutate({ cardIds: selected, revolution: false })
              }
              highlight={myTurnActiveOnline}
            />
          )}
        </div>
      )}
    </GameScreen>
    {chatSheet}
    </>
  );
}

// ---------- app shell ----------

type Screen =
  | { kind: "home" }
  | { kind: "cpu-setup" }
  | { kind: "local-game"; roster: { id: string; name: string; isBot: boolean }[]; rules: Rules }
  | { kind: "online" };

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "home" });
  const [name, setName] = useState(
    () => localStorage.getItem("daifugo-name") ?? "",
  );
  const [rules, setRulesState] = useState<Rules>(loadSavedRules);
  const [avatar, setAvatarState] = useState<string | null>(loadSavedAvatar);
  const [avatarSaveError, setAvatarSaveError] = useState("");
  const [rulesSaveError, setRulesSaveError] = useState("");
  const setRules = (r: Rules) => {
    setRulesState(r);
    setRulesSaveError(
      saveRulesToBrowser(r)
        ? ""
        : "ルール設定をこの端末に保存できませんでした（容量不足の可能性があります）",
    );
  };
  const updateAvatar = (dataUrl: string | null) => {
    setAvatarState(dataUrl);
    try {
      if (dataUrl) localStorage.setItem(AVATAR_STORAGE_KEY, dataUrl);
      else localStorage.removeItem(AVATAR_STORAGE_KEY);
      setAvatarSaveError("");
    } catch {
      setAvatarSaveError(
        "画像をこの端末に保存できませんでした（容量不足の可能性があります）。いまは表示されますが、次に開いたときには残らないことがあります",
      );
    }
  };
  const [cpuTotal, setCpuTotal] = useState(4);

  const updateName = (n: string) => {
    setName(n);
    localStorage.setItem("daifugo-name", n);
  };

  const displayName = name.trim() || "あなた";

  return (
    <div
      className="app-bg min-h-screen"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
    >
      <div aria-hidden style={{ height: "env(safe-area-inset-top, 0px)" }} />
      <main className="mx-auto max-w-2xl">
        {screen.kind === "home" && (
          <div className="px-4 pb-10 pt-4">
            <div className="ornate-band rounded-sm mb-4" aria-hidden />
            <div className="text-center pt-3 pb-2">
              <p className="text-2xl tracking-[0.5em] text-[#ffd34d]" aria-hidden>
                ♠ ♥ ♦ ♣
              </p>
              <h1 className="gold-text mt-2 text-5xl font-extrabold tracking-wide">
                大富豪
              </h1>
              <p className="mt-2 text-sm text-[var(--dim)] font-bold">
                無料・インストール不要。最大6人で遊べるトランプゲーム
              </p>
            </div>

            <div className="mt-5 space-y-4 max-w-lg mx-auto">
              <NameField name={name} onChange={updateName} />
              <ProfileImageField
                avatar={avatar}
                name={name}
                saveError={avatarSaveError}
                onAvatarChange={updateAvatar}
              />
              <p className="text-[11px] font-bold leading-4 text-[var(--dim)]">{STORAGE_NOTE}</p>
              <button
                type="button"
                onClick={() => setScreen({ kind: "online" })}
                className="btn-orange w-full text-left rounded-2xl p-5"
              >
                <span className="block text-xl font-extrabold">
                  友達とオンライン対戦
                </span>
                <span className="block text-sm font-bold mt-1 opacity-90">
                  離れた場所の友達と、合言葉（4桁）の部屋で対戦
                </span>
              </button>
              <button
                type="button"
                onClick={() => setScreen({ kind: "cpu-setup" })}
                className="gold-frame w-full text-left rounded-2xl bg-[var(--surface)] p-5 active:scale-[0.99] transition-transform"
              >
                <span className="gold-text block text-xl font-extrabold">
                  CPU対戦
                </span>
                <span className="block text-sm text-[var(--dim)] font-bold mt-1">
                  1人でCPUと対戦。練習にぴったり
                </span>
              </button>
            </div>
            <InstallGuide />
          </div>
        )}

        {screen.kind === "cpu-setup" && (
          <div className="px-4 pb-10 pt-3 space-y-5 max-w-lg mx-auto">
            <button
              type="button"
              onClick={() => setScreen({ kind: "home" })}
              aria-label="ホームに戻る"
              className="rounded-full bg-[var(--surface)] border border-[var(--border)] px-4 py-1.5 text-sm font-bold text-[var(--text)]"
            >
              ← もどる
            </button>
            <h2 className="gold-text text-2xl font-extrabold">CPU対戦の設定</h2>
            <CountPicker
              label="対戦人数（あなた＋CPU）"
              value={cpuTotal}
              min={2}
              max={6}
              onChange={setCpuTotal}
            />
            <RulesEditor rules={rules} onChange={setRules} />
            <p className="text-[11px] font-bold leading-4 text-[var(--dim)]">{STORAGE_NOTE}</p>
            {rulesSaveError && (
              <p className="text-xs font-extrabold text-[#ff9d7a]">{rulesSaveError}</p>
            )}
            <button
              type="button"
              onClick={() =>
                setScreen({
                  kind: "local-game",
                  roster: [
                    { id: "me", name: displayName, isBot: false },
                    ...Array.from({ length: cpuTotal - 1 }, (_, i) => ({
                      id: `cpu-${i + 1}`,
                      name: `CPU ${i + 1}`,
                      isBot: true,
                    })),
                  ],
                  rules,
                })
              }
              className="btn-orange w-full rounded-xl font-extrabold py-4 text-lg"
            >
              対局スタート
            </button>
          </div>
        )}

        {screen.kind === "local-game" && (
          <LocalGame
            roster={screen.roster}
            rules={screen.rules}
            onExit={() => setScreen({ kind: "home" })}
            avatarMap={
              avatar ? { [screen.roster[0]?.id ?? "me"]: avatar } : undefined
            }
          />
        )}

        {screen.kind === "online" && (
          <OnlineGame
            initialName={name}
            initialRules={rules}
            avatar={avatar}
            onRulesChange={setRules}
            onExit={() => setScreen({ kind: "home" })}
          />
        )}
      </main>
    </div>
  );
}
