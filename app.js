/* mistofpandian — dependency-free, read-only research interface. */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const icons = {
    arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
    download:'<path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4"/>',
    document:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/>',
    layers:'<path d="m12 3 10 5-10 5L2 8zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    shield:'<path d="m12 3 8 4v6c0 4-8 8-8 8s-8-4-8-8V7z"/><path d="m8 12 3 3 5-6"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.2"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    external:'<path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/>'
  };
  const icon = key => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[key] || icons.document}</svg>`;
  const money = n => Number(n).toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2});
  const num = n => Number(n).toLocaleString('en-US');
  const signed = n => `${Number(n) > 0 ? '+' : ''}${money(n)}`;
  const pct = n => `${Number(n) > 0 ? '+' : ''}${Number(n).toFixed(2)}%`;
  const polarity = n => Number(n) >= 0 ? 'positive' : 'negative';
  const DATA = window.RESEARCH_DATA;
  const titles = {overview:'研究总览',tuning:'时间平移调参',reports:'回测报告',compare:'实验对照',data:'数据档案',methodology:'方法与边界'};
  const state = {route:'overview',selected:null,chartMode:'balance',query:'',filters:{},study:null,dialog:null,tab:'trades',direction:'all',tradeQuery:'',page:1,tuningPhase:'validation',tuningTimeframe:'all',tuningSort:'net'};
  let toastTimer;
  function notify(message) {
    $('toast').textContent = message;
    $('toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2800);
  }
  function download(filename, content, type='application/json;charset=utf-8') {
    const url = URL.createObjectURL(new Blob([content], {type}));
    const link = document.createElement('a');
    link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function closeMenu() {
    $('sidebar').classList.remove('open'); $('backdrop').hidden = true;
    $('sidebar').inert = window.matchMedia('(max-width: 760px)').matches;
    $('menuButton').setAttribute('aria-expanded','false');
  }
  $('menuButton').addEventListener('click', () => {
    const opened = $('sidebar').classList.toggle('open');
    $('sidebar').inert = !opened;
    $('backdrop').hidden = !opened; $('menuButton').setAttribute('aria-expanded', String(opened));
  });
  $('backdrop').addEventListener('click', closeMenu);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  function applyTheme(dark) {
    document.body.classList.toggle('dark', dark);
    $('themeButton').setAttribute('aria-label', dark ? '切换浅色模式' : '切换深色模式');
    $('themeButton').title = dark ? '切换浅色模式' : '切换深色模式';
  }
  try { applyTheme(localStorage.getItem('mistofpandian-theme') === 'dark'); } catch (_) {}
  $('themeButton').addEventListener('click', () => {
    const dark = !document.body.classList.contains('dark'); applyTheme(dark);
    try { localStorage.setItem('mistofpandian-theme', dark ? 'dark' : 'light'); } catch (_) {}
    drawAllCharts();
  });
  if (!DATA || !Array.isArray(DATA.reports) || !DATA.reports.length) {
    $('main').innerHTML = '<section class="load-error"><p class="eyebrow">RESEARCH ARCHIVE</p><h1>研究数据尚未加载</h1><p>请通过 build_mistofpandian.py 构建网站，并打开生成目录中的 index.html。</p></section>';
    return;
  }
  const FILTERS = window.ResearchFilters;
  if (!FILTERS || DATA.metadata?.schemaVersion !== 1) {
    $('main').innerHTML = '<section class="load-error"><h1>筛选元数据尚未加载</h1><p>请刷新网页，或使用最新构建器重新生成网站。</p></section>';
    return;
  }
  const reports = [...DATA.reports].sort((a,b) => b.createdAt.localeCompare(a.createdAt) || a.spread-b.spread);
  const studies = [...DATA.studies].sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  const tuningStudies = [...(DATA.tuningStudies || [])].sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  const reportLabel = report => report.phase ? report.title : `${report.symbol} · ${report.timeframe} · 点差 ${report.spread}`;
  const finalBalance = report => Number(report.trades.length ? report.trades.at(-1).balance : report.summary.initial_deposit);
  state.selected = (reports.find(r=>r.phase==='validation' && r.selectedCandidate) || reports[0]).id; state.study = studies[0]?.id;
  const reportById = id => reports.find(report => report.id === id);
  const selected = () => reportById(state.selected) || reports[0];
  const summaryNumber = (report,key) => Number(report.summary[key]);
  const returnPct = report => summaryNumber(report,'net_profit') / summaryNumber(report,'initial_deposit') * 100;
  const drawdown = report => ({amount: report.summary.max_drawdown.split(' ')[0], percent: (report.summary.max_drawdown.match(/\(([\d.]+)%\)/) || [,'—'])[1]});
  const win = report => ({count:report.summary.profit_trades_pct.split(' ')[0],percent:(report.summary.profit_trades_pct.match(/\(([\d.]+)%\)/) || [,'—'])[1]});
  const period = report => {
    const dates = report.summary.period.match(/\d{4}\.\d{2}\.\d{2}/g) || [];
    return {from:dates[0] || '—',to:dates[1] || '—'};
  };
  const studyReports = () => reports.filter(report => report.studyId === state.study).sort((a,b) => a.spread-b.spread);
  const dateText = date => String(date).slice(0,10).replaceAll('-','.');
  $('navCount').textContent = String(reports.length).padStart(2,'0');
  function pageHeading(eyebrow,title,description,action='') {
    const last = reports[0].createdAt;
    return `<div class="page-heading"><div><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${action || `<div class="heading-date">${icon('calendar')}<span>最近归档 ${dateText(last)}</span></div>`}</div>`;
  }
  const notice = text => `<div class="notice">${icon('info')}<span>${text}</span></div>`;
  const verified = '<span class="tag verified">数据已核对</span>';
  function reportSelect() {
    return `<div class="report-selection"><label for="reportSelect">当前方案</label><select id="reportSelect" aria-label="选择当前报告">${reports.map(report => `<option value="${esc(report.id)}" ${report.id===state.selected?'selected':''}>${esc(reportLabel(report))}</option>`).join('')}</select></div>`;
  }
  function heroVisual() {
    return `<div class="hero-visual" aria-hidden="true"><svg viewBox="0 0 330 210" fill="none"><circle cx="174" cy="102" r="90" stroke="#3b5e4e" stroke-width=".8"/><circle cx="174" cy="102" r="66" stroke="#3b5e4e" stroke-width=".8"/><circle cx="174" cy="102" r="42" stroke="#55735a" stroke-width=".8"/><path d="M62 102h224M174 0v204" stroke="#3b5e4e" stroke-dasharray="3 6"/><path d="m85 137 25-16 25 9 21-33 26 10 21-37 23 13 34-40" stroke="#b4cfa7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="260" cy="43" r="5" fill="#bed3ac"/><circle cx="260" cy="43" r="11" stroke="#bed3ac" stroke-opacity=".25"/><circle cx="174" cy="102" r="3" fill="#6f9276"/><path d="M64 191h220M64 184v7m220-7v7" stroke="#55735a"/><text x="78" y="176" fill="#a4bda8" font-size="8" font-family="monospace" letter-spacing="2">OBSERVE · TEST · VERIFY</text><path d="M38 25v10m-5-5h10M296 156v10m-5-5h10" stroke="#708f74"/></svg><span class="visual-tag">RESEARCH, WITH CONTEXT.</span></div>`;
  }
  function summaryCard(label,value,unit,caption,iconName) {
    return `<article class="summary-card"><div class="summary-label">${esc(label)}${icon(iconName)}</div><div class="summary-number">${esc(value)}<small>${esc(unit)}</small></div><div class="summary-caption">${caption}</div></article>`;
  }
  function realizedDrawdown(report) {
    let peak=Number(report.summary.initial_deposit), worst=0;
    for(const trade of report.trades){const value=Number(trade.balance);peak=Math.max(peak,value);worst=Math.min(worst,(value/peak-1)*100);}
    return worst;
  }
  function overview() {
    const report = selected(), s = report.summary, dd = drawdown(report), w = win(report);
    const range = period(report);
    return `${pageHeading('YOUR RESEARCH, IN ONE PLACE','研究总览','把每一次测试，变成可追溯的研究记录。')}
      <section class="hero"><div><p class="eyebrow">MISTOFPANDIAN / TRADING RESEARCH</p><h2>让每一次回测，<br><em>有据可查。</em></h2><p>从一条交易记录到一组对照实验。<br>关注收益，也关注成本、风险与数据的边界。</p><div class="hero-actions"><a href="#reports" class="button hero-button">浏览研究报告 ${icon('arrow')}</a><a href="#methodology" class="hero-link">我们的研究方法 <span>↗</span></a></div></div>${heroVisual()}</section>
      <section class="summary-strip" aria-label="研究档案概况">
        ${summaryCard('已归档报告',String(reports.length).padStart(2,'0'),'份','<span class="good">已核验</span> · 仅统计可发布结果','document')}
        ${summaryCard('对照实验',String(studies.length+tuningStudies.length).padStart(2,'0'),'组','同一实验的方案分别保留','layers')}
        ${summaryCard('已收录策略',String(new Set(reports.map(r=>r.strategy)).size).padStart(2,'0'),'个','Moving Average · 官方示例','shield')}
        ${summaryCard('最近更新',dateText(reports[0].createdAt).slice(5),'',dateText(reports[0].createdAt).slice(0,4)+' 年 · 历史结果归档','clock')}
      </section>
      <div class="section-heading"><div><h2><span class="section-dot"></span> 最新研究表现</h2><p>${esc(range.from)} — ${esc(range.to)} · MT4 平台时间</p></div>${reportSelect()}</div>
      <div class="dashboard-grid"><section class="panel"><div class="panel-head"><div><h2 id="mainChartTitle">${state.chartMode==='balance'?'已平仓账户余额':'平仓余额回撤'}</h2><p class="panel-subtitle">${esc(report.symbol)} / ${esc(report.timeframe)} / 固定点差 ${report.spread} points</p><div class="chart-value-row"><span class="chart-value">${state.chartMode==='balance'?money(finalBalance(report)):realizedDrawdown(report).toFixed(2)}<small class="currency">${state.chartMode==='balance'?'USD':'%'}</small></span><span class="return-pill ${state.chartMode==='balance'&&returnPct(report)<0?'loss':''}">${state.chartMode==='balance'?pct(returnPct(report)):'仅平仓点计算'}</span></div></div><div class="segment" role="group" aria-label="选择图表指标"><button data-chart-mode="balance" aria-pressed="${state.chartMode==='balance'}">余额</button><button data-chart-mode="drawdown" aria-pressed="${state.chartMode==='drawdown'}">余额回撤</button></div></div><div id="overviewChart" class="chart-container"></div><div class="chart-caption"><span>来源：MT4 原生报告 · 横轴按平仓顺序排列</span><span>余额曲线，不是持仓净值</span></div></section>
      <aside class="panel metric-aside"><div class="metric-aside-head">本次回测摘要 <span class="tiny-badge">点差 ${report.spread}</span></div><dl class="metric-aside-body"><div class="metric-row"><dt>净利润</dt><dd class="${polarity(s.net_profit)}">${signed(s.net_profit)}<small>USD</small></dd></div><div class="metric-row"><dt>报告最大回撤</dt><dd>${esc(dd.percent)}<small>%</small></dd></div><div class="metric-row"><dt>盈利因子</dt><dd>${esc(s.profit_factor)}</dd></div><div class="metric-row"><dt>胜率 / 交易数</dt><dd>${esc(w.percent)}<small>% / ${esc(s.total_trades)}</small></dd></div></dl><div class="metric-aside-foot"><a href="#" data-open-report="${esc(report.id)}">查看逐笔交易与参数 <span>↗</span></a></div></aside></div>
      <div class="section-heading"><h2><span class="section-dot"></span> 最近归档</h2><a href="#reports">全部报告 <span>↗</span></a></div>
      <section class="panel table-scroll">${archiveTable(reports.slice(0,4))}</section>
      ${notice('当前档案包含原点差对照与时间平移参数研究；同组方案不是独立样本，不合并利润。训练与后续检验请在“时间平移调参”页面分开查看。全部结果均为离线历史回测。')}`;
  }
  function archiveTable(items) {
    return `<table class="report-table"><thead><tr><th scope="col">研究报告</th><th scope="col">净利润 / USD</th><th scope="col">最大回撤</th><th scope="col">状态</th><th scope="col"><span class="screen-reader">操作</span></th></tr></thead><tbody>${items.map(report => `<tr><td><div class="report-name"><span class="report-icon">${icon('document')}</span><div><strong>${esc(reportLabel(report))}</strong><small>${esc(report.strategy)} <span> / </span> ${dateText(report.createdAt)}</small></div></div></td><td class="mono ${polarity(report.summary.net_profit)}">${signed(report.summary.net_profit)}</td><td class="mono">${esc(drawdown(report).percent)}%</td><td>${verified}</td><td><button class="text-button" data-open-report="${esc(report.id)}">查看报告 <span>↗</span></button></td></tr>`).join('')}</tbody></table>`;
  }
  function reportCard(report) {
    const s = report.summary, range = period(report);
    const parameterTags = FILTERS.fields(DATA.metadata, {'d-eaId':report.eaId}).filter(f=>f.kind==='parameter'&&f.varying&&Object.hasOwn(report.parameters,f.key)).map(f=>`<span class="tag">${esc(f.label)} ${esc(report.parameters[f.key])}${f.unit?` ${esc(f.unit)}`:''}</span>`).join('');
    return `<article class="panel report-card"><div class="report-card-top"><span class="report-icon">${icon('document')}</span>${verified}</div><h2>${esc(reportLabel(report))}</h2><p class="description">${esc(report.strategy)} · ${esc(range.from)} — ${esc(range.to)}</p><div class="report-meta parameter-tags"><span class="tag">${esc(report.timeframe)}</span>${parameterTags}</div><dl class="report-card-metrics"><div><dt>净利润 / USD</dt><dd class="${polarity(s.net_profit)}">${signed(s.net_profit)}</dd></div><div><dt>报告最大回撤</dt><dd>${esc(drawdown(report).percent)}%</dd></div><div><dt>已完成交易</dt><dd>${esc(s.total_trades)}<small class="currency">笔</small></dd></div></dl><svg class="mini-chart" viewBox="0 0 400 75" data-sparkline="${esc(report.id)}" role="img" aria-label="${esc(report.symbol)} 点差 ${report.spread} 已平仓余额简图"></svg><div class="card-bottom"><span>固定点差 · 离线环境 · USD</span><button class="text-button" data-open-report="${esc(report.id)}">打开报告 <span>↗</span></button></div></article>`;
  }
  function filteredReports() {
    return FILTERS.filter(reports, DATA.metadata, state.filters, state.query);
  }
  function facetControl(field) {
    const current = state.filters[field.id] || '';
    return `<label class="facet-control" for="filter-${esc(field.id)}"><span>${esc(field.label)}${field.unit?` <small>(${esc(field.unit)})</small>`:''}</span>${field.kind==='parameter'?`<code>${esc(field.key)}</code>`:''}<select id="filter-${esc(field.id)}" data-report-filter="${esc(field.id)}" ${field.description?`aria-describedby="help-${esc(field.id)}"`:''}><option value="">${esc(field.allLabel)}</option>${field.options.map(option=>`<option value="${esc(option.value)}" ${current===option.value?'selected':''} ${!option.count&&current!==option.value?'disabled':''}>${esc(option.label)} · ${option.count} 份</option>`).join('')}</select>${field.description?`<small class="facet-help" id="help-${esc(field.id)}">${esc(field.description)}</small>`:''}</label>`;
  }
  function reportFacetFields(fixedOpen=false) {
    const fields = FILTERS.facets(reports, DATA.metadata, state.filters, state.query);
    const dimensions = fields.filter(f=>f.kind==='dimension');
    const varying = fields.filter(f=>f.kind==='parameter'&&f.varying);
    const fixed = fields.filter(f=>f.kind==='parameter'&&!f.varying);
    return `<div class="facet-heading"><h2>回测条件</h2><span>各条件取交集 · 选项数字为匹配报告数</span></div><div class="facet-grid">${dimensions.map(facetControl).join('')}</div><div class="facet-heading"><h2>EA 输入参数</h2><span>从已核验报告自动读取</span></div>${varying.length?`<div class="facet-grid parameter-grid">${varying.map(facetControl).join('')}</div>`:'<p class="metadata-note">当前 EA 的输入参数没有不同取值，可展开下方查看。</p>'}${fixed.length?`<details id="fixedParameters" class="fixed-parameters" ${fixedOpen?'open':''}><summary>更多参数 · 当前各 EA 内仅一个已收录取值（${fixed.length} 项）${fixed.some(f=>state.filters[f.id])?' · 已有筛选':''}</summary><div class="facet-grid parameter-grid">${fixed.map(facetControl).join('')}</div></details>`:''}`;
  }
  function reportFilters() {
    return `<section class="panel report-filters" aria-label="回测报告筛选"><div class="report-filter-toolbar"><label class="search-box">${icon('search')}<span class="screen-reader">搜索报告</span><input id="reportSearch" type="search" placeholder="搜索策略、品种、参数或报告…" value="${esc(state.query)}" autocomplete="off"></label><button class="button" data-action="reset-filters">清空筛选</button><span class="filter-count" id="reportCount" role="status" aria-live="polite"></span></div><div id="reportFilterFields">${reportFacetFields()}</div><p class="metadata-note">${esc(DATA.metadata.note)} 时间间隔为 K 线周期；平移量以根 K 线计，点差以 points 计。<a href="data/metadata.json" target="_blank" rel="noopener">查看元数据 JSON ↗</a></p></section>`;
  }
  function refreshReportFilters() {
    const focused = document.activeElement?.id;
    const fixedOpen = $('fixedParameters')?.open || false;
    $('reportFilterFields').innerHTML = reportFacetFields(fixedOpen);
    if (focused?.startsWith('filter-')) $(focused)?.focus({preventScroll:true});
    renderReportCards();
  }
  function reportList() {
    return `${pageHeading('THE RESEARCH ARCHIVE','回测报告','每一份报告，都保留参数、交易与验证依据。',`<button class="button heading-download" data-action="download-all">${icon('download')}导出研究数据</button>`)}${notice('只收录通过原始报告与逐笔记录核对的结果。同组参数和点差方案不能当作独立样本；训练与后续区间各自从初始资金开始，不能合并利润。')}${reportFilters()}<div class="report-cards" id="reportCards"></div>`;
  }
  function renderReportCards() {
    const filtered = filteredReports();
    $('reportCards').innerHTML = filtered.length ? filtered.map(reportCard).join('') : '<div class="panel empty-state">没有找到符合条件的报告。<br><button class="button" data-action="reset-filters">清空筛选</button></div>';
    $('reportCount').textContent = `${filtered.length} / ${reports.length} 份报告`;
    drawSparklines();
  }
  function tuningPage() {
    const study=tuningStudies[0];
    if(!study)return `${pageHeading('MOVING AVERAGE PARAMETER STUDY','时间平移调参','成功核验后的参数研究将在这里显示。')}${notice('暂无完整成功的调参归档。')}`;
    const all=reports.filter(r=>r.studyId===study.id);
    const rows=all.filter(r=>r.phase===state.tuningPhase && (state.tuningTimeframe==='all'||r.timeframe===state.tuningTimeframe)).sort((a,b)=>state.tuningSort==='drawdown'?Number(drawdown(a).percent)-Number(drawdown(b).percent):state.tuningSort==='trades'?Number(b.summary.total_trades)-Number(a.summary.total_trades):Number(b.summary.net_profit)-Number(a.summary.net_profit));
    const selection=Object.entries(study.selected).map(([tf,p])=>{
      const detail=study.selectionDetails[tf];
      return `<article class="panel tuning-selection"><p class="eyebrow">${esc(tf)} / ${detail.fallback?'原基准回退':'训练规则选出'}</p><h2>周期 ${p.period} · 平移 ${p.shift}</h2><p>${detail.fallback?'没有符合最低笔数与回撤条件的参数组。':`两种点差中的较低净利润 ${signed(detail.worst_spread_net_profit)} USD；最坏回撤 ${esc(detail.worst_drawdown_percent)}%。`}</p></article>`;
    }).join('');
    const header=['周期','均线 / 平移','点差 points','净利润 USD','收益率','最大回撤','交易数','标记','报告'];
    const table=rows.map(r=>`<tr><td><strong>${esc(r.timeframe)}</strong></td><td class="mono">${r.movingPeriod} / ${r.movingShift}</td><td class="mono">${r.spread}</td><td class="mono ${polarity(r.summary.net_profit)}">${signed(r.summary.net_profit)}</td><td class="mono">${pct(returnPct(r))}</td><td class="mono">${esc(drawdown(r).percent)}%</td><td class="mono">${esc(r.summary.total_trades)}</td><td>${r.selectedCandidate?'<span class="tag verified">训练选定</span>':''}${r.baseline?'<span class="tag">原基准</span>':''}${r.phase==='training'&&Number(r.summary.total_trades)<5?'<span class="tag">笔数不足</span>':''}${r.phase==='training'&&Number(drawdown(r).percent)>25?'<span class="tag">超回撤门槛</span>':''}</td><td><button class="text-button" data-open-report="${esc(r.id)}">查看报告 ↗</button></td></tr>`).join('');
    return `${pageHeading('MOVING AVERAGE / TIME SHIFT','时间平移调参','图表周期、均线参数与点差的网格研究。',`<button class="button" data-action="download-all">${icon('download')}导出全部研究数据</button>`)}
      ${notice(esc(study.validationCaveat))}
      <section class="tuning-intro panel"><h2>本次测试范围</h2><p>${esc(study.interpretation)}</p><p><strong>训练：</strong>2026.09.01—09.30，共 ${study.trainingRuns} 组；<strong>后续检验：</strong>2026.10.01—10.16，共 ${study.validationRuns} 组。每次从 1000 USD 重新开始，每个即时价模型。时间均为平台时间。</p><p>网格：H1 / H4 × 均线 8 / 12 / 20 × 平移 3 / 6 / 9 × 点差 20 / 30。其他输入不变。</p></section>
      <div class="section-heading"><h2><span class="section-dot"></span> 训练筛选结果</h2><span class="tag">不是实盘推荐</span></div><div class="tuning-selections">${selection}</div>
      <details class="panel tuning-rule"><summary>查看预先固定的选择规则与限制</summary><p>${esc(study.selectionRule)}</p><p>后续检验仅比较所选参数与原基准 12/6，结果不再用于重选。本轮多组筛选存在过拟合风险；样本与交易笔数较少。</p><p>${esc(study.costCaveat)}</p><p>曲线为平仓余额，不是持仓净值。MT4 的净利润与最终余额分别舍入，可能相差 0.01 USD，均保留原报告数值。</p></details>
      <div class="section-heading"><h2><span class="section-dot"></span> 分区间结果</h2><span class="tag">逐笔与参数可展开核对</span></div>
      <div class="filter-bar"><label>区间 <select id="tuningPhase" aria-label="选择研究区间"><option value="validation" ${state.tuningPhase==='validation'?'selected':''}>后续检验 · 10月1—16日</option><option value="training" ${state.tuningPhase==='training'?'selected':''}>训练筛选 · 9月1—30日</option></select></label><label>图表周期 <select id="tuningTimeframe" aria-label="筛选K线周期">${['all','H1','H4'].map(tf=>`<option value="${tf}" ${state.tuningTimeframe===tf?'selected':''}>${tf==='all'?'全部周期':tf}</option>`).join('')}</select></label><label>排序 <select id="tuningSort" aria-label="调参结果排序"><option value="net" ${state.tuningSort==='net'?'selected':''}>净利润从高到低</option><option value="drawdown" ${state.tuningSort==='drawdown'?'selected':''}>回撤从低到高</option><option value="trades" ${state.tuningSort==='trades'?'selected':''}>交易数从多到少</option></select></label><span class="filter-count">${rows.length} 组 · ${state.tuningPhase==='training'?'训练结果，不是后续验证':'后续区间，不参与本轮筛选'}</span></div>
      <section class="panel table-scroll"><table class="report-table tuning-table"><thead><tr>${header.map(t=>`<th scope="col">${esc(t)}</th>`).join('')}</tr></thead><tbody>${table}</tbody></table></section>
      ${notice('点数在本研究中指固定点差，不是止损止盈距离；20 / 30 points 在当前 EURUSD 五位报价中为 2 / 3 pip。不同参数可能产生不同交易，不能把差额全部解释为点差成本。所有历史结果均不保证未来收益。')}`;
  }
  function comparison() {
    const pair = studyReports(), first=pair[0], second=pair[1];
    if (!first || !second) return pageHeading('CONTROLLED EXPERIMENTS','实验对照','需要同一组实验的两种点差结果。');
    const a=first.summary,b=second.summary,reduction=Number(a.net_profit)-Number(b.net_profit);
    const percentReduction = Number(a.net_profit) ? reduction/Number(a.net_profit)*100 : null;
    const rows = [
      ['净利润 / USD',signed(a.net_profit),signed(b.net_profit)],
      ['初始资金收益率',pct(returnPct(first)),pct(returnPct(second))],
      ['报告最大回撤 / USD',drawdown(first).amount,drawdown(second).amount],
      ['报告最大回撤比例',drawdown(first).percent+'%',drawdown(second).percent+'%'],
      ['盈利因子',a.profit_factor,b.profit_factor],
      ['已完成交易 / 笔',a.total_trades,b.total_trades],
      ['胜率',win(first).percent+'%',win(second).percent+'%'],
      ['每笔预期收益 / USD',a.expected_payoff,b.expected_payoff]
    ];
    return `${pageHeading('ONE VARIABLE, TWO OUTCOMES','实验对照','固定其他条件，观察交易成本如何改变结果。')}<div class="filter-bar"><label for="studySelect" class="filter-count" style="margin-left:0">实验档案</label><select id="studySelect" aria-label="选择对照实验">${studies.map(study=>`<option value="${esc(study.id)}" ${study.id===state.study?'selected':''}>${dateText(study.createdAt)} · ${esc(study.symbol)} 点差对照</option>`).join('')}</select><span class="filter-count">同一策略 / 同一数据 / 同一参数</span></div><div class="compare-layout"><section class="panel"><div class="panel-head"><div><h2>相同交易，不同成本</h2><p class="panel-subtitle">${esc(first.strategy)} · ${esc(first.symbol)} ${esc(first.timeframe)} · ${num(a.initial_deposit)} USD 初始资金</p></div>${verified}</div><div class="table-scroll section-spaced"><table class="comparison-table"><thead><tr><th scope="col">报告指标</th><th scope="col">点差 ${first.spread}</th><th scope="col">点差 ${second.spread}</th></tr></thead><tbody>${rows.map((row,i)=>`<tr ${i===0?'class="emphasized"':''}>${row.map((cell,j)=>`<td class="${j?'mono':''}">${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section><aside class="insight"><p class="eyebrow">THE COST OF SPREAD</p><h2>多出 1 个标准点，<br>这次少赚了多少？</h2><div class="insight-number">${percentReduction===null?'—':percentReduction.toFixed(1)+'%'}</div><p>净利润相对减少。胜率相同，<br>并不意味着盈利能力相同。</p><div class="insight-equation"><div>${esc(a.total_trades)}<small>笔完整交易</small></div><span>×</span><div>$${money(reduction/Number(a.total_trades))}<small>每笔利润减少</small></div><span>=</span><div>$${money(reduction)}<small>总利润减少</small></div></div></aside><section class="panel full-width"><div class="panel-head"><div><h2>已平仓余额 · 双方案对照</h2><p class="panel-subtitle">两组均从 ${num(a.initial_deposit)} USD 开始；横轴为平仓顺序</p></div><div class="chart-legend"><span><i style="background:var(--green)"></i>点差 ${first.spread}</span><span><i style="background:var(--blue)"></i>点差 ${second.spread}</span></div></div><div id="compareChart" class="chart-container"></div><div class="chart-caption"><span>来源：同组两份 MT4 报告 · ${esc(period(first).from)} — ${esc(period(first).to)}</span><span>曲线不包含持仓期间浮动盈亏</span></div></section></div>${notice('两组开平仓时间、方向与手数一致，均为 0.10 手。此处只比较本次固定点差实验；每笔减少 1 USD 不是适用于所有品种或合约的通用成本公式。')}`;
  }
  function dataPage() {
    const histories = DATA.history || [];
    return `${pageHeading('DATA & PROVENANCE','数据档案','看清数据从哪里来，以及它能支持什么结论。')}<section class="data-stats"><article class="panel"><h2>历史数据周期</h2><strong>${histories.length.toString().padStart(2,'0')}</strong><p>M1 / H1 / H4 · 归档检查</p></article><article class="panel"><h2>报告错配错误</h2><strong>${reports.reduce((sum,r)=>sum+Number(r.summary.mismatched_chart_errors),0)}</strong><p>仅对应已收录测试</p></article><article class="panel"><h2>核验方式</h2><strong>SHA256</strong><p>保留原始报告文件指纹</p></article></section><div class="section-heading"><h2><span class="section-dot"></span> 本地历史文件覆盖</h2><span class="tag">范围 ≠ 完整性认证</span></div><section class="panel table-scroll"><table class="report-table history-table"><thead><tr><th scope="col">周期</th><th scope="col">K 线数量</th><th scope="col">最早记录 / 平台时间</th><th scope="col">最晚记录 / 平台时间</th></tr></thead><tbody>${histories.map(history=>`<tr><td><strong>${history.periodMinutes===1?'M1':history.periodMinutes===60?'H1':history.periodMinutes===240?'H4':esc(history.periodMinutes)+' min'}</strong></td><td class="mono">${num(history.bars)}</td><td class="mono">${esc(history.first)}</td><td class="mono">${esc(history.last)}</td></tr>`).join('')}</tbody></table></section>${notice('覆盖范围来自本地历史文件检查，不代表每一分钟都完整或与真实券商一致。H4 数据无法还原 H1 每个即时价模型需要的分钟内价格路径；历史文件中的时间未核实为 UTC。')}<div class="section-heading section-spaced"><h2><span class="section-dot"></span> 报告来源指纹</h2><span class="tag">SHA-256</span></div><section class="panel"><div class="panel-padding">${reports.map(report=>`<div style="padding:12px 0"><strong style="font-size:11px">${esc(reportLabel(report))}</strong><p class="hash">${esc(report.sourceHash)}</p></div>`).join('')}</div></section><div class="panel download-box"><div><h2>带走数据，继续你的研究。</h2><p>公开 JSON 包含核对后的指标、逐笔交易与历史覆盖摘要，不包含账户信息、本机路径或终端配置。</p></div><button class="button" data-action="download-all">${icon('download')}下载研究数据 JSON</button></div>`;
  }
  function methodology() {
    return `${pageHeading('CONTEXT BEFORE CONCLUSIONS','方法与边界','一份有用的报告，也应该说清楚它不能证明什么。')}<section class="hero" style="min-height:180px"><div><p class="eyebrow">THE RESEARCH PRINCIPLE</p><h2>结果可以复查，<br><em>结论保留边界。</em></h2><p>这是个人交易研究档案，不是实盘业绩展示，也不提供投资建议。</p></div>${heroVisual()}</section><div class="method-grid"><section class="panel method-section"><div class="step">01 / SOURCE</div><h2>从真实报告开始</h2><p>当前收录 MT4 官方 Moving Average 的 EURUSD H1 点差对照及 H1/H4 时间平移调参。仅回测版本限制在策略测试器内运行。</p><ul><li>逐项核对原始报告统计与已保存摘要。</li><li>逐笔核对开平仓事件，保留余额列原始数值。</li><li>保留报告 SHA-256 指纹，公开数据按白名单重建。</li></ul></section><section class="panel method-section"><div class="step">02 / CONTROL</div><h2>区分成本对照与参数筛选</h2><p>原点差实验固定日期、策略参数、资金与数据，只改点差20/30。新增调参研究比较多个周期和均线参数，以9月筛选，10月作后续检验，不将多参数差异解释成纯点差效果。</p><ul><li>同组参数方案不是独立样本；后续区间此前已被包含在旧基准中，不是严格未见样本。</li><li>均为离线默认合约环境，未连接交易服务器。</li><li>尚未验证真实手续费、隔夜费、滑点或动态点差。</li></ul></section><section class="panel method-section"><div class="step">03 / INTERPRET</div><h2>区分余额与净值</h2><p>网站曲线来自平仓后的账户余额，不包含持仓时的浮动盈亏。图表的“余额回撤”只根据这些平仓点计算。</p><ul><li>“报告最大回撤”直接采用 MT4 原始报告口径。</li><li>余额曲线无法推断逐即时价净值或最大浮亏。</li><li>每笔利润有舍入，余额不以舍入后利润重新累计。</li></ul></section><section class="panel method-section"><div class="step">04 / LIMITS</div><h2>保留模型的不确定性</h2><p>当前测试采用每个即时价模型，包含分形插值。90% 建模质量并不是盈利概率、胜率或真实 tick 认证。</p><ul><li>平台历史时间未经验证为 UTC。</li><li>订单未设置固定止损止盈，策略条件决定退出。</li><li>末笔“测试结束”是测试器强制平仓，而非触发止损。</li><li>MaximumRisk 参数不是有止损保障的单笔风险上限。</li></ul></section></div><div class="panel download-box"><div><h2>关于 mistofpandian</h2><p>独立的个人研究空间。图表在浏览器本地渲染；站点不连接交易账户，也不执行交易。</p></div><a class="button" href="#reports">回到研究档案 ${icon('arrow')}</a></div>${notice('历史表现不保证未来收益。请在独立样本、可靠数据与真实成交成本下继续验证策略；本站任何数字都不应被视为盈利承诺。')}`;
  }
  function renderRoute() {
    const hash = location.hash.slice(1).split('?')[0];
    state.route = titles[hash] ? hash : 'overview';
    document.title = `${titles[state.route]} · mistofpandian`;
    $('breadcrumbTitle').textContent = titles[state.route];
    document.querySelectorAll('[data-route]').forEach(link => {
      const active=link.dataset.route===state.route; link.classList.toggle('active',active);
      if(active) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
    });
    $('main').innerHTML = ({overview,tuning:tuningPage,reports:reportList,compare:comparison,data:dataPage,methodology})[state.route]();
    if(state.route==='reports') renderReportCards();
    drawAllCharts(); closeMenu();
  }
  window.addEventListener('hashchange', () => { renderRoute(); window.scrollTo(0,0); });
  function drawSparklines() {
    document.querySelectorAll('[data-sparkline]').forEach(svg => {
      const report=reportById(svg.dataset.sparkline), values=[Number(report.summary.initial_deposit),...report.trades.map(trade=>Number(trade.balance))];
      const lo=Math.min(...values)-5,hi=Math.max(...values)+5;
      const points=values.map((value,index)=>`${index/Math.max(1,values.length-1)*400},${68-(value-lo)/(hi-lo)*59}`);
      svg.innerHTML=`<title>${esc(report.title)} · 已平仓余额简图</title><desc>横轴：已完成交易 0 至 ${report.trades.length} 笔；纵轴：账户余额 ${money(lo)} 至 ${money(hi)} USD。来源：MT4 原生报告。</desc><path d="M0 70H400" stroke="var(--line)" fill="none"/><path d="M${points.join(' L')}" stroke="var(--green)" stroke-width="1.8" fill="none" stroke-linejoin="round"/>`;
    });
  }
  function chart(targetId,items,mode='balance') {
    const container=$(targetId); if(!container) return;
    const dark=document.body.classList.contains('dark');
    const colors=dark?['#a0c9aa','#93abb5']:['#3d8967','#a0b0b6'];
    const gridColor=dark?'#2e3b34':'#edf0ee',textColor=dark?'#8eaa98':'#99a59e';
    const NS='http://www.w3.org/2000/svg',W=Math.max(420,Math.min(900,Math.round(container.clientWidth||800))),H=265,pad={left:57,right:23,top:20,bottom:49};
    const series=items.map((report,index)=>{
      const balances=[Number(report.summary.initial_deposit),...report.trades.map(trade=>Number(trade.balance))];
      let peak=balances[0];
      const values=mode==='drawdown'?balances.map(value=>{peak=Math.max(peak,value);return (value/peak-1)*100;}):balances;
      return {report,values,color:colors[index%colors.length]};
    });
    const all=series.flatMap(item=>item.values),min=Math.min(...all),max=Math.max(...all),span=Math.max(max-min,mode==='drawdown'?1:20);
    let lo,hi,step;
    if(mode==='drawdown'){step=Math.max(1,Math.ceil(span/4));lo=Math.floor((min-.3)/step)*step;hi=0;}
    else {step=Math.max(10,Math.ceil(span/4/10)*10);lo=Math.floor((min-span*.09)/step)*step;hi=Math.ceil((max+span*.09)/step)*step;}
    const count=Math.max(...series.map(item=>item.values.length))-1;
    const x=index=>pad.left+index/Math.max(1,count)*(W-pad.left-pad.right);
    const y=value=>pad.top+(hi-value)/(hi-lo)*(H-pad.top-pad.bottom);
    container.innerHTML='';
    const svg=document.createElementNS(NS,'svg');
    svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.classList.add('research-chart');
    svg.setAttribute('role','slider');svg.setAttribute('tabindex','0');
    svg.setAttribute('aria-label',`${mode==='drawdown'?'平仓余额回撤百分比':'已平仓账户余额 USD'}，横轴已完成交易笔数，使用左右方向键逐笔查看`);
    svg.setAttribute('aria-valuemin','0');svg.setAttribute('aria-valuemax',String(count));svg.setAttribute('aria-valuenow','0');
    const make=(tag,attributes,text,parent=svg)=>{
      const node=document.createElementNS(NS,tag);Object.entries(attributes).forEach(([key,value])=>node.setAttribute(key,String(value)));
      if(text!==undefined)node.textContent=text;parent.append(node);return node;
    };
    make('title',{},mode==='drawdown'?'平仓余额回撤（%）':'已平仓账户余额（USD）');
    make('desc',{},`来源：MT4 原生报告。横轴：已完成交易 0 至 ${count} 笔。纵轴：${mode==='drawdown'?'平仓余额相对历史平仓高点的回撤百分比，不是 MT4 报告最大回撤':'账户余额 USD，不包含持仓浮动盈亏'}。`);
    const ticks=Math.round((hi-lo)/step);
    for(let i=0;i<=ticks;i++){
      const value=lo+i*step;
      make('line',{x1:pad.left,y1:y(value),x2:W-pad.right,y2:y(value),stroke:gridColor,'stroke-dasharray':'3 5'});
      make('text',{x:pad.left-12,y:y(value)+3,'text-anchor':'end',fill:textColor,'font-size':10,'font-family':'monospace'},mode==='drawdown'?value+'%':num(value));
    }
    const xTicks=Array.from(new Set([0,...Array.from({length:Math.floor(count/10)},(_,i)=>(i+1)*10),count]));
    xTicks.forEach(index=>make('text',{x:x(index),y:H-28,'text-anchor':'middle',fill:textColor,'font-size':10,'font-family':'monospace'},index));
    make('text',{x:(pad.left+W-pad.right)/2,y:H-7,'text-anchor':'middle',fill:textColor,'font-size':9},'已完成交易（笔）');
    make('text',{x:pad.left,y:10,fill:textColor,'font-size':9},mode==='drawdown'?'平仓余额回撤（%）':'账户余额（USD）');
    if(series.length===1){
      const item=series[0],bottom=mode==='drawdown'?y(0):H-pad.bottom;
      const d=`M${x(0)} ${bottom} L${item.values.map((value,index)=>`${x(index)} ${y(value)}`).join(' L')} L${x(count)} ${bottom} Z`;
      make('path',{d,fill:mode==='drawdown'?(dark?'#734c4525':'#bb736b12'):(dark?'#99bf9812':'#7ca7850e')});
    }
    series.forEach(item=>{
      const color=mode==='drawdown'?(dark?'#d7968c':'#b47a70'):item.color;
      make('path',{d:'M'+item.values.map((value,index)=>`${x(index)} ${y(value)}`).join(' L'),fill:'none',stroke:color,'stroke-width':2.3,'stroke-linejoin':'round','stroke-linecap':'round'});
      const last=item.values.length-1;
      make('circle',{cx:x(last),cy:y(item.values[last]),r:3.4,fill:color,stroke:dark?'#1d2623':'white','stroke-width':2});
    });
    const cursor=make('line',{x1:0,y1:pad.top,x2:0,y2:H-pad.bottom,stroke:textColor,'stroke-dasharray':'3 5',visibility:'hidden'});
    const circles=series.map(item=>make('circle',{r:4,fill:item.color,stroke:dark?'#1d2623':'#fff','stroke-width':2,visibility:'hidden'}));
    container.append(svg);
    const tooltip=document.createElement('div');tooltip.className='chart-tooltip';tooltip.hidden=true;container.append(tooltip);
    const hint=document.createElement('span');hint.className='chart-keyboard-hint';hint.textContent='← → 逐笔查看 · Home / End 跳转';container.append(hint);
    let activeIndex=0;
    function show(index,pointerX){
      activeIndex=Math.max(0,Math.min(count,index));
      const px=x(activeIndex);cursor.setAttribute('x1',px);cursor.setAttribute('x2',px);cursor.setAttribute('visibility','visible');
      circles.forEach((circle,i)=>{circle.setAttribute('cx',px);circle.setAttribute('cy',y(series[i].values[activeIndex]));circle.setAttribute('visibility','visible');});
      const first=series[0].report;
      tooltip.innerHTML=(activeIndex?`第 ${activeIndex} 笔平仓 · ${esc(first.trades[activeIndex-1].closed)}`:'起始资金')+'<br>'+series.map(item=>`点差 ${item.report.spread}：<strong>${mode==='drawdown'?item.values[activeIndex].toFixed(2)+'%':'$'+money(item.values[activeIndex])}</strong>`).join('<br>');
      tooltip.hidden=false;
      const rect=container.getBoundingClientRect(),ideal=pointerX===undefined?px/W*rect.width:pointerX-rect.left;
      tooltip.style.left=Math.max(6,Math.min(ideal+12,rect.width-tooltip.offsetWidth-8))+'px';tooltip.style.top='30px';
      svg.setAttribute('aria-valuenow',String(activeIndex));
      svg.setAttribute('aria-valuetext',`第 ${activeIndex} 笔，${series.map(item=>`点差 ${item.report.spread}：${mode==='drawdown'?item.values[activeIndex].toFixed(2)+'%':money(item.values[activeIndex])+' USD'}`).join('；')}`);
    }
    function hide(){cursor.setAttribute('visibility','hidden');circles.forEach(circle=>circle.setAttribute('visibility','hidden'));tooltip.hidden=true;}
    svg.addEventListener('pointermove',event=>{const rect=svg.getBoundingClientRect();show(Math.round(((event.clientX-rect.left)/rect.width*W-pad.left)/(W-pad.left-pad.right)*count),event.clientX);});
    svg.addEventListener('pointerleave',()=>{if(document.activeElement!==svg)hide();});
    svg.addEventListener('focus',()=>show(activeIndex));svg.addEventListener('blur',hide);
    svg.addEventListener('keydown',event=>{
      const next={ArrowRight:activeIndex+1,ArrowLeft:activeIndex-1,Home:0,End:count}[event.key];
      if(next!==undefined){event.preventDefault();show(next);}
    });
  }
  function drawAllCharts(){
    if($('overviewChart'))chart('overviewChart',[selected()],state.chartMode);
    if($('compareChart'))chart('compareChart',studyReports());
    drawSparklines();
  }
  function exportReport(report){
    download(`mistofpandian-${report.id}.json`,JSON.stringify({site:DATA.site,report,notes:publicNotes()},null,2));
    notify('已导出本方案的公开研究数据');
  }
  function publicNotes(){return ['离线默认合约环境，非实盘表现。','余额曲线不含持仓浮动盈亏。','同组方案不是独立样本。','平台时间未经验证为 UTC。','仅发布白名单字段，原始终端文件未公开。'];}
  function filteredTrades(){
    const report=reportById(state.dialog),query=state.tradeQuery.trim();
    return report.trades.filter(trade=>(state.direction==='all'||trade.direction===state.direction)&&(!query||[trade.ticket,trade.opened,trade.closed].some(value=>value.includes(query))));
  }
  function exportCSV(){
    const report=reportById(state.dialog), rows=filteredTrades();
    const keys=['ticket','direction','lots','opened','closed','entry','exit','profit','balance','reason'];
    const header=['订单','方向','手数','开仓时间（平台时间）','平仓时间（平台时间）','开仓价','平仓价','利润USD','平仓余额USD','退出原因'];
    const quote=value=>'"'+String(value).replace(/^[=+@\t\r]/,"'").replace(/"/g,'""')+'"';
    const csv='\ufeff'+[header,...rows.map(trade=>keys.map(key=>trade[key]))].map(row=>row.map(quote).join(',')).join('\r\n');
    download(`mistofpandian-${report.id}-trades.csv`,csv,'text/csv;charset=utf-8');
    notify(`已导出筛选后的 ${rows.length} 笔交易`);
  }
  function dialogTrades(){
    return `<div class="filter-bar"><label class="search-box">${icon('search')}<span class="screen-reader">搜索订单或日期</span><input type="search" id="tradeSearch" placeholder="订单号 / 日期，如 2026.09" value="${esc(state.tradeQuery)}"></label><select id="directionFilter" aria-label="筛选交易方向"><option value="all">全部方向</option><option value="buy" ${state.direction==='buy'?'selected':''}>买入</option><option value="sell" ${state.direction==='sell'?'selected':''}>卖出</option></select><button class="button" data-action="export-csv">${icon('download')}导出 CSV</button></div><div class="table-scroll"><table class="report-table trade-table"><thead><tr><th scope="col">订单 / 方向</th><th scope="col">开仓时间</th><th scope="col">平仓时间</th><th scope="col">手数</th><th scope="col">盈亏 / USD</th><th scope="col">余额 / USD</th></tr></thead><tbody id="tradeRows"></tbody></table></div><div class="pagination"><span id="tradeCount" role="status" aria-live="polite"></span><div class="pagination-controls"><button class="button" id="previousPage" data-action="previous-page">上一页</button><span id="pageCount"></span><button class="button" id="nextPage" data-action="next-page">下一页</button></div></div>`;
  }
  function renderTradeRows(){
    if(!$('tradeRows'))return;
    const trades=filteredTrades(),pageCount=Math.max(1,Math.ceil(trades.length/10));state.page=Math.min(state.page,pageCount);
    const page=trades.slice((state.page-1)*10,state.page*10);
    $('tradeRows').innerHTML=page.length?page.map(trade=>`<tr><td><span class="mono">#${esc(trade.ticket)}</span> <span class="direction-${trade.direction==='buy'?'buy':'sell'}">${trade.direction==='buy'?'买入':'卖出'}</span></td><td class="mono">${esc(trade.opened)}</td><td class="mono">${esc(trade.closed)}${trade.reason==='close at stop'?'<small class="tag" style="margin-left:5px">测试结束</small>':''}</td><td class="mono">${esc(trade.lots)}</td><td class="mono ${polarity(trade.profit)}">${signed(trade.profit)}</td><td class="mono">${money(trade.balance)}</td></tr>`).join(''):'<tr><td colspan="6" style="padding:30px;text-align:center">没有匹配的交易，请调整日期或方向筛选。</td></tr>';
    $('tradeCount').textContent=`筛选后 ${trades.length} / ${reportById(state.dialog).trades.length} 笔 · 每页 10 笔`;
    $('pageCount').textContent=`${state.page} / ${pageCount}`;
    $('previousPage').disabled=state.page<=1;$('nextPage').disabled=state.page>=pageCount;
  }
  function dialogParameters(report){
    const s=report.summary,fields=[['策略',report.strategy],['品种 / 周期',report.symbol+' / '+report.timeframe],['固定点差',report.spread+' points'],['初始资金',s.initial_deposit+' USD'],['模型',s.model],['建模质量',s.history_quality+'（不是盈利概率）'],['K 线 / 模拟即时价',num(s.bars)+' / '+num(s.ticks)],['图表错配错误',s.mismatched_chart_errors],...Object.entries(report.parameters)];
    return `<dl class="parameter-list">${fields.map(([key,value])=>`<div ${key==='模型'?'class="wide"':''}><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>${notice('MaximumRisk 不是有止损保证的单笔风险上限。本报告未设置订单级固定止损止盈；EA 按条件退出，最后一笔由测试器结束时平仓。')}`;
  }
  function renderDialogTab(){
    const report=reportById(state.dialog);
    $('dialogTabPanel').innerHTML=state.tab==='trades'?dialogTrades():dialogParameters(report);
    document.querySelectorAll('[data-dialog-tab]').forEach(button=>{const active=button.dataset.dialogTab===state.tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
    $('dialogTabPanel').setAttribute('aria-labelledby',state.tab==='trades'?'tradesTab':'parametersTab');
    renderTradeRows();
  }
  function openReport(id){
    const report=reportById(id);if(!report)return;
    state.dialog=id;state.tab='trades';state.direction='all';state.tradeQuery='';state.page=1;
    const s=report.summary,dd=drawdown(report);
    $('dialogContent').innerHTML=`<div class="dialog-header"><div><p class="eyebrow">VERIFIED BACKTEST REPORT</p><h2 id="dialogTitle">${esc(reportLabel(report))}</h2><p>${esc(report.strategy)} / ${esc(period(report).from)} — ${esc(period(report).to)} / 平台时间</p></div><button class="icon-button" data-action="close-dialog" aria-label="关闭报告">${icon('close')}</button></div><div class="dialog-body"><div class="dialog-actions">${verified}<span class="tag">离线历史回测</span><button class="button" data-action="export-report">${icon('download')}导出 JSON</button><a class="button" href="${esc(report.reportUrl)}" target="_blank" rel="noopener">${icon('external')}独立报告 / 打印</a></div><dl class="dialog-metrics"><div class="dialog-metric"><dt>净利润 / USD</dt><dd class="${polarity(s.net_profit)}">${signed(s.net_profit)}</dd></div><div class="dialog-metric"><dt>资金收益率</dt><dd>${pct(returnPct(report))}</dd></div><div class="dialog-metric"><dt>报告最大回撤</dt><dd>${esc(dd.percent)}<small>%</small></dd></div><div class="dialog-metric"><dt>交易 / 胜率</dt><dd>${esc(s.total_trades)}<small> / ${esc(win(report).percent)}%</small></dd></div></dl><div role="tablist" aria-label="报告内容" class="dialog-tabs"><button id="tradesTab" role="tab" aria-controls="dialogTabPanel" data-dialog-tab="trades" aria-selected="true">逐笔交易</button><button id="parametersTab" role="tab" aria-controls="dialogTabPanel" data-dialog-tab="parameters" aria-selected="false" tabindex="-1">测试条件与参数</button></div><div id="dialogTabPanel" role="tabpanel" aria-labelledby="tradesTab"></div><div class="provenance"><strong>验证依据</strong> · 原始报告统计与逐笔交易记录一致；公开页面由白名单字段重建，并非未经处理的原始 HTML。<br>原始报告 SHA-256：<span class="hash">${esc(report.sourceHash)}</span><br>曲线与交易数据不包含持仓中的浮动盈亏；历史结果不保证未来表现。</div></div>`;
    renderDialogTab();$('reportDialog').showModal();
  }
  $('reportDialog').addEventListener('click',event=>{if(event.target===$('reportDialog')){const rect=$('reportDialog').getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)$('reportDialog').close();}});
  $('reportDialog').addEventListener('close',()=>{state.dialog=null;});
  document.addEventListener('click',event=>{
    const open=event.target.closest('[data-open-report]');
    if(open){event.preventDefault();openReport(open.dataset.openReport);return;}
    const mode=event.target.closest('[data-chart-mode]');
    if(mode){state.chartMode=mode.dataset.chartMode;const scroll=window.scrollY;renderRoute();window.scrollTo(0,scroll);return;}
    const tab=event.target.closest('[data-dialog-tab]');
    if(tab){state.tab=tab.dataset.dialogTab;renderDialogTab();return;}
    const action=event.target.closest('[data-action]');if(!action)return;
    switch(action.dataset.action){
      case 'download-all':download('mistofpandian-research.json',JSON.stringify({...DATA,notes:publicNotes()},null,2));notify('已导出全部公开研究数据');break;
      case 'reset-filters':state.query='';state.filters={};renderRoute();$('reportSearch')?.focus();break;
      case 'close-dialog':$('reportDialog').close();break;
      case 'export-report':exportReport(reportById(state.dialog));break;
      case 'export-csv':exportCSV();break;
      case 'previous-page':state.page--;renderTradeRows();break;
      case 'next-page':state.page++;renderTradeRows();break;
    }
  });
  document.addEventListener('input',event=>{
    if(event.target.id==='reportSearch'){state.query=event.target.value;refreshReportFilters();}
    if(event.target.id==='tradeSearch'){state.tradeQuery=event.target.value;state.page=1;renderTradeRows();}
  });
  document.addEventListener('change',event=>{
    const field = event.target.dataset.reportFilter;
    if (field) { state.filters=FILTERS.update(state.filters,field,event.target.value);refreshReportFilters();return; }
    switch(event.target.id){
      case 'reportSelect':state.selected=event.target.value;renderRoute();break;
      case 'directionFilter':state.direction=event.target.value;state.page=1;renderTradeRows();break;
      case 'tuningPhase':state.tuningPhase=event.target.value;renderRoute();break;
      case 'tuningTimeframe':state.tuningTimeframe=event.target.value;renderRoute();break;
      case 'tuningSort':state.tuningSort=event.target.value;renderRoute();break;
      case 'studySelect':state.study=event.target.value;renderRoute();break;
    }
  });
  document.addEventListener('keydown',event=>{
    const tab=event.target.closest('[data-dialog-tab]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();state.tab=event.key==='Home'?'trades':event.key==='End'?'parameters':state.tab==='trades'?'parameters':'trades';renderDialogTab();
    document.querySelector(`[data-dialog-tab="${state.tab}"]`).focus();
  });
  let resizeTimer;
  window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(drawAllCharts,120);if(window.innerWidth>760)closeMenu();else if(!$('sidebar').classList.contains('open'))$('sidebar').inert=true;});
  renderRoute();
})();
