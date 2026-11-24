function sanitizeCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  let text = String(value);
  // Neutralize spreadsheet formula triggers while leaving ordinary negative decimals like "-12.5" untouched
  if (/^[=+@]/.test(text) || /^-(?![\d.])/.test(text)) {
    text = `'${text}`;
  }
  return text;
}

function escapeCsvField(value) {
  const safe = sanitizeCell(value);
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function toCsv(headers, rows = []) {
  const headerLine = headers.map((h) => escapeCsvField(h)).join(',');
  const dataLines = rows.map((row) =>
    row.map((cell) => escapeCsvField(cell)).join(',')
  );
  return [headerLine, ...dataLines].join('\r\n') + '\r\n';
}

module.exports = {
  sanitizeCell,
  escapeCsvField,
  toCsv
};
