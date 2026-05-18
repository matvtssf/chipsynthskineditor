// File: cs/sidebarManager.js
/**
 * sidebarManager.js
 * Manages the file browser tree and the preview area in the sidebar.
 * REVISED:
 * - updateProductLogoDisplay simplified: it now only attempts the specific mst_logo.png path.
 * The main logo finding logic (including generic fallbacks) is in skinManager.js.
 */
import * as State from '../core/state.js';
import { addConsoleLogEntry, getFileContent, isFileUsed, getFontBlobUrls, getFontMap, getFileMap, getImageBlobUrls, getCurrentSkinRoot, getDefaultSkinRoot, getUsedFiles } from '../core/state.js';
import {
    getFileTreeContainer, getPreviewArea, getEditButton,
    logError, applyFont, normalizePath, createErrorPlaceholder,
    getGuiContentWrapper
} from '../core/domUtils.js';
import { highlightXmlSyntax, openXmlEditor } from '../core/xmlEditor.js';

// --- Constants for Supported File Types ---
const SUPPORTED_EXTENSIONS = ['.xml', '.svg', '.otf', '.ttf', '.png', '.html', '.fermatax', '.fermatap', '.txt', '.scl'];

// --- Exported Functions ---

/** Populates the file browser tree UI */
export function populateFileBrowser() {
    const fileTreeContainer = getFileTreeContainer();
    if (!fileTreeContainer) { console.error("[sidebarManager] File tree container not found."); return; }
    fileTreeContainer.innerHTML = '';
    // console.log("[sidebarManager] Populating file browser..."); // Reduce noise
    try {
        const fileTree = buildFileTreeScoped();
        if (!fileTree) { throw new Error("File tree structure is null or undefined after build."); }
        const treeElement = createTreeElement(fileTree);
        if (!treeElement) { throw new Error("Failed to create HTML tree element."); }
        fileTreeContainer.appendChild(treeElement);
        addTreeEventListeners(treeElement);
        highlightActiveFile();
    } catch (error) {
        logError("[sidebarManager] Error populating file browser", error);
        addConsoleLogEntry(`Error populating file browser: ${error.message}`, 'error');
        if(fileTreeContainer) fileTreeContainer.innerHTML = '<div style="color: red; font-style: italic; padding: 5px;">Error loading file tree.</div>';
    }
}

/**
 * Updates the product logo display in the sidebar.
 * This function attempts to display the specific 'mst_logo.png' based on vendor/product.
 * The primary logo loading (including generic fallbacks) is handled by skinManager.js.
 * This function provides an independent way to try and set the mst_logo.png if called.
 */
