// ============================================================
// AXONE — FX MANAGEMENT SUITE  |  script.js v3.2 (FULL DATABASE)
// ============================================================

const SUPABASE_URL = 'https://izqfrgccjoxumisrlfcj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6cWZyZ2Njam94dW1pc3JsZmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjg4ODMsImV4cCI6MjA4OTk0NDg4M30.11PolSu1vLoggcxT3SdkLnFIu3TmF7coyrusVAovg74';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let db = { clientes: [], operacoes: [], fornecedores: [], despesas: [] };

// ── 1. INICIALIZAÇÃO ─────────────────────────────────────────
(async function init() {
    if (sessionStorage.getItem('axone_auth') !== 'true') {
        window.location.href = 'login.html';
        return;
    }
    
    await sincronizarBanco();
    
    const user = sessionStorage.getItem('axone_user') || 'Gestor';
    const nomeFormatado = user.charAt(0).toUpperCase() + user.slice(1);
    ['nome-usuario','nome-usuario-mobile'].forEach(id => {
        if (document.getElementById(id)) document.getElementById(id).textContent = nomeFormatado;
    });

    navegarPara(sessionStorage.getItem('axone_last_page') || 'home');
})();

async function sincronizarBanco() {
    const [c, o] = await Promise.all([
        _supabase.from('clientes').select('*').order('nome'),
        _supabase.from('operacoes').select('*').order('created_at', { ascending: false })
    ]);
    db.clientes = c.data || [];
    db.operacoes = o.data || [];
    atualizarComponentesUI();
}

function atualizarComponentesUI() {
    const opts = db.clientes.map(cl => `<option value="${cl.nome}">${cl.nome}</option>`).join('');
    const selectFiltro = document.getElementById('filtro-cliente-hist');
    if (selectFiltro) selectFiltro.innerHTML = '<option value="">Todos os Clientes</option>' + opts;
}

// ── 2. NAVEGAÇÃO ─────────────────────────────────────────────
function navegarPara(page) {
    sessionStorage.setItem('axone_last_page', page);
    document.querySelectorAll('.nav-links a, .nav-drawer a').forEach(el => el.classList.remove('active'));
    document.querySelectorAll(`[data-page="${page}"]`).forEach(el => el.classList.add('active'));
    document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
    
    document.getElementById('page-' + page)?.classList.add('active');

    if (page === 'home')      renderHome();
    if (page === 'clientes')  renderTabelaClientes();
    if (page === 'operacoes') renderTabelaOperacoes();
    
    document.getElementById('nav-drawer')?.classList.remove('open');
}

// ── 3. MÓDULO OPERAÇÕES (ESTILO EXCEL + CLOUD) ────────────────
function renderTabelaOperacoes() {
    const tb = document.getElementById('tabela-operacoes');
    if (!tb) return;

    tb.innerHTML = db.operacoes.map(op => {
        const corLucro = op.lucro > 0 ? 'var(--green)' : op.lucro < 0 ? 'var(--red)' : '#888';
        return `
        <tr data-id="${op.id}">
            <td><input class="cell-input" value="${op.data}" onchange="editarOp(${op.id}, 'data', this.value)"></td>
            <td>
                <select class="cell-select" onchange="editarOp(${op.id}, 'status', this.value)" style="color:var(--green)">
                    <option value="concluida" ${op.status==='concluida'?'selected':''}>Settled</option>
                    <option value="andamento" ${op.status==='andamento'?'selected':''}>Processing</option>
                </select>
            </td>
            <td>
                <select class="cell-select" onchange="editarOp(${op.id}, 'cliente', this.value)">
                    <option value="">Selecione...</option>
                    ${db.clientes.map(c => `<option value="${c.nome}" ${op.cliente===c.nome?'selected':''}>${c.nome}</option>`).join('')}
                </select>
            </td>
            <td><input class="cell-input" style="text-align:right" value="${fmtDisplay(op.usdt)}" onchange="editarOp(${op.id}, 'usdt', this.value)"></td>
            <td><input class="cell-input" style="text-align:right" value="${fmtCot(op.cot_venda)}" onchange="editarOp(${op.id}, 'cot_venda', this.value)"></td>
            <td style="text-align:right; font-weight:700; color:${corLucro}">R$ ${fmtDisplay(op.lucro)}</td>
            <td><button class="btn-small del" onclick="excluirOp(${op.id})">Excluir</button></td>
        </tr>`;
    }).join('');
}

async function adicionarLinhaVazia() {
    const novaOp = {
        data: new Date().toLocaleDateString('pt-BR'),
        status: 'concluida',
        cliente: '',
        usdt: 0,
        cot_compra: 0,
        cot_venda: 0,
        lucro: 0
    };

    const { error } = await _supabase.from('operacoes').insert([novaOp]);
    if (error) return toast("Erro ao criar linha", "error");
    
    await sincronizarBanco();
    renderTabelaOperacoes();
}

async function editarOp(id, campo, valor) {
    let valFormatado = valor;
    
    // Se for campo numérico, limpa a formatação brasileira antes de salvar
    if (campo === 'usdt' || campo === 'cot_venda' || campo === 'cot_compra') {
        valFormatado = parseNum(valor);
    }

    // Busca a operação atual para recalcular lucro
    const op = db.operacoes.find(o => o.id === id);
    const dadosNovos = { [campo]: valFormatado };

    // Recalcula lucro se mudar valor ou cotação
    if (campo === 'usdt' || campo === 'cot_venda') {
        const u = campo === 'usdt' ? valFormatado : op.usdt;
        const cv = campo === 'cot_venda' ? valFormatado : op.cot_venda;
        const cc = op.cot_compra || 0; // Se você tiver cot_compra na tabela
        dadosNovos.lucro = u * (cv - cc);
    }

    const { error } = await _supabase.from('operacoes').update(dadosNovos).eq('id', id);
    if (error) toast("Erro ao atualizar", "error");
    else {
        await sincronizarBanco();
        renderTabelaOperacoes();
    }
}

async function excluirOp(id) {
    if (!confirm("Excluir permanentemente?")) return;
    await _supabase.from('operacoes').delete().eq('id', id);
    await sincronizarBanco();
    renderTabelaOperacoes();
}

// ── 4. AUXILIARES ────────────────────────────────────────────
function fmtDisplay(n) { return (+n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtCot(n) { return (+n||0).toLocaleString('pt-BR',{minimumFractionDigits:4,maximumFractionDigits:4}); }
function parseNum(s) { return parseFloat(String(s).replace(/\./g,'').replace(',','.')) || 0; }

function toast(msg, tipo='success') {
    const t = document.getElementById('toast');
    if (t) {
        t.textContent = msg;
        t.className = 'show' + (tipo==='error'?' error':'');
        setTimeout(() => t.className = '', 3000);
    }
}

// Vincular botão de nova linha (index.html)
document.getElementById('btn-nova-linha-op')?.addEventListener('click', adicionarLinhaVazia);

// ── 5. CLIENTES ──────────────────────────────────────────────
async function acaoCadastrarCliente() {
    const nome = document.getElementById('cad-nome').value.trim();
    const contato = document.getElementById('cad-contato').value.trim();
    if (!nome) return toast('Nome obrigatório', 'error');

    await _supabase.from('clientes').insert([{ nome, contato }]);
    toast('Cliente salvo!');
    await sincronizarBanco();
    renderTabelaClientes();
}
