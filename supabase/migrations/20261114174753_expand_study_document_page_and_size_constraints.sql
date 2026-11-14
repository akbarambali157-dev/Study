alter table public.study_documents
  drop constraint if exists study_documents_page_count_check,
  drop constraint if exists study_documents_size_bytes_check;
alter table public.study_documents
  add constraint study_documents_page_count_check check (page_count between 1 and 400),
  add constraint study_documents_size_bytes_check check (size_bytes > 0 and size_bytes <= 52428800);

alter table public.study_document_pages
  drop constraint if exists study_document_pages_page_number_check;
alter table public.study_document_pages
  add constraint study_document_pages_page_number_check check (page_number between 1 and 400);

alter table public.public_materials
  drop constraint if exists public_materials_page_count_check;
alter table public.public_materials
  add constraint public_materials_page_count_check check (page_count between 1 and 400);
