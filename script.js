// ============================================================
// KROMA CAPITAL — FX MANAGEMENT SUITE  |  script.js v2.0
// ============================================================

// ── 0. AUTH ─────────────────────────────────────────────────
(function() {
    if (sessionStorage.getItem('kroma_autenticado') !== 'true') {
        window.location.href = 'login.html';
    }
    const u = sessionStorage.getItem('kroma_usuario') || 'gestor';
    const nome = u.charAt(0).toUpperCase() + u.slice(1);
    ['nome-usuario','nome-usuario-mobile'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = nome;
    });
})();

function logout() {
    sessionStorage.clear();
    window.location.href = 'login.html';
}

// ── 0.1 DATA DINÂMICA ────────────────────────────────────────
(function() {
    const el = document.getElementById('data-atual');
    if (el) el.textContent = new Date().toLocaleDateString('pt-BR', {
        weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
    });
})();

// ── 1. FORMATAÇÃO ────────────────────────────────────────────
function fmtMoeda(v) {
    v = v.replace(/\D/g,'');
    v = (v/100).toFixed(2)+'';
    v = v.replace('.',',');
    v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g,'$1.');
    return v;
}
function fmtDisplay(n) {
    return (+n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function fmtCot(n) {
    return (+n||0).toLocaleString('pt-BR',{minimumFractionDigits:4,maximumFractionDigits:4});
}
function parseNum(s) {
    return parseFloat((s||'').replace(/\./g,'').replace(',','.')) || 0;
}

// ── 1.1 TOAST ────────────────────────────────────────────────
function toast(msg, tipo='success') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'show' + (tipo==='error'?' error':'');
    clearTimeout(t._tid);
    t._tid = setTimeout(()=>{ t.className=''; }, 3200);
}

// ── 2. NAVEGAÇÃO ─────────────────────────────────────────────
const pages = { fornecedor:null, clientes:null, lucro:null, cotacoes:null };

document.querySelectorAll('.nav-links a, .nav-drawer a').forEach(a => {
    a.addEventListener('click', e => {
        e.preventDefault();
        const page = a.dataset.page;
        // Marca active em todos os links (desktop + drawer)
        document.querySelectorAll('.nav-links a, .nav-drawer a').forEach(x => x.classList.remove('active'));
        document.querySelectorAll(`[data-page="${page}"]`).forEach(x => x.classList.add('active'));
        document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
        document.getElementById('page-' + page).classList.add('active');
        if (page === 'lucro')      renderLucro();
        if (page === 'cotacoes')   iniciarCotacoes();
        if (page === 'operacoes') { if(window._initOperacoes) window._initOperacoes(); else if(window._renderOperacoes) window._renderOperacoes(); }
    });
});

// ── HAMBURGUER MENU (MOBILE) ─────────────────────────────────
(function() {
    const btn    = document.getElementById('nav-hamburger');
    const drawer = document.getElementById('nav-drawer');
    if (!btn || !drawer) return;

    btn.addEventListener('click', () => {
        const open = drawer.classList.toggle('open');
        btn.classList.toggle('open', open);
        document.body.style.overflow = open ? 'hidden' : '';
    });

    // Fecha ao clicar num link do drawer
    drawer.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
            drawer.classList.remove('open');
            btn.classList.remove('open');
            document.body.style.overflow = '';
        });
    });
})();

// ── 3. BANCO DE DADOS (localStorage) ────────────────────────
let opFornecedor = JSON.parse(localStorage.getItem('banco_cambio'))      || [];
let opClientes   = JSON.parse(localStorage.getItem('banco_clientes'))    || [];
let cadastrosCli = JSON.parse(localStorage.getItem('banco_cadastros'))   || [];
let opOperacoes    = JSON.parse(localStorage.getItem('banco_operacoes'))     || [];
let cadFornecedores = JSON.parse(localStorage.getItem('banco_fornecedores')) || [];

function salvarFornecedor()    { localStorage.setItem('banco_cambio',       JSON.stringify(opFornecedor)); }
function salvarClientes()      { localStorage.setItem('banco_clientes',     JSON.stringify(opClientes)); }
function salvarCadastros()     { localStorage.setItem('banco_cadastros',    JSON.stringify(cadastrosCli)); }
function salvarOperacoes()     { localStorage.setItem('banco_operacoes',    JSON.stringify(opOperacoes)); }
function salvarFornecedores()  { localStorage.setItem('banco_fornecedores', JSON.stringify(cadFornecedores)); }

// ── Saldo disponível por cotação (usado por Operações) ────────
// Retorna quanto USDT ainda resta de cada compra, agrupado por cotação
function saldoPorCotacao() {
    // Constrói mapa de saldo disponível por ref de compra
    const saldos = {};
    // Parte de todas as compras do fornecedor (mais antigas primeiro)
    [...opFornecedor].reverse().forEach(op => {
        saldos[op.ref] = { cotacao: op.cotacao, fornecedor: op.fornecedor || '—', saldo: op.usdt, original: op.usdt };
    });
    // Desconta o que já foi vendido nas operações
    opOperacoes.forEach(venda => {
        if (venda.compraRef && saldos[venda.compraRef] !== undefined) {
            saldos[venda.compraRef].saldo -= (venda.usdt || 0);
        }
    });
    return saldos;
}

// Saldo total disponível (soma de todas as compras menos vendas)
function saldoTotalDisponivel() {
    return Object.values(saldoPorCotacao()).reduce((s, v) => s + Math.max(0, v.saldo), 0);
}

// ============================================================
// MÓDULO E — OPERAÇÕES (tabela estilo Excel)
// ============================================================
// Estrutura de cada linha:
// { ref, data, status, cliente, usdt, cotCompra, cotVenda, totalCompra, totalVenda, lucro }

let _opInitDone = false;

function initOperacoes() {
    if (_opInitDone) return;
    _opInitDone = true;

    const btnNova  = document.getElementById('btn-nova-linha-op');
    const btnPDF   = document.getElementById('btn-exportar-op');
    if (btnNova) btnNova.addEventListener('click', () => { adicionarLinhaOp(); });
    if (btnPDF)  btnPDF.addEventListener('click', exportarOpPDF);

    renderTabelaOp();
    atualizarCardsOp();
    dragScroll(document.getElementById('drag-operacoes'));
}

