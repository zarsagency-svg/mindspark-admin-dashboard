"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AdminDashboard } from "@/components/AdminDashboard";
import { GlassShieldIcon, GoogleGLogo } from "@/components/GlassIcons3D";
import { isAdminEmail } from "@/lib/admins";
import { supabase } from "@/lib/supabase";

const glassPanel: React.CSSProperties = {
  background:
    "linear-gradient(160deg, rgba(46,93,230,0.34) 0%, rgba(15,34,112,0.92) 52%, rgba(7,16,57,0.98) 100%)",
  borderTop: "1.5px solid rgba(230,237,253,0.62)",
  borderLeft: "1px solid rgba(230,237,253,0.38)",
  borderRight: "1px solid rgba(175,197,248,0.28)",
  borderBottom: "1.5px solid rgba(7,16,57,0.9)",
  boxShadow:
    "0 25px 60px -12px rgba(7,16,57,0.95), 0 0 40px rgba(46,93,230,0.35)",
};

export default function AdminConsole() {
  const [checking, setChecking] = useState(true);
  const [adminEmail, setAdminEmail] = useState("");
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let live = true;
    const sync = async () => {
      const { data, error: userError } = await supabase.auth.getUser();
      if (!live) return;
      const email = data.user?.email?.toLowerCase() ?? "";
      const approved =
        !userError &&
        isAdminEmail(email) &&
        Boolean(
          data.user?.identities?.some(
            (identity) => identity.provider === "google"
          )
        );
      setAdminEmail(approved ? email : "");
      setChecking(false);
    };
    void sync();
    const { data } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => {
        void sync();
      }, 0);
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError("");
    setStarting(true);
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (signInError) {
      setError("Google sign-in could not start. Please try again.");
      setStarting(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setAdminEmail("");
  }, []);

  if (checking) {
    return (
      <main className="site-shell min-h-[100dvh] flex items-center justify-center p-4">
        <div className="w-6 h-6 rounded-full border-2 border-[#AFC5F8] border-t-transparent animate-spin" />
      </main>
    );
  }

  if (!adminEmail) {
    return (
      <main className="site-shell min-h-[100dvh] flex items-center justify-center p-4 relative overflow-hidden">
        <div
          className="relative w-full max-w-sm rounded-[28px] p-6 sm:p-8 text-[#E6EDFD] animate-pop-in text-center space-y-6"
          style={glassPanel}
        >
          <div className="flex flex-col items-center gap-3">
            <GlassShieldIcon className="w-14 h-14" />
            <h1 className="font-display text-xl font-extrabold text-[#E6EDFD] tracking-tight">
              MIND SPARK
            </h1>
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={starting}
            className="w-full py-3.5 px-4 rounded-2xl font-display font-bold text-sm text-[#E6EDFD] flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60 transition-transform hover:scale-[1.01]"
            style={{
              background: "linear-gradient(135deg, #2E5DE6 0%, #6E92F2 100%)",
              border: "1px solid rgba(230,237,253,0.6)",
              boxShadow: "0 8px 22px rgba(46,93,230,0.55)",
            }}
          >
            <GoogleGLogo className="w-5 h-5" />
            <span>{starting ? "Opening Google…" : "Continue with Google"}</span>
          </button>

          {error && (
            <p
              role="alert"
              className="text-xs text-[#FCA5A5] bg-[#EF4444]/20 border border-[#EF4444]/40 rounded-xl px-3 py-2"
            >
              {error}
            </p>
          )}
        </div>
      </main>
    );
  }

  return <AdminDashboard adminEmail={adminEmail} onSignOut={signOut} />;
}
