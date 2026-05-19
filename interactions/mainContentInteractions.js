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
    logError,
    updateStatus,
    showToast
} from '../core/domUtils.js';
import { updateZoomControlsDisplay } from './sidebarControlsInteractions.js';
import { openXmlEditor } from '../core/xmlEditor.js';
import { syncElementChangesToXmlSource, deleteElementFromXml, findElementInXmlContent, updateXmlCoords, toggleElementCommentState } from '../core/xmlReconciler.js';

// --- Module State ---
let isPanning = false;
let panStartX = 0, panStartY = 0;
let panStartScrollX = 0, panStartScrollY = 0;
let lastHoveredElement = null;

let isTransforming = false;
let transformType = null;
let transformStartX = 0, transformStartY = 0;
let transformStartLeft = 0, transformStartTop = 0;
let transformStartWidth = 0, transformStartHeight = 0;
let ctrlPressedAtStart = false;
let hasDuplicatedForThisDrag = false;
let activeDragDropZone = null;
let targetDragContainer = null;

// --- Initialization ---
export function setupMainContentInteractions() {
    console.log("[mainContent] Setting up Main Content listeners...");
    
    // Globally expose the reconciliation hook so detached modules (like SelectionManager nudging) can fire it safely
    window.syncElementChangesToXmlSource = syncElementChangesToXmlSource;

    if (!document.body.dataset.historyEngineAttached) {
        document.addEventListener('applyHistoryState', (e) => {
            const { path, content } = e.detail;
            if (!content || !path) return;

            State.addFile(path, content);
            
            const instance = State.getEditorInstanceByPath(path);
            if (instance) {
                 State.updateEditorInstance(instance.uniqueId, { currentContent: content });
                 const activeTextarea = document.getElementById(`xml-editor-textarea-${instance.uniqueId}`);
                 if (activeTextarea) {
                     activeTextarea.value = content;
                     activeTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                 }
            }

            // Immediately force layout engine redraw off the fresh memory state
            if (typeof window.renderMainGui === 'function') {
                window.renderMainGui();
            }
        });
        document.body.dataset.historyEngineAttached = 'true';
    }

    const mainContentArea = getMainContentArea();
    const guiZoomCanvas = getGuiZoomCanvas();

    if (guiZoomCanvas) {
        if (!guiZoomCanvas.dataset.panListenerAttached) {
            guiZoomCanvas.addEventListener('mousedown', handlePanStart);
            guiZoomCanvas.addEventListener('mousedown', handleTransformStart);
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
        if (!document.body.dataset.globalWheelZoomAttached) {
            document.addEventListener('wheel', handleWheelZoom, { passive: false });
            document.body.dataset.globalWheelZoomAttached = 'true';
            console.log("[mainContent] Global wheel zoom listener attached to document to prevent native scaling.");
        }
    } else {
        logError("[mainContent] guiZoomCanvas not found for listeners init!", null, true);
    }
    if(mainContentArea) { // For middle-click context menu prevention on viewport
        mainContentArea.addEventListener('contextmenu', (e) => {
            if (e.button === 1) e.preventDefault();
        });
    }

    if (!document.body.dataset.layerKeysAttached) {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === '+' || e.key === '=') {
                const sel = State.getSelectedElement() || SelectionManager.currentSelection;
                if (sel) {
                    e.preventDefault();
                    moveElementLayer(sel, 'up');
                }
            } else if (e.key === '-' || e.key === '_') {
                const sel = State.getSelectedElement() || SelectionManager.currentSelection;
                if (sel) {
                    e.preventDefault();
                    moveElementLayer(sel, 'down');
                }
            }
        });
        document.body.dataset.layerKeysAttached = 'true';
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

function handleTransformStart(e) {
    if (!State.getDebugEnabled() || e.button !== 0) return;
    const handle = e.target.closest('.selection-resize-handle');
    const guiElement = e.target.closest('.gui-element');
    let targetEl = null;
    if (handle) {
        isTransforming = true;
        transformType = 'resize';
        targetEl = State.getSelectedElement();
    } else if (guiElement && guiElement === State.getSelectedElement()) {
        isTransforming = true;
        transformType = 'move';
        targetEl = guiElement;
    }
    if (!isTransforming || !targetEl) return;
    e.preventDefault();
    e.stopPropagation();
    transformStartX = e.clientX;
    transformStartY = e.clientY;
    transformStartLeft = parseFloat(targetEl.style.left) || 0;
    transformStartTop = parseFloat(targetEl.style.top) || 0;
    transformStartWidth = parseFloat(targetEl.style.width) || targetEl.clientWidth || 0;
    transformStartHeight = parseFloat(targetEl.style.height) || targetEl.clientHeight || 0;
    ctrlPressedAtStart = e.ctrlKey;
    hasDuplicatedForThisDrag = false;
    document.addEventListener('mousemove', handleTransformMove);
    document.addEventListener('mouseup', handleTransformEnd, { once: true });
}

