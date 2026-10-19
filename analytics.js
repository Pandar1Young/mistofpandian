/* Hits provides approximate public PV. GA4 defaults on, with persistent opt-out.
   Only fixed page/report identifiers are sent; URL queries and trade data are excluded. */
'use strict';
(() => {
  const ORIGIN = 'https://pandar1young.github.io';
  const PREFIX = '/mistofpandian/';
  const COUNTER = 'https://hits.sh/pandar1young.github.io/mistofpandian';
  const PRIVACY_KEY = 'mistofpandian-analytics-optout';
  const GA_ID = 'G-H4WSCL56LF';
  // Keep the legacy key so earlier explicit refusals remain effective.
  const GA_PREFERENCE_KEY = 'mistofpandian-ga-consent';
  let gaPreference = 'granted', gaStarted = false, gaLastPage = null;
  try { gaPreference = localStorage.getItem(GA_PREFERENCE_KEY) === 'denied' ? 'denied' : 'granted'; } catch (_) { /* In-memory preference only. */ }
  const ROUTES = new Set(['overview', 'tuning', 'reports', 'compare', 'data', 'methodology']);
  const REPORT_ID = /^\d{8}_\d{6}_\d{6}-(?:s(?:20|30)|(?:train|validation)_H[14]_p(?:8|12|20)_m(?:3|6|9)_s(?:20|30))$/;
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
  const gaControls = document.createElement('span');
  gaControls.className = 'analytics-widget ga-controls';
  const gaStatus = document.createElement('span');
  gaStatus.setAttribute('role', 'status');
  const gaToggle = document.createElement('button');
  gaToggle.type = 'button'; gaToggle.className = 'analytics-toggle';
  gaControls.append(gaStatus, gaToggle);
  if (footer) footer.append(gaControls);
  const disclosure = document.createElement('span');
  disclosure.className = 'ga-disclosure';
  disclosure.textContent = 'Google Analytics 默认使用 Cookie 统计大致地区、来源、设备与页面浏览，可随时关闭。';
  const privacy = document.createElement('a');
  privacy.href = 'https://policies.google.com/privacy?hl=zh-CN';
  privacy.target = '_blank'; privacy.rel = 'noopener noreferrer'; privacy.textContent = 'Google 隐私政策';
  gaControls.append(disclosure, privacy);
  function gaEnabled() { return enabled() && gaPreference === 'granted' && pageKey() !== null; }
  function gaRefresh() {
    const available = live && !privacySignal && !optedOut && pageKey() !== null;
    gaToggle.disabled = !available;
    gaToggle.textContent = gaPreference === 'granted' ? '关闭 Google 统计' : '开启 Google 统计';
    gaStatus.textContent = !available ? 'Google 统计已停用' : gaPreference === 'granted' ? 'Google 统计已开启 · 使用 Cookie' : 'Google 统计已关闭';
    if (!preferenceSaved) gaStatus.textContent += '（偏好无法保存，仅本页有效）';
  }
  function gaCommand() { window.dataLayer.push(arguments); }
  function gaFields(page) {
    // Referrer origin preserves source information without sending its query/path.
    let referrer = '';
    try { referrer = new URL(document.referrer).origin + '/'; } catch (_) { /* Direct visit. */ }
    return {
      page_location: ORIGIN + PREFIX + (page.startsWith('report-') ? 'reports/' + page.slice(7) + '.html' : '#' + page),
      page_title: 'mistofpandian / ' + page,
      page_referrer: referrer
    };
  }
  function gaPageView() {
    if (!gaEnabled()) return;
    const page = pageKey();
    window['ga-disable-' + GA_ID] = false;
    if (!gaStarted) {
      gaStarted = true;
      window.dataLayer = window.dataLayer || [];
      window.gtag = gaCommand;
      // Owner-selected storage mode, not a record of visitor consent.
      gaCommand('consent', 'default', {analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
      gaCommand('js', new Date());
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
      script.onerror = () => { gaStatus.textContent = 'Google 统计被拦截或暂不可用，网站功能不受影响'; };
      document.head.append(script);
    }
    if (page === gaLastPage) return;
    gaLastPage = page;
    gaCommand('config', GA_ID, {
      ...gaFields(page), send_page_view: false,
      allow_google_signals: false, allow_ad_personalization_signals: false,
      cookie_flags: 'SameSite=Lax;Secure', cookie_path: PREFIX,
      cookie_domain: 'pandar1young.github.io'
    });
    gaCommand('set', gaFields(page));
    gaCommand('event', 'page_view', {...gaFields(page), send_to: GA_ID});
  }
  function gaStop() {
    window['ga-disable-' + GA_ID] = true;
    gaLastPage = null;
    // Remove only this site's GA cookies; do not touch unrelated preferences.
    for (const name of ['_ga', '_ga_' + GA_ID.slice(2)]) {
      for (const path of ['/', PREFIX, PREFIX.slice(0, -1)]) {
        for (const domain of ['', ';domain=pandar1young.github.io', ';domain=.pandar1young.github.io']) {
          document.cookie = name + '=;Max-Age=0;path=' + path + domain + ';SameSite=Lax;Secure';
        }
      }
    }
  }
  function chooseGA(value) {
    gaPreference = value;
    try { localStorage.setItem(GA_PREFERENCE_KEY, value); preferenceSaved = true; } catch (_) { preferenceSaved = false; }
    if (value !== 'granted') gaStop();
    gaRefresh(); gaPageView();
  }
  gaToggle.addEventListener('click', () => chooseGA(gaPreference === 'granted' ? 'denied' : 'granted'));
  function enabled() { return live && !privacySignal && !optedOut; }
  function refresh() {
    toggle.disabled = !live || privacySignal;
    toggle.textContent = optedOut ? '开启统计' : '关闭统计';
    badge.hidden = !enabled();
    status.textContent = !live ? '本地预览不计数' : privacySignal ? '已尊重浏览器隐私信号' : optedOut ? (preferenceSaved ? '本浏览器已退出统计' : '本页已退出统计（偏好无法保存）') : 'Hits · 无 Cookie · 近似 PV';
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
  badge.onload = () => { if (enabled()) { badge.hidden = false; status.textContent = 'Hits · 无 Cookie · 近似 PV'; } };
  toggle.addEventListener('click', () => {
    optedOut = !optedOut;
    try { localStorage.setItem(PRIVACY_KEY, optedOut ? '1' : '0'); preferenceSaved = true; } catch (_) { preferenceSaved = false; }
    if (optedOut) { badge.removeAttribute('src'); lastPage = null; gaStop(); }
    refresh(); gaRefresh();
    if (!optedOut) { pageView(); gaPageView(); }
  });
  // Clicking statistics is a deliberate navigation to a third-party website;
  // only its badge endpoint is requested automatically by this site.
  document.addEventListener('click', event => {
    if (!enabled()) return;
    const trigger = event.target.closest('[data-open-report]');
    const id = trigger && trigger.dataset.openReport;
    if (id && REPORT_ID.test(id)) {
      increment('/events/report-open-' + id);
      if (gaEnabled()) gaCommand('event', 'report_open', {...gaFields(pageKey()), report_id: id, send_to: GA_ID});
    }
  });
  window.addEventListener('hashchange', () => { pageView(); gaRefresh(); gaPageView(); });
  window.addEventListener('storage', event => {
    if (event.key !== PRIVACY_KEY && event.key !== GA_PREFERENCE_KEY && event.key !== null) return;
    try {
      optedOut = localStorage.getItem(PRIVACY_KEY) === '1';
      gaPreference = localStorage.getItem(GA_PREFERENCE_KEY) === 'denied' ? 'denied' : 'granted';
    } catch (_) { return; }
    if (!gaEnabled()) gaStop();
    if (optedOut) { badge.removeAttribute('src'); lastPage = null; }
    refresh(); gaRefresh(); pageView(); gaPageView();
  });
  refresh(); gaRefresh(); pageView(); gaPageView();
})();
