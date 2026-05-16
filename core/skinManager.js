/* File: cs/skinManager.js */
/**
 * skinManager.js
 * Manages skin detection, loading, switching, and related UI updates like logo.
 * MODIFIED: loadSkin to correctly handle missing variant gui.xml by falling back to default gui.xml content,
 * while keeping variant's root as asset loading context for findAsset.
 * MODIFIED: parseProductXmlFile to robustly set defaultMainGuiXmlPath and defaultSkinRoot in State.
 * MODIFIED: populateSkinSelector to better indicate skins with missing XMLs that will use fallback.
 * MODIFIED: ensureSkinNameMap to search for gui_settings.xml in current skin root, default skin root, and project root.
 */
import * as State from './state.js';
import {
    addConsoleLogEntry, getFileContent, getAssetBlobUrl, getDirectory, normalizePath,
    getDefaultSkinRoot, getDetectedSkinInfo, getCurrentSkinRoot, setActiveFilePath,
    setFontMap, setStyles,
    clearUsedFiles, setGlobalGuiDefaults, getProductName, getProductVendor, getFileMap,
    getImageBlobUrls, getGuiSettingsXmlParsedForNames, setGuiSettingsXmlParsedForNames,
    setDefaultMainGuiXmlPath, getDefaultMainGuiXmlPath // Import new state functions
} from './state.js';
import {
    logError, getSkinSelectorContainer, getSkinSelector, getDynamicStyles,
    getGuiContentWrapper, getStatusDiv, clearErrors, getProductLogoImg,
    getFileBrowserContainer, getPreviewAreaContainer, updateStatus
} from './domUtils.js';
import { buildGui } from './guiBuilder.js';
import { populateFileBrowser, highlightActiveFile } from '../managers/sidebarManager.js';
import { initializeAllContainerStates } from './visibilityController.js';

let skinNameMap = null;
let skinSelectorListenerAttached = false;

function ensureSkinNameMap() {
    if (skinNameMap !== null && skinNameMap.size > 0 && State.getGuiSettingsXmlParsedForNames()) {
        return;
    }
    skinNameMap = new Map(); // Reset
    State.setGuiSettingsXmlParsedForNames(false); // Assume failure until success

    let settingsContent;
    let foundPath = '';
    const pathsToTry = [];

    const currentRoot = State.getCurrentSkinRoot(); // Might be "" for root skins
    const defaultRoot = State.getDefaultSkinRoot(); // Might be "" for root default skin

    // Path 1: Current skin's directory's gui_settings.xml
    // Ensure currentRoot is a string before attempting to use it in path construction
    if (typeof currentRoot === 'string') {
        pathsToTry.push(normalizePath(currentRoot ? `${currentRoot}/gui_settings.xml` : 'gui_settings.xml'));
    }

    // Path 2: Default skin's directory's gui_settings.xml
    // Ensure defaultRoot is a string before attempting to use it
    if (typeof defaultRoot === 'string') {
        pathsToTry.push(normalizePath(defaultRoot ? `${defaultRoot}/gui_settings.xml` : 'gui_settings.xml'));
    }

    // Path 3: Absolute project root's gui_settings.xml
    pathsToTry.push(normalizePath('gui_settings.xml'));

    // Deduplicate paths (e.g., if currentRoot or defaultRoot is "" an explicit "" path is also added)
    // and attempt to load. Filter out any non-string paths that might have crept in if roots were not strings.
    const uniquePathsToTry = [...new Set(pathsToTry.filter(p => typeof p === 'string'))];

    addConsoleLogEntry(`[SM ensureSkinNameMap] Attempting to find gui_settings.xml. Search paths: ${JSON.stringify(uniquePathsToTry)}`, 'debug');

    for (const p of uniquePathsToTry) {
        settingsContent = getFileContent(p); // getFileContent is from state.js
        if (settingsContent) {
            foundPath = p;
            addConsoleLogEntry(`[SM ensureSkinNameMap] Found gui_settings.xml at: '${foundPath}'`, 'info');
            break; // Found it, stop searching
        } else {
            // Optional: Add a debug log for each failed attempt if needed, but can be noisy.
            // addConsoleLogEntry(`[SM ensureSkinNameMap] gui_settings.xml not found at: '${p}'`, 'debug');
        }
    }

    if (!settingsContent) {
        addConsoleLogEntry(`[SM ensureSkinNameMap] gui_settings.xml NOT FOUND after checking paths: ${uniquePathsToTry.join(', ')}. Skin names may be generic.`, 'warn');
        // skinNameMap remains empty, State.setGuiSettingsXmlParsedForNames remains false (already set)
        return;
    }

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(settingsContent, "application/xml");
        const parseError = doc.querySelector("parsererror");
        if (parseError) { throw new Error(`Parse error in ${foundPath || 'gui_settings.xml'}: ${parseError.textContent}`);} // Use foundPath in error
        const optionMenu = doc.querySelector('OptionMenu[param="DID_PRODUCT_DISPLAYSKINVARIANT"]');
        if (!optionMenu) {
            addConsoleLogEntry(`[SM ensureSkinNameMap] OptionMenu[param="DID_PRODUCT_DISPLAYSKINVARIANT"] not found in ${foundPath || 'gui_settings.xml'}.`, 'warn');
            State.setGuiSettingsXmlParsedForNames(false);
            return;
        }
        optionMenu.querySelectorAll('OptionItem').forEach(item => {
            const valueIndex = item.getAttribute('value');
            const name = item.getAttribute('name');
            if (valueIndex !== null && name) { skinNameMap.set(`_${valueIndex}`, name); }
        });
        State.setGuiSettingsXmlParsedForNames(true);
         addConsoleLogEntry(`[SM ensureSkinNameMap] Successfully parsed skin names from ${foundPath}.`, 'info');
    } catch (e) {
        logError(`Error parsing ${foundPath || 'gui_settings.xml'} for skin names`, e);
        State.setGuiSettingsXmlParsedForNames(false);
    }
}

