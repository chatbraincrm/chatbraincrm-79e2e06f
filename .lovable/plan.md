## Problema

Hoje a página inteira de `/admin → Atendimentos` cresce além da viewport: o título "Atendimentos" + abas (Inbox/Relatórios) somam ~120px e logo abaixo o `SellerInbox` usa altura fixa `h-[calc(100dvh-8rem)]`. Resultado: o footer com o campo "Mensagem" cai para fora da tela e o usuário precisa rolar a página inteira (header do admin some, como mostra o print).

## Objetivo

Header da seção, lista de conversas e campo de envio ficam **fixos**. Apenas a área de mensagens rola internamente.

## Mudanças (somente layout/CSS)

1. **`src/pages/Admin.tsx`** — garantir que o `<main>` seja uma coluna flex de altura controlada para que filhos com `h-full` funcionem.
   - `main` passa de `flex-1 overflow-auto` para `flex-1 overflow-hidden flex flex-col min-h-0` (mantém scroll só onde a página precisar, ex.: outras telas continuam recebendo `overflow-auto` via wrapper interno).
   - Para não quebrar as demais telas do admin, envolver o conteúdo padrão num wrapper `flex-1 overflow-auto` e deixar o `InboxManager` "furar" esse wrapper renderizando direto em altura cheia.

2. **`src/components/admin/InboxManager.tsx`**
   - Container raiz: `h-full flex flex-col min-h-0`.
   - Cabeçalho ("Atendimentos" + descrição) + `TabsList`: `flex-shrink-0`.
   - `TabsContent value="inbox"`: `flex-1 min-h-0 overflow-hidden` (em vez de `space-y-4`).

3. **`src/components/seller/SellerInbox.tsx`** (linhas 782/789)
   - Trocar `h-[calc(100dvh-8rem)]` por `h-full` nos dois lugares, mantendo `flex flex-col overflow-hidden`. A altura agora vem do pai.

Resultado: o `ScrollArea` de mensagens (já marcado `flex-1 min-h-0`) absorve o espaço restante; lista de conversas à esquerda, header do chat e `ChatInput` ficam fixos.

## Fora de escopo

- Sem mudanças em lógica de envio, websocket, mensagens ou estados.
- Sem alteração visual além do necessário para parar o scroll global.

## Validação

- Abrir `/admin → Atendimentos`: o título e o campo "Mensagem" ficam visíveis sem rolar a página; rolar dentro do chat apenas move as mensagens.
- Testar também em mobile (`useIsMobile` já é respeitado pelos componentes — só conferir que `h-full` herda do `MobileLayout`).
- Conferir que outras telas do admin (Pipeline, Leads, Agenda, etc.) continuam roláveis normalmente.