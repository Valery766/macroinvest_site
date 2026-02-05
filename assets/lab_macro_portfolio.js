const datasetMap = {
  '2026.01': '2026-01-31',
  '2025.12': '2025-12-31',
  '2025.09': '2025-09-30',
};

const scenarioLabels = {
  base: 'base',
  hawkish: 'hawkish',
  dovish: 'dovish',
};

const scenarioMultiplier = {
  base: 1.0,
  hawkish: 0.88,
  dovish: 1.06,
};

const riskProfileBands = {
  conservative: { vol: 0.7, drawdown: 0.8 },
  moderate: { vol: 1.0, drawdown: 1.0 },
  aggressive: { vol: 1.25, drawdown: 1.25 },
};

const targetBandMap = {
  real_0_1: 0.01,
  real_2_3: 0.025,
  real_4_6: 0.05,
};

const elements = {
  scenario: document.getElementById('scenario'),
  riskProfile: document.getElementById('riskProfile'),
  horizon: document.getElementById('horizon'),
  targetBand: document.getElementById('targetBand'),
  datasetVersion: document.getElementById('datasetVersion'),
  datasetAsOf: document.getElementById('datasetAsOf'),
  reportId: document.getElementById('reportId'),
  datasetInfo: document.getElementById('datasetInfo'),
  wSum: document.getElementById('wSum'),
  outWeights: document.getElementById('outWeights'),
  outMetrics: document.getElementById('outMetrics'),
  outQuality: document.getElementById('outQuality'),
  outExplain: document.getElementById('outExplain'),
  compareBox: document.getElementById('compareBox'),
  btnRun: document.getElementById('btnRun'),
  btnCompare: document.getElementById('btnCompare'),
  btnPrint: document.getElementById('btnPrint'),
  btnExport: document.getElementById('btnExport'),
  presetConservative: document.getElementById('presetConservative'),
  presetBalanced: document.getElementById('presetBalanced'),
  presetAggressive: document.getElementById('presetAggressive'),
  weights: {
    bonds: { range: document.getElementById('w_bonds'), number: document.getElementById('n_bonds') },
    equity: { range: document.getElementById('w_equity'), number: document.getElementById('n_equity') },
    cash: { range: document.getElementById('w_cash'), number: document.getElementById('n_cash') },
    alt: { range: document.getElementById('w_alt'), number: document.getElementById('n_alt') },
  },
};

const state = {
  lastReport: null,
  lastScenarioTable: null,
};

const formatPercent = (value, digits = 1) => `${(value * 100).toFixed(digits)}%`;

function updateDatasetInfo() {
  if (!elements.datasetVersion) return;
  const version = elements.datasetVersion.value;
  const asOf = datasetMap[version] || '—';
  if (elements.datasetAsOf) {
    elements.datasetAsOf.textContent = asOf;
  }
  if (elements.datasetInfo) {
    elements.datasetInfo.textContent = `${version} (${asOf})`;
  }
}

function getWeights() {
  const raw = {
    bonds: parseFloat(elements.weights.bonds.number.value || 0),
    equity: parseFloat(elements.weights.equity.number.value || 0),
    cash: parseFloat(elements.weights.cash.number.value || 0),
    alt: parseFloat(elements.weights.alt.number.value || 0),
  };
  const sum = Object.values(raw).reduce((acc, val) => acc + val, 0);
  if (sum <= 0) {
    return { normalized: { bonds: 0.4, equity: 0.4, cash: 0.15, alt: 0.05 }, sum: 100 };
  }
  const normalized = Object.fromEntries(
    Object.entries(raw).map(([key, val]) => [key, val / sum])
  );
  return { normalized, sum };
}

function updateWeightSum() {
  const { sum } = getWeights();
  if (elements.wSum) {
    elements.wSum.textContent = `${sum.toFixed(1)}%`;
  }
}

function syncWeightInputs(key, value, isRange) {
  const weight = elements.weights[key];
  if (!weight) return;
  if (isRange) {
    weight.number.value = parseFloat(value).toFixed(1);
  } else {
    weight.range.value = value;
  }
  updateWeightSum();
}

function bindWeights() {
  Object.entries(elements.weights).forEach(([key, inputs]) => {
    inputs.range.addEventListener('input', (event) => {
      syncWeightInputs(key, event.target.value, true);
    });
    inputs.number.addEventListener('input', (event) => {
      syncWeightInputs(key, event.target.value, false);
    });
  });
}

function applyPreset(values) {
  Object.entries(values).forEach(([key, value]) => {
    const inputs = elements.weights[key];
    inputs.range.value = value;
    inputs.number.value = value.toFixed(1);
  });
  updateWeightSum();
}

