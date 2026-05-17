// File: cs/domUtils.js
/**
 * domUtils.js
 * DOM element references (via getter functions) and utility functions.
 * MODIFIED: Added getters for new GUI structure: gui-zoom-canvas and skin-container-actual.
 * MODIFIED: applyCurrentBackgroundColor targets gui-zoom-canvas.
 * FIXED: Ensured getExportParamRefBtn is exported.
 * FIXED: Added getMergedAttributes function.
 */
import * as State from './state.js';
import {
    addConsoleLogEntry, getFontMap, getGlobalGuiDefaults, getAssetBlobUrl,
    normalizePath as stateNormalizePath,
    getStyles, getUseDefaultBackgroundColor, getSkinDefaultBackgroundColor, getCustomBackgroundColor,
    getSimulateSplashOverlay
} from './state.js';

export const KNOB_ANGLE_RANGE = 315;
export const KNOB_START_ANGLE = 112.5;
const INFINITY_SYMBOL = "∞";

// --- Internal Helper Functions ---
function getElement(id, required = true) {
    const element = document.getElementById(id);
    if (!element && required) {
        console.error(`[domUtils] CRITICAL: Required element with ID '${id}' not found!`);
    }
    return element;
}

function querySelector(selector, parent = document, required = true) {
    const element = parent.querySelector(selector);
    if (!element && required) {
        let parentDesc = 'unknown parent';
        if (parent === document) {
            parentDesc = 'document';
        } else if (parent && parent.id) {
            parentDesc = `#${parent.id}`;
        } else if (parent && parent.tagName) {
            parentDesc = parent.tagName.toLowerCase();
        } else if (parent && parent.nodeName) {
            parentDesc = parent.nodeName.toLowerCase();
        }
        console.error(`[domUtils] CRITICAL: Required element with selector '${selector}' not found within ${parentDesc}!`);
    }
    return element;
}
export function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }


// --- Exported Getter Functions for DOM Elements ---
export function getTextLogo() { return getElement('text-logo', false); }
export function getEditorContainer() { return querySelector('.editor-container'); }
export function getMainContentArea() { return getElement('main-content-area'); }
export function getSidebar() { return getElement('sidebar'); }
export function getSidebarToggleBtn() { return getElement('sidebar-toggle-btn'); }
export function getSidebarContentWrapper() { return querySelector('#sidebar .sidebar-content-wrapper'); }
export function getLoadFolderButton() { return getElement('load-folder-button'); }
export function getFileInput() { return getElement('file-input'); }
export function getSclFileInput() { return getElement('scl-file-input', false); }
export function getStatusDiv() { return getElement('status'); }
export function getSkinSelectorContainer() { return getElement('skin-selector-container'); }
export function getSkinSelector() { return getElement('skin-selector'); }
export function getProductLogoImg() { return getElement('product-logo-img', false); }

// --- Getters for the NEW GUI rendering structure (from index.html changes) ---
export function getGuiZoomCanvas() { return getElement('gui-zoom-canvas'); }
export function getSkinContainerActual() { return getElement('skin-container-actual'); }

// --- Getters for OLD GUI structure IDs ---
export function getGuiOutputContainer() { return getElement('gui-output-container', false); }
export function getGuiOutputDiv() { return getElement('gui-output', false); }
export function getGuiContentWrapper() { return getElement('gui-content-wrapper', false) || getSkinContainerActual(); }


export function getFileTreeContainer() { return getElement('file-tree'); }
export function getFileBrowserContainer() { return getElement('file-browser-container'); }
export function getEditButton() { return getElement('edit-button'); }
export function getPreviewAreaContainer() { return getElement('preview-area-container'); }
export function getPreviewArea() { return getElement('preview-area'); }
export function getSidebarControls() { return getElement('sidebar-controls'); }
export function getZoomSlider() { return getElement('zoom-slider'); }
export function getZoomValueDisplay() { return getElement('zoom-value'); }
export function getDebugCheckbox() { return getElement('debug-checkbox', false); }
export function getDebugToggleButton() { return getElement('debug-toggle-button'); }
export function getConsoleButton() { return getElement('console-button'); }
export function getConfigButton() { return getElement('config-button'); }
export function getReferenceButton() { return getElement('reference-button'); }
export function getErrorLogContainer() { return getElement('error-log-container', false); }
export function getErrorLogDiv() { return getElement('error-log', false); }
export function getErrorContent() { return getElement('error-content', false); }
export function getCopyLogBtn() { return getElement('copy-log-btn', false); }

// XML Editor Modal (Template Getters)
export function getXmlEditorModal() { return getElement('xml-editor-modal'); }
export function getXmlEditorModalContent() { return getElement('xml-editor-content'); }
export function getXmlEditorTextarea() { return getElement('xml-editor-textarea'); }
export function getXmlEditorLineNumbers() { return getElement('xml-editor-line-numbers'); }
export function getXmlEditorHighlightOverlay() { return getElement('xml-editor-highlight-overlay'); }
export function getXmlEditorStatusBar() { return getElement('xml-editor-status-bar'); }
export function getEditingFilenameSpan() { return getElement('editing-filename'); }
export function getOkXmlButton() { return getElement('ok-xml-button'); }
export function getCancelXmlButton() { return getElement('cancel-xml-button'); }
export function getApplyXmlButton() { return getElement('apply-xml-button'); }
export function getCloseXmlEditorBtn() { return getElement('close-xml-editor-btn'); }
export function getSaveXmlAsFileButton() { return getElement('save-xml-as-file-btn'); }
export function getCopyXmlContentButton() { return getElement('copy-xml-content-btn'); }
export function getXmlEditorResizeHandle() { return getElement('xml-editor-resize-handle'); }

