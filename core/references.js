// File: cs/references.js
/**
 * references.js
 * Handles loading, accessing, and managing reference data for XML elements, attributes,
 * AND now also handles Parameter reference data from param-data.json.
 * This version includes detailed logging for data loading.
 */
import * as State from './state.js'; 
import { showToast, logError, getExportParamRefBtn, getExportReferenceBtn } from './domUtils.js';

// --- Module State ---
let elementReferenceDataInternalCache = { globalAttributes: {}, elements: [] }; // Internal cache for this module
let globalAttributesDataInternalCache = {}; // Separate cache for global/common attributes
let elementDataLoaded = false;
let elementReferenceDataChanged = false;
export const ELEMENT_PLACEHOLDER_TEXT = "No element reference data loaded. Click 'Import JSON' in the Reference Modal.";

let paramReferenceDataInternalCache = {}; // Internal cache for param data
let paramDataLoaded = false;
let paramDataChanged = false;
export const PARAM_PLACEHOLDER_TEXT = "No parameter reference data loaded. Attempting load on startup or use Import.";

/** Attempts to load ELEMENT reference data from ./data/reference-data.json on startup */
export async function loadInitialElementReferenceData() {
    console.log("[SYNC References DEBUG] === Attempting to load initial ELEMENT reference data from ./data/reference-data.json ===");
    elementReferenceDataChanged = false;
    setElementUnsavedChanges(false); 

    try {
        const response = await fetch('./data/reference-data.json');
        console.log(`[SYNC References DEBUG] Fetch response status for reference-data.json: ${response.status}`);
        if (!response.ok) {
            if (response.status === 404) {
                console.warn("[SYNC References DEBUG] reference-data.json NOT FOUND (404). Using default empty data structure.");
                showToast("Element reference data (reference-data.json) not found. Using default.", "warn", 4000);
                setElementReferenceData([], {}); // Update internal module cache
                State.setElementReferenceData({ elements: [], commonAttributes: {}, attributeCategories: State.getAttributeCategories(), elementCategories: State.getElementCategories() });
                elementDataLoaded = true;
                document.dispatchEvent(new CustomEvent('referenceDataUpdated', { detail: { success: false, error: 'File not found', source: 'initialLoad' } }));
                return false;
            } else {
                throw new Error(`HTTP error! status: ${response.status} while fetching ./reference-data.json`);
            }
        }
        const jsonData = await response.json(); // jsonData is the full parsed object from reference-data.json
        // console.log("[SYNC References DEBUG] Raw parsed data from reference-data.json:", JSON.stringify(jsonData, null, 2).substring(0, 1000) + "...");

        if (!jsonData || typeof jsonData !== 'object' || !jsonData.elements || !Array.isArray(jsonData.elements)) {
            const errorMsg = "Invalid element JSON format. Expected 'elements' (array) key. 'globalAttributes' (object) is optional.";
            console.error(`[SYNC References DEBUG] ${errorMsg}`, jsonData);
            throw new Error(errorMsg);
        }

        const elementsToSet = jsonData.elements;
        const globalAttrsToSet = jsonData.globalAttributes || {}; // Default to empty if missing
        const attributeCategoriesFromFile = Array.isArray(jsonData.attributeCategories) ? jsonData.attributeCategories : [];
        const elementCategoriesFromFile = Array.isArray(jsonData.elementCategories) ? jsonData.elementCategories : [];
        
        setElementReferenceData(elementsToSet, globalAttrsToSet); // Updates internal module caches (elementReferenceDataInternalCache, globalAttributesDataInternalCache)

        const stateUpdateObject = {
            elements: elementsToSet,
            commonAttributes: globalAttrsToSet,
            attributeCategories: attributeCategoriesFromFile,
            elementCategories: elementCategoriesFromFile
        };
        // console.log("[SYNC References DEBUG] Object being sent to State.setElementReferenceData:", JSON.stringify(stateUpdateObject, null, 2).substring(0,500) + "...");
        State.setElementReferenceData(stateUpdateObject); // <<<<<<< UPDATE GLOBAL STATE HERE

        const currentDataInState = State.getElementReferenceData(); // Get it back from State to verify
        console.log(`[SYNC References DEBUG] State check immediately after set in references.js: Number of elements in state: ${currentDataInState.length}`);
        if (currentDataInState.length > 0) {
            // console.log("[SYNC References DEBUG] State check: First element now in state:", JSON.stringify(currentDataInState[0]));
        }
        
        console.log("[SYNC References DEBUG] Successfully loaded and processed reference-data.json. Dispatching 'referenceDataUpdated'.");
        showToast("Element reference data loaded.", "info", 2000);
        document.dispatchEvent(new CustomEvent('referenceDataUpdated', { detail: { success: true, source: 'initialLoad' } }));
        return true;
    } catch (error) {
        logError("[SYNC References DEBUG] Error loading initial reference-data.json", error);
        showToast(`Error loading element reference data: ${error.message}`, 'error');
        setElementReferenceData([], {}); // Reset internal caches
        State.setElementReferenceData({ elements: [], commonAttributes: {}, attributeCategories: State.getAttributeCategories(), elementCategories: State.getElementCategories() });
        elementDataLoaded = true;
        document.dispatchEvent(new CustomEvent('referenceDataUpdated', { detail: { success: false, error: error.message, source: 'initialLoadError' } }));
        return false;
    }
}

