// Gerador de treino em 3 passos: equipamento → músculos → exercícios (à la workout.cool).
(() => {
    'use strict';
    const { h, field, select, toast } = window.Fit;

    const EQUIP_EMOJI = { 'Peso corporal': '🤸', Halteres: '🏋️', Barra: '🏗️', Kettlebell: '🔔', 'Elástico': '🪢', Anilha: '💿', 'Barra fixa': '🧗', Banco: '🛋️', 'Máquina': '⚙️', Cardio: '🏃', Bola: '⚽', Piscina: '🏊', Raquete: '🎾' };
    const MUSCLE_EMOJI = { Peito: '🛡️', Costas: '🦅', Ombros: '🏔️', 'Bíceps': '💪', 'Tríceps': '🔱', Pernas: '🦵', 'Glúteos': '🍑', Abdominais: '🎯', Cardio: '❤️', 'Antebraços': '🦾', 'Corpo inteiro': '⚡', Mobilidade: '🧘' };
    const GOALS = {
        strength: { label: t('Força'), s: 4, r: 6, cardio: 10, plank: 1 },
        hyper: { label: t('Hipertrofia'), s: 3, r: 10, cardio: 15, plank: 1 },
        endure: { label: t('Resistência'), s: 3, r: 15, cardio: 20, plank: 2 },
    };
    const DAYS = I18n.weekdays();

    const ui = { step: 1, eq: new Set(['Peso corporal']), muscles: new Set(), n: 6, goal: 'hyper', list: [], member: '', day: null };

    const uniq = (key) => [...new Set(Fit.exercises.map((e) => e[key]))];
    const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
    const pool = (muscle) => Fit.exercises.filter((e) => e.muscle === muscle && ui.eq.has(e.equip));

    function ensureMember() {
        if (!Fit.member(ui.member)) ui.member = Fit.me() || Fit.members()[0]?.id || '';
    }

    function defaults(ex) {
        const g = GOALS[ui.goal];
        if (ex.kind === 'time') return { e: ex.id, s: 1, r: ex.muscle === 'Cardio' ? g.cardio : g.plank };
        return { e: ex.id, s: g.s, r: g.r };
    }

    function generate() {
        const muscles = [...ui.muscles].filter((m) => pool(m).length);
        const missing = [...ui.muscles].filter((m) => !pool(m).length);
        if (missing.length) toast(t('Sem exercícios de {muscles} com esse equipamento.', { muscles: missing.map(t).join(', ') }));
        const chosen = [];
        const used = new Set();
        const queues = new Map(muscles.map((m) => [m, shuffle(pool(m))]));
        let guard = 0;
        while (chosen.length < ui.n && guard++ < 200 && muscles.length) {
            let added = false;
            for (const m of muscles) {
                const q = queues.get(m);
                const ex = q.find((e) => !used.has(e.id));
                if (ex && chosen.length < ui.n) { used.add(ex.id); chosen.push(ex); added = true; }
            }
            if (!added) break;
        }
        // força/carga primeiro, tempo no fim
        const rank = (e) => (e.kind === 'load' ? 0 : e.kind === 'reps' ? 1 : 2);
        ui.list = chosen.sort((a, b) => rank(a) - rank(b)).map(defaults);
        return ui.list.length > 0;
    }

    // ---------- Passos ----------
    function tile(emoji, text, on, onPick) {
        return h('button', { type: 'button', class: `gen-tile${on ? ' on' : ''}`, 'aria-pressed': String(on), onclick: onPick },
            h('span', { class: 'gen-emoji' }, emoji), h('span', {}, text));
    }

    function stepper() {
        const steps = [t('Equipamento'), t('Músculos'), t('Treino')];
        return h('div', { class: 'stepper' }, steps.map((label, i) => h('div', { class: `st${ui.step === i + 1 ? ' on' : ''}${ui.step > i + 1 ? ' done' : ''}` },
            h('b', {}, String(i + 1)), h('span', {}, label))));
    }

    function stepEquip() {
        return h('div', { class: 'panel' },
            h('h2', {}, t('O que tens à mão?')),
            h('p', { class: 'muted small' }, t('Escolhe o equipamento disponível (podes marcar vários).')),
            h('div', { class: 'gen-grid' }, uniq('equip').map((eq) => tile(EQUIP_EMOJI[eq] || '🏷️', t(eq), ui.eq.has(eq), () => {
                ui.eq.has(eq) ? ui.eq.delete(eq) : ui.eq.add(eq);
                render();
            }))),
            h('button', { type: 'button', disabled: ui.eq.size ? null : 'disabled', onclick: () => { if (ui.eq.size) { ui.step = 2; render(); } } }, t('Continuar')));
    }

    function stepMuscles() {
        const available = uniq('muscle').filter((m) => pool(m).length);
        return h('div', { class: 'panel' },
            h('h2', {}, t('O que queres treinar?')),
            h('div', { class: 'gen-grid' }, available.map((m) => tile(MUSCLE_EMOJI[m] || '💪', t(m), ui.muscles.has(m), () => {
                ui.muscles.has(m) ? ui.muscles.delete(m) : ui.muscles.add(m);
                render();
            }))),
            h('div', { class: 'row' },
                field(t('Objetivo'), select('goal', Object.entries(GOALS).map(([k, v]) => [k, `${v.label} (${v.s}×${v.r})`]), ui.goal, (v) => { ui.goal = v; })),
                field(t('Exercícios'), select('n', [4, 5, 6, 8, 10].map((n) => [String(n), String(n)]), String(ui.n), (v) => { ui.n = Number(v); }))),
            h('div', { class: 'row' },
                h('button', { type: 'button', class: 'secondary', onclick: () => { ui.step = 1; render(); } }, t('Voltar')),
                h('button', { type: 'button', onclick: () => {
                    if (!ui.muscles.size) { toast(t('Escolhe pelo menos um músculo.')); return; }
                    if (generate()) { ui.step = 3; render(); } else toast(t('Não encontrei exercícios. Muda o equipamento.'));
                } }, t('🎲 Gerar treino'))));
    }

    function rowFor(item, i) {
        const ex = Fit.byId(item.e);
        const time = ex.kind === 'time';
        const mini = (lab, key) => h('label', { class: 'mini-fld' }, h('span', {}, lab),
            h('input', { type: 'number', min: 1, inputmode: 'numeric', value: item[key],
                oninput: (e) => { item[key] = Math.max(1, Math.round(Number(e.target.value)) || 1); } }));
        return h('li', { class: 'plan-item' },
            h('div', { class: 'grow' }, h('strong', {}, ex.name), h('small', {}, `${t(ex.muscle)} · ${t(ex.equip)}`),
                h('div', { class: 'row mini' }, time ? null : mini(t('Séries'), 's'), mini(time ? t('Min') : t('Reps'), 'r'))),
            h('button', { type: 'button', class: 'btn-x', 'aria-label': t('Trocar exercício'), title: t('Trocar'), onclick: () => {
                const used = new Set(ui.list.map((p) => p.e));
                const options = pool(ex.muscle).filter((e) => !used.has(e.id));
                if (!options.length) { toast(t('Não há alternativas com esse equipamento.')); return; }
                ui.list[i] = defaults(options[Math.floor(Math.random() * options.length)]);
                render();
            } }, '🔀'),
            h('button', { type: 'button', class: 'btn-x', 'aria-label': t('Remover'), onclick: () => { ui.list.splice(i, 1); render(); } }, '×'));
    }

    function stepResult() {
        ensureMember();
        if (ui.day == null) ui.day = window.Plan.today();
        const hasMembers = Fit.members().length > 0;
        const addMore = () => {
            const used = new Set(ui.list.map((p) => p.e));
            const options = Fit.exercises.filter((e) => ui.muscles.has(e.muscle) && ui.eq.has(e.equip) && !used.has(e.id));
            if (!options.length) { toast(t('Já usaste todos os exercícios possíveis.')); return; }
            ui.list.push(defaults(options[Math.floor(Math.random() * options.length)]));
            render();
        };
        return h('div', { class: 'panel' },
            h('h2', {}, t('O teu treino')),
            ui.list.length ? h('ul', { class: 'list' }, ui.list.map(rowFor)) : h('p', { class: 'empty' }, t('Lista vazia. Adiciona ou gera de novo.')),
            h('div', { class: 'row' },
                h('button', { type: 'button', class: 'secondary', onclick: addMore }, t('＋ Mais um')),
                h('button', { type: 'button', class: 'secondary', onclick: () => { generate(); render(); } }, t('🔄 Regenerar'))),
            hasMembers ? [
                field(t('Para'), select('m', Fit.members().map((m) => [m.id, m.name]), ui.member, (v) => { ui.member = v; })),
                h('button', { type: 'button', disabled: ui.list.length ? null : 'disabled', onclick: () => ui.list.length && window.Plan.startWith(ui.member, ui.list) }, t('▶ Começar agora')),
                h('div', { class: 'row center' },
                    select('day', DAYS.map((d, i) => [String(i), d]), String(ui.day), (v) => { ui.day = Number(v); }),
                    h('button', { type: 'button', class: 'secondary', onclick: () => {
                        if (!ui.list.length) return;
                        ui.list.forEach((p) => window.Plan.add(ui.member, ui.day, p.e, p.s, p.r));
                        toast(t('Guardado no plano de {day}', { day: DAYS[ui.day] }));
                    } }, t('📅 Guardar no plano'))),
            ] : Fit.onboarding(),
            h('button', { type: 'button', class: 'secondary', onclick: () => { ui.step = 2; render(); } }, t('Voltar')));
    }

    function render() {
        const root = document.getElementById('view-generator');
        root.replaceChildren();
        const body = ui.step === 1 ? stepEquip() : ui.step === 2 ? stepMuscles() : stepResult();
        root.append(stepper(), body);
    }

    document.addEventListener('fit:change', render);
    render();
})();