export function getDisclaimerModal() { return getElement('disclaimer-modal', false); }
export function getAcknowledgeDisclaimerButton() { return getElement('acknowledge-disclaimer', false); }
export function getConsoleModal() { return getElement('console-modal'); }
export function getCloseConsoleBtn() { return getElement('close-console-btn'); }
export function getClearConsoleBtn() { return getElement('clear-console-btn'); }
export function getConsoleLogOutput() { return getElement('console-log-output'); }
export function getCopyConsoleBtn() { return getElement('copy-console-btn'); }
export function getConfigModal() { return getElement('config-modal'); }
export function getCloseConfigBtn() { return getElement('close-config-btn'); }
export function getGridToggle() { return getElement('grid-toggle', false); }
export function getGridToggleCheckbox() { return getElement('grid-toggle-checkbox', false); }
export function getBgColorInput() { return getElement('bg-color-input', false); }
export function getBgColorValue() { return getElement('bg-color-value', false); }
export function getBgModeToggle() { return getElement('bg-mode-toggle', false); }
export function getBgModeCheckbox() { return getElement('bg-mode-checkbox', false); }
export function getSimulateSplashToggle() { return getElement('simulate-splash-toggle', false); }
export function getReferenceModal() { return getElement('reference-modal'); }
export function getCloseReferenceBtn() { return getElement('close-reference-btn'); }
export function getReferenceContent() { return getElement('reference-content'); }
export function getImportReferenceBtn() { return getElement('import-reference-btn'); }
export function getExportReferenceBtn() { return getElement('export-reference-btn'); }
export function getReferenceFileInput() { return getElement('reference-file-input'); }
export function getElementEditorModal() { return getElement('element-editor-modal'); }
export function getElementEditorTitle() { return getElement('element-editor-title'); }
export function getCloseElementEditorBtn() { return getElement('close-element-editor-btn'); }
export function getElementEditorOriginalName() { return getElement('element-editor-original-name'); }
export function getElementEditorNameInput() { return getElement('element-editor-name'); }
export function getElementEditorDescriptionTextarea() { return getElement('element-editor-description'); }
export function getElementEditorUsesCommonCheckbox() { return getElement('element-editor-uses-common'); }
export function getElementEditorSpecificAttributesTextarea() { return getElement('element-editor-specific-attributes'); }
export function getElementEditorNotesTextarea() { return getElement('element-editor-notes'); }
export function getCancelElementEditBtn() { return getElement('cancel-element-edit-btn'); }
export function getSaveElementEditBtn() { return getElement('save-element-edit-btn'); }
export function getDebugOverlay() { return getElement('debug-overlay', false); }
export function getToastContainer() { return getElement('toast-container', false); }
export function getDynamicStyles() { return getElement('dynamic-styles'); }
export function getReferenceElementList() { return getElement('reference-element-list'); }
export function getReferencePlaceholderText() { return getElement('reference-placeholder-text'); }
export function getReferenceAttributeList() { return getElement('reference-attribute-list', false); }
export function getAddElementRefBtn() { return getElement('add-element-ref-btn', false); }
export function getAddAttributeRefBtn() { return getElement('add-attribute-ref-btn', false); }
export function getManageAttributeDefinitionsBtn() { return getElement('manage-attribute-definitions-btn', false); }
export function getEditElementCategoriesBtnRef() { return getElement('edit-element-categories-btn-ref', false); }
export function getReferenceDescriptionTextarea() { return getElement('reference-description-textarea'); }
export function getElementEditorCategorySelect() { return getElement('element-editor-category', false); }
export function getAttributeEditorModal() { return getElement('attribute-editor-modal'); }
export function getCloseAttributeEditorBtn() { return getElement('close-attribute-editor-btn'); }
export function getAttributeEditorTitle() { return getElement('attribute-editor-title'); }
export function getEditAttributeCategoriesBtnAttr() { return getElement('edit-attribute-categories-btn-attr', false); }
export function getAttributeEditorList() { return getElement('attribute-editor-list'); }
export function getAddNewAttributeBtn() { return getElement('add-new-attribute-btn'); }
export function getAttributeEditorOriginalName() { return getElement('attribute-editor-original-name'); }
export function getAttributeEditorTypeFlag() { return getElement('attribute-editor-type-flag'); }
export function getAttributeEditorNameInput() { return getElement('attribute-editor-name'); }
export function getAttributeEditorDescriptionTextarea() { return getElement('attribute-editor-description'); }
export function getAttributeEditorTypeSelect() { return getElement('attribute-editor-type'); }
export function getAttributeEditorDefaultInput() { return getElement('attribute-editor-default'); }
export function getAttributeEditorRequiredCheckbox() { return getElement('attribute-editor-required'); }
export function getAttributeEditorCategorySelect() { return getElement('attribute-editor-category'); }
export function getInsertElementXmlBtn() { return getElement('insert-element-xml-btn', false); }
export function getXmlInsertElementModal() { return getElement('xml-insert-element-modal', false); }
export function getCloseXmlInsertBtn() { return getElement('close-xml-insert-btn', false); }
export function getXmlInsertElementList() { return getElement('xml-insert-element-list', false); }
export function getXmlHoverInfo() { return getElement('xml-hover-info', false); }
export function getParamReferenceButton() { return getElement('param-reference-button', false); }
export function getParamReferenceModal() { return getElement('param-reference-modal'); }
export function getCloseParamRefBtn() { return getElement('close-param-ref-btn'); }
export function getImportParamRefBtn() { return getElement('import-param-ref-btn'); }
export function getExportParamRefBtn() { return getElement('export-param-ref-btn', false); }
export function getParamReferenceFileInput() { return getElement('param-reference-file-input'); }
export function getParamReferenceContent() { return getElement('param-reference-content'); }
export function getParamListContainer() { return getElement('param-list-container'); }
export function getParamList() { return getElement('param-list'); }
export function getAddParamRefBtn() { return getElement('add-param-ref-btn'); }
export function getParamDetailsContainer() { return getElement('param-details-container'); }
export function getParamCategorySelect() { return getElement('param-category-select'); }
export function getAddParamCategoryBtn() { return getElement('add-param-category-btn'); }
export function getRenameParamCategoryBtn() { return getElement('rename-param-category-btn'); }
export function getRemoveParamCategoryBtn() { return getElement('remove-param-category-btn'); }
export function getParamIdInput() { return getElement('param-id-input'); }
export function getParamLabelInput() { return getElement('param-label-input'); }
export function getParamDescriptionTextarea() { return getElement('param-description-textarea'); }
export function getParamPlaceholderText() { return getElement('param-placeholder-text', false); }
export function getElementRefNameInput() { return getElement('element-ref-name-input', false); }
export function getAttributeDescriptionTextarea() { return getElement('attribute-description-textarea', false); }
export function getOverrideAttributeDescriptionBtn() { return getElement('override-attribute-description-btn', false); }

