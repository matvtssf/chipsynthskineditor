// File: cs/renderers/drawRenderer.js
import * as DomUtils from '../core/domUtils.js';
import * as State from '../core/state.js';

const SVG_NS = "http://www.w3.org/2000/svg";

function renderRect(xmlNode, mergedAttributes) {
    const htmlElement = document.createElement('div');
    htmlElement.classList.add('gui-rect');
    
    // Restore masking/clipping capabilities for rectangles
    if (mergedAttributes['mask'] === '1' || mergedAttributes['clip'] === '1') {
        htmlElement.style.overflow = 'hidden';
    }

    // Force exact border sizing so it doesn't break CSS box models
    htmlElement.style.boxSizing = 'border-box';

    return {
        htmlElement: htmlElement,
        mainElementForAttributes: htmlElement,
        requiresRecursiveRender: true, 
        postProcessFunction: null
    };
}

function renderRoundedRect(xmlNode, mergedAttributes) {
    const htmlElement = document.createElement('div');
    htmlElement.classList.add('gui-rounded-rect');
    
    if (mergedAttributes['mask'] === '1' || mergedAttributes['clip'] === '1') {
        htmlElement.style.overflow = 'hidden';
    }
    
    htmlElement.style.boxSizing = 'border-box';

    return {
        htmlElement: htmlElement,
        mainElementForAttributes: htmlElement,
        requiresRecursiveRender: true,
        postProcessFunction: null
    };
}

function renderStaticImage(xmlNode, mergedAttributes) {
    const imagePath = mergedAttributes['image'];
    const currentSkinRoot = State.getCurrentSkinRoot() || '';
    let htmlElement; 

    if (imagePath) {
        const fullImagePath = State.normalizePath(imagePath, currentSkinRoot);
        const blobUrl = State.getAssetBlobUrl(fullImagePath);

        if (blobUrl) {
            State.addUsedFile(fullImagePath);
            const isSvg = imagePath.toLowerCase().endsWith('.svg');

            if (isSvg) {
                htmlElement = document.createElement('img');
                htmlElement.src = blobUrl;
                htmlElement.classList.add('gui-static-image', 'gui-svg-image'); 
                htmlElement.alt = imagePath.split('/').pop(); 
            } else { 
                htmlElement = document.createElement('div');
                htmlElement.classList.add('gui-static-image', 'gui-raster-image');
                htmlElement.style.backgroundImage = `url('${blobUrl}')`;
                
                const stretch = mergedAttributes['stretch'] === '1';
                const tile = mergedAttributes['tile'] === '1';

                if (stretch) {
                    htmlElement.style.backgroundSize = '100% 100%'; 
                    htmlElement.style.backgroundRepeat = 'no-repeat';
                } else if (tile) {
                    htmlElement.style.backgroundSize = 'auto'; 
                    htmlElement.style.backgroundRepeat = 'repeat';
                } else { 
                    htmlElement.style.backgroundSize = 'contain'; 
                    htmlElement.style.backgroundRepeat = 'no-repeat';
                }
                htmlElement.style.backgroundPosition = 'center'; 
            }
        } else {
            console.warn(`[drawRenderer] Image blob URL not found for: ${fullImagePath}`);
            htmlElement = DomUtils.createErrorPlaceholder(`Missing: ${imagePath.split('/').pop()}`);
        }
    } else {
        htmlElement = DomUtils.createErrorPlaceholder('No image path');
    }

    if (!htmlElement) { 
         htmlElement = DomUtils.createErrorPlaceholder('Image Error');
    }
    
    return {
        htmlElement: htmlElement,
        mainElementForAttributes: htmlElement,
        requiresRecursiveRender: true, 
        postProcessFunction: null
    };
}

