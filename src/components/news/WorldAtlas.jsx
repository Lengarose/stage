import { useMemo } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import worldAtlas from "world-atlas/countries-110m.json";
import { continentIdFromIso, getCountryName, isoNumericToAlpha2 } from "@/lib/allCountries";

const INK = "#110c08";
const LIVE = "#c4a24a";
const MUTED = "#d7c27a";
const FADE = "#e8dba8";
const SELECTED = "#c70f2b";

const CONTINENT_VIEW = {
  europe: { center: [10, 52], zoom: 4 },
  africa: { center: [20, 5], zoom: 3.2 },
  asia: { center: [95, 28], zoom: 2.4 },
  north_america: { center: [-90, 40], zoom: 2.8 },
  south_america: { center: [-60, -18], zoom: 3 },
  oceania: { center: [150, -22], zoom: 3.2 },
  middle_east: { center: [45, 26], zoom: 4.2 },
};

const WORLD_VIEW = { center: [12, 12], zoom: 1 };

function geoCountryCode(geo) {
  return isoNumericToAlpha2(geo?.id);
}

export default function WorldAtlas({
  continents = [],
  countries = [],
  selectedContinent = "",
  selectedCountry = "",
  onSelectContinent,
  onSelectCountry,
}) {
  const counts = useMemo(
    () => Object.fromEntries((countries || []).map((row) => [String(row.code || "").toUpperCase(), Number(row.count) || 0])),
    [countries],
  );
  const continentByCode = useMemo(() => {
    const map = Object.create(null);
    for (const row of countries || []) {
      if (row.code && row.continent) map[String(row.code).toUpperCase()] = row.continent;
    }
    return map;
  }, [countries]);
  const view = CONTINENT_VIEW[selectedContinent] || WORLD_VIEW;

  return (
    <div className="world-atlas">
      <div className="world-atlas-map" aria-label="World map">
        <ComposableMap
          projection="geoEqualEarth"
          projectionConfig={{ scale: 155 }}
          width={800}
          height={420}
        >
          <ZoomableGroup center={view.center} zoom={view.zoom} minZoom={1} maxZoom={8}>
            <Geographies geography={worldAtlas}>
              {({ geographies }) => geographies.map((geo) => {
                const code = geoCountryCode(geo);
                if (!code) return null;
                const continent = continentByCode[code] || continentIdFromIso(code);
                const selected = selectedCountry === code;
                const inContinent = !selectedContinent || continent === selectedContinent;
                const live = Number(counts[code]) > 0;
                const fill = selected
                  ? SELECTED
                  : !inContinent
                    ? FADE
                    : live
                      ? LIVE
                      : MUTED;
                const name = geo.properties?.name || getCountryName(code);
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    tabIndex={0}
                    role="button"
                    aria-label={name}
                    aria-pressed={selected}
                    onClick={() => onSelectCountry?.(code)}
                    title={`${name} · ${counts[code] || 0} ${(counts[code] || 0) === 1 ? "story" : "stories"}`}
                    style={{
                      default: { fill, stroke: INK, strokeWidth: 0.6, outline: "none", cursor: "pointer" },
                      hover: { fill: SELECTED, stroke: INK, strokeWidth: 0.8, outline: "none", cursor: "pointer" },
                      pressed: { fill: SELECTED, stroke: INK, strokeWidth: 0.8, outline: "none", cursor: "pointer" },
                    }}
                  />
                );
              })}
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      </div>
      <div className="world-atlas-legend">
        {continents.map((row) => (
          <button
            key={row.id}
            type="button"
            className={`world-atlas-chip${row.id === selectedContinent ? " is-active" : ""}`}
            onClick={() => onSelectContinent?.(row.id)}
          >
            <span>{row.name}</span>
            <em>{row.kicker}</em>
            <strong>{row.count}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}
