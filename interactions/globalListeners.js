/**
 * globalListeners.js
 * Attaches listeners to the document or body for broad interactions
 * like logo hover, modal background clicks, and global mouse state.
 * FIXED: Added imports for handlePanEnd and flashModalBorder, removed window checks.
 */

import * as State from '../core/state.js'; // For setIsMouseButtonDown
import * as Refs from '../core/references.js';
import { getTextLogo, getSidebar, getDisclaimerModal, getAcknowledgeDisclaimerButton, getLoadFolderButton, showToast } from '../core/domUtils.js';
import { handlePanEnd } from './mainContentInteractions.js'; // Sibling interaction import
import { flashModalBorder } from '../managers/modalManager.js'; // Moved up one level
import { openXmlEditor, getCachedParamReferenceDataForHover } from '../core/xmlEditor.js'; // Added for middle-click jump
import { syncElementChangesToXmlSource, updateGuiZoom } from './mainContentInteractions.js';
window.syncElementChangesToXmlSource = syncElementChangesToXmlSource;

let middleMouseDownX = 0;
let middleMouseDownY = 0;

// --- Initialization ---

/**
 * Sets up global event listeners attached to document or body.
 */
export function setupGlobalListeners() {
    console.log("[globalListeners] Setting up Global listeners...");

    // Light mode contrast enhancement for settings/open controls right before presentation
    let lightModeOverride = document.getElementById('qi-lightmode-contrast-override');
    if (!lightModeOverride) {
        lightModeOverride = document.createElement('style');
        lightModeOverride.id = 'qi-lightmode-contrast-override';
        lightModeOverride.textContent = `
            .light-mode #settings-btn, .light-mode .settings-btn, .light-mode .settings-button,
            .light-mode #open-btn, .light-mode .open-btn, .light-mode #open-project-btn {
                background: transparent !important;
                color: #4a5568 !important;
                border: none !important;
                padding: 4px 8px !important;
                font-size: 12px !important;
                font-weight: 500 !important;
                border-radius: 4px !important;
                box-shadow: none !important;
                cursor: pointer !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 6px !important;
            }
            .light-mode #settings-btn:hover, .light-mode .settings-btn:hover, .light-mode .settings-button:hover,
            .light-mode #open-btn:hover, .light-mode .open-btn:hover, .light-mode #open-project-btn:hover {
                background: rgba(0, 0, 0, 0.05) !important;
                color: #1a202c !important;
            }
            .light-mode #settings-btn svg, .light-mode .settings-btn svg, .light-mode .settings-button svg,
            .light-mode #open-btn svg, .light-mode .open-btn svg, .light-mode #open-project-btn svg {
                fill: #4a5568 !important;
                stroke: #4a5568 !important;
                width: 16px !important;
                height: 16px !important;
            }
            .light-mode #settings-btn:hover svg, .light-mode .settings-btn:hover svg, .light-mode .settings-button:hover svg,
            .light-mode #open-btn:hover svg, .light-mode .open-btn:hover svg, .light-mode #open-project-btn:hover svg {
                fill: #1a202c !important;
                stroke: #1a202c !important;
            }
            body.disclaimer-active #sidebar,
            body.disclaimer-active .sidebar,
            body.disclaimer-active #settings-btn,
            body.disclaimer-active .settings-btn,
            body.disclaimer-active .settings-button,
            body.disclaimer-active #open-btn,
            body.disclaimer-active .open-btn,
            body.disclaimer-active #open-project-btn,
            body.disclaimer-active .corner-controls,
            body.disclaimer-active .top-right-controls {
                display: none !important;
            }
        `;
        document.head.appendChild(lightModeOverride);
    }

    // Centralized Disclaimer Dissolve & Activation Flow
    const ackBtn = getAcknowledgeDisclaimerButton();
    const discModal = getDisclaimerModal();
    const loadBtn = getLoadFolderButton();
    const currentTextLogo = getTextLogo();
    const sidebar = getSidebar();

    // Active real-time hide routine for boot status text element to guarantee zero visibility before acknowledgement
    const hideStatusRoutine = () => {
        if (!document.body.classList.contains('disclaimer-active')) return;
        const allElements = document.getElementsByTagName('*');
        for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            if (el.children.length === 0 && el.textContent.toLowerCase().includes('load a product folder')) {
                el.style.setProperty('visibility', 'hidden', 'important');
            }
        }
    };

    let statusInterval = null;
    if (discModal && (discModal.classList.contains('visible') || discModal.style.display !== 'none')) {
        document.body.classList.add('disclaimer-active');
        hideStatusRoutine();
        statusInterval = setInterval(hideStatusRoutine, 30);
    }

    if (ackBtn && discModal && !ackBtn.dataset.hasListener) {
        ackBtn.dataset.hasListener = 'true';
        ackBtn.addEventListener('click', () => {
            if (statusInterval) clearInterval(statusInterval);
            console.log("[globalListeners] Disclaimer acknowledged: Immediate layout initialization.");
            document.body.classList.remove('disclaimer-active');
            
            discModal.classList.remove('visible');
            discModal.style.display = 'none';
            
            // Cleanly unhide and restore the workspace components instantly
            const cornerControls = document.querySelectorAll('#settings-btn, .settings-btn, .settings-button, #open-btn, .open-btn, #open-project-btn, .corner-controls, .top-right-controls');
            cornerControls.forEach(control => control.style.removeProperty('display'));
            
            const allElements = document.getElementsByTagName('*');
            for (let i = 0; i < allElements.length; i++) {
                const el = allElements[i];
                if (el.textContent.toLowerCase().includes('load a product folder')) {
                    el.style.removeProperty('visibility');
                }
            }
            
            if (loadBtn) {
                loadBtn.disabled = false;
                console.log("[globalListeners] Main layout unlocked: Folder loading enabled.");
            }
        });
    }

    // Logo Hover Effect
    const textLogo = getTextLogo();
    // Use document.body to store listener flags (textLogo is already declared at the top of the function scope)
    if (textLogo && !document.body.dataset.logoHoverListenerAttached) {
        document.body.addEventListener('mousemove', handleLogoHover);
        document.body.dataset.logoHoverListenerAttached = 'true';
    }

    // Modal Flash on Background Click
    // Corrected: Check dataset on document.body
    if (!document.body.dataset.modalFlashListenerAttached) {
        document.addEventListener('click', handleGlobalClickForModalFlash);
        document.body.dataset.modalFlashListenerAttached = 'true'; // Set flag on body
    }

    // Global Mouse State and Pan End Trigger
    // Corrected: Check dataset on document.body
    if (!document.body.dataset.globalMouseListenersAttached) {
        document.addEventListener('mousedown', handleGlobalMouseDown);
        document.addEventListener('mouseup', handleGlobalMouseUp);
        window.addEventListener('blur', handleWindowBlur); // Stop actions if window loses focus
        document.body.dataset.globalMouseListenersAttached = 'true'; // Set flag on body
    }

    if (!document.body.dataset.contextMenuDebugListenerAttached) {
        document.addEventListener('contextmenu', handleGlobalContextMenu);
        document.body.dataset.contextMenuDebugListenerAttached = 'true';
    }
}

