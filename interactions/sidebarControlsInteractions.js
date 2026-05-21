/* File: cs/sidebarControlsInteractions.js */
/**
 * Handles interactions for the controls within the sidebar,
 * such as zoom, open folder, debug, console, and reference buttons.
 * MODIFIED: Added exportable updateZoomControlsDisplay function.
 * MODIFIED: handleZoomChange now uses updateZoomControlsDisplay and calls updateGuiZoom.
 */
import * as State from '../core/state.js';
import {
    getLoadFolderButton, getFileInput, getZoomSlider, getZoomValueDisplay,
    getDebugToggleButton, getDebugCheckbox, getConsoleButton, getReferenceButton,
    getConfigButton,
    getPreviewArea, getPreviewItemModal, getClosePreviewItemModalBtn,
    getPreviewItemModalContent, getPreviewItemModalTitle,
    getGuiZoomCanvas, // Changed from getGuiOutputDiv for consistency with new structure
    getMainContentArea,
    getDebugOverlay,
    getConsoleModal, getCloseConsoleBtn, getClearConsoleBtn, getConsoleLogOutput, getCopyConsoleBtn,
    logError, showToast,
    toggleElementErrorClass,
    getSidebar, getSidebarToggleBtn
} from '../core/domUtils.js';
import { handleFileSelection } from '../core/fileLoader.js';
import { populateFileBrowser } from '../managers/sidebarManager.js';
import { handleReferenceToggle } from './elementRefModalInteractions.js';
import { handleConfigToggle } from './configModalInteractions.js';
import { makeModalDraggable, toggleModalVisibility } from '../managers/modalManager.js';
import { openXmlEditor } from '../core/xmlEditor.js';
import { updateGuiZoom } from './mainContentInteractions.js';
import { cancelCanvasInsertMode } from './canvasInsertInteractions.js';

let previewArea = null;
let previewItemModal = null;
let closePreviewItemModalBtn = null;
let previewItemModalContent = null;
let previewItemModalTitle = null;

/**
 * Updates the zoom slider position and the percentage text display.
 * @param {number} zoomLevel - The new zoom level (e.g., 1.0 for 100%).
 */
export function updateZoomControlsDisplay(zoomLevel) {
    const zoomSlider = getZoomSlider();
    const zoomValueDisplay = getZoomValueDisplay();

    if (zoomSlider) {
        zoomSlider.value = zoomLevel;
    }
    if (zoomValueDisplay) {
        zoomValueDisplay.textContent = `${Math.round(zoomLevel * 100)}%`;
    }
}

function handleZoomChange(event) {
    const zoomLevel = parseFloat(event.target.value);
    updateZoomControlsDisplay(zoomLevel); // Update sidebar UI elements
    updateGuiZoom(zoomLevel);          // Update the actual GUI zoom on the main canvas
}

/** Toggles the collapsed state of the sidebar */
function handleSidebarToggle() {
    const sidebar = getSidebar();
    const toggleBtn = getSidebarToggleBtn();
    if (sidebar) {
        const isCollapsed = sidebar.classList.toggle('collapsed');
        State.setIsSidebarCollapsed(isCollapsed);
        if (toggleBtn) {
            toggleBtn.title = isCollapsed ? "Expand Sidebar" : "Collapse Sidebar";
        }
        console.log(`[sidebarControls] Sidebar toggled. Collapsed: ${isCollapsed}`);
    }
}

function disableEditMode() {
    const debugCheckbox = getDebugCheckbox();
    const debugToggleButton = getDebugToggleButton();
    const debugOverlayElement = getDebugOverlay();

    if (debugCheckbox && debugToggleButton && debugOverlayElement) {
        debugCheckbox.checked = false;
        debugToggleButton.setAttribute('aria-checked', 'false');
        debugToggleButton.classList.remove('active');
        debugToggleButton.title = "Toggle Edit Mode";
        const debugIcon = debugToggleButton.querySelector('i');
        if (debugIcon) {
            debugIcon.className = 'iconoir-edit-pencil';
        }
        State.setDebugEnabled(false);
        document.body.classList.remove('edit-mode-active');
        debugOverlayElement.style.display = 'none';
        debugOverlayElement.textContent = '';
        cancelCanvasInsertMode();
    }
}

function closeAllModals() {
    const modalIds = [
        'xml-editor-modal', 'console-modal', 'config-modal', 'reference-modal',
        'attribute-editor-modal', 'element-editor-modal', 'xml-insert-element-modal',
        'param-reference-modal', 'preview-item-modal'
    ];
    modalIds.forEach(id => {
        const modal = document.getElementById(id);
        if (modal) {
            toggleModalVisibility(modal, false);
        }
    });
    const consoleIcon = getConsoleButton()?.querySelector('i');
    if (consoleIcon) {
        consoleIcon.className = 'iconoir-terminal-tag';
    }
    State.setIsConsoleVisible(false);
    if (previewItemModalContent) {
        previewItemModalContent.innerHTML = '';
        previewItemModalContent.onwheel = null;
    }
    const previewEditBtn = document.getElementById('preview-edit-button');
    if (previewEditBtn) previewEditBtn.style.display = 'none';
}

