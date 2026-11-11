-- WhatsApp-style chat between Google-signed-in visitors and the admin.
-- Existing student_messages rows are migrated into chat threads, and the
-- lecture-site mirror trigger is repointed at the chat tables.

-- 1) Tables -------------------------------------------------------------------
create table if not exists public.chat_conversations (
  id                   uuid primary key default gen_random_uuid(),
  google_sub           text not null unique,
  user_id              uuid references auth.users(id) on delete set null,
  google_email         text not null default '',
  google_name          text not null default '',
  google_avatar        text not null default '',
  last_message_at      timestamptz not null default now(),
  last_message_preview text not null default '',
  last_sender          text not null default 'visitor' check (last_sender in ('visitor','admin')),
  unread_by_admin      integer not null default 0,
  unread_by_visitor    integer not null default 0,
  created_at           timestamptz not null default now()
);

create index if not exists chat_conversations_last_message_at_idx
  on public.chat_conversations (last_message_at desc);
alter table public.chat_conversations enable row level security;
revoke all on public.chat_conversations from public, anon, authenticated;

create table if not exists public.chat_messages (
  id              bigint generated always as identity primary key,
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sender          text not null check (sender in ('visitor','admin')),
  body            text not null,
  created_at      timestamptz not null default now()
);

create index if not exists chat_messages_conversation_idx
  on public.chat_messages (conversation_id, id);
alter table public.chat_messages enable row level security;
revoke all on public.chat_messages from public, anon, authenticated;

-- 2) Verified Google identity, read from auth (never from the request) ---------
create or replace function public.mindspark_google_identity()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text; v_name text; v_sub text; v_avatar text;
begin
  if v_uid is null then
    raise exception 'Sign in with Google first' using errcode = '42501';
  end if;

  select lower(u.email),
         coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
                  nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), split_part(u.email, '@', 1))
    into v_email, v_name
  from auth.users u
  where u.id = v_uid and u.email_confirmed_at is not null;

  if v_email is null then
    raise exception 'A confirmed Google account is required' using errcode = '42501';
  end if;

  select i.provider || '|' || coalesce(i.identity_data ->> 'provider_id', i.identity_id::text)
    into v_sub
  from auth.identities i
  where i.user_id = v_uid and i.provider = 'google'
    and lower(i.identity_data ->> 'email') = v_email
    and i.identity_data ->> 'email_verified' = 'true'
  limit 1;

  if v_sub is null then
    raise exception 'A verified Google sign-in is required' using errcode = '42501';
  end if;

  select upper(left(coalesce(string_agg(left(w, 1), ''), ''), 2))
    into v_avatar
  from unnest(regexp_split_to_array(v_name, '\s+')) as w
  where w <> '';

  return jsonb_build_object(
    'user_id', v_uid, 'email', v_email, 'name', v_name, 'sub', v_sub,
    'avatar', coalesce(nullif(btrim(coalesce(v_avatar, '')), ''), 'ST')
  );
end; $$;
revoke all on function public.mindspark_google_identity() from public, anon, authenticated;

-- 3) JSON shapers -------------------------------------------------------------
create or replace function public.chat_conversation_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'googleEmail', c.google_email, 'googleName', c.google_name,
    'googleAvatar', c.google_avatar, 'lastMessagePreview', c.last_message_preview,
    'lastSender', c.last_sender, 'unreadByAdmin', c.unread_by_admin,
    'unreadByVisitor', c.unread_by_visitor,
    'lastMessageAt', floor(extract(epoch from c.last_message_at) * 1000)::bigint,
    'createdAt', floor(extract(epoch from c.created_at) * 1000)::bigint
  ) from public.chat_conversations c where c.id = p_id;
$$;
revoke all on function public.chat_conversation_json(uuid) from public, anon, authenticated;

create or replace function public.chat_message_json(p_id bigint)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', m.id, 'conversationId', m.conversation_id, 'sender', m.sender, 'body', m.body,
    'createdAt', floor(extract(epoch from m.created_at) * 1000)::bigint
  ) from public.chat_messages m where m.id = p_id;
$$;
revoke all on function public.chat_message_json(bigint) from public, anon, authenticated;

-- 4) Visitor RPCs -------------------------------------------------------------
create or replace function public.chat_my_conversation()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ident jsonb := public.mindspark_google_identity();
  v_conv uuid;