// --- Event Handlers ---

/** Handles mouse moving over the logo area or collapsed sidebar */
function handleLogoHover(event) {
    const textLogo = getTextLogo();
    const sidebar = getSidebar();
    if (!textLogo || !sidebar) return; // Should not happen if listener is attached

    const logoRect = textLogo.getBoundingClientRect();
    const sidebarRect = sidebar.getBoundingClientRect();
    const isCollapsed = sidebar.classList.contains('collapsed');

    const isOverLogo = event.clientX >= logoRect.left && event.clientX <= logoRect.right &&
                       event.clientY >= logoRect.top && event.clientY <= logoRect.bottom;

    const isOverCollapsedSidebar = isCollapsed &&
                                   event.clientX >= sidebarRect.left && event.clientX <= sidebarRect.right &&
                                   event.clientY >= sidebarRect.top && event.clientY <= sidebarRect.bottom;

    // Add class to body to trigger CSS opacity change
    document.body.classList.toggle('logo-hover', isOverLogo || isOverCollapsedSidebar);
}


/** Global click listener to detect clicks outside the topmost visible modal and trigger flash. */
function handleGlobalClickForModalFlash(event) {
    const visibleModals = document.querySelectorAll('.modal-overlay.visible');
    if (visibleModals.length === 0) return;

    const topModalOverlay = visibleModals[visibleModals.length - 1];

    // Check if the click target is exactly the overlay backdrop
    if (event.target === topModalOverlay) {
        // Call imported function directly
        flashModalBorder(topModalOverlay); // <<< UPDATED CALL
    }
}

/** Tracks global mouse down state */
function handleGlobalMouseDown(e) {
    // Track left mouse button state primarily
    if (e.button === 0) {
        State.setIsMouseButtonDown(true);
        if (State.getDebugEnabled()) {
            const guiElement = e.target.closest('.gui-element');
            if (guiElement) {
                State.setSelectedElement(guiElement);
                e.preventDefault();
            } else if (!e.target.closest('#element-quick-inspector') && !e.target.closest('.selection-resize-handle')) {
                State.setSelectedElement(null);
            }
        }
    }
    if (e.button === 1) {
        middleMouseDownX = e.clientX;
        middleMouseDownY = e.clientY;
    }
}

/** Tracks global mouse up state and potentially ends panning */
function handleGlobalMouseUp(e) {
    // Track left mouse button state primarily
    if (e.button === 0) {
        State.setIsMouseButtonDown(false);
    }
    // If the middle mouse button is released anywhere, ensure panning stops
    if (e.button === 1) {
        // Call imported function directly
         handlePanEnd(e); // <<< UPDATED CALL
         
         // Check if it was a click (not a drag) to trigger XML jump
         const dx = Math.abs(e.clientX - middleMouseDownX);
         const dy = Math.abs(e.clientY - middleMouseDownY);
         if (dx < 5 && dy < 5) {
             handleGlobalMiddleClickOpenEditor(e);
         }
    }
}

function handleGlobalMiddleClickOpenEditor(event) {
    let isDebug = false;
    if (typeof State.getDebugEnabled === 'function') isDebug = isDebug || State.getDebugEnabled();
    if (typeof State.getDebugMode === 'function') isDebug = isDebug || State.getDebugMode();
    if (State.debugMode !== undefined) isDebug = isDebug || State.debugMode;
    if (window.debugMode !== undefined) isDebug = isDebug || window.debugMode;
    if (document.body.classList.contains('debug-mode')) isDebug = true;

    if (!isDebug) return;

    const guiElement = event.target.closest('.gui-element');
    if (!guiElement) return;

    State.setSelectedElement(guiElement);

    const canvasViewport = document.getElementById('canvas-viewport');
    if (canvasViewport) {
        State.setSavedViewportScroll(canvasViewport.scrollLeft, canvasViewport.scrollTop);
        const currentZoom = State.getCurrentZoomLevel() || 1;
        if (State.setSavedZoomLevel) State.setSavedZoomLevel(currentZoom);

        const zoomSlider = document.getElementById('zoom-slider');
        if (zoomSlider) zoomSlider.disabled = true;

        const transitionDelay = currentZoom !== 1 ? 180 : 10;
        if (currentZoom !== 1) {
            updateGuiZoom(1);
        }

        setTimeout(() => {
            const sidebar = document.getElementById('sidebar');
            const sidebarLeft = sidebar && !sidebar.classList.contains('collapsed') ? sidebar.getBoundingClientRect().left : window.innerWidth;
            const viewportRect = canvasViewport.getBoundingClientRect();
            
            const vCenterX = viewportRect.left + (sidebarLeft - viewportRect.left) / 2;
            const vCenterY = viewportRect.top + viewportRect.height / 2;

            const elRect = guiElement.getBoundingClientRect();
            const elW = elRect.width;
            const elH = elRect.height;
            
            const previewW = 500;
            const previewH = 500;
            const fits = elW <= previewW && elH <= previewH;

            // Only pan the canvas to align if the element physically fits inside the preview pane
            if (fits) {
                // The inspector window is 840px wide, 540px tall. 
                // The preview pane's center relative to the whole window is offset to the left and down.
                const targetScreenX = vCenterX - 170; 
                const targetScreenY = vCenterY + 20;  

                const currentElCenterX = elRect.left + elW / 2;
                const currentElCenterY = elRect.top + elH / 2;

                const deltaX = currentElCenterX - targetScreenX;
                const deltaY = currentElCenterY - targetScreenY;
                
                const maxScrollX = Math.max(0, canvasViewport.scrollWidth - canvasViewport.clientWidth);
                const maxScrollY = Math.max(0, canvasViewport.scrollHeight - canvasViewport.clientHeight);
                
                const targetScrollX = Math.max(0, Math.min(maxScrollX, canvasViewport.scrollLeft + deltaX));
                const targetScrollY = Math.max(0, Math.min(maxScrollY, canvasViewport.scrollTop + deltaY));

                canvasViewport.scrollTo({
                    left: targetScrollX,
                    top: targetScrollY,
                    behavior: 'smooth'
                });
            }

            let inspector = document.getElementById('element-quick-inspector');
            if (!inspector) {
                inspector = document.createElement('div');
                inspector.id = 'element-quick-inspector';
                document.body.appendChild(inspector);
            }
            inspector.style.display = 'block';
            
            // Apply depth-of-field blur and lock scrolling on the canvas background
            canvasViewport.style.transition = 'filter 0.3s ease-out';
            canvasViewport.style.filter = 'blur(6px) brightness(0.7)';
            canvasViewport.style.overflow = 'hidden';
            
            renderInspectorContent(inspector, guiElement);
        }, transitionDelay);
    }
}

