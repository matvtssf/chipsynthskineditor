// File: cs/state.js
/**
 * state.js
 * Manages the application's shared state.
 * Ensures all reference data structures, accessors, and multi-editor state are correctly implemented.
 */

// --- State Variables ---
let fileMap = new Map();
let imageBlobUrls = new Map();
let fontBlobUrls = new Map();
let fontMap = new Map();
let stylesMap = {}; // Consistent naming
let xmlMacros = new Map(); // Consistent naming
let detectedSkinInfo = [];
let currentSkinRoot = '';
let defaultSkinRoot = '';
let mainGuiXmlPath = 'ui.xml'; // Variable to hold the main GUI XML path
let baseGuiWidth = 1024;
let baseGuiHeight = 630;
let globalGuiDefaults = {};
let productName = 'Unknown Product';
let productVendor = 'Unknown Vendor';
let usedXmlFiles = new Set();
let usedSvgFiles = new Set();
let usedFontFiles = new Set();
let activeFilePath = null;
let isMouseButtonDown = false;
let isSidebarCollapsed = false;
let isConsoleVisible = false;
let consoleLogContent = [];
let hasConsoleErrors = false;
let useDefaultBackgroundColor = true;
let customBackgroundColor = '#4B5563';
let skinDefaultBackgroundColor = null;
let showGridLines = false;
let debugEnabled = false;
let selectedElement = null;
let savedViewportScrollLeft = 0;
let savedViewportScrollTop = 0;
let savedZoomLevel = 1;
let simulateSplashOverlay = false;
let guiSettingsXmlParsedForNames = false;
let currentZoomLevel = 1;

let undoStack = [];
let redoStack = [];
let isUndoRedoExecuting = false;

let visibilityStates = {};
let activeExpandableViewContainers = new Map();
let scrollViewStates = new Map();
let elementStates = new Map();

// --- XML Editor Instance State ---
let editorInstances = new Map();
let nextEditorInstanceNumericId = 1;
let activeEditorInstanceId = null;
let baseEditorZIndex = 6000;
let isXmlEditorDirty = false; // Reflects active editor's dirty state

// --- Element and Attribute Reference Data State ---
let elementReferenceData = [];
let commonAttributes = {};
let attributeCategories = ['Layout & Position', 'Value & Parameter', 'Appearance & Style', 'Text & Font', 'Interaction & Behavior', 'Timing & Mode', 'Structure & System', 'Other'];
let elementCategories = ['Containers & Layout', 'Buttons & Toggles', 'Knobs & Sliders', 'Menus & Options', 'Text & Display', 'Graphics & Shapes', 'Complex Editors & Views', 'Overlays', 'Definitions & Structure', 'Other'];

// --- Parameter Reference Data State ---
let paramReferenceData = {};


// --- Path Utilities ---
export function normalizePath(p) { return p ? p.toLowerCase().replace(/\\/g, '/') : ''; }
export function getDirectory(filePath) { const normalized = normalizePath(filePath); const lastSlash = normalized.lastIndexOf('/'); return lastSlash === -1 ? '' : normalized.substring(0, lastSlash); }

// --- Getters for Maps/Objects/Arrays ---
export function getFileMap() { return fileMap; }
export function getImageBlobUrls() { return imageBlobUrls; }
export function getFontBlobUrls() { return fontBlobUrls; }
export function getFontMap() { return fontMap; }
export function getStyles() { return stylesMap; }
export function getXmlMacros() { return xmlMacros; }
export function getDetectedSkinInfo() { return detectedSkinInfo; }
export function getUsedFiles() { return { xml: usedXmlFiles, svg: usedSvgFiles, font: usedFontFiles }; }
export function getConsoleLogContent() { return consoleLogContent; }

// --- Getters/Setters for Simple Values ---
export function getCurrentSkinRoot() { return currentSkinRoot; }
export function setCurrentSkinRoot(root) { currentSkinRoot = normalizePath(typeof root === 'string' ? root : ''); }
export function getDefaultSkinRoot() { return defaultSkinRoot; }
export function setDefaultSkinRoot(root) { defaultSkinRoot = normalizePath(typeof root === 'string' ? root : ''); }