export function initializeSidebarControls() {
    const sidebarToggleBtn = getSidebarToggleBtn();
    const loadFolderButton = getLoadFolderButton();
    const fileInput = getFileInput();
    const zoomSlider = getZoomSlider();
    const debugToggleButton = getDebugToggleButton();
    const consoleButton = getConsoleButton();
    const referenceButton = getReferenceButton();
    const configButton = getConfigButton();

    previewArea = getPreviewArea();
    previewItemModal = getPreviewItemModal();
    closePreviewItemModalBtn = getClosePreviewItemModalBtn();
    previewItemModalContent = getPreviewItemModalContent();
    previewItemModalTitle = getPreviewItemModalTitle();

    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', handleSidebarToggle);
    }
    if (loadFolderButton && fileInput) {
        loadFolderButton.addEventListener('click', () => {
            if (State.canUndo()) {
                if (!confirm("You have unsaved changes in your current project. We highly recommend downloading/saving your project first so you don't lose your work.\n\nDo you want to proceed and open a new project anyway?")) {
                    return;
                }
            }
            fileInput.click();
        });
        fileInput.addEventListener('change', (event) => {
            if (event.target.files.length > 0) {
                disableEditMode();
                closeAllModals();
                handleFileSelection(event.target.files);
            }
        });
    } else {
        logError("Load folder button or file input not found.", null, true);
    }

    if (zoomSlider) {
        zoomSlider.addEventListener('input', handleZoomChange);
        // Initialize display based on current slider value (which defaults to 1 in HTML)
        updateZoomControlsDisplay(parseFloat(zoomSlider.value));
    } else {
        logError("Zoom slider not found.", null, true);
    }

    if (debugToggleButton) {
        debugToggleButton.addEventListener('click', handleDebugToggle);
    } else {
        logError("Debug toggle button not found.", null, true);
    }

    if (consoleButton) {
        consoleButton.addEventListener('click', handleConsoleButtonClick);
        
        // Modal Inner Controls
        const closeConsoleBtn = getCloseConsoleBtn();
        if (closeConsoleBtn) {
            closeConsoleBtn.addEventListener('click', () => {
                State.setIsConsoleVisible(false);
                toggleModalVisibility(getConsoleModal(), false);
                const icon = getConsoleButton()?.querySelector('i');
                if (icon) {
                    icon.className = 'iconoir-terminal-tag';
                }
            });
        }
        const clearConsoleBtn = getClearConsoleBtn();
        if (clearConsoleBtn) {
            clearConsoleBtn.addEventListener('click', handleConsoleClear);
        }
        const copyConsoleBtn = getCopyConsoleBtn();
        if (copyConsoleBtn) {
            copyConsoleBtn.addEventListener('click', handleConsoleCopy);
        }

        // Console Filter Listeners
        ['console-filter-info', 'console-filter-warn', 'console-filter-error'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => updateConsoleView(true));
        });
    } else {
        logError("Console button not found.", null, true);
    }

    if (referenceButton) {
        referenceButton.addEventListener('click', handleReferenceToggle);
    } else {
        logError("Reference button not found.", null, true);
    }

    // New File Browser Action Buttons
    document.getElementById('new-xml-btn')?.addEventListener('click', handleNewXml);
    document.getElementById('new-folder-btn')?.addEventListener('click', handleNewFolder);
    document.getElementById('import-file-btn')?.addEventListener('click', () => document.getElementById('sidebar-import-input')?.click());
    document.getElementById('sidebar-import-input')?.addEventListener('change', handleSidebarImport);
    document.getElementById('remove-item-btn')?.addEventListener('click', handleRemoveItem);
    document.getElementById('export-item-btn')?.addEventListener('click', handleExportItem);
    document.getElementById('save-project-button')?.addEventListener('click', handleExportProjectZip);
    document.addEventListener('historyChanged', updateSaveButtonVisualState);
    updateSaveButtonVisualState();
     if (configButton) {
        configButton.addEventListener('click', handleConfigToggle);
    } else {
        logError("Config button not found.", null, true);
    }

    if (previewArea && previewItemModal && previewItemModalContent && closePreviewItemModalBtn && previewItemModalTitle) {
        previewArea.addEventListener('click', handleSidebarPreviewAreaClick);
        closePreviewItemModalBtn.addEventListener('click', closePreviewItemModal);
        const previewModalContentContainer = previewItemModal.querySelector('.modal-content-container');
        const previewModalHeader = previewModalContentContainer ? previewModalContentContainer.querySelector('div:first-child') : null;
        if (previewModalContentContainer && previewModalHeader) {
            makeModalDraggable(previewModalContentContainer, previewModalHeader);
        }
    } else {
        if (!previewArea) logError("Sidebar Preview Area (#preview-area) for modal trigger not found.");
        // Other checks for preview modal elements...
    }

    const mainContentArea = getMainContentArea();
    if (mainContentArea) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            mainContentArea.addEventListener(eventName, preventDefaults, false);
        });
        mainContentArea.addEventListener('dragenter', () => mainContentArea.classList.add('dragover-active'));
        mainContentArea.addEventListener('dragleave', () => mainContentArea.classList.remove('dragover-active'));
        mainContentArea.addEventListener('drop', handleDrop, false);
    }
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const mainContentArea = getMainContentArea();
    if (mainContentArea) mainContentArea.classList.remove('dragover-active');

    const dt = e.dataTransfer;
    if (dt.files && dt.files.length > 0) { // Prioritize dt.files directly
        if (State.canUndo()) {
            if (!confirm("You have unsaved changes in your current project. We highly recommend downloading/saving your project first so you don't lose your work.\n\nDo you want to proceed and open a new project anyway?")) {
                return;
            }
        }
        disableEditMode();
        closeAllModals();
        handleFileSelection(dt.files);
    } else if (dt.items) { // Fallback to process items if files is empty but items exist
        const files = [];
        const items = Array.from(dt.items);
        const fileReadingPromises = items.map(item => {
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry();
                if (entry) {
                    return processFileEntry(entry, files);
                }
            }
            return Promise.resolve();
        });

        Promise.all(fileReadingPromises)
            .then(() => {
                if (files.length > 0) {
                    showToast("Folder drop (from items) detected. Processing...", "info");
                    // handleFileSelection expects a FileList. This 'files' array needs conversion
                    // or handleFileSelection needs to be adapted. For now, this path might be less robust.
                    // It's safer if handleFileSelection primarily works with dt.files.
                    // If `files` contains actual File objects, one might try to construct a FileList
                    // or pass it and adapt handleFileSelection.
                    // THIS IS A COMPLEX AREA that might need specific logic from your original LKGV.
                    // For now, this branch for 'items' leading to `files` may not correctly form a FileList.
                    logError("Dropped items processed into an array, but handleFileSelection expects FileList. This path needs review.", files);
                    // As a fallback, try dt.files again if it somehow got populated.
                     if (dt.files && dt.files.length > 0) handleFileSelection(dt.files);
                } else {
                     showToast("No files found in dropped items.", "warning");
                }
            })
            .catch(err => {
                logError("Error processing dropped items:", err);
                showToast("Error processing dropped items.", "error");
            });
    } else {
        showToast("No files or items found in drop event.", "warning");
    }
}