// ── Adiciona linha nova ou com dados ──────────────────────────
function adicionarLinhaOp(dados) {
    const agora = new Date();
    const linha = dados || {
        ref:        Date.now(),
        data:       agora.toLocaleDateString('pt-BR'),
        status:     'concluida',
        cliente:    '',
        usdt:       0,
        cotCompra:  0,
        cotVenda:   0,
        totalCompra:0,
        totalVenda: 0,
        lucro:      0,
    };
    if (!dados) opOperacoes.unshift(linha);
    salvarOperacoes();
    renderTabelaOp();
    atualizarCardsOp();
    // Foca na célula USDT da primeira linha
    setTimeout(() => {
        const firstInput = document.querySelector('#tabela-operacoes tr:first-child .op-usdt');
        if (firstInput) firstInput.focus();
    }, 50);
}

// ── Renderiza toda a tabela ───────────────────────────────────
function renderTabelaOp() {
    const tb = document.getElementById('tabela-operacoes');
    if (!tb) return;

    // Guarda foco atual para restaurar depois
    const focusRef  = document.activeElement?.dataset?.ref;
    const focusField = document.activeElement?.dataset?.field;

    tb.innerHTML = '';

    const statusOpts = [
        { v:'concluida', l:'Concluída',     cor:'#4CAF50' },
        { v:'andamento', l:'Em Andamento',  cor:'#ffc107' },
        { v:'cancelada', l:'Cancelada',     cor:'#ff5555' },
    ];

    const clientes = cadastrosCli.map(c => c.nome);

    opOperacoes.forEach(op => {
        const corLucro  = (op.lucro||0) > 0 ? '#4CAF50' : (op.lucro||0) < 0 ? '#ff5555' : '#888';
        const stOpt     = statusOpts.find(s => s.v === op.status) || statusOpts[0];
        const tr = document.createElement('tr');
        tr.dataset.ref = op.ref;

        // Monta opções de clientes
        const cliOpts = clientes.map(n =>
            `<option value="${n}" ${op.cliente===n?'selected':''}>${n}</option>`
        ).join('');

        tr.innerHTML = `
            <td>
                <input class="cell-input op-data" data-ref="${op.ref}" data-field="data"
                    value="${op.data}" style="width:90px;">
            </td>
            <td>
                <select class="cell-select op-status" data-ref="${op.ref}" data-field="status"
                    style="color:${stOpt.cor};">
                    ${statusOpts.map(s=>`<option value="${s.v}" ${op.status===s.v?'selected':''} style="color:${s.cor};">${s.l}</option>`).join('')}
                </select>
            </td>
            <td>
                <select class="cell-select op-cliente" data-ref="${op.ref}" data-field="cliente">
                    <option value="">— cliente —</option>
                    ${cliOpts}
                </select>
            </td>
            <td>
                <input class="cell-input op-usdt" data-ref="${op.ref}" data-field="usdt"
                    value="${op.usdt ? fmtDisplay(op.usdt) : ''}" placeholder="0,00" style="text-align:right;">
            </td>
            <td>
                <input class="cell-input op-cot-compra" data-ref="${op.ref}" data-field="cotCompra"
                    value="${op.cotCompra ? fmtCot(op.cotCompra) : ''}" placeholder="0,0000" style="text-align:right;">
            </td>
            <td>
                <input class="cell-input op-cot-venda" data-ref="${op.ref}" data-field="cotVenda"
                    value="${op.cotVenda ? fmtCot(op.cotVenda) : ''}" placeholder="0,0000" style="text-align:right;">
            </td>
            <td style="text-align:right;color:#a0a0a0;padding:0 10px;">
                ${op.totalCompra ? 'R$ '+fmtDisplay(op.totalCompra) : '—'}
            </td>
            <td style="text-align:right;color:#a0a0a0;padding:0 10px;">
                ${op.totalVenda ? 'R$ '+fmtDisplay(op.totalVenda) : '—'}
            </td>
            <td style="text-align:right;font-weight:700;color:${corLucro};padding:0 10px;">
                ${op.lucro ? 'R$ '+fmtDisplay(op.lucro) : '—'}
            </td>
            <td style="padding:0 8px;">
                <div style="display:flex;gap:4px;align-items:center;">
                    ${op.cotVenda && op.cliente ? `
                    <button class="btn-small" title="Copiar trava" onclick="copiarTrava(${op.ref})"
                        style="background:rgba(76,175,80,.1);border:1px solid rgba(76,175,80,.3);color:#4CAF50;padding:4px 6px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>` : ''}
                    <button class="btn-small del" title="Excluir linha" onclick="excluirOperacao(${op.ref})"
                        style="padding:4px 6px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                    </button>
                </div>
            </td>`;

        // Eventos de edição inline
        tr.querySelectorAll('.cell-input').forEach(inp => {
            inp.addEventListener('change', e => salvarCelulaOp(e.target));
            inp.addEventListener('keydown', e => { if (e.key==='Enter') e.target.blur(); });
        });
        tr.querySelectorAll('.cell-select').forEach(sel => {
            sel.addEventListener('change', e => salvarCelulaOp(e.target));
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

// ── Salva alteração de uma célula e recalcula lucro ───────────
function salvarCelulaOp(el) {
    const ref   = parseInt(el.dataset.ref);
    const field = el.dataset.field;
    const idx   = opOperacoes.findIndex(o => o.ref === ref);
    if (idx === -1) return;

    const op = opOperacoes[idx];

    if (field === 'usdt' || field === 'cotCompra' || field === 'cotVenda') {
        op[field] = parseNum(el.value);
    } else {
        op[field] = el.value;
    }

    // Recalcula totais e lucro
    if (op.usdt && op.cotCompra) op.totalCompra = op.usdt * op.cotCompra;
    else op.totalCompra = 0;

    if (op.usdt && op.cotVenda)  op.totalVenda = op.usdt * op.cotVenda;
    else op.totalVenda = 0;

    if (op.totalCompra && op.totalVenda) op.lucro = op.totalVenda - op.totalCompra;
    else op.lucro = 0;

    opOperacoes[idx] = op;
    salvarOperacoes();

    // Atualiza só as células calculadas da linha sem re-renderizar tudo
    const tr = document.querySelector(`#tabela-operacoes tr[data-ref="${ref}"]`);
    if (tr) {
        const cells = tr.querySelectorAll('td');
        const corLucro = op.lucro > 0 ? '#4CAF50' : op.lucro < 0 ? '#ff5555' : '#888';
        cells[6].textContent = op.totalCompra ? 'R$ '+fmtDisplay(op.totalCompra) : '—';
        cells[7].textContent = op.totalVenda  ? 'R$ '+fmtDisplay(op.totalVenda)  : '—';
        cells[8].style.color = corLucro;
        cells[8].textContent = op.lucro ? 'R$ '+fmtDisplay(op.lucro) : '—';
        // Atualiza botão trava
        const btnDiv = cells[9].querySelector('div');
        if (btnDiv) {
            const jaTemTrava = btnDiv.querySelector('button[title="Copiar trava"]');
            if (op.cotVenda && op.cliente && !jaTemTrava) {
                const btn = document.createElement('button');
                btn.className = 'btn-small';
                btn.title = 'Copiar trava';
                btn.style.cssText = 'background:rgba(76,175,80,.1);border:1px solid rgba(76,175,80,.3);color:#4CAF50;padding:4px 6px;';
                btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
                btn.onclick = () => copiarTrava(op.ref);
                btnDiv.insertBefore(btn, btnDiv.firstChild);
            }
        }
        // Atualiza cor do status select
        const selStatus = tr.querySelector('.op-status');
        if (selStatus && field === 'status') {
            const stOpts = { concluida:'#4CAF50', andamento:'#ffc107', cancelada:'#ff5555' };
            selStatus.style.color = stOpts[op.status] || '#fff';
        }
    }

    atualizarCardsOp();
    carregarFornecedor(); // atualiza saldo disponível
}

// ── Cards de resumo ───────────────────────────────────────────
function atualizarCardsOp() {
    const comVenda    = opOperacoes.filter(o => o.cotVenda && o.usdt);
    const totalLucro  = comVenda.reduce((s,o) => s+(o.lucro||0), 0);
    const totalVol    = opOperacoes.reduce((s,o) => s+(o.usdt||0), 0);
    const volVendido  = comVenda.reduce((s,o) => s+(o.usdt||0), 0);
    const spreadMedio = volVendido > 0 ? totalLucro/volVendido : 0;
    const saldoDisp   = saldoTotalDisponivel();

    const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
    set('op-card-saldo',   fmtDisplay(saldoDisp)+' USDT');
    set('op-card-lucro',   'R$ '+fmtDisplay(totalLucro));
    set('op-card-volume',  fmtDisplay(totalVol)+' USDT');
    set('op-card-spread',  'R$ '+fmtCot(spreadMedio));

    const elForn = document.getElementById('card-saldo-disponivel');
    if (elForn) elForn.textContent = fmtDisplay(saldoDisp)+' USDT';
}

// ── Excluir linha ─────────────────────────────────────────────
function excluirOperacao(ref) {
    if (!confirm('Excluir esta linha?')) return;
    opOperacoes = opOperacoes.filter(o => o.ref !== ref);
    salvarOperacoes();
    renderTabelaOp();
    carregarFornecedor();
    toast('Linha excluída.');
}

// ── Copiar trava para cliente ─────────────────────────────────
function copiarTrava(ref) {
    const op = opOperacoes.find(o => o.ref === ref);
    if (!op || !op.cliente || !op.cotVenda) return;
    const nome  = op.cliente.toUpperCase().padEnd(12,' ');
    const usdt  = 'US$ '+fmtDisplay(op.usdt);
    const cot   = 'R$ '+fmtCot(op.cotVenda);
    const total = 'R$ '+fmtDisplay(op.totalVenda);
    const trava = `${nome}   ${usdt}   ${cot}   ${total}`;
    navigator.clipboard.writeText(trava).catch(() => {
        const ta = document.createElement('textarea');
        ta.value=trava; document.body.appendChild(ta);
        ta.select(); document.execCommand('copy');
        document.body.removeChild(ta);
    });
    toast('Trava copiada! ✓');
}

// ── Exportar PDF ──────────────────────────────────────────────
function exportarOpPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l','mm','a4');
    const pw  = doc.internal.pageSize.getWidth();

    doc.setFontSize(16); doc.setFont('helvetica','bold');
    doc.text('Kroma Capital — Operações', pw/2, 20, {align:'center'});
    doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pw/2, 28, {align:'center'});
    const totalLucro = opOperacoes.reduce((s,o)=>s+(o.lucro||0),0);
    doc.text(`Lucro Total: R$ ${fmtDisplay(totalLucro)}`, pw/2, 34, {align:'center'});

    doc.autoTable({
        startY: 40,
        head: [['Data','Status','Cliente','USDT','Cot. Compra','Cot. Venda','Total Compra','Total Venda','Lucro']],
        body: opOperacoes.map(o => [
            o.data, o.status, o.cliente||'—',
            fmtDisplay(o.usdt),
            o.cotCompra ? 'R$ '+fmtCot(o.cotCompra) : '—',
            o.cotVenda  ? 'R$ '+fmtCot(o.cotVenda)  : '—',
            o.totalCompra ? 'R$ '+fmtDisplay(o.totalCompra) : '—',
            o.totalVenda  ? 'R$ '+fmtDisplay(o.totalVenda)  : '—',
            o.lucro       ? 'R$ '+fmtDisplay(o.lucro)       : '—',
        ]),
        styles: { fontSize:8, cellPadding:3 },
        headStyles: { fillColor:[30,30,30], textColor:[200,200,200] },
        alternateRowStyles: { fillColor:[245,245,245] },
    });
    doc.save('kroma-operacoes.pdf');
}

