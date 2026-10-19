/* Pure metadata-driven report facets. No EA names or input keys are hardcoded. */
'use strict';
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ResearchFilters = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  function fields(metadata, selections = {}) {
    const dimensions = metadata.dimensions.map(d => ({...d, id:`d-${d.key}`, kind:'dimension'}));
    const ea = selections['d-eaId'] || '';
    const strategies = metadata.strategies.filter(s => !ea || s.id === ea);
    const parameters = strategies.flatMap(strategy => strategy.parameters.map(p => ({
      ...p, id:`p-${strategy.id}-${p.key}`, kind:'parameter', eaId:strategy.id,
      strategy:strategy.name, label:metadata.strategies.length > 1 && !ea ? `${strategy.name} · ${p.label}` : p.label,
      allLabel:`全部${p.label}`, options:p.values.map(value => ({value, label:value}))
    })));
    return [...dimensions, ...parameters];
  }
  function value(report, field) {
    if (field.kind === 'parameter') {
      return report.eaId === field.eaId && Object.hasOwn(report.parameters || {}, field.key)
        ? String(report.parameters[field.key]) : undefined;
    }
    const raw = report[field.key] ?? field.missingValue;
    return raw == null ? undefined : String(raw);
  }
  function matches(report, selections, descriptors, query = '', except = '') {
    for (const field of descriptors) {
      const selected = selections[field.id];
      if (field.id !== except && selected != null && selected !== '' && value(report, field) !== selected) return false;
    }
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    const phase = report.phase === 'training' ? '训练' : report.phase === 'validation' ? '后续检验' : '点差对照';
    return [report.title, report.strategy, report.symbol, report.timeframe, report.createdAt,
      report.summary?.inputs, phase, `点差 ${report.spread}`, ...Object.entries(report.parameters || {}).flat()]
      .join(' ').toLowerCase().includes(needle);
  }
  function filter(reports, metadata, selections = {}, query = '') {
    const descriptors = fields(metadata, selections);
    return reports.filter(report => matches(report, selections, descriptors, query));
  }
  function facets(reports, metadata, selections = {}, query = '') {
    const descriptors = fields(metadata, selections);
    return descriptors.map(field => {
      const counts = new Map();
      for (const report of reports) {
        if (!matches(report, selections, descriptors, query, field.id)) continue;
        const key = value(report, field);
        if (key !== undefined) counts.set(key, (counts.get(key) || 0) + 1);
      }
      return {...field, options:field.options.map(option => ({...option, count:counts.get(option.value) || 0}))};
    });
  }
  function update(selections, field, selected) {
    const next = {...selections};
    if (field === 'd-eaId') {
      for (const key of Object.keys(next)) if (key.startsWith('p-')) delete next[key];
    }
    if (selected === '') delete next[field]; else next[field] = selected;
    return next;
  }
  return {fields, value, matches, filter, facets, update};
});
