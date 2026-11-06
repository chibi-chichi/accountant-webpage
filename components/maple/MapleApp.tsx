"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import bossesData from "@/data/maple/bosses.json";
import itemsData from "@/data/maple/items.json";
import shopData from "@/data/maple/shop-prices.json";
import {
  auctionPayout, balance, CATEGORY_LABELS, DEFAULT_SETTINGS, fmt, huntingReward,
  makeId, mesoToPoints, taxPoints,
  type Category, type Currency, type Direction, type Settings, type Transaction,
} from "@/lib/maple/calculations";

type Screen = "overview" | "transactions";
type Filter = "all" | "income" | "expense";
const STORE = "asset-manager-maple-demo-v1";
const boxes = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const input = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const btn = "rounded-xl px-4 py-2.5 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";
const today = () => new Date().toLocaleDateString("en-CA");
function num(value: string) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function itemLabel(name: string) { return name.trim().slice(0, 1) || "?"; }
function ItemIcon({ name }: { name: string }) {
  const [failed, setFailed] = useState(false);
  const item = itemsData.find(i => i.name === name);
  return <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
    {item && !failed ? <img src={item.image} alt="" className="h-full w-full object-contain" onError={() => setFailed(true)}/> : itemLabel(name)}
  </span>;
}
type ListedTransaction = { row: Transaction; members: Transaction[] };
// Boss rewards remain separate accounting entries but appear as one expandable batch.
function listTransactions(records: Transaction[]): ListedTransaction[] {
  const groups = new Map<string, Transaction[]>();
  const result: ListedTransaction[] = [];
  for (const row of records) {
    const key = row.category === "boss" && row.linkedId ? row.linkedId : row.id;
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  for (const members of groups.values()) {
    if (members.length === 1 || members[0].category !== "boss") {
      result.push({ row: members[0], members });
      continue;
    }
    // Rank by full crystal price, not the amount after party splitting.
    const crystalPrice = (row: Transaction) => {
      const boss = bossesData.find(b => row.name.startsWith(`${b.name} (${b.difficulty})`));
      return boss?.crystalPrice ?? row.amount;
    };
    const ranked = [...members].sort((a, b) => crystalPrice(b) - crystalPrice(a) || a.name.localeCompare(b.name));
    const top = ranked[0];
    const topName = bossesData.find(b => top.name.startsWith(`${b.name} (${b.difficulty})`))?.name ?? top.name.split(" (")[0];
    result.push({
      row: { ...top, name: `${topName} 외 ${members.length - 1}개`, amount: members.reduce((sum, r) => sum + r.amount, 0) },
      members,
    });
  }
  return result.sort((a, b) => b.row.date.localeCompare(a.row.date));
}
function BossDetails({ members }: { members: Transaction[] }) {
  return <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm">
    <div className="mb-2 font-semibold text-blue-800">보스 결정석 상세 · {members.length}개</div>
    {members.map(member => <div key={member.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-blue-100 py-2 first:border-t-0">
      <div><div className="font-medium">{member.name}</div><div className="text-xs text-slate-500">{member.memo}</div></div>
      <div className="font-semibold text-blue-700">+{fmt(member.amount)} 메소</div>
    </div>)}
    <div className="mt-2 border-t border-blue-200 pt-2 text-right font-bold">합계 +{fmt(members.reduce((sum, r) => sum + r.amount, 0))} 메소</div>
  </div>;
}
function Amount({ value, currency }: { value: number; currency: Currency }) {
  return <span className="tabular-nums">{fmt(value)} {currency === "meso" ? "메소" : "P"}</span>;
}
function Trend({ rows, currency, opening }: { rows: Transaction[]; currency: Currency; opening: number }) {
  // Next.js Cache Components: read the current date only after mounting in the browser.
  const [days, setDays] = useState<string[]>([]);
  useEffect(() => {
    const result = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - (6 - i));
      return date.toLocaleDateString("en-CA");
    });
    setDays(result);
  }, []);
  const series = days.map(day => opening + rows.filter(r => r.currency === currency && r.date <= day).reduce((acc, r) => acc + (r.direction === "income" ? r.amount : -r.amount), 0));
  const lo = series.length ? Math.min(...series) : 0;
  const hi = series.length ? Math.max(...series) : 0;
  const points = series.map((v, i) => `${15 + i * 60},${105 - ((v - lo) / (hi - lo || 1)) * 78}`).join(" ");
  if (!days.length) return <div className="h-36 rounded-xl bg-slate-50" aria-label="잔고 그래프 불러오는 중" />;
  return <div>
    <svg role="img" aria-label="최근 7일 잔고 그래프" viewBox="0 0 390 125" className="h-36 w-full overflow-visible">
      {[27, 66, 105].map(y => <line key={y} x1="15" y1={y} x2="375" y2={y} stroke="#e2e8f0" strokeDasharray="4 5" />)}
      <polyline points={points} fill="none" stroke={currency === "meso" ? "#2563eb" : "#9333ea"} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {series.map((v, i) => <circle key={i} cx={15 + i * 60} cy={105 - ((v - lo) / (hi - lo || 1)) * 78} r="3.5" fill={currency === "meso" ? "#2563eb" : "#9333ea"} />)}
    </svg>
    <div className="flex justify-between text-xs text-slate-500">{days.map(day => <span key={day}>{day.slice(5)}</span>)}</div>
  </div>;
}

