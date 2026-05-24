
# Checkup Completo do Sistema

Vou conduzir em **3 fases** para você aprovar uma vez só e eu executar até o fim, reportando os achados ao final de cada fase.

## Fase 1 — Varredura técnica automatizada (sem mudança de código)

Rodo em paralelo e te entrego um **relatório priorizado** (P0/P1/P2):

1. **Linter do banco** (`supabase--linter`) — RLS faltando, funções inseguras, índices ausentes.
2. **Security scan** (`security--run_security_scan`) — vazamento de dados, policies frouxas.
3. **Saúde do banco** (`db_health`) — saturação de conexão, deadlocks, OOM, WAL.
4. **Logs recentes de Edge Functions críticas** — `evolution-webhook`, `webchat-bot`, `webchat-inbox`, `ai-followup-cron`, `start-whatsapp-conversation` (últimas 24 h, filtrando erros).
5. **Queries de integridade de dados**:
   - Leads órfãos (sem `product_id`, sem `current_stage_id`, sem `temperature`).
   - Conversas sem `last_message`, sem `visitor_avatar_url`, em `waiting_human` há > 1 h.
   - Conversas duplicadas por `phone + organization_id`.
   - Mensagens duplicadas (`external_id` repetido em < 30 s).
   - `pipeline_stages` sem cor / sem ordem.
   - Triggers e RLS de `enforce_single_attendant` aplicados.

Já detectei na pré-varredura: **2 leads sem produto** e **3 conversas WhatsApp sem avatar**.

## Fase 2 — Auditoria guiada dos bugs que você já apontou

Investigo cada um, identifico causa-raiz e listo o fix proposto **antes** de aplicar:

| # | Bug relatado | Onde vou investigar |
|---|---|---|
| 1 | Bugs no Inbox (atendimento) | `SellerInbox.tsx`, `ConversationList.tsx`, `ChatArea.tsx`, realtime subscriptions |
| 2 | Bug na IA (resposta/comportamento) | `webchat-bot/index.ts`, `agent_action_logs`, prompt e roteamento |
| 3 | Bug para passar atendimento IA → humano | `TransferConversationModal.tsx`, trigger `enforce_single_attendant`, `useAcceptConversation` |
| 4 | Temperatura do lead não aparece na Central de Leads | `LeadsManager`, `LeadHeader`, render do badge (Flame/Snowflake/ThermometerSun) |
| 5 | Lentidão no envio/recebimento WhatsApp | Timing de `evolution-webhook` (debounce 4 s + chunking 800 ms), `EdgeRuntime.waitUntil`, fila de chunks, latência Evolution |
| 6 | Card do Pipeline com pouca info | `LeadsKanban.tsx` — adicionar: temperatura, último contato, canal de origem, tags principais, valor, dono |
| 7 | Dashboard de atendimento com "em breve" | `WebChatReportsTab.tsx` + itens marcados `comingSoon` no `adminMenu.ts` — listar e implementar relatórios faltantes (taxa resolução IA, SLA por setor, ranking de atendentes, distribuição por canal, heatmap de horário) |

## Fase 3 — Aplicar correções (com sua confirmação por bloco)

Agrupo os fixes em blocos pequenos e seguros:

- **Bloco A — Dados** (backfill de leads órfãos, temperaturas, avatars).
- **Bloco B — Inbox/IA/Handoff** (bugs 1, 2, 3).
- **Bloco C — Pipeline card enriquecido** (bug 6).
- **Bloco D — Performance WhatsApp** (bug 5 — provavelmente `waitUntil` no webhook + revisão do debounce).
- **Bloco E — Dashboard de atendimento completo** (bug 7).
- **Bloco F — Achados da varredura técnica** (P0/P1 primeiro).

Cada bloco vira um commit isolado, fácil de reverter se algo regredir.

## Detalhes técnicos

- Nada será alterado na Fase 1 (somente leitura).
- Fase 2 só roda queries e leitura de código/logs.
- Fase 3 respeita as regras já memorizadas: `enforce_single_attendant`, debounce/chunking do WhatsApp, multi-tenant scoping, RLS, normalização DDI 55, `delete_team_member` RPC.
- Bugs que dependerem de reprodução manual no preview (ex: "ao clicar em X acontece Y"), vou te pedir um print ou os passos exatos antes de fechar.

## O que eu preciso de você

Nada agora — só aprovar o plano. Conforme eu for executando, posso te pedir detalhe de algum sintoma específico (ex: "o bug da IA é resposta errada, duplicada, ou ela trava?").

Posso começar?
