import gsap, { reduced, ScrollTrigger } from "@lib/gsap";
import { initScrollTrigger } from "@lib/scroll";
import { onMount, onDestroy } from "@/modules/_";
import { toNumber } from "@utils/math";
import { handleEditor } from "@webflow/detect-editor";

const NESTED_SELECTOR = "[data-reveal-nested], [data-reveal-group-nested]";
const ANIM_DURATION = 0.8;
const ANIM_EASE = "power4.inOut";

type ItemSlot = { type: "item"; el: HTMLElement };
type NestedSlot = {
  type: "nested";
  parentEl: HTMLElement;
  nestedEl: HTMLElement;
  includeParent: boolean;
  nestedChildren: HTMLElement[];
};
type Slot = ItemSlot | NestedSlot;

const getElementChildren = (el: HTMLElement) =>
  Array.from(el.children).filter(
    (child): child is HTMLElement => child.nodeType === 1
  );

const findNestedGroup = (child: HTMLElement) => {
  if (child.matches(NESTED_SELECTOR)) return child;
  return child.querySelector<HTMLElement>(`:scope ${NESTED_SELECTOR}`);
};

const resetVisible = (groupEl: HTMLElement) => {
  gsap.set(groupEl, { clearProps: "all", y: 0, autoAlpha: 1 });
  groupEl.querySelectorAll<HTMLElement>("*").forEach((node) => {
    gsap.set(node, { clearProps: "all", y: 0, autoAlpha: 1 });
  });
};

const buildSlots = (groupEl: HTMLElement): Slot[] => {
  const slots: Slot[] = [];

  getElementChildren(groupEl).forEach((child) => {
    const nestedGroup = findNestedGroup(child);

    if (nestedGroup) {
      const includeParent =
        child.getAttribute("data-ignore") !== "true" &&
        (child.getAttribute("data-ignore") === "false" ||
          nestedGroup.getAttribute("data-ignore") === "false");

      const nestedChildren = getElementChildren(nestedGroup).filter(
        (el) => el.getAttribute("data-ignore") !== "true"
      );

      slots.push({
        type: "nested",
        parentEl: child,
        nestedEl: nestedGroup,
        includeParent,
        nestedChildren,
      });
    } else {
      if (child.getAttribute("data-ignore") === "true") return;
      slots.push({ type: "item", el: child });
    }
  });

  return slots;
};

const setHiddenState = (slots: Slot[], groupDistance: string) => {
  slots.forEach((slot) => {
    if (slot.type === "item") {
      const isNestedSelf = slot.el.matches(NESTED_SELECTOR);
      const distance = isNestedSelf
        ? groupDistance
        : slot.el.getAttribute("data-distance") || groupDistance;
      gsap.set(slot.el, { y: distance, autoAlpha: 0 });
      return;
    }

    if (slot.includeParent) {
      gsap.set(slot.parentEl, { y: groupDistance, autoAlpha: 0 });
    }

    const nestedDistance =
      slot.nestedEl.getAttribute("data-distance") || groupDistance;
    slot.nestedChildren.forEach((target) =>
      gsap.set(target, { y: nestedDistance, autoAlpha: 0 })
    );
  });

  slots.forEach((slot) => {
    if (slot.type === "nested" && slot.includeParent) {
      gsap.set(slot.parentEl, { y: groupDistance });
    }
  });
};

const revealGroup = (groupEl: HTMLElement, dataset: DOMStringMap) => {
  const groupStaggerSec = toNumber(dataset.stagger, 100) / 1000;
  const groupDistance = dataset.distance || "2em";

  // clamp() keeps the start reachable for groups near the bottom of the
  // page (e.g. the footer) — without it the trigger position can sit beyond
  // the max scroll, onEnter never fires, and the content stays hidden.
  const rawStart = dataset.start || "top 80%";
  const triggerStart = rawStart.includes("clamp")
    ? rawStart
    : `clamp(${rawStart})`;

  if (reduced) {
    resetVisible(groupEl);
    return;
  }

  const directChildren = getElementChildren(groupEl);

  if (!directChildren.length) {
    gsap.set(groupEl, { y: groupDistance, autoAlpha: 0 });
    ScrollTrigger.create({
      trigger: groupEl,
      start: triggerStart,
      once: true,
      onEnter: () =>
        gsap.to(groupEl, {
          y: 0,
          autoAlpha: 1,
          duration: ANIM_DURATION,
          ease: ANIM_EASE,
          onComplete: () => gsap.set(groupEl, { clearProps: "all" }),
        }),
    });
    return;
  }

  const slots = buildSlots(groupEl);
  setHiddenState(slots, groupDistance);

  ScrollTrigger.create({
    trigger: groupEl,
    start: triggerStart,
    once: true,
    onEnter: () => {
      const tl = gsap.timeline();

      slots.forEach((slot, slotIndex) => {
        const slotTime = slotIndex * groupStaggerSec;

        if (slot.type === "item") {
          tl.to(
            slot.el,
            {
              y: 0,
              autoAlpha: 1,
              duration: ANIM_DURATION,
              ease: ANIM_EASE,
              onComplete: () => gsap.set(slot.el, { clearProps: "all" }),
            },
            slotTime
          );
          return;
        }

        if (slot.includeParent) {
          tl.to(
            slot.parentEl,
            {
              y: 0,
              autoAlpha: 1,
              duration: ANIM_DURATION,
              ease: ANIM_EASE,
              onComplete: () =>
                gsap.set(slot.parentEl, { clearProps: "all" }),
            },
            slotTime
          );
        }

        const nestedMs = parseFloat(slot.nestedEl.getAttribute("data-stagger") ?? "");
        const nestedStaggerSec = Number.isFinite(nestedMs)
          ? nestedMs / 1000
          : groupStaggerSec;

        slot.nestedChildren.forEach((nestedChild, nestedIndex) => {
          tl.to(
            nestedChild,
            {
              y: 0,
              autoAlpha: 1,
              duration: ANIM_DURATION,
              ease: ANIM_EASE,
              onComplete: () =>
                gsap.set(nestedChild, { clearProps: "all" }),
            },
            slotTime + nestedIndex * nestedStaggerSec
          );
        });
      });
    },
  });
};

/**
 * Scroll-triggered staggered reveal for a group and its children.
 *
 * data-module="content-reveal" on the group wrapper (replaces data-reveal-group).
 *
 * Group options: data-stagger="100" (ms), data-distance="2em", data-start="top 80%"
 * Nested layer: data-reveal-nested (or data-reveal-group-nested)
 * Skip element: data-ignore="true" | include parent: data-ignore="false"
 * Per-child distance: data-distance on the child
 */
export default function (element: HTMLElement, dataset: DOMStringMap) {
  let ctx: gsap.Context | null = null;
  let isEditor = false;

  const start = () => {
    if (isEditor || reduced) {
      resetVisible(element);
      return;
    }

    initScrollTrigger();
    ctx?.revert();
    ctx = gsap.context(() => revealGroup(element, dataset), element);
    requestAnimationFrame(() => ScrollTrigger.refresh());
  };

  const stop = () => {
    ctx?.revert();
    ctx = null;
    resetVisible(element);
  };

  handleEditor((editor) => {
    isEditor = editor;
    if (editor) stop();
    else start();
  });

  onMount(() => start());
  onDestroy(() => stop());
}