async function processFileEntry(entry, filesArray, currentPath = "") {
    // This is a simplified placeholder based on common patterns.
    // If your original `processFileEntry` from LKGV was more complex for directory traversal,
    // that logic would need to be here.
    if (entry.isFile) {
        return new Promise((resolve, reject) => {
            entry.file(file => {
                // To reconstruct relative paths if needed: Object.defineProperty(file, 'webkitRelativePath', { value: currentPath + file.name });
                filesArray.push(file);
                resolve();
            }, reject);
        });
    } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        return new Promise((resolve, reject) => {
            dirReader.readEntries(async (entries) => {
                const promises = entries.map(subEntry => processFileEntry(subEntry, filesArray, `${currentPath}${entry.name}/`));
                await Promise.all(promises);
                resolve();
            }, reject);
        });
    }
    return Promise.resolve();
}


function getSelectedTreeItemInfo() {
    const fileTreeContainer = document.getElementById('file-tree');
    const selectedLi = fileTreeContainer?.querySelector('.highlighted');
    if (!selectedLi) return { path: '', isFolder: false };

    const isFolder = selectedLi.classList.contains('folder');
    let path = selectedLi.dataset.filePath || "";
    
    if (isFolder && !path) {
        let current = selectedLi;
        let pathParts = [];
        while (current && current.id !== 'file-tree') {
            if (current.tagName === 'LI' && current.classList.contains('folder')) {
                // Clone node to strip nested ul/li elements text when reading container text
                const span = current.querySelector('span');
                if (span) {
                    let text = span.childNodes[0]?.textContent || span.textContent;
                    text = text.replace(/[▸\s]+/g, '').trim();
                    if (text) pathParts.unshift(text);
                }
            }
            current = current.parentElement?.closest('li');
        }
        path = pathParts.join('/');
    }
    return { path, isFolder, element: selectedLi };
}

