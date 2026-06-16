// ============================================================
// AXONE — FX MANAGEMENT SUITE  |  script.js v3.0 (corrigido)
// ============================================================

// ── 0. AUTH ─────────────────────────────────────────────────
(function () {
    if (sessionStorage.getItem('kroma_autenticado') !== 'true') {
        window.location.href = 'login.html';
        return;
    }
    const u    = sessionStorage.getItem('kroma_usuario') || 'admin';
    const nome = u.charAt(0).toUpperCase() + u.slice(1);
    ['nome-usuario', 'nome-usuario-mobile'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = nome;
    });
})();

function logout() {
    sessionStorage.clear();
    window.location.href = 'login.html';
}

// ── 1. FORMATAÇÃO ────────────────────────────────────────────
function fmtMoeda(v) {
    v = v.replace(/\D/g, '');
    v = (v / 100).toFixed(2) + '';
    v = v.replace('.', ',');
    v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    return v;
}
function fmtDisplay(n) {
    return (+n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtCot(n) {
    return (+n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}
function parseNum(s) {
    return parseFloat((s || '').replace(/\./g, '').replace(',', '.')) || 0;
}

// ── 2. TOAST ─────────────────────────────────────────────────
function toast(msg, tipo = 'success') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className   = 'show' + (tipo === 'error' ? ' error' : '');
    clearTimeout(t._tid);
    t._tid = setTimeout(() => { t.className = ''; }, 3200);
}

// ── 3. BANCO DE DADOS (localStorage) ────────────────────────
let opFornecedor    = JSON.parse(localStorage.getItem('banco_cambio'))       || [];
let opClientes      = JSON.parse(localStorage.getItem('banco_clientes'))     || [];
let cadastrosCli    = JSON.parse(localStorage.getItem('banco_cadastros'))    || [];
let opOperacoes     = JSON.parse(localStorage.getItem('banco_operacoes'))    || [];
let cadFornecedores = JSON.parse(localStorage.getItem('banco_fornecedores')) || [];
let opDespesas      = JSON.parse(localStorage.getItem('banco_despesas'))     || [];

function salvarFornecedor()   { localStorage.setItem('banco_cambio',       JSON.stringify(opFornecedor)); }
function salvarClientes()     { localStorage.setItem('banco_clientes',     JSON.stringify(opClientes)); }
function salvarCadastros()    { localStorage.setItem('banco_cadastros',    JSON.stringify(cadastrosCli)); }
function salvarOperacoes()    { localStorage.setItem('banco_operacoes',    JSON.stringify(opOperacoes)); }
function salvarFornecedores() { localStorage.setItem('banco_fornecedores', JSON.stringify(cadFornecedores)); }
function salvarDespesas()     { localStorage.setItem('banco_despesas',     JSON.stringify(opDespesas)); }

// ── Saldo disponível ─────────────────────────────────────────
function saldoTotalDisponivel() {
    const totalComprado = opFornecedor.reduce((s, o) => s + (o.usdt || 0), 0);
    const totalVendido  = opOperacoes.reduce((s, o) => s + (o.usdt || 0), 0);
    return Math.max(0, totalComprado - totalVendido);
}

// ── 4. NAVEGAÇÃO ─────────────────────────────────────────────
function navegarPara(page) {
    sessionStorage.setItem('kroma_pagina', page);
    document.querySelectorAll('.nav-links a, .nav-drawer a').forEach(x => x.classList.remove('active'));
    document.querySelectorAll(`[data-page="${page}"]`).forEach(x => x.classList.add('active'));
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    const sec = document.getElementById('page-' + page);
    if (sec) sec.classList.add('active');

    if (page === 'home')      renderHome();
    if (page === 'fornecedor') carregarFornecedor();
    if (page === 'clientes')  carregarClientes();
    if (page === 'lucro')     renderLucro();
    if (page === 'cotacoes')  iniciarCotacoes();
    if (page === 'operacoes') initOperacoes();

    // Fecha drawer mobile
    const drawer = document.getElementById('nav-drawer');
    const btn    = document.getElementById('nav-hamburger');
    if (drawer) drawer.classList.remove('open');
    if (btn)    btn.classList.remove('open');
    document.body.style.overflow = '';
}

// Links da nav
document.querySelectorAll('.nav-links a, .nav-drawer a').forEach(a => {
    a.addEventListener('click', e => {
        e.preventDefault();
        navegarPara(a.dataset.page);
    });
});

// Links internos (ex: "Ver todas →" no home)
document.addEventListener('click', e => {
    const a = e.target.closest('.home-link');
    if (!a) return;
    e.preventDefault();
    const page = a.dataset.page;
    if (page) navegarPara(page);
});

// Hamburguer mobile
(function () {
    const btn    = document.getElementById('nav-hamburger');
    const drawer = document.getElementById('nav-drawer');
    if (!btn || !drawer) return;
    btn.addEventListener('click', () => {
        const open = drawer.classList.toggle('open');
        btn.classList.toggle('open', open);
        document.body.style.overflow = open ? 'hidden' : '';
    });
})();

// Data atual
(function () {
    const el = document.getElementById('data-atual');
    if (el) el.textContent = new Date().toLocaleDateString('pt-BR', {
        weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
    });
})();

// Restaura última aba
(function () {
    const paginaSalva = sessionStorage.getItem('kroma_pagina') || 'home';
    navegarPara(paginaSalva);
})();

// ── 5. DRAG TO SCROLL ────────────────────────────────────────
function dragScroll(el) {
    if (!el) return;
    let down = false, sx, sl;
    el.addEventListener('mousedown',  e => { down = true; sx = e.pageX - el.offsetLeft; sl = el.scrollLeft; });
    el.addEventListener('mouseleave', () => { down = false; });
    el.addEventListener('mouseup',    () => { down = false; });
    el.addEventListener('mousemove',  e => {
        if (!down) return;
        e.preventDefault();
        el.scrollLeft = sl - ((e.pageX - el.offsetLeft - sx) * 1.5);
    });
}

// ============================================================
// MÓDULO HOME
// ============================================================
let homeChartLucro  = null;
let homeChartVolume = null;
let homeClockTick   = null;

function renderHome() {
    const hora    = new Date().getHours();
    const greet   = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
    const usuario = sessionStorage.getItem('kroma_usuario') || 'admin';
    const nome    = usuario.charAt(0).toUpperCase() + usuario.slice(1);

    const elG = document.getElementById('home-greeting');
    if (elG) elG.textContent = `${greet}, ${nome}`;

    const elD = document.getElementById('home-date');
    if (elD) elD.textContent = new Date().toLocaleDateString('pt-BR',
        { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

    if (!homeClockTick) {
        homeClockTick = setInterval(() => {
            const elT = document.getElementById('home-time');
            if (elT) elT.textContent = new Date().toLocaleTimeString('pt-BR',
                { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }, 1000);
    }
    const elT = document.getElementById('home-time');
    if (elT) elT.textContent = new Date().toLocaleTimeString('pt-BR',
        { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Tagline rotativa
    if (!window._taglineInit) {
        window._taglineInit = true;
        const frases = [
            'Inteligência de mercado ao seu alcance.',
            'Controle total das suas operações.',
            'Spread calculado automaticamente.',
            'Decisões mais inteligentes.',
            'Saldos sempre atualizados.',
        ];
        let fi = 0;
        const elTag = document.getElementById('home-tagline');
        if (elTag) {
            setInterval(() => {
                elTag.classList.add('fade-out');
                setTimeout(() => {
                    fi = (fi + 1) % frases.length;
                    elTag.textContent = frases[fi];
                    elTag.classList.remove('fade-out');
                    elTag.classList.add('fade-in');
                }, 650);
            }, 4000);
        }
    }

    // KPIs
    const mesAtual  = new Date().toLocaleDateString('pt-BR').slice(3);
    const opsMes    = opOperacoes.filter(o => o.data && o.data.slice(3) === mesAtual);
    const lucroMes  = opsMes.reduce((s, o) => s + (o.lucro || 0), 0);
    const volumeMes = opsMes.reduce((s, o) => s + (o.usdt || 0), 0);
    const saldoDisp = saldoTotalDisponivel();
    const opsAbert  = opOperacoes.filter(o => o.status === 'andamento' || o.status === 'falta_pagar').length;
    const assetPend = opOperacoes.filter(o => o.status === 'nos_devemos').reduce((s, o) => s + (o.usdt || 0), 0);
    const aPagarF   = Math.max(0,
        opFornecedor.reduce((s, o) => s + (o.totalBrl || 0), 0) -
        opFornecedor.reduce((s, o) => s + (o.pix || 0), 0));

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('home-saldo',          fmtDisplay(saldoDisp) + ' USDT');
    set('home-lucro-mes',      'R$ ' + fmtDisplay(lucroMes));
    set('home-volume-mes',     fmtDisplay(volumeMes) + ' USDT');
    set('home-ops-abertas',    opsAbert);
    set('home-asset-pending',  fmtDisplay(assetPend) + ' USDT');
    set('home-a-pagar',        'R$ ' + fmtDisplay(aPagarF));

    const elLM = document.getElementById('home-lucro-mes');
    if (elLM) elLM.style.color = lucroMes >= 0 ? '#4CAF50' : '#ff5555';

    // Gráficos 30 dias
    const ini30  = new Date(); ini30.setDate(ini30.getDate() - 29);
    const diasMap = {}, volMap = {};
    for (let i = 0; i < 30; i++) {
        const d = new Date(ini30); d.setDate(ini30.getDate() + i);
        const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        diasMap[label] = 0;
        volMap[label]  = 0;
    }
    opOperacoes.forEach(op => {
        if (!op.data || !op.lucro) return;
        const [dd, mm, aa] = op.data.split('/');
        const dt = new Date(+aa, +mm - 1, +dd);
        if (dt >= ini30) {
            const label = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            if (diasMap[label] !== undefined) {
                diasMap[label] += op.lucro || 0;
                volMap[label]  += op.usdt  || 0;
            }
        }
    });
    const labels  = Object.keys(diasMap);
    const lucros  = Object.values(diasMap).map(v => +v.toFixed(2));
    const volumes = Object.values(volMap).map(v => +v.toFixed(2));

    if (homeChartLucro) homeChartLucro.destroy();
    const ctxL = document.getElementById('home-chart-lucro')?.getContext('2d');
    if (ctxL) {
        homeChartLucro = new Chart(ctxL, {
            type: 'line',
            data: { labels, datasets: [{ data: lucros, borderColor: '#4CAF50', backgroundColor: 'rgba(76,175,80,.08)', borderWidth: 2, pointRadius: 0, tension: 0.4, fill: true }] },
            options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255,255,255,.03)' }, ticks: { color: '#555', maxTicksLimit: 8, font: { size: 10 } } }, y: { grid: { color: 'rgba(255,255,255,.03)' }, ticks: { color: '#555', font: { size: 10 }, callback: v => 'R$' + fmtDisplay(v) } } } }
        });
    }

    if (homeChartVolume) homeChartVolume.destroy();
    const ctxV = document.getElementById('home-chart-volume')?.getContext('2d');
    if (ctxV) {
        homeChartVolume = new Chart(ctxV, {
            type: 'bar',
            data: { labels, datasets: [{ data: volumes, backgroundColor: 'rgba(33,150,243,.25)', borderColor: 'rgba(33,150,243,.7)', borderWidth: 1, borderRadius: 3 }] },
            options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255,255,255,.03)' }, ticks: { color: '#555', maxTicksLimit: 8, font: { size: 10 } } }, y: { grid: { color: 'rgba(255,255,255,.03)' }, ticks: { color: '#555', font: { size: 10 }, callback: v => fmtDisplay(v) } } } }
        });
    }

    // Tabelas do home
    const statusCores = { concluida: '#4CAF50', andamento: '#2196F3', falta_pagar: '#ffc107', nos_devemos: '#ff9800', cancelada: '#ff5555' };
    const statusNomes = { concluida: 'Settled', andamento: 'Processing', falta_pagar: 'Payment Pending', nos_devemos: 'Asset Pending', cancelada: 'Voided' };

    const tbOps = document.getElementById('home-tabela-ops');
    if (tbOps) {
        const ultOps = opOperacoes.filter(o => o.cliente).slice(0, 6);
        tbOps.innerHTML = ultOps.length
            ? ultOps.map(o => `
                <tr>
                    <td style="padding:6px 8px;font-size:.78rem;">${o.data}</td>
                    <td style="padding:6px 8px;font-size:.78rem;font-weight:600;">${o.cliente}</td>
                    <td style="padding:6px 8px;font-size:.78rem;text-align:right;">${fmtDisplay(o.usdt)}</td>
                    <td style="padding:6px 8px;font-size:.78rem;text-align:right;color:${(o.lucro || 0) > 0 ? '#4CAF50' : '#888'};font-weight:700;">${o.lucro ? 'R$ ' + fmtDisplay(o.lucro) : '—'}</td>
                    <td style="padding:6px 8px;"><span style="font-size:.68rem;font-weight:700;color:${statusCores[o.status] || '#888'};">${statusNomes[o.status] || o.status}</span></td>
                </tr>`).join('')
            : '<tr><td colspan="5" style="padding:16px;text-align:center;color:#555;font-size:.82rem;">Nenhuma operação ainda.</td></tr>';
    }

    const tbComp = document.getElementById('home-tabela-compras');
    if (tbComp) {
        const ultComp = opFornecedor.slice(0, 6);
        tbComp.innerHTML = ultComp.length
            ? ultComp.map(o => {
                const saldo    = Math.max(0, o.usdt - opOperacoes.filter(v => v.cotCompra && Math.round(v.cotCompra * 10000) === Math.round(o.cotacao * 10000)).reduce((s, v) => s + (v.usdt || 0), 0));
                const corSaldo = saldo <= 0 ? '#4CAF50' : saldo < o.usdt ? '#ffc107' : '#a0a0a0';
                return `
                <tr>
                    <td style="padding:6px 8px;font-size:.78rem;">${o.data}</td>
                    <td style="padding:6px 8px;font-size:.78rem;">${o.fornecedor || '—'}</td>
                    <td style="padding:6px 8px;font-size:.78rem;text-align:right;color:#4CAF50;font-weight:700;">${fmtDisplay(o.usdt)}</td>
                    <td style="padding:6px 8px;font-size:.78rem;text-align:right;">R$ ${fmtCot(o.cotacao)}</td>
                    <td style="padding:6px 8px;font-size:.78rem;text-align:right;color:${corSaldo};font-weight:700;">${fmtDisplay(saldo)}</td>
                </tr>`;
            }).join('')
            : '<tr><td colspan="5" style="padding:16px;text-align:center;color:#555;font-size:.82rem;">Nenhuma compra ainda.</td></tr>';
    }
}

// ============================================================
// MÓDULO A — FORNECEDOR
// ============================================================
function popularSelectForn() {
    const iSelForn = document.getElementById('select-fornecedor');
    if (!iSelForn) return;
    const atual = iSelForn.value;
    iSelForn.innerHTML = '<option value="">— Selecione o fornecedor —</option>';
    cadFornecedores.forEach(f => {
        const o = document.createElement('option');
        o.value = f; o.textContent = f;
        iSelForn.appendChild(o);
    });
    if (atual) iSelForn.value = atual;
}

(function initFornecedor() {
    const iValComp = document.getElementById('valor-comprado');
    const iCot     = document.getElementById('cotacao');
    const iTotAuto = document.getElementById('total-automatico');
    const iValPix  = document.getElementById('valor-pix');
    const iRefPix  = document.getElementById('referencia-pix');
    const iSelForn = document.getElementById('select-fornecedor');
    const btnReg   = document.getElementById('btn-registrar');
    const btnCan   = document.getElementById('btn-cancelar');
    const iFiltroD = document.getElementById('filtro-data');
    const btnLimp  = document.getElementById('btn-limpar-filtro');
    const btnAddF  = document.getElementById('btn-add-fornecedor');
    const inputNovoF = document.getElementById('input-novo-fornecedor');

    if (!btnReg) return;

    function calcTotalForn() {
        const total = parseNum(iValComp.value) * parseNum(iCot.value);
        iTotAuto.value = total > 0 ? fmtDisplay(total) : '';
    }

    iValComp.addEventListener('input', e => { e.target.value = fmtMoeda(e.target.value); calcTotalForn(); });
    iCot.addEventListener('input', calcTotalForn);
    if (iValPix) iValPix.addEventListener('input', e => { e.target.value = fmtMoeda(e.target.value); });

    function limparForn() {
        iValComp.value = ''; iCot.value = ''; iTotAuto.value = '';
        if (iValPix)  iValPix.value  = '';
        if (iRefPix)  iRefPix.value  = '';
        iValComp.focus();
    }
    if (btnCan) btnCan.addEventListener('click', limparForn);

    btnReg.addEventListener('click', () => {
        const usdt  = parseNum(iValComp.value);
        const cot   = parseNum(iCot.value);
        const total = parseNum(iTotAuto.value) || usdt * cot;
        const pix   = iValPix  ? parseNum(iValPix.value)  : 0;
        const ref   = iRefPix  ? iRefPix.value.trim()     : '';
        const forn  = iSelForn ? iSelForn.value.trim()    : '';

        if (!forn)             { toast('Selecione ou cadastre um fornecedor.', 'error'); return; }
        if (usdt === 0 && pix === 0) { toast('Preencha USDT ou o valor pago.', 'error'); return; }
        if (usdt > 0 && cot === 0)   { toast('Informe a Cotação de Compra.', 'error'); return; }

        const now = new Date();
        opFornecedor.unshift({
            ref:       Date.now(),
            data:      now.toLocaleDateString('pt-BR'),
            hora:      now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            usdt, cotacao: cot, totalBrl: total, pix, pendente: usdt,
            refPagto: ref, fornecedor: forn
        });
        salvarFornecedor();
        carregarFornecedor();
        limparForn();
        toast('Operação registrada com sucesso!');
    });

    if (iFiltroD) iFiltroD.addEventListener('change', carregarFornecedor);
    if (btnLimp)  btnLimp.addEventListener('click', () => { iFiltroD.value = ''; carregarFornecedor(); });

    // Adicionar fornecedor
    if (btnAddF && inputNovoF) {
        btnAddF.addEventListener('click', () => {
            const nome = inputNovoF.value.trim();
            if (!nome) { toast('Digite o nome do fornecedor.', 'error'); return; }
            if (cadFornecedores.includes(nome)) { toast('Fornecedor já cadastrado.', 'error'); return; }
            cadFornecedores.push(nome);
            salvarFornecedores();
            popularSelectForn();
            if (iSelForn) iSelForn.value = nome;
            inputNovoF.value = '';
            toast('Fornecedor cadastrado!');
        });
    }

    popularSelectForn();
})();

function carregarFornecedor() {
    const iFiltroD = document.getElementById('filtro-data');
    const btnLimp  = document.getElementById('btn-limpar-filtro');
    const tbHist   = document.getElementById('tabela-historico');
    if (!tbHist) return;

    let filtroData = '';
    if (iFiltroD && iFiltroD.value) {
        const p = iFiltroD.value.split('-');
        filtroData = `${p[2]}/${p[1]}/${p[0]}`;
        if (btnLimp) btnLimp.style.display = 'inline-block';
    } else {
        if (btnLimp) btnLimp.style.display = 'none';
    }

    const opExibidas = filtroData
        ? opFornecedor.filter(o => o.data === filtroData)
        : [...opFornecedor];

    tbHist.innerHTML = '';
    let totUsdt = 0, totPendente = 0, totBrl = 0, totPix = 0;

    if (!opExibidas.length) {
        tbHist.innerHTML = `<tr><td colspan="9" class="empty-state">${filtroData ? 'Sem operações nesta data.' : 'Nenhuma operação registrada ainda.'}</td></tr>`;
    }

    opExibidas.forEach(op => {
        const idxGlobal = opFornecedor.indexOf(op);
        const saldoUsdt = Math.max(0, op.usdt - opOperacoes.filter(v =>
            v.cotCompra && Math.round(v.cotCompra * 10000) === Math.round(op.cotacao * 10000)
        ).reduce((s, v) => s + (v.usdt || 0), 0));
        const pctUsado  = op.usdt > 0 ? (op.usdt - saldoUsdt) / op.usdt : 0;
        const corSaldo  = saldoUsdt <= 0 ? '#4CAF50' : pctUsado > 0 ? '#ffc107' : '#a0a0a0';

        totUsdt     += op.usdt     || 0;
        totPendente += op.pendente || 0;
        totBrl      += op.totalBrl || 0;
        totPix      += op.pix      || 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${op.data}${op.fornecedor ? `<br><small style="color:#555;font-size:.75rem;">${op.fornecedor}</small>` : ''}</td>
            <td>${op.hora || '—'}</td>
            <td style="color:#4CAF50;font-weight:700;">${fmtDisplay(op.usdt)}</td>
            <td>R$ ${fmtCot(op.cotacao)}</td>
            <td>R$ ${fmtDisplay(op.totalBrl)}</td>
            <td style="color:#2196F3;font-weight:700;">R$ ${fmtDisplay(op.pix)}${op.refPagto ? `<br><small style="color:#555;">${op.refPagto}</small>` : ''}</td>
            <td style="color:${corSaldo};font-weight:700;">${fmtDisplay(saldoUsdt)}</td>
            <td style="color:${(op.pendente || 0) <= 0 ? '#4CAF50' : '#ff5555'};font-weight:700;">${fmtDisplay(op.pendente || 0)}</td>
            <td>
                <div style="display:flex;gap:6px;align-items:center;">
                    <button class="btn-small ok" ${(op.pendente || 0) <= 0 ? 'disabled style="opacity:.3;cursor:not-allowed;"' : ''}>Receber</button>
                    <button class="btn-small del" title="Excluir">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            </td>`;

        const [btnReceber, btnDel] = tr.querySelectorAll('button');

        btnReceber.addEventListener('click', () => {
            if ((op.pendente || 0) <= 0) return;
            const v = prompt(`Falta: ${fmtDisplay(op.pendente)} USDT\nQuantos recebeu agora?`);
            if (!v) return;
            const n = parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;
            if (n <= 0) { toast('Valor inválido.', 'error'); return; }
            if (n > op.pendente) { toast('Maior que o pendente!', 'error'); return; }
            opFornecedor[idxGlobal].pendente -= n;
            salvarFornecedor();
            carregarFornecedor();
            toast(`${fmtDisplay(n)} USDT recebidos!`);
        });

        btnDel.addEventListener('click', () => {
            if (!confirm('Excluir esta operação permanentemente?')) return;
            opFornecedor.splice(idxGlobal, 1);
            salvarFornecedor();
            carregarFornecedor();
            toast('Operação excluída.', 'error');
        });

        tbHist.appendChild(tr);
    });

    const saldoDisp = saldoTotalDisponivel();
    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setEl('card-vol-usdt',       fmtDisplay(totUsdt));
    setEl('card-vol-brl',        'R$ ' + fmtDisplay(totBrl));
    setEl('card-forn-comprado',  fmtDisplay(totUsdt));
    setEl('card-forn-pendente',  fmtDisplay(totPendente));
    setEl('card-pagar-enviado',  'R$ ' + fmtDisplay(totPix));
    setEl('card-pagar-pendente', 'R$ ' + fmtDisplay(Math.max(0, totBrl - totPix)));
    setEl('card-saldo-disponivel', fmtDisplay(saldoDisp) + ' USDT');
    setEl('op-card-saldo',         fmtDisplay(saldoDisp) + ' USDT');

    // PDF
    const btnPDF = document.getElementById('btn-exportar-pdf');
    if (btnPDF) {
        btnPDF.onclick = () => {
            if (!opExibidas.length) { toast('Sem dados para exportar.', 'error'); return; }
            exportarFornecedorPDF(opExibidas);
        };
    }

    dragScroll(document.getElementById('drag-fornecedor'));
}

function exportarFornecedorPDF(dados) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');
    const pw  = doc.internal.pageSize.getWidth();
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('AXONE — Fornecedor', pw / 2, 20, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pw / 2, 28, { align: 'center' });
    doc.autoTable({
        startY: 36,
        head: [['Data', 'Fornecedor', 'USDT', 'Cotação', 'Total (R$)', 'Pago (R$)', 'Pendente']],
        body: dados.map(o => [
            o.data, o.fornecedor || '—', fmtDisplay(o.usdt),
            'R$ ' + fmtCot(o.cotacao), 'R$ ' + fmtDisplay(o.totalBrl),
            'R$ ' + fmtDisplay(o.pix), fmtDisplay(o.pendente || 0)
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [30, 30, 30], textColor: [200, 200, 200] },
    });
    doc.save('axone-fornecedor.pdf');
}

carregarFornecedor();

// ============================================================
// MÓDULO B — CLIENTES
// ============================================================
function atualizarSelectsClientes() {
    const filtroCliHist = document.getElementById('filtro-cliente-hist');
    const opts = cadastrosCli.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
    if (filtroCliHist) filtroCliHist.innerHTML = '<option value="">Todos</option>' + opts;
    // Atualiza select na tabela de operações
    if (window._renderOperacoes) window._renderOperacoes();
}

// Cadastrar cliente
const btnCadCli = document.getElementById('btn-cadastrar-cliente');
if (btnCadCli) {
    btnCadCli.addEventListener('click', () => {
        const nome = (document.getElementById('cad-nome')?.value || '').trim();
        const cont = (document.getElementById('cad-contato')?.value || '').trim();
        const obs  = (document.getElementById('cad-obs')?.value || '').trim();

        if (!nome) { toast('Informe o nome do cliente.', 'error'); return; }
        if (cadastrosCli.find(c => c.nome.toLowerCase() === nome.toLowerCase())) {
            toast('Cliente já cadastrado!', 'error'); return;
        }

        cadastrosCli.push({
            nome, contato: cont, obs,
            criadoEm: new Date().toLocaleDateString('pt-BR')
        });
        salvarCadastros();
        atualizarSelectsClientes();

        document.getElementById('cad-nome').value    = '';
        document.getElementById('cad-contato').value = '';
        document.getElementById('cad-obs').value     = '';

        toast(`Cliente "${nome}" cadastrado com sucesso!`);
        carregarClientes();
    });
}

// Filtros clientes
const filtroCliHist = document.getElementById('filtro-cliente-hist');
const filtroDataCli = document.getElementById('filtro-data-cli');
if (filtroCliHist) filtroCliHist.addEventListener('change', carregarClientes);
if (filtroDataCli) filtroDataCli.addEventListener('change', carregarClientes);

function carregarClientes() {
    atualizarSelectsClientes();

    const filtCli  = filtroCliHist ? filtroCliHist.value : '';
    const filtData = (() => {
        if (!filtroDataCli || !filtroDataCli.value) return '';
        const p = filtroDataCli.value.split('-');
        return `${p[2]}/${p[1]}/${p[0]}`;
    })();

    const tbClientes = document.getElementById('tabela-clientes');
    if (!tbClientes) return;

    let dados = opOperacoes.filter(o => o.cliente);
    if (filtCli)  dados = dados.filter(o => o.cliente === filtCli);
    if (filtData) dados = dados.filter(o => o.data === filtData);

    tbClientes.innerHTML = '';
    if (!dados.length) {
        tbClientes.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhuma venda registrada ainda.</td></tr>';
    }

    const statusCores = { concluida: '#4CAF50', andamento: '#2196F3', falta_pagar: '#ffc107', nos_devemos: '#ff9800', cancelada: '#ff5555' };
    const statusNomes = { concluida: 'Settled', andamento: 'Processing', falta_pagar: 'Payment Pending', nos_devemos: 'Asset Pending', cancelada: 'Voided' };

    dados.forEach(op => {
        const cor = statusCores[op.status] || '#888';
        const txt = statusNomes[op.status] || op.status;
        const tr  = document.createElement('tr');
        tr.innerHTML = `
            <td>${op.data || '—'}</td>
            <td>${op.hora || '—'}</td>
            <td style="font-weight:600;">${op.cliente}</td>
            <td style="color:#4CAF50;font-weight:700;">${fmtDisplay(op.usdt)}</td>
            <td>${op.cotVenda ? 'R$ ' + fmtCot(op.cotVenda) : '—'}</td>
            <td>${op.totalVenda ? 'R$ ' + fmtDisplay(op.totalVenda) : '—'}</td>
            <td style="color:${(op.lucro || 0) > 0 ? '#4CAF50' : '#888'};font-weight:700;">${op.lucro ? 'R$ ' + fmtDisplay(op.lucro) : '—'}</td>
            <td><span class="badge-status" style="color:${cor};background:${cor}22;border:1px solid ${cor}44;display:inline-block;padding:2px 8px;border-radius:20px;font-size:.7rem;font-weight:700;">${txt}</span></td>`;
        tbClientes.appendChild(tr);
    });

    // Cards (sempre sobre todos os dados)
    const todosCli   = opOperacoes.filter(o => o.cliente);
    const pendUsdt   = todosCli.filter(o => o.status === 'nos_devemos').reduce((a, o) => a + (o.usdt || 0), 0);
    const totalUsdt  = todosCli.reduce((a, o) => a + (o.usdt || 0), 0);
    const totalVenda = todosCli.reduce((a, o) => a + (o.totalVenda || 0), 0);
    const totalLucro = todosCli.reduce((a, o) => a + (o.lucro || 0), 0);

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('cli-total-clientes', cadastrosCli.length);
    set('cli-vol-usdt',       fmtDisplay(totalUsdt));
    set('cli-vol-brl',        'R$ ' + fmtDisplay(totalVenda));
    set('cli-pendente-usdt',  fmtDisplay(pendUsdt));
    set('cli-lucro-total',    'R$ ' + fmtDisplay(totalLucro));
}

carregarClientes();
dragScroll(document.getElementById('drag-clientes'));

// ============================================================
// MÓDULO C — DASHBOARD DE LUCRO
// ============================================================
let periodoAtivo = 'semana';
let graficoLucro = null;

document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        periodoAtivo = btn.dataset.period;
        renderLucro();
    });
});

function filtrarPorPeriodo(dados, campo = 'data') {
    const hoje = new Date();
    return dados.filter(op => {
        if (!op[campo]) return false;
        const [d, m, a] = op[campo].split('/');
        const dt = new Date(+a, +m - 1, +d);
        if (periodoAtivo === 'semana') return (hoje - dt) / (1000 * 60 * 60 * 24) <= 7;
        if (periodoAtivo === 'mes')   return dt.getMonth() === hoje.getMonth() && dt.getFullYear() === hoje.getFullYear();
        return true;
    });
}

// Despesas
(function initDespesas() {
    const btnAdd = document.getElementById('btn-add-despesa');
    const iDesc  = document.getElementById('desp-desc');
    const iVal   = document.getElementById('desp-valor');
    const iData  = document.getElementById('desp-data');
    const iCat   = document.getElementById('desp-categoria');
    if (!btnAdd) return;

    iData.value = new Date().toISOString().split('T')[0];
    if (iVal) iVal.addEventListener('input', e => { e.target.value = fmtMoeda(e.target.value); });

    btnAdd.addEventListener('click', () => {
        const desc  = iDesc.value.trim();
        const valor = parseNum(iVal.value);
        const data  = iData.value;
        const cat   = iCat.value;
        if (!desc)  { toast('Informe a descrição.', 'error'); return; }
        if (!valor) { toast('Informe o valor.', 'error'); return; }
        if (!data)  { toast('Informe a data.', 'error'); return; }
        const [a, m, d] = data.split('-');
        opDespesas.unshift({ ref: Date.now(), data: `${d}/${m}/${a}`, desc, valor, cat });
        salvarDespesas();
        iDesc.value = ''; iVal.value = '';
        iData.value = new Date().toISOString().split('T')[0];
        renderLucro();
        toast('Despesa registrada!');
    });
})();

function excluirDespesa(ref) {
    if (!confirm('Excluir esta despesa?')) return;
    opDespesas = opDespesas.filter(d => d.ref !== ref);
    salvarDespesas();
    renderLucro();
    toast('Despesa excluída.');
}

function renderDespesas() {
    const tb = document.getElementById('tabela-despesas');
    if (!tb) return;
    const despPeriodo = filtrarPorPeriodo(opDespesas);
    tb.innerHTML = '';
    if (!despPeriodo.length) {
        tb.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhuma despesa no período.</td></tr>';
        return;
    }
    const catLabel = { operacional: 'Operacional', pessoal: 'Pessoal', tecnologia: 'Tecnologia', outros: 'Outros' };
    despPeriodo.forEach(d => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${d.data}</td>
            <td style="font-weight:600;">${d.desc}</td>
            <td><span class="badge-status pendente">${catLabel[d.cat] || d.cat}</span></td>
            <td style="text-align:right;color:#ff5555;font-weight:700;">R$ ${fmtDisplay(d.valor)}</td>
            <td><button class="btn-small del" onclick="excluirDespesa(${d.ref})">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button></td>`;
        tb.appendChild(tr);
    });
}

function renderLucro() {
    const dados       = filtrarPorPeriodo(opOperacoes);
    const despPeriodo = filtrarPorPeriodo(opDespesas);

    let totLucro = 0, totVolume = 0, qtdOps = 0;
    const lucroPorDia = {};
    const detalhe     = [];

    dados.forEach(op => {
        if (!op.cotVenda || !op.cotCompra || !op.usdt) return;
        const spread  = op.cotVenda - op.cotCompra;
        const lucroOp = spread * op.usdt;
        totLucro  += lucroOp;
        totVolume += op.usdt;
        qtdOps++;
        lucroPorDia[op.data] = (lucroPorDia[op.data] || 0) + lucroOp;
        detalhe.push({ data: op.data, cliente: op.cliente || '—', usdt: op.usdt, cotacaoCompra: op.cotCompra, cotacaoVenda: op.cotVenda, spread, lucroOp });
    });

    const totDespesas  = despPeriodo.reduce((s, d) => s + (d.valor || 0), 0);
    const lucroLiquido = totLucro - totDespesas;
    const spreadMedio  = totVolume > 0 ? totLucro / totVolume : 0;

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('lc-lucro-total',    'R$ ' + fmtDisplay(totLucro));
    set('lc-despesas',       'R$ ' + fmtDisplay(totDespesas));
    set('lc-lucro-liquido',  'R$ ' + fmtDisplay(lucroLiquido));
    set('lc-volume',         fmtDisplay(totVolume) + ' USDT');
    set('lc-spread-medio',   'R$ ' + fmtCot(spreadMedio));
    set('lc-qtd-ops',        qtdOps);

    const elLL = document.getElementById('lc-lucro-liquido');
    if (elLL) elLL.style.color = lucroLiquido >= 0 ? '#2196F3' : '#ff5555';

    // Gráfico
    const diasSet = new Set([...Object.keys(lucroPorDia), ...despPeriodo.map(d => d.data)]);
    const dias    = [...diasSet].sort((a, b) => {
        const [da, ma, aa] = a.split('/'); const [db, mb, ab] = b.split('/');
        return new Date(+aa, +ma - 1, +da) - new Date(+ab, +mb - 1, +db);
    });

    if (graficoLucro) graficoLucro.destroy();
    const ctx = document.getElementById('grafico-lucro')?.getContext('2d');
    if (ctx) {
        graficoLucro = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dias,
                datasets: [
                    { label: 'Lucro', data: dias.map(d => +(lucroPorDia[d] || 0).toFixed(2)), backgroundColor: 'rgba(76,175,80,0.3)', borderColor: 'rgba(76,175,80,0.9)', borderWidth: 2, borderRadius: 4 },
                    { label: 'Despesas', data: dias.map(d => -(despPeriodo.filter(x => x.data === d).reduce((s, x) => s + x.valor, 0))), backgroundColor: 'rgba(255,85,85,0.2)', borderColor: 'rgba(255,85,85,0.7)', borderWidth: 2, borderRadius: 4 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#888', boxWidth: 12 } } }, scales: { x: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#888' } }, y: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#888', callback: v => 'R$ ' + fmtDisplay(v) } } } }
        });
    }

    renderDespesas();

    const tb = document.getElementById('tabela-lucro');
    if (!tb) return;
    tb.innerHTML = '';
    if (!detalhe.length) {
        tb.innerHTML = '<tr><td colspan="7" class="empty-state">Sem operações com spread no período.</td></tr>';
        return;
    }
    detalhe.forEach(op => {
        const cor = op.lucroOp >= 0 ? '#4CAF50' : '#ff5555';
        const tr  = document.createElement('tr');
        tr.innerHTML = `
            <td>${op.data}</td>
            <td style="font-weight:600;">${op.cliente}</td>
            <td>${fmtDisplay(op.usdt)}</td>
            <td>R$ ${fmtCot(op.cotacaoCompra)}</td>
            <td>R$ ${fmtCot(op.cotacaoVenda)}</td>
            <td style="color:#ffc107;font-weight:700;">R$ ${fmtCot(op.spread)}</td>
            <td style="color:${cor};font-weight:700;">R$ ${fmtDisplay(op.lucroOp)}</td>`;
        tb.appendChild(tr);
    });
}

// ============================================================
// MÓDULO D — COTAÇÕES AO VIVO
// ============================================================
let cotacaoAtual      = 0;
let cotacoesIniciadas = false;

function iniciarCotacoes() {
    if (cotacoesIniciadas) return;
    cotacoesIniciadas = true;
    iniciarWidgetTV();
    buscarCotacaoSimples();
    setInterval(buscarCotacaoSimples, 10000);
}

function iniciarWidgetTV() {
    const chartContainer = document.getElementById('tv-chart-container');
    if (!chartContainer || chartContainer.dataset.loaded) return;
    chartContainer.dataset.loaded = '1';

    const script = document.createElement('script');
    script.src   = 'https://s3.tradingview.com/tv.js';
    script.onload = () => {
        if (typeof TradingView === 'undefined') return;
        new TradingView.widget({
            autosize: true, symbol: 'FX_IDC:USDBRL', interval: 'D',
            timezone: 'America/Sao_Paulo', theme: 'dark', style: '1',
            locale: 'br', toolbar_bg: '#111', backgroundColor: 'rgba(13,13,13,1)',
            hide_top_toolbar: false, hide_legend: false, save_image: false,
            container_id: 'tv-chart-container',
        });
    };
    document.body.appendChild(script);
}

async function buscarCotacaoSimples() {
    // Tenta Binance primeiro
    try {
        const r = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=USDTBRL');
        if (!r.ok) throw new Error('Binance ' + r.status);
        const d   = await r.json();
        let preco = parseFloat(d.lastPrice);
        if (preco < 1 && preco > 0) preco = 1 / preco;
        if (preco < 3) throw new Error('Valor suspeito');
        const lo  = parseFloat(d.lowPrice)          > 1 ? parseFloat(d.lowPrice)          : preco * 0.998;
        const hi  = parseFloat(d.highPrice)         > 1 ? parseFloat(d.highPrice)         : preco * 1.002;
        const pct = parseFloat(d.priceChangePercent) || 0;
        cotacaoAtual = preco;
        atualizarHeroCotacao(preco, lo, hi, pct, 'Binance · USDT/BRL');
        return;
    } catch (_) {}

    // Fallback: AwesomeAPI
    try {
        const r = await fetch('https://economia.awesomeapi.com.br/json/last/USDT-BRL', { cache: 'no-store' });
        const d = await r.json();
        const bid = parseFloat(d.USDTBRL.bid);
        if (bid > 1) {
            cotacaoAtual = bid;
            atualizarHeroCotacao(bid, parseFloat(d.USDTBRL.low), parseFloat(d.USDTBRL.high), parseFloat(d.USDTBRL.pctChange) || 0, 'AwesomeAPI · USDT/BRL');
        }
    } catch (_) {}
}

function atualizarHeroCotacao(preco, low, high, pctChg, fonte) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('cot-preco-principal', 'R$ ' + fmtCot(preco));
    set('cot-min',             'R$ ' + fmtCot(low));
    set('cot-max',             'R$ ' + fmtCot(high));
    set('cot-fonte',           fonte);

    const elVar = document.getElementById('cot-variacao');
    if (elVar && pctChg !== 0) {
        elVar.textContent = (pctChg >= 0 ? '▲ +' : '▽ ') + Math.abs(pctChg).toFixed(2) + '% nas últimas 24h';
        elVar.className   = 'ch-change ' + (pctChg >= 0 ? 'up' : 'down');
    }

    set('ticker-price',        'R$ ' + fmtCot(preco));
    set('ticker-price-mobile', 'R$ ' + fmtCot(preco));

    const elTChange = document.getElementById('ticker-change');
    if (elTChange && pctChg !== 0) {
        elTChange.textContent = (pctChg >= 0 ? '+' : '') + pctChg.toFixed(2) + '%';
        elTChange.className   = 'change ' + (pctChg >= 0 ? 'up' : 'down');
    }

    set('ultimo-update', 'Atualizado às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    calcularSpread();
}

function calcularSpread() {
    const elMercado  = document.getElementById('calc-mercado');
    const elFinal    = document.getElementById('calc-preco-final');
    const elSpreadRs = document.getElementById('calc-spread-rs');
    const elInput    = document.getElementById('calc-spread-input');

    if (elMercado) elMercado.textContent = cotacaoAtual > 0 ? 'R$ ' + fmtCot(cotacaoAtual) : '—';

    const spreadPct = parseFloat((elInput ? elInput.value : '0').replace(',', '.')) || 0;
    if (cotacaoAtual > 0 && spreadPct > 0) {
        const precoFinal = cotacaoAtual * (1 + spreadPct / 100);
        if (elFinal)    elFinal.textContent    = 'R$ ' + fmtCot(precoFinal);
        if (elSpreadRs) elSpreadRs.textContent = 'R$ ' + fmtCot(precoFinal - cotacaoAtual);
    } else {
        if (elFinal)    elFinal.textContent    = cotacaoAtual > 0 ? 'R$ ' + fmtCot(cotacaoAtual) : '—';
        if (elSpreadRs) elSpreadRs.textContent = '—';
    }
}

function copiarCotacao() {
    const el    = document.getElementById('calc-preco-final');
    const texto = el?.textContent.replace('R$ ', '').trim();
    if (!texto || texto === '—') { toast('Calcule o spread primeiro.', 'error'); return; }
    navigator.clipboard.writeText(texto).then(() => toast('Número copiado! ✓')).catch(() => toast('Não foi possível copiar.', 'error'));
}

function gerarPrintCotacao() {
    const precoEl = document.getElementById('calc-preco-final');
    const mercEl  = document.getElementById('calc-mercado');
    if (!precoEl || precoEl.textContent === '—') { toast('Calcule o spread primeiro.', 'error'); return; }
    const preco   = precoEl.textContent;
    const mercado = mercEl?.textContent || '—';
    const hora    = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const w = window.open('', '_blank', 'width=540,height=400');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>AXONE — Cotação</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0d0d0d;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:Inter,sans-serif}.card{background:#111;border:1px solid #222;border-radius:16px;padding:40px 48px;width:460px}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid #1e1e1e}.logo-name{font-size:1.2rem;font-weight:700;letter-spacing:5px;color:#fff}.logo-sub{font-size:.6rem;letter-spacing:3px;color:#444;margin-top:3px}.hora{font-size:.72rem;color:#444}.label{font-size:.65rem;letter-spacing:.14em;color:#444;text-transform:uppercase;margin-bottom:10px}.preco{font-size:3.2rem;font-weight:700;color:#fff;letter-spacing:-1px;line-height:1}.footer{display:flex;justify-content:space-between;margin-top:28px;padding-top:18px;border-top:1px solid #1a1a1a;font-size:.72rem;color:#444}.footer span b{color:#777}.btn{display:block;width:100%;margin-top:24px;background:#4CAF50;color:#000;border:none;padding:12px;border-radius:8px;font-weight:700;font-size:.88rem;cursor:pointer;font-family:Inter,sans-serif}@media print{.btn{display:none}}</style>
</head><body><div class="card"><div class="header"><div><div class="logo-name">AXONE</div><div class="logo-sub">FX SUITE</div></div><div class="hora">${hora}</div></div>
<div class="label">USDT / BRL — Cotação de Venda</div><div class="preco">${preco}</div>
<div class="footer"><span>Mercado: <b>${mercado}</b></span><span>Válido por 30 segundos</span></div>
<button class="btn" onclick="window.print()">Imprimir / Salvar PDF</button></div></body></html>`);
    w.document.close();
}

// Modal compartilhar
const btnShare = document.getElementById('btn-abrir-share');
if (btnShare) {
    btnShare.addEventListener('click', () => {
        const url = window.location.href.replace(/[^/]*$/, '') + 'cotacao-cliente.html';
        const elUrl = document.getElementById('link-cliente-url');
        if (elUrl) elUrl.textContent = url;
        const modal = document.getElementById('modal-share');
        if (modal) modal.style.display = 'flex';
    });
}

function fecharModal() {
    const modal = document.getElementById('modal-share');
    if (modal) modal.style.display = 'none';
}

function copiarLink() {
    const url = document.getElementById('link-cliente-url')?.textContent;
    if (url) navigator.clipboard.writeText(url).then(() => toast('Link copiado!')).catch(() => toast('Erro ao copiar.', 'error'));
}

function abrirPaginaCliente() {
    const spread = document.getElementById('calc-spread-input')?.value || '0';
    window.open(`cotacao-cliente.html?spread=${encodeURIComponent(spread)}`, '_blank');
    fecharModal();
}

const modalShare = document.getElementById('modal-share');
if (modalShare) modalShare.addEventListener('click', e => { if (e.target === modalShare) fecharModal(); });

// ============================================================
// MÓDULO E — OPERAÇÕES (tabela estilo Excel)
// ============================================================
let _opInitDone = false;

function initOperacoes() {
    if (_opInitDone) {
        renderTabelaOp();
        atualizarCardsOp();
        return;
    }
    _opInitDone = true;

    const btnNova = document.getElementById('btn-nova-linha-op');
    const btnPDF  = document.getElementById('btn-exportar-op');
    if (btnNova) btnNova.addEventListener('click', () => adicionarLinhaOp());
    if (btnPDF)  btnPDF.addEventListener('click', exportarOpPDF);

    renderTabelaOp();
    atualizarCardsOp();
    dragScroll(document.getElementById('drag-operacoes'));
}

function toggleGlossary() {
    const panel = document.getElementById('sg-panel');
    if (!panel) return;
    const open = panel.style.display === 'none' || panel.style.display === '';
    panel.style.display = open ? 'block' : 'none';
    if (open) {
        setTimeout(() => {
            document.addEventListener('click', function handler(e) {
                if (!document.getElementById('status-glossary')?.contains(e.target)) {
                    panel.style.display = 'none';
                    document.removeEventListener('click', handler);
                }
            });
        }, 0);
    }
}

function adicionarLinhaOp(dados) {
    const agora = new Date();
    const linha = dados || {
        ref:         Date.now(),
        data:        agora.toLocaleDateString('pt-BR'),
        hora:        agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        status:      'andamento',
        cliente:     '',
        usdt:        0,
        cotCompra:   0,
        cotVenda:    0,
        totalCompra: 0,
        totalVenda:  0,
        lucro:       0,
    };
    if (!dados) opOperacoes.unshift(linha);
    salvarOperacoes();
    renderTabelaOp();
    atualizarCardsOp();
    setTimeout(() => {
        const firstInput = document.querySelector('#tabela-operacoes tr:first-child .op-usdt');
        if (firstInput) firstInput.focus();
    }, 50);
}

function renderTabelaOp() {
    const tb = document.getElementById('tabela-operacoes');
    if (!tb) return;

    const focusRef   = document.activeElement?.dataset?.ref;
    const focusField = document.activeElement?.dataset?.field;

    tb.innerHTML = '';

    const statusOpts = [
        { v: 'concluida',   l: 'Settled',         cor: '#4CAF50' },
        { v: 'andamento',   l: 'Processing',      cor: '#2196F3' },
        { v: 'falta_pagar', l: 'Payment Pending', cor: '#ffc107' },
        { v: 'nos_devemos', l: 'Asset Pending',   cor: '#ff9800' },
        { v: 'cancelada',   l: 'Voided',          cor: '#ff5555' },
    ];

    // Lista atualizada de clientes para o select
    const clientes = cadastrosCli.map(c => c.nome);

    opOperacoes.forEach(op => {
        const corLucro = (op.lucro || 0) > 0 ? '#4CAF50' : (op.lucro || 0) < 0 ? '#ff5555' : '#888';
        const stOpt    = statusOpts.find(s => s.v === op.status) || statusOpts[0];
        const tr       = document.createElement('tr');
        tr.dataset.ref = op.ref;

        const cliOpts = clientes.map(n =>
            `<option value="${n}" ${op.cliente === n ? 'selected' : ''}>${n}</option>`
        ).join('');

        tr.innerHTML = `
            <td>
                <input class="cell-input op-data" data-ref="${op.ref}" data-field="data" value="${op.data}" style="width:100px;min-width:100px;">
            </td>
            <td>
                <select class="cell-select op-status" data-ref="${op.ref}" data-field="status" style="color:${stOpt.cor};font-weight:700;">
                    ${statusOpts.map(s => `<option value="${s.v}" ${op.status === s.v ? 'selected' : ''} style="color:${s.cor};font-weight:700;">${s.l}</option>`).join('')}
                </select>
            </td>
            <td>
                <select class="cell-select op-cliente" data-ref="${op.ref}" data-field="cliente">
                    <option value="">— cliente —</option>
                    ${cliOpts}
                </select>
            </td>
            <td class="td-num">
                <input class="cell-input op-usdt" data-ref="${op.ref}" data-field="usdt" value="${op.usdt ? fmtDisplay(op.usdt) : ''}" placeholder="0,00" inputmode="numeric">
            </td>
            <td class="td-num">
                <input class="cell-input op-cot-compra" data-ref="${op.ref}" data-field="cotCompra" value="${op.cotCompra ? fmtCot(op.cotCompra) : ''}" placeholder="0,0000">
            </td>
            <td class="td-num">
                <input class="cell-input op-cot-venda" data-ref="${op.ref}" data-field="cotVenda" value="${op.cotVenda ? fmtCot(op.cotVenda) : ''}" placeholder="0,0000">
            </td>
            <td class="td-num td-calc" style="padding-right:14px;">${op.totalCompra ? 'R$ ' + fmtDisplay(op.totalCompra) : '—'}</td>
            <td class="td-num td-calc" style="padding-right:14px;">${op.totalVenda  ? 'R$ ' + fmtDisplay(op.totalVenda)  : '—'}</td>
            <td class="td-num td-calc" style="padding-right:14px;font-weight:700;color:${corLucro};">${op.lucro ? 'R$ ' + fmtDisplay(op.lucro) : '—'}</td>
            <td style="padding:0 8px;">
                <div style="display:flex;gap:4px;align-items:center;">
                    ${op.cotVenda && op.cliente ? `
                    <button class="btn-small" title="Copiar trava" onclick="copiarTrava(${op.ref})"
                        style="background:rgba(76,175,80,.1);border:1px solid rgba(76,175,80,.3);color:#4CAF50;padding:4px 6px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>` : ''}
                    <button class="btn-small del" title="Excluir" onclick="excluirOperacao(${op.ref})" style="padding:4px 6px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                    </button>
                </div>
            </td>`;

        // Eventos inline
        tr.querySelectorAll('.cell-input').forEach(inp => {
            if (inp.classList.contains('op-usdt')) {
                inp.addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, ''); });
                inp.addEventListener('blur', e => {
                    const num = parseFloat(e.target.value) || 0;
                    if (num > 0) e.target.value = fmtDisplay(num);
                    salvarCelulaOp(e.target);
                });
                inp.addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
            } else {
                inp.addEventListener('change', e => salvarCelulaOp(e.target));
                inp.addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
            }
        });
        tr.querySelectorAll('.cell-select').forEach(sel => {
            sel.addEventListener('change', e => {
                if (e.target.classList.contains('op-status')) {
                    const cores = { concluida: '#4CAF50', andamento: '#2196F3', falta_pagar: '#ffc107', nos_devemos: '#ff9800', cancelada: '#ff5555' };
                    e.target.style.color = cores[e.target.value] || '#e0e0e0';
                }
                salvarCelulaOp(e.target);
            });
        });

        tb.appendChild(tr);
    });

    // Restaura foco
    if (focusRef && focusField) {
        const el = tb.querySelector(`[data-ref="${focusRef}"][data-field="${focusField}"]`);
        if (el) el.focus();
    }

    atualizarCardsOp();
}

function salvarCelulaOp(el) {
    const ref   = parseInt(el.dataset.ref);
    const field = el.dataset.field;
    const idx   = opOperacoes.findIndex(o => o.ref === ref);
    if (idx === -1) return;

    const op = opOperacoes[idx];

    if (field === 'usdt') {
        op[field] = parseNum(el.value) || parseFloat(el.value.replace(/\./g, '').replace(',', '.')) || 0;
    } else if (field === 'cotCompra' || field === 'cotVenda') {
        op[field] = parseNum(el.value);
    } else {
        op[field] = el.value;
    }

    op.totalCompra = (op.usdt && op.cotCompra) ? op.usdt * op.cotCompra : 0;
    op.totalVenda  = (op.usdt && op.cotVenda)  ? op.usdt * op.cotVenda  : 0;
    op.lucro       = (op.totalCompra && op.totalVenda) ? op.totalVenda - op.totalCompra : 0;

    opOperacoes[idx] = op;
    salvarOperacoes();

    // Atualiza células calculadas sem re-render completo
    const tr = document.querySelector(`#tabela-operacoes tr[data-ref="${ref}"]`);
    if (tr) {
        const cells    = tr.querySelectorAll('td');
        const corLucro = op.lucro > 0 ? '#4CAF50' : op.lucro < 0 ? '#ff5555' : '#888';
        cells[6].textContent      = op.totalCompra ? 'R$ ' + fmtDisplay(op.totalCompra) : '—';
        cells[7].textContent      = op.totalVenda  ? 'R$ ' + fmtDisplay(op.totalVenda)  : '—';
        cells[8].style.color      = corLucro;
        cells[8].style.fontWeight = '700';
        cells[8].textContent      = op.lucro ? 'R$ ' + fmtDisplay(op.lucro) : '—';

        // Botão trava
        if (op.cotVenda && op.cliente) {
            const btnDiv = cells[9].querySelector('div');
            if (btnDiv && !btnDiv.querySelector('button[title="Copiar trava"]')) {
                const btn = document.createElement('button');
                btn.className  = 'btn-small';
                btn.title      = 'Copiar trava';
                btn.style.cssText = 'background:rgba(76,175,80,.1);border:1px solid rgba(76,175,80,.3);color:#4CAF50;padding:4px 6px;';
                btn.innerHTML  = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
                btn.onclick    = () => copiarTrava(op.ref);
                btnDiv.insertBefore(btn, btnDiv.firstChild);
            }
        }
    }

    atualizarCardsOp();
    carregarFornecedor();
    carregarClientes();
}

function atualizarCardsOp() {
    const comVenda   = opOperacoes.filter(o => o.cotVenda && o.usdt);
    const totalLucro = comVenda.reduce((s, o) => s + (o.lucro || 0), 0);
    const totalVol   = opOperacoes.reduce((s, o) => s + (o.usdt || 0), 0);
    const volVendido = comVenda.reduce((s, o) => s + (o.usdt || 0), 0);
    const spreadMedio = volVendido > 0 ? totalLucro / volVendido : 0;
    const saldoDisp  = saldoTotalDisponivel();

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('op-card-saldo',   fmtDisplay(saldoDisp) + ' USDT');
    set('op-card-lucro',   'R$ ' + fmtDisplay(totalLucro));
    set('op-card-volume',  fmtDisplay(totalVol) + ' USDT');
    set('op-card-spread',  'R$ ' + fmtCot(spreadMedio));
    set('card-saldo-disponivel', fmtDisplay(saldoDisp) + ' USDT');
}

function excluirOperacao(ref) {
    if (!confirm('Excluir esta linha?')) return;
    opOperacoes = opOperacoes.filter(o => o.ref !== ref);
    salvarOperacoes();
    renderTabelaOp();
    carregarFornecedor();
    carregarClientes();
    toast('Linha excluída.');
}

function copiarTrava(ref) {
    const op = opOperacoes.find(o => o.ref === ref);
    if (!op || !op.cliente || !op.cotVenda) return;
    const trava = `${op.cliente.toUpperCase().padEnd(12, ' ')}   US$ ${fmtDisplay(op.usdt)}   R$ ${fmtCot(op.cotVenda)}   R$ ${fmtDisplay(op.totalVenda)}`;
    navigator.clipboard.writeText(trava).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = trava; document.body.appendChild(ta);
        ta.select(); document.execCommand('copy');
        document.body.removeChild(ta);
    });
    toast('Trava copiada! ✓');
}

function exportarOpPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');
    const pw  = doc.internal.pageSize.getWidth();
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('AXONE — Operações', pw / 2, 20, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pw / 2, 28, { align: 'center' });
    const totalLucro = opOperacoes.reduce((s, o) => s + (o.lucro || 0), 0);
    doc.text(`Lucro Total: R$ ${fmtDisplay(totalLucro)}`, pw / 2, 34, { align: 'center' });
    doc.autoTable({
        startY: 40,
        head: [['Data', 'Status', 'Cliente', 'USDT', 'Cot. Compra', 'Cot. Venda', 'Total Compra', 'Total Venda', 'Lucro']],
        body: opOperacoes.map(o => [
            o.data, o.status, o.cliente || '—', fmtDisplay(o.usdt),
            o.cotCompra ? 'R$ ' + fmtCot(o.cotCompra)   : '—',
            o.cotVenda  ? 'R$ ' + fmtCot(o.cotVenda)    : '—',
            o.totalCompra ? 'R$ ' + fmtDisplay(o.totalCompra) : '—',
            o.totalVenda  ? 'R$ ' + fmtDisplay(o.totalVenda)  : '—',
            o.lucro       ? 'R$ ' + fmtDisplay(o.lucro)       : '—',
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [30, 30, 30], textColor: [200, 200, 200] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
    });
    doc.save('axone-operacoes.pdf');
}

// Expõe para uso externo
window._renderOperacoes = renderTabelaOp;
window._initOperacoes   = initOperacoes;