// Expõe para navegação
window._renderOperacoes = renderTabelaOp;
window._initOperacoes   = initOperacoes;


// ============================================================
// MÓDULO A — FORNECEDOR
// ============================================================
(function() {
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

    if (!btnReg) return;

    function calcTotalForn() {
        const total = parseNum(iValComp.value) * parseNum(iCot.value);
        iTotAuto.value = total > 0 ? fmtDisplay(total) : '';
    }

    iValComp.addEventListener('input', e => { e.target.value = fmtMoeda(e.target.value); calcTotalForn(); });
    iCot.addEventListener('input', calcTotalForn);
    iValPix.addEventListener('input', e => { e.target.value = fmtMoeda(e.target.value); });

    function limparForn() {
        iValComp.value=''; iCot.value=''; iTotAuto.value=''; iValPix.value='';
        if (iRefPix) iRefPix.value='';
        iValComp.focus();
    }
    btnCan.addEventListener('click', limparForn);
    document.addEventListener('keydown', e => { if (e.key==='Escape') limparForn(); });

    btnReg.addEventListener('click', () => {
        const usdt  = parseNum(iValComp.value);
        const cot   = parseNum(iCot.value);
        const total = parseNum(iTotAuto.value) || usdt * cot;
        const pix   = parseNum(iValPix.value);
        const ref   = iRefPix ? iRefPix.value.trim() : '';
        const forn  = iSelForn ? iSelForn.value.trim() : '';

        if (usdt===0 && pix===0) { toast('Preencha USDT ou o valor pago.','error'); return; }
        if (usdt>0 && cot===0)   { toast('Informe a Cotação de Compra.','error'); return; }
        if (!forn)               { toast('Selecione ou cadastre um fornecedor.','error'); return; }

        const now = new Date();
        opFornecedor.unshift({
            ref:        Date.now(),
            data:       now.toLocaleDateString('pt-BR'),
            hora:       now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),
            usdt, cotacao:cot, totalBrl:total, pix, pendente:usdt, ref, fornecedor:forn
        });
        salvarFornecedor();
        carregarFornecedor();
        limparForn();
        toast('Operação registrada com sucesso!', 'success');
    });

    if (iFiltroD) iFiltroD.addEventListener('change', carregarFornecedor);
    if (btnLimp)  btnLimp.addEventListener('click', () => { iFiltroD.value=''; carregarFornecedor(); });

    // ── Gestão de fornecedores ────────────────────────────────
    const btnAddForn  = document.getElementById('btn-add-fornecedor');
    const inputNovoF  = document.getElementById('input-novo-fornecedor');

    function popularSelectForn() {
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

    if (btnAddForn && inputNovoF) {
        btnAddForn.addEventListener('click', () => {
            const nome = inputNovoF.value.trim();
            if (!nome) { toast('Digite o nome do fornecedor.','error'); return; }
            if (cadFornecedores.includes(nome)) { toast('Fornecedor já cadastrado.','error'); return; }
            cadFornecedores.push(nome);
            salvarFornecedores();
            popularSelectForn();
            iSelForn.value = nome;
            inputNovoF.value = '';
            toast('Fornecedor cadastrado!');
        });
    }

    popularSelectForn();
    window._popularSelectForn = popularSelectForn;
    window._carregarFornecedor = carregarFornecedor;
})();

