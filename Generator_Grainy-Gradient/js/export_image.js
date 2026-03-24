// EXPORT IMAGE
// Three-step export strategy:
//
//   Step 1 — Font embedding: the DINishDot font is fetched, converted to a
//             base64 data URL, and injected as an inline <style> element.
//             This is necessary because dom-to-image-more serializes the DOM
//             inside an SVG foreignObject where relative @font-face URLs no
//             longer resolve — the browser falls back to the default font.
//             A data URL is self-contained and always resolves correctly.
//
//   Step 2 — dom-to-image-more captures the scene into a PNG data URL.
//             This library renders the DOM inside an SVG foreignObject, so the
//             browser itself handles compositing — meaning filter: contrast()
//             on the parent and filter: blur() on the child (the gooey effect)
//             are correctly reproduced. The grain div is hidden during this
//             pass because SVG feTurbulence inside a foreignObject does not
//             serialize correctly and would produce an inconsistent result.
//
//   Step 3 — the grain SVG is serialized to a blob URL, loaded as an <img>,
//             and drawn on top of the captured canvas with soft-light
//             compositing at 0.35 opacity — matching the CSS exactly.
//             Browsers correctly render feTurbulence when an SVG is used as
//             an image source (unlike inside foreignObject).

// Fetches a font file and returns it as a base64 data URL.
// This is used to embed the font directly into the cloned document so that
// dom-to-image-more can access it inside the SVG foreignObject context.
async function fetchFontAsDataUrl(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Creates a temporary <a> element to trigger a PNG download from a canvas.
function triggerDownload(canvas) {
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'composition.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

document.getElementById('downloadBtn').addEventListener('click', async () => {
    const scene = document.getElementById('scene');
    const grain = document.getElementById('grain');

    // Read the body background so the export matches what is visible in the browser.
    // .scene has no background of its own (gradient is currently disabled),
    // so without an explicit bgcolor the export would show a black background.
    const bodyBg = getComputedStyle(document.body).backgroundColor;

    const w = scene.offsetWidth;
    const h = scene.offsetHeight;

    // --- Step 1: embed font as data URL ---

    // Path is relative to index.html (the CSS uses ../ because it lives in css/)
    const fontDataUrl = await fetchFontAsDataUrl('DINishDot_test/DINishDot-Bold.otf');

    // Inject an inline @font-face with the data URL so dom-to-image-more picks it up
    const embeddedFontStyle = document.createElement('style');
    embeddedFontStyle.textContent = `
        @font-face {
            font-family: DINishDot;
            src: url('${fontDataUrl}');
            font-style: normal;
            font-weight: bold;
        }
    `;
    document.head.appendChild(embeddedFontStyle);

    // --- Step 2: capture scene without grain via dom-to-image-more ---

    // Hide grain so dom-to-image-more ignores it entirely
    grain.style.visibility = 'hidden';

    try {
        const dataUrl = await domtoimage.toPng(scene, {
            bgcolor: bodyBg,
            width: w,
            height: h,
            style: { backgroundColor: bodyBg }
        });

        // Restore grain and remove the temporary font style
        grain.style.visibility = '';
        document.head.removeChild(embeddedFontStyle);

        // --- Step 3: composite the grain SVG on top ---

        const sceneImg = new Image();
        sceneImg.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');

            // Draw the captured scene as the base layer
            ctx.drawImage(sceneImg, 0, 0);

            // Guard: if the grain SVG is not in the DOM, skip grain compositing
            const svgEl = grain.querySelector('svg');
            if (!svgEl) {
                triggerDownload(canvas);
                return;
            }

            // Serialize the SVG grain element to a blob.
            // The browser renders feTurbulence correctly when loading SVG as an img src.
            const svgString = new XMLSerializer().serializeToString(svgEl);
            const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const svgUrl = URL.createObjectURL(svgBlob);

            const grainImg = new Image();
            grainImg.onload = () => {
                // Match the blend mode and opacity set in CSS on #grain
                ctx.globalCompositeOperation = 'soft-light';
                ctx.globalAlpha = 0.35;
                ctx.drawImage(grainImg, 0, 0, w, h);

                // Reset compositing state before export
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = 1;

                URL.revokeObjectURL(svgUrl);
                triggerDownload(canvas);
            };

            grainImg.onerror = () => {
                // Grain compositing failed — export scene without grain
                console.warn('Grain SVG could not be loaded as image, exporting without grain.');
                URL.revokeObjectURL(svgUrl);
                triggerDownload(canvas);
            };

            grainImg.src = svgUrl;
        };

        sceneImg.src = dataUrl;

    } catch (err) {
        // Clean up in case of error so the page is not left in a broken state
        grain.style.visibility = '';
        if (document.head.contains(embeddedFontStyle)) {
            document.head.removeChild(embeddedFontStyle);
        }
        console.error('Export failed:', err);
    }
});
