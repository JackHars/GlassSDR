import { useEffect, useRef } from "react";
import maplibregl, { Map as MlMap, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { AircraftState } from "../ipc/types/AircraftState";

interface Props {
  aircraft: Map<string, AircraftState>;
  style?: React.CSSProperties;
}

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
  layers: [
    { id: "osm", type: "raster", source: "osm" },
  ],
};

export function AircraftMap({ aircraft, style }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [0, 30],
      zoom: 2,
    });
    map.on("load", () => {
      map.addSource("aircraft", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "aircraft-points",
        type: "circle",
        source: "aircraft",
        paint: {
          "circle-radius": 4,
          "circle-color": "#ff0066",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
        },
      });
      map.addLayer({
        id: "aircraft-labels",
        type: "symbol",
        source: "aircraft",
        layout: {
          "text-field": ["coalesce", ["get", "callsign"], ["get", "icao24"]],
          "text-size": 10,
          "text-offset": [0, 1.0],
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "#000000",
          "text-halo-width": 1,
        },
      });
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const featuresRef = useRef<GeoJSON.Feature[]>([]);

  useEffect(() => {
    const features: GeoJSON.Feature[] = [];
    aircraft.forEach((a) => {
      if (a.position) {
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [a.position.lon, a.position.lat] },
          properties: { icao24: a.icao24, callsign: a.callsign },
        });
      }
    });
    featuresRef.current = features;

    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource("aircraft") as GeoJSONSource | undefined;
      if (src) {
        src.setData({ type: "FeatureCollection", features: featuresRef.current });
      }
    };
    if (map.isStyleLoaded()) {
      apply();
    } else {
      // Style still loading; apply when ready
      map.once("load", apply);
    }
  }, [aircraft]);

  return <div ref={containerRef} style={{ width: "100%", height: 500, ...style }} />;
}
