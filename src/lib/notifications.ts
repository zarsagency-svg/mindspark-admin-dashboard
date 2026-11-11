"use client";

let sharedAudioCtx: AudioContext | null = null;
let audioUnlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudioCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
  }
  return sharedAudioCtx;
}

/**
 * Unlocks Web Audio on the first user gesture so background message polls
 * can always play the notification sound without browser autoplay blocking.
 */
export function unlockNotificationAudio(): boolean {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    audioUnlocked = true;
    return true;
  } catch {
    return false;
  }
}

export function isAudioUnlocked(): boolean {
  return audioUnlocked;
}

/**
 * Plays a crisp, pleasant Instagram/iMessage-inspired 3-note chime.
 */
export function playMessageNotificationSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const now = ctx.currentTime;
    const notes = [
      { freq: 587.33, start: 0, duration: 0.14, gain: 0.22 }, // D5
      { freq: 880.0, start: 0.09, duration: 0.18, gain: 0.26 }, // A5
      { freq: 1174.66, start: 0.19, duration: 0.34, gain: 0.24 }, // D6
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const subOsc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, now + note.start);

      subOsc.type = "triangle";
      subOsc.frequency.setValueAtTime(note.freq * 1.5, now + note.start);

      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.05, now + note.start);

      gainNode.gain.setValueAtTime(0.0001, now + note.start);
      gainNode.gain.exponentialRampToValueAtTime(
        note.gain,
        now + note.start + 0.02
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        now + note.start + note.duration
      );

      osc.connect(gainNode);
      subOsc.connect(subGain);
      subGain.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now + note.start);
      subOsc.start(now + note.start);
      osc.stop(now + note.start + note.duration + 0.02);
      subOsc.stop(now + note.start + note.duration + 0.02);
    }
    audioUnlocked = true;
  } catch {
    // Ignore audio errors if blocked before gesture
  }
}

export function getNotificationPermissionState():
  | NotificationPermission
  | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  unlockNotificationAudio();
  playMessageNotificationSound();
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "granted") {
    return "granted";
  }
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}

export function showBrowserMessageNotification(opts: {
  senderName: string;
  body: string;
  avatar?: string;
  conversationId?: string;
  onClick?: () => void;
}): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    const notif = new Notification(opts.senderName || "New Message", {
      body: opts.body,
      icon: opts.avatar || "/platforms/noxglass.svg",
      tag: opts.conversationId || "mindspark-chat",
    });
    notif.onclick = () => {
      window.focus();
      opts.onClick?.();
      notif.close();
    };
  } catch {
    // Some mobile browsers only support SW notifications; sound + in-app banner still fire
  }
}
