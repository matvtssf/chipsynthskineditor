// File: cs/main.js
/**
 * main.js - Main application entry point
 * ADDED: Setup call for slider interactions.
 * ADDED: Debugger statement at the very beginning for early DOM inspection.
 * CORRECTED: Import and call for sidebar controls initialization.
 */

// debugger; 

import * as State from './state.js';
import { loadInitialElementReferenceData, loadInitialParamReferenceData } from './references.js';
import { initializeXmlEditor } from './xmlEditor.js'; 
import { updateStatus, getStatusDiv, logError, showToast, getAcknowledgeDisclaimerButton, getDisclaimerModal, getLoadFolderButton } from './domUtils.js';
// Corrected import from sidebarControlsInteractions.js
import { initializeSidebarControls } from './sidebarControlsInteractions.js'; 
import { setupReferenceModalListeners } from './elementRefModalInteractions.js';
import { setupParamReferenceModalListeners } from './paramRefModalInteractions.js';
import { setupAttributeEditorModalListeners } from './attributeEditorInteractions.js';
import { setupXmlEditorListeners } from './xmlEditorInteractions.js';
import { setupMainContentInteractions } from './mainContentInteractions.js';
import { setupGlobalListeners } from './globalListeners.js';
import { setupButtonListeners } from './buttonInteractions.js'; 
import { setupSliderListeners } from './sliderInteractions.js'; 

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

        // Disclaimer Logic
        const ackButton = getAcknowledgeDisclaimerButton();
        const discModal = getDisclaimerModal();
        const loadBtn = getLoadFolderButton();

        if (ackButton && discModal && loadBtn) {
            if (discModal.classList.contains('visible')) {
                loadBtn.disabled = true;
                console.log("Disclaimer visible, load button disabled until acknowledged.");
                ackButton.addEventListener('click', () => {
                    console.log("Disclaimer acknowledged: Initiating blur dissolution and logo glitch.");
                    
                    // Trigger the text logo digital glitch block
                    const textLogo = document.getElementById('text-logo');
                    if (textLogo) {
                        textLogo.classList.add('logo-glitch-active');
                        textLogo.addEventListener('animationend', () => {
                            textLogo.classList.remove('logo-glitch-active');
                        }, { once: true });
                    }

                    if (discModal) {
                        discModal.classList.add('dissolve-blur-active');
                        discModal.addEventListener('animationend', () => {
                            discModal.classList.remove('visible');
                            discModal.classList.remove('dissolve-blur-active');
                            discModal.style.display = 'none';
                        }, { once: true });
                    }
                    if (loadBtn) {
                        loadBtn.disabled = false; // Enable the load button
                        console.log("Load button enabled after disclaimer.");
                    }
                }, { once: true });
            } else {
                loadBtn.disabled = false; // Ensure load button is enabled if disclaimer isn't visible
                console.log("Disclaimer not visible or not found, load button enabled.");
            }
        } else {
            if (!loadBtn) logError("Load folder button not found for disclaimer logic.");
            if (!discModal) logError("Disclaimer modal not found for disclaimer logic.");
        }

        updateStatus('Ready. Please load a product folder.', 0);

    } catch (error) {
        logError('Error during application initialization', error);
        updateStatus('Initialization Error! Check console.', 0);
        showToast('Critical error during initialization. Check console.', 'error', 0);
    }
}

// Removed handleDisclaimerAcknowledge as its logic is now inline for clarity

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