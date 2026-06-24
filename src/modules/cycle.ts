import { Raf } from "@/lib/subs";
import {
  onMount,
  onDestroy,
  onPageOut,
  onView,
  onTrack,
  onPageIn,
} from "@/modules/_";
import gsap from "@lib/gsap";
// import { Raf, Resize } from "@/lib/subs";/
import State from "@lib/hey";

import { Scroll } from "@lib/scroll";

export default function (element: HTMLElement, dataset: DOMStringMap) {
  // console.log("cycle", element);
  // State.on("something", () => {})
  // ;

  State.on("SOMETHING", (data) => {
    console.log("something", data);
  });

  onPageIn(async () => {
    // console.log("onPageIn");
    await gsap.to(element, {
      duration: 0.2,
      backgroundColor: "green",
    });
  });

  onPageOut(
    async () => {
      // console.log("onPageOut");
      await gsap.to(element, {
        duration: 1,
        backgroundColor: "blue",
      });

      await gsap.to(element, {
        duration: 1,
        autoAlpha: 0,
      });
    },
    {
      element,
    }
  );

  onMount(() => {
    // element.style.backgroundColor = "red";
    // console.log("onMount");
    // observer.start();
  });

  // const observer = onView(element, {
  //   root: null,
  //   rootMargin: "0px",
  //   threshold: 0.1,
  //   autoStart: false,
  //   once: false,
  //   callback: ({ isIn, direction }) => {
  //     console.log("inView", isIn, direction);
  //   },
  // });

  // const track = onTrack(element, {
  //   bounds: [0, 1],
  //   top: "bottom",
  //   bottom: "top",
  //   callback: (value) => {
  //     console.log("^^", value);
  //   },
  // });

  onDestroy(() => {});

  // return () => {};
}
