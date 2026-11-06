"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import bossesData from "@/data/maple/bosses.json";
import itemsData from "@/data/maple/items.json";
import shopData from "@/data/maple/shop-prices.json";
import {
  auctionPayout, balance, CATEGORY_LABELS, DEFAULT_SETTINGS, ENHANCEMENT_TYPES,
  fmt, huntingReward, koreanAmount, makeId,
  type BossPreset, type Category, type Direction, type Settings, type Transaction,
} from "@/lib/maple/calculations";

const KEY = "asset-manager-maple-demo-v1"; // Keep v1 storage key to preserve demo history.
const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const input = "w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const button = "rounded-xl px-4 py-2.5 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";
const dateNow = () => new Date().toLocaleDateString("en-CA");
const valid = (x: number) => Number.isSafeInteger(x) && x >= 0;
const number = (s: string) => s.trim() === "" ? 0 : Number(s);
type Screen = "dashboard" | "transactions";
type Filter = "all" | Direction;
type BossChoice = { bossId: string; party: number };
const bossGroups = [...new Set(bossesData.map(b => b.name))].map(name => ({ name, entries: bossesData.filter(b => b.name === name) }));
const displayCategories: Category[] = ["boss", "hunting", "auction", "npc", "purchase", "enhancement", "other"];

// Resolve an icon from the existing JSON master files, including older saved transactions.
// Boss groups use the representative boss's weekly/monthly crystal image.
function transactionIcon(row: Transaction): string | undefined {
  if (row.category === "boss") {
    const boss = bossesData.find(b => row.name.startsWith(`${b.name} (${b.difficulty})`))
      ?? bossesData.find(b => row.name === b.name || row.name.startsWith(`${b.name} 외 `));
    return boss?.image;
  }
  const itemName = row.name.trim();
  if (!itemName) return undefined;
  const item = itemsData.find(x => x.name === itemName)
    ?? itemsData.find(x => itemName.startsWith(`${x.name} (`));
  if (item?.image) return item.image;
  const shop = shopData.find(x => x.name === itemName);
  return shop?.image;
}

function TransactionIcon({ row, size = "normal" }: { row: Transaction; size?: "normal" | "small" }) {
  const src = transactionIcon(row);
  const [failed, setFailed] = useState(false);
  // A broken/missing public image should not display an empty or broken thumbnail.
  if (!src || failed) return null;
  const dimensions = size === "small" ? "h-8 w-8" : "h-10 w-10";
  return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)}
    className={`${dimensions} shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1`} />;
}