function handleTransformMove(e) {
    if (!isTransforming) return;
    let targetEl = State.getSelectedElement();
    if (!targetEl && typeof SelectionManager !== 'undefined') targetEl = SelectionManager.currentSelection;
    if (!targetEl) { handleTransformEnd(); return; }
    const zoom = State.getCurrentZoomLevel() || 1;
    const dx = (e.clientX - transformStartX) / zoom;
    const dy = (e.clientY - transformStartY) / zoom;
    if (transformType === 'move') {
        if (ctrlPressedAtStart && !hasDuplicatedForThisDrag) {
            hasDuplicatedForThisDrag = true;
            console.log("[mainContent] CTRL drag duplicate triggered.");
            
            const rawXml = targetEl.dataset.rawXml;
            const sourcePath = targetEl.dataset.sourcePath;
            if (rawXml && sourcePath) {
                // 1. Visually clone the element so drag can continue seamlessly
                const clone = targetEl.cloneNode(true);
                targetEl.parentNode.appendChild(clone);
                
                // 2. Inject identical XML into the file cache right after the original
                const fileMap = State.getFileMap();
                const targetKey = sourcePath.toLowerCase().replace(/\\/g, '/');
                let fileContent = fileMap.get(targetKey);
                
                if (fileContent) {
                    if (typeof State.pushHistoryState === 'function') State.pushHistoryState(targetKey, fileContent);
                    
                    const elAttrs = {};
                    for (const key in targetEl.dataset) {
                        if (key.startsWith('xmlAttr_')) elAttrs[key.slice(8)] = targetEl.dataset[key];
                    }
                    const matchResult = findElementInXmlContent(fileContent, targetEl.dataset.xmlTagName, elAttrs);
                    
                    if (matchResult) {
                        const duplicateXml = matchResult.exactStr;
                        const commentedXml = `\n\t${duplicateXml}`;
                        const insertionIndex = matchResult.index + matchResult.length;
                        const newContent = fileContent.slice(0, insertionIndex) + "\n\t" + commentedXml + fileContent.slice(insertionIndex);
                        
                        fileMap.set(targetKey, newContent);
                        if (typeof State.setXmlEditorDirty === 'function') State.setXmlEditorDirty(true);
                        
                        const instance = State.getEditorInstanceByPath(targetKey);
                        if (instance) {
                            if (typeof State.updateEditorInstance === 'function') State.updateEditorInstance(instance.uniqueId, { currentContent: newContent });
                            const textarea = document.getElementById(`xml-editor-textarea-${instance.uniqueId}`);
                            if (textarea) {
                                textarea.value = newContent;
                                textarea.dispatchEvent(new Event('input'));
                            }
                        }
                        clone.dataset.rawXml = duplicateXml;
                    }
                }
                
                // 3. Swap the active drag target to the new clone
                targetEl = clone;
                if (typeof SelectionManager !== 'undefined' && SelectionManager.select) {
                    SelectionManager.select(targetEl);
                } else if (typeof State.setSelectedElement === 'function') {
                    State.setSelectedElement(targetEl);
                }
                if (typeof showToast === 'function') showToast("Element duplicated on drag.", "info");
            }
        }

        let currentDx = dx;
        let currentDy = dy;

        if (!ctrlPressedAtStart && e.ctrlKey) {
            // Lock axis dynamically based on dominant movement
            if (Math.abs(currentDx) > Math.abs(currentDy)) {
                currentDy = 0;
            } else {
                currentDx = 0;
            }
        }

        let newLeft = Math.round(transformStartLeft + currentDx);
        let newTop = Math.round(transformStartTop + currentDy);

        const snapEnabled = typeof State.getSnappingEnabled === 'function' ? State.getSnappingEnabled() : false;
        if (snapEnabled && !e.shiftKey) {
            const gridSize = typeof State.getSnappingGrid === 'function' ? State.getSnappingGrid() : 8;
            const sensitivity = typeof State.getSnappingSensitivity === 'function' ? State.getSnappingSensitivity() : 8;
            const snapMode = typeof State.getSnappingMode === 'function' ? State.getSnappingMode() : 'absolute';

            if (snapMode === 'element') {
                const elements = Array.from(document.querySelectorAll('.gui-element')).filter(el => el !== targetEl && !targetEl.contains(el));
                const targetW = targetEl.offsetWidth || 0;
                const targetH = targetEl.offsetHeight || 0;
                
                let snappedLeft = false;
                let snappedTop = false;

                elements.forEach(el => el.classList.remove('snap-target-glow'));

                for (const other of elements) {
                    const oLeft = parseFloat(other.style.left) || 0;
                    const oTop = parseFloat(other.style.top) || 0;
                    const oW = other.offsetWidth || 0;
                    const oH = other.offsetHeight || 0;
                    const oRight = oLeft + oW;
                    const oBottom = oTop + oH;

                    let snappedThisElement = false;

                    if (!snappedLeft) {
                        if (Math.abs(newLeft - oLeft) <= sensitivity) { newLeft = oLeft; snappedLeft = true; snappedThisElement = true; }
                        else if (Math.abs(newLeft - oRight) <= sensitivity) { newLeft = oRight; snappedLeft = true; snappedThisElement = true; }
                        else if (Math.abs((newLeft + targetW) - oLeft) <= sensitivity) { newLeft = oLeft - targetW; snappedLeft = true; snappedThisElement = true; }
                        else if (Math.abs((newLeft + targetW) - oRight) <= sensitivity) { newLeft = oRight - targetW; snappedLeft = true; snappedThisElement = true; }
                    }
                    if (!snappedTop) {
                        if (Math.abs(newTop - oTop) <= sensitivity) { newTop = oTop; snappedTop = true; snappedThisElement = true; }
                        else if (Math.abs(newTop - oBottom) <= sensitivity) { newTop = oBottom; snappedTop = true; snappedThisElement = true; }
                        else if (Math.abs((newTop + targetH) - oTop) <= sensitivity) { newTop = oTop - targetH; snappedTop = true; snappedThisElement = true; }
                        else if (Math.abs((newTop + targetH) - oBottom) <= sensitivity) { newTop = oBottom - targetH; snappedTop = true; snappedThisElement = true; }
                    }

                    if (snappedThisElement) {
                        other.classList.add('snap-target-glow');
                    }
                }
            } else {
                document.querySelectorAll('.snap-target-glow').forEach(el => el.classList.remove('snap-target-glow'));
                const snappedLeft = Math.round(newLeft / gridSize) * gridSize;
                if (Math.abs(newLeft - snappedLeft) <= sensitivity) {
                    newLeft = snappedLeft;
                }
                const snappedTop = Math.round(newTop / gridSize) * gridSize;
                if (Math.abs(newTop - snappedTop) <= sensitivity) {
                    newTop = snappedTop;
                }
            }
        }

        targetEl.style.left = `${newLeft}px`;
        targetEl.style.top = `${newTop}px`;
        targetEl.dataset.xmlAttr_x = newLeft;
        targetEl.dataset.xmlAttr_y = newTop;
    } else if (transformType === 'resize') {
        let newWidth = Math.max(8, Math.round(transformStartWidth + dx));
        let newHeight = Math.max(8, Math.round(transformStartHeight + dy));

        if (e.shiftKey && transformStartHeight > 0) {
            const aspect = transformStartWidth / transformStartHeight;
            if (Math.abs(dx) > Math.abs(dy)) {
                newHeight = Math.max(8, Math.round(newWidth / aspect));
            } else {
                newWidth = Math.max(8, Math.round(newHeight * aspect));
            }
        }

        if (e.ctrlKey) {
            if (e.shiftKey && transformStartHeight > 0) {
                const aspect = transformStartWidth / transformStartHeight;
                if (Math.abs(dx) > Math.abs(dy)) {
                    newWidth = Math.max(8, Math.round(transformStartWidth + 2 * dx));
                    newHeight = Math.max(8, Math.round(newWidth / aspect));
                } else {
                    newHeight = Math.max(8, Math.round(transformStartHeight + 2 * dy));
                    newWidth = Math.max(8, Math.round(newHeight * aspect));
                }
            } else {
                newWidth = Math.max(8, Math.round(transformStartWidth + 2 * dx));
                newHeight = Math.max(8, Math.round(transformStartHeight + 2 * dy));
            }

            const newLeft = Math.round(transformStartLeft - (newWidth - transformStartWidth) / 2);
            const newTop = Math.round(transformStartTop - (newHeight - transformStartHeight) / 2);
            
            targetEl.style.left = `${newLeft}px`;
            targetEl.style.top = `${newTop}px`;
            targetEl.dataset.xmlAttr_x = newLeft;
            targetEl.dataset.xmlAttr_y = newTop;
        }

        targetEl.style.width = `${newWidth}px`;
        targetEl.style.height = `${newHeight}px`;
        targetEl.dataset.xmlAttr_w = newWidth;
        targetEl.dataset.xmlAttr_h = newHeight;
        targetEl.dataset.xmlAttr_width = newWidth;
        targetEl.dataset.xmlAttr_height = newHeight;
    }

    // Cross-container drag detection
    if (transformType === 'move') {
        const originalPointerEvents = targetEl.style.pointerEvents;
        targetEl.style.pointerEvents = 'none';
        
        const hitEl = document.elementFromPoint(e.clientX, e.clientY);
        const childTag = targetEl.dataset.xmlTagName || 'element';
        const prospectiveContainer = getValidDropContainer(hitEl, childTag);
        
        targetEl.style.pointerEvents = originalPointerEvents;

        // Prevent dropping an element inside itself
        if (prospectiveContainer && !targetEl.contains(prospectiveContainer) && prospectiveContainer !== targetEl) {
            targetDragContainer = prospectiveContainer;
            if (activeDragDropZone && activeDragDropZone !== prospectiveContainer) {
                activeDragDropZone.classList.remove('prospective-drop-zone');
            }
            if (prospectiveContainer !== targetEl.parentElement) {
                prospectiveContainer.classList.add('prospective-drop-zone');
                activeDragDropZone = prospectiveContainer;
            } else {
                activeDragDropZone = null;
            }
        } else {
            if (activeDragDropZone) {
                activeDragDropZone.classList.remove('prospective-drop-zone');
                activeDragDropZone = null;
            }
            targetDragContainer = targetEl.parentElement; // Default to safe parent
        }
    }

    updateSelectionOutline();
    if (SelectionManager.currentSelection === targetEl) {
        SelectionManager.renderContextToolbar(targetEl);
    }
    if (window.updateInspectorReadout) {
        window.updateInspectorReadout(targetEl);
    }
}