export function getDefaultMainGuiXmlPath() { return mainGuiXmlPath; }
export function setDefaultMainGuiXmlPath(path) {
    if (typeof path === 'string') {
        mainGuiXmlPath = path;
    } else {
        console.warn('[State] setDefaultMainGuiXmlPath: Provided path is not a string. Path not changed.');
    }
}

export function getBaseGuiDimensions() { return { width: baseGuiWidth, height: baseGuiHeight }; }
export function setBaseGuiDimensions(width, height) { baseGuiWidth = width; baseGuiHeight = height; }
export function getGlobalGuiDefaults() { return globalGuiDefaults; }
export function setGlobalGuiDefaults(defaults) { globalGuiDefaults = defaults || {}; }
export function getProductName() { return productName; }
export function setProductName(name) { productName = name || 'Unknown Product'; }
export function getProductVendor() { return productVendor; }
export function setProductVendor(vendor) { productVendor = vendor || 'Unknown Vendor'; }
export function getActiveFilePath() { return activeFilePath; }
export function setActiveFilePath(path) { activeFilePath = path; }

export function getCurrentlyEditingPath() {
    const activeInstance = getEditorInstance(activeEditorInstanceId);
    return activeInstance ? activeInstance.filePath : null;
}
export function setCurrentlyEditingPath(path) {
    if (activeEditorInstanceId) {
        updateEditorInstance(activeEditorInstanceId, { filePath: normalizePath(path) });
    }
}
export function getOriginalXmlContent() {
    const activeInstance = getEditorInstance(activeEditorInstanceId);
    return activeInstance ? activeInstance.originalContent : '';
}
export function setOriginalXmlContent(content) {
    if (activeEditorInstanceId) {
        updateEditorInstance(activeEditorInstanceId, { originalContent: content });
    }
}
export function getXmlEditorDirty() {
    const activeInstance = getEditorInstance(activeEditorInstanceId);
    return activeInstance ? activeInstance.currentContent !== activeInstance.originalContent : false;
}
export function setXmlEditorDirty(dirty) {
    isXmlEditorDirty = !!dirty;
    if (activeEditorInstanceId && dirty === false) {
        const instance = getEditorInstance(activeEditorInstanceId);
        if (instance) {
            updateEditorInstance(activeEditorInstanceId, { originalContent: instance.currentContent });
        }
    }
}

export function getIsMouseButtonDown() { return isMouseButtonDown; }
export function setIsMouseButtonDown(value) { isMouseButtonDown = !!value; }
export function getIsSidebarCollapsed() { return isSidebarCollapsed; }
export function setIsSidebarCollapsed(value) { isSidebarCollapsed = !!value; }
export function getIsConsoleVisible() { return isConsoleVisible; }
export function setIsConsoleVisible(value) { isConsoleVisible = !!value; }
export function getHasConsoleErrors() { return hasConsoleErrors; }
export function setHasConsoleErrors(value) { hasConsoleErrors = !!value; updateConsoleButtonStateInternal(); }
export function getUseDefaultBackgroundColor() { return useDefaultBackgroundColor; }
export function setUseDefaultBackgroundColor(value) { useDefaultBackgroundColor = !!value; }
export function getCustomBackgroundColor() { return customBackgroundColor; }
export function setCustomBackgroundColor(value) { customBackgroundColor = typeof value === 'string' ? value : '#4B5563'; }
export function getSkinDefaultBackgroundColor() { return skinDefaultBackgroundColor; }
export function setSkinDefaultBackgroundColor(value) { skinDefaultBackgroundColor = typeof value === 'string' ? value : null; }
export function getShowGridLines() { return showGridLines; }
export function setShowGridLines(value) { showGridLines = !!value; }
export function getDebugEnabled() { return debugEnabled; }
export function setDebugEnabled(value) { debugEnabled = !!value; if (!value) { setSelectedElement(null); } }
export function getSelectedElement() { return selectedElement; }
export function setSelectedElement(el) { selectedElement = el; if (window.updateSelectionOutline) window.updateSelectionOutline(); }
export function getSavedViewportScroll() { return { left: savedViewportScrollLeft, top: savedViewportScrollTop }; }
export function setSavedViewportScroll(left, top) { savedViewportScrollLeft = left; savedViewportScrollTop = top; }
export function getSavedZoomLevel() { return savedZoomLevel; }
export function setSavedZoomLevel(level) { savedZoomLevel = level; }
export function getSimulateSplashOverlay() { return simulateSplashOverlay; }
export function setSimulateSplashOverlay(value) { simulateSplashOverlay = !!value; }
export function getGuiSettingsXmlParsedForNames() { return guiSettingsXmlParsedForNames; }
export function setGuiSettingsXmlParsedForNames(parsed) { guiSettingsXmlParsedForNames = parsed; }
export function getToolVersion() { return "0.3.0"; }
export function setDetectedSkinInfo(skins) { detectedSkinInfo = Array.isArray(skins) ? skins : []; }

