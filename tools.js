// Ferramentas: calorias e macros, IMC, zonas de frequência cardíaca, 1RM, discos e hidratação.
(() => {
    'use strict';
    const { h, field, select } = window.Fit;

    const KEY = 'fit_tools_v1';
    const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
    let saved = read();
    const store = (name, value) => { saved[name] = value; localStorage.setItem(KEY, JSON.stringify(saved)); };

    function lastWeight() {
        const id = Fit.me() || Fit.members()[0]?.id;
        if (!id || !window.Measures) return null;
        const w = window.Measures.exportFor(id).filter((e) => e.v.weight != null).sort((a, b) => b.t - a.t)[0];
        return w ? w.v.weight : null;
    }

    const val = (name, fallback = '') => saved[name] ?? fallback;
    const n = (form, name) => parseFloat(String(new FormData(form).get(name)).replace(',', '.'));
    const ok = (...v) => v.every((x) => Number.isFinite(x) && x > 0);
    const round = (v, d = 0) => Math.round(v * 10 ** d) / 10 ** d;

    function input(label, name, fallback, attrs = {}) {
        return field(label, h('input', { type: 'number', name, inputmode: 'decimal', step: 'any', min: 0, value: val(name, fallback), ...attrs }));
    }

    function pick(label, name, options, fallback) {
        return field(label, select(name, options, String(val(name, fallback)), (v) => { store(name, v); }));
    }

    // Cria um painel de ferramenta: compute(form) devolve um nó/array com o resultado
    function tool(id, title, hint, fields, compute) {
        const out = h('div', { class: 'tool-out' });
        const form = h('form', { class: 'tool-form', onsubmit: (e) => e.preventDefault() }, fields, out);
        const run = () => {
            out.replaceChildren();
            try {
                const res = compute(form);
                if (res) out.append(...[].concat(res).filter(Boolean));
            } catch { /* entradas incompletas */ }
        };
        form.addEventListener('input', (e) => {
            if (e.target.name && e.target.type !== 'checkbox') store(e.target.name, e.target.value);
            run();
        });
        form.addEventListener('change', run);
        const box = h('details', { class: 'panel tool', id: `tool-${id}` },
            h('summary', {}, title), hint ? h('p', { class: 'muted small' }, hint) : null, form);
        run();
        return box;
    }

    const stat = (label, value, sub) => h('div', { class: 'stat-box' }, h('small', {}, label), h('b', {}, value), sub ? h('small', {}, sub) : null);
    const stats = (...items) => h('div', { class: 'stats wrap' }, items);

    // ---------- Calorias e macros ----------
    const ACTIVITY = [['1.2', 'Sedentário (sem exercício)'], ['1.375', 'Leve (1–3 treinos/semana)'], ['1.55', 'Moderado (3–5 treinos)'], ['1.725', 'Intenso (6–7 treinos)'], ['1.9', 'Muito intenso (2x/dia)']];
    const GOAL_KCAL = [['-500', 'Perder gordura (−500 kcal)'], ['-250', 'Perder devagar (−250 kcal)'], ['0', 'Manter peso'], ['250', 'Ganhar devagar (+250 kcal)'], ['400', 'Ganhar músculo (+400 kcal)']];

    const calories = () => tool('cal', '🔥 Calorias e macros', 'Estimativa pela fórmula de Mifflin-St Jeor. Usa como ponto de partida e ajusta com a evolução do peso.',
        [h('div', { class: 'row' }, pick('Sexo', 'sex', [['m', 'Homem'], ['f', 'Mulher']], 'm'), input('Idade', 'age', 30)),
            h('div', { class: 'row' }, input('Altura (cm)', 'height', 175), input('Peso (kg)', 'weight', lastWeight() ?? 75)),
            pick('Atividade', 'activity', ACTIVITY, '1.55'), pick('Objetivo', 'kgoal', GOAL_KCAL, '0')],
        (f) => {
            const age = n(f, 'age'), height = n(f, 'height'), weight = n(f, 'weight');
            if (!ok(age, height, weight)) return null;
            const bmr = 10 * weight + 6.25 * height - 5 * age + (new FormData(f).get('sex') === 'f' ? -161 : 5);
            const tdee = bmr * Number(new FormData(f).get('activity'));
            const target = Math.max(1200, tdee + Number(new FormData(f).get('kgoal')));
            const protein = round(weight * 2);
            const fat = round((target * 0.25) / 9);
            const carbs = Math.max(0, round((target - protein * 4 - fat * 9) / 4));
            return [stats(stat('Metabolismo basal', `${round(bmr)} kcal`), stat('Manutenção (TDEE)', `${round(tdee)} kcal`), stat('Objetivo diário', `${round(target)} kcal`)),
                h('strong', {}, 'Macros sugeridos'),
                stats(stat('Proteína', `${protein} g`, '2 g/kg'), stat('Hidratos', `${carbs} g`), stat('Gordura', `${fat} g`, '25% kcal'))];
        });

    // ---------- IMC ----------
    const bmi = () => tool('bmi', '⚖️ IMC', 'O IMC é só uma referência: não distingue músculo de gordura.',
        [h('div', { class: 'row' }, input('Altura (cm)', 'height', 175), input('Peso (kg)', 'weight', lastWeight() ?? 75))],
        (f) => {
            const height = n(f, 'height'), weight = n(f, 'weight');
            if (!ok(height, weight)) return null;
            const v = weight / (height / 100) ** 2;
            const cat = v < 18.5 ? 'Abaixo do peso' : v < 25 ? 'Peso normal' : v < 30 ? 'Excesso de peso' : 'Obesidade';
            const lo = round(18.5 * (height / 100) ** 2, 1), hi = round(24.9 * (height / 100) ** 2, 1);
            return [stats(stat('IMC', String(round(v, 1)), cat), stat('Peso "normal"', `${lo}–${hi} kg`, 'segundo a OMS'))];
        });

    // ---------- Zonas de FC ----------
    const ZONES = [['Z1 · Recuperação', 0.5, 0.6], ['Z2 · Base / queima de gordura', 0.6, 0.7], ['Z3 · Aeróbio', 0.7, 0.8], ['Z4 · Limiar', 0.8, 0.9], ['Z5 · Máximo', 0.9, 1]];

    const hrZones = () => tool('hr', '❤️ Zonas de frequência cardíaca', 'FC máxima estimada (Tanaka: 208 − 0,7 × idade). Com a FC de repouso usa o método de Karvonen.',
        [h('div', { class: 'row' }, input('Idade', 'age', 30), input('FC repouso (opcional)', 'rhr', ''))],
        (f) => {
            const age = n(f, 'age');
            if (!ok(age)) return null;
            const max = round(208 - 0.7 * age);
            const rest = n(f, 'rhr');
            const karvonen = ok(rest) && rest < max;
            const bpm = (p) => (karvonen ? round(rest + (max - rest) * p) : round(max * p));
            return [stats(stat('FC máxima', `${max} bpm`), stat('Método', karvonen ? 'Karvonen' : '% da FC máx.')),
                h('ul', { class: 'list' }, ZONES.map(([name, a, b]) => h('li', {}, h('span', { class: 'grow' }, name), h('b', {}, `${bpm(a)}–${bpm(b)} bpm`))))];
        });

    // ---------- 1RM ----------
    const PERCENTS = [[100, 1], [95, 2], [90, 4], [85, 6], [80, 8], [75, 10], [70, 12], [65, 16], [60, 20]];

    const oneRm = () => tool('rm', '🏋️ Calculadora de 1RM', 'Estima a carga máxima para 1 repetição a partir de uma série submáxima (até ~10 reps).',
        [h('div', { class: 'row' }, input('Peso levantado (kg)', 'rmkg', 60), input('Repetições', 'rmreps', 8))],
        (f) => {
            const kg = n(f, 'rmkg'), reps = n(f, 'rmreps');
            if (!ok(kg, reps) || reps > 30) return null;
            const epley = kg * (1 + reps / 30);
            const brzycki = reps < 37 ? (kg * 36) / (37 - reps) : epley;
            const rm = reps === 1 ? kg : (epley + brzycki) / 2;
            return [stats(stat('1RM estimado', `${round(rm, 1)} kg`)),
                h('ul', { class: 'list' }, PERCENTS.map(([p, r]) => h('li', {}, h('span', { class: 'grow' }, `${p}% · ~${r} reps`), h('b', {}, `${round((rm * p) / 100, 1)} kg`))))];
        });

    // ---------- Discos ----------
    const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

    const plates = () => tool('plates', '💿 Calculadora de discos', 'Quantos discos pôr de cada lado da barra.',
        [h('div', { class: 'row' }, input('Peso total (kg)', 'platekg', 100), pick('Barra', 'bar', [['20', 'Olímpica 20 kg'], ['15', 'Feminina 15 kg'], ['10', 'Curta 10 kg']], '20'))],
        (f) => {
            const total = n(f, 'platekg'), bar = Number(new FormData(f).get('bar'));
            if (!ok(total) || total < bar) return h('p', { class: 'empty' }, 'O peso total tem de ser maior que o da barra.');
            let side = (total - bar) / 2;
            const used = [];
            PLATES.forEach((p) => { const c = Math.floor(side / p + 1e-9); if (c > 0) { used.push([p, c]); side = round(side - c * p, 3); } });
            const done = round(bar + 2 * used.reduce((a, [p, c]) => a + p * c, 0), 2);
            return [used.length
                ? h('div', { class: 'plate-row' }, used.flatMap(([p, c]) => Array.from({ length: c }, () => h('span', { class: `plate p${String(p).replace('.', '_')}` }, String(p)))))
                : h('p', { class: 'empty' }, 'Só a barra.'),
                h('p', { class: 'lead' }, used.length ? `Por lado: ${used.map(([p, c]) => `${c}×${p}`).join(' + ')}` : 'Sem discos'),
                done !== total ? h('p', { class: 'muted small' }, `Com os discos habituais chegas a ${done} kg.`) : null];
        });

    // ---------- Hidratação ----------
    const water = () => tool('water', '💧 Hidratação', 'Referência: ~35 ml por kg de peso, mais 500 ml por cada hora de treino.',
        [h('div', { class: 'row' }, input('Peso (kg)', 'weight', lastWeight() ?? 75), input('Treino (horas/dia)', 'trainh', 1))],
        (f) => {
            const weight = n(f, 'weight'), hours = n(f, 'trainh') || 0;
            if (!ok(weight)) return null;
            const ml = weight * 35 + hours * 500;
            return stats(stat('Por dia', `${round(ml / 1000, 1)} L`, `≈ ${Math.round(ml / 250)} copos de 250 ml`));
        });

    function render() {
        const root = document.getElementById('view-tools');
        const openId = root.querySelector('details[open]')?.id;
        root.replaceChildren();
        saved = read();
        root.append(
            h('div', { class: 'panel' }, h('h2', {}, 'Ferramentas'),
                h('p', { class: 'muted small' }, 'Calculadoras úteis para treino e nutrição. São estimativas e não substituem aconselhamento profissional.')),
            calories(), oneRm(), plates(), hrZones(), bmi(), water());
        if (openId) root.querySelector(`#${openId}`)?.setAttribute('open', '');
    }

    document.addEventListener('viewchange', (e) => { if (e.detail === 'ferramentas') render(); });
    render();
})();
