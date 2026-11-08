// Programas prontos: plano semanal de várias semanas, com progresso por perfil.
(() => {
    'use strict';
    const { h, field, select, toast, confirmDialog } = window.Fit;

    const KEY = 'fit_programs_v1';
    const WEEK = 7 * 864e5;
    const DAYS = I18n.weekdays();
    const x = (e, s, r) => ({ e, s, r }); // série × reps (para tempo: s=1, r=minutos)

    const PROGRAMS = [
        {
            id: 'fb-iniciante', emoji: '🌱', name: t('Full Body Iniciante'), level: t('Iniciante'), weeks: 4,
            desc: t('Vais ao ginásio e não sabes o que fazer? Três treinos de corpo inteiro com máquinas e halteres.'),
            days: {
                0: [x('legpress', 3, 12), x('dbpress', 3, 10), x('latpull', 3, 10), x('dbohp', 3, 10), x('plank', 1, 1)],
                2: [x('goblet', 3, 12), x('pushup', 3, 10), x('seatedrow', 3, 10), x('lateral', 3, 12), x('dbcurl', 2, 12), x('tripush', 2, 12)],
                4: [x('legpress', 3, 12), x('incline', 3, 10), x('dbrow', 3, 10), x('rdl', 3, 10), x('crunch', 3, 15), x('plank', 1, 1)],
            },
        },
        {
            id: 'casa', emoji: '🏠', name: t('Em Casa · Sem Equipamento'), level: t('Iniciante'), weeks: 4,
            desc: t('Transforma a sala num ginásio. Só o peso do corpo, três vezes por semana.'),
            days: {
                0: [x('squat', 3, 15), x('pushup', 3, 10), x('superman', 3, 12), x('lunge', 3, 10), x('plank', 1, 1)],
                2: [x('bridge', 3, 15), x('pike', 3, 8), x('benchdip', 3, 10), x('jumpsquat', 3, 12), x('bicycle', 3, 20), x('wallsit', 1, 1)],
                4: [x('lunge', 3, 12), x('declinepush', 3, 8), x('superman', 3, 15), x('donkey', 3, 15), x('deadbug', 3, 12), x('mountain', 1, 1)],
            },
        },
        {
            id: 'elastico', emoji: '🪢', name: t('Treino com Elástico'), level: t('Iniciante'), weeks: 4,
            desc: t('Leve, portátil e eficaz. Um elástico chega para treinar o corpo todo em casa ou em viagem.'),
            days: {
                0: [x('bandsquat', 3, 15), x('bandpress', 3, 12), x('bandrow', 3, 12), x('bandlateral', 3, 15), x('bandcurl', 3, 12)],
                2: [x('bandwalk', 3, 15), x('bandpull', 3, 12), x('bandtri', 3, 12), x('bandfacepull', 3, 15), x('crunch', 3, 20)],
                4: [x('bandsquat', 3, 20), x('bandpress', 3, 15), x('bandrow', 3, 15), x('bandcurl', 3, 15), x('bandtri', 3, 15), x('plank', 1, 1)],
            },
        },
        {
            id: 'gluteos', emoji: '🍑', name: t('Glúteos em Foco'), level: t('Iniciante'), weeks: 6,
            desc: t('Seis semanas para fortalecer e definir glúteos e pernas, com hip thrust, búlgaros e elástico.'),
            days: {
                0: [x('hipthrust', 4, 10), x('bulgarian', 3, 10), x('rdl', 3, 10), x('donkey', 3, 15), x('bandwalk', 3, 15)],
                2: [x('bridge', 3, 20), x('kbdeadlift', 3, 12), x('stepup', 3, 12), x('plateglute', 3, 12), x('kbswing', 3, 15)],
                5: [x('hipthrust', 4, 12), x('goblet', 3, 12), x('dblunge', 3, 10), x('donkey', 3, 20), x('bandwalk', 3, 20)],
            },
        },
        {
            id: 'ppl', emoji: '💪', name: t('Push · Pull · Legs'), level: t('Intermédio'), weeks: 6,
            desc: t('Empurrar, puxar e pernas: a divisão clássica de hipertrofia em três treinos.'),
            days: {
                0: [x('bench', 4, 8), x('dbohp', 3, 10), x('incline', 3, 10), x('lateral', 3, 12), x('tripush', 3, 12), x('skull', 3, 10)],
                2: [x('deadlift', 3, 5), x('latpull', 4, 10), x('row', 3, 10), x('facepull', 3, 15), x('curl', 3, 10), x('hammer', 3, 12)],
                4: [x('barsquat', 4, 8), x('rdl', 3, 10), x('legpress', 3, 12), x('legcurl', 3, 12), x('calf', 4, 15), x('legraise', 3, 12)],
            },
        },
        {
            id: 'upper-lower', emoji: '⚖️', name: t('Superior / Inferior'), level: t('Intermédio'), weeks: 8,
            desc: t('Quatro treinos por semana, alternando parte superior e inferior, para ganhar força e volume.'),
            days: {
                0: [x('bench', 4, 8), x('row', 4, 8), x('ohp', 3, 10), x('latpull', 3, 10), x('curl', 3, 12), x('tripush', 3, 12)],
                1: [x('barsquat', 4, 8), x('rdl', 3, 10), x('legpress', 3, 12), x('legcurl', 3, 12), x('calf', 4, 15)],
                3: [x('incline', 4, 10), x('dbrow', 4, 10), x('dbohp', 3, 10), x('seatedrow', 3, 12), x('hammer', 3, 12), x('skull', 3, 12)],
                4: [x('goblet', 3, 12), x('hipthrust', 3, 10), x('dblunge', 3, 10), x('legext', 3, 12), x('calf', 4, 15), x('plank', 1, 1)],
            },
        },
        {
            id: 'hiit-abs', emoji: '🔥', name: t('HIIT & Abdominais'), level: t('Intermédio'), weeks: 4,
            desc: t('Sessões intensas para queimar calorias e esculpir o abdómen. Quatro dias de suor.'),
            days: {
                0: [x('burpee', 4, 10), x('jumpingjack', 1, 2), x('mountain', 1, 1), x('bicycle', 3, 20), x('plank', 1, 1)],
                1: [x('highknees', 1, 2), x('jumpsquat', 4, 12), x('crunch', 3, 20), x('legraise', 3, 12), x('sideplank', 1, 1)],
                3: [x('hiit', 1, 15), x('russian', 3, 20), x('deadbug', 3, 12), x('plank', 1, 1)],
                5: [x('rope', 1, 10), x('burpee', 3, 12), x('bicycle', 3, 25), x('sideplank', 1, 1), x('mountain', 1, 2)],
            },
        },
        {
            id: 'core', emoji: '🛡️', name: t('Core de Titã'), level: t('Intermédio'), weeks: 4,
            desc: t('Abdominais, estabilidade e controlo do tronco para melhorar o desempenho e prevenir lesões.'),
            days: {
                0: [x('plank', 1, 1), x('deadbug', 3, 12), x('legraise', 3, 12), x('russian', 3, 20)],
                2: [x('sideplank', 1, 1), x('bicycle', 3, 20), x('crunch', 3, 20), x('woodchop', 3, 12), x('hanglegraise', 3, 10)],
                4: [x('plank', 1, 2), x('mountain', 1, 1), x('deadbug', 3, 15), x('legraise', 3, 15), x('russian', 3, 24)],
            },
        },
        {
            id: 'calistenia', emoji: '🤸', name: t('Calistenia Base'), level: t('Intermédio'), weeks: 6,
            desc: t('Barras, mergulhos e flexões: força relativa com o peso do teu corpo e uma barra fixa.'),
            days: {
                0: [x('pullup', 4, 6), x('dips', 4, 8), x('pushup', 3, 15), x('hanglegraise', 3, 10), x('plank', 1, 1)],
                2: [x('chinup', 4, 6), x('pike', 3, 8), x('declinepush', 3, 10), x('jumpsquat', 3, 15), x('sideplank', 1, 1)],
                4: [x('pullup', 4, 6), x('dips', 4, 8), x('bulgarian', 3, 10), x('burpee', 3, 10), x('hang', 1, 1)],
            },
        },
        {
            id: 'forca-5x5', emoji: '🏆', name: t('Força 5×5'), level: t('Avançado'), weeks: 8,
            desc: t('Clássico de força: poucos exercícios, cargas pesadas e progressão semana a semana.'),
            days: {
                0: [x('barsquat', 5, 5), x('bench', 5, 5), x('row', 5, 5)],
                2: [x('barsquat', 5, 5), x('ohp', 5, 5), x('deadlift', 1, 5)],
                4: [x('barsquat', 5, 5), x('bench', 5, 5), x('row', 5, 5)],
            },
        },
    ];

    // Programas de preparação física por desporto: força + exercícios específicos + um dia de jogo/treino.
    const sportProgram = (sport, emoji, desc, days) => ({
        id: `sport-${sport}`, sport, emoji,
        name: t('Preparação · {sport}', { sport: window.SPORTS.find((s) => s.id === sport).name }),
        level: t('Intermédio'), weeks: 6, desc, days,
    });

    PROGRAMS.push(
        sportProgram('football', '⚽', t('Força, velocidade e agilidade para o futebol, com prevenção de lesões e um dia de jogo.'), {
            0: [x('barsquat', 4, 6), x('rdl', 3, 8), x('nordic', 3, 6), x('calf', 3, 15), x('plank', 1, 1)],
            2: [x('agility', 1, 10), x('sprints', 5, 6), x('dribble', 1, 15), x('shooting', 3, 10), x('sidelunge', 3, 10)],
            5: [x('footmatch', 1, 70)],
        }),
        sportProgram('swimming', '🏊', t('Treino a seco e na piscina para ganhar força de braçada, pernada e resistência.'), {
            0: [x('latpull', 3, 10), x('dbpress', 3, 10), x('shoulderprev', 3, 15), x('hollow', 1, 1), x('plank', 1, 1)],
            2: [x('swimfree', 1, 30), x('swimkick', 1, 10), x('swimsets', 4, 2)],
            4: [x('swimback', 1, 15), x('swimbreast', 1, 15), x('swimpull', 1, 15), x('catcow', 1, 5)],
        }),
        sportProgram('basketball', '🏀', t('Salto, deslocamentos e pontaria: força de pernas, agilidade e um dia de jogo.'), {
            0: [x('barsquat', 4, 6), x('boxjump', 3, 8), x('dbpress', 3, 8), x('row', 3, 8), x('calf', 3, 15)],
            2: [x('defslide', 1, 10), x('agility', 1, 10), x('bbdribble', 1, 15), x('bbshoot', 4, 15), x('layup', 3, 10)],
            5: [x('bbmatch', 1, 60)],
        }),
        sportProgram('handball', '🤾', t('Potência de remate, ombros fortes e resistência para o andebol.'), {
            0: [x('barsquat', 3, 8), x('bench', 4, 6), x('row', 4, 6), x('medball', 3, 10), x('shoulderprev', 3, 15)],
            2: [x('sprints', 5, 6), x('defslide', 1, 10), x('hbpass', 3, 15), x('hbthrow', 4, 10), x('nordic', 3, 6)],
            5: [x('hbmatch', 1, 60)],
        }),
        sportProgram('volleyball', '🏐', t('Impulsão, ataque e ombros protegidos para o voleibol.'), {
            0: [x('frontsquat', 3, 8), x('jumpsquat', 3, 10), x('ohp', 3, 8), x('pullup', 3, 6), x('shoulderprev', 3, 15)],
            2: [x('vbblock', 4, 10), x('boxjump', 3, 8), x('medball', 3, 10), x('vbspike', 4, 10), x('vbserve', 3, 15)],
            5: [x('vbmatch', 1, 60)],
        }),
        sportProgram('tennis', '🎾', t('Rotação, pernas rápidas e ombros fortes para o ténis.'), {
            0: [x('goblet', 3, 10), x('pallof', 3, 12), x('dbrow', 3, 10), x('shoulderprev', 3, 15), x('lunge', 3, 10)],
            2: [x('agility', 1, 10), x('sprints', 5, 6), x('trally', 1, 30), x('tserve', 4, 15)],
            5: [x('tmatch', 1, 60)],
        }),
        sportProgram('padel', '🏓', t('Deslocamentos, core e remate para jogares mais padel sem lesões.'), {
            0: [x('goblet', 3, 10), x('pallof', 3, 12), x('dbrow', 3, 10), x('shoulderprev', 3, 15), x('sidelunge', 3, 10)],
            2: [x('defslide', 1, 10), x('agility', 1, 10), x('pdrill', 1, 30), x('psmash', 4, 15), x('pvolley', 1, 10)],
            5: [x('pmatch', 1, 60)],
        }),
    );

    const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
    let active = read(); // { membroId: { pid, start } }
    const save = () => localStorage.setItem(KEY, JSON.stringify(active));
    const ui = { member: '', open: null };

    const byId = (id) => PROGRAMS.find((p) => p.id === id);
    const dayCount = (p) => Object.keys(p.days).length;
    const name = (id) => Fit.byId(id)?.name || id;
    const label = (it) => (Fit.byId(it.e)?.kind === 'time' ? `${it.r} ${t('min')}` : `${it.s}×${it.r}`);

    function ensureMember() {
        if (!Fit.member(ui.member)) ui.member = Fit.me() || Fit.members()[0]?.id || '';
    }

    async function activate(p) {
        const m = Fit.member(ui.member);
        if (!(await confirmDialog(t('Ativar «{program}» para {name}? O plano semanal atual vai ser substituído.', { program: p.name, name: m.name })))) return;
        window.Plan.importFor(m.id, p.days);
        active[m.id] = { pid: p.id, start: Date.now() };
        save();
        toast(t('{program} ativado! 💪', { program: p.name }));
        render();
    }

    async function stop() {
        const m = Fit.member(ui.member);
        if (!(await confirmDialog(t('Terminar o programa de {name}? O plano semanal mantém-se.', { name: m.name })))) return;
        delete active[m.id];
        save();
        render();
    }

    function activePanel() {
        const st = active[ui.member];
        const p = st && byId(st.pid);
        if (!p) return null;
        const week = Math.floor((Date.now() - st.start) / WEEK) + 1;
        const finished = week > p.weeks;
        const planned = p.weeks * dayCount(p);
        const done = Fit.stats(ui.member, st.start).days;
        const pct = Math.min(1, done / planned);
        const today = window.Plan.exportFor(ui.member)[(new Date().getDay() + 6) % 7] || [];
        return h('div', { class: 'hero' },
            h('div', { class: 'hero-top' },
                h('span', { class: 'prog-emoji' }, p.emoji),
                h('div', { class: 'grow' },
                    h('small', { class: 'kicker' }, t('Programa ativo')),
                    h('div', { class: 'hero-name' }, p.name))),
            h('div', { class: 'xp' }, h('i', { style: `width:${Math.round(pct * 100)}%` })),
            h('div', { class: 'hero-stats' },
                h('div', {}, h('b', {}, finished ? '✓' : `${week}/${p.weeks}`), h('small', {}, t('semana'))),
                h('div', {}, h('b', {}, `${done}/${planned}`), h('small', {}, t('treinos'))),
                h('div', {}, h('b', {}, `${Math.round(pct * 100)}%`), h('small', {}, t('concluído')))),
            finished ? h('p', { class: 'quote' }, t('Programa concluído! 🎉 Escolhe o próximo desafio.')) : null,
            today.length
                ? h('button', { type: 'button', onclick: () => window.Plan.startWith(ui.member, today) }, tn(today.length, 'Treinar hoje · {n} exercício', 'Treinar hoje · {n} exercícios'))
                : h('p', { class: 'quote' }, t('Hoje é dia de descanso. Recupera para o próximo treino 😎')),
            h('button', { type: 'button', class: 'secondary', onclick: stop }, t('Terminar programa')));
    }

    function card(p) {
        const open = ui.open === p.id;
        const isActive = active[ui.member]?.pid === p.id;
        return h('div', { class: `panel prog${open ? ' open' : ''}` },
            h('button', { type: 'button', class: 'ex-head', 'aria-expanded': String(open), onclick: () => { ui.open = open ? null : p.id; render(); } },
                h('span', { class: 'prog-emoji sm' }, p.emoji),
                h('div', { class: 'grow' }, h('strong', {}, p.name),
                    h('small', {}, `${p.level} · ${tn(p.weeks, '{n} semana', '{n} semanas')} · ${t('{n} dias/semana', { n: dayCount(p) })}`)),
                isActive ? h('span', { class: 'badge' }, t('ATIVO')) : null,
                h('span', { class: 'chev' }, open ? '▲' : '▼')),
            open ? h('div', { class: 'ex-detail' },
                h('p', { class: 'tip' }, p.desc),
                Object.keys(p.days).map(Number).sort().map((d) => h('div', { class: 'detail-block' },
                    h('strong', {}, `${DAYS[d]} · ${tn(p.days[d].length, '{n} exercício', '{n} exercícios')}`),
                    h('ul', { class: 'list compact' }, p.days[d].map((it) =>
                        h('li', {}, h('span', { class: 'grow' }, name(it.e)), h('b', {}, label(it))))))),
                h('button', { type: 'button', onclick: () => activate(p) }, isActive ? t('Reiniciar programa') : t('Ativar para {name}', { name: Fit.member(ui.member).name }))) : null);
    }

    function render() {
        const root = document.getElementById('view-programs');
        root.replaceChildren();
        const ids = new Set(Fit.members().map((m) => m.id));
        const stale = Object.keys(active).filter((id) => !ids.has(id));
        if (stale.length) { stale.forEach((id) => delete active[id]); save(); }
        if (!Fit.members().length) { root.append(Fit.onboarding()); return; }
        ensureMember();
        root.append(...[
            h('div', { class: 'panel' },
                h('h2', {}, t('Programas')),
                h('p', { class: 'muted small' }, t('Planos prontos de várias semanas. Ao ativar, o plano semanal do perfil é substituído.')),
                Fit.members().length > 1
                    ? field(t('Perfil'), select('m', Fit.members().map((m) => [m.id, m.name]), ui.member, (v) => { ui.member = v; render(); }))
                    : null),
            activePanel(),
            ...PROGRAMS.map(card),
        ].filter(Boolean));
    }

    window.Programs = { list: PROGRAMS };
    document.addEventListener('fit:change', render);
    render();
})();
