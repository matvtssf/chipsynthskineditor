import * as DomUtils from '../core/domUtils.js';
import * as State from '../core/state.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function parseColor(attr, fallback) {
    return DomUtils.parseColor ? DomUtils.parseColor(attr || fallback || '#FF0000') : (attr || fallback || '#FF0000');
}

function findCurveParam(xmlNode, roleName) {
    if (!xmlNode) return null;
    // Look for child elements with matching role attribute inside the element itself
    let el = xmlNode.querySelector ? xmlNode.querySelector(`[role="${roleName}"]`) : null;
    if (el) return el;

    // If not found, search sibling nodes in the parent container
    const parent = xmlNode.parentNode;
    if (parent && parent.children) {
        for (const child of parent.children) {
            if (child !== xmlNode && child.getAttribute && child.getAttribute('role') === roleName) {
                return child;
            }
        }
    }
    return null;
}

function numericAttr(node, name, fallback = 0) {
    if (!node) return fallback;
    const v = node.getAttribute ? node.getAttribute(name) : null;
    const n = parseFloat(v);
    return isNaN(n) ? fallback : n;
}

export function render(tagName, xmlNode, parentHtmlElement, currentParams, sourcePath, mergedAttributes) {
    // Support only CS01CurveEditor
    if (tagName !== 'CS01CurveEditor') return null;

    const outer = document.createElement('div');
    outer.classList.add('gui-curve-editor');
    outer.style.position = 'absolute';
    outer.style.overflow = 'hidden';
    outer.style.boxSizing = 'border-box';

    const areaX = parseFloat(mergedAttributes['curveArea_x'] || mergedAttributes['curvearea_x'] || '0');
    const areaY = parseFloat(mergedAttributes['curveArea_y'] || mergedAttributes['curvearea_y'] || '0');
    const areaW = parseFloat(mergedAttributes['curveArea_w'] || mergedAttributes['curvearea_w'] || mergedAttributes['curveArea_w'] || mergedAttributes['w'] || '150');
    const areaH = parseFloat(mergedAttributes['curveArea_h'] || mergedAttributes['curvearea_h'] || mergedAttributes['curveArea_h'] || mergedAttributes['h'] || '60');

    const bgColor = parseColor(mergedAttributes['backgroundColor'] || mergedAttributes['backgroundcolor'] || mergedAttributes['background'] || '#00000000', 'transparent');
    outer.style.backgroundColor = bgColor;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', String(areaW));
    svg.setAttribute('height', String(areaH));
    svg.style.position = 'absolute';
    svg.style.left = areaX + 'px';
    svg.style.top = areaY + 'px';
    svg.style.overflow = 'visible';

    // Read vmin/vmax (value range for vertical mapping)
    const vmin = parseFloat(mergedAttributes['vmin'] || '0');
    const vmax = parseFloat(mergedAttributes['vmax'] || '1');

    // Locate parameter knobs under this node (expected roles per spec)
    // curveParameter_0 = Attack (time)
    // curveParameter_1 = Decay (time)
    // curveParameter_2 = Sustain (level)
    // curveParameter_3 = Decay2 (time)
    // curveParameter_4 = Release (time)
    const knobs = [];
    for (let i = 0; i < 5; i++) {
        knobs.push(findCurveParam(xmlNode, `curveParameter_${i}`));
    }

    function knobNumeric(k, attrName, fallback) {
        if (!k) return fallback;
        const a = k.getAttribute(attrName);
        const n = parseFloat(a);
        return isNaN(n) ? fallback : n;
    }

    // Resolve live value for a knob: prefer runtime State value from its `param` attr, fallback to XML 'value' or mid-range
    function knobLiveValue(k, defaultFallback) {
        if (!k) return defaultFallback;
        // Try to resolve its param id using DomUtils.getParamValue
        let pid = null;
        try {
            pid = DomUtils.getParamValue ? DomUtils.getParamValue(k, currentParams?.paramOffset || 0) : null;
        } catch (e) {
            pid = null;
        }
        if (pid && typeof State.getElementState === 'function') {
            const st = State.getElementState(pid);
            if (st !== undefined && st !== null) {
                const num = parseFloat(st);
                if (!isNaN(num)) return num;
                return st;
            }
        }
        // Fallback to explicit 'value' attribute
        const raw = k.getAttribute && k.getAttribute('value');
        if (raw !== null && raw !== undefined) {
            const nv = parseFloat(raw);
            if (!isNaN(nv)) return nv;
        }
        const defaultValue = k.getAttribute && k.getAttribute('vdefault');
        if (defaultValue !== null && defaultValue !== undefined) {
            const dv = parseFloat(defaultValue);
            if (!isNaN(dv)) return dv;
        }
        return defaultFallback;
    }

    // Extract parameter values and ranges
    const attackVal = knobLiveValue(knobs[0], knobNumeric(knobs[0], 'vmin', 0));
    const attackMin = knobNumeric(knobs[0], 'vmin', 0);
    const attackMax = knobNumeric(knobs[0], 'vmax', 1);

    const decayVal = knobLiveValue(knobs[1], knobNumeric(knobs[1], 'vmin', 0));
    const decayMin = knobNumeric(knobs[1], 'vmin', 0);
    const decayMax = knobNumeric(knobs[1], 'vmax', 1);

    const sustainVal = knobLiveValue(knobs[2], knobNumeric(knobs[2], 'vmin', (vmin + vmax) / 2));
    const sustainMin = knobNumeric(knobs[2], 'vmin', vmin);
    const sustainMax = knobNumeric(knobs[2], 'vmax', vmax);

    const decay2Val = knobLiveValue(knobs[3], knobNumeric(knobs[3], 'vmin', 0));
    const decay2Min = knobNumeric(knobs[3], 'vmin', 0);
    const decay2Max = knobNumeric(knobs[3], 'vmax', 1);

    const releaseVal = knobLiveValue(knobs[4], knobNumeric(knobs[4], 'vmin', 0));
    const releaseMin = knobNumeric(knobs[4], 'vmin', 0);
    const releaseMax = knobNumeric(knobs[4], 'vmax', 1);

    // Normalize times into positive durations
    function normTime(val, min, max) {
        const rng = Math.max(1e-6, max - min);
        return Math.max(0, (val - min) / rng);
    }

    const attackDur = normTime(attackVal, attackMin, attackMax) + 0.0001;
    const decayDur = normTime(decayVal, decayMin, decayMax) + 0.0001;
    const decay2Dur = normTime(decay2Val, decay2Min, decay2Max) + 0.0001;
    const releaseDur = normTime(releaseVal, releaseMin, releaseMax) + 0.0001;

    const totalTime = attackDur + decayDur + decay2Dur + releaseDur;

    // Compute x positions as cumulative times across the width
    const t0 = 0;
    const t1 = attackDur / totalTime;
    const t2 = (attackDur + decayDur) / totalTime;
    const t3 = (attackDur + decayDur + decay2Dur) / totalTime;
    const t4 = 1.0;

    const xPositions = [t0 * areaW, t1 * areaW, t2 * areaW, t3 * areaW, t4 * areaW];

    // Compute Y positions: start at vmin, attack peak at vmax, decay to sustain, sustain hold, release to vmin
    function valueToY(value) {
        const norm = (value - vmin) / Math.max(1e-6, vmax - vmin);
        return (1 - Math.max(0, Math.min(1, norm))) * areaH; // 0 = top
    }

    const sustainNorm = sustainMax > sustainMin ? ((sustainVal - sustainMin) / (sustainMax - sustainMin)) : 0;
    const sustainMapped = vmin + Math.max(0, Math.min(1, sustainNorm)) * (vmax - vmin);
    const yPositions = [];
    // Node 0 = start at bottom, Node1 = attack peak (top), Node2 = sustain level, Node3 = decay2 point (bottom), Node4 = release end (bottom)
    yPositions[0] = valueToY(vmin);
    yPositions[1] = valueToY(vmax);
    yPositions[2] = valueToY(sustainMapped);
    yPositions[3] = valueToY(vmin); // ensure decay2 lands at bottom so final segment is flat
    yPositions[4] = valueToY(vmin);

    // Ensure x positions are strictly increasing (avoid overlap) by nudging tiny amounts
    for (let i = 1; i < xPositions.length; i++) {
        if (xPositions[i] <= xPositions[i-1] + 0.5) {
            xPositions[i] = xPositions[i-1] + 0.5;
        }
    }

    // Determine if any knob is at max (use curveColor_1)
    const epsilon = 1e-6;
    const anyMaxed = (
        (attackVal >= attackMax - epsilon) ||
        (decayVal >= decayMax - epsilon) ||
        (sustainVal >= sustainMax - epsilon) ||
        (decay2Val >= decay2Max - epsilon) ||
        (releaseVal >= releaseMax - epsilon)
    );

    const curveColor = parseColor(anyMaxed ? (mergedAttributes['curveColor_1'] || mergedAttributes['curveColor1'] || mergedAttributes['curvecolor_1']) : (mergedAttributes['curveColor'] || mergedAttributes['curvecolor'] || mergedAttributes['curve_color']), '#D6332E');
    const curveWidth = parseFloat(mergedAttributes['curveWidth'] || mergedAttributes['curvewidth'] || mergedAttributes['curve_width'] || '2');

    // Helper to create cubic bezier control points
    function bezierCPoints(x1,y1,x2,y2,type) {
        const dx = x2 - x1;
        let cp1fac = 0.22;
        let cp2fac = 0.35;
        if (type === 'easeInOut') { cp1fac = 0.15; cp2fac = 0.35; }
        else if (type === 'easeOut') { cp1fac = 0.28; cp2fac = 0.12; }
        else if (type === 'easeIn') { cp1fac = 0.12; cp2fac = 0.35; }
        const cp1x = x1 + dx * cp1fac;
        const cp2x = x2 - dx * cp2fac;
        const cp1y = y1;
        const cp2y = y2;
        return {cp1x, cp1y, cp2x, cp2y};
    }

    // We'll draw via a function so we can redraw on state changes
    const segTypes = ['easeOut','easeIn','easeIn','linear'];

    function draw() {
        // clear children
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        // recompute live values in-case they changed
        const liveAttack = knobLiveValue(knobs[0], knobNumeric(knobs[0], 'vmin', 0));
        const liveDecay = knobLiveValue(knobs[1], knobNumeric(knobs[1], 'vmin', 0));
        const liveSustain = knobLiveValue(knobs[2], knobNumeric(knobs[2], 'vmin', (vmin + vmax) / 2));
        const liveDecay2 = knobLiveValue(knobs[3], knobNumeric(knobs[3], 'vmin', 0));
        const liveRelease = knobLiveValue(knobs[4], knobNumeric(knobs[4], 'vmin', 0));

        // recompute durations and x positions
        const aDur = normTime(liveAttack, attackMin, attackMax) + 0.0001;
        const dDur = normTime(liveDecay, decayMin, decayMax) + 0.0001;
        const d2Dur = normTime(liveDecay2, decay2Min, decay2Max) + 0.0001;
        const rDur = normTime(liveRelease, releaseMin, releaseMax) + 0.0001;
        const total = aDur + dDur + d2Dur + rDur;
        const xt0 = 0;
        const xt1 = aDur / total;
        const xt2 = (aDur + dDur) / total;
        const xt3 = (aDur + dDur + d2Dur) / total;
        const xt4 = 1.0;
        const xs = [xt0*areaW, xt1*areaW, xt2*areaW, xt3*areaW, xt4*areaW];

        // recompute y positions with updated sustain
        const liveSustainNorm = sustainMax > sustainMin ? ((liveSustain - sustainMin) / (sustainMax - sustainMin)) : 0;
        const liveSustainMapped = vmin + Math.max(0, Math.min(1, liveSustainNorm)) * (vmax - vmin);
        const ys = [];
        ys[0] = valueToY(vmin);
        ys[1] = valueToY(vmax);
        ys[2] = valueToY(liveSustainMapped);
        ys[3] = valueToY(vmin);
        ys[4] = valueToY(vmin);

        // enforce tiny spacing
        for (let i=1;i<xs.length;i++) { if (xs[i] <= xs[i-1] + 0.5) xs[i] = xs[i-1] + 0.5; }

        // determine per-segment max flags (attack->seg0, decay->seg1, decay2->seg2, release->seg3)
        const attackMaxed = (liveAttack >= attackMax - 1e-6);
        const decayMaxed = (liveDecay >= decayMax - 1e-6);
        const decay2Maxed = (liveDecay2 >= decay2Max - 1e-6);
        const releaseMaxed = (liveRelease >= releaseMax - 1e-6);

        const globalAnyMax = attackMaxed || decayMaxed || decay2Maxed || releaseMaxed || (liveSustain >= sustainMax - 1e-6);

        for (let si=0; si<4; si++) {
            const x1 = xs[si], y1 = ys[si], x2 = xs[si+1], y2 = ys[si+1];
            const dx = Math.abs(x2 - x1);
            const isVertical = dx < 1.0;

            // pick segment-specific "maxed" state
            let segMaxed = false;
            if (si === 0) segMaxed = attackMaxed;
            else if (si === 1) segMaxed = decayMaxed;
            else if (si === 2) segMaxed = decay2Maxed;
            else if (si === 3) segMaxed = releaseMaxed;

            const segColor = segMaxed ? parseColor(mergedAttributes['curveColor_1'] || mergedAttributes['curveColor1'] || mergedAttributes['curvecolor_1']) : parseColor(mergedAttributes['curveColor'] || mergedAttributes['curvecolor'] || mergedAttributes['curve_color']);

            const segPath = document.createElementNS(SVG_NS, 'path');
            let d = '';

            // If this segment is maxed, draw linear/solid (as in plugin visuals)
            const forceLinear = segMaxed || isVertical || segTypes[si] === 'linear' || si === 3;

            if (forceLinear) {
                // ensure last segment drawn flat at bottom
                if (si === 3) {
                    const ybot = valueToY(vmin);
                    d = `M ${x1.toFixed(2)} ${ybot.toFixed(2)} L ${x2.toFixed(2)} ${ybot.toFixed(2)}`;
                } else {
                    d = `M ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)}`;
                }
            } else {
                const cps = bezierCPoints(x1,y1,x2,y2,segTypes[si]);
                d = `M ${x1.toFixed(2)} ${y1.toFixed(2)} C ${cps.cp1x.toFixed(2)} ${cps.cp1y.toFixed(2)} ${cps.cp2x.toFixed(2)} ${cps.cp2y.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
            }

            segPath.setAttribute('d', d);
            segPath.setAttribute('fill','none');
            segPath.setAttribute('stroke', segColor || '#D6332E');

            if (isVertical && !segMaxed) {
                segPath.setAttribute('stroke-width', '1');
                segPath.setAttribute('stroke-dasharray', '2,2');
                segPath.setAttribute('stroke-linecap', 'butt');
            } else {
                segPath.setAttribute('stroke-width', String(curveWidth));
                segPath.setAttribute('stroke-linecap', segMaxed ? 'butt' : 'round');
                segPath.setAttribute('stroke-linejoin', 'round');
            }

            // if seg is maxed ensure no dash
            if (segMaxed) segPath.removeAttribute('stroke-dasharray');

            svg.appendChild(segPath);
        }

        // draw handles
        const handleTypeLocal = parseInt(mergedAttributes['handleType'] || '0', 10);
        if (handleTypeLocal === 0) {
            const handleW = parseFloat(mergedAttributes['handle_w'] || '4');
            const handleH = parseFloat(mergedAttributes['handle_h'] || '4');
            const baseHandleColor = parseColor(mergedAttributes['handleColor'] || mergedAttributes['handlecolor'] || mergedAttributes['handle_color'] || '#8A858B');
            const altHandleColor = parseColor(mergedAttributes['handleColor_1'] || mergedAttributes['handlecolor_1'] || mergedAttributes['handleColor1'] || baseHandleColor);
            const chosenHandleColor = globalAnyMax ? altHandleColor : baseHandleColor;
            const handleRadius = Math.max(1, Math.min(handleW, handleH) / 2);
            for (let i=0;i<5;i++) {
                const cx = xs[i];
                const cy = ys[i];
                const circle = document.createElementNS(SVG_NS, 'circle');
                circle.setAttribute('cx', String(cx));
                circle.setAttribute('cy', String(cy));
                circle.setAttribute('r', String(handleRadius));
                circle.setAttribute('fill', chosenHandleColor);
                svg.appendChild(circle);
            }
        }
    }

    // initial draw
    draw();

    // prepare param id list for live update subscriptions
    const knobParamIds = knobs.map(k => k ? (DomUtils.getParamValue ? DomUtils.getParamValue(k, currentParams?.paramOffset || 0) : null) : null).filter(Boolean);

    const postProcessFunctionLocal = (element, attrs) => {
        const handler = (ev) => {
            try {
                const changedId = String(ev.detail.elementId);
                console.debug(`[curveEditor] elementStateChanged received: ${changedId}; subscribed knobs=${JSON.stringify(knobParamIds)}`);
                const matched = knobParamIds.includes(changedId);
                console.debug(`[curveEditor] matching result for ${changedId}: ${matched}`);
                if (matched) {
                    console.debug(`[curveEditor] matched param ${changedId}, redrawing curve`);
                    draw();
                }
            } catch (e) { console.warn('[curveEditor] elementStateChanged handler error', e); }
        };
        document.addEventListener('elementStateChanged', handler);
        // store cleanup so other systems can remove listener if needed
        element._curveEditorCleanup = () => document.removeEventListener('elementStateChanged', handler);
    };

    outer.appendChild(svg);

        return {
            htmlElement: outer,
            mainElementForAttributes: outer,
            requiresRecursiveRender: true,
            postProcessFunction: postProcessFunctionLocal
        };
}
