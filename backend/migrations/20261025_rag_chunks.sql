create extension if not exists vector;

do $$
begin
  if to_regclass('public.chunks_rag') is null
     and to_regclass('public.documentos_contexto') is not null then
    alter table public.documentos_contexto rename to chunks_rag;
  end if;
end $$;

do $$
begin
  if (select count(*) from public.chunks_rag) > 0 then
    raise exception 'chunks_rag no está vacía: revisar antes de recrear la columna embedding';
  end if;
end $$;

alter table public.chunks_rag drop column if exists embedding;
alter table public.chunks_rag add column embedding vector(768);

alter table public.chunks_rag alter column id_contexto set default gen_random_uuid();
alter table public.chunks_rag alter column fecha_subida set default now();

create index if not exists chunks_rag_id_docente_idx on public.chunks_rag (id_docente);
create index if not exists chunks_rag_docente_nombre_idx on public.chunks_rag (id_docente, nombre_original);
create index if not exists chunks_rag_embedding_idx on public.chunks_rag using hnsw (embedding vector_cosine_ops);

create or replace function public.match_chunks(
  query_embedding vector(768),
  p_id_docente uuid,
  match_count int default 6
)
returns table (id_contexto uuid, nombre_original text, contenido_chunk text, similarity float)
language sql stable
as $$
  select c.id_contexto, c.nombre_original, c.contenido_chunk,
         (1 - (c.embedding <=> query_embedding))::float as similarity
  from public.chunks_rag c
  where c.id_docente = p_id_docente
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

revoke all on function public.match_chunks(vector, uuid, integer) from public, anon, authenticated;
grant execute on function public.match_chunks(vector, uuid, integer) to service_role;

notify pgrst, 'reload schema';