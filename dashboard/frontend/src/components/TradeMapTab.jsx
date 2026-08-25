import { useMemo, useState } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { scaleLinear } from 'd3-scale';
import { feature } from 'topojson-client';
import worldAtlas from 'world-atlas/countries-110m.json';
import { Globe2, Minus, PackageOpen, Plus, RotateCcw } from 'lucide-react';

const WIDTH = 900;
const HEIGHT = 460;
const FEATURES = feature(worldAtlas, worldAtlas.objects.countries).features;

function formatCompactUsd(value) {
  const amount = Number(value) || 0;
  if (Math.abs(amount) >= 1e12) return `$${(amount / 1e12).toFixed(2)}T`;
  if (Math.abs(amount) >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function TradeMapTab({ allCountriesTrade }) {
  const [zoom, setZoom] = useState(1);
  const [tooltip, setTooltip] = useState(null);
  const values = Object.values(allCountriesTrade);
  const maxTrade = values.length ? Math.max(...values) : 1;
  const colorScale = useMemo(
    () => scaleLinear().domain([0, maxTrade * 0.18, maxTrade]).range(['#242721', '#6e7e37', '#d8ff4f']),
    [maxTrade],
  );
  const path = useMemo(() => {
    const projection = geoNaturalEarth1().fitExtent([[18, 18], [WIDTH - 18, HEIGHT - 18]], {
      type: 'FeatureCollection',
      features: FEATURES,
    });
    return geoPath(projection);
  }, []);

  const adjustZoom = (next) => setZoom(Math.min(4, Math.max(1, next)));
  const showTooltip = (event, name, value) => {
    const bounds = event.currentTarget.ownerSVGElement.getBoundingClientRect();
    setTooltip({
      name,
      value,
      x: event.clientX - bounds.left + 12,
      y: event.clientY - bounds.top + 12,
    });
  };

  return (
    <section className="single-panel-layout">
      <article className="dashboard-panel map-panel">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">Geographic distribution</p>
            <h2>Cumulative export intensity</h2>
          </div>
          <span className="panel-chip"><Globe2 size={12} /> Local vector atlas</span>
        </div>
        <div className="map-stage">
          {Object.keys(allCountriesTrade).length ? (
            <>
              <div className="map-controls" aria-label="Map zoom controls">
                <button type="button" onClick={() => adjustZoom(zoom + 0.35)} aria-label="Zoom in"><Plus size={15} /></button>
                <button type="button" onClick={() => adjustZoom(zoom - 0.35)} aria-label="Zoom out"><Minus size={15} /></button>
                <button type="button" onClick={() => setZoom(1)} aria-label="Reset zoom"><RotateCcw size={14} /></button>
              </div>
              <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                role="img"
                aria-label="World map showing cumulative exports by economy"
                onWheel={(event) => adjustZoom(zoom + (event.deltaY < 0 ? 0.2 : -0.2))}
              >
                <g transform={`translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${zoom}) translate(${-WIDTH / 2} ${-HEIGHT / 2})`}>
                  {FEATURES.map((country, index) => {
                    const name = country.properties.name;
                    const value = allCountriesTrade[name];
                    return (
                      <path
                        key={`${country.id || 'country'}-${name}-${index}`}
                        d={path(country)}
                        fill={value ? colorScale(value) : '#20231e'}
                        stroke="#11130f"
                        strokeWidth={0.6 / zoom}
                        tabIndex="0"
                        aria-label={`${name}: ${value ? formatCompactUsd(value) : 'No data'}`}
                        onPointerEnter={(event) => showTooltip(event, name, value)}
                        onPointerMove={(event) => showTooltip(event, name, value)}
                        onPointerLeave={() => setTooltip(null)}
                        onFocus={() => setTooltip({ name, value, x: 24, y: 24 })}
                        onBlur={() => setTooltip(null)}
                      />
                    );
                  })}
                </g>
              </svg>
              {tooltip && (
                <div className="map-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
                  <strong>{tooltip.name}</strong>
                  <span>{tooltip.value ? formatCompactUsd(tooltip.value) : 'No data'}</span>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state"><PackageOpen size={22} /><p>Map data is not available.</p></div>
          )}
        </div>
        <div className="map-legend">
          <span>Lower value</span><span className="gradient-scale" /><span>Higher value</span>
        </div>
      </article>
    </section>
  );
}

export default TradeMapTab;
