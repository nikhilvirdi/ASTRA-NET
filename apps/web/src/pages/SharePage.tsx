import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchShareSnapshot, type ShareSnapshotData } from '@/lib/api';
import { HorizonBand } from '@/components/brief/HorizonBand';
import { buildShareMetaHead, formatCapturedDate } from '@/lib/share-helpers';

export function SharePage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const [snapshot, setSnapshot] = useState<ShareSnapshotData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    fetchShareSnapshot(id)
      .then((data) => {
        if (mounted) {
          setSnapshot(data);
          setLoading(false);

          // Update Document Title and Head Open Graph Meta Tags
          const metaHead = buildShareMetaHead(data, window.location.origin);
          document.title = metaHead.title;

          // Helper to set or update meta tag in document head
          const setMetaTag = (property: string, content: string, isName = false) => {
            const attr = isName ? 'name' : 'property';
            let el = document.querySelector(`meta[${attr}="${property}"]`);
            if (!el) {
              el = document.createElement('meta');
              el.setAttribute(attr, property);
              document.head.appendChild(el);
            }
            el.setAttribute('content', content);
          };

          setMetaTag('og:title', metaHead.title);
          setMetaTag('og:description', metaHead.description);
          setMetaTag('og:image', metaHead.ogImageUrl);
          setMetaTag('og:url', metaHead.ogUrl);
          setMetaTag('og:type', 'website');
          setMetaTag('og:image:width', '1200');
          setMetaTag('og:image:height', '630');

          setMetaTag('twitter:card', 'summary_large_image', true);
          setMetaTag('twitter:title', metaHead.title, true);
          setMetaTag('twitter:description', metaHead.description, true);
          setMetaTag('twitter:image', metaHead.ogImageUrl, true);
        }
      })
      .catch((err) => {
        if (mounted) {
          if (err instanceof Error && err.message === 'NOT_FOUND') {
            setNotFound(true);
          } else {
            console.error('[SharePage] Fetch error:', err);
            setError('Unable to load sky card snapshot.');
          }
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  // Loading state
  if (loading) {
    return (
      <main
        id="main-content"
        className="min-h-screen bg-sky-950 flex flex-col justify-center items-center p-6 text-sky-100"
      >
        <div className="type-mono text-brass-400 text-sm tracking-widest animate-pulse">
          — — ACQUIRING SHAREABLE SKY CARD — —
        </div>
      </main>
    );
  }

  // Not Found / Error state
  if (notFound || error || !snapshot) {
    return (
      <main
        id="main-content"
        className="min-h-screen bg-sky-950 flex flex-col justify-center items-center p-6 text-center"
      >
        <div className="max-w-[500px] flex flex-col gap-6 items-center">
          <span className="type-micro text-brass-500 tracking-wider uppercase">
            SKY CARD NOT FOUND
          </span>
          <h1 className="type-display-m text-sky-100">
            {error ? 'Telemetry Unreachable' : 'This Sky Card Does Not Exist'}
          </h1>
          <p className="type-body text-sky-300">
            {error
              ? 'The sky card snapshot could not be retrieved from the network.'
              : 'This shared snapshot may have expired or been removed.'}
          </p>
          <Link
            to="/"
            className="mt-4 type-micro text-brass-300 hover:text-sky-100 border border-brass-500/40 hover:border-brass-300 px-6 py-2 rounded transition-colors tracking-wider uppercase cursor-pointer"
          >
            SEE YOUR OWN SKY →
          </Link>
        </div>
      </main>
    );
  }

  const surfaceHex = snapshot.sky.surfaceHex || '#111818';

  return (
    <main
      id="main-content"
      className="min-h-screen flex flex-col justify-between p-6 md:p-12 text-sky-100 transition-colors duration-500 overflow-x-hidden select-none"
      style={{ backgroundColor: surfaceHex }}
    >
      <div className="max-w-[1000px] w-full mx-auto flex flex-col justify-between flex-1 gap-6 md:gap-8">
        {/* ── 1. Location + Date Eyebrow Strip (Solid sky-900 Instrument Plate) ── */}
        <header className="bg-sky-900 border border-sky-800/80 rounded px-4 md:px-6 py-3 flex flex-wrap justify-between items-center gap-x-4 gap-y-2 shadow-md">
          <div className="type-micro text-brass-300 tracking-wider uppercase font-mono text-xs flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brass-400 inline-block" />
            <span>OBSERVER AT {snapshot.observer.label}</span>
          </div>

          <div className="type-micro text-sky-200 tracking-wider uppercase font-mono text-xs">
            {formatCapturedDate(snapshot.capturedAt)}
          </div>
        </header>

        {/* ── 2. Headline (Bare surface, display-l size) ────────────────── */}
        <section aria-label="Sky Card Headline" className="my-2">
          <h1 className="type-display-l text-sky-100 max-w-[900px] leading-tight font-serif">
            {snapshot.headline}
          </h1>
        </section>

        {/* ── 3. Horizon Band (Simplified, markers & horizon only) ───────── */}
        <section aria-label="Horizon Band View">
          <HorizonBand markers={snapshot.horizon.markers} hideScrubber={true} />
        </section>

        {/* ── 4. Three Key Measurements (Solid sky-900 Instrument Plate) ─── */}
        <section aria-label="Key Measurements">
          <div className="bg-sky-900 border border-sky-800/80 rounded p-4 md:p-6 grid grid-cols-1 sm:grid-cols-3 gap-6 shadow-md">
            {snapshot.facts.map((fact, idx) => (
              <div
                key={idx}
                className="flex flex-col gap-1 border-l border-sky-800/60 pl-4 first:border-l-0 first:pl-0"
              >
                <span className="type-micro text-brass-300 tracking-wider uppercase text-xs">
                  {fact.label}
                </span>
                <span className="type-data-l text-sky-100 font-mono text-xl md:text-2xl font-medium tracking-tight">
                  {fact.value}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── 5. Wordmark + CTA Footer ────────────────────────────────────── */}
        <footer className="border-t border-sky-800/40 pt-4 flex flex-wrap justify-between items-center gap-4">
          <div className="type-micro text-brass-500 text-xs tracking-widest uppercase font-mono">
            ASTRANET · ADAPTIVE SKY TELEMETRY
          </div>

          <Link
            to="/"
            className="type-micro text-sky-100 hover:text-brass-300 border border-sky-700 hover:border-brass-400 bg-sky-900/80 px-4 py-2 rounded transition-colors tracking-wider uppercase text-xs inline-flex items-center gap-2 cursor-pointer shadow"
          >
            <span>SEE YOUR OWN SKY</span>
            <span>→</span>
          </Link>
        </footer>
      </div>
    </main>
  );
}
