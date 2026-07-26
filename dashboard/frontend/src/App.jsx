import React, { useState, useEffect, useCallback } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, Cell, LabelList, PieChart, Pie, Sector
} from 'recharts';
import { Chart } from "react-google-charts";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { Tooltip as ReactTooltip } from "react-tooltip";
import 'react-tooltip/dist/react-tooltip.css';
import {
  Activity, Globe, Box, TrendingUp, DollarSign,
  LayoutDashboard, Database, Settings, ArrowUpRight, ArrowDownRight,
  AlertCircle, RefreshCw, Package, FileText, ExternalLink, Info,
  HardDrive, Calendar, Hash, Layers
} from 'lucide-react';
import './index.css';

const isProd = import.meta.env.PROD;
const API_URL = import.meta.env.VITE_API_URL || (isProd ? '/api' : 'http://localhost:5000/api');

const CHART_COLORS = [
  '#00f0ff', /* Electric Cyan */
  '#b026ff', /* Neon Violet */
  '#00ff9d', /* Cyber Green */
  '#ff0055', /* Hot Pink */
  '#facc15', /* Cyber Yellow */
  '#3b82f6', /* Blue 500 */
  '#d946ef', /* Fuchsia */
  '#0ea5e9'  /* Sky */
];

// --- Sidebar ---
const Sidebar = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'overview',     icon: LayoutDashboard, label: 'Overview' },
    { id: 'geopolitics',  icon: Globe,            label: 'Geopolitics' },
    { id: 'commodities',  icon: Package,          label: 'Commodities' },
  ];
  const bottomItems = [
    { id: 'datasources',  icon: Database,         label: 'Data Sources' },
    { id: 'settings',     icon: Settings,         label: 'Settings' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">
          <Activity size={20} className="text-indigo" />
        </div>
        <span className="brand-text">UN Trade Data</span>
      </div>
      <nav className="sidebar-nav">
        {navItems.map(({ id, icon: Icon, label }) => (
          <a
            key={id}
            href="#"
            onClick={(e) => { e.preventDefault(); setActiveTab(id); }}
            className={`nav-item ${activeTab === id ? 'active' : ''}`}
          >
            <Icon size={18} />
            {label}
          </a>
        ))}
        <div className="nav-divider"></div>
        {bottomItems.map(({ id, icon: Icon, label }) => (
          <a
            key={id}
            href="#"
            onClick={(e) => { e.preventDefault(); setActiveTab(id); }}
            className={`nav-item ${activeTab === id ? 'active' : ''}`}
          >
            <Icon size={18} />
            {label}
          </a>
        ))}
      </nav>
      <div className="sidebar-user">
        <div className="avatar">SD</div>
        <div className="user-info">
          <span className="user-name">SDG 8 Analyst</span>
          <span className="user-role">Enterprise Plan</span>
        </div>
      </div>
    </aside>
  );
};