function handleNewXml() {
    const info = getSelectedTreeItemInfo();
    
    let rootPrefix = '';
    const fileMapKeys = Array.from(State.getFileMap().keys());
    if (fileMapKeys.length > 0) {
        const firstPath = fileMapKeys[0];
        const firstPathParts = firstPath.split('/');
        if (firstPathParts.length > 1) {
            const potentialRoot = firstPathParts[0];
            if (fileMapKeys.every(p => p.startsWith(potentialRoot + '/') || p === potentialRoot)) {
                rootPrefix = potentialRoot + '/';
            }
        }
    }

    let defaultDir = State.getCurrentSkinRoot() || "default/gui";
    if (info.isFolder && info.path) {
        defaultDir = info.path;
        if (rootPrefix && !defaultDir.toLowerCase().startsWith(rootPrefix.toLowerCase())) {
            defaultDir = rootPrefix + defaultDir;
        }
    } else if (!info.isFolder && info.path.includes('/')) {
        defaultDir = info.path.substring(0, info.path.lastIndexOf('/'));
    }

    const filename = prompt("Enter new XML filename (e.g. template.xml):", "new_skin.xml");
    if (!filename) return;

    const finalPath = defaultDir.endsWith('/') ? `${defaultDir}${filename}` : `${defaultDir}/${filename}`;
    const normalized = finalPath.toLowerCase();

    if (State.getFileMap().has(normalized)) {
        showToast("File already exists!", "warning");
        return;
    }

    const initialXml = `<?xml version="1.0" encoding="utf-8"?>\n<Skin>\n    \n</Skin>`;
    State.getFileMap().set(normalized, initialXml);
    populateFileBrowser();
    showToast(`Created new XML: ${filename}`, "info");
}

function handleNewFolder() {
    const info = getSelectedTreeItemInfo();
    
    let rootPrefix = '';
    const fileMapKeys = Array.from(State.getFileMap().keys());
    if (fileMapKeys.length > 0) {
        const firstPath = fileMapKeys[0];
        const firstPathParts = firstPath.split('/');
        if (firstPathParts.length > 1) {
            const potentialRoot = firstPathParts[0];
            if (fileMapKeys.every(p => p.startsWith(potentialRoot + '/') || p === potentialRoot)) {
                rootPrefix = potentialRoot + '/';
            }
        }
    }

    let defaultDir = State.getCurrentSkinRoot() || "default/gui";
    if (info.isFolder && info.path) {
        defaultDir = info.path;
        if (rootPrefix && !defaultDir.toLowerCase().startsWith(rootPrefix.toLowerCase())) {
            defaultDir = rootPrefix + defaultDir;
        }
    } else if (!info.isFolder && info.path.includes('/')) {
        defaultDir = info.path.substring(0, info.path.lastIndexOf('/'));
    }

    const folderName = prompt("Enter new folder name:", "NewFolder");
    if (!folderName) return;

    const finalDir = defaultDir.endsWith('/') ? defaultDir : `${defaultDir}/`;
    const placeholderPath = `${finalDir}${folderName}/.init.xml`;
    const normalizedPath = placeholderPath.toLowerCase();

    if (State.getFileMap().has(normalizedPath)) {
        showToast("Folder structure already exists!", "warning");
        return;
    }

    const initialXml = `<?xml version="1.0" encoding="utf-8"?>\n<FolderInit />`;
    State.getFileMap().set(normalizedPath, initialXml);
    populateFileBrowser();
    showToast(`Created new folder structure: ${folderName}`, "info");
}

function handleSidebarImport(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const info = getSelectedTreeItemInfo();
    let targetDir = State.getCurrentSkinRoot() || "default/gui";
    if (info.isFolder && info.path) {
        targetDir = info.path;
    } else if (!info.isFolder && info.path.includes('/')) {
        targetDir = info.path.substring(0, info.path.lastIndexOf('/'));
    }

    let loadedCount = 0;
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        const finalPath = targetDir.endsWith('/') ? `${targetDir}${file.name}` : `${targetDir}/${file.name}`;
        const normalizedPath = finalPath.toLowerCase();

        if (['.png', '.jpg', '.jpeg', '.svg'].includes(extension)) {
            reader.onload = (e) => {
                const blob = new Blob([e.target.result], { type: file.type });
                const blobUrl = URL.createObjectURL(blob);
                State.getImageBlobUrls().set(normalizedPath, blobUrl);
                State.getFileMap().set(normalizedPath, "");
                loadedCount++;
                if (loadedCount === files.length) {
                    populateFileBrowser();
                    showToast(`Imported ${files.length} asset(s) successfully`, "info");
                }
            };
            reader.readAsArrayBuffer(file);
        } else if (['.ttf', '.otf'].includes(extension)) {
            reader.onload = (e) => {
                const blob = new Blob([e.target.result], { type: file.type });
                const blobUrl = URL.createObjectURL(blob);
                State.getFontBlobUrls().set(normalizedPath, blobUrl);
                State.getFileMap().set(normalizedPath, "");
                loadedCount++;
                if (loadedCount === files.length) {
                    populateFileBrowser();
                    showToast(`Imported ${files.length} asset(s) successfully`, "info");
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            reader.onload = (e) => {
                State.getFileMap().set(normalizedPath, e.target.result);
                loadedCount++;
                if (loadedCount === files.length) {
                    populateFileBrowser();
                    showToast(`Imported ${files.length} asset(s) successfully`, "info");
                }
            };
            reader.readAsText(file);
        }
    });
}