export function updateProductLogoDisplay() {
    const logoImgEl = document.getElementById('product-logo-img');
    const logoContainer = document.getElementById('product-logo-container');

    if (!logoImgEl || !logoContainer) {
        if (!logoImgEl) console.error("[sidebarManager updateProductLogoDisplay] Product logo image element ('product-logo-img') not found.");
        if (!logoContainer) console.error("[sidebarManager updateProductLogoDisplay] Product logo container element ('product-logo-container') not found.");
        return;
    }

    logoContainer.textContent = ''; // Clear previous placeholder
    logoContainer.classList.remove('logo-placeholder-text');
    logoImgEl.src = '';
    logoImgEl.style.display = 'none';

    const vendor = State.getProductVendor();
    const product = State.getProductName();
    
    console.log(`[sidebarManager updateProductLogoDisplay] --- Attempting mst_logo.png Display ---`);
    console.log(`  Vendor: "${vendor}", Product: "${product}"`);

    if (vendor && product && vendor !== 'Unknown Vendor' && product !== 'Unknown Product') {
        const constructedRelativePath = `NKS/PAResources/image/${vendor}/${product}/mst_logo.png`;
        const currentSkinRoot = State.getCurrentSkinRoot(); // For logging context
        const defaultSkinRoot = State.getDefaultSkinRoot(); // For logging context

        console.log(`  Target relative path for mst_logo.png: "${constructedRelativePath}"`);
        console.log(`    (Context: CurrentRoot="${currentSkinRoot}", DefaultRoot="${defaultSkinRoot}")`);
        console.log(`    (State.getAssetBlobUrl will try this relative to current, then default root, then as direct key)`);

        const blobUrl = State.getAssetBlobUrl(constructedRelativePath);

        if (blobUrl) {
            logoImgEl.src = blobUrl;
            logoImgEl.style.display = 'block';
            logoContainer.style.display = 'flex';
            console.log(`  SUCCESS: mst_logo.png loaded by sidebarManager via "${constructedRelativePath}"`);
        } else {
            logoImgEl.style.display = 'none';
            logoContainer.style.display = 'flex';
            logoContainer.classList.add('logo-placeholder-text');
            logoContainer.textContent = `mst_logo.png not found by sidebarManager. Path tried: ${constructedRelativePath}`;
            console.warn(`  FAILURE: mst_logo.png not found by sidebarManager for relative path: "${constructedRelativePath}"`);
        }
    } else {
        logoImgEl.style.display = 'none';
        logoContainer.style.display = 'flex';
        logoContainer.classList.add('logo-placeholder-text');
        logoContainer.textContent = 'Cannot attempt mst_logo.png: Vendor/Product unknown.';
        console.warn(`  Skipped mst_logo.png attempt by sidebarManager: Vendor or Product name missing/default.`);
    }
    console.log(`[sidebarManager updateProductLogoDisplay] --- mst_logo.png Display Attempt END ---`);
}


