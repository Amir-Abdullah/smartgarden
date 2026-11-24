function getDialect(sequelize) {
  const raw = (sequelize && sequelize.options && sequelize.options.dialect) || 'sqlite';
  if (raw === 'postgresql' || raw === 'postgres') return 'postgres';
  if (raw === 'mysql' || raw === 'mariadb') return 'mariadb';
  return 'sqlite';
}

function normalizeSelectRows(res) {
  if (!res) return [];
  if (Array.isArray(res)) {
    if (res.length === 2 && Array.isArray(res[0])) return res[0];
    return res;
  }
  if (Array.isArray(res.rows)) return res.rows;
  return [];
}

function normalizeAffectedCount(res) {
  if (res == null) return 0;
  const pick = (obj, keys) => {
    if (!obj || typeof obj !== 'object') return null;
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === 'number' || typeof v === 'bigint') return Number(v);
    }
    return null;
  };
  if (Array.isArray(res)) {
    const [first, meta] = res;
    const fromMeta = pick(meta, ['rowCount', 'changes', 'affectedRows']);
    if (fromMeta !== null) return fromMeta;
    const fromFirst = pick(first, ['affectedRows', 'changes', 'rowCount']);
    if (fromFirst !== null) return fromFirst;
    return 0;
  }
  const direct = pick(res, ['changes', 'rowCount', 'affectedRows']);
  return direct !== null ? direct : 0;
}

function formatDbTimestamp(date = new Date(), dialect = 'sqlite') {
  const d = date instanceof Date ? date : new Date(date);
  if (dialect === 'mariadb' || dialect === 'mysql') {
    return d.toISOString().slice(0, 19).replace('T', ' ');
  }
  return d.toISOString();
}

function escapeSqlLiteral(val, dialect = 'sqlite') {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return 'NULL';
    return String(val);
  }
  if (typeof val === 'boolean') {
    if (dialect === 'postgres' || dialect === 'postgresql') return val ? 'TRUE' : 'FALSE';
    return val ? '1' : '0';
  }
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return 'NULL';
    return `'${formatDbTimestamp(val, dialect).replace(/'/g, "''")}'`;
  }
  let str = String(val);
  if (dialect === 'mariadb' || dialect === 'mysql') {
    str = str.replace(/\\/g, '\\\\');
  }
  return `'${str.replace(/'/g, "''")}'`;
}

function isUniqueConstraintError(err) {
  if (!err) return false;
  if (err.name === 'SequelizeUniqueConstraintError') return true;
  if (err.code === '23505' || err.code === 'SQLITE_CONSTRAINT' || err.code === 'SQLITE_CONSTRAINT_UNIQUE') return true;
  if (err.errno === 1062 || err.errno === 19) return true;
  if (err.parent && (err.parent.code === '23505' || err.parent.errno === 1062)) return true;
  return /unique/i.test(err.message || '');
}

function isValidTimeZone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function getLocalDateString(timeZone = 'UTC', date = new Date()) {
  const tz = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

function getLocalTimeString(timeZone = 'UTC', date = new Date()) {
  const tz = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const d = date instanceof Date ? date : new Date(date);
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour12: false,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(d);
  // Normalize 24:xx:xx edge cases if any runtime emits 24
  return formatted.startsWith('24:') ? `00:${formatted.slice(3)}` : formatted;
}

function addDaysToIsoDate(isoDateStr, days) {
  const [y, m, d] = String(isoDateStr).slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + Number(days)));
  return dt.toISOString().slice(0, 10);
}

module.exports = {
  getDialect,
  normalizeSelectRows,
  normalizeAffectedCount,
  formatDbTimestamp,
  escapeSqlLiteral,
  isUniqueConstraintError,
  isValidTimeZone,
  getLocalDateString,
  getLocalTimeString,
  addDaysToIsoDate
};