function handleRemoveItem() {
    const info = getSelectedTreeItemInfo();
    if (!info.path) {
        showToast("Select a file or folder to remove.", "warning");
        return;
    }

    if (!confirm(`Are you sure you want to remove: ${info.path}?`)) return;

    const normalizedTarget = info.path.toLowerCase();
    if (info.isFolder) {
        let rootPrefix = '';
        const fileMapKeys = Array.from(State.getFileMap().keys());
        if (fileMapKeys.length > 0) {
            const firstPath = fileMapKeys[0];
            const firstPathParts = firstPath.split('/');
            if (firstPathParts.length > 1) {
                const potentialRoot = firstPathParts[0];
                if (fileMapKeys.every(p => p.startsWith(potentialRoot + '/') || p === potentialRoot)) {
                    rootPrefix = potentialRoot + '/';
                }
            }
        }

        let folderPath = normalizedTarget;
        if (rootPrefix && !folderPath.startsWith(rootPrefix.toLowerCase())) {
            folderPath = rootPrefix.toLowerCase() + folderPath;
        }
        const prefix = folderPath.endsWith('/') ? folderPath : folderPath + '/';

        State.getFileMap().forEach((_, key) => {
            if (key.startsWith(prefix)) State.getFileMap().delete(key);
        });
        State.getImageBlobUrls().forEach((_, key) => {
            if (key.startsWith(prefix)) State.getImageBlobUrls().delete(key);
        });
        State.getFontBlobUrls().forEach((_, key) => {
            if (key.startsWith(prefix)) State.getFontBlobUrls().delete(key);
        });
        showToast(`Removed folder branch: ${info.path}`, "info");
    } else {
        State.getFileMap().delete(normalizedTarget);
        State.getImageBlobUrls().delete(normalizedTarget);
        State.getFontBlobUrls().delete(normalizedTarget);
        showToast(`Removed file: ${info.path}`, "info");
    }
    populateFileBrowser();
}

