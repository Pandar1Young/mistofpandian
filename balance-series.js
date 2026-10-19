/* Pure balance-series helpers. Report clock values are coordinates, not timezone claims. */
'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ResearchBalance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function timestamp(text) {
    const m = /^(\d{4})\.(\d{2})\.(\d{2})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(String(text).trim());
    if (!m) throw new Error('Invalid report timestamp');
    const parts = [Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0)];
    const result = Date.UTC(...parts), dt = new Date(result);
    if ([dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), dt.getUTCHours(), dt.getUTCMinutes(), dt.getUTCSeconds()].some((v, i) => v !== parts[i])) throw new Error('Invalid report timestamp');
    return result;
  }
  function format(stamp, withTime = false) {
    const text = new Date(stamp).toISOString();
    return text.slice(0, 10).replaceAll('-', '.') + (withTime ? ' ' + text.slice(11, 16) : '');
  }
  function series(report) {
    const range = /\((\d{4}\.\d{2}\.\d{2}) - (\d{4}\.\d{2}\.\d{2})\)/.exec(report.summary.period);
    const fallback = String(report.summary.period).match(/\d{4}\.\d{2}\.\d{2}(?: \d{2}:\d{2})?/g) || [];
    const start = timestamp(range ? range[1] : fallback[0]);
    const end = timestamp(range ? range[2] : fallback[1]);
    if (end < start) throw new Error('Reversed report interval');
    const initial = Number(report.summary.initial_deposit);
    if (!Number.isFinite(initial)) throw new Error('Invalid starting balance');
    const points = [{time: start, value: initial, count: 0, trade: null}];
    for (const trade of report.trades) {
      const time = timestamp(trade.closed), value = Number(trade.balance), last = points.at(-1);
      if (!Number.isFinite(value) || time < start || time > end || time < last.time) throw new Error('Invalid close event or balance');
      const point = {time, value, count: last.count + 1, trade};
      // Multiple closes in the same reported minute retain the final recorded balance.
      if (time === last.time) points[points.length - 1] = point;
      else points.push(point);
    }
    if (points.at(-1).time < end) points.push({...points.at(-1), time: end});
    return {start, end, points, report};
  }
  function at(item, time) {
    if (time < item.start || time > item.end) return null;
    let lo = 0, hi = item.points.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (item.points[mid].time <= time) lo = mid; else hi = mid - 1;
    }
    return item.points[lo];
  }
  function timeline(items) {
    return [...new Set(items.flatMap(item => item.points.map(point => point.time)))].sort((a, b) => a - b);
  }
  function stepPath(points, x, y) {
    return points.map((point, index) => index ? `H${x(point.time)} V${y(point.value)}` : `M${x(point.time)} ${y(point.value)}`).join(' ');
  }
  return {timestamp, format, series, at, timeline, stepPath};
});
