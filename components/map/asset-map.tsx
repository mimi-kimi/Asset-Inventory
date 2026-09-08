"use client";

import { useEffect, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin } from "lucide-react";

export interface MapPoint {
  code: string;
  label: string;
  lat: number;
  lng: number;
}

function pinIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:9999px;background:${color};border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    tooltipAnchor: [0, -12],
  });
}

export function AssetMap({ points }: { points: MapPoint[] }) {
  // react-leaflet/leaflet is browser-only: keep a client-side "ready" flag so
  // SSR renders a placeholder instead of the map (avoids hydration mismatches).
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="flex h-80 w-full items-center justify-center rounded-lg bg-zinc-100 text-sm text-zinc-400">
        Loading map…
      </div>
    );
  }

  if (!points.length) {
    return (
      <div className="flex h-80 w-full flex-col items-center justify-center gap-2 rounded-lg bg-zinc-100 text-sm text-zinc-400">
        <MapPin className="h-6 w-6" />
        No assets with GPS coordinates yet.
      </div>
    );
  }

  const center: [number, number] = [points[0].lat, points[0].lng];

  return (
    <div className="h-80 w-full overflow-hidden rounded-lg">
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((p) => (
          <Marker key={p.code} position={[p.lat, p.lng]} icon={pinIcon("#f59e0b")}>
            <Tooltip direction="top" offset={[0, -8]}>
              <span className="font-semibold">{p.code}</span> — {p.label}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
