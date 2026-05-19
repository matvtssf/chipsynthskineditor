/**
 * clipboardInteractions.js
 * Handles clipboard memory state, phantom placement, and structural layer swapping.
 */
import * as State from '../core/state.js';
import { showToast } from '../core/domUtils.js';

let isPasteModeActive = false;
let ghostElement = null;
let activeTargetContainer = null;

const VALID_CONTAINERS = ['view', 'pane', 'group', 'container', 'tabview'];
const INVALID_CHILD_HOSTS = ['statictext', 'text', 'button', 'knob', 'slider'];

export function initializeClipboardAndLayerListeners() {
    document.addEventListener('keydown', handleGlobalKeydown);
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('click', handleGlobalCanvasClick, true);
}

function isValidDropTarget(childTag, parentTag) {
    if (!childTag || !parentTag) return false;
    const child = childTag.toLowerCase();
    const parent = parentTag.toLowerCase();

    // Structural containers capable of hosting layout blocks
    const ALLOWED_PARENTS = ['pane', 'group', 'tabview', 'skin'];
    if (!ALLOWED_PARENTS.includes(parent) && !parent.includes('container') && !parent.includes('view')) return false;

    // Control endpoints and static strings that cannot wrap other interface components
    const ILLEGAL_HOSTS = ['statictext', 'text', 'button', 'knob', 'slider', 'control', 'dropdown', 'keyboard'];
    if (ILLEGAL_HOSTS.includes(parent)) return false;

    // Pane boundaries are structurally bound strictly to TabView control strips
    if (child === 'pane' && parent !== 'tabview') return false;

    return true;
}

function updateClipboardBadge() {
    const badge = document.getElementById('clipboard-badge');
    const badgeText = document.getElementById('clipboard-badge-text');
    const clip = State.getProjectClipboard ? State.getProjectClipboard() : null;
    
    if (badge && badgeText) {
        if (clip && clip.content) {
            badge.style.display = 'inline-block';
            badgeText.textContent = `${clip.tag}`;
        } else {
            badge.style.display = 'none';
        }
    }
}

function handleGlobalKeydown(e) {
    const activeEl = State.getSelectedElement ? State.getSelectedElement() : null;
    
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && activeEl) {
        e.preventDefault();
        copyElementToClipboard(activeEl);
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x' && activeEl) {
        e.preventDefault();
        cutElementToClipboard(activeEl);
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        activatePhantomPasteMode();
    }
    if (activeEl && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        moveLayer(activeEl, 1);
    }
    if (activeEl && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        moveLayer(activeEl, -1);
    }
    if (e.key === 'Escape' && isPasteModeActive) {
        deactivatePhantomPasteMode();
    }
}

function copyElementToClipboard(el) {
    const rawXml = el.dataset.rawXml || '';
    const sourcePath = el.dataset.sourcePath || (State.getActiveFilePath ? State.getActiveFilePath() : '');
    const tag = el.dataset.xmlTagName || el.tagName || 'Element';
    
    if (!rawXml) return;
    if (State.setProjectClipboard) {
        State.setProjectClipboard({ tag, content: rawXml, sourcePath });
    }
    updateClipboardBadge();
    if (typeof showToast === 'function') {
        showToast(`Copied <${tag}> to layout memory.`, 'info');
    }
}

function cutElementToClipboard(el) {
    copyElementToClipboard(el);
    removeElementFromSource(el);
}

// Container Validation Shield: Safe token slice lookup to prevent matching duplicates elsewhere
function removeElementFromSource(el) {
    const rawXml = el.dataset.rawXml;
    const sourcePath = el.dataset.sourcePath || (State.getActiveFilePath ? State.getActiveFilePath() : '');
    if (!rawXml || !sourcePath) return;

    let fileContent = State.getFileContent ? State.getFileContent(sourcePath) : null;
    if (!fileContent) return;

    const index = fileContent.indexOf(rawXml);
    if (index !== -1) {
        if (State.pushHistoryState) State.pushHistoryState(sourcePath, fileContent);
        const updatedContent = fileContent.substring(0, index) + fileContent.substring(index + rawXml.length);
        if (State.addFile) State.addFile(sourcePath, updatedContent);
        if (window.checkAndRerender) window.checkAndRerender(sourcePath);
        if (State.setSelectedElement) State.setSelectedElement(null);
        if (typeof showToast === 'function') showToast("Element removed from structure.", "info");
    }
}

