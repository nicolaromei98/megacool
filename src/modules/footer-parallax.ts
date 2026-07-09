import gsap, { reduced } from "@lib/gsap";
import { Scroll } from "@lib/scroll";
import { Resize } from "@lib/subs";
import { onMount, onDestroy } from "@/modules/_";
import { clamp, map } from "@utils/math";
import { handleEditor } from "@webflow/detect-editor";

/**
 * Scroll-scrubbed footer parallax (replaces the standalone data-footer-parallax script).
 *
 * data-module="footer-parallax" on the wrapper.
 * Children: [data-footer-parallax-inner] slides up from yPercent -25,
 * [data-footer-parallax-dark] fades in from opacity 0.5.
 *
 * Progress is read from the footer's *live* bounding rect every frame (like
 * card-content-fade) rather than from ScrollTrigger's cached start/end. On
 * tall, image-heavy pages (e.g. /technology) lazy images above the footer load
 * as you scroll, shifting the footer after a cached scrub had already measured
 * it — the scrub then remaps mid-scroll and the footer looks frozen. Reading
 * the rect each frame is immune to those layout shifts.
 */
export default function (element: HTMLElement, _dataset: DOMStringMap) {
  const inner = element.querySelector<HTMLElement>(
    "[data-footer-parallax-inner]"
  );
  const dark = element.querySelector<HTMLElement>("[data-footer-parallax-dark]");

  if (!inner && !dark) return;

  let started = false;
  let isEditor = false;
  let unsubScroll: (() => void) | null = null;
  let unsubResize: (() => void) | null = null;
  let lastProgress = -1;

  const render = () => {
    // progress: 0 when the footer's top sits at the viewport bottom,
    // 1 when it reaches the viewport top — the range the old
    // clamp(top bottom)→clamp(top top) scrub covered.
    const top = element.getBoundingClientRect().top;
    const progress = clamp(0, 1, map(top, Resize.height, 0, 0, 1));

    if (progress === lastProgress) return;
    lastProgress = progress;

    const remaining = 1 - progress;
    if (inner) gsap.set(inner, { yPercent: -25 * remaining });
    if (dark) gsap.set(dark, { opacity: 0.5 * remaining });
  };

  const reset = () => {
    if (inner) gsap.set(inner, { clearProps: "transform" });
    if (dark) gsap.set(dark, { clearProps: "opacity" });
    lastProgress = -1;
  };

  const start = () => {
    if (started || isEditor || reduced) return;
    started = true;
    render();
    unsubScroll = Scroll.add(render);
    unsubResize = Resize.add(render);
  };

  const stop = () => {
    if (!started) return;
    started = false;
    unsubScroll?.();
    unsubResize?.();
    unsubScroll = null;
    unsubResize = null;
    reset();
  };

  handleEditor((editor) => {
    isEditor = editor;
    if (editor || reduced) stop();
    else start();
  });

  onMount(() => start());

  onDestroy(() => stop());
}