async function handleExportItem() {
    const info = getSelectedTreeItemInfo();
    if (!info.path) {
        showToast("Select a file or folder to export.", "warning");
        return;
    }

    const normalizedTarget = info.path.toLowerCase();
    
    let rootPrefix = '';
    const fileMapKeys = Array.from(State.getFileMap().keys());
    if (fileMapKeys.length > 0) {
        const firstPath = fileMapKeys[0];
        const firstPathParts = firstPath.split('/');
        if (firstPathParts.length > 1) {
            const potentialRoot = firstPathParts[0];
            if (fileMapKeys.every(p => p.startsWith(potentialRoot + '/') || p === potentialRoot)) {
                rootPrefix = potentialRoot + '/';
            }
        }
    }

    if (info.isFolder) {
        if (!window.JSZip) {
            showToast("ZIP library not loaded yet.", "error");
            return;
        }
        showToast("Generating ZIP archive...", "info");
        const zip = new window.JSZip();
        
        let folderPath = normalizedTarget;
        if (rootPrefix && !folderPath.startsWith(rootPrefix.toLowerCase())) {
            folderPath = rootPrefix.toLowerCase() + folderPath;
        }
        const prefix = folderPath.endsWith('/') ? folderPath : folderPath + '/';
        let count = 0;

        const uniqueKeys = new Set();
        State.getFileMap().forEach((_, k) => { if (k.startsWith(prefix)) uniqueKeys.add(k); });
        State.getImageBlobUrls().forEach((_, k) => { if (k.startsWith(prefix)) uniqueKeys.add(k); });
        State.getFontBlobUrls().forEach((_, k) => { if (k.startsWith(prefix)) uniqueKeys.add(k); });

        for (const key of uniqueKeys) {
            if (key.endsWith('.keep') || key.endsWith('.init.xml')) continue;
            
            const zipPath = key.substring(prefix.lastIndexOf('/', prefix.length - 2) + 1);

            if (State.getImageBlobUrls().has(key)) {
                try {
                    const res = await fetch(State.getImageBlobUrls().get(key));
                    const blob = await res.blob();
                    zip.file(zipPath, blob);
                    count++;
                } catch (e) {
                    console.error("Failed to fetch image blob for zip:", key, e);
                }
            } else if (State.getFontBlobUrls().has(key)) {
                try {
                    const res = await fetch(State.getFontBlobUrls().get(key));
                    const blob = await res.blob();
                    zip.file(zipPath, blob);
                    count++;
                } catch (e) {
                    console.error("Failed to fetch font blob for zip:", key, e);
                }
            } else {
                const content = State.getFileMap().get(key);
                if (content !== undefined && content !== null) {
                    zip.file(zipPath, content);
                    count++;
                }
            }
        }

        if (count === 0) {
            showToast("No files found inside folder branch to export.", "warning");
            return;
        }

        try {
            const contentBlob = await zip.generateAsync({ type: "blob" });
            const folderName = info.path.split('/').pop() || "folder";
            const element = document.createElement('a');
            element.href = URL.createObjectURL(contentBlob);
            element.download = `${folderName}.zip`;
            element.style.display = 'none';
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
            showToast(`Successfully downloaded ${folderName}.zip. (Reminder: Save the root of the skin in the "USER" folder to apply it as a user skin.)`, "info", 6000);
        } catch (err) {
            console.error("ZIP generation error:", err);
            showToast("Failed to generate zip file archive.", "error");
        }
    } else {
        let fileKey = normalizedTarget;
        if (rootPrefix && !fileKey.startsWith(rootPrefix.toLowerCase())) {
            fileKey = rootPrefix.toLowerCase() + fileKey;
        }
        
        const filename = info.path.substring(info.path.lastIndexOf('/') + 1);
        
        if (State.getImageBlobUrls().has(fileKey)) {
            try {
                const res = await fetch(State.getImageBlobUrls().get(fileKey));
                const blob = await res.blob();
                const element = document.createElement('a');
                element.href = URL.createObjectURL(blob);
                element.download = filename;
                element.style.display = 'none';
                document.body.appendChild(element);
                element.click();
                document.body.removeChild(element);
                showToast(`Exported asset: ${filename}`, "info");
            } catch(e) {
                showToast("Failed to download image asset.", "error");
            }
        } else if (State.getFontBlobUrls().has(fileKey)) {
            try {
                const res = await fetch(State.getFontBlobUrls().get(fileKey));
                const blob = await res.blob();
                const element = document.createElement('a');
                element.href = URL.createObjectURL(blob);
                element.download = filename;
                element.style.display = 'none';
                document.body.appendChild(element);
                element.click();
                document.body.removeChild(element);
                showToast(`Exported asset: ${filename}`, "info");
            } catch(e) {
                showToast("Failed to download font asset.", "error");
            }
        } else {
            const content = State.getFileMap().get(fileKey) || "";
            triggerDownload(filename, content);
            showToast(`Exported asset: ${filename}`, "info");
        }
    }
}

function triggerDownload(filename, content) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function handleDebugToggle() {
    const debugCheckbox = getDebugCheckbox();
    const debugToggleButton = getDebugToggleButton();
    const debugOverlayElement = getDebugOverlay();

    if (debugCheckbox && debugToggleButton && debugOverlayElement) {
        const isCurrentlyChecked = debugToggleButton.getAttribute('aria-checked') === 'true';
        const newCheckedState = !isCurrentlyChecked;

        debugCheckbox.checked = newCheckedState; // Keep hidden checkbox in sync
        debugToggleButton.setAttribute('aria-checked', String(newCheckedState));
        debugToggleButton.classList.toggle('active', newCheckedState);
        debugToggleButton.title = newCheckedState ? "Disable Edit Mode" : "Toggle Edit Mode";
        const debugIcon = debugToggleButton.querySelector('i');
        if (debugIcon) {
            debugIcon.className = newCheckedState ? 'iconoir-pen-connect-wifi' : 'iconoir-edit-pencil';
        }
        State.setDebugEnabled(newCheckedState); // Update global state
        document.body.classList.toggle('edit-mode-active', newCheckedState);

        debugOverlayElement.style.display = newCheckedState ? 'block' : 'none';
        if (!newCheckedState && debugOverlayElement) { // Clear overlay when disabling
            debugOverlayElement.textContent = '';
            cancelCanvasInsertMode();
        }
        showToast(`Edit Mode: ${newCheckedState ? 'ON' : 'OFF'}`, 'info', 1500);
    } else {
        logError("Debug checkbox, toggle button, or debug overlay element not found.", null, true);
    }
}

