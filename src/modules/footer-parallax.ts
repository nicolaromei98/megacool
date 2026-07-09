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

      // fromTo (not from) so both endpoints are explicit. A plain .from() infers
      // its "to" from the element's live transform, so if a ScrollTrigger.refresh
      // lands after layout shifts (image loads, Taxi soft-nav) it re-bakes a
      // mid-animation value and the footer freezes at e.g. yPercent -3%.
      if (inner) {
        tl.fromTo(inner, { yPercent: -25 }, { yPercent: 0, ease: "none" });
      }

      if (dark) {
        tl.fromTo(dark, { opacity: 0.5 }, { opacity: 1, ease: "none" }, "<");
      }

      ScrollTrigger.create({
        trigger: element,
        start: "clamp(top bottom)",
        end: "clamp(top top)",
        scrub: true,
        // Re-read the fromTo endpoints on every refresh so late layout changes
        // recompute cleanly instead of leaving the scrub stuck partway.
        invalidateOnRefresh: true,
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
