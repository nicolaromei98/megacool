import Lenis from "lenis";
import gsap, { ScrollTrigger } from "./gsap";
import { Resize } from "@lib/subs";
import { handleEditor } from "@webflow/detect-editor";

type SubscriberFn = (data: any) => void;

// (*) TODO: disable on webflow editor

const SCROLL_CONFIG = {
  infinite: false,
  lerp: 0.1,
  smoothWheel: true,
  touchMultiplier: 2,
  // autoResize: true,
};

let scrollTriggerReady = false;

/** Wire ScrollTrigger to Lenis — safe to call multiple times. */
export function initScrollTrigger() {
  if (scrollTriggerReady) return;
  scrollTriggerReady = true;

  ScrollTrigger.scrollerProxy(document.documentElement, {
    scrollTop(value) {
      if (arguments.length) {
        Scroll.scrollTo(value, { immediate: true });
      }
      return Scroll.scroll;
    },
    getBoundingClientRect() {
      return {
        top: 0,
        left: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      };
    },
  });

  Scroll.on("scroll", ScrollTrigger.update);
  ScrollTrigger.addEventListener("refresh", () => Scroll.resize());
  Resize.add(() => ScrollTrigger.refresh());
}

class _Scroll extends Lenis {
  #ticker = gsap.ticker.add((time) => this.raf(time * 1000));

  constructor() {
    super(SCROLL_CONFIG);
    this.on("scroll", this.#scroll.bind(this));
  }

  #scroll(data: any) {
    // console.log("scroll", { scroll, limit, progress, velocity, time });
    this.notify(data);
  }

  toTop() {
    this.scrollTo(0, {
      immediate: true,
    });
  }

  /** Subscribable */
  #subscribers: { fn: SubscriberFn; priority: number; id: symbol }[] = [];

  add(fn: SubscriberFn, priority = 0, id = Symbol()) {
    const index = this.#subscribers.findIndex((sub) => sub.priority > priority);
    if (index === -1) {
      this.#subscribers.push({ fn, priority, id });
    } else {
      this.#subscribers.splice(index, 0, { fn, priority, id });
    }
    return () => this.remove(id);
  }

  remove(id: symbol) {
    this.#subscribers = this.#subscribers.filter((f) => f.id !== id);
  }

  notify(data: any) {
    if (this.#subscribers.length < 1) return;
    this.#subscribers.forEach((f) => f.fn(data));
  }
}

export const Scroll = new _Scroll();

handleEditor((isEditor) => {
  if (isEditor) {
    Scroll.destroy();
  } else {
    Scroll.start();
    initScrollTrigger();
    requestAnimationFrame(() => ScrollTrigger.refresh());
  }
});