export default function MapleApp() {
  const [hydrated, setHydrated] = useState(false);
  const [screen, setScreen] = useState<Screen>("overview");
  const [currency, setCurrency] = useState<Currency>("meso");
  const [filter, setFilter] = useState<Filter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [dialog, setDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE);
      if (saved) {
        const parsed = JSON.parse(saved) as { rows?: Transaction[]; settings?: Partial<Settings> };
        if (Array.isArray(parsed.rows)) setRows(parsed.rows);
        if (parsed.settings) setSettings({ ...DEFAULT_SETTINGS, ...parsed.settings });
      }
    } catch { /* Corrupted demo data: keep defaults. */ }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) localStorage.setItem(STORE, JSON.stringify({ rows, settings }));
  }, [rows, settings, hydrated]);

  const visibleRows = useMemo(() => rows.filter(r =>
    r.currency === currency && (filter === "all" || r.direction === filter) &&
    (categoryFilter === "all" || r.category === categoryFilter) &&
    `${r.name} ${r.memo} ${CATEGORY_LABELS[r.category]}`.toLowerCase().includes(query.toLowerCase())
  ).sort((a, b) => b.date.localeCompare(a.date)), [rows, currency, filter, categoryFilter, query]);
  const recent = listTransactions(rows).slice(0, 3);
  const listedRows = useMemo(() => listTransactions(visibleRows), [visibleRows]);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const toggleGroup = (id: string) => setExpandedGroups(old => old.includes(id) ? old.filter(v => v !== id) : [...old, id]);
  const meso = balance("meso", rows, settings), point = balance("point", rows, settings);
  function deleteRow(id: string) {
    const target = rows.find(r => r.id === id);
    if (!target || !window.confirm("이 거래를 삭제할까요? 연결된 교환/관세 기록도 함께 삭제됩니다.")) return;
    setRows(prev => prev.filter(r => r.id !== id && (target.linkedId ? r.linkedId !== target.linkedId : true)));
  }
  function openEntry() { setEditId(null); setDialog(true); }
  function openEdit(id: string) { setEditId(id); setDialog(true); }
  function saveRows(newRows: Transaction[]) {
    setRows(prev => {
      if (!editId) return [...prev, ...newRows];
      const old = prev.find(r => r.id === editId);
      return [...prev.filter(r => r.id !== editId && (!old?.linkedId || r.linkedId !== old.linkedId)), ...newRows];
    });
    setDialog(false);
  }
  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
      <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 text-lg font-black text-orange-700">M</div>
      <div><div className="font-bold">Asset Manager</div><div className="text-xs text-slate-500">메이플스토리 가계부</div></div></div>
      <div className="flex gap-2"><button className={`${btn} bg-slate-100 text-sm hover:bg-slate-200`} onClick={() => setShowSettings(true)}>⚙ 설정</button>
      <button className={`${btn} bg-blue-600 text-sm text-white hover:bg-blue-700`} onClick={openEntry}>＋ 거래 입력</button></div>
    </div></header>
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-extrabold">메이플스토리</h1><p className="mt-1 text-sm text-slate-500">두 재화를 한 곳에서 관리해요</p></div>
      <div className="flex rounded-xl bg-slate-200 p-1 text-sm">{([{id:"overview",label:"대시보드"},{id:"transactions",label:"거래 내역"}] as const).map(t => <button key={t.id} onClick={() => setScreen(t.id)} className={`rounded-lg px-4 py-2 font-semibold ${screen === t.id ? "bg-white shadow-sm" : "text-slate-500"}`}>{t.label}</button>)}</div></div>
      {screen === "overview" ? <>
        <div className="grid gap-4 sm:grid-cols-2">
          <button onClick={() => { setCurrency("meso"); setScreen("transactions"); }} className={`${boxes} p-5 text-left transition hover:border-blue-300`}><div className="text-sm text-slate-500">전체 메소 잔고</div><div className="mt-2 break-all text-2xl font-extrabold text-blue-700"><Amount value={meso} currency="meso"/></div><div className="mt-3 text-xs text-slate-500">상세 내역 보기 →</div></button>
          <button onClick={() => { setCurrency("point"); setScreen("transactions"); }} className={`${boxes} p-5 text-left transition hover:border-purple-300`}><div className="text-sm text-slate-500">전체 메이플포인트 잔고</div><div className="mt-2 break-all text-2xl font-extrabold text-purple-700"><Amount value={point} currency="point"/></div><div className="mt-3 text-xs text-slate-500">상세 내역 보기 →</div></button>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <section className={`${boxes} p-5 lg:col-span-2`}><h2 className="mb-4 text-lg font-bold">최근 7일 잔고</h2>
            <div className="grid gap-6 md:grid-cols-2"><div><div className="mb-2 text-sm font-semibold text-blue-700">메소</div><Trend rows={rows} currency="meso" opening={settings.openingMeso}/></div><div><div className="mb-2 text-sm font-semibold text-purple-700">메이플포인트</div><Trend rows={rows} currency="point" opening={settings.openingPoint}/></div></div></section>
          <section className={`${boxes} p-5`}><h2 className="text-lg font-bold">메소마켓 시세</h2><div className="mt-4 text-sm text-slate-500">1억 메소당 메이플포인트</div><div className="mt-2 text-3xl font-black">{settings.marketRate > 0 ? `${fmt(settings.marketRate)} P` : "미설정"}</div><p className="mt-3 text-xs leading-5 text-slate-500">수동으로 입력한 시세입니다. 실시간 자동 수집 및 추이 그래프는 추후 연결됩니다.</p><button onClick={() => setShowSettings(true)} className="mt-4 text-sm font-semibold text-blue-600">시세 입력 →</button></section>
        </div>
        <section className={`${boxes} p-5`}><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">최근 거래 3건</h2><button onClick={() => setScreen("transactions")} className="text-sm font-semibold text-blue-600">모두 보기 →</button></div>
          {recent.length ? <div className="divide-y divide-slate-100">{recent.map(item => <TransactionLine key={item.row.id} row={item.row} members={item.members} expanded={expandedGroups.includes(item.row.linkedId ?? item.row.id)} onToggle={() => toggleGroup(item.row.linkedId ?? item.row.id)} onEdit={openEdit} onDelete={deleteRow}/>)}</div> : <p className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">거래가 없어요. 오른쪽 위에서 첫 거래를 추가해 보세요.</p>}</section>
        <p className="text-center text-xs text-amber-700">개발용 화면: 거래는 현재 브라우저의 localStorage에만 저장됩니다. Supabase 동기화는 아직 연결되지 않았어요.</p>
      </> : <>
        <section className={`${boxes} space-y-4 p-5`}><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><h2 className="text-lg font-bold">거래 내역</h2><button onClick={openEntry} className={`${btn} bg-blue-600 text-sm text-white`}>＋ 입력</button></div>
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-xl bg-slate-100 p-1">{([{id:"meso",label:"메소"},{id:"point",label:"메포"}] as const).map(t => <button key={t.id} onClick={() => setCurrency(t.id)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${currency === t.id ? "bg-white shadow-sm" : "text-slate-500"}`}>{t.label}</button>)}</div>
            <button onClick={() => setFilter(prev => prev === "all" ? "income" : prev === "income" ? "expense" : "all")} className={`${btn} border border-slate-200 bg-white text-sm`}>수익/소비: {filter === "all" ? "전체" : filter === "income" ? "수익" : "소비"} ↻</button>
            <select aria-label="카테고리 필터" className={`${input} w-auto text-sm`} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="all">모든 카테고리</option>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <input className={`${input} min-w-40 flex-1 text-sm`} value={query} onChange={e => setQuery(e.target.value)} placeholder="이름 또는 메모 검색" aria-label="거래 검색"/>
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[630px] text-left text-sm"><thead className="bg-slate-100 text-slate-600"><tr><th className="rounded-l-xl px-3 py-3">Profit/Spent</th><th className="px-3 py-3">Name</th><th className="px-3 py-3">Account Type</th><th className="px-3 py-3">Date</th><th className="px-3 py-3 text-right">{currency === "meso" ? "Meso" : "Point"}</th><th className="rounded-r-xl px-3 py-3">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{listedRows.map(({row, members}) => {
              const groupId = row.linkedId ?? row.id;
              const isGroup = row.category === "boss" && members.length > 1;
              const expanded = expandedGroups.includes(groupId);
              return <tr key={groupId}><td colSpan={6} className="p-0"><table className="w-full table-fixed"><tbody><tr>
                <td className={`w-[15%] px-3 py-3 font-semibold ${row.direction === "income" ? "text-blue-600" : "text-red-600"}`}>{row.direction === "income" ? "Profit" : "Spent"}</td>
                <td className="w-[23%] px-3 py-3">{isGroup ? <button type="button" aria-expanded={expanded} onClick={() => toggleGroup(groupId)} className="text-left font-semibold text-blue-700 underline decoration-dotted underline-offset-4 hover:text-blue-900">{row.name} {expanded ? "▴" : "▾"}</button> : row.name}<div className="max-w-36 truncate text-xs text-slate-400">{isGroup ? `${members.length}개 결정석 · 클릭해서 상세 보기` : row.memo}</div></td>
                <td className="w-[17%] px-3 py-3">{CATEGORY_LABELS[row.category]}</td><td className="w-[14%] px-3 py-3">{row.date}</td>
                <td className="w-[17%] px-3 py-3 text-right font-semibold">{row.direction === "income" ? "+" : "-"}{fmt(row.amount)}</td>
                <td className="w-[14%] whitespace-nowrap px-3 py-3"><button onClick={() => openEdit(row.id)} className="mr-3 text-blue-600">수정</button><button onClick={() => deleteRow(row.id)} className="text-red-600">삭제</button></td>
              </tr>{isGroup && expanded && <tr><td colSpan={6} className="px-3 pb-4"><BossDetails members={members}/></td></tr>}</tbody></table></td></tr>;
            })}</tbody></table>
            {!listedRows.length && <div className="p-10 text-center text-sm text-slate-500">조건에 맞는 거래가 없습니다.</div>}
          </div>
        </section>
      </>}
    </main>
    {dialog && <EntryDialog key={editId ?? "new"} onClose={() => setDialog(false)} onSave={saveRows} current={rows.find(r => r.id === editId)} relatedRows={rows.filter(r => r.linkedId && r.linkedId === rows.find(item => item.id === editId)?.linkedId)} settings={settings} updateSettings={setSettings}/>}
    {showSettings && <SettingsDialog settings={settings} onSave={value => {setSettings(value);setShowSettings(false);}} onClose={() => setShowSettings(false)}/>}
  </div>;
}
function TransactionLine({ row, members, expanded, onToggle, onEdit, onDelete }: { row: Transaction; members: Transaction[]; expanded: boolean; onToggle: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void }) {
  const isGroup = row.category === "boss" && members.length > 1;
  return <div className="py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><ItemIcon name={row.name}/><div>
    {isGroup ? <button type="button" aria-expanded={expanded} onClick={onToggle} className="text-left font-semibold text-blue-700 underline decoration-dotted underline-offset-4">{row.name} {expanded ? "▴" : "▾"}</button> : <div className="font-semibold">{row.name}</div>}
    <div className="text-xs text-slate-500">{row.date} · {CATEGORY_LABELS[row.category]} · {row.currency === "meso" ? "메소" : "메포"}</div></div></div>
    <div className="flex items-center gap-3"><span className={`font-bold ${row.direction === "income" ? "text-blue-600" : "text-red-600"}`}>{row.direction === "income" ? "+" : "-"}<Amount value={row.amount} currency={row.currency}/></span><button onClick={() => onEdit(row.id)} className="text-xs text-blue-600">수정</button><button onClick={() => onDelete(row.id)} className="text-xs text-red-600">삭제</button></div></div>
    {isGroup && expanded && <BossDetails members={members}/>}
  </div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1 text-sm font-medium"><span>{label}</span>{children}</label>; }
function NumberField({ label, value, onChange, min = 0, max, step = 1 }: {label:string; value:number; onChange:(v:number)=>void; min?:number; max?:number; step?:number}) {
  return <Field label={label}><input type="number" className={input} min={min} max={max} step={step} value={value} onChange={e => onChange(num(e.target.value))}/></Field>;
}
function SettingsDialog({ settings, onSave, onClose }: { settings: Settings; onSave: (v: Settings) => void; onClose: () => void }) {
  const [form, setForm] = useState(settings);
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setForm(prev => ({ ...prev, [key]: value }));
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" onMouseDown={onClose}><div role="dialog" aria-modal="true" aria-label="메이플스토리 설정" className={`${boxes} max-h-[90vh] w-full max-w-lg overflow-y-auto p-5`} onMouseDown={e => e.stopPropagation()}>
    <div className="mb-5 flex justify-between"><h2 className="text-xl font-bold">메이플스토리 설정</h2><button onClick={onClose} aria-label="닫기">✕</button></div>
    <div className="space-y-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.mvpSilver} onChange={e => update("mvpSilver", e.target.checked)}/> MVP 실버 이상 (경매장 판매 수수료 3%)</label>
      <NumberField label="메소 초기 잔고" value={form.openingMeso} onChange={v => update("openingMeso", v)}/>
      <NumberField label="메포 초기 잔고" value={form.openingPoint} onChange={v => update("openingPoint", v)}/>
      <NumberField label="메소마켓 시세 (1억 메소당 메포) — 수동 입력" value={form.marketRate} onChange={v => update("marketRate", v)}/>
      <p className="text-xs text-slate-500">사냥 메획·도핑·PC방은 아래 거래 입력에서 변경하면 마지막 설정이 저장됩니다.</p>
      <button className={`${btn} w-full bg-blue-600 text-white`} onClick={() => onSave(form)}>설정 저장</button></div>
  </div></div>;
}

function EntryDialog({ current, relatedRows, settings, updateSettings, onSave, onClose }: { current?: Transaction; relatedRows: Transaction[]; settings: Settings; updateSettings: (v: Settings) => void; onSave: (rows: Transaction[]) => void; onClose: () => void }) {
  const [currency, setCurrency] = useState<Currency>(() => current?.category === "exchange" && current.direction === "income" ? (current.currency === "meso" ? "point" : "meso") : current?.currency ?? "meso");
  const [direction, setDirection] = useState<Direction>(current?.category === "exchange" ? "expense" : current?.direction ?? "income");
  const [category, setCategory] = useState<Category>(current?.category ?? "boss");
  const [name, setName] = useState(current?.name ?? "");
  const [memo, setMemo] = useState(current?.memo ?? "");
  const [date, setDate] = useState(current?.date ?? "");
  useEffect(() => {
    if (!current?.date) setDate(today());
  }, [current?.date]);
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(current?.amount ?? 0);
  const [bossSelections, setBossSelections] = useState<string[]>(() => {
    if (current?.category !== "boss") return [];
    const selected = bossesData.filter(b => (relatedRows.length ? relatedRows : [current]).some(r => r.category === "boss" && r.name.includes(`${b.name} (${b.difficulty})`)));
    return selected.filter((b, i) => selected.findIndex(other => other.name === b.name) === i).map(b => b.id);
  });
  const [bossParties, setBossParties] = useState<Record<string, number>>(() => Object.fromEntries((relatedRows.length ? relatedRows : current ? [current] : []).filter(r => r.category === "boss").map(r => [r.name.split(" (")[0], Number(r.memo.match(/파티 (\d+)명/)?.[1] || 1)])));
  const [exchangeEok, setExchangeEok] = useState(() => {
    const mesoRow = [current, ...relatedRows].find(r => r?.category === "exchange" && r.currency === "meso");
    return mesoRow ? mesoRow.amount / 100_000_000 : 1;
  });
  const [pointPayment, setPointPayment] = useState(() => [current, ...relatedRows].find(r => r?.category === "exchange" && r.currency === "point" && r.direction === "expense")?.amount ?? 0);
  const [pointRefund, setPointRefund] = useState(() => relatedRows.find(r => r.category === "exchange" && r.currency === "point" && r.direction === "income" && r.name.includes("환불"))?.amount ?? 0);
  const [pcBang, setPcBang] = useState(settings.pcBang);
  const [tariff, setTariff] = useState(false);
  const [hunting, setHunting] = useState({equipment:settings.equipment,ability:settings.ability,union:settings.union,wealthPotion:settings.wealthPotion,unionWealth:settings.unionWealth});
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState(true);
  const bossGroups = Array.from(new Set(bossesData.map(b => b.name))).map(bossName => ({
    name: bossName,
    entries: bossesData.filter(b => b.name === bossName),
  }));
  const bossTotal = bossSelections.reduce((total, id) => {
    const b = bossesData.find(v => v.id === id);
    return total + (b ? Math.floor(b.crystalPrice / (bossParties[b.name] || 1)) : 0);
  }, 0);
  const exchangeMeso = exchangeEok * 100_000_000;
  const exchangePoints = mesoToPoints(exchangeMeso, settings.marketRate);
  const pointNet = pointPayment - pointRefund;
  const npc = shopData.find(item => item.name === name.trim());
  const huntingCalc = huntingReward(price, hunting);
  const auction = auctionPayout(price, quantity, 5000, settings.mvpSilver, pcBang);
  const isMesoIncome = currency === "meso" && direction === "income";
  const itemMatches = itemsData.filter(item => name.trim() && (item.name.includes(name) || item.keywords.some(k => k.includes(name)))).slice(0, 6);
  const options: { value: Category; label: string }[] = currency === "point" ?
    [{value:"exchange",label:"메소마켓 거래"},{value:"cash",label:"캐시샵 구매"}] : direction === "income" ?
    [{value:"boss",label:"보스 수익"},{value:"hunting",label:"사냥 수익"},{value:"auction",label:"경매장 판매"},{value:"npc",label:"잡화상인 판매"},{value:"exchange",label:"메소마켓 교환"},{value:"other",label:"기타 수입"}] :
    [{value:"purchase",label:"아이템 구매"},{value:"exchange",label:"메소마켓 교환"},{value:"other",label:"기타 지출"}];
  const isExchange = category === "exchange";
  const rate = settings.marketRate;
  function switchCurrency(next: Currency) {
    setCurrency(next); setDirection(next === "point" ? "expense" : "income"); setCategory(next === "point" ? "exchange" : "boss"); setPrice(0);setName("");setError("");
  }
  function switchDirection(next: Direction) {
    setDirection(next); setCategory(currency === "point" ? "exchange" : next === "income" ? "boss" : "purchase");setPrice(0);setError("");
  }
  function submit() {
    setError("");
    if (!date) return setError("날짜를 입력해 주세요.");
    if (!Number.isSafeInteger(price) || price < 0 || !Number.isSafeInteger(quantity) || quantity < 1) return setError("금액과 수량은 유효한 정수여야 합니다.");
    if (category === "hunting" && (hunting.equipment < 0 || hunting.equipment > 100 || hunting.ability < 0 || hunting.ability > 20 || hunting.union < 0 || hunting.union > 15 || ![hunting.equipment,hunting.ability,hunting.union].every(Number.isInteger))) return setError("메획 설정의 허용 범위를 확인하세요.");
    if (category === "boss") {
      if (!bossSelections.length) return setError("보스 난이도를 하나 이상 선택해 주세요.");
      if (bossSelections.some(id => {
        const b = bossesData.find(v => v.id === id);
        const members = b ? (bossParties[b.name] || 1) : 0;
        return !b || b.crystalPrice <= 0 || !Number.isInteger(members) || members < 1 || members > 6;
      })) return setError("선택한 난이도의 bosses.json 결정석 가격(1 이상)과 파티 인원을 확인해 주세요.");
    }
    if (category === "npc" && (!npc || npc.unitPrice <= 0)) return setError("shop-prices.json에 등록되어 가격이 1 이상인 아이템만 판매할 수 있어요.");
    if (category === "auction" && (price < 1 || auction.net <= 0)) return setError("경매장 순수익은 1 이상이어야 합니다. 개당 가격과 수량을 확인하세요.");
    if (category !== "boss" && category !== "npc" && category !== "auction" && !isExchange && price < 1) return setError("금액은 1 이상이어야 합니다.");
    if (isExchange && (!Number.isSafeInteger(exchangeMeso) || !Number.isInteger(exchangeEok) || exchangeEok < 1)) return setError("환전할 메소는 1억 이상, 정수 단위로 입력해 주세요.");
    if (isExchange && currency === "point" && (!Number.isSafeInteger(pointPayment) || pointPayment < 1 || !Number.isSafeInteger(pointRefund) || pointRefund < 0 || pointRefund >= pointPayment || pointNet < 1)) return setError("포인트 수는 1 이상이고 환불 메포는 지불 메포보다 작아야 합니다.");
    if (((isExchange && currency === "meso") || (category === "purchase" && tariff)) && (!Number.isSafeInteger(rate) || rate <= 0)) return setError("설정에서 유효한 메소마켓 시세를 입력해 주세요.");
    if (category === "purchase" && tariff && rate <= 0) return setError("관세 계산을 위해 설정에서 메소마켓 시세를 입력해 주세요.");
    if (isExchange && currency === "meso" && rate <= 0) return setError("교환하려면 설정에서 메소마켓 시세를 먼저 입력해야 합니다.");
    if (currency === "point" && direction !== "expense") return setError("메포 수익은 메소마켓 교환의 연결 기록으로만 생성됩니다.");
    let amount = price;
    if (category === "boss") amount = bossTotal;
    if (category === "hunting") amount = huntingCalc.total;
    if (category === "auction") amount = auction.net;
    if (category === "npc") amount = npc!.unitPrice * quantity;
    if (category !== "auction" && category !== "boss" && category !== "hunting" && category !== "npc" && category !== "exchange") amount = price * quantity;
    if (isExchange) amount = currency === "point" ? pointNet : exchangeMeso;
    if (amount < 1 || !Number.isSafeInteger(amount)) return setError("계산된 거래 금액이 올바르지 않아요.");
    const shared = {date, memo};
    const linkedId = (isExchange || (category === "purchase" && tariff)) ? makeId() : undefined;
    if (category === "boss") {
      const batchId = makeId();
      const records: Transaction[] = bossSelections.map(id => {
        const b = bossesData.find(v => v.id === id)!;
        const members = bossParties[b.name] || 1;
        return {id:makeId(), currency:"meso", direction:"income", category:"boss", amount:Math.floor(b.crystalPrice / members), name:`${b.name} (${b.difficulty}) 보스 결정석`, linkedId:batchId, date, memo:`파티 ${members}명${memo ? ` · ${memo}` : ""}`};
      });
      updateSettings({...settings, ...hunting,pcBang});
      onSave(records);
      return;
    }
    const primary: Transaction = {id:makeId(),currency,direction,category,amount,name:category === "hunting" ? "사냥 순수익" : isExchange ? "메소마켓 교환" : name.trim() || CATEGORY_LABELS[category],linkedId,...shared};
    const next: Transaction[] = [primary];
    if (isExchange) {
      // Point spent buys meso; meso spent buys points. Never guess game-side fee.
      if (currency === "meso" && direction === "expense") {
        const gain = mesoToPoints(exchangeMeso, rate);
        if (gain < 1) return setError("수령 메포가 1 미만입니다. 금액/환율을 확인하세요.");
        next.push({id:makeId(), currency:"point",direction:"income",category:"exchange",amount:gain,name:"메소마켓 교환 수령",linkedId,...shared});
      } else if (currency === "point" && direction === "expense") {
        const gain = exchangeMeso;
        if (gain < 1 || !Number.isSafeInteger(gain)) return setError("수령 메소 계산에 실패했어요.");
        next.push({id:makeId(), currency:"meso",direction:"income",category:"exchange",amount:gain,name:"메소마켓 교환 수령",linkedId,...shared});
      } else if (currency === "meso" && direction === "income") {
        return setError("메소마켓 수령은 메포 소비 화면에서 교환을 입력하면 자동 기록됩니다.");
      }
    }
    if (isExchange && currency === "point" && pointRefund > 0) {
      next.push({id:makeId(), currency:"point",direction:"income",category:"exchange",amount:pointRefund,name:"메소마켓 환불 메포",linkedId,...shared});
      // Primary transaction records the gross amount; refund is tracked separately.
      primary.amount = pointPayment;
    }
    if (category === "purchase" && tariff) {
      const cost = taxPoints(amount, rate);
      if (cost < 1) return setError("계산된 관세가 1 메포 미만입니다.");
      next.push({id:makeId(),currency:"point",direction:"expense",category:"purchase",amount:cost,name:`${primary.name} (관세)`,linkedId,...shared});
    }
    updateSettings({...settings, ...hunting,pcBang});
    onSave(next);
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" onMouseDown={onClose}><div role="dialog" aria-modal="true" aria-label="거래 입력" className={`${boxes} max-h-[94vh] w-full max-w-2xl overflow-y-auto p-5 sm:p-6`} onMouseDown={e => e.stopPropagation()}>
    <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-extrabold">{current ? "거래 수정" : "새 거래 입력"}</h2><button onClick={onClose} className="rounded-xl bg-slate-100 px-3 py-2" aria-label="닫기">✕</button></div>
    <div className="mb-5 grid grid-cols-2 gap-3"><div className="flex rounded-xl bg-slate-100 p-1">{([{id:"meso",label:"메소"},{id:"point",label:"메포"}] as const).map(t => <button key={t.id} className={`flex-1 rounded-lg py-2 text-sm font-bold ${currency === t.id ? "bg-white shadow-sm" : "text-slate-500"}`} onClick={() => switchCurrency(t.id)}>{t.label}</button>)}</div>
      <div className="flex rounded-xl bg-slate-100 p-1">{([{id:"income",label:"수익"},{id:"expense",label:"소비"}] as const).map(t => <button key={t.id} disabled={currency === "point" && t.id === "income"} className={`flex-1 rounded-lg py-2 text-sm font-bold disabled:opacity-30 ${direction === t.id ? "bg-white shadow-sm" : "text-slate-500"}`} onClick={() => switchDirection(t.id)}>{t.label}</button>)}</div></div>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Account Type"><select className={input} value={category} onChange={e => {setCategory(e.target.value as Category);setError("");setPrice(0);}}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
      <Field label="거래 날짜"><input type="date" className={input} value={date} onChange={e => setDate(e.target.value)}/></Field>
      {category === "boss" ? <div className="space-y-3 sm:col-span-2">
        <div className="grid grid-cols-[minmax(72px,0.9fr)_minmax(0,2.5fr)_minmax(90px,0.9fr)] gap-2 rounded-xl bg-slate-100 px-3 py-3 text-xs font-bold text-slate-600 sm:text-sm"><span>보스 이름</span><span>난이도 (보스별 1개 선택)</span><span>파티원</span></div>
        {bossGroups.map(group => <div key={group.name} className="grid grid-cols-[minmax(72px,0.9fr)_minmax(0,2.5fr)_minmax(90px,0.9fr)] items-center gap-2 rounded-xl border border-slate-200 p-3">
          <strong className="text-sm">{group.name}</strong>
          <div className="flex flex-wrap gap-x-3 gap-y-2">{group.entries.map(b => <label key={b.id} className="inline-flex items-center gap-1.5 text-sm"><input type="checkbox" checked={bossSelections.includes(b.id)} onChange={e => setBossSelections(old => e.target.checked ? [...old.filter(id => !group.entries.some(other => other.id === id)), b.id] : old.filter(id => id !== b.id))}/>{b.difficulty}</label>)}</div>
          <label className="flex items-center gap-1"><input aria-label={`${group.name} 파티원 수`} type="number" min={1} max={6} step={1} className={`${input} min-w-0 px-2`} value={bossParties[group.name] ?? 1} onChange={e => setBossParties(prev => ({...prev,[group.name]:num(e.target.value)}))}/><span className="shrink-0 text-sm">명</span></label>
        </div>)}
        <div className="rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700">선택 난이도 {bossSelections.length}개 · 예상 총 수익 {fmt(bossTotal)} 메소</div>
        <p className="text-xs text-slate-500">각 보스에서 난이도는 하나만 선택할 수 있습니다. 여러 보스를 함께 저장하면 거래 목록에서 대표 보스 이름 외 n개로 묶어 표시하며, 이름을 누르면 상세 내역을 확인할 수 있습니다. 결정석 가격은 data/maple/bosses.json에서 입력해야 합니다.</p>
      </div> : null}
      {category === "hunting" ? <><NumberField label="순수 메소 획득량 (메획 적용 전)" value={price} onChange={setPrice}/>
        <div className="grid grid-cols-3 gap-2 sm:col-span-2"><NumberField label="장비 메획 (%)" value={hunting.equipment} onChange={v => setHunting(p=>({...p,equipment:v}))} max={100}/><NumberField label="어빌리티 (%)" value={hunting.ability} onChange={v=>setHunting(p=>({...p,ability:v}))} max={20}/><NumberField label="유니온 (%)" value={hunting.union} onChange={v=>setHunting(p=>({...p,union:v}))} max={15}/></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hunting.wealthPotion} onChange={e=>setHunting(p=>({...p,wealthPotion:e.target.checked}))}/> 재물 획득의 비약 (+20%)</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hunting.unionWealth} onChange={e=>setHunting(p=>({...p,unionWealth:e.target.checked}))}/> 유니온의 부 (+50%)</label>
        <div className="rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700 sm:col-span-2">합계 +{huntingCalc.rate}% → {fmt(huntingCalc.total)} 메소</div></> : null}
      {category !== "boss" && category !== "hunting" && category !== "exchange" ? <div className="relative sm:col-span-2"><Field label={category === "exchange" ? "교환 이름 (선택)" : "아이템 또는 소비 이름 (선택)"}><input className={input} value={name} onChange={e=>{setName(e.target.value);setSuggestions(true);}} onKeyDown={e=>{if(e.key === "Tab" && itemMatches.length && suggestions){e.preventDefault();setName(itemMatches[0].name);setSuggestions(false);}}} placeholder="아이템명 입력 후 Tab으로 자동완성"/></Field>
        {suggestions && itemMatches.length>0 && <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white p-1 shadow-xl">{itemMatches.map(it=><button type="button" key={it.id} className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm hover:bg-slate-100" onClick={()=>{setName(it.name);setSuggestions(false);}}><ItemIcon name={it.name}/>{it.name}</button>)}</div>}</div> : null}
      {category === "npc" && <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 sm:col-span-2">등록된 잡화상인 아이템: {shopData.map(i=>`${i.name} (${fmt(i.unitPrice)})`).join(", ")}. JSON에서 가격 입력 후 사용 가능.</div>}
      {category !== "boss" && category !== "hunting" && !isExchange && <><NumberField label={category === "auction" || category === "npc" ? "개당 가격" : "가격"} value={category === "npc" ? npc?.unitPrice ?? 0 : price} onChange={setPrice} min={category === "npc" ? 0 : 1}/>{category !== "cash" && <NumberField label="수량" value={quantity} onChange={setQuantity} min={1}/>}</>}
      {isExchange && <>
        <NumberField label={currency === "point" ? "억 메소" : "환전할 메소 (단위 : 억)"} value={exchangeEok} onChange={setExchangeEok} min={1}/>
        {currency === "point" && <><NumberField label="포인트 수" value={pointPayment} onChange={setPointPayment} min={1}/><NumberField label="환불 메포" value={pointRefund} onChange={setPointRefund} min={0}/></>}
      </>}
      {category === "auction" && <><div className="rounded-xl bg-slate-50 p-3 text-sm">등록 수수료 <strong>5,000 메소 (고정)</strong></div><label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" checked={pcBang} onChange={e=>setPcBang(e.target.checked)}/> 이번 거래 PC방 적용</label><div className="rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700 sm:col-span-2">판매 수수료 {auction.feeRate*100}% · 등록비 5,000 메소 차감 · 순수익 {fmt(auction.net)} 메소</div></>}
      {category === "purchase" && <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={tariff} onChange={e=>setTariff(e.target.checked)}/> 타 서버 구매 관세 적용 (메소 금액 10%를 메포로 차감)</label>}
      {(isExchange || (category === "purchase" && tariff)) && <div className="rounded-xl bg-purple-50 p-3 text-sm text-purple-800 sm:col-span-2">현재 수동 시세: 1억 메소 = {fmt(rate)} P<br/>{isExchange ? (currency === "point" ? `수령 ${fmt(exchangeMeso)} 메소 · 메포 순지출 ${fmt(pointNet)} P` : `예상 수령 ${fmt(exchangePoints)} 메포`) : `관세 예상: ${fmt(taxPoints(price*quantity,rate))} 메포`}<p className="mt-1 text-xs">실제 수령량, 게임 내 추가 수수료는 아직 반영하지 않은 계산 예시입니다.</p></div>}
      <div className="sm:col-span-2"><Field label="메모 (선택)"><textarea className={input} rows={2} value={memo} onChange={e=>setMemo(e.target.value)}/></Field></div>
    </div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="mt-6 flex justify-end gap-2"><button className={`${btn} bg-slate-100`} onClick={onClose}>취소</button><button className={`${btn} bg-blue-600 text-white`} onClick={submit}>{current ? "수정 저장" : "거래 저장"}</button></div>
  </div></div>;
}