function handleConsoleButtonClick() {
    const consoleModalElement = getConsoleModal();
    if (consoleModalElement) {
        const isVisibleNow = !consoleModalElement.classList.contains('visible');
        State.setIsConsoleVisible(isVisibleNow);
        const visibilityChanged = toggleModalVisibility(consoleModalElement, isVisibleNow);
        if (visibilityChanged && isVisibleNow) {
            updateConsoleView();
        }
    } else {
        logError("Console modal element not found.", null, true);
    }
}

/** Updates the visual content of the console log modal */
export function updateConsoleView() {
    const output = getConsoleLogOutput();
    if (!output) return;

    const showInfo = document.getElementById('console-filter-info')?.checked !== false;
    const showWarn = document.getElementById('console-filter-warn')?.checked !== false;
    const showError = document.getElementById('console-filter-error')?.checked !== false;

    const logs = State.getConsoleLogContent();
    const filteredLogs = logs.filter(log => {
        if (log.type === 'error' || log.type === 'failure') return showError;
        if (log.type === 'warn' || log.type === 'warning') return showWarn;
        return showInfo;
    });

    if (filteredLogs.length === 0) {
        output.innerHTML = '<div class="text-gray-500 italic">No matching log entries.</div>';
        return;
    }

    output.innerHTML = filteredLogs.map(log => {
        const time = log.timestamp.toLocaleTimeString();
        const colorClass = log.type === 'error' ? 'text-red-400' : (log.type === 'warn' ? 'text-yellow-400' : 'text-gray-300');
        const prefix = log.type === 'error' ? '[ERROR] ' : (log.type === 'warn' ? '[WARN] ' : '');
        return `<div class="mb-1 font-mono"><span class="text-gray-500">[${time}]</span> <span class="${colorClass}">${prefix}${log.message}</span></div>`;
    }).join('');
    
    // Auto-scroll the content area to the bottom
    const content = document.getElementById('console-content');
    if (content) {
        content.scrollTop = content.scrollHeight;
    }
}

// Map it to window so state.js internalAddLog can trigger it
window.updateConsoleView = updateConsoleView;

function handleConsoleClear() {
    State.clearConsoleLog();
    updateConsoleView();
    updateConsoleButtonErrorState(false);
}

