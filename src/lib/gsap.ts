import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { prefersReducedMotion } from "@/utils/media";

gsap.registerPlugin(ScrollTrigger);

const defaults = {
  ease: "expo.out",
  duration: 1.2,
};

gsap.defaults(defaults);

const reduced = prefersReducedMotion();

export default gsap;
export { defaults, reduced, ScrollTrigger, SplitText };
