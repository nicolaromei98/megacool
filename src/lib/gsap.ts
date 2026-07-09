import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { CustomEase } from "gsap/CustomEase";
import { prefersReducedMotion } from "@/utils/media";

gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);

// Registered once here so any module can reference the ease by name ("punch").
CustomEase.create("punch", "M0,0 C0.19,1 0.22,1 1,1");

const defaults = {
  ease: "expo.out",
  duration: 1.2,
};

gsap.defaults(defaults);

const reduced = prefersReducedMotion();

export default gsap;
export { defaults, reduced, ScrollTrigger, SplitText, CustomEase };