function handleTransformEnd() {
    if (!isTransforming) return;
    isTransforming = false;
    transformType = null;
    document.removeEventListener('mousemove', handleTransformMove);
    
    if (activeDragDropZone) {
        activeDragDropZone.classList.remove('prospective-drop-zone');
        activeDragDropZone = null;
    }

    document.querySelectorAll('.snap-target-glow').forEach(el => el.classList.remove('snap-target-glow'));

    State.setXmlEditorDirty(true);
    
    const targetEl = State.getSelectedElement();
    if (targetEl) {
        if (targetDragContainer && targetDragContainer !== targetEl.parentElement && targetDragContainer !== targetEl && !targetEl.contains(targetDragContainer)) {
            reparentElement(targetEl, targetDragContainer);
        } else {
            syncElementChangesToXmlSource(targetEl);
        }
    }
    targetDragContainer = null;
}

function reparentElement(el, newParent) {
    const rawXml = el.dataset.rawXml;
    let targetFilePath = el.dataset.sourcePath || newParent.dataset.sourcePath || (typeof State.getActiveFilePath === 'function' ? State.getActiveFilePath() : '');
    
    if (!rawXml || !targetFilePath) {
        syncElementChangesToXmlSource(el);
        return;
    }

    const currentScale = State.getCurrentZoomLevel() || 1;
    const parentRect = newParent.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    
    const localX = Math.round((elRect.left - parentRect.left) / currentScale);
    const localY = Math.round((elRect.top - parentRect.top) / currentScale);
    
    // Save current drag coords
    const draggedX = el.dataset.xmlAttr_x;
    const draggedY = el.dataset.xmlAttr_y;

    // Restore start coords temporarily so the xmlReconciler can find the original element signature to delete it
    el.dataset.xmlAttr_x = transformStartLeft;
    el.dataset.xmlAttr_y = transformStartTop;

    const deleteSuccess = deleteElementFromXml(el);

    // Put the new target coords back
    el.dataset.xmlAttr_x = localX;
    el.dataset.xmlAttr_y = localY;
    
    if (!deleteSuccess) {
        el.dataset.xmlAttr_x = draggedX;
        el.dataset.xmlAttr_y = draggedY;
        syncElementChangesToXmlSource(el);
        return;
    }

    const rawFinalXml = updateXmlCoords(rawXml, localX, localY);
    const finalXml = `\n\t${rawFinalXml}`;

    const fileMap = State.getFileMap();
    const normalizedPath = targetFilePath.toLowerCase().replace(/\\/g, '/');
    let targetKey = normalizedPath;
    let fileContent = fileMap.get(normalizedPath);

    if (!fileContent) {
        for (const key of fileMap.keys()) {
            if (key.endsWith('/' + normalizedPath) || normalizedPath.endsWith('/' + key)) {
                targetKey = key;
                fileContent = fileMap.get(key);
                break;
            }
        }
    }

    if (!fileContent) {
        showToast("Failed to locate file content for reparenting.", "error");
        return;
    }

    let insertionSuccess = false;
    let updatedContent = "";

    if (newParent.id === 'skin-container-actual' || !newParent.dataset.xmlTagName) {
        const lastCloseIndex = fileContent.lastIndexOf('</');
        if (lastCloseIndex !== -1) {
            updatedContent = fileContent.slice(0, lastCloseIndex) + "\n\t" + finalXml + "\n" + fileContent.slice(lastCloseIndex);
            insertionSuccess = true;
        }
    } else {
        const containerTagName = newParent.dataset.xmlTagName;
        const containerAttrs = {};
        for (const key in newParent.dataset) {
            if (key.startsWith('xmlAttr_')) containerAttrs[key.slice(8)] = newParent.dataset[key];
        }
        
        const matchResult = findElementInXmlContent(fileContent, containerTagName, containerAttrs);
        if (matchResult) {
            const matchStr = matchResult.exactStr;
            if (matchStr.trim().endsWith('/>')) {
                const expandedContainer = matchStr.replace('/>', `>\n\t${finalXml}\n</${containerTagName}>`);
                updatedContent = fileContent.slice(0, matchResult.index) + expandedContainer + fileContent.slice(matchResult.index + matchResult.length);
                insertionSuccess = true;
            } else {
                const closingTagStr = `</${containerTagName}>`;
                const closeTagIdx = matchStr.lastIndexOf(closingTagStr);
                if (closeTagIdx !== -1) {
                    const updatedMatchStr = matchStr.slice(0, closeTagIdx) + "\n\t" + finalXml + "\n" + matchStr.slice(closeTagIdx);
                    updatedContent = fileContent.slice(0, matchResult.index) + updatedMatchStr + fileContent.slice(matchResult.index + matchResult.length);
                    insertionSuccess = true;
                }
            }
        }
    }

    if (insertionSuccess) {
        fileMap.set(targetKey, updatedContent);
        if (typeof State.setXmlEditorDirty === 'function') State.setXmlEditorDirty(true);
        
        const instance = State.getEditorInstanceByPath(targetKey);
        if (instance) {
            if (typeof State.updateEditorInstance === 'function') State.updateEditorInstance(instance.uniqueId, { currentContent: updatedContent });
            const textarea = document.getElementById(`xml-editor-textarea-${instance.uniqueId}`);
            if (textarea) {
                const scrollPos = textarea.scrollTop;
                textarea.value = updatedContent;
                textarea.scrollTop = scrollPos;
                textarea.dispatchEvent(new Event('input'));
            }
        }
        
        showToast(`Element moved to new container.`, 'success');
        
        const droppedTag = el.dataset.xmlTagName;
        const targetX = localX;
        const targetY = localY;

        if (typeof window.renderMainGui === 'function') {
            window.renderMainGui();
            setTimeout(() => {
                const elements = document.querySelectorAll('.gui-element');
                for (let candidate of elements) {
                    if (candidate.dataset.xmlTagName === droppedTag && 
                        parseInt(candidate.dataset.xmlAttr_x, 10) === targetX && 
                        parseInt(candidate.dataset.xmlAttr_y, 10) === targetY) {
                        if (typeof SelectionManager !== 'undefined') {
                            SelectionManager.select(candidate);
                        }
                        break;
                    }
                }
            }, 50);
        }
    } else {
        showToast("Failed to insert element into new container.", "error");
        syncElementChangesToXmlSource(el);
    }
}



