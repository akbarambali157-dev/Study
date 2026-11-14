-- Private PDF storage and searchable page-text index.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('study-documents','study-documents',false,31457280,array['application/pdf']::text[])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create table if not exists public.study_documents(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,storage_path text not null,file_name text not null check(char_length(btrim(file_name)) between 1 and 255),title text not null check(char_length(btrim(title)) between 1 and 200),mime_type text not null default 'application/pdf' check(mime_type='application/pdf'),size_bytes bigint not null check(size_bytes>0 and size_bytes<=31457280),page_count integer not null check(page_count between 1 and 120),status text not null default 'uploaded' check(status in('uploaded','indexed','ready','failed')),error_message text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(owner_id,storage_path),check(split_part(storage_path,'/',1)=owner_id::text));
create index if not exists study_documents_owner_created_idx on public.study_documents(owner_id,created_at desc);
create table if not exists public.study_document_pages(id bigint generated always as identity primary key,document_id uuid not null references public.study_documents(id) on delete cascade,owner_id uuid not null references auth.users(id) on delete cascade,page_number integer not null check(page_number between 1 and 120),page_text text not null,search_vector tsvector generated always as(to_tsvector('simple'::regconfig,coalesce(page_text,''))) stored,created_at timestamptz not null default now(),unique(document_id,page_number));
create index if not exists study_document_pages_owner_document_idx on public.study_document_pages(owner_id,document_id,page_number);
create index if not exists study_document_pages_search_idx on public.study_document_pages using gin(search_vector);
alter table public.study_documents enable row level security; alter table public.study_document_pages enable row level security;
revoke all on public.study_documents,public.study_document_pages from anon;
grant select,insert,update,delete on public.study_documents to authenticated; grant select,insert,delete on public.study_document_pages to authenticated; grant usage,select on sequence public.study_document_pages_id_seq to authenticated;
drop policy if exists "Students manage their own study documents" on public.study_documents;
create policy "Students manage their own study documents" on public.study_documents for all to authenticated using((select auth.uid())=owner_id) with check((select auth.uid())=owner_id and split_part(storage_path,'/',1)=(select auth.uid())::text);
drop policy if exists "Students read their own document pages" on public.study_document_pages;
create policy "Students read their own document pages" on public.study_document_pages for select to authenticated using((select auth.uid())=owner_id);
drop policy if exists "Students index pages for their own documents" on public.study_document_pages;
create policy "Students index pages for their own documents" on public.study_document_pages for insert to authenticated with check((select auth.uid())=owner_id and exists(select 1 from public.study_documents d where d.id=document_id and d.owner_id=(select auth.uid())));
drop policy if exists "Students delete their own document pages" on public.study_document_pages;
create policy "Students delete their own document pages" on public.study_document_pages for delete to authenticated using((select auth.uid())=owner_id);
drop policy if exists "Students upload their own private PDFs" on storage.objects;
create policy "Students upload their own private PDFs" on storage.objects for insert to authenticated with check(bucket_id='study-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Students read their own private PDFs" on storage.objects;
create policy "Students read their own private PDFs" on storage.objects for select to authenticated using(bucket_id='study-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Students replace their own private PDFs" on storage.objects;
create policy "Students replace their own private PDFs" on storage.objects for update to authenticated using(bucket_id='study-documents' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='study-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Students delete their own private PDFs" on storage.objects;
create policy "Students delete their own private PDFs" on storage.objects for delete to authenticated using(bucket_id='study-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
