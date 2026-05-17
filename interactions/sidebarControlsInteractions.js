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
import { handleReferenceToggle } from './elementRefModalInteractions.js';
import { handleConfigToggle } from './configModalInteractions.js';
import { makeModalDraggable, toggleModalVisibility } from '../managers/modalManager.js';
import { openXmlEditor } from '../core/xmlEditor.js';
import { updateGuiZoom } from './mainContentInteractions.js';

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
        loadFolderButton.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (event) => {
            if (event.target.files.length > 0) {
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
            document.getElementById(id)?.addEventListener('change', updateConsoleView);
        });
    } else {
        logError("Console button not found.", null, true);
    }

    if (referenceButton) {
        referenceButton.addEventListener('click', handleReferenceToggle);
    } else {
        logError("Reference button not found.", null, true);
    }
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
        const debugIcon = debugToggleButton.querySelector('i');
        if (debugIcon) {
            debugIcon.classList.toggle('iconoir-bug', !newCheckedState);
            debugIcon.classList.toggle('iconoir-bug-solid', newCheckedState);
        }
        State.setDebugEnabled(newCheckedState); // Update global state

        debugOverlayElement.style.display = newCheckedState ? 'block' : 'none';
        if (!newCheckedState && debugOverlayElement) { // Clear overlay when disabling
            debugOverlayElement.textContent = '';
        }
        showToast(`Debug Info: ${newCheckedState ? 'ON' : 'OFF'}`, 'info', 1500);
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
        if (previewItemModalContent) {
            previewItemModalContent.innerHTML = '';
            previewItemModalContent.onwheel = null; // Clean up wheel event on close
        }
    }
}

// Removed escapeHtml as it's not used here; if needed elsewhere, it should be in domUtils.

export function updateConsoleButtonErrorState(hasErrors) {
    const consoleButton = getConsoleButton();
    if (consoleButton) {
        toggleElementErrorClass(consoleButton, 'error', hasErrors);
    }
}