export function getPreviewItemModal() { return getElement('preview-item-modal', false); }
export function getClosePreviewItemModalBtn() { return getElement('close-preview-item-modal-btn', false); }
export function getPreviewItemModalContent() { return getElement('preview-item-modal-content', false); }
export function getPreviewItemModalTitle() { return getElement('preview-item-modal-title', false); }

export function getReferenceModalContent() { return querySelector('#reference-modal .modal-content-container'); }
export function getReferenceModalHeader() { return querySelector('#reference-modal .modal-content-container > div:first-child'); }
export function getXmlEditorModalHeader() { return querySelector('#xml-editor-modal .modal-content-container > div:first-child'); }
export function getParamReferenceModalContent() { const modal = getParamReferenceModal(); return modal ? querySelector('.modal-content-container', modal) : null; }
export function getParamReferenceModalHeader() { const modal = getParamReferenceModal(); return modal ? querySelector('.modal-content-container > div:first-child', modal) : null; }
export function getAttributeEditorModalContent() { const modal = getAttributeEditorModal(); return modal ? querySelector('.modal-content-container', modal) : null; }
export function getAttributeEditorModalHeader() { const modal = getAttributeEditorModal(); return modal ? querySelector('.modal-content-container > div:first-child', modal) : null; }

// --- Utility Functions ---

/**
 * Merges attributes from an XML node, a named style, and global defaults.
 * Precedence: XML Attributes > Style Attributes > Global Defaults
 */
export function getMergedAttributes(xmlNode, styleName, stylesMap) {
    const merged = {};
    const globalDefaults = State.getGlobalGuiDefaults();
    
    for (const key in globalDefaults) {
        merged[key] = globalDefaults[key];
    }
    
    if (styleName && stylesMap) {
        const styleParts = styleName.split(';').map(s => s.trim()).filter(Boolean);
        for (const part of styleParts) {
            if (stylesMap[part]) {
                const styleData = stylesMap[part];
                for (const key in styleData) {
                    merged[key] = styleData[key];
                }
            }
        }
    }
    
    if (xmlNode && typeof xmlNode.getAttribute === 'function') {
        for (const attr of xmlNode.attributes) {
            merged[attr.name] = attr.value;
        }
    }
    
    return merged;
}

/**
 * Sanitizes an attribute name to be used as a key in a dataset object.
 */
export function sanitizeAttrName(name) {
    if (typeof name !== 'string') return '';
    return name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/^-+|-+$/g, '');
}

export function normalizePath(p) { return stateNormalizePath(p); }
export function formatChipsynthName(text) { if (!text) return ''; return text.replace(/chipsynth/gi, 'chip<b>synth</b>'); }

export function parseColor(colorString) {
    if (!colorString || typeof colorString !== 'string') { return 'rgba(0,0,0,0)'; }
    const s = colorString.trim().toLowerCase();
    if (s === 'transparent') return 'rgba(0,0,0,0)'; if (s === 'none') return 'none';
    if (s.startsWith('#')) {
        let hex = s.substring(1); if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2]; if (hex.length === 6) hex += 'ff';
        if (hex.length === 8) {
            const r = parseInt(hex.substring(0, 2), 16); const g = parseInt(hex.substring(2, 4), 16); const b = parseInt(hex.substring(4, 6), 16); const aInt = parseInt(hex.substring(6, 8), 16);
            if (isNaN(r) || isNaN(g) || isNaN(b) || isNaN(aInt)) { console.warn(`[domUtils parseColor] Invalid hex characters in: "${colorString}", returning 'none'.`); return 'none'; }
            const a = parseFloat((aInt / 255).toFixed(3)); return `rgba(${r},${g},${b},${a})`;
        }
    }
    if (s.startsWith('rgba')) return s; if (s.startsWith('rgb')) return s.replace('rgb', 'rgba').replace(')', ',1)');
    console.warn(`[domUtils parseColor] Could not parse color format: "${colorString}", returning 'none'.`); return 'none';
}

export function mapFontSize(fontSizeName = 'Small') {
    const upperCaseName = typeof fontSizeName === 'string' ? fontSizeName.trim().toUpperCase() : 'SMALL';
    const map = { 'SMALL': 10, 'MEDIUM': 12, 'LARGE': 14, 'VERYSMALL': 9 };
    const parsedInt = parseInt(fontSizeName, 10);
    if (!isNaN(parsedInt)) return parsedInt;
    return map[upperCaseName] || 11;
}

export function mapTextAlign(alignValue) { const map = { 'left': 'left', 'Left': 'left', 'center': 'center', 'Center': 'center', 'right': 'right', 'Right': 'right' }; return map[alignValue] || 'left'; }

export function mapFlexAlignment(alignValue) { const map = { 'left': 'flex-start', 'Left': 'flex-start', 'center': 'center', 'Center': 'center', 'right': 'flex-end', 'Right': 'flex-end' }; return map[alignValue] || 'flex-start'; }

