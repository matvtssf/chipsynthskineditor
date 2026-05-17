// File: cs/mainContentInteractions.js
/**
 * mainContentInteractions.js
 * Handles interactions directly within the main content display area,
 * such as panning, debug overlay updates, and GUI zoom.
 * MODIFIED: Updated zoom functionality to target gui-zoom-canvas,
 * and only zoom when mouse is over gui-zoom-canvas with CTRL key.
 * Fixed getBoundingClientRect() for zoom origin calculation.
 * MODIFIED: Import and use updateZoomControlsDisplay from sidebarControlsInteractions.
 * FIXED: Use State.getCurrentZoomLevel() and State.setCurrentZoomLevel().
 * RESTORED: Appends a list of raw XML attributes and values onto the debug tooltip.
 */
import * as State from '../core/state.js';
import {
    getGuiZoomCanvas,
    getMainContentArea,
    getDebugOverlay,
    getZoomSlider, // Used for min/max zoom values
    logError
} from '../core/domUtils.js';
import { updateZoomControlsDisplay } from './sidebarControlsInteractions.js';

// --- Module State ---
let isPanning = false;
let panStartX = 0, panStartY = 0;
let panStartScrollX = 0, panStartScrollY = 0;
let lastHoveredElement = null;

// --- Initialization ---
export function setupMainContentInteractions() {
    console.log("[mainContent] Setting up Main Content listeners...");
    const mainContentArea = getMainContentArea();
    const guiZoomCanvas = getGuiZoomCanvas();

    if (guiZoomCanvas) {
        if (!guiZoomCanvas.dataset.panListenerAttached) {
            guiZoomCanvas.addEventListener('mousedown', handlePanStart);
            guiZoomCanvas.dataset.panListenerAttached = 'true';
            console.log("[mainContent] Panning listeners attached (mousedown on canvas elements, scrolls mainContentArea).");
        }
        const canvasViewport = document.getElementById('canvas-viewport');
        if (canvasViewport && !canvasViewport.dataset.dragListenerAttached) {
            canvasViewport.addEventListener('dragstart', (e) => e.preventDefault());
            canvasViewport.dataset.dragListenerAttached = 'true';
        }

        if (!guiZoomCanvas.dataset.debugListenersAttached) {
             guiZoomCanvas.addEventListener('mousemove', handleDebugMouseMove);
             guiZoomCanvas.addEventListener('mouseleave', handleDebugMouseLeave);
             guiZoomCanvas.dataset.debugListenersAttached = 'true';
             console.log("[mainContent] Debug listeners attached to guiZoomCanvas.");
        }
        if (!guiZoomCanvas.dataset.wheelListenerAttached) {
            guiZoomCanvas.addEventListener('wheel', handleWheelZoom, { passive: false });
            guiZoomCanvas.dataset.wheelListenerAttached = 'true';
            console.log("[mainContent] Wheel zoom listener attached to guiZoomCanvas.");
        }
    } else {
        logError("[mainContent] guiZoomCanvas not found for listeners init!", null, true);
    }
    if(mainContentArea) { // For middle-click context menu prevention on viewport
        mainContentArea.addEventListener('contextmenu', (e) => {
            if (e.button === 1) e.preventDefault();
        });
    }
}

// --- Panning Logic (Scrolls canvasViewport based on drag on guiZoomCanvas) ---
function handlePanStart(e) {
    if (e.button !== 1) {
        return;
    }

    const guiZoomCanvas = getGuiZoomCanvas();
    const canvasViewport = document.getElementById('canvas-viewport');

    if (!canvasViewport || !guiZoomCanvas) return;

    e.preventDefault();
    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    panStartScrollX = canvasViewport.scrollLeft;
    panStartScrollY = canvasViewport.scrollTop;
    
    canvasViewport.classList.add('panning-active');
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', handlePanMove);
    document.addEventListener('mouseup', handlePanEnd, { once: true });
    console.log("[mainContent] Pan start.");
}

// --- Panning Move Logic ---
function handlePanMove(e) {
    if (!isPanning) return;
    e.preventDefault();

    const canvasViewport = document.getElementById('canvas-viewport');
    if (!canvasViewport) {
        handlePanEnd(e);
        return;
    }

    const dx = e.clientX - panStartX;
    const dy = e.clientY - panStartY;
    canvasViewport.scrollLeft = panStartScrollX - dx;
    canvasViewport.scrollTop = panStartScrollY - dy;
}

