// Daifugo (大富豪) game engine — client copy for local modes (CPU / pass-and-play).
// The server keeps an identical copy (server/src/game.ts) for online rooms.

export interface Rules {
  // 基本（従来からの項目）
  revolution: boolean; // 革命: 4枚以上で強さ逆転
  eightCut: boolean; // 8切り: 8を含むと場が流れて自分が続けて出せる
  elevenBack: boolean; // 11バック: Jを含むと場が流れるまで強さ逆転
  spade3: boolean; // スペ3返し: ♠3単体でジョーカーに勝てて場が流れる
  jokerCount: number; // ジョーカーの枚数 0〜2
  skip5: boolean; // スキップ: 5を含むと次の人を1回休み
  stairs: boolean; // 階段: 同じスートの連番を出せる
  shibari: boolean; // 縛り: 同じスートが続くとそのスートしか出せない
  forbiddenFinish: boolean; // 禁止あがり（マスター）
  miyakoOchi: boolean; // 都落ち: 前の大富豪が1位で上がれないと大貧民に落ちる
  reverse9: boolean; // 9リバース
  sevenPass: boolean; // 7渡し
  tenDiscard: boolean; // 10捨て
  qBomber: boolean; // Qボンバー（12ボンバー）
  downNumber: boolean; // ダウンナンバー
  cardExchange: boolean; // カード交換（マスター）
  startPlayer: "diamond3" | "winner" | "daihinmin" | "spade3"; // スタート
  // 革命の詳細
  stairsRevolution: boolean; // 階段革命: 階段5枚以上でも革命
  revolutionReturn: "immediate" | "none"; // 革命返し: 即時=革命中に再び起きると元に戻る
  revolutionJoker: boolean; // ジョーカー含みの組でも革命可
  revolutionChoice: boolean; // 革命選択: 革命条件を満たしたとき起こすか選べる
  coupDetat: boolean; // クーデター: 9を3枚で革命
  omen: boolean; // オーメン: 6を3枚で革命し以後革命不可・他効果無効
  nanasanRevolution: boolean; // ナナサン革命: 7を3枚で革命
  // 階段の詳細
  stairsMin: number; // 階段に必要な最小枚数 3〜5
  stairsStrength: "overlap" | "top"; // 階段の強さ判定（重なる=実際のカードの最強数字で比較）
  stairsEffects: boolean; // 階段に含まれる8切り等の効果を発動するか
  emperor: boolean; // エンペラー: 全て異なるスートの4枚連番（出すと革命）
  // 縛りの詳細
  numberShibari: boolean; // 数しば: 連続した数字で出たら次は1つ強い数字しか出せない
  gekiShibari: boolean; // 激しば: スート縛りと数字縛りが同時に発生する
  ryoShibari: "both" | "either"; // 両しば: 両方の縛りがかかったときの適用方式
  shibariCount: number; // 縛り回数: 同じスートが何回続いたら縛るか 1〜3
  // 8切り系の特殊流し
  fourStop: boolean; // 4止め: 8切りの2倍枚数の4で8切りを止められる
  sandstorm: boolean; // 砂嵐: 3を3枚でどんな場にも出せて場が流れる
  ambulance: boolean; // 救急車: 9を2枚で場が流れる
  rokurokubi: boolean; // ろくろ首: 6を2枚で場が流れる
  // 11バックの詳細
  strongElevenBack: boolean; // 強化11バック: 場が流れても効果が続く
  // 禁止あがりの詳細
  forbid2: boolean; // 2あがり禁止
  forbid8: boolean; // 8切りあがり禁止
  forbidJoker: "off" | "yasashii" | "all"; // Jokerあがり禁止（やさしい=単体のみ禁止）
  forbidSpade3: boolean; // スペ3あがり禁止
  forbidQBomber: boolean; // 12ボンバーあがり禁止
  forbid11Back: boolean; // 11バックあがり禁止
  forbid7Pass: boolean; // 7渡しあがり禁止
  forbid10Discard: boolean; // 10捨てあがり禁止
  // 都落ちの詳細
  gekokujo: boolean; // 下剋上: 前回の大貧民が1位で上がると前回の大富豪が大貧民に落ちる
  // Jokerの詳細
  jokerEffect: "all" | "groups" | "stairs"; // Jokerの効果範囲
  // リバースの詳細
  reverse: boolean; // リバース（マスター）
  reverse12: boolean; // 12リバース
  // スキップの詳細
  skip: boolean; // スキップ（マスター）
  skip13: boolean; // 13スキップ（Kスキップ）
  // 7渡し・10捨ての詳細
  sevenPassChoice: boolean; // 枚数選択: OFFなら出した枚数分ちょうど渡す
  tenDiscardChoice: boolean; // 枚数選択: OFFなら出した枚数分ちょうど捨てる
  // カード交換の詳細
  exchangeMode: "simultaneous" | "order"; // 交換方式（同時／順番）
  exchangeChoice: boolean; // 貧民のカード選択: ONでは貧民側が渡すカードを自分で選ぶ
  exchangeNoJoker: boolean; // Jokerを交換しない
  tenpenchii: boolean; // 天変地異: 大貧民の手札が全て10以下なら大富豪と全交換
  // ゲームの進行
  cpuLevel: "weak" | "normal" | "strong"; // コンピューターの強さ
  timeLimit: number; // 持ち時間（秒）0=∞（クライアント側タイマーで自動パス等）
  seatShuffle: "random" | "off"; // 席替え
  shuffleType: "random" | "reality" | "separate" | "separate3"; // シャッフルの配り方（下記 buildDealHands 参照）
  blindCard: boolean; // ブラインドカード: 余りカードを伏せて抜く
  agariNagashi: boolean; // あがり流し: 誰かが上がったら場を流す
  passLimit: boolean; // パス制限: ON=一度パスしたら場が流れるまで出せず、自分の番では自動パスになる / OFF=一度パスしても次の自分の番でまた出せる
}

export const DEFAULT_RULES: Rules = {
  revolution: true,
  eightCut: true,
  elevenBack: true,
  spade3: true,
  jokerCount: 2,
  skip5: false,
  stairs: false,
  shibari: false,
  forbiddenFinish: true,
  miyakoOchi: false,
  reverse9: false,
  sevenPass: false,
  tenDiscard: false,
  qBomber: false,
  downNumber: false,
  cardExchange: true,
  startPlayer: "daihinmin",
  stairsRevolution: false,
  revolutionReturn: "immediate",
  revolutionJoker: true,
  revolutionChoice: false,
  coupDetat: false,
  omen: false,
  nanasanRevolution: false,
  stairsMin: 3,
  stairsStrength: "overlap",
  stairsEffects: false,
  emperor: false,
  numberShibari: false,
  gekiShibari: false,
  ryoShibari: "both",
  shibariCount: 1,
  fourStop: false,
  sandstorm: false,
  ambulance: false,
  rokurokubi: false,
  strongElevenBack: false,
  forbid2: false,
  forbid8: true,
  forbidJoker: "yasashii",
  forbidSpade3: false,
  forbidQBomber: false,
  forbid11Back: false,
  forbid7Pass: false,
  forbid10Discard: false,
  gekokujo: false,
  jokerEffect: "groups",
  reverse: false,
  reverse12: false,
  skip: false,
  skip13: false,
  sevenPassChoice: false,
  tenDiscardChoice: false,
  exchangeMode: "simultaneous",
  exchangeChoice: false,
  exchangeNoJoker: false,
  tenpenchii: true,
  cpuLevel: "normal",
  timeLimit: 0,
  seatShuffle: "random",
  shuffleType: "reality",
  blindCard: false,
  agariNagashi: false,
  passLimit: false,
};

const BOOL_RULE_KEYS = [
  "revolution", "eightCut", "elevenBack", "spade3", "skip5", "stairs",
  "shibari", "forbiddenFinish", "miyakoOchi", "reverse9", "sevenPass",
  "tenDiscard", "qBomber", "downNumber", "cardExchange", "stairsRevolution",
  "revolutionJoker", "revolutionChoice", "coupDetat", "omen",
  "nanasanRevolution", "stairsEffects", "emperor", "numberShibari",
  "gekiShibari", "fourStop", "sandstorm", "ambulance", "rokurokubi",
  "strongElevenBack", "forbid2", "forbid8", "forbidSpade3", "forbidQBomber",
  "forbid11Back", "forbid7Pass", "forbid10Discard", "gekokujo", "reverse",
  "reverse12", "skip", "skip13", "sevenPassChoice", "tenDiscardChoice",
  "exchangeChoice", "exchangeNoJoker", "tenpenchii", "blindCard",
  "agariNagashi", "passLimit",
] as const;

/** Converts legacy stored rules (joker: boolean) and fills defaults. */
export function normalizeRules(input: unknown): Rules {
  const r = (input ?? {}) as Record<string, unknown>;
  const out = { ...DEFAULT_RULES } as Record<string, unknown>;
  for (const k of BOOL_RULE_KEYS) {
    if (typeof r[k] === "boolean") out[k] = r[k];
  }
  out.jokerCount =
    typeof r.jokerCount === "number"
      ? Math.max(0, Math.min(2, Math.floor(r.jokerCount)))
      : r.joker === false
        ? 0
        : DEFAULT_RULES.jokerCount;
  out.stairsMin =
    typeof r.stairsMin === "number"
      ? Math.max(3, Math.min(5, Math.floor(r.stairsMin)))
      : DEFAULT_RULES.stairsMin;
  out.shibariCount =
    typeof r.shibariCount === "number"
      ? Math.max(1, Math.min(3, Math.floor(r.shibariCount)))
      : DEFAULT_RULES.shibariCount;
  out.timeLimit =
    typeof r.timeLimit === "number" && [0, 10, 20, 30, 60].includes(r.timeLimit)
      ? r.timeLimit
      : DEFAULT_RULES.timeLimit;
  out.startPlayer = ["winner", "diamond3", "spade3", "daihinmin"].includes(
    r.startPlayer as string,
  )
    ? r.startPlayer
    : DEFAULT_RULES.startPlayer;
  out.revolutionReturn = r.revolutionReturn === "none" ? "none" : "immediate";
  out.stairsStrength = r.stairsStrength === "top" ? "top" : "overlap";
  out.ryoShibari = r.ryoShibari === "either" ? "either" : "both";
  out.forbidJoker = ["off", "yasashii", "all"].includes(r.forbidJoker as string)
    ? r.forbidJoker
    : DEFAULT_RULES.forbidJoker;
  out.jokerEffect = ["all", "groups", "stairs"].includes(r.jokerEffect as string)
    ? r.jokerEffect
    : DEFAULT_RULES.jokerEffect;
  out.exchangeMode = r.exchangeMode === "order" ? "order" : "simultaneous";
  out.cpuLevel = ["weak", "normal", "strong"].includes(r.cpuLevel as string)
    ? r.cpuLevel
    : DEFAULT_RULES.cpuLevel;
  out.seatShuffle = r.seatShuffle === "off" ? "off" : "random";
  out.shuffleType = ["random", "separate", "separate3"].includes(
    r.shuffleType as string,
  )
    ? r.shuffleType
    : "reality";
  // パス制限は BOOL_RULE_KEYS 経由で保存値がそのまま反映される（初期値はOFF）
  return out as unknown as Rules;
}

export type Suit = "S" | "H" | "D" | "C" | "J";

export interface Card {
  id: string; // e.g. "S3", "H14", "JOKER"
  suit: Suit;
  rank: number; // 3..15 (11=J,12=Q,13=K,14=A,15=2), joker=20
}

export interface PlayerState {
  id: string;
  name: string;
  isBot: boolean;
  hand: Card[];
  finishRank: number | null;
}

export interface FieldState {
  cards: Card[];
  ownerId: string;
  rank: number; // effective strength rank (normal=set rank, sequence=top rank)
  kind: "normal" | "sequence";
  suit: Suit | null; // suit when every non-joker card shares one suit
  low: number; // sequences: lowest rank of the run (normal sets: same as rank)
  actualTop: number; // strongest non-joker rank (階段の強さ「重なる」用)
}

export interface HistoryEntry {
  playerId: string;
  name: string;
  cards: Card[] | null; // null = pass (or a note-only entry)
  note: string | null;
  flow?: boolean; // true = 「場が流れた」マーカー（履歴は対局中消さず、このマーカーで場を区切る）
}

export interface PendingAction {
  type: "sevenPass" | "tenDiscard" | "qBomber" | "fourStop";
  playerId: string;
  maxCount: number; // sevenPass / tenDiscard: up to this many cards / fourStop: 必要な4の枚数
  playedCards: Card[];
}

/** カード交換の1回分の交換。
 * giveIds = 貧民側→大富豪側への献上カード（貧民のカード選択OFFでは最強カードで自動決定済み）。
 * backIds = 大富豪側→貧民側へ渡すカード（大富豪・富豪側が自分で選ぶ。null = 未決定）。 */
export interface ExchangeStep {
  giverId: string;
  receiverId: string;
  count: number;
  giveIds: string[] | null; // null = 献上カード未決定
  backIds: string[] | null; // null = 大富豪側が渡すカード未決定
}

/** そのステップで次にカードを選ぶべきプレイヤー（献上→お返しの順）。両方決まればnull。 */
export function exchangeDecider(step: ExchangeStep): string | null {
  if (step.giveIds == null) return step.giverId;
  if (step.backIds == null) return step.receiverId;
  return null;
}

/** 対局開始前のカード交換フェーズ。 */
export interface ExchangeState {
  mode: "simultaneous" | "order";
  steps: ExchangeStep[];
  index: number; // order方式で現在処理中のステップ
}