export function createErrorPlaceholder(text = 'Error') { const div = document.createElement('div'); div.className = 'gui-error-placeholder'; div.style.cssText = `border: 1px dashed red; color: red; background-color: #fee2e2; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 10px; padding: 2px; overflow: hidden; box-sizing: border-box; position: absolute;`; div.textContent = text; return div; }

export function logError(message, errorObject = null, isCritical = false) {
    let logMessage = `[${isCritical ? 'CRITICAL ' : ''}Error] ${message}`;
    if (errorObject) {
        logMessage += errorObject.message ? `\n  Message: ${errorObject.message}` : `\n  Details: ${String(errorObject)}`;
        if (errorObject.stack) { logMessage += `\n  Stack: ${errorObject.stack}`; }
    }
    console.error(logMessage);
    try { 
        State.addConsoleLogEntry(logMessage, 'error'); 
        if (typeof window.updateConsoleView === 'function' && document.getElementById('console-modal')?.classList.contains('visible')) {
            window.updateConsoleView();
        }
    } catch (stateError) { 
        console.error("[domUtils logError] FATAL: Failed to add entry to state console log:", stateError); 
    }
    const errorLogContainer = getErrorLogContainer(); const errorLogDiv = getErrorLogDiv(); const errorContent = getErrorContent();
    if (errorLogContainer && errorLogDiv && errorContent) {
        errorLogContainer.style.display = 'block'; const timestamp = new Date().toLocaleTimeString();
        let uiErrorMessage = `[${timestamp}] ${message}`;
        if (errorObject && errorObject.message) { uiErrorMessage += `: ${errorObject.message}`; } else if (errorObject) { uiErrorMessage += `: ${String(errorObject)}`; }
        errorContent.textContent += uiErrorMessage + '\n\n'; errorLogDiv.scrollTop = errorLogDiv.scrollHeight;
    }
}

export function clearErrors() { const errorContent = getErrorContent(); const errorLogContainer = getErrorLogContainer(); if (errorContent) errorContent.textContent = ''; if (errorLogContainer) errorLogContainer.style.display = 'none'; }

export function showToast(message, type = 'info', duration = 3000) { const toastContainer = getToastContainer(); if (!toastContainer) { console.log(`Toast (${type}): ${message}`); return; } const toast = document.createElement('div'); toast.className = `toast-notification ${type}`; toast.innerHTML = message; const closeBtn = document.createElement('button'); closeBtn.className = 'toast-close-btn'; closeBtn.innerHTML = '&times;'; closeBtn.setAttribute('aria-label', 'Close notification'); closeBtn.onclick = (e) => { e.stopPropagation(); toast.classList.add('fade-out'); if (toast.timerId) { clearTimeout(toast.timerId); } toast.addEventListener('transitionend', () => { if (toast.parentNode === toastContainer) { toastContainer.removeChild(toast); } }, { once: true }); }; toast.appendChild(closeBtn); toastContainer.appendChild(toast); if (duration > 0) { toast.timerId = setTimeout(() => { closeBtn.click(); }, duration); } else { toast.timerId = null; } }

export function getParamValue(node, offset = 0, attributeName = 'param') {
    if (!node) { return 'NODE_INVALID';}
    if (typeof node.getAttribute !== 'function') {
        console.warn(`[domUtils getParamValue] Node passed is not a valid element for getAttribute. Node:`, node);
        return 'NODE_INVALID_NO_GETATTRIBUTE';
    }
    const rawValue = node.getAttribute(attributeName);
    if (!rawValue) return 'PARAM_MISSING';
    if (rawValue.startsWith('DID_')) { return rawValue; }
    const numericValue = parseInt(rawValue, 10);
    if (!isNaN(numericValue) && /^\d+$/.test(rawValue)) { return (numericValue + offset).toString(); }
    if (rawValue.includes('+') && rawValue.toUpperCase().includes('OFFSET')) { try { const parts = rawValue.split('+'); const base = parseInt(parts[0].trim(), 10); if (!isNaN(base)) { return (base + offset).toString(); } } catch (e) { console.warn(`Failed to parse formula param '${rawValue}', returning as is.`); } }
    if (rawValue.includes('|')) { return rawValue; }
    return rawValue;
}

export function applyCommonAttributes(element, xmlNode, styleName = null) {
    if (!element) { console.warn('[domUtils applyCommonAttributes] HTML Element is null/undefined. Skipping.'); return; }
    if (!xmlNode) { console.warn('[domUtils applyCommonAttributes] xmlNode is null/undefined. Skipping for element:', element.tagName); return; }

    if (typeof xmlNode.getAttribute !== 'function') {
        const nodeInfo = {
            nodeName: xmlNode.nodeName,
            nodeType: xmlNode.nodeType,
            toString: String(xmlNode),
            properties: Object.keys(xmlNode)
        };
        console.error('[domUtils applyCommonAttributes] FATAL: xmlNode is invalid or missing getAttribute method.', {
            elementTag: element.tagName, styleName, xmlNodeDetails: nodeInfo
        });
        logError('applyCommonAttributes: xmlNode is invalid.', {problematicXmlNodeInfo: nodeInfo});
        return;
    }

    const getAttr = (attr) => {
        const lower = attr.toLowerCase();
        if (styleName && typeof styleName === 'object') {
            for (const k in styleName) {
                if (k.toLowerCase() === lower) return styleName[k];
            }
        }
        if (xmlNode && xmlNode.attributes) {
            for (const a of xmlNode.attributes) {
                if (a.name.toLowerCase() === lower) return a.value;
            }
        }
        const styles = typeof styleName === 'string' ? State.getStyles() : {};
        const styleData = (typeof styleName === 'string' && styles && styles[styleName]) ? styles[styleName] : {};
        for (const k in styleData) {
            if (k.toLowerCase() === lower) return styleData[k];
        }
        return null;
    };

    const x = getAttr('x') ?? getAttr('xoffset');
    const y = getAttr('y') ?? getAttr('yoffset');
    const w = getAttr('w');
    const h = getAttr('h');

    if (x !== null || y !== null) {
        element.style.position = 'absolute';
    }
    if (x !== null) element.style.left = `${x}px`;
    if (y !== null) element.style.top = `${y}px`;

    if (element.tagName.toLowerCase() === 'svg') {
        if (w !== null) {
            element.setAttribute('width', w);
            element.style.width = `${w}px`;
        }
        if (h !== null) {
            element.setAttribute('height', h);
            element.style.height = `${h}px`;
        }
    } else {
        if (w !== null) element.style.width = `${w}px`;
        if (h !== null) {
            element.style.height = `${h}px`;
        }
    }
}

