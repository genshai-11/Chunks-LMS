-- Private generated narration bucket. Uploads use the Edge service credential;
-- clients receive only authorized/signed reads, so no public storage.objects
-- policy is added here.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('narration-audio','narration-audio',false,10485760,array['audio/mpeg','audio/mp3','audio/wav','audio/ogg'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

comment on table public.narration_variants is 'Generated/uploaded narration remains private and unusable until explicitly approved with matching source hash.';