export function updateSelectionOutline() {
    if (SelectionManager && typeof SelectionManager.updatePosition === 'function') {
        SelectionManager.updatePosition();
    }
    const zoomCanvas = getGuiZoomCanvas();
    if (!zoomCanvas) return;
    let outline = document.getElementById('selection-outline-overlay');
    const selectedEl = State.getSelectedElement();
    if (!selectedEl || !State.getDebugEnabled()) {
        if (outline) outline.style.display = 'none';
        return;
    }
    if (!outline) {
        outline = document.createElement('div');
        outline.id = 'selection-outline-overlay';
        outline.style.position = 'absolute';
        outline.style.border = '4px solid #22c55e';
        outline.style.boxSizing = 'border-box';
        outline.style.pointerEvents = 'none';
        outline.style.zIndex = '10000';
        const handle = document.createElement('div');
        handle.className = 'selection-resize-handle';
        handle.style.position = 'absolute';
        handle.style.right = '-6px';
        handle.style.bottom = '-6px';
        handle.style.width = '12px';
        handle.style.height = '12px';
        handle.style.background = '#22c55e';
        handle.style.pointerEvents = 'auto';
        handle.style.cursor = 'nwse-resize';
        outline.appendChild(handle);
        zoomCanvas.appendChild(outline);
    }
    outline.style.display = 'block';
    outline.style.left = selectedEl.style.left || '0px';
    outline.style.top = selectedEl.style.top || '0px';
    outline.style.width = selectedEl.style.width || `${selectedEl.clientWidth}px`;
    outline.style.height = selectedEl.style.height || `${selectedEl.clientHeight}px`;
}
window.updateSelectionOutline = updateSelectionOutline;

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
    const skinContainer = zoomCanvas.querySelector('#skin-container-actual');

    let skinX = (event.clientX - zoomCanvasRect.left) / currentScale;
    let skinY = (event.clientY - zoomCanvasRect.top) / currentScale;

    if (skinContainer) {
        const skinRect = skinContainer.getBoundingClientRect();
        skinX = (event.clientX - skinRect.left) / currentScale;
        skinY = (event.clientY - skinRect.top) / currentScale;
    }

    let elementInfo = `Skin X: ${skinX.toFixed(0)}, Y: ${skinY.toFixed(0)}\n`;
    let targetElement = event.target;
    let validTargetFound = false;

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
    
    // Globally prevent default native browser scaling whenever CTRL is held
    event.preventDefault();

    const inspector = document.getElementById('element-quick-inspector');
    if (inspector && inspector.style.display !== 'none') {
        return;
    }
    
    if (event.target.closest('#sidebar') || event.target.closest('[data-xml-tag-name="Keyboard"]') || event.target.closest('.keyboard-gui')) {
        return;
    }

    const zoomCanvas = getGuiZoomCanvas();
    if (!zoomCanvas) {
        logError("[mainContent] Zoom target (gui-zoom-canvas) not found for wheel event.", null, true);
        return;
    }

    if (!zoomCanvas.contains(event.target) && event.target !== zoomCanvas) {
        return;
    }

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
export const SelectionManager = {
    currentSelection: null,
    overlay: null,

    select(el) {
        this.deselect(); // Clear previous selection
        if (!el) return;

        this.currentSelection = el;

        // 1. Create the Green Bounding Box
        this.overlay = document.createElement('div');
        this.overlay.id = 'qi-selection-box';
        this.overlay.style.position = 'absolute';
        this.overlay.style.top = '0';
        this.overlay.style.left = '0';
        this.overlay.style.width = '100%';
        this.overlay.style.height = '100%';
        this.overlay.style.border = '2px solid #32cd32'; // Vibrant Green
        this.overlay.style.boxSizing = 'border-box';
        this.overlay.style.pointerEvents = 'none'; // Let clicks pass through to the element
        this.overlay.style.zIndex = '9000';

        // 2. Define the 8 Scaling Handles
        const handleSize = 8;
        const offset = -4; // Centers the handle over the border
        const handles = [
            { pos: 'nw', top: offset, left: offset, cursor: 'nwse-resize' },
            { pos: 'n', top: offset, left: `calc(50% - ${handleSize/2}px)`, cursor: 'ns-resize' },
            { pos: 'ne', top: offset, right: offset, cursor: 'nesw-resize' },
            { pos: 'e', top: `calc(50% - ${handleSize/2}px)`, right: offset, cursor: 'ew-resize' },
            { pos: 'se', bottom: offset, right: offset, cursor: 'nwse-resize' },
            { pos: 's', bottom: offset, left: `calc(50% - ${handleSize/2}px)`, cursor: 'ns-resize' },
            { pos: 'sw', bottom: offset, left: offset, cursor: 'nesw-resize' },
            { pos: 'w', top: `calc(50% - ${handleSize/2}px)`, left: offset, cursor: 'ew-resize' }
        ];

        handles.forEach(h => {
            const handleEl = document.createElement('div');
            handleEl.className = `qi-resize-handle qi-handle-${h.pos}`;
            handleEl.style.position = 'absolute';
            handleEl.style.width = `${handleSize}px`;
            handleEl.style.height = `${handleSize}px`;
            handleEl.style.background = '#32cd32';
            handleEl.style.opacity = '0.5'; // Half opacity as requested
            handleEl.style.cursor = h.cursor;
            handleEl.style.pointerEvents = 'auto'; // Make handles clickable
            
            if (h.top !== undefined) handleEl.style.top = typeof h.top === 'number' ? `${h.top}px` : h.top;
            if (h.bottom !== undefined) handleEl.style.bottom = typeof h.bottom === 'number' ? `${h.bottom}px` : h.bottom;
            if (h.left !== undefined) handleEl.style.left = typeof h.left === 'number' ? `${h.left}px` : h.left;
            if (h.right !== undefined) handleEl.style.right = typeof h.right === 'number' ? `${h.right}px` : h.right;

            this.attachResizeLogic(handleEl, h.pos, el);
            this.overlay.appendChild(handleEl);
        });

        // 3. Define the Underneath Nudge Pad
        const nudgePad = document.createElement('div');
        nudgePad.style.position = 'absolute';
        nudgePad.style.bottom = '-35px';
        nudgePad.style.left = '50%';
        nudgePad.style.transform = 'translateX(-50%)';
        nudgePad.style.display = 'flex';
        nudgePad.style.gap = '2px';
        nudgePad.style.background = 'rgba(26, 32, 44, 0.9)';
        nudgePad.style.padding = '4px';
        nudgePad.style.borderRadius = '4px';
        nudgePad.style.pointerEvents = 'auto';
        nudgePad.style.boxShadow = '0 4px 10px rgba(0,0,0,0.5)';

        const arrows = [
            { id: 'left', icon: '◀', dx: -1, dy: 0 },
            { id: 'up', icon: '▲', dx: 0, dy: -1 },
            { id: 'down', icon: '▼', dx: 0, dy: 1 },
            { id: 'right', icon: '▶', dx: 1, dy: 0 }
        ];

        arrows.forEach(dir => {
            const btn = document.createElement('button');
            btn.innerHTML = dir.icon;
            btn.style.background = '#4a5568';
            btn.style.border = 'none';
            btn.style.color = '#fff';
            btn.style.width = '24px';
            btn.style.height = '24px';
            btn.style.borderRadius = '3px';
            btn.style.cursor = 'pointer';
            btn.style.fontSize = '12px';
            
            btn.onmousedown = (e) => e.stopPropagation(); // Prevent dragging
            btn.onclick = (e) => {
                e.stopPropagation();
                this.nudgeElement(el, dir.dx, dir.dy);
            };
            nudgePad.appendChild(btn);
        });

        this.overlay.appendChild(nudgePad);
        
        // Append the whole overlay directly to the element so it moves and scales with it
        el.appendChild(this.overlay);
        
        this.renderContextToolbar(el);
    },

    deselect() {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        this.overlay = null;
        this.currentSelection = null;
        const existingToolbar = document.getElementById('element-context-action-toolbar');
        if (existingToolbar) existingToolbar.remove();
    },

    nudgeElement(el, dx, dy) {
        let currentX = parseFloat(el.style.left) || 0;
        let currentY = parseFloat(el.style.top) || 0;
        
        const newX = currentX + dx;
        const newY = currentY + dy;
        
        el.style.left = `${newX}px`;
        el.style.top = `${newY}px`;
        el.dataset.xmlAttr_x = newX;
        el.dataset.xmlAttr_y = newY;
        
        this.sync(el);
    },

    attachResizeLogic(handle, pos, el) {
        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation(); // Stop element dragging
            e.preventDefault();
            
            const startX = e.clientX;
            const startY = e.clientY;
            const startW = parseFloat(el.style.width) || el.clientWidth || 0;
            const startH = parseFloat(el.style.height) || el.clientHeight || 0;
            const startLeft = parseFloat(el.style.left) || 0;
            const startTop = parseFloat(el.style.top) || 0;

            // Fetch the zoom level so the mouse delta matches the element scale
            const zoom = typeof State !== 'undefined' && State.getSavedZoomLevel ? State.getSavedZoomLevel() : 1;

            const onMouseMove = (moveEvent) => {
                const deltaX = (moveEvent.clientX - startX) / zoom;
                const deltaY = (moveEvent.clientY - startY) / zoom;
                
                let newW = startW;
                let newH = startH;
                let newLeft = startLeft;
                let newTop = startTop;

                if (moveEvent.ctrlKey) {
                    if (pos.includes('e')) {
                        newW = startW + 2 * deltaX;
                        newLeft = startLeft - deltaX;
                    }
                    if (pos.includes('w')) {
                        newW = startW - 2 * deltaX;
                        newLeft = startLeft + deltaX;
                    }
                    if (pos.includes('s')) {
                        newH = startH + 2 * deltaY;
                        newTop = startTop - deltaY;
                    }
                    if (pos.includes('n')) {
                        newH = startH - 2 * deltaY;
                        newTop = startTop + deltaY;
                    }
                } else {
                    if (pos.includes('e')) newW = startW + deltaX;
                    if (pos.includes('s')) newH = startH + deltaY;
                    
                    if (pos.includes('w')) {
                        newW = startW - deltaX;
                        newLeft = startLeft + deltaX;
                    }
                    if (pos.includes('n')) {
                        newH = startH - deltaY;
                        newTop = startTop + deltaY;
                    }
                }

                if (moveEvent.shiftKey && startH > 0) {
                    const aspect = startW / startH;
                    let useWidthDrives = false;
                    if (pos === 'e' || pos === 'w') {
                        useWidthDrives = true;
                    } else if (pos === 'n' || pos === 's') {
                        useWidthDrives = false;
                    } else {
                        useWidthDrives = Math.abs(newW - startW) / startW > Math.abs(newH - startH) / startH;
                    }

                    if (useWidthDrives) {
                        const targetH = newW / aspect;
                        const hDiff = targetH - newH;
                        newH = targetH;
                        if (moveEvent.ctrlKey) {
                            newTop = startTop - (newH - startH) / 2;
                        } else if (pos.includes('n')) {
                            newTop = newTop - hDiff;
                        }
                    } else {
                        const targetW = newH * aspect;
                        const wDiff = targetW - newW;
                        newW = targetW;
                        if (moveEvent.ctrlKey) {
                            newLeft = startLeft - (newW - startW) / 2;
                        } else if (pos.includes('w')) {
                            newLeft = newLeft - wDiff;
                        }
                    }
                }

                // Prevent collapsing to negative sizes
                if (newW > 10) {
                    el.style.width = `${newW}px`;
                    el.style.left = `${newLeft}px`;
                    el.dataset.xmlAttr_w = Math.round(newW);
                    el.dataset.xmlAttr_x = Math.round(newLeft);
                }
                if (newH > 10) {
                    el.style.height = `${newH}px`;
                    el.style.top = `${newTop}px`;
                    el.dataset.xmlAttr_h = Math.round(newH);
                    el.dataset.xmlAttr_y = Math.round(newTop);
                }
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                this.sync(el);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    },

    sync(el) {
        if (typeof State !== 'undefined' && State.setXmlEditorDirty) {
            State.setXmlEditorDirty(true);
        }
        if (window.syncElementChangesToXmlSource) {
            window.syncElementChangesToXmlSource(el);
        }
        
        this.renderContextToolbar(el);
        
        // Auto-update the Quick Inspector if it's open
        const inspectorX = document.getElementById('qi-input-x');
        if (inspectorX) {
            document.getElementById('qi-input-x').value = el.dataset.xmlAttr_x;
            document.getElementById('qi-input-y').value = el.dataset.xmlAttr_y;
            document.getElementById('qi-input-w').value = el.dataset.xmlAttr_w;
            document.getElementById('qi-input-h').value = el.dataset.xmlAttr_h;
        }
    },

    renderContextToolbar(el) {
        const existingToolbar = document.getElementById('element-context-action-toolbar');
        if (existingToolbar) existingToolbar.remove();

        const canvasViewport = document.getElementById('canvas-viewport');
        if (!canvasViewport) return;

        const toolbar = document.createElement('div');
        toolbar.id = 'element-context-action-toolbar';
        toolbar.className = 'element-context-toolbar';

        // Title bar Header Row containing Tag Name
        const titleRow = document.createElement('div');
        titleRow.className = 'context-toolbar-title-row';
        titleRow.style.display = 'flex';
        titleRow.style.justifyContent = 'space-between';
        titleRow.style.alignItems = 'center';
        
        const nameLabel = document.createElement('span');
        nameLabel.className = 'context-toolbar-el-name';
        nameLabel.textContent = el.dataset.xmlTagName || 'Element';

        if (el.dataset.isCommented === 'true') {
            nameLabel.textContent += ' (disabled)';
            nameLabel.style.color = '#ef4444'; 
        }

        const toggleWrapper = document.createElement('div');
        toggleWrapper.className = `editor-toggle-switch ${el.dataset.isCommented === 'true' ? 'off' : ''}`;
        toggleWrapper.title = el.dataset.isCommented === 'true' ? 'Enable Element' : 'Disable Element';
        
        toggleWrapper.addEventListener('mousedown', (e) => e.stopPropagation());
        toggleWrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleElementCommentState(el);
            this.renderContextToolbar(el);
        });
        
        titleRow.appendChild(nameLabel);
        titleRow.appendChild(toggleWrapper);
        toolbar.appendChild(titleRow);

        // Coordinates Readout Row with Editable and Scrubbable Inputs
        const coordsRow = document.createElement('div');
        coordsRow.className = 'context-toolbar-coords';
        const curX = el.dataset.xmlAttr_x || Math.round(parseFloat(el.style.left) || 0);
        const curY = el.dataset.xmlAttr_y || Math.round(parseFloat(el.style.top) || 0);
        const curW = el.dataset.xmlAttr_w || el.dataset.xmlAttr_width || Math.round(parseFloat(el.style.width) || el.clientWidth || 0);
        const curH = el.dataset.xmlAttr_h || el.dataset.xmlAttr_height || Math.round(parseFloat(el.style.height) || el.clientHeight || 0);

        const fields = [
            { label: 'X', val: curX, prop: 'left', attr: 'xmlAttr_x' },
            { label: 'Y', val: curY, prop: 'top', attr: 'xmlAttr_y' },
            { label: 'W', val: curW, prop: 'width', attr: 'xmlAttr_w' },
            { label: 'H', val: curH, prop: 'height', attr: 'xmlAttr_h' }
        ];

        fields.forEach(f => {
            const group = document.createElement('div');
            group.className = 'coord-input-group';
            
            const label = document.createElement('span');
            label.className = 'coord-label';
            label.textContent = f.label;
            
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'coord-input';
            input.value = f.val;
            
            input.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                if (e.button !== 0) return;
                
                let isDragging = false;
                const scrubStartY = e.clientY;
                const scrubStartVal = parseInt(input.value, 10) || 0;
                
                const onScrubMove = (moveEvent) => {
                    const deltaY = scrubStartY - moveEvent.clientY;
                    if (Math.abs(deltaY) > 2) {
                        isDragging = true;
                    }
                    if (isDragging) {
                        moveEvent.preventDefault();
                        const nextVal = scrubStartVal + Math.round(deltaY);
                        input.value = nextVal;
                        
                        el.style[f.prop] = `${nextVal}px`;
                        el.dataset[f.attr] = nextVal;
                        if (f.prop === 'width') el.dataset.xmlAttr_width = nextVal;
                        if (f.prop === 'height') el.dataset.xmlAttr_height = nextVal;
                        
                        if (window.updateSelectionOutline) window.updateSelectionOutline();
                        if (window.syncElementChangesToXmlSource) window.syncElementChangesToXmlSource(el);
                        if (typeof State !== 'undefined' && State.setXmlEditorDirty) State.setXmlEditorDirty(true);
                        if (window.updateInspectorReadout) window.updateInspectorReadout(el);
                    }
                };
                
                const onScrubUp = () => {
                    document.removeEventListener('mousemove', onScrubMove);
                    document.removeEventListener('mouseup', onScrubUp);
                    if (isDragging) {
                        SelectionManager.renderContextToolbar(el);
                    }
                };
                
                document.addEventListener('mousemove', onScrubMove);
                document.addEventListener('mouseup', onScrubUp);
            });

            input.addEventListener('input', () => {
                const val = parseInt(input.value, 10);
                if (!isNaN(val)) {
                    el.style[f.prop] = `${val}px`;
                    el.dataset[f.attr] = val;
                    if (f.prop === 'width') el.dataset.xmlAttr_width = val;
                    if (f.prop === 'height') el.dataset.xmlAttr_height = val;
                    
                    if (window.updateSelectionOutline) window.updateSelectionOutline();
                    if (window.syncElementChangesToXmlSource) window.syncElementChangesToXmlSource(el);
                    if (typeof State !== 'undefined' && State.setXmlEditorDirty) State.setXmlEditorDirty(true);
                    if (window.updateInspectorReadout) window.updateInspectorReadout(el);
                }
            });
            
            input.addEventListener('change', () => {
                SelectionManager.renderContextToolbar(el);
            });

            group.appendChild(label);
            group.appendChild(input);
            coordsRow.appendChild(group);
        });

        toolbar.appendChild(coordsRow);

        const actions = [
            { id: 'cut', icon: 'iconoir-scissor', title: 'Cut' },
            { id: 'paste', icon: 'iconoir-paste-clipboard', title: 'Paste' },
            { id: 'duplicate', icon: 'iconoir-copy', title: 'Duplicate' },
            { id: 'delete', icon: 'iconoir-xmark', title: 'Delete' },
            { id: 'layer-up', icon: 'iconoir-transition-up', title: 'Layer Up' },
            { id: 'layer-down', icon: 'iconoir-transition-down', title: 'Layer Down' },
            { id: 'edit', icon: 'iconoir-edit-pencil', title: 'Open Element Editor' },
            { id: 'jump-to-xml', icon: 'iconoir-code', title: 'Jump to XML' }
        ];

        actions.forEach(act => {
            const btn = document.createElement('button');
            btn.className = 'context-toolbar-btn';
            if (act.id === 'delete') {
                btn.className += ' context-btn-delete';
            }
            btn.title = act.title;
            btn.dataset.action = act.id;
            btn.innerHTML = `<i class="${act.icon}"></i>`;
            
            btn.addEventListener('mousedown', (e) => e.stopPropagation());
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (act.id === 'edit') {
                    el.dispatchEvent(new MouseEvent('mousedown', { button: 1, bubbles: true }));
                    el.dispatchEvent(new MouseEvent('mouseup', { button: 1, bubbles: true }));
                } else if (act.id === 'jump-to-xml') {
                    const filePath = el.dataset.sourcePath;
                    const rawXml = el.dataset.rawXml;
                    if (filePath && rawXml) {
                        const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');
                        if (typeof openXmlEditor === 'function') {
                            openXmlEditor(normalizedPath);
                            setTimeout(() => {
                                const instance = State.getEditorInstanceByPath(normalizedPath);
                                if (instance && instance.uniqueId) {
                                    const textarea = document.getElementById(`xml-editor-textarea-${instance.uniqueId}`);
                                    if (textarea) {
                                        const textContent = textarea.value;
                                        let index = textContent.indexOf(rawXml);
                                        if (index === -1) {
                                            const tagName = el.dataset.xmlTagName;
                                            if (tagName) index = textContent.indexOf(`<${tagName}`);
                                        }
                                        if (index !== -1) {
                                            textarea.focus();
                                            textarea.setSelectionRange(index, index + rawXml.length);
                                            const numLines = textContent.substring(0, index).split('\n').length;
                                            const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight) || 16;
                                            textarea.scrollTop = Math.max(0, (numLines - 5) * lineHeight);
                                            textarea.dispatchEvent(new Event('scroll'));
                                        }
                                    }
                                }
                            }, 150);
                        }
                    }
                } else if (act.id === 'cut') {
                    const rawXml = el.dataset.rawXml;
                    const tagName = el.dataset.xmlTagName;
                    if (rawXml) {
                        State.setProjectClipboard({
                            tagName: tagName || 'Element',
                            rawXml: rawXml
                        });
                        const success = deleteElementFromXml(el);
                        if (success) {
                            showToast(`Cut &lt;${tagName || 'Element'}&gt; to clipboard.`, 'error');
                            SelectionManager.deselect();
                            if (typeof window.renderMainGui === 'function') {
                                window.renderMainGui();
                            }
                        } else {
                            showToast(`Failed to cut element from XML source.`, 'error');
                        }
                    } else {
                        showToast(`No raw XML data associated with this element.`, 'error');
                    }
                } else if (act.id === 'delete') {
                    const tagName = el.dataset.xmlTagName;
                    if (confirm(`Are you sure you want to delete this <${tagName || 'Element'}>? This will remove it from the XML configuration.`)) {
                        const success = deleteElementFromXml(el);
                        if (success) {
                            showToast(`Deleted &lt;${tagName || 'Element'}&gt; successfully.`, 'error');
                            SelectionManager.deselect();
                            if (typeof window.renderMainGui === 'function') {
                                window.renderMainGui();
                            }
                        } else {
                            showToast(`Failed to delete element from XML source.`, 'error');
                        }
                    }
                } else if (act.id === 'paste') {
                    const clip = State.getProjectClipboard();
                    if (clip && clip.rawXml) {
                        activatePhantomPlacement(clip);
                    } else {
                        showToast('Clipboard is empty.', 'warning');
                    }
                } else if (act.id === 'duplicate') {
                    const rawXml = el.dataset.rawXml;
                    const tagName = el.dataset.xmlTagName;
                    if (rawXml) {
                        activatePhantomPlacement({ tagName: tagName || 'Element', rawXml: rawXml });
                    } else {
                        showToast('No XML data found on element to duplicate.', 'error');
                    }
                } else if (act.id === 'layer-up') {
                    moveElementLayer(el, 'up');
                } else if (act.id === 'layer-down') {
                    moveElementLayer(el, 'down');
                } else {
                    console.log(`[Context Toolbar] Action triggered: ${act.id} on element`, el);
                }
            });
            
            toolbar.appendChild(btn);
        });

        canvasViewport.appendChild(toolbar);

        const elRect = el.getBoundingClientRect();
        const vpRect = canvasViewport.getBoundingClientRect();

        const toolbarWidth = toolbar.offsetWidth || 185; 
        let leftPos = (elRect.left - vpRect.left) + canvasViewport.scrollLeft + (elRect.width / 2) - (toolbarWidth / 2);
        
        const minPadding = 8;
        if (leftPos < minPadding + canvasViewport.scrollLeft) {
            leftPos = minPadding + canvasViewport.scrollLeft;
        } else if (leftPos + toolbarWidth > vpRect.width - minPadding + canvasViewport.scrollLeft) {
            leftPos = vpRect.width - toolbarWidth - minPadding + canvasViewport.scrollLeft;
        }

        let topPos = (elRect.bottom - vpRect.top) + canvasViewport.scrollTop + 8;
        const toolbarHeight = toolbar.offsetHeight || 80;

        if (topPos + toolbarHeight > vpRect.height + canvasViewport.scrollTop - minPadding) {
            topPos = (elRect.top - vpRect.top) + canvasViewport.scrollTop - toolbarHeight - 8;
            if (topPos < minPadding + canvasViewport.scrollTop) {
                topPos = minPadding + canvasViewport.scrollTop;
            }
        }

        toolbar.style.left = `${leftPos}px`;
        toolbar.style.top = `${topPos}px`;
    }
};

