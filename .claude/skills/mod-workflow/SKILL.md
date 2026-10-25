---
name: mod-workflow
description: Fluxo para prototipar um mod novo, ou mudar a UI de um existente, nesta coleção. Use quando o pedido for criar, redesenhar ou prototipar um mod, painel, faixa, toast ou cartão do Claude Code, ou quando pedirem uma referência de UI para um mod.
---

# mod-workflow

Fluxo para levar uma ideia de mod a um protótipo que passa na CI desta coleção. A UI nunca começa do zero:
parta de um padrão já catalogado, com imagem.

## Referências de UI (leia antes de desenhar)

Tudo em `docs/ui-analysis/`:

- `README.md`: os 9 mods do vídeo de referência, o que cada print ensina e a análise dos 6 mods atuais.
- `duas-frentes.md`: o que melhorar nos mods atuais × ideias de mods novos, com esforço e ordem.
- `video-frames/`: frames reais de mods de referência.
  - `helper-desk-taskbar.png`: selo `Tasks 0/5`, trilho com marcas de etapa, `Now: <etapa>`.
  - `helper-desk-panel-start.png`, `helper-desk-panel-running-finished.png`: cartões de resumo,
    grupos `Running` e `Finished`, um cartão por agente com cor e identidade próprias.
  - `cache-clock.png`: número + barra + frase de consequência + um botão.
  - `handoff.png`: etapas com um número cada, botão primário escuro e secundários claros.
  - `switchboard.png`: linha `ícone · nome · descrição · /comando · olho · toggle` e rodapé com as três regras.
- `*.png` na raiz da pasta: os 6 mods desta coleção, para manter a coerência visual.

Abra a imagem mais próxima do que o mod precisa mostrar com o Read antes de escrever qualquer `ui.tsx`.

## Padrões que todo mod desta coleção segue

1. **Superfície certa**: estado contínuo = faixa fina acima do prompt ou linha de status; decisão pontual = cartão com
   botões; inventário = pane; aviso = toast. Ver “Shared bands” no `README.md`.
2. **Um botão primário por cartão**, o resto em texto (`Copy handoff prompt` × `Close`).
3. **Todo número importante vem com uma frase de consequência**, não só o dado.
4. **Vocabulário de comandos**: `/x` abre, `/x on|off` liga e desliga em todas as conversas, `/x hide|show` esconde o
   painel sem desligar, `/x help` lista. Tudo que roda algo de fora do mod, ou desfaz dados da pessoa, só coloca o texto no prompt.
5. **Layout de pane**: dica em cinza no topo, seções com título em negrito, estado vazio que nomeia o próximo passo
   (`/x demo`), rodapé com os verbos como botões e um fechar. Ver “Pane layout” no `README.md`.
6. **Um idioma por tela** (opção `language`: `auto`, `pt-BR`, `en`), nunca os dois.
7. **Custo**: mod sem IA é o padrão. Se chamar modelo, diga na descrição e na tabela “What each mod reaches”.

## Passos

1. **Escolher a referência.** Abra os PNGs que combinam com a superfície e ache o mod mais parecido em
   `docs/ui-analysis/README.md`. Anote em uma linha o padrão que vai copiar e o que vai mudar.
2. **Definir o contrato**: gatilho (qual evento), o que desenha e onde, comandos, opções em `userConfig`,
   o que lê e escreve (a tabela do `README.md` precisa dela).
3. **Criar a pasta do mod** com a mesma estrutura dos outros:
   `<mod>/.claude-plugin/plugin.json`, `<mod>/hooks/{hooks.json,register.tsx,ui.tsx,words.ts}`,
   `<mod>/types/index.d.ts`, `<mod>/tests/`, `<mod>/README.md`. `ui.tsx` é cópia dos outros mods:
   não edite uma cópia só (ver “Shared helpers”).
4. **Registrar** o mod em `.claude-plugin/marketplace.json` com o mesmo `name` e `description` do `plugin.json`.
5. **Escrever os testes**, incluindo o teste de render nas superfícies `terminal` e `desktop`, e o teste de
   cada estado (vazio, normal, atenção, erro).
6. **Gerar o screenshot** com `scripts/screenshots/<mod>.snap.tsx` e `./scripts/screenshots/run.sh`; a CI exige que
   as imagens batam com o que o mod desenha agora. Compare com a imagem de referência do passo 1.
7. **Rodar as checagens** antes de subir:
   ```bash
   claude plugin validate ./<mod> && claude plugin test ./<mod>
   ./scripts/check-shared.sh
   python3 scripts/check-manifests.py
   ./scripts/check-versions.sh origin/main
   ./scripts/screenshots/run.sh && git diff --stat screenshots
   ```
8. **Documentar**: seção do mod nos dois READMEs (`README.md` e `README.pt-BR.md`), a linha na tabela de cada um
   e a linha em “What each mod reaches”. Mod alterado sobe a `version` no `plugin.json`.

## Se a referência não existe

Se o mod pedido não tem padrão em `docs/ui-analysis/`, descreva a UI em texto, prototipe, gere o screenshot e
**acrescente o frame e a lição em `docs/ui-analysis/`** para o próximo mod.

## Não fazer

- Copiar código de mods de terceiros: o vídeo de referência só serve para padrões de UI.
- Criar um comando que mude o mod sem um `on`/`off` equivalente.
- Subir imagem na CI que não foi gerada pelo `run.sh`.
