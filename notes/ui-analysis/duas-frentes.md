# Duas frentes: melhorar os mods atuais × criar mods novos

Base: os 6 frames reais em `video-frames/` (Helper desk ×3, Cache clock, Handoff, Switchboard) e os
6 PNGs dos mods desta coleção. Esforço: P = horas, M = um dia, G = vários dias.

## O que o Switchboard (`video-frames/switchboard.png`) mostra

- Abas no mesmo painel: `Mods · Helpers · In this chat · Made in this chat`.
- Linha por mod: ícone, **nome**, descrição de uma frase, **comando em itálico** (`/cacheclock to show or hide`),
  olho (esconder o painel) e toggle verde.
- O olho só existe nos mods que têm painel. Mod sem painel (Screen-Share, Brain-Dump, Reflect) só tem toggle.
- Rodapé de três regras: *Off means off in every chat. Hidden keeps it on but out of sight. Changes apply within 3
  seconds. New mods appear here by themselves.*
- A lista revela dois mods que não estavam na transcrição: **Context Gauge** (`/gauge`: o que enche a janela de
  contexto) e **Output Tray** (`/tray`: arquivos e links criados na conversa). Os 9 do pacote são Context Gauge,
  Cache Clock, Handoff, Screen-Share, Brain-Dump, Reflect, Output Tray, Helper Desk e Chat Inventory; o Switchboard é o
  painel que lista os outros, e o Replay Theater é da Anthropic.

---

## Frente 1: UI dos seus mods atuais

### Em todos os mods (fazer primeiro)

| # | Mudança | Por quê (frame) | Esforço |
| - | --- | --- | --- |
| 1 | **Vocabulário único**: todo mod aceita `/x on`, `/x off`, `/x hide`, `/x show`, com a mesma regra do rodapé do Switchboard (*off* = desligado em todas as conversas, *hide* = ligado mas invisível). Hoje o `limits-meter` tem `hide/show`, o `plain-view` tem `on/off` e os outros não têm nenhum dos dois | Switchboard | M |
| 2 | **Botão primário × secundário** em todos os panes: um por cartão em cor cheia, o resto em texto. No `allowlist-coach` `allow`, `dismiss` e `reset count` têm o mesmo peso | Handoff | P |
| 3 | **Linha de frase de consequência** abaixo do número que importa (“responda agora e custa 5 a 10%”), em vez de só o dado | Cache clock | P |
| 4 | **Idioma único por mod**: PT ou EN, nunca os dois na mesma tela (`launchpad` hoje mistura) | análise dos PNGs | P |
| 5 | **Hierarquia tipográfica**: número-chave em branco/negrito, rótulo em cinza, estado em cor | todos os PNGs | P |

### Mod a mod

| Mod | Mudança | Frame | Esforço |
| --- | --- | --- | --- |
| **launchpad** | Painel de mods vira switchboard: linha `ícone · nome · descrição · /comando · [olho] · [on/off]` para os 6 mods; rodapé com as 3 regras; abas `Mods · Atalhos`; botões de 1 linha (hoje 3 linhas de altura) | Switchboard | M |
| **agent-watch** | Identidade por agente (glifo + cor fixos usados no cartão, barra e passo atual); `Step N · ação` mais as 2 últimas ações; cartões de resumo no topo (tokens, tempo, custo opcional); grupos `Running · n` e `Finished · n` com cabeçalho de cor | Helper desk | M |
| **agent-watch** | Modo compacto automático com 5+ agentes | fraqueza do Helper desk | P |
| **limits-meter** | Contagem regressiva do cache (TTL real) em verde→vermelho, com a frase de consequência; botão `keep warm` | Cache clock | M |
| **limits-meter** | Barra de contexto vira **decomposição** (conversa, arquivos lidos, saída de tools, MCP, system) com `/gauge`-like no pane | Context Gauge | M |
| **limits-meter** | Em 85% de contexto, botão `handoff` ao lado de `compact` | Handoff | P |
| **plain-view** | Cartão com selo `Tasks 2/5`, marcas de etapa no trilho e linha `Now: …`; barra do cartão pode fechar (`×`) | Helper desk, barra | P |
| **plain-view** | No cartão final, lista de *saídas* (arquivos e links criados) com contagem, além de “arquivos mudados e lidos” | Output Tray / Chat Inventory | M |
| **allowlist-coach** | Barra de contagem no mesmo estilo das outras (`███░░`) e `allow` como primário | Handoff | P |
| **test-hud** | Falhas agrupadas por arquivo; botão para abrir o arquivo do teste | Replay theater | M |

---

## Frente 2: ideias de mods novos

Cada um segue o Switchboard: um comando próprio, `hide/show` se tiver painel, `on/off` sempre, sem custo de modelo
quando possível. “IA” = gasta o plano, e o mod deve avisar.