function Field({ label, children }: {label: string; children: ReactNode}) {
  return <label className="block space-y-1.5 text-sm font-medium"><span>{label}</span>{children}</label>;
}
function NumberField({ label, value, onChange, min=0, max, unit=true }: {label:string;value:number;onChange:(n:number)=>void;min?:number;max?:number;unit?:boolean}) {
  return <div><Field label={label}><input type="number" step="1" min={min} max={max} value={value} onChange={e => onChange(number(e.target.value))} className={input}/></Field>
    {unit && <div className="mt-1 min-h-4 text-xs text-slate-400">{koreanAmount(value) || "금액을 입력하세요"}</div>}</div>;
}
function Modal({ title, children, onClose, wide=false }: {title:string;children:ReactNode;onClose:()=>void;wide?:boolean}) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" onMouseDown={onClose}>
    <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={e => e.stopPropagation()} className={`max-h-[94vh] w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6 ${wide ? "max-w-4xl" : "max-w-xl"}`}>
      <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-xl font-extrabold">{title}</h2><button type="button" onClick={onClose} aria-label="닫기" className="rounded-xl bg-slate-100 px-3 py-2">✕</button></div>
      {children}
    </div>
  </div>;
}
function transactionGroup(rows: Transaction[]) {
  const groups = new Map<string, Transaction[]>();
  for (const row of rows) {
    const key = row.category === "boss" && row.linkedId ? row.linkedId : row.id;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].map(members => {
    const ordered = [...members].sort((a, b) => {
      const getBase = (r: Transaction) => bossesData.find(b => r.name.startsWith(`${b.name} (${b.difficulty})`))?.crystalPrice ?? r.amount;
      return getBase(b) - getBase(a);
    });
    const top = ordered[0];
    const bossName = top.name.split(" (")[0];
    return { row: { ...top, name: members.length > 1 ? `${bossName} 외 ${members.length - 1}개` : top.name, amount: members.reduce((s,r) => s+r.amount,0) }, members };
  }).sort((a,b) => b.row.date.localeCompare(a.row.date));
}
function Trend({rows, opening}:{rows:Transaction[]; opening:number}) {
  // Read the current date after hydration, not during Next.js prerender.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => { setToday(dateNow()); }, []);
  const days = useMemo(() => {
    if (!today) return [];
    const [year, month, day] = today.split("-").map(Number);
    const end = new Date(year, month - 1, day, 12);
    return Array.from({length:7}, (_,i) => {
      const d = new Date(end);
      d.setDate(d.getDate() - (6-i));
      return d.toLocaleDateString("en-CA");
    });
  }, [today]);
  const series = days.map(day => opening + rows.filter(r => r.currency === "meso" && r.date <= day).reduce((sum,r)=>sum+(r.direction === "income"?r.amount:-r.amount),0));
  const low = series.length ? Math.min(...series) : opening;
  const high = series.length ? Math.max(...series) : opening;
  const plot = (v:number,i:number) => `${15+i*60},${105-((v-low)/(high-low||1))*78}`;
  return <><svg viewBox="0 0 390 125" role="img" aria-label="최근 7일 메소 잔고" className="h-36 w-full">
    {[27,66,105].map(y => <line key={y} x1="15" y1={y} x2="375" y2={y} stroke="#e2e8f0" strokeDasharray="4 5"/>)}
    <polyline points={series.map(plot).join(" ")} stroke="#2563eb" strokeWidth="3" fill="none" strokeLinejoin="round" strokeLinecap="round"/>
    {series.map((v,i)=><circle key={i} cx={15+i*60} cy={105-((v-low)/(high-low||1))*78} r="3" fill="#2563eb"/>)}
  </svg><div className="flex justify-between text-xs text-slate-500">{days.map(d=><span key={d}>{d.slice(5)}</span>)}</div></>;
}
function BossSelector({choices,onChange}:{choices:BossChoice[];onChange:(v:BossChoice[])=>void}) {
  const selected = (name:string) => choices.find(c => bossesData.find(b => b.id === c.bossId)?.name === name);
  return <div className="space-y-2">
    <div className="grid grid-cols-[75px_minmax(0,1fr)_95px] gap-2 rounded-xl bg-slate-100 p-3 text-xs font-bold sm:grid-cols-[100px_minmax(0,1fr)_120px]"><span>보스 이름</span><span>난이도 (하나 선택)</span><span>파티원</span></div>
    {bossGroups.map(group => { const pick = selected(group.name); return <div key={group.name} className="grid grid-cols-[75px_minmax(0,1fr)_95px] items-center gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[100px_minmax(0,1fr)_120px]">
      <strong className="text-sm">{group.name}</strong>
      <div className="flex flex-wrap gap-x-3 gap-y-2">{group.entries.map(b=><label key={b.id} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={pick?.bossId===b.id} onChange={e=>onChange(e.target.checked ? [...choices.filter(c=>!group.entries.some(x=>x.id===c.bossId)),{bossId:b.id,party:pick?.party??1}] : choices.filter(c=>c.bossId!==b.id))}/>{b.difficulty}</label>)}</div>
      <div className="flex items-center gap-1"><input type="number" aria-label={`${group.name} 파티원`} disabled={!pick} min={1} max={6} step={1} value={pick?.party ?? 1} onChange={e=>onChange(choices.map(c=>c.bossId===pick?.bossId ? {...c,party:number(e.target.value)}:c))} className={`${input} px-2 disabled:bg-slate-100`}/><span className="shrink-0 text-sm">명</span></div>
    </div>; })}
  </div>;
}
function BossBreakdown({members}:{members:Transaction[]}) {
  return <div className="mt-2 space-y-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm"><strong className="text-blue-800">보스 수익 상세 · {members.length}개</strong>
    {members.map(m=><div key={m.id} className="flex items-center justify-between gap-2 border-t border-blue-100 py-2"><div className="flex min-w-0 items-center gap-2"><TransactionIcon row={m} size="small"/><span>{m.name}<small className="block text-slate-500">{m.memo}</small></span></div><strong className="shrink-0">+{fmt(m.amount)}</strong></div>)}
    <div className="border-t border-blue-200 pt-2 text-right font-bold">합계 +{fmt(members.reduce((s,r)=>s+r.amount,0))} 메소</div>
  </div>;
}
function groupedBossRows(choices:BossChoice[],date:string,memo:string):Transaction[] {
  const linkedId = makeId();
  return choices.map(choice=>{
    const boss = bossesData.find(b=>b.id===choice.bossId)!;
    return { id:makeId(),linkedId,date,category:"boss",currency:"meso",direction:"income",amount:Math.floor(boss.crystalPrice/choice.party),name:`${boss.name} (${boss.difficulty}) 보스 결정석`,memo:`파티 ${choice.party}명${memo ? ` · ${memo}`:""}` };
  });
}
function validateBosses(choices:BossChoice[]) {
  if (!choices.length) return "보스 난이도를 하나 이상 선택해 주세요.";
  for (const choice of choices) {
    const b = bossesData.find(x=>x.id===choice.bossId);
    if (!b || !valid(b.crystalPrice) || b.crystalPrice===0) return "선택한 보스의 결정석 가격을 data/maple/bosses.json에 1 이상으로 입력해 주세요.";
    if (!Number.isInteger(choice.party) || choice.party<1 || choice.party>6) return "파티원은 1~6명으로 입력해 주세요.";
  }
  return "";
}

