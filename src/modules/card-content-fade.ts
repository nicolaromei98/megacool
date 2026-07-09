import gsap, { reduced } from "@lib/gsap";
import { Scroll } from "@lib/scroll";
import { Resize } from "@lib/subs";
import { onMount, onDestroy } from "@/modules/_";
import { clamp, map, toNumber } from "@utils/math";
import { handleEditor } from "@webflow/detect-editor";

const TRIGGER_SELECTOR = "[data-card-trigger]";
const CONTENT_SELECTOR = "[data-card-content]";

export default function (element: HTMLElement, dataset: DOMStringMap) {
  const trigger =
    element.querySelector<HTMLElement>(TRIGGER_SELECTOR) ??
    (dataset.trigger
      ? element.querySelector<HTMLElement>(dataset.trigger)
      : null);

  const contents = Array.from(
    element.querySelectorAll<HTMLElement>(CONTENT_SELECTOR)
  );

  if (!trigger || !contents.length) return;

  const endVh = toNumber(dataset.endVh, 20) / 100;
  const fadeAmount = toNumber(dataset.fade, 0.5);

  let started = false;
  let isEditor = false;
  let unsubScroll: (() => void) | null = null;
  let unsubResize: (() => void) | null = null;
  let lastProgress = -1;

  const render = () => {
    const endTop = Resize.height * endVh;
    const progress = clamp(
      0,
      1,
      map(trigger.getBoundingClientRect().top, Resize.height, endTop, 0, 1)
    );

    if (progress === lastProgress) return;
    lastProgress = progress;

    const opacity = 1 - progress * fadeAmount;
    contents.forEach((el) => gsap.set(el, { opacity }));
  };

  const reset = () => {
    contents.forEach((el) => gsap.set(el, { clearProps: "opacity" }));
    lastProgress = -1;
  };

  const start = () => {
    if (started) return;
    started = true;
    render();
    unsubScroll = Scroll.add(render);
    unsubResize = Resize.add(render);
  };

  const stop = () => {
    if (!started) return;
    started = false;
    unsubScroll?.();
    unsubResize?.();
    unsubScroll = null;
    unsubResize = null;
    reset();
  };

  handleEditor((editor) => {
    isEditor = editor;
    if (editor || reduced) stop();
    else start();
  });

  onMount(() => {
    if (!isEditor && !reduced) start();
  });

  onDestroy(() => stop());
}