// Example usage to wire it up globally (Clicking outside deselects it)
document.addEventListener('mousedown', (e) => {
    // 1. Robust check to see if we are in Debug/Edit mode
    let isDebug = false;
    if (typeof State !== 'undefined') {
        if (typeof State.getDebugEnabled === 'function') isDebug = isDebug || State.getDebugEnabled();
        if (typeof State.getDebugMode === 'function') isDebug = isDebug || State.getDebugMode();
        if (State.debugMode !== undefined) isDebug = isDebug || State.debugMode;
    }
    if (window.debugMode !== undefined) isDebug = isDebug || window.debugMode;
    if (document.body.classList.contains('debug-mode') || document.body.classList.contains('debug')) isDebug = true;
    if (document.body.dataset.debug === 'true' || document.body.dataset.mode === 'debug') isDebug = true;

    // 2. If NOT in debug mode, clear any existing selection and do nothing
    if (!isDebug) {
        if (SelectionManager.currentSelection) {
            SelectionManager.deselect();
        }
        return;
    }

    // 3. We are in Debug Mode: proceed with selection logic
    // Ignore clicks inside the Quick Inspector or on handles/pads
    if (e.target.closest('#element-quick-inspector') || e.target.closest('#qi-selection-box') || e.target.closest('#element-context-action-toolbar')) {
        return;
    }
    
    const guiElement = e.target.closest('.gui-element');
    if (guiElement) {
        SelectionManager.select(guiElement);
        updateStatus('Press + or - to move item up or down a layer in the container (moves element before or after next element in XML)', 0);
    } else {
        SelectionManager.deselect();
        updateStatus('Ready.', 0);
    }
});