export function handlePanEnd(e) {
     if (!isPanning) return;
     if (e && e.type === 'mouseup' && e.button !== 1) {
         return;
     }
    isPanning = false;
    const canvasViewport = document.getElementById('canvas-viewport');
    if (canvasViewport) {
        canvasViewport.classList.remove('panning-active');
    }
    document.body.style.userSelect = '';

    document.removeEventListener('mousemove', handlePanMove);
    document.removeEventListener('mouseup', handlePanEnd);
    console.log("[mainContent] Pan end.");
}

// --- Debug Overlay Logic (Relative to guiZoomCanvas) ---
function handleDebugMouseMove(event) {
    const debugEnabled = State.getDebugEnabled ? State.getDebugEnabled() : false;
    const debugOverlay = getDebugOverlay();
    const zoomCanvas = getGuiZoomCanvas();

    if (!debugEnabled || !debugOverlay || !zoomCanvas) {
        if (debugOverlay && debugOverlay.style.display !== 'none') {
            debugOverlay.style.display = 'none';
        }
        if (lastHoveredElement) {
            lastHoveredElement.classList.remove('debug-highlight');
            lastHoveredElement = null;
        }
        return;
    }
    debugOverlay.style.display = 'block';
    const zoomCanvasRect = zoomCanvas.getBoundingClientRect();
    const currentScale = State.getCurrentZoomLevel(); // FIXED: Use getCurrentZoomLevel
    const mouseXRelativeToCanvasScaled = event.clientX - zoomCanvasRect.left;
    const mouseYRelativeToCanvasScaled = event.clientY - zoomCanvasRect.top;
    const mouseXUnscaled = mouseXRelativeToCanvasScaled / currentScale;
    const mouseYUnscaled = mouseYRelativeToCanvasScaled / currentScale;

    let elementInfo = `Canvas X: ${mouseXUnscaled.toFixed(0)}, Y: ${mouseYUnscaled.toFixed(0)}\n`;
    let targetElement = event.target;
    let validTargetFound = false;
    const skinContainer = zoomCanvas.querySelector('#skin-container-actual');

    while (targetElement && targetElement !== document.body) {
        if (targetElement.dataset && targetElement.dataset.xmlTagName) {
            if (skinContainer && skinContainer.contains(targetElement)) {
                 validTargetFound = true;
                 break;
            }
        }
        if (targetElement === zoomCanvas || targetElement === zoomCanvas.parentElement) break;
        targetElement = targetElement.parentElement;
    }

    if (lastHoveredElement && lastHoveredElement !== targetElement) {
        lastHoveredElement.classList.remove('debug-highlight');
        lastHoveredElement = null;
    }

    if (validTargetFound && targetElement && targetElement !== skinContainer && targetElement !== zoomCanvas) {
        targetElement.classList.add('debug-highlight');
        lastHoveredElement = targetElement;
        elementInfo += `\nElement: <${targetElement.dataset.xmlTagName}>`;
        if (targetElement.dataset.sourcePath) {
            elementInfo += `\nSource: ${targetElement.dataset.sourcePath.split(/[\\/]/).pop()}`;
        }
        if (targetElement.style.left) elementInfo += `\nCSS L: ${targetElement.style.left} T: ${targetElement.style.top}`;
        if (targetElement.style.width) elementInfo += ` W: ${targetElement.style.width} H: ${targetElement.style.height}`;

        // Scan dataset keys to append a detailed listing of raw original XML attributes
        let attributesList = [];
        for (const key in targetElement.dataset) {
            if (key.startsWith('xmlAttr_')) {
                const cleanAttrName = key.slice(8); // Remove 'xmlAttr_' prefix
                attributesList.push(`  ${cleanAttrName}="${targetElement.dataset[key]}"`);
            }
        }
        if (attributesList.length > 0) {
            elementInfo += `\n\nAttributes:\n${attributesList.join('\n')}`;
        }
    } else {
        if (lastHoveredElement) {
            lastHoveredElement.classList.remove('debug-highlight');
            lastHoveredElement = null;
        }
        if (event.target === zoomCanvas || (skinContainer && !skinContainer.contains(event.target))) {
             elementInfo += "\n(Hovering over canvas background or outside skin area)";
        } else if (event.target === skinContainer) {
            elementInfo += "\n(Hovering over skin container)";
        } else {
             elementInfo += "\n(Hover over a GUI element inside the skin)";
        }
    }
    debugOverlay.textContent = elementInfo;
    debugOverlay.style.left = `${event.clientX + 15}px`;
    debugOverlay.style.top = `${event.clientY + 15}px`;
}