/** Builds a nested object representing the file tree structure based on specified scope */
function buildFileTreeScoped() {
    // console.log("[sidebarManager] Building scoped file tree..."); // Reduce noise
    const tree = {};
    const currentSkinRoot = getCurrentSkinRoot();
    const defaultSkinRoot = getDefaultSkinRoot();
    const currentRootNormalized = normalizePath(currentSkinRoot);
    const defaultRootNormalized = normalizePath(defaultSkinRoot);
    // const showDefaultRootContentsSeparately = defaultRootNormalized && defaultRootNormalized !== currentRootNormalized; // Not directly used here

    const allFilesData = new Map();
    const fileMap = getFileMap();
    const imageBlobUrls = getImageBlobUrls();
    const fontBlobUrls = getFontBlobUrls();

    fileMap.forEach((_, filePath) => { allFilesData.set(normalizePath(filePath), { type: 'file', path: filePath }); });
    imageBlobUrls.forEach((_, filePath) => { const normPath = normalizePath(filePath); if (!allFilesData.has(normPath)) allFilesData.set(normPath, { type: 'image', path: filePath }); });
    fontBlobUrls.forEach((_, filePath) => { const normPath = normalizePath(filePath); if (!allFilesData.has(normPath)) allFilesData.set(normPath, { type: 'font', path: filePath }); });

    if (allFilesData.size === 0) { return tree; }

    let rootPrefix = '';
    const paths = Array.from(allFilesData.keys());
    if (paths.length > 0) { const firstPathParts = paths[0].split('/'); if (firstPathParts.length > 1) { const potentialRoot = firstPathParts[0]; if (paths.every(p => p.startsWith(potentialRoot + '/') || p === potentialRoot)) { rootPrefix = potentialRoot + '/'; } } }
    const rootPrefixLength = rootPrefix.length;
    // console.log(`[SB] Detected root prefix: '${rootPrefix}'`);

    const logicalCurrentRoot = currentRootNormalized.startsWith(rootPrefix) ? currentRootNormalized.substring(rootPrefixLength) : currentRootNormalized;
    const logicalDefaultRoot = defaultRootNormalized.startsWith(rootPrefix) ? defaultRootNormalized.substring(rootPrefixLength) : defaultRootNormalized;
    const logicalCurrentRootNormalized = normalizePath(logicalCurrentRoot);
    const logicalDefaultRootNormalized = normalizePath(logicalDefaultRoot);
    // console.log(`[SB] Logical Roots: Current='${logicalCurrentRootNormalized || '[root]'}', Default='${logicalDefaultRootNormalized || '[not set]'}'`);

    const addPathToTree = (currentTreeLevel, pathParts, fullPathData) => {
        if (!pathParts || pathParts.length === 0) return;
        const part = pathParts[0]; if (!part) return;
        const remainingParts = pathParts.slice(1); const isLastPart = remainingParts.length === 0;
        if (isLastPart) { if (!currentTreeLevel[part] || !currentTreeLevel[part]._isFolder) { currentTreeLevel[part] = { _isFile: true, _fullPath: fullPathData.path, _type: fullPathData.type }; } } else { if (currentTreeLevel[part] && currentTreeLevel[part]._isFile) { return; } if (!currentTreeLevel[part]) { currentTreeLevel[part] = { _isFolder: true, children: {} }; } currentTreeLevel[part].children = currentTreeLevel[part].children || {}; addPathToTree(currentTreeLevel[part].children, remainingParts, fullPathData); }
    };

    allFilesData.forEach((fileData, normalizedPath) => {
        const extension = '.' + normalizedPath.split('.').pop(); if (!SUPPORTED_EXTENSIONS.includes(extension)) return;
        const logicalPath = normalizedPath.startsWith(rootPrefix) ? normalizedPath.substring(rootPrefixLength) : normalizedPath; if (!logicalPath) return;
        let include = false; 
        const isLogicalRootLevelFile = !logicalPath.includes('/'); 
        const isInLogicalNKS = logicalPath.startsWith('nks/'); 
        const isInLogicalCurrentSkin = logicalCurrentRootNormalized && logicalPath.startsWith(logicalCurrentRootNormalized + '/'); 
        const isInLogicalDefaultSkin = logicalDefaultRootNormalized && logicalDefaultRootNormalized !== logicalCurrentRootNormalized && logicalPath.startsWith(logicalDefaultRootNormalized + '/');
        if (isLogicalRootLevelFile || isInLogicalNKS || isInLogicalCurrentSkin || isInLogicalDefaultSkin) { include = true; }
        if (include) { const displayPathParts = logicalPath.split('/'); if (displayPathParts.length > 0 && displayPathParts[0] !== '') { addPathToTree(tree, displayPathParts, fileData); } }
    });
    // console.log("[sidebarManager] Scoped tree structure built:", tree); // Reduce noise
    return tree;
}


