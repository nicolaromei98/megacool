import gsap, { reduced } from "@lib/gsap";
import { Resize } from "@lib/subs";
import { onMount, onDestroy } from "@/modules/_";
import { toNumber } from "@utils/math";
import { handleEditor } from "@webflow/detect-editor";

const DEFAULT_TICK_SELECTOR = ".sm__tick";
const DEFAULT_FROM = "#e8503a";
const DEFAULT_TO = "#3ab3a3";

const getVisibleTicks = (element: HTMLElement, selector: string) =>
  Array.from(element.querySelectorAll<HTMLElement>(selector)).filter(
    (tick) => tick.offsetParent !== null
  );

/**
 * Paints a horizontal color gradient on visible ticks and runs a shared
 * opacity pulse animation.
 *
 * data-module="tick-gradient" on the ticks wrapper.
 * Ticks: `.sm__tick` (or data-tick-selector=".custom-tick").
 *
 * Optional: data-from="#e8503a", data-to="#3ab3a3", data-pulse-duration="1.2"
 */
export default function (element: HTMLElement, dataset: DOMStringMap) {
  const tickSelector = dataset.tickSelector || DEFAULT_TICK_SELECTOR;
  const from = dataset.from || DEFAULT_FROM;
  const to = dataset.to || DEFAULT_TO;
  const pulseDuration = toNumber(dataset.pulseDuration, 1.2);

  let isEditor = false;
  let started = false;
  let pulseTween: gsap.core.Tween | null = null;
  let unsubResize: (() => void) | null = null;

  const paintGradient = () => {
    const ticks = getVisibleTicks(element, tickSelector);
    const last = ticks.length - 1;

    ticks.forEach((tick, index) => {
      const ratio = last > 0 ? index / last : 0;
      tick.style.setProperty(
        "--tick-glow",
        gsap.utils.interpolate(from, to, ratio) as string
      );
    });
  };

  const startPulse = () => {
    if (pulseTween || isEditor || reduced) return;

    const ticks = getVisibleTicks(element, tickSelector);
    if (!ticks.length) return;

    pulseTween = gsap.to(ticks, {
      opacity: 1,
      duration: pulseDuration,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
    });
  };

  const stopPulse = () => {
    pulseTween?.kill();
    pulseTween = null;

    element.querySelectorAll<HTMLElement>(tickSelector).forEach((tick) => {
      gsap.killTweensOf(tick);
      gsap.set(tick, { clearProps: "opacity" });
    });
  };

  const resetGradient = () => {
    element
      .querySelectorAll<HTMLElement>(tickSelector)
      .forEach((tick) => tick.style.removeProperty("--tick-glow"));
  };

  const start = () => {
    if (started) {
      paintGradient();
      startPulse();
      return;
    }

    started = true;
    paintGradient();
    startPulse();
    unsubResize = Resize.add(paintGradient);
  };

  const stop = () => {
    if (!started) return;
    started = false;

    unsubResize?.();
    unsubResize = null;
    stopPulse();
    resetGradient();
  };

  handleEditor((editor) => {
    isEditor = editor;
    if (editor || reduced) {
      stopPulse();
      paintGradient();
      return;
    }

    start();
  });

  onMount(() => {
    if (!isEditor && !reduced) start();
    else paintGradient();
  });

  onDestroy(() => stop());
}