function handleDebugMouseLeave(event) {
    const guiZoomCanvas = getGuiZoomCanvas();
    if (guiZoomCanvas && event.relatedTarget && guiZoomCanvas.contains(event.relatedTarget)) {
        return;
    }
    const debugEnabled = State.getDebugEnabled ? State.getDebugEnabled() : false;
    const debugOverlay = getDebugOverlay();
    if (lastHoveredElement) {
        lastHoveredElement.classList.remove('debug-highlight');
        lastHoveredElement = null;
    }
    if (debugOverlay) {
        debugOverlay.innerHTML = '';
        if (!debugEnabled || (event.target === guiZoomCanvas && !guiZoomCanvas.contains(event.relatedTarget) )) {
             debugOverlay.style.display = 'none';
        }
    }
}

/**
 * Updates the visual zoom level of the GUI content.
 * @param {number} zoomLevel - The desired zoom level (e.g., 1 for 100%, 0.5 for 50%).
 * @param {string|null} [origin=null] - The transform-origin string (e.g., "0px 0px" or "center center").
 */
export function updateGuiZoom(zoomLevel, origin = null) {
    const zoomTargetElement = getGuiZoomCanvas();
    if (zoomTargetElement) {
        if (origin) {
            zoomTargetElement.style.transformOrigin = origin;
        } else {
            const canvasViewport = document.getElementById('canvas-viewport');
            if (canvasViewport) {
                const currentZoom = State.getCurrentZoomLevel() || 1;
                const rect = zoomTargetElement.getBoundingClientRect();
                const viewRect = canvasViewport.getBoundingClientRect();
                
                const viewCenterX = viewRect.left + viewRect.width / 2;
                const viewCenterY = viewRect.top + viewRect.height / 2;
                
                const originX = (viewCenterX - rect.left) / currentZoom;
                const originY = (viewCenterY - rect.top) / currentZoom;
                
                zoomTargetElement.style.transformOrigin = `${originX.toFixed(2)}px ${originY.toFixed(2)}px`;
            } else if (!zoomTargetElement.style.transformOrigin || zoomTargetElement.style.transformOrigin === "50% 50%" ||  zoomTargetElement.style.transformOrigin === "center center") {
                zoomTargetElement.style.transformOrigin = 'top left';
            }
        }
        zoomTargetElement.style.transform = `scale(${zoomLevel})`;
        State.setCurrentZoomLevel(zoomLevel); // FIXED: Use setCurrentZoomLevel
    } else {
        logError("[mainContent] gui-zoom-canvas not found, cannot update zoom.", null, true);
    }
}

/**
 * Handles wheel events for zooming the GUI content if CTRL is pressed.
 * @param {WheelEvent} event - The wheel event.
 */
function handleWheelZoom(event) {
    if (!event.ctrlKey) return;

    const zoomCanvas = getGuiZoomCanvas();
    if (!zoomCanvas) {
        logError("[mainContent] Zoom target (gui-zoom-canvas) not found for wheel event.", null, true);
        return;
    }

    if (!zoomCanvas.contains(event.target) && event.target !== zoomCanvas) {
        return;
    }

    event.preventDefault();

    const currentZoom = State.getCurrentZoomLevel(); // FIXED: Use getCurrentZoomLevel
    const zoomFactor = 0.1;
    let newZoom;

    if (event.deltaY < 0) { // Zoom in
        newZoom = currentZoom * (1 + zoomFactor);
    } else { // Zoom out
        newZoom = currentZoom * (1 - zoomFactor);
    }

    const zoomSliderElement = getZoomSlider();
    const minZoom = parseFloat(zoomSliderElement?.min || "0.5");
    const maxZoom = parseFloat(zoomSliderElement?.max || "4");
    newZoom = Math.max(minZoom, Math.min(newZoom, maxZoom));

    if (Math.abs(newZoom - currentZoom) < 0.001) return;

    const rect = zoomCanvas.getBoundingClientRect();
    const mouseXOnScaledElement = event.clientX - rect.left;
    const mouseYOnScaledElement = event.clientY - rect.top;
    const originX = mouseXOnScaledElement / currentZoom;
    const originY = mouseYOnScaledElement / currentZoom;
    const zoomOrigin = `${originX.toFixed(2)}px ${originY.toFixed(2)}px`;

    updateGuiZoom(newZoom, zoomOrigin);

    if (typeof updateZoomControlsDisplay === 'function') {
        updateZoomControlsDisplay(newZoom);
    } else {
        logError("[mainContent] updateZoomControlsDisplay function is not available from sidebarControlsInteractions. Slider UI might be out of sync.", null);
        if(zoomSliderElement) zoomSliderElement.value = newZoom;
        const zoomValueDisplayElement = document.getElementById('zoom-value'); // Direct get, less ideal
        if(zoomValueDisplayElement) zoomValueDisplayElement.textContent = `${Math.round(newZoom * 100)}%`;
    }
}