export interface GameState {
  players: PlayerState[];
  field: FieldState | null;
  current: number; // index into players
  revolution: boolean;
  backActive: boolean;
  direction: 1 | -1; // リバースで反転
  lockSuit: Suit | null; // 縛り中のスート
  numberLock: boolean; // 数縛り中（次は場の数字の1つ強い数字しか出せない）
  passed: string[]; // player ids who passed on the current field
  finishOrder: string[];
  status: "playing" | "finished";
  log: string[];
  lastPlayBy: string | null;
  history: HistoryEntry[]; // 対局全体の履歴（場が流れるたび flow マーカーで区切る。再生側が最後の一手まで表示してから山を流せるよう、途中で消さない）
  pending: PendingAction | null;
  exchange: ExchangeState | null; // カード交換フェーズ中は非null
  prevChampionId: string | null; // 前回の大富豪（都落ち用）
  prevRanks: Record<string, number> | null; // 前回の順位（開始プレイヤー決定用）
  prevLastId: string | null; // 前回の大貧民（下剋上用）
  suitStreak: number; // 同じスートが連続で出た回数（縛り回数用）
  suitStreakSuit: Suit | null;
  strongBack: boolean; // 強化11バック: 場が流れても効果が続く
  omen: boolean; // オーメン成立後: 革命不可・他のカード効果無効
}