export function applyStyles(element, styleName, xmlNode) {
    if (!element) { console.warn('[domUtils applyStyles] HTML Element is null/undefined. Skipping.'); return; }
    if (!xmlNode ) { console.warn('[domUtils applyStyles] xmlNode is null/undefined. Skipping for element:', element.tagName); return; }

    if (typeof xmlNode.getAttribute !== 'function') {
        const nodeInfo = {
            nodeName: xmlNode.nodeName,
            nodeType: xmlNode.nodeType,
            toString: String(xmlNode),
            properties: Object.keys(xmlNode)
        };
        console.error('[domUtils applyStyles] FATAL: xmlNode is invalid or missing getAttribute method.', {
            elementTag: element.tagName, styleName, xmlNodeDetails: nodeInfo
        });
        logError('applyStyles: xmlNode is invalid.', {problematicXmlNodeInfo: nodeInfo});
        return;
    }

    const styles = State.getStyles();
    const styleData = (styleName && styles && styles[styleName]) ? styles[styleName] : {};
    const globalDefaults = State.getGlobalGuiDefaults();

    const isButton = element.tagName?.toLowerCase() === 'button' ||
                     element.classList.contains('gui-onoff-button') ||
                     element.classList.contains('gui-expand-view-button') ||
                     element.classList.contains('gui-text-button') ||
                     element.classList.contains('gui-control-text-button');
    const isHtmlRect = element.tagName?.toLowerCase() === 'div' &&
                       (element.classList.contains('gui-rect') || element.classList.contains('gui-rounded-rect'));
    const isStaticText = element.classList.contains('gui-statictext');
    const isContainer = element.classList.contains('gui-view-container') ||
                        element.classList.contains('gui-view-container1') ||
                        element.classList.contains('gui-visibility-container') ||
                        element.classList.contains('gui-expandable-content-container');
    const isOptionMenu = element.tagName?.toLowerCase() === 'select';
    const isLineOrShape = element.classList.contains('gui-line-container') || 
                          element.classList.contains('gui-shape-container') ||
                          element.classList.contains('gui-line-svg');

    if (isButton) {
        element.style.boxSizing = 'border-box';
        element.style.padding = '0';
        element.style.border = 'none';
        element.style.outline = 'none';
        element.style.overflow = 'hidden';
        if (element.style.height) {
            element.style.lineHeight = element.style.height;
        }
    }

    const getFinalValue = (xmlAttrNames, styleAttrNames, globalDefaultKey, fallback = null) => {
        const xmlNames = Array.isArray(xmlAttrNames) ? xmlAttrNames : [xmlAttrNames];
        const styleNames = Array.isArray(styleAttrNames) ? styleAttrNames : [styleAttrNames];

        if (xmlNode && xmlNode.attributes) {
            for (const name of xmlNames) {
                const lowerName = name.toLowerCase();
                for (const attr of xmlNode.attributes) {
                    if (attr.name.toLowerCase() === lowerName) return attr.value;
                }
            }
        }
        for (const name of styleNames) {
            const lowerName = name.toLowerCase();
            for (const key in styleData) {
                if (key.toLowerCase() === lowerName && styleData[key] !== undefined) return styleData[key];
            }
        }
        if (globalDefaultKey) {
            const lowerKey = globalDefaultKey.toLowerCase();
            for (const key in globalDefaults) {
                if (key.toLowerCase() === lowerKey && globalDefaults[key] !== undefined) return globalDefaults[key];
            }
        }
        return fallback;
    };

    if (!isLineOrShape) {
        const borderColor = getFinalValue(['color_border', 'border_color', 'frameColor'], ['color_border', 'border_color', 'frameColor'], 'color_border');
        const borderWidth = getFinalValue('frameWidth', 'frameWidth', null);
        const drawMode = getFinalValue('drawMode', 'drawMode', null);
        element.style.borderColor = borderColor ? parseColor(borderColor) : '';
        element.style.borderWidth = borderWidth ? `${borderWidth}px` : '';
        if (drawMode === 'stroked') { element.style.borderStyle = 'solid'; if (!element.style.borderWidth || element.style.borderWidth === '0px') element.style.borderWidth = '1px'; }
        else if (drawMode === 'filled') { if (borderColor || (borderWidth && parseFloat(borderWidth) > 0)) { element.style.borderStyle = 'solid'; if (!element.style.borderWidth) element.style.borderWidth = '1px'; } else { element.style.borderStyle = 'none'; } }
        else { if (borderColor || (borderWidth && parseFloat(borderWidth) > 0)) { element.style.borderStyle = 'solid'; if (!element.style.borderWidth) element.style.borderWidth = '1px'; } else { element.style.borderStyle = ''; } }
    } else {
        element.style.border = 'none';
    }

    const fontAlias = getFinalValue('font', 'font', 'font');
    if (fontAlias) { applyFont(element, fontAlias); }
    else { const globalFontSize = getGlobalGuiDefaults().font_size; if (globalFontSize) { const sizeInPx = mapFontSize(globalFontSize); element.style.fontSize = `${sizeInPx}px`; } else { element.style.fontSize = ''; } element.style.fontFamily = ''; }
    const fontSize = getFinalValue('font_size', 'font_size', null);
    if (fontSize !== null) { element.style.fontSize = `${mapFontSize(fontSize)}px`; }

    element.style.borderRadius = '0px';
    const roundedRectRatio = getFinalValue('roundedRectRatio', 'roundedRectRatio', null);
    const roundedRatio = getFinalValue('roundedRatio', 'roundedRatio', null);
    if (roundedRectRatio && (element.classList.contains('gui-rounded-rect') || isContainer)) {
        const elementW = parseFloat(element.style.width || getFinalValue('w', 'w', null) || '0');
        const elementH = parseFloat(element.style.height || getFinalValue('h', 'h', null) || '0');
        const ratio = parseFloat(roundedRectRatio || '0');
        if (elementW > 0 && elementH > 0 && ratio >= 0) { const radius = Math.min(elementW, elementH) * ratio * 0.5; element.style.borderRadius = `${radius}px`; }
    } else if (roundedRatio && isButton) {
        const elementW = parseFloat(element.style.width || getFinalValue('w', 'w', null) || '0');
        const elementH = parseFloat(element.style.height || getFinalValue('h', 'h', null) || '0');
        const ratio = parseFloat(roundedRatio || '0');
        if (elementW > 0 && elementH > 0 && ratio >= 0) {
            const size = Math.min(elementW, elementH);
            const radiusValue = size * ratio;
            element.style.borderRadius = `${radiusValue}px`;
        }
    }

    const defaultAlignment = (isButton || isOptionMenu) ? 'center' : 'left';
    if (isStaticText || element.classList.contains('gui-label') || element.classList.contains('gui-textdisplay') || element.classList.contains('gui-texteditor') || isOptionMenu || isButton) {
        const alignment = getFinalValue('alignment', 'alignment', null, defaultAlignment);
        element.style.textAlign = mapTextAlign(alignment);
        if (isOptionMenu) {
            element.style.textAlignLast = mapTextAlign(alignment);
        }
        if (element.style.display === 'flex') { element.style.justifyContent = mapFlexAlignment(alignment); }
    }

    const isStateColored = element.classList.contains('gui-tab-button');
    if (!isStateColored) {
        const textColorValue = getFinalValue(['color_text', 'fontColor'], ['color_text', 'fontColor'], 'color_text');
        if (textColorValue) {
            const parsedTextColor = parseColor(textColorValue);
            if (isOptionMenu) {
                if (parsedTextColor && parsedTextColor !== 'none' && !parsedTextColor.startsWith('rgba(0,0,0,0)')) {
                    element.style.color = parsedTextColor;
                }
            } else {
                element.style.color = parsedTextColor;
            }
        }
    }

    const bgHandledByImageStates = isButton && (getFinalValue(['image', 'image_on', 'image_off'], ['image', 'image_on', 'image_off'], null) !== null || styleData.image || styleData.image_on || styleData.image_off);
    const isTransparentAttr = getFinalValue('transparent', 'transparent', null, '0') === '1';
    let explicitBgColor = getFinalValue(['fill_color', 'color_back', 'backgroundColor'], ['fill_color', 'color_back', 'backgroundColor'], null);
    if (isButton && !explicitBgColor && !bgHandledByImageStates) {
        if (element.classList.contains('active')) {
            explicitBgColor = getFinalValue('onColor', 'onColor', null) || getFinalValue('offColor', 'offColor', null);
        } else {
            explicitBgColor = getFinalValue('offColor', 'offColor', null);
        }
    }

    if (!isLineOrShape) {
        if (isStaticText || isContainer) {
            if (isTransparentAttr) { element.style.backgroundColor = 'transparent'; }
            else if (explicitBgColor) { element.style.backgroundColor = parseColor(explicitBgColor); }
            else { element.style.backgroundColor = 'transparent'; }
        } else if (!bgHandledByImageStates && !isOptionMenu) {
            let finalBgColor = '';
            if (isTransparentAttr) { finalBgColor = 'transparent'; }
            else if (explicitBgColor) { finalBgColor = parseColor(explicitBgColor); }
            else { const globalBg = (isHtmlRect || isButton) ? globalDefaults['color_back'] : null; finalBgColor = globalBg ? parseColor(globalBg) : ''; }
            if (finalBgColor && finalBgColor !== 'none') { element.style.backgroundColor = finalBgColor; }
            else { element.style.backgroundColor = ''; }
        } else if (isOptionMenu) {
            if (explicitBgColor && explicitBgColor !== 'none' && !isTransparentAttr) {
                element.style.backgroundColor = parseColor(explicitBgColor);
            } else if (isTransparentAttr) {
                element.style.backgroundColor = 'transparent';
            }
        }
    } else {
        element.style.backgroundColor = 'transparent';
    }
}

