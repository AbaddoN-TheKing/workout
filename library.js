// Biblioteca de exercícios: pesquisa, filtros, dicas, progresso por perfil e criação de exercícios próprios.
(() => {
    'use strict';
    const { h, field, select, toast, confirmDialog } = window.Fit;

    const KIND_LABEL = { reps: t('Repetições'), load: t('Carga'), time: t('Tempo') };
    const ui = { q: '', muscle: 'Todos', equip: 'Todos', sport: 'Todos', open: null, member: '', day: null };

    const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const uniq = (key) => [...new Set(Fit.exercises.map((e) => e[key]))];
    // O que o utilizador escreve (já traduzido) volta à chave canónica guardada nos dados.
    const canon = (key, typed) => uniq(key).find((m) => norm(t(m)) === norm(typed)) ?? typed;

    function ensureMember() {
        if (!Fit.members().some((m) => m.id === ui.member)) ui.member = Fit.me() || Fit.members()[0]?.id || '';
    }

    function filtered() {
        const q = norm(ui.q.trim());
        return Fit.exercises.filter((e) =>
            (ui.muscle === 'Todos' || e.muscle === ui.muscle)
            && (ui.equip === 'Todos' || e.equip === ui.equip)
            && (ui.sport === 'Todos' || e.sports?.includes(ui.sport))
            && (!q || norm(`${e.name} ${t(e.muscle)} ${t(e.equip)}`).includes(q)));
    }

    // ---------- Detalhe ----------
    function progress(ex) {
        if (!Fit.members().length) return null;
        ensureMember();
        const data = Fit.series(ui.member, ex.id);
        const metric = Fit.metric(ex.kind);
        const best = data.reduce((b, p) => (!b || p.v > b.v ? p : b), null);
        const recent = data.slice(-4).reverse();

        return h('div', { class: 'detail-block' },
            Fit.members().length > 1
                ? field(t('Progresso de'), select('m', Fit.members().map((m) => [m.id, m.name]), ui.member, (v) => { ui.member = v; renderList(); }))
                : null,
            data.length
                ? h('div', { class: 'stats' },
                    h('div', {}, h('small', { class: 'muted' }, t('Melhor · {label}', { label: metric.label })), h('b', {}, `${Fit.fmtNum(best.v)} ${metric.unit}`)),
                    h('div', {}, h('small', { class: 'muted' }, t('Sessões')), h('b', {}, String(data.length))))
                : h('p', { class: 'empty' }, t('Ainda sem registos deste exercício.')),
            data.length ? Fit.lineChart(data.map((p) => ({ t: p.t, v: p.v })), metric.unit) : null,
            recent.length ? h('ul', { class: 'list compact' }, recent.map((p) => h('li', {},
                h('span', { class: 'muted' }, Fit.fmtDate(p.t)),
                h('div', { class: 'grow right' }, setsSummary(ex, p.sets))))) : null);
    }

    function setsSummary(ex, sets) {
        if (ex.kind === 'time') return `${sets.reduce((a, s) => a + (s.min || 0), 0)} ${t('min')}`;
        return sets.map((s) => (ex.kind === 'load' ? `${s.kg}×${s.r}` : `${s.r}`)).join(' · ');
    }

    function planForm(ex) {
        if (!Fit.members().length) return h('p', { class: 'empty' }, t('Cria um perfil para adicionar ao plano.'));
        ensureMember();
        if (ui.day == null) ui.day = window.Plan.today();
        const time = ex.kind === 'time';
        return h('form', {
            class: 'detail-block',
            onsubmit: (event) => {
                event.preventDefault();
                const f = new FormData(event.target);
                const s = time ? 1 : Math.max(1, Number(f.get('s')) || 1);
                const r = Math.max(1, Number(f.get('r')) || 1);
                const member = f.get('m') || ui.member;
                ui.member = member;
                ui.day = Number(f.get('d'));
                window.Plan.add(member, ui.day, ex.id, s, r);
                toast(t('Adicionado a {day}', { day: window.Plan.days[ui.day] }));
            },
        },
            h('strong', {}, t('Adicionar ao plano')),
            h('div', { class: 'row' },
                field(t('Perfil'), select('m', Fit.members().map((m) => [m.id, m.name]), ui.member, (v) => { ui.member = v; })),
                field(t('Dia'), select('d', window.Plan.days.map((d, i) => [String(i), d]), String(ui.day), (v) => { ui.day = Number(v); }))),
            h('div', { class: 'row' },
                time ? null : field(t('Séries'), h('input', { type: 'number', name: 's', min: 1, value: 3, inputmode: 'numeric' })),
                field(time ? t('Minutos') : t('Reps'), h('input', { type: 'number', name: 'r', min: 1, value: time ? 20 : 10, inputmode: 'numeric' }))),
            h('button', { type: 'submit' }, t('Adicionar')));
    }

    function detail(ex) {
        const tip = window.tipOf(ex) || ex.note;
        return h('div', { class: 'ex-detail' },
            tip ? h('p', { class: 'tip' }, tip) : null,
            progress(ex),
            planForm(ex),
            ex.custom ? h('button', {
                type: 'button', class: 'secondary danger',
                onclick: async () => {
                    if (!(await confirmDialog(t('Apagar este exercício, o seu histórico e retirá-lo dos planos?')))) return;
                    ui.open = null;
                    Fit.removeExercise(ex.id);
                },
            }, t('Apagar exercício')) : null);
    }

    // ---------- Lista ----------
    function renderList() {
        const box = document.getElementById('libList');
        if (!box) return;
        box.replaceChildren();
        const items = filtered();
        box.append(h('small', { class: 'muted' }, tn(items.length, '{n} exercício', '{n} exercícios')));
        if (!items.length) { box.append(h('p', { class: 'empty' }, t('Nada encontrado.'))); return; }

        items.forEach((ex) => {
            const open = ui.open === ex.id;
            box.append(h('div', { class: `panel ex${open ? ' open' : ''}` },
                h('button', {
                    type: 'button', class: 'ex-head', 'aria-expanded': String(open),
                    onclick: () => { ui.open = open ? null : ex.id; renderList(); },
                },
                    h('div', { class: 'grow' }, h('strong', {}, ex.name),
                        h('small', {}, `${t(ex.muscle)} · ${t(ex.equip)}`)),
                    h('span', { class: 'badge' }, KIND_LABEL[ex.kind]),
                    h('span', { class: 'chev' }, open ? '▲' : '▼')),
                open ? detail(ex) : null));
        });
    }

    // ---------- Criar exercício ----------
    function createForm() {
        return h('details', { class: 'panel' },
            h('summary', {}, t('＋ Criar exercício')),
            h('form', {
                class: 'create-form',
                onsubmit: (event) => {
                    event.preventDefault();
                    const f = new FormData(event.target);
                    const ex = Fit.addExercise({
                        name: f.get('name'), muscle: canon('muscle', f.get('muscle')), equip: canon('equip', f.get('equip')), kind: f.get('kind'), note: f.get('note'),
                    });
                    if (ex) { ui.open = ex.id; ui.q = ''; ui.muscle = 'Todos'; ui.equip = 'Todos'; toast(t('Exercício criado!')); renderLibrary(); }
                },
            },
                field(t('Nome'), h('input', { name: 'name', required: true, maxlength: 40, autocomplete: 'off' })),
                h('div', { class: 'row' },
                    field(t('Músculo'), h('input', { name: 'muscle', list: 'libMuscles', maxlength: 24, placeholder: t('Ex: Peito') })),
                    field(t('Equipamento'), h('input', { name: 'equip', list: 'libEquip', maxlength: 24, placeholder: t('Ex: Halteres') }))),
                h('datalist', { id: 'libMuscles' }, uniq('muscle').map((m) => h('option', { value: t(m) }))),
                h('datalist', { id: 'libEquip' }, uniq('equip').map((m) => h('option', { value: t(m) }))),
                field(t('Tipo'), select('kind', [['reps', t('Repetições (peso corporal)')], ['load', t('Carga (kg × reps)')], ['time', t('Tempo (min)')]], 'load', () => {})),
                field(t('Dica (opcional)'), h('textarea', { name: 'note', rows: 2, maxlength: 300 })),
                h('button', { type: 'submit' }, t('Criar'))));
    }

    function renderLibrary() {
        const root = document.getElementById('view-library');
        root.replaceChildren();
        if (!Fit.exercises.some((e) => e.muscle === ui.muscle)) ui.muscle = 'Todos';
        if (!Fit.exercises.some((e) => e.equip === ui.equip)) ui.equip = 'Todos';
        if (ui.sport !== 'Todos' && !window.SPORTS.some((s) => s.id === ui.sport)) ui.sport = 'Todos';

        root.append(
            h('div', { class: 'panel' },
                h('input', {
                    type: 'search', class: 'search', placeholder: t('Pesquisar exercício…'), value: ui.q, 'aria-label': t('Pesquisar'),
                    oninput: (e) => { ui.q = e.target.value; renderList(); },
                }),
                h('div', { class: 'row' },
                    field(t('Músculo'), select('muscle', [['Todos', t('Todos')], ...uniq('muscle').map((m) => [m, t(m)])], ui.muscle, (v) => { ui.muscle = v; renderList(); })),
                    field(t('Equipamento'), select('equip', [['Todos', t('Todos')], ...uniq('equip').map((m) => [m, t(m)])], ui.equip, (v) => { ui.equip = v; renderList(); }))),
                field(t('Desporto'), select('sport', [['Todos', t('Todos')], ...window.SPORTS.map((s) => [s.id, `${s.emoji} ${s.name}`])], ui.sport, (v) => { ui.sport = v; renderList(); }))),
            createForm(),
            h('div', { id: 'libList', class: 'lib-list' }));
        renderList();
    }

    document.addEventListener('fit:change', renderLibrary);
    renderLibrary();
})();
