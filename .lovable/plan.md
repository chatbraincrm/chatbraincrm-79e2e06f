## Objetivo

Eliminar a tela confusa "Aguardando liberação" para Super Admin e Admin, sem efeitos colaterais no banco. Foco: zero suporte ao escalar para 100+ empresas.

## Mudanças

### 1. Redirect inteligente no login (`src/pages/Index.tsx`)

Após o carregamento dos produtos, aplicar as regras nesta ordem:

```text
1. Super Admin + shouldForceSetup → /super-admin   (já existe)
2. Super Admin                    → /admin         [NOVO]
3. Admin + onboarding guiado      → fica em /      (já existe — mostra modal)
4. Admin sem produtos atribuídos  → /admin         (já existe, ajustar condição)
5. Admin com produtos             → fica em /      (atua como vendedor)
6. Vendedor/Manager               → fluxo normal (EmptyState se sem produtos)
```

Resultado: no fluxo padrão de login, nenhum usuário com papel administrativo cai na tela "Aguarde seu gestor".

### 2. EmptyState contextual por papel (`src/components/product/EmptyState.tsx`)

Hoje o componente mostra a mesma mensagem para todo mundo. Vamos dividir em duas variantes detectando o papel via `useAuth`:

**Variante Admin/Super Admin** (quando, por algum motivo — ex: clicar em "Voltar ao App" pelo painel — caem aqui):
- Título: "Nenhum produto atribuído a você"
- Subtítulo: "Você é administrador desta empresa. Crie um produto ou atribua produtos existentes a si mesmo para usar o app de vendedor."
- Botões:
  - Primário: "Ir para o Painel Admin" → `/admin`
  - Secundário: "Criar produto" → `/admin` (aba produtos)
  - Secundário: "Gerenciar equipe" → `/admin` (aba equipe)

**Variante Vendedor/Manager** (mantém o que existe hoje):
- Título: "Bem-vindo ao {platformName}"
- "Você ainda não tem produtos atribuídos"
- "Aguarde seu gestor liberar acesso aos produtos."
- Badge "Aguardando liberação"

### Detalhes técnicos

- `src/pages/Index.tsx`: adicionar `if (isSuperAdmin()) return <Navigate to="/admin" replace />;` logo após o bloco do `shouldForceSetup`. Simplificar a condição existente do admin removendo `!isSuperAdmin()` (já tratado acima).
- `src/components/product/EmptyState.tsx`: importar `useAuth`, calcular `isAdminLike = isAdmin() || isSuperAdmin()`, renderizar variante condicionalmente. Usar `useNavigate` do `react-router-dom` para os botões.
- Os caminhos exatos das abas do `/admin` (produtos, equipe) seguem o padrão já usado em `src/pages/Admin.tsx` — verificar e usar query param/hash apropriado, ou apenas levar à raiz `/admin` por enquanto.

## Fora do escopo

- Nenhuma migração de banco.
- Nenhuma atribuição automática de produtos (evita poluir Auto Dispatch, metas, rankings).
- Nenhuma alteração em RLS, edge functions, ou hooks de dados.
- Nenhuma mudança no fluxo de vendedor.

## Impacto em escala

- Toda empresa nova criada via `create-organization-admin` cai num fluxo previsível e self-service.
- Admins que voltam ao app sem produtos sabem exatamente o que fazer — sem ticket de suporte.
- Super Admin nunca mais vê tela confusa em qualquer ambiente.
- Mudança 100% no frontend, baixíssimo risco de regressão.
