## Configurar Firecrawl para o botão "Analisar"

Você compartilhou a chave da API do Firecrawl. Vou configurá-la como segredo do backend (`FIRECRAWL_API_KEY`) para que a edge function `firecrawl-scrape` (usada pelo "Analisar" no onboarding) passe a funcionar.

### Passos
1. Solicitar o segredo `FIRECRAWL_API_KEY` via formulário seguro (você cola a chave `fc-...` lá — nunca no chat).
2. Após salvar, o segredo fica disponível automaticamente em todas as edge functions (`firecrawl-scrape`, `firecrawl-map`, `firecrawl-crawl`, `catalog-sync-website`).
3. Testar clicando em "Analisar" novamente no onboarding.

### Observação de segurança
Como você colou a chave no chat, recomendo **rotacioná-la no painel do Firecrawl** depois de salvar (gerar nova e revogar essa). Chaves em mensagens ficam no histórico.

Nenhuma alteração de código é necessária — as edge functions já estão prontas para usar `FIRECRAWL_API_KEY`.