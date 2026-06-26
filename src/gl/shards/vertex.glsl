attribute float aPhase;
attribute float aHoverAmount;
attribute float aIntroAmount;

uniform float uTime;
uniform float uSwayPower;
uniform float uSwaySpeed;
uniform float uBladeHeight;
uniform float uIntroYOffset;

varying float vHoverAmount;
varying float vIntroAmount;

void main()
{
    vec3 pos = position;

    // pos.y runs from 0 at the base to uBladeHeight at the tip
    // (geometry pivot is translated to y=0 at the base).
    float heightRatio = clamp(pos.y / uBladeHeight, 0.0, 1.0);

    float phase = uTime * uSwaySpeed + aPhase * 6.2831;
    float sway = sin(phase) * uSwayPower * heightRatio;

    pos.x += sway;

    // Intro slide: blade starts offset by -uIntroYOffset in local Y and
    // slides back to zero as aIntroAmount goes 0 -> 1.
    pos.y -= (1.0 - aIntroAmount) * uIntroYOffset;

    vHoverAmount = aHoverAmount;
    vIntroAmount = aIntroAmount;

    csm_Position = pos;
}