function renderInspectorContent(container, el) {
    const tagName = el.dataset.xmlTagName || 'Unknown';
    const x = parseFloat(el.style.left) || 0;
    const y = parseFloat(el.style.top) || 0;
    const w = parseFloat(el.style.width) || el.clientWidth || 0;
    const h = parseFloat(el.style.height) || el.clientHeight || 0;

    const previewW = 500;
    const previewH = 500;
    const panelW = 340;
    const headerH = 40;
    
    const inspectorWidth = previewW + panelW;
    const inspectorHeight = previewH + headerH;

    // Apply a standard 24px padding so elements touching the max border don't hit the absolute edge
    const previewScale = Math.min(1, Math.min((previewW - 24) / w, (previewH - 24) / h));

    container.style.position = 'fixed';
    container.style.width = `${inspectorWidth}px`;
    container.style.height = `${inspectorHeight}px`;
    container.style.background = 'rgba(45, 55, 72, 0.9)';
    container.style.backdropFilter = 'blur(8px)';
    container.style.border = '2px solid rgba(255, 255, 255, 0.2)';
    container.style.borderRadius = '8px';
    container.style.boxShadow = '0 12px 40px rgba(0,0,0,0.6)';
    container.style.zIndex = '900';
    container.style.overflow = 'hidden';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.pointerEvents = 'auto'; 

    const canvasViewport = document.getElementById('canvas-viewport');
    
    // Dynamically center the inspector based on the responsive canvas-viewport size
    const updatePosition = () => {
        if (!canvasViewport || container.style.display === 'none') return;
        const sidebar = document.getElementById('sidebar');
        const sidebarLeft = sidebar && !sidebar.classList.contains('collapsed') ? sidebar.getBoundingClientRect().left : window.innerWidth;
        const rect = canvasViewport.getBoundingClientRect();
        
        const vCenterX = rect.left + (sidebarLeft - rect.left) / 2;
        const vCenterY = rect.top + rect.height / 2;
        
        container.style.left = `${vCenterX - inspectorWidth / 2}px`;
        container.style.top = `${vCenterY - inspectorHeight / 2}px`;
    };
    
    updatePosition();
    
    if (container.resizeObserver) container.resizeObserver.disconnect();
    container.resizeObserver = new ResizeObserver(updatePosition);
    if (canvasViewport) container.resizeObserver.observe(canvasViewport);

    let html = `
        <div id="qi-header" style="background: rgba(26, 32, 44, 0.7); color: #fff; padding: 10px; font-weight: bold; user-select: none; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); flex-shrink: 0; height: ${headerH}px; box-sizing: border-box;">
            <span>Element: &lt;${tagName}&gt;</span>
            <button id="qi-close-btn" style="background: none; border: none; color: #fff; cursor: pointer; font-weight: bold; font-size: 14px;">X</button>
        </div>
        <div style="display: flex; flex-direction: row; height: ${previewH}px; overflow: hidden;">
            <div style="width: ${previewW}px; height: ${previewH}px; background: rgba(0,0,0,0.2); border-right: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; flex-shrink: 0;">
                <div style="position: absolute; top: 4px; left: 4px; color: rgba(255,255,255,0.6); font-size: 10px; font-family: monospace; z-index: 10;">Isolated Preview</div>
                <div id="qi-preview-wrapper" style="transform: scale(${previewScale}); transform-origin: center; display: flex; align-items: center; justify-content: center; width: ${w}px; height: ${h}px; pointer-events: none; position: relative;">
                </div>
            </div>
            <div style="flex-grow: 1; padding: 12px; overflow-y: auto; color: #fff; width: ${panelW}px; box-sizing: border-box; display: flex; flex-direction: column;">
                <div style="margin-bottom: 12px; background: rgba(26, 32, 44, 0.6); padding: 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;">
                    <label style="font-size: 11px; color: #cbd5e0; display: block; margin-bottom: 6px; font-weight: bold;">Position & Size</label>
                    <div style="display: flex; gap: 6px;">
                        <span style="font-size:10px; color:#a0aec0; align-self: center;">X:</span><input type="number" id="qi-input-x" value="${x}" style="width:45px; background:rgba(0,0,0,0.3); color:#fff; border:1px solid rgba(255,255,255,0.2); padding:3px; font-size:11px; border-radius:3px;" />
                        <span style="font-size:10px; color:#a0aec0; align-self: center;">Y:</span><input type="number" id="qi-input-y" value="${y}" style="width:45px; background:rgba(0,0,0,0.3); color:#fff; border:1px solid rgba(255,255,255,0.2); padding:3px; font-size:11px; border-radius:3px;" />
                        <span style="font-size:10px; color:#a0aec0; align-self: center;">W:</span><input type="number" id="qi-input-w" value="${w}" style="width:45px; background:rgba(0,0,0,0.3); color:#fff; border:1px solid rgba(255,255,255,0.2); padding:3px; font-size:11px; border-radius:3px;" />
                        <span style="font-size:10px; color:#a0aec0; align-self: center;">H:</span><input type="number" id="qi-input-h" value="${h}" style="width:45px; background:rgba(0,0,0,0.3); color:#fff; border:1px solid rgba(255,255,255,0.2); padding:3px; font-size:11px; border-radius:3px;" />
                    </div>
                </div>
                <div style="font-size: 12px; font-weight: bold; margin-bottom: 8px; color: #cbd5e0; flex-shrink: 0;">Attributes Layout</div>
                <div id="qi-attributes-list" style="flex-grow: 1; overflow-y: auto; margin-bottom: 12px; min-height: 50px;">
    `;

    for (const key in el.dataset) {
        if (key.startsWith('xmlAttr_')) {
            const attrName = key.slice(8);
            const attrValue = el.dataset[key];
            const lowerAttr = attrName.toLowerCase();
            const isColor = lowerAttr.includes('color');
            const hasOptions = !isColor && ['param', 'image', 'background', 'hoverimage', 'position', 'align', 'font', 'style'].some(k => lowerAttr.includes(k));
            
            let safeHex = '#ffffff';
            if (attrValue && attrValue.startsWith('#')) {
                safeHex = attrValue.length === 4 ? '#' + attrValue[1]+attrValue[1] + attrValue[2]+attrValue[2] + attrValue[3]+attrValue[3] : attrValue.substring(0, 7);
            }

            const isParamAttr = lowerAttr.includes('param');
            const isStyleAttr = lowerAttr === 'style';
            let linkClass = '';
            let linkColor = '#a0aec0';
            let linkCursor = 'default';
            let linkDecoration = 'none';
            let linkTitle = attrName;

            if (isParamAttr) {
                linkClass = 'qi-param-link';
                linkColor = '#63b3ed';
                linkCursor = 'pointer';
                linkDecoration = 'underline';
                linkTitle = 'Click to open Parameter Reference';
            } else if (isStyleAttr) {
                linkClass = 'qi-style-link';
                linkColor = '#9f7aea';
                linkCursor = 'pointer';
                linkDecoration = 'underline';
                linkTitle = 'Click to open styles.xml';
            }

            html += `
                <div class="qi-attr-row" style="margin-bottom:4px; position:relative; display:flex; align-items:center;" data-attr-name="${attrName}">
                    <span class="${linkClass}" style="font-size:11px; color:${linkColor}; display:inline-block; width:90px; overflow:hidden; text-overflow:ellipsis; flex-shrink:0; cursor:${linkCursor}; text-decoration:${linkDecoration};" title="${linkTitle}">${attrName}</span>
                    <input type="text" class="qi-attr-val-input" data-attr-key="${key}" value="${attrValue}" style="flex-grow:1; width:0; background:rgba(0,0,0,0.3); color:#fff; border:1px solid rgba(255,255,255,0.2); padding:2px; font-size:11px; border-radius:3px;" />
                    ${isColor ? `
                        <div class="qi-color-preview" data-attr-name="${attrName}" style="position:relative; width:14px; height:14px; background:${attrValue || 'transparent'}; border:1px solid rgba(255,255,255,0.5); margin-left:4px; border-radius:2px; flex-shrink:0; box-sizing:border-box; cursor:pointer;" title="Click to Pick Color">
                        </div>
                    ` : ''}
                    ${hasOptions ? `<button class="qi-options-btn" data-attr-name="${attrName}" style="background:rgba(255,255,255,0.1); color:#fff; border:1px solid rgba(255,255,255,0.2); padding:1px 6px; cursor:pointer; font-size:11px; margin-left:4px; border-radius:2px;" title="Select Option">...</button>` : ''}
                    <button class="qi-delete-row-btn" style="background:#e53e3e; color:#fff; border:none; padding:2px 6px; cursor:pointer; font-size:11px; margin-left:4px; border-radius:2px; flex-shrink:0;">X</button>
                </div>
            `;
        }
    }

    html += `
            </div>
            <div style="border-top:1px solid rgba(255,255,255,0.1); padding-top:6px; flex-shrink: 0; display:flex; gap:4px; align-items:center;">
                <select id="qi-add-attr-select" style="flex-grow:1; background:rgba(26, 32, 44, 0.9); color:#fff; border:1px solid rgba(255,255,255,0.2); padding:3px; font-size:11px; border-radius:3px;">
                    <option value="">-- Add Attribute --</option>
                    <option value="--custom--">✎ Add Custom...</option>
    `;

    // Fetch context-aware allowed attributes for this specific element tag from reference JSON
    let allowedAttrsSet = new Set();
    const elementsRef = (Refs && typeof Refs.getElementReferenceData === 'function') ? Refs.getElementReferenceData() : [];
    const foundElementRef = elementsRef.find(e => e && (e.element === tagName || String(e.element).toLowerCase() === String(tagName).toLowerCase()));
    if (foundElementRef) {
        if (foundElementRef.attributes) {
            Object.keys(foundElementRef.attributes).forEach(k => allowedAttrsSet.add(k));
        }
        if (foundElementRef.usesCommonAttributes !== false) {
            const commonAttrs = (Refs && typeof Refs.getCommonAttributes === 'function') ? Refs.getCommonAttributes() : {};
            Object.keys(commonAttrs).forEach(k => allowedAttrsSet.add(k));
        }
    }
    if (allowedAttrsSet.size === 0) {
        const allowedAttrsObj = State.getAllowedAttributes ? State.getAllowedAttributes(tagName) : (State.getCommonAttributes ? State.getCommonAttributes() : {});
        const allowedAttrsListAlt = Array.isArray(allowedAttrsObj) ? allowedAttrsObj : Object.keys(allowedAttrsObj);
        allowedAttrsListAlt.forEach(k => allowedAttrsSet.add(k));
    }
    const allowedAttrsList = Array.from(allowedAttrsSet);
    
    allowedAttrsList.sort().forEach(attrName => {
        if (!el.dataset[`xmlAttr_${attrName}`]) {
            html += `<option value="${attrName}">${attrName}</option>`;
        }
    });

    html += `
                </select>
                <button id="qi-add-attr-btn" style="background:#3182ce; color:#fff; border:none; padding:3px 8px; cursor:pointer; font-size:11px; border-radius:3px;">Add</button>
            </div>
            <div style="margin-top:12px; text-align:right; flex-shrink: 0;">
                <button id="qi-jump-editor-btn" style="background:#4a5568;color:#fff;border:none;padding:5px 10px;cursor:pointer;font-size:11px; border-radius:3px; transition: background 0.2s;">Jump to XML Source</button>
            </div>
        </div></div>
    `;

    container.innerHTML = html;

    // Create the global floating dropdown context menu for options if it doesn't exist
    let popup = document.getElementById('qi-options-popup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'qi-options-popup';
        popup.style.position = 'fixed';
        popup.style.background = 'rgba(26, 32, 44, 0.95)';
        popup.style.backdropFilter = 'blur(4px)';
        popup.style.border = '1px solid rgba(255,255,255,0.2)';
        popup.style.zIndex = '10000';
        popup.style.maxHeight = '200px';
        popup.style.overflowY = 'auto';
        popup.style.boxShadow = '0 5px 15px rgba(0,0,0,0.5)';
        popup.style.borderRadius = '4px';
        popup.style.display = 'none';
        popup.style.minWidth = '120px';
        document.body.appendChild(popup);
        
        // Globally close popup on background click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#qi-options-popup') && !e.target.closest('.qi-options-btn')) {
                popup.style.display = 'none';
            }
        });
    }

    // Attach listeners for the custom floating alpha color pickers
    container.querySelectorAll('.qi-color-preview').forEach(previewElement => {
        previewElement.addEventListener('click', (e) => {
            e.stopPropagation();
            const row = e.target.closest('.qi-attr-row');
            if (!row) return;
            const inputElement = row.querySelector('.qi-attr-val-input');
            if (!inputElement) return;

            let currentVal = (inputElement.value || '#FFFFFFFF').trim();
            if (!currentVal.startsWith('#')) currentVal = '#FFFFFFFF';
            
            if (currentVal.length === 4) {
                currentVal = '#' + currentVal[1] + currentVal[1] + currentVal[2] + currentVal[2] + currentVal[3] + currentVal[3] + 'FF';
            } else if (currentVal.length === 7) {
                currentVal += 'FF';
            }

            const baseColorHex = currentVal.substring(0, 7);
            const initialAlpha = currentVal.length === 9 ? parseInt(currentVal.substring(7, 9), 16) : 255;

            let qiPicker = document.getElementById('qi-dynamic-color-picker');
            if (qiPicker) qiPicker.remove();

            qiPicker = document.createElement('div');
            qiPicker.id = 'qi-dynamic-color-picker';
            qiPicker.style.position = 'fixed';
            qiPicker.style.zIndex = '10005';
            qiPicker.style.border = '1px solid rgba(255,255,255,0.2)';
            qiPicker.style.background = '#1a202c';
            qiPicker.style.padding = '10px';
            qiPicker.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
            qiPicker.style.borderRadius = '6px';
            qiPicker.style.display = 'flex';
            qiPicker.style.flexDirection = 'column';
            qiPicker.style.gap = '6px';

            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.value = baseColorHex;
            colorInput.style.width = '100%';
            colorInput.style.cursor = 'pointer';

            const alphaSlider = document.createElement('input');
            alphaSlider.type = 'range';
            alphaSlider.min = '0';
            alphaSlider.max = '255';
            alphaSlider.value = String(initialAlpha);
            alphaSlider.style.width = '100%';

            const alphaLabel = document.createElement('span');
            alphaLabel.style.fontSize = '11px';
            alphaLabel.style.color = '#cbd5e0';
            alphaLabel.style.textAlign = 'center';
            alphaLabel.textContent = `Alpha: ${initialAlpha}`;

            const updateColorValue = () => {
                const alphaHex = parseInt(alphaSlider.value).toString(16).padStart(2, '0').toUpperCase();
                const finalHex = (colorInput.value + alphaHex).toUpperCase();
                alphaLabel.textContent = `Alpha: ${alphaSlider.value}`;
                inputElement.value = finalHex;
                previewElement.style.background = finalHex;
                inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            };

            colorInput.addEventListener('input', updateColorValue);
            alphaSlider.addEventListener('input', updateColorValue);

            qiPicker.appendChild(colorInput);
            qiPicker.appendChild(alphaSlider);
            qiPicker.appendChild(alphaLabel);
            document.body.appendChild(qiPicker);

            const rect = previewElement.getBoundingClientRect();
            qiPicker.style.left = `${rect.right + 6}px`;
            qiPicker.style.top = `${rect.top}px`;

            const closePickerHandler = (event) => {
                if (!qiPicker.contains(event.target) && event.target !== previewElement) {
                    qiPicker.remove();
                    document.removeEventListener('mousedown', closePickerHandler);
                }
            };
            setTimeout(() => {
                document.addEventListener('mousedown', closePickerHandler);
            }, 0);
        });
    });

    // Attach listeners to populate and show the options popup
    container.querySelectorAll('.qi-options-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const buttonNode = e.currentTarget;
            const attrName = buttonNode.dataset.attrName;
            const lowerAttr = attrName.toLowerCase();
            
            let options = [];
            
            // Broaden matching and dynamically scrape GUI components if State returns null
            if (lowerAttr.includes('param')) {
                options = [];
                const inputEl = buttonNode.parentElement.querySelector('.qi-attr-val-input');
                const currentVal = inputEl ? inputEl.value.trim() : '';
                
                const categories = (Refs && typeof Refs.getParamCategories === 'function') ? Refs.getParamCategories() : [];
                const skinRoot = (typeof State.getCurrentSkinRoot === 'function' ? State.getCurrentSkinRoot() : '') || '';
                const productKeywords = ['sfc', 'portafm', 'ops7', 'md', 'c64'];
                let detectedCategory = null;
                for (const keyword of productKeywords) {
                    if (skinRoot.toLowerCase().includes(keyword)) {
                        detectedCategory = categories.find(cat => cat.toLowerCase().includes(keyword));
                        if (detectedCategory) break;
                    }
                }

                let paramList = [];
                if (detectedCategory) {
                    paramList = (Refs && typeof Refs.getParamsByCategory === 'function') ? Refs.getParamsByCategory(detectedCategory) : [];
                }
                if (!paramList || paramList.length === 0) {
                    categories.forEach(cat => {
                        const cats = (Refs && typeof Refs.getParamsByCategory === 'function') ? Refs.getParamsByCategory(cat) : [];
                        if (Array.isArray(cats)) {
                            paramList = paramList.concat(cats);
                        }
                    });
                }
                if (!paramList || paramList.length === 0) {
                    const directData = (Refs && typeof Refs.getParamReferenceData === 'function') ? Refs.getParamReferenceData() : (typeof State.getParamReferenceData === 'function' ? State.getParamReferenceData() : {});
                    if (directData && typeof directData === 'object') {
                        Object.keys(directData).forEach(catKey => {
                            if (Array.isArray(directData[catKey])) {
                                paramList = paramList.concat(directData[catKey]);
                            }
                        });
                    }
                }

                const seenIDs = new Set();
                if (Array.isArray(paramList)) {
                    paramList.forEach(p => {
                        if (!p) return;
                        const pID = p.paramID !== undefined ? p.paramID : (p.paramid !== undefined ? p.paramid : p.id);
                        if (pID === undefined) return;
                        const pIDStr = String(pID).trim();
                        if (!pIDStr || seenIDs.has(pIDStr)) return;
                        seenIDs.add(pIDStr);
                        
                        const nameStr = p.name || p.label || '(No Name)';
                        options.push({
                            value: pIDStr,
                            text: `${pIDStr}: ${nameStr}`,
                            isHighlighted: (pIDStr === currentVal),
                            sortKey: parseInt(pIDStr, 10) || 0
                        });
                    });
                }

                options.sort((a, b) => a.sortKey - b.sortKey);
                if (options.length === 0) options = ['(No params loaded)'];
            }
            else if (lowerAttr.includes('image') || lowerAttr.includes('background') || lowerAttr.includes('hoverimage')) {
                options = (typeof State.getAvailableImages === 'function' ? State.getAvailableImages() : null);
                if (!options || options.length === 0) options = ['(No images loaded)'];
            }
            else if (lowerAttr.includes('position')) {
                options = ['absolute', 'relative', 'centered'];
            }
            else if (lowerAttr.includes('align')) {
                options = ['left', 'center', 'right', 'top', 'bottom'];
            }
            else if (lowerAttr.includes('font')) {
                options = (typeof State.getAvailableFonts === 'function' ? State.getAvailableFonts() : null);
                if (!options || options.length === 0) {
                    // Scrape document for parsed Fonts
                    options = Array.from(document.querySelectorAll('[data-xml-tag-name="Font"], [data-xml-tag-name="font"]'))
                        .map(n => n.dataset.xmlAttr_name || n.dataset.xmlAttr_id).filter(Boolean);
                }
                options = [...new Set(options)].filter(Boolean);
                if (options.length === 0) options = ['(No fonts loaded)'];
            }
            else if (lowerAttr.includes('style')) {
                options = [];
                const inputEl = buttonNode.parentElement.querySelector('.qi-attr-val-input');
                const currentVal = inputEl ? inputEl.value.trim() : '';
                const seenStyles = new Set();

                // 1. Scrape structural DOM nodes strictly matching a fully parsed <Style> element
                const allElements = document.getElementsByTagName('*');
                for (let i = 0; i < allElements.length; i++) {
                    const n = allElements[i];
                    const tag = (n.dataset?.xmlTagName || n.getAttribute('data-xml-tag-name') || '').toLowerCase();
                    if (tag === 'style') {
                        const nameAttr = n.dataset?.xmlAttr_name || n.getAttribute('data-xml-attr_name') ||
                                         n.dataset?.xmlAttr_id || n.getAttribute('data-xml-attr_id');
                        const nameStr = nameAttr ? String(nameAttr).trim() : '';
                        if (nameStr && !seenStyles.has(nameStr)) {
                            seenStyles.add(nameStr);
                            options.push({
                                value: nameStr,
                                text: nameStr,
                                isHighlighted: (nameStr === currentVal)
                            });
                        }
                    }
                }

                // 2. Scan open text editors, sidebar views, or workspace containers line-by-line via robust regex
                for (let i = 0; i < allElements.length; i++) {
                    const elNode = allElements[i];
                    const text = elNode.value || elNode.textContent || elNode.dataset?.rawXml || '';
                    if (text.includes('Style') || text.includes('style')) {
                        const lines = text.split('\n');
                        for (let j = 0; j < lines.length; j++) {
                            const line = lines[j];
                            const match = line.match(/<style\b[^>]*?\b(name|id)=["']([^"']+)["']/i);
                            if (match && match[2]) {
                                const nameStr = match[2].trim();
                                if (nameStr && !seenStyles.has(nameStr)) {
                                    seenStyles.add(nameStr);
                                    options.push({
                                        value: nameStr,
                                        text: nameStr,
                                        isHighlighted: (nameStr === currentVal)
                                    });
                                }
                            }
                        }
                    }
                }

                // 3. Fallback: Scan underlying workspace file map for global template discovery
                if (typeof State.getFileMap === 'function') {
                    State.getFileMap().forEach((content, filePath) => {
                        if (filePath.toLowerCase().includes('styles.xml') || content.includes('Style') || content.includes('style')) {
                            const lines = content.split('\n');
                            for (let j = 0; j < lines.length; j++) {
                                const line = lines[j];
                                const match = line.match(/<style\b[^>]*?\b(name|id)=["']([^"']+)["']/i);
                                if (match && match[2]) {
                                    const nameStr = match[2].trim();
                                    if (nameStr && !seenStyles.has(nameStr)) {
                                        seenStyles.add(nameStr);
                                        options.push({
                                            value: nameStr,
                                            text: nameStr,
                                            isHighlighted: (nameStr === currentVal)
                                        });
                                    }
                                }
                            }
                        }
                    });
                }

                options.sort((a, b) => a.text.localeCompare(b.text));
                if (options.length === 0) options = [{ value: '', text: '(No styles loaded)' }];
            }

            popup.innerHTML = '';
            let elementToScroll = null;
            options.forEach(opt => {
                const div = document.createElement('div');
                let valueStr = '';
                let displayStr = '';
                let highlight = false;

                if (opt && typeof opt === 'object') {
                    valueStr = opt.value;
                    displayStr = opt.text;
                    highlight = opt.isHighlighted;
                } else {
                    valueStr = String(opt);
                    displayStr = String(opt);
                    const inputEl = buttonNode.parentElement.querySelector('.qi-attr-val-input');
                    if (inputEl && inputEl.value.trim() === valueStr.trim()) {
                        highlight = true;
                    }
                }

                div.textContent = displayStr;
                div.style.padding = '6px 10px';
                div.style.fontSize = '11px';
                div.style.color = '#fff';
                div.style.cursor = valueStr.startsWith('(') ? 'default' : 'pointer';
                div.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                
                if (highlight) {
                    div.style.background = '#3182ce';
                    elementToScroll = div;
                }
                
                if (!valueStr.startsWith('(')) {
                    div.addEventListener('mousemove', () => {
                        if (!highlight) div.style.background = 'rgba(255,255,255,0.1)';
                    });
                    div.addEventListener('mouseleave', () => {
                        if (!highlight) div.style.background = 'transparent';
                    });
                    div.addEventListener('click', () => {
                        const input = buttonNode.parentElement.querySelector('.qi-attr-val-input');
                        if (input) {
                            input.value = valueStr;
                            input.dispatchEvent(new Event('input')); 
                        }
                        popup.style.display = 'none';
                    });
                } else {
                    div.style.color = '#a0aec0';
                }
                popup.appendChild(div);
            });
            if (elementToScroll) {
                setTimeout(() => {
                    elementToScroll.scrollIntoView({ block: 'center' });
                }, 40);
            }
            
            const rect = buttonNode.getBoundingClientRect();
            popup.style.left = `${rect.left}px`;
            popup.style.top = `${rect.bottom + 4}px`;
            popup.style.display = 'block';
        });
    });

    // Attach click listeners to parameter hotlinks
    container.querySelectorAll('.qi-param-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const row = e.target.closest('.qi-attr-row');
            if (!row) return;
            const inputElement = row.querySelector('.qi-attr-val-input');
            const paramVal = inputElement ? inputElement.value.trim() : '';
            document.dispatchEvent(new CustomEvent('jumpToParam', { detail: { id: paramVal } }));
        });
    });

    // Attach click listeners to style hotlinks to open styles.xml
    container.querySelectorAll('.qi-style-link').forEach(link => {
        link.addEventListener('click', () => {
            let stylesPath = '';
            
            // 1. Search file loader / sidebar tree nodes for case-sensitive active or green-highlighted styles.xml
            const sidebarFiles = Array.from(document.querySelectorAll('[data-file-path]'));
            const styleFileNode = sidebarFiles.find(node => {
                const p = (node.dataset.filePath || '').toLowerCase();
                return p.endsWith('styles.xml') && (
                    node.classList.contains('used-file') || 
                    node.classList.contains('highlighted') ||
                    node.style.backgroundColor.includes('rgba(34, 197, 94')
                );
            }) || sidebarFiles.find(node => (node.dataset.filePath || '').toLowerCase().endsWith('styles.xml'));

            if (styleFileNode && styleFileNode.dataset.filePath) {
                stylesPath = styleFileNode.dataset.filePath;
            }

            // 2. Prioritize querying active DOM components for an open file reference already exhibiting accurate styles.xml casing
            if (!stylesPath) {
                const styleNode = Array.from(document.querySelectorAll('*'))
                    .find(node => node.dataset?.sourcePath && node.dataset.sourcePath.toLowerCase().includes('styles.xml'));
                if (styleNode) {
                    stylesPath = styleNode.dataset.sourcePath;
                }
            }

            // 3. Fallback: extract the directory prefix from the current active element's source path layout
            if (!stylesPath) {
                const currentSourcePath = el.dataset.sourcePath || '';
                if (currentSourcePath) {
                    const firstSlash = currentSourcePath.indexOf('/');
                    if (firstSlash !== -1) {
                        stylesPath = currentSourcePath.substring(0, firstSlash) + '/styles.xml';
                    }
                }
            }

            // 4. Fallback: query active generic skin workspace root state parameters
            if (!stylesPath) {
                const skinRoot = (typeof State.getCurrentSkinRoot === 'function' ? State.getCurrentSkinRoot() : '') || '';
                stylesPath = skinRoot ? `${skinRoot}/styles.xml` : 'styles.xml';
            }

            // 5. Force strict casing normalization correction for known chipsynth instrument workspace directories
            const lowerPath = stylesPath.toLowerCase();
            if (lowerPath.includes('chipsynth sfc')) stylesPath = stylesPath.replace(/chipsynth sfc/i, 'chipsynth SFC');
            else if (lowerPath.includes('chipsynth portafm')) stylesPath = stylesPath.replace(/chipsynth portafm/i, 'chipsynth PortaFM');
            else if (lowerPath.includes('chipsynth ops7')) stylesPath = stylesPath.replace(/chipsynth ops7/i, 'chipsynth OPS7');
            else if (lowerPath.includes('chipsynth md')) stylesPath = stylesPath.replace(/chipsynth md/i, 'chipsynth MD');
            else if (lowerPath.includes('chipsynth c64')) stylesPath = stylesPath.replace(/chipsynth c64/i, 'chipsynth C64');
            
            container.querySelector('#qi-close-btn').click();
            if (typeof openXmlEditor === 'function') {
                openXmlEditor(stylesPath);
                // Keep the Quick Inspector open when jumping to styles.xml
                // The XML editor opens as a separate modal, so the inspector should remain visible.
                const inspector = document.getElementById('element-quick-inspector');
                if (inspector) {
                    inspector.style.display = 'flex'; // Ensure it stays visible
                    // Also ensure the canvas blur/scroll lock is not removed by the inspector's own close logic
                    const cViewport = document.getElementById('canvas-viewport');
                    if (cViewport) {
                        cViewport.style.filter = 'blur(6px) brightness(0.7)';
                        cViewport.style.overflow = 'hidden';
                    }
                }
            }
        });
    });

    const previewWrapper = container.querySelector('#qi-preview-wrapper');
    if (previewWrapper) {
        const clone = el.cloneNode(true);
        clone.removeAttribute('id');
        clone.style.setProperty('left', '0px', 'important');
        clone.style.setProperty('top', '0px', 'important');
        clone.style.setProperty('position', 'relative', 'important');
        clone.style.setProperty('margin', '0px', 'important');
        clone.style.setProperty('transform', 'none', 'important');

        // Strip out the green selection box from the clone
        const clonedSelection = clone.querySelector('#qi-selection-box');
        if (clonedSelection) clonedSelection.remove();

        // Deep sync state (inputs, selects, textareas)
        const originalInputs = [el, ...el.querySelectorAll('input, select, textarea')];
        const clonedInputs = [clone, ...clone.querySelectorAll('input, select, textarea')];
        originalInputs.forEach((input, index) => {
            const cInput = clonedInputs[index];
            if (cInput) {
                if (input.tagName === 'SELECT') cInput.selectedIndex = input.selectedIndex;
                cInput.value = input.value;
                if ('checked' in input) cInput.checked = input.checked;
            }
        });

        // Deep sync canvas states
        const originalCanvases = [el, ...el.querySelectorAll('canvas')].filter(e => e.tagName === 'CANVAS');
        const clonedCanvases = [clone, ...clone.querySelectorAll('canvas')].filter(e => e.tagName === 'CANVAS');
        originalCanvases.forEach((canvas, index) => {
            const cCanvas = clonedCanvases[index];
            if (cCanvas) {
                const ctx = cCanvas.getContext('2d');
                if (ctx) ctx.drawImage(canvas, 0, 0);
            }
        });

        previewWrapper.appendChild(clone);
        detectAndDrawTightBounds(el, previewWrapper);
    }

    container.querySelector('#qi-close-btn').addEventListener('click', () => {
        container.style.display = 'none';
        const zoomSlider = document.getElementById('zoom-slider');
        if (zoomSlider) zoomSlider.disabled = false;
        
        if (container.resizeObserver) {
            container.resizeObserver.disconnect();
            container.resizeObserver = null;
        }

        const cViewport = document.getElementById('canvas-viewport');
        if (cViewport) {
            cViewport.style.filter = 'none'; // Clear the blur
            cViewport.style.overflow = ''; // Restore panning
            
            if (State.getSavedZoomLevel) {
                updateGuiZoom(State.getSavedZoomLevel());
            }
            setTimeout(() => {
                const savedScroll = State.getSavedViewportScroll();
                cViewport.scrollTo({
                    left: savedScroll.left,
                    top: savedScroll.top,
                    behavior: 'smooth'
                });
            }, 50);
        }
    });

    const syncDimensions = () => {
        const nx = parseInt(document.getElementById('qi-input-x').value) || 0;
        const ny = parseInt(document.getElementById('qi-input-y').value) || 0;
        const nw = parseInt(document.getElementById('qi-input-w').value) || 8;
        const nh = parseInt(document.getElementById('qi-input-h').value) || 8;
        el.style.left = `${nx}px`;
        el.style.top = `${ny}px`;
        el.style.width = `${nw}px`;
        el.style.height = `${nh}px`;
        el.dataset.xmlAttr_x = nx;
        el.dataset.xmlAttr_y = ny;
        el.dataset.xmlAttr_w = nw;
        el.dataset.xmlAttr_h = nh;
        el.dataset.xmlAttr_width = nw;
        el.dataset.xmlAttr_height = nh;
        if (window.updateSelectionOutline) window.updateSelectionOutline();
        State.setXmlEditorDirty(true);
    };

    ['qi-input-x', 'qi-input-y', 'qi-input-w', 'qi-input-h'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            syncDimensions();
            if (window.syncElementChangesToXmlSource) {
                window.syncElementChangesToXmlSource(el);
            }
        });
    });

    container.querySelectorAll('.qi-attr-val-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const datasetKey = e.target.dataset.attrKey;
            el.dataset[datasetKey] = e.target.value;
            
            // Live update the color preview swatch if the user manually types a hex code
            const preview = e.target.parentElement.querySelector('.qi-color-preview');
            if (preview) {
                preview.style.background = e.target.value;
            }

            State.setXmlEditorDirty(true);
            if (window.syncElementChangesToXmlSource) {
                window.syncElementChangesToXmlSource(el);
            }
        });
    });

    container.querySelectorAll('.qi-delete-row-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const row = e.target.closest('[data-attr-name]');
            const attrName = row.dataset.attrName;
            delete el.dataset[`xmlAttr_${attrName}`];
            State.setXmlEditorDirty(true);
            if (window.syncElementChangesToXmlSource) {
                window.syncElementChangesToXmlSource(el);
            }
            renderInspectorContent(container, el);
        });
    });

    container.querySelector('#qi-add-attr-btn').addEventListener('click', () => {
        const select = document.getElementById('qi-add-attr-select');
        let selectedVal = select.value;
        if (!selectedVal) return;
        
        if (selectedVal === '--custom--') {
            let promptVal = prompt("Enter custom attribute name (e.g., param, value):");
            if (!promptVal || !promptVal.trim()) return;
            
            // Strip spaces and hyphens to prevent DOMStringMap assignment crashes
            selectedVal = promptVal.trim().replace(/[^a-zA-Z0-9_]/g, '');
            if (!selectedVal) return; // Exit if they only typed invalid characters
        }

        el.dataset[`xmlAttr_${selectedVal}`] = '';
        State.setXmlEditorDirty(true);
        if (window.syncElementChangesToXmlSource) {
            window.syncElementChangesToXmlSource(el);
        }
        renderInspectorContent(container, el);
    });

    container.querySelector('#qi-jump-editor-btn').addEventListener('click', () => {
        const filePath = el.dataset.sourcePath;
        if (!filePath) return;
        
        // Trigger the close routine to clean up the blur and zoom locks
        container.querySelector('#qi-close-btn').click();
        openXmlEditor(filePath);
    });
}

