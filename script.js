// ============================================================
// MÓDULO D — COTAÇÕES AO VIVO (CORRIGIDO)
// Referência: USD/BRL × USDT/USD  -> igual ao compósito da empresa
// ============================================================
let cotacaoAtual = 0;
let graficoCotacao = null;
let cotacoesIniciadas = false;
let velasData = [];
let cotacaoInterval = null;
let velasInterval = null;
let fatorUsdtUsdAtual = 1;

// Helper seguro para fetch com timeout
async function fetchJSON(url, timeout = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        const res = await fetch(url, {
            signal: controller.signal,
            cache: 'no-store'
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

function iniciarCotacoes() {
    if (cotacoesIniciadas) return;
    cotacoesIniciadas = true;

    buscarCotacao();
    buscarVelas();

    cotacaoInterval = setInterval(buscarCotacao, 5000);
    velasInterval = setInterval(buscarVelas, 300000);
}

function atualizarHeroCotacao(preco, low, high, pctChg, fonte) {
    const elPreco = document.getElementById('cot-preco-principal');
    const elVar = document.getElementById('cot-variacao');
    const elMin = document.getElementById('cot-min');
    const elMax = document.getElementById('cot-max');
    const elFonte = document.getElementById('cot-fonte');
    const elUltimo = document.getElementById('ultimo-update');
    const elTickerPrice = document.getElementById('ticker-price');
    const elTickerChange = document.getElementById('ticker-change');
    const elCalcMercado = document.getElementById('calc-mercado');

    if (elPreco) elPreco.textContent = 'R$ ' + fmtCot(preco);
    if (elMin) elMin.textContent = 'R$ ' + fmtCot(low);
    if (elMax) elMax.textContent = 'R$ ' + fmtCot(high);
    if (elFonte) elFonte.textContent = fonte;

    if (elVar) {
        if (pctChg || pctChg === 0) {
            elVar.textContent = (pctChg >= 0 ? '▲ +' : '▼ ') + Math.abs(pctChg).toFixed(2) + '% nas últimas 24h';
            elVar.className = 'ch-change ' + (pctChg >= 0 ? 'up' : 'down');
        } else {
            elVar.textContent = '';
            elVar.className = 'ch-change';
        }
    }

    if (elTickerPrice) elTickerPrice.textContent = 'R$ ' + fmtCot(preco);

    if (elTickerChange) {
        elTickerChange.textContent = (pctChg >= 0 ? '+' : '') + pctChg.toFixed(2) + '%';
        elTickerChange.className = 'change ' + (pctChg >= 0 ? 'up' : 'down');
    }

    if (elCalcMercado) {
        elCalcMercado.textContent = 'R$ ' + fmtCot(preco);
    }

    if (elUltimo) {
        const agora = new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });
        elUltimo.textContent = 'Atualizado às ' + agora;
    }

    calcularSpread();
}

function mostrarErroCotacao() {
    const elPreco = document.getElementById('cot-preco-principal');
    const elVar = document.getElementById('cot-variacao');
    const elMin = document.getElementById('cot-min');
    const elMax = document.getElementById('cot-max');
    const elFonte = document.getElementById('cot-fonte');
    const elUltimo = document.getElementById('ultimo-update');
    const elTickerPrice = document.getElementById('ticker-price');
    const elTickerChange = document.getElementById('ticker-change');
    const elCalcMercado = document.getElementById('calc-mercado');

    if (elPreco) elPreco.textContent = 'Indisponível';
    if (elVar) elVar.textContent = '';
    if (elMin) elMin.textContent = '—';
    if (elMax) elMax.textContent = '—';
    if (elFonte) elFonte.textContent = '—';
    if (elUltimo) elUltimo.textContent = 'Erro ao obter cotação';
    if (elTickerPrice) elTickerPrice.textContent = '—';
    if (elTickerChange) elTickerChange.textContent = '';
    if (elCalcMercado) elCalcMercado.textContent = '—';
}

async function buscarCotacao() {
    try {
        // 1) USD/BRL
        // 2) USDT/USD (Bitstamp)
        const [usdBrlData, usdtUsdData] = await Promise.all([
            fetchJSON('https://economia.awesomeapi.com.br/json/last/USD-BRL'),
            fetchJSON('https://www.bitstamp.net/api/v2/ticker/usdtusd/')
        ]);

        const usd = usdBrlData.USDBRL;
        const usdtusd = usdtUsdData;

        if (!usd || !usdtusd) {
            throw new Error('Resposta incompleta das APIs');
        }

        const usdBrlBid = parseFloat(usd.bid || 0);
        const usdBrlLow = parseFloat(usd.low || 0);
        const usdBrlHigh = parseFloat(usd.high || 0);

        const usdtUsdLast = parseFloat(usdtusd.last || 0);
        const usdtUsdLow = parseFloat(usdtusd.low || 0);
        const usdtUsdHigh = parseFloat(usdtusd.high || 0);
        const usdtUsdOpen24 = parseFloat(usdtusd.open_24 || usdtusd.open || 0);

        if (!usdBrlBid || !usdtUsdLast) {
            throw new Error('Valores inválidos para compor a cotação');
        }

        // Fator atual do USDT/USD
        fatorUsdtUsdAtual = usdtUsdLast;

        // Cotação composta = USD/BRL × USDT/USD
        const preco = usdBrlBid * usdtUsdLast;
        const low = usdBrlLow * usdtUsdLow;
        const high = usdBrlHigh * usdtUsdHigh;

        // Variação aproximada 24h do compósito
        let pctChg = 0;
        if (usdBrlBid > 0 && usdtUsdOpen24 > 0) {
            const precoAnterior = parseFloat(usd.open || usd.bid || 0) * usdtUsdOpen24;
            if (precoAnterior > 0) {
                pctChg = ((preco - precoAnterior) / precoAnterior) * 100;
            }
        }

        cotacaoAtual = preco;
        atualizarHeroCotacao(
            preco,
            low,
            high,
            pctChg,
            'AwesomeAPI USD/BRL × Bitstamp USDT/USD'
        );

        const graficoFonte = document.getElementById('grafico-fonte');
        if (graficoFonte) {
            graficoFonte.textContent = 'Fonte: USD/BRL (AwesomeAPI) × USDT/USD (Bitstamp)';
        }

    } catch (errComposto) {
        console.warn('Falha no compósito principal, tentando fallback USDT-BRL...', errComposto);

        // Fallback: USDT-BRL direto
        try {
            const data = await fetchJSON('https://economia.awesomeapi.com.br/json/last/USDT-BRL');
            const usdt = data.USDTBRL;

            if (!usdt) throw new Error('USDTBRL não retornado');

            const bid = parseFloat(usdt.bid || 0);
            const low = parseFloat(usdt.low || 0);
            const high = parseFloat(usdt.high || 0);
            const pct = parseFloat(usdt.pctChange || 0);

            if (!bid) throw new Error('USDTBRL inválido');

            cotacaoAtual = bid;
            fatorUsdtUsdAtual = 1;

            atualizarHeroCotacao(
                bid,
                low,
                high,
                pct,
                'AwesomeAPI · USDT/BRL (fallback)'
            );

            const graficoFonte = document.getElementById('grafico-fonte');
            if (graficoFonte) {
                graficoFonte.textContent = 'Fonte: AwesomeAPI · USDT/BRL';
            }

        } catch (errFallback) {
            console.error('Erro total ao obter cotação:', errFallback);
            mostrarErroCotacao();
        }
    }
}

// Histórico diário baseado em USD/BRL e ajustado pelo fator atual USDT/USD
async function buscarVelas() {
    try {
        const fim = new Date();
        const ini = new Date();
        ini.setDate(ini.getDate() - 45);

        const fmtBcb = (d) => {
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            return `${mm}-${dd}-${d.getFullYear()}`;
        };

        const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@di,dataFinalCotacao=@df)?@di='${fmtBcb(ini)}'&@df='${fmtBcb(fim)}'&$top=200&$orderby=dataHoraCotacao%20asc&$format=json&$select=cotacaoCompra,cotacaoVenda,dataHoraCotacao`;

        const data = await fetchJSON(url);
        const itens = data.value || [];

        if (!itens.length) {
            throw new Error('Sem dados do BCB');
        }

        const porDia = {};

        itens.forEach(item => {
            const dia = item.dataHoraCotacao.substring(0, 10);
            if (!porDia[dia]) porDia[dia] = [];

            const media = (parseFloat(item.cotacaoCompra) + parseFloat(item.cotacaoVenda)) / 2;
            porDia[dia].push(media);
        });

        const dias = Object.keys(porDia).sort().slice(-30);

        velasData = dias.map((dia, i) => {
            const vals = porDia[dia].map(v => v * (fatorUsdtUsdAtual || 1));

            const close = vals[vals.length - 1];
            const open = i > 0
                ? porDia[dias[i - 1]][porDia[dias[i - 1]].length - 1] * (fatorUsdtUsdAtual || 1)
                : vals[0];

            const high = Math.max(...vals);
            const low = Math.min(...vals);

            const [yyyy, mm, dd] = dia.split('-');

            return {
                t: `${dd}/${mm}`,
                open,
                high,
                low,
                close
            };
        });

        renderVelas();
    } catch (err) {
        console.error('Erro ao buscar velas:', err);
    }
}

// Render real de candles no canvas
function renderVelas() {
    const canvas = document.getElementById('grafico-cotacao');
    if (!canvas) return;

    if (graficoCotacao) {
        graficoCotacao.destroy();
        graficoCotacao = null;
    }

    if (!velasData.length) return;

    const labels = velasData.map(v => v.t);
    const closes = velasData.map(v => v.close);

    const minPrice = Math.min(...velasData.map(v => v.low));
    const maxPrice = Math.max(...velasData.map(v => v.high));
    const padding = (maxPrice - minPrice) * 0.08 || 0.05;

    const candlestickPlugin = {
        id: 'candlestickPlugin',
        afterDatasetsDraw(chart) {
            const { ctx, scales: { x, y } } = chart;
            ctx.save();

            const total = velasData.length;
            const candleWidth = Math.max(6, Math.min(18, (chart.chartArea.width / total) * 0.55));

            velasData.forEach((candle, index) => {
                const xPos = x.getPixelForValue(index);
                const openY = y.getPixelForValue(candle.open);
                const closeY = y.getPixelForValue(candle.close);
                const highY = y.getPixelForValue(candle.high);
                const lowY = y.getPixelForValue(candle.low);

                const isAlta = candle.close >= candle.open;
                const color = isAlta ? '#4CAF50' : '#ff5555';

                // pavio
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.2;
                ctx.moveTo(xPos, highY);
                ctx.lineTo(xPos, lowY);
                ctx.stroke();

                // corpo
                const bodyTop = Math.min(openY, closeY);
                const bodyBottom = Math.max(openY, closeY);
                const bodyHeight = Math.max(2, bodyBottom - bodyTop);

                ctx.fillStyle = color;
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;

                ctx.beginPath();
                ctx.rect(xPos - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
                ctx.fill();
                ctx.stroke();
            });

            ctx.restore();
        }
    };

    graficoCotacao = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data: closes,
                borderColor: 'transparent',
                backgroundColor: 'transparent',
                pointRadius: 0,
                pointHoverRadius: 0
            }]
        },
        plugins: [candlestickPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1a1a1a',
                    borderColor: '#333',
                    borderWidth: 1,
                    titleColor: '#a0a0a0',
                    bodyColor: '#e0e0e0',
                    padding: 12,
                    callbacks: {
                        title: items => 'USD/BRL × USDT/USD — ' + labels[items[0].dataIndex],
                        label: item => {
                            const v = velasData[item.dataIndex];
                            return [
                                `Abertura: R$ ${fmtCot(v.open)}`,
                                `Fechamento: R$ ${fmtCot(v.close)}`,
                                `Máxima: R$ ${fmtCot(v.high)}`,
                                `Mínima: R$ ${fmtCot(v.low)}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,.04)' },
                    ticks: {
                        color: '#777',
                        maxTicksLimit: 10,
                        font: { size: 11 }
                    }
                },
                y: {
                    min: minPrice - padding,
                    max: maxPrice + padding,
                    grid: { color: 'rgba(255,255,255,.04)' },
                    ticks: {
                        color: '#888',
                        font: { size: 11 },
                        callback: v => 'R$ ' + fmtCot(v)
                    }
                }
            }
        }
    });
}