export function getVisibilityState(changeName) { if (visibilityStates.hasOwnProperty(changeName)) { return visibilityStates[changeName]; } return true; }
export function setVisibilityState(changeName, isVisible) { const newState = !!isVisible; if (!changeName) { return; } if (visibilityStates[changeName] !== newState) { visibilityStates[changeName] = newState; if (window.visibilityController && typeof window.visibilityController.updateVisibility === 'function') { setTimeout(() => window.visibilityController.updateVisibility(changeName, newState), 0); } } }

export function registerExpandableView(tag, containerElement, expandButtonElement, originalDisplay = 'block') { if (!tag || !containerElement || !expandButtonElement) { return; } activeExpandableViewContainers.set(tag, { containerElement, expandButtonElement, isContentLoaded: false, isVisible: false, originalDisplay: originalDisplay || 'block' }); }
export function getExpandableViewInfo(tag) { return activeExpandableViewContainers.get(tag); }
export function setExpandViewContentLoaded(tag, isLoaded) { const info = activeExpandableViewContainers.get(tag); if (info) { info.isContentLoaded = !!isLoaded; } }
export function showExpandableView(tag) { const info = activeExpandableViewContainers.get(tag); if (info && info.containerElement) { info.containerElement.style.display = info.originalDisplay; info.isVisible = true; } }
export function hideExpandableView(tag) { const info = activeExpandableViewContainers.get(tag); if (info && info.containerElement) { info.containerElement.style.display = 'none'; info.isVisible = false; } }
export function clearExpandableViewContainers() { activeExpandableViewContainers.clear(); }

export function addScrollViewState(name, state) { if(name) scrollViewStates.set(name, state); }
export function getScrollViewState(name) { return scrollViewStates.get(name); }
export function getAllScrollViewStates() { return scrollViewStates; }
export function updateScrollViewPage(name, newPage) { const state = scrollViewStates.get(name); if (state) { state.currentPage = newPage; } }
export function clearScrollViewStates() { scrollViewStates.clear(); }

export function setElementState(elementId, stateValue) { if (elementId === null || elementId === undefined) { return; } elementStates.set(String(elementId), stateValue); document.dispatchEvent(new CustomEvent('elementStateChanged', { detail: { elementId: String(elementId), newState: stateValue } })); }
export function getElementState(elementId, defaultValue = undefined) { if (elementId === null || elementId === undefined) { return defaultValue; } const state = elementStates.get(String(elementId)); return state === undefined ? defaultValue : state; }
export function clearAllElementStates() { elementStates.clear(); }
export function getAllElementStates() { return new Map(elementStates); }

