// Partilha de perfis: exportar (ficheiro ou código) e importar. Os dados validam-se no import.
(() => {
    'use strict';
    const PREFIX = 'FITCREW1:';
    const MAX_BYTES = 5 * 1024 * 1024;

    // ---------- Codificação ----------
    function toB64(text) {
        const bytes = new TextEncoder().encode(text);
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(bin);
    }

    function fromB64(b64) {
        const bin = atob(b64.replace(/\s+/g, ''));
        const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        return new TextDecoder().decode(bytes);
    }

    // ---------- Exportar ----------
    function bundleFor(id) {
        const core = Fit.exportCore(id);
        if (!core) return null;
        return { ...core, plan: window.Plan.exportFor(id), measures: window.Measures.exportFor(id) };
    }

    const wrap = (bundles) => ({ app: 'fitcrew', v: 1, exported: Date.now(), bundles });
    const json = (bundles) => JSON.stringify(wrap(bundles));
    const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'perfil';

    function download(file) {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    async function shareFile(bundles, name) {
        const file = new File([json(bundles)], `fitcrew-${name}.json`, { type: 'application/json' });
        try {
            if (navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file], title: 'Fit Crew', text: 'Importa o meu perfil no Fit Crew (separador Perfis → Importar).' });
                return;
            }
        } catch (err) {
            if (err?.name === 'AbortError') return;
        }
        download(file);
        Fit.toast('Ficheiro guardado. Envia-o por mensagem!');
    }

    function shareProfile(id) {
        const b = bundleFor(id);
        if (b) shareFile([b], slug(b.member.name));
    }

    function shareAll() {
        const bundles = Fit.members().map((m) => bundleFor(m.id)).filter(Boolean);
        if (bundles.length) shareFile(bundles, 'todos');
    }

    async function copyCode(id) {
        const b = bundleFor(id);
        if (!b) return;
        const code = PREFIX + toB64(json([b]));
        try {
            await navigator.clipboard.writeText(code);
            Fit.toast('Código copiado! Cola-o numa mensagem.');
        } catch {
            Fit.toast('Não foi possível copiar. Usa "Partilhar".');
        }
    }

    // ---------- Importar ----------
    function parse(text) {
        text = String(text || '').trim();
        if (!text) throw new Error('Vazio');
        if (text.length > MAX_BYTES) throw new Error('Demasiado grande');
        const raw = text.startsWith(PREFIX) ? fromB64(text.slice(PREFIX.length)) : text;
        const data = JSON.parse(raw);
        if (data?.app !== 'fitcrew' || !Array.isArray(data.bundles) || !data.bundles.length || data.bundles.length > 20) {
            throw new Error('Formato inválido');
        }
        return data.bundles;
    }

    function describe(bundles) {
        const have = new Set(Fit.data().log.map((l) => l.id));
        return bundles.map((b) => {
            const exists = !!Fit.member(b?.member?.id);
            const fresh = (Array.isArray(b?.log) ? b.log : []).filter((l) => l && !have.has(l.id)).length;
            return `${exists ? '↻' : '＋'} ${String(b?.member?.name || '?').slice(0, 24)} (${fresh} treino${fresh === 1 ? '' : 's'} novo${fresh === 1 ? '' : 's'})`;
        });
    }

    async function importText(text) {
        let bundles;
        try { bundles = parse(text); } catch { Fit.toast('Ficheiro ou código inválido.'); return false; }
        const ok = await Fit.confirmDialog(`Importar?\n${describe(bundles).join('\n')}\n\n＋ novo perfil · ↻ atualizar perfil existente`);
        if (!ok) return false;
        const done = [];
        for (const b of bundles) {
            try {
                const res = Fit.importCore(b);
                window.Plan.importFor(res.id, b.plan);
                window.Measures.importFor(res.id, b.measures);
                done.push(res.name);
            } catch { /* perfil inválido: ignora */ }
        }
        document.dispatchEvent(new Event('fit:change'));
        Fit.toast(done.length ? `Importado: ${done.join(', ')} 💪` : 'Nada importado.');
        return done.length > 0;
    }

    async function importFile(file) {
        if (!file) return false;
        if (file.size > MAX_BYTES) { Fit.toast('Ficheiro demasiado grande.'); return false; }
        return importText(await file.text());
    }

    window.Share = { shareProfile, shareAll, copyCode, importText, importFile };
})();
