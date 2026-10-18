/* Free aggregate page-view counting via Hits. No visitor IDs, analytics cookies,
   remote JavaScript, query strings, search terms, account data, or trade data.
   Public counters are approximate page views, not unique visitors. */
'use strict';
(() => {
  const ORIGIN = 'https://pandar1young.github.io';
  const PREFIX = '/mistofpandian/';
  const COUNTER = 'https://hits.sh/pandar1young.github.io/mistofpandian';
  const PRIVACY_KEY = 'mistofpandian-analytics-optout';
  const ROUTES = new Set(['overview', 'reports', 'compare', 'data', 'methodology']);
  const REPORT_ID = /^\d{8}_\d{6}_\d{6}-s(?:20|30)$/;
  const live = location.origin === ORIGIN && location.pathname.startsWith(PREFIX);
  const privacySignal = navigator.globalPrivacyControl === true ||
    navigator.doNotTrack === '1' || navigator.doNotTrack === 'yes' || window.doNotTrack === '1';
  let optedOut = false, preferenceSaved = true;
  try { optedOut = localStorage.getItem(PRIVACY_KEY) === '1'; } catch (_) { preferenceSaved = false; }
  let lastPage = null, sequence = 0;
  const pending = new Set();
  const footer = document.querySelector('.site-footer') || document.querySelector('footer');
  const widget = document.createElement('span');
  widget.className = 'analytics-widget';
  widget.setAttribute('aria-label', '网站访问统计');
  const stats = document.createElement('a');
  stats.href = COUNTER + '/'; stats.target = '_blank'; stats.rel = 'noopener noreferrer';
  stats.textContent = '访问统计'; stats.title = '查看累计、每周与每月访问次数（公开，非独立访客数）';
  const badge = document.createElement('img');
  badge.alt = '累计访问次数（PV，非独立访客）'; badge.width = 72; badge.height = 20;
  badge.referrerPolicy = 'no-referrer'; badge.hidden = true;
  const status = document.createElement('span');
  status.className = 'analytics-status';
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.className = 'analytics-toggle';
  widget.append(stats, badge, status, toggle);
  if (footer) footer.append(widget);
  function enabled() { return live && !privacySignal && !optedOut; }
  function refresh() {
    toggle.disabled = !live || privacySignal;
    toggle.textContent = optedOut ? '开启统计' : '关闭统计';
    badge.hidden = !enabled();
    status.textContent = !live ? '本地预览不计数' : privacySignal ? '已尊重浏览器隐私信号' : optedOut ? (preferenceSaved ? '本浏览器已退出统计' : '本页已退出统计（偏好无法保存）') : '无 Cookie · 近似 PV';
  }
  function badgeURL(key) {
    // Cache busting prevents browser caches from suppressing genuine subsequent visits.
    return `${COUNTER}${key}.svg?label=PV&color=21745c&labelColor=7b8980&_=${Date.now()}-${++sequence}`;
  }
  function increment(key) {
    if (!enabled()) return;
    const image = new Image(); image.referrerPolicy = 'no-referrer';
    pending.add(image);
    image.onload = image.onerror = () => pending.delete(image);
    image.src = badgeURL(key);
  }
  function pageKey() {
    const suffix = location.pathname.slice(PREFIX.length);
    const match = /^reports\/(.+)\.html$/.exec(suffix);
    if (match) return REPORT_ID.test(match[1]) ? 'report-' + match[1] : null;
    if (suffix !== '' && suffix !== 'index.html') return null;
    const hash = location.hash.slice(1).split('?')[0];
    return ROUTES.has(hash) ? hash : 'overview';
  }
  function pageView() {
    if (!enabled()) return;
    const page = pageKey();
    if (!page || page === lastPage) return;
    lastPage = page;
    // One request updates the visible aggregate badge, one the fixed page bucket.
    badge.hidden = false; badge.src = badgeURL('');
    increment('/pages/' + page);
  }
  badge.onerror = () => { badge.hidden = true; status.textContent = '统计暂不可用，网站功能不受影响'; };
  badge.onload = () => { if (enabled()) { badge.hidden = false; status.textContent = '无 Cookie · 近似 PV'; } };
  toggle.addEventListener('click', () => {
    optedOut = !optedOut;
    try { localStorage.setItem(PRIVACY_KEY, optedOut ? '1' : '0'); preferenceSaved = true; } catch (_) { preferenceSaved = false; }
    if (optedOut) { badge.removeAttribute('src'); lastPage = null; }
    refresh();
    if (!optedOut) pageView();
  });
  // Clicking statistics is a deliberate navigation to a third-party website;
  // only its badge endpoint is requested automatically by this site.
  document.addEventListener('click', event => {
    if (!enabled()) return;
    const trigger = event.target.closest('[data-open-report]');
    const id = trigger && trigger.dataset.openReport;
    if (id && REPORT_ID.test(id)) increment('/events/report-open-' + id);
  });
  window.addEventListener('hashchange', pageView);
  refresh(); pageView();
})();