// ── Calculadora de Spread ────────────────────────────────────
function calcularSpread() {
    const elMercado = document.getElementById('calc-mercado');
    const elFinal = document.getElementById('calc-preco-final');
    const elSpreadRs = document.getElementById('calc-spread-rs');
    const elInput = document.getElementById('calc-spread-input');

    if (elMercado) {
        elMercado.textContent = cotacaoAtual > 0 ? 'R$ ' + fmtCot(cotacaoAtual) : '—';
    }

    const spreadPct = parseFloat((elInput ? elInput.value : '0').replace(',', '.')) || 0;

    if (cotacaoAtual > 0 && spreadPct > 0) {
        const precoFinal = cotacaoAtual * (1 + spreadPct / 100);
        const spreadRs = precoFinal - cotacaoAtual;

        if (elFinal) elFinal.textContent = 'R$ ' + fmtCot(precoFinal);
        if (elSpreadRs) elSpreadRs.textContent = 'R$ ' + fmtCot(spreadRs);
    } else {
        if (elFinal) elFinal.textContent = cotacaoAtual > 0 ? 'R$ ' + fmtCot(cotacaoAtual) : '—';
        if (elSpreadRs) elSpreadRs.textContent = '—';
    }
}

// ── Copiar cotação ───────────────────────────────────────────
function copiarCotacao() {
    const el = document.getElementById('calc-preco-final');
    if (!el) return;

    const texto = el.textContent.replace('R$ ', '').trim();
    if (!texto || texto === '—') {
        toast('Nenhuma cotação para copiar.', 'error');
        return;
    }

    navigator.clipboard.writeText('R$ ' + texto).then(() => {
        const btn = document.getElementById('btn-copiar-cotacao');
        if (!btn) return;

        const svgOriginal = btn.innerHTML;
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        btn.style.borderColor = '#4CAF50';

        setTimeout(() => {
            btn.innerHTML = svgOriginal;
            btn.style.borderColor = '';
        }, 2000);

        toast('Cotação copiada: R$ ' + texto);
    }).catch(() => {
        toast('Não foi possível copiar.', 'error');
    });
}

