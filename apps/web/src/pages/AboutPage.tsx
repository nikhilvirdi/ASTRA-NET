import React from 'react';
import { Link } from 'react-router-dom';

export function AboutPage(): React.ReactElement {
  return (
    <main id="main-content" className="pt-24 px-8 pb-32 max-w-2xl mx-auto space-y-12">
      {/* ── Section: What's Overhead ── */}
      <section className="space-y-4">
        <h1 className="font-jost text-2xl sm:text-3xl text-white font-medium tracking-tight">
          What&apos;s Overhead
        </h1>
        <div className="space-y-4 type-body text-sky-200 leading-relaxed font-sans">
          <p>
            ASTRA-NET tells you what&apos;s actually happening in the sky above you right now — the
            ISS passing overhead, an aurora that might reach your latitude tonight, an asteroid
            making its closest approach, the planets and stars visible from exactly where
            you&apos;re standing.
          </p>
          <p>
            Every number on this page comes from somewhere real: NASA, NOAA, N2YO, JPL, or a
            calculation run live against your actual location and the current time. If a source goes
            down, the app says so, rather than filling the gap with a number that just happens to
            look plausible.
          </p>
        </div>
      </section>

      {/* ── Section: The Causal Engine ── */}
      <section className="space-y-4 border-t border-sky-800/40 pt-8">
        <h2 className="font-jost text-xl sm:text-2xl text-white font-medium tracking-tight">
          The Causal Engine
        </h2>
        <p className="type-body text-sky-200 leading-relaxed font-sans">
          When ASTRA-NET says an aurora might be visible tonight, that&apos;s the end of a real
          chain of physical reasoning, not a single number pulled from somewhere:
        </p>
        <ol className="space-y-3 pt-2 text-sky-200 font-sans list-none">
          <li className="flex gap-3 items-start">
            <span className="font-jost text-xs text-brass-300 font-semibold px-2 py-0.5 rounded-sm bg-brass-300/10 border border-brass-400/30 flex-shrink-0 mt-0.5">
              1
            </span>
            <div className="type-body text-sm sm:text-base leading-relaxed">
              <strong className="text-sky-100 font-semibold">Detection</strong> — NASA&apos;s DONKI
              system reports a coronal mass ejection (CME) erupting from the Sun.
            </div>
          </li>
          <li className="flex gap-3 items-start">
            <span className="font-jost text-xs text-brass-300 font-semibold px-2 py-0.5 rounded-sm bg-brass-300/10 border border-brass-400/30 flex-shrink-0 mt-0.5">
              2
            </span>
            <div className="type-body text-sm sm:text-base leading-relaxed">
              <strong className="text-sky-100 font-semibold">Transit</strong> — the CME&apos;s real
              launch velocity runs through a physics-based drag model to estimate when it&apos;ll
              reach Earth, usually a day or more out.
            </div>
          </li>
          <li className="flex gap-3 items-start">
            <span className="font-jost text-xs text-brass-300 font-semibold px-2 py-0.5 rounded-sm bg-brass-300/10 border border-brass-400/30 flex-shrink-0 mt-0.5">
              3
            </span>
            <div className="type-body text-sm sm:text-base leading-relaxed">
              <strong className="text-sky-100 font-semibold">Geomagnetic response</strong> —
              NOAA&apos;s live Kp index (a measure of geomagnetic disturbance) gets checked against
              how strong that CME is expected to be.
            </div>
          </li>
          <li className="flex gap-3 items-start">
            <span className="font-jost text-xs text-brass-300 font-semibold px-2 py-0.5 rounded-sm bg-brass-300/10 border border-brass-400/30 flex-shrink-0 mt-0.5">
              4
            </span>
            <div className="type-body text-sm sm:text-base leading-relaxed">
              <strong className="text-sky-100 font-semibold">Local outcome</strong> — the Kp value
              is compared against your actual latitude to figure out whether the aurora&apos;s
              visibility boundary reaches you.
            </div>
          </li>
        </ol>
        <p className="type-body text-sky-200 leading-relaxed font-sans pt-2">
          You can see the whole chain, from solar eruption to &ldquo;will I see it from here,&rdquo;
          along with how confident that final answer really is.
        </p>
      </section>

      {/* ── Section: Confidence, honestly ── */}
      <section className="space-y-4 border-t border-sky-800/40 pt-8">
        <h2 className="font-jost text-xl sm:text-2xl text-white font-medium tracking-tight">
          Confidence, Honestly
        </h2>
        <p className="type-body text-sky-200 leading-relaxed font-sans">
          Every prediction gets tracked against what actually happens. The public accuracy record
          isn&apos;t touched up afterward — it&apos;s a rolling, unedited log of every call the app
          has made, right or wrong, so the track record actually means something.
        </p>
      </section>

      {/* ── Section: The data behind it ── */}
      <section className="space-y-4 border-t border-sky-800/40 pt-8">
        <h2 className="font-jost text-xl sm:text-2xl text-white font-medium tracking-tight">
          The Data Behind It
        </h2>
        <p className="type-body text-sky-200 leading-relaxed font-sans">
          ISS positions and passes come from N2YO. Space weather and geomagnetic data come from
          NOAA&apos;s Space Weather Prediction Center. Solar flares and CMEs come from NASA&apos;s
          DONKI system. Near-Earth objects come from NASA&apos;s NeoWs. Planetary positions come
          from JPL&apos;s Horizons ephemeris service. Sun, Moon, and star positions are computed
          live, straight from real astronomical formulas. The full breakdown of every source lives
          on the{' '}
          <Link
            to="/settings"
            className="text-brass-300 hover:text-sky-100 underline underline-offset-4 transition-colors"
          >
            Settings page
          </Link>
          .
        </p>
      </section>

      {/* ── Section: No accounts, nothing tracked ── */}
      <section className="space-y-4 border-t border-sky-800/40 pt-8">
        <h2 className="font-jost text-xl sm:text-2xl text-white font-medium tracking-tight">
          No Accounts, Nothing Tracked
        </h2>
        <p className="type-body text-sky-200 leading-relaxed font-sans">
          There&apos;s no sign-up here. Your location stays in your own browser and never touches a
          server. Nothing about you is being collected.
        </p>
      </section>

      {/* ── Section: Built by ── */}
      <section className="space-y-4 border-t border-sky-800/40 pt-8">
        <h2 className="font-jost text-xl sm:text-2xl text-white font-medium tracking-tight">
          Built By
        </h2>
        <p className="type-body text-sky-200 leading-relaxed font-sans">
          ASTRA-NET was built by{' '}
          <strong className="text-sky-100 font-semibold">Nikhil Virdi</strong>. Source and more
          work:{' '}
          <a
            href="https://github.com/nikhilvirdi/ASTRA-NET"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brass-300 hover:text-sky-100 underline underline-offset-4 transition-colors"
          >
            github.com/nikhilvirdi/ASTRA-NET
          </a>
          .
        </p>
      </section>
    </main>
  );
}
