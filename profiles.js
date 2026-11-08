// Separador Perfis: cartões com foto, nível e conquistas; criar perfil; partilhar/importar; equipas.
(() => {
    'use strict';
    const { h, field, select, toast, confirmDialog } = window.Fit;

    const PALETTE = ['#c6ff3d', '#ff5a1f', '#22d3ee', '#a78bfa', '#f472b6', '#facc15', '#34d399', '#60a5fa'];
    const ui = { photo: '' };

    const ask = (message, defaultValue) =>
        (typeof showDialog === 'function' ? showDialog({ message, type: 'prompt', defaultValue }) : Promise.resolve(null));

    function pickPhoto(onPhoto) {
        const input = h('input', { type: 'file', accept: 'image/*', class: 'hidden' });
        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            input.remove();
            if (!file) return;
            try { onPhoto(await Fit.processPhoto(file)); } catch { toast(t('Não foi possível usar essa imagem.')); }
        });
        document.body.append(input);
        input.click();
    }

    // ---------- Cartão de perfil ----------
    function card(m) {
        const total = Fit.stats(m.id);
        const lv = Fit.level(total.points);
        const st = Fit.streaks(m.id);
        const isMe = Fit.me() === m.id;
        const badges = Fit.badges(m.id);
        const earned = badges.filter((b) => b.on).length;

        return h('div', { class: 'panel profile-card' },
            h('div', { class: 'pc-head' },
                h('button', { type: 'button', class: 'avatar-btn', 'aria-label': t('Mudar foto'), onclick: () => pickPhoto((photo) => Fit.updateMember(m.id, { photo })) },
                    Fit.avatar(m, 68), h('span', { class: 'cam' }, '📷')),
                h('div', { class: 'grow' },
                    h('div', { class: 'pc-name' }, m.name, isMe ? h('span', { class: 'chip me' }, t('EU')) : null),
                    h('small', { class: 'muted' }, `${m.role !== 'Outro' ? `${t(m.role)} · ` : ''}${t('Nível {lv}', { lv: lv.lv })} ${lv.title}`),
                    h('div', { class: 'xp' }, h('i', { style: `width:${Math.round(lv.pct * 100)}%` })),
                    h('small', { class: 'muted' }, t('{n} pts para o próximo nível', { n: lv.next })))),
            h('div', { class: 'hero-stats' },
                h('div', {}, h('b', {}, String(total.points)), h('small', {}, t('pontos'))),
                h('div', {}, h('b', {}, String(total.sessions)), h('small', {}, t('treinos'))),
                h('div', {}, h('b', {}, `🔥 ${st.current}`), h('small', {}, t('sequência')))),
            h('div', { class: 'badges' }, badges.map((b) =>
                h('span', { class: `bdg${b.on ? ' on' : ''}`, title: b.label }, b.icon)),
                h('small', { class: 'muted' }, t('{earned}/{total} conquistas', { earned, total: badges.length }))),
            h('label', { class: 'goal-row' }, h('span', {}, t('Meta semanal')),
                select('goal', [1, 2, 3, 4, 5, 6, 7].map((n) => [String(n), tn(n, '{n} dia', '{n} dias')]), String(m.goal || 3),
                    (v) => Fit.updateMember(m.id, { goal: Number(v) }))),
            h('div', { class: 'actions' },
                h('button', { type: 'button', onclick: () => Share.shareProfile(m.id) }, t('📤 Partilhar')),
                h('button', { type: 'button', class: 'secondary', onclick: () => Share.copyCode(m.id) }, t('📋 Código')),
                isMe ? null : h('button', { type: 'button', class: 'secondary', onclick: () => { Fit.setMe(m.id); toast(t('{name} é o teu perfil', { name: m.name })); } }, t('⭐ Sou eu')),
                h('button', { type: 'button', class: 'secondary', onclick: async () => {
                    const name = await ask(t('Novo nome:'), m.name);
                    if (name) Fit.updateMember(m.id, { name });
                } }, t('✏️ Nome')),
                m.photo ? h('button', { type: 'button', class: 'secondary', onclick: () => Fit.updateMember(m.id, { photo: '' }) }, t('Sem foto')) : null,
                h('button', { type: 'button', class: 'secondary danger', onclick: async () => {
                    if (!(await confirmDialog(t('Apagar {name} e todo o histórico?', { name: m.name })))) return;
                    Fit.removeMember(m.id);
                } }, t('🗑️ Apagar'))));
    }

    // ---------- Novo perfil ----------
    function newForm() {
        const color = PALETTE[Fit.members().length % PALETTE.length];
        const preview = h('div', { class: 'photo-preview' });
        const paint = () => {
            preview.replaceChildren(Fit.avatar({ name: '?', color, photo: ui.photo }, 72));
        };
        paint();
        return h('form', { class: 'panel', onsubmit: (event) => {
            event.preventDefault();
            const f = new FormData(event.target);
            const m = Fit.addMember({ name: f.get('name'), role: f.get('role'), color: f.get('color'), photo: ui.photo });
            if (!m) return;
            ui.photo = '';
            toast(t('{name} entrou na equipa! 💪', { name: m.name }));
        } },
            h('h2', {}, t('Novo perfil')),
            h('div', { class: 'photo-row' }, preview,
                h('button', { type: 'button', class: 'secondary', onclick: () => pickPhoto((photo) => { ui.photo = photo; paint(); }) }, t('📷 Escolher foto'))),
            field(t('Nome'), h('input', { name: 'name', required: true, maxlength: 24, autocomplete: 'off', placeholder: t('Ex: Ana') })),
            h('div', { class: 'row' },
                field(t('Tipo'), select('role', Fit.roles.map((r) => [r, t(r)]), 'Outro', () => {})),
                field(t('Cor'), h('input', { name: 'color', type: 'color', value: color }))),
            h('button', { type: 'submit' }, t('Criar perfil')));
    }

    // ---------- Importar ----------
    function importPanel() {
        const code = h('textarea', { rows: 3, placeholder: t('Cola aqui o código FITCREW1:…'), 'aria-label': t('Código do perfil') });
        const fileInput = h('input', { type: 'file', accept: '.json,application/json,text/plain', class: 'hidden' });
        fileInput.addEventListener('change', async () => {
            const ok = await Share.importFile(fileInput.files?.[0]);
            fileInput.value = '';
            if (ok) code.value = '';
        });
        return h('div', { class: 'panel' },
            h('h2', {}, t('Importar perfil')),
            h('p', { class: 'muted small' }, t('Recebeste o perfil de alguém da família por mensagem? Escolhe o ficheiro ou cola o código para entrarem no ranking.')),
            fileInput,
            h('button', { type: 'button', onclick: () => fileInput.click() }, t('📥 Escolher ficheiro')),
            code,
            h('button', { type: 'button', class: 'secondary', onclick: async () => {
                if (await Share.importText(code.value)) code.value = '';
            } }, t('Importar código')),
            Fit.members().length ? h('button', { type: 'button', class: 'secondary', onclick: () => Share.shareAll() }, t('💾 Exportar todos (cópia de segurança)')) : null);
    }

    // ---------- Equipas / casais ----------
    function teamForm() {
        if (Fit.members().length < 2) return null;
        return h('form', { class: 'panel', onsubmit: (event) => {
            event.preventDefault();
            const f = new FormData(event.target);
            const ids = f.getAll('member');
            if (ids.length < 2) { toast(t('Escolhe pelo menos 2 perfis.')); return; }
            Fit.addTeam(f.get('name'), ids);
        } },
            h('h2', {}, t('Novo duelo')),
            h('p', { class: 'muted small' }, t('Cria um duelo entre casal, irmãos ou amigos. Aparece no Ranking.')),
            field(t('Nome'), h('input', { name: 'name', required: true, maxlength: 24, autocomplete: 'off', placeholder: t('Ex: Casal Fit') })),
            h('div', { class: 'checks' }, Fit.members().map((m) =>
                h('label', {}, h('input', { type: 'checkbox', name: 'member', value: m.id }), Fit.avatar(m, 26), m.name))),
            h('button', { type: 'submit' }, t('Criar duelo')));
    }

    function teamList() {
        if (!Fit.teams().length) return null;
        return h('div', { class: 'panel' }, h('h2', {}, t('Duelos')), h('ul', { class: 'list' }, Fit.teams().map((team) =>
            h('li', {}, h('div', { class: 'grow' }, h('strong', {}, team.name),
                h('small', {}, team.memberIds.map((id) => Fit.member(id)?.name).filter(Boolean).join(' vs '))),
                h('button', { type: 'button', class: 'btn-x', 'aria-label': t('Apagar'), onclick: async () => {
                    if (await confirmDialog(t('Apagar este duelo?'))) Fit.removeTeam(team.id);
                } }, '×')))));
    }

    function render() {
        const root = document.getElementById('view-profiles');
        root.replaceChildren();
        const members = Fit.members();
        root.append(...[
            members.length ? null : h('div', { class: 'panel cta' },
                h('h2', {}, t('Monta a tua equipa')),
                h('p', { class: 'muted' }, t('Cria o teu perfil e convida a família: cada um importa o perfil dos outros e o ranking junta todos.'))),
            ...members.map(card),
            newForm(),
            importPanel(),
            teamForm(),
            teamList(),
        ].filter(Boolean));
    }

    document.addEventListener('fit:change', render);
    render();
})();