/** Attempts to load PARAMETER reference data from ./data/param-data.json on startup */
export async function loadInitialParamReferenceData() {
    console.log("[SYNC References DEBUG] === Attempting to load initial PARAMETER reference data from ./data/param-data.json ===");
    paramDataLoaded = false;
    setParamDataChanged(false);
    try {
        const response = await fetch('./data/param-data.json');
        // console.log(`[SYNC References DEBUG] Fetch response status for param-data.json: ${response.status}`);
        if (!response.ok) {
            if (response.status === 404) {
                console.warn("[SYNC References DEBUG] param-data.json NOT FOUND (404). Using default empty data.");
                showToast("Parameter reference data (param-data.json) not found.", "info", 4000);
                setParamReferenceData({}); // Update internal
                State.setParamReferenceData({}); // Update global
                paramDataLoaded = true;
                document.dispatchEvent(new CustomEvent('paramReferenceDataUpdated', { detail: { success: false, error: 'File not found', source: 'initialLoad' } }));
                return false;
            } else { throw new Error(`HTTP error! status: ${response.status} for param-data.json`); }
        }
        const jsonData = await response.json(); // jsonData is the full parsed object
        // console.log("[SYNC References DEBUG] Raw parsed data from param-data.json:", JSON.stringify(jsonData, null, 2).substring(0,1000) + "...");

        if (!jsonData || typeof jsonData !== 'object' || Array.isArray(jsonData)) { // Expect an object of categories
            throw new Error("Invalid param JSON format. Expected an object where keys are category names and values are arrays of param objects.");
        }
        // Additional validation for inner structure can be added here if necessary
        
        setParamReferenceData(jsonData); // Updates internal paramReferenceDataInternalCache
        State.setParamReferenceData(jsonData); // <<<<<<< UPDATE GLOBAL STATE HERE

        const currentParamDataInState = State.getParamReferenceData();
        console.log(`[SYNC References DEBUG] State check for params: Categories loaded: ${Object.keys(currentParamDataInState).length}`);

        console.log("[SYNC References DEBUG] Successfully loaded param-data.json. Dispatching 'paramReferenceDataUpdated'.");
        showToast("Parameter reference data loaded.", "info", 2000);
        document.dispatchEvent(new CustomEvent('paramReferenceDataUpdated', { detail: { success: true, source: 'initialLoad' } }));
        return true;
    } catch (error) {
        logError("[SYNC References DEBUG] Error loading initial param-data.json", error);
        showToast(`Error loading parameter reference data: ${error.message}`, 'error');
        setParamReferenceData({}); // Reset internal
        State.setParamReferenceData({}); // Reset global
        paramDataLoaded = true;
        document.dispatchEvent(new CustomEvent('paramReferenceDataUpdated', { detail: { success: false, error: error.message, source: 'initialLoadError' } }));
        return false;
    }
}

