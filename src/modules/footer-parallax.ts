import gsap, { reduced, ScrollTrigger } from "@lib/gsap";
import { initScrollTrigger } from "@lib/scroll";
import { onMount, onDestroy } from "@/modules/_";
import { handleEditor } from "@webflow/detect-editor";

/**
 * Scroll-scrubbed footer parallax (replaces the standalone data-footer-parallax script).
 *
 * data-module="footer-parallax" on the wrapper.
 * Children: [data-footer-parallax-inner] slides up from yPercent -25,
 * [data-footer-parallax-dark] fades in from opacity 0.5.
 */
export default function (element: HTMLElement, _dataset: DOMStringMap) {
  const inner = element.querySelector<HTMLElement>(
    "[data-footer-parallax-inner]"
  );
  const dark = element.querySelector<HTMLElement>("[data-footer-parallax-dark]");

  if (!inner && !dark) return;

  let ctx: gsap.Context | null = null;
  let isEditor = false;

  const start = () => {
    if (ctx || isEditor || reduced) return;

    initScrollTrigger();

    ctx = gsap.context(() => {
      const tl = gsap.timeline();

      if (inner) {
        tl.from(inner, { yPercent: -25, ease: "none" });
      }

      if (dark) {
        tl.from(dark, { opacity: 0.5, ease: "none" }, "<");
      }

      // Use the ScrollTrigger.create API directly (instead of the timeline
      // `scrollTrigger` shorthand) — the shorthand needs the plugin registered
      // on GSAP's property system, which isn't reliable in this bundle and
      // throws "Invalid property scrollTrigger". Attaching via `animation`
      // uses the same path as the other modules.
      ScrollTrigger.create({
        trigger: element,
        start: "clamp(top bottom)",
        end: "clamp(top top)",
        scrub: true,
        animation: tl,
      });
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
