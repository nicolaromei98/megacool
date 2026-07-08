import gsap from "@lib/gsap";
import { Scroll, refreshScroll } from "@lib/scroll";
import { Resize } from "@lib/subs";
import { onMount, onDestroy } from "@/modules/_";
import { clientRect } from "@utils/client-rect";
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

  const bounds = { start: 0, end: 1 };
  let unsubScroll: (() => void) | null = null;
  let unsubResize: (() => void) | null = null;
  let lastProgress = -1;

  const measure = () => {
    const rect = clientRect(element);
    bounds.start = rect.top - Resize.height;
    bounds.end = rect.top;
    lastProgress = -1;
  };

  const render = () => {
    const p = clamp(0, 1, map(Scroll.scroll, bounds.start, bounds.end, 0, 1));
    if (p === lastProgress) return;
    lastProgress = p;
    if (inner) gsap.set(inner, { yPercent: shift * (1 - p) });
    if (dark) gsap.set(dark, { opacity: darkFrom * (1 - p) });
  };

  const start = () => {
    if (started) return;
    started = true;
    measure();
    render();
    unsubScroll = Scroll.add(render);
    unsubResize = Resize.add(() => {
      measure();
      render();
    });
    // Recalculate Lenis limit once assets settle — no wrapper height changes.
    document.fonts?.ready.then(refreshScroll);
    requestAnimationFrame(refreshScroll);
  };

  const stop = () => {
    if (!started) return;
    started = false;
    unsubScroll?.();
    unsubResize?.();
    unsubScroll = null;
    unsubResize = null;
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