export function setFileMap(newMap) { fileMap = newMap instanceof Map ? newMap : new Map(); }
export function addFile(key, content) { if(key) fileMap.set(normalizePath(key), content); }
export function setStyles(newStyles) { stylesMap = newStyles || {}; }
export function setXmlMacros(newMacros) { xmlMacros = (newMacros instanceof Map) ? newMacros : (typeof newMacros === 'object' && newMacros !== null ? new Map(Object.entries(newMacros)) : new Map());}
export function clearXmlMacros() { xmlMacros.clear(); }
export function setFontMap(newMap) { fontMap = newMap instanceof Map ? newMap : new Map(); }

export function addImageBlobUrl(key, url) { if(key) imageBlobUrls.set(normalizePath(key), url); }
export function addFontBlobUrl(key, url) { if(key) fontBlobUrls.set(normalizePath(key), url); }
export function addUsedFile(type, path) { if (!path) return; const lp = normalizePath(path); switch (type) { case 'xml': usedXmlFiles.add(lp); break; case 'svg': case 'image': usedSvgFiles.add(lp); break; case 'font': usedFontFiles.add(lp); break; default: console.warn(`Unknown used file type: ${type}`); } }

function internalAddLog(message, type='info') {
    const msgStr = String(message);
    if (consoleLogContent.length > 0) {
        const lastLog = consoleLogContent[consoleLogContent.length - 1];
        if (lastLog.message === msgStr && lastLog.type === type) {
            lastLog.timestamp = new Date();
            lastLog.count = (lastLog.count || 1) + 1;
            if (getIsConsoleVisible() && window.updateConsoleView) {
                window.updateConsoleView();
            }
            return lastLog;
        }
    }
    consoleLogContent.push({ timestamp: new Date(), message: msgStr, type, count: 1 });
    if (consoleLogContent.length > 200) {
        consoleLogContent.shift();
    }
    if (type === 'error') {
        if (!hasConsoleErrors) {
            setHasConsoleErrors(true);
        }
    }
    if (getIsConsoleVisible() && window.updateConsoleView) {
        window.updateConsoleView();
    }
    return consoleLogContent[consoleLogContent.length - 1];
}
export function addConsoleLogEntry(message, type = 'info') { return internalAddLog(message, type); }
export function clearConsoleLog() { consoleLogContent = []; setHasConsoleErrors(false); if(getIsConsoleVisible() && window.updateConsoleView) { window.updateConsoleView(); } }
function updateConsoleButtonStateInternal() { const btn = document.getElementById('console-button'); if (btn) btn.classList.toggle('error', hasConsoleErrors); }

export function isFileUsed(path) { if (!path) return false; const np = normalizePath(path); return usedXmlFiles.has(np) || usedSvgFiles.has(np) || usedFontFiles.has(np); }

// MODIFIED findAsset function - now returns object with value and resolved path
function findAsset(relativePath, mapToSearch) {
    if (!relativePath) return { value: undefined, resolvedPath: undefined };
    const normalizedRelativePath = normalizePath(relativePath);

    // Helper to check map directly (keys are assumed to be pre-normalized)
    const checkPathInMapDirect = (pathKeyToLookup) => {
        if (mapToSearch.has(pathKeyToLookup)) {
            return { value: mapToSearch.get(pathKeyToLookup), resolvedPath: pathKeyToLookup };
        }
        return undefined;
    };

    const currentRoot = getCurrentSkinRoot();
    const defaultRoot = getDefaultSkinRoot();
    let result;

    // 1. Try with current skin's root
    if (currentRoot) {
        result = checkPathInMapDirect(normalizePath(`${currentRoot}/${normalizedRelativePath}`));
        if (result !== undefined) return result;
    }

    // 2. Try with default skin's root (if different from current)
    if (defaultRoot && defaultRoot !== currentRoot) {
        result = checkPathInMapDirect(normalizePath(`${defaultRoot}/${normalizedRelativePath}`));
        if (result !== undefined) {
            addConsoleLogEntry(`Asset Fallback: '${normalizedRelativePath}' not in '${currentRoot || 'root'}', found in '${defaultRoot || 'root'}'.`, 'info');
            return result;
        }
    }

    // 3. Try the relativePath as is (it might be an absolute path from project root, or already correctly prefixed)
    result = checkPathInMapDirect(normalizedRelativePath);
    if (result !== undefined) return result;

    return { value: undefined, resolvedPath: undefined }; // Not found
}