let phantomPlacementActive = false;
let phantomClipboardData = null;
let phantomGhostElement = null;

export function activatePhantomPlacement(clipboardData) {
    if (!clipboardData || !clipboardData.rawXml) return;
    cancelPhantomPlacement();
    
    phantomPlacementActive = true;
    phantomClipboardData = clipboardData;
    
    phantomGhostElement = document.createElement('div');
    phantomGhostElement.className = 'phantom-ghost-element';
    phantomGhostElement.style.position = 'absolute';
    phantomGhostElement.style.pointerEvents = 'none';
    phantomGhostElement.style.opacity = '0.6';
    phantomGhostElement.style.border = '2px dashed #3b82f6';
    phantomGhostElement.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
    phantomGhostElement.style.zIndex = '11000';
    
    let w = 60, h = 30;
    const wMatch = clipboardData.rawXml.match(/(\s(?:w|width))=["']([^"']*)["']/);
    const hMatch = clipboardData.rawXml.match(/(\s(?:h|height))=["']([^"']*)["']/);
    if (wMatch) w = parseInt(wMatch[2], 10) || w;
    if (hMatch) h = parseInt(hMatch[2], 10) || h;
    
    phantomGhostElement.style.width = `${w}px`;
    phantomGhostElement.style.height = `${h}px`;
    
    const zoomCanvas = getGuiZoomCanvas();
    if (zoomCanvas) {
        zoomCanvas.appendChild(phantomGhostElement);
    }
    
    updateStatus(`Placement Active: Click canvas container to place <${clipboardData.tagName}> (Esc to cancel)`, 0);
    
    document.addEventListener('keydown', handlePhantomKeyDown);
    document.addEventListener('mousemove', handlePhantomMouseMove);
    
    // Defer click listener to prevent catching the click that initiated placement
    setTimeout(() => {
        if (phantomPlacementActive) {
            document.addEventListener('click', handlePhantomClick, true);
        }
    }, 50);
}