export function detectSkins(productXmlPathArgument) {
    const normalizedProductXmlPath = normalizePath(productXmlPathArgument);
    console.log(`[SM] === detectSkins START (productXmlPath: ${normalizedProductXmlPath || 'N/A'}) ===`);
    State.setGuiSettingsXmlParsedForNames(false); // Reset before parsing
    skinNameMap = null; // Reset before parsing
    State.setDefaultMainGuiXmlPath(''); // Reset default paths
    State.setDefaultSkinRoot('');     // Reset default paths

    let detectedSkins = [];
    const fileMap = getFileMap();

    if (normalizedProductXmlPath && fileMap.has(normalizedProductXmlPath)) {
        const skinsFromProduct = parseProductXmlFile(normalizedProductXmlPath); // This will set default paths in State
        if (skinsFromProduct && skinsFromProduct.length > 0) {
            detectedSkins = skinsFromProduct;
        } else {
            addConsoleLogEntry(`Primary XML parsing ('${normalizedProductXmlPath}') returned no skins. Proceeding to fallback scan.`, 'warn');
        }
    } else {
        addConsoleLogEntry(`Product XML ('${normalizedProductXmlPath || 'N/A'}') not provided or not found in fileMap. Proceeding to fallback scan.`, 'warn');
    }

    if (detectedSkins.length === 0) {
        console.log("[SM] Starting fallback folder scan for skins (as primary detection yielded no skins)...");
        const potentialRoots = new Set(['']); // Always check root
        fileMap.forEach((_, filePath) => { const dir = getDirectory(filePath); if (dir) potentialRoots.add(dir); });

        let scannedSkins = [];
        Array.from(potentialRoots).sort().forEach((root, index) => { // Sort roots for some consistency
            const guiPath = root ? `${root}/gui.xml` : 'gui.xml';
            const normalizedGuiPath = normalizePath(guiPath);
            const mainXmlExists = fileMap.has(normalizedGuiPath);

            if (mainXmlExists || fileMap.has(normalizePath(root ? `${root}/styles.xml` : 'styles.xml'))) {
                scannedSkins.push({
                    root: root,
                    mainXmlFile: normalizedGuiPath,
                    id: `scan_${normalizePath(root).replace(/[^a-zA-Z0-9]/gi, '_') || 'rootscan'}_${mainXmlExists ? 'gui' : 'styles'}`,
                    xmlIndex: 1000 + index, // Use a high base index for scanned items
                    hasGuiXml: mainXmlExists
                });
            }
        });
        scannedSkins.sort((a, b) => {
            if (a.hasGuiXml && !b.hasGuiXml) return -1;
            if (!a.hasGuiXml && b.hasGuiXml) return 1;
            if (a.root === '') return -1; if (b.root === '') return 1;
            return a.root.localeCompare(b.root);
        });
        detectedSkins = scannedSkins;

        // If fallback scan found skins, and default paths weren't set by product.xml, set them now.
        if (detectedSkins.length > 0 && !State.getDefaultMainGuiXmlPath()) {
            const firstScannedWithGui = detectedSkins.find(s => s.hasGuiXml);
            if (firstScannedWithGui) {
                State.setDefaultMainGuiXmlPath(firstScannedWithGui.mainXmlFile);
                State.setDefaultSkinRoot(firstScannedWithGui.root);
            } else if (detectedSkins[0]) { // Fallback to first scanned even if its gui.xml is missing
                State.setDefaultMainGuiXmlPath(detectedSkins[0].mainXmlFile); // This path might not exist in fileMap
                State.setDefaultSkinRoot(detectedSkins[0].root);
                addConsoleLogEntry(`Fallback scan: Defaulting to first found skin '${detectedSkins[0].root}', but its gui.xml may be missing.`, "warn");
            }
        }
    }
    
    // Final check: if no default GUI XML path is set at all, and there are detected skins, try to pick one.
    if (!State.getDefaultMainGuiXmlPath() && detectedSkins.length > 0) {
        const firstSkinWithActualGuiFile = detectedSkins.find(s => s.hasGuiXml && State.getFileMap().has(s.mainXmlFile));
        if (firstSkinWithActualGuiFile) {
            State.setDefaultMainGuiXmlPath(firstSkinWithActualGuiFile.mainXmlFile);
            State.setDefaultSkinRoot(firstSkinWithActualGuiFile.root);
        } else if (detectedSkins[0]) { // Last resort
            State.setDefaultMainGuiXmlPath(detectedSkins[0].mainXmlFile); // This might be a path to a non-existent file
            State.setDefaultSkinRoot(detectedSkins[0].root);
        }
    }

    State.setDetectedSkinInfo(detectedSkins);
    console.log(`[SM] Final detected skins: ${detectedSkins.length}. Default Root: '${State.getDefaultSkinRoot()}'. Default Main XML: '${State.getDefaultMainGuiXmlPath()}'`);
    console.log("[SM] === detectSkins END ===");
}

