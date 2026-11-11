"use client";
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admins';
type Message = { id: string; sender_name: string | null; message: string; created_at: string; source: string };
type Notice = { id: string; title: string; body: string; created_at: string; image_url: string | null };
const prettyDate = (value: string) => new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
export default function Dashboard() {
  const [signedIn, setSignedIn] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [section, setSection] = useState<'inbox' | 'broadcast'>('inbox');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    const { data, error: e } = await supabase.rpc('mindspark_dashboard_data');
    if (e) { setMessages([]); setNotices([]); setError('Could not load dashboard data. Check that you signed in with an approved Google account.'); }
    else { setMessages(data?.messages ?? []); setNotices(data?.notifications ?? []); }
    setLoading(false);
  }, []);
  useEffect(() => {
    let live = true;
    const sync = async () => {
      const { data, error: e } = await supabase.auth.getUser();
      if (!live) return;
      const email = data.user?.email?.toLowerCase() ?? '';
      const ok = !e && isAdminEmail(email) && Boolean(data.user?.identities?.some(i => i.provider === 'google'));
      setSignedIn(Boolean(ok)); setAdminEmail(ok ? email : ''); setChecking(false);
      if (ok) await load(); else { setMessages([]); setNotices([]); }
    };
    void sync();
    const { data } = supabase.auth.onAuthStateChange(() => { window.setTimeout(() => { void sync(); }, 0); });
    return () => { live = false; data.subscription.unsubscribe(); };
  }, [load]);
  const signIn = async () => {
    setError('');
    const { error: e } = await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo: `${window.location.origin}/`}});
    if (e) setError('Google sign-in could not start. Please try again.');
  };
  const signOut = async () => { await supabase.auth.signOut(); setSignedIn(false); setAdminEmail(''); setMessages([]); setNotices([]); };
  const publish = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim() || !window.confirm('Publish this announcement to visitors of both connected sites?')) return;
    setSending(true); setError(''); setStatus('');
    const { error: err } = await supabase.rpc('mindspark_dashboard_publish', {p_title: title.trim(), p_body: body.trim()});
    if (err) setError('Announcement was not published. Please check your connection and try again.');
    else { setTitle(''); setBody(''); setStatus('Announcement published.'); await load(); }
    setSending(false);
  };
  if (checking) return <main className="login"><div className="panel">Checking your session…</div></main>;
  if (!signedIn) return <main className="login"><div className="panel loginbox"><span className="badge">MIND SPARK · ADMIN</span><h1>Welcome back.</h1><p>Sign in with an approved Google account to open your dashboard.</p><button className="primary" onClick={signIn}>Continue with Google ↗</button>{error && <p role="alert">{error}</p>}<p className="muted">Access is restricted to approved administrators.</p></div></main>;
  return <div className="shell"><aside><div className="brand"><span className="logo">✦</span><div><b>MIND SPARK</b><small>ADMIN CONSOLE</small></div></div><p className="navlabel">WORKSPACE</p><button className={section === 'inbox' ? 'nav active' : 'nav'} onClick={() => setSection('inbox')}>✉ &nbsp; Inbox <span>{messages.length}</span></button><button className={section === 'broadcast' ? 'nav active' : 'nav'} onClick={() => setSection('broadcast')}>◉ &nbsp; Announcements</button><div className="sidebottom"><p>Signed in as<br/><b>{adminEmail}</b></p><button className="outline" onClick={signOut}>Sign out</button></div></aside>
  <main className="content"><header><div><span className="eyebrow">MIND SPARK / ADMIN</span><h1>{section === 'inbox' ? 'Your inbox' : 'Announcements'}</h1><p>{section === 'inbox' ? 'Messages sent by your visitors, all in one place.' : 'Share an update with your connected websites.'}</p></div><button className="outline" onClick={() => void load()} disabled={loading}>↻ {loading ? 'Loading…' : 'Refresh'}</button></header>
  {error && <div className="alert" role="alert">{error}</div>}{status && <div className="success" role="status">{status}</div>}
  <div className="stats"><div className="stat"><small>VISITOR MESSAGES</small><strong>{messages.length}</strong><span>Most recent 200</span></div><div className="stat"><small>ANNOUNCEMENTS</small><strong>{notices.length}</strong><span>Most recent 100</span></div><div className="stat"><small>ANALYTICS</small><strong>—</strong><span>Not connected yet</span></div></div>
  {section === 'inbox' ? <section className="panel"><div className="panelhead"><div><span className="eyebrow">MESSAGES</span><h2>Visitor inbox</h2></div><span className="badge">PRIVATE</span></div><p className="hint">Messages sent through the lecture site. Older messages may have an unverified, user-entered name.</p>{loading ? <p>Loading…</p> : messages.length === 0 ? <p className="empty">No messages yet.</p> : messages.map(m => <article key={m.id} className="message"><div className="messagehead"><b>{m.sender_name || 'Anonymous visitor'}</b><time>{prettyDate(m.created_at)}</time></div><p>{m.message}</p><small>{m.source}</small></article>)}</section> : <><section className="panel"><div className="panelhead"><div><span className="eyebrow">BROADCAST</span><h2>Write an update</h2></div><span className="badge">BOTH SITES</span></div><p className="hint">Announcements appear in the connected websites’ notification drawers.</p><form onSubmit={publish}><label>Title<input required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="A short title" /></label><label>Message<textarea required maxLength={4000} rows={5} value={body} onChange={e => setBody(e.target.value)} placeholder="Write your announcement…" /></label><button className="primary" disabled={sending}>{sending ? 'Publishing…' : 'Publish announcement ↗'}</button></form></section><section className="panel"><div className="panelhead"><h2>Recent announcements</h2></div>{notices.length === 0 ? <p className="empty">No announcements found.</p> : notices.map(n => <article key={n.id} className="message"><div className="messagehead"><b>{n.title}</b><time>{prettyDate(n.created_at)}</time></div><p>{n.body}</p>{n.image_url && <img src={n.image_url} alt="Announcement attachment" className="attachment" />}</article>)}</section></>}
  <p className="footnote">Analytics, private replies, image uploads and visitor Google sign-in are not connected in this version.</p></main></div>;
}