/** Recursively creates HTML elements for the file tree */
function createTreeElement(node) {
    const ul = document.createElement('ul');
    if (!node || typeof node !== 'object' || Object.keys(node).length === 0) { return ul; }
    const sortedKeys = Object.keys(node).sort((a, b) => { const itemA = node[a]; const itemB = node[b]; const isFolderA = itemA?._isFolder ?? false; const isFolderB = itemB?._isFolder ?? false; if (isFolderA !== isFolderB) { return isFolderA ? -1 : 1; } return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }); });
    sortedKeys.forEach(key => {
        if (key.startsWith('_')) return; const item = node[key]; if (!item) return; const li = document.createElement('li'); const span = document.createElement('span'); let iconClass = 'iconoir-file-not-found'; let fileType = 'unknown';
        
        const checkSpan = document.createElement('span');
        checkSpan.className = 'file-checkmark'; 
        checkSpan.innerHTML = '<i class="iconoir-check-square-solid"></i>'; 
        checkSpan.style.display = 'none'; 

        if (item._isFolder) {
            li.classList.add('folder');
            iconClass = 'iconoir-folder';
            span.innerHTML = `<i class="${iconClass}"></i> ${key}`;
            li.appendChild(span);
            const subUl = createTreeElement(item.children || {});
            if (subUl && subUl.hasChildNodes()) {
                li.appendChild(subUl);
            } else if (!subUl || !subUl.hasChildNodes()) {
                li.classList.add('empty-folder');
            }
        } else if (item._isFile) {
            li.classList.add('file');
            const fullPath = item._fullPath;
            const lowerPath = normalizePath(fullPath);
            fileType = item._type || 'unknown';

            if (lowerPath.endsWith('.xml') || lowerPath.endsWith('.txt') || lowerPath.endsWith('.scl')) {
                iconClass = 'iconoir-code'; 
                fileType = 'xml';
            } else if (lowerPath.endsWith('.fermatax') || lowerPath.endsWith('.fermatap')) {
                iconClass = 'iconoir-list';
                fileType = 'xml'; 
            } else if (lowerPath.endsWith('.svg') || lowerPath.endsWith('.png') || fileType === 'image') {
                iconClass = 'iconoir-media-image';
                fileType = lowerPath.endsWith('.svg') ? 'svg' : 'image';
            } else if (lowerPath.endsWith('.otf') || lowerPath.endsWith('.ttf') || fileType === 'font') {
                iconClass = 'iconoir-font-question';
                fileType = 'font';
            } else if (lowerPath.endsWith('.html')) {
                iconClass = 'iconoir-html5';
                fileType = 'html';
            }
            
            const iconEl = document.createElement('i');
            iconEl.className = iconClass;
            span.appendChild(iconEl);
            
            const textNode = document.createTextNode(` ${key}`); 
            span.appendChild(textNode);

            let isInUse = State.isFileUsed(fullPath);
            const currentSkinRoot = State.getCurrentSkinRoot();
            
            // Sub-skin default/gui fallback check
            if (!isInUse && currentSkinRoot && lowerPath.includes(currentSkinRoot)) {
                const fallbackPath = lowerPath.replace(currentSkinRoot, 'default/gui');
                if (State.isFileUsed(fallbackPath)) {
                    isInUse = true;
                }
            }
            if (!isInUse && lowerPath.includes('default/gui')) {
                const subSkinPath = lowerPath.replace('default/gui', currentSkinRoot || '');
                if (State.isFileUsed(subSkinPath)) {
                    isInUse = true;
                }
            }

            if (isInUse) {
                // Apply green rounded rectangle styling directly
                li.style.backgroundColor = 'rgba(34, 197, 94, 0.15)'; // bg-green-100 equivalent
                li.style.borderRadius = '6px'; // rounded-md equivalent
                li.style.color = '#15803d'; // text-green-900 equivalent
                li.style.fontWeight = '500';
                li.classList.add('used-file');
                // We leave checkSpan.style.display = 'none' to remove the checkmark
            }
            span.appendChild(checkSpan); 

            li.appendChild(span);
            li.dataset.filePath = fullPath;
            li.dataset.fileType = fileType;
            li.dataset.isEditable = (fileType === 'xml' || fileType === 'svg') ? 'true' : 'false'; 
        } else {
            return; 
        }
        ul.appendChild(li);
    });
    return ul;
}


