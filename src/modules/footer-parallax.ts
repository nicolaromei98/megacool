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
  let mounted = false;

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

      ScrollTrigger.create({
        trigger: element,
        start: "clamp(top bottom)",
        end: "clamp(top top)",
        scrub: true,
        // Recompute start/end (and the scrubbed from-values) on every refresh.
        // The footer sits at the very bottom, so its position depends on the
        // full height of everything above it — which on long, image-heavy pages
        // keeps changing after the trigger is first created.
        invalidateOnRefresh: true,
        animation: tl,
      });
    }, element);

    // Refresh across a couple of frames so the trigger measures the *settled*
    // layout. On soft (Taxi) navigation there's no window "load"/fonts.ready to
    // trigger a late refresh, so a single early refresh would leave the footer
    // measured against a stale height on the tall /technology page.
    requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      requestAnimationFrame(() => ScrollTrigger.refresh());
    });
  };

  const stop = () => {
    ctx?.revert();
    ctx = null;
  };

  // NOTE: handleEditor fires its callback synchronously, which happens during
  // createCycles() — i.e. before the page-in transition settles. Building here
  // would measure the trigger too early (and onMount would then no-op because
  // ctx already exists). So we only (re)build from the editor callback once the
  // module has actually mounted; the initial build is owned by onMount, which
  // runs after runPageIn() has resolved.
  handleEditor((editor) => {
    isEditor = editor;
    if (editor) stop();
    else if (mounted) start();
  });

  onMount(() => {
    mounted = true;
    start();
  });

  onDestroy(() => {
    mounted = false;
    stop();
  });
}