function renderLine(xmlNode, mergedAttributes) {
    const svgElement = document.createElementNS(SVG_NS, "svg");
    const lineElement = document.createElementNS(SVG_NS, "line");

    let wAttr = parseFloat(mergedAttributes['w'] || '0');
    let hAttr = parseFloat(mergedAttributes['h'] || '0');
    let frameWidth = parseFloat(mergedAttributes['frameWidth'] || '1');
    if (frameWidth === 0 && (wAttr > 0 || hAttr > 0)) { 
        frameWidth = 1; 
    }

    const borderColor = DomUtils.parseColor(mergedAttributes['border_color'] || mergedAttributes['color_frame'] || '#FFFFFFFF');

    let x1, y1, x2, y2;
    let svgActualW = wAttr;
    let svgActualH = hAttr;

    // Handle horizontal/vertical straight lines seamlessly
    if (hAttr <= frameWidth && wAttr > 0) { 
        svgActualH = Math.max(frameWidth, 1); 
        x1 = 0; y1 = svgActualH / 2; x2 = wAttr; y2 = svgActualH / 2;
    } else if (wAttr <= frameWidth && hAttr > 0) { 
        svgActualW = Math.max(frameWidth, 1); 
        x1 = svgActualW / 2; y1 = 0; x2 = svgActualW / 2; y2 = hAttr;
    } else if (wAttr === 0 && hAttr === 0 && frameWidth > 0) { 
        svgActualW = frameWidth; 
        svgActualH = frameWidth;
        const rectElement = document.createElementNS(SVG_NS, "rect");
        rectElement.setAttribute("x", "0"); rectElement.setAttribute("y", "0");
        rectElement.setAttribute("width", String(frameWidth));
        rectElement.setAttribute("height", String(frameWidth));
        rectElement.setAttribute("fill", borderColor);
        svgElement.appendChild(rectElement);
        
        svgElement.setAttribute("width", String(svgActualW));
        svgElement.setAttribute("height", String(svgActualH));
        svgElement.style.overflow = "visible";
        return { htmlElement: svgElement, mainElementForAttributes: svgElement, requiresRecursiveRender: false, postProcessFunction: null };
    } else { 
        x1 = 0; y1 = 0; x2 = wAttr; y2 = hAttr; 
        svgActualW = wAttr;
        svgActualH = hAttr;
    }

    lineElement.setAttribute("x1", String(x1));
    lineElement.setAttribute("y1", String(y1));
    lineElement.setAttribute("x2", String(x2));
    lineElement.setAttribute("y2", String(y2));
    lineElement.setAttribute("stroke", borderColor);
    lineElement.setAttribute("stroke-width", String(frameWidth));
    lineElement.setAttribute("stroke-linecap", mergedAttributes['stroke-linecap'] || "butt");
    
    svgElement.appendChild(lineElement);
    svgElement.setAttribute("width", String(svgActualW));
    svgElement.setAttribute("height", String(svgActualH));
    svgElement.style.overflow = "visible"; 

    return {
        htmlElement: svgElement,
        mainElementForAttributes: svgElement,
        requiresRecursiveRender: false,
        postProcessFunction: null 
    };
}

