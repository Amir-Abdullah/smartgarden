const { EventEmitter } = require('node:events');

const MONTH_NAMES = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

const DOW_NAMES = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6
};

function replaceNames(token, namesMap) {
  let out = token.toLowerCase();
  for (const [name, num] of Object.entries(namesMap)) {
    out = out.replace(new RegExp(`\\b${name}\\b`, 'g'), String(num));
  }
  return out;
}

function parseField(rawToken, min, max, namesMap = null, normalizeSevenToZero = false) {
  if (typeof rawToken !== 'string' || rawToken.length === 0) return null;
  const token = namesMap ? replaceNames(rawToken, namesMap) : rawToken;
  const values = new Set();
  const parts = token.split(',');

  for (const part of parts) {
    if (!part) return null;

    let rangePart = part;
    let step = 1;
    if (part.includes('/')) {
      const splitStep = part.split('/');
      if (splitStep.length !== 2 || !/^\d+$/.test(splitStep[1])) return null;
      rangePart = splitStep[0];
      step = Number(splitStep[1]);
      if (step <= 0) return null;
    }

    let start;
    let end;
    if (rangePart === '*') {
      start = min;
      end = max;
    } else if (rangePart.includes('-')) {
      const bounds = rangePart.split('-');
      if (bounds.length !== 2 || !/^\d+$/.test(bounds[0]) || !/^\d+$/.test(bounds[1])) return null;
      start = Number(bounds[0]);
      end = Number(bounds[1]);
      if (start > end || start < min || end > max) return null;
    } else {
      if (!/^\d+$/.test(rangePart)) return null;
      start = Number(rangePart);
      end = part.includes('/') ? max : start;
      if (start < min || start > max) return null;
    }

    for (let v = start; v <= end; v += step) {
      values.add(normalizeSevenToZero && v === 7 ? 0 : v);
    }
  }

  return values;
}

function parseCronExpression(expression) {
  if (typeof expression !== 'string') return null;
  const trimmed = expression.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5 && parts.length !== 6) return null;

  let idx = 0;
  let seconds = null;
  if (parts.length === 6) {
    seconds = parseField(parts[idx++], 0, 59);
    if (!seconds) return null;
  }

  const minutes = parseField(parts[idx++], 0, 59);
  const hours = parseField(parts[idx++], 0, 23);
  const daysOfMonth = parseField(parts[idx++], 1, 31);
  const months = parseField(parts[idx++], 1, 12, MONTH_NAMES);
  const daysOfWeek = parseField(parts[idx++], 0, 7, DOW_NAMES, true);

  if (!minutes || !hours || !daysOfMonth || !months || !daysOfWeek) return null;

  return {
    hasSeconds: parts.length === 6,
    seconds,
    minutes,
    hours,
    daysOfMonth,
    months,
    daysOfWeek
  };
}

function validate(expression) {
  return parseCronExpression(expression) !== null;
}

function getDatePartsInTimezone(date, timezone) {
  if (!timezone) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
      dayOfWeek: date.getDay()
    };
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hourCycle: 'h23'
  });
  const map = {};
  for (const part of formatter.formatToParts(date)) {
    map[part.type] = part.value;
  }
  const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    second: Number(map.second),
    dayOfWeek: dowMap[map.weekday] ?? date.getDay()
  };
}

function matchesCron(parsed, date, timezone) {
  const p = getDatePartsInTimezone(date, timezone);
  if (parsed.hasSeconds && !parsed.seconds.has(p.second)) return false;
  if (!parsed.minutes.has(p.minute)) return false;
  if (!parsed.hours.has(p.hour)) return false;
  if (!parsed.daysOfMonth.has(p.day)) return false;
  if (!parsed.months.has(p.month)) return false;
  if (!parsed.daysOfWeek.has(p.dayOfWeek)) return false;
  return p;
}

class ScheduledTask extends EventEmitter {
  constructor(expression, parsed, fn, options = {}) {
    super();
    this.expression = expression;
    this._parsed = parsed;
    this._fn = fn;
    this._options = options;
    this._timer = null;
    this._running = false;
    this._lastFiredKey = null;

    if (options.runOnInit) {
      Promise.resolve().then(() => this._invoke(new Date()));
    }
    if (options.scheduled !== false) {
      this.start();
    }
  }

  _invoke(now) {
    try {
      const res = this._fn(now);
      if (res && typeof res.catch === 'function') {
        res.catch((err) => this.emit('error', err));
      }
    } catch (err) {
      this.emit('error', err);
    }
  }

  _scheduleNext() {
    if (!this._running) return;

    const nowMs = Date.now();
    const intervalMs = this._parsed.hasSeconds ? 1000 : 60000;
    const delay = intervalMs - (nowMs % intervalMs) + 5;

    this._timer = setTimeout(() => {
      if (!this._running) return;
      const now = new Date();
      const matched = matchesCron(this._parsed, now, this._options.timezone);
      if (matched) {
        const key = this._parsed.hasSeconds
          ? `${matched.year}-${matched.month}-${matched.day} ${matched.hour}:${matched.minute}:${matched.second}`
          : `${matched.year}-${matched.month}-${matched.day} ${matched.hour}:${matched.minute}`;
        if (this._lastFiredKey !== key) {
          this._lastFiredKey = key;
          this._invoke(now);
        }
      }
      this._scheduleNext();
    }, delay);

    if (typeof this._timer.unref === 'function') {
      this._timer.unref();
    }
  }

  start() {
    if (this._running) return this;
    this._running = true;
    this._scheduleNext();
    return this;
  }

  stop() {
    this._running = false;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    return this;
  }

  destroy() {
    return this.stop();
  }

  getStatus() {
    return this._running ? 'scheduled' : 'stopped';
  }
}

function schedule(expression, func, options = {}) {
  const parsed = parseCronExpression(expression);
  if (!parsed) {
    throw new Error(`Invalid cron expression: "${expression}"`);
  }
  if (typeof func !== 'function') {
    throw new TypeError('Cron task callback must be a function');
  }
  return new ScheduledTask(expression, parsed, func, options);
}

module.exports = {
  schedule,
  validate,
  parseCronExpression,
  ScheduledTask
};