let opExibidas = [];

function carregarFornecedor() {
    const iFiltroD = document.getElementById('filtro-data');
    const btnLimp  = document.getElementById('btn-limpar-filtro');
    const tbHist   = document.getElementById('tabela-historico');
    if (!tbHist) return;

    let filtroData = '';
    if (iFiltroD && iFiltroD.value) {
        const p = iFiltroD.value.split('-');
        filtroData = `${p[2]}/${p[1]}/${p[0]}`;
        if (btnLimp) btnLimp.style.display='inline-block';
    } else {
        if (btnLimp) btnLimp.style.display='none';
    }

    opExibidas = filtroData ? opFornecedor.filter(o=>o.data===filtroData) : [...opFornecedor];

    // Calcula saldo de cada compra (descontando vendas já feitas)
    const saldos = saldoPorCotacao();

    tbHist.innerHTML = '';
    let totUsdt=0, totPendente=0, totBrl=0, totPix=0;

    if (!opExibidas.length) {
        const msg = filtroData ? `Sem operações em ${filtroData}.` : 'Nenhuma operação registrada ainda.';
        tbHist.innerHTML = `<tr><td colspan="9" class="empty-state">${msg}</td></tr>`;
    }

    opExibidas.forEach(op => {
        const idx         = opFornecedor.indexOf(op);
        const saldoInfo   = saldos[op.ref] || {};
        const saldoUsdt   = saldoInfo.saldo !== undefined ? Math.max(0, saldoInfo.saldo) : op.usdt;
        const vendido     = op.usdt - saldoUsdt;

        totUsdt     += op.usdt;
        totPendente += op.pendente;
        totBrl      += op.totalBrl;
        totPix      += op.pix;

        const corSaldo = saldoUsdt <= 0 ? '#4CAF50' : saldoUsdt < op.usdt ? '#ffc107' : '#ff5555';
        const refStr   = op.ref ? `<br><small style="color:#888;font-weight:normal;">${op.ref}</small>` : '';
        const fornStr  = op.fornecedor ? `<br><small style="color:#888;">${op.fornecedor}</small>` : '';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${op.data}${fornStr}</td>
            <td>${op.hora}</td>
            <td style="color:#4CAF50;font-weight:700;">${fmtDisplay(op.usdt)}</td>
            <td>R$ ${fmtCot(op.cotacao)}</td>
            <td>R$ ${fmtDisplay(op.totalBrl)}</td>
            <td style="color:#2196F3;font-weight:700;">R$ ${fmtDisplay(op.pix)}${refStr}</td>
            <td style="color:${corSaldo};font-weight:700;" title="Vendido: ${fmtDisplay(vendido)} USDT">
                ${fmtDisplay(saldoUsdt)}
                ${vendido>0?`<br><small style="color:#888;font-weight:normal;">Vendido: ${fmtDisplay(vendido)}</small>`:''}
            </td>
            <td style="color:${op.pendente<=0?'#4CAF50':'#ff5555'};font-weight:700;">${fmtDisplay(op.pendente)}</td>
            <td style="display:flex;gap:6px;">
                <button class="btn-small ok" ${op.pendente<=0?'disabled style="opacity:.3;cursor:not-allowed;"':''}>Receber</button>
                <button class="btn-small del" title="Excluir">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </td>`;

        tr.querySelectorAll('button')[0].addEventListener('click', () => {
            if (op.pendente<=0) return;
            const v = prompt(`Falta: ${fmtDisplay(op.pendente)} USDT\nQuantos recebeu agora?`);
            if (!v) return;
            const n = parseFloat(v.replace(/\./g,'').replace(',','.')) || 0;
            if (n<=0) { toast('Valor inválido.','error'); return; }
            if (n>op.pendente) { toast('Maior que o pendente!','error'); return; }
            opFornecedor[idx].pendente -= n;
            salvarFornecedor();
            carregarFornecedor();
            toast(`${fmtDisplay(n)} USDT recebidos!`, 'success');
        });
        tr.querySelectorAll('button')[1].addEventListener('click', () => {
            if (confirm('Excluir esta operação permanentemente?')) {
                opFornecedor.splice(idx,1);
                salvarFornecedor();
                carregarFornecedor();
                toast('Operação excluída.', 'error');
            }
        });
        tbHist.appendChild(tr);
    });

    let pendBrl = totBrl - totPix;
    if (pendBrl<0) pendBrl=0;

    const saldoDisp = saldoTotalDisponivel();
    document.getElementById('card-vol-usdt').textContent      = fmtDisplay(totUsdt);
    document.getElementById('card-vol-brl').textContent       = 'R$ '+fmtDisplay(totBrl);
    document.getElementById('card-forn-comprado').textContent  = fmtDisplay(totUsdt);
    document.getElementById('card-forn-pendente').textContent  = fmtDisplay(totPendente);
    document.getElementById('card-pagar-enviado').textContent  = 'R$ '+fmtDisplay(totPix);
    document.getElementById('card-pagar-pendente').textContent = 'R$ '+fmtDisplay(pendBrl);

    // Card saldo disponível (novo)
    const elSaldo = document.getElementById('card-saldo-disponivel');
    if (elSaldo) elSaldo.textContent = fmtDisplay(saldoDisp) + ' USDT';

    // Atualiza card de saldo em Operações também
    const elOpSaldo = document.getElementById('op-card-saldo');
    if (elOpSaldo) elOpSaldo.textContent = fmtDisplay(saldoDisp) + ' USDT';

    // Exportar PDF
    const btnPDF = document.getElementById('btn-exportar-pdf');
    if (btnPDF) {
        btnPDF.onclick = () => {
            if (!opExibidas.length) { toast('Sem dados para exportar.','error'); return; }
            exportarPDF(opExibidas);
        };
    }

    dragScroll(document.getElementById('drag-fornecedor'));
}

carregarFornecedor();
// ============================================================
// MÓDULO B — CLIENTES
// ============================================================
const tbClientes     = document.getElementById('tabela-clientes');
const filtroCliHist  = document.getElementById('filtro-cliente-hist');
const filtroDataCli  = document.getElementById('filtro-data-cli');

// Cadastrar cliente
document.getElementById('btn-cadastrar-cliente').addEventListener('click', ()=>{
    const nome = document.getElementById('cad-nome').value.trim();
    const cont = document.getElementById('cad-contato').value.trim();
    const obs  = document.getElementById('cad-obs').value.trim();
    if (!nome) { toast('Informe o nome do cliente.','error'); return; }
    if (cadastrosCli.find(c=>c.nome.toLowerCase()===nome.toLowerCase())) {
        toast('Cliente já cadastrado!','error'); return;
    }
    cadastrosCli.push({nome, contato:cont, obs, criadoEm: new Date().toLocaleDateString('pt-BR')});
    salvarCadastros();
    atualizarSelectsClientes();
    document.getElementById('cad-nome').value='';
    document.getElementById('cad-contato').value='';
    document.getElementById('cad-obs').value='';
    toast(`Cliente "${nome}" cadastrado com sucesso!`, 'success');
});

function atualizarSelectsClientes() {
    const opts = cadastrosCli.map(c=>`<option value="${c.nome}">${c.nome}</option>`).join('');
    if (filtroCliHist) filtroCliHist.innerHTML = '<option value="">Todos</option>' + opts;
    // Atualiza select de operações também
    if (window._popularClientesOp) window._popularClientesOp();
}

function carregarClientes() {
    atualizarSelectsClientes();

    const filtCli  = filtroCliHist ? filtroCliHist.value : '';
    const filtData = (() => {
        if (!filtroDataCli || !filtroDataCli.value) return '';
        const p = filtroDataCli.value.split('-');
        return `${p[2]}/${p[1]}/${p[0]}`;
    })();

    let dados = [...opClientes];
    if (filtCli)  dados = dados.filter(o=>o.cliente===filtCli);
    if (filtData) dados = dados.filter(o=>o.data===filtData);

    tbClientes.innerHTML = '';

    if (!dados.length) {
        tbClientes.innerHTML = '<tr><td colspan="10" class="empty-state">Nenhuma venda registrada ainda.</td></tr>';
    }

    let totUsdt=0, totBrl=0, totPend=0;
    dados.forEach(op => {
        const idx = opClientes.indexOf(op);
        totUsdt += op.usdt;
        totBrl  += op.pagoBrl;
        if (op.statusEnvio !== 'enviado') totPend += op.usdt;

        const badgeCls = op.statusEnvio==='enviado'?'enviado': op.statusEnvio==='parcial'?'parcial':'pendente';
        const badgeTxt = op.statusEnvio==='enviado'?'Enviado': op.statusEnvio==='parcial'?'Parcial':'Pendente';

        const saldo = getSaldoCliente(op.cliente);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${op.data}</td>
            <td>${op.hora}</td>
            <td style="font-weight:600;">${op.cliente}</td>
            <td style="color:#4CAF50;font-weight:700;">${fmtDisplay(op.usdt)}</td>
            <td>R$ ${fmtCot(op.cotacaoVenda)}</td>
            <td>R$ ${fmtDisplay(op.totalBrl)}</td>
            <td style="color:#2196F3;font-weight:700;">R$ ${fmtDisplay(op.pagoBrl)}</td>
            <td style="color:#ffc107;font-weight:700;">${fmtDisplay(saldo)}</td>
            <td><span class="badge-status ${badgeCls}">${badgeTxt}</span></td>
            <td style="display:flex;gap:5px;">
                <button class="btn-small ok">Enviar</button>
                <button class="btn-small del" title="Excluir"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </td>`;

        tr.querySelectorAll('button')[0].addEventListener('click', ()=>{
            const novoStatus = op.statusEnvio==='enviado'?'pendente':'enviado';
            opClientes[idx].statusEnvio = novoStatus;
            salvarClientes();
            carregarClientes();
            toast(novoStatus==='enviado'?'Marcado como Enviado.':'Revertido para Pendente.');
        });
        tr.querySelectorAll('button')[1].addEventListener('click', ()=>{
            if (confirm('Excluir esta venda?')) {
                opClientes.splice(idx,1);
                salvarClientes();
                carregarClientes();
                toast('Venda excluída.', 'error');
            }
        });
        tbClientes.appendChild(tr);
    });

    // Cards
    document.getElementById('cli-total-clientes').textContent = cadastrosCli.length;
    document.getElementById('cli-vol-usdt').textContent = fmtDisplay(opClientes.reduce((a,o)=>a+o.usdt,0));
    document.getElementById('cli-vol-brl').textContent  = 'R$ '+fmtDisplay(opClientes.reduce((a,o)=>a+o.pagoBrl,0));
    document.getElementById('cli-pendente-usdt').textContent = fmtDisplay(opClientes.filter(o=>o.statusEnvio!=='enviado').reduce((a,o)=>a+o.usdt,0));
}