/** Adds event listeners for the file tree */
 function addTreeEventListeners(treeElement) {
    if (!treeElement) { console.error("Cannot add tree listeners: Tree element missing."); return; }

    treeElement.addEventListener('click', (event) => {
        let target = event.target;
        let folderLi = null;
        let fileLi = null;

        let current = target;
        while (current && current !== treeElement) {
             if ((current.tagName === 'SPAN' || current.tagName === 'I') && current.parentElement?.tagName === 'LI') {
                 current = current.parentElement;
             }
            if (current.tagName === 'LI') {
                if (current.classList.contains('file')) { fileLi = current; break; }
                if (current.classList.contains('folder')) { folderLi = current; break; }
            }
            current = current.parentElement;
        }

        const liveEditButton = getEditButton();
        const fileTreeContainer = getFileTreeContainer();
        const previewArea = getPreviewArea();
        if (!fileTreeContainer || !previewArea) { console.error("Missing elements in click handler!"); return; }

        const previouslySelected = fileTreeContainer.querySelector('.highlighted');
        if (previouslySelected) { previouslySelected.classList.remove('highlighted'); }

        if (fileLi) {
            fileLi.classList.add('highlighted');
            if (liveEditButton) { liveEditButton.disabled = !(fileLi.dataset.isEditable === 'true'); }
            const selectedPath = fileLi.dataset.filePath; 
            const fileType = fileLi.dataset.fileType;
            if (selectedPath) { 
                displayPreview(selectedPath, fileType); 
            } else {
                 if (previewArea) previewArea.innerHTML = 'Error: File path missing.';
            }
        } else if (folderLi) {
            folderLi.classList.add('highlighted');
            if (liveEditButton) { liveEditButton.disabled = true; }
            if (previewArea) {
                previewArea.innerHTML = '<div class="text-gray-400 italic p-2">Folder selected. Actions will apply inside this directory branch.</div>';
                previewArea.classList.remove('image-preview-bg');
            }
        } else {
            if (liveEditButton) { liveEditButton.disabled = true; }
            if (previewArea) {
                 previewArea.innerHTML = 'Select a file to preview.';
                 previewArea.classList.remove('image-preview-bg'); 
            }
        }

        if (folderLi && !fileLi) { folderLi.classList.toggle('open'); }
    });

    treeElement.addEventListener('dblclick', (event) => {
        let current = event.target;
        let fileLi = null;
        while (current && current !== treeElement) {
            if (current.tagName === 'LI' && current.classList.contains('file')) {
                fileLi = current;
                break;
            }
            current = current.parentElement;
        }
        if (fileLi && fileLi.dataset.filePath) {
            const previewArea = getPreviewArea();
            if (previewArea) previewArea.click();
        }
    });

    const editButton = getEditButton();
    if (editButton && !editButton.dataset.listenerAttached) {
         editButton.addEventListener('click', () => {
             const selectedLi = getFileTreeContainer()?.querySelector('.file.highlighted');
             if (selectedLi && selectedLi.dataset.filePath && selectedLi.dataset.isEditable === 'true') {
                 openXmlEditor(selectedLi.dataset.filePath); 
             }
         });
         editButton.dataset.listenerAttached = 'true';
         // console.log("[SB] Edit button listener attached."); // Reduce noise
    } else if (!editButton) { console.error("[sidebarManager] Could not find edit button for listener setup."); }
 }

/** Highlights the active file in the tree */
export function highlightActiveFile() {
    const fileTreeContainer = getFileTreeContainer();
    const previewArea = getPreviewArea();
    const editButton = getEditButton();
    if (!fileTreeContainer) return;

    const activePath = State.getActiveFilePath();
    const fileElements = fileTreeContainer.querySelectorAll('.file');
    let found = false;
    let isEditable = false;
    let activeLi = null;

    fileElements.forEach(el => {
        const elementPath = normalizePath(el.dataset.filePath || '');
        const targetPath = normalizePath(activePath || '');
        const isMatch = activePath && elementPath === targetPath;
        el.classList.toggle('highlighted', isMatch);
        if (isMatch) {
            found = true;
            isEditable = el.dataset.isEditable === 'true';
            activeLi = el;
            let parent = el.parentElement;
            while (parent && parent !== fileTreeContainer) {
                if (parent.tagName === 'LI' && parent.classList.contains('folder')) {
                    parent.classList.add('open');
                }
                parent = parent.parentElement;
            }
        }
    });

    if (editButton) {
        editButton.disabled = !(found && isEditable);
    }

    if (found && activePath && activeLi) {
        const fileType = activeLi.dataset.fileType;
        displayPreview(activePath, fileType);
    } else if (!found && previewArea) {
        previewArea.innerHTML = 'Select a file to preview.';
        previewArea.classList.remove('image-preview-bg'); 
    }
    // console.log(`[SB] Highlighted active file: ${activePath || 'None'}`); // Reduce noise
}


