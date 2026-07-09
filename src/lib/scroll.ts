import Lenis from "lenis";
import gsap, { ScrollTrigger } from "./gsap";
import { Resize } from "@lib/subs";
import { handleEditor } from "@webflow/detect-editor";

type SubscriberFn = (data: any) => void;

// (*) TODO: disable on webflow editor

const SCROLL_CONFIG = {
  infinite: false,
  lerp: 0.1,
  smoothWheel: true,
  touchMultiplier: 2,
  // Lenis's autoResize covers viewport/wrapper changes, but it does NOT
  // reliably catch content-height growth when scrolling the window (e.g. lazy
  // images loading below the fold). initScrollTrigger() calls Scroll.resize()
  // on body-height changes to keep `limit` in sync — see the note there.
  autoResize: true,
};

let scrollTriggerReady = false;

/**
 * Wire ScrollTrigger to Lenis — safe to call multiple times.
 * Lenis scrolls natively (window.scrollY changes), so no scrollerProxy is
 * needed; a proxy would fight Lenis on every ScrollTrigger.refresh().
 */
export function initScrollTrigger() {
  if (scrollTriggerReady) return;
  scrollTriggerReady = true;

  Scroll.on("scroll", ScrollTrigger.update);
  Resize.add(() => ScrollTrigger.refresh());

  // Keep the scroll measurements in sync with *content-height* changes, not
  // just the viewport. On long, image-heavy pages (e.g. /technology) figures
  // load below the fold after the initial refresh, growing the page. The window
  // "resize" event never fires for that, so two things go stale: Lenis's scroll
  // `limit` (clamping the user short of the real bottom — the page feels
  // "stuck") and ScrollTrigger's cached start/end. A body ResizeObserver plus
  // load/fonts hooks fix both — Scroll.resize() updates Lenis, then
  // ScrollTrigger.refresh() re-measures.
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleRefresh = () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      Scroll.resize();
      ScrollTrigger.refresh();
    }, 150);
  };

  window.addEventListener("load", scheduleRefresh);
  document.fonts?.ready.then(scheduleRefresh);

  if (typeof ResizeObserver !== "undefined") {
    let lastHeight = document.body.offsetHeight;
    const observer = new ResizeObserver(() => {
      // Only react to height changes — width changes already come through the
      // window "resize" path above, and reacting to both risks refresh loops.
      const height = document.body.offsetHeight;
      if (height !== lastHeight) {
        lastHeight = height;
        // Update Lenis's limit immediately so the scroll wall tracks the
        // content while actively scrolling; the heavier ScrollTrigger.refresh
        // stays debounced.
        Scroll.resize();
        scheduleRefresh();
      }
    });
    observer.observe(document.body);
  }
}

class _Scroll extends Lenis {
  #ticker = gsap.ticker.add((time) => this.raf(time * 1000));

  constructor() {
    super(SCROLL_CONFIG);
    this.on("scroll", this.#scroll.bind(this));
  }

  #scroll(data: any) {
    // console.log("scroll", { scroll, limit, progress, velocity, time });
    this.notify(data);
  }

  toTop() {
    this.scrollTo(0, {
      immediate: true,
    });
  }

  /** Subscribable */
  #subscribers: { fn: SubscriberFn; priority: number; id: symbol }[] = [];

  add(fn: SubscriberFn, priority = 0, id = Symbol()) {
    const index = this.#subscribers.findIndex((sub) => sub.priority > priority);
    if (index === -1) {
      this.#subscribers.push({ fn, priority, id });
    } else {
      this.#subscribers.splice(index, 0, { fn, priority, id });
    }
    return () => this.remove(id);
  }

  remove(id: symbol) {
    this.#subscribers = this.#subscribers.filter((f) => f.id !== id);
  }

  notify(data: any) {
    if (this.#subscribers.length < 1) return;
    this.#subscribers.forEach((f) => f.fn(data));
  }
}

export const Scroll = new _Scroll();

handleEditor((isEditor) => {
  if (isEditor) {
    Scroll.destroy();
  } else {
    Scroll.start();
    initScrollTrigger();
    requestAnimationFrame(() => ScrollTrigger.refresh());
  }
});
