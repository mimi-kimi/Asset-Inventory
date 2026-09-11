"use client";

import { useEffect, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { MarkerState } from "@/lib/marker";
import { MARKER_META } from "@/lib/marker";

export interface MapPoint {
  id: string;
  label: string; // primary label (No / code)
  sub?: string; // secondary label (ID-Inventory)
  lat: number;
  lng: number;
  state: MarkerState;
}

function pinIcon(state: MarkerState, selected: boolean) {
  const color = MARKER_META[state].color;
  const size = selected ? 20 : 15;
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:${selected ? 3 : 2}px solid white;box-shadow:0 1px 5px rgba(0,0,0,.5);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [0, -size / 2 - 8],
  });
}

export function MarkersMap({
  points,
  fitSignal,
  onSelect,
  className,
  selectedId,
  emptyHint,
}: {
  points: MapPoint[];
  /** change this value to force the map to zoom to the current points */
  fitSignal: string | number;
  onSelect?: (point: MapPoint) => void;
  className?: string;
  selectedId?: string | null;
  /** hint shown centered over the map when there are no points */
  emptyHint?: string;
}) {
  const [ready, setReady] = useState(false);
  const [map, setMap] = useState<L.Map | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
  }, []);

  // zoom to the current data whenever the fit signal changes
  useEffect(() => {
    if (!map || points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [fitSignal, map, points]);

  if (!ready) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl bg-zinc-200 text-sm text-zinc-500">
        Loading map…
      </div>
    );
  }

  const hasPoints = points.length > 0;
  const center: [number, number] = hasPoints
    ? [points[0].lat, points[0].lng]
    : [14.5995, 120.9842];
  const zoom = hasPoints ? 12 : 6;

  return (
    <div className={className ?? "relative h-full w-full overflow-hidden"}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
        ref={(m) => {
          if (m && m !== map) setMap(m);
        }}
      >
        <TileLayer
          attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        {points.map((p) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={pinIcon(p.state, p.id === selectedId)}
            eventHandlers={
              onSelect ? { click: () => onSelect(p) } : undefined
            }
          >
            <Tooltip direction="top" offset={[0, -10]}>
              <span className="font-semibold">{p.label}</span>
              {p.sub ? ` · ${p.sub}` : ""}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>

      {!hasPoints && emptyHint && (
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center p-4">
          <div className="rounded-full border border-zinc-200 bg-white/95 px-4 py-2 text-center text-sm font-semibold text-zinc-600 shadow-lg">
            🗺️ {emptyHint}
          </div>
        </div>
      )}
    </div>
  );
}

/** Small legend used above/below maps. `vertical` stacks the entries. */
export function MarkerLegend({ vertical = false }: { vertical?: boolean }) {
  const items = [
    { color: "#22c55e", label: "Working" },
    { color: "#ef4444", label: "Not working" },
    { color: "#3b82f6", label: "Not inspected" },
  ];
  const Item = ({ color, label }: { color: string; label: string }) => (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-3 w-3 shrink-0 rounded-full border-2 border-white shadow"
        style={{ background: color }}
      />
      {label}
    </span>
  );

  if (vertical) {
    return (
      <div className="flex flex-col items-start gap-1.5 text-xs text-zinc-600">
        {items.map((i) => (
          <Item key={i.label} {...i} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
      {items.map((i) => (
        <Item key={i.label} {...i} />
      ))}
    </div>
  );
}
