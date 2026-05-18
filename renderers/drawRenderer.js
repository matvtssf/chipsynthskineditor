// File: cs/renderers/drawRenderer.js
import * as DomUtils from '../core/domUtils.js';
import * as State from '../core/state.js';

const SVG_NS = "http://www.w3.org/2000/svg";

function renderRect(xmlNode, mergedAttributes) {
    let drawMode = mergedAttributes['drawmode'] || mergedAttributes['drawMode'];
    if (!drawMode) {
        if (mergedAttributes['fill_color'] || mergedAttributes['color_fill']) drawMode = 'filled';
        else if (mergedAttributes['border_color'] || mergedAttributes['color_frame']) drawMode = 'stroked';
        else drawMode = 'filled'; 
    }

    const outerDiv = document.createElement('div');
    outerDiv.classList.add('gui-rect-container');
    outerDiv.style.position = 'absolute';
    outerDiv.style.boxSizing = 'border-box';
    
    if (mergedAttributes['mask'] === '1' || mergedAttributes['clip'] === '1') {
        outerDiv.style.overflow = 'hidden';
    }

    if (drawMode === 'filled' || drawMode === 'strokedFilled') {
        const fillColor = DomUtils.parseColor(mergedAttributes['fill_color'] || mergedAttributes['color_fill'] || mergedAttributes['color'] || 'transparent');
        outerDiv.style.backgroundColor = fillColor;
    }
    
    if (drawMode === 'stroked' || drawMode === 'strokedFilled') {
        const borderColor = DomUtils.parseColor(mergedAttributes['border_color'] || mergedAttributes['color_frame'] || mergedAttributes['color'] || 'transparent');
        const frameWidth = parseFloat(mergedAttributes['framewidth'] || mergedAttributes['frameWidth'] || '1');
        
        // Prevent drawing inner borders if the frame color identically matches the fill (it's just a solid block)
        if (drawMode === 'stroked' || outerDiv.style.backgroundColor !== borderColor) {
            outerDiv.style.border = `${frameWidth}px solid ${borderColor}`;
        }
    }

    return {
        htmlElement: outerDiv,
        mainElementForAttributes: outerDiv,
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
    const outerDiv = document.createElement('div');
    outerDiv.classList.add('gui-line-container');
    outerDiv.style.position = 'absolute';
    outerDiv.style.setProperty('background-color', 'transparent', 'important');
    outerDiv.style.setProperty('border', 'none', 'important');
    outerDiv.style.setProperty('padding', '0px', 'important');

    const svgElement = document.createElementNS(SVG_NS, "svg");
    const lineElement = document.createElementNS(SVG_NS, "line");

    svgElement.style.pointerEvents = 'none'; 
    svgElement.style.position = 'absolute';
    svgElement.style.left = '0px';
    svgElement.style.top = '0px';
    svgElement.style.setProperty('background-color', 'transparent', 'important');
    svgElement.style.setProperty('border', 'none', 'important');
    svgElement.style.overflow = "visible"; 
    svgElement.classList.add('gui-line-svg');

    let wAttr = parseFloat(mergedAttributes['w'] || '0');
    let hAttr = parseFloat(mergedAttributes['h'] || '0');
    
    let frameWidth = parseFloat(mergedAttributes['framewidth'] || mergedAttributes['frameWidth'] || '1');
    if (frameWidth === 0 && (wAttr > 0 || hAttr > 0)) { 
        frameWidth = 1; 
    }

    const borderColor = DomUtils.parseColor(mergedAttributes['border_color'] || mergedAttributes['color_frame'] || mergedAttributes['color'] || '#FFFFFFFF');

    let x1 = 0, y1 = 0, x2 = wAttr, y2 = hAttr;

    if (mergedAttributes['reversepoints'] === '1' || mergedAttributes['reversePoints'] === '1') {
        x1 = 0; y1 = hAttr; x2 = wAttr; y2 = 0;
    }

    // Handle 0-length lines (dots)
    if (wAttr === 0 && hAttr === 0 && frameWidth > 0) { 
        const rectElement = document.createElementNS(SVG_NS, "rect");
        rectElement.setAttribute("x", String(-frameWidth/2)); 
        rectElement.setAttribute("y", String(-frameWidth/2));
        rectElement.setAttribute("width", String(frameWidth));
        rectElement.setAttribute("height", String(frameWidth));
        rectElement.setAttribute("fill", borderColor);
        svgElement.appendChild(rectElement);
        
        svgElement.setAttribute("width", "1");
        svgElement.setAttribute("height", "1");
        outerDiv.appendChild(svgElement);
        return { htmlElement: outerDiv, mainElementForAttributes: outerDiv, requiresRecursiveRender: false, postProcessFunction: null };
    }

    lineElement.setAttribute("x1", String(x1));
    lineElement.setAttribute("y1", String(y1));
    lineElement.setAttribute("x2", String(x2));
    lineElement.setAttribute("y2", String(y2));
    lineElement.setAttribute("stroke", borderColor);
    lineElement.setAttribute("stroke-width", String(frameWidth));
    
    const isDiagonal = (wAttr > 0 && hAttr > 0);
    lineElement.setAttribute("stroke-linecap", mergedAttributes['stroke-linecap'] || (isDiagonal ? "round" : "butt"));
    
    svgElement.appendChild(lineElement);
    
    svgElement.setAttribute("width", String(wAttr || 1));
    svgElement.setAttribute("height", String(hAttr || 1));

    outerDiv.appendChild(svgElement);

    return {
        htmlElement: outerDiv,
        mainElementForAttributes: outerDiv,
        requiresRecursiveRender: false,
        postProcessFunction: (element) => {
            element.style.setProperty('background-color', 'transparent', 'important');
            element.style.setProperty('border', 'none', 'important');
            element.style.setProperty('outline', 'none', 'important');
            element.style.setProperty('box-shadow', 'none', 'important');
            element.style.setProperty('overflow', 'visible', 'important');
        }
    };
}

function renderShape(xmlNode, mergedAttributes) {
    const outerDiv = document.createElement('div');
    outerDiv.classList.add('gui-shape-container');
    
    // uiRenderer handles standard positioning, so we just set defaults for the container
    outerDiv.style.position = 'absolute';
    outerDiv.style.setProperty('background-color', 'transparent', 'important');
    outerDiv.style.setProperty('border', 'none', 'important'); 
    outerDiv.style.setProperty('padding', '0px', 'important');

    const pointsData = [];

    for (const childNode of xmlNode.children) {
        if (childNode.nodeType === Node.ELEMENT_NODE && childNode.tagName === 'Point') {
            const px = parseFloat(childNode.getAttribute('x'));
            const py = parseFloat(childNode.getAttribute('y'));
            if (!isNaN(px) && !isNaN(py)) {
                pointsData.push({ x: px, y: py });
            }
        }
    }

    if (pointsData.length < 2) {
        return { htmlElement: outerDiv, mainElementForAttributes: outerDiv, requiresRecursiveRender: false, postProcessFunction: null };
    }

    const closeShape = mergedAttributes['closeshape'] === '1' || mergedAttributes['closeShape'] === '1';
    let drawMode = mergedAttributes['drawmode'] || mergedAttributes['drawMode'] || (closeShape ? 'strokedFilled' : 'stroked');

    let finalStrokeWidth = parseFloat(mergedAttributes['framewidth'] || mergedAttributes['frameWidth'] || mergedAttributes['stroke-width'] || '0');
    let strokeColorVal = mergedAttributes['color_frame'] || mergedAttributes['border_color'] || mergedAttributes['color'];
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

    const svgElement = document.createElementNS(SVG_NS, "svg");
    svgElement.style.position = 'absolute';
    svgElement.style.left = '0';
    svgElement.style.top = '0';
    svgElement.style.setProperty('background-color', 'transparent', 'important');
    svgElement.style.setProperty('border', 'none', 'important');
    svgElement.setAttribute('width', "100%"); 
    svgElement.setAttribute('height', "100%");
    svgElement.style.overflow = 'visible';

    const pathElement = document.createElementNS(SVG_NS, closeShape ? "polygon" : "polyline");
    pathElement.setAttribute('points', pointsData.map(p => `${p.x},${p.y}`).join(' '));
    pathElement.setAttribute('fill', finalFill);
    pathElement.setAttribute('stroke', finalStroke);
    pathElement.setAttribute('stroke-width', String(finalStrokeWidth));

    if (finalStroke !== 'none' && finalStrokeWidth > 0) {
        // Use square caps and sharp miters to fuse corners identically with straight rect lines
        pathElement.setAttribute("stroke-linecap", mergedAttributes['stroke-linecap'] || "square");
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
        case 'Picture8Data': return renderPicture8Data(xmlNode, mergedAttributes);
        case 'ImageHolder': return renderImageHolder(xmlNode, mergedAttributes);
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

function renderPicture8Data(xmlNode, mergedAttributes) {
    const htmlElement = document.createElement('img');
    htmlElement.src = 'style/spc.svg';
    htmlElement.classList.add('gui-picture8data', 'gui-svg-image');
    htmlElement.style.position = 'absolute';
    htmlElement.style.display = 'block';

    return {
        htmlElement: htmlElement,
        mainElementForAttributes: htmlElement,
        requiresRecursiveRender: false,
        postProcessFunction: null
    };
}

function renderImageHolder(xmlNode, mergedAttributes) {
    const container = document.createElement('div');
    container.classList.add('gui-image-holder');
    container.style.position = 'absolute';
    container.style.boxSizing = 'border-box';
    container.style.overflow = 'hidden';

    const placeholder = document.createElement('div');
    placeholder.classList.add('gui-image-holder-placeholder');
    placeholder.style.width = '100%';
    placeholder.style.height = '100%';
    placeholder.style.display = 'flex';
    placeholder.style.flexDirection = 'column';
    placeholder.style.alignItems = 'center';
    placeholder.style.justifyContent = 'center';
    placeholder.style.border = '1px dashed rgba(255, 255, 255, 0.15)';
    placeholder.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
    placeholder.style.borderRadius = '4px';
    placeholder.style.pointerEvents = 'none';

    const textLabel = document.createElement('span');
    textLabel.textContent = '📂 [Image Holder]';
    textLabel.style.fontSize = '10px';
    textLabel.style.color = 'rgba(255, 255, 255, 0.3)';
    textLabel.style.fontFamily = 'monospace';
    textLabel.style.userSelect = 'none';
    
    placeholder.appendChild(textLabel);
    container.appendChild(placeholder);

    const paramId = mergedAttributes['param'];
    const target = mergedAttributes['target'];
    if (paramId) container.dataset.param = paramId;
    if (target) container.dataset.target = target;

    return {
        htmlElement: container,
        mainElementForAttributes: container,
        requiresRecursiveRender: false,
        postProcessFunction: null
    };
}