function cancelPhantomPlacement() {
    phantomPlacementActive = false;
    if (phantomGhostElement && phantomGhostElement.parentNode) {
        phantomGhostElement.parentNode.removeChild(phantomGhostElement);
    }
    phantomGhostElement = null;
    phantomClipboardData = null;
    
    document.removeEventListener('keydown', handlePhantomKeyDown);
    document.removeEventListener('click', handlePhantomClick, true);
    document.removeEventListener('mousemove', handlePhantomMouseMove);
    document.querySelectorAll('.prospective-drop-zone').forEach(el => el.classList.remove('prospective-drop-zone'));
    updateStatus('Ready.', 0);
}

function handlePhantomKeyDown(e) {
    if (e.key === 'Escape') {
        cancelPhantomPlacement();
        updateStatus('Placement canceled.', 0);
        setTimeout(() => updateStatus('Ready.', 0), 2000);
    }
}

function handlePhantomMouseMove(event) {
    if (!phantomPlacementActive || !phantomGhostElement) return;
    const zoomCanvas = getGuiZoomCanvas();
    if (!zoomCanvas) return;
    
    const zoomCanvasRect = zoomCanvas.getBoundingClientRect();
    const currentScale = State.getCurrentZoomLevel() || 1;
    
    const skinX = (event.clientX - zoomCanvasRect.left) / currentScale;
    const skinY = (event.clientY - zoomCanvasRect.top) / currentScale;
    
    phantomGhostElement.style.left = `${skinX}px`;
    phantomGhostElement.style.top = `${skinY}px`;
    
    document.querySelectorAll('.prospective-drop-zone').forEach(el => el.classList.remove('prospective-drop-zone'));
    
    const targetElement = document.elementFromPoint(event.clientX, event.clientY);
    const childTag = phantomClipboardData ? (phantomClipboardData.tagName || 'element') : 'element';
    const containerElement = getValidDropContainer(targetElement, childTag);
    
    if (containerElement && containerElement.id !== 'skin-container-actual') {
        containerElement.classList.add('prospective-drop-zone');
    }
}

function getValidDropContainer(startElement, childTag) {
    let target = startElement;
    while (target && target !== document.body) {
        if (target.dataset && target.dataset.xmlTagName) {
            const parentTag = target.dataset.xmlTagName.toLowerCase();
            if (parentTag.includes('container') || parentTag.includes('view') || parentTag === 'pane' || parentTag === 'group' || parentTag === 'tabview') {
                // Panes are strictly bound to TabView structures
                if (childTag.toLowerCase() === 'pane' && parentTag !== 'tabview') {
                    // Keep traversing upward
                } else {
                    return target;
                }
            }
        }
        if (target.id === 'skin-container-actual') {
            return target;
        }
        target = target.parentElement;
    }
    return document.getElementById('skin-container-actual');
}