export function applyFont(element, fontAlias) {
    const fontMap = State.getFontMap();
    const fontData = fontMap.get(fontAlias);
    if (fontData) {
        const safeFamily = fontData.family;
        element.style.fontFamily = `${safeFamily}, Arial, sans-serif`;
        const sizeInPx = fontData.size ? mapFontSize(fontData.size) : null;
        element.style.fontSize = sizeInPx ? `${sizeInPx}px` : '';
        element.style.fontWeight = fontData.weight || '';
        element.style.fontStyle = fontData.fontStyle || '';
    } else {
        console.warn(`Font alias "${fontAlias}" not found in fontMap.`);
        element.style.fontFamily = '';
        element.style.fontSize = '';
        element.style.fontWeight = '';
        element.style.fontStyle = '';
    }
}

let statusTimeoutId = null;
export function updateStatus(message, durationMs = 4000) { const statusDiv = getStatusDiv(); if (!statusDiv) return; console.log(`[Status Update] ${message}`); statusDiv.innerHTML = message; statusDiv.classList.add('visible'); if (statusTimeoutId) { clearTimeout(statusTimeoutId); } if (durationMs > 0) { statusTimeoutId = setTimeout(() => { statusDiv.classList.remove('visible'); statusTimeoutId = null; }, durationMs); } else { statusTimeoutId = null; } }