// --- Stat Card ---
const StatCard = ({ title, value, icon: Icon, trendValue, description }) => {
  const pct = parseFloat(trendValue);
  const isPositive = !isNaN(pct) ? pct >= 0 : true;
  const displayTrend = !isNaN(pct)
    ? `${pct > 0 ? '+' : ''}${pct}%`
    : trendValue;

  return (
    <div className="stat-card">
      <div className="stat-header">
        <h3 className="stat-title">{title}</h3>
        <Icon size={16} className="stat-icon" />
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-footer">
        <span className={`stat-trend ${isPositive ? 'trend-up' : 'trend-down'}`}>
          {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {displayTrend}
        </span>
        <span className="stat-desc">{description}</span>
      </div>
    </div>
  );
};

// --- Custom Tooltip ---
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="tooltip-label">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="tooltip-entry">
            <span className="tooltip-indicator" style={{ backgroundColor: entry.color }} />
            <span className="tooltip-name">{entry.name}:</span>
            <span className="tooltip-value">${Number(entry.value).toFixed(2)}B</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// --- Error Banner ---
const ErrorBanner = ({ message, onRetry }) => (
  <div className="error-banner">
    <AlertCircle size={18} />
    <span>{message}</span>
    <button onClick={onRetry} className="retry-btn">
      <RefreshCw size={14} /> Retry
    </button>
  </div>
);

// --- Overview Tab ---
const OverviewTab = ({ yearChartData, pieData }) => {
  // Explode all slices to create the requested "separated" 3D look
  // and completely eliminate z-fighting (collision) between thin slices
  const explosionOffsets = {};
  for (let i = 0; i < 15; i++) {
    explosionOffsets[i] = { offset: 0.05 };
  }

  // Option configurations for 3D Pie Chart
  const pieOptions = {
    is3D: true,
    backgroundColor: 'transparent',
    legend: { position: 'right', textStyle: { color: '#a1a1aa', fontSize: 12 } },
    chartArea: { width: '85%', height: '90%' },
    pieSliceBorderColor: 'none', // Remove border to make 3D effect smoother
    colors: CHART_COLORS,
    tooltip: { showColorCode: true },
    slices: explosionOffsets
  };

  return (
    <div className="charts-grid">
      <div className="chart-panel wide-panel">
        <div className="panel-header">
          <h2>Trade Value Over Time (Billion USD)</h2>
          <span className="badge">1990 – Present</span>
        </div>
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={yearChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorExport" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorImport" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} dy={10} />
              <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#a1a1aa', marginTop: '10px' }} />
              <Area type="monotone" dataKey="Export" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorExport)" />
              <Area type="monotone" dataKey="Import" stroke="#14b8a6" strokeWidth={2} fillOpacity={1} fill="url(#colorImport)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-panel wide-panel">
        <div className="panel-header">
          <h2>Volume Distribution by Category (3D)</h2>
          <span className="badge">Interactive Doughnut</span>
        </div>
        <div className="chart-wrapper" style={{ height: '420px' }}>
          {pieData.length > 1 ? (
            <Chart
              chartType="PieChart"
              data={pieData}
              options={pieOptions}
              width="100%"
              height="100%"
            />
          ) : (
            <p className="empty-chart">Category data not available.</p>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Geopolitics Tab ---
const GeopoliticsTab = ({ allCountriesTrade }) => {
  const geoUrl = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";
  
  const values = Object.values(allCountriesTrade);
  const maxTrade = values.length > 0 ? Math.max(...values) : 1;
  const colorScale = scaleLinear()
    .domain([0, maxTrade])
    .range(["#e0e7ff", "#1e1b4b"]);

  return (
    <div className="charts-grid">
      <div className="chart-panel wide-panel" style={{ position: "relative" }}>
        <div className="panel-header">
          <h2>Global Export Map</h2>
          <span className="badge">Zoomable Heatmap</span>
        </div>
        <div className="chart-wrapper" style={{ height: '600px', overflow: 'hidden', cursor: 'grab', backgroundColor: '#09090b', borderRadius: '8px' }}>
          {Object.keys(allCountriesTrade).length > 0 ? (
            <ComposableMap
              projectionConfig={{ scale: 140 }}
              width={800}
              height={400}
              style={{ width: "100%", height: "100%" }}
            >
              <ZoomableGroup 
                zoom={1} 
                minZoom={1} 
                maxZoom={8} 
                translateExtent={[[0, 0], [800, 400]]}
              >
                <Geographies geography={geoUrl}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const countryName = geo.properties.name;
                      const tradeValue = allCountriesTrade[countryName];
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          data-tooltip-id="map-tooltip"
                          data-tooltip-content={tradeValue ? `${countryName}: $${(tradeValue / 1e9).toFixed(2)} Billion` : `${countryName}: No Data`}
                          style={{
                            default: {
                              fill: tradeValue ? colorScale(tradeValue) : "#27272a",
                              outline: "none",
                              stroke: "#18181b",
                              strokeWidth: 0.5,
                            },
                            hover: {
                              fill: "#6366f1",
                              outline: "none",
                              cursor: "pointer",
                            },
                            pressed: {
                              fill: "#4f46e5",
                              outline: "none",
                            },
                          }}
                        />
                      );
                    })
                  }
                </Geographies>
              </ZoomableGroup>
            </ComposableMap>
          ) : (
            <p className="empty-chart">Loading map data...</p>
          )}
          <ReactTooltip id="map-tooltip" place="top" style={{ backgroundColor: '#18181b', color: '#fafafa', border: '1px solid #27272a', zIndex: 100 }} />
        </div>
      </div>
    </div>
  );
};