export function buildDeck(rules: Rules): Card[] {
  const suits: Suit[] = ["S", "H", "D", "C"];
  const deck: Card[] = [];
  for (const suit of suits) {
    for (let rank = 3; rank <= 15; rank++) {
      deck.push({ id: `${suit}${rank}`, suit, rank });
    }
  }
  for (let i = 0; i < rules.jokerCount; i++) {
    deck.push({ id: i === 0 ? "JOKER" : `JOKER${i + 1}`, suit: "J", rank: 20 });
  }
  return deck;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

export function sortHand(hand: Card[]): Card[] {
  const suitOrder: Record<Suit, number> = { S: 0, H: 1, D: 2, C: 3, J: 4 };
  return [...hand].sort((a, b) =>
    a.rank !== b.rank ? a.rank - b.rank : suitOrder[a.suit] - suitOrder[b.suit],
  );
}

export interface PrevGameInfo {
  winnerId?: string | null;
  ranks?: Record<string, number>; // playerId -> finish rank of previous game
  // 前のゲームで場に出されたカード（1手＝1グループ、出された順）。
  // リアリティ配りの土台になる。無い場合（最初のゲーム）はランダムで配る。
  discardGroups?: Card[][] | null;
}

/** 終わったゲームの履歴から「場に出されたカードの組（出された順）」を取り出す。 */
export function discardGroupsFromHistory(state: GameState): Card[][] {
  return state.history
    .filter((h) => h.cards != null && h.cards.length > 0)
    .map((h) => h.cards!);
}

/** 開始プレイヤーの決定（カード交換の後に手札を見て決める）。 */
export function pickStartIndex(
  players: PlayerState[],
  rules: Rules,
  prevWinnerId: string | null,
  prevRanks: Record<string, number> | null,
): { index: number; note: string } {
  let start = -1;
  let note = "";
  if (rules.startPlayer === "winner" && prevWinnerId) {
    start = players.findIndex((p) => p.id === prevWinnerId);
    if (start >= 0) note = "前回の勝者";
  }
  if (start < 0 && rules.startPlayer === "daihinmin" && prevRanks) {
    let worstRank = -1;
    for (const p of players) {
      const r = prevRanks[p.id];
      if (r != null && r > worstRank) {
        worstRank = r;
        start = players.findIndex((x) => x.id === p.id);
        note = "大貧民";
      }
    }
  }
  if (start < 0 && rules.startPlayer === "spade3") {
    start = players.findIndex((p) => p.hand.some((c) => c.id === "S3"));
    if (start >= 0) note = "♠3";
  }
  if (start < 0) {
    start = players.findIndex((p) => p.hand.some((c) => c.id === "D3"));
    note = "♦3";
  }
  if (start < 0) start = 0;
  return { index: start, note };
}

/** 献上カード（最強からcount枚。Jokerを交換しない設定ではジョーカーを除くが、
 * 枚数が足りない場合だけジョーカーで補う）。 */
export function strongestGiveCards(
  hand: Card[],
  count: number,
  noJoker: boolean,
): Card[] {
  const sorted = [...hand].sort((a, b) => b.rank - a.rank);
  if (!noJoker) return sorted.slice(0, count);
  const give = sorted.filter((c) => c.suit !== "J").slice(0, count);
  if (give.length < count) {
    give.push(
      ...sorted.filter((c) => c.suit === "J").slice(0, count - give.length),
    );
  }
  return give;
}

/** お返し・Botの「いらないカード」用：弱いカードからcount枚。
 * Jokerを交換しない設定ではジョーカーを後回しにする（枚数が足りない場合だけ使う）。 */
export function weakestGiveCards(
  hand: Card[],
  count: number,
  noJoker: boolean,
): Card[] {
  const weakestFirst = [...hand].sort((a, b) => a.rank - b.rank);
  const pool = noJoker
    ? [
        ...weakestFirst.filter((c) => c.suit !== "J"),
        ...weakestFirst.filter((c) => c.suit === "J"),
      ]
    : weakestFirst;
  return pool.slice(0, count);
}

/**
 * 軽いシャッフル（リアリティ用）：カット数回と、数枚の塊の移動数回だけ。
 * 並びの局所性がおおむね残るので、隣り合っていたカードは近くに残る。
 */
export function lightShuffle<T>(arr: T[]): T[] {
  let a = [...arr];
  if (a.length < 4) return shuffle(a);
  const cuts = 2 + Math.floor(Math.random() * 2); // 2〜3回カット
  for (let i = 0; i < cuts; i++) {
    const at = 1 + Math.floor(Math.random() * (a.length - 1));
    a = [...a.slice(at), ...a.slice(0, at)];
  }
  const moves = 3 + Math.floor(Math.random() * 3); // 4〜7枚の塊を3〜5回移動
  for (let i = 0; i < moves; i++) {
    const size = Math.min(
      a.length - 1,
      4 + Math.floor(Math.random() * 4),
    );
    if (size < 1) break;
    const from = Math.floor(Math.random() * (a.length - size + 1));
    const chunk = a.splice(from, size);
    const to = Math.floor(Math.random() * (a.length - size + 1));
    a.splice(to, 0, ...chunk);
  }
  return a;
}

/** セパレート系のグループ分け。bounds[i] 以下のランクはグループ i、
 * それより大きいランクとジョーカーは最後のグループ。 */
function separateGroups(deck: Card[], bounds: number[]): Card[][] {
  const groups: Card[][] = bounds.map(() => []);
  groups.push([]);
  for (const c of deck) {
    let gi = bounds.length;
    if (c.suit !== "J") {
      for (let i = 0; i < bounds.length; i++) {
        if (c.rank <= bounds[i]!) {
          gi = i;
          break;
        }
      }
    }
    groups[gi]!.push(c);
  }
  return groups;
}

/**
 * シャッフル設定に従って全カードを各プレイヤーへ配り、手札を作る。
 * - random: 全カードを完全シャッフルして1枚ずつ順に配る（一番偏りやすい）
 * - reality: 前のゲームの捨て札の並び（まとめて出された組は隣り合う並び）を
 *   土台にデッキを組み、軽いシャッフルにとどめて1枚ずつ順に配る。
 *   隣り合っていたカードは連続した手番に配られるため、まとめて捨てられた
 *   カード同士は別のプレイヤーに散る傾向になる。前のゲームが無い場合は
 *   ランダムで配る。
 * - separate: グループ1「3〜9」／グループ2「10〜2・Joker」に分け、
 *   各グループ内をシャッフルし、通しの順番で1枚ずつ配ることで
 *   各プレイヤーに両グループがほぼ同数ずつ行き渡る。
 * - separate3: グループ1「3〜6」／グループ2「7〜11」／グループ3「12〜2・Joker」
 *   で同様に配る。
 * dealTotal はブラインドカード用（この枚数だけ配り、残りは伏せて抜く）。
 */
export function buildDealHands(
  deck: Card[],
  playerCount: number,
  rules: Rules,
  prev?: PrevGameInfo | null,
  dealTotal?: number,
): Card[][] {
  const n = playerCount;
  const total = dealTotal ?? deck.length;
  const hands: Card[][] = Array.from({ length: n }, () => []);
  const dealInOrder = (cards: Card[], startAt = 0) => {
    cards.forEach((card, i) => {
      hands[(startAt + i) % n]!.push(card);
    });
    return startAt + cards.length;
  };

  if (rules.shuffleType === "separate" || rules.shuffleType === "separate3") {
    const bounds = rules.shuffleType === "separate" ? [9] : [6, 11];
    const groups = separateGroups(deck, bounds);
    // ブラインドカード: 余分な枚数を一番大きいグループから抜き、
    // グループごとのバランスを崩さない
    let excess = deck.length - total;
    while (excess > 0) {
      let gi = 0;
      for (let i = 1; i < groups.length; i++) {
        if (groups[i]!.length > groups[gi]!.length) gi = i;
      }
      groups[gi]!.pop();
      excess--;
    }
    let turn = 0;
    for (const g of groups) {
      turn = dealInOrder(shuffle(g), turn);
    }
    return hands;
  }

  if (
    rules.shuffleType === "reality" &&
    prev?.discardGroups &&
    prev.discardGroups.length > 0
  ) {
    const byId = new Map(deck.map((c) => [c.id, c]));
    const used = new Set<string>();
    const base: Card[] = [];
    for (const group of prev.discardGroups) {
      for (const c of group) {
        const card = byId.get(c.id);
        if (card && !used.has(card.id)) {
          used.add(card.id);
          base.push(card);
        }
      }
    }
    if (base.length > 0) {
      // 出されなかった残りのカード（手札に残った分など）は混ぜて後ろへ
      const rest = shuffle(deck.filter((c) => !used.has(c.id)));
      const ordered = lightShuffle([...base, ...rest]);
      dealInOrder(ordered.slice(0, total));
      return hands;
    }
  }

  // random、および reality で前のゲームが無い場合は完全シャッフル
  dealInOrder(shuffle(deck).slice(0, total));
  return hands;
}

export function createGame(
  players: { id: string; name: string; isBot: boolean }[],
  rules: Rules,
  prev?: PrevGameInfo,
): GameState {
  // 席替え（2ゲーム目以降）: 座席順をランダムに入れ替える
  const roster =
    rules.seatShuffle === "random" && prev?.ranks ? shuffle(players) : [...players];
  const deck = buildDeck(rules);
  const states: PlayerState[] = roster.map((p) => ({
    ...p,
    hand: [],
    finishRank: null,
  }));
  const log: string[] = [];
  // ブラインドカード: 余りカードは伏せて抜き、全員同枚数で配る
  const dealCount = rules.blindCard
    ? Math.floor(deck.length / states.length) * states.length
    : deck.length;
  if (rules.blindCard && dealCount < deck.length) {
    log.push(`ブラインドカード：余りの${deck.length - dealCount}枚を伏せて抜きました`);
  }
  // シャッフル設定（ランダム／リアリティ／セパレート／セパレート3）に従って配る
  const hands = buildDealHands(deck, states.length, rules, prev, dealCount);
  states.forEach((p, i) => {
    p.hand = sortHand(hands[i]!);
  });

  // 天変地異（2ゲーム目以降）: 大貧民の手札が全て10以下なら大富豪と手札を全交換
  if (rules.tenpenchii && prev?.ranks && states.length >= 2) {
    const ranked = states
      .filter((p) => prev.ranks![p.id] != null)
      .sort((a, b) => prev.ranks![a.id]! - prev.ranks![b.id]!);
    const champ = ranked[0];
    const last = ranked[ranked.length - 1];
    if (
      champ && last && champ.id !== last.id &&
      last.hand.length > 0 &&
      last.hand.every((c) => c.rank <= 10)
    ) {
      const tmp = champ.hand;
      champ.hand = last.hand;
      last.hand = tmp;
      log.push(`天変地異！${last.name}さん（大貧民）と${champ.name}さん（大富豪）の手札が入れ替わりました`);
    }
  }

  // カード交換（2ゲーム目以降）: 交換ペア（大貧民→大富豪 2枚、貧民→富豪 1枚）
  const pairs: { giver: PlayerState; receiver: PlayerState; count: number }[] = [];
  if (rules.cardExchange && prev?.ranks && states.length >= 3) {
    const byRank = [...states].filter((p) => prev.ranks![p.id] != null)
      .sort((a, b) => prev.ranks![a.id]! - prev.ranks![b.id]!);
    if (byRank.length >= 2) {
      const first = byRank[0]!;
      const last = byRank[byRank.length - 1]!;
      if (first.id !== last.id) pairs.push({ giver: last, receiver: first, count: 2 });
    }
    if (byRank.length >= 4) {
      const second = byRank[1]!;
      const secondLast = byRank[byRank.length - 2]!;
      if (second.id !== secondLast.id) {
        pairs.push({ giver: secondLast, receiver: second, count: 1 });
      }
    }
  }

  // 前回の大貧民（下剋上用）
  let prevLastId: string | null = null;
  if (prev?.ranks) {
    let worstRank = -1;
    for (const p of states) {
      const r = prev.ranks[p.id];
      if (r != null && r > worstRank) {
        worstRank = r;
        prevLastId = p.id;
      }
    }
  }

  const game: GameState = {
    players: states,
    field: null,
    current: 0,
    revolution: false,
    backActive: false,
    direction: 1,
    lockSuit: null,
    numberLock: false,
    passed: [],
    finishOrder: [],
    status: "playing",
    log,
    lastPlayBy: null,
    history: [],
    pending: null,
    exchange: null,
    prevChampionId: prev?.winnerId ?? null,
    prevRanks: prev?.ranks ?? null,
    prevLastId,
    suitStreak: 0,
    suitStreakSuit: null,
    strongBack: rules.strongElevenBack,
    omen: false,
  };

  if (pairs.length > 0) {
    // カード交換フェーズ：献上（貧民側）は「貧民のカード選択」ONなら自分で選ぶ。
    // OFFでも、献上側が人間の場合は自動決定せず未決定で始める：まず配られた
    // 手札を見せ、渡すカード（最強カード）を光らせてから、本人が
    // 「カード交換する」を押して初めて確定する（画面側の確認ステップ）。
    // CPUの献上は従来どおり（OFFなら最強カードで自動決定、ONならBot処理が選ぶ）。
    // お返し（大富豪・富豪側）は常に自分で「いらないカード」を選ぶ
    // （CPUは最も弱いカードを自動で選ぶ）。
    game.exchange = {
      mode: rules.exchangeMode,
      steps: pairs.map((p) => ({
        giverId: p.giver.id,
        receiverId: p.receiver.id,
        count: p.count,
        giveIds:
          rules.exchangeChoice || !p.giver.isBot
            ? null
            : strongestGiveCards(p.giver.hand, p.count, rules.exchangeNoJoker).map(
                (c) => c.id,
              ),
        backIds: null,
      })),
      index: 0,
    };
    const firstDecider = exchangeDecider(game.exchange.steps[0]!);
    game.current = Math.max(
      0,
      states.findIndex((p) => p.id === firstDecider),
    );
    const humanGivePending = game.exchange.steps.some((s) => {
      const giver = states.find((p) => p.id === s.giverId);
      return s.giveIds == null && giver != null && !giver.isBot;
    });
    log.push(
      rules.exchangeChoice
        ? "カード交換：貧民側が渡すカードを選んでください"
        : humanGivePending
          ? "カード交換：貧民・大貧民が渡すカードを確認してください"
          : "カード交換：大富豪・富豪が渡すカードを選んでください",
    );
  } else {
    const { index, note } = pickStartIndex(
      states,
      rules,
      game.prevChampionId,
      game.prevRanks,
    );
    game.current = index;
    log.push(`${states[index]!.name}さん（${note}）からスタート！`);
  }
  return game;
}

/** 1回分のカード交換を実際に適用する（献上→同数のお返し）。
 * お返しは大富豪側が選んだカード（backIds）。未指定（旧データ等）は最弱カードで補う。 */
function applyExchangeStep(state: GameState, rules: Rules, step: ExchangeStep) {
  const giver = state.players.find((p) => p.id === step.giverId);
  const receiver = state.players.find((p) => p.id === step.receiverId);
  if (!giver || !receiver || !step.giveIds) return;
  const give = step.giveIds
    .map((id) => giver.hand.find((c) => c.id === id))
    .filter((c): c is Card => !!c);
  const chosenBack = step.backIds
    ? step.backIds
        .map((id) => receiver.hand.find((c) => c.id === id))
        .filter((c): c is Card => !!c)
    : [];
  const back =
    chosenBack.length === step.count
      ? chosenBack
      : weakestGiveCards(receiver.hand, step.count, rules.exchangeNoJoker);
  giver.hand = sortHand(giver.hand.filter((c) => !give.includes(c)));
  receiver.hand = sortHand(receiver.hand.filter((c) => !back.includes(c)));
  giver.hand = sortHand([...giver.hand, ...back]);
  receiver.hand = sortHand([...receiver.hand, ...give]);
  state.log.push(
    `カード交換：${giver.name}さんが${receiver.name}さんへ${give.map(cardLabel).join(" ")}を渡しました`,
  );
  void rules;
}

/** 交換が全て終わったら開始プレイヤーを決めて対局を始める。 */
function finalizeExchange(state: GameState, rules: Rules) {
  state.exchange = null;
  const { index, note } = pickStartIndex(
    state.players,
    rules,
    state.prevChampionId,
    state.prevRanks,
  );
  state.current = index;
  state.log.push(`${state.players[index]!.name}さん（${note}）からスタート！`);
}

/** 交換フェーズでカードを提出する。提出者がそのステップの献上側なら献上カード、
 * お返し側（大富豪・富豪）ならお返しカードとして記録する。 */
export function resolveExchange(
  state: GameState,
  rules: Rules,
  playerId: string,
  cardIds: string[],
): { ok: boolean; reason: string } {
  const ex = state.exchange;
  if (!ex) return { ok: false, reason: "カード交換中ではありません" };
  let step: ExchangeStep | undefined;
  let role: "give" | "back" | null = null;
  const roleOf = (s: ExchangeStep): "give" | "back" | null =>
    s.giveIds === null && s.giverId === playerId
      ? "give"
      : s.backIds === null && s.receiverId === playerId
        ? "back"
        : null;
  if (ex.mode === "order") {
    step = ex.steps[ex.index];
    if (!step) return { ok: false, reason: "あなたの交換は終わっています" };
    role = roleOf(step);
    if (!role) return { ok: false, reason: "あなたの交換の番ではありません" };
  } else {
    step = ex.steps.find((s) => roleOf(s) !== null);
    if (!step) return { ok: false, reason: "あなたの交換は終わっています" };
    role = roleOf(step);
  }
  const actor = state.players.find((p) => p.id === playerId);
  if (!actor) return { ok: false, reason: "プレイヤーが見つかりません" };
  if (cardIds.length !== step.count) {
    return { ok: false, reason: `ちょうど${step.count}枚選んでください` };
  }
  if (new Set(cardIds).size !== cardIds.length) {
    return { ok: false, reason: "同じカードは選べません" };
  }
  const cards = cardIds.map((id) => actor.hand.find((c) => c.id === id));
  if (cards.some((c) => !c)) return { ok: false, reason: "そのカードは手札にありません" };
  if (role === "give" && rules.exchangeNoJoker && (cards as Card[]).some((c) => c.suit === "J")) {
    return { ok: false, reason: "「Jokerを交換しない」設定のため、ジョーカーは渡せません" };
  }
  if (role === "give") step.giveIds = [...cardIds];
  else step.backIds = [...cardIds];

  const stepDone = (s: ExchangeStep) => s.giveIds != null && s.backIds != null;
  if (ex.mode === "order") {
    if (stepDone(step)) {
      applyExchangeStep(state, rules, step);
      ex.index += 1;
      if (ex.index >= ex.steps.length) {
        finalizeExchange(state, rules);
        return { ok: true, reason: "" };
      }
      const nextStep = ex.steps[ex.index]!;
      const decider = exchangeDecider(nextStep);
      state.current = Math.max(
        0,
        state.players.findIndex((p) => p.id === decider),
      );
    } else {
      const decider = exchangeDecider(step);
      state.current = Math.max(
        0,
        state.players.findIndex((p) => p.id === decider),
      );
    }
  } else if (ex.steps.every(stepDone)) {
    for (const s of ex.steps) applyExchangeStep(state, rules, s);
    finalizeExchange(state, rules);
  } else {
    const nextStep = ex.steps.find((s) => !stepDone(s))!;
    const decider = exchangeDecider(nextStep);
    state.current = Math.max(
      0,
      state.players.findIndex((p) => p.id === decider),
    );
  }
  return { ok: true, reason: "" };
}

/** Botの交換カード決定を進める（献上・お返しとも最も弱い不要カードを選ぶ）。
 * 人間の決定待ちになったらfalseを返す。 */
export function advanceExchange(state: GameState, rules: Rules): boolean {
  let progressed = false;
  while (state.exchange) {
    const ex = state.exchange;
    const targets =
      ex.mode === "order"
        ? [ex.steps[ex.index]].filter((s): s is ExchangeStep => !!s)
        : ex.steps;
    let acted = false;
    for (const step of targets) {
      const deciderId = exchangeDecider(step);
      if (!deciderId) continue;
      const decider = state.players.find((p) => p.id === deciderId);
      if (!decider || !decider.isBot) continue;
      const give = weakestGiveCards(
        decider.hand,
        step.count,
        rules.exchangeNoJoker,
      ).map((c) => c.id);
      if (give.length < step.count) continue;
      const res = resolveExchange(state, rules, decider.id, give);
      if (res.ok) {
        acted = true;
        progressed = true;
      }
    }
    if (!acted) break;
  }
  return progressed;
}

export function isReversed(state: GameState): boolean {
  return state.revolution !== state.backActive;
}

function isFinished(state: GameState): boolean {
  return state.status === "finished";
}

/** Rank of a set, or null when the cards don't form a legal set. */
export function setRank(cards: Card[]): number | null {
  if (cards.length === 0) return null;
  const nonJoker = cards.filter((c) => c.suit !== "J");
  if (nonJoker.length === 0) return 20;
  const rank = nonJoker[0]!.rank;
  if (nonJoker.some((c) => c.rank !== rank)) return null;
  return rank;
}

/** The single suit of a set (ignoring jokers), or null when mixed / joker-only. */
export function setSuit(cards: Card[]): Suit | null {
  const nonJoker = cards.filter((c) => c.suit !== "J");
  if (nonJoker.length === 0) return null;
  const suit = nonJoker[0]!.suit;
  return nonJoker.every((c) => c.suit === suit) ? suit : null;
}

/** Shared math for run-like sets (階段 / エンペラー): distinct consecutive
 * ranks with jokers filling gaps or extending the top. */
function seqMath(
  nonJoker: Card[],
  jokerCount: number,
): { top: number; low: number; actualTop: number } | null {
  const ranks = nonJoker.map((c) => c.rank).sort((a, b) => a - b);
  if (new Set(ranks).size !== ranks.length) return null;
  const span = ranks[ranks.length - 1]! - ranks[0]! + 1;
  const gaps = span - ranks.length;
  if (gaps > jokerCount) return null;
  const extra = jokerCount - gaps;
  const top = Math.min(15, ranks[ranks.length - 1]! + extra);
  return { top, low: ranks[0]!, actualTop: ranks[ranks.length - 1]! };
}

/** 階段: same-suit sequence of 3+ cards (jokers wild). */
export function sequenceInfo(
  cards: Card[],
): { suit: Suit; top: number; low: number; actualTop: number } | null {
  if (cards.length < 3) return null;
  const nonJoker = cards.filter((c) => c.suit !== "J");
  if (nonJoker.length === 0) return null;
  const suit = nonJoker[0]!.suit;
  if (nonJoker.some((c) => c.suit !== suit)) return null;
  const m = seqMath(nonJoker, cards.length - nonJoker.length);
  return m ? { suit, ...m } : null;
}

/** エンペラー: 4 cards, every non-joker suit different, ranks consecutive
 * (jokers wild). Treated as a sequence for field matching and reversal. */
export function emperorInfo(
  cards: Card[],
): { top: number; low: number; actualTop: number } | null {
  if (cards.length !== 4) return null;
  const nonJoker = cards.filter((c) => c.suit !== "J");
  if (nonJoker.length === 0) return null;
  const suits = nonJoker.map((c) => c.suit);
  if (new Set(suits).size !== suits.length) return null;
  return seqMath(nonJoker, cards.length - nonJoker.length);
}

const SUIT_NAME: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣", J: "ジョーカー" };

export function canPlay(
  state: GameState,
  rules: Rules,
  cards: Card[],
): { ok: boolean; reason: string } {
  let rank = setRank(cards);
  let seq = rules.stairs ? sequenceInfo(cards) : null;
  // 階段の最小枚数
  if (seq && cards.length < rules.stairsMin) seq = null;
  const emp = rules.emperor ? emperorInfo(cards) : null;
  // Jokerの効果範囲: 組のみ=階段に使えない / 階段のみ=組に使えない
  const hasJoker = cards.some((c) => c.suit === "J");
  const nonJokerCount = cards.filter((c) => c.suit !== "J").length;
  if (hasJoker && rules.jokerEffect === "groups") seq = null;
  const empJokerBlocked = hasJoker && rules.jokerEffect === "groups";
  if (rank !== null && hasJoker && nonJokerCount > 0 && rules.jokerEffect === "stairs") {
    rank = null;
  }
  // 階段とエンペラーはどちらも「連番」として扱う（数値情報は同一形式）
  const seqLike = seq ?? (empJokerBlocked ? null : emp);
  if (rank === null && seqLike === null) {
    return {
      ok: false,
      reason: rules.stairs
        ? "同じ数字か、階段（同じマークの連番）で出してください"
        : "同じ数字の組み合わせで出してください",
    };
  }
  // 砂嵐: 3を3枚なら、どんな場にも出せる
  if (rules.sandstorm && cards.length === 3 && rank === 3) {
    return { ok: true, reason: "" };
  }
  const field = state.field;
  if (!field) return { ok: true, reason: "" };
  if (cards.length !== field.cards.length) {
    return { ok: false, reason: `場と同じ${field.cards.length}枚で出してください` };
  }
  const reversed = isReversed(state);
  // スペ3返し（縛りより優先される特殊な返し）
  if (
    rules.spade3 &&
    cards.length === 1 &&
    cards[0]!.id === "S3" &&
    field.cards.length === 1 &&
    field.cards[0]!.suit === "J"
  ) {
    return { ok: true, reason: "" };
  }
  // この出し方の実効数字（組=数字、階段/エンペラー=一番上）と単一スート
  const isSeqPlay = seqLike !== null && rank === null;
  const playRank = isSeqPlay ? seqLike!.top : rank!;
  const effSuit = setSuit(cards) ?? seq?.suit ?? null;

  // 縛り判定（スート縛り＋数縛り）。両方かかっているときは両しばの方式で適用
  const suitLocked = state.lockSuit !== null;
  const numLocked = state.numberLock;
  if (suitLocked || numLocked) {
    const suitOk = !suitLocked || effSuit === null || effSuit === state.lockSuit;
    const requiredRank = field.rank + (reversed ? -1 : 1);
    const numOk = !numLocked || playRank === requiredRank;
    if (suitLocked && numLocked && rules.ryoShibari === "either") {
      if (!suitOk && !numOk) {
        return {
          ok: false,
          reason: `縛り中です：${SUIT_NAME[state.lockSuit!]}か、${rankLabelText(requiredRank)}のどちらかを出してください`,
        };
      }
    } else {
      if (!suitOk) {
        return { ok: false, reason: `縛り中です：${SUIT_NAME[state.lockSuit!]}しか出せません` };
      }
      if (!numOk) {
        return { ok: false, reason: `数縛り中です：${rankLabelText(requiredRank)}しか出せません` };
      }
    }
  }

  if (field.kind === "sequence") {
    if (!isSeqPlay) return { ok: false, reason: "場が階段なので、階段で出してください" };
    // 階段の強さ: トップ=ジョーカー込みの一番上 / 重なる=実際のカードの一番強い数字
    const playKey = rules.stairsStrength === "overlap" ? seqLike!.actualTop : seqLike!.top;
    const fieldKey =
      rules.stairsStrength === "overlap" ? (field.actualTop ?? field.rank) : field.rank;
    if (reversed ? playKey < fieldKey : playKey > fieldKey) {
      return { ok: true, reason: "" };
    }
    return {
      ok: false,
      reason: reversed ? "場より弱い階段を出してください（逆転中）" : "場より強い階段を出してください",
    };
  }
  if (isSeqPlay) {
    return { ok: false, reason: "場が階段ではないので、階段は出せません" };
  }
  // ジョーカーは常に最強：ジョーカーのみの組は、革命・11バックで強さが
  // 逆転していても場のどの数字にも勝ち、逆にジョーカーのみの場には
  // 通常のカードでは出せない（スペ3返しは上の特殊判定で許可済み）
  if (field.rank === 20) {
    return { ok: false, reason: "ジョーカーの場には出せません" };
  }
  if (playRank === 20) {
    return { ok: true, reason: "" };
  }
  if (reversed ? playRank < field.rank : playRank > field.rank) {
    return { ok: true, reason: "" };
  }
  // ダウンナンバー: 場と同じスートで1つ弱いカードも出せる
  if (rules.downNumber && field.suit) {
    const suit = setSuit(cards);
    const oneWeaker = reversed ? field.rank + 1 : field.rank - 1;
    if (suit !== null && suit === field.suit && playRank === oneWeaker) {
      return { ok: true, reason: "" };
    }
  }
  return {
    ok: false,
    reason: reversed ? "場より弱いカードを出してください（逆転中）" : "場より強いカードを出してください",
  };
}

function activePlayers(state: GameState): PlayerState[] {
  return state.players.filter((p) => p.finishRank === null);
}

function nextActiveIndex(state: GameState, from: number, skipPassed: boolean): number {
  const n = state.players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (((from + step * state.direction) % n) + n) % n;
    const p = state.players[idx]!;
    if (p.finishRank !== null) continue;
    if (skipPassed && state.field && state.passed.includes(p.id)) continue;
    if (skipPassed && state.field && p.id === state.field.ownerId) continue;
    return idx;
  }
  return from;
}

