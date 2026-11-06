export type Currency = "meso" | "point";
export type Direction = "income" | "expense";
export type Category = "boss" | "hunting" | "auction" | "npc" | "purchase" | "exchange" | "cash" | "enhancement" | "other";
export type Transaction = {
  id: string;
  date: string;
  name: string;
  category: Category;
  direction: Direction;
  currency: Currency;
  amount: number;
  memo: string;
  linkedId?: string;
};
export type Settings = {
  mvpSilver: boolean;
  equipment: number;
  ability: number;
  union: number;
  wealthPotion: boolean;
  unionWealth: boolean;
  pcBang: boolean;
  marketRate: number;
  openingMeso: number;
  openingPoint: number;
  presets?: BossPreset[];
};
export type BossPreset = { id: string; characterName: string; entries: { bossId: string; party: number }[] };
export const DEFAULT_SETTINGS: Settings = {
  mvpSilver: false, equipment: 0, ability: 0, union: 0,
  wealthPotion: false, unionWealth: false, pcBang: false,
  marketRate: 0, openingMeso: 0, openingPoint: 0, presets: [],
};
export const CATEGORY_LABELS: Record<Category, string> = {
  boss: "보스 수익", hunting: "사냥 수익", auction: "경매장 판매",
  npc: "잡화상인", purchase: "아이템 구매", exchange: "메소마켓 교환",
  cash: "캐시샵 구매", enhancement: "강화", other: "기타",
};
export function huntingReward(base: number, settings: Pick<Settings, "equipment" | "ability" | "union" | "wealthPotion" | "unionWealth">) {
  const rate = settings.equipment + settings.ability + settings.union + (settings.wealthPotion ? 20 : 0) + (settings.unionWealth ? 50 : 0);
  return { rate, total: Math.floor(base * (1 + rate / 100)) };
}
export function auctionPayout(gross: number, quantity: number, registrationFee: number, mvpSilver: boolean, pcBang: boolean) {
  const feeRate = mvpSilver || pcBang ? 0.03 : 0.05;
  const proceeds = Math.floor(gross * quantity * (1 - feeRate));
  return { feeRate, proceeds, net: proceeds - registrationFee };
}
export function taxPoints(mesoPrice: number, ratePerHundredMillion: number) {
  return Math.ceil(mesoPrice * 0.10 / 100_000_000 * ratePerHundredMillion);
}
export function mesoToPoints(meso: number, ratePerHundredMillion: number) {
  return Math.floor(meso / 100_000_000 * ratePerHundredMillion);
}
export function pointsToMeso(points: number, ratePerHundredMillion: number) {
  return Math.floor(points / ratePerHundredMillion * 100_000_000);
}
export function balance(currency: Currency, rows: Transaction[], settings: Settings) {
  return (currency === "meso" ? settings.openingMeso : settings.openingPoint) + rows.reduce((sum, row) => sum + (row.currency === currency ? (row.direction === "income" ? row.amount : -row.amount) : 0), 0);
}
export function fmt(num: number) { return Math.trunc(num).toLocaleString("ko-KR"); }
export function makeId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }

export const ENHANCEMENT_TYPES = [
  "잠재능력", "에디셔널 잠재능력 설정", "스타포스", "추가 옵션 설정", "주문서", "소울 잠재 추가"
] as const;
export function koreanAmount(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "";
  const whole = Math.floor(n);
  const chunks: string[] = [];
  const units = ["", "만", "억", "조", "경"];
  let value = whole;
  for (let i = 0; value > 0 && i < units.length; i++) {
    const part = value % 10000;
    if (part) chunks.unshift(`${part.toLocaleString("ko-KR")}${units[i]}`);
    value = Math.floor(value / 10000);
  }
  return chunks.join(" ") + " 메소";
}
