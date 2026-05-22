## Objetivo
Fazer o preview ficar realmente fixo na lateral direita enquanto você rola o conteúdo da esquerda, ocupando toda a altura disponível da tela.

## Diagnóstico
Hoje o preview usa `lg:sticky lg:top-0` dentro de um container `overflow-y-auto`. O sticky funciona, mas:
- A altura está limitada a `calc(100dvh-160px)`, então sobra espaço embaixo.
- O scroll acontece no container pai, e o sticky "gruda" só até onde o grid termina — quando o conteúdo da esquerda é curto, o preview parece "subir junto".

## Solução
Em telas `lg+`, transformar a coluna direita em uma **coluna fixa de altura total**, e deixar **apenas a coluna da esquerda rolar**.

### Mudanças em `FunnelAppearanceTab.tsx`
1. Remover o `overflow-y-auto` do wrapper externo (`<div className="flex-1 overflow-y-auto pt-4 min-h-0">`).
2. Trocar o grid por um layout `lg:flex` onde:
   - **Esquerda**: `flex-1 overflow-y-auto` (rola sozinha, com `pr-4` para respiro).
   - **Direita**: largura fixa `lg:w-[440px]`, `lg:h-full`, `lg:sticky lg:top-0` **OU** simplesmente parte do flex sem rolar — ocupa 100% da altura do pai.
3. O container interno do preview passa a usar `h-full` (sem `max-h` artificial), e o `AppearanceLivePreview` continua dentro de um `flex-1 min-h-0 overflow-y-auto` caso o preview de mobile/desktop exceda a altura.
4. No mobile (`<lg`), mantém o comportamento atual de empilhar (preview em cima, controles embaixo) com rolagem normal da página.

### Resultado
- Você rola **só** a coluna da esquerda (presets + formulário de aparência).
- A coluna direita (preview + toggle mobile/desktop) fica **100% fixa**, da barra de canais até o fim da tela.
- Sem "sobrar espaço" embaixo do preview.

## Arquivos
- `src/components/admin/capture/appearance/FunnelAppearanceTab.tsx` — única alteração, só de layout/CSS Tailwind. Nada de lógica de negócio.
