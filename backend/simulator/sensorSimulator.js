#!/usr/bin/env node
const path = require('path');

function parseArgs(argv) {
  const args = {
    help: false,
    key: process.env.SIMULATOR_DEVICE_KEY || '',
    url: process.env.SIMULATOR_API_URL || 'http://127.0.0.1:3000/api/sensors/ingest',
    interval: Number(process.env.SIMULATOR_INTERVAL_SEC || 10),
    once: false,
    count: Infinity,
    uid: process.env.SIMULATOR_DEVICE_UID || undefined
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--key' && argv[i + 1]) args.key = argv[++i];
    else if (arg === '--url' && argv[i + 1]) args.url = argv[++i];
    else if (arg === '--interval' && argv[i + 1]) args.interval = Number(argv[++i]);
    else if (arg === '--count' && argv[i + 1]) args.count = Number(argv[++i]);
    else if (arg === '--uid' && argv[i + 1]) args.uid = argv[++i];
    else if (arg === '--once') {
      args.once = true;
      args.count = 1;
    }
  }
  return args;
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

function round1(val) {
  return Math.round(val * 10) / 10;
}

/**
 * Generates realistic diurnal telemetry:
 * - SolarAngle = 2*PI*(hour - 6)/24 -> peaks at 12:00, night near 00:00
 * - Temperature rises in afternoon, cools at night
 * - Humidity inversely tracks temperature
 * - Soil moisture decays faster in warm weather and triggers simulated irrigation pulse when < 15%
 */
function generateTelemetry(state = { soilMoisture: 58, batteryPercent: 94 }, date = new Date()) {
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60;
  const solarAngle = (2 * Math.PI * (hour - 6)) / 24;
  const solarFactor = Math.max(0, Math.sin(solarAngle));

  const tempJitter = (Math.random() - 0.5) * 0.8;
  const temperature = round1(clamp(16 + 11 * Math.sin(solarAngle - 0.4) + tempJitter, -40, 85));
  const humidity = round1(clamp(75 - 24 * Math.sin(solarAngle - 0.4) + (Math.random() - 0.5) * 2, 0, 100));
  const lightLux = Math.round(clamp(solarFactor * 48000 + (solarFactor > 0 ? Math.random() * 1500 : 12), 0, 120000));

  let soilMoisture = typeof state.soilMoisture === 'number' ? state.soilMoisture : 58;
  const evapRate = 0.25 + Math.max(0, temperature - 15) * 0.04;
  soilMoisture = soilMoisture - evapRate;
  if (soilMoisture < 15) {
    soilMoisture = 85; // Automated simulated irrigation pulse
  }
  soilMoisture = round1(clamp(soilMoisture, 0, 100));

  const batteryPercent = round1(clamp((state.batteryPercent ?? 94) - 0.02, 5, 100));
  const signalRssi = Math.round(clamp(-62 + (Math.random() - 0.5) * 8, -120, 0));

  state.soilMoisture = soilMoisture;
  state.batteryPercent = batteryPercent;

  return {
    timestamp: date.toISOString(),
    firmwareVersion: 'sim-2.0.0',
    metrics: {
      soilMoisture,
      temperature,
      humidity,
      lightLux,
      batteryPercent,
      signalRssi
    }
  };
}

async function sendOnce(args, state) {
  const payload = generateTelemetry(state, new Date());
  if (args.uid) payload.deviceUid = args.uid;

  const response = await fetch(args.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Key': args.key
    },
    body: JSON.stringify(payload)
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errMsg = body?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Ingest rejected (${response.status}): ${errMsg}`);
  }
  console.log(
    `[Simulator] ${payload.timestamp} -> moisture=${payload.metrics.soilMoisture}% temp=${payload.metrics.temperature}C humidity=${payload.metrics.humidity}% lux=${payload.metrics.lightLux} (reading_id=${body?.data?.reading_id})`
  );
  return body;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage: node ${path.basename(__filename)} --key sg_live_... [--url http://127.0.0.1:3000/api/sensors/ingest] [--interval 10] [--once] [--count N] [--uid SG-UID]`);
    process.exit(0);
  }
  if (!args.key || !args.key.startsWith('sg_live_')) {
    console.error(`Usage: node ${path.basename(__filename)} --key sg_live_... [--url http://127.0.0.1:3000/api/sensors/ingest] [--interval 10] [--once]`);
    process.exit(1);
  }

  const state = { soilMoisture: 58, batteryPercent: 94 };
  let sent = 0;

  while (sent < args.count) {
    try {
      await sendOnce(args, state);
    } catch (err) {
      console.error('[Simulator Error]', err.message);
      if (args.once) process.exit(1);
    }
    sent++;
    if (sent >= args.count) break;
    await new Promise((resolve) => setTimeout(resolve, Math.max(1, args.interval) * 1000));
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  generateTelemetry,
  sendOnce
};
