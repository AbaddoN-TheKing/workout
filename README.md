# Fit Crew 💪

Treina. Compete. Evolui. App de treino em família (PWA, sem servidor, funciona offline).

**Demo:** https://abaddon-theking.github.io/workout/

## O que tem
- **Treinar** – início motivacional (sequência, meta semanal, nível), treino guiado com séries/peso/reps, descanso, cronómetro, notas e deteção de recordes.
- **Plano** – plano semanal por perfil: editar séries/reps, reordenar, copiar dias.
- **Ranking** – pódio (pontos, treinos, sequência, volume), semana da família, duelos e comparação entre perfis.
- **Perfis** – foto, nível, conquistas e meta semanal; **partilhar/importar perfis** por ficheiro ou código.
- **Mais**
  - 🎲 **Gerar treino** – equipamento → músculos → treino à medida (trocar exercícios, começar já ou guardar no plano).
  - 🏅 **Desportos** – futebol, natação, basquetebol, andebol, voleibol, ténis e padel: regista jogos e treinos (contam para pontos, sequência e ranking), vê estatísticas por desporto e exercícios específicos.
  - 🧪 **Suplementos** – proteína, creatina, pré-treino, aminoácidos, ómega-3, vitaminas e cafeína: dose, unidade, hora(s) e dias; marcação diária das tomas, proteína e cafeína do dia e resumo da semana.
  - 📋 **Programas** – 17 programas prontos (full body, casa, elástico, glúteos, PPL, superior/inferior, HIIT, core, calistenia, 5×5 e 7 de preparação por desporto) com progresso por semana.
  - 📊 **Estatísticas** – tempo, volume, treinos por semana, calendário de atividade, músculos trabalhados e recordes.
  - 🧮 **Ferramentas** – calorias e macros, 1RM, discos da barra, zonas de FC, IMC e hidratação.
  - 📚 **Exercícios** – 179 exercícios (musculação, funcional, mobilidade e desportos) com dicas e evolução; filtra por músculo, equipamento ou desporto e cria os teus.
  - 📏 **Medidas** – peso, gordura e perímetros com gráficos.
  - 🔳 **QR Basic-Fit** – gerador de QR de acesso (da versão original).

## Competir em família
1. Cada pessoa cria o seu perfil no telemóvel e treina.
2. Em **Perfis → Partilhar** (ficheiro) ou **Código** (texto), envia o perfil por mensagem.
3. Quem recebe vai a **Perfis → Importar** (ficheiro ou colar código). O perfil aparece no ranking.
4. Para atualizar, volta a enviar/importar: só entram os treinos novos.

Os dados ficam apenas no dispositivo (`localStorage`). Usa **Exportar todos** como cópia de segurança.

## Idiomas
PT, PT-BR, EN, FR, ES, ES-MX, RO, PL, HU e TR — escolhe no seletor do cabeçalho (por omissão segue o idioma do navegador).

- O texto-fonte é o português de Portugal: o código usa `t('Treinar')` e `tn(n, '{n} treino', '{n} treinos')` para plurais.
- `i18n/ui.js` (interface), `i18n/exercises.js` (nomes por id) e `i18n/tips.js` (dicas por id). Cada linha é `[chave, en, fr, es, ro, pl, hu, tr]`.
- `i18n/variants.js` só guarda as diferenças de pt-BR e es-MX.
- As dicas de RO, PL, HU e TR ainda aparecem em inglês: acrescenta colunas em `i18n/tips.js`.
- `node scripts/check-i18n.mjs` verifica se todos os textos e exercícios têm tradução em todos os idiomas (`--list` imprime as chaves).

## Notas
- Sem backend: nada sai do teu telemóvel a não ser o que partilhas.
- Código em JS puro (sem build). Basta publicar a pasta (GitHub Pages).

**v4.0 «Crew»** · feito por -AbaddoN-

Base de ideias e inspiração: [workout.cool](https://github.com/Snouzy/workout-cool) (MIT).
