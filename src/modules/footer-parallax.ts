import gsap from "@lib/gsap";
import { Scroll } from "@lib/scroll";
import { Raf, Resize } from "@lib/subs";
import { onMount, onDestroy } from "@/modules/_";
import { clamp, map } from "@utils/math";
import { handleEditor } from "@webflow/detect-editor";

/** data-module="footer-parallax" on wrapper (overflow:hidden). data-footer-parallax-inner, data-footer-parallax-dark. */
export default function (element: HTMLElement, dataset: DOMStringMap) {
  const inner = element.querySelector<HTMLElement>(
    "[data-footer-parallax-inner]"
  );
  const dark = element.querySelector<HTMLElement>("[data-footer-parallax-dark]");

  if (!inner && !dark) return;

  const shift = parseFloat(dataset.parallax ?? "-25");
  const darkFrom = parseFloat(dataset.dark ?? "0.5");

  let started = false;
  let isEditor = false;
  let unsubRaf: (() => void) | null = null;
  let lastProgress = -1;

  // Measured live every frame (cheap: one getBoundingClientRect on one
  // element). Cached bounds go stale when fonts/images load after mount or
  // when the viewport changes (e.g. opening DevTools), which left the footer
  // clipped mid-reveal. The wrapper itself is never transformed — only the
  // inner is — so reading its rect is stable.
  const render = () => {
    // Footer top in document space, from the current layout.
    const top = element.getBoundingClientRect().top + Scroll.scroll;

    // Original ScrollTrigger used end: 'clamp(top top)' — the end position
    // must be reachable. A footer at the bottom of the page can never bring
    // its top to the viewport top, so cap it at the max scroll position.
    const end = Math.min(top, Scroll.limit);
    const start = Math.min(top - Resize.height, end - 1);

    const p = clamp(0, 1, map(Scroll.scroll, start, end, 0, 1));
    if (p === lastProgress) return;
    lastProgress = p;
    if (inner) gsap.set(inner, { yPercent: shift * (1 - p) });
    if (dark) gsap.set(dark, { opacity: darkFrom * (1 - p) });
  };

  const start = () => {
    if (started) return;
    started = true;
    lastProgress = -1;
    render();
    unsubRaf = Raf.add(render);
  };

  const stop = () => {
    if (!started) return;
    started = false;
    unsubRaf?.();
    unsubRaf = null;
    if (inner) gsap.set(inner, { clearProps: "transform" });
    if (dark) gsap.set(dark, { clearProps: "opacity" });
  };

  handleEditor((editor) => {
    isEditor = editor;
    if (editor) stop();
    else start();
  });

  onMount(() => {
    if (!isEditor) start();
  });

  onDestroy(() => stop());
}