export default function MapleApp() {
  const [ready,setReady] = useState(false);
  const [rows,setRows] = useState<Transaction[]>([]);
  const [settings,setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [screen,setScreen] = useState<Screen>("dashboard");
  const [filter,setFilter] = useState<Filter>("all");
  const [categoryFilter,setCategoryFilter] = useState("all");
  const [query,setQuery] = useState("");
  const [editing,setEditing] = useState<string|null>(null);
  const [entryOpen,setEntryOpen] = useState(false);
  const [settingsOpen,setSettingsOpen] = useState(false);
  const [expanded,setExpanded] = useState<string[]>([]);
  useEffect(()=>{
    try { const stored = localStorage.getItem(KEY); if(stored) {const parsed=JSON.parse(stored) as {rows?:Transaction[];settings?:Partial<Settings>}; if(Array.isArray(parsed.rows))setRows(parsed.rows);if(parsed.settings)setSettings({...DEFAULT_SETTINGS,...parsed.settings,presets:parsed.settings.presets??[]});} }catch{/* Demo data could be corrupt */}
    setReady(true);
  },[]);
  useEffect(()=>{if(ready)localStorage.setItem(KEY,JSON.stringify({rows,settings}));},[rows,settings,ready]);
  // Previous point history is kept in localStorage, but entirely hidden in the meso-only view.
  const mesoRows = rows.filter(r=>r.currency==="meso" && r.category!=="exchange" && r.category!=="cash");
  const total = balance("meso",mesoRows,settings);
  const visible = useMemo(()=>mesoRows.filter(r=>(filter==="all"||r.direction===filter)&&(categoryFilter==="all"||r.category===categoryFilter)&&`${r.name} ${r.memo} ${CATEGORY_LABELS[r.category]??r.category}`.toLowerCase().includes(query.trim().toLowerCase())),[rows,filter,categoryFilter,query]);
  const listed = transactionGroup(visible);
  const recent = transactionGroup(mesoRows).slice(0,3);
  const toggle = (id:string) => setExpanded(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const openAdd = () => {setEditing(null);setEntryOpen(true);};
  const openEdit = (id:string) => {setEditing(id);setEntryOpen(true);};
  const replace = (next:Transaction[]) => {
    const old = rows.find(r=>r.id===editing);
    setRows(prev=>[...prev.filter(r=>!old || (r.id!==old.id && (!old.linkedId||r.linkedId!==old.linkedId))),...next]);
    setEntryOpen(false);setEditing(null);
  };
  const remove = (id:string) => {
    const old=rows.find(r=>r.id===id);
    if(!old||!confirm("이 거래를 삭제할까요? 같은 묶음에 속한 보스 기록도 함께 삭제됩니다."))return;
    setRows(prev=>prev.filter(r=>r.id!==id && (!old.linkedId||r.linkedId!==old.linkedId)));
  };
  const savePresetIncome = (preset:BossPreset) => {
    const reason=validateBosses(preset.entries);
    if(reason){alert(reason);return;}
    if(!confirm(`${preset.characterName}의 보스 수익 ${preset.entries.length}건을 오늘 날짜로 등록할까요?`))return;
    setRows(prev=>[...prev,...groupedBossRows(preset.entries,dateNow(),`프리셋: ${preset.characterName}`)]);
    setSettingsOpen(false);
  };
  const renderLine = ({row,members}:{row:Transaction;members:Transaction[]}) => {
    const key=row.linkedId??row.id;
    const isGroup=row.category==="boss" && members.length>1;
    return <div key={key} className="border-t border-slate-100 py-3 first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-3"><TransactionIcon row={row}/><div className="min-w-0">
        {isGroup?<button type="button" onClick={()=>toggle(key)} className="font-semibold text-blue-700 underline decoration-dotted underline-offset-4">{row.name} {expanded.includes(key)?"▴":"▾"}</button>:<strong>{row.name}</strong>}
        <div className="text-xs text-slate-500">{row.date} · {CATEGORY_LABELS[row.category]??row.category}</div></div></div>
        <div className="flex flex-wrap items-center gap-3"><span className={`font-bold ${row.direction==="income"?"text-blue-600":"text-red-600"}`}>{row.direction==="income"?"+":"-"}{fmt(row.amount)} 메소</span><button type="button" onClick={()=>openEdit(row.id)} className="text-xs text-blue-600">수정</button><button type="button" onClick={()=>remove(row.id)} className="text-xs text-red-600">삭제</button></div></div>
      {isGroup && expanded.includes(key)&&<BossBreakdown members={members}/>}
    </div>;
  };
  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 font-black text-orange-700">M</div><div><strong>Asset Manager</strong><div className="text-xs text-slate-500">메이플스토리 가계부</div></div></div><div className="flex gap-2"><button type="button" className={`${button} bg-slate-100 text-sm`} onClick={()=>setSettingsOpen(true)}>⚙ 설정</button><button type="button" className={`${button} bg-blue-600 text-sm text-white`} onClick={openAdd}>＋ 거래 입력</button></div></div></header>
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-extrabold">메이플스토리</h1><p className="text-sm text-slate-500">메소 수익과 소비 관리</p></div><div className="flex rounded-xl bg-slate-200 p-1">{([{value:"dashboard",label:"대시보드"},{value:"transactions",label:"거래 내역"}] as const).map(t=><button type="button" key={t.value} onClick={()=>setScreen(t.value)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${screen===t.value?"bg-white shadow-sm":"text-slate-500"}`}>{t.label}</button>)}</div></div>
      {screen==="dashboard"? <>
        <div className="grid gap-4 sm:grid-cols-2"><button type="button" onClick={()=>setScreen("transactions")} className={`${card} text-left hover:border-blue-300`}><div className="text-sm text-slate-500">전체 메소 잔고</div><div className="mt-2 text-2xl font-extrabold tabular-nums">{fmt(total)} 메소</div></button><section className={card}><div className="text-sm text-slate-500">Profit &amp; Loss</div><div className="mt-2 text-2xl font-extrabold">{fmt(mesoRows.reduce((s,r)=>s+(r.direction==="income"?r.amount:-r.amount),0))} 메소</div></section></div>
        <section className={card}><h2 className="mb-3 font-bold">최근 7일 잔고</h2><Trend rows={mesoRows} opening={settings.openingMeso}/></section>
        <section className={card}><div className="mb-2 flex items-center justify-between"><h2 className="font-bold">최근 거래 3건</h2><button type="button" onClick={()=>setScreen("transactions")} className="text-sm text-blue-600">모두 보기</button></div>{recent.length?recent.map(renderLine):<p className="p-5 text-sm text-slate-500">거래 내역이 없어요.</p>}</section>
      </>:<section className={`${card} space-y-4`}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">거래 내역</h2><button type="button" onClick={openAdd} className={`${button} bg-blue-600 text-sm text-white`}>＋ 입력</button></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>setFilter(p=>p==="all"?"income":p==="income"?"expense":"all")} className={`${button} border border-slate-200 bg-white text-sm`}>수익/소비: {filter==="all"?"전체":filter==="income"?"수익":"소비"} ↻</button><select aria-label="Account Type 필터" value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)} className={`${input} w-auto text-sm`}><option value="all">모든 카테고리</option>{displayCategories.map(c=><option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</select><input className={`${input} min-w-40 flex-1 text-sm`} value={query} onChange={e=>setQuery(e.target.value)} aria-label="검색" placeholder="이름 또는 메모 검색"/></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm"><thead className="bg-slate-100 text-left"><tr><th className="rounded-l-xl px-3 py-3">Profit/Spent</th><th className="px-3 py-3">Name</th><th className="px-3 py-3">Account Type</th><th className="px-3 py-3">Date</th><th className="px-3 py-3 text-right">Meso</th><th className="rounded-r-xl px-3 py-3">Action</th></tr></thead><tbody>{listed.map(({row,members})=>{const key=row.linkedId??row.id;const group=row.category==="boss"&&members.length>1;return <tr key={key}><td colSpan={6} className="p-0"><table className="w-full table-fixed"><tbody><tr className="border-b border-slate-100"><td className={`w-[15%] px-3 py-3 font-bold ${row.direction==="income"?"text-blue-600":"text-red-600"}`}>{row.direction==="income"?"Profit":"Spent"}</td><td className="w-[23%] px-3 py-3"><div className="flex min-w-0 items-center gap-2"><TransactionIcon row={row}/><div className="min-w-0">{group?<button type="button" onClick={()=>toggle(key)} className="break-words text-left font-semibold text-blue-700 underline">{row.name} {expanded.includes(key)?"▴":"▾"}</button>:<span className="break-words">{row.name}</span>}<small className="block truncate text-slate-400">{row.memo}</small></div></div></td><td className="w-[17%] px-3 py-3">{CATEGORY_LABELS[row.category]??row.category}</td><td className="w-[14%] px-3 py-3">{row.date}</td><td className="w-[17%] px-3 py-3 text-right font-semibold">{row.direction==="income"?"+":"-"}{fmt(row.amount)}</td><td className="w-[14%] px-3 py-3"><button type="button" onClick={()=>openEdit(row.id)} className="mr-2 text-blue-600">수정</button><button type="button" onClick={()=>remove(row.id)} className="text-red-600">삭제</button></td></tr>{group&&expanded.includes(key)&&<tr><td colSpan={6} className="px-3 pb-3"><BossBreakdown members={members}/></td></tr>}</tbody></table></td></tr>})}</tbody></table>{!listed.length&&<p className="p-8 text-center text-slate-500">조건에 맞는 거래가 없어요.</p>}</div>
      </section>}
      <p className="text-center text-xs text-amber-700">개발용 프로토타입: 현재 브라우저에만 저장됩니다. Supabase 동기화는 아직 연결되지 않았어요. 이전 메포·메소마켓 기록은 삭제하지 않고 현재 메소 전용 집계에서 제외합니다.</p>
    </main>
    {entryOpen&&<EntryModal key={editing??"new"} current={rows.find(r=>r.id===editing)} related={rows.filter(r=>r.linkedId&&r.linkedId===rows.find(x=>x.id===editing)?.linkedId)} settings={settings} setSettings={setSettings} onSave={replace} onClose={()=>setEntryOpen(false)}/>}
    {settingsOpen&&<SettingsModal settings={settings} onSave={setSettings} onClose={()=>setSettingsOpen(false)} onPresetIncome={savePresetIncome}/>}
  </div>;
}

function SettingsModal({settings,onSave,onClose,onPresetIncome}:{settings:Settings;onSave:(v:Settings)=>void;onClose:()=>void;onPresetIncome:(p:BossPreset)=>void}) {
  const [draft,setDraft]=useState<Settings>({...settings,presets:settings.presets??[]});
  const [tab,setTab]=useState<"general"|"preset">("general");
  const [character,setCharacter]=useState("");
  const [choices,setChoices]=useState<BossChoice[]>([]);
  const [editPresetId,setEditPresetId]=useState<string|null>(null);
  const [error,setError]=useState("");
  const presets=draft.presets??[];
  const reset=()=>{setEditPresetId(null);setCharacter("");setChoices([]);setError("");};
  const addPreset=()=>{
    if(!character.trim())return setError("캐릭터 이름을 입력해 주세요.");
    if(!choices.length)return setError("보스를 하나 이상 선택해 주세요.");
    if(choices.some(c=>!Number.isInteger(c.party)||c.party<1||c.party>6))return setError("파티원은 1~6명으로 입력해 주세요.");
    const preset:BossPreset={id:editPresetId??makeId(),characterName:character.trim(),entries:choices};
    const next={...draft,presets:editPresetId?presets.map(p=>p.id===editPresetId?preset:p):[...presets,preset]};
    setDraft(next);onSave(next);reset();
  };
  return <Modal title="메이플스토리 설정" onClose={onClose} wide={tab==="preset"}>
    <div className="mb-4 flex rounded-xl bg-slate-100 p-1">{([{id:"general",label:"기본 설정"},{id:"preset",label:"캐릭터 보스 프리셋"}] as const).map(t=><button key={t.id} type="button" onClick={()=>setTab(t.id)} className={`flex-1 rounded-lg px-3 py-2 font-bold ${tab===t.id?"bg-white shadow-sm":"text-slate-500"}`}>{t.label}</button>)}</div>
    {tab==="general"?<div className="space-y-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.mvpSilver} onChange={e=>setDraft(p=>({...p,mvpSilver:e.target.checked}))}/> MVP 실버 이상 (경매장 수수료 3%)</label><NumberField label="메소 초기 잔고" value={draft.openingMeso} onChange={v=>setDraft(p=>({...p,openingMeso:v}))}/><p className="text-xs text-slate-500">메획, 도핑, PC방은 거래 입력에서 변경하면 마지막 설정이 유지됩니다.</p><button type="button" className={`${button} w-full bg-blue-600 text-white`} onClick={()=>{if(!valid(draft.openingMeso))return;onSave(draft);onClose();}}>설정 저장</button></div>:<div className="space-y-4">
      <p className="text-sm text-slate-600">캐릭터별로 처치하는 보스와 파티 인원을 저장할 수 있어요. 프리셋으로 수익 등록 시 날짜는 오늘이며, 결정을 위한 가격은 bosses.json에서 불러옵니다.</p>
      {presets.length>0&&<div className="space-y-2">{presets.map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3"><div><strong>{p.characterName}</strong><p className="text-xs text-slate-500">선택된 보스 {p.entries.length}개</p></div><div className="flex flex-wrap gap-2"><button className={`${button} bg-blue-600 text-xs text-white`} onClick={()=>onPresetIncome(p)}>오늘 수익 등록</button><button className={`${button} bg-slate-100 text-xs`} onClick={()=>{setEditPresetId(p.id);setCharacter(p.characterName);setChoices(p.entries);setError("");}}>수정</button><button className={`${button} bg-red-50 text-xs text-red-600`} onClick={()=>{if(confirm(`${p.characterName} 프리셋을 삭제할까요?`)){const next={...draft,presets:presets.filter(x=>x.id!==p.id)};setDraft(next);onSave(next);if(editPresetId===p.id)reset();}}}>삭제</button></div></div>)}</div>}
      <div className="space-y-3 rounded-2xl bg-slate-50 p-3"><Field label={editPresetId?"캐릭터 프리셋 수정":"새 캐릭터 이름"}><input className={input} value={character} onChange={e=>setCharacter(e.target.value)} placeholder="예: 본캐"/></Field><BossSelector choices={choices} onChange={setChoices}/>{error&&<p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="flex gap-2"><button className={`${button} bg-blue-600 text-white`} onClick={addPreset}>{editPresetId?"프리셋 수정 저장":"프리셋 추가"}</button>{editPresetId&&<button className={`${button} bg-slate-200`} onClick={reset}>취소</button>}</div></div>
    </div>}
  </Modal>;
}

function EntryModal({current,related,settings,setSettings,onSave,onClose}:{current?:Transaction;related:Transaction[];settings:Settings;setSettings:(s:Settings)=>void;onSave:(next:Transaction[])=>void;onClose:()=>void}) {
  const [direction,setDirection]=useState<Direction>(current?.direction??"income");
  const [category,setCategory]=useState<Category>(()=>current?.category==="exchange"?"other":current?.category??"boss");
  const [date,setDate]=useState(current?.date??"");
  useEffect(() => { if (!current?.date) setDate(dateNow()); }, [current?.date]);
  const [name,setName]=useState(current?.name??"");
  const [memo,setMemo]=useState(current?.memo??"");
  const [quantity,setQuantity]=useState(1);
  const [price,setPrice]=useState(current?.amount??0);
  const [pcBang,setPcBang]=useState(settings.pcBang);
  const [suggest,setSuggest]=useState(true);
  const [enhanceType,setEnhanceType]=useState<string>(current?.category==="enhancement" ? current.name : ENHANCEMENT_TYPES[0]);
  const [hunting,setHunting]=useState({equipment:settings.equipment,ability:settings.ability,union:settings.union,wealthPotion:settings.wealthPotion,unionWealth:settings.unionWealth});
  const [choices,setChoices]=useState<BossChoice[]>(()=>{
    if(current?.category!=="boss")return [];
    return (related.length?related:[current]).filter(r=>r.category==="boss").flatMap(r=>{
      const b=bossesData.find(x=>r.name.startsWith(`${x.name} (${x.difficulty})`));
      return b?[{bossId:b.id,party:Number(r.memo.match(/파티 (\d+)명/)?.[1]??1)}]:[];
    });
  });
  const [selectedPreset,setSelectedPreset]=useState("");
  const [error,setError]=useState("");
  const options:Category[] = direction==="income"?["boss","hunting","auction","npc","other"]:["purchase","enhancement","other"];
  const npc=shopData.find(x=>x.name===name.trim());
  const npcPrice=npc?.unitPrice && npc.unitPrice>0?npc.unitPrice:price;
  const auction=auctionPayout(price,quantity,5000,settings.mvpSilver,pcBang);
  const hunt=huntingReward(price,hunting);
  const matches = category === "npc"
    ? shopData.filter(x => name.trim() && x.name.toLocaleLowerCase().includes(name.trim().toLocaleLowerCase())).slice(0, 8)
    : itemsData.filter(x => name.trim() && (x.name.toLocaleLowerCase().includes(name.trim().toLocaleLowerCase()) || x.keywords.some(k => k.toLocaleLowerCase().includes(name.trim().toLocaleLowerCase())))).slice(0, 8);
  const chooseSuggestion = (value: string) => {
    setName(value);
    setSuggest(false);
    setPrice(0);
  };
  const npcTotal = npcPrice * quantity;
  const bossTotal=choices.reduce((s,c)=>{const b=bossesData.find(x=>x.id===c.bossId);return s+(b?Math.floor(b.crystalPrice/(c.party||1)):0);},0);
  function changeDirection(next:Direction){setDirection(next);setCategory(next==="income"?"boss":"purchase");setName("");setPrice(0);setError("");}
  function submit(){
    setError("");
    if(!date)return setError("거래 날짜를 입력해 주세요.");
    if(category==="boss"){
      const reason=validateBosses(choices);if(reason)return setError(reason);
      const next=groupedBossRows(choices,date,memo);setSettings({...settings,...hunting,pcBang});onSave(next);return;
    }
    if(!valid(price)||!Number.isInteger(quantity)||quantity<1)return setError("금액은 0 이상의 안전한 정수, 수량은 1 이상의 정수로 입력해 주세요.");
    if(category==="hunting"&&(!valid(hunting.equipment)||hunting.equipment>100||!valid(hunting.ability)||hunting.ability>20||!valid(hunting.union)||hunting.union>15))return setError("메획 범위를 확인해 주세요.");
    if(category==="auction"&&(!name.trim()||price<1||auction.net<1))return setError("경매장 판매는 아이템명, 개당 가격 및 수량이 필요하고 순수익은 1 이상이어야 해요.");
    if(category==="npc"&&(!name.trim()||npcPrice<1||!valid(npcPrice)))return setError("잡화상인 아이템 이름과 개당 가격을 입력해 주세요. JSON 가격이 없는 아이템은 직접 가격을 입력할 수 있어요.");
    if(category!=="auction"&&category!=="npc"&&category!=="hunting"&&price<1)return setError("금액은 1 이상이어야 해요.");
    let amount=price*quantity;
    if(category==="auction")amount=auction.net;
    if(category==="npc")amount=npcPrice*quantity;
    if(category==="hunting")amount=hunt.total;
    if(!valid(amount)||amount<1)return setError("계산된 금액을 확인해 주세요.");
    const displayName=category==="hunting"?"사냥 순수익":category==="enhancement"?enhanceType:category==="other"?(name.trim()||CATEGORY_LABELS["other"]):name.trim()||CATEGORY_LABELS[category];
    const record:Transaction={id:makeId(),currency:"meso",direction,category,date,name:displayName,memo,amount};
    setSettings({...settings,...hunting,pcBang});onSave([record]);
  }
  return <Modal title={current?"거래 수정":"새 거래 입력"} onClose={onClose} wide>
    <div className="mb-5 flex rounded-xl bg-slate-100 p-1">{([{id:"income",label:"수익"},{id:"expense",label:"소비"}] as const).map(t=><button type="button" key={t.id} onClick={()=>changeDirection(t.id)} className={`flex-1 rounded-lg py-2 font-bold ${direction===t.id?"bg-white shadow-sm":"text-slate-500"}`}>{t.label}</button>)}</div>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Account Type"><select className={input} value={category} onChange={e=>{setCategory(e.target.value as Category);setPrice(0);setName("");setError("");}}>{options.map(c=><option key={c} value={c}>{category===c&&c==="other"&&direction==="expense"?"기타 지출":category===c&&c==="other"?"기타 수입":CATEGORY_LABELS[c]}</option>)}</select></Field><Field label="거래 날짜"><input type="date" className={input} value={date} onChange={e=>setDate(e.target.value)}/></Field>
      {category==="boss"&&<div className="space-y-3 sm:col-span-2"><Field label="캐릭터 프리셋 불러오기 (선택)"><select value={selectedPreset} onChange={e=>{setSelectedPreset(e.target.value);const p=(settings.presets??[]).find(x=>x.id===e.target.value);if(p)setChoices(p.entries);}} className={input}><option value="">직접 선택</option>{(settings.presets??[]).map(p=><option key={p.id} value={p.id}>{p.characterName}</option>)}</select></Field><BossSelector choices={choices} onChange={setChoices}/><div className="rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-700">선택 {choices.length}개 · 예상 총 수익 {fmt(bossTotal)} 메소</div><p className="text-xs text-slate-500">결정석 가격은 data/maple/bosses.json에서 관리합니다. 같은 보스는 난이도 하나만 선택할 수 있어요.</p></div>}
      {category==="hunting"&&<><NumberField label="순수 메소 획득량 (메획 적용 전)" value={price} onChange={setPrice}/><div className="sm:col-span-2 grid grid-cols-3 gap-2"><NumberField label="장비 메획 %" value={hunting.equipment} onChange={v=>setHunting(p=>({...p,equipment:v}))} max={100} unit={false}/><NumberField label="어빌리티 %" value={hunting.ability} onChange={v=>setHunting(p=>({...p,ability:v}))} max={20} unit={false}/><NumberField label="유니온 %" value={hunting.union} onChange={v=>setHunting(p=>({...p,union:v}))} max={15} unit={false}/></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hunting.wealthPotion} onChange={e=>setHunting(p=>({...p,wealthPotion:e.target.checked}))}/> 재물 획득의 비약 +20%</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hunting.unionWealth} onChange={e=>setHunting(p=>({...p,unionWealth:e.target.checked}))}/> 유니온의 부 +50%</label><div className="rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-700 sm:col-span-2">메획 +{hunt.rate}% · 총 {fmt(hunt.total)} 메소</div></>}
      {(category==="auction"||category==="npc"||category==="purchase"||category==="other")&&<div className="relative sm:col-span-2"><Field label={category==="other"?"이름 (선택)":"아이템 이름"}><input className={input} value={name} onChange={e=>{setName(e.target.value);setSuggest(true);setPrice(0);}} placeholder={category==="npc"?"잡화상인 아이템 입력 후 Tab으로 자동완성":"이름 입력"} autoComplete="off" onKeyDown={e=>{if((e.key==="Tab"||e.key==="Enter")&&matches.length&&suggest){e.preventDefault();chooseSuggestion(matches[0].name);}else if(e.key==="Escape")setSuggest(false);}}/></Field>{suggest&&matches.length>0&&<div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white p-1 shadow-lg">{matches.map(m=><button type="button" key={m.id} onClick={()=>chooseSuggestion(m.name)} className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm hover:bg-slate-100">{"image" in m && m.image ? <img src={m.image} alt="" className="h-8 w-8 shrink-0 rounded-lg object-contain" onError={e=>{e.currentTarget.style.display="none";}}/> : null}<span>{m.name}</span>{category==="npc" && "unitPrice" in m && <span className="ml-auto text-xs text-slate-500">{fmt(m.unitPrice)} 메소</span>}</button>)}</div>}</div>}
      {category==="enhancement"&&<div className="sm:col-span-2"><Field label="강화 종류"><select className={input} value={enhanceType} onChange={e=>setEnhanceType(e.target.value)}>{ENHANCEMENT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></Field></div>}
      {category!=="boss"&&category!=="hunting"&&<><NumberField label={category==="auction"||category==="npc"?"개당 가격":"가격"} value={category==="npc"&&npc?.unitPrice&&npc.unitPrice>0?npc.unitPrice:price} onChange={setPrice}/>{category!=="enhancement"&&category!=="other"&&<NumberField label="수량" value={quantity} onChange={setQuantity} min={1} unit={false}/>}</>}
      {category==="npc"&&<div aria-live="polite" className="space-y-1 rounded-xl bg-blue-50 p-3 text-sm sm:col-span-2"><div className="font-semibold text-blue-700">예상 판매 금액: {valid(npcTotal) ? fmt(npcTotal) : "금액 확인 필요"} 메소</div><div className="text-xs text-slate-600">{npc && npc.unitPrice > 0 ? "JSON에 등록된 개당 가격이 자동 적용됐습니다." : "JSON에 없는 아이템은 개당 가격을 직접 입력할 수 있습니다."} 개당 가격 × 수량, 수수료 없음</div></div>}
      {category==="auction"&&<><div className="rounded-xl bg-slate-50 p-3 text-sm">등록 수수료 <strong>5,000 메소 (고정)</strong></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pcBang} onChange={e=>setPcBang(e.target.checked)}/> 이번 거래 PC방 적용</label><div className="rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-700 sm:col-span-2">판매 수수료 {auction.feeRate*100}% · 등록 수수료 5,000 메소 · 순수익 {fmt(auction.net)} 메소</div></>}
      <div className="sm:col-span-2"><Field label="메모 (선택)"><textarea className={input} rows={2} value={memo} onChange={e=>setMemo(e.target.value)}/></Field></div>
    </div>
    {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className={`${button} bg-slate-100`}>취소</button><button type="button" onClick={submit} className={`${button} bg-blue-600 text-white`}>{current?"수정 저장":"거래 저장"}</button></div>
  </Modal>;
}
