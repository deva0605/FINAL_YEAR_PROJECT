import React, { useMemo, useState } from 'react';

type Scenario = 'mild' | 'stress' | 'crash' | 'rally' | 'custom';
type HoldingInput = { symbol: string; quantity: string; price: string; shock: string };
type HoldingResult = {
  symbol: string;
  current_value: number;
  shock_percent: number;
  estimated_loss: number;
  post_shock_value: number;
  portfolio_weight_percent: number;
};
type SimulationResult = {
  scenario_name: string;
  methodology: string;
  current_portfolio_value: number;
  estimated_portfolio_loss: number;
  estimated_loss_percent: number;
  post_shock_portfolio_value: number;
  holdings: HoldingResult[];
  assumptions: string[];
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const presets: Record<Exclude<Scenario, 'custom'>, { label: string; shock: number; description: string }> = {
  mild: { label: 'Mild correction', shock: -5, description: 'A hypothetical 5% decline across all holdings.' },
  stress: { label: 'Market stress', shock: -15, description: 'A hypothetical 15% decline across all holdings.' },
  crash: { label: 'Severe drawdown', shock: -30, description: 'A hypothetical 30% decline across all holdings.' },
  rally: { label: 'Recovery rally', shock: 10, description: 'A hypothetical 10% increase across all holdings.' },
};

const initialHoldings: HoldingInput[] = [
  { symbol: 'AAPL', quantity: '10', price: '200', shock: '-15' },
  { symbol: 'MSFT', quantity: '5', price: '420', shock: '-15' },
  { symbol: 'NVDA', quantity: '12', price: '120', shock: '-15' },
];

function money(value: number, currency: string) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency', currency, maximumFractionDigits: 2,
  }).format(value);
}