function rankLabel(rankPos: number, total: number): string {
  if (rankPos === 1) return "大富豪";
  if (rankPos === total) return "大貧民";
  if (total >= 4 && rankPos === 2) return "富豪";
  if (total >= 4 && rankPos === total - 1) return "貧民";
  return "平民";
}

export function rankLabelOf(state: GameState, player: PlayerState): string | null {
  if (player.finishRank === null) return null;
  return rankLabel(player.finishRank, state.players.length);
}

function checkFinish(state: GameState, rules: Rules, player: PlayerState) {
  if (player.hand.length !== 0 || player.finishRank !== null) return;
  player.finishRank = state.finishOrder.length + 1;
  state.finishOrder.push(player.id);
  state.log.push(`🎉 ${player.name}さんが${player.finishRank}位で上がり！`);

  // 都落ち: 前回の大富豪が1位を逃したら、その場で大貧民になって対局終了
  if (
    rules.miyakoOchi &&
    player.finishRank === 1 &&
    state.prevChampionId &&
    state.prevChampionId !== player.id
  ) {
    const champ = state.players.find((p) => p.id === state.prevChampionId);
    if (champ && champ.finishRank === null) {
      const rest = state.players.filter(
        (p) => p.finishRank === null && p.id !== champ.id,
      );
      for (const p of rest) {
        p.finishRank = state.finishOrder.length + 1;
        state.finishOrder.push(p.id);
      }
      champ.finishRank = state.players.length;
      state.finishOrder.push(champ.id);
      state.status = "finished";
      state.log.push(`都落ち！前回の大富豪 ${champ.name}さんは大貧民に…`);
      return;
    }
  }

  // 下剋上: 前回の大貧民が1位で上がったら、前回の大富豪がその場で大貧民に落ちて対局終了
  if (
    rules.gekokujo &&
    player.finishRank === 1 &&
    state.prevLastId === player.id &&
    state.prevChampionId &&
    state.prevChampionId !== player.id &&
    state.players.length >= 3
  ) {
    const champ = state.players.find((p) => p.id === state.prevChampionId);
    if (champ && champ.finishRank === null) {
      const rest = state.players.filter(
        (p) => p.finishRank === null && p.id !== champ.id,
      );
      for (const p of rest) {
        p.finishRank = state.finishOrder.length + 1;
        state.finishOrder.push(p.id);
      }
      champ.finishRank = state.players.length;
      state.finishOrder.push(champ.id);
      state.status = "finished";
      state.log.push(
        `下剋上！前回の大貧民 ${player.name}さんが大富豪に成り上がり、前回の大富豪 ${champ.name}さんは大貧民に…`,
      );
      return;
    }
  }

  const remaining = activePlayers(state);
  if (remaining.length === 1) {
    const last = remaining[0]!;
    last.finishRank = state.players.length;
    state.finishOrder.push(last.id);
    state.status = "finished";
    state.log.push(`対局終了！ ${last.name}さんは${state.players.length}位でした`);
  }
}

function clearField(state: GameState) {
  state.field = null;
  state.passed = [];
  if (!state.strongBack) state.backActive = false;
  state.lockSuit = null;
  state.numberLock = false;
  // 履歴は消さず、「場が流れた」マーカーを積む。クライアントは履歴を
  // 1手ずつ再生するので、流れる直前のカードや最後のパスも必ず表示され、
  // 全員分の手が再生し終わってから山が退場する。
  const lastEntry = state.history[state.history.length - 1];
  if (state.history.length > 0 && !lastEntry?.flow) {
    state.history = [
      ...state.history,
      { playerId: "", name: "", cards: null, note: null, flow: true },
    ];
  }
  state.suitStreak = 0;
  state.suitStreakSuit = null;
}

/** パス制限ONの自動パス処理。
 * 現在の手番プレイヤーが、その場ですでにパスしている人なら、本人の操作を
 * 待たずに自動でパスしたものとして履歴・ログに残し、手番を次へ進める。
 * 場の持ち主まで手番が戻ってきて、持ち主以外の全員がパス済みなら場を流す。
 * 進展があった場合に true を返す。パス制限OFFでは何もしない。 */
export function settlePassLimit(state: GameState, rules: Rules): boolean {
  if (!rules.passLimit) return false;
  let progressed = false;
  let guard = 0;
  while (
    state.status === "playing" &&
    state.field &&
    !state.pending &&
    !state.exchange &&
    guard++ < 30
  ) {
    const cur = state.players[state.current];
    if (!cur || cur.finishRank !== null) break;
    const field = state.field;
    if (cur.id === field.ownerId) {
      // 持ち主まで戻ってきた: 他全員がパス済みなら場を流して持ち主が続けて出せる
      const others = state.players.filter(
        (p) => p.finishRank === null && p.id !== field.ownerId,
      );
      if (others.length > 0 && others.every((p) => state.passed.includes(p.id))) {
        const ownerIdx = state.players.findIndex((p) => p.id === field.ownerId);
        const owner = state.players[ownerIdx]!;
        clearField(state);
        state.log.push("全員パスしたので場が流れました");
        state.current =
          owner.finishRank === null
            ? ownerIdx
            : nextActiveIndex(state, ownerIdx, false);
        progressed = true;
      }
      break;
    }
    if (!state.passed.includes(cur.id)) break;
    // この場でパス済みの人の番は自動パス（履歴チップで分かるように残す）
    state.log.push(`${cur.name}さんはパス制限により自動パスしました`);
    state.history = [
      ...state.history,
      { playerId: cur.id, name: cur.name, cards: null, note: "自動パス（パス制限）" },
    ];
    progressed = true;
    state.current = nextActiveIndex(state, state.current, false);
  }
  return progressed;
}

/** Whether card effects (8切り・スキップ等) fire for this play. */
function effectsAllowed(state: GameState, rules: Rules, playCards: Card[]): boolean {
  if (state.omen) return false; // オーメン成立後は他のカード効果が無効
  if (!rules.stairsEffects && rules.stairs) {
    const isSeq =
      (sequenceInfo(playCards) !== null || emperorInfo(playCards) !== null) &&
      setRank(playCards) === null;
    if (isSeq) return false; // 階段中のカード効果は発動しない設定
  }
  return true;
}

/** Turn advancement after a play (8切り / スペ3返し / 砂嵐 / 救急車 / ろくろ首 / スキップ / 次の人へ).
 * prevFieldCards = 場に出す直前に場にあったカード（スペ3返しの判定用）。 */
function advanceAfterPlay(
  state: GameState,
  rules: Rules,
  playerIdx: number,
  playCards: Card[],
  prevFieldCards?: Card[] | null,
) {
  const player = state.players[playerIdx]!;
  const wasFinished = player.finishRank !== null;
  if (state.status === "finished") return;
  const fx = effectsAllowed(state, rules, playCards);
  const rank = setRank(playCards);

  // 場が流れる特殊な出し方: 同じプレイヤーが続けて出せる（上がった場合は次へ）
  let flowLabel: string | null = null;
  if (
    fx &&
    rules.spade3 &&
    prevFieldCards != null &&
    prevFieldCards.length === 1 &&
    prevFieldCards[0]!.suit === "J" &&
    playCards.length === 1 &&
    playCards[0]!.id === "S3"
  ) {
    // スペ3返し: ジョーカーに♠3で返したら場が流れる
    flowLabel = "スペ3返し！場が流れました";
  } else if (fx && rules.sandstorm && playCards.length === 3 && rank === 3) {
    flowLabel = "砂嵐！場が流れました";
  } else if (fx && rules.eightCut && playCards.some((c) => c.rank === 8 && c.suit !== "J")) {
    flowLabel = "8切り！場が流れました";
  } else if (fx && rules.ambulance && playCards.length === 2 && rank === 9) {
    flowLabel = "救急車（99車）！場が流れました";
  } else if (fx && rules.rokurokubi && playCards.length === 2 && rank === 6) {
    flowLabel = "ろくろ首！場が流れました";
  }
  // 4止め: 8切りが発生するとき、8の2倍枚数の4を持つプレイヤー（最初に該当する人）が止めるか選べる
  if (
    flowLabel === "8切り！場が流れました" &&
    rules.fourStop &&
    !state.pending
  ) {
    const eights = playCards.filter((c) => c.rank === 8 && c.suit !== "J").length;
    const need = eights * 2;
    const n = state.players.length;
    for (let step = 1; step < n; step++) {
      const idx = (((playerIdx + step * state.direction) % n) + n) % n;
      const cand = state.players[idx]!;
      if (cand.finishRank !== null || cand.id === player.id) continue;
      const fours = cand.hand.filter((c) => c.rank === 4 && c.suit !== "J").length;
      if (fours >= need) {
        state.pending = {
          type: "fourStop",
          playerId: cand.id,
          maxCount: need,
          playedCards: playCards,
        };
        state.current = idx;
        state.log.push(
          `4止め：${cand.name}さんは4を${need}枚持っています。8切りを止められます`,
        );
        return;
      }
    }
  }
  if (flowLabel) {
    state.log.push(flowLabel);
    clearField(state);
    state.current = wasFinished ? nextActiveIndex(state, playerIdx, false) : playerIdx;
    return;
  }

  // スキップ: 5（と13=K）の枚数分、次のプレイヤーを飛ばす
  if (rules.passLimit) {
    // パス制限ON: 次の手番は素直に次の人へ。スキップは「1回休み」として
    // その人を飛ばすだけにし、任意パスとは別扱いにする（passedには入れない:
    // 入れると場が流れるまで出られなくなってしまうため）。
    // パス済みの人に手番が回ったら、この後の settlePassLimit が自動パスにする。
    let next = nextActiveIndex(state, playerIdx, false);
    if (fx && rules.skip) {
      const skipCount =
        (rules.skip5 ? playCards.filter((c) => c.rank === 5 && c.suit !== "J").length : 0) +
        (rules.skip13 ? playCards.filter((c) => c.rank === 13 && c.suit !== "J").length : 0);
      for (let k = 0; k < skipCount; k++) {
        const skipped = state.players[next]!;
        if (skipped.id === player.id) break;
        state.log.push(`スキップ！${skipped.name}さんは1回休み`);
        state.history = [
          ...state.history,
          { playerId: skipped.id, name: skipped.name, cards: null, note: "スキップ（1回休み）" },
        ];
        next = nextActiveIndex(state, next, false);
      }
    }
    state.current = next;
    settlePassLimit(state, rules);
    return;
  }
  let next = nextActiveIndex(state, playerIdx, true);
  if (fx && rules.skip) {
    const skipCount =
      (rules.skip5 ? playCards.filter((c) => c.rank === 5 && c.suit !== "J").length : 0) +
      (rules.skip13 ? playCards.filter((c) => c.rank === 13 && c.suit !== "J").length : 0);
    for (let k = 0; k < skipCount; k++) {
      const skipped = state.players[next]!;
      if (skipped.id === player.id) break;
      state.log.push(`スキップ！${skipped.name}さんは1回休み`);
      state.passed = [...state.passed, skipped.id];
      next = nextActiveIndex(state, playerIdx, true);
    }
  }
  state.current = next;
}

