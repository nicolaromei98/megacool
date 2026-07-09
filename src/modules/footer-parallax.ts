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

      // end: "bottom bottom" aligns completion with the footer's bottom edge,
      // which — since the footer is the last element — is exactly the document
      // bottom (max scroll). "top top" is unreachable for footers shorter than
      // the viewport, so clamp() would cap it to a stale max-scroll value and
      // the scrub would freeze mid-way whenever the page height changed after
      // the last refresh. "bottom bottom" always resolves to max scroll, so
      // progress reliably reaches 1 even if measured before layout settled.
      ScrollTrigger.create({
        trigger: element,
        start: "clamp(top bottom)",
        end: "clamp(bottom bottom)",
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
