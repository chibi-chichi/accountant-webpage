
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

export default function TestLoginPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (error) {
        setError(error.message);
      }

      setUser(data.user);
      setLoading(false);
    };

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          `${window.location.origin}/auth/callback?next=/test-login`,
      },
    });

    if (error) setError(error.message);
  };

  const handleLogout = async () => {
    setError(null);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setError(error.message);
      return;
    }

    setUser(null);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold">Asset Manager</h1>

      {loading ? (
        <p>로그인 상태 확인 중...</p>
      ) : user ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-xl font-semibold">
            로그인 성공!
          </p>

          <p>
            {user.user_metadata?.full_name ?? "사용자"}님,
            환영합니다.
          </p>

          <p className="text-gray-500">{user.email}</p>

          <button
            onClick={handleLogout}
            className="rounded-lg bg-red-600 px-6 py-3 text-white"
          >
            Log out
          </button>
        </div>
      ) : (
        <button
          onClick={handleGoogleLogin}
          className="rounded-lg bg-black px-6 py-3 text-white"
        >
          Sign in with Google
        </button>
      )}

      {error && <p className="text-red-500">{error}</p>}
    </main>
  );
}