/** この出し方が革命（クーデター等の派生含む）を起こすかどうか。 */
export function checkRevolutionTrigger(
  rules: Rules,
  cards: Card[],
  omenActive: boolean,
): boolean {
  if (omenActive) return false; // オーメン成立後は革命不可
  const rank = setRank(cards);
  const rankCount = (r: number) => cards.filter((c) => c.rank === r).length;
  const jokerOk = rules.revolutionJoker || !cards.some((c) => c.suit === "J");
  if (rules.revolution && rank !== null && cards.length >= 4 && jokerOk) return true;
  const seq = rules.stairs ? sequenceInfo(cards) : null;
  if (
    rules.stairsRevolution &&
    seq !== null && rank === null && cards.length >= 5 && jokerOk
  ) {
    return true;
  }
  if (
    rules.coupDetat &&
    rank === 9 && (rankCount(9) >= 3 || (rules.revolutionJoker && cards.length >= 3))
  ) {
    return true;
  }
  if (
    rules.nanasanRevolution &&
    rank === 7 && (rankCount(7) >= 3 || (rules.revolutionJoker && cards.length >= 3))
  ) {
    return true;
  }
  if (
    rules.omen &&
    rank === 6 && (rankCount(6) >= 3 || (rules.revolutionJoker && cards.length >= 3))
  ) {
    return true;
  }
  // エンペラー: 異なるスート4枚の連番でも革命が起きる
  if (rules.emperor && emperorInfo(cards) !== null && jokerOk) return true;
  return false;
}

/** 禁止あがりの対象に当たるカード名の一覧（マスター設定OFFなら空）。
 * この手を出して手札が0枚になる場合にだけ意味を持つ。 */
export function forbiddenFinishHits(rules: Rules, playCards: Card[]): string[] {
  if (!rules.forbiddenFinish) return [];
  const hits: string[] = [];
  const has = (r: number) => playCards.some((c) => c.rank === r && c.suit !== "J");
  if (rules.forbid2 && has(15)) hits.push("2");
  if (rules.forbid8 && has(8)) hits.push("8");
  if (rules.forbidQBomber && has(12)) hits.push("Q（12ボンバー）");
  if (rules.forbid11Back && has(11)) hits.push("J（11バック）");
  if (rules.forbid7Pass && has(7)) hits.push("7（7渡し）");
  if (rules.forbid10Discard && has(10)) hits.push("10（10捨て）");
  if (rules.forbidSpade3 && playCards.length === 1 && playCards[0]!.id === "S3") {
    hits.push("スペ3");
  }
  const jokers = playCards.filter((c) => c.suit === "J").length;
  if (rules.forbidJoker === "all" && jokers > 0) hits.push("ジョーカー");
  if (
    rules.forbidJoker === "yasashii" &&
    playCards.length === 1 &&
    playCards[0]!.suit === "J"
  ) {
    hits.push("ジョーカー単体");
  }
  return hits;
}

/** その手を出すと禁止あがりで弾かれるかどうか（手札が0枚になる手だけ対象）。 */
export function isForbiddenFinishPlay(
  rules: Rules,
  handSize: number,
  playCards: Card[],
): boolean {
  return (
    playCards.length === handSize && forbiddenFinishHits(rules, playCards).length > 0
  );
}

/** CPUの革命選択の判断: 残り手札が弱いときは革命（または維持）を望む。 */
function botWantsRevolution(state: GameState, player: PlayerState): boolean {
  const rest = player.hand.filter((c) => c.suit !== "J");
  if (rest.length === 0) return true;
  const avg = rest.reduce((s, c) => s + c.rank, 0) / rest.length;
  // 革命していないとき: 弱い手札なら起こす / 革命中: 強い手札なら鎮圧する
  return state.revolution ? avg >= 10.5 : avg <= 9.5;
}

export function applyPlay(
  state: GameState,
  rules: Rules,
  playerIdx: number,
  cardIds: string[],
  opts?: { revolution?: boolean },
): { ok: boolean; reason: string } {
  if (state.status !== "playing") return { ok: false, reason: "対局は終了しています" };
  if (state.exchange) return { ok: false, reason: "カード交換中です" };
  if (state.pending) return { ok: false, reason: "先にカードの受け渡しをしてください" };
  if (state.current !== playerIdx) return { ok: false, reason: "あなたの番ではありません" };
  const player = state.players[playerIdx]!;
  const cards = cardIds.map((id) => player.hand.find((c) => c.id === id));
  if (cards.some((c) => !c)) return { ok: false, reason: "そのカードは手札にありません" };
  const playCards = cards as Card[];
  // パス制限ON: その場ですでにパスした人は、場が流れるまで出せない
  // （通常は手番が回る前に settlePassLimit が自動パスで進めているため、
  // ここに来るのは直接の操作だけ。その場合も理由を返して弾く）
  if (rules.passLimit && state.field && state.passed.includes(player.id)) {
    return {
      ok: false,
      reason: "パス制限：一度パスしたので、この場が流れるまでは出せません",
    };
  }
  // パス制限OFFでは、一度パスしても、その場が流れるまでは再びカードを出せる
  const check = canPlay(state, rules, playCards);
  if (!check.ok) return check;

  // 禁止あがり（詳細設定）: 手札が0枚になる出し方のうち、禁止対象を含むものは禁止
  if (player.hand.length === playCards.length) {
    const hits = forbiddenFinishHits(rules, playCards);
    if (hits.length > 0) {
      return { ok: false, reason: `禁止あがり：${hits.join("・")}では上がれません` };
    }
  }

  const rank = setRank(playCards);
  const seq = rules.stairs ? sequenceInfo(playCards) : null;
  const emp = rules.emperor ? emperorInfo(playCards) : null;
  const seqLike = seq ?? emp;
  const prevFieldSuit = state.field?.suit ?? null;
  const prevFieldRank = state.field?.rank ?? null;
  const prevFieldCards = state.field?.cards ?? null;
  const reversedBefore = isReversed(state);
  player.hand = sortHand(player.hand.filter((c) => !cardIds.includes(c.id)));

  let note = "";
  const fx = effectsAllowed(state, rules, playCards);
  // スペ3返し（ジョーカー単体へ♠3単体）: 場が流れる（advanceAfterPlayで処理）
  if (
    rules.spade3 &&
    prevFieldCards !== null &&
    prevFieldCards.length === 1 &&
    prevFieldCards[0]!.suit === "J" &&
    playCards.length === 1 &&
    playCards[0]!.id === "S3"
  ) {
    note += " スペ3返し！";
  }
  // 革命いろいろ（オーメン成立後は革命不可）
  const rankCount = (r: number) => playCards.filter((c) => c.rank === r).length;
  let revolutionTriggered = checkRevolutionTrigger(rules, playCards, state.omen);
  let omenTriggered =
    revolutionTriggered &&
    rules.omen &&
    rank === 6 &&
    (rankCount(6) >= 3 || (rules.revolutionJoker && playCards.length >= 3));
  if (revolutionTriggered) {
    if (
      rules.coupDetat &&
      rank === 9 && (rankCount(9) >= 3 || (rules.revolutionJoker && playCards.length >= 3))
    ) {
      note += " クーデター！";
    } else if (
      rules.nanasanRevolution &&
      rank === 7 && (rankCount(7) >= 3 || (rules.revolutionJoker && playCards.length >= 3))
    ) {
      note += " ナナサン革命！";
    } else if (emp !== null && seq === null) {
      note += " エンペラー！";
    }
    if (omenTriggered) {
      note += " オーメン！以後、革命は起きず他のカード効果も無効になります";
    }
  }
  // 革命選択: 起こせる場面で、起こすかどうかを選べる
  if (revolutionTriggered && rules.revolutionChoice) {
    const doRev =
      opts?.revolution !== undefined
        ? opts.revolution
        : player.isBot
          ? botWantsRevolution(state, player)
          : true;
    if (!doRev) {
      revolutionTriggered = false;
      omenTriggered = false;
      note += " （革命は起こさなかった）";
    }
  }
  if (revolutionTriggered) {
    // 革命返し「なし」: 革命中に再び条件を満たしても元に戻らない
    if (!(rules.revolutionReturn === "none" && state.revolution)) {
      state.revolution = !state.revolution;
      note += state.revolution ? " 革命発生！" : " 革命鎮圧！";
    }
    if (omenTriggered) state.omen = true;
  }
  // 11バック
  if (fx && rules.elevenBack && playCards.some((c) => c.rank === 11 && c.suit !== "J")) {
    state.backActive = !state.backActive;
    note += " 11バック！";
  }
  // リバース（9 / 12）
  if (
    fx && rules.reverse &&
    ((rules.reverse9 && playCards.some((c) => c.rank === 9 && c.suit !== "J")) ||
      (rules.reverse12 && playCards.some((c) => c.rank === 12 && c.suit !== "J")))
  ) {
    state.direction = state.direction === 1 ? -1 : 1;
    note += " リバース！進行方向が逆になりました";
  }
  // 縛り: 同じスートが「縛り回数」ぶん続いたら縛り発生
  const playSuit = setSuit(playCards) ?? seq?.suit ?? null;
  if (playSuit !== null && playSuit === state.suitStreakSuit) {
    state.suitStreak += 1;
  } else {
    state.suitStreak = playSuit !== null ? 1 : 0;
    state.suitStreakSuit = playSuit;
  }
  const suitTrigger =
    rules.shibari &&
    prevFieldSuit !== null &&
    playSuit !== null &&
    playSuit === prevFieldSuit &&
    state.suitStreak - 1 >= rules.shibariCount;
  // 数しば: 場の数字の1つ強い数字を出すと、数字縛りが発生する
  const playEffRank = seqLike !== null && rank === null ? seqLike.top : rank;
  const numTrigger =
    rules.numberShibari &&
    prevFieldRank !== null &&
    playEffRank !== null &&
    playEffRank === prevFieldRank + (reversedBefore ? -1 : 1);
  if (rules.gekiShibari && (suitTrigger || numTrigger)) {
    // 激しば: スート縛りと数字縛りが同時にかかる
    if (playSuit !== null && state.lockSuit !== playSuit) {
      note += ` ${SUIT_NAME[playSuit]}縛り！`;
    }
    if (playSuit !== null) state.lockSuit = playSuit;
    if (!state.numberLock) note += " 数縛り！";
    state.numberLock = true;
    note += " 激縛り！";
  } else {
    if (suitTrigger) {
      if (state.lockSuit !== playSuit) note += ` ${SUIT_NAME[playSuit!]}縛り！`;
      state.lockSuit = playSuit;
    }
    if (numTrigger && !state.numberLock) {
      state.numberLock = true;
      note += " 数縛り！";
    }
  }

  state.field = {
    cards: playCards,
    ownerId: player.id,
    rank: seqLike && rank === null ? seqLike.top : rank!,
    kind: seqLike && rank === null ? "sequence" : "normal",
    suit: playSuit,
    low: seqLike && rank === null ? seqLike.low : rank!,
    actualTop: seqLike && rank === null ? seqLike.actualTop : rank!,
  };
  // パス制限ON: パス済みの記録は場が流れるまで残す（誰かが出しても消えない）。
  // OFF: 誰かが出したらパス記録はリセットされ、パスした人もまた出せる。
  // 場が空だったとき（リードの一手）はどちらの場合もリセットする
  // （リードパス用の記録を新しい場へ持ち越さないため）。
  state.passed =
    rules.passLimit && prevFieldCards !== null
      ? state.passed.filter((id) => id !== player.id)
      : [];
  state.lastPlayBy = player.id;
  state.history = [
    ...state.history,
    {
      playerId: player.id,
      name: player.name,
      cards: playCards,
      note: note.trim() ? note.trim() : null,
    },
  ];
  state.log.push(`${player.name}さんが ${playCards.map(cardLabel).join(" ")} を出しました${note}`);

  checkFinish(state, rules, player);
  if (isFinished(state)) return { ok: true, reason: "" };

  // あがり流し: 誰かが上がったら場を流し、次の人が親になる
  if (rules.agariNagashi && player.finishRank !== null) {
    state.log.push("あがり流し：場が流れました");
    clearField(state);
    state.current = nextActiveIndex(state, playerIdx, false);
    return { ok: true, reason: "" };
  }

  // 特殊アクション（解決するまでターンは進まない）
  if (player.hand.length > 0 && fx) {
    if (rules.qBomber && playCards.some((c) => c.rank === 12 && c.suit !== "J")) {
      state.pending = { type: "qBomber", playerId: player.id, maxCount: 0, playedCards: playCards };
      state.current = playerIdx;
      state.log.push("Qボンバー！捨てる数字を宣言してください");
      return { ok: true, reason: "" };
    }
    const sevens = playCards.filter((c) => c.rank === 7 && c.suit !== "J").length;
    if (rules.sevenPass && sevens > 0) {
      state.pending = {
        type: "sevenPass",
        playerId: player.id,
        maxCount: Math.min(sevens, player.hand.length),
        playedCards: playCards,
      };
      state.current = playerIdx;
      state.log.push(`7渡し：${player.name}さんは手札を次の人に渡せます`);
      return { ok: true, reason: "" };
    }
    const tens = playCards.filter((c) => c.rank === 10 && c.suit !== "J").length;
    if (rules.tenDiscard && tens > 0) {
      state.pending = {
        type: "tenDiscard",
        playerId: player.id,
        maxCount: Math.min(tens, player.hand.length),
        playedCards: playCards,
      };
      state.current = playerIdx;
      state.log.push(`10捨て：${player.name}さんは手札を捨てられます`);
      return { ok: true, reason: "" };
    }
  }

  advanceAfterPlay(state, rules, playerIdx, playCards, prevFieldCards);
  return { ok: true, reason: "" };
}