export function updateProductLogo() {
    console.log(`[skinManager updateProductLogo] Function called.`);
    const logoImgEl = document.getElementById('product-logo-img');
    const logoContainer = document.getElementById('product-logo-container');

    if (!logoImgEl) {
        console.error("[skinManager updateProductLogo] CRITICAL: #product-logo-img DOM element NOT FOUND.");
        if (logoContainer) { logoContainer.textContent = 'Error: Logo img tag missing.'; logoContainer.classList.add('logo-placeholder-text'); logoContainer.style.display = 'flex'; }
        return;
    }
    if (!logoContainer) { console.error("[skinManager updateProductLogo] CRITICAL: #product-logo-container DOM element NOT FOUND."); logoImgEl.style.display = 'none'; return; }

    logoContainer.classList.remove('logo-placeholder-text');
    logoImgEl.src = ''; logoImgEl.style.display = 'none';

    const vendor = State.getProductVendor();
    const product = State.getProductName();
    // For logo, use currentSkinRoot (variant) then defaultSkinRoot (true default) for fallback
    const currentVariantRoot = State.getCurrentSkinRoot(); // This is the context of the skin being displayed
    const actualDefaultRoot = State.getDefaultSkinRoot(); // This is the root of the actual default skin

    let finalLogoPathAttempted = '';

    if (vendor && product && vendor !== 'Unknown Vendor' && product !== 'Unknown Product') {
        const productFolderPrefix = normalizePath(product);
        const logoBasename = "mst_logo.png";
        const nksRelativePath = `NKS/PAResources/image/${vendor}/${product}/${logoBasename}`;
        let pathForNksLogo = normalizePath(nksRelativePath);
        if (productFolderPrefix && !nksRelativePath.toLowerCase().startsWith(productFolderPrefix.toLowerCase())) {
             pathForNksLogo = normalizePath(`${productFolderPrefix}/${nksRelativePath}`);
        }
        finalLogoPathAttempted = pathForNksLogo;
        // getAssetBlobUrl will use findAsset, which checks currentVariantRoot, then actualDefaultRoot, then absolute
        const blobUrlNKS = State.getAssetBlobUrl(pathForNksLogo);
        if (blobUrlNKS) { logoImgEl.src = blobUrlNKS; logoImgEl.style.display = 'block'; logoContainer.style.display = 'flex'; return; }
    }
    const potentialLogoFilenames = [ 'logo.png', 'product_logo.png', 'Logo.png', 'Product_Logo.png', 'logo.svg', product ? `${product.toLowerCase().replace(/\s+/g, '')}_logo.png` : '', product ? `logo_${product.toLowerCase().replace(/\s+/g, '')}.png` : '', product ? `${product}_logo.png` : '' ].filter(Boolean);
    let foundBlobUrl = null;

    for (const filename of potentialLogoFilenames) {
        // findAsset (via getAssetBlobUrl) will try currentVariantRoot, then actualDefaultRoot, then absolute root.
        const blobUrl = State.getAssetBlobUrl(filename);
        if (blobUrl) { foundBlobUrl = blobUrl; finalLogoPathAttempted = filename; break; }
    }

    if (foundBlobUrl) { logoImgEl.src = foundBlobUrl; logoImgEl.style.display = 'block'; logoContainer.style.display = 'flex'; }
    else { logoImgEl.style.display = 'none'; logoContainer.style.display = 'flex'; logoContainer.classList.add('logo-placeholder-text'); logoContainer.textContent = `Logo not found.`; }
}

