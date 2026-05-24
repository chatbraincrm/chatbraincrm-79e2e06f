## Plano consolidado — 7 correções

### Bloco A · Inbox WhatsApp (4 problemas anteriores)

#### A1) Mensagem da IA duplicada
Confirmado no banco: cada resposta da IA gera **2 linhas** em `webchat_messages` — uma `sender_type=bot` (gravada pelo `webchat-bot` antes de enviar) e outra `sender_type=agent`/`metadata.source=external_device` (gravada pelo `evolution-webhook` quando o Evolution devolve o próprio envio como `fromMe=true`).

**Fix:** em `supabase/functions/evolution-webhook/index.ts` (bloco `external_outbound`, ~linha 1093), antes do insert:
- Buscar nos últimos 10s uma `webchat_messages` da mesma `conversation_id` com `direction=outbound` e `content` idêntico (ou `metadata.external_id = norm.messageId`).
- Se achar: apenas patch (`metadata.external_id`, `metadata.delivered_via='whatsapp'`) e retornar `{ ok:true, deduped:true }`. Não inserir.
- Senão: insert atual (cobre envio real pelo celular).

#### A2) `#fe43fd` embaixo do nome parece código de cor
É o `ticketCode = conversation.id.slice(0,6)` renderizado em `ChatArea.tsx:362`.
**Fix:** remover o `· #{ticketCode}` do header principal e manter só no menu `…` "Detalhes do ticket" se necessário.

#### A3) Foto do contato não aparece no WhatsApp
`visitor_avatar_url` é null pra conversas Evolution — o webhook nunca grava.
**Fix:** no `evolution-webhook`, quando o payload trouxer `profilePicUrl`/`pushName.profilePictureUrl`, atualizar `webchat_conversations.visitor_avatar_url` no upsert. Para conversas existentes sem foto, fazer fetch único em background via Evolution `/chat/fetchProfilePictureUrl/{instance}` na primeira mensagem nova.

#### A4) Card mostra "Nova conversa" no lugar da última mensagem
`webchat_conversations.last_message` **não existe** (erro confirmado: `column "last_message" does not exist`), então `conv.last_message` é sempre `undefined` e cai no fallback.

**Fix:** migration:
```sql
ALTER TABLE webchat_conversations
  ADD COLUMN last_message text,
  ADD COLUMN last_message_metadata jsonb;

CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS trigger AS $$
BEGIN
  UPDATE webchat_conversations
     SET last_message = NEW.content,
         last_message_metadata = NEW.metadata,
         last_message_at = NEW.created_at
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_update_conv_last_message
  AFTER INSERT ON webchat_messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();
```
Backfill único pra preencher as conversas que já existem.

---

### Bloco B · Pipeline & ferramenta da IA (3 problemas novos)

#### B1) IA enviou "Lead movido no pipeline com sucesso." ao cliente
Bug em `supabase/functions/webchat-bot/index.ts:3834`:
```ts
responseContent = choice.message?.content || 'Lead movido no pipeline com sucesso.';
```
`move_pipeline_stage` é tool **silenciosa**, mas o fallback transformou o "log interno" em mensagem pro WhatsApp.

**Fix:**
- Trocar fallback para `''` (silencioso, igual `apply_tags` / `remove_tags`).
- Validar que `stage_id` existe e pegar o `product_id` dele.
- Se o lead estiver sem `product_id`, preencher junto com `current_stage_id`.

#### B2) Lead não aparece no Pipeline
Lead Thaisa tem `product_id = NULL`. `useKanbanData` filtra com `.eq('product_id', productId)`, então o pipeline ignora.

**Fix:** na criação automática de lead (regra "Auto-Lead on Conversation"), se a org tem **exatamente 1 produto ativo**, gravar `product_id` desse produto direto. Multi-produto continua sem produto (o operador/IA decide).

#### B3) Lead aparece na Central de Leads
É o comportamento esperado (`useLeads()` sem filtro de produto lista tudo). Some quando A2 corrigir a falta de `product_id`.

**Backfill seguro** (rodar 1 vez):
```sql
UPDATE leads l
   SET product_id = (
     SELECT id FROM products
      WHERE organization_id = l.organization_id AND is_active = true
      LIMIT 1
   )
 WHERE l.product_id IS NULL
   AND (SELECT COUNT(*) FROM products
         WHERE organization_id = l.organization_id AND is_active = true) = 1;
```

---

## Arquivos afetados
- `supabase/functions/evolution-webhook/index.ts` — A1 (dedupe eco), A3 (avatar), B2 (auto-vincular produto único na criação de lead)
- `supabase/functions/webchat-bot/index.ts` — B1 (fix `move_pipeline_stage`)
- `src/components/seller/inbox/ChatArea.tsx` — A2 (remover ticketCode do header)
- Nova migration SQL — A4 (coluna `last_message` + trigger + backfill) e B3 (backfill `product_id`)

Aprova esse plano consolidado?
