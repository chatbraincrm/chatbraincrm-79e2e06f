-- ============================================================
-- Fix: support_tickets e support_messages usam FK para auth.users,
-- mas a query do PostgREST tenta fazer join com public.profiles.
-- PostgREST só navega FKs dentro do schema public, portanto o join
-- creator:profiles!support_tickets_created_by_fkey e
-- author:profiles!support_messages_author_id_fkey falhavam silenciosamente,
-- retornando array vazio mesmo após inserção bem-sucedida.
--
-- Fix: redirecionar as FKs para public.profiles(id), que espelha
-- auth.users(id) 1:1, garantindo integridade e habilitando o join no PostgREST.
-- ============================================================

-- support_tickets.created_by → profiles.id
ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_created_by_fkey;

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE;

-- support_messages.author_id → profiles.id
ALTER TABLE public.support_messages
  DROP CONSTRAINT IF EXISTS support_messages_author_id_fkey;

ALTER TABLE public.support_messages
  ADD CONSTRAINT support_messages_author_id_fkey
    FOREIGN KEY (author_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE;