window.updateInspectorReadout = function(targetEl) {
    const inspector = document.getElementById('element-quick-inspector');
    if (!inspector || inspector.style.display === 'none') return;
    const inputX = document.getElementById('qi-input-x');
    const inputY = document.getElementById('qi-input-y');
    const inputW = document.getElementById('qi-input-w');
    const inputH = document.getElementById('qi-input-h');
    if (inputX) inputX.value = parseFloat(targetEl.style.left) || 0;
    if (inputY) inputY.value = parseFloat(targetEl.style.top) || 0;
    if (inputW) inputW.value = parseFloat(targetEl.style.width) || targetEl.clientWidth || 0;
    if (inputH) inputH.value = parseFloat(targetEl.style.height) || targetEl.clientHeight || 0;
};

/** Handles ending actions if the window loses focus */
function handleWindowBlur() {
    console.log("[globalListeners] Window lost focus.");
    // Ensure mouse button state is reset
    State.setIsMouseButtonDown(false);
    // Ensure panning stops if active
    // Call imported function directly
     handlePanEnd(); // <<< UPDATED CALL (Call without event object)
}

/** Scans elements to draw tight diagnostic red boxes around visible pixels */
function detectAndDrawTightBounds(originalEl, previewWrapper) {
    if (!originalEl || !previewWrapper) return;
    const img = originalEl.tagName === 'IMG' ? originalEl : originalEl.querySelector('img');
    
    if (img && img.src) {
        // Image Canvas Pixel Scanning
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const tempImg = new Image();
        tempImg.crossOrigin = 'Anonymous';
        tempImg.onload = () => {
            try {
                canvas.width = tempImg.width;
                canvas.height = tempImg.height;
                ctx.drawImage(tempImg, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
                let found = false;
                
                // Scan all pixels for Alpha channel > 10
                for (let y = 0; y < canvas.height; y++) {
                    for (let x = 0; x < canvas.width; x++) {
                        if (data[(y * canvas.width + x) * 4 + 3] > 10) {
                            if (x < minX) minX = x;
                            if (x > maxX) maxX = x;
                            if (y < minY) minY = y;
                            if (y > maxY) maxY = y;
                            found = true;
                        }
                    }
                }
                if (found) {
                    const rect = img.getBoundingClientRect();
                    const origRect = originalEl.getBoundingClientRect();
                    const scaleX = rect.width / canvas.width;
                    const scaleY = rect.height / canvas.height;
                    const offsetX = rect.left - origRect.left;
                    const offsetY = rect.top - origRect.top;

                    const tightBox = document.createElement('div');
                    tightBox.style.position = 'absolute';
                    tightBox.style.border = '1px dashed #ef4444';
                    tightBox.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.5)';
                    tightBox.style.pointerEvents = 'none';
                    tightBox.style.zIndex = '20';
                    tightBox.style.left = `${offsetX + minX * scaleX}px`;
                    tightBox.style.top = `${offsetY + minY * scaleY}px`;
                    tightBox.style.width = `${(maxX - minX + 1) * scaleX}px`;
                    tightBox.style.height = `${(maxY - minY + 1) * scaleY}px`;
                    
                    previewWrapper.appendChild(tightBox);
                }
            } catch (e) { console.warn("Pixel scan CORS error", e); }
        };
        tempImg.src = img.src;
    } else {
        // Native SVG Node Scanning Fallback
        const svg = originalEl.tagName === 'SVG' ? originalEl : originalEl.querySelector('svg');
        if (svg && typeof svg.getBBox === 'function') {
            try {
                const bbox = svg.getBBox();
                if (bbox.width > 0 && bbox.height > 0) {
                    const rect = svg.getBoundingClientRect();
                    const origRect = originalEl.getBoundingClientRect();
                    const offsetX = rect.left - origRect.left;
                    const offsetY = rect.top - origRect.top;
                    
                    let scaleX = 1, scaleY = 1;
                    if (svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width > 0) {
                        scaleX = rect.width / svg.viewBox.baseVal.width;
                        scaleY = rect.height / svg.viewBox.baseVal.height;
                    } else {
                        scaleX = rect.width / (svg.width.baseVal.value || rect.width);
                        scaleY = rect.height / (svg.height.baseVal.value || rect.height);
                    }

                    const tightBox = document.createElement('div');
                    tightBox.style.position = 'absolute';
                    tightBox.style.border = '1px dashed #ef4444';
                    tightBox.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.5)';
                    tightBox.style.pointerEvents = 'none';
                    tightBox.style.zIndex = '20';
                    tightBox.style.left = `${offsetX + bbox.x * scaleX}px`;
                    tightBox.style.top = `${offsetY + bbox.y * scaleY}px`;
                    tightBox.style.width = `${bbox.width * scaleX}px`;
                    tightBox.style.height = `${bbox.height * scaleY}px`;
                    
                    previewWrapper.appendChild(tightBox);
                }
            } catch(e) { console.warn("SVG bbox scan error", e); }
        }
    }
}