export function populateSkinSelector() {
    console.log("[SM populateSkinSelector] Populating skin selector...");
    const selector = getSkinSelector();
    const container = getSkinSelectorContainer();
    if (!selector || !container) { logError("Skin selector or its container not found in DOM."); return; }
    selector.innerHTML = '';
    ensureSkinNameMap(); // ensureSkinNameMap is called here

    const detectedSkins = getDetectedSkinInfo();
    const activeFileNormalized = normalizePath(State.getActiveFilePath());
    const defaultMainGuiXml = State.getDefaultMainGuiXmlPath();
    const defaultGuiExists = defaultMainGuiXml && State.getFileMap().has(defaultMainGuiXml);


    if (detectedSkins && detectedSkins.length > 0) {
        let hasSelection = false;
        detectedSkins.forEach(skin => {
            const option = document.createElement('option');
            option.value = skin.mainXmlFile; 

            let displayName = null;
            if (skin.xmlIndex !== undefined && skin.xmlIndex !== -1) { // Exclude special -1 index for default from this naming
                const settingsKey = `_${skin.xmlIndex}`;
                if (skinNameMap && skinNameMap.has(settingsKey)) {
                    displayName = skinNameMap.get(settingsKey);
                }
            }
            if (!displayName) {
                displayName = skin.root === "" ? "Default Skin" : skin.root.split('/').pop() || skin.root || "Unnamed Skin";
                 if(skin.mainXmlFile && skin.root && skin.mainXmlFile !== normalizePath(skin.root + '/gui.xml') && skin.mainXmlFile.startsWith(skin.root)) {
                    displayName += ` (${skin.mainXmlFile.substring(skin.root.length + 1)})`;
                 } else if (skin.mainXmlFile && !skin.root && skin.mainXmlFile !== "gui.xml"){
                    displayName = skin.mainXmlFile;
                 }
            }

            const mainXmlExistsForThisVariant = State.getFileMap().has(normalizePath(skin.mainXmlFile));
            if (!mainXmlExistsForThisVariant) {
                if (defaultGuiExists) {
                    displayName += " (uses default layout)";
                } else {
                    option.disabled = true;
                    displayName += " (GUI XML Missing!)";
                    console.warn(`[SM populateSkinSelector] Main XML '${skin.mainXmlFile}' for skin '${displayName}' AND default GUI XML are missing. Disabling option.`);
                }
            }
            option.textContent = displayName;

            if (normalizePath(skin.mainXmlFile) === activeFileNormalized && !option.disabled) {
                option.selected = true;
                hasSelection = true;
            }
            selector.appendChild(option);
        });

        if (!hasSelection && selector.options.length > 0) {
            const firstEnabledOption = Array.from(selector.options).find(opt => !opt.disabled);
            if (firstEnabledOption) {
                firstEnabledOption.selected = true;
                // Initial load already happened; this just ensures a valid selection if previous was disabled.
                // If an immediate load is desired upon this auto-selection, it would go here.
                // However, loadSkin is usually called after detectSkins or by user change.
            }
        }
        container.style.display = 'block';

        if (!skinSelectorListenerAttached) {
            selector.addEventListener('change', (event) => {
                const newMainXmlFileToLoad = event.target.value;
                loadSkin(newMainXmlFileToLoad)
                    .catch(err => logError(`Error loading skin from selector for ${newMainXmlFileToLoad}`, err));
            });
            skinSelectorListenerAttached = true;
        }
    } else {
        container.style.display = 'none';
        const option = document.createElement('option'); option.textContent = "No skins available"; option.disabled = true; selector.appendChild(option);
    }
}

