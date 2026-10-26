# Análise de UI: os 9 mods do vídeo × os 6 mods desta coleção

Fonte: [9 Insane Claude Mods I Already Can't Live Without](https://youtu.be/bTqizdva04g) (Ben AI, 2026-10-21).
Base da análise: transcrição + descrição visual quadro a quadro do vídeo (VidIQ `video_watch`) e as
imagens deste repositório renderizadas em PNG (nesta pasta).

> **Limite honesto:** o YouTube bloqueou o download do vídeo (anti-bot). Os frames reais são os 5
> prints enviados pelo usuário (seção 0, mods 2, 3 e 4). Para os outros 6 mods a UI vem da análise
> visual do vídeo (VidIQ), com o timestamp do melhor frame para capturar. O pacote oficial dos
> mods está no link da descrição do vídeo.

## 0. Frames reais do vídeo (enviados pelo usuário)

Cinco prints dos mods 2, 3 e 4, em `video-frames/`. Eles corrigem e detalham a descrição textual da seção 1.

| Arquivo | Mod | O que se vê de fato |
| --- | --- | --- |
| `helper-desk-taskbar.png` | Helper desk, barra | Cartão acima do campo de prompt: título da tarefa (`● Video prep: Claude Projects`), selo roxo `Tasks 0/5`, trilho com **marcas de divisão** por etapa, `0%`, `×` para fechar e uma segunda linha `Now: Research the topic` |
| `helper-desk-panel-start.png` | Helper desk, painel | Abas `Mods × · Helper Desk × · In this chat ×` (os três mods dividem **um** painel com abas). Três cartões de resumo (`Total chat cost $1.05`, `Subagent tokens 106k`, `Time 0:11`), cabeçalho verde `Running · 5` e um cartão por agente |
| `helper-desk-panel-running-finished.png` | Helper desk, painel | Mesmos cartões 1:54 depois: `Running · 3` (verde) e `Finished · 2` (âmbar) em grupos recolhíveis; agentes concluídos mostram `Done · 6 steps`, check e barra cheia |
| `cache-clock.png` | Cache clock | Cartão flutuante (não uma faixa fixa): `🕐 Cache warm 59:59` em verde + linha de progresso + botão `Keep warm` à direita, e **uma frase de custo em linguagem simples**: “1 hour cache, as Anthropic's last reply set it. Reply now and 214k tokens cost 5 to 10% as much.” |
| `handoff.png` | Handoff | Cartão com título `Handoff ready:` + `912 words` em destaque amarelo; 5 etapas com check, barra e **um número por etapa** (`186 messages`, `14 files`, `2 skills, 3 links`, `34 s`); caminho salvo; botões `Copy handoff prompt` (**primário, preto**), `Start new chat with it`, `Open file`, `Close` |

O que cada print ensina (e que a seção 1 não tinha):

1. **Cada subagente tem uma identidade completa e única**: sprite pixelado, cor da borda do cartão, cor da barra e do passo atual
   (vermelho, laranja, verde, azul, rosa). Você acha “o agente laranja” no olho, sem ler. O nome é o papel (`Thumbnails`, `Research`,
   `Script`), a linha de baixo é `tipo · modelo`.
2. **Cada cartão responde três perguntas**: onde está (`Step 3 · Writing the hook`), o que acabou de fazer (duas linhas `Reading pre-outline.md`) e quanto
   falta (barra). No nosso `agent-watch` a linha só diz o que está rodando e há uma barra única de tokens, não de progresso.
3. **Totais no topo, em cartões** (custo, tokens, tempo), antes da lista. O custo em dinheiro aparece (`$4.31`); nosso `limits-meter`
   evita dinheiro de propósito, então aqui é uma decisão de produto, não de UI.
4. **Grupos por estado** (`Running`, `Finished`) com cabeçalho de cor cheia; os concluídos ficam visíveis, resumidos.
5. **A barra de tarefas tem marcas de etapa** no trilho, então 0% já mostra “são 5 partes”. A nossa barra do `plain-view` só preenche.
6. **Cache clock explica o porquê com um número**: “5 a 10% do custo”. Nosso `cache 42%` mostra a taxa, não a consequência.
7. **Botão primário escuro, secundários cinza-claros**: hierarquia clara em dois níveis (Handoff). No terminal o equivalente é `[ cor cheia ]` vs. `texto`.
8. **Em cada etapa, a evidência**: `186 messages`, `14 files`. Dá confiança de que o resumo não foi superficial.

Correção da seção 1: o Cache clock é um cartão flutuante (não “faixa docada”) e o Helper desk usa abas num painel único com os outros mods.
Faltam frames dos mods 1, 5, 6, 7, 8 e 9: os timestamps da seção 1 apontam onde capturar.

## 1. Os 9 mods do vídeo e a UI de cada um

| # | Mod | Gatilho | UI (placement, forma) | Timestamp do melhor frame | Ponto fraco visível |
| - | --- | --- | --- | --- | --- |
| 1 | **Brain dump** | envio do prompt (bloqueia se for longo) | Cartão acima do prompt, perguntas de múltipla escolha numeradas (`Dump 1 of 2`), depois o brief estruturado | 02:08 / 02:12 | O cartão cobre o histórico, difícil consultar o texto bruto |
| 2 | **Helper desk** | início de subagente / tarefa concluída | Barra roxa de progresso acima do prompt (`Tasks 2/5 · 40%`) + painel lateral com um cartão por agente: avatar-sprite próprio, cor, barra, custo | 03:52 | Denso com 5+ agentes |
| 3 | **Cache clock** | fim da resposta (usa o TTL real da API) | Faixa acima do prompt: relógio, contagem regressiva, barra que muda verde→amarelo→vermelho, `Keep warm` / `Stop` / `Hide` | 04:46 / 06:18 | Contagem permanente gera urgência artificial |
| 4 | **Handoff** | 250k tokens, cache frio ou `/handoff` | Cartão com etapas (lendo conversa, achando arquivos, escrevendo) e `Handoff ready: 912 words`; botões `Copy`, `Start new chat with it`, `Open file` | 08:04 | Resumo pode perder decisões sutis; sem prévia editável |
| 5 | **Reflect** | todo prompt (detecta regra dura) | Popup ancorado no prompt: regra citada + `Save to memory` (primário), `Save to vault`, `Skip` | 09:42 | Falsos positivos → fadiga de popup |
| 6 | **Chat inventory** (“In this chat”) | toda chamada de tool/conector/skill | Painel lateral seccionado: To-do (com a meta no topo), Connectors (logo + nº de chamadas), Skills, Files lidos/criados | 10:32 / 10:48 | Ocupa muita largura em laptop |
| 7 | **Screen share mode** | `/screen-share` | Faixa de status + máscara cinza arredondada sobre nomes, e-mails, telefones e valores; botão `Turn off` | 11:42 / 11:46 | Regex perde dados sem padrão (codinomes) |
| 8 | **Replay theater** | `/replay` | Diff passo a passo no painel lateral: chips `1 2 3 4`, `+` verde / `-` vermelho, `Prev (P) / Next (N) / Close (C)` | 12:04 / 12:34 | Só arquivos, não texto do chat |
| 9 | **Switchboard** | `/mods` | Painel lateral com todos os mods: ícone, descrição, toggle on/off e olho para esconder painéis | 12:54 / 13:24 | Sem busca, filtro nem categoria |

Padrões de UI que se repetem nos 9 (e que valem copiar):

1. **Uma faixa fina acima do prompt** para estado contínuo; **cartão com botões** para decisão pontual.
2. **Toda decisão tem ação primária + `Skip`/`Hide`**, nunca só informação.
3. **Painel lateral** para inventário (agentes, arquivos, mods); no terminal o equivalente é o pane.
4. **Identidade visual por entidade** (sprite/cor por subagente, logo por conector).
5. **Mods sem IA são grátis**; os que usam modelo avisam que gastam o plano.

## 2. Os 6 mods atuais (PNG nesta pasta)

`limits-meter.png`, `allowlist-coach.png`, `agent-watch.png`, `test-hud.png`, `launchpad.png`, `plain-view.png`.

Pontos fortes observados: layout de pane consistente (dica, seções, estado vazio, rodapé com verbos),
barras com densidade boa, cor semântica (verde/âmbar/vermelho) usada com disciplina, tudo sem custo de modelo.
Pontos fracos observados: o texto é denso e todo em cinza-azulado (pouca hierarquia entre “número que importa” e
“contexto”), `launchpad` mistura PT e EN (`configuration`, `list`, `place`), botões de `launchpad` ocupam muita
altura (caixas de 3 linhas), `agent-watch` e `limits-meter` não têm identidade visual por entidade e as
barras de `allowlist-coach` (`●●●○○`) e `limits-meter` (`████░░`) usam dois idiomas visuais diferentes.

## 3. Melhorias nos mods atuais

| Mod | Melhoria | Inspirada em | Esforço |
| --- | --- | --- | --- |
| **agent-watch** | Identidade por subagente: glifo + cor fixos (`◆` laranja = Research) usados no cartão, na barra e no passo atual, em vez de só o texto “Fix the flaky test” e uma barra de tokens | Helper desk (prints 2 e 3) | M |
| **agent-watch** | Cada agente com `Step N · ação atual` e as 2 últimas ações, não só a linha “running npm test for 6m” | Helper desk (print 3) | M |
| **agent-watch** | Resumo no topo (custo ou tokens totais, tempo) e grupos `Running · n` / `Finished · n` com cabeçalho de cor; hoje os concluídos somem numa linha `1 finished` | Helper desk (prints 2 e 3) | P |
| **agent-watch / plain-view** | Faixa acima do prompt com `Tasks 2/5`, marcas de divisão por etapa no trilho e `Now: <etapa>` (o cartão do `plain-view` já tem a barra, faltam as marcas e o selo de contagem) | Helper desk (print 1) | P |
| **agent-watch** | Modo compacto automático com 5+ agentes (uma linha por agente, expande no clique) | fraqueza do Helper desk | P |
| **limits-meter** | Contagem regressiva do **cache** (TTL real da resposta) na faixa, com cor verde→vermelho; hoje só mostra `cache 42%` (taxa de acerto), que não diz *quando esfria*. Acompanhar de uma frase de consequência: “Responda agora e 214k tokens custam 5 a 10%” | Cache clock (print 4) | M |
| **limits-meter** | Botão `keep warm` / `/keep-warm`: mensagem oculta antes do TTL, para sozinho após 2 h ou no próximo prompt. Estimar o custo frio vs. quente (`~$1,6 vs ~$0,04`) | Cache clock | M |
| **limits-meter** | Em 85% de contexto (hoje só sugere `compact`), oferecer `handoff` ao lado | Handoff | P |
| **allowlist-coach** | Padronizar a barra de contagem com a das outras barras (`███░░`); destacar o botão `allow` como primário e `dismiss` como secundário (hoje têm o mesmo peso) | padrão ação primária + skip | P |
| **allowlist-coach** | Agrupar por família (`Bash(npm run *)`) e propor a regra mais ampla segura, não uma por comando | Reflect (um clique salva) | M |
| **plain-view** | Seção “In this chat” no cartão: arquivos lidos/criados e conectores chamados, com contagem (hoje só arquivos mudados/lidos no resumo final) | Chat inventory | M |
| **plain-view** | Atalhos de teclado visíveis nos botões (`[-] fold`, `show request`) | Replay theater `(P)/(N)/(C)` | P |
| **launchpad** | Tudo em um idioma (hoje `configuration/list/add/remove/place` ao lado de rótulos PT); botões mais baixos (1 linha) para caberem mais no painel; campo de busca no painel de mods | Switchboard | P |
| **launchpad** | O painel de mods vira um **switchboard de verdade**: toggle on/off por mod (hoje só plain-view tem `desligar`) e lista qualquer mod instalado, não só os desta coleção | Switchboard | M |
| **test-hud** | Botão “mostrar diff do arquivo do teste” e agrupar falhas por arquivo; toast só na transição vermelho→verde (já existe) + toast único quando um teste vira `flaky?` | Replay theater | M |
| **todos** | Tema único de hierarquia: valor-chave em negrito/branco, rótulo em cinza, estado em cor; e um estado “modo discreto” (some tudo, volta com um toque) para quem acha a contagem distrativa | fraqueza do Cache clock | M |

## 4. Mods novos sugeridos

Priorizados por valor para quem trabalha com Claude Code diariamente e por *não* duplicar o que já existe.

| Prioridade | Mod | O que faz | UI | Usa IA? |
| --- | --- | --- | --- | --- |
| 1 | **cache-clock** | Contagem regressiva real do cache + `keep warm` | Faixa acima do prompt, barra verde→vermelho, `/keep-warm` | Não (a mensagem de keep-warm usa poucos centavos) |
| 2 | **switchboard** (`/mods`) | Lista todos os mods ativos, toggle on/off, esconder painéis, busca | Pane com linhas ícone·nome·descrição·toggle | Não |
| 3 | **handoff** | Gera um prompt de transferência completo (arquivos, skills, links, próximos passos) e abre uma conversa nova | Cartão com etapas + `Copy`, `Start new chat`, `Open file`; gatilhos 250k / cache frio / `/handoff` | Sim |
| 4 | **chat-inventory** | Painel “Nesta conversa”: tarefas, conectores com contagem, skills, arquivos lidos/criados | Pane seccionado; no desktop, painel lateral | Não |
| 5 | **screen-share** | Máscara cinza em nomes, e-mails, telefones, valores e *lista própria de termos* (codinomes de cliente) | Faixa `modo tela compartilhada` + `/screen-share off`; lista editável em `/screen-share terms` | Não |
| 6 | **replay** | Reproduz as edições de um arquivo passo a passo, `+/-`, volta à versão anterior | Pane com chips `1 2 3 4`, `P/N/C`, botão `restore this step` | Não |
| 7 | **reflect** | Detecta regra dura (“nunca use travessão”) e pergunta onde salvar: memória, CLAUDE.md, skill | Cartão com regra citada, `Save` primário, `Skip`; **limite de frequência** para evitar fadiga | Sim (ou heurística local) |
| 8 | **brain-dump** | Segura prompts longos de voz, faz 2–3 perguntas e reescreve num prompt estruturado (tarefa, porquê, limites, “pronto quando”) | Cartão de múltipla escolha acima do prompt, `Dump 1 of 2`; botão `send original anyway` | Sim |

Ideias que o vídeo não cobre e que se encaixam na coleção:

- **cost-ledger**: custo acumulado por sessão/dia/projeto em tokens e, opcionalmente, em moeda (BRL/USD), com sparkline semanal. Complementa o limits-meter, que hoje mostra “tokens e percentual, nunca dinheiro” por decisão de design, então entra como opt-in.
- **context-diet**: lista o que ocupa o contexto (arquivos lidos, saídas de tool grandes, MCPs) com barra por item e botão “esquecer/compactar este”. Resolve o “por que meu contexto está em 86%?” do limits-meter.
- **permission-radar**: junta o allowlist-coach com um risco por regra (rede, escrita, `rm`) e mostra o que o Claude pediu hoje, bloqueado e aprovado.
- **focus-mode**: modo discreto único que esconde todas as faixas e panes dos mods com um toggle (resposta direta à fadiga de UI que os 9 mods e os 6 atuais podem causar juntos).
- **session-recap**: ao reabrir uma conversa fria, um cartão “onde paramos” (última tarefa, arquivos mexidos, próximo passo), curto, sem IA, lido do transcript.

## 5. Ordem sugerida

1. `limits-meter`: cache countdown + keep-warm (maior economia real, UI já existe).
2. `launchpad`: idioma único + painel de mods com toggles (vira o switchboard).
3. `agent-watch`: nomes/cores por agente + faixa `Tasks n/m`.
4. Mods novos: `handoff`, `chat-inventory`, `screen-share`.
5. Mods novos restantes e o `focus-mode`.

## 6. Aviso sobre a origem

Os 9 mods do vídeo são do autor do vídeo (Ben AI) e de terceiros citados na descrição
(Savvy Progress, Cache Tax, Claude Reflect). Este documento descreve **ideias e padrões de UI**; qualquer mod
novo deve ser escrito do zero com a skill `plugin-authoring`, sem copiar código do pacote deles.