// --- Commodities Tab ---
const CommoditiesTab = ({ topCommodities }) => {
  const chartData = topCommodities.map(item => ({
    name: item.commodity.length > 28 ? item.commodity.substring(0, 28) + '…' : item.commodity,
    fullName: item.commodity,
    value: item.total_trade / 1e9,
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', padding: '12px', borderRadius: '8px', maxWidth: '350px', zIndex: 1000, position: 'relative' }}>
          <p style={{ color: '#fafafa', margin: '0 0 8px 0', fontSize: '13px', lineHeight: '1.4', fontWeight: '500' }}>{data.fullName}</p>
          <p style={{ color: '#a1a1aa', margin: 0, fontSize: '12px' }}>
            Total Trade: <strong style={{ color: '#818cf8', fontSize: '13px' }}>${data.value.toFixed(2)} Billion</strong>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="charts-grid">
      <div className="chart-panel wide-panel">
        <div className="panel-header">
          <h2>Top 10 Commodities by Trade Value</h2>
          <span className="badge">Billion USD</span>
        </div>
        <div className="chart-wrapper" style={{ height: '420px' }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 40, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} vertical={true} />
                <XAxis type="number" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `$${v.toFixed(0)}B`} />
                <YAxis dataKey="name" type="category" stroke="#a1a1aa" fontSize={11} width={220}
                  tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: '#27272a' }}
                  content={<CustomTooltip />}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={22}>
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                  <LabelList dataKey="value" position="right" formatter={(v) => `$${v.toFixed(1)}B`} fill="#a1a1aa" fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="empty-chart">Commodity data not available.</p>
          )}
        </div>
      </div>

      <div className="chart-panel wide-panel">
        <div className="panel-header">
          <h2>Commodity Detail Table</h2>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Commodity</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Total Value (USD)</th>
              </tr>
            </thead>
            <tbody>
              {topCommodities.map((item, index) => (
                <tr key={index}>
                  <td className="rank-cell">#{index + 1}</td>
                  <td>{item.commodity}</td>
                  <td><span className="category-badge">{item.category}</span></td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    ${(item.total_trade / 1e9).toFixed(2)}B
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// --- Data Sources Tab ---
const DataSourcesTab = () => (
  <div className="charts-grid">
    <div className="chart-panel wide-panel">
      <div className="panel-header">
        <h2>Dataset Information</h2>
        <span className="badge">UN Comtrade</span>
      </div>
      <div className="info-grid">
        <div className="info-card">
          <div className="info-icon-wrap"><HardDrive size={20} /></div>
          <div>
            <p className="info-label">Dataset Size</p>
            <p className="info-value">~1.2 GB</p>
          </div>
        </div>
        <div className="info-card">
          <div className="info-icon-wrap"><Hash size={20} /></div>
          <div>
            <p className="info-label">Total Records</p>
            <p className="info-value">~8.2 Million rows</p>
          </div>
        </div>
        <div className="info-card">
          <div className="info-icon-wrap"><Calendar size={20} /></div>
          <div>
            <p className="info-label">Time Coverage</p>
            <p className="info-value">1988 – 2016</p>
          </div>
        </div>
        <div className="info-card">
          <div className="info-icon-wrap"><Layers size={20} /></div>
          <div>
            <p className="info-label">Pipeline Architecture</p>
            <p className="info-value">Medallion (Bronze → Silver → Gold)</p>
          </div>
        </div>
      </div>
    </div>

    <div className="chart-panel wide-panel">
      <div className="panel-header">
        <h2>Data Pipeline</h2>
      </div>
      <div className="pipeline-steps">
        <div className="pipeline-step">
          <div className="step-badge bronze">Bronze</div>
          <div className="step-content">
            <p className="step-title">Raw Ingestion</p>
            <p className="step-desc">Raw CSV data ingested from UN Comtrade. No transformations applied. Full fidelity preserved.</p>
          </div>
        </div>
        <div className="pipeline-arrow">↓</div>
        <div className="pipeline-step">
          <div className="step-badge silver">Silver</div>
          <div className="step-content">
            <p className="step-title">Cleaning & Standardization</p>
            <p className="step-desc">Filter exports only. Drop rows with null <code>trade_usd</code> or <code>weight_kg</code>. Standardize country names with <code>str.title()</code>.</p>
          </div>
        </div>
        <div className="pipeline-arrow">↓</div>
        <div className="pipeline-step">
          <div className="step-badge gold">Gold</div>
          <div className="step-content">
            <p className="step-title">Aggregated Analytics</p>
            <p className="step-desc">Group by year, country, and commodity. Aggregate total export value (USD) and volume (KG). Stored in SQLite for fast API access.</p>
          </div>
        </div>
      </div>
    </div>

    <div className="chart-panel wide-panel">
      <div className="panel-header">
        <h2>Schema Reference</h2>
      </div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Column</th>
              <th>Type</th>
              <th>Description</th>
              <th>Layer</th>
            </tr>
          </thead>
          <tbody>
            {[
              { col: 'country_or_area', type: 'string', desc: 'Reporting country or customs area', layer: 'Bronze' },
              { col: 'year', type: 'integer', desc: 'Reference year of the transaction', layer: 'Bronze' },
              { col: 'commodity', type: 'string', desc: 'Commodity description (HS code based)', layer: 'Bronze' },
              { col: 'flow', type: 'string', desc: 'Trade flow: Export or Import', layer: 'Bronze' },
              { col: 'trade_usd', type: 'float', desc: 'Trade value in current US Dollars', layer: 'Silver' },
              { col: 'weight_kg', type: 'float', desc: 'Net weight of traded goods in kg', layer: 'Silver' },
              { col: 'category', type: 'string', desc: 'Commodity grouping category', layer: 'Silver' },
              { col: 'total_nilai_ekspor_usd', type: 'float', desc: 'Aggregated export value per group', layer: 'Gold' },
              { col: 'total_volume_kg', type: 'float', desc: 'Aggregated weight per group', layer: 'Gold' },
            ].map((row, i) => (
              <tr key={i}>
                <td><code style={{ color: '#a5b4fc', fontSize: '12px' }}>{row.col}</code></td>
                <td><span className="category-badge">{row.type}</span></td>
                <td style={{ color: '#a1a1aa', fontSize: '13px' }}>{row.desc}</td>
                <td>
                  <span className={`step-badge ${row.layer.toLowerCase()}`} style={{ fontSize: '11px', padding: '2px 8px' }}>
                    {row.layer}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    <div className="chart-panel wide-panel">
      <div className="panel-header">
        <h2>External Links</h2>
      </div>
      <div className="links-grid">
        {[
          { label: 'UN Comtrade Database', url: 'https://comtrade.un.org/', desc: 'Official UN trade statistics portal' },
          { label: 'Kaggle Dataset', url: 'https://www.kaggle.com/datasets/unitednations/global-commodity-trade-statistics', desc: 'Download the raw CSV dataset' },
          { label: 'SDG Goal 8', url: 'https://sdgs.un.org/goals/goal8', desc: 'Decent Work and Economic Growth — UN SDG' },
          { label: 'GitHub Repository', url: 'https://github.com/LaboNapitupulu/sdg8-global-trade-pipeline', desc: 'Project source code on GitHub' },
        ].map((link, i) => (
          <a key={i} href={link.url} target="_blank" rel="noreferrer" className="link-card">
            <div>
              <p className="link-title">{link.label}</p>
              <p className="link-desc">{link.desc}</p>
            </div>
            <ExternalLink size={16} className="link-icon" />
          </a>
        ))}
      </div>
    </div>
  </div>
);

// --- Settings Tab ---
const SettingsTab = () => (
  <div className="charts-grid">
    <div className="chart-panel wide-panel">
      <div className="panel-header">
        <h2>API Configuration</h2>
        <span className="badge">Read-only</span>
      </div>
      <div className="settings-section">
        <div className="setting-row">
          <div>
            <p className="setting-label">Backend API URL</p>
            <p className="setting-hint">Configured via <code>VITE_API_URL</code> environment variable</p>
          </div>
          <code className="setting-value">{API_URL}</code>
        </div>
        <div className="setting-row">
          <div>
            <p className="setting-label">Data Refresh</p>
            <p className="setting-hint">Data is fetched on page load. Use the Refresh button to re-fetch.</p>
          </div>
          <span className="setting-value">On demand</span>
        </div>
        <div className="setting-row">
          <div>
            <p className="setting-label">Cache Duration</p>
            <p className="setting-hint">API responses are cached in the browser for 5 minutes.</p>
          </div>
          <span className="setting-value">300 seconds</span>
        </div>
      </div>
    </div>

    <div className="chart-panel wide-panel">
      <div className="panel-header">
        <h2>Project Information</h2>
      </div>
      <div className="settings-section">
        {[
          { label: 'Project Name', value: 'SDG 8 Global Trade Pipeline' },
          { label: 'Course', value: 'Big Data Engineering' },
          { label: 'Dataset', value: 'UN Comtrade — Global Commodity Trade Statistics' },
          { label: 'Frontend Stack', value: 'React 18 + Vite + Recharts + Google Charts' },
          { label: 'Backend Stack', value: 'Python 3 + Flask + SQLite + Pandas' },
          { label: 'Pipeline Engine', value: 'Apache Spark (Hadoop + Hive) / Pandas' },
          { label: 'Architecture', value: 'Medallion (Bronze → Silver → Gold)' },
          { label: 'Containerization', value: 'Docker Compose (Hadoop, Spark, Hive, Presto)' },
        ].map((item, i) => (
          <div key={i} className="setting-row">
            <p className="setting-label">{item.label}</p>
            <span className="setting-value">{item.value}</span>
          </div>
        ))}
      </div>
    </div>

    <div className="chart-panel wide-panel">
      <div className="panel-header">
        <h2>About</h2>
      </div>
      <div className="about-block">
        <Info size={16} style={{ flexShrink: 0, color: '#6366f1', marginTop: 2 }} />
        <p>
          This dashboard visualizes global commodity trade data sourced from the UN Comtrade database,
          processed through a <strong>Medallion Architecture</strong> ETL pipeline. The pipeline compares
          performance between <strong>Apache Spark</strong> (distributed) and <strong>Pandas</strong> (single-node)
          execution engines, with results stored in a SQLite database for low-latency API access.
          Built as part of the SDG 8 initiative — Decent Work and Economic Growth.
        </p>
      </div>
    </div>
  </div>
);

// --- Main App ---
function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [tradeByYear, setTradeByYear]       = useState({ years: [], exports: [], imports: [] });
  const [topCountries, setTopCountries]     = useState({ exports: [], imports: [] });
  const [topCommodities, setTopCommodities] = useState([]);
  const [tradeByCategory, setTradeByCategory] = useState([]);
  const [allCountriesTrade, setAllCountriesTrade] = useState({});
  const [growthMetrics, setGrowthMetrics]   = useState({ export_growth_pct: null, import_growth_pct: null });
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [yearRes, countriesRes, commRes, catRes, allRes, growthRes] = await Promise.all([
        fetch(`${API_URL}/trade-by-year`),
        fetch(`${API_URL}/top-countries`),
        fetch(`${API_URL}/top-commodities`),
        fetch(`${API_URL}/trade-by-category`),
        fetch(`${API_URL}/all-countries-trade`),
        fetch(`${API_URL}/growth-metrics`),
      ]);

      const responses = [yearRes, countriesRes, commRes, catRes, allRes, growthRes];
      const failed = responses.find(r => !r.ok);
      if (failed) throw new Error(`API error: ${failed.status} ${failed.statusText}`);

      setTradeByYear(await yearRes.json());
      setTopCountries(await countriesRes.json());
      setTopCommodities(await commRes.json());
      setTradeByCategory(await catRes.json());
      setAllCountriesTrade(await allRes.json());
      setGrowthMetrics(await growthRes.json());
    } catch (err) {
      setError(`Failed to connect to API. Make sure the Python backend is running at ${API_URL.replace('/api', '')}. (${err.message})`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const yearChartData = tradeByYear.years.map((year, i) => ({
    name: year,
    Export: tradeByYear.exports[i] / 1e9,
    Import: tradeByYear.imports[i] / 1e9,
  }));

  const geoData = [
    ["Country", "Export Value (Billion USD)"],
    ...Object.entries(allCountriesTrade).map(([country, val]) => [country, val / 1e9])
  ];

  const pieData = [
    ["Category", "Trade Value"],
    ...tradeByCategory.map(item => [item.category, item.total_trade / 1e9])
  ];

  const totalExport  = tradeByYear.exports.reduce((a, b) => a + b, 0) / 1e12;
  const totalImport  = tradeByYear.imports.reduce((a, b) => a + b, 0) / 1e12;
  const topExporter  = topCountries.exports.length > 0 ? topCountries.exports[0].country_or_area : '-';

  const pageTitles = {
    overview:    'Global Trade Overview',
    geopolitics: 'Geopolitical Trade Map',
    commodities: 'Commodities Analysis',
    datasources: 'Data Sources',
    settings:    'Settings',
  };

  const analyticsTab = ['overview', 'geopolitics', 'commodities'].includes(activeTab);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p className="loading-text">Loading Analytics Workspace...</p>
        <p className="loading-subtext">Connecting to {API_URL}</p>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="page-title">{pageTitles[activeTab]}</h1>
            <p className="page-subtitle">SDG 8: Decent Work and Economic Growth</p>
          </div>
          <div className="topbar-right">
            {analyticsTab && (
              <button className="btn-secondary" onClick={fetchData}>
                <RefreshCw size={14} style={{ marginRight: '6px' }} />
                Refresh Data
              </button>
            )}
            <button className="btn-primary">
              <FileText size={14} style={{ marginRight: '6px' }} />
              Download Report
            </button>
          </div>
        </header>

        <div className="dashboard-content">
          {error && analyticsTab && (
            <ErrorBanner message={error} onRetry={fetchData} />
          )}

          {analyticsTab && (
            <div className="stats-grid">
              <StatCard
                title="Total Global Exports"
                value={`$${totalExport.toFixed(2)}T`}
                icon={TrendingUp}
                trendValue={growthMetrics.export_growth_pct}
                description="Growth: 2000s → 2010s"
              />
              <StatCard
                title="Total Global Imports"
                value={`$${totalImport.toFixed(2)}T`}
                icon={DollarSign}
                trendValue={growthMetrics.import_growth_pct}
                description="Growth: 2000s → 2010s"
              />
              <StatCard
                title="Largest Exporter"
                value={topExporter}
                icon={Globe}
                trendValue="Rank #1"
                description="Cumulative historical total"
              />
              <StatCard
                title="Commodity Categories"
                value="97"
                icon={Box}
                trendValue="100"
                description="Actively tracked"
              />
            </div>
          )}

          {activeTab === 'overview'    && <OverviewTab yearChartData={yearChartData} pieData={pieData} />}
          {activeTab === 'geopolitics' && <GeopoliticsTab allCountriesTrade={allCountriesTrade} />}
          {activeTab === 'commodities' && <CommoditiesTab topCommodities={topCommodities} />}
          {activeTab === 'datasources' && <DataSourcesTab />}
          {activeTab === 'settings'    && <SettingsTab />}
        </div>
      </main>
    </div>
  );
}

export default App;
