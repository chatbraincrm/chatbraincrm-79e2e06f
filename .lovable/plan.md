## Diagnóstico dos 3 problemas

**1. E-mail de teste não chegou**
Nenhum domínio remetente está configurado no workspace. Sem domínio, o Lovable Emails não envia nada — a função `test-integration` falha silenciosamente.

**2. Aba "Templates" vazia**
A tabela `platform_email_templates` está com 0 registros. O componente está correto, só falta popular os dados.

**3. Central de Ajuda vazia**
Tabelas `help_categories` e `help_articles` zeradas.

---

## Etapa 1 — Configurar domínio remetente `notify.chatbraincrm.com.br`

Bloqueia o teste de e-mail funcionar. Vou abrir o diálogo oficial de setup, você adiciona 2 registros NS no seu provedor de DNS, e a verificação roda em background (pode levar algumas horas). Enquanto isso, podemos seguir com as etapas 2 e 3 normalmente.

---

## Etapa 2 — Seed de Templates de E-mail da Plataforma

Migração inserindo **12 templates** padrão divididos nas 4 categorias da UI:

**Acesso & Convites** (4)

- Convite de novo membro da equipe
- Boas-vindas após cadastro
- Recuperação de senha
- Confirmação de e-mail

**Cobrança** (4)

- Lembrete pré-vencimento
- Cobrança no dia do vencimento
- Alerta de atraso
- Aviso de suspensão por inadimplência

**Sistema** (3)

- Notificação genérica da plataforma
- Alerta de WhatsApp desconectado
- Novo lead atribuído

**Mala Direta** (1)

- Comunicado geral aos clientes

Cada template terá: `name`, `subject`, `description`, `body_html` em português com variáveis (`{{nome}}`, `{{empresa}}`, `{{link_acao}}` etc.), `is_system=true`, `is_active=true`. Layout HTML inline limpo, sem dependência de imagens externas, pronto para edição pelo editor já existente.

---

## Etapa 3 — Seed da Central de Ajuda

Migração com **8 categorias** + **25 artigos publicados** cobrindo todas as funcionalidades reais do sistema:

### Categorias

1. **Primeiros Passos** — onboarding inicial
2. **Atendimento & Inbox** — conversas, fila, transferências
3. **WhatsApp & Integrações** — Evolution, conexões, regras
4. **Captura & Funis** — funis, formulários, widgets
5. **Leads & Pipeline** — qualificação, distribuição, BANT
6. **IA & Agentes** — agentes autônomos, treinamento, copiloto
7. **Equipe & Permissões** — papéis, setores, convites
8. **Agendamentos & Calendário** — Google Calendar, eventos

### Artigos (título — categoria)

- Bem-vindo ao ChatBrain — Primeiros Passos
- Configurando seu primeiro produto — Primeiros Passos
- Convidando sua equipe — Primeiros Passos
- Como funciona a fila de atendimento — Atendimento
- Aceitando e transferindo conversas — Atendimento
- Aba "Aguardando": humanos e IA — Atendimento
- Conectando uma instância Evolution (WhatsApp) — WhatsApp
- Por que números precisam de DDI 55 — WhatsApp
- Editando e apagando mensagens enviadas — WhatsApp
- Criando um funil de captura — Captura
- Personalizando aparência por canal — Captura
- Instalando o widget no seu site — Captura
- Entendendo o framework BANT — Leads
- Distribuição automática (Auto Dispatch) — Leads
- Transferência de leads com auditoria — Leads
- Criando seu primeiro agente IA — IA
- Treinando a IA com documentos — IA
- Agendamento autônomo pela IA — IA
- Usando o Copiloto de vendas — IA
- Papéis: Super Admin, Admin, Gestor, Vendedor — Equipe
- Setores e permissões granulares — Equipe
- Removendo um membro com segurança — Equipe
- Conectando o Google Calendar — Agendamentos
- Criando tipos de evento — Agendamentos
- Lembretes e confirmações automáticas — Agendamentos

Todos com `is_published=true`, `display_order` definido, slugs únicos, conteúdo HTML em português claro (h2/h3/p/ul/strong) — editável pelo `RichEditor` existente.

---

## Etapa 4 — Validar

- Recarregar `/super-admin` → aba **Templates** lista os 12 templates agrupados.
- Acessar **Central de Ajuda** → ver as 8 categorias e 25 artigos.
- Após DNS verificar (etapa 1), reenviar o e-mail de teste.

---

## Detalhes técnicos

- Migrações idempotentes (`ON CONFLICT (slug) DO NOTHING`) — seguro rodar múltiplas vezes.
- HTML dos e-mails: estilos inline, fonte Arial, header com nome da plataforma, footer simples (descadastro é injetado automaticamente pelo Lovable Emails).
- Artigos: HTML semântico simples, sem CSS externo, compatível com edição posterior pelo painel.
- **Nenhuma alteração em componentes React** — apenas dados via migration.

---

## Fora de escopo

- Customização visual avançada dos templates (faremos depois se quiser).
- Tradução para outros idiomas.
- Vídeos/screenshots nos artigos (você pode adicionar depois pelo editor da Central de Ajuda).
- Configurar provedores de pagamento, WhatsApp, ou outras integrações.

---

## Ordem de execução proposta

1. Abrir diálogo de domínio (`notify.chatbraincrm.com.br`)
2. Migration de templates de e-mail
3. Migration de categorias + artigos da Central de Ajuda
4. Validação final

**O que você quer ajustar antes de aprovar?** Posso mudar nomes de categorias, adicionar/remover artigos, trocar o subdomínio remetente, etc.