function activatePhantomPasteMode() {
    const clip = State.getProjectClipboard ? State.getProjectClipboard() : null;
    if (!clip || !clip.content) {
        if (typeof showToast === 'function') showToast("Clipboard is empty.", "warn");
        return;
    }
    
    isPasteModeActive = true;
    if (ghostElement) ghostElement.remove();

    ghostElement = document.createElement('div');
    ghostElement.className = 'phantom-ghost-element';
    ghostElement.style.cssText = 'position: fixed; pointer-events: none; opacity: 0.6; border: 2px dashed #6b7280; background: rgba(107, 114, 128, 0.15); z-index: 99999; width: 48px; height: 24px; transition: border-color 0.15s;';
    document.body.appendChild(ghostElement);
    if (typeof showToast === 'function') showToast("Phantom Placement engaged.", "info");
}

function deactivatePhantomPasteMode() {
    isPasteModeActive = false;
    if (ghostElement) {
        ghostElement.remove();
        ghostElement = null;
    }
    clearDropZoneHighlights();
}

function clearDropZoneHighlights() {
    document.querySelectorAll('.prospective-drop-zone').forEach(el => {
        el.classList.remove('prospective-drop-zone');
        el.style.outline = '';
    });
    document.querySelectorAll('.prospective-drop-zone-invalid').forEach(el => {
        el.classList.remove('prospective-drop-zone-invalid');
        el.style.outline = '';
    });
    activeTargetContainer = null;
}

function handleGlobalMouseMove(e) {
    if (!isPasteModeActive || !ghostElement) return;

    let x = e.clientX;
    let y = e.clientY;

    if (e.shiftKey) {
        x = Math.round(x / 8) * 8;
        y = Math.round(y / 8) * 8;
    }

    ghostElement.style.left = `${x + 8}px`;
    ghostElement.style.top = `${y + 8}px`;

    clearDropZoneHighlights();
    const hitEl = document.elementFromPoint(e.clientX, e.clientY);
    if (!hitEl) return;

    const prospectiveContainer = hitEl.closest('.gui-element, [data-raw-xml]');
    if (prospectiveContainer) {
        const clip = State.getProjectClipboard ? State.getProjectClipboard() : null;
        const childTag = clip ? clip.tag : 'element';
        const parentTag = prospectiveContainer.dataset.xmlTagName || prospectiveContainer.tagName;

        // Container Validation Shield Evaluation
        if (isValidDropTarget(childTag, parentTag)) {
            activeTargetContainer = prospectiveContainer;
            activeTargetContainer.classList.add('prospective-drop-zone');
            activeTargetContainer.style.outline = '2px solid #4ade80';
            ghostElement.style.borderColor = '#4ade80';
        } else {
            // Repel layout modification by dropping lookahead frame boundaries to defensive red colors
            prospectiveContainer.classList.add('prospective-drop-zone-invalid');
            prospectiveContainer.style.outline = '2px solid #ef4444';
            ghostElement.style.borderColor = '#ef4444';
        }
    } else {
        ghostElement.style.borderColor = '#6b7280';
    }
}

function handleGlobalCanvasClick(e) {
    if (!isPasteModeActive) return;
    e.preventDefault();
    e.stopPropagation();

    if (!activeTargetContainer) {
        if (typeof showToast === 'function') showToast("Placement blocked: Select a valid container slot.", "warn");
        deactivatePhantomPasteMode();
        return;
    }

    const clip = State.getProjectClipboard ? State.getProjectClipboard() : null;
    const targetSourcePath = activeTargetContainer.dataset.sourcePath || (State.getActiveFilePath ? State.getActiveFilePath() : '');
    const parentRawXml = activeTargetContainer.dataset.rawXml;

    if (!parentRawXml || !targetSourcePath || !clip) {
        deactivatePhantomPasteMode();
        return;
    }

    let fileContent = State.getFileContent ? State.getFileContent(targetSourcePath) : null;
    if (!fileContent) return;

    const parentIndex = fileContent.indexOf(parentRawXml);
    if (parentIndex === -1) {
        deactivatePhantomPasteMode();
        return;
    }

    const closingTag = `</${activeTargetContainer.dataset.xmlTagName || activeTargetContainer.tagName.toLowerCase()}>`;
    const innerClosingIndex = parentRawXml.lastIndexOf(closingTag);

    if (innerClosingIndex === -1) {
        deactivatePhantomPasteMode();
        return;
    }

    const insertOffset = parentIndex + innerClosingIndex;
    if (State.pushHistoryState) State.pushHistoryState(targetSourcePath, fileContent);

    const freshlyPastedXml = `\n\t${clip.content}\n`;
    const updatedFileContent = fileContent.substring(0, insertOffset) + freshlyPastedXml + fileContent.substring(insertOffset);

    if (State.addFile) State.addFile(targetSourcePath, updatedFileContent);
    if (window.checkAndRerender) window.checkAndRerender(targetSourcePath);
    
    if (typeof showToast === 'function') showToast("Element structural injection complete.", "info");
    deactivatePhantomPasteMode();
}

