// Separador Desportos: regista jogos e treinos de qualquer modalidade e mostra o progresso por desporto.
// As sessões são registos normais (tipo "tempo"), por isso contam para pontos, sequência e ranking.
(() => {
    'use strict';
    const { h, field, select, toast } = window.Fit;

    const ui = { sport: window.SPORTS[0].id, member: '', exercise: '', minutes: 60 };

    const dayKey = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
    const sportOf = () => window.SPORTS.find((s) => s.id === ui.sport);
    // Primeiro os exercícios exclusivos do desporto (jogo, treino técnico), depois os partilhados com outros.
const drills = (sportId) => Fit.exercises.filter((e) => e.sports?.includes(sportId)).sort((a, b) => a.sports.length - b.sports.length);
    const fmtMin = (min) => (min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : `${min} ${t('min')}`);

    function ensureMember() {
        if (!Fit.members().some((m) => m.id === ui.member)) ui.member = Fit.me() || Fit.members()[0]?.id || '';
    }

    // Sessões, minutos e pontos de um perfil num desporto (um treino = uma sessão).
    function summary(member, sportId) {
        const ids = new Set(drills(sportId).map((e) => e.id));
        const sessions = new Set();
        const out = { sessions: 0, minutes: 0, points: 0, last: 0 };
        Fit.data().log.forEach((l) => {
            if (l.m !== member || !ids.has(l.e)) return;
            sessions.add(l.sid || `d${dayKey(l.t)}`);
            out.points += Fit.points(l);
            out.last = Math.max(out.last, l.t);
            if (Fit.byId(l.e)?.kind === 'time') out.minutes += (l.sets || [l]).reduce((a, s) => a + (s.min || 0), 0);
        });
        out.sessions = sessions.size;
        return out;
    }

    function picker() {
        return h('div', { class: 'gen-grid' }, window.SPORTS.map((s) => {
            const on = ui.sport === s.id;
            return h('button', {
                type: 'button', class: `gen-tile${on ? ' on' : ''}`, 'aria-pressed': String(on),
                onclick: () => { ui.sport = s.id; ui.exercise = ''; render(); },
            }, h('span', { class: 'gen-emoji' }, s.emoji), s.name);
        }));
    }

    function logForm() {
        const options = drills(ui.sport).filter((e) => e.kind === 'time');
        if (!options.some((e) => e.id === ui.exercise)) ui.exercise = options[0]?.id || '';
        return h('form', {
            class: 'panel',
            onsubmit: (event) => {
                event.preventDefault();
                const f = new FormData(event.target);
                const min = Math.min(600, Math.max(1, Math.round(Number(f.get('min')) || 0)));
                const note = String(f.get('note') || '').trim().slice(0, 300);
                ui.member = f.get('m') || ui.member;
                ui.minutes = min;
                const entry = { e: ui.exercise, sid: Fit.uid(), dur: min, sets: [{ r: 0, kg: 0, min }], ...(note ? { note } : {}) };
                const pts = Fit.points(entry);
                Fit.addLogs(ui.member, [entry]);
                toast(t('Sessão registada! +{total} pontos', { total: pts }));
            },
        },
            h('h2', {}, t('Registar sessão')),
            Fit.members().length > 1 ? field(t('Quem'), select('m', Fit.members().map((m) => [m.id, m.name]), ui.member, (v) => { ui.member = v; render(); })) : null,
            field(t('Atividade'), select('e', options.map((e) => [e.id, e.name]), ui.exercise, (v) => { ui.exercise = v; })),
            field(t('Duração (min)'), h('input', { type: 'number', name: 'min', min: 1, max: 600, value: ui.minutes, inputmode: 'numeric', required: true })),
            field(t('Notas (resultado, sensações…)'), h('input', { name: 'note', maxlength: 300, autocomplete: 'off' })),
            h('button', { type: 'submit' }, t('Registar')));
    }

    function statsPanel() {
        const s = summary(ui.member, ui.sport);
        return h('div', { class: 'panel' }, h('h2', {}, `${sportOf().emoji} ${sportOf().name}`),
            s.sessions
                ? h('div', { class: 'tiles' },
                    h('div', { class: 'tile static' }, h('small', {}, t('Sessões')), h('b', {}, String(s.sessions))),
                    h('div', { class: 'tile static' }, h('small', {}, t('Tempo total')), h('b', {}, s.minutes ? fmtMin(s.minutes) : '—')),
                    h('div', { class: 'tile static' }, h('small', {}, t('Pontos')), h('b', {}, String(s.points))),
                    h('div', { class: 'tile static' }, h('small', {}, t('Última')), h('b', {}, Fit.fmtShort(s.last))))
                : h('p', { class: 'empty' }, t('Ainda sem sessões deste desporto.')));
    }

    function drillList() {
        return h('div', { class: 'panel' }, h('h2', {}, t('Exercícios do desporto')),
            h('ul', { class: 'list' }, drills(ui.sport).map((e) => h('li', {},
                h('div', { class: 'grow' }, h('strong', {}, e.name),
                    h('small', {}, `${t(e.muscle)} · ${t(e.equip)}`),
                    h('small', { class: 'muted' }, window.tipOf(e) || ''))))));
    }

    function programsPanel() {
        const list = window.Programs.list.filter((p) => p.sport === ui.sport);
        if (!list.length) return null;
        return h('div', { class: 'panel' }, h('h2', {}, t('Programa de preparação')),
            list.map((p) => h('p', { class: 'muted' }, `${p.emoji} ${p.name} — ${p.desc}`)),
            h('a', { class: 'btn secondary', href: '#programas' }, t('📋 Programas')));
    }

    function render() {
        const root = document.getElementById('view-sports');
        root.replaceChildren();
        const intro = h('div', { class: 'panel' }, h('h2', {}, t('Desportos')),
            h('p', { class: 'muted small' }, t('Regista jogos e treinos de qualquer desporto. Contam para pontos, sequência e ranking.')),
            picker());
        if (!Fit.members().length) { root.append(intro, Fit.onboarding()); return; }
        ensureMember();
        root.append(...[intro, logForm(), statsPanel(), programsPanel(), drillList()].filter(Boolean));
    }

    document.addEventListener('fit:change', render);
    document.addEventListener('viewchange', (e) => { if (e.detail === 'desportos') render(); });
    render();
})();