export function polarToCartesian(centerX, centerY, radius, angleInDegrees) { const angleInRadians = angleInDegrees * Math.PI / 180.0; return { x: centerX + (radius * Math.cos(angleInRadians)), y: centerY + (radius * Math.sin(angleInRadians)) }; }
export function describeArc(x, y, radius, startAngleDegrees, endAngleDegrees) { if (isNaN(x) || isNaN(y) || isNaN(radius) || isNaN(startAngleDegrees) || isNaN(endAngleDegrees)) { return "M 0 0"; } if (Math.abs(endAngleDegrees - startAngleDegrees) < 0.01) return ""; if (Math.abs(endAngleDegrees - startAngleDegrees) >= 360) { endAngleDegrees = startAngleDegrees + 359.99 * Math.sign(endAngleDegrees - startAngleDegrees); } const start = polarToCartesian(x, y, radius, startAngleDegrees); const end = polarToCartesian(x, y, radius, endAngleDegrees); const largeArcFlag = Math.abs(endAngleDegrees - startAngleDegrees) <= 180 ? "0" : "1"; const sweepFlag = endAngleDegrees > startAngleDegrees ? "1" : "0"; const d = [ "M", start.x.toFixed(3), start.y.toFixed(3), "A", radius.toFixed(3), radius.toFixed(3), 0, largeArcFlag, sweepFlag, end.x.toFixed(3), end.y.toFixed(3) ].join(" "); return d; }
export function mapValueToAngle(value, vmin, vmax) { if (isNaN(value) || isNaN(vmin) || isNaN(vmax)) { return KNOB_START_ANGLE; } const valueRange = vmax - vmin; if (valueRange === 0) return KNOB_START_ANGLE; const clampedValue = clamp(value, vmin, vmax); const normalizedValue = (clampedValue - vmin) / valueRange; const angle = KNOB_START_ANGLE + normalizedValue * KNOB_ANGLE_RANGE; return angle; }

export function rgbToHsl(r, g, b) { r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b); let h = 0, s = 0, l = (max + min) / 2; if (max != min) { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min); switch (max) { case r: h = (g - b) / d + (g < b ? 6 : 0); break; case g: h = (b - r) / d + 2; break; case b: h = (r - g) / d + 4; break; } h /= 6; } return { h: h * 360, s: s, l: l }; }
export function hslToRgb(h, s, l) { let r, g, b; if (s == 0) { r = g = b = l; } else { const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p + (q - p) * 6 * t; if (t < 1/2) return q; if (t < 2/3) return p + (q - p) * (2/3 - t) * 6; return p; }; const q = l < 0.5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q; h /= 360; r = hue2rgb(p, q, h + 1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1/3); } return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }; }
export function transformHslHighlight(hsl, lum) { let { h, s, l } = hsl; let newL = clamp(l + lum, 0, 1); return { h, s, l: newL }; }
export function applyHighlight(doHighlight, elementsToHighlight) { const globalDefaults = State.getGlobalGuiDefaults(); const lum = globalDefaults.highlight_Luminance || 0.0; if (lum === 0 && doHighlight) return; elementsToHighlight.forEach(el => { if (!el) return; const originalFill = el.dataset.originalFill; const originalStroke = el.dataset.originalStroke; const targetAttr = originalFill ? 'fill' : (originalStroke ? 'stroke' : null); const originalColorCss = originalFill || originalStroke; if (!targetAttr || !originalColorCss) return; if (doHighlight && lum !== 0) { try { const match = originalColorCss.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/); if (match) { const r = parseInt(match[1]); const g = parseInt(match[2]); const b = parseInt(match[3]); const a = match[4] !== undefined ? parseFloat(match[4]) : 1; const hsl = rgbToHsl(r, g, b); const newHsl = transformHslHighlight(hsl, lum); const newRgb = hslToRgb(newHsl.h, newHsl.s, newHsl.l); el.setAttribute(targetAttr, `rgba(${newRgb.r}, ${newRgb.g}, ${newRgb.b}, ${a})`); } else { el.setAttribute(targetAttr, originalColorCss); } } catch (e) { el.setAttribute(targetAttr, originalColorCss); } } else { el.setAttribute(targetAttr, originalColorCss); } }); }

export function quantizeValue(value, step, vmin) { if (step <= 0) return value; return vmin + Math.round((value - vmin) / step) * step; }
export function formatDisplayValue(value, format, vmin = 0, vmax = 1) { if (format === 'FORMAT_LINEAR2DB_LINEAR') { const epsilon = 0.00001; if (value < vmin + epsilon) { return INFINITY_SYMBOL; } if (Math.abs(value - 1.0) < epsilon) { return "0.0 dB"; } if (value <= 0) return "-inf dB"; const db = 20 * Math.log10(value); if (db > 0) { return `+${db.toFixed(1)} dB`; } else { return `${db.toFixed(1)} dB`; } } if (typeof value === 'number') { return value.toFixed(2); } return String(value); }


export function applyCurrentBackgroundColor() {
    const canvasViewport = getElement('canvas-viewport');
    if (!canvasViewport) {
        console.error("[domUtils applyCurrentBackgroundColor] canvas-viewport not found!");
        return;
    }

    const useSkinDefaultBg = State.getUseDefaultBackgroundColor();
    const skinXmlBgColor = State.getSkinDefaultBackgroundColor();
    const customEditorBgColor = State.getCustomBackgroundColor();

    let finalAppliedColor = '';

    if (useSkinDefaultBg) {
        if (skinXmlBgColor && skinXmlBgColor.toLowerCase() !== 'none' && skinXmlBgColor.toLowerCase() !== 'transparent') {
            finalAppliedColor = parseColor(skinXmlBgColor);
        } else if (skinXmlBgColor && (skinXmlBgColor.toLowerCase() === 'transparent' || skinXmlBgColor.toLowerCase() === 'none')) {
            finalAppliedColor = 'transparent';
        }
    } else {
        if (customEditorBgColor) {
            finalAppliedColor = customEditorBgColor;
        }
    }
    canvasViewport.style.backgroundColor = finalAppliedColor;
}