if (filtroCliHist) filtroCliHist.addEventListener('change', carregarClientes);
if (filtroDataCli) filtroDataCli.addEventListener('change', carregarClientes);

carregarClientes();
dragScroll(document.getElementById('drag-clientes'));

// ============================================================
// MÓDULO C — DASHBOARD DE LUCRO
// ============================================================
let periodoAtivo = 'semana';
let graficoLucro = null;

document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', ()=>{
        document.querySelectorAll('.period-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        periodoAtivo = btn.dataset.period;
        renderLucro();
    });
});

function filtrarPorPeriodo(dados, campo='data') {
    const hoje = new Date();
    return dados.filter(op => {
        const [d,m,a] = op[campo].split('/');
        const dt = new Date(+a, +m-1, +d);
        if (periodoAtivo==='semana') {
            const diff = (hoje-dt)/(1000*60*60*24);
            return diff <= 7;
        }
        if (periodoAtivo==='mes') {
            return dt.getMonth()===hoje.getMonth() && dt.getFullYear()===hoje.getFullYear();
        }
        return true;
    });
}

function renderLucro() {
    // Precisa ter operação de cliente COM cotação de compra registrada
    const dados = filtrarPorPeriodo(opClientes);

    let totLucro=0, totVolume=0, qtdOps=0;
    const lucroPorDia = {};
    const detalhe = [];

    dados.forEach(op => {
        if (!op.cotacaoVenda || !op.cotacaoCompra) return;
        const spread    = op.cotacaoVenda - op.cotacaoCompra;
        const lucroOp   = spread * op.usdt;
        totLucro  += lucroOp;
        totVolume += op.usdt;
        qtdOps++;

        lucroPorDia[op.data] = (lucroPorDia[op.data]||0) + lucroOp;
        detalhe.push({...op, spread, lucroOp});
    });

    const spreadMedio = totVolume > 0 ? totLucro/totVolume : 0;

    document.getElementById('lc-lucro-total').textContent  = 'R$ '+fmtDisplay(totLucro);
    document.getElementById('lc-volume').textContent       = fmtDisplay(totVolume)+' USDT';
    document.getElementById('lc-spread-medio').textContent = 'R$ '+fmtCot(spreadMedio);
    document.getElementById('lc-qtd-ops').textContent      = qtdOps;

    // Gráfico de barras
    const dias   = Object.keys(lucroPorDia).sort((a,b)=>{
        const [da,ma,aa]=a.split('/'); const [db,mb,ab]=b.split('/');
        return new Date(+aa,+ma-1,+da)-new Date(+ab,+mb-1,+db);
    });
    const valores = dias.map(d=>+lucroPorDia[d].toFixed(2));

    if (graficoLucro) graficoLucro.destroy();
    const ctx = document.getElementById('grafico-lucro').getContext('2d');
    graficoLucro = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dias,
            datasets: [{
                label: 'Lucro (R$)',
                data: valores,
                backgroundColor: 'rgba(76,175,80,0.25)',
                borderColor: 'rgba(76,175,80,0.9)',
                borderWidth: 2,
                borderRadius: 6,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend:{display:false} },
            scales: {
                x: { grid:{color:'rgba(255,255,255,.05)'}, ticks:{color:'#888'} },
                y: { grid:{color:'rgba(255,255,255,.05)'}, ticks:{color:'#888', callback: v=>'R$ '+fmtDisplay(v)} }
            }
        }
    });

    // Tabela detalhamento
    const tb = document.getElementById('tabela-lucro');
    tb.innerHTML = '';
    if (!detalhe.length) {
        tb.innerHTML = '<tr><td colspan="7" class="empty-state">Sem dados no período. Registre vendas com cotação de compra para ver o lucro.</td></tr>';
        return;
    }
    detalhe.forEach(op => {
        const cor = op.lucroOp >= 0 ? '#4CAF50' : '#ff5555';
        const tr = document.createElement('tr');
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
let graficoCotacao    = null;
let cotacoesIniciadas = false;
let velasData         = []; // dados do gráfico de velas

function iniciarCotacoes() {
    if (cotacoesIniciadas) return;
    cotacoesIniciadas = true;
    buscarCotacao();
    buscarVelas();
    setInterval(buscarCotacao, 15000);
    setInterval(buscarVelas,  300000); // atualiza velas a cada 5 min
}

// ── Cotação USDT/BRL — BCB (USD/BRL) × Binance (USDT/USD) ──────
// Fórmula: USDT/BRL = USD/BRL × USDT/USD  (igual ao TradingView)
async function buscarCotacao() {
    try {
        // Busca USD/BRL do BCB e USDT/USD da Binance em paralelo
        const [rBcb, rBin] = await Promise.all([
            fetch(`https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@d)?@d='${bcbDataHoje()}'&$top=1&$orderby=dataHoraCotacao%20desc&$format=json&$select=cotacaoCompra,cotacaoVenda`),
            fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=USDTUSDT').catch(()=>null)
        ]);

        const dBcb = await rBcb.json();
        if (!dBcb.value || !dBcb.value.length) throw new Error('BCB sem dados');

        const usdBrl = (parseFloat(dBcb.value[0].cotacaoCompra) + parseFloat(dBcb.value[0].cotacaoVenda)) / 2;

        // USDT/USD — normalmente ~1.0000 mas pode variar levemente
        let usdtUsd = 1.0;
        if (rBin) {
            try {
                // USDTUSDT não existe — usa BTCUSDT/BTCUSDT proxy ou assume 1.0
                // Melhor: busca USDT na Binance diretamente
                const rb2 = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=USDCUSDT');
                // USDC≈USDT, ambos ≈1 USD. Usar como proxy do USDT/USD
                const db2 = await rb2.json();
                usdtUsd = parseFloat(db2.price) || 1.0;
            } catch(_) { usdtUsd = 1.0; }
        }

        cotacaoAtual = usdBrl * usdtUsd;

        // Variação % via Binance USDTBRL
        let pctChg = 0, lo = cotacaoAtual * 0.998, hi = cotacaoAtual * 1.002;
        try {
            const rb3 = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=USDTBRL');
            const db3 = await rb3.json();
            pctChg = parseFloat(db3.priceChangePercent) || 0;
            const binLo = parseFloat(db3.lowPrice);
            const binHi = parseFloat(db3.highPrice);
            // Binance low/high podem estar invertidos (valor < 1)
            lo = binLo > 1 ? binLo : usdBrl * 0.998;
            hi = binHi > 1 ? binHi : usdBrl * 1.002;
        } catch(_) {}

        atualizarHeroCotacao(cotacaoAtual, lo, hi, pctChg, 'BCB × Binance · USDT/BRL');

    } catch(e) {
        // Fallback: só Binance com correção
        try {
            const rb = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=USDTBRL');
            const db = await rb.json();
            let preco = parseFloat(db.lastPrice);
            if (preco < 1) preco = 1 / preco;
            cotacaoAtual = preco;
            const pct = parseFloat(db.priceChangePercent) || 0;
            const lo  = parseFloat(db.lowPrice)  > 1 ? parseFloat(db.lowPrice)  : preco * 0.998;
            const hi  = parseFloat(db.highPrice) > 1 ? parseFloat(db.highPrice) : preco * 1.002;
            atualizarHeroCotacao(preco, lo, hi, pct, 'Binance USDT/BRL');
        } catch(e2) {
            document.getElementById('cot-preco-principal').textContent = 'Indisponível';
            document.getElementById('ultimo-update').textContent = 'Erro ao obter cotação';
        }
    }
}

// Retorna data útil mais recente no formato MM-DD-YYYY (padrão BCB)
function bcbDataHoje() {
    const d = new Date();
    const dow = d.getDay();
    if (dow === 0) d.setDate(d.getDate() - 2); // domingo → sexta
    if (dow === 6) d.setDate(d.getDate() - 1); // sábado → sexta
    const dd   = String(d.getDate()).padStart(2,'0');
    const mm   = String(d.getMonth()+1).padStart(2,'0');
    return `${mm}-${dd}-${d.getFullYear()}`;
}

function atualizarHeroCotacao(preco, low, high, pctChg, fonte) {
    document.getElementById('cot-preco-principal').textContent = 'R$ ' + fmtCot(preco);

    const elVar = document.getElementById('cot-variacao');
    if (pctChg !== 0) {
        elVar.textContent = (pctChg >= 0 ? '▲ +' : '▽ ') + Math.abs(pctChg).toFixed(2) + '% nas últimas 24h';
        elVar.className   = 'ch-change ' + (pctChg >= 0 ? 'up' : 'down');
    } else {
        elVar.textContent = '';
    }

    document.getElementById('cot-min').textContent = 'R$ ' + fmtCot(low);
    document.getElementById('cot-max').textContent = 'R$ ' + fmtCot(high);

    const elFonte = document.getElementById('cot-fonte');
    if (elFonte) elFonte.textContent = fonte;

    const elTPrice  = document.getElementById('ticker-price');
    const elTChange = document.getElementById('ticker-change');
    const elTMobile = document.getElementById('ticker-price-mobile');
    if (elTPrice)  elTPrice.textContent  = 'R$ ' + fmtCot(preco);
    if (elTMobile) elTMobile.textContent = 'R$ ' + fmtCot(preco);
    if (elTChange && pctChg !== 0) {
        elTChange.textContent = (pctChg >= 0 ? '+' : '') + pctChg.toFixed(2) + '%';
        elTChange.className   = 'change ' + (pctChg >= 0 ? 'up' : 'down');
    }

    const agora = new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
    document.getElementById('ultimo-update').textContent = 'Atualizado às ' + agora;

    calcularSpread();
}

// ── Velas USDT/BRL — BCB histórico diário × fator USDT/USD ────
async function buscarVelas() {
    try {
        const fim = new Date();
        const ini = new Date(); ini.setDate(ini.getDate() - 50);

        const fmtBcb = d => {
            const dd   = String(d.getDate()).padStart(2,'0');
            const mm   = String(d.getMonth()+1).padStart(2,'0');
            return `${mm}-${dd}-${d.getFullYear()}`;
        };

        const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@di,dataFinalCotacao=@df)?@di='${fmtBcb(ini)}'&@df='${fmtBcb(fim)}'&$top=200&$orderby=dataHoraCotacao%20asc&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao`;

        const r = await fetch(url);
        if (!r.ok) throw new Error('BCB error');
        const d = await r.json();
        const itens = d.value;
        if (!itens || !itens.length) throw new Error('Sem dados BCB');

        // Agrupa por dia (formato dataHoraCotacao: "YYYY-MM-DD HH:MM:SS.mmm")
        const porDia = {};
        itens.forEach(item => {
            // Extrai só a data "YYYY-MM-DD"
            const dia = item.dataHoraCotacao.substring(0, 10);
            if (!porDia[dia]) porDia[dia] = [];
            const med = (parseFloat(item.cotacaoCompra) + parseFloat(item.cotacaoVenda)) / 2;
            porDia[dia].push(med);
        });

        const dias = Object.keys(porDia).sort().slice(-30);

        velasData = dias.map((dia, i) => {
            const vals  = porDia[dia];
            const close = vals[vals.length - 1];
            const open  = i > 0 ? porDia[dias[i-1]][porDia[dias[i-1]].length - 1] : vals[0];
            const high  = Math.max(...vals);
            const low   = Math.min(...vals);
            // Formata label DD/MM
            const partes = dia.split('-');
            return { t: `${partes[2]}/${partes[1]}`, open, high, low, close };
        });

        renderVelas();
    } catch(e) {
        console.warn('Erro velas BCB:', e);
    }
}

// ── Gráfico de Velas Japonesas (Candlestick) ──────────────────
function renderVelas() {
    const ctx = document.getElementById('grafico-cotacao');
    if (!ctx) return;
    if (graficoCotacao) { graficoCotacao.destroy(); graficoCotacao = null; }
    if (!velasData.length) return;

    const labels     = velasData.map(v => v.t);
    const corVela    = velasData.map(v => v.close >= v.open ? 'rgba(76,175,80,0.85)'  : 'rgba(255,85,85,0.85)');
    const corBorda   = velasData.map(v => v.close >= v.open ? '#4CAF50' : '#ff5555');

    // Corpo: base = min(open,close), altura = |close - open|
    const corpoBase  = velasData.map(v => Math.min(v.open, v.close));
    const corpoAlto  = velasData.map(v => Math.max(0.0001, Math.abs(v.close - v.open)));

    // Pavio inferior: low → min(open,close)
    const pavInfBase = velasData.map(v => v.low);
    const pavInfAlto = velasData.map(v => Math.max(0, Math.min(v.open, v.close) - v.low));

    // Pavio superior: max(open,close) → high
    const pavSupBase = velasData.map(v => Math.max(v.open, v.close));
    const pavSupAlto = velasData.map(v => Math.max(0, v.high - Math.max(v.open, v.close)));

    graficoCotacao = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Corpo',
                    data: corpoAlto, base: corpoBase,
                    backgroundColor: corVela, borderColor: corBorda,
                    borderWidth: 1, borderRadius: 1, barPercentage: 0.55,
                },
                {
                    label: 'Pavio Inf',
                    data: pavInfAlto, base: pavInfBase,
                    backgroundColor: corBorda, borderColor: corBorda,
                    borderWidth: 1, barPercentage: 0.07,
                },
                {
                    label: 'Pavio Sup',
                    data: pavSupAlto, base: pavSupBase,
                    backgroundColor: corBorda, borderColor: corBorda,
                    borderWidth: 1, barPercentage: 0.07,
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, animation: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1a1a1a', borderColor: '#333', borderWidth: 1,
                    titleColor: '#a0a0a0', bodyColor: '#e0e0e0', padding: 12,
                    callbacks: {
                        title: items => 'USDT/BRL — ' + labels[items[0].dataIndex],
                        label: item => {
                            if (item.datasetIndex !== 0) return null;
                            const v = velasData[item.dataIndex];
                            return [
                                ` Abertura:    R$ ${fmtCot(v.open)}`,
                                ` Fechamento:  R$ ${fmtCot(v.close)}`,
                                ` Máxima:      R$ ${fmtCot(v.high)}`,
                                ` Mínima:      R$ ${fmtCot(v.low)}`,
                            ];
                        },
                        filter: item => item.datasetIndex === 0,
                    }
                }
            },
            scales: {
                x: {
                    stacked: false,
                    grid:  { color: 'rgba(255,255,255,.04)' },
                    ticks: { color: '#555', maxTicksLimit: 12, font: { size: 11 } }
                },
                y: {
                    grid:  { color: 'rgba(255,255,255,.04)' },
                    ticks: { color: '#888', font: { size: 11 }, callback: v => 'R$ ' + fmtCot(v) }
                }
            }
        }
    });
}

// ── Calculadora de Spread (simplificada) ─────────────────────
function calcularSpread() {
    const elMercado = document.getElementById('calc-mercado');
    const elFinal   = document.getElementById('calc-preco-final');
    const elSpreadRs= document.getElementById('calc-spread-rs');
    const elInput   = document.getElementById('calc-spread-input');

    elMercado.textContent = cotacaoAtual > 0 ? 'R$ ' + fmtCot(cotacaoAtual) : '—';

    const spreadPct = parseFloat((elInput ? elInput.value : '0').replace(',', '.')) || 0;

    if (cotacaoAtual > 0 && spreadPct > 0) {
        const precoFinal = cotacaoAtual * (1 + spreadPct / 100);
        const spreadRs   = precoFinal - cotacaoAtual;

        elFinal.textContent   = 'R$ ' + fmtCot(precoFinal);
        elSpreadRs.textContent = 'R$ ' + fmtCot(spreadRs);
    } else {
        elFinal.textContent   = cotacaoAtual > 0 ? 'R$ ' + fmtCot(cotacaoAtual) : '—';
        elSpreadRs.textContent = '—';
    }
}

// ── Copiar cotação com spread ─────────────────────────────────
function copiarCotacao() {
    const el = document.getElementById('calc-preco-final');
    const texto = el.textContent.replace('R$ ', '').trim();
    if (!texto || texto === '—') { toast('Nenhuma cotação para copiar.', 'error'); return; }
    navigator.clipboard.writeText('R$ ' + texto).then(() => {
        const btn = document.getElementById('btn-copiar-cotacao');
        const svgOriginal = btn.innerHTML;
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        btn.style.borderColor = '#4CAF50';
        setTimeout(() => { btn.innerHTML = svgOriginal; btn.style.borderColor = ''; }, 2000);
        toast('Cotação copiada: R$ ' + texto);
    }).catch(() => toast('Não foi possível copiar.', 'error'));
}

// ── Modal compartilhar ────────────────────────────────────────
document.getElementById('btn-abrir-share').addEventListener('click', () => {
    const url = window.location.href.replace(/[^/]*$/, '') + 'cotacao-cliente.html';
    document.getElementById('link-cliente-url').textContent = url;
    const modal = document.getElementById('modal-share');
    modal.style.display = 'flex';
});

function fecharModal() {
    document.getElementById('modal-share').style.display = 'none';
}

function copiarLink() {
    const url = document.getElementById('link-cliente-url').textContent;
    navigator.clipboard.writeText(url).then(() => toast('Link copiado com sucesso!')).catch(() => toast('Erro ao copiar link.', 'error'));
}

function abrirPaginaCliente() {
    window.open('cotacao-cliente.html', '_blank');
}

// Fechar modal clicando fora
document.getElementById('modal-share').addEventListener('click', function(e) {
    if (e.target === this) fecharModal();
});

// ── UTIL: DRAG TO SCROLL ────────────────────────────────────
function dragScroll(el) {
    if (!el) return;
    let down=false, sx, sl;
    el.addEventListener('mousedown', e=>{ down=true; sx=e.pageX-el.offsetLeft; sl=el.scrollLeft; });
    el.addEventListener('mouseleave',  ()=>{ down=false; });
    el.addEventListener('mouseup',     ()=>{ down=false; });
    el.addEventListener('mousemove',   e=>{
        if(!down) return; e.preventDefault();
        el.scrollLeft = sl - ((e.pageX-el.offsetLeft - sx)*1.5);
    });
}
