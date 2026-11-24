const { Buffer } = require('buffer');

function escapePdfText(text) {
  return String(text || '')
    .replace(/[^\x20-\x7e]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function buildPageStream(commands) {
  return Buffer.from(commands.join('\n'), 'latin1');
}

function compilePdfDocument(pageStreams) {
  const objects = [];
  // 1: Catalog, 2: Pages, 3: Helvetica, 4: Helvetica-Bold
  const pageObjNums = [];
  let nextObjNum = 5;

  const pageEntries = pageStreams.map((streamBuf) => {
    const contentNum = nextObjNum++;
    const pageNum = nextObjNum++;
    pageObjNums.push(pageNum);
    return { streamBuf, contentNum, pageNum };
  });

  objects.push({ num: 1, body: Buffer.from('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n', 'latin1') });
  objects.push({
    num: 2,
    body: Buffer.from(
      `2 0 obj\n<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageObjNums.length} >>\nendobj\n`,
      'latin1'
    )
  });
  objects.push({ num: 3, body: Buffer.from('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n', 'latin1') });
  objects.push({ num: 4, body: Buffer.from('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n', 'latin1') });

  for (const entry of pageEntries) {
    const contentHeader = Buffer.from(
      `${entry.contentNum} 0 obj\n<< /Length ${entry.streamBuf.length} >>\nstream\n`,
      'latin1'
    );
    const contentFooter = Buffer.from('\nendstream\nendobj\n', 'latin1');
    objects.push({
      num: entry.contentNum,
      body: Buffer.concat([contentHeader, entry.streamBuf, contentFooter])
    });

    const pageBody = Buffer.from(
      `${entry.pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${entry.contentNum} 0 R >>\nendobj\n`,
      'latin1'
    );
    objects.push({ num: entry.pageNum, body: pageBody });
  }

  objects.sort((a, b) => a.num - b.num);

  const chunks = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  let offset = chunks[0].length;
  const offsets = [0];

  for (const obj of objects) {
    offsets[obj.num] = offset;
    chunks.push(obj.body);
    offset += obj.body.length;
  }

  const xrefOffset = offset;
  const totalObjs = objects.length + 1;
  const xrefLines = [`xref\n0 ${totalObjs}\n0000000000 65535 f \n`];
  for (let i = 1; i < totalObjs; i++) {
    xrefLines.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  const trailer = `trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(xrefLines.join('') + trailer, 'latin1'));

  return Buffer.concat(chunks);
}

function generateAnalyticsPdf({
  garden,
  rangeLabel = '30d',
  generatedAt = new Date().toISOString(),
  kpis = {},
  waterByMethod = [],
  dailyTelemetry = [],
  zoneSummary = []
}) {
  const cmds = [];

  const addText = (x, y, text, { font = 'F1', size = 10, color = '0.15 0.17 0.2' } = {}) => {
    cmds.push('BT');
    cmds.push(`/${font} ${size} Tf`);
    cmds.push(`${color} rg`);
    cmds.push(`1 0 0 1 ${x} ${y} Tm`);
    cmds.push(`(${escapePdfText(text)}) Tj`);
    cmds.push('ET');
  };

  // Header Banner
  cmds.push('0.06 0.46 0.30 rg');
  cmds.push('0 732 612 60 re f');
  addText(40, 762, 'SmartGarden Analytics & Sustainability Report', {
    font: 'F2',
    size: 16,
    color: '1 1 1'
  });
  addText(40, 744, `Garden: ${garden?.name || 'Garden'} (${garden?.location_address || 'Plot'}) | Window: ${rangeLabel} | Generated: ${generatedAt.slice(0, 10)}`, {
    font: 'F1',
    size: 9,
    color: '0.88 0.96 0.92'
  });

  // KPI Section
  let y = 706;
  addText(40, y, 'Key Performance Indicators', { font: 'F2', size: 12, color: '0.06 0.36 0.24' });
  y -= 18;
  const kpiRows = [
    `Total Water Applied: ${Number(kpis.total_water_liters || 0).toFixed(2)} L across ${kpis.watering_events || 0} events`,
    `Task Completion Rate: ${Number(kpis.task_completion_rate_pct || 0).toFixed(1)}% (${kpis.completed_tasks || 0}/${kpis.total_tasks || 0} tasks)`,
    `Average Soil Moisture: ${kpis.avg_soil_moisture != null ? Number(kpis.avg_soil_moisture).toFixed(1) + '%' : 'N/A'} | Avg Temp: ${kpis.avg_temperature != null ? Number(kpis.avg_temperature).toFixed(1) + ' C' : 'N/A'}`,
    `Journal Entries Logged: ${kpis.journal_entries_count || 0} | Active Zones: ${zoneSummary.length}`
  ];
  for (const row of kpiRows) {
    addText(48, y, `- ${row}`, { size: 10 });
    y -= 15;
  }

  // Water Breakdown
  y -= 10;
  addText(40, y, 'Irrigation Method Breakdown', { font: 'F2', size: 12, color: '0.06 0.36 0.24' });
  y -= 18;
  if (waterByMethod.length === 0) {
    addText(48, y, 'No watering logs recorded in this window.', { size: 9, color: '0.45 0.48 0.52' });
    y -= 15;
  } else {
    for (const item of waterByMethod.slice(0, 6)) {
      addText(48, y, `${item.method}: ${Number(item.liters || 0).toFixed(2)} L (${item.events || 0} logs)`, { size: 9.5 });
      y -= 14;
    }
  }

  // Zone Summary
  y -= 10;
  addText(40, y, 'Microclimate Zone Summary', { font: 'F2', size: 12, color: '0.06 0.36 0.24' });
  y -= 18;
  addText(48, y, 'Zone Name | Water (L) | Avg Moist (%) | Avg Temp (C) | Crops', { font: 'F2', size: 9 });
  y -= 14;
  for (const z of zoneSummary.slice(0, 8)) {
    const moist = z.avg_soil_moisture != null ? Number(z.avg_soil_moisture).toFixed(1) : '-';
    const temp = z.avg_temperature != null ? Number(z.avg_temperature).toFixed(1) : '-';
    addText(48, y, `${z.zone_name} | ${Number(z.water_liters || 0).toFixed(1)} L | ${moist}% | ${temp} C | ${z.plant_count || 0}`, { size: 9 });
    y -= 13;
  }

  // Daily Telemetry Rollup
  y -= 10;
  if (y > 140) {
    addText(40, y, 'Recent Daily Sensor Rollups', { font: 'F2', size: 12, color: '0.06 0.36 0.24' });
    y -= 18;
    addText(48, y, 'Date | Moisture Avg (%) | Temp Avg (C) | Humidity (%) | Samples', { font: 'F2', size: 9 });
    y -= 14;
    const recent = dailyTelemetry.slice(-10);
    if (recent.length === 0) {
      addText(48, y, 'No daily sensor aggregates recorded for this window.', { size: 9, color: '0.45 0.48 0.52' });
    } else {
      for (const day of recent) {
        if (y < 60) break;
        addText(
          48,
          y,
          `${day.date} | ${Number(day.avg_soil_moisture || 0).toFixed(1)}% | ${Number(day.avg_temperature || 0).toFixed(1)} C | ${Number(day.avg_humidity || 0).toFixed(1)}% | ${day.sample_count || 0}`,
          { size: 9 }
        );
        y -= 13;
      }
    }
  }

  addText(40, 32, 'Generated by SmartGarden Telemetry & Horticulture Platform', {
    size: 8,
    color: '0.5 0.5 0.55'
  });

  return compilePdfDocument([buildPageStream(cmds)]);
}

module.exports = {
  generateAnalyticsPdf
};
