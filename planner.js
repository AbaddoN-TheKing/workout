// Plano semanal + sessão de treino (séries com peso/reps, descanso, cronómetro e recordes).
(() => {
    'use strict';
    const { h, field, select, toast, confirmDialog } = window.Fit;

    const PLAN_KEY = 'fit_plan_v1';
    const SESSION_KEY = 'fit_session_v1';
    const REST_KEY = 'fit_rest_v1';
    const DAYS = I18n.weekdays();
    const REST_OPTIONS = [30, 45, 60, 90, 120, 180];

    const read = (key, fallback) => {
        try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
    };
    const todayIdx = () => (new Date().getDay() + 6) % 7;

    let plans = read(PLAN_KEY, {});        // { membroId: { diaIdx: [{ e, s, r }] } }
    let session = read(SESSION_KEY, null); // { m, start, note, items: [{ e, sets: [{ kg, r, min, done }] }] }
    let restSeconds = REST_OPTIONS.includes(read(REST_KEY, 90)) ? read(REST_KEY, 90) : 90;
    const ui = { member: '', day: todayIdx(), muscle: 'Todos', copyTo: null };

    const savePlans = () => localStorage.setItem(PLAN_KEY, JSON.stringify(plans));
    const saveSession = () => (session
        ? localStorage.setItem(SESSION_KEY, JSON.stringify(session))
        : localStorage.removeItem(SESSION_KEY));

    const exercise = (id) => Fit.byId(id);
    const planLabel = (p) => (exercise(p.e)?.kind === 'time' ? `${p.r} ${t('min')}` : `${p.s}×${p.r}`);
    const memberOptions = () => Fit.members().map((m) => [m.id, m.name]);
    const clock = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

    function ensureMember() {
        if (!Fit.members().some((m) => m.id === ui.member)) ui.member = Fit.me() || Fit.members()[0]?.id || '';
    }

    const noMembers = () => Fit.onboarding();
    const numInput = (name, value) => h('input', { type: 'number', name, min: 1, value, inputmode: 'numeric' });

    // ---------- Plano semanal ----------
    function miniField(label, plan, key) {
        return h('label', { class: 'mini-fld' }, h('span', {}, label),
            h('input', {
                type: 'number', min: 1, inputmode: 'numeric', value: plan[key],
                oninput: (e) => { plan[key] = Math.max(1, Math.round(Number(e.target.value)) || 1); savePlans(); },
            }));
    }

    function renderPlan() {
        const root = document.getElementById('view-plan');
        root.replaceChildren();
        if (!Fit.members().length) { root.append(noMembers()); return; }
        ensureMember();

        const days = (plans[ui.member] ||= {});
        const list = (days[ui.day] ||= []);
        const muscles = ['Todos', ...new Set(Fit.exercises.map((e) => e.muscle))];
        if (!muscles.includes(ui.muscle)) ui.muscle = 'Todos';
        const pool = Fit.exercises.filter((e) => ui.muscle === 'Todos' || e.muscle === ui.muscle);
        if (ui.copyTo == null || ui.copyTo === ui.day) ui.copyTo = (ui.day + 1) % 7;

        const dayButtons = DAYS.map((d, i) => h('button', {
            type: 'button',
            class: `${ui.day === i ? 'on' : ''} ${(days[i] || []).length ? 'has' : ''}`,
            onclick: () => { ui.day = i; renderPlan(); },
        }, d));

        const move = (i, dir) => {
            const j = i + dir;
            if (j < 0 || j >= list.length) return;
            [list[i], list[j]] = [list[j], list[i]];
            savePlans();
            renderPlan();
        };

        const items = list.map((p, i) => {
            const ex = exercise(p.e);
            if (!ex) return null;
            return h('li', { class: 'plan-item' },
                h('div', { class: 'grow' },
                    h('strong', {}, ex.name), h('small', {}, `${t(ex.muscle)} · ${t(ex.equip)}`),
                    h('div', { class: 'row mini' },
                        ex.kind === 'time' ? null : miniField(t('Séries'), p, 's'),
                        miniField(ex.kind === 'time' ? t('Min') : t('Reps'), p, 'r'))),
                h('div', { class: 'col-btns' },
                    h('button', { type: 'button', class: 'btn-x', 'aria-label': t('Subir'), onclick: () => move(i, -1) }, '▲'),
                    h('button', { type: 'button', class: 'btn-x', 'aria-label': t('Descer'), onclick: () => move(i, 1) }, '▼')),
                h('button', {
                    type: 'button', class: 'btn-x', 'aria-label': t('Remover'),
                    onclick: () => { list.splice(i, 1); savePlans(); renderAll(); },
                }, '×'));
        }).filter(Boolean);

        const copyOptions = DAYS.map((d, i) => [String(i), d]).filter(([v]) => Number(v) !== ui.day);

        root.append(
            h('div', { class: 'panel' },
                field(t('Plano de'), select('m', memberOptions(), ui.member, (v) => { ui.member = v; renderPlan(); })),
                h('div', { class: 'seg days' }, dayButtons)),
            h('div', { class: 'panel' }, h('h2', {}, t('Treino de {day}', { day: DAYS[ui.day] })),
                items.length ? h('ul', { class: 'list' }, items) : h('p', { class: 'empty' }, t('Dia de descanso. Adiciona exercícios abaixo.')),
                items.length ? h('div', { class: 'row center' },
                    select('copyTo', copyOptions, String(ui.copyTo), (v) => { ui.copyTo = Number(v); }),
                    h('button', { type: 'button', class: 'secondary', onclick: copyDay }, t('Copiar')),
                    h('button', { type: 'button', class: 'secondary', onclick: clearDay }, t('Limpar'))) : null),
            h('form', { class: 'panel', onsubmit: onAddPlan },
                h('h2', {}, t('Adicionar ao dia')),
                field(t('Músculo'), select('muscle', muscles.map((x) => [x, t(x)]), ui.muscle, (v) => { ui.muscle = v; renderPlan(); })),
                field(t('Exercício'), select('e', pool.map((e) => [e.id, `${e.name} · ${t(e.equip)}`]), pool[0].id, () => {})),
                h('div', { class: 'row' }, field(t('Séries'), numInput('s', 3)), field(t('Reps / min'), numInput('r', 10))),
                h('button', { type: 'submit' }, t('Adicionar'))));
    }

    async function copyDay() {
        const src = plans[ui.member][ui.day];
        const dst = plans[ui.member][ui.copyTo] || [];
        if (dst.length && !(await confirmDialog(t('Substituir o treino de {day}?', { day: DAYS[ui.copyTo] })))) return;
        plans[ui.member][ui.copyTo] = src.map((p) => ({ ...p }));
        savePlans();
        toast(t('Copiado para {day}', { day: DAYS[ui.copyTo] }));
        renderAll();
    }

    async function clearDay() {
        if (!(await confirmDialog(t('Limpar o treino de {day}?', { day: DAYS[ui.day] })))) return;
        plans[ui.member][ui.day] = [];
        savePlans();
        renderAll();
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
        renderAll();
    }

    // ---------- Relógios (descanso + duração) sem setInterval ----------
    let restEnd = 0;
    let timer = 0;

    function loop() {
        timer = 0;
        const sc = document.getElementById('sessionClock');
        if (sc && session) {
            const text = `⏱ ${clock(Math.floor((Date.now() - session.start) / 1000))}`;
            if (sc.textContent !== text) sc.textContent = text;
        }
        const rc = document.getElementById('restClock');
        const left = Math.ceil((restEnd - Date.now()) / 1000);
        if (left > 0) {
            const text = `${t('Descanso')} ${clock(left)}`;
            if (rc && rc.textContent !== text) rc.textContent = text;
        } else {
            if (rc) rc.textContent = '';
            if (restEnd) { restEnd = 0; navigator.vibrate?.(300); }
        }
        if (session || restEnd) timer = setTimeout(loop, 250);
    }

    const kick = () => { if (!timer) timer = setTimeout(loop, 0); };

    function startRest() {
        restEnd = Date.now() + restSeconds * 1000;
        kick();
    }

    // ---------- Sessão ----------
    function newItem(member, id, count, target) {
        const ex = exercise(id);
        const last = Fit.lastSet(member, id);
        const make = () => (ex.kind === 'time' ? { min: target, done: false } : { kg: last?.kg ?? 0, r: target, done: false });
        return { e: id, sets: Array.from({ length: ex.kind === 'time' ? 1 : count }, make) };
    }

    function startSession(plan) {
        const valid = plan.filter((p) => exercise(p.e));
        session = { m: ui.member, start: Date.now(), note: '', items: valid.map((p) => newItem(ui.member, p.e, p.s, p.r)) };
        saveSession();
        renderSession();
    }

    async function cancelSession() {
        if (!(await confirmDialog(t('Cancelar este treino sem guardar?')))) return;
        session = null;
        restEnd = 0;
        saveSession();
        renderSession();
    }

    function finishSession() {
        const done = session.items
            .map((item) => ({
                e: item.e,
                sets: item.sets.filter((s) => s.done).map((s) => ({ r: s.r || 0, kg: s.kg || 0, min: s.min || 0 })),
            }))
            .filter((entry) => entry.sets.length);
        if (!done.length) { toast(t('Marca pelo menos uma série como feita (✓).')); return; }

        // Recordes: comparar com o histórico antes de guardar
        const records = done.filter((entry) => {
            const prev = Fit.best(session.m, entry.e);
            return prev && Fit.valueOf(exercise(entry.e), entry.sets) > prev.v;
        }).map((entry) => exercise(entry.e).name);

        const sid = Fit.uid();
        const dur = Math.max(1, Math.round((Date.now() - session.start) / 60000));
        const note = (session.note || '').trim().slice(0, 300);
        const entries = done.map((entry) => ({ ...entry, sid, dur, ...(note ? { note } : {}) }));
        const total = entries.reduce((sum, entry) => sum + Fit.points(entry), 0);

        Fit.addLogs(session.m, entries);
        session = null;
        restEnd = 0;
        saveSession();
        toast(records.length
            ? t('🏆 Recorde: {names} · +{total} pts', { names: `${records.slice(0, 2).join(', ')}${records.length > 2 ? '…' : ''}`, total })
            : t('Treino guardado! +{total} pontos', { total }));
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
                ? setInput(set, 'min', t('min'))
                : [ex.kind === 'load' ? setInput(set, 'kg', 'kg') : null, setInput(set, 'r', t('reps'))],
            h('button', {
                type: 'button', class: 'btn-ok', 'aria-label': t('Concluir série'),
                onclick: () => { set.done = !set.done; saveSession(); if (set.done) startRest(); renderSession(); },
            }, '✓'));
    }

    function lastHint(ex) {
        const last = Fit.lastSet(session.m, ex.id);
        if (!last) return null;
        if (ex.kind === 'time') return t('Última vez: {v}', { v: `${last.min} ${t('min')}` });
        return t('Última vez: {v}', { v: `${ex.kind === 'load' ? `${last.kg} kg × ` : ''}${last.r}${ex.kind === 'load' ? '' : ` ${t('reps')}`}` });
    }

    function itemPanel(item) {
        const ex = exercise(item.e);
        return h('div', { class: 'panel' },
            h('div', { class: 'row between' },
                h('div', {}, h('h2', {}, ex.name), h('small', { class: 'muted' }, `${t(ex.muscle)} · ${t(ex.equip)}`),
                    lastHint(ex) ? h('small', { class: 'muted hint' }, lastHint(ex)) : null),
                h('button', {
                    type: 'button', class: 'btn-x', 'aria-label': t('Remover exercício'),
                    onclick: () => { session.items = session.items.filter((i) => i !== item); saveSession(); renderSession(); },
                }, '×')),
            item.sets.map((s, i) => setRow(ex, s, i)),
            h('button', {
                type: 'button', class: 'secondary',
                onclick: () => { item.sets.push({ ...item.sets.at(-1), done: false }); saveSession(); renderSession(); },
            }, t('+ Série')));
    }

    function addExercisePanel() {
        let pick = Fit.exercises[0].id;
        return h('div', { class: 'panel' }, h('h2', {}, t('Adicionar exercício')),
            select('e', Fit.exercises.map((e) => [e.id, `${e.name} (${t(e.muscle)})`]), pick, (v) => { pick = v; }),
            h('button', {
                type: 'button', class: 'secondary',
                onclick: () => {
                    const isTime = exercise(pick).kind === 'time';
                    session.items.push(newItem(session.m, pick, 3, isTime ? 20 : 10));
                    saveSession();
                    renderSession();
                },
            }, t('Adicionar')));
    }

    function startPanel() {
        const plan = (plans[ui.member]?.[todayIdx()] ?? []).filter((p) => exercise(p.e));
        return h('div', { class: 'panel' },
            h('h2', {}, t('Treinar · {day}', { day: DAYS[todayIdx()] })),
            field(t('Quem'), select('m', memberOptions(), ui.member, (v) => { ui.member = v; renderSession(); })),
            plan.length
                ? h('ul', { class: 'list' }, plan.map((p) => h('li', {},
                    h('div', { class: 'grow' }, exercise(p.e).name, h('small', {}, planLabel(p))))))
                : h('p', { class: 'empty' }, t('Sem plano para hoje. Cria-o no separador Plano ou começa um treino livre.')),
            h('button', { type: 'button', onclick: () => startSession(plan) }, plan.length ? t('Começar treino') : t('Treino livre')),
            h('div', { class: 'row' },
                h('a', { class: 'btn secondary', href: '#gerador' }, t('🎲 Gerar treino')),
                h('a', { class: 'btn secondary', href: '#programas' }, t('📋 Programas'))));
    }

    function renderSession() {
        const root = document.getElementById('sessionBox');
        root.replaceChildren();
        if (!Fit.members().length) { root.append(noMembers()); return; }
        ensureMember();
        if (session) {
            session.items = session.items.filter((i) => exercise(i.e));
            session.start ||= Date.now();
        }
        if (!session || !Fit.members().some((m) => m.id === session.m)) {
            session = null;
            root.append(...[Fit.heroPanel(ui.member), startPanel()].filter(Boolean));
            return;
        }

        const name = Fit.members().find((m) => m.id === session.m).name;
        root.append(...[
            h('div', { class: 'panel' },
                h('div', { class: 'row between' },
                    h('h2', {}, t('Treino de {name}', { name })),
                    h('span', { class: 'timer', id: 'sessionClock' })),
                h('div', { class: 'row center between' },
                    h('p', { class: 'rest', id: 'restClock' }),
                    h('label', { class: 'mini-fld rest-pick' }, h('span', {}, t('Descanso')),
                        select('rest', REST_OPTIONS.map((s) => [String(s), `${s}s`]), String(restSeconds), (v) => {
                            restSeconds = Number(v);
                            localStorage.setItem(REST_KEY, String(restSeconds));
                        })))),
            ...session.items.map(itemPanel),
            addExercisePanel(),
            h('div', { class: 'panel' }, h('h2', {}, t('Notas')),
                h('textarea', {
                    rows: 2, maxlength: 300, placeholder: t('Como correu? (opcional)'),
                    oninput: (e) => { session.note = e.target.value; saveSession(); },
                }, session.note || '')),
            h('div', { class: 'row' },
                h('button', { type: 'button', class: 'secondary', onclick: cancelSession }, t('Cancelar')),
                h('button', { type: 'button', onclick: finishSession }, t('Terminar'))),
        ]);
        kick();
    }

    function renderAll() {
        // Remove planos de perfis que já não existem
        const ids = new Set(Fit.members().map((m) => m.id));
        const stale = Object.keys(plans).filter((id) => !ids.has(id));
        if (stale.length) { stale.forEach((id) => delete plans[id]); savePlans(); }
        renderSession();
        renderPlan();
    }

    // API para outros módulos (biblioteca de exercícios)
    window.Plan = {
        days: DAYS,
        today: todayIdx,
        add(member, day, id, s, r) {
            ((plans[member] ||= {})[day] ||= []).push({ e: id, s, r });
            savePlans();
            renderAll();
        },
        startWith(member, items) {
            const valid = (items || []).filter((p) => exercise(p.e));
            if (!valid.length || !Fit.member(member)) return;
            const go = () => {
                ui.member = member;
                session = { m: member, start: Date.now(), note: '', items: valid.map((p) => newItem(member, p.e, p.s, p.r)) };
                saveSession();
                renderSession();
                location.hash = '#treinos';
            };
            if (session) confirmDialog(t('Já tens um treino a decorrer. Substituir por este?')).then((ok) => { if (ok) go(); });
            else go();
        },
        exportFor(member) {
            const days = plans[member] || {};
            const out = {};
            Object.keys(days).forEach((d) => { if (days[d]?.length) out[d] = days[d]; });
            return out;
        },
        importFor(member, days) {
            if (!days || typeof days !== 'object') return;
            const clean = {};
            for (let d = 0; d < 7; d++) {
                const list = Array.isArray(days[d]) ? days[d] : [];
                clean[d] = list.slice(0, 40).map((p) => ({
                    e: String(p?.e || ''),
                    s: Math.min(50, Math.max(1, Math.round(Number(p?.s)) || 1)),
                    r: Math.min(1000, Math.max(1, Math.round(Number(p?.r)) || 1)),
                })).filter((p) => /^[\w-]{1,40}$/.test(p.e) && exercise(p.e));
            }
            plans[member] = clean;
            savePlans();
            renderAll();
        },
        purge(id) {
            Object.values(plans).forEach((days) => {
                Object.keys(days).forEach((d) => { days[d] = days[d].filter((p) => p.e !== id); });
            });
            savePlans();
            if (session) { session.items = session.items.filter((i) => i.e !== id); saveSession(); }
            renderAll();
        },
    };

    document.addEventListener('fit:change', renderAll);
    renderAll();
})();
