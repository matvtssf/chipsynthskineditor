// File: cs/main.js
/**
 * main.js - Main application entry point
 * ADDED: Setup call for slider interactions.
 * ADDED: Debugger statement at the very beginning for early DOM inspection.
 * CORRECTED: Import and call for sidebar controls initialization.
 */

import * as State from './core/state.js';
import { loadInitialElementReferenceData, loadInitialParamReferenceData } from './core/references.js';
import { initializeXmlEditor } from './core/xmlEditor.js'; 
import { updateStatus, getStatusDiv, logError, showToast, getAcknowledgeDisclaimerButton, getDisclaimerModal, getLoadFolderButton } from './core/domUtils.js';
// Corrected import from sidebarControlsInteractions.js
import { initializeSidebarControls } from './interactions/sidebarControlsInteractions.js'; 
import { setupReferenceModalListeners } from './interactions/elementRefModalInteractions.js';
import { setupParamReferenceModalListeners } from './interactions/paramRefModalInteractions.js';
import { setupAttributeEditorModalListeners } from './interactions/attributeEditorInteractions.js';
import { setupXmlEditorListeners } from './interactions/xmlEditorInteractions.js';
import { setupMainContentInteractions } from './interactions/mainContentInteractions.js';
import { setupGlobalListeners } from './interactions/globalListeners.js';
import { setupButtonListeners } from './interactions/buttonInteractions.js'; 
import { setupSliderListeners } from './interactions/sliderInteractions.js'; 
import { setupCanvasInsertInteractions } from './interactions/canvasInsertInteractions.js';

/** Capture browser console logs and route them to our UI console */
function setupConsoleInterception() {
    const originalError = console.error;
    console.error = (...args) => {
        const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ');
        // Duplication Guard: Don't re-intercept errors coming explicitly from logError framework calls
        if (!message.includes('[Error]') && !message.includes('[CRITICAL Error]')) {
            State.addConsoleLogEntry(message, 'error');
            // Live Panel Refresh: If the modal is currently open, push the update to the viewport immediately
            if (typeof window.updateConsoleView === 'function' && document.getElementById('console-modal')?.classList.contains('visible')) {
                window.updateConsoleView();
            }
        }
        originalError.apply(console, args);
    };

    const originalWarn = console.warn;
    console.warn = (...args) => {
        const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ');
        if (!message.includes('Asset Fallback:')) {
            State.addConsoleLogEntry(message, 'warn');
            // Live Panel Refresh: Update the panel if visible
            if (typeof window.updateConsoleView === 'function' && document.getElementById('console-modal')?.classList.contains('visible')) {
                window.updateConsoleView();
            }
        }
        originalWarn.apply(console, args);
    };
}

/** Initialize application */
async function initializeApp() {
    setupConsoleInterception();
    const savedTheme = localStorage.getItem('chipsynth-editor-theme') || 'dark';
    document.body.setAttribute('data-app-theme', savedTheme);
    console.log('Initializing application...');
    updateStatus('Loading reference data...');

    try {
        await Promise.all([
            loadInitialElementReferenceData(),
            loadInitialParamReferenceData()
        ]);
        updateStatus('Reference data loaded.');
        console.log("Reference data loading complete.");

        console.log("Setting up interaction modules...");
        setupReferenceModalListeners();
        setupParamReferenceModalListeners();
        setupAttributeEditorModalListeners();
        setupXmlEditorListeners();
        initializeXmlEditor();
        initializeSidebarControls(); // Call the main initializer for sidebar controls
        setupMainContentInteractions();
        setupGlobalListeners();
        setupButtonListeners(); 
        setupSliderListeners(); 
        setupCanvasInsertInteractions();
        console.log("Interaction modules setup complete.");

        // Disclaimer Visibility State Control
        const discModal = getDisclaimerModal();
        const loadBtn = getLoadFolderButton();

        if (discModal && loadBtn) {
            if (discModal.classList.contains('visible')) {
                loadBtn.disabled = true;
                console.log("Disclaimer visible, load button disabled until acknowledged.");
            } else {
                loadBtn.disabled = false; // Ensure load button is enabled if disclaimer isn't visible
                console.log("Disclaimer not visible or not found, load button enabled.");
            }
        }

        initializeThemeManagement();
        updateStatus('Ready. Please load a product folder.', 0);

    } catch (error) {
        logError('Error during application initialization', error);
        updateStatus('Initialization Error! Check console.', 0);
        showToast('Critical error during initialization. Check console.', 'error', 0);
    }
}

function initializeThemeManagement() {
    const savedTheme = localStorage.getItem('chipsynth-editor-theme') || 'dark';
    document.body.setAttribute('data-app-theme', savedTheme);
}

