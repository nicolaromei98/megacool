import gsap, { reduced } from "@lib/gsap";
import { Scroll } from "@lib/scroll";
import { Resize } from "@lib/subs";
import { onMount, onDestroy } from "@/modules/_";
import { clamp, toNumber } from "@utils/math";
import { handleEditor } from "@webflow/detect-editor";

const DESKTOP_MQ = "(min-width: 992px) and (min-height: 701px)";

/**
 * data-module="partnership" on .partner-track. Designer: data-debug + editor.css (or embed CSS below)
 *
 * Optional linked target stack:
 * When accordions carry data-trigger="1..n" and there are sibling elements with
 * data-target="1..n" (stacked vertically inside an overflow:hidden container),
 * opening the accordion with data-trigger=V slides the matching data-target=V
 * into view. data-target=1 is the initial visible one; the stack moves upward.
 * data-duration / data-ease tune the slide. Without these attributes the
 * accordion behaves exactly as before.
 */
export default function (element: HTMLElement, dataset: DOMStringMap) {
  const items = Array.from(
    element.querySelectorAll<HTMLElement>(".accordion")
  );

  if (!items.length) return;

  const desktopMq = window.matchMedia(DESKTOP_MQ);
  const count = items.length;

  // --- Optional linked target stack --------------------------------------
  const targets = new Map<string, HTMLElement>();
  element.querySelectorAll<HTMLElement>("[data-target]").forEach((el) => {
    const key = el.dataset.target;
    if (key && !targets.has(key)) targets.set(key, el);
  });

  const targetEls = Array.from(targets.values());
  const hasTargets =
    targetEls.length > 0 && items.some((it) => it.dataset.trigger != null);

  const slideDuration = toNumber(dataset.duration, 0.9);
  const slideEase = dataset.ease || "expo.out";

  const positionTargets = (value?: string, animate = true) => {
    if (!hasTargets) return;
    const target = value != null ? targets.get(value) : undefined;
    const base = targetEls[0].offsetTop;
    const y = target ? -(target.offsetTop - base) : 0;
    if (animate && !reduced) {
      gsap.to(targetEls, { y, duration: slideDuration, ease: slideEase, overwrite: true });
    } else {
      gsap.set(targetEls, { y });
    }
  };

  let started = false;
  let isEditor = false;
  let activeIndex = -1;
  let unsubScroll: (() => void) | null = null;
  let unsubResize: (() => void) | null = null;

  const setAllOpen = (open: boolean) => {
    activeIndex = -1;
    items.forEach((it) => it.classList.toggle("is-open", open));
    positionTargets(undefined);
  };

  const setActive = (index: number) => {
    if (index === activeIndex) return;
    activeIndex = index;
    items.forEach((it, i) => it.classList.toggle("is-open", i === index));
    positionTargets(items[index]?.dataset.trigger);
  };

  const updateDesktop = () => {
    const rect = element.getBoundingClientRect();
    const scrollRoom = rect.height - Resize.height;
    if (scrollRoom <= 0) return;

    const progress = clamp(0, 0.999, (-rect.top) / scrollRoom);
    setActive(Math.floor(progress * count));
  };

  const applyMode = () => {
    activeIndex = -1;
    if (!desktopMq.matches) setAllOpen(true);
    else updateDesktop();
  };

  const onScroll = () => {
    if (!desktopMq.matches) return;
    updateDesktop();
  };

  const start = () => {
    if (started) return;
    started = true;

    desktopMq.addEventListener("change", applyMode);
    unsubScroll = Scroll.add(onScroll);
    unsubResize = Resize.add(applyMode);
    applyMode();
  };

  const stop = () => {
    if (!started) return;
    started = false;
    desktopMq.removeEventListener("change", applyMode);
    unsubScroll?.();
    unsubResize?.();
    unsubScroll = null;
    unsubResize = null;
    if (hasTargets) gsap.set(targetEls, { clearProps: "transform" });
  };

  const debug = element.hasAttribute("data-debug");

  handleEditor((editor) => {
    isEditor = editor;
    stop();
    if (editor) setAllOpen(debug);
    else start();
  });

  onMount(() => {
    if (!isEditor) start();
    else if (debug) setAllOpen(true);
  });

  onDestroy(() => stop());
}
