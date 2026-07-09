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

      // Explicit fromTo (not from) so the resting value is always a hard 0 /
      // opacity 1 — GSAP won't record a stale "natural" end value if a refresh
      // happens mid-scrub.
      if (inner) {
        tl.fromTo(inner, { yPercent: -25 }, { yPercent: 0, ease: "none" });
      }

      if (dark) {
        tl.fromTo(dark, { opacity: 0.5 }, { opacity: 1, ease: "none" }, "<");
      }

      // end: "bottom bottom" — the footer's bottom reaching the viewport bottom
      // IS reachable at the page's max scroll, so progress always hits 1 and the
      // transform lands on 0. "clamp(top top)" relied on clamping to max-scroll,
      // which drifts out of reach when the page height changes after measuring
      // (content-reveal clearing props, images loading, Lenis resize) and left
      // the footer stuck at a negative yPercent.
      // invalidateOnRefresh recomputes the tween on every ScrollTrigger.refresh.
      ScrollTrigger.create({
        trigger: element,
        start: "clamp(top bottom)",
        end: "bottom bottom",
        scrub: true,
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
