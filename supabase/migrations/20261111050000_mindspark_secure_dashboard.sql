create function public.mindspark_dashboard_data() returns jsonb language plpgsql security definer set search_path = '' as $$
begin
 if not exists (select 1 from auth.users u join auth.identities i on i.user_id=u.id where u.id=auth.uid() and lower(u.email)='zarsagency@gmail.com' and u.email_confirmed_at is not null and i.provider='google' and lower(i.identity_data->>'email')='zarsagency@gmail.com' and i.identity_data->>'email_verified'='true') then raise exception 'Admin access required' using errcode='42501'; end if;
 return jsonb_build_object('messages',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at desc) from (select id, sender_name, message, created_at, read_at, source from public.lecture_visitor_messages order by created_at desc limit 200) m),'[]'::jsonb),'notifications',coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from (select id,title,body,created_at,image_url from public.mindspark_notifications order by created_at desc limit 100) n),'[]'::jsonb));
end; $$;
revoke all on function public.mindspark_dashboard_data() from public, anon;
grant execute on function public.mindspark_dashboard_data() to authenticated;
create function public.mindspark_dashboard_publish(p_title text,p_body text) returns text language plpgsql security definer set search_path='' as $$
declare v_id text;
begin
 if not exists (select 1 from auth.users u join auth.identities i on i.user_id=u.id where u.id=auth.uid() and lower(u.email)='zarsagency@gmail.com' and u.email_confirmed_at is not null and i.provider='google' and lower(i.identity_data->>'email')='zarsagency@gmail.com' and i.identity_data->>'email_verified'='true') then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_title is null or length(trim(p_title)) not between 1 and 120 or p_body is null or length(trim(p_body)) not between 1 and 4000 then raise exception 'Invalid announcement'; end if;
 insert into public.mindspark_notifications(title,body) values(trim(p_title),trim(p_body)) returning id into v_id;
 return v_id;
end; $$;
revoke all on function public.mindspark_dashboard_publish(text,text) from public, anon;
grant execute on function public.mindspark_dashboard_publish(text,text) to authenticated;