/** Sets the internal ELEMENT reference data cache */
export function setElementReferenceData(elementsArray, globalAttrs) {
    try {
        if (!Array.isArray(elementsArray)) { throw new Error("Invalid 'elements' structure. Expected an array."); }
        if (typeof globalAttrs !== 'object' || globalAttrs === null || Array.isArray(globalAttrs)) { throw new Error("Invalid 'globalAttributes' structure. Expected an object."); }
        
        elementReferenceDataInternalCache = { // Update the module's internal cache
            elements: elementsArray || [],
            globalAttributes: globalAttrs || {}
        };
        globalAttributesDataInternalCache = elementReferenceDataInternalCache.globalAttributes || {};
        elementDataLoaded = true; 
        setElementUnsavedChanges(false);
        return true;
    } catch (error) {
        logError("Error setting internal element reference data cache", error);
        elementReferenceDataInternalCache = { globalAttributes: {}, elements: [] }; 
        globalAttributesDataInternalCache = {}; 
        elementDataLoaded = false; 
        setElementUnsavedChanges(false); return false;
    }
}

/** Sets the internal PARAMETER reference data cache */
export function setParamReferenceData(paramDataAsObjectOfCategories) {
    try {
        if (!paramDataAsObjectOfCategories || typeof paramDataAsObjectOfCategories !== 'object' || Array.isArray(paramDataAsObjectOfCategories)) {
             throw new Error("Invalid param data structure for internal cache. Expected an object of categories.");
        }
        paramReferenceDataInternalCache = paramDataAsObjectOfCategories || {}; // Update module's internal cache
        paramDataLoaded = true;
        setParamDataChanged(false);
        return true;
    } catch (error) {
        logError("Error setting internal parameter reference data cache", error);
        paramReferenceDataInternalCache = {}; 
        paramDataLoaded = false; 
        setParamDataChanged(false); return false;
    }
}

// --- Getters for module's internal cache (primarily for UI population within this module/modal) ---
export function getElementReferenceData() { return elementReferenceDataInternalCache.elements || []; }
export function getParamReferenceData() { return paramReferenceDataInternalCache || {}; }
export function getCommonAttributes() { return globalAttributesDataInternalCache || {}; }

// --- Status checkers ---
export function hasLoadedElementReferenceData() { return elementDataLoaded; }
export function hasLoadedParamReferenceData() { return paramDataLoaded; }
export function hasUnsavedParamChanges() { return paramDataChanged; }
export function hasUnsavedElementChanges() { return elementReferenceDataChanged; }

export function setElementUnsavedChanges(changed) {
    const hasChanged = !!changed; if (elementReferenceDataChanged === hasChanged) return;
    elementReferenceDataChanged = hasChanged;
    try {
        const exportBtn = getExportReferenceBtn();
        if (exportBtn) {
            exportBtn.classList.toggle('unsaved-changes', elementReferenceDataChanged);
            exportBtn.title = elementReferenceDataChanged ? "Export Element JSON (Unsaved Changes)" : "Export current element reference data to JSON file";
        }
    } catch(e) { console.error("[references.js] Error updating element export button style:", e); }
}

export function setParamDataChanged(changed) {
    const hasChanged = !!changed; if (paramDataChanged === hasChanged) return;
    paramDataChanged = hasChanged;
    try {
        const exportBtn = getExportParamRefBtn();
        if (exportBtn) {
            exportBtn.classList.toggle('unsaved-changes', paramDataChanged);
            exportBtn.title = paramDataChanged ? "Export Param JSON (Unsaved Changes)" : "Export current parameter reference data to JSON file";
        }
    } catch(e) { console.error("[references.js] Error updating param export button style:", e); }
}

// --- CRUD operations for Element Reference Data (modify internal cache and then global state) ---
export function addOrUpdateReferenceElement(elementName, data) {
    if (!elementName || !data || typeof data !== 'object') return false;
    try {
        const elementsArray = elementReferenceDataInternalCache.elements || [];
        const elementIndex = elementsArray.findIndex(el => el.element === elementName);
        const newElementData = {
             element: elementName, description: data.description || '', category: data.category || 'Other',
             usesCommonAttributes: data.usesCommonAttributes !== undefined ? data.usesCommonAttributes : true,
             attributes: data.attributes || {}, supported: data.supported !== undefined ? data.supported : false,
             notes: data.notes || ''
         };
        if (elementIndex > -1) { elementsArray[elementIndex] = newElementData; } else { elementsArray.push(newElementData); }
        elementReferenceDataInternalCache.elements = elementsArray; 
        setElementUnsavedChanges(true);
        // Update global state
        State.setElementReferenceData({ 
            elements: elementReferenceDataInternalCache.elements, 
            commonAttributes: globalAttributesDataInternalCache,
            attributeCategories: State.getAttributeCategories(), // Preserve existing categories from state
            elementCategories: State.getElementCategories()   // Preserve existing categories from state
        });
        document.dispatchEvent(new CustomEvent('referenceDataUpdated', { detail: { success: true, source: 'manualUpdate' } }));
        return true;
    } catch (e) { logError(`Error adding/updating element ${elementName}`, e); return false; }
}

