import { useEffect, useRef, useState, ReactNode } from "react";
import maplibregl, { Map as MlMap, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./EntityMap.css";

export type EntityKind = "aircraft" | "ship" | "balloon" | "station" | "beacon" | "generic";

export interface MapEntity {
  id: string;
  lat: number;
  lon: number;
  kind?: EntityKind;
  label?: string;
  heading?: number;
  trail?: Array<{ lat: number; lon: number }>;
}

interface EntityMapProps {
  entities: MapEntity[];
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  detail?: ReactNode;
  accentColor?: string;
  emptyLabel?: string;
  style?: React.CSSProperties;
}

const KIND_COLOURS: Record<EntityKind, string> = {
  aircraft: "#0DB88A",
  ship:     "#0A7ABE",
  balloon:  "#50B8E8",
  station:  "#E86020",
  beacon:   "#D02820",
  generic:  "#007AFF",
};

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

/** Generalised map component for plotting aircraft, ships, balloons, stations, etc. */
export function EntityMap({
  entities,
  selected,
  onSelect,
  detail,
  accentColor,
  emptyLabel = "No entities",
  style,
}: EntityMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const readyRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [0, 30],
      zoom: 2,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    map.on("load", () => {
      // Entity points source
      map.addSource("entities", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      // Trail lines source
      map.addSource("trails", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "trail-lines",
        type: "line",
        source: "trails",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 1.5,
          "line-opacity": 0.4,
          "line-dasharray": [4, 2],
        },
      });

      map.addLayer({
        id: "entity-circles",
        type: "circle",
        source: "entities",
        paint: {
          "circle-radius": ["case", ["==", ["get", "selected"], true], 8, 5],
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": ["case", ["==", ["get", "selected"], true], 2.5, 1.5],
          "circle-opacity": 0.92,
        },
      });

      map.addLayer({
        id: "entity-labels",
        type: "symbol",
        source: "entities",
        layout: {
          "text-field": ["get", "label"],
          "text-size": 10,
          "text-offset": [0, 1.2],
          "text-anchor": "top",
          "text-optional": true,
        },
        paint: {
          "text-color": "#1a1a1a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        },
      });

      // Click to select
      map.on("click", "entity-circles", (e) => {
        const feat = e.features?.[0];
        if (feat && onSelect) {
          onSelect(String(feat.properties?.["id"] ?? ""));
        }
        e.preventDefault();
      });

      map.on("click", (e) => {
        const feats = map.queryRenderedFeatures(e.point, { layers: ["entity-circles"] });
        if (!feats.length && onSelect) onSelect(null);
      });

      map.on("mouseenter", "entity-circles", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "entity-circles", () => { map.getCanvas().style.cursor = ""; });

      readyRef.current = true;
      setMapReady(true);
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; readyRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update data whenever entities or selection change
  useEffect(() => {
    if (!mapReady || !readyRef.current) return;
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const accent = accentColor ?? "#007AFF";

    const points: GeoJSON.Feature[] = entities.map((e) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [e.lon, e.lat] },
      properties: {
        id: e.id,
        label: e.label ?? e.id,
        color: accentColor ?? KIND_COLOURS[e.kind ?? "generic"],
        selected: selected === e.id,
      },
    }));

    const trails: GeoJSON.Feature[] = entities
      .filter((e) => e.trail && e.trail.length > 1)
      .map((e) => ({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [...(e.trail ?? []).map((p) => [p.lon, p.lat]), [e.lon, e.lat]],
        },
        properties: { id: e.id, color: accentColor ?? KIND_COLOURS[e.kind ?? "generic"] },
      }));

    (map.getSource("entities") as GeoJSONSource)?.setData({ type: "FeatureCollection", features: points });
    (map.getSource("trails") as GeoJSONSource)?.setData({ type: "FeatureCollection", features: trails });

    void accent;
  }, [entities, selected, accentColor, mapReady]);

  const count = entities.length;

  return (
    <div className="entity-map" style={style}>
      {/* Map tile area */}
      <div ref={containerRef} className="entity-map__canvas" />

      {/* Count badge */}
      {count > 0 && (
        <div className="entity-map__badge">{count}</div>
      )}

      {/* Empty state overlay */}
      {count === 0 && (
        <div className="entity-map__empty">
          <span className="entity-map__empty-icon">🗺️</span>
          <span className="entity-map__empty-label">{emptyLabel}</span>
        </div>
      )}

      {/* Detail card (selected entity) */}
      {selected && detail && (
        <div className="entity-map__detail">
          <button className="entity-map__detail-close" onClick={() => onSelect?.(null)}>✕</button>
          {detail}
        </div>
      )}
    </div>
  );
}