function Metric({ label, value, detail, tone = 'default' }: { label: string; value: string; detail?: string; tone?: 'default' | 'danger' | 'good' }) {
  const valueClass = tone === 'danger' ? 'text-rose-700' : tone === 'good' ? 'text-emerald-700' : 'text-slate-900';
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
    <p className={`mt-2 text-xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
    {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
  </div>;
}

export const Simulation: React.FC = () => {
  const [holdings, setHoldings] = useState<HoldingInput[]>(initialHoldings);
  const [scenario, setScenario] = useState<Scenario>('stress');
  const [scenarioName, setScenarioName] = useState('Market stress scenario');
  const [cash, setCash] = useState('0');
  const [currency, setCurrency] = useState('USD');
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const scenarioDescription = useMemo(
    () => scenario === 'custom' ? 'Set a separate hypothetical percentage shock for each holding.' : presets[scenario].description,
    [scenario],
  );

  const updateHolding = (index: number, key: keyof HoldingInput, value: string) => {
    setHoldings(current => current.map((holding, i) => i === index ? { ...holding, [key]: value } : holding));
  };

  const changeScenario = (value: Scenario) => {
    setScenario(value);
    if (value !== 'custom') {
      setScenarioName(presets[value].label);
      setHoldings(current => current.map(holding => ({ ...holding, shock: String(presets[value].shock) })));
    } else {
      setScenarioName('Custom portfolio stress');
    }
  };

  const addHolding = () => {
    if (holdings.length < 20) setHoldings(current => [...current, { symbol: '', quantity: '1', price: '', shock: '-15' }]);
  };

  const runSimulation = async () => {
    setError('');
    setResult(null);
    if (!holdings.length || holdings.some(h => !h.symbol.trim() || !Number.isFinite(Number(h.quantity)) || Number(h.quantity) <= 0 || !Number.isFinite(Number(h.price)) || Number(h.price) <= 0 || !Number.isFinite(Number(h.shock)) || Number(h.shock) < -100 || Number(h.shock) > 100)) {
      setError('Enter a symbol, positive quantity and price, and a shock between -100% and +100% for every holding.');
      return;
    }
    if (!Number.isFinite(Number(cash)) || Number(cash) < 0) {
      setError('Cash must be zero or a positive number.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/simulation/portfolio-stress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario_name: scenarioName.trim() || 'Custom stress scenario',
          cash: Number(cash),
          holdings: holdings.map(h => ({
            symbol: h.symbol.trim().toUpperCase(),
            quantity: Number(h.quantity),
            current_price: Number(h.price),
            shock_percent: Number(h.shock),
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        const detail = typeof data.detail === 'string' ? data.detail : 'The API rejected the simulation input.';
        throw new Error(detail);
      }
      setResult(data as SimulationResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Simulation failed. Check that the FastAPI backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const totalLossTone = result && result.estimated_portfolio_loss > 0 ? 'danger' : 'good';

  return <div className="flex flex-col gap-6">
    <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Portfolio Lab · Decision Support</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Portfolio Risk Simulation</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">Stress-test a sample or custom portfolio, quantify the impact of hypothetical price shocks, and compare pre- and post-scenario values.</p>
        </div>
        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Deterministic scenario engine</span>
      </div>
      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
        Demo data warning: the prefilled holdings and prices are illustrative inputs, not live market quotes. All holdings must use the same currency. Results are hypothetical scenarios, not forecasts or investment advice.
      </div>
    </header>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">1. Configure portfolio</h2>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-600" htmlFor="currency">Currency</label>
          <select id="currency" value={currency} onChange={e => setCurrency(e.target.value)} className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm">
            <option value="USD">USD ($)</option>
            <option value="INR">INR (₹)</option>
          </select>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <th className="pb-3 pr-3">Symbol</th><th className="pb-3 pr-3">Quantity</th><th className="pb-3 pr-3">Price / share</th><th className="pb-3 pr-3">Shock (%)</th><th className="pb-3">Position value</th>
          </tr></thead>
          <tbody>
            {holdings.map((holding, index) => <tr key={index} className="border-b border-slate-100 last:border-0">
              <td className="py-3 pr-3"><input aria-label={`Holding ${index + 1} symbol`} value={holding.symbol} onChange={e => updateHolding(index, 'symbol', e.target.value)} placeholder="e.g. AAPL" className="w-28 rounded-lg border border-slate-300 px-2.5 py-2 font-medium uppercase" /></td>
              <td className="py-3 pr-3"><input aria-label={`Holding ${index + 1} quantity`} type="number" min="0.000001" step="any" value={holding.quantity} onChange={e => updateHolding(index, 'quantity', e.target.value)} className="w-28 rounded-lg border border-slate-300 px-2.5 py-2" /></td>
              <td className="py-3 pr-3"><input aria-label={`Holding ${index + 1} price`} type="number" min="0.000001" step="any" value={holding.price} onChange={e => updateHolding(index, 'price', e.target.value)} className="w-32 rounded-lg border border-slate-300 px-2.5 py-2" /></td>
              <td className="py-3 pr-3"><input aria-label={`Holding ${index + 1} shock`} type="number" min="-100" max="100" step="any" value={holding.shock} disabled={scenario !== 'custom'} onChange={e => updateHolding(index, 'shock', e.target.value)} className="w-28 rounded-lg border border-slate-300 px-2.5 py-2 disabled:bg-slate-100 disabled:text-slate-500" /></td>
              <td className="py-3 font-medium tabular-nums text-slate-700">{money(Math.max(0, Number(holding.quantity) || 0) * Math.max(0, Number(holding.price) || 0), currency)}</td>
              <td className="py-3 pl-2"><button type="button" onClick={() => setHoldings(current => current.filter((_, i) => i !== index))} disabled={holdings.length === 1} aria-label={`Remove ${holding.symbol || 'holding'}`} className="rounded-md px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-30">Remove</button></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <button type="button" onClick={addHolding} disabled={holdings.length >= 20} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40">+ Add holding</button>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="cash">Cash reserve</label>
          <input id="cash" type="number" min="0" step="any" value={cash} onChange={e => setCash(e.target.value)} className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">2. Choose scenario</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {(Object.keys(presets) as Array<Exclude<Scenario, 'custom'>>).map(key => <button key={key} type="button" onClick={() => changeScenario(key)} className={`rounded-xl border p-3 text-left transition ${scenario === key ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200' : 'border-slate-200 hover:border-slate-300'}`}>
          <span className="block text-sm font-semibold text-slate-900">{presets[key].label}</span><span className={`mt-1 block text-lg font-bold ${presets[key].shock < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{presets[key].shock > 0 ? '+' : ''}{presets[key].shock}%</span>
        </button>)}
        <button type="button" onClick={() => changeScenario('custom')} className={`rounded-xl border p-3 text-left transition ${scenario === 'custom' ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200' : 'border-slate-200 hover:border-slate-300'}`}>
          <span className="block text-sm font-semibold text-slate-900">Custom shocks</span><span className="mt-1 block text-sm text-slate-600">Per holding</span>
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-500">{scenarioDescription}</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <label htmlFor="scenarioName" className="mb-1 block text-xs font-medium text-slate-600">Scenario label</label>
          <input id="scenarioName" value={scenarioName} maxLength={80} onChange={e => setScenarioName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <button type="button" onClick={runSimulation} disabled={loading} className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60">{loading ? 'Calculating…' : 'Run stress simulation'}</button>
      </div>
      {error && <div role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
    </section>

    {result && <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Simulation output</p><h2 className="mt-1 text-xl font-bold text-slate-900">{result.scenario_name}</h2></div>
        <span className="text-xs text-slate-500">Calculated by the backend API</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Current portfolio value" value={money(result.current_portfolio_value, currency)} />
        <Metric label="Estimated loss / (gain)" value={money(result.estimated_portfolio_loss, currency)} tone={totalLossTone} detail="Positive = loss · Negative = gain" />
        <Metric label="Portfolio impact" value={`${result.estimated_loss_percent.toFixed(2)}%`} tone={result.estimated_loss_percent > 0 ? 'danger' : 'good'} />
        <Metric label="Post-shock value" value={money(result.post_shock_portfolio_value, currency)} />
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4"><h3 className="font-semibold text-slate-900">Holding-level impact</h3><p className="mt-1 text-xs text-slate-500">Shows contribution to the scenario from each position; does not estimate likelihood.</p></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Holding</th><th className="px-4 py-3">Weight</th><th className="px-4 py-3">Shock</th><th className="px-4 py-3">Estimated loss / (gain)</th><th className="px-4 py-3">Post-shock value</th></tr></thead>
            <tbody>{result.holdings.map((holding, i) => <tr key={`${holding.symbol}-${i}`} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold text-slate-900">{holding.symbol}</td><td className="px-4 py-3 tabular-nums">{holding.portfolio_weight_percent.toFixed(2)}%</td><td className="px-4 py-3 tabular-nums">{holding.shock_percent > 0 ? '+' : ''}{holding.shock_percent.toFixed(2)}%</td><td className={`px-4 py-3 tabular-nums ${holding.estimated_loss > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{money(holding.estimated_loss, currency)}</td><td className="px-4 py-3 tabular-nums">{money(holding.post_shock_value, currency)}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-900">Methodology & assumptions</h3>
        <p className="mt-2 text-sm text-slate-600">{result.methodology}</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-600">{result.assumptions.map((assumption, i) => <li key={i}>{assumption}</li>)}</ul>
      </div>
    </section>}
  </div>;
};
