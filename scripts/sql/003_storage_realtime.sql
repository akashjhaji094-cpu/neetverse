-- Storage bucket for question images, PYQ PDFs, notes and OMR uploads
insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true)
on conflict (id) do update set public = true;

drop policy if exists "question_images_public_read" on storage.objects;
create policy "question_images_public_read" on storage.objects
  for select using (bucket_id = 'question-images');

drop policy if exists "question_images_auth_insert" on storage.objects;
create policy "question_images_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'question-images');

drop policy if exists "question_images_admin_update" on storage.objects;
create policy "question_images_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'question-images' and public.is_admin(auth.uid()));

drop policy if exists "question_images_admin_delete" on storage.objects;
create policy "question_images_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'question-images' and public.is_admin(auth.uid()));

-- Realtime for battle arena
do $$
begin
  begin
    alter publication supabase_realtime add table public.battle_rooms;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.battle_players;
  exception when duplicate_object then null;
  end;
end $$;

alter table public.battle_rooms replica identity full;
alter table public.battle_players replica identity full;
