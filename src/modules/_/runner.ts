/*

mount()
destroy()

pageIn()
pageOut()

view()
track()


*/

import { Observe, ObserveConfig, Track } from "@/modules/_";
import { Resize } from "@/lib/subs";

/** -- <stores> */
const destroy: Array<() => void> = [];
const mount: Array<() => void> = [];

/** -- <lifecycle> */
export function onMount(fn: () => void) {
  mount.push(fn);
}

export function onDestroy(fn: () => void) {
  destroy.push(fn);
}

export function runDestroy() {
  destroy.forEach((fn) => fn());
  destroy.length = 0;
  //   console.log("destroy -> []", destroy);
}

export function runMount() {
  mount.forEach((fn) => fn());
  mount.length = 0;
  //   console.log("mount -> []", mount);
}

/** -- <animation> */
const pageOut: Array<() => Promise<void>> = [];
const pageIn: Array<() => Promise<void>> = [];

export function onPageOut(
  fn: () => Promise<void>,
  { element }: { element?: HTMLElement } = {}
) {
  if (element) {
    pageOut.push(async () => {
      const rect = element.getBoundingClientRect();
      const isCurrentlyVisible = rect.top < Resize.height && rect.bottom > 0;
      return isCurrentlyVisible ? await fn() : Promise.resolve();
    });
  } else {
    pageOut.push(fn);
  }
}

export async function runPageOut() {
  await Promise.allSettled(pageOut.map((fn) => fn()));
  pageOut.length = 0;
  //   console.log("page -> []", page);
}

export function onPageIn(fn: () => Promise<void>) {
  pageIn.push(fn);
}

export async function runPageIn() {
  await Promise.allSettled(pageIn.map((fn) => fn()));
  pageIn.length = 0;
}

export function onView(
  element: HTMLElement,
  { root, rootMargin, threshold, autoStart, once, callback }: ObserveConfig
) {
  const observer = new Observe(element, {
    root,
    rootMargin,
    threshold,
    autoStart,
    once,
    callback,
  });

  onDestroy(() => {
    observer.destroy();
  });

  return observer;
}

export function onTrack(
  element: HTMLElement,
  config: {
    bounds?: [number, number];
    top?: "top" | "center" | "bottom";
    bottom?: "top" | "center" | "bottom";
    callback?: (value: number) => void;
  } = {}
) {
  const track = new Track(element, config);

  onDestroy(() => {
    track.destroy();
  });

  return track;
}