function handlePhantomClick(event) {
    if (!phantomPlacementActive || !phantomClipboardData) return;
    
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    
    const targetElement = document.elementFromPoint(event.clientX, event.clientY);
    const childTag = phantomClipboardData.tagName || 'element';
    const containerElement = getValidDropContainer(targetElement, childTag);
    
    if (!containerElement) {
        showToast('No valid placement container found.', 'error');
        cancelPhantomPlacement();
        return;
    }
    
    const containerRect = containerElement.getBoundingClientRect();
    const currentScale = State.getCurrentZoomLevel() || 1;
    const localX = Math.round((event.clientX - containerRect.left) / currentScale);
    const localY = Math.round((event.clientY - containerRect.top) / currentScale);
    
    const rawFinalXml = updateXmlCoords(phantomClipboardData.rawXml, localX, localY);
    const finalXml = `\n\t${rawFinalXml}`;
    const fileMap = State.getFileMap();
    
    // Fallback to active file path correctly to prevent crashes if container lacks source
    let targetFilePath = containerElement.dataset.sourcePath || (typeof State.getActiveFilePath === 'function' ? State.getActiveFilePath() : '');
    if (!targetFilePath) {
        if (fileMap && fileMap.size > 0) {
            targetFilePath = Array.from(fileMap.keys())[0];
        } else {
            showToast('No active file context found to paste into.', 'error');
            cancelPhantomPlacement();
            return;
        }
    }

    const normalizedPath = targetFilePath.toLowerCase().replace(/\\/g, '/');
    let targetKey = normalizedPath;
    let fileContent = fileMap.get(normalizedPath);

    // Cross-check memory mapping dynamically incase path segments differ
    if (!fileContent) {
        for (const key of fileMap.keys()) {
            if (key.endsWith('/' + normalizedPath) || normalizedPath.endsWith('/' + key)) {
                targetKey = key;
                fileContent = fileMap.get(key);
                break;
            }
        }
    }
    
    if (!fileContent) {
        showToast(`Source file content not found for insertion.`, 'error');
        cancelPhantomPlacement();
        return;
    }
    
    if (typeof State.pushHistoryState === 'function') {
        State.pushHistoryState(targetKey, fileContent);
    }
    
    let insertionSuccess = false;
    let updatedContent = "";
    
    if (containerElement.id === 'skin-container-actual' || !containerElement.dataset.xmlTagName) {
        const lastCloseIndex = fileContent.lastIndexOf('</');
        if (lastCloseIndex !== -1) {
            updatedContent = fileContent.slice(0, lastCloseIndex) + "\n\t" + finalXml + "\n" + fileContent.slice(lastCloseIndex);
            insertionSuccess = true;
        }
    } else {
        const containerTagName = containerElement.dataset.xmlTagName;
        const containerAttrs = {};
        for (const key in containerElement.dataset) {
            if (key.startsWith('xmlAttr_')) containerAttrs[key.slice(8)] = containerElement.dataset[key];
        }
        
        const matchResult = findElementInXmlContent(fileContent, containerTagName, containerAttrs);
        if (matchResult) {
            const matchStr = matchResult.exactStr;
            if (matchStr.trim().endsWith('/>')) {
                const expandedContainer = matchStr.replace('/>', `>\n\t${finalXml}\n</${containerTagName}>`);
                updatedContent = fileContent.slice(0, matchResult.index) + expandedContainer + fileContent.slice(matchResult.index + matchResult.length);
                insertionSuccess = true;
            } else {
                const closingTagStr = `</${containerTagName}>`;
                const closeTagIdx = matchStr.lastIndexOf(closingTagStr);
                if (closeTagIdx !== -1) {
                    const updatedMatchStr = matchStr.slice(0, closeTagIdx) + "\n\t" + finalXml + "\n" + matchStr.slice(closeTagIdx);
                    updatedContent = fileContent.slice(0, matchResult.index) + updatedMatchStr + fileContent.slice(matchResult.index + matchResult.length);
                    insertionSuccess = true;
                }
            }
        }
    }
    
    if (insertionSuccess) {
        fileMap.set(targetKey, updatedContent);
        if (typeof State.setXmlEditorDirty === 'function') State.setXmlEditorDirty(true);
        
        const instance = State.getEditorInstanceByPath(targetKey);
        if (instance) {
            if (typeof State.updateEditorInstance === 'function') State.updateEditorInstance(instance.uniqueId, { currentContent: updatedContent });
            const textarea = document.getElementById(`xml-editor-textarea-${instance.uniqueId}`);
            if (textarea) {
                const scrollPos = textarea.scrollTop;
                textarea.value = updatedContent;
                textarea.scrollTop = scrollPos;
                textarea.dispatchEvent(new Event('input'));
            }
        }
        
        showToast(`Successfully pasted <${phantomClipboardData.tagName}>`, 'success');
        
        // Cache tag and coords for post-render selection targeting
        const droppedTag = phantomClipboardData.tagName;
        const targetX = localX;
        const targetY = localY;

        cancelPhantomPlacement();
        
        if (typeof window.renderMainGui === 'function') {
            window.renderMainGui();
            // Wait for DOM to finish mounting before acquiring target
            setTimeout(() => {
                const elements = document.querySelectorAll('.gui-element');
                for (let candidate of elements) {
                    if (candidate.dataset.xmlTagName === droppedTag && 
                        parseInt(candidate.dataset.xmlAttr_x, 10) === targetX && 
                        parseInt(candidate.dataset.xmlAttr_y, 10) === targetY) {
                        if (typeof SelectionManager !== 'undefined') {
                            SelectionManager.select(candidate);
                        }
                        break;
                    }
                }
            }, 50);
        }
    } else {
        showToast('Failed to find container insertion point in XML.', 'error');
        cancelPhantomPlacement();
    }
}

export function moveElementLayer(el, direction) {
    const filePath = el.dataset.sourcePath;
    if (!filePath) return;
    
    const sibling = (direction === 'up') ? el.nextElementSibling : el.previousElementSibling;
    if (!sibling || !sibling.classList.contains('gui-element')) {
        showToast(`No layout sibling found to shift layer ${direction}.`, 'warning');
        return;
    }
    
    const fileMap = State.getFileMap();
    const targetKey = filePath.toLowerCase().replace(/\\/g, '/');
    let fileContent = fileMap.get(targetKey);
    if (!fileContent) return;
    
    const elAttrs = {};
    for (const key in el.dataset) {
        if (key.startsWith('xmlAttr_')) elAttrs[key.slice(8)] = el.dataset[key];
    }
    
    const sibAttrs = {};
    for (const key in sibling.dataset) {
        if (key.startsWith('xmlAttr_')) sibAttrs[key.slice(8)] = sibling.dataset[key];
    }
    
    const matchEl = findElementInXmlContent(fileContent, el.dataset.xmlTagName, elAttrs);
    const matchSib = findElementInXmlContent(fileContent, sibling.dataset.xmlTagName, sibAttrs);
    
    if (!matchEl || !matchSib) {
        showToast("Could not locate element coordinates in XML source file.", "error");
        return;
    }
    
    if (typeof State.pushHistoryState === 'function') {
        State.pushHistoryState(targetKey, fileContent);
    }
    
    let newContent = "";
    if (matchEl.index < matchSib.index) {
        const before = fileContent.slice(0, matchEl.index);
        const middle = fileContent.slice(matchEl.index + matchEl.length, matchSib.index);
        const after = fileContent.slice(matchSib.index + matchSib.length);
        newContent = before + matchSib.exactStr + middle + matchEl.exactStr + after;
    } else {
        const before = fileContent.slice(0, matchSib.index);
        const middle = fileContent.slice(matchSib.index + matchSib.length, matchEl.index);
        const after = fileContent.slice(matchEl.index + matchEl.length);
        newContent = before + matchEl.exactStr + middle + matchSib.exactStr + after;
    }
    
    fileMap.set(targetKey, newContent);
    State.setXmlEditorDirty(true);
    
    const instance = State.getEditorInstanceByPath(targetKey);
    if (instance) {
        State.updateEditorInstance(instance.uniqueId, { currentContent: newContent });
        const textarea = document.getElementById(`xml-editor-textarea-${instance.uniqueId}`);
        if (textarea) {
            const scrollPos = textarea.scrollTop;
            textarea.value = newContent;
            textarea.scrollTop = scrollPos;
            textarea.dispatchEvent(new Event('input'));
        }
    }
    
    showToast(`Moved structural layer ${direction}.`, 'info');
    if (typeof window.renderMainGui === 'function') {
        window.renderMainGui();
        setTimeout(() => {
            const elements = document.querySelectorAll('.gui-element');
            for (const candidate of elements) {
                if (candidate.dataset.xmlTagName === el.dataset.xmlTagName && candidate.dataset.xmlAttr_x === el.dataset.xmlAttr_x && candidate.dataset.xmlAttr_y === el.dataset.xmlAttr_y) {
                    SelectionManager.select(candidate);
                    break;
                }
            }
        }, 50);
    }
}