import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { scaleLinear } from 'd3-scale';
import { Tooltip as MapTooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Box,
  CalendarDays,
  Check,
  CircleDollarSign,
  Database,
  Download,
  ExternalLink,
  FileStack,
  Globe2,
  HardDrive,
  Info,
  Layers3,
  Menu,
  PackageOpen,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import './index.css';

const isProd = import.meta.env.PROD;
const API_URL = import.meta.env.VITE_API_URL || (isProd ? '/api' : 'http://localhost:5000/api');
const GEO_URL = 'https://unpkg.com/world-atlas@2.0.2/countries-110m.json';

const COLORS = ['#d8ff4f', '#80e7c5', '#ff9364', '#b39cff', '#61a8ff', '#f4d06f', '#ff7f9f', '#8bd36d'];

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'geopolitics', label: 'Trade map', icon: Globe2 },
  { id: 'commodities', label: 'Commodities', icon: PackageOpen },
  { id: 'datasources', label: 'Data pipeline', icon: Database },
  { id: 'about', label: 'About', icon: Info },
];

const PAGE_COPY = {
  overview: {
    eyebrow: 'Global trade intelligence',
    title: 'World trade, in focus.',
    description: 'A compact view of long-run trade flows, market leaders, and commodity concentration.',
  },
  geopolitics: {
    eyebrow: 'Market geography',
    title: 'Follow the flow of exports.',
    description: 'Explore cumulative export value across reporting economies from the UN Comtrade dataset.',
  },
  commodities: {
    eyebrow: 'Product intelligence',
    title: 'What the world trades.',
    description: 'Rank the product groups shaping global trade value and economic activity.',
  },
  datasources: {
    eyebrow: 'Data engineering',
    title: 'From raw files to decisions.',
    description: 'Trace the medallion pipeline that cleans, aggregates, and serves the dashboard.',
  },
  about: {
    eyebrow: 'SDG 8 analytics',
    title: 'Built for transparent insight.',
    description: 'Project context, system architecture, and the public sources behind the analysis.',
  },
};