### Do pacote do vídeo (reescritos do zero, sem copiar código)

| Prioridade | Mod | Comando | O que faz | UI | IA | Esforço |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **cache-clock** | `/cacheclock` | Contagem regressiva do cache com o TTL real da resposta, `Keep warm`, para sozinho no próximo prompt ou em 2 h | Cartão flutuante verde→vermelho + frase de consequência | Não (poucos centavos no keep-warm) | M |
| 2 | **switchboard** | `/mods` | Lista todos os mods, toggle on/off, olho, busca, rodapé de regras; abas por grupo | Pane com linhas do print acima | Não | M |
| 3 | **context-gauge** | `/gauge` | Mostra o que enche a janela de contexto, por categoria, com botão para esquecer ou compactar o que pesa | Barra empilhada + lista | Não | M |
| 4 | **handoff** | `/handoff` | Prompt de transferência com arquivos, skills, links e próximos passos; gatilhos: 250k, cache frio, comando | Cartão de 5 etapas com contagens + `Copy`, `Start new chat`, `Open file`, `Close` | Sim | G |
| 5 | **chat-inventory** | `/inventory` | Tarefas, conectores (com contagem), skills, arquivos lidos e criados | Pane com seções; abas `In this chat · Made in this chat` | Não | M |
| 6 | **output-tray** | `/tray` | Só os arquivos e links *criados* na conversa, com abrir e copiar caminho (pode ser aba do chat-inventory) | Lista com ícone por tipo | Não | P |
| 7 | **screen-share** | `/screen-share` | Máscara cinza em nomes, e-mails, telefones, valores e **termos seus** (codinomes) | Faixa de status + `Turn off` | Não | M |
| 8 | **replay** | `/replay` | Reproduz as edições de um arquivo passo a passo, com `+/-` e restauração | Chips `1 2 3 4`, teclas `P/N/C`, `restore this step` | Não | G |
| 9 | **reflect** | automático | Detecta regra dura e pergunta onde salvar (memória, CLAUDE.md, skill); limite de frequência | Cartão com regra citada, `Save` primário, `Skip` | Sim, ou heurística local | M |
| 10 | **brain-dump** | automático | Segura prompts longos, faz 2–3 perguntas e reescreve; botão `send original anyway` | Cartão de múltipla escolha, `Dump 1 of 2` | Sim | G |

### Ideias suas, que o vídeo não cobre

| Mod | Comando | O que faz | UI | IA | Esforço |
| --- | --- | --- | --- | --- | --- |
| **cost-ledger** | `/cost` | Custo por sessão, dia e projeto, com sparkline semanal; opt-in, já que o `limits-meter` evita dinheiro | Cartões de resumo (como o Helper desk) + lista | Não | M |
| **focus-mode** | `/focus` | Um toggle que esconde todas as faixas e panes dos mods e os traz de volta num toque | Faixa mínima `focus on · show` | Não | P |
| **session-recap** | `/recap` | Ao reabrir uma conversa fria, cartão “onde paramos”: última tarefa, arquivos mexidos, próximo passo | Cartão com `Continue` primário | Não (lê o transcript) | M |
| **permission-radar** | `/radar` | Resumo do dia do que o Claude pediu, o que foi aprovado e o risco por regra; complementa o `allowlist-coach` | Pane com abas por risco | Não | M |
| **agent-names** | `/names` | Dá nome e cor por papel aos subagentes (`research`, `script`) a partir do `description`/tipo do agente; alimenta o `agent-watch` e o `plain-view` | Sem UI própria; opção em `/config` | Não | P |
| **keep-quiet** | `/quiet` | Limite global de toasts por minuto entre todos os mods, com fila | Contador no pane do switchboard | Não | M |

## Ordem recomendada

1. **Vocabulário `on/off/hide/show` e botão primário** nos 6 mods (frente 1, itens 1 e 2). É o que viabiliza o switchboard.
2. **launchpad → switchboard** e **limits-meter → cache countdown e gauge**.
3. **agent-watch** com identidade, passos e grupos.
4. Novos: `handoff`, `chat-inventory` + `output-tray`, `screen-share`.
5. `focus-mode` e `keep-quiet` quando houver 8+ mods ativos, para o conjunto não virar poluição.

## Limites do que se vê

Cada mod do vídeo é de terceiros (Ben AI e os autores citados na descrição). Aqui estão só padrões de UI e
ideias; qualquer mod novo deve ser escrito do zero com a skill `plugin-authoring`. Se um mod conseguir ligar/desligar
*outro* plugin ou depende de uma opção de `/config` própria de cada mod, isso precisa ser confirmado na API de mods antes de prometer o switchboard universal.
