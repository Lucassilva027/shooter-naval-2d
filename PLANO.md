# Pirate Battle — Plano de Implementação

Documento vivo para acompanhar o desenvolvimento. Marque `[x]` ao concluir cada item.
Prazo alvo: 2 dias. **Deploy na Vercel ao final do Dia 1.**

---

## Estrutura de pastas

```
public/
  assets/              # assets fornecidos (navios, tiles, efeitos, ui_sheet*.json)
    sounds/            # WAV
  mockServiceWorker.js # gerado pelo MSW (necessário no build publicado)
src/
  app/                 # App.tsx, providers (QueryClient), máquina de telas
  config/              # gameConfig.ts (config tipada), limites e validação das Options
  storage/             # persistência local (options, pendentes, banco do mock)
  api/                 # contratos tipados, cliente Axios
    queries/           # hooks TanStack Query (ranking, histórico, registro)
  game/
    core/              # GameLoop (delta time fixo), Clock, RNG com seed, World
    entities/          # Player, Chaser, Shooter, Projectile, Island (dados puros)
    systems/           # movimento, colisão, armas/cooldown, spawn, dano, regras da partida
    input/             # teclado e toque -> InputState (isolado)
    render/            # camada PixiJS: views, health bars, efeitos, resize
    assets/            # manifest, carregamento, progresso, falhas
    bridge/            # store externo (useSyncExternalStore) jogo -> React, sem render por frame
  ui/
    screens/           # Menu, Options, Match, Result
    components/        # botões, abas, diálogos, paginação, estados de erro/vazio
    hud/               # HUD semântico (vida, pontos, tempo), overlay de pausa, controles de toque
    styles/
  mocks/               # MSW: handlers, db em memória + localStorage
    fixtures/          # dados compartilhados entre dev, testes e demo
    scenarios/         # cenários de rede (sucesso, vazio, lento, timeout, 5xx...)
  testing/             # instrumentação (window.__PIRATE__): observar estado, controlar relógio/seed
tests/
  e2e/                 # Playwright E2E
  visual/              # regressão visual (baselines versionadas)
  fixtures/            # fixtures do Playwright
docs/
  perf/                # evidências de profiling
```

---

## Princípios de arquitetura (não negociáveis)

- [ ] Simulação em TypeScript puro, sem dependência de PixiJS (testável e determinística)
- [ ] Game loop com **passo fixo** (ex.: 1/60 s) + acumulador; delta limitado (clamp) para não "teleportar" após travadas
- [ ] React **não** re-renderiza por frame: HUD lê um store externo que só notifica quando valores mudam (ex.: segundo inteiro, vida, pontos)
- [ ] Cleanup completo em `useEffect` (ticker, listeners, timers, `app.destroy`) — seguro em Strict Mode
- [ ] Toda constante de balanceamento em `src/config/gameConfig.ts`
- [ ] Teclas do jogo capturadas só com gameplay ativa
- [ ] Falha de API nunca bloqueia jogo

---

## Fases

### Dia 1

#### 1. Setup do projeto

