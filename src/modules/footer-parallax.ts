import gsap, { reduced, ScrollTrigger } from "@lib/gsap";
import { initScrollTrigger } from "@lib/scroll";
import { onMount, onDestroy } from "@/modules/_";
import { toNumber } from "@utils/math";
import { handleEditor } from "@webflow/detect-editor";

/**
 * Scroll-scrubbed footer reveal (replaces data-footer-parallax).
 *
 * data-module="footer-parallax" on the wrapper (overflow:hidden).
 * Children: [data-footer-parallax-inner] slides up from yPercent -25,
 * [data-footer-parallax-dark] fades out from opacity 0.5.
 *
 * Optional: data-parallax="-25", data-dark="0.5", data-debug (ST markers)
 */
export default function (element: HTMLElement, dataset: DOMStringMap) {
  const inner = element.querySelector<HTMLElement>(
    "[data-footer-parallax-inner]"
  );
  const dark = element.querySelector<HTMLElement>("[data-footer-parallax-dark]");

  if (!inner && !dark) return;

  const shift = toNumber(dataset.parallax, -25);
  const darkFrom = toNumber(dataset.dark, 0.5);

  let ctx: gsap.Context | null = null;
  let isEditor = false;

  const start = () => {
    if (ctx || isEditor || reduced) return;

    initScrollTrigger();

    ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: element,
          start: "clamp(top bottom)",
          end: "clamp(top top)",
          scrub: true,
          markers: element.hasAttribute("data-debug"),
        },
      });

      if (inner) {
        tl.from(inner, { yPercent: shift, ease: "none" });
      }

      if (dark) {
        tl.from(dark, { opacity: darkFrom, ease: "none" }, "<");
      }
    }, element);

    requestAnimationFrame(() => ScrollTrigger.refresh());
  };

  const stop = () => {
    ctx?.revert();
    ctx = null;
  };

  handleEditor((editor) => {
    isEditor = editor;
    if (editor) stop();
    else start();
  });

  onMount(() => start());

  onDestroy(() => stop());
}
