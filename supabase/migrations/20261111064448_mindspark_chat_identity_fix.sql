-- auth.identities has no identity_id column (it is id), and it carries the
-- Google profile picture, so use that as the chat avatar instead of derived
-- initials. Also factors the thread upsert into one helper shared by
-- chat_my_conversation() and chat_send().

create or replace function public.mindspark_google_identity()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_name text;
  v_sub text;
  v_picture text;
  v_initials text;
begin
  if v_uid is null then
    raise exception 'Sign in with Google first' using errcode = '42501';
  end if;

  select lower(btrim(u.email)),
         coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
                  nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
                  split_part(u.email, '@', 1))
    into v_email, v_name
  from auth.users u
  where u.id = v_uid;

  if v_email is null then
    raise exception 'A confirmed Google account is required' using errcode = '42501';
  end if;

  select 'google|' || coalesce(nullif(btrim(i.provider_id), ''), i.id::text),
         nullif(btrim(i.identity_data ->> 'picture'), ''),
         coalesce(nullif(btrim(i.identity_data ->> 'name'), ''), v_name)
    into v_sub, v_picture, v_name
  from auth.identities i
  where i.user_id = v_uid
    and i.provider = 'google'
    and lower(btrim(coalesce(nullif(btrim(i.email), ''), i.identity_data ->> 'email', ''))) = v_email
    and coalesce(i.identity_data ->> 'email_verified', 'true') = 'true'
  order by i.last_sign_in_at desc nulls last, i.created_at desc
  limit 1;

  if v_sub is null then
    raise exception 'A verified Google sign-in is required' using errcode = '42501';
  end if;

  select upper(left(coalesce(string_agg(left(w, 1), ''), ''), 2))
    into v_initials
  from unnest(regexp_split_to_array(btrim(v_name), '\s+')) as w
  where btrim(w) <> '';

  return jsonb_build_object(
    'user_id', v_uid,
    'email', v_email,
    'name', v_name,
    'sub', v_sub,
    'avatar', coalesce(v_picture, ''),
    'avatarInitials', coalesce(nullif(btrim(v_initials), ''), 'ST')
  );
end; $$;
revoke all on function public.mindspark_google_identity() from public, anon, authenticated;

-- Store the Google picture URL and the initials fallback separately.
alter table public.chat_conversations
  add column if not exists google_avatar_initials text not null default '';

create or replace function public.chat_conversation_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id,
    'googleEmail', c.google_email,
    'googleName', c.google_name,
    'googleAvatar', c.google_avatar,
    'googleAvatarInitials', c.google_avatar_initials,
    'lastMessagePreview', c.last_message_preview,
    'lastSender', c.last_sender,
    'unreadByAdmin', c.unread_by_admin,
    'unreadByVisitor', c.unread_by_visitor,
    'lastMessageAt', floor(extract(epoch from c.last_message_at) * 1000)::bigint,
    'createdAt', floor(extract(epoch from c.created_at) * 1000)::bigint
  ) from public.chat_conversations c where c.id = p_id;
$$;
revoke all on function public.chat_conversation_json(uuid) from public, anon, authenticated;

create or replace function public.chat_upsert_thread(p_ident jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select id into v_id from public.chat_conversations where google_sub = p_ident ->> 'sub';
  if v_id is null then
    insert into public.chat_conversations
      (google_sub, user_id, google_email, google_name, google_avatar, google_avatar_initials)
    values (p_ident ->> 'sub', (p_ident ->> 'user_id')::uuid, p_ident ->> 'email',
            p_ident ->> 'name', coalesce(p_ident ->> 'avatar', ''),
            coalesce(p_ident ->> 'avatarInitials', 'ST'))
    returning id into v_id;
  else
    update public.chat_conversations set
      user_id = coalesce(user_id, (p_ident ->> 'user_id')::uuid),
      google_email = p_ident ->> 'email',
      google_name = p_ident ->> 'name',
      google_avatar = coalesce(p_ident ->> 'avatar', ''),
      google_avatar_initials = coalesce(p_ident ->> 'avatarInitials', 'ST')
    where id = v_id;
  end if;
  return v_id;
end; $$;
revoke all on function public.chat_upsert_thread(jsonb) from public, anon, authenticated;
grant execute on function public.chat_upsert_thread(jsonb) to authenticated;

create or replace function public.chat_my_conversation()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ident jsonb := public.mindspark_google_identity();
  v_conv uuid;
begin
  v_conv := public.chat_upsert_thread(v_ident);
  update public.chat_conversations set unread_by_visitor = 0 where id = v_conv;

  return jsonb_build_object(
    'identity', v_ident,
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
  v_conv uuid;
  v_id bigint;
begin
  if length(v_body) not between 1 and 2000 then
    raise exception 'Message must be 1-2000 characters' using errcode = '22023';
  end if;

  v_conv := public.chat_upsert_thread(v_ident);

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
    last_sender = 'visitor', unread_by_admin = unread_by_admin + 1,
    unread_by_visitor = 0
  where id = v_conv;

  return jsonb_build_object('message', public.chat_message_json(v_id),
                            'conversation', public.chat_conversation_json(v_conv));
end; $$;

revoke all on function public.chat_my_conversation() from public, anon;
grant execute on function public.chat_my_conversation() to authenticated;
revoke all on function public.chat_send(text) from public, anon;
grant execute on function public.chat_send(text) to authenticated;

-- Backfill initials for threads created before the picture column existed.
update public.chat_conversations
set google_avatar_initials = upper(left(coalesce(google_name, 'ST'), 2))
where btrim(google_avatar_initials) = '';