export function loadSkin(mainXmlFilePath, directXmlContent = null) {
    return new Promise((resolve, reject) => {
        const normalizedTargetXmlPath = normalizePath(mainXmlFilePath);
        const variantSkinRootDir = getDirectory(normalizedTargetXmlPath);

        console.log(`[SM loadSkin] === START === Target Variant XML: '${normalizedTargetXmlPath}', Variant Root: '${variantSkinRootDir}'`);

        if (!normalizedTargetXmlPath) {
            const errorMsg = "loadSkin called with invalid or empty mainXmlFilePath";
            logError(errorMsg, { mainXmlFilePath }); reject(new Error(errorMsg)); return;
        }

        State.setCurrentSkinRoot(variantSkinRootDir); // Context for asset loading is the variant's root
        const actualDefaultSkinRoot = State.getDefaultSkinRoot(); // Get the true default skin's root for fallback
        console.log(`[SM loadSkin] Set CurrentSkinRoot (for assets): "${variantSkinRootDir}", DefaultSkinRoot (for assets fallback): "${actualDefaultSkinRoot}"`);

        let mainXmlContentToParse = directXmlContent;
        let loadedPathForGuiBuild = normalizedTargetXmlPath;
        let usedFallbackGuiXml = false;

        if (mainXmlContentToParse === null) {
            mainXmlContentToParse = getFileContent(normalizedTargetXmlPath); // Uses findAsset, which should try variant then default then direct
        }

        if (mainXmlContentToParse === undefined) {
            console.warn(`[SM loadSkin] Main XML for variant '${normalizedTargetXmlPath}' not found directly. Attempting fallback to default GUI XML.`);
            addConsoleLogEntry(`GUI XML for '${normalizedTargetXmlPath}' not found. Attempting default.`, 'warn');
            
            const defaultGuiPath = State.getDefaultMainGuiXmlPath();
            if (defaultGuiPath && defaultGuiPath !== normalizedTargetXmlPath) { // Ensure default is different and exists
                mainXmlContentToParse = getFileContent(defaultGuiPath); // This uses findAsset correctly for the default path
                if (mainXmlContentToParse !== undefined) {
                    loadedPathForGuiBuild = defaultGuiPath; // GUI is built from default's content
                    usedFallbackGuiXml = true;
                    addConsoleLogEntry(`Using default GUI XML: '${defaultGuiPath}' for skin context '${variantSkinRootDir}'.`, 'info');
                    console.log(`[SM loadSkin] Successfully used default GUI XML content from: '${defaultGuiPath}' (Context for assets remains: '${variantSkinRootDir}')`);
                } else {
                    const errorMsg = `Main XML for variant '${normalizedTargetXmlPath}' AND default GUI XML '${defaultGuiPath}' not found. Cannot load GUI.`;
                    logError(errorMsg); reject(new Error(errorMsg)); return;
                }
            } else {
                const errorMsg = `Main XML for variant '${normalizedTargetXmlPath}' not found, and no valid default GUI XML path is set or it's the same path. Cannot load GUI. Default path: ${defaultGuiPath || 'not set'}`;
                logError(errorMsg); reject(new Error(errorMsg)); return;
            }
        }

        setActiveFilePath(loadedPathForGuiBuild); // Active file is the one whose content is parsed for buildGui
        console.log(`[SM loadSkin] Active file path for GUI build set to: ${loadedPathForGuiBuild}`);

        setFontMap(new Map()); setStyles({}); clearUsedFiles(); setGlobalGuiDefaults({}); State.clearAllElementStates();
        if (typeof initializeAllContainerStates === 'function') initializeAllContainerStates();
        const dynamicStyles = getDynamicStyles(); if (dynamicStyles) dynamicStyles.innerHTML = '';
        const guiContentWrapper = getGuiContentWrapper(); if (guiContentWrapper) guiContentWrapper.innerHTML = '';
        clearErrors();
        const statusDiv = getStatusDiv(); if (statusDiv) statusDiv.textContent = `Building GUI from: ${loadedPathForGuiBuild}...`;

        try {
            console.log(`[SM loadSkin] Calling buildGui with content from '${loadedPathForGuiBuild}' (Asset context root: '${State.getCurrentSkinRoot()}')`);
            buildGui(mainXmlContentToParse, loadedPathForGuiBuild); 
            console.log("[SM loadSkin] Returned from buildGui.");
            updateProductLogo();
            requestAnimationFrame(() => {
                 populateFileBrowser();
                 highlightActiveFile(); 
                 populateSkinSelector(); 
                 const fileBrowserContainer = getFileBrowserContainer(); if (fileBrowserContainer) fileBrowserContainer.classList.add('loaded-visible');
                 const previewAreaContainer = getPreviewAreaContainer(); if (previewAreaContainer) previewAreaContainer.classList.add('loaded-visible');
                 const sidebarEl = document.getElementById('sidebar'); if (sidebarEl) sidebarEl.classList.remove('initial-condensed');
            });
            ensureSkinNameMap(); // ensureSkinNameMap is called here after buildGui potentially (and after state is set)
            const skinsInfo = getDetectedSkinInfo();
            const targetSkinInfo = skinsInfo.find(s => normalizePath(s.mainXmlFile) === normalizedTargetXmlPath) || skinsInfo.find(s => normalizePath(s.root) === variantSkinRootDir);
            let skinDisplayNameForStatus = variantSkinRootDir || "Unknown Skin";
            if (targetSkinInfo && targetSkinInfo.xmlIndex !== undefined && targetSkinInfo.xmlIndex !== -1) { // Check for -1 used by setup.xml default
                const settingsKey = `_${targetSkinInfo.xmlIndex}`;
                if (skinNameMap && skinNameMap.has(settingsKey)) {
                    skinDisplayNameForStatus = skinNameMap.get(settingsKey);
                }
            } else if (variantSkinRootDir === "" && State.getDefaultMainGuiXmlPath() === loadedPathForGuiBuild) {
                 skinDisplayNameForStatus = "Default (Root)";
            } else if (!targetSkinInfo && variantSkinRootDir){ // Fallback if no direct match in detectedSkins
                skinDisplayNameForStatus = variantSkinRootDir.split('/').pop() || variantSkinRootDir;
            }

            if (usedFallbackGuiXml) {
                skinDisplayNameForStatus += " (using default layout)";
            }

            if(statusDiv) updateStatus(`Loaded: ${getProductName()} - ${skinDisplayNameForStatus}`, 5000);
            console.log("[SM loadSkin] === loadSkin SUCCESS ===");
            resolve();
        } catch (error) {
            logError(`[SM loadSkin] Error during buildGui or subsequent processing (using content from '${loadedPathForGuiBuild}')`, error);
            if(statusDiv) statusDiv.textContent = 'Error building GUI. Check Console.';
            if(guiContentWrapper) guiContentWrapper.innerHTML='<p class="text-red-500 p-4">Error building GUI. Check Console.</p>';
            if (typeof initializeAllContainerStates === 'function') { initializeAllContainerStates(); }
            requestAnimationFrame(() => { populateFileBrowser(); highlightActiveFile(); populateSkinSelector(); });
            console.error("[SM loadSkin] === loadSkin FAILED ===");
            reject(error);
        }
    });
}