export function getAssetBlobUrl(relativePath) {
    let res = findAsset(relativePath, imageBlobUrls);
    if (res.value !== undefined) { addUsedFile('image', res.resolvedPath); return res.value; }
    
    res = findAsset(relativePath, fontBlobUrls);
    if (res.value !== undefined) { addUsedFile('font', res.resolvedPath); return res.value; }
    
    return undefined;
}

export function getFileContent(relativePath) {
    const res = findAsset(relativePath, fileMap);
    if (res.value !== undefined) {
        const normalizedKey = normalizePath(res.resolvedPath); 
        if (normalizedKey.endsWith('.xml') || normalizedKey.endsWith('.txt') || normalizedKey.endsWith('.scl') || normalizedKey.endsWith('.fermatap') || normalizedKey.endsWith('.fermatax') || normalizedKey.endsWith('.html') ) {
            addUsedFile('xml', res.resolvedPath); // Track the exact resolved file path
        }
    }
    return res.value;
}

// --- Element Reference Data Management ---
export function setElementReferenceData(data) {
    if (typeof data === 'object' && data !== null) {
        elementReferenceData = Array.isArray(data.elements) ? data.elements : [];
        commonAttributes = typeof data.commonAttributes === 'object' && data.commonAttributes !== null ? data.commonAttributes : {};
        const defaultAttrCats = ['Layout & Position', 'Value & Parameter', 'Appearance & Style', 'Text & Font', 'Interaction & Behavior', 'Timing & Mode', 'Structure & System', 'Other'];
        const defaultElemCats = ['Containers & Layout', 'Buttons & Toggles', 'Knobs & Sliders', 'Menus & Options', 'Text & Display', 'Graphics & Shapes', 'Complex Editors & Views', 'Overlays', 'Definitions & Structure', 'Other'];
        attributeCategories = Array.isArray(data.attributeCategories) && data.attributeCategories.length > 0
            ? [...new Set([...defaultAttrCats, ...data.attributeCategories])]
            : defaultAttrCats;
        elementCategories = Array.isArray(data.elementCategories) && data.elementCategories.length > 0
            ? [...new Set([...defaultElemCats, ...data.elementCategories])]
            : defaultElemCats;
    } else {
        elementReferenceData = [];
        commonAttributes = {};
        attributeCategories = ['Layout & Position', 'Value & Parameter', 'Appearance & Style', 'Text & Font', 'Interaction & Behavior', 'Timing & Mode', 'Structure & System', 'Other'];
        elementCategories = ['Containers & Layout', 'Buttons & Toggles', 'Knobs & Sliders', 'Menus & Options', 'Text & Display', 'Graphics & Shapes', 'Complex Editors & Views', 'Overlays', 'Definitions & Structure', 'Other'];
    }
}
export function getElementReferenceData() { return [...elementReferenceData]; }
export function getCommonAttributes() { return {...commonAttributes}; }
export function getAttributeCategories() { return [...attributeCategories]; }
export function getElementCategories() { return [...elementCategories]; }

// --- Parameter Reference Data ---
export function setParamReferenceData(data) {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        paramReferenceData = { ...data };
    } else {
        paramReferenceData = {};
    }
}
export function getParamReferenceData() { return {...paramReferenceData}; }

export function findParamDescription(paramID) {
    const allParamData = getParamReferenceData();
    if (!allParamData || Object.keys(allParamData).length === 0) {
        return `Param ID '${paramID}' (Param Data not loaded/empty).`;
    }
    const searchID = String(paramID).trim();
    for (const categoryName in allParamData) {
        if (Array.isArray(allParamData[categoryName])) {
            const paramsInCategory = allParamData[categoryName];
            for (const param of paramsInCategory) {
                if (param && String(param.paramID).trim() === searchID) {
                    return param.description || param.name || `Param ID: ${paramID}`;
                }
            }
        }
    }
    return `Unknown Param ID: ${paramID}`;
}

