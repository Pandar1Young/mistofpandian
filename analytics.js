/* Owner-managed analytics. IP checks complete before either provider is contacted.
   Only fixed page/report identifiers are sent; URL queries and trade data are excluded. */
'use strict';
(() => {
  const SETTINGS = {"schemaVersion":1,"enabled":true,"ipExclusion":{"enabled":true,"salt":"2b9d60a913d48a7bd6b3a1dfbcc9d40b","hashes":["8e0864fdc7435eb4417f7026e29adecac9113ad9eef762a629130f2df937156c","d1e19984fde24d8156dba16a07ad18ceb3ab5df32e1d445a8bf84e2d076bf7f1"],"timeoutMs":4000}};
  const ORIGIN = 'https://pandar1young.github.io';
  const PREFIX = '/mistofpandian/';
  const COUNTER = 'https://hits.sh/pandar1young.github.io/mistofpandian';
  const PRIVACY_KEY = 'mistofpandian-analytics-optout';
  const GA_PREFERENCE_KEY = 'mistofpandian-ga-consent';
  const GA_ID = 'G-H4WSCL56LF';
  const IP_ENDPOINTS = ['https://api.ipify.org?format=json', 'https://api64.ipify.org?format=json'];
  const ROUTES = new Set(['overview', 'tuning', 'reports', 'compare', 'data', 'methodology']);
  const REPORT_ID = /^\d{8}_\d{6}_\d{6}-(?:s(?:20|30)|(?:train|validation)_H[14]_p(?:8|12|20)_m(?:3|6|9)_s(?:20|30))$/;
  const live = location.origin === ORIGIN && location.pathname.startsWith(PREFIX);
  const privacySignal = navigator.globalPrivacyControl === true ||
    navigator.doNotTrack === '1' || navigator.doNotTrack === 'yes' || window.doNotTrack === '1';
  let optedOut = false, gaPreference = 'granted';
  let gate = 'pending', checking = null, lastPage = null, sequence = 0;
  let gaStarted = false, gaLastPage = null;
  const pending = new Set();
  function readPreferences() {
    try {
      optedOut = localStorage.getItem(PRIVACY_KEY) === '1';
      gaPreference = localStorage.getItem(GA_PREFERENCE_KEY) === 'denied' ? 'denied' : 'granted';
    } catch (_) { /* No storage writes or frontend controls. */ }
  }
  readPreferences();
  // Detached image retains aggregate counting without adding any page UI.
  const badge = new Image();
  badge.referrerPolicy = 'no-referrer';
  function eligible() { return SETTINGS?.enabled === true && live && !privacySignal && !optedOut && pageKey() !== null; }
  function enabled() { return eligible() && gate === 'allowed'; }
  function gaEnabled() { return enabled() && gaPreference === 'granted'; }
  function canonicalIP(raw) {
    if (typeof raw !== 'string' || !raw || raw.length > 45 || raw !== raw.trim()) throw Error('Invalid IP response');
    if (raw.includes(':')) {
      if (!/^[0-9a-fA-F:.]+$/.test(raw)) throw Error('Invalid IPv6 response');
      return new URL('http://[' + raw + ']/').hostname.replace(/^\[|\]$/g, '').toLowerCase();
    }
    const octets = raw.split('.');
    if (octets.length !== 4 || octets.some(o => !/^(0|[1-9]\d{0,2})$/.test(o) || Number(o) > 255)) throw Error('Invalid IPv4 response');
    return octets.join('.');
  }
  async function addressHash(endpoint) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SETTINGS.ipExclusion.timeoutMs);
    try {
      const response = await fetch(endpoint, {credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer', signal:controller.signal});
      if (!response.ok) throw Error('IP lookup failed');
      const address = canonicalIP((await response.json()).ip);
      const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(SETTINGS.ipExclusion.salt + '|' + address));
      return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
    } finally { clearTimeout(timer); }
  }
  function ensureGate() {
    if (!eligible() || gate !== 'pending' || checking) return;
    if (!SETTINGS.ipExclusion.enabled) { gate = 'allowed'; pageView(); gaPageView(); return; }
    // Check both IPv4 and dual-stack egress. A match on either excludes BOTH providers.
    // Any lookup failure prevents collection for this load; never fall back to counting.
    checking = Promise.allSettled(IP_ENDPOINTS.map(addressHash)).then(results => {
      if (results.some(r => r.status === 'fulfilled' && SETTINGS.ipExclusion.hashes.includes(r.value))) gate = 'internal';
      else gate = results.every(r => r.status === 'fulfilled') ? 'allowed' : 'unavailable';
      if (!gaEnabled()) gaStop();
      pageView(); gaPageView();
    }).catch(() => { gate = 'unavailable'; gaStop(); });
  }
  function gaCommand() { window.dataLayer.push(arguments); }
  function gaFields(page) {
    let referrer = '';
    try { referrer = new URL(document.referrer).origin + '/'; } catch (_) { /* Direct visit. */ }
    return {
      page_location: ORIGIN + PREFIX + (page.startsWith('report-') ? 'reports/' + page.slice(7) + '.html' : '#' + page),
      page_title: 'mistofpandian / ' + page, page_referrer: referrer
    };
  }
  function gaPageView() {
    if (!gaEnabled()) return;
    const page = pageKey(); window['ga-disable-' + GA_ID] = false;
    if (!gaStarted) {
      gaStarted = true; window.dataLayer = window.dataLayer || []; window.gtag = gaCommand;
      // Owner-selected storage mode, not a record of visitor consent.
      gaCommand('consent', 'default', {analytics_storage:'granted', ad_storage:'denied', ad_user_data:'denied', ad_personalization:'denied'});
      gaCommand('js', new Date());
      const script = document.createElement('script'); script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
      script.onerror = () => { /* Provider failure leaves the research UI unchanged. */ };
      document.head.append(script);
    }
    if (page === gaLastPage) return;
    gaLastPage = page;
    gaCommand('config', GA_ID, {...gaFields(page), send_page_view:false,
      allow_google_signals:false, allow_ad_personalization_signals:false,
      cookie_flags:'SameSite=Lax;Secure', cookie_path:PREFIX, cookie_domain:'pandar1young.github.io'});
    gaCommand('set', gaFields(page));
    gaCommand('event', 'page_view', {...gaFields(page), send_to:GA_ID});
  }
  function gaStop() {
    window['ga-disable-' + GA_ID] = true; gaLastPage = null;
    for (const name of ['_ga', '_ga_' + GA_ID.slice(2)]) {
      for (const path of ['/', PREFIX, PREFIX.slice(0,-1)]) {
        for (const domain of ['', ';domain=pandar1young.github.io', ';domain=.pandar1young.github.io']) {
          document.cookie = name + '=;Max-Age=0;path=' + path + domain + ';SameSite=Lax;Secure';
        }
      }
    }
  }
  function badgeURL(key) {
    return `${COUNTER}${key}.svg?label=PV&color=21745c&labelColor=7b8980&_=${Date.now()}-${++sequence}`;
  }
  function increment(key) {
    if (!enabled()) return;
    const image = new Image(); image.referrerPolicy = 'no-referrer'; pending.add(image);
    image.onload = image.onerror = () => pending.delete(image); image.src = badgeURL(key);
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
    const page = pageKey(); if (!page || page === lastPage) return;
    lastPage = page; badge.src = badgeURL(''); increment('/pages/' + page);
  }
  badge.onload = badge.onerror = () => { /* Aggregate counter stays detached from the page. */ };
  document.addEventListener('click', event => {
    if (!enabled()) return;
    const trigger = event.target.closest('[data-open-report]'); const id = trigger && trigger.dataset.openReport;
    if (id && REPORT_ID.test(id)) {
      increment('/events/report-open-' + id);
      if (gaEnabled()) gaCommand('event', 'report_open', {...gaFields(pageKey()), report_id:id, send_to:GA_ID});
    }
  });
  window.addEventListener('hashchange', () => { ensureGate(); pageView(); gaPageView(); });
  window.addEventListener('storage', event => {
    if (event.key !== PRIVACY_KEY && event.key !== GA_PREFERENCE_KEY && event.key !== null) return;
    readPreferences();
    if (!gaEnabled()) gaStop();
    if (optedOut) { badge.removeAttribute('src'); lastPage = null; }
    ensureGate(); pageView(); gaPageView();
  });
  window['ga-disable-' + GA_ID] = true;
  if (!eligible() || gaPreference === 'denied') gaStop();
  ensureGate(); pageView(); gaPageView();
})();