- [x] Vite + React + TypeScript strict
- [x] PixiJS v8, ESLint, Prettier, Vitest, Playwright, MSW (`mockServiceWorker.js` em `public/`)
- [x] Scripts: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:e2e`
- [x] Copiar assets para `public/assets` (atlas dos navios convertido para JSON)
- [ ] `ASSETS.md` com origem e licença dos assets

#### 2. Game loop com delta time

- [x] `FixedStepLoop` (passo fixo, acumulador, clamp) + interpolação no render
- [x] `KeyboardInput` (por `event.code`, só captura com gameplay ativa) + `mergeInputs` para teclado + toque
- [x] Movimento com inércia (acelera, freia gradual, drag) e rotação; contenção nos limites da arena
- [x] `GameController`: montagem Pixi dentro de React com cleanup seguro no Strict Mode
- [x] Carregamento de assets com progresso, erro acessível e "Try again" (`strategy: 'retry'`)
- [x] Mundo fixo por partida + letterbox no resize
- [x] Testes: 14 unitários (Vitest) + 2 E2E (falha/nova tentativa de assets, 5 ciclos sem vazar canvas)

#### 3. Colisões

- [x] Limites da arena (considerando o casco inteiro e a orientação)
- [x] 3 ilhas em layout fixo proporcional (grama, areia, rocha), colisão por união de círculos
- [x] Casco do navio como 3 círculos (proa, meio, popa); deslizamento pela costa sem "grudar"
- [x] `separateShips` pronto para inimigos (empurrão simétrico)
- [x] Debug visual dos círculos com `?colliders` na URL
- [ ] Projéteis × ilhas (fase 4)

#### 4. Disparos

- [x] Frontal (1 projétil) e lateral (3 paralelos, esquerda e direita), tiro automático ao segurar
- [x] Cooldown por arma (laterais independentes por lado), vida útil, dano aplicado uma única vez
- [x] Projéteis param em ilhas, somem ao sair da arena, splash ao expirar
- [x] Fila de eventos da simulação → efeitos (pool de sprites) e áudio (Web Audio, mudo persistido)
- [x] Estágios de dano do casco por vida + flash vermelho ao ser atingido
- [x] 11 testes unitários de armas/projéteis (inclui mesma cadência a 30 e 144 fps)

#### 5. Inimigos

- [x] Chaser (persegue, explode no impacto com 25 de dano, não pontua ao se autodestruir)
- [x] Shooter (aproxima até ~80% do alcance, mira, dispara com linha de visão livre)
- [x] Desvio de ilhas por "bigodes" (sondas à frente e laterais)
- [x] Spawner com intervalo configurável, abertura 1 de cada, sorteio 60/40 com seed, teto de 10 vivos
- [x] Pontos de spawn livres de ilhas/navios e longe do jogador; `?seed=` na URL reproduz a partida
- [x] Inimigo afundado sai da simulação na hora (sem colisão/tiro), destroço afundando + explosão + som
- [x] Barras de vida sobre todos os navios (redesenhadas só quando a vida muda), fade-in no spawn
- [x] 16 testes novos (spawner + comportamento dos inimigos + pontuação), 52 no total

#### 6. HUD

- [x] Vida (barra `role=meter` + número) à esquerda, tempo (`role=timer`) no centro, pontos à direita
- [x] `aria-live` só para marcos: 30 s, 10 s, vida baixa (≤25%) e fim de partida
- [x] Últimos 10 s: tempo vermelho pulsando + `time_warning` a cada segundo; `health_low` ao cair para ≤25%
- [x] Regras: 120 s padrão (`match.durationSeconds`), fim por tempo ou morte, pontuação congelada no fim
- [x] Encerramento de 1,5 s (banner + navio afundando), depois `onFinish(MatchResult)` com snapshot do config e seed
- [x] Tela de resultado provisória (a definitiva fica na fase 7)
- [x] 5 testes novos de regras de partida (57 no total)
- [x] Health bars sobre navios, deterioração visual (feito na fase 5)

#### 7. Telas principais

- [x] Visual das telas de referência (`sample_*.png`): fundo `ui_scene_background.png`, painel nine-slice e botões do `ui_sheet` via `border-image` (1x/2x)
- [x] Menu: Play, Options, How to play (diálogo), último resultado, botões Ranking / Match history
- [x] Records: abas ARIA (Ranking | Match history) com setas do teclado; conteúdo vazio até a fase 9
- [x] Apelido na 1ª partida: `<dialog>` modal, 3–16 caracteres (letras, números, espaço, `-`, `_`), `playerId` via `crypto.randomUUID()`
- [x] Options (parcial): trocar apelido, som; duração/spawn ficam na fase 8
- [x] Sair da partida: confirmação "Leave battle?" com a partida suspensa (`GameController.setSuspended`), foco em "Keep fighting"
- [x] Resultado: título por motivo, pontos, tempo, motivo, "New best!" / melhor anterior; último resultado e recorde por config (`configKey`) salvos localmente
- [ ] Status do registro no Resultado (fase 9)
- [x] Controles de toque (`TouchInput` + stick e 3 botões de canhão, só em `pointer: coarse`) e aviso para girar em retrato
- [x] Botão de pausa no toque fica para a fase 10
- [x] 7 testes unitários novos (64) e 7 E2E novos por projeto (18 no total)

#### 8. Options

- [x] Duração (60–180 s, passo 10) e intervalo de spawn (1–15 s, passo 1, padrão 3) em `OPTION_LIMITS`
- [x] Steppers −/+ como na referência, `role=spinbutton` (setas, Page Up/Down, Home/End), botões desabilitados nos limites
- [x] Salvamento automático a cada mudança; "Reset to defaults" com anúncio para leitor de tela
- [x] Validação por campo (`normalizeOption`): limita, alinha ao passo, valor inválido → padrão
- [x] `createMatchConfig(options)` aplica as opções num snapshot congelado no início da partida
- [x] Captain e Sound abaixo dos steppers + nota sobre ranking por configuração
- [x] 8 testes unitários novos (72) e 6 E2E novos por projeto (30 no total)

#### ✈️ Deploy de segurança na Vercel (fim do Dia 1)

### Dia 2

#### 9. Ranking e Histórico

- [ ] Contratos tipados + cliente Axios (timeout)
- [ ] MSW (handlers, fixtures, db persistido, funciona no build)
- [ ] TanStack Query: paginação, cache, invalidação, retries, `placeholderData`
- [ ] Registro idempotente (ID da partida gerado no cliente) + fila de pendentes persistida
- [ ] Respostas atrasadas não sobrescrevem dados recentes
- [ ] UI de seleção/reset de cenários de rede

#### 10. Pausa

- [ ] Manual (tecla/botão), automática (blur, `visibilitychange`)
- [ ] Retomada exige ação; sem acúmulo de delta/inputs

#### 11. Playwright (críticos primeiro)

- [ ] Instrumentação: seed, relógio controlado, leitura do estado
- [ ] Options, partida (movimento, disparos, fim por tempo/morte), pausa
- [ ] Ranking/histórico (vazio, erro, paginação, timeout sem duplicação, pendente após refresh)
- [ ] Visual: menu, arena estável, resultado
- [ ] Projetos desktop + mobile (Chromium), relatório HTML, traces em falha

#### 12. Deploy final na Vercel

#### 13. Documentação

- [ ] README.md
- [ ] ARCHITECTURE.md

#### 14. Polishing e performance

- [ ] Medir FPS, p95 do frame time, nº de entidades em partida de 3 min
- [ ] Memória após 5 ciclos iniciar-jogar-sair
- [ ] Evidências em `docs/perf/`

---

## Requisitos extras do README oficial do desafio

Fonte: https://github.com/junglegaming/game-developer-challenge

- [ ] **UI, identificadores de código e documentação em inglês** (este PLANO.md é interno)
- [ ] Ranking compara partidas **com a mesma configuração** + desempate determinístico
- [ ] Cada partida usa um **snapshot da config** ao iniciar; mudanças valem só para novas partidas
- [ ] Recarregar ou sair da tela de combate **encerra** a partida; partida abandonada **não** é registrada
- [ ] Persistir localmente opções **e o resultado da última partida concluída**
- [ ] Testes de combate devem acionar controles reais do jogo (instrumentação só observa estado / controla relógio)
- [ ] Informar estimativa de prazo antes de iniciar (proposta: 2 dias, conforme este plano)
- [ ] Incluir relatórios de testes e de profiling na entrega

## Decisões tomadas

| Data       | Decisão                                                                     | Motivo                                      |
| ---------- | --------------------------------------------------------------------------- | ------------------------------------------- |
| 2026-10-02 | npm como gerenciador                                                        | já instalado, lockfile padrão               |
| 2026-10-02 | Jogador informa apelido na 1ª partida; `playerId` gerado e salvo localmente | identificação legível no ranking            |
| 2026-10-02 | Mobile somente em paisagem, com aviso para girar                            | arena horizontal sem cortes                 |
| 2026-10-02 | CSS puro/CSS Modules + sprites do `ui_sheet`                                | sem dependência extra                       |
| 2026-10-02 | Vitest para lógica pura do jogo + Playwright para E2E                       | feedback rápido nos sistemas                |
| 2026-10-02 | Git local; GitHub MCP será autenticado manualmente depois                   | —                                           |
| 2026-10-02 | PixiJS controlado imperativamente (sem `@pixi/react`)                       | controle total de ciclo de vida/Strict Mode |
| 2026-10-02 | Atlas XML dos navios convertido para JSON do Pixi (`npm run assets:atlas`)  | Pixi não lê formato Starling XML            |
| 2026-10-02 | Bundle do Vite em `dist/static/`                                            | evitar colisão com `public/assets/`         |
| 2026-10-02 | SVG/SWF movidos para `assets-src/vector` (fora do deploy)                   | ~3 MB não usados em runtime                 |
| 2026-10-02 | TypeScript 6: `@types/web` no lugar da lib `dom`                            | recomendação da skill oficial do PixiJS     |

| 2026-10-02 | Game loop com passo fixo 1/60 s + acumulador + limite de delta | determinismo para testes com seed |
| 2026-10-02 | Movimento com inércia: W/↑ acelera, S/↓ freia gradualmente (mesma curva da aceleração) | sensação de barco |
| 2026-10-02 | Teclas: W/↑ avançar, S/↓ frear, A/D ou ←/→ girar, Espaço frontal, Q/E laterais, P/Esc pausa | — |
| 2026-10-02 | Sprites escolhidos por cor (jogador, Chaser, Shooter distintos) | — |
| 2026-10-02 | Tamanho do mundo definido pela tela ao iniciar a partida (com limites mín./máx.) e fixo durante ela; resize só muda a escala | atende "resize sem alterar regras" |

| 2026-10-02 | Playwright no Windows usa GPU (`--use-angle=d3d11`), 2 workers, timeout 60 s | WebGL por software deixava cada ação ~6× mais lenta e estourava timeouts |
| 2026-10-02 | Navios: jogador azul (`ship_5`), Chaser vermelho (`ship_3`), Shooter preto (`ship_2`); dano = +6, +12, +18 no índice | layout do atlas |

| 2026-10-02 | Ilhas: layout fixo, 3 ilhas, união de círculos (quadrado arredondado = 1 central + 4 cantos) | arte quadrada; círculo único deixava os cantos de fora |
| 2026-10-02 | Navio: 3 círculos ao longo do casco (config `player.hull`) | casco alongado; círculo único deixava proa/popa atravessarem |
| 2026-10-02 | Perda de velocidade no impacto = teto `maxSpeed × (1 − componente frontal)` | multiplicar por passo fazia o navio travar ao deslizar |

| 2026-10-02 | Tiros laterais em **K** (esquerda) e **L** (direita); Q/E removidos | pedido do usuário |
| 2026-10-02 | Segurar tiro = automático no cooldown; laterais com cooldown por lado | — |
| 2026-10-02 | Frontal 20 dano/0,4 s; lateral 3×15/1,5 s; bala 420 u/s, 1,2 s, raio 6 (desenhada no tamanho da colisão) | proposta aceita; raio 5→6 por legibilidade |
| 2026-10-02 | Áudio desde já, Web Audio, falhas de áudio nunca bloqueiam o jogo | — |

| 2026-10-02 | Spawn a cada 4 s (limites 1–15 s), 1º spawn aos 2 s, abertura Chaser→Shooter, depois 60% Chaser / 40% Shooter com seed | proposta aceita |
| 2026-10-02 | Máximo 10 inimigos vivos; spawn espera vaga | performance e legibilidade |
| 2026-10-02 | Chaser 40 HP, 170 u/s, 25 de dano no impacto; Shooter 60 HP, 120 u/s, alcance 380, 10 de dano a cada 1,6 s, para a 80% do alcance | proposta aceita |
| 2026-10-02 | Toda aleatoriedade da simulação vem de `createRandom(seed)` (mulberry32) | partidas reproduzíveis em testes |

| 2026-10-02 | Duração padrão 120 s; fim congela a simulação e a pontuação na hora; 1,5 s de encerramento antes do resultado | proposta aceita |
| 2026-10-02 | HUD: vida à esquerda, tempo no centro, pontos à direita junto dos botões; barra sobre o navio do jogador mantida | proposta aceita |
| 2026-10-02 | Aviso de tempo nos últimos 10 s (visual + som); leitor de tela só recebe marcos | `aria-live` com moderação |

| 2026-10-02 | Fundo das telas = `ui_scene_background.png` (em vez de tile animado) | as telas de referência do desafio usam essa arte; continua só CSS, sem Pixi |
| 2026-10-02 | Ranking/Histórico: botões no Menu abrem uma tela com abas | atende a referência (botões) e a escolha por abas |
| 2026-10-02 | Recorde pessoal só compara partidas com o mesmo `configKey` (duração + spawn) | mesma regra do ranking |
| 2026-10-02 | Toque: stick (cima = avançar, baixo = frear, lados = girar) + Fire/Port/Starboard; escondidos de leitores de tela | o teclado continua sendo a entrada acessível |

| 2026-10-02 | Options: steppers, duração passo 10 s, spawn passo 1 s, spawn padrão 3 s (era 4 s) | igual à referência `sample_options.png` |
| 2026-10-02 | Options salvam automaticamente; reset disponível; valores corrompidos reparados por campo | proposta aceita |

Versões: React 19.3, PixiJS 8.22, TypeScript 6.0, Vite 8.3, TanStack Query 5.104, Axios 1.20, MSW 2.15, Playwright 1.63, Vitest 5.0.

## Perguntas em aberto

- Licença dos assets: não há arquivo de licença no repositório do desafio (aparentam ser do Kenney "Pirate Pack", CC0) — confirmar e registrar em `ASSETS.md`.

## Ferramentas instaladas

- Skills (globais): `pixijs*` (oficiais), `tanstack-query`, `msw`, `vercel-react-best-practices`, `deploy-to-vercel`, `playwright-best-practices`, `playwright-cli`
- MCPs: Playwright (disponível), GitKraken/Git (disponível), GitHub (precisa autenticar)
