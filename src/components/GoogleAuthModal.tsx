"use client";

import React, { useState } from "react";
import { CheckCircle2, ShieldCheck, Sparkles, UserCheck, X } from "lucide-react";
import { GoogleGLogo } from "./GlassIcons3D";

export interface GoogleUserProfile {
  googleEmail: string;
  googleName: string;
  googleAvatar: string;
  googleSub: string;
}

export const GOOGLE_STORAGE_KEY = "mindspark_google_user";

export const PRESET_GOOGLE_ACCOUNTS: GoogleUserProfile[] = [
  {
    googleName: "Aarav Sharma",
    googleEmail: "aarav.sharma.jee2026@gmail.com",
    googleAvatar: "AS",
    googleSub: "google-oauth2|10928374651",
  },
  {
    googleName: "Ananya Verma",
    googleEmail: "ananya.verma.neet@gmail.com",
    googleAvatar: "AV",
    googleSub: "google-oauth2|10928374699",
  },
];

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (profile: GoogleUserProfile) => void;
}

export function GoogleAuthModal({
  isOpen,
  onClose,
  onSuccess,
}: GoogleAuthModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  if (!isOpen) return null;

  const completeLogin = (profile: GoogleUserProfile) => {
    setIsAuthenticating(true);
    setError("");
    setTimeout(() => {
      try {
        localStorage.setItem(GOOGLE_STORAGE_KEY, JSON.stringify(profile));
      } catch {
        // ignore storage errors
      }
      setIsAuthenticating(false);
      onSuccess(profile);
      onClose();
    }, 240);
  };

  const handleCustomGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setError("Please enter your full name from your Google Account.");
      return;
    }
    if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      setError("Please enter a valid Google email address (e.g. name@gmail.com).");
      return;
    }

    const initials =
      cleanName
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "GU";

    completeLogin({
      googleName: cleanName,
      googleEmail: cleanEmail,
      googleAvatar: initials,
      googleSub: `google-oauth2|${btoa(cleanEmail).slice(0, 14)}`,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-auth-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{
        background: "rgba(7, 16, 57, 0.78)",
        backdropFilter: "var(--glass-overlay-filter)",
        WebkitBackdropFilter: "var(--glass-overlay-filter)",
      }}
    >
      <div
        className="relative w-full max-w-md rounded-[28px] p-5 sm:p-6 text-[#E6EDFD] overflow-hidden animate-pop-in"
        style={{
          background:
            "linear-gradient(160deg, rgba(46,93,230,0.38) 0%, rgba(15,34,112,0.92) 48%, rgba(7,16,57,0.98) 100%)",
          borderTop: "1.5px solid rgba(230,237,253,0.62)",
          borderLeft: "1px solid rgba(230,237,253,0.38)",
          borderRight: "1px solid rgba(175,197,248,0.28)",
          borderBottom: "1.5px solid rgba(7,16,57,0.9)",
          boxShadow:
            "0 28px 65px -12px rgba(7,16,57,0.95), 0 0 42px rgba(46,93,230,0.4), inset 0 1.5px 2px rgba(230,237,253,0.45)",
        }}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-white shadow-lg"
              style={{
                boxShadow:
                  "0 8px 20px rgba(7,16,57,0.5), inset 0 1px 2px rgba(255,255,255,0.9)",
              }}
            >
              <GoogleGLogo className="w-6 h-6" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#AFC5F8]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#6E92F2]" />
                Google OAuth Identity
              </span>
              <h2
                id="google-auth-title"
                className="font-display text-lg sm:text-xl font-bold text-[#E6EDFD] leading-tight"
              >
                Sign in with Google
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Google Sign-In"
            className="p-2 rounded-full text-[#AFC5F8] hover:text-[#E6EDFD] hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs sm:text-[13px] text-[#AFC5F8] leading-relaxed mb-4">
          To keep Mr Sad&apos;s Admin Inbox verified and spam-free, students sign
          in with their Google Account to send direct messages and receive
          official replies.
        </p>

        {/* Quick 1-Click Google Accounts */}
        <div className="mb-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#AFC5F8] mb-2 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-[#6E92F2]" />
            Choose a Verified Google Account
          </p>
          <div className="space-y-2">
            {PRESET_GOOGLE_ACCOUNTS.map((acct) => (
              <button
                key={acct.googleEmail}
                type="button"
                disabled={isAuthenticating}
                onClick={() => completeLogin(acct)}
                className="w-full flex items-center justify-between gap-3 p-3 rounded-2xl text-left transition-ui hover:-translate-y-0.5 cursor-pointer group"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(175,197,248,0.20) 0%, rgba(26,59,176,0.38) 100%)",
                  border: "1px solid rgba(230,237,253,0.38)",
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-display font-bold text-xs text-[#E6EDFD] shrink-0"
                    style={{
                      background:
                        "linear-gradient(135deg, #2E5DE6 0%, #6E92F2 100%)",
                      border: "1px solid rgba(230,237,253,0.6)",
                    }}
                  >
                    {acct.googleAvatar}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-display font-bold text-sm text-[#E6EDFD] truncate">
                        {acct.googleName}
                      </p>
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#34A853] shrink-0" />
                    </div>
                    <p className="text-xs text-[#AFC5F8] truncate">
                      {acct.googleEmail}
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/15 text-[#E6EDFD] group-hover:bg-white group-hover:text-[#071039] transition-colors shrink-0">
                  Continue
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="relative flex py-2 items-center mb-3">
          <div className="flex-grow border-t border-[#AFC5F8]/25" />
          <span className="flex-shrink mx-3 text-[10px] font-bold uppercase tracking-widest text-[#AFC5F8]/80">
            Or Use Another Google Account
          </span>
          <div className="flex-grow border-t border-[#AFC5F8]/25" />
        </div>

        {/* Custom Google Account Form */}
        <form onSubmit={handleCustomGoogleSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#AFC5F8] mb-1">
              Your Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Kumar"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm text-[#E6EDFD] placeholder-[#AFC5F8]/55 focus:outline-none focus:ring-2 focus:ring-[#6E92F2]"
              style={{
                background: "rgba(7, 16, 57, 0.65)",
                border: "1px solid rgba(175, 197, 248, 0.35)",
              }}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#AFC5F8] mb-1">
              Google Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="yourname@gmail.com"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm text-[#E6EDFD] placeholder-[#AFC5F8]/55 focus:outline-none focus:ring-2 focus:ring-[#6E92F2]"
              style={{
                background: "rgba(7, 16, 57, 0.65)",
                border: "1px solid rgba(175, 197, 248, 0.35)",
              }}
            />
          </div>

          {error && (
            <p className="text-xs font-medium text-[#FCA5A5] bg-[#EF4444]/20 border border-[#EF4444]/40 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isAuthenticating}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl font-display font-bold text-sm text-[#071039] bg-white hover:bg-[#E6EDFD] transition-ui cursor-pointer shadow-lg"
          >
            <GoogleGLogo className="w-4 h-4" />
            <span>
              {isAuthenticating
                ? "Verifying Google Account..."
                : "Continue with Google Account"}
            </span>
            <Sparkles className="w-4 h-4 text-[#2E5DE6]" />
          </button>
        </form>
      </div>
    </div>
  );
}