function moveLayer(el, direction) {
    const sourcePath = el.dataset.sourcePath || (State.getActiveFilePath ? State.getActiveFilePath() : '');
    const rawXml = el.dataset.rawXml;
    const parentNode = el.parentElement?.closest('[data-raw-xml]');

    if (!rawXml || !parentNode) return;
    const parentRawXml = parentNode.dataset.rawXml;
    if (!parentRawXml) return;

    let fileContent = State.getFileContent ? State.getFileContent(sourcePath) : null;
    if (!fileContent) return;

    const parentStartIdx = fileContent.indexOf(parentRawXml);
    if (parentStartIdx === -1) return;

    const elOffsetInParent = parentRawXml.indexOf(rawXml);
    if (elOffsetInParent === -1) return;

    if (direction === -1) {
        const beforeText = parentRawXml.substring(0, elOffsetInParent);
        const lastCloseTagIdx = beforeText.lastIndexOf('>');
        if (lastCloseTagIdx !== -1) {
            const prevTagStartIdx = beforeText.lastIndexOf('<', lastCloseTagIdx);
            if (prevTagStartIdx !== -1) {
                const prevSiblingXml = parentRawXml.substring(prevTagStartIdx, elOffsetInParent);
                if (prevSiblingXml.trim().startsWith('<')) {
                    const swappedParentXml = parentRawXml.substring(0, prevTagStartIdx) + rawXml + prevSiblingXml + parentRawXml.substring(elOffsetInParent + rawXml.length);
                    if (State.pushHistoryState) State.pushHistoryState(sourcePath, fileContent);
                    const updatedFileContent = fileContent.replace(parentRawXml, swappedParentXml);
                    if (State.addFile) State.addFile(sourcePath, updatedFileContent);
                    if (window.checkAndRerender) window.checkAndRerender(sourcePath);
                    if (typeof showToast === 'function') showToast("Layer order moved down.", "info");
                    return;
                }
            }
        }
    } else if (direction === 1) {
        const afterText = parentRawXml.substring(elOffsetInParent + rawXml.length);
        const nextTagStartIdx = afterText.indexOf('<');
        if (nextTagStartIdx !== -1) {
            const nextTagEndIdx = afterText.indexOf('>', nextTagStartIdx);
            if (nextTagEndIdx !== -1) {
                let nextSiblingLength = nextTagEndIdx + 1;
                const nextTagNameMatch = afterText.substring(nextTagStartIdx + 1).match(/^[\w:-]+/);
                if (nextTagNameMatch) {
                    const nextTagName = nextTagNameMatch[0];
                    const closeTagStr = `</${nextTagName}>`;
                    const closeTagIdx = afterText.indexOf(closeTagStr, nextTagEndIdx);
                    if (closeTagIdx !== -1) {
                        nextSiblingLength = closeTagIdx + closeTagStr.length;
                    }
                }
                const nextSiblingXml = afterText.substring(0, nextSiblingLength);
                const swappedParentXml = parentRawXml.substring(0, elOffsetInParent) + nextSiblingXml + rawXml + afterText.substring(nextSiblingLength);
                if (State.pushHistoryState) State.pushHistoryState(sourcePath, fileContent);
                const updatedFileContent = fileContent.replace(parentRawXml, swappedParentXml);
                if (State.addFile) State.addFile(sourcePath, updatedFileContent);
                if (window.checkAndRerender) window.checkAndRerender(sourcePath);
                if (typeof showToast === 'function') showToast("Layer order moved up.", "info");
                return;
            }
        }
    }
}