/** Resolves a pending 7渡し / 10捨て / Qボンバー action, then advances the turn. */
export function resolvePending(
  state: GameState,
  rules: Rules,
  playerIdx: number,
  payload: { cardIds?: string[]; rank?: number },
): { ok: boolean; reason: string } {
  if (state.status !== "playing") return { ok: false, reason: "対局は終了しています" };
  const pending = state.pending;
  if (!pending) return { ok: false, reason: "解決待ちのアクションはありません" };
  const player = state.players[playerIdx]!;
  if (pending.playerId !== player.id || state.current !== playerIdx) {
    return { ok: false, reason: "あなたのアクションではありません" };
  }

  if (pending.type === "fourStop") {
    const ownerIdx = state.players.findIndex(
      (p) => p.id === (state.field?.ownerId ?? state.lastPlayBy),
    );
    const ids = payload.cardIds ?? [];
    if (ids.length === 0) {
      // 止めない → 8切りが成立し、場が流れて8を出した人が親になる
      state.pending = null;
      state.log.push(`${player.name}さんは4止めしませんでした（8切り成立）`);
      clearField(state);
      state.current =
        ownerIdx >= 0 && state.players[ownerIdx]!.finishRank === null
          ? ownerIdx
          : nextActiveIndex(state, ownerIdx >= 0 ? ownerIdx : playerIdx, false);
      return { ok: true, reason: "" };
    }
    if (ids.length !== pending.maxCount) {
      return { ok: false, reason: `4を${pending.maxCount}枚出してください` };
    }
    const cards = ids.map((id) => player.hand.find((c) => c.id === id));
    if (cards.some((c) => !c)) return { ok: false, reason: "そのカードは手札にありません" };
    const chosen = cards as Card[];
    if (chosen.some((c) => c.rank !== 4 || c.suit === "J")) {
      return { ok: false, reason: "4止めには4のカードが必要です" };
    }
    player.hand = sortHand(player.hand.filter((c) => !ids.includes(c.id)));
    state.pending = null;
    state.log.push(
      `4止め！${player.name}さんが8切りを止めました。場が流れて${player.name}さんが親になります`,
    );
    clearField(state);
    checkFinish(state, rules, player);
    if (isFinished(state)) return { ok: true, reason: "" };
    state.current =
      player.finishRank === null
        ? playerIdx
        : nextActiveIndex(state, playerIdx, false);
    return { ok: true, reason: "" };
  }

  if (pending.type === "sevenPass" || pending.type === "tenDiscard") {
    const ids = payload.cardIds ?? [];
    if (ids.length > pending.maxCount) {
      return { ok: false, reason: `${pending.maxCount}枚までです` };
    }
    // 枚数選択OFF: 出した枚数分ちょうど選ぶ必要がある
    const choiceOn =
      pending.type === "sevenPass" ? rules.sevenPassChoice : rules.tenDiscardChoice;
    if (!choiceOn && ids.length !== pending.maxCount) {
      return {
        ok: false,
        reason: `枚数選択OFF：ちょうど${pending.maxCount}枚選んでください`,
      };
    }
    const cards = ids.map((id) => player.hand.find((c) => c.id === id));
    if (cards.some((c) => !c)) return { ok: false, reason: "そのカードは手札にありません" };
    const chosen = cards as Card[];
    player.hand = sortHand(player.hand.filter((c) => !ids.includes(c.id)));
    if (pending.type === "sevenPass") {
      const targetIdx = nextActiveIndex(state, playerIdx, false);
      const target = state.players[targetIdx]!;
      target.hand = sortHand([...target.hand, ...chosen]);
      if (chosen.length > 0) {
        state.log.push(`7渡し：${player.name}さんが${target.name}さんへ${chosen.length}枚渡しました`);
        state.history = [
          ...state.history,
          { playerId: player.id, name: player.name, cards: null, note: `7渡し→${target.name}さんへ${chosen.length}枚` },
        ];
      } else {
        state.log.push(`7渡し：${player.name}さんは渡しませんでした`);
      }
      checkFinish(state, rules, player);
    } else {
      if (chosen.length > 0) {
        state.log.push(`10捨て：${player.name}さんが${chosen.length}枚捨てました`);
        state.history = [
          ...state.history,
          { playerId: player.id, name: player.name, cards: null, note: `10捨て ${chosen.map(cardLabel).join(" ")}` },
        ];
      } else {
        state.log.push(`10捨て：${player.name}さんは捨てませんでした`);
      }
      checkFinish(state, rules, player);
    }
  } else {
    // Qボンバー
    const rank = payload.rank;
    if (rank === undefined || rank < 3 || rank > 15) {
      return { ok: false, reason: "捨てる数字を選んでください" };
    }
    const parts: string[] = [];
    for (const p of state.players) {
      const removed = p.hand.filter((c) => c.rank === rank && c.suit !== "J");
      if (removed.length > 0) {
        p.hand = sortHand(p.hand.filter((c) => !removed.includes(c)));
        parts.push(`${p.name}さん${removed.length}枚`);
      }
    }
    state.log.push(
      `Qボンバー！「${rankLabelText(rank)}」を全員が捨てました${parts.length ? `（${parts.join("、")}）` : "（誰も持っていませんでした）"}`,
    );
    state.history = [
      ...state.history,
      { playerId: player.id, name: player.name, cards: null, note: `Qボンバー「${rankLabelText(rank)}」` },
    ];
    for (const p of state.players) checkFinish(state, rules, p);
  }

  const playedCards = pending.playedCards;
  state.pending = null;
  if (isFinished(state)) return { ok: true, reason: "" };
  // あがり流し: 受け渡し・捨てで上がった場合も場を流す
  if (rules.agariNagashi && player.finishRank !== null) {
    state.log.push("あがり流し：場が流れました");
    clearField(state);
    state.current = nextActiveIndex(state, playerIdx, false);
    return { ok: true, reason: "" };
  }
  advanceAfterPlay(state, rules, playerIdx, playedCards);
  return { ok: true, reason: "" };
}

function rankLabelText(rank: number): string {
  if (rank === 11) return "J";
  if (rank === 12) return "Q";
  if (rank === 13) return "K";
  if (rank === 14) return "A";
  if (rank === 15) return "2";
  return String(rank);
}

export function applyPass(
  state: GameState,
  playerIdx: number,
  rules?: Rules,
): { ok: boolean; reason: string } {
  if (state.status !== "playing") return { ok: false, reason: "対局は終了しています" };
  if (state.exchange) return { ok: false, reason: "カード交換中です" };
  if (state.pending) return { ok: false, reason: "先にカードの受け渡しをしてください" };
  if (state.current !== playerIdx) return { ok: false, reason: "あなたの番ではありません" };
  const player = state.players[playerIdx]!;
  if (player.finishRank !== null) {
    return { ok: false, reason: "上がったプレイヤーはパスできません" };
  }
  if (!state.field) {
    // リードパス：場が空のときは通常パスできないが、手札に出せる手が1つも
    // ない場合（例：最後の1枚が禁止あがり対象で出すこともできない）に限り
    // パスしてリード権を次の人へ渡せる。これがないと対局が止まってしまう。
    if (!rules) return { ok: false, reason: "場にカードがないのでパスできません" };
    const hasPlay = legalSets(state, rules, playerIdx).some(
      (set) => !isForbiddenFinishPlay(rules, player.hand.length, set),
    );
    if (hasPlay) return { ok: false, reason: "場にカードがないのでパスできません" };
    state.passed = [...state.passed, player.id];
    state.log.push(`${player.name}さんは出せるカードがなく、パスしました`);
    state.history = [
      ...state.history,
      { playerId: player.id, name: player.name, cards: null, note: "出せるカードなし" },
    ];
    const actives = activePlayers(state);
    if (actives.every((p) => state.passed.includes(p.id))) {
      // 全員が出せるカードを持っていない：残りの順位を手札の少ない順に付けて終了
      const rest = [...actives].sort((a, b) => a.hand.length - b.hand.length);
      for (const p of rest) {
        p.finishRank = state.finishOrder.length + 1;
        state.finishOrder.push(p.id);
      }
      state.passed = [];
      state.status = "finished";
      state.log.push("全員が出せるカードがなく、対局を終了しました");
      return { ok: true, reason: "" };
    }
    state.current = nextActiveIndex(state, playerIdx, false);
    return { ok: true, reason: "" };
  }
  if (!state.passed.includes(player.id)) {
    state.passed = [...state.passed, player.id];
  }
  state.log.push(`${player.name}さんがパス`);
  state.history = [
    ...state.history,
    { playerId: player.id, name: player.name, cards: null, note: null },
  ];

  const field = state.field;
  const others = state.players.filter(
    (p) => p.finishRank === null && p.id !== field.ownerId,
  );
  const allPassed = others.every((p) => state.passed.includes(p.id));
  if (allPassed) {
    const ownerIdx = state.players.findIndex((p) => p.id === field.ownerId);
    const owner = state.players[ownerIdx]!;
    clearField(state);
    state.log.push("全員パスしたので場が流れました");
    state.current =
      owner.finishRank === null ? ownerIdx : nextActiveIndex(state, ownerIdx, false);
    return { ok: true, reason: "" };
  }
  if (rules?.passLimit) {
    // パス制限ON: 次の人へ素直に回し、パス済みの人なら自動パスで進める
    state.current = nextActiveIndex(state, playerIdx, false);
    settlePassLimit(state, rules);
    return { ok: true, reason: "" };
  }
  state.current = nextActiveIndex(state, playerIdx, true);
  return { ok: true, reason: "" };
}

export function cardLabel(card: Card): string {
  if (card.suit === "J") return "ジョーカー";
  const suitSym = { S: "♠", H: "♥", D: "♦", C: "♣", J: "" }[card.suit];
  return `${suitSym}${rankLabelText(card.rank)}`;
}

/** All k-card combinations of arr (original order preserved). */
function combinations(arr: Card[], k: number): Card[][] {
  if (k === 0) return [[]];
  if (k > arr.length) return [];
  const out: Card[][] = [];
  const idx = Array.from({ length: k }, (_, i) => i);
  for (;;) {
    out.push(idx.map((i) => arr[i]!));
    let i = k - 1;
    while (i >= 0 && idx[i] === arr.length - k + i) i--;
    if (i < 0) break;
    idx[i] = idx[i]! + 1;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1]! + 1;
  }
  return out;
}

/** All legal sets a player could play right now (used by the AI). */
export function legalSets(state: GameState, rules: Rules, playerIdx: number): Card[][] {
  const player = state.players[playerIdx]!;
  // パス制限ON: その場でパス済みの人は、場が流れるまで合法手なし
  // （手札の発光判定・CPUの手選び・リードパス判定すべてに効く）
  if (rules.passLimit && state.field && state.passed.includes(player.id)) {
    return [];
  }
  const hand = player.hand;
  const need = state.field ? state.field.cards.length : 0;
  const byRank = new Map<number, Card[]>();
  const jokers: Card[] = [];
  for (const c of hand) {
    if (c.suit === "J") jokers.push(c);
    else {
      const list = byRank.get(c.rank) ?? [];
      list.push(c);
      byRank.set(c.rank, list);
    }
  }
  const results: Card[][] = [];
  const sizes = need > 0 ? [need] : [1, 2, 3, 4, 5];
  for (const size of sizes) {
    for (const [, group] of byRank) {
      for (let useJoker = 0; useJoker <= Math.min(jokers.length, size); useJoker++) {
        const fromGroup = size - useJoker;
        if (fromGroup <= 0 || fromGroup > group.length) continue;
        // 同じ数字のカードはどれも出せる対象として扱うため、先頭からの
        // 切り取りではなく、組とジョーカーの組み合わせを全て列挙する
        // （これをしないと、同じ数字の2枚目以降が「出せるカード」として
        // 光らなくなってしまう）
        for (const g of combinations(group, fromGroup)) {
          for (const js of combinations(jokers, useJoker)) {
            const set = [...g, ...js];
            if (canPlay(state, rules, set).ok) results.push(set);
          }
        }
      }
    }
    // joker-only set（ジョーカーが複数枚あっても1枚ずつ全て候補にする）
    if (size === 1) {
      for (const joker of jokers) {
        const set = [joker];
        if (canPlay(state, rules, set).ok) results.push(set);
      }
    }
    // 階段 (sequences)
    if (rules.stairs && size >= Math.max(3, rules.stairsMin)) {
      const suits: Suit[] = ["S", "H", "D", "C"];
      for (const suit of suits) {
        const suited = hand
          .filter((c) => c.suit === suit)
          .sort((a, b) => a.rank - b.rank);
        for (let i = 0; i < suited.length; i++) {
          for (let j = i + 2; j <= suited.length + jokers.length; j++) {
            const base = suited.slice(i, Math.min(j, suited.length));
            if (base.length === 0) continue;
            for (let useJoker = 0; useJoker <= jokers.length; useJoker++) {
              if (base.length + useJoker !== size) continue;
              for (const js of combinations(jokers, useJoker)) {
                const set = [...base, ...js];
                if (sequenceInfo(set) && canPlay(state, rules, set).ok) {
                  results.push(set);
                }
              }
            }
          }
        }
      }
    }
  }
  // エンペラー: 4枚の組み合わせを全て試す（場が4枚の連番か、場が空のとき）
  if (rules.emperor && (need === 0 || need === 4)) {
    for (let a = 0; a + 3 < hand.length; a++) {
      for (let b = a + 1; b + 2 < hand.length; b++) {
        for (let c2 = b + 1; c2 + 1 < hand.length; c2++) {
          for (let d = c2 + 1; d < hand.length; d++) {
            const set = [hand[a]!, hand[b]!, hand[c2]!, hand[d]!];
            if (emperorInfo(set) && canPlay(state, rules, set).ok) {
              results.push(set);
            }
          }
        }
      }
    }
  }
  // 砂嵐: 場の枚数と違っても3×3は出せる
  if (rules.sandstorm) {
    const threes = byRank.get(3) ?? [];
    for (let useJoker = 0; useJoker <= Math.min(jokers.length, 3); useJoker++) {
      const fromGroup = 3 - useJoker;
      if (fromGroup <= 0 || fromGroup > threes.length) continue;
      for (const g of combinations(threes, fromGroup)) {
        for (const js of combinations(jokers, useJoker)) {
          const set = [...g, ...js];
          if (
            canPlay(state, rules, set).ok &&
            !results.some(
              (r) => r.length === set.length && r.every((c) => set.includes(c)),
            )
          ) {
            results.push(set);
          }
        }
      }
    }
  }
  return results;
}

