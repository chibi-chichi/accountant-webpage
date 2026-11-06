import { createClient } from "@/lib/supabase/client";
import type { BossPreset, Settings, Transaction } from "@/lib/maple/calculations";
import { DEFAULT_SETTINGS } from "@/lib/maple/calculations";
import bossesData from "@/data/maple/bosses.json";

const db = () => createClient();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const uuid = () => crypto.randomUUID();
const assert = (error: {message:string}|null) => { if (error) throw new Error(error.message); };

export async function getMapleUser() {
  const { data, error } = await db().auth.getUser();
  assert(error);
  if (!data.user) throw new Error("Google 로그인이 필요합니다. 메인 화면에서 로그인해 주세요.");
  return data.user.id;
}

const settingsRecord = (userId:string, s:Settings) => ({
  user_id:userId, opening_meso:s.openingMeso, mvp_silver:s.mvpSilver,
  pc_bang:s.pcBang, equipment:s.equipment, ability:s.ability,
  union_bonus:s.union, wealth_potion:s.wealthPotion, union_wealth:s.unionWealth,
});

export async function loadMaple() {
  const userId = await getMapleUser();
  const client=db();
  const [tx, st, ps, bs] = await Promise.all([
    client.from("maple_transactions").select("*").eq("user_id", userId).order("transaction_date",{ascending:false}).limit(10000),
    client.from("maple_settings").select("*").eq("user_id",userId).maybeSingle(),
    client.from("maple_boss_presets").select("*").eq("user_id",userId),
    client.from("maple_preset_bosses").select("*").eq("user_id",userId),
  ]);
  for(const x of [tx,st,ps,bs]) assert(x.error);
  if((tx.data?.length??0)===10000) throw new Error("거래가 10,000개 이상입니다. 페이지네이션을 추가하기 전에는 전체를 표시할 수 없습니다.");
  const presets:BossPreset[]=(ps.data??[]).map(p=>({
    id:p.id,characterName:p.character_name,
    entries:(bs.data??[]).filter(b=>b.preset_id===p.id).map(b=>({bossId:b.boss_id,party:b.party_size})),
  }));
  const settings:Settings={...DEFAULT_SETTINGS,
    ...(st.data?{openingMeso:Number(st.data.opening_meso),mvpSilver:st.data.mvp_silver,
      pcBang:st.data.pc_bang,equipment:st.data.equipment,ability:st.data.ability,
      union:st.data.union_bonus,wealthPotion:st.data.wealth_potion,unionWealth:st.data.union_wealth}:{}),
    presets,
  };
  const rows:Transaction[]=(tx.data??[]).map(t=>({
    id:t.id, date:t.transaction_date,name:t.name,category:t.category,
    direction:t.direction,currency:"meso",amount:Number(t.amount),memo:t.memo,
    ...(t.linked_id?{linkedId:t.linked_id}:{}),
  }));
  return { rows, settings };
}

export async function saveMapleSettings(s:Settings) {
  const userId=await getMapleUser();
  const {error}=await db().from("maple_settings").upsert(settingsRecord(userId,s),{onConflict:"user_id"});
  assert(error);
}

export async function syncMaplePresets(presets:BossPreset[]) {
  const userId=await getMapleUser(); const client=db();
  const {data:existing,error:fetchError}=await client.from("maple_boss_presets").select("id").eq("user_id",userId);
  assert(fetchError);
  const savedIds=new Set(presets.map(p=>p.id));
  for(const old of existing??[]) if(!savedIds.has(old.id)) {
    const {error}=await client.from("maple_boss_presets").delete().eq("id",old.id).eq("user_id",userId);
    assert(error);
  }
  for(const preset of presets) {
    if (!uuidPattern.test(preset.id)) throw new Error("프리셋 ID가 UUID가 아닙니다.");
    const {error:upsertError}=await client.from("maple_boss_presets").upsert({id:preset.id,user_id:userId,character_name:preset.characterName},{onConflict:"id"});
    assert(upsertError);
    const {error:clearError}=await client.from("maple_preset_bosses").delete().eq("preset_id",preset.id).eq("user_id",userId);
    assert(clearError);
    if(preset.entries.length){
      const entries=preset.entries.map(c=>{
        const boss=bossesData.find(b=>b.id===c.bossId);
        if(!boss) throw new Error(`알 수 없는 보스: ${c.bossId}`);
        return {preset_id:preset.id,user_id:userId,boss_id:c.bossId,boss_name:boss.name,difficulty:boss.difficulty,party_size:c.party};
      });
      const {error}=await client.from("maple_preset_bosses").insert(entries);
      assert(error);
    }
  }
}