function formatCompactUsd(value) {
  const amount = Number(value) || 0;
  if (Math.abs(amount) >= 1e12) return `$${(amount / 1e12).toFixed(2)}T`;
  if (Math.abs(amount) >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (Math.abs(amount) >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `${number > 0 ? '+' : ''}${number.toFixed(1)}%`;
}

function AppHeader({ activeTab, onNavigate, menuOpen, setMenuOpen, refreshing, onRefresh, onExport }) {
  return (
    <header className="app-header">
      <div className="brand-lockup" aria-label="Trade8 home">
        <span className="brand-mark"><Activity size={16} strokeWidth={2.5} /></span>
        <span className="brand-name">Trade<span>8</span></span>
      </div>

      <nav className={`primary-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Primary navigation">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`nav-pill ${activeTab === id ? 'active' : ''}`}
            onClick={() => {
              onNavigate(id);
              setMenuOpen(false);
            }}
            aria-current={activeTab === id ? 'page' : undefined}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="header-actions">
        <span className="connection-chip"><span className="status-dot" /> Live dataset</span>
        <button type="button" className="icon-button" onClick={onRefresh} aria-label="Refresh dashboard data">
          <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
        </button>
        <button type="button" className="export-button" onClick={onExport}>
          <Download size={15} />
          <span>Export</span>
        </button>
        <button
          type="button"
          className="menu-button"
          onClick={() => setMenuOpen((current) => !current)}
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
    </header>
  );
}

function PageIntro({ activeTab }) {
  const copy = PAGE_COPY[activeTab];
  return (
    <section className="page-intro">
      <div>
        <p className="eyebrow"><Sparkles size={13} /> {copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p className="intro-copy">{copy.description}</p>
      </div>
      <div className="dataset-window">
        <span>Dataset window</span>
        <strong>1988—2016</strong>
        <small>UN Comtrade · 8.2M records</small>
      </div>
    </section>
  );
}

function MetricCard({ label, value, trend, helper, icon: Icon, featured = false }) {
  const numericTrend = Number(trend);
  const isNumeric = Number.isFinite(numericTrend);
  const isPositive = !isNumeric || numericTrend >= 0;

  return (
    <article className={`metric-card ${featured ? 'featured' : ''}`}>
      <div className="metric-card-top">
        <p>{label}</p>
        <span className="metric-icon"><Icon size={16} /></span>
      </div>
      <strong className="metric-value">{value}</strong>
      <div className="metric-meta">
        <span className={isPositive ? 'positive' : 'negative'}>
          {isPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {isNumeric ? formatPercent(numericTrend) : trend}
        </span>
        <small>{helper}</small>
      </div>
    </article>
  );
}

function PanelHeader({ kicker, title, action }) {
  return (
    <div className="panel-heading">
      <div>
        {kicker && <p className="panel-kicker">{kicker}</p>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function TradeTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p>{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="tooltip-row">
          <span className="tooltip-dot" style={{ background: entry.color }} />
          <span>{entry.name}</span>
          <strong>${Number(entry.value).toFixed(2)}B</strong>
        </div>
      ))}
    </div>
  );
}

function OverviewTab({ yearChartData, categoryData, topCountries, metrics }) {
  const categoryTotal = categoryData.reduce((sum, item) => sum + item.value, 0);
  const marketRows = topCountries.exports.slice(0, 5);
  const maxMarketValue = marketRows[0]?.total_export || 1;

  return (
    <>
      <section className="metric-grid" aria-label="Key performance indicators">
        <MetricCard
          featured
          label="Cumulative exports"
          value={formatCompactUsd(metrics.totalExport)}
          trend={metrics.exportGrowth}
          helper="2000s vs 2010s"
          icon={TrendingUp}
        />
        <MetricCard
          label="Cumulative imports"
          value={formatCompactUsd(metrics.totalImport)}
          trend={metrics.importGrowth}
          helper="2000s vs 2010s"
          icon={CircleDollarSign}
        />
        <MetricCard
          label="Leading exporter"
          value={metrics.topExporter}
          trend="Rank #1"
          helper="Historical total"
          icon={Globe2}
        />
        <MetricCard
          label="Tracked categories"
          value={String(metrics.categoryCount)}
          trend="8 groups"
          helper="In current overview"
          icon={Box}
        />
      </section>

      <section className="overview-grid">
        <article className="dashboard-panel flow-panel">
          <PanelHeader
            kicker="Trade flow"
            title="Export and import value"
            action={<span className="panel-chip">Annual · Billion USD</span>}
          />
          <div className="chart-stage flow-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={yearChartData} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="exportFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d8ff4f" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#d8ff4f" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="importFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#80e7c5" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#80e7c5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.055)" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#777a73', fontSize: 11 }} minTickGap={28} />
                <YAxis width={68} axisLine={false} tickLine={false} tick={{ fill: '#777a73', fontSize: 11 }} tickFormatter={(value) => `$${value}B`} />
                <Tooltip content={<TradeTooltip />} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, color: '#a7aaa2' }} />
                <Area type="monotone" dataKey="Export" stroke="#d8ff4f" strokeWidth={2.4} fill="url(#exportFill)" dot={false} activeDot={{ r: 4, fill: '#d8ff4f', stroke: '#11130f', strokeWidth: 2 }} />
                <Area type="monotone" dataKey="Import" stroke="#80e7c5" strokeWidth={2} fill="url(#importFill)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="dashboard-panel allocation-panel">
          <PanelHeader
            kicker="Product mix"
            title="Category allocation"
            action={<span className="round-action"><ArrowUpRight size={14} /></span>}
          />
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={65}
                  outerRadius={92}
                  paddingAngle={3}
                  cornerRadius={6}
                  stroke="none"
                >
                  {categoryData.map((item, index) => (
                    <Cell key={item.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0];
                    return (
                      <div className="chart-tooltip">
                        <p>{item.name}</p>
                        <strong>{formatCompactUsd(item.value * 1e9)}</strong>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <small>Portfolio</small>
              <strong>{formatCompactUsd(categoryTotal * 1e9)}</strong>
            </div>
          </div>
          <div className="legend-list">
            {categoryData.slice(0, 4).map((item, index) => (
              <div key={item.name}>
                <span className="legend-color" style={{ background: COLORS[index % COLORS.length] }} />
                <p>{item.name}</p>
                <strong>{categoryTotal ? `${((item.value / categoryTotal) * 100).toFixed(1)}%` : '0%'}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-panel markets-panel">
          <PanelHeader
            kicker="Market leaders"
            title="Top exporting economies"
            action={<span className="panel-chip">Cumulative</span>}
          />
          <div className="market-list">
            {marketRows.map((country, index) => (
              <div className="market-row" key={country.country_or_area}>
                <span className="market-rank">{String(index + 1).padStart(2, '0')}</span>
                <div className="market-main">
                  <div>
                    <p>{country.country_or_area}</p>
                    <strong>{formatCompactUsd(country.total_export)}</strong>
                  </div>
                  <span className="market-track">
                    <span style={{ width: `${Math.max(8, (country.total_export / maxMarketValue) * 100)}%` }} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-panel insight-panel">
          <div className="insight-orb"><Target size={24} /></div>
          <div>
            <p className="panel-kicker">SDG 8 signal</p>
            <h2>Trade growth can widen access to productive opportunity.</h2>
            <p>
              Use the dashboard to examine where value concentrates, which markets lead,
              and how trade activity changes across economic cycles.
            </p>
          </div>
          <a href="https://sdgs.un.org/goals/goal8" target="_blank" rel="noreferrer" className="insight-link">
            Explore Goal 8 <ArrowRight size={14} />
          </a>
        </article>
      </section>
    </>
  );
}

function TradeMapTab({ allCountriesTrade }) {
  const values = Object.values(allCountriesTrade);
  const maxTrade = values.length ? Math.max(...values) : 1;
  const colorScale = scaleLinear()
    .domain([0, maxTrade * 0.18, maxTrade])
    .range(['#242721', '#6e7e37', '#d8ff4f']);

  return (
    <section className="single-panel-layout">
      <article className="dashboard-panel map-panel">
        <PanelHeader
          kicker="Geographic distribution"
          title="Cumulative export intensity"
          action={<span className="panel-chip"><Globe2 size={12} /> Scroll to zoom</span>}
        />
        <div className="map-stage">
          {Object.keys(allCountriesTrade).length ? (
            <ComposableMap projectionConfig={{ scale: 145 }} width={900} height={460}>
              <ZoomableGroup zoom={1} minZoom={1} maxZoom={8} translateExtent={[[0, 0], [900, 460]]}>
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const name = geo.properties.name;
                      const value = allCountriesTrade[name];
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          data-tooltip-id="trade-map-tooltip"
                          data-tooltip-content={value ? `${name} · ${formatCompactUsd(value)}` : `${name} · No data`}
                          style={{
                            default: { fill: value ? colorScale(value) : '#20231e', outline: 'none', stroke: '#11130f', strokeWidth: 0.6 },
                            hover: { fill: '#ffffff', outline: 'none', cursor: 'pointer' },
                            pressed: { fill: '#d8ff4f', outline: 'none' },
                          }}
                        />
                      );
                    })
                  }
                </Geographies>
              </ZoomableGroup>
            </ComposableMap>
          ) : (
            <EmptyState message="Map data is not available." />
          )}
          <MapTooltip id="trade-map-tooltip" className="map-tooltip" />
        </div>
        <div className="map-legend">
          <span>Lower value</span>
          <span className="gradient-scale" />
          <span>Higher value</span>
        </div>
      </article>
    </section>
  );
}

function CommodityTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="chart-tooltip commodity-tooltip">
      <p>{item.fullName}</p>
      <strong>{formatCompactUsd(item.rawValue)}</strong>
    </div>
  );
}

function CommoditiesTab({ topCommodities }) {
  const chartData = topCommodities.map((item) => ({
    name: item.commodity.length > 25 ? `${item.commodity.slice(0, 25)}…` : item.commodity,
    fullName: item.commodity,
    value: item.total_trade / 1e9,
    rawValue: item.total_trade,
  }));

  return (
    <section className="commodity-layout">
      <article className="dashboard-panel commodity-chart-panel">
        <PanelHeader
          kicker="Value ranking"
          title="Top commodities"
          action={<span className="panel-chip">Billion USD</span>}
        />
        <div className="chart-stage commodity-chart">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 48, left: 22, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#777a73', fontSize: 10 }} tickFormatter={(value) => `$${value.toFixed(0)}B`} />
                <YAxis type="category" dataKey="name" width={190} axisLine={false} tickLine={false} tick={{ fill: '#a7aaa2', fontSize: 11 }} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.035)' }} content={<CommodityTooltip />} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={18}>
                  {chartData.map((item, index) => (
                    <Cell key={item.fullName} fill={index === 0 ? '#d8ff4f' : COLORS[(index + 1) % COLORS.length]} />
                  ))}
                  <LabelList dataKey="value" position="right" formatter={(value) => `$${value.toFixed(1)}B`} fill="#8d9188" fontSize={10} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="Commodity data is not available." />
          )}
        </div>
      </article>

      <article className="dashboard-panel commodity-table-panel">
        <PanelHeader kicker="Detail view" title="Commodity ledger" />
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Commodity</th>
                <th>Category</th>
                <th>Trade value</th>
              </tr>
            </thead>
            <tbody>
              {topCommodities.map((item, index) => (
                <tr key={`${item.commodity}-${index}`}>
                  <td><span className="rank-badge">{String(index + 1).padStart(2, '0')}</span></td>
                  <td><strong>{item.commodity}</strong></td>
                  <td><span className="category-tag">{String(item.category).replaceAll('_', ' ')}</span></td>
                  <td>{formatCompactUsd(item.total_trade)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

function DataPipelineTab() {
  const stages = [
    {
      name: 'Bronze',
      icon: HardDrive,
      title: 'Raw ingestion',
      description: 'UN Comtrade CSV records land unchanged, preserving source fidelity for auditing.',
      meta: '8.2M rows',
    },
    {
      name: 'Silver',
      icon: Zap,
      title: 'Quality and standardization',
      description: 'Null handling, flow filtering, country normalization, and typed trade measures.',
      meta: 'Validated',
    },
    {
      name: 'Gold',
      icon: Layers3,
      title: 'Analytics-ready aggregates',
      description: 'Year, economy, and commodity summaries are written to SQLite for low-latency reads.',
      meta: 'API ready',
    },
  ];

  return (
    <section className="pipeline-layout">
      <article className="dashboard-panel pipeline-panel">
        <PanelHeader
          kicker="Medallion architecture"
          title="Three layers, one trusted view"
          action={<span className="panel-chip"><Check size={12} /> Production pattern</span>}
        />
        <div className="pipeline-track">
          {stages.map(({ name, icon: Icon, title, description, meta }, index) => (
            <div className="pipeline-stage" key={name}>
              <div className={`stage-icon ${name.toLowerCase()}`}><Icon size={19} /></div>
              <div className="stage-copy">
                <div className="stage-label-row">
                  <span>{name}</span>
                  <small>{meta}</small>
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
              {index < stages.length - 1 && <span className="stage-connector"><ArrowRight size={16} /></span>}
            </div>
          ))}
        </div>
      </article>

      <div className="source-cards">
        <article className="dashboard-panel source-card">
          <FileStack size={18} />
          <p>Source format</p>
          <strong>CSV / Parquet</strong>
          <small>Raw commodity trade records</small>
        </article>
        <article className="dashboard-panel source-card">
          <Activity size={18} />
          <p>Compute engines</p>
          <strong>Spark + Pandas</strong>
          <small>Distributed and local ETL paths</small>
        </article>
        <article className="dashboard-panel source-card">
          <Database size={18} />
          <p>Serving layer</p>
          <strong>Flask + SQLite</strong>
          <small>Cached REST endpoints</small>
        </article>
        <article className="dashboard-panel source-card">
          <CalendarDays size={18} />
          <p>Time coverage</p>
          <strong>1988—2016</strong>
          <small>Historical reporting window</small>
        </article>
      </div>

      <article className="dashboard-panel schema-panel">
        <PanelHeader kicker="Gold contract" title="Analytics schema" />
        <div className="schema-grid">
          {[
            ['country_or_area', 'string', 'Reporting economy'],
            ['year', 'integer', 'Reference period'],
            ['flow', 'string', 'Export or import'],
            ['commodity', 'string', 'HS-based description'],
            ['trade_usd', 'float', 'Trade value in USD'],
            ['weight_kg', 'float', 'Net traded weight'],
          ].map(([field, type, description]) => (
            <div className="schema-field" key={field}>
              <code>{field}</code>
              <span>{type}</span>
              <small>{description}</small>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function AboutTab() {
  const links = [
    ['UN Comtrade', 'Official global trade statistics', 'https://comtrade.un.org/'],
    ['Kaggle dataset', 'Raw commodity trade archive', 'https://www.kaggle.com/datasets/unitednations/global-commodity-trade-statistics'],
    ['UN SDG Goal 8', 'Decent work and economic growth', 'https://sdgs.un.org/goals/goal8'],
    ['GitHub repository', 'Source code and documentation', 'https://github.com/LaboNapitupulu/sdg8-global-trade-pipeline'],
  ];

  return (
    <section className="about-layout">
      <article className="dashboard-panel about-hero">
        <span className="about-symbol"><Globe2 size={27} /></span>
        <div>
          <p className="panel-kicker">Project mission</p>
          <h2>Make global trade data easier to inspect, explain, and reuse.</h2>
          <p>
            Trade8 combines a medallion ETL pipeline with a focused analytics interface.
            The project supports SDG 8 by making economic activity and market concentration
            visible through reproducible public data.
          </p>
        </div>
      </article>

      <article className="dashboard-panel stack-panel">
        <PanelHeader kicker="System profile" title="Technology stack" />
        <div className="stack-list">
          {[
            ['Frontend', 'React, Vite, Recharts, Simple Maps'],
            ['Backend', 'Python, Flask, Pandas, SQLite'],
            ['Pipeline', 'Apache Spark and Pandas'],
            ['Infrastructure', 'Docker Compose, Hadoop, Hive, Presto'],
          ].map(([label, value]) => (
            <div key={label}><span>{label}</span><strong>{value}</strong></div>
          ))}
        </div>
      </article>

      <article className="dashboard-panel resources-panel">
        <PanelHeader kicker="References" title="Open resources" />
        <div className="resource-list">
          {links.map(([label, description, url]) => (
            <a href={url} target="_blank" rel="noreferrer" key={label}>
              <span><strong>{label}</strong><small>{description}</small></span>
              <ExternalLink size={15} />
            </a>
          ))}
        </div>
      </article>
    </section>
  );
}

function EmptyState({ message }) {
  return (
    <div className="empty-state">
      <PackageOpen size={22} />
      <p>{message}</p>
    </div>
  );
}

function ErrorBanner({ message, onRetry }) {
  return (
    <div className="error-banner" role="alert">
      <Info size={17} />
      <span>{message}</span>
      <button type="button" onClick={onRetry}>Try again</button>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <span className="loading-mark"><Activity size={20} /></span>
      <p>Trade8</p>
      <small>Preparing global trade intelligence</small>
      <span className="loading-line"><span /></span>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [tradeByYear, setTradeByYear] = useState({ years: [], exports: [], imports: [] });
  const [topCountries, setTopCountries] = useState({ exports: [], imports: [] });
  const [topCommodities, setTopCommodities] = useState([]);
  const [tradeByCategory, setTradeByCategory] = useState([]);
  const [allCountriesTrade, setAllCountriesTrade] = useState({});
  const [growthMetrics, setGrowthMetrics] = useState({ export_growth_pct: null, import_growth_pct: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async ({ initial = false } = {}) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const endpoints = [
        'trade-by-year',
        'top-countries',
        'top-commodities',
        'trade-by-category',
        'all-countries-trade',
        'growth-metrics',
      ];
      const responses = await Promise.all(endpoints.map((endpoint) => fetch(`${API_URL}/${endpoint}`)));
      const failed = responses.find((response) => !response.ok);
      if (failed) throw new Error(`${failed.status} ${failed.statusText}`);
      const [year, countries, commodities, categories, countriesTrade, growth] =
        await Promise.all(responses.map((response) => response.json()));
      setTradeByYear(year);
      setTopCountries(countries);
      setTopCommodities(commodities);
      setTradeByCategory(categories);
      setAllCountriesTrade(countriesTrade);
      setGrowthMetrics(growth);
    } catch (requestError) {
      setError(`The analytics API is unavailable at ${API_URL}. ${requestError.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData({ initial: true });
  }, [fetchData]);

  const yearChartData = useMemo(
    () => tradeByYear.years.map((year, index) => ({
      name: year,
      Export: (tradeByYear.exports[index] || 0) / 1e9,
      Import: (tradeByYear.imports[index] || 0) / 1e9,
    })),
    [tradeByYear],
  );

  const categoryData = useMemo(
    () => tradeByCategory.map((item) => ({
      name: item.category,
      value: item.total_trade / 1e9,
    })),
    [tradeByCategory],
  );

  const totalExport = tradeByYear.exports.reduce((sum, value) => sum + value, 0);
  const totalImport = tradeByYear.imports.reduce((sum, value) => sum + value, 0);
  const metrics = {
    totalExport,
    totalImport,
    exportGrowth: growthMetrics.export_growth_pct,
    importGrowth: growthMetrics.import_growth_pct,
    topExporter: topCountries.exports[0]?.country_or_area || '—',
    categoryCount: tradeByCategory.length,
  };

  const exportSummary = () => {
    const rows = [
      ['metric', 'value'],
      ['cumulative_exports_usd', totalExport],
      ['cumulative_imports_usd', totalImport],
      ['export_growth_pct', growthMetrics.export_growth_pct ?? ''],
      ['import_growth_pct', growthMetrics.import_growth_pct ?? ''],
      ['leading_exporter', metrics.topExporter],
      ...topCountries.exports.slice(0, 5).map((country, index) => [
        `top_exporter_${index + 1}_${country.country_or_area}`,
        country.total_export,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'trade8-dashboard-summary.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="app-shell">
      <AppHeader
        activeTab={activeTab}
        onNavigate={setActiveTab}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        refreshing={refreshing}
        onRefresh={() => fetchData()}
        onExport={exportSummary}
      />

      <main className="dashboard-main">
        <PageIntro activeTab={activeTab} />
        {error && <ErrorBanner message={error} onRetry={() => fetchData()} />}

        {activeTab === 'overview' && (
          <OverviewTab
            yearChartData={yearChartData}
            categoryData={categoryData}
            topCountries={topCountries}
            metrics={metrics}
          />
        )}
        {activeTab === 'geopolitics' && <TradeMapTab allCountriesTrade={allCountriesTrade} />}
        {activeTab === 'commodities' && <CommoditiesTab topCommodities={topCommodities} />}
        {activeTab === 'datasources' && <DataPipelineTab />}
        {activeTab === 'about' && <AboutTab />}
      </main>

      <footer className="app-footer">
        <span>Trade8 · SDG 8 Global Trade Analytics</span>
        <span>UN Comtrade · Read-only public data</span>
      </footer>
    </div>
  );
}

export default App;
