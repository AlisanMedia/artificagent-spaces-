# Spaces — architectural clarity

Implementation direction for the owner's 7 November 2026 request to add and use Impeccable. Refine the existing product; do not rebuild its architecture or invent live capabilities. The prior visual baseline supplies the brand, not a requirement to keep repetitive card layouts.

## Identity and tokens

Warm canvas `#F7F6F2`, white surface, ink `#192622`, supporting text `#58645D`, forest green `#0D624A`, sage `#E3EAE4`, border `#D9DFD9`, immersive media `#101916`. Champagne `#CAB58F` is decorative only. Tenant accent and accessible accent text remain authoritative for tenant actions. Use existing licensed, self-hosted Manrope UI and Newsreader sparingly; no remote fonts or new assets/services.

## Operate: studio

A compact sans-serif heading, stable navigation and step controls lead to one unmistakable upload action. Group upload, its explanation and the existing sample action. Present service choices at a useful density rather than equal-height marketing boxes. Existing form labels, error feedback, required rights, media ordering and independent review remain usable.

## Experience: showcase

One media-led composition, plain headings and a direct studio action. Actual local video, source/result comparison, synthetic 3D and licensed 360° panorama retain distinct provenance. Services with verified examples may lead with media. Services without examples use honest compact rows; no decorative stock image implies a result. Maintain source framing and aspect ratio.

## Rhythm and interaction

Use 4/8px spacing steps with clear compact/control/section groups, a content width around 1248px, mobile edges 16–20px. Small controls may have quiet outlines; avoid nested cards, repeated icon tiles, arbitrary all-caps labels and a single italic headline fragment on every section. Active state and primary action earn the green accent.

Feedback 140–200ms, primarily opacity/transform; no page-load choreography, forced waits, autoplay sound, infinite effects or automatic 3D rotation. Reduced motion disables decorative transitions. Desktop sections reflow structurally to mobile with DOM/focus order preserved.

## Verification

Retain keyboard focus, contrast, meaningful labels, native file picker, native dialog and range semantics. Check 375/390/430/768/1024/1280/1440 widths, upload-first visibility, no horizontal overflow, honest disabled states and actual MP4 playback. Verify existing RLS/review/consent/voice/partner/browser suites. Screenshots are real local captures; no human acceptance, Safari, deployment or generative media quality is inferred from them.