// ============================================================
// 自動選択（UI補助）: 場に2枚以上出ているとき、未選択の出せるカードを
// 1枚タップしたら、そのカードを含む合法手を1つ選んで丸ごと選択する。
// ============================================================

/** 出し方の種類。canPlay と同じ分類: 組（同じ数字+ジョーカー）か、
 * 階段系（階段・エンペラー）か。どちらでもなければ null。 */
export function playKind(
  rules: Rules,
  cards: Card[],
): "group" | "sequence" | null {
  let rank = setRank(cards);
  let seq = rules.stairs ? sequenceInfo(cards) : null;
  if (seq && cards.length < rules.stairsMin) seq = null;
  const emp = rules.emperor ? emperorInfo(cards) : null;
  const hasJoker = cards.some((c) => c.suit === "J");
  const nonJokerCount = cards.filter((c) => c.suit !== "J").length;
  if (hasJoker && rules.jokerEffect === "groups") seq = null;
  const empBlocked = hasJoker && rules.jokerEffect === "groups";
  if (
    rank !== null &&
    hasJoker &&
    nonJokerCount > 0 &&
    rules.jokerEffect === "stairs"
  ) {
    rank = null;
  }
  const seqLike = seq ?? (empBlocked ? null : emp);
  if (seqLike !== null && rank === null) return "sequence";
  if (rank !== null) return "group";
  return null;
}

/** 並べ替え用の「開始位置」: 階段系は一番小さい数字、組はその数字。 */
function setStartKey(rules: Rules, cards: Card[]): number {
  if (playKind(rules, cards) === "sequence") {
    const info = sequenceInfo(cards) ?? emperorInfo(cards);
    return info?.low ?? 99;
  }
  return setRank(cards) ?? 99;
}

/**
 * 場に複数枚出ているときの自動選択: タップしたカードを含む合法手
 * （発光判定と同じ集合 sets）の中から、自動選択する1手を決める。
 * 優先順位:
 *  1. 場と同じ種類（組/階段系）で、場と同じ枚数の手
 *  2. その中では開始位置（階段系=一番小さい数字、組=その数字）が
 *     一番小さいもの。さらに同点なら legalSets の列挙順（ジョーカーの
 *     使用枚数が少なく、手札の並びで早い組が先に来る）が優先される
 *  3. 1が無ければ、タップしたカードを含む合法手のうち枚数が場に一番
 *     近いもの（同距離なら少ない方）から、開始位置・列挙順で決める
 * 場が1枚以下、またはタップしたカードを含む合法手が無ければ null
 * （呼び出し側は従来の1枚選択にフォールバックする）。
 */
export function pickAutoSelectSet(
  fieldCards: Card[],
  fieldKind: "group" | "sequence",
  rules: Rules,
  sets: Card[][],
  tappedId: string,
): Card[] | null {
  if (fieldCards.length < 2) return null;
  const fieldSize = fieldCards.length;
  const candidates = sets
    .map((set, index) => ({ set, index }))
    .filter(({ set }) => set.some((c) => c.id === tappedId));
  if (candidates.length === 0) return null;
  const scored = candidates.map(({ set, index }) => ({
    set,
    index,
    tier: playKind(rules, set) === fieldKind && set.length === fieldSize ? 0 : 1,
    sizeDist: Math.abs(set.length - fieldSize),
    startKey: setStartKey(rules, set),
  }));
  scored.sort(
    (a, b) =>
      a.tier - b.tier ||
      a.sizeDist - b.sizeDist ||
      a.set.length - b.set.length ||
      a.startKey - b.startKey ||
      a.index - b.index,
  );
  return scored[0]?.set ?? null;
}

// ============================================================
// CPUの思考: 合法手の候補すべてを評価関数で採点して選ぶ。
// 共通の土台は「手札を出し切るまでの手数（グループ数）」。
// レベルごとに評価の理論が違う:
//  弱い = 初心者。弱い手から出すが、組を崩す・切り札を惜しまない・
//         たまに読み違えてパスする等のミスを混ぜる。
//  普通 = セオリー。手数が減る手を弱い順に出し、切り札は終盤まで温存。
//         切り札でしか返せない場は序盤〜中盤ならパスも選ぶ。
//  強い = 手数最小化＋ストッパー保持＋カードカウント＋相手の残り枚数
//         を使った妨害と、革命/11バックの損得判断まで読む。
// ============================================================

/** 手札を「1手で出せるグループ」に分解する（手数評価の土台）。
 * 階段（有効な場合）→同じ数字の組の順に貪欲に取り出す。
 * ジョーカーは既存のグループに吸収できれば手数を増やさない。 */
export function decomposeHand(hand: Card[], rules: Rules): Card[][] {
  const rest = hand.filter((c) => c.suit !== "J");
  const jokerCount = hand.length - rest.length;
  const groups: Card[][] = [];
  const used = new Set<string>();
  if (rules.stairs) {
    const minLen = Math.max(3, rules.stairsMin);
    const suits: Suit[] = ["S", "H", "D", "C"];
    for (const suit of suits) {
      const suited = rest
        .filter((c) => c.suit === suit)
        .sort((a, b) => a.rank - b.rank);
      let run: Card[] = [];
      let lastRank = -10;
      const flush = () => {
        if (run.length >= minLen) {
          groups.push(run);
          for (const c of run) used.add(c.id);
        }
        run = [];
      };
      for (const c of suited) {
        if (run.length > 0 && c.rank === lastRank) continue; // 同数字の重複は組へ回す
        if (run.length > 0 && c.rank !== lastRank + 1) flush();
        run.push(c);
        lastRank = c.rank;
      }
      flush();
    }
  }
  const byRank = new Map<number, Card[]>();
  for (const c of rest) {
    if (used.has(c.id)) continue;
    const list = byRank.get(c.rank) ?? [];
    list.push(c);
    byRank.set(c.rank, list);
  }
  for (const [, g] of byRank) groups.push(g);
  if (jokerCount > 0) {
    // ジョーカーが組にも階段にも加われない設定・状況では、ジョーカー同士で1グループ
    const canJoinSet = rules.jokerEffect !== "stairs";
    const canJoinSeq = rules.jokerEffect !== "groups";
    const joinable = groups.some((g) =>
      setRank(g) === null ? canJoinSeq : canJoinSet,
    );
    if (!joinable) groups.push(hand.filter((c) => c.suit === "J"));
  }
  return groups;
}

/** 手札を出し切るまでの手数（グループ数）。 */
export function handGroupCount(hand: Card[], rules: Rules): number {
  return decomposeHand(hand, rules).length;
}

/** 「強い」専用の、より正確な手数計算。
 * 貪欲分解は「階段を先に抜く」順序によっては組を壊して手数を多く数える
 * ことがあるため、「組を先に抜く」分解とも比べて小さい方を採る。 */
function minGroupCount(hand: Card[], rules: Rules): number {
  let best = decomposeHand(hand, rules).length;
  if (rules.stairs && best > 1) {
    // 組優先の分解: まず同じ数字の組（2枚以上）を抜き、残りから階段を作る
    const rest = hand.filter((c) => c.suit !== "J");
    const byRank = new Map<number, Card[]>();
    for (const c of rest) {
      const list = byRank.get(c.rank) ?? [];
      list.push(c);
      byRank.set(c.rank, list);
    }
    const used = new Set<string>();
    let groups = 0;
    for (const [, g] of byRank) {
      if (g.length >= 2) {
        groups += 1;
        for (const c of g) used.add(c.id);
      }
    }
    const leftover = rest.filter((c) => !used.has(c.id));
    groups += decomposeHand(leftover, rules).length;
    // ジョーカーの吸収可否は元の分解と同じ条件で見る（単体グループ化の分）
    const jokers = hand.filter((c) => c.suit === "J");
    if (jokers.length > 0 && groups === 0) groups += 1;
    best = Math.min(best, groups);
  }
  return best;
}

/** 1手の分析結果（評価関数の入力）。 */
interface PlayInfo {
  set: Card[];
  rank: number; // 実効ランク（組=数字、階段=top、ジョーカーのみ=20）
  strength: number; // 逆転を加味した強さ（大きいほど強い。ジョーカーは別格で最大）
  after: Card[]; // 出した後の手札
  afterGroups: number; // 出した後の手数
  usesJoker: boolean;
  usesTwo: boolean; // 2（最も強い通常カード）を含む
  usesStopper: boolean; // 切り札級（ジョーカー・2・8切り可能な8）を含む
  stoppersAfter: number; // 出した後に残る切り札級の枚数
  flow: boolean; // 場を流して自分が続けて出せる手（8切り・スペ3返し等）
  revolution: boolean; // 革命（鎮圧含む）を起こす手
  back: boolean; // 11バックを起こす手
}

function isStopperCard(rules: Rules, c: Card): boolean {
  return (
    c.suit === "J" || c.rank === 15 || (rules.eightCut && c.rank === 8)
  );
}

function analyzePlay(
  state: GameState,
  rules: Rules,
  player: PlayerState,
  set: Card[],
): PlayInfo {
  const reversed = isReversed(state);
  const seq =
    (rules.stairs ? sequenceInfo(set) : null) ??
    (rules.emperor ? emperorInfo(set) : null);
  const rank = setRank(set) ?? seq?.top ?? 20;
  const after = player.hand.filter((c) => !set.includes(c));
  const fx = effectsAllowed(state, rules, set);
  const r = setRank(set);
  const flow =
    fx &&
    ((rules.spade3 &&
      state.field !== null &&
      state.field.cards.length === 1 &&
      state.field.cards[0]!.suit === "J" &&
      set.length === 1 &&
      set[0]!.id === "S3") ||
      (rules.sandstorm && set.length === 3 && r === 3) ||
      (rules.eightCut && set.some((c) => c.rank === 8 && c.suit !== "J")) ||
      (rules.ambulance && set.length === 2 && r === 9) ||
      (rules.rokurokubi && set.length === 2 && r === 6));
  return {
    set,
    rank,
    strength: rank === 20 ? 100 : reversed ? 18 - rank : rank,
    after,
    afterGroups: handGroupCount(after, rules),
    usesJoker: set.some((c) => c.suit === "J"),
    usesTwo: set.some((c) => c.rank === 15 && c.suit !== "J"),
    usesStopper: set.some((c) => isStopperCard(rules, c)),
    stoppersAfter: after.filter((c) => isStopperCard(rules, c)).length,
    flow,
    revolution: checkRevolutionTrigger(rules, set, state.omen),
    back:
      fx &&
      rules.elevenBack &&
      set.some((c) => c.rank === 11 && c.suit !== "J"),
  };
}

/** 強さ逆転が自分の手札に有利かどうか（革命・11バックの判断）。
 * 逆転していないとき: 弱いカード中心なら逆転が得。
 * 逆転しているとき: 強いカード中心なら（鎮圧・継続が）得。 */
function prefersFlip(player: PlayerState, reversedNow: boolean): boolean {
  const rest = player.hand.filter((c) => c.suit !== "J");
  if (rest.length === 0) return true;
  const avg = rest.reduce((s, c) => s + c.rank, 0) / rest.length;
  return reversedNow ? avg >= 10.5 : avg <= 9.5;
}

/** 次に手番が来る相手（未上がり）の残り枚数。相手がいなければ99。 */
function nextOpponentHand(state: GameState, playerIdx: number): number {
  const n = state.players.length;
  for (let step = 1; step < n; step++) {
    const idx = (((playerIdx + step * state.direction) % n) + n) % n;
    const p = state.players[idx]!;
    if (p.finishRank === null && idx !== playerIdx) return p.hand.length;
  }
  return 99;
}

/** 相手（未上がり）の中で最も少ない残り枚数。 */
function minOpponentHand(state: GameState, player: PlayerState): number {
  let min = 99;
  for (const p of state.players) {
    if (p.id !== player.id && p.finishRank === null) {
      min = Math.min(min, p.hand.length);
    }
  }
  return min;
}

/** カードカウント: 場に出た（履歴＋現在の場）カードを数え、
 * まだ見えていないジョーカーと2の枚数を返す。 */