function renderShape(xmlNode, mergedAttributes) {
    const outerDiv = document.createElement('div');
    outerDiv.classList.add('gui-shape-container');
    
    outerDiv.style.setProperty('border', 'none', 'important'); 
    outerDiv.style.setProperty('padding', '0px', 'important');

    const pointsData = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const childNode of xmlNode.children) {
        if (childNode.nodeType === Node.ELEMENT_NODE && childNode.tagName === 'Point') {
            const px = parseFloat(childNode.getAttribute('x'));
            const py = parseFloat(childNode.getAttribute('y'));
            if (!isNaN(px) && !isNaN(py)) {
                pointsData.push({ x: px, y: py });
                minX = Math.min(minX, px);
                minY = Math.min(minY, py);
                maxX = Math.max(maxX, px);
                maxY = Math.max(maxY, py);
            }
        }
    }

    if (pointsData.length < 2 || minX === Infinity) {
        return { htmlElement: outerDiv, mainElementForAttributes: outerDiv, requiresRecursiveRender: false, postProcessFunction: null };
    }

    const geomW = Math.max(0, maxX - minX);
    const geomH = Math.max(0, maxY - minY);
    const closeShape = mergedAttributes['closeShape'] === '1';
    const drawMode = mergedAttributes['drawMode'] || (closeShape ? 'strokedFilled' : 'stroked');

    let finalStrokeWidth = parseFloat(mergedAttributes['frameWidth'] || mergedAttributes['stroke-width'] || '0');
    let strokeColorVal = mergedAttributes['color_frame'] || mergedAttributes['border_color'];
    let fillColorVal = mergedAttributes['color_fill'] || mergedAttributes['fill_color'];

    let finalStroke = 'none';
    let finalFill = 'transparent';

    if (drawMode === 'stroked') {
        finalStroke = DomUtils.parseColor(strokeColorVal || '#000000');
        finalStrokeWidth = finalStrokeWidth > 0 ? finalStrokeWidth : (strokeColorVal ? 1 : 0);
        finalFill = fillColorVal ? DomUtils.parseColor(fillColorVal) : 'none';
    } else if (drawMode === 'filled') {
        finalFill = DomUtils.parseColor(fillColorVal || '#000000');
        if (strokeColorVal && finalStrokeWidth > 0) {
            finalStroke = DomUtils.parseColor(strokeColorVal);
        }
    } else { 
        finalFill = DomUtils.parseColor(fillColorVal || 'transparent');
        if (strokeColorVal) {
            finalStroke = DomUtils.parseColor(strokeColorVal);
            finalStrokeWidth = finalStrokeWidth > 0 ? finalStrokeWidth : 1;
        }
    }

    const strokeHalfW = (finalStroke !== 'none' && finalStrokeWidth > 0) ? finalStrokeWidth / 2 : 0;
    const svgActualW = Math.max(1, geomW + finalStrokeWidth);
    const svgActualH = Math.max(1, geomH + finalStrokeWidth);

    if (mergedAttributes['x'] === undefined) { outerDiv.style.left = `${minX - strokeHalfW}px`; }
    if (mergedAttributes['y'] === undefined) { outerDiv.style.top = `${minY - strokeHalfW}px`; }
    if (mergedAttributes['w'] === undefined) { outerDiv.style.width = `${svgActualW}px`; }
    if (mergedAttributes['h'] === undefined) { outerDiv.style.height = `${svgActualH}px`; }

    const svgElement = document.createElementNS(SVG_NS, "svg");
    svgElement.setAttribute('width', "100%"); 
    svgElement.setAttribute('height', "100%");
    svgElement.setAttribute('viewBox', `${minX - strokeHalfW} ${minY - strokeHalfW} ${svgActualW} ${svgActualH}`);
    svgElement.style.overflow = 'visible';

    const pathElement = document.createElementNS(SVG_NS, closeShape ? "polygon" : "polyline");
    pathElement.setAttribute('points', pointsData.map(p => `${p.x},${p.y}`).join(' '));
    pathElement.setAttribute('fill', finalFill);
    pathElement.setAttribute('stroke', finalStroke);
    pathElement.setAttribute('stroke-width', String(finalStrokeWidth));

    if (finalStroke !== 'none' && finalStrokeWidth > 0) {
        pathElement.setAttribute("stroke-linecap", mergedAttributes['stroke-linecap'] || "butt");
        pathElement.setAttribute("stroke-linejoin", mergedAttributes['stroke-linejoin'] || "miter");
    }

    svgElement.appendChild(pathElement);
    outerDiv.appendChild(svgElement);

    return {
        htmlElement: outerDiv,
        mainElementForAttributes: outerDiv,
        requiresRecursiveRender: false,
        postProcessFunction: null
    };
}


export function render(tagName, xmlNode, parentHtmlElement, currentParams, sourcePath, mergedAttributes) {
    switch (tagName) {
        case 'Rect': return renderRect(xmlNode, mergedAttributes);
        case 'RoundedRect': return renderRoundedRect(xmlNode, mergedAttributes);
        case 'StaticImage': return renderStaticImage(xmlNode, mergedAttributes);
        case 'Line': return renderLine(xmlNode, mergedAttributes);
        case 'Shape': return renderShape(xmlNode, mergedAttributes);
        default:
            console.warn(`[drawRenderer] Attempted to render unhandled tag: ${tagName}`);
            const placeholder = DomUtils.createErrorPlaceholder(tagName);
            if (mergedAttributes['x']) placeholder.style.left = mergedAttributes['x'] + 'px';
            if (mergedAttributes['y']) placeholder.style.top = mergedAttributes['y'] + 'px';
            if (mergedAttributes['w']) placeholder.style.width = mergedAttributes['w'] + 'px';
            if (mergedAttributes['h']) placeholder.style.height = mergedAttributes['h'] + 'px';
            return { htmlElement: placeholder, mainElementForAttributes: placeholder, requiresRecursiveRender: false, postProcessFunction: null };
    }
}