begin
  select id into v_conv from public.chat_conversations where google_sub = v_ident ->> 'sub';

  if v_conv is null then
    insert into public.chat_conversations (google_sub, user_id, google_email, google_name, google_avatar)
    values (v_ident ->> 'sub', (v_ident ->> 'user_id')::uuid, v_ident ->> 'email',
            v_ident ->> 'name', v_ident ->> 'avatar')
    returning id into v_conv;
  else
    update public.chat_conversations set
      user_id = coalesce(user_id, (v_ident ->> 'user_id')::uuid),
      google_email = v_ident ->> 'email',
      google_name = v_ident ->> 'name',
      google_avatar = v_ident ->> 'avatar',
      unread_by_visitor = 0
    where id = v_conv;
  end if;

  return jsonb_build_object(
    'conversation', public.chat_conversation_json(v_conv),
    'messages', coalesce((
      select jsonb_agg(public.chat_message_json(m.id) order by m.id)
      from public.chat_messages m where m.conversation_id = v_conv), '[]'::jsonb)
  );
end; $$;

create or replace function public.chat_send(p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ident jsonb := public.mindspark_google_identity();
  v_body text := btrim(coalesce(p_body, ''));
  v_conv uuid; v_id bigint;
begin
  if length(v_body) not between 1 and 2000 then
    raise exception 'Message must be 1-2000 characters' using errcode = '22023';
  end if;

  select id into v_conv from public.chat_conversations where google_sub = v_ident ->> 'sub';
  if v_conv is null then
    insert into public.chat_conversations (google_sub, user_id, google_email, google_name, google_avatar)
    values (v_ident ->> 'sub', (v_ident ->> 'user_id')::uuid, v_ident ->> 'email',
            v_ident ->> 'name', v_ident ->> 'avatar')
    returning id into v_conv;
  else
    update public.chat_conversations set
      google_email = v_ident ->> 'email', google_name = v_ident ->> 'name',
      google_avatar = v_ident ->> 'avatar'
    where id = v_conv;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_ident ->> 'sub', 2));
  if exists (select 1 from public.chat_messages
             where conversation_id = v_conv and sender = 'visitor'
               and created_at > now() - interval '3 seconds') then
    raise exception 'Please wait a few seconds before sending another message' using errcode = '42929';
  end if;

  insert into public.chat_messages (conversation_id, sender, body)
  values (v_conv, 'visitor', v_body) returning id into v_id;

  update public.chat_conversations set
    last_message_at = now(), last_message_preview = left(v_body, 140),
    last_sender = 'visitor', unread_by_admin = unread_by_admin + 1
  where id = v_conv;

  return jsonb_build_object('message', public.chat_message_json(v_id),
                            'conversation', public.chat_conversation_json(v_conv));
end; $$;

-- 5) Admin RPCs ---------------------------------------------------------------
create or replace function public.admin_list_conversations()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_assert();
  return coalesce((
    select jsonb_agg(public.chat_conversation_json(c.id) order by c.last_message_at desc, c.id desc)
    from public.chat_conversations c), '[]'::jsonb);
end; $$;