// ── Modal compartilhar ───────────────────────────────────────
(function () {
    const btnAbrirShare = document.getElementById('btn-abrir-share');
    const modalShare = document.getElementById('modal-share');

    if (btnAbrirShare) {
        btnAbrirShare.addEventListener('click', () => {
            const url = window.location.href.replace(/[^/]*$/, '') + 'cotacao-cliente.html';
            const el = document.getElementById('link-cliente-url');
            if (el) el.textContent = url;
            if (modalShare) modalShare.style.display = 'flex';
        });
    }

    if (modalShare) {
        modalShare.addEventListener('click', function (e) {
            if (e.target === this) fecharModal();
        });
    }
})();

function fecharModal() {
    const modal = document.getElementById('modal-share');
    if (modal) modal.style.display = 'none';
}

function copiarLink() {
    const el = document.getElementById('link-cliente-url');
    if (!el) return;

    navigator.clipboard.writeText(el.textContent)
        .then(() => toast('Link copiado com sucesso!'))
        .catch(() => toast('Erro ao copiar link.', 'error'));
}

function abrirPaginaCliente() {
    window.open('cotacao-cliente.html', '_blank');
}

// Se a aba de cotações já estiver ativa ao carregar a página,
// inicia automaticamente para não ficar preso no "Carregando..."
document.addEventListener('DOMContentLoaded', () => {
    const sec = document.getElementById('page-cotacoes');
    if (sec && sec.classList.contains('active')) {
        iniciarCotacoes();
    }
});