export function getLocalizedString(str, key = '') {
    if (str === undefined || str === null) {
        return '';
    }
    if (typeof str !== 'string') {
        return String(str);
    }
    return str;
}

// --- XML Editor Instance Management ---
function generateEditorInstanceId(filePath) {
    const numericId = nextEditorInstanceNumericId++;
    const pathPart = normalizePath(filePath).replace(/[^a-zA-Z0-9_]/g, '_');
    return `editorInstance_${pathPart}_${numericId}`;
}
export function createEditorInstance(filePath, content) {
    const instanceId = generateEditorInstanceId(filePath);
    const currentHighestZ = getHighestZIndexForEditors();
    const newZIndex = (editorInstances.size === 0) ? baseEditorZIndex : currentHighestZ + 10;
    const instanceState = {
        uniqueId: instanceId, filePath: normalizePath(filePath), originalContent: content, currentContent: content,
        modalElement: null, isActive: false, zIndex: newZIndex,
    };
    editorInstances.set(instanceId, instanceState);
    return instanceId;
}
export function getEditorInstance(instanceId) { return editorInstances.get(instanceId); }
export function getEditorInstanceByPath(filePath) {
    const normalized = normalizePath(filePath);
    for (const instance of editorInstances.values()) { if (instance.filePath === normalized) return instance; }
    return null;
}
export function isEditorOpen(filePath) { return !!getEditorInstanceByPath(filePath); }
export function updateEditorInstance(instanceId, updates) {
    const instance = editorInstances.get(instanceId);
    if (instance) {
        if (updates.filePath) updates.filePath = normalizePath(updates.filePath);
        editorInstances.set(instanceId, { ...instance, ...updates });
    }
}
export function removeEditorInstance(instanceId) {
    const deleted = editorInstances.delete(instanceId);
    if (deleted && activeEditorInstanceId === instanceId) {
        activeEditorInstanceId = null;
        const remainingInstances = Array.from(editorInstances.values());
        if (remainingInstances.length > 0) {
            remainingInstances.sort((a, b) => b.zIndex - a.zIndex);
            setActiveEditorInstance(remainingInstances[0].uniqueId);
        }
    }
    return deleted;
}
export function getAllEditorInstances() { return editorInstances; }
export function getHighestZIndexForEditors() {
    let maxZ = baseEditorZIndex - 10;
    if (editorInstances.size === 0) return maxZ;
    editorInstances.forEach(instance => { if (instance.zIndex > maxZ) maxZ = instance.zIndex; });
    return maxZ;
}
export function setActiveEditorInstance(instanceId) {
    if (!editorInstances.has(instanceId)) {
        if (activeEditorInstanceId === instanceId) activeEditorInstanceId = null;
        return;
    }
    if (activeEditorInstanceId && activeEditorInstanceId !== instanceId) {
        const oldActive = editorInstances.get(activeEditorInstanceId);
        if (oldActive) updateEditorInstance(activeEditorInstanceId, { isActive: false });
        if (oldActive?.modalElement) oldActive.modalElement.classList.remove('active-editor-modal');
    }
    const newActive = editorInstances.get(instanceId);
    if (newActive) {
        const currentHighestZ = getHighestZIndexForEditors();
        const newZIndex = (newActive.zIndex < currentHighestZ && editorInstances.size > 1) ? currentHighestZ + 10 : newActive.zIndex;
        updateEditorInstance(instanceId, { isActive: true, zIndex: newZIndex });
        if (newActive.modalElement) {
            newActive.modalElement.style.zIndex = newZIndex.toString();
            newActive.modalElement.classList.add('active-editor-modal');
        }
        activeEditorInstanceId = instanceId;
    } else {
        activeEditorInstanceId = null;
    }
}
export function getActiveEditorInstanceId() { return activeEditorInstanceId; }

// --- Zoom Level ---
export function getCurrentZoomLevel() { return currentZoomLevel; }
export function setCurrentZoomLevel(level) { currentZoomLevel = Math.max(0.1, Math.min(level, 10)); }

