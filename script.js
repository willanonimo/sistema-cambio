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
        if (page === 'lucro')    renderLucro();
        if (page === 'cotacoes') iniciarCotacoes();
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
let opFornecedor = JSON.parse(localStorage.getItem('banco_cambio'))    || [];
let opClientes   = JSON.parse(localStorage.getItem('banco_clientes'))  || [];
let cadastrosCli = JSON.parse(localStorage.getItem('banco_cadastros')) || [];

function salvarFornecedor() { localStorage.setItem('banco_cambio',    JSON.stringify(opFornecedor)); }
function salvarClientes()   { localStorage.setItem('banco_clientes',  JSON.stringify(opClientes)); }
function salvarCadastros()  { localStorage.setItem('banco_cadastros', JSON.stringify(cadastrosCli)); }

// ============================================================
// MÓDULO A — FORNECEDOR
// ============================================================
const iValComp = document.getElementById('valor-comprado');
const iCot     = document.getElementById('cotacao');
const iTotAuto = document.getElementById('total-automatico');
const iValPix  = document.getElementById('valor-pix');
const iRefPix  = document.getElementById('referencia-pix');
const btnReg   = document.getElementById('btn-registrar');
const btnCan   = document.getElementById('btn-cancelar');
const iFiltroD = document.getElementById('filtro-data');
const btnLimp  = document.getElementById('btn-limpar-filtro');
const tbHist   = document.getElementById('tabela-historico');

let opExibidas = [];

function calcTotalForn() {
    const total = parseNum(iValComp.value) * parseNum(iCot.value);
    iTotAuto.value = total > 0 ? fmtDisplay(total) : '';
}

iValComp.addEventListener('input', e=>{ e.target.value=fmtMoeda(e.target.value); calcTotalForn(); });
iCot.addEventListener('input', calcTotalForn);
iValPix.addEventListener('input', e=>{ e.target.value=fmtMoeda(e.target.value); });

function limparForn() {
    iValComp.value=''; iCot.value=''; iTotAuto.value=''; iValPix.value='';
    if(iRefPix) iRefPix.value='';
    iValComp.focus();
}
btnCan.addEventListener('click', limparForn);
document.addEventListener('keydown', e=>{ if(e.key==='Escape') limparForn(); });

btnReg.addEventListener('click', ()=>{
    const usdt  = parseNum(iValComp.value);
    const cot   = parseNum(iCot.value);
    const total = parseNum(iTotAuto.value);
    const pix   = parseNum(iValPix.value);
    const ref   = iRefPix ? iRefPix.value.trim() : '';

    if (usdt===0 && pix===0) { toast('Preencha USDT ou o valor pago.','error'); return; }
    if (usdt>0 && cot===0)   { toast('Informe a Cotação de Compra.','error'); return; }

    const now = new Date();
    opFornecedor.unshift({
        data: now.toLocaleDateString('pt-BR'),
        hora: now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),
        usdt, cotacao:cot, totalBrl:total, pix, pendente:usdt, ref
    });
    salvarFornecedor();
    carregarFornecedor();
    limparForn();
    toast('Operação registrada com sucesso!', 'success');
});

