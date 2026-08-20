create policy "temp_allow_red_test_audio_upload_insert"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'narration-audio'
  and name like 'narrations/616288f1-62d1-412c-9356-f8fc92057b01/red-test/%'
);

create policy "temp_allow_red_test_audio_upload_select"
on storage.objects
for select
to anon
using (
  bucket_id = 'narration-audio'
  and name like 'narrations/616288f1-62d1-412c-9356-f8fc92057b01/red-test/%'
);

create policy "temp_allow_red_test_audio_upload_update"
on storage.objects
for update
to anon
using (
  bucket_id = 'narration-audio'
  and name like 'narrations/616288f1-62d1-412c-9356-f8fc92057b01/red-test/%'
)
with check (
  bucket_id = 'narration-audio'
  and name like 'narrations/616288f1-62d1-412c-9356-f8fc92057b01/red-test/%'
);;
