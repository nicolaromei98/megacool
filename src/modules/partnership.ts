import { Scroll } from "@lib/scroll";
import { Resize } from "@lib/subs";
import { onMount, onDestroy } from "@/modules/_";
import { clamp } from "@utils/math";
import { handleEditor } from "@webflow/detect-editor";

const DESKTOP_MQ = "(min-width: 992px) and (min-height: 701px)";

/** data-module="partnership" on .partner-track. Designer: data-debug + editor.css (or embed CSS below) */
export default function (element: HTMLElement, _dataset: DOMStringMap) {
  const items = Array.from(
    element.querySelectorAll<HTMLElement>(".accordion")
  );

  if (!items.length) return;

  const desktopMq = window.matchMedia(DESKTOP_MQ);
  const count = items.length;

  let started = false;
  let isEditor = false;
  let activeIndex = -1;
  let unsubScroll: (() => void) | null = null;
  let unsubResize: (() => void) | null = null;

  const setAllOpen = (open: boolean) => {
    activeIndex = -1;
    items.forEach((it) => it.classList.toggle("is-open", open));
  };

  const setActive = (index: number) => {
    if (index === activeIndex) return;
    activeIndex = index;
    items.forEach((it, i) => it.classList.toggle("is-open", i === index));
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
