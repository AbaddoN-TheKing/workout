// Ranking da família: pódio, tabela semanal, duelos e comparação entre perfis.
(() => {
    'use strict';
    const { h, field, select } = window.Fit;

    const METRICS = {
        points: { label: t('Pontos'), fmt: (v) => `${v} ${t('pts')}` },
        sessions: { label: t('Treinos'), fmt: (v) => tn(v, '{n} dia', '{n} dias') },
        streak: { label: t('Sequência'), fmt: (v) => `🔥 ${v}` },
        volume: { label: t('Volume'), fmt: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)} t` : `${v} kg`) },
    };
    const PERIODS = [['week', t('7 dias')], ['month', t('30 dias')], ['all', t('Sempre')]];
    const ui = { metric: 'points', period: 'week', cmp: null, exercise: '' };

    const seg = (items, current, onPick) => h('div', { class: 'seg' }, items.map(([v, text]) =>
        h('button', { type: 'button', class: current === v ? 'on' : '', onclick: () => onPick(v) }, text)));

    // ---------- Pódio e lista ----------
    function podium(rows, fmt) {
        const top = rows.slice(0, 3);
        const order = top.length === 2 ? [1, 0] : [1, 0, 2];
        return h('div', { class: `podium n${top.length}` }, order.map((i) => {
            const r = top[i];
            if (!r) return null;
            return h('div', { class: `pod p${i + 1}` },
                i === 0 ? h('span', { class: 'crown' }, '👑') : null,
                Fit.avatar(r.m, i === 0 ? 74 : 58),
                h('strong', {}, r.m.name),
                h('b', { class: 'pv' }, fmt(r.v)),
                h('div', { class: 'step' }, String(i + 1)));
        }));
    }

    function restList(rows, fmt) {
        const max = Math.max(1, ...rows.map((r) => r.v));
        return h('div', { class: 'bars' }, rows.map((r, i) => h('div', { class: 'bar-row' },
            h('span', { class: 'pos' }, String(i + 4)),
            Fit.avatar(r.m, 30),
            h('div', { class: 'grow' }, h('span', { class: 'bar-name' }, r.m.name),
                h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill', style: `width:${(r.v / max) * 100}%;background:${Fit.safeColor(r.m.color)}` }))),
            h('b', {}, fmt(r.v)))));
    }

    function boardPanel() {
        const rows = Fit.leaderboard(ui.metric, ui.period);
        const { fmt } = METRICS[ui.metric];
        const me = Fit.me();
        return h('div', { class: 'panel' },
            h('h2', {}, t('Classificação')),
            seg(Object.entries(METRICS).map(([k, v]) => [k, v.label]), ui.metric, (v) => { ui.metric = v; renderRank(); }),
            ui.metric === 'streak' ? null : seg(PERIODS, ui.period, (v) => { ui.period = v; renderRank(); }),
            me ? h('p', { class: 'lead' }, Fit.rankMessage(me)) : null,
            podium(rows, fmt),
            rows.length > 3 ? restList(rows.slice(3), fmt) : null);
    }

    // ---------- Semana da família ----------
    function weekPanel() {
        const rows = Fit.members().map((m) => ({ m, grid: Fit.weekGrid(m.id) }));
        const today = (new Date().getDay() + 6) % 7;
        return h('div', { class: 'panel' },
            h('h2', {}, t('Semana da família')),
            h('div', { class: 'wk-head' }, h('span', {}), I18n.weekdays('narrow').map((d, i) =>
                h('span', { class: i === today ? 'today' : '' }, d)), h('span', {}, t('Meta'))),
            rows.map(({ m, grid }) => {
                const done = grid.filter(Boolean).length;
                const goal = m.goal || 3;
                return h('div', { class: 'wk-row' },
                    h('div', { class: 'wk-who' }, Fit.avatar(m, 28), h('span', {}, m.name)),
                    grid.map((on) => h('span', { class: `cell${on ? ' on' : ''}`, style: on ? `background:${Fit.safeColor(m.color)}` : '' })),
                    h('b', { class: done >= goal ? 'ok' : '' }, `${done}/${goal}${done >= goal ? ' ✓' : ''}`));
            }));
    }

    // ---------- Duelos ----------
    function duelPanel(team) {
        const rows = team.memberIds.map(Fit.member).filter(Boolean)
            .map((m) => ({ m, v: Fit.stats(m.id, Date.now() - 7 * Fit.dayMs).points })).sort((a, b) => b.v - a.v);
        if (rows.length < 2) return null;
        const total = rows.reduce((sum, r) => sum + r.v, 0);
        const gap = rows[0].v - rows[1].v;
        return h('div', { class: 'panel duel' },
            h('h2', {}, `⚔️ ${team.name}`),
            h('div', { class: 'duel-faces' }, rows.map((r) => h('div', { class: 'face' }, Fit.avatar(r.m, 52), h('strong', {}, r.m.name), h('b', {}, `${r.v} ${t('pts')}`)))),
            h('div', { class: 'split' }, rows.map((r) => h('i', { style: `flex:${total ? r.v : 1};background:${Fit.safeColor(r.m.color)}` }))),
            h('p', { class: 'lead' }, gap === 0 ? t('Empate! Quem treinar a seguir ganha a vantagem.') : t('{name} lidera por {gap} pts esta semana', { name: rows[0].m.name, gap })));
    }

    // ---------- Comparar perfis ----------
    function topExercise() {
        const count = new Map();
        Fit.data().log.forEach((l) => count.set(l.e, (count.get(l.e) || 0) + 1));
        const [id] = [...count.entries()].filter(([e]) => Fit.byId(e)).sort((a, b) => b[1] - a[1])[0] || [];
        return id || Fit.exercises[0].id;
    }

    function comparePanel() {
        const members = Fit.members();
        if (members.length < 2) {
            return h('div', { class: 'panel' }, h('h2', {}, t('Comparar')),
                h('p', { class: 'empty' }, t('Precisas de pelo menos 2 perfis. Importa o perfil de alguém da família em Perfis.')));
        }
        if (!ui.cmp) ui.cmp = new Set(members.slice(0, 4).map((m) => m.id));
        ui.cmp = new Set([...ui.cmp].filter((id) => Fit.member(id)));
        if (!Fit.byId(ui.exercise)) ui.exercise = topExercise();
        const ex = Fit.byId(ui.exercise);
        const metric = Fit.metric(ex.kind);
        const chosen = members.filter((m) => ui.cmp.has(m.id));

        const chips = h('div', { class: 'chips' }, members.map((m) =>
            h('button', {
                type: 'button', class: `chip pick${ui.cmp.has(m.id) ? ' on' : ''}`,
                onclick: () => { ui.cmp.has(m.id) ? ui.cmp.delete(m.id) : ui.cmp.add(m.id); renderRank(); },
            }, Fit.avatar(m, 22), m.name)));

        const series = chosen.map((m) => ({ m, data: Fit.series(m.id, ex.id) }));
        const chart = Fit.multiChart(series.map(({ m, data }) => ({
            name: m.name, color: Fit.safeColor(m.color), points: data.map((p) => ({ t: p.t, v: p.v })),
        })), metric.unit);

        const best = (data) => data.reduce((b, p) => Math.max(b, p.v), 0);
        const maxBest = Math.max(0, ...series.map(({ data }) => best(data)));

        // Quadro geral frente a frente
        const all = chosen.map((m) => ({
            m, pts: Fit.stats(m.id).points, days: Fit.stats(m.id).days, vol: Fit.stats(m.id).volume,
            streak: Fit.streaks(m.id).best, lv: Fit.level(Fit.stats(m.id).points),
        }));
        const rowDefs = [
            [t('Nível'), (r) => r.lv.lv, (r) => `${r.lv.lv}`],
            [t('Pontos'), (r) => r.pts, (r) => `${r.pts}`],
            [t('Dias treinados'), (r) => r.days, (r) => `${r.days}`],
            [t('Melhor sequência'), (r) => r.streak, (r) => `🔥 ${r.streak}`],
            [t('Volume'), (r) => r.vol, (r) => METRICS.volume.fmt(r.vol)],
        ];

        return h('div', { class: 'panel' },
            h('h2', {}, t('Comparar perfis')),
            chips,
            chosen.length ? h('div', { class: 'cmp-wrap' }, h('table', { class: 'cmp' },
                h('thead', {}, h('tr', {}, h('th', {}), chosen.map((m) => h('th', {}, Fit.avatar(m, 30), h('small', {}, m.name))))),
                h('tbody', {}, rowDefs.map(([label, val, text]) => {
                    const top = Math.max(...all.map(val));
                    return h('tr', {}, h('td', {}, label), all.map((r) => h('td', { class: top > 0 && val(r) === top ? 'best' : '' }, text(r))));
                })))) : h('p', { class: 'empty' }, t('Escolhe pelo menos um perfil.')),
            field(t('Exercício'), select('ex', Fit.exercises.map((e) => [e.id, `${e.name} · ${t(e.muscle)}`]), ui.exercise, (v) => { ui.exercise = v; renderRank(); })),
            chosen.length ? chart : null,
            chosen.length ? h('div', { class: 'legend' }, series.map(({ m, data }) => h('span', {},
                h('i', { style: `background:${Fit.safeColor(m.color)}` }),
                `${m.name}: ${data.length ? `${Fit.fmtNum(best(data))} ${metric.unit}${best(data) === maxBest && series.length > 1 ? ' 🏆' : ''}` : '—'}`))) : null,
            h('small', { class: 'muted' }, t('Métrica: {label}', { label: metric.label })));
    }

    function renderRank() {
        const root = document.getElementById('view-rank');
        root.replaceChildren();
        if (!Fit.members().length) { root.append(Fit.onboarding()); return; }
        root.append(...[boardPanel(), weekPanel(), ...Fit.teams().map(duelPanel), comparePanel()].filter(Boolean));
    }

    document.addEventListener('fit:change', renderRank);
    renderRank();
})();