export function getAttributeCategory(attrName) {
    const name = String(attrName).toLowerCase();
    if (['x', 'y', 'w', 'h', 'width', 'height', 'xoffset', 'yoffset', 'left', 'top', 'right', 'bottom', 'anchor', 'rel_x', 'rel_y', 'rel_w', 'rel_h'].includes(name)) return 'Layout & Position';
    if (['value', 'vmin', 'vmax', 'vdefault', 'stepped', 'param', 'parametermode', 'scalefactor', 'maxchars'].includes(name)) return 'Value & Parameter';
    if (['style', 'color', 'fill_color', 'color_back', 'color_text', 'color_border', 'framecolor', 'framecolorhl', 'fontcolor', 'fontcolorhl', 'knobfillcolor', 'valuetrackcolor', 'valuefillcolor', 'valueindicatorfillcolor', 'valueindicatorcolor', 'indicatorcolor', 'highlight_luminance', 'drawmode', 'linewidth', 'framewidth', 'transparent', 'roundedrectratio', 'roundedratio', 'offColor', 'onColor'].includes(name)) return 'Appearance & Style';
    if (['font', 'label_font', 'value_font', 'font_size', 'label_fontcolor', 'value_fontcolor', 'alignment', 'textalign', 'label_mode', 'labelmode', 'label_text', 'text', 'labeltext', 'valuetext', 'showvaluetextonhl'].includes(name)) return 'Text & Font';
    if (['tooltip', 'visible', 'enabled', 'enablekey', 'enabledbyonoff', 'targetelement', 'options', 'sendvalueonmouseover', 'visibilitychangename', 'command', 'mouseoversound', 'mouseclicksound'].includes(name)) return 'Interaction & Behavior';
    if (['valueindicatortype', 'imagemode', 'drawframe', 'loopmode', 'syncmode', 'resetmode'].includes(name)) return 'Timing & Mode';
    if (['controller', 'id', 'group', 'path', 'source', 'images', 'knobframes', 'image', 'image_off', 'image_on', 'image_list', 'svg_src', 'element', 'valuetrackorder', 'label_x', 'label_y', 'label_w', 'label_h', 'knob_x', 'knob_y', 'knob_w', 'knob_h', 'valuetrackwidth', 'valueindicatormargin', 'valueindicator_w', 'valueindicator_h'].includes(name)) return 'Structure & System';
    return 'Other';
}

const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const IS_BLACK_KEY_PATTERN = [false, true, false, true, false, false, true, false, true, false, true, false];

export function getNoteInfo(midiNote) {
    if (midiNote < 0 || midiNote > 127) {
        return {
            midiNote: midiNote,
            isWhite: true,
            isBlack: false,
            noteName: 'N/A',
            noteIndex: -1,
            octave: -1,
            noteNameWithOctave: `MIDI ${midiNote}`
        };
    }
    const noteIndexInOctave = midiNote % 12;
    const noteName = NOTE_NAMES_SHARP[noteIndexInOctave];
    const octave = Math.floor(midiNote / 12) - 1;
    const isBlack = IS_BLACK_KEY_PATTERN[noteIndexInOctave];
    return {
        midiNote: midiNote,
        isWhite: !isBlack,
        isBlack: isBlack,
        noteName: noteName,
        noteIndex: noteIndexInOctave,
        octave: octave,
        noteNameWithOctave: `${noteName}${octave}`
    };
}

export function getSvgDimensions(svgPath, fallbacks = { defaultWidth: 20, defaultHeight: 80 }) {
    return new Promise((resolve) => {
        if (!svgPath) {
            resolve({ loaded: false, width: fallbacks.defaultWidth, height: fallbacks.defaultHeight });
            return;
        }
        let blobUrl;
        try {
            blobUrl = State.getAssetBlobUrl(svgPath);
        } catch (e) {
            resolve({ loaded: false, width: fallbacks.defaultWidth, height: fallbacks.defaultHeight });
            return;
        }
        if (!blobUrl) {
            resolve({ loaded: false, width: fallbacks.defaultWidth, height: fallbacks.defaultHeight });
            return;
        }
        const tempImg = new Image();
        tempImg.onload = () => {
            if (tempImg.naturalWidth > 0 && tempImg.naturalHeight > 0) {
                resolve({ loaded: true, width: tempImg.naturalWidth, height: tempImg.naturalHeight });
            } else {
                resolve({ loaded: true, width: fallbacks.defaultWidth, height: fallbacks.defaultHeight });
            }
        };
        tempImg.onerror = () => {
            resolve({ loaded: false, width: fallbacks.defaultWidth, height: fallbacks.defaultHeight });
        };
        tempImg.src = blobUrl;
    });
}

export function toggleElementErrorClass(element, className, force) {
    if (!element || !className) return;
    element.classList.toggle(className, force);
}

export function clearChildren(element) {
    if (element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }
}

export function normalizedToPixel(normalizedValue, trackLengthPixels, knobSizePixels) {
    const availableTrack = trackLengthPixels - knobSizePixels;
    if (availableTrack <= 0) return 0;
    return normalizedValue * availableTrack;
}

export function pixelToNormalized(pixelPosition, trackLengthPixels, knobSizePixels) {
    const availableTrack = trackLengthPixels - knobSizePixels;
    if (availableTrack <= 0) return 0;
    return clamp(pixelPosition / availableTrack, 0, 1);
}

/**
 * Triggers a standard change event on an element.
 */
export function triggerGenericChangeEvent(element, value) {
    const event = new CustomEvent('change', {
        detail: { value: value },
        bubbles: true,
        cancelable: true
    });
    element.dispatchEvent(event);
}