const transactionRecord = (userId:string,r:Transaction)=>({
  id:r.id,user_id:userId,transaction_date:r.date,direction:r.direction,category:r.category,
  name:r.name,memo:r.memo,amount:r.amount,linked_id:r.linkedId??null,
});

export async function saveMapleTransactions(next:Transaction[], old?:Transaction) {
  const userId=await getMapleUser();const client=db();
  if(next.some(r=>r.currency!=="meso"||r.category==="exchange"||r.category==="cash"||!uuidPattern.test(r.id)||!!r.linkedId&&!uuidPattern.test(r.linkedId)))throw new Error("지원하지 않는 거래 데이터 또는 ID입니다.");
  const {error:insertError}=await client.from("maple_transactions").insert(next.map(r=>transactionRecord(userId,r)));
  assert(insertError);
  if(old) {
    let deleteQuery=client.from("maple_transactions").delete().eq("user_id",userId);
    deleteQuery=old.linkedId?deleteQuery.eq("linked_id",old.linkedId):deleteQuery.eq("id",old.id);
    const {error}=await deleteQuery;
    if(error){
      // Best-effort rollback: old data remains intact if deletion failed.
      const ids=next.map(r=>r.id);
      await client.from("maple_transactions").delete().eq("user_id",userId).in("id",ids);
      throw new Error(`기존 거래 교체에 실패했습니다: ${error.message}`);
    }
  }
}

export async function deleteMapleTransactions(old:Transaction) {
  const userId=await getMapleUser();
  let q=db().from("maple_transactions").delete().eq("user_id",userId);
  q=old.linkedId?q.eq("linked_id",old.linkedId):q.eq("id",old.id);
  const {error}=await q;assert(error);
}

// Generate deterministic UUIDs so retrying a partially completed legacy import does not duplicate records.
async function legacyUuid(userId:string, kind:string, original:string){
  const bytes=new TextEncoder().encode(`${userId}:${kind}:${original}`);
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",bytes));
  const b=digest.slice(0,16);b[6]=(b[6]&15)|80;b[8]=(b[8]&63)|128;
  const h=[...b].map(x=>x.toString(16).padStart(2,"0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
export type LegacySnapshot={rows:Transaction[];settings:Settings};
export function readLegacySnapshot():LegacySnapshot|null {
  try{
    const raw=localStorage.getItem("asset-manager-maple-demo-v1");
    if(!raw)return null;
    const parsed=JSON.parse(raw);
    return {rows:Array.isArray(parsed.rows)?parsed.rows:[],settings:{...DEFAULT_SETTINGS,...parsed.settings,presets:parsed.settings?.presets??[]}};
  }catch{return null;}
}
export async function importLegacy(snapshot:LegacySnapshot){
  const userId=await getMapleUser();const client=db();
  const [t,s,p]=await Promise.all([
    client.from("maple_transactions").select("id",{count:"exact",head:true}).eq("user_id",userId),
    client.from("maple_settings").select("user_id",{count:"exact",head:true}).eq("user_id",userId),
    client.from("maple_boss_presets").select("id",{count:"exact",head:true}).eq("user_id",userId),
  ]);
  for(const x of [t,s,p])assert(x.error);
  // Idempotent retries allowed only if all cloud records were inserted by this same importer? Not provable;
  // therefore require an empty account for manual import, no overwrites.
  if((t.count??0)>0||(s.count??0)>0||(p.count??0)>0)throw new Error("클라우드에 이미 데이터가 있습니다. 중복 방지를 위해 빈 계정에서만 이전할 수 있습니다.");
  const filtered=snapshot.rows.filter(r=>r.currency==="meso"&&!["exchange","cash"].includes(r.category));
  const rows:Transaction[]=[];
  for(const [i,r] of filtered.entries()){
    if(!Number.isSafeInteger(r.amount)||r.amount<1)throw new Error(`기존 거래 ${i+1}번의 금액을 확인해 주세요.`);
    rows.push({...r,id:await legacyUuid(userId,"transaction",`${r.id}:${i}`),...(r.linkedId?{linkedId:await legacyUuid(userId,"group",r.linkedId)}:{})});
  }
  const presets:BossPreset[]=[];
  for(const [i,preset] of (snapshot.settings.presets??[]).entries()){
    presets.push({...preset,id:await legacyUuid(userId,"preset",`${preset.id}:${i}`)});
  }
  if(rows.length){
    const {error}=await client.from("maple_transactions").insert(rows.map(r=>transactionRecord(userId,r)));
    assert(error);
  }
  await saveMapleSettings({...snapshot.settings,presets:[]});
  if(presets.length)await syncMaplePresets(presets);
  return rows.length;
}
