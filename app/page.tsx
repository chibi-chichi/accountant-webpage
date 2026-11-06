"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

function MapleLeaf({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className} fill="none">
      <path d="M24 3 29 14l7-5-1 10 9 5-9 5 2 9-10-4-3 11-3-11-10 4 2-9-9-5 9-5-1-10 7 5L24 3Z" fill="currentColor" />
      <path d="M24 29v15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!active) return;
      setUser(data.user ?? null);
      // A missing session is normal for visitors; no need to display an error.
      if (authError && !/session missing|auth session missing/i.test(authError.message)) {
        console.warn("Could not check the current session:", authError.message);
      }
      setChecking(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setChecking(false);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn() {
    setError(null);
    setWorking(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error("Google login error:", error.message);
      alert("로그인에 실패했습니다: " + error.message);
    }
    // On success the browser navigates to Google and back through the auth callback.
  }

  async function signOut() {
    setError(null);
    setWorking(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
    else setUser(null);
    setWorking(false);
  }

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "사용자";

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-900">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Asset Manager 홈">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 9h18M16 14h2"/></svg>
            </div>
            <span className="text-lg font-extrabold tracking-tight">Asset Manager</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            {checking ? (
              <span className="text-sm text-slate-400" role="status">로그인 확인 중…</span>
            ) : user ? (
              <>
                <span className="hidden max-w-48 truncate text-sm text-slate-600 sm:block">{displayName}님</span>
                <button type="button" disabled={working} onClick={signOut} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-50 disabled:opacity-50">로그아웃</button>
              </>
            ) : (
              <button type="button" disabled={working} onClick={signIn} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50">Google 로그인</button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-8 sm:pt-16">
        <section className="relative isolate overflow-hidden rounded-3xl bg-slate-100 text-slate-950 shadow-lg shadow-slate-900/10">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/images/home-hero.webp')" }}
          />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/65 to-white/10" />
          <div className="relative max-w-2xl px-7 py-12 sm:px-12 sm:py-16">
            <div className="mb-5 inline-flex rounded-full border border-slate-900/20 bg-white/65 px-4 py-1.5 text-xs font-semibold tracking-wide text-slate-950">PERSONAL ASSET DASHBOARD</div>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-5xl">하나의 공간에서<br />모든 자산을 관리하세요.</h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-900 sm:text-base">현실 자산과 게임 내 재화를 한눈에 확인하는 개인 가계부. 메이플스토리의 메소 수익과 소비부터 시작해 보세요.</p>
            {!checking && !user && <button type="button" disabled={working} onClick={signIn} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-100 disabled:opacity-50">Google 계정으로 시작하기 <ArrowIcon /></button>}
            {!checking && user && <p className="mt-7 text-sm font-medium text-slate-950">{displayName}님, 관리할 가계부를 선택해 주세요.</p>}
          </div>
        </section>

        {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">인증 오류: {error}</div>}

        <section className="mt-12 sm:mt-14" aria-labelledby="workspace-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="workspace-heading" className="text-2xl font-extrabold tracking-tight">내 가계부</h2>
              <p className="mt-1 text-sm text-slate-500">가계부를 선택하면 상세 대시보드로 이동해요.</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">1개 사용 가능</span>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {user ? (
              <Link href="/maple" className="group relative flex min-h-64 flex-col overflow-hidden rounded-3xl border border-orange-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-orange-300 hover:shadow-xl hover:shadow-orange-100/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                <div className="absolute -right-9 -top-10 h-40 w-40 rounded-full bg-orange-50" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-md shadow-orange-200"><MapleLeaf className="h-9 w-9"/></div>
                <div className="relative mt-6 flex flex-1 flex-col">
                  <span className="text-xs font-semibold text-orange-600">GAME ACCOUNT</span>
                  <h3 className="mt-1 text-xl font-extrabold">메이플스토리</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">메소 잔고 · 보스 수익 · 사냥 · 거래 내역</p>
                  <div className="mt-auto flex items-center justify-between pt-6 text-sm font-bold text-blue-700"><span>가계부 열기</span><ArrowIcon /></div>
                </div>
              </Link>
            ) : (
              <div className="relative flex min-h-64 flex-col rounded-3xl border border-orange-200 bg-white p-6 shadow-sm">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 text-white"><MapleLeaf className="h-9 w-9"/></div>
                <span className="mt-6 text-xs font-semibold text-orange-600">GAME ACCOUNT</span>
                <h3 className="mt-1 text-xl font-extrabold">메이플스토리</h3>
                <p className="mt-2 text-sm text-slate-500">메소 수익과 소비를 관리해요.</p>
                <p className="mt-auto pt-6 text-sm font-medium text-slate-500">Google 로그인 후 이용 가능</p>
              </div>
            )}

            <div className="flex min-h-64 flex-col rounded-3xl border border-slate-200 bg-white p-6 opacity-85 shadow-sm">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h5"/></svg>
              </div>
              <span className="mt-6 text-xs font-semibold text-emerald-700">REAL-WORLD ACCOUNT</span>
              <h3 className="mt-1 text-xl font-extrabold">현실 가계부</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">현실 자산과 지출 관리 기능을 준비하고 있어요.</p>
              <span className="mt-auto w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">준비 중</span>
            </div>

            <div className="flex min-h-64 flex-col rounded-3xl border border-dashed border-slate-300 bg-white/70 p-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl font-light text-slate-400">+</div>
              <span className="mt-6 text-xs font-semibold text-slate-400">COMING LATER</span>
              <h3 className="mt-1 text-xl font-extrabold text-slate-600">다른 게임 추가</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">지원하는 게임을 차차 늘려갈 예정이에요.</p>
              <span className="mt-auto w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">준비 중</span>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-slate-200/80 bg-white py-6 text-center text-xs text-slate-400">Asset Manager · Personal finance & game assets</footer>
    </div>
  );
}
