import { useState } from 'react';
export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [query, setQuery] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState("RELIANCE.BO");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null); // <-- ADD THIS LINE
  const [stockData, setStockData] = useState(null);

  // Formatter to clean up the Markdown coming from the AI/Fallback
  const formatReport = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      let cleanLine = line.trim();

      // Remove markdown bold/italic asterisks
      cleanLine = cleanLine.replace(/\*\*/g, '').replace(/\*/g, '');

      // Handle Headers (# Header)
      if (cleanLine.startsWith('#')) {
        const headerText = cleanLine.replace(/^#+\s*/, '');
        return (
          <h3 key={i} className="text-title-lg font-bold text-primary mt-4 mb-2">
            {headerText}
          </h3>
        );
      }

      // Handle Bullet Points (- Item)
      if (cleanLine.startsWith('- ') || cleanLine.startsWith('• ')) {
        const bulletText = cleanLine.replace(/^[-•]\s*/, '');
        return (
          <li key={i} className="ml-5 list-disc marker:text-primary mb-1 text-on-surface-variant">
            {bulletText}
          </li>
        );
      }

      // Handle Horizontal Rules (---)
      if (cleanLine === '---') {
        return <hr key={i} className="my-3 border-outline-variant/30" />;
      }

      // Empty Lines
      if (!cleanLine) {
        return <div key={i} className="h-2"></div>;
      }

      // Regular Paragraphs
      return <p key={i} className="mb-2 text-on-surface-variant leading-relaxed">{cleanLine}</p>;
    });
  };

  // Trigger FastAPI analysis
  const runAnalysis = async (searchQuery) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setReport(null);
    try {
      const retrieveRes = await fetch(`http://localhost:8000/retrieve/retrieve?query=${encodeURIComponent(searchQuery)}`);
      const retrieveData = await retrieveRes.json();
      // Save the latest stock numbers to state
      if (retrieveData.symbols && retrieveData.market_data) {
        const primarySymbol = retrieveData.symbols[0];
        const records = retrieveData.market_data[primarySymbol];
        if (records && records.length > 0) {
          setStockData(records[records.length - 1]);
        }
      }

      const analyzeRes = await fetch("http://localhost:8000/analyze/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: retrieveData })
      });
      const analyzeData = await analyzeRes.json();
      setReport(analyzeData.summary || "No brief generated.");
    } catch (error) {
      console.error("Backend Error:", error);
      setReport("Failed to connect to FastAPI backend. Ensure uvicorn is running on port 8000.");
    }
    setLoading(false);
  };

  const handleSearchKey = (e) => {
    if (e.key === 'Enter') {
      runAnalysis(query);
    }
  };

  const handleStockClick = (symbol) => {
    setSelectedSymbol(symbol);
    setQuery(`Analyze risk and market standing for ${symbol}`);
    runAnalysis(`Analyze risk and market standing for ${symbol}`);
  };

  return (
    <div className="flex bg-background font-body-md text-on-background min-h-screen">
      {/* SIDEBAR NAVIGATION */}
      <aside className="fixed left-0 top-0 h-full w-72 bg-surface-container-lowest z-50 flex flex-col border-r border-outline-variant shadow-sm">
        <div className="p-6 flex flex-col gap-1">
          <h1 className="text-title-lg font-headline-lg text-primary tracking-tight">Market Intelligence</h1>
          <p className="text-label-md font-label-md text-on-surface-variant uppercase tracking-widest">BSE X GLOBAL ANALYTICS</p>
        </div>

        <nav className="flex-1 px-4 mt-2 space-y-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center px-4 py-3 rounded-lg transition-all gap-3 ${activeTab === 'overview' ? 'bg-primary-container text-on-primary-container font-bold' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span className="font-body-md">Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('news')}
            className={`w-full flex items-center px-4 py-3 rounded-lg transition-all gap-3 ${activeTab === 'news' ? 'bg-primary-container text-on-primary-container font-bold' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
          >
            <span className="material-symbols-outlined">newspaper</span>
            <span className="font-body-md">Market Impact News</span>
          </button>

          <button
            onClick={() => setActiveTab('snapshot')}
            className={`w-full flex items-center px-4 py-3 rounded-lg transition-all gap-3 ${activeTab === 'snapshot' ? 'bg-primary-container text-on-primary-container font-bold' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
          >
            <span className="material-symbols-outlined">analytics</span>
            <span className="font-body-md">Stock Snapshot</span>
          </button>

          <button
            onClick={() => setActiveTab('geopolitical')}
            className={`w-full flex items-center px-4 py-3 rounded-lg transition-all gap-3 ${activeTab === 'geopolitical' ? 'bg-primary-container text-on-primary-container font-bold' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
          >
            <span className="material-symbols-outlined">public</span>
            <span className="font-body-md">Geopolitical Feed</span>
          </button>
        </nav>

        <div className="p-4 border-t border-outline-variant">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary text-[20px]">person</span>
            </div>
            <div className="flex flex-col text-left">
              <span className="text-body-md font-bold text-on-surface">Devesh</span>
              <span className="text-label-md text-on-surface-variant">Pro Analyst Plan</span>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="pl-72 w-full flex flex-col">
        {/* HEADER */}
        <header className="fixed top-0 left-72 right-0 bg-surface-container-lowest z-40 shadow-sm">
          <div className="h-16 px-8 flex items-center justify-center gap-4">
            <div className="flex-1 max-w-2xl relative group">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
              <input
                className="w-full h-11 pl-12 pr-24 bg-surface-container rounded-full border-none focus:ring-2 focus:ring-primary/20 text-body-md transition-all outline-none"
                placeholder="Search BSE stocks or ask: 'What's the risk in RELIANCE?'"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearchKey}
              />
              <button
                onClick={() => runAnalysis(query)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-primary text-on-primary text-xs font-bold rounded-full hover:opacity-90 transition-opacity"
              >
                ANALYZE
              </button>
            </div>
          </div>

          <div className="h-10 bg-surface-container-low border-t border-outline-variant overflow-hidden flex items-center">
            <div className="whitespace-nowrap flex items-center gap-8 px-8 animate-marquee text-label-md font-medium text-on-surface-variant">
              <span className="flex items-center gap-2">SENSEX <span className="text-secondary font-bold">77,654.60 (+1.16%)</span></span>
              <span className="flex items-center gap-2">NIFTY 50 <span className="text-secondary font-bold">24,250.20 (+1.10%)</span></span>
              <span className="flex items-center gap-2">BANKNIFTY <span className="text-secondary font-bold">52,430.15 (+0.85%)</span></span>
              <span className="flex items-center gap-2 uppercase">Gold <span className="text-tertiary font-bold">72,450 (-0.24%)</span></span>
              <span className="flex items-center gap-2 uppercase">Crude Oil <span className="text-secondary font-bold">6,890 (+1.42%)</span></span>
            </div>
          </div>
        </header>

        {/* DASHBOARD BODY */}
        <main className="pt-32 p-8 grid grid-cols-12 gap-8 w-full">

          {/* LEFT MAIN PANEL */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">

            {/* AI REPORT CONTAINER */}
            {(loading || report) && (
              <section className="bg-surface-container-lowest p-6 rounded-xl shadow-md border-l-4 border-primary flex flex-col">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-outline-variant/30">
                  <h3 className="text-headline-md font-headline-md text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">auto_awesome</span>
                    FinAI Intelligence Brief
                  </h3>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center gap-3 text-primary font-bold py-12">
                    <span className="material-symbols-outlined animate-spin">sync</span>
                    Evaluating market risk & fetching live data...
                  </div>
                ) : (
                  <div className="max-h-[400px] overflow-y-auto pr-3 border border-outline-variant/20 rounded-lg p-4 bg-surface-container-low/50">
                    {formatReport(report)}
                  </div>
                )}
              </section>
            )}

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="flex flex-col gap-6">
                <section className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/30">
                  <span className="px-2 py-0.5 bg-tertiary/10 text-tertiary text-label-md font-bold rounded-sm uppercase">HIGH IMPACT</span>
                  <h3 className="text-title-lg font-title-lg text-on-surface mt-2 mb-2">Middle East Escalation Causes Crude Oil Spike</h3>
                  <p className="text-body-md text-on-surface-variant">
                    Brent crude futures jumped 3.4% as tensions escalate, threatening supply routes through the Strait of Hormuz. Indian OMCs (BPCL, IOC) face margin pressures.
                  </p>
                </section>
                <section className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/30">
                  <span className="px-2 py-0.5 bg-secondary/10 text-secondary text-label-md font-bold rounded-sm uppercase">MACRO POLICY</span>
                  <h3 className="text-title-lg font-title-lg text-on-surface mt-2 mb-2">RBI Repo Rate Maintained at 6.5%</h3>
                  <p className="text-body-md text-on-surface-variant">
                    The MPC voted to keep benchmark interest rates steady to control core inflation while maintaining strong domestic GDP growth projections.
                  </p>
                </section>
              </div>
            )}

            {/* TAB 2: MARKET IMPACT NEWS */}
            {activeTab === 'news' && (
              <div className="flex flex-col gap-4">
                <h2 className="text-headline-md font-bold text-on-surface">Market Impacting News</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/20 shadow-sm">
                    <span className="text-xs font-bold text-primary uppercase">BSE Announcement</span>
                    <h4 className="font-bold text-on-surface mt-1">TCS Expands Digital Transformation Contract with European Bank</h4>
                    <p className="text-xs text-on-surface-variant mt-2">Multi-year $500M deal expansion announced on BSE filing platform.</p>
                  </div>
                  <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/20 shadow-sm">
                    <span className="text-xs font-bold text-tertiary uppercase">Commodities Impact</span>
                    <h4 className="font-bold text-on-surface mt-1">Global Shipping Rates Increase 12% Amid Maritime Diversions</h4>
                    <p className="text-xs text-on-surface-variant mt-2">Freight costs impact Indian exporters across textile and auto ancillary sectors.</p>
                  </div>
                  <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/20 shadow-sm">
                    <span className="text-xs font-bold text-secondary uppercase">Sectoral</span>
                    <h4 className="font-bold text-on-surface mt-1">PLI Scheme Expansion for IT Hardware: Tech Giants Eye Local Expansion</h4>
                    <p className="text-xs text-on-surface-variant mt-2">Dixon and Kaynes Technology show pre-market momentum following the announcement.</p>
                  </div>
                  <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/20 shadow-sm">
                    <span className="text-xs font-bold text-primary uppercase">Regulatory</span>
                    <h4 className="font-bold text-on-surface mt-1">SEBI Proposes New Norms for Investment Advisers</h4>
                    <p className="text-xs text-on-surface-variant mt-2">Structural changes aimed at protecting retail investors could impact broker volumes.</p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: STOCK SNAPSHOT */}
            {activeTab === 'snapshot' && (
              <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-outline-variant/30 flex flex-col gap-6">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-label-md font-label-md text-on-surface-variant uppercase tracking-widest">BSE Listed</span>
                      <span className="px-2 py-0.5 bg-secondary/10 text-secondary text-[10px] font-bold rounded">NIFTY 50</span>
                    </div>
                    <h2 className="text-headline-lg font-bold text-on-surface">{selectedSymbol}</h2>
                  </div>
                  <button
                    onClick={() => runAnalysis(selectedSymbol)}
                    className="px-4 py-2 bg-primary text-on-primary rounded-lg font-bold text-xs shadow-sm hover:opacity-90"
                  >
                    Run Fresh AI Scan
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-6 border-t border-outline-variant/30">
                  <div className="flex flex-col">
                    <span className="text-label-md font-label-md text-on-surface-variant uppercase">Open</span>
                    <span className="text-title-lg font-bold text-on-surface">
                      {stockData?.Open ? `₹${Number(stockData.Open).toFixed(2)}` : stockData?.open ? `₹${Number(stockData.open).toFixed(2)}` : '--'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-label-md font-label-md text-on-surface-variant uppercase">High</span>
                    <span className="text-title-lg font-bold text-on-surface">
                      {stockData?.High ? `₹${Number(stockData.High).toFixed(2)}` : stockData?.high ? `₹${Number(stockData.high).toFixed(2)}` : '--'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-label-md font-label-md text-on-surface-variant uppercase">Low</span>
                    <span className="text-title-lg font-bold text-on-surface">
                      {stockData?.Low ? `₹${Number(stockData.Low).toFixed(2)}` : stockData?.low ? `₹${Number(stockData.low).toFixed(2)}` : '--'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-label-md font-label-md text-on-surface-variant uppercase">Vol</span>
                    <span className="text-title-lg font-bold text-on-surface">
                      {stockData?.Volume ? Number(stockData.Volume).toLocaleString() : stockData?.volume ? Number(stockData.volume).toLocaleString() : '--'}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-on-surface-variant mt-4 italic">Select a ticker from the right sidebar to run automated financial risk evaluations.</p>
              </div>
            )}

            {/* TAB 4: GEOPOLITICAL FEED */}
            {activeTab === 'geopolitical' && (
              <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/30 flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
                  <div className="flex items-center gap-2 text-tertiary font-bold">
                    <span className="material-symbols-outlined">warning</span>
                    Global Risk Index: 74 / 100 (Volatile)
                  </div>
                  <span className="text-xs text-on-surface-variant">Last synced: 2m ago</span>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="p-4 border-l-2 border-tertiary bg-surface-container-low rounded-r-lg">
                    <span className="text-xs font-bold text-tertiary uppercase">14:22 GMT • High Impact</span>
                    <h4 className="font-bold text-on-surface mt-1">Eastern Europe Energy Infrastructure Targeted</h4>
                    <p className="text-sm text-on-surface-variant mt-1">Systemic drone strikes on regional power nodes. Potential for multi-week disruption in transit capacities through key pipeline networks. Monitor Indian Natural Gas and Fertilizer stocks.</p>
                  </div>
                  <div className="p-4 border-l-2 border-secondary bg-surface-container-low rounded-r-lg">
                    <span className="text-xs font-bold text-secondary uppercase">09:15 GMT • Medium Impact</span>
                    <h4 className="font-bold text-on-surface mt-1">ASEAN Trade Corridor Expansion Talks</h4>
                    <p className="text-sm text-on-surface-variant mt-1">Strategic bypass negotiations for Malacca Strait congestion. India invited as primary logistical observer. Positive for Port Logistics Stocks.</p>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* RIGHT SIDEBAR */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
            <section className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/30">
              <h3 className="text-title-lg font-title-lg text-on-surface mb-4">Top BSE Movers</h3>
              <p className="text-xs text-on-surface-variant mb-4">Click any stock to trigger instant AI risk evaluation:</p>

              <div className="flex flex-col gap-3">
                <div
                  onClick={() => handleStockClick("TCS.BO")}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-colors cursor-pointer border border-outline-variant/20"
                >
                  <div className="flex flex-col">
                    <span className="text-body-md font-bold text-on-surface">TCS.BO</span>
                    <span className="text-label-md text-on-surface-variant uppercase">Tata Consultancy</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-body-md font-bold text-on-surface">₹4,120.40</span>
                    <span className="text-label-md font-bold text-secondary">+2.45%</span>
                  </div>
                </div>

                <div
                  onClick={() => handleStockClick("RELIANCE.BO")}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-colors cursor-pointer border border-outline-variant/20"
                >
                  <div className="flex flex-col">
                    <span className="text-body-md font-bold text-on-surface">RELIANCE.BO</span>
                    <span className="text-label-md text-on-surface-variant uppercase">Reliance Ind.</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-body-md font-bold text-on-surface">₹2,845.20</span>
                    <span className="text-label-md font-bold text-tertiary">-0.82%</span>
                  </div>
                </div>

                <div
                  onClick={() => handleStockClick("INFY.BO")}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-colors cursor-pointer border border-outline-variant/20"
                >
                  <div className="flex flex-col">
                    <span className="text-body-md font-bold text-on-surface">INFY.BO</span>
                    <span className="text-label-md text-on-surface-variant uppercase">Infosys Ltd</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-body-md font-bold text-on-surface">₹1,540.20</span>
                    <span className="text-label-md font-bold text-secondary">+1.20%</span>
                  </div>
                </div>

                <div
                  onClick={() => handleStockClick("SBIN.BO")}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-colors cursor-pointer border border-outline-variant/20"
                >
                  <div className="flex flex-col">
                    <span className="text-body-md font-bold text-on-surface">SBIN.BO</span>
                    <span className="text-label-md text-on-surface-variant uppercase">State Bank India</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-body-md font-bold text-on-surface">₹845.10</span>
                    <span className="text-label-md font-bold text-secondary">+0.95%</span>
                  </div>
                </div>
              </div>
            </section>
          </div>

        </main>
      </div>
    </div>
  );
}