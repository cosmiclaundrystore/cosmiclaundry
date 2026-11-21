// The launch page. While the store is locked (see proxy.ts) it is served at / and every shop page redirects here.
// The email form posts to /api/notify, which saves the address in public.launch_signups.
const comingSoonHtml = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#faf9f6">
  <title>Coming soon | Cosmic Laundry</title>
  <meta name="description" content="Fresh load incoming. Something out of this world is coming to Cosmic Laundry.">
  <link rel="icon" href="/assets/products/logo-black-480.webp">
  <link rel="preload" href="/assets/space-grotesk-normal-400.ttf" as="font" type="font/ttf" crossorigin>
  <link rel="stylesheet" href="/fonts.css">
  <link rel="stylesheet" href="/comingsoon.css">
</head>
<body>
  <div class="color-wash" aria-hidden="true"></div>
  <header class="launch-header">
    <a href="/" class="wordmark" aria-label="Cosmic Laundry home">COSMIC LAUNDRY<span>Made to be worn. Hard to ignore.</span></a>
    <span class="launch-status">Coming soon</span>
  </header>
  <main>
    <div class="logo-universe">
      <div class="orbits" aria-hidden="true">
        <span class="orbit" style="--tilt:-14deg;--height:36%;--speed:28s;--delay:-4s"></span>
        <span class="orbit" style="--tilt:12deg;--height:43%;--speed:34s;--delay:-17s"></span>
        <span class="orbit" style="--tilt:-38deg;--height:49%;--speed:38s;--delay:-11s"></span>
        <span class="orbit" style="--tilt:42deg;--height:51%;--speed:44s;--delay:-29s"></span>
        <span class="orbit" style="--tilt:76deg;--height:39%;--speed:32s;--delay:-8s"></span>
        <span class="orbit" style="--tilt:-70deg;--height:44%;--speed:40s;--delay:-21s"></span>
      </div>
      <button class="logo-play" id="logo-play" type="button" aria-pressed="false" aria-label="Play the Cosmic Laundry soundtrack">
        <img class="launch-logo" src="/assets/products/logo-black-480.webp" alt="" width="240" height="280" fetchpriority="high">
      </button>
    </div>
    <section class="launch-copy" aria-labelledby="launch-title">
      <h1 id="launch-title">Fresh load <span>incoming.</span></h1>
      <p>Something out of this world is almost ready to wear.</p>
      <form class="email-signup" id="launch-form" action="/api/notify" method="post" novalidate>
        <label class="sr-only" for="launch-email">Email address</label>
        <input id="launch-email" name="email" type="email" autocomplete="email" placeholder="Your email address" required maxlength="254">
        <input class="hp" name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button type="submit">Notify me <span aria-hidden="true">↗</span></button>
      </form>
      <p class="signup-status" id="launch-status" role="status" aria-live="polite"></p>
    </section>
  </main>
  <footer class="launch-footer">
    <span>&copy; ${new Date().getFullYear()} Cosmic Laundry</span>
    <a href="https://www.instagram.com/cosmiclaundry.co/" target="_blank" rel="noopener noreferrer">Follow the spin <span aria-hidden="true">↗</span></a>
  </footer>
  <script>
    // Logo soundtrack: clicking the logo loops 7s–27s of the song (the clip file holds 6.5s–27.5s; we loop 0.5s–20.5s of it).
    // Web Audio gives a gapless loop and an analyser that makes the logo pulse on the kick; plain <audio> is the fallback.
    (() => {
      const button = document.getElementById('logo-play');
      const SRC = '/assets/audio/launch-loop.m4a', LOOP_START = 0.5, LOOP_END = 20.5, VOLUME = 0.8;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const logo = button.querySelector('.launch-logo');
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
      let ctx, gain, analyser, bins, source, bufferPromise, fallback, raf, playing = false;

      // Bass energy (~40–170 Hz) drives the scale: jumps up on each kick, eases back between them.
      let floor = 0, level = 0;
      const pulse = () => {
        raf = requestAnimationFrame(pulse);
        analyser.getByteFrequencyData(bins);
        let sum = 0;
        for (let i = 1; i <= 4; i++) sum += bins[i];
        const energy = sum / (4 * 255);
        floor += (energy - floor) * 0.05;
        const hit = Math.min(1, Math.max(0, (energy - floor) * 3.5) + energy * energy * 0.3);
        level = hit > level ? hit : level * 0.88;
        logo.style.setProperty('--beat', (1 + (calm.matches ? 0 : level * 0.14)).toFixed(3));
      };
      const stopPulse = () => { cancelAnimationFrame(raf); level = 0; logo.style.removeProperty('--beat'); };

      const setState = (on) => {
        playing = on;
        button.setAttribute('aria-pressed', String(on));
        button.setAttribute('aria-label', on ? 'Pause the Cosmic Laundry soundtrack' : 'Play the Cosmic Laundry soundtrack');
        document.body.classList.toggle('is-playing', on);
        if (!on) { stopPulse(); document.body.classList.remove('beat-fallback'); }
      };

      const startFallback = () => {
        if (!fallback) {
          fallback = new Audio(SRC);
          fallback.volume = VOLUME;
          fallback.addEventListener('timeupdate', () => { if (fallback.currentTime >= LOOP_END) fallback.currentTime = LOOP_START; });
        }
        if (fallback.currentTime < LOOP_START || fallback.currentTime >= LOOP_END) fallback.currentTime = LOOP_START;
        document.body.classList.add('beat-fallback');
        return fallback.play();
      };

      const play = async () => {
        setState(true);
        try {
          if (!Ctx) throw new Error('no web audio');
          if (!ctx) {
            ctx = new Ctx();
            gain = ctx.createGain();
            gain.connect(ctx.destination);
            analyser = ctx.createAnalyser();
            analyser.fftSize = 1024;
            analyser.smoothingTimeConstant = 0.4;
            analyser.connect(gain);
            bins = new Uint8Array(analyser.frequencyBinCount);
            bufferPromise = fetch(SRC).then((r) => r.arrayBuffer()).then((data) => new Promise((ok, fail) => ctx.decodeAudioData(data, ok, fail)));
          }
          await ctx.resume();
          const buffer = await bufferPromise;
          if (!playing) return;
          source = ctx.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          source.loopStart = LOOP_START;
          source.loopEnd = Math.min(LOOP_END, buffer.duration);
          source.connect(analyser);
          gain.gain.cancelScheduledValues(ctx.currentTime);
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(VOLUME, ctx.currentTime + 0.6);
          source.start(0, LOOP_START);
          cancelAnimationFrame(raf);
          pulse();
        } catch (error) {
          try { await startFallback(); } catch { setState(false); }
        }
      };

      const pause = () => {
        setState(false);
        if (fallback) fallback.pause();
        if (source && ctx) {
          const s = source; source = null;
          gain.gain.cancelScheduledValues(ctx.currentTime);
          gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
          s.stop(ctx.currentTime + 0.3);
        }
      };

      button.addEventListener('click', () => (playing ? pause() : play()));
    })();

    (() => {
      const form = document.getElementById('launch-form');
      const input = document.getElementById('launch-email');
      const status = document.getElementById('launch-status');
      const button = form.querySelector('button');
      const say = (text, kind) => { status.textContent = text; status.dataset.kind = kind || ''; };
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = input.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { say('Enter a valid email address.', 'error'); input.focus(); return; }
        button.disabled = true; say('Adding you to the list…');
        try {
          const response = await fetch('/api/notify', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email, website: form.website.value }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.message || 'That didn’t go through. Please try again.');
          form.reset();
          say('You’re on the list. We’ll email you the moment the first load drops.', 'ok');
        } catch (error) {
          say(error.message || 'That didn’t go through. Please try again.', 'error');
        } finally {
          button.disabled = false;
        }
      });
    })();
  </script>
</body>
</html>`;

export function GET() {
  return new Response(comingSoonHtml, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