function buildReport() {
  const { normalized, sum } = getWeights();
  const scenario = elements.scenario.value;
  const riskProfile = elements.riskProfile.value;
  const horizon = parseInt(elements.horizon.value, 10) || 5;
  const targetBand = elements.targetBand.value;
  const target = targetBandMap[targetBand] || 0.025;
  const scenarioShift = scenarioMultiplier[scenario] || 1.0;
  const riskBand = riskProfileBands[riskProfile] || riskProfileBands.moderate;

  const expectedReturn = (
    normalized.bonds * 0.022 +
    normalized.equity * 0.065 +
    normalized.cash * 0.012 +
    normalized.alt * 0.075
  ) * scenarioShift;

  const volatility = (
    normalized.bonds * 0.06 +
    normalized.equity * 0.18 +
    normalized.cash * 0.02 +
    normalized.alt * 0.22
  ) * riskBand.vol;

  const drawdown = Math.min(0.55, volatility * 1.65 * riskBand.drawdown);
  const buffer = expectedReturn - target;
  const shortfall = 1 / (1 + Math.exp(buffer * 18));

  const alignment = Math.max(0, 1 - Math.abs(sum - 100) / 25);
  const diversification = Math.min(1, 0.4 + normalized.equity + normalized.bonds);
  const qualityScore = Math.max(
    0,
    Math.min(10, (alignment * 3.5 + diversification * 3.5 + (1 - drawdown) * 3) * 2)
  );

  const reportId = `LAB-${Date.now().toString(36).toUpperCase()}`;

  return {
    reportId,
    inputs: {
      scenario,
      riskProfile,
      horizon,
      targetBand,
      weights: normalized,
      sum,
      dataset: elements.datasetVersion.value,
      datasetAsOf: datasetMap[elements.datasetVersion.value],
    },
    outputs: {
      expectedReturn,
      volatility,
      drawdown,
      shortfall,
      qualityScore,
    },
  };
}

function renderReport(report) {
  elements.reportId.textContent = report.reportId;
  elements.datasetInfo.textContent = `${report.inputs.dataset} (${report.inputs.datasetAsOf})`;

  elements.outWeights.innerHTML = `
    Bonds: <b>${formatPercent(report.inputs.weights.bonds)}</b> ·
    Equity: <b>${formatPercent(report.inputs.weights.equity)}</b> ·
    Cash: <b>${formatPercent(report.inputs.weights.cash)}</b> ·
    Alt: <b>${formatPercent(report.inputs.weights.alt)}</b>
  `;

  elements.outMetrics.innerHTML = `
    Ожидаемая реальная доходность: <b>${formatPercent(report.outputs.expectedReturn, 2)}</b><br />
    Волатильность (год): <b>${formatPercent(report.outputs.volatility, 2)}</b><br />
    Потенциальная просадка: <b>${formatPercent(report.outputs.drawdown, 1)}</b><br />
    Вероятность недостижения цели: <b>${formatPercent(report.outputs.shortfall, 1)}</b>
  `;

  const qualityLabel = report.outputs.qualityScore >= 7.5
    ? 'Устойчивое решение — соблюдены лимиты и цель.'
    : report.outputs.qualityScore >= 5
      ? 'Базовый уровень — есть зоны для улучшения.'
      : 'Нужна корректировка параметров и риск-лимитов.';

  elements.outQuality.innerHTML = `
    Score: <b>${report.outputs.qualityScore.toFixed(1)}</b>/10<br />
    ${qualityLabel}
  `;

  elements.outExplain.innerHTML = `
    Сценарий <b>${scenarioLabels[report.inputs.scenario]}</b>, риск‑профиль <b>${report.inputs.riskProfile}</b>, горизонт <b>${report.inputs.horizon} лет</b>.
    Рекомендованный шаг обучения: проверить чувствительность к сценарию и пересмотреть веса,
    если вероятность недостижения цели выше 35%.
  `;
}

