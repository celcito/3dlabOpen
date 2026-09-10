# Viewer3D Layout Critique — 2026-09-08

Baseado no product register (técnico, preciso, confiável) e DESIGN.md (The Workshop Bench).

## Problemas Críticos

### 1. Glassmorphism proibida no Navigation Guide
`backdrop-blur-md` + `bg-[#F9FAF4]/85]` (linhas 1503, 1513-1515, 1528). DESIGN.md bane: "Don't use gradients, glassmorphism, or backdrop-filter blur."

### 2. Cores hardcoded ignoram o design system
CSS define tokens `--workbench-accent`, `--workbench-muted`, `--workbench-line`, mas código usa `text-zinc-400`, `text-zinc-500`, `bg-[#E8E9E3]`, `text-[#212121]` por toda parte. Quebra consistência e impede troca de tema.

### 3. Header ocupa espaço demais para ferramenta
`text-6xl font-black` + `p-8` é proporção de landing page. viewport deveria dominar. Header compacto (40-48px) com título menor.

### 4. Grid do viewport usa cores escuras demais
`cellColor="#222" sectionColor="#444"` (linha 1495). DESIGN.md define `--workbench-line: #DDE1D8` para linhas sutis.

## Layout & Hierarquia

### 5. Toolbar bottom bar muito densa
10+ botões compactos (`gap-1.5`, `text-[9px]`) com 3 grupos separados por `w-px`. Difícil escanear. Agrupar por ação com mais respiro.

### 6. Sidebar: seções numeradas erradas
"01" → "04" → "05" → "05b". Faltam 02 e 03. Numeração deveria ser sequencial.

### 7. Estados ativos visualmente inconsistentes
- Brush ativo: `bg-[#632CE5] text-[#212121]`
- Preview ativo: `bg-[#632CE5] text-white`
- Encaixe ativo: `bg-[#FFD700]/20 text-[#FFD700]`
- Auto Highlight ativo: `bg-[#632CE5]/20 text-[#632CE5]`

Padronizar: fundo primary-tinted, texto primary, borda primary.

### 8. "05b. Modo Booleano" deveria estar dentro de "05. Encaixes"
É configuração dos encaixes, não seção independente.

## Cor & Contraste

### 9. Muitas cores semânticas competindo
Roxo, verde (#00FF41), dourado (#FFD700), vermelho (#FF1744), âmbar (#F59E0B). 5 cores em ferramenta "restrained". Reduzir para: primary, success, error, warning.

### 10. Contraste insuficiente
`text-zinc-300` em fundo claro não passa WCAG AAA. Usar `--on-surface-variant: #494455`.

## Correções Sugeridas

| Problema | Solução |
|---|---|
| Glassmorphism | Remover `backdrop-blur-md`, fundo sólido com opacity |
| Cores hardcoded | Substituir por `var(--workbench-*)` tokens |
| Header grande | Reduzir para 40-48px, título `text-lg`/`text-xl` |
| Grid escuro | `cellColor="#DDE1D8" sectionColor="#CAC3D8"` |
| Toolbar densa | Aumentar `gap` para 2-3px, agrupar visualmente |
| Numeração errada | Renumerar: 01, 02, 03, 04 |
| Estados ativos | Padronizar: `bg-primary/10 text-primary border-primary` |
| Contraste | Usar `--on-surface-variant` para texto secundário |
