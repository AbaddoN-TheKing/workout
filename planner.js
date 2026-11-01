// Plano semanal + sessão de treino (séries com peso/reps e descanso).
(() => {
    'use strict';
    const { h, field, select, toast, confirmDialog } = window.Fit;

    const PLAN_KEY = 'fit_plan_v1';
    const SESSION_KEY = 'fit_session_v1';
    const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const REST_SECONDS = 90;

    const read = (key, fallback) => {
        try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
    };
    const todayIdx = () => (new Date().getDay() + 6) % 7;

    let plans = read(PLAN_KEY, {});      // { membroId: { diaIdx: [{ e, s, r }] } }
    let session = read(SESSION_KEY, null); // { m, items: [{ e, sets: [{ kg, r, min, done }] }] }
    const ui = { member: '', day: todayIdx(), muscle: 'Todos' };

    const savePlans = () => localStorage.setItem(PLAN_KEY, JSON.stringify(plans));
    const saveSession = () => (session
        ? localStorage.setItem(SESSION_KEY, JSON.stringify(session))
        : localStorage.removeItem(SESSION_KEY));

    const exercise = (id) => Fit.byId(id);
    const planLabel = (p) => (exercise(p.e)?.kind === 'time' ? `${p.r} min` : `${p.s}×${p.r}`);
    const memberOptions = () => Fit.members().map((m) => [m.id, m.name]);

    function ensureMember() {
        if (!Fit.members().some((m) => m.id === ui.member)) ui.member = Fit.members()[0]?.id ?? '';
    }

    const noMembers = () => h('p', { class: 'empty' }, 'Cria primeiro um perfil no separador Perfis.');
    const numInput = (name, value) => h('input', { type: 'number', name, min: 1, value, inputmode: 'numeric' });

    // ---------- Plano semanal ----------
    function renderPlan() {
        const root = document.getElementById('view-plan');
        root.replaceChildren();
        if (!Fit.members().length) { root.append(noMembers()); return; }
        ensureMember();

        const days = (plans[ui.member] ||= {});
        const list = (days[ui.day] ||= []);
        const muscles = ['Todos', ...new Set(Fit.exercises.map((e) => e.muscle))];
        const pool = Fit.exercises.filter((e) => ui.muscle === 'Todos' || e.muscle === ui.muscle);

        const dayButtons = DAYS.map((d, i) => h('button', {
            type: 'button',
            class: `${ui.day === i ? 'on' : ''} ${(days[i] || []).length ? 'has' : ''}`,
            onclick: () => { ui.day = i; renderPlan(); },
        }, d));

        const items = list.map((p, i) => h('li', {},
            h('div', { class: 'grow' }, h('strong', {}, exercise(p.e)?.name ?? p.e), h('small', {}, planLabel(p))),
            h('button', {
                type: 'button', class: 'btn-x', 'aria-label': 'Remover',
                onclick: () => { list.splice(i, 1); savePlans(); renderPlan(); },
            }, '×')));

        root.append(
            h('div', { class: 'panel' },
                field('Plano de', select('m', memberOptions(), ui.member, (v) => { ui.member = v; renderPlan(); })),
                h('div', { class: 'seg days' }, dayButtons)),
            h('div', { class: 'panel' }, h('h2', {}, `Treino de ${DAYS[ui.day]}`),
                items.length ? h('ul', { class: 'list' }, items) : h('p', { class: 'empty' }, 'Dia de descanso. Adiciona exercícios abaixo.')),
            h('form', { class: 'panel', onsubmit: onAddPlan },
                h('h2', {}, 'Adicionar ao dia'),
                field('Músculo', select('muscle', muscles.map((x) => [x, x]), ui.muscle, (v) => { ui.muscle = v; renderPlan(); })),
                field('Exercício', select('e', pool.map((e) => [e.id, `${e.name} · ${e.equip}`]), pool[0].id, () => {})),
                h('div', { class: 'row' }, field('Séries', numInput('s', 3)), field('Reps / min', numInput('r', 10))),
                h('button', { type: 'submit' }, 'Adicionar')));
    }

    function onAddPlan(event) {
        event.preventDefault();
        const f = new FormData(event.target);
        const ex = exercise(f.get('e'));
        if (!ex) return;
        const s = ex.kind === 'time' ? 1 : Math.max(1, Number(f.get('s')) || 1);
        const r = Math.max(1, Number(f.get('r')) || 1);
        plans[ui.member][ui.day].push({ e: ex.id, s, r });
        savePlans();
        renderPlan();
    }

    // ---------- Descanso (sem setInterval: usa requestAnimationFrame) ----------
    let restEnd = 0;
    let raf = 0;

    function tickRest() {
        const el = document.getElementById('restClock');
        const left = Math.ceil((restEnd - Date.now()) / 1000);
        if (el) el.textContent = left > 0 ? `⏱ Descanso ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : '';
        if (left > 0) { raf = requestAnimationFrame(tickRest); return; }
        if (restEnd) { restEnd = 0; navigator.vibrate?.(300); }
    }

    function startRest() {
        restEnd = Date.now() + REST_SECONDS * 1000;
        cancelAnimationFrame(raf);
        tickRest();
    }

    // ---------- Sessão ----------
    function newItem(member, id, count, target) {
        const ex = exercise(id);
        const last = Fit.lastSet(member, id);
        const make = () => (ex.kind === 'time' ? { min: target, done: false } : { kg: last?.kg ?? 0, r: target, done: false });
        return { e: id, sets: Array.from({ length: ex.kind === 'time' ? 1 : count }, make) };
    }

    function startSession(plan) {
        session = { m: ui.member, items: plan.map((p) => newItem(ui.member, p.e, p.s, p.r)) };
        saveSession();
        renderSession();
    }

    async function cancelSession() {
        if (!(await confirmDialog('Cancelar este treino sem guardar?'))) return;
        session = null;
        saveSession();
        renderSession();
    }

    function finishSession() {
        const entries = session.items
            .map((item) => ({
                e: item.e,
                sets: item.sets.filter((s) => s.done).map((s) => ({ r: s.r || 0, kg: s.kg || 0, min: s.min || 0 })),
            }))
            .filter((entry) => entry.sets.length);
        if (!entries.length) { toast('Marca pelo menos uma série como feita (✓).'); return; }
        const total = entries.reduce((sum, entry) => sum + Fit.points(entry), 0);
        Fit.addLogs(session.m, entries);
        session = null;
        saveSession();
        toast(`Treino guardado! +${total} pontos`);
        renderSession();
    }

    const setInput = (set, key, placeholder) => h('input', {
        type: 'number', min: 0, step: 'any', inputmode: 'decimal', placeholder,
        'aria-label': placeholder, value: set[key] ?? 0,
        oninput: (e) => { set[key] = Math.max(0, Number(e.target.value) || 0); saveSession(); },
    });

    function setRow(ex, set, index) {
        return h('div', { class: `set${set.done ? ' done' : ''}` },
            h('span', { class: 'set-n' }, index + 1),
            ex.kind === 'time'
                ? setInput(set, 'min', 'min')
                : [ex.kind === 'load' ? setInput(set, 'kg', 'kg') : null, setInput(set, 'r', 'reps')],
            h('button', {
                type: 'button', class: 'btn-ok', 'aria-label': 'Concluir série',
                onclick: () => { set.done = !set.done; saveSession(); if (set.done) startRest(); renderSession(); },
            }, '✓'));
    }

    function itemPanel(item) {
        const ex = exercise(item.e);
        return h('div', { class: 'panel' },
            h('div', { class: 'row between' },
                h('div', {}, h('h2', {}, ex.name), h('small', { class: 'muted' }, `${ex.muscle} · ${ex.equip}`)),
                h('button', {
                    type: 'button', class: 'btn-x', 'aria-label': 'Remover exercício',
                    onclick: () => { session.items = session.items.filter((i) => i !== item); saveSession(); renderSession(); },
                }, '×')),
            item.sets.map((s, i) => setRow(ex, s, i)),
            h('button', {
                type: 'button', class: 'secondary',
                onclick: () => { item.sets.push({ ...item.sets.at(-1), done: false }); saveSession(); renderSession(); },
            }, '+ Série'));
    }

    function addExercisePanel() {
        let pick = Fit.exercises[0].id;
        return h('div', { class: 'panel' }, h('h2', {}, 'Adicionar exercício'),
            select('e', Fit.exercises.map((e) => [e.id, `${e.name} (${e.muscle})`]), pick, (v) => { pick = v; }),
            h('button', {
                type: 'button', class: 'secondary',
                onclick: () => {
                    const isTime = exercise(pick).kind === 'time';
                    session.items.push(newItem(session.m, pick, 3, isTime ? 20 : 10));
                    saveSession();
                    renderSession();
                },
            }, 'Adicionar'));
    }

    function startPanel() {
        const plan = plans[ui.member]?.[todayIdx()] ?? [];
        return h('div', { class: 'panel' },
            h('h2', {}, `Treinar · ${DAYS[todayIdx()]}`),
            field('Quem', select('m', memberOptions(), ui.member, (v) => { ui.member = v; renderSession(); })),
            plan.length
                ? h('ul', { class: 'list' }, plan.map((p) => h('li', {},
                    h('div', { class: 'grow' }, exercise(p.e)?.name ?? p.e, h('small', {}, planLabel(p))))))
                : h('p', { class: 'empty' }, 'Sem plano para hoje. Cria-o no separador Plano ou começa um treino livre.'),
            h('button', { type: 'button', onclick: () => startSession(plan) }, plan.length ? 'Começar treino' : 'Treino livre'));
    }

    function renderSession() {
        const root = document.getElementById('sessionBox');
        root.replaceChildren();
        if (!Fit.members().length) { root.append(noMembers()); return; }
        ensureMember();
        if (!session || !Fit.members().some((m) => m.id === session.m)) { session = null; root.append(startPanel()); return; }

        const name = Fit.members().find((m) => m.id === session.m).name;
        root.append(
            h('div', { class: 'panel' }, h('h2', {}, `Treino de ${name}`), h('p', { class: 'rest', id: 'restClock' })),
            session.items.map(itemPanel),
            addExercisePanel(),
            h('div', { class: 'row' },
                h('button', { type: 'button', class: 'secondary', onclick: cancelSession }, 'Cancelar'),
                h('button', { type: 'button', onclick: finishSession }, 'Terminar')));
        if (restEnd) tickRest();
    }

    function renderAll() {
        renderSession();
        renderPlan();
    }

    document.addEventListener('fit:change', renderAll);
    renderAll();
})();
