import gsap from "@lib/gsap";
import { Scroll } from "@lib/scroll";
import { Resize } from "@lib/subs";
import { onMount, onDestroy } from "@/modules/_";
import { clamp, map, toNumber } from "@utils/math";
import { handleEditor } from "@webflow/detect-editor";

/**
 * Footer reveal parallax.
 *
 * data-module="footer-parallax" on wrapper (overflow:hidden).
 * data-footer-parallax-inner, data-footer-parallax-dark.
 * Optional: data-parallax="-25" (yPercent shift), data-dark="0.5"
 */
export default function (element: HTMLElement, dataset: DOMStringMap) {
  const inner = element.querySelector<HTMLElement>(
    "[data-footer-parallax-inner]"
  );
  const dark = element.querySelector<HTMLElement>("[data-footer-parallax-dark]");

  if (!inner && !dark) return;

  const shift = toNumber(dataset.parallax, -25);
  const darkFrom = toNumber(dataset.dark, 0.5);

  let started = false;
  let isEditor = false;
  let unsubScroll: (() => void) | null = null;
  let unsubResize: (() => void) | null = null;
  let lastProgress = -1;

  const getProgress = () => {
    const rect = element.getBoundingClientRect();
    const wh = Resize.height;
    const h = Math.max(rect.height, 1);

    // 0 → footer top enters viewport; 1 → footer bottom reaches viewport bottom
    return clamp(0, 1, map(rect.top, wh, wh - h, 0, 1));
  };

  const render = () => {
    const p = getProgress();
    if (p === lastProgress) return;
    lastProgress = p;

    if (inner) gsap.set(inner, { yPercent: shift * (1 - p), force3D: true });
    if (dark) gsap.set(dark, { opacity: darkFrom * (1 - p) });
  };

  const start = () => {
    if (started) return;
    started = true;
    lastProgress = -1;
    render();
    unsubScroll = Scroll.add(render);
    unsubResize = Resize.add(() => {
      lastProgress = -1;
      render();
      Scroll.resize();
    });
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