function unseenPowerCards(
  state: GameState,
  rules: Rules,
  player: PlayerState,
): { jokers: number; twos: number } {
  const seen = new Set<string>();
  for (const h of state.history) {
    if (h.cards) for (const c of h.cards) seen.add(c.id);
  }
  if (state.field) for (const c of state.field.cards) seen.add(c.id);
  for (const c of player.hand) seen.add(c.id);
  let jokers = rules.jokerCount;
  let twos = 4;
  for (const id of seen) {
    if (id.startsWith("JOKER")) jokers -= 1;
    else if (id.endsWith("15")) twos -= 1;
  }
  return { jokers: Math.max(0, jokers), twos: Math.max(0, twos) };
}

function bestOf(infos: PlayInfo[], score: (i: PlayInfo) => number): Card[] {
  let best = infos[0]!;
  let bestScore = score(best);
  for (const info of infos) {
    const s = score(info);
    if (s < bestScore) {
      bestScore = s;
      best = info;
    }
  }
  return best.set;
}

/** 弱い: 初心者。弱い手から出すが、組を平気で崩し、ジョーカーや2も
 * 序盤から惜しまず使い、たまにランダムに打ったり読み違えてパスする。 */
function weakChoose(state: GameState, infos: PlayInfo[]): Card[] | null {
  // 読みの甘さ: 出せる手があってもたまにパスする（場があるときだけ）
  if (state.field && Math.random() < 0.1) return null;
  // 2〜3割は考えなしにランダムな合法手を選ぶ
  if (Math.random() < 0.25) {
    return infos[Math.floor(Math.random() * infos.length)]!.set;
  }
  // 基本は一番弱い手。ただしジョーカーは「ただのカード」と思っていて
  // 強さの見積もりが甘い（中くらいのカード扱い）ので、早めに切ってしまう。
  const score = (i: PlayInfo): number => {
    const perceived = i.rank === 20 ? 9 : i.strength;
    return perceived * 10 + i.set.length; // 単体を優先しがち＝組を崩す
  };
  return bestOf(infos, score);
}

/** 普通: 大富豪のセオリー。手数が減る手を弱い順に出し、組は崩さない。
 * 切り札（2・ジョーカー）は終盤まで温存し、切り札でしか返せない場は
 * 序盤〜中盤ならパスを選ぶことがある。 */
function normalChoose(
  state: GameState,
  player: PlayerState,
  playerIdx: number,
  infos: PlayInfo[],
): Card[] | null {
  const reversed = isReversed(state);
  const nextOpp = nextOpponentHand(state, playerIdx);
  const minOpp = minOpponentHand(state, player);
  const danger = nextOpp <= 2 || minOpp <= 2;
  let pool = infos;
  if (state.field) {
    const cheap = infos.filter((i) => !i.usesJoker && !i.usesTwo);
    if (cheap.length > 0 && !danger) {
      pool = cheap;
    } else if (
      // 切り札でしか返せない: 序盤〜中盤（自分も相手も枚数が多い）は温存パス
      player.hand.length > 6 &&
      minOpp > 3 &&
      !infos.some((i) => i.flow)
    ) {
      return null;
    }
  }
  const score = (i: PlayInfo): number => {
    let s = i.afterGroups * 40; // 手数が減る手を優先（組を崩さない）
    s += i.strength; // その中で弱い手から
    if (i.usesJoker) s += 30; // 切り札は温存
    if (i.usesTwo) s += 22;
    if (i.flow) s -= danger ? 25 : 10; // 8切り等で流れを作る
    if (i.revolution) s += prefersFlip(player, reversed) ? -25 : 70;
    if (i.back) s += prefersFlip(player, reversed) ? -10 : 25;
    if (danger) {
      // 次の相手が上がりそう: 強い手で止めにいく／安いリードをしない
      s -= i.strength * 2;
      if (!state.field && nextOpp === 1 && i.set.length >= 2) s -= 25;
    }
    return s;
  };
  return bestOf(pool, score);
}

/** 強い: 手数最小化を軸に、ストッパー保持・カードカウント・相手の
 * 残り枚数への妨害・革命/11バックの損得まで評価する。 */
function strongChoose(
  state: GameState,
  rules: Rules,
  player: PlayerState,
  playerIdx: number,
  infos: PlayInfo[],
): Card[] | null {
  const reversed = isReversed(state);
  const nextOpp = nextOpponentHand(state, playerIdx);
  const minOpp = minOpponentHand(state, player);
  const danger = nextOpp <= 2 || minOpp <= 2;
  const unseen = unseenPowerCards(state, rules, player);
  // 自分の残す切り札が「場で一番強い（ボス）」かどうか:
  // 見えていないジョーカー/2がなければ、手持ちの切り札は絶対に勝てる
  const myTopIsBoss = unseen.jokers === 0 && unseen.twos === 0;
  const fieldOwner =
    state.field !== null
      ? (state.players.find((p) => p.id === state.field!.ownerId) ?? null)
      : null;

  const groupsOf = (i: PlayInfo): number => minGroupCount(i.after, rules);
  const score = (i: PlayInfo): number => {
    // 手数最小化が最優先。終盤ほど手数の重みを上げる（上がり筋の読み）
    let s = groupsOf(i) * (player.hand.length <= 6 ? 150 : 100);
    s += i.strength * 0.8; // 同じ手数なら弱い手から使う
    // ストッパー管理: 最後の切り札を序盤に切るのは割に合わない
    if (i.usesStopper && i.stoppersAfter === 0 && i.after.length >= 5) {
      s += myTopIsBoss ? 85 : 60;
    } else if (i.usesStopper && i.stoppersAfter === 0 && i.after.length >= 3) {
      s += 28;
    } else if (i.usesJoker) {
      // ジョーカーの消費コスト（序盤ほど惜しい）
      s += i.after.length >= 8 ? 30 : 18;
    }
    if (i.flow) s -= 30; // 場のコントロール（8切り・スペ3返し等）
    if (i.revolution) s += prefersFlip(player, reversed) ? -45 : 110;
    if (i.back) s += prefersFlip(player, reversed) ? -20 : 45;
    if (danger) {
      // 上がりそうな相手への妨害。切迫度（次の相手か、場の主が上がりそう）
      // に応じて強さを変え、ジョーカーの過剰な切り方はしない
      const dStr = Math.min(i.strength, 16);
      const ownerDanger =
        fieldOwner !== null &&
        fieldOwner.id !== player.id &&
        fieldOwner.hand.length <= 2;
      if (nextOpp <= 2 || ownerDanger) {
        s -= dStr * 3;
        // 場の主が上がりそうなら、場を流して主導権を奪う手が特に効く
        if (i.flow && ownerDanger) s -= 50;
      } else {
        s -= dStr; // 離れた相手が少ないだけなら軽く警戒する程度
      }
      // 残り1枚の相手の直前では、場を流せる手が最も確実な妨害になる
      if (i.flow && minOpp <= 1) s -= 70;
      if (!state.field && nextOpp === 1 && i.set.length >= 2) s -= 60;
      if (!state.field && nextOpp <= 2 && i.set.length === 1 && i.strength < 60) {
        s += 20; // 安い単体リードは相手に渡してしまう
      }
    }
    // 終盤の仕上げ: 残り1グループで、それが切り札級なら上がり筋が堅い
    if (groupsOf(i) === 1) {
      if (i.after.some((c) => isStopperCard(rules, c))) s -= 20;
      if (i.after.length <= 3) s -= (4 - i.after.length) * 12;
    }
    return s;
  };

  if (state.field) {
    const best = bestOf(infos, score);
    const bestInfo = infos.find((i) => i.set === best)!;
    const ownerSafe =
      !fieldOwner || fieldOwner.id === player.id || fieldOwner.hand.length > 2;
    // 最後のストッパーを切るしかない場面: 本当の序盤だけ温存してパスする
    if (
      bestInfo.usesStopper &&
      bestInfo.stoppersAfter === 0 &&
      bestInfo.after.length >= 7 &&
      minOpp > 2 &&
      ownerSafe
    ) {
      return null;
    }
    return best;
  }
  return bestOf(infos, score);
}

export function aiChoosePlay(state: GameState, rules: Rules, playerIdx: number): Card[] | null {
  const player = state.players[playerIdx]!;
  // 禁止あがりで弾かれる手は候補から外す（これしかない場合はnull→パス/リードパス）
  const sets = legalSets(state, rules, playerIdx).filter(
    (set) => !isForbiddenFinishPlay(rules, player.hand.length, set),
  );
  if (sets.length === 0) return null;
  // 上がれる手があれば必ず上がる（全レベル共通）
  const finish = sets.find((s) => s.length === player.hand.length);
  if (finish) return finish;
  const infos = sets.map((set) => analyzePlay(state, rules, player, set));
  if (rules.cpuLevel === "weak") return weakChoose(state, infos);
  if (rules.cpuLevel === "strong") {
    return strongChoose(state, rules, player, playerIdx, infos);
  }
  return normalChoose(state, player, playerIdx, infos);
}

/** Bot resolution for pending actions: pass weakest / discard strongest / bomb the rank others hold most. */
export function botResolvePending(state: GameState, rules: Rules): boolean {
  const pending = state.pending;
  if (!pending) return false;
  const idx = state.players.findIndex((p) => p.id === pending.playerId);
  if (idx < 0) return false;
  const player = state.players[idx]!;
  if (pending.type === "sevenPass") {
    const count = rules.sevenPassChoice
      ? Math.min(pending.maxCount, Math.max(0, player.hand.length - 1))
      : pending.maxCount;
    const give = [...player.hand]
      .sort((a, b) => a.rank - b.rank)
      .slice(0, count)
      .map((c) => c.id);
    return resolvePending(state, rules, idx, { cardIds: give }).ok;
  }
  if (pending.type === "tenDiscard") {
    const count = rules.tenDiscardChoice
      ? Math.min(pending.maxCount, Math.max(0, player.hand.length - 1))
      : pending.maxCount;
    const drop = [...player.hand]
      .sort((a, b) => b.rank - a.rank)
      .slice(0, count)
      .map((c) => c.id);
    return resolvePending(state, rules, idx, { cardIds: drop }).ok;
  }
  if (pending.type === "fourStop") {
    // 止める判断: 4を出しても手札が少なくなる、または手札が強めなら止めて親になる
    const fours = player.hand.filter((c) => c.rank === 4 && c.suit !== "J");
    const nonJoker = player.hand.filter((c) => c.suit !== "J");
    const avg =
      nonJoker.length > 0
        ? nonJoker.reduce((s, c) => s + c.rank, 0) / nonJoker.length
        : 0;
    const stop =
      fours.length >= pending.maxCount &&
      (player.hand.length - pending.maxCount <= 5 || avg >= 11);
    return resolvePending(state, rules, idx, {
      cardIds: stop ? fours.slice(0, pending.maxCount).map((c) => c.id) : [],
    }).ok;
  }
  // qBomber: pick the rank opponents hold most (net of own cards)
  let bestRank = 3;
  let bestScore = -Infinity;
  for (let r = 3; r <= 15; r++) {
    let score = 0;
    for (const p of state.players) {
      const n = p.hand.filter((c) => c.rank === r && c.suit !== "J").length;
      score += p.id === player.id ? -n : n * 2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestRank = r;
    }
  }
  return resolvePending(state, rules, idx, { rank: bestRank }).ok;
}

/** 手番が「上がったプレイヤー」に残っていたら、次の未上がりプレイヤーへ進める。
 * 上がり直後の手番移行漏れで対局が止まるのを防ぐための安全弁。 */
export function ensureActiveCurrent(state: GameState): boolean {
  if (state.status !== "playing") return false;
  const cur = state.players[state.current];
  if (!cur || cur.finishRank === null) return false;
  const nxt = nextActiveIndex(state, state.current, false);
  if (nxt === state.current) return false;
  state.current = nxt;
  return true;
}

/** Advance bot turns until a human is to move or the game ends. */
export function advanceBots(state: GameState, rules: Rules) {
  let guard = 0;
  while (state.status === "playing" && guard++ < 600) {
    if (state.exchange) {
      if (!advanceExchange(state, rules)) break;
      continue;
    }
    if (state.pending) {
      const holder = state.players.find((p) => p.id === state.pending!.playerId);
      if (!holder || holder.finishRank !== null) {
        // 解決待ちの本人が上がってしまっていたら、待ちを解除して進める
        state.pending = null;
        continue;
      }
      if (!holder.isBot) break;
      if (!botResolvePending(state, rules)) break;
      continue;
    }
    // 上がった人が手番に残っていたら必ず次へ進める（固まり防止）
    if (ensureActiveCurrent(state)) continue;
    // パス制限ON: パス済みの人（人間・CPU共通）の番は自動パスで進める。
    // 通常は出す／パス処理の中で解決済みだが、保存済みの対局を再開した
    // 場合などに手番がパス済みの人に残っていても止まらないようにする。
    if (settlePassLimit(state, rules)) continue;
    const player = state.players[state.current]!;
    if (!player.isBot) break;
    const play = aiChoosePlay(state, rules, state.current);
    let moved = false;
    if (play) {
      const res = applyPlay(state, rules, state.current, play.map((c) => c.id));
      moved = res.ok;
      if (!moved) {
        // 選んだ手が弾かれた場合は、他の合法手を順に試す
        for (const alt of legalSets(state, rules, state.current)) {
          if (alt === play) continue;
          if (isForbiddenFinishPlay(rules, player.hand.length, alt)) continue;
          if (applyPlay(state, rules, state.current, alt.map((c) => c.id)).ok) {
            moved = true;
            break;
          }
        }
      }
    }
    if (!moved) {
      const passRes = applyPass(state, state.current, rules);
      if (!passRes.ok) break;
    }
  }
}
