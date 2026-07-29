/**
 * Pure layout and formatting helpers for the Shareable Sky Card page (/share/:id)
 * (DESIGN_SPEC.md §17). Extracted for unit testing under Vitest.
 */

import type { ShareMarkerData, ShareSnapshotData } from './api';

export function formatCapturedDate(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'UNKNOWN DATE';

  const weekday = d
    .toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
    .toUpperCase();
  const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  const day = d.toLocaleDateString('en-US', { day: '2-digit', timeZone: 'UTC' });
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');

  return `${weekday}, ${month} ${day} · ${hours}:${minutes} UTC`;
}

export function getOgImageMetaUrl(shareId: string, origin = ''): string {
  const base = origin.replace(/\/+$/, '');
  return `${base}/api/share/${shareId}/og.png`;
}

export function getShareMarkerColorClass(type: ShareMarkerData['type']): string {
  switch (type) {
    case 'sun':
      return 'bg-solar';
    case 'iss':
      return 'bg-orbital';
    case 'moon':
      return 'bg-sky-100';
    case 'planet':
    default:
      return 'bg-brass-300';
  }
}

export interface ShareMetaHeadProps {
  title: string;
  description: string;
  ogImageUrl: string;
  ogUrl: string;
}

export function buildShareMetaHead(snapshot: ShareSnapshotData, origin = ''): ShareMetaHeadProps {
  const title = `${snapshot.headline} — ASTRANET Sky Card`;
  const description = `Observed at ${snapshot.observer.label} · ${snapshot.sky.twilightBand.toUpperCase()} TWILIGHT`;
  const ogImageUrl = getOgImageMetaUrl(snapshot.id, origin);
  const ogUrl = `${origin.replace(/\/+$/, '')}/share/${snapshot.id}`;

  return {
    title,
    description,
    ogImageUrl,
    ogUrl,
  };
}