function parseProductXmlFile(productXmlFilePath) {
    console.log(`[SM XML Parse] Attempting to parse product definition XML from: "${productXmlFilePath}"`);
    const fileMap = State.getFileMap();

    if (!productXmlFilePath || !fileMap.has(productXmlFilePath)) {
        const errorMsg = `[SM XML Parse] File not found in State.fileMap: "${productXmlFilePath}".`;
        addConsoleLogEntry(errorMsg, 'error'); return [];
    }
    const xmlContent = fileMap.get(productXmlFilePath);
    const productXmlDir = getDirectory(productXmlFilePath);

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlContent, "application/xml");
        const parseErrorDoc = doc.querySelector("parsererror");
        if (parseErrorDoc) { throw new Error(`Error parsing XML (${productXmlFilePath}): ${parseErrorDoc.textContent.trim()}`); }
        const rootNode = doc.documentElement;
        if (!rootNode || typeof rootNode.tagName === 'undefined') { throw new Error(`XML (${productXmlFilePath}) has no document element.`); }

        const skins = [];
        let primaryDefaultMainXmlPath = null; // Full path to the highest-priority default gui.xml
        let primaryDefaultSkinRoot = null;    // Directory of the highest-priority default gui.xml

        if (rootNode.tagName === 'Product') {
            State.setProductVendor(rootNode.getAttribute('vendor') || 'Unknown Vendor');
            State.setProductName(rootNode.getAttribute('name') || 'Unknown Product');
            const skinNodes = rootNode.querySelectorAll('SkinVariant');
            if (skinNodes.length === 0) { addConsoleLogEntry(`No <SkinVariant> tags in "${productXmlFilePath}".`, 'warn'); }

            let defaultSkinIdFromXml = rootNode.getAttribute('defaultSkinID');
            let defaultSkinIndexFromXml = parseInt(rootNode.getAttribute('defaultSkinIndex') || '0', 10);

            skinNodes.forEach((node, index) => {
                const skinPathAttr = node.getAttribute('path') || '';
                const mainXmlFileAttr = node.getAttribute('mainXmlFile') || 'gui.xml';
                const skinIdAttr = node.getAttribute('id');
                const absoluteSkinRootDir = productXmlDir ? normalizePath(`${productXmlDir}/${skinPathAttr}`) : normalizePath(skinPathAttr);
                const absoluteMainXmlFile = normalizePath(`${absoluteSkinRootDir}/${mainXmlFileAttr}`);
                const mainXmlExists = State.getFileMap().has(absoluteMainXmlFile);
                skins.push({ root: absoluteSkinRootDir, mainXmlFile: absoluteMainXmlFile, id: skinIdAttr || `_${index}`, xmlIndex: index, hasGuiXml: mainXmlExists });
                const effectiveSkinId = skinIdAttr || `_${index}`;
                if ((defaultSkinIdFromXml && effectiveSkinId === defaultSkinIdFromXml) || (!defaultSkinIdFromXml && index === defaultSkinIndexFromXml)) {
                    if (mainXmlExists) primaryDefaultMainXmlPath = absoluteMainXmlFile;
                    primaryDefaultSkinRoot = absoluteSkinRootDir;
                }
            });
            if (!primaryDefaultMainXmlPath && skins.length > 0) {
                const defaultCandidate = skins[defaultSkinIndexFromXml] || skins[0];
                if (defaultCandidate) {
                    if (defaultCandidate.hasGuiXml) primaryDefaultMainXmlPath = defaultCandidate.mainXmlFile;
                    primaryDefaultSkinRoot = defaultCandidate.root;
                }
            }
        } else if (rootNode.tagName === 'Setup') {
            const properties = Array.from(rootNode.querySelectorAll('Property'));
            State.setProductVendor(properties.find(p => p.getAttribute('name') === 'vendor')?.getAttribute('value') || 'Unknown Vendor');
            State.setProductName(properties.find(p => p.getAttribute('name') === 'product')?.getAttribute('value') || 'Unknown Product');

            const defaultGuiPathAttrValue = properties.find(p => p.getAttribute('name') === 'guiPath')?.getAttribute('value');
            if (defaultGuiPathAttrValue) {
                const normalizedDefaultGuiPath = normalizePath(defaultGuiPathAttrValue);
                primaryDefaultMainXmlPath = productXmlDir ? normalizePath(`${productXmlDir}/${normalizedDefaultGuiPath}`) : normalizedDefaultGuiPath;
                primaryDefaultSkinRoot = getDirectory(primaryDefaultMainXmlPath);
                 if (!State.getFileMap().has(primaryDefaultMainXmlPath)) {
                    addConsoleLogEntry(`Default guiPath '${primaryDefaultMainXmlPath}' from Setup.xml not found in fileMap.`, 'warn');
                    // primaryDefaultMainXmlPath will remain, loadSkin will try to load it and then fallback if needed
                }
            }

            properties.forEach(propNode => {
                const nameAttr = propNode.getAttribute('name');
                const valueAttr = propNode.getAttribute('value');
                if (nameAttr && nameAttr.startsWith('guiPath_') && valueAttr) {
                    const index = parseInt(nameAttr.substring('guiPath_'.length), 10);
                    if (!isNaN(index)) {
                        const mainXmlFileRelToProductXml = normalizePath(valueAttr);
                        const absoluteMainXmlFile = productXmlDir ? normalizePath(`${productXmlDir}/${mainXmlFileRelToProductXml}`) : mainXmlFileRelToProductXml;
                        const absoluteSkinRootDir = getDirectory(absoluteMainXmlFile);
                        if (!skins.some(s => normalizePath(s.mainXmlFile) === absoluteMainXmlFile)) { // Avoid adding duplicates if guiPath_0 is same as guiPath
                           skins.push({ root: absoluteSkinRootDir, mainXmlFile: absoluteMainXmlFile, id: `_${index}`, xmlIndex: index, hasGuiXml: State.getFileMap().has(absoluteMainXmlFile) });
                        }
                    }
                }
            });
            // If the main guiPath was not part of guiPath_X, add it with a distinct xmlIndex or manage it.
            // Let's ensure it's in the list if it defined a default and wasn't covered by guiPath_0
            if (primaryDefaultMainXmlPath && !skins.some(s => normalizePath(s.mainXmlFile) === primaryDefaultMainXmlPath)) {
                skins.push({ root: primaryDefaultSkinRoot, mainXmlFile: primaryDefaultMainXmlPath, id: '_defaultGuiPath', xmlIndex: -1, hasGuiXml: State.getFileMap().has(primaryDefaultMainXmlPath) });
            }
            skins.sort((a,b) => (a.xmlIndex === -1 ? -Infinity : a.xmlIndex) - (b.xmlIndex === -1 ? -Infinity : b.xmlIndex));
        } else {
            throw new Error(`Unsupported root tag: <${rootNode.tagName}>. Expected <Product> or <Setup>.`);
        }

        // Set the state for default paths based on what was identified and exists
        if (primaryDefaultMainXmlPath && State.getFileMap().has(primaryDefaultMainXmlPath)) {
            State.setDefaultMainGuiXmlPath(primaryDefaultMainXmlPath);
            State.setDefaultSkinRoot(getDirectory(primaryDefaultMainXmlPath));
        } else {
            // If the primary default isn't usable, try to find the first *available* skin from the list as fallback default
            const firstAvailableSkin = skins.find(s => s.hasGuiXml && State.getFileMap().has(s.mainXmlFile));
            if (firstAvailableSkin) {
                State.setDefaultMainGuiXmlPath(firstAvailableSkin.mainXmlFile);
                State.setDefaultSkinRoot(firstAvailableSkin.root);
                addConsoleLogEntry(`Primary default GUI XML ('${primaryDefaultMainXmlPath || 'N/A'}') not found/usable. Using first available skin '${firstAvailableSkin.mainXmlFile}' as default.`, 'warn');
            } else if (skins.length > 0 && skins[0]?.mainXmlFile) { // Last resort, even if file might be missing
                State.setDefaultMainGuiXmlPath(skins[0].mainXmlFile);
                State.setDefaultSkinRoot(skins[0].root);
                 addConsoleLogEntry(`No usable default GUI XML found. Setting default to first listed skin '${skins[0].mainXmlFile}' which may also be missing.`, 'warn');
            } else {
                addConsoleLogEntry(`Could not determine any default skin paths.`, 'error');
            }
        }
        return skins;

    } catch (e) {
        logError(`[SM XML Parse] Critical error parsing "${productXmlFilePath}"`, e);
        return [];
    }
}