export function deleteReferenceElement(elementName) {
    if (!elementName) return false;
    try {
        const elementsArray = elementReferenceDataInternalCache.elements || [];
        const initialLength = elementsArray.length;
        elementReferenceDataInternalCache.elements = elementsArray.filter(el => el.element !== elementName);
        const deleted = elementReferenceDataInternalCache.elements.length < initialLength;
        if (deleted) {
            setElementUnsavedChanges(true);
            State.setElementReferenceData({ 
                elements: elementReferenceDataInternalCache.elements, 
                commonAttributes: globalAttributesDataInternalCache,
                attributeCategories: State.getAttributeCategories(),
                elementCategories: State.getElementCategories()
            });
            document.dispatchEvent(new CustomEvent('referenceDataUpdated', { detail: { success: true, source: 'manualDelete' } }));
        }
        return deleted;
    } catch (e) { logError(`Error deleting element ${elementName}`, e); return false; }
}

export function updateElementReferenceDescription(itemType, itemName, newDescription, elementContext = null) {
     if (!itemType || !itemName || typeof newDescription !== 'string') return false;
     let changed = false;
     try {
        if (itemType === 'element') {
            const elementObj = (elementReferenceDataInternalCache.elements || []).find(el => el.element === itemName);
            if (!elementObj) return false;
            if (elementObj.description !== newDescription) { elementObj.description = newDescription; changed = true; }
        } else if (itemType === 'common-attribute') {
            if (!globalAttributesDataInternalCache[itemName]) globalAttributesDataInternalCache[itemName] = {}; 
             if (globalAttributesDataInternalCache[itemName].description !== newDescription) { globalAttributesDataInternalCache[itemName].description = newDescription; changed = true; }
        } else if (itemType === 'specific-attribute') {
            if (!elementContext) return false;
            const elementObj = (elementReferenceDataInternalCache.elements || []).find(el => el.element === elementContext);
            if (!elementObj) return false;
            if (!elementObj.attributes) elementObj.attributes = {};
            if (!elementObj.attributes[itemName]) elementObj.attributes[itemName] = {};
            if (elementObj.attributes[itemName].description !== newDescription) { elementObj.attributes[itemName].description = newDescription; changed = true; }
        } else { return false; }
        if (changed) {
            setElementUnsavedChanges(true);
            State.setElementReferenceData({ 
                elements: elementReferenceDataInternalCache.elements, 
                commonAttributes: globalAttributesDataInternalCache,
                attributeCategories: State.getAttributeCategories(),
                elementCategories: State.getElementCategories()
            });
            document.dispatchEvent(new CustomEvent('referenceDataUpdated', { detail: { success: true, source: 'manualDescriptionUpdate' } }));
        }
        return true;
     } catch (e) { logError(`Error updating element ref description for ${itemType} ${itemName}`, e); return false; }
}

export function updateElementSupportedStatus(elementName, isSupported) {
    if (!elementName) return false;
    const supportedBool = !!isSupported;
    try {
        const elementObj = (elementReferenceDataInternalCache.elements || []).find(el => el.element === elementName);
        if (elementObj) {
            if (elementObj.supported !== supportedBool) { 
                elementObj.supported = supportedBool; 
                setElementUnsavedChanges(true); 
                State.setElementReferenceData({ 
                    elements: elementReferenceDataInternalCache.elements, 
                    commonAttributes: globalAttributesDataInternalCache,
                    attributeCategories: State.getAttributeCategories(),
                    elementCategories: State.getElementCategories()
                });
                document.dispatchEvent(new CustomEvent('referenceDataUpdated', { detail: { success: true, source: 'manualSupportUpdate' } }));
            }
            return true;
        }
        return false;
    } catch(e) { logError(`Error updating supported status for element ${elementName}`, e); return false; }
}

// --- CRUD operations for Parameter Reference Data (modify internal cache and then global state) ---
export function getParamCategories() { return Object.keys(paramReferenceDataInternalCache || {}).sort(); }
export function getParamsByCategory(category) { return (paramReferenceDataInternalCache && paramReferenceDataInternalCache[category]) ? [...paramReferenceDataInternalCache[category]] : []; }