/** Displays a preview of the selected file */
export function displayPreview(selectedPath, fileType) { 
    const previewArea = getPreviewArea();
    if (!previewArea) { console.error("[SB] Preview area not found!"); return; }
    previewArea.innerHTML = '';
    previewArea.onwheel = null; // Reset custom wheel zoom handler for text/font files
    previewArea.dataset.previewedFilePath = selectedPath; // Save current active path for popup clones
    previewArea.dataset.previewedFileType = fileType;
    previewArea.className = 'border border-gray-200 rounded bg-gray-50 p-1 flex-grow overflow-auto text-xs'; 
    previewArea.style.fontFamily = 'monospace'; 

    const normalizedLookupPath = normalizePath(selectedPath); 
    // console.log(`[SB] Displaying preview for ${selectedPath} (Lookup Key: ${normalizedLookupPath}), type: ${fileType}`); // Reduce noise

    try {
        if (fileType === 'xml') {
            const content = State.getFileMap().get(normalizedLookupPath);
            if (content !== undefined) {
                 previewArea.innerHTML = highlightXmlSyntax(content);
            } else {
                 previewArea.textContent = `Could not load content for: ${selectedPath}`;
                 logError("Preview Error: Content not found (direct lookup)", new Error(selectedPath));
            }
        } else if (fileType === 'image' || fileType === 'svg') {
            const blobUrl = State.getImageBlobUrls().get(normalizedLookupPath);
            if (blobUrl) {
                 const img = document.createElement('img');
                 img.src = blobUrl;
                 img.alt = selectedPath;
                 img.style.cssText = 'max-width: 100%; max-height: 100%; height: auto; display: block; margin: auto; transform-origin: center center; transition: transform 0.05s ease-out;';
                 img.classList.add('preview-image-transparent-bg');
                 img.onerror = () => { previewArea.textContent = `Error loading image preview: ${selectedPath}`; logError("Preview Error: Image failed to load", new Error(selectedPath));};
                 previewArea.appendChild(img);
                 previewArea.classList.add('image-preview-bg'); 
                 previewArea.classList.add('flex', 'items-center', 'justify-center'); // Centering works perfectly with pure CSS scaling

                 let currentZoom = 1.0;
                 previewArea.onwheel = (e) => {
                     e.preventDefault();
                     const zoomFactor = 0.15;
                     if (e.deltaY < 0) {
                         currentZoom *= (1 + zoomFactor);
                     } else {
                         currentZoom *= (1 - zoomFactor);
                     }
                     currentZoom = Math.max(0.1, Math.min(currentZoom, 15));
                     img.style.transform = `scale(${currentZoom})`;
                 };

                 const previewItemModal = document.getElementById('preview-item-modal');
                 if (previewItemModal && previewItemModal.classList.contains('visible')) {
                     const previewItemModalTitle = document.getElementById('preview-item-modal-title');
                     const previewItemModalContent = document.getElementById('preview-item-modal-content');
                     if (previewItemModalTitle && previewItemModalContent) {
                         const fileName = selectedPath.substring(selectedPath.lastIndexOf('/') + 1);
                         previewItemModalTitle.textContent = `Preview: ${fileName}`;
                         previewItemModalContent.innerHTML = '';
                         const contentToClone = img.cloneNode(true);
                         contentToClone.style.transform = '';
                         previewItemModalContent.appendChild(contentToClone);

                         let modalZoom = 1.0;
                         contentToClone.style.transformOrigin = 'center center';
                         contentToClone.style.transition = 'transform 0.05s ease-out';
                         previewItemModalContent.onwheel = (e) => {
                             e.preventDefault();
                             const zoomFactor = 0.15;
                             if (e.deltaY < 0) {
                                 modalZoom *= (1 + zoomFactor);
                             } else {
                                 modalZoom *= (1 - zoomFactor);
                             }
                             modalZoom = Math.max(0.1, Math.min(modalZoom, 15));
                             contentToClone.style.transform = `scale(${modalZoom})`;
                         };
                     }
                 }
            } else {
                 previewArea.textContent = `Could not load image preview for: ${selectedPath}`;
                 logError(`Preview Error: Blob URL not found for image/svg (direct lookup)`, new Error(selectedPath));
            }
        } else if (fileType === 'font') {
            const blobUrl = State.getFontBlobUrls().get(normalizedLookupPath);
            if (blobUrl) {
                 const fontMap = getFontMap(); const fontData = Array.from(fontMap.values()).find(fd => fd.filename && normalizePath(fd.filename) === normalizedLookupPath); const baseName = selectedPath.split('/').pop().split('.')[0]; const derivedFamily = baseName.replace(/[^a-zA-Z0-9]/g, '_'); const fontFamily = fontData?.name_windows || fontData?.name_osx || derivedFamily; const previewText = `${fontFamily}\nABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789\n!@#$%^&*()_+[];',./{}:"<>?`; const fontPreviewDiv = document.createElement('div'); fontPreviewDiv.classList.add('font-preview'); const safeFamily = /\s|[^\w-]/.test(fontFamily) ? `"${fontFamily}"` : fontFamily; fontPreviewDiv.style.fontFamily = `${safeFamily}, sans-serif`; fontPreviewDiv.textContent = previewText;
                 fontPreviewDiv.style.cssText = 'transform-origin: center center; transition: transform 0.05s ease-out; white-space: pre-wrap;';
                 previewArea.appendChild(fontPreviewDiv);
                 previewArea.style.fontFamily = '';
                 previewArea.classList.add('flex', 'items-center', 'justify-center');

                 let currentZoom = 1.0;
                 previewArea.onwheel = (e) => {
                     e.preventDefault();
                     const zoomFactor = 0.15;
                     if (e.deltaY < 0) {
                         currentZoom *= (1 + zoomFactor);
                     } else {
                         currentZoom *= (1 - zoomFactor);
                     }
                     currentZoom = Math.max(0.1, Math.min(currentZoom, 15));
                     fontPreviewDiv.style.transform = `scale(${currentZoom})`;
                 };
            } else {
                 previewArea.textContent = `Could not load font preview for: ${selectedPath}`;
                 logError(`Preview Error: Blob URL not found for font (direct lookup)`, new Error(selectedPath));
            }
        } else if (fileType === 'html') {
             const content = State.getFileMap().get(normalizedLookupPath);
             if (content !== undefined) {
                 let blobUrl = null;
                 try { const blob = new Blob([content], { type: 'text/html' }); blobUrl = URL.createObjectURL(blob); } catch (blobError) { logError(`Error creating blob URL for HTML file: ${selectedPath}`, blobError); previewArea.textContent = `Error creating preview link for: ${selectedPath}`; return; }
                 const link = document.createElement('a'); link.href = blobUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Open HTML in New Browser Tab'; link.className = 'inline-block bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-2 rounded text-xs'; const cleanupUrl = blobUrl; link.addEventListener('click', () => { setTimeout(() => { console.log(`[SB Preview] Revoking Blob URL: ${cleanupUrl.substring(0,30)}...`); URL.revokeObjectURL(cleanupUrl); }, 500); }); previewArea.appendChild(link); previewArea.classList.add('flex', 'items-center', 'justify-center'); previewArea.style.fontFamily = '';
             } else {
                 previewArea.textContent = `Could not load content for: ${selectedPath}`;
                  logError("Preview Error: HTML Content not found (direct lookup)", new Error(selectedPath));
             }
        } else {
             previewArea.textContent = `Preview not available for: ${selectedPath} (Type: ${fileType})`;
        }
    } catch (e) {
        logError(`Error generating preview for ${selectedPath}`, e);
        previewArea.textContent = `Error generating preview. Check console.`;
        previewArea.style.color = 'red';
    }
}