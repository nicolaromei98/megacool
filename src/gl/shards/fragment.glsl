uniform vec3 uHighlightColor;
uniform float uHighlightPower;

varying float vHoverAmount;
varying float vIntroAmount;

void main()
{
    // Hover highlight — additive emissive boost on top of the base
    // MeshStandardMaterial.
    csm_Emissive += uHighlightColor * vHoverAmount * uHighlightPower;

    // Intro fade: real alpha. The material is `transparent: true` with
    // `alphaTest: 0.01`, so fully-invisible blades are discarded and don't
    // write depth (DoF stays correct).
    csm_DiffuseColor.a *= vIntroAmount;
    csm_Emissive *= vIntroAmount;
}