export function addParamCategory(categoryName) {
    if (!categoryName || typeof categoryName !== 'string' || (paramReferenceDataInternalCache && paramReferenceDataInternalCache[categoryName])) {
        logError(`Cannot add duplicate or invalid param category: ${categoryName}`); return false;
    }
    if (!paramReferenceDataInternalCache) paramReferenceDataInternalCache = {};
    paramReferenceDataInternalCache[categoryName] = [];
    setParamDataChanged(true);
    State.setParamReferenceData(paramReferenceDataInternalCache); 
    document.dispatchEvent(new CustomEvent('paramReferenceDataUpdated'));
    return true;
}

export function renameParamCategory(oldName, newName) {
    if (!oldName || !newName || typeof oldName !== 'string' || typeof newName !== 'string' || oldName === newName || !(paramReferenceDataInternalCache && paramReferenceDataInternalCache[oldName]) || (paramReferenceDataInternalCache && paramReferenceDataInternalCache[newName])) {
        logError(`Cannot rename param category: Invalid names, old name not found, or new name exists. Old: ${oldName}, New: ${newName}`); return false;
    }
    paramReferenceDataInternalCache[newName] = paramReferenceDataInternalCache[oldName];
    delete paramReferenceDataInternalCache[oldName];
    setParamDataChanged(true);
    State.setParamReferenceData(paramReferenceDataInternalCache);
    document.dispatchEvent(new CustomEvent('paramReferenceDataUpdated'));
    return true;
}

export function removeParamCategory(categoryName) {
    if (!categoryName || !(paramReferenceDataInternalCache && paramReferenceDataInternalCache[categoryName])) {
        logError(`Cannot remove non-existent param category: ${categoryName}`); return false;
    }
    delete paramReferenceDataInternalCache[categoryName];
    setParamDataChanged(true);
    State.setParamReferenceData(paramReferenceDataInternalCache);
    document.dispatchEvent(new CustomEvent('paramReferenceDataUpdated'));
    return true;
}

export function addOrUpdateParam(categoryName, paramData) {
    if (!categoryName || !(paramReferenceDataInternalCache && paramReferenceDataInternalCache[categoryName]) || !paramData || typeof paramData !== 'object' || !paramData.paramID) {
         logError(`Cannot add/update param: Invalid category, data, or missing paramID. Category: ${categoryName}`, paramData); return false;
    }
    const category = paramReferenceDataInternalCache[categoryName];
    const existingIndex = category.findIndex(p => String(p.paramID) === String(paramData.paramID).trim());
    const dataToStore = {
        paramID: String(paramData.paramID).trim(),
        name: String(paramData.name || '').trim(),
        description: String(paramData.description || '').trim()
    };
    let changed = false;
    if (existingIndex > -1) {
        if (category[existingIndex].name !== dataToStore.name || category[existingIndex].description !== dataToStore.description) {
            category[existingIndex] = dataToStore; changed = true;
        }
    } else { category.push(dataToStore); changed = true; }
    if (changed) {
        category.sort((a,b) => String(a.paramID).localeCompare(String(b.paramID), undefined, {numeric:true, sensitivity:'base'}));
        setParamDataChanged(true);
        State.setParamReferenceData(paramReferenceDataInternalCache);
        document.dispatchEvent(new CustomEvent('paramReferenceDataUpdated'));
    }
    return true;
}

export function removeParam(categoryName, paramID) {
    if (!categoryName || !(paramReferenceDataInternalCache && paramReferenceDataInternalCache[categoryName]) || !paramID) {
        logError(`Cannot remove param: Invalid category or missing paramID. Category: ${categoryName}, ID: ${paramID}`); return false;
    }
    const paramIDStr = String(paramID);
    const category = paramReferenceDataInternalCache[categoryName];
    const initialLength = category.length;
    paramReferenceDataInternalCache[categoryName] = category.filter(p => String(p.paramID) !== paramIDStr);
    const removed = paramReferenceDataInternalCache[categoryName].length < initialLength;
    if (removed) {
        setParamDataChanged(true);
        State.setParamReferenceData(paramReferenceDataInternalCache);
        document.dispatchEvent(new CustomEvent('paramReferenceDataUpdated'));
    }
    return removed;
}