// --- Global error handlers ---
window.addEventListener('error', (event) => {
    logError('Unhandled runtime error:', event.error || event.message);
    showToast(`Runtime Error: ${event.message}`, 'error', 5000);
});
window.addEventListener('unhandledrejection', (event) => {
    logError('Unhandled promise rejection:', event.reason);
     showToast(`Unhandled Promise Rejection: ${event.reason}`, 'error', 5000);
});

// --- Start the application ---
document.addEventListener('DOMContentLoaded', initializeApp);

// --- XML Editor Cursor Tracking Context Highlights ---
const debugStyle = document.createElement('style');
debugStyle.textContent = `
    .debug-line-highlight {
        outline: 2px dotted #ff3333 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 6px rgba(255, 51, 51, 0.6) !important;
        z-index: 999999 !important;
    }
    body.edit-mode-active #canvas-viewport {
        box-shadow: inset 0 0 40px rgba(239, 68, 68, 0.6), 0 0 30px rgba(239, 68, 68, 0.4) !important;
        border: 2px solid rgba(239, 68, 68, 0.8) !important;
        transition: box-shadow 0.25s ease-in-out, border-color 0.25s ease-in-out;
    }
    body.edit-mode-active .grid-visible,
    body.edit-mode-active .grid-active,
    body.edit-mode-active #gui-zoom-canvas.grid-active,
    body.edit-mode-active #main-content-area.grid-visible {
        background-image: 
            linear-gradient(to right, rgba(239, 68, 68, 0.75) 1.5px, transparent 1.5px), 
            linear-gradient(to bottom, rgba(239, 68, 68, 0.75) 1.5px, transparent 1.5px) !important;
        box-shadow: inset 0 0 60px rgba(239, 68, 68, 0.3) !important;
    }
    body.edit-mode-active .grid-line,
    body.edit-mode-active [class*="grid-line"] {
        background-color: #ef4444 !important;
        color: #ef4444 !important;
        border-color: #ef4444 !important;
        box-shadow: 0 0 12px #ef4444 !important;
    }
    body.edit-mode-active #debug-toggle-button {
        color: #ef4444 !important;
        background: rgba(239, 68, 68, 0.15) !important;
        border-color: #ef4444 !important;
        box-shadow: 0 0 12px rgba(239, 68, 68, 0.6) !important;
    }
    #console-button.error {
        color: #a855f7 !important;
        background: rgba(147, 51, 234, 0.15) !important;
        border-color: #a855f7 !important;
        box-shadow: 0 0 12px rgba(147, 51, 234, 0.6) !important;
    }
    #config-button.active i::before,
    #config-button.active i {
        -webkit-text-stroke: 1px currentColor;
    }

`;
document.head.appendChild(debugStyle);

const handleEditorLineSync = () => {
    const activeEl = document.activeElement;
    if (!activeEl || !activeEl.id || !activeEl.id.startsWith('xml-editor-textarea')) return;

    const text = activeEl.value;
    const selStart = activeEl.selectionStart;
    const linesBefore = text.substring(0, selStart).split('\n');
    const currentLineNum = linesBefore.length - 1;
    const currentLineText = text.split('\n')[currentLineNum] || '';

    document.querySelectorAll('.debug-line-highlight').forEach(el => {
        el.classList.remove('debug-line-highlight');
    });

    const paramMatch = currentLineText.match(/\bparam=["']([^"']+)["']/i);
    const xMatch = currentLineText.match(/\bx=["']([^"']+)["']/i);
    const yMatch = currentLineText.match(/\by=["']([^"']+)["']/i);

    let selector = '';
    if (paramMatch) {
        const pVal = String(paramMatch[1]).trim();
        selector = `[data-param="${pVal}"], [data-param-id="${pVal}"], [data-xml-attr_param="${pVal}"]`;
    } else if (xMatch && yMatch) {
        const xVal = String(xMatch[1]).trim();
        const yVal = String(yMatch[1]).trim();
        selector = `[data-xml-attr_x="${xVal}"][data-xml-attr_y="${yVal}"], [style*="left: ${xVal}px"][style*="top: ${yVal}px"]`;
    }

    if (selector) {
        const targets = document.querySelectorAll(selector);
        targets.forEach(target => {
            if (target.classList.contains('gui-element') || target.classList.contains('gui-view-container') || target.classList.contains('gui-view-container1') || target.classList.contains('gui-macro-instance-content')) {
                target.classList.add('debug-line-highlight');
            }
        });
    }
};

document.addEventListener('keyup', handleEditorLineSync);
document.addEventListener('click', handleEditorLineSync);