create or replace function public.admin_get_conversation(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_assert();
  if not exists (select 1 from public.chat_conversations where id = p_id) then
    raise exception 'Conversation not found' using errcode = '22023';
  end if;
  update public.chat_conversations set unread_by_admin = 0 where id = p_id;
  return jsonb_build_object(
    'conversation', public.chat_conversation_json(p_id),
    'messages', coalesce((
      select jsonb_agg(public.chat_message_json(m.id) order by m.id)
      from public.chat_messages m where m.conversation_id = p_id), '[]'::jsonb)
  );
end; $$;

create or replace function public.admin_send_chat(p_id uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_body text := btrim(coalesce(p_body, '')); v_msg bigint;
begin
  perform public.admin_assert();
  if length(v_body) not between 1 and 2000 then
    raise exception 'Message must be 1-2000 characters' using errcode = '22023';
  end if;
  if not exists (select 1 from public.chat_conversations where id = p_id) then
    raise exception 'Conversation not found' using errcode = '22023';
  end if;

  insert into public.chat_messages (conversation_id, sender, body)
  values (p_id, 'admin', v_body) returning id into v_msg;

  update public.chat_conversations set
    last_message_at = now(), last_message_preview = left(v_body, 140),
    last_sender = 'admin', unread_by_visitor = unread_by_visitor + 1
  where id = p_id;

  return jsonb_build_object('message', public.chat_message_json(v_msg),
                            'conversation', public.chat_conversation_json(p_id));
end; $$;

create or replace function public.admin_delete_conversation(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_assert();
  delete from public.chat_conversations where id = p_id;
  return jsonb_build_object('deletedId', p_id);
end; $$;

-- 6) Migrate existing inbox rows into chat threads ----------------------------
insert into public.chat_conversations
  (google_sub, user_id, google_email, google_name, google_avatar,
   last_message_at, last_message_preview, last_sender, unread_by_admin, created_at)
select case when m.google_sub <> '' then m.google_sub
            else 'legacy:' || coalesce(m.visitor_id::text, m.id::text) end,
       null, m.google_email, m.google_name, m.google_avatar,
       m.created_at, left(m.message, 140), 'visitor',
       case when m.status = 'unread' then 1 else 0 end, m.created_at
from public.student_messages m
on conflict (google_sub) do nothing;

insert into public.chat_messages (conversation_id, sender, body, created_at)
select c.id, 'visitor', m.message, m.created_at
from public.student_messages m
join public.chat_conversations c
  on c.google_sub = case when m.google_sub <> '' then m.google_sub
                         else 'legacy:' || coalesce(m.visitor_id::text, m.id::text) end;

insert into public.chat_messages (conversation_id, sender, body, created_at)
select c.id, 'admin', m.admin_reply, coalesce(m.replied_at, m.created_at + interval '1 minute')
from public.student_messages m
join public.chat_conversations c
  on c.google_sub = case when m.google_sub <> '' then m.google_sub
                         else 'legacy:' || coalesce(m.visitor_id::text, m.id::text) end
where coalesce(btrim(m.admin_reply), '') <> '';

-- 7) Lecture-site messages now land in the chat -------------------------------
create or replace function public.mindspark_mirror_visitor_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_sub text := 'visitor:' || new.visitor_id::text;
  v_name text := coalesce(new.sender_name, 'Anonymous visitor');
  v_conv uuid;
begin
  select id into v_conv from public.chat_conversations where google_sub = v_sub;

  if v_conv is null then
    insert into public.chat_conversations
      (google_sub, google_email, google_name, google_avatar,
       last_message_at, last_message_preview, last_sender, unread_by_admin, created_at)
    values (v_sub, '', v_name, upper(left(coalesce(nullif(btrim(v_name), ''), 'V'), 2)),
            new.created_at, left(new.message, 140), 'visitor', 1, new.created_at)
    returning id into v_conv;
  else
    update public.chat_conversations set
      last_message_at = new.created_at, last_message_preview = left(new.message, 140),
      last_sender = 'visitor', unread_by_admin = unread_by_admin + 1
    where id = v_conv;
  end if;

  insert into public.chat_messages (conversation_id, sender, body, created_at)
  values (v_conv, 'visitor', new.message, new.created_at);

  return new;
end; $$;

-- 8) Grants -------------------------------------------------------------------
revoke all on function public.chat_my_conversation() from public, anon;
grant execute on function public.chat_my_conversation() to authenticated;
revoke all on function public.chat_send(text) from public, anon;
grant execute on function public.chat_send(text) to authenticated;

do $grant$
declare f text;
begin
  foreach f in array array[
    'admin_list_conversations()',
    'admin_get_conversation(uuid)',
    'admin_send_chat(uuid,text)',
    'admin_delete_conversation(uuid)'
  ]
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $grant$;

-- ---------------------------------------------------------------------------
-- One-off data backfill, applied directly to production alongside this
-- migration and recorded here so a fresh database reproduces the same state.
-- The legacy mirror table public.student_messages was already empty, so the
-- surviving visitor message is re-imported from its source of truth,
-- public.lecture_visitor_messages.
-- ---------------------------------------------------------------------------
-- insert into public.chat_conversations
--   (google_sub, google_email, google_name, google_avatar_initials, last_message_at,
--    last_message_preview, last_sender, unread_by_admin, created_at)
-- select 'visitor:' || m.visitor_id::text, '',
--        coalesce(nullif(btrim(m.sender_name), ''), 'Anonymous visitor'),
--        upper(left(coalesce(nullif(btrim(m.sender_name), ''), 'V'), 2)),
--        m.created_at, left(m.message, 140), 'visitor', 1, m.created_at
-- from public.lecture_visitor_messages m
-- on conflict (google_sub) do nothing;
--
-- insert into public.chat_messages (conversation_id, sender, body, created_at)
-- select c.id, 'visitor', m.message, m.created_at
-- from public.lecture_visitor_messages m
-- join public.chat_conversations c
--   on c.google_sub = 'visitor:' || m.visitor_id::text;
