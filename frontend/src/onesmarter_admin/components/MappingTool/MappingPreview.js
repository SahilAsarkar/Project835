export const MappingPreview = (() => {
  function widthOf(field) {
    const width = Number(field.length);
    return Number.isFinite(width) && width > 0 ? Math.floor(width) : 1;
  }

  function padOf(field) {
    return String(field.pad || ' ').slice(0, 1) || ' ';
  }

  function formatPreview(value, field) {
    const width = widthOf(field);
    let formatted = value == null ? '' : String(value);
    if (field.trim) formatted = formatted.trim();
    if (field.upper) formatted = formatted.toUpperCase();

    let warning = '';
    if (field.type !== 'N' && field.truncate && formatted.length > width) {
      warning = `Value will be truncated from ${formatted.length} to ${width} characters.`;
      formatted = formatted.slice(0, width);
    }
    if (formatted.length > width) {
      return {
        output: null,
        warning: `Value is ${formatted.length} characters and does not fit the configured width of ${width}.`,
      };
    }

    const pad = padOf(field);
    formatted = field.align === 'right'
      ? formatted.padStart(width, pad)
      : formatted.padEnd(width, pad);
    return {output: `|${formatted}|`, warning};
  }

  function sourceSample(field, source) {
    if (source && source.sample != null) return String(source.sample);
    if (field.type === 'D') return '20260101';
    return '1';
  }

  function runtimeSample(name, options) {
    if (name === 'PROCESS_DATE') {
      if (options.today) return options.today;
      const now = new Date();
      return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    }
    return '01';
  }

  function outputBlock(title, result) {
    return result.output ? `${title}:\n${result.output}` : `${title}:\nCannot fit within the configured width.`;
  }

  function helpText(field, notes) {
    const base = [
      `Positions: ${field.start}-${Number(field.start) + widthOf(field) - 1} · Width: ${widthOf(field)}`,
      'Pipes mark preview boundaries only; they are not written to the MIR file.',
    ];
    return base.concat(notes.filter(Boolean)).join('\n');
  }

  function buildPreview(field, sources = [], options = {}) {
    const mapType = field.mapType;
    if (mapType === 'Hardcoded Text') {
      const result = formatPreview(field.map, field);
      return {
        details: `Hardcoded value: ${field.map == null ? '' : field.map}`,
        output: outputBlock('Formatted output', result),
        help: helpText(field, [result.warning]),
      };
    }

    if (mapType === 'Direct from 835') {
      const source = sources.find(item => item.id === field.map);
      const label = source ? source.label : String(field.map || 'No source selected');
      const scope = source ? source.scope : field.scope || 'Runtime 835 data';
      const sample = sourceSample(field, source);
      const numericRuntime = field.type === 'N';
      const example = numericRuntime ? null : formatPreview(sample, field);
      const fallbackValue = field.fallbackType === 'Hardcoded' ? field.fallbackValue : '';
      const fallback = numericRuntime ? null : formatPreview(fallbackValue, field);
      const output = numericRuntime
        ? 'Formatted example:\nNumeric MIR formatting is calculated during conversion.'
        : outputBlock('Formatted example', example);
      const missing = numericRuntime
        ? field.fallbackType === 'Hardcoded'
          ? `If source is missing:\nFixed fallback: ${fallbackValue}\nNumeric MIR formatting is calculated during conversion.`
          : 'If source is missing:\nLeave blank; numeric MIR formatting is calculated during conversion.'
        : outputBlock('If source is missing', fallback);
      return {
        details: [
          `Source: ${label}`,
          `Scope: ${scope}`,
          `Runtime value: Taken from ${field.map || 'the selected source'} of each uploaded 835 ${scope.toLowerCase()}.`,
          `Example source value (illustrative): ${sample}`,
        ].join('\n'),
        output: `${output}\n\n${missing}`,
        help: helpText(field, [
          example && example.warning,
          fallback && fallback.warning ? `Fallback: ${fallback.warning}` : '',
        ]),
      };
    }

    if (mapType === 'Formula') {
      const formula = String(field.technicalRule || (field.map === 'Custom formula' ? '' : field.map) || '').trim();
      const issue = options.formulaIssue || (!formula ? 'formula is empty' : '');
      const status = issue ? 'invalid' : options.formulaStatus || 'idle';
      const validationNote = status === 'invalid'
        ? `Invalid formula: ${issue}`
        : status === 'valid'
          ? 'Formula validated using the server mapping rules.'
          : status === 'pending'
            ? 'Validating formula using the server mapping rules...'
            : status === 'unavailable'
              ? 'Formula validation is temporarily unavailable.'
              : 'Formula validation uses the server mapping rules.';
      return {
        details: `Formula:\n${formula || '(empty)'}\n\nResult:\nCalculated during 835 → MIR conversion`,
        output: 'Runtime result is formatted to the configured field width during conversion.',
        help: helpText(field, [validationNote]),
      };
    }

    if (mapType === 'System / Runtime') {
      const descriptions = {
        PROCESS_DATE: 'Generated during conversion · Format: YYYYMMDD',
        RECORD_SEQUENCE: 'Value determined for each generated MIR record',
        MAX_RECORD_SEQUENCE: 'Value determined for each generated MIR claim',
        SERVICE_COUNT: 'Value determined from each generated MIR record',
      };
      const sample = runtimeSample(field.map, options);
      const result = formatPreview(sample, field);
      return {
        details: `System value: ${field.map || '(none)'}\n${descriptions[field.map] || 'Generated during conversion'}\nExample value (illustrative): ${sample}`,
        output: outputBlock('Formatted example', result),
        help: helpText(field, [result.warning]),
      };
    }

    const result = formatPreview('', field);
    const fill = padOf(field) === ' ' ? 'spaces' : `the selected ${JSON.stringify(padOf(field))} pad character`;
    return {
      details: `Blank mapping\nField remains present in the fixed-width MIR record; its positions are filled with ${fill}.`,
      output: outputBlock('Formatted output', result),
      help: helpText(field, [result.warning]),
    };
  }

  return {formatPreview, buildPreview};
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = globalThis.MappingPreview;
}