/** Handles right-click actions on GUI elements for debug copying */
function handleGlobalContextMenu(event) {
    // Check all possible debug mode toggle flags comprehensively at the absolute top
    let isDebug = false;
    if (typeof State.getDebugEnabled === 'function') isDebug = isDebug || State.getDebugEnabled();
    if (typeof State.getDebugMode === 'function') isDebug = isDebug || State.getDebugMode();
    if (typeof State.isDebugMode === 'function') isDebug = isDebug || State.isDebugMode();
    if (typeof State.isDebug === 'function') isDebug = isDebug || State.isDebug();
    if (State.debugMode !== undefined) isDebug = isDebug || State.debugMode;
    if (window.debugMode !== undefined) isDebug = isDebug || window.debugMode;
    if (document.body.classList.contains('debug-mode') || document.body.classList.contains('debug')) isDebug = true;
    if (document.body.dataset.debug === 'true' || document.body.dataset.mode === 'debug') isDebug = true;

    if (!isDebug) return;

    // Suppress the default browser context menu immediately across the workspace when debug is active
    event.preventDefault();

    const guiElement = event.target.closest('.gui-element');
    if (!guiElement) return;

    const xmlString = guiElement.dataset.rawXml;
    if (!xmlString) {
        console.warn("[globalListeners] Missing dataset.rawXml on element:", guiElement);
        if (typeof showToast === 'function') {
            showToast(`Element <${guiElement.dataset.xmlTagName || 'element'}> missing serialized XML data.`, 'warn', 3000);
        }
        return;
    }

    navigator.clipboard.writeText(xmlString)
        .then(() => {
            if (typeof showToast === 'function') {
                showToast(`Copied XML for <${guiElement.dataset.xmlTagName || 'element'}> to clipboard!`, 'info', 3000);
            }
        })
        .catch(err => {
            console.error("[globalListeners] Clipboard write failed:", err);
            if (typeof showToast === 'function') {
                showToast("Failed to copy XML to clipboard.", "error", 3000);
            }
        });
}