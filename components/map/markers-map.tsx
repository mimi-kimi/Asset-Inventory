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
}: {
  points: MapPoint[];
  /** change this value to force the map to zoom to the current points */
  fitSignal: string | number;
  onSelect?: (point: MapPoint) => void;
  className?: string;
  selectedId?: string | null;
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

  if (points.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl bg-zinc-200 text-sm text-zinc-500">
        🗺️ No markers for the selected task.
      </div>
    );
  }

  const center: [number, number] = [points[0].lat, points[0].lng];

  return (
    <div className={className ?? "h-full w-full overflow-hidden rounded-xl"}>
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
        ref={(m) => {
          if (m && m !== map) setMap(m);
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
    </div>
  );
}

/** Small legend row used above/below maps. */
export function MarkerLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full border-2 border-white bg-blue-500 shadow" /> Not inspected
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full border-2 border-white bg-green-500 shadow" /> Working
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full border-2 border-white bg-red-500 shadow" /> Not working
      </span>
    </div>
  );
}