// --- Undo / Redo History ---
export function pushHistoryState(path, xmlContent) {
    if (isUndoRedoExecuting || !path || xmlContent === undefined) return;
    const last = undoStack[undoStack.length - 1];
    if (!last || last.path !== path || last.content !== xmlContent) {
        undoStack.push({ path, content: xmlContent });
        if (undoStack.length > 50) undoStack.shift();
        redoStack = [];
        document.dispatchEvent(new Event('historyChanged'));
    }
}

export function canUndo() { return undoStack.length > 0; }
export function canRedo() { return redoStack.length > 0; }

export function peekUndoState() { return undoStack.length > 0 ? undoStack[undoStack.length - 1] : null; }
export function peekRedoState() { return redoStack.length > 0 ? redoStack[redoStack.length - 1] : null; }

export function popUndoState(currentFallbackContent) {
    if (undoStack.length === 0) return null;
    const state = undoStack.pop();
    if (currentFallbackContent !== undefined) {
         redoStack.push({ path: state.path, content: currentFallbackContent });
    }
    document.dispatchEvent(new Event('historyChanged'));
    return state;
}

export function popRedoState(currentFallbackContent) {
    if (redoStack.length === 0) return null;
    const state = redoStack.pop();
    if (currentFallbackContent !== undefined) {
         undoStack.push({ path: state.path, content: currentFallbackContent });
    }
    document.dispatchEvent(new Event('historyChanged'));
    return state;
}

export function setIsUndoRedoExecuting(isExecuting) {
    isUndoRedoExecuting = !!isExecuting;
}

export function clearHistory() {
    undoStack = [];
    redoStack = [];
    document.dispatchEvent(new Event('historyChanged'));
}

// --- Utility ---
function revokeBlobUrls(map) { map.forEach(url => { try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ } }); map.clear(); }
export function clearUsedFiles() { usedXmlFiles.clear(); usedSvgFiles.clear(); usedFontFiles.clear(); }

export function clearAllState() {
    revokeBlobUrls(imageBlobUrls); revokeBlobUrls(fontBlobUrls); fileMap.clear(); fontMap.clear();
    stylesMap = {}; xmlMacros.clear(); detectedSkinInfo = []; currentSkinRoot = ''; defaultSkinRoot = '';
    mainGuiXmlPath = 'ui.xml';
    baseGuiWidth = 1024; baseGuiHeight = 630; globalGuiDefaults = {}; productName = 'Unknown Product';
    productVendor = 'Unknown Vendor'; clearUsedFiles(); activeFilePath = null;

    isMouseButtonDown = false; isSidebarCollapsed = false; isConsoleVisible = false; clearConsoleLog();
    useDefaultBackgroundColor = true; customBackgroundColor = '#4B5563'; skinDefaultBackgroundColor = null;
    showGridLines = false;

    debugEnabled = false;
    simulateSplashOverlay = false;
    guiSettingsXmlParsedForNames = false;
    currentZoomLevel = 1;
    isXmlEditorDirty = false;

    visibilityStates = {}; clearExpandableViewContainers(); clearScrollViewStates(); clearAllElementStates();
    clearHistory();

    editorInstances.clear(); activeEditorInstanceId = null; nextEditorInstanceNumericId = 1;

    elementReferenceData = [];
    commonAttributes = {};
    attributeCategories = ['Layout & Position', 'Value & Parameter', 'Appearance & Style', 'Text & Font', 'Interaction & Behavior', 'Timing & Mode', 'Structure & System', 'Other'];
    elementCategories = ['Containers & Layout', 'Buttons & Toggles', 'Knobs & Sliders', 'Menus & Options', 'Text & Display', 'Graphics & Shapes', 'Complex Editors & Views', 'Overlays', 'Definitions & Structure', 'Other'];
    paramReferenceData = {};

    if (window.visibilityController && typeof window.visibilityController.clearRegisteredContainers === 'function') {
         window.visibilityController.clearRegisteredContainers();
    }
    console.log("[State] All application state cleared.");
}