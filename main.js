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
        State.addConsoleLogEntry(message, 'warn');
        // Live Panel Refresh: Update the panel if visible
        if (typeof window.updateConsoleView === 'function' && document.getElementById('console-modal')?.classList.contains('visible')) {
            window.updateConsoleView();
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