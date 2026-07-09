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
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;

  const start = () => {
    if (ctx || isEditor || reduced) return;

    initScrollTrigger();

    ctx = gsap.context(() => {
      const tl = gsap.timeline();

      // Explicit fromTo endpoints (instead of `from`) so a stale/leftover
      // transform can never be recorded as the animation's end state.
      if (inner) {
        tl.fromTo(
          inner,
          { yPercent: -25 },
          { yPercent: 0, ease: "none" },
          0
        );
      }

      if (dark) {
        tl.fromTo(dark, { opacity: 0.5 }, { opacity: 1, ease: "none" }, 0);
      }

      ScrollTrigger.create({
        trigger: element,
        start: "clamp(top bottom)",
        end: "clamp(top top)",
        scrub: true,
        // Re-record start/end + tween values on every refresh so late layout
        // shifts (image loads, font swaps, page transitions) can't leave the
        // scrub frozen at an intermediate transform. Reload used to "fix" it
        // only because a fresh load re-measured everything.
        invalidateOnRefresh: true,
        animation: tl,
      });
    }, element);

    // One refresh next frame, one after the browser has painted/settled — the
    // second catches layout that isn't ready on the immediate frame.
    requestAnimationFrame(() => ScrollTrigger.refresh());
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      ScrollTrigger.refresh();
    }, 200);
  };

  const stop = () => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
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
