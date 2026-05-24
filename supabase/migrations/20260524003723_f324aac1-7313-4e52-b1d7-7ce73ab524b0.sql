ALTER TABLE public.webchat_conversations
  ADD COLUMN IF NOT EXISTS last_message text,
  ADD COLUMN IF NOT EXISTS last_message_metadata jsonb;

CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_deleted IS NOT TRUE THEN
    UPDATE public.webchat_conversations
       SET last_message = NEW.content,
           last_message_metadata = NEW.metadata,
           last_message_at = NEW.created_at
     WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_conv_last_message ON public.webchat_messages;
CREATE TRIGGER trg_update_conv_last_message
  AFTER INSERT ON public.webchat_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();

UPDATE public.webchat_conversations c
   SET last_message = m.content,
       last_message_metadata = m.metadata
  FROM (
    SELECT DISTINCT ON (conversation_id)
           conversation_id, content, metadata
      FROM public.webchat_messages
     WHERE is_deleted = false
     ORDER BY conversation_id, created_at DESC
  ) m
 WHERE c.id = m.conversation_id;

UPDATE public.leads l
   SET product_id = (
     SELECT id FROM public.products
      WHERE organization_id = l.organization_id
      LIMIT 1
   )
 WHERE l.product_id IS NULL
   AND (
     SELECT COUNT(*) FROM public.products
      WHERE organization_id = l.organization_id
   ) = 1;