function carregarFornecedor() {
    let filtroData = '';
    if (iFiltroD && iFiltroD.value) {
        const p = iFiltroD.value.split('-');
        filtroData = `${p[2]}/${p[1]}/${p[0]}`;
        if(btnLimp) btnLimp.style.display='inline-block';
    } else {
        if(btnLimp) btnLimp.style.display='none';
    }

    opExibidas = filtroData ? opFornecedor.filter(o=>o.data===filtroData) : [...opFornecedor];

    tbHist.innerHTML = '';
    let totUsdt=0, totPendente=0, totBrl=0, totPix=0;

    if (!opExibidas.length) {
        const msg = filtroData ? `Sem operações em ${filtroData}.` : 'Nenhuma operação registrada ainda.';
        tbHist.innerHTML = `<tr><td colspan="8" class="empty-state">${msg}</td></tr>`;
    }

    opExibidas.forEach(op => {
        const idx = opFornecedor.indexOf(op);
        totUsdt    += op.usdt;
        totPendente += op.pendente;
        totBrl     += op.totalBrl;
        totPix     += op.pix;

        const corPend = op.pendente===0 ? '#4CAF50' : '#ff5555';
        const ref = op.ref ? `<br><small style="color:#888;font-weight:normal;">Ref: ${op.ref}</small>` : '';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${op.data}</td>
            <td>${op.hora}</td>
            <td style="color:#4CAF50;font-weight:700;">${fmtDisplay(op.usdt)}</td>
            <td>R$ ${fmtCot(op.cotacao)}</td>
            <td>R$ ${fmtDisplay(op.totalBrl)}</td>
            <td style="color:#2196F3;font-weight:700;">R$ ${fmtDisplay(op.pix)}${ref}</td>
            <td style="color:${corPend};font-weight:700;">${fmtDisplay(op.pendente)}</td>
            <td style="display:flex;gap:6px;">
                <button class="btn-small ok" ${op.pendente<=0?'disabled style="opacity:.3;cursor:not-allowed;"':''}>Receber</button>
                <button class="btn-small del" title="Excluir"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </td>`;

        tr.querySelectorAll('button')[0].addEventListener('click', ()=>{
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
        tr.querySelectorAll('button')[1].addEventListener('click', ()=>{
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

    document.getElementById('card-vol-usdt').textContent     = fmtDisplay(totUsdt);
    document.getElementById('card-vol-brl').textContent      = 'R$ '+fmtDisplay(totBrl);
    document.getElementById('card-forn-comprado').textContent = fmtDisplay(totUsdt);
    document.getElementById('card-forn-pendente').textContent = fmtDisplay(totPendente);
    document.getElementById('card-pagar-enviado').textContent = 'R$ '+fmtDisplay(totPix);
    document.getElementById('card-pagar-pendente').textContent= 'R$ '+fmtDisplay(pendBrl);
}

if (iFiltroD) iFiltroD.addEventListener('change', carregarFornecedor);
if (btnLimp)  btnLimp.addEventListener('click', ()=>{ iFiltroD.value=''; carregarFornecedor(); });

carregarFornecedor();

// Drag-to-scroll Fornecedor
dragScroll(document.getElementById('drag-fornecedor'));

// PDF Export
document.getElementById('btn-exportar-pdf').addEventListener('click', ()=>{
    if (!opExibidas.length) { toast('Sem dados para exportar.','error'); return; }
    exportarPDF(opExibidas);
});

function exportarPDF(dados) {
    let tU=0,tP=0,tPend=0,tBrl=0;
    dados.forEach(o=>{ tU+=o.usdt; tP+=o.pix; tPend+=o.pendente; tBrl+=o.totalBrl; });
    let faltaPagar = Math.max(0, tBrl-tP);

    const {jsPDF} = window.jspdf;
    const doc = new jsPDF('l','mm','a4');
    const pw = doc.internal.pageSize.getWidth();

    doc.setDrawColor(35,35,35); doc.setLineWidth(1.5); doc.line(14,15,14,25);
    doc.setFontSize(20); doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0);
    doc.text('K R O M A',19,21);
    doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(120,120,120);
    doc.text('C A P I T A L',19,25);

    const p0 = dados[dados.length-1].data, p1 = dados[0].data;
    doc.text(p0===p1?`Data: ${p0}`:`Período: ${p0} a ${p1}`, 14, 32);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 36);
    doc.setDrawColor(220,220,220); doc.setLineWidth(.3); doc.line(14,40,pw-14,40);

    doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0);
    doc.text('Resumo de Saldos Financeiros',14,48);

    doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(35,35,35);
    doc.text(`Total USDT Comprado: ${fmtDisplay(tU)} USDT`,14,56);
    doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0);
    doc.text(`Pendente a Receber: ${fmtDisplay(tPend)} USDT`,14,62);
    doc.setFont('helvetica','normal'); doc.setTextColor(35,35,35);
    doc.text(`Total Pago: R$ ${fmtDisplay(tP)}`,pw/2,56);
    doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0);
    doc.text(`Falta Pagar: R$ ${fmtDisplay(faltaPagar)}`,pw/2,62);

    doc.autoTable({
        startY:70,
        head:[['Data','Hora','USDT Comprado','Cotação','Total (R$)','Valor Pago','Falta Receber','Ref.']],
        body: dados.map(o=>[
            o.data, o.hora,
            o.usdt>0?fmtDisplay(o.usdt):'-',
            o.cotacao>0?'R$ '+fmtCot(o.cotacao):'-',
            o.totalBrl>0?'R$ '+fmtDisplay(o.totalBrl):'-',
            o.pix>0?'R$ '+fmtDisplay(o.pix):'-',
            o.pendente>0?fmtDisplay(o.pendente):'-',
            o.ref||'-'
        ]),
        theme:'plain',
        headStyles:{fillColor:[35,35,35],textColor:[240,240,245],fontStyle:'bold',halign:'center'},
        bodyStyles:{textColor:[60,60,60],halign:'center',fontSize:9},
        alternateRowStyles:{fillColor:[248,248,250]}
    });

    const da = p0===p1?p0.replace(/\//g,'-'):new Date().toLocaleDateString('pt-BR').replace(/\//g,'-');
    doc.save(`Extrato_Kroma_${da}.pdf`);
    toast('Relatório PDF gerado com sucesso!', 'success');
}

// ============================================================
// MÓDULO B — CLIENTES
// ============================================================
const cliSelect      = document.getElementById('cli-select');
const cliUsdt        = document.getElementById('cli-usdt');
const cliCotVenda    = document.getElementById('cli-cotacao-venda');
const cliTotalBrl    = document.getElementById('cli-total-brl');
const cliPagoBrl     = document.getElementById('cli-pago-brl');
const cliStatusEnvio = document.getElementById('cli-status-envio');
const cliRef         = document.getElementById('cli-ref');
const cliSaldoDisp   = document.getElementById('cli-saldo-display');
const btnRegCli      = document.getElementById('btn-registrar-cliente');
const btnCanCli      = document.getElementById('btn-cancelar-cliente');
const tbClientes     = document.getElementById('tabela-clientes');
const filtroCliHist  = document.getElementById('filtro-cliente-hist');
const filtroDataCli  = document.getElementById('filtro-data-cli');

// Tabs clientes
document.getElementById('tab-nova-op').addEventListener('click', ()=>{
    document.getElementById('painel-nova-op').style.display='block';
    document.getElementById('painel-cadastro').style.display='none';
    document.getElementById('tab-nova-op').classList.add('active');
    document.getElementById('tab-cadastro').classList.remove('active');
});
document.getElementById('tab-cadastro').addEventListener('click', ()=>{
    document.getElementById('painel-nova-op').style.display='none';
    document.getElementById('painel-cadastro').style.display='block';
    document.getElementById('tab-cadastro').classList.add('active');
    document.getElementById('tab-nova-op').classList.remove('active');
});

// Cálculo automático cliente
function calcTotalCli() {
    const total = parseNum(cliUsdt.value) * parseNum(cliCotVenda.value);
    cliTotalBrl.value = total > 0 ? fmtDisplay(total) : '';

    // Calcula saldo USDT do cliente (já enviado vs. comprado)
    const nome = cliSelect.value;
    if (nome) {
        const saldo = getSaldoCliente(nome);
        const novoUsdt = parseNum(cliUsdt.value);
        cliSaldoDisp.value = fmtDisplay(saldo + novoUsdt) + ' USDT';
    }
}

cliUsdt.addEventListener('input', e=>{ e.target.value=fmtMoeda(e.target.value); calcTotalCli(); });
cliCotVenda.addEventListener('input', calcTotalCli);
cliPagoBrl.addEventListener('input', e=>{ e.target.value=fmtMoeda(e.target.value); });
cliSelect.addEventListener('change', calcTotalCli);

function getSaldoCliente(nome) {
    // Saldo = soma de USDT comprado - soma de USDT já enviado (status=enviado)
    return opClientes
        .filter(o=>o.cliente===nome)
        .reduce((acc,o)=>{
            const enviado = o.statusEnvio==='enviado' ? o.usdt : (o.statusEnvio==='parcial' ? o.usdt*0.5 : 0);
            return acc + o.usdt - enviado;
        }, 0);
}

function limparCli() {
    cliUsdt.value=''; cliCotVenda.value=''; cliTotalBrl.value='';
    cliPagoBrl.value=''; cliRef.value=''; cliSaldoDisp.value='';
    cliStatusEnvio.value='pendente';
}
btnCanCli.addEventListener('click', limparCli);

btnRegCli.addEventListener('click', ()=>{
    const cliente = cliSelect.value;
    const usdt    = parseNum(cliUsdt.value);
    const cot     = parseNum(cliCotVenda.value);
    const total   = parseNum(cliTotalBrl.value);
    const pago    = parseNum(cliPagoBrl.value);
    const status  = cliStatusEnvio.value;
    const ref     = cliRef.value.trim();

    if (!cliente)   { toast('Selecione um cliente.','error'); return; }
    if (usdt===0)   { toast('Informe o USDT vendido.','error'); return; }
    if (cot===0)    { toast('Informe a cotação de venda.','error'); return; }

    // Busca cotação de compra do dia para calcular spread
    const cotCompra = getCotCompraMedia();

    const now = new Date();
    opClientes.unshift({
        data: now.toLocaleDateString('pt-BR'),
        hora: now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),
        cliente, usdt, cotacaoVenda:cot, totalBrl:total,
        pagoBrl:pago, statusEnvio:status, ref,
        cotacaoCompra: cotCompra
    });
    salvarClientes();
    carregarClientes();
    limparCli();
    toast('Venda registrada com sucesso!', 'success');
});

function getCotCompraMedia() {
    // Média das cotações de compra do fornecedor hoje
    const hoje = new Date().toLocaleDateString('pt-BR');
    const ops  = opFornecedor.filter(o=>o.data===hoje && o.cotacao>0);
    if (!ops.length) return 0;
    return ops.reduce((a,o)=>a+o.cotacao,0)/ops.length;
}

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
    cliSelect.innerHTML    = '<option value="">— Selecione o cliente —</option>' + opts;
    filtroCliHist.innerHTML= '<option value="">Todos</option>' + opts;
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

// ── Cotação USDT/BRL via AwesomeAPI (dólar comercial × USDTUSD) ──
// FX_IDC:USDBRL * BITSTAMP:USDTUSD — mesma fórmula do TradingView
async function buscarCotacao() {
    try {
        // AwesomeAPI: dólar comercial BRL (gratuita, sem chave)
        const [rUsd, rUsdt] = await Promise.all([
            fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL'),
            fetch('https://economia.awesomeapi.com.br/json/last/USDT-BRL')
        ]);

        const dUsd  = await rUsd.json();
        const dUsdt = await rUsdt.json();

        const usdBrl  = parseFloat(dUsd.USDBRL.bid);   // dólar comercial
        const usdtBrl = parseFloat(dUsdt.USDTBRL.bid); // USDT em BRL

        // Usa USDT/BRL diretamente da AwesomeAPI — mais preciso que Binance
        cotacaoAtual = usdtBrl;

        const high   = parseFloat(dUsdt.USDTBRL.high);
        const low    = parseFloat(dUsdt.USDTBRL.low);
        const pctChg = parseFloat(dUsdt.USDTBRL.pctChange);

        // Hero
        document.getElementById('cot-preco-principal').textContent = 'R$ ' + fmtCot(cotacaoAtual);
        const elVar = document.getElementById('cot-variacao');
        elVar.textContent = (pctChg >= 0 ? '▲ +' : '▽ ') + pctChg.toFixed(2) + '% nas últimas 24h';
        elVar.className   = 'ch-change ' + (pctChg >= 0 ? 'up' : 'down');

        document.getElementById('cot-min').textContent = 'R$ ' + fmtCot(low);
        document.getElementById('cot-max').textContent = 'R$ ' + fmtCot(high);

        const elFonte = document.getElementById('cot-fonte');
        if (elFonte) elFonte.textContent = 'AwesomeAPI · Dólar Comercial';

        // Ticker nav
        const elTPrice  = document.getElementById('ticker-price');
        const elTChange = document.getElementById('ticker-change');
        if (elTPrice)  elTPrice.textContent  = 'R$ ' + fmtCot(cotacaoAtual);
        if (elTChange) {
            elTChange.textContent = (pctChg >= 0 ? '+' : '') + pctChg.toFixed(2) + '%';
            elTChange.className   = 'change ' + (pctChg >= 0 ? 'up' : 'down');
        }

        const agora = new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
        document.getElementById('ultimo-update').textContent = 'Atualizado às ' + agora;

        calcularSpread();

    } catch(e) {
        // Fallback: tenta só USDT da AwesomeAPI
        try {
            const r = await fetch('https://economia.awesomeapi.com.br/json/last/USDT-BRL');
            const d = await r.json();
            cotacaoAtual = parseFloat(d.USDTBRL.bid);
            document.getElementById('cot-preco-principal').textContent = 'R$ ' + fmtCot(cotacaoAtual);
            const elTPrice = document.getElementById('ticker-price');
            if (elTPrice) elTPrice.textContent = 'R$ ' + fmtCot(cotacaoAtual);
            calcularSpread();
        } catch(e2) {
            document.getElementById('cot-preco-principal').textContent = 'Indisponível';
            document.getElementById('ultimo-update').textContent = 'Erro ao obter cotação';
        }
    }
}

// ── Velas USDT/BRL — AwesomeAPI histórico diário ─────────────
// Busca os últimos 30 dias de dólar comercial e monta OHLC simulado
// A AwesomeAPI retorna fechamento diário — usamos para construir as velas
async function buscarVelas() {
    try {
        // Busca 30 dias de histórico USD-BRL da AwesomeAPI
        const r = await fetch('https://economia.awesomeapi.com.br/json/daily/USDT-BRL/30');
        if (!r.ok) throw new Error('API error');
        const dados = await r.json();

        // dados vem do mais recente para o mais antigo — invertemos
        const sorted = dados.reverse();

        velasData = sorted.map((d, i) => {
            const close = parseFloat(d.bid);
            const high  = parseFloat(d.high);
            const low   = parseFloat(d.low);
            // open = fechamento do dia anterior (ou aprox)
            const open  = i > 0 ? parseFloat(sorted[i-1].bid) : close;
            const ts    = new Date(parseInt(d.timestamp) * 1000);
            const label = ts.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
            return { t: label, open, high, low, close };
        });

        renderVelas();
    } catch(e) {
        console.warn('Erro ao buscar histórico de velas:', e);
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