function buildScenarioTable(report) {
  const scenarios = ['base', 'hawkish', 'dovish'];
  const rows = scenarios.map((scenario) => {
    const scenarioReport = {
      ...report,
      inputs: { ...report.inputs, scenario },
    };
    const simulated = buildReportFromBase(scenarioReport);
    return {
      scenario,
      expected: simulated.outputs.expectedReturn,
      volatility: simulated.outputs.volatility,
      drawdown: simulated.outputs.drawdown,
      quality: simulated.outputs.qualityScore,
    };
  });

  return `
    <table class="table">
      <thead>
        <tr>
          <th>Сценарий</th>
          <th>Доходность</th>
          <th>Волатильность</th>
          <th>Просадка</th>
          <th>Score</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                <td>${row.scenario}</td>
                <td>${formatPercent(row.expected, 2)}</td>
                <td>${formatPercent(row.volatility, 2)}</td>
                <td>${formatPercent(row.drawdown, 1)}</td>
                <td>${row.quality.toFixed(1)}/10</td>
              </tr>
            `
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function buildReportFromBase(baseReport) {
  const scenario = baseReport.inputs.scenario;
  const riskProfile = baseReport.inputs.riskProfile;
  const targetBand = baseReport.inputs.targetBand;
  const scenarioShift = scenarioMultiplier[scenario] || 1.0;
  const riskBand = riskProfileBands[riskProfile] || riskProfileBands.moderate;
  const target = targetBandMap[targetBand] || 0.025;
  const weights = baseReport.inputs.weights;

  const expectedReturn = (
    weights.bonds * 0.022 +
    weights.equity * 0.065 +
    weights.cash * 0.012 +
    weights.alt * 0.075
  ) * scenarioShift;

  const volatility = (
    weights.bonds * 0.06 +
    weights.equity * 0.18 +
    weights.cash * 0.02 +
    weights.alt * 0.22
  ) * riskBand.vol;

  const drawdown = Math.min(0.55, volatility * 1.65 * riskBand.drawdown);
  const buffer = expectedReturn - target;
  const shortfall = 1 / (1 + Math.exp(buffer * 18));

  const alignment = Math.max(0, 1 - Math.abs(baseReport.inputs.sum - 100) / 25);
  const diversification = Math.min(1, 0.4 + weights.equity + weights.bonds);
  const qualityScore = Math.max(
    0,
    Math.min(10, (alignment * 3.5 + diversification * 3.5 + (1 - drawdown) * 3) * 2)
  );

  return {
    ...baseReport,
    outputs: { expectedReturn, volatility, drawdown, shortfall, qualityScore },
  };
}

function exportReport(report) {
  const payload = {
    reportId: report.reportId,
    generatedAt: new Date().toISOString(),
    inputs: report.inputs,
    outputs: report.outputs,
  };

  const jsonBlob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const textBlob = new Blob([
    `Report: ${report.reportId}\n` +
      `Scenario: ${report.inputs.scenario}\n` +
      `Risk profile: ${report.inputs.riskProfile}\n` +
      `Horizon: ${report.inputs.horizon} years\n` +
      `Expected return: ${(report.outputs.expectedReturn * 100).toFixed(2)}%\n` +
      `Volatility: ${(report.outputs.volatility * 100).toFixed(2)}%\n` +
      `Drawdown: ${(report.outputs.drawdown * 100).toFixed(1)}%\n` +
      `Quality score: ${report.outputs.qualityScore.toFixed(1)}/10\n`,
  ], { type: 'text/plain' });

  const download = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  download(jsonBlob, `${report.reportId}.json`);
  download(textBlob, `${report.reportId}.txt`);
}

function init() {
  if (!elements.scenario) return;
  updateDatasetInfo();
  bindWeights();
  updateWeightSum();

  elements.datasetVersion.addEventListener('change', updateDatasetInfo);

  elements.presetConservative.addEventListener('click', () =>
    applyPreset({ bonds: 60, equity: 20, cash: 15, alt: 5 })
  );
  elements.presetBalanced.addEventListener('click', () =>
    applyPreset({ bonds: 45, equity: 40, cash: 10, alt: 5 })
  );
  elements.presetAggressive.addEventListener('click', () =>
    applyPreset({ bonds: 25, equity: 55, cash: 5, alt: 15 })
  );

  elements.btnRun.addEventListener('click', () => {
    const report = buildReport();
    state.lastReport = report;
    renderReport(report);
    toast('Отчёт лабораторной сформирован.');
  });

  elements.btnCompare.addEventListener('click', () => {
    if (!state.lastReport) {
      toast('Сначала сформируйте отчёт лабораторной.');
      return;
    }
    const table = buildScenarioTable(state.lastReport);
    state.lastScenarioTable = table;
    elements.compareBox.innerHTML = table;
  });

  elements.btnPrint.addEventListener('click', () => {
    window.print();
  });

  elements.btnExport.addEventListener('click', () => {
    if (!state.lastReport) {
      toast('Сначала сформируйте отчёт лабораторной.');
      return;
    }
    exportReport(state.lastReport);
  });
}

init();