function handleConsoleCopy() {
    const logs = State.getConsoleLogContent();
    const text = logs.map(l => `[${l.timestamp.toLocaleTimeString()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text).then(() => showToast("Console log copied to clipboard", "info"));
}

function handleSidebarPreviewAreaClick() {
    if (!previewArea || !previewItemModal || !previewItemModalContent || !previewItemModalTitle) {
        logError("Preview modal elements not properly initialized for click.", null, true);
        return;
    }
    const currentContentElement = previewArea.firstChild;
    let titleText = "Preview";
    const previewedFilePath = previewArea.dataset.previewedFilePath;
    const previewedFileType = previewArea.dataset.previewedFileType;

    if (previewedFileType === 'xml' && previewedFilePath) {
        openXmlEditor(previewedFilePath);
        return;
    }

    if (previewedFileType === 'html') {
        return;
    }

    if (previewedFilePath) {
         const fileName = previewedFilePath.substring(previewedFilePath.lastIndexOf('/') + 1);
         if (fileName) titleText = `Preview: ${fileName}`;
    }
    previewItemModalTitle.textContent = titleText;

    let contentToClone = null;
    if (currentContentElement && (currentContentElement.tagName === 'IMG' || currentContentElement.tagName === 'svg' || currentContentElement.tagName === 'PRE' || currentContentElement.classList.contains('font-preview'))) {
        contentToClone = currentContentElement.cloneNode(true);
        contentToClone.style.transform = ''; // Clear prior sidebar zoom transformations on popup launch
    } else if (previewArea.textContent && previewArea.textContent.trim() !== "Click a file to preview" && previewArea.textContent.trim() !== "Loading preview...") {
        const pre = document.createElement('pre');
        pre.className = 'text-xs p-2 whitespace-pre-wrap break-words';
        pre.textContent = previewArea.textContent; // Already escaped by previewArea population
        contentToClone = pre;
    }

    if (contentToClone) {
        previewItemModalContent.innerHTML = '';
        previewItemModalContent.appendChild(contentToClone);

        const previewEditBtn = document.getElementById('preview-edit-button');
        if (previewEditBtn) {
            if (previewedFileType === 'svg' || previewedFileType === 'xml') {
                previewEditBtn.style.display = 'block';
                previewEditBtn.onclick = () => {
                    closePreviewItemModal();
                    openXmlEditor(previewedFilePath);
                };
            } else {
                previewEditBtn.style.display = 'none';
            }
        }
        
        // Pure CSS scale-based zoom for images/svgs/fonts in the popup preview window modal
        previewItemModalContent.onwheel = null;
        const normalizedTag = contentToClone.tagName ? contentToClone.tagName.toUpperCase() : '';
        if (normalizedTag === 'IMG' || normalizedTag === 'SVG' || contentToClone.classList.contains('font-preview')) {
            let currentZoom = 1.0;
            contentToClone.style.transformOrigin = 'center center';
            contentToClone.style.transition = 'transform 0.05s ease-out';
            
            previewItemModalContent.onwheel = (e) => {
                e.preventDefault();
                const zoomFactor = 0.15;
                if (e.deltaY < 0) {
                    currentZoom *= (1 + zoomFactor);
                } else {
                    currentZoom *= (1 - zoomFactor);
                }
                currentZoom = Math.max(0.1, Math.min(currentZoom, 15));
                contentToClone.style.transform = `scale(${currentZoom})`;
            };
        }
        
        toggleModalVisibility(previewItemModal, true); // Show the modal
    } else {
        showToast("No previewable content selected.", "info");
    }
}

function closePreviewItemModal() {
    if (previewItemModal) {
        toggleModalVisibility(previewItemModal, false); // Hide the modal
        const previewEditBtn = document.getElementById('preview-edit-button');
        if (previewEditBtn) previewEditBtn.style.display = 'none';
        if (previewItemModalContent) {
            previewItemModalContent.innerHTML = '';
            previewItemModalContent.onwheel = null; // Clean up wheel event on close
        }
    }
}

// Removed escapeHtml as it's not used here; if needed elsewhere, it should be in domUtils.

async function handleExportProjectZip() {
    if (!window.JSZip) {
        showToast("ZIP library not loaded yet.", "error");
        return;
    }
    if (State.getFileMap().size === 0) {
        showToast("No project files loaded to save.", "warning");
        return;
    }
    showToast("Generating full project ZIP archive...", "info");
    const zip = new window.JSZip();
    let count = 0;

    const uniqueKeys = new Set();
    State.getFileMap().forEach((_, k) => uniqueKeys.add(k));
    State.getImageBlobUrls().forEach((_, k) => uniqueKeys.add(k));
    State.getFontBlobUrls().forEach((_, k) => uniqueKeys.add(k));

    for (const key of uniqueKeys) {
        if (key.endsWith('.keep') || key.endsWith('.init.xml')) continue;

        if (State.getImageBlobUrls().has(key)) {
            try {
                const res = await fetch(State.getImageBlobUrls().get(key));
                const blob = await res.blob();
                zip.file(key, blob);
                count++;
            } catch (e) {
                console.error("Failed to fetch image blob for zip:", key, e);
            }
        } else if (State.getFontBlobUrls().has(key)) {
            try {
                const res = await fetch(State.getFontBlobUrls().get(key));
                const blob = await res.blob();
                zip.file(key, blob);
                count++;
            } catch (e) {
                console.error("Failed to fetch font blob for zip:", key, e);
            }
        } else {
            const content = State.getFileMap().get(key);
            if (content !== undefined && content !== null) {
                zip.file(key, content);
                count++;
            }
        }
    }

    try {
        const contentBlob = await zip.generateAsync({ type: "blob" });
        const element = document.createElement('a');
        element.href = URL.createObjectURL(contentBlob);

        const dateStr = new Date().toISOString().split('T')[0];
        let productStr = "product";
        let skinStr = "skin";
        const skinRoot = State.getCurrentSkinRoot();
        if (skinRoot) {
            const parts = skinRoot.split('/').filter(Boolean);
            if (parts.length > 0) productStr = parts[0];
            if (parts.length > 1) skinStr = parts[parts.length - 1];
        }

        element.download = `${productStr}_${dateStr}_${skinStr}.zip`;
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        State.clearHistory();
        showToast(`Successfully downloaded full project archive. (Reminder: Save the root of the skin in the "USER" folder to apply it as a user skin.)`, "info", 6000);
    } catch (err) {
        console.error("ZIP generation error:", err);
        showToast("Failed to generate zip file archive.", "error");
    }
}

function updateSaveButtonVisualState() {
    const saveBtn = document.getElementById('save-project-button');
    if (!saveBtn) return;
    const isDirty = State.canUndo();
    const icon = saveBtn.querySelector('i');
    if (isDirty) {
        saveBtn.classList.add('dirty');
        if (icon) {
            icon.className = 'iconoir-download-square-solid';
        }
    } else {
        saveBtn.classList.remove('dirty');
        if (icon) {
            icon.className = 'iconoir-download-square';
        }
    }
}

export function updateConsoleButtonErrorState(hasErrors) {
    const consoleButton = getConsoleButton();
    if (consoleButton) {
        toggleElementErrorClass(consoleButton, 'error', hasErrors);
    }
}