/**
 * globalListeners.js
 * Attaches listeners to the document or body for broad interactions
 * like logo hover, modal background clicks, and global mouse state.
 * FIXED: Added imports for handlePanEnd and flashModalBorder, removed window checks.
 */

import * as State from '../core/state.js'; // For setIsMouseButtonDown
import { getTextLogo, getSidebar, getDisclaimerModal, getAcknowledgeDisclaimerButton, getLoadFolderButton } from '../core/domUtils.js';
import { handlePanEnd } from './mainContentInteractions.js'; // Sibling interaction import
import { flashModalBorder } from '../managers/modalManager.js'; // Moved up one level

// --- Initialization ---

/**
 * Sets up global event listeners attached to document or body.
 */
export function setupGlobalListeners() {
    console.log("[globalListeners] Setting up Global listeners...");

    // Centralized Disclaimer Dissolve & Activation Flow
    const ackBtn = getAcknowledgeDisclaimerButton();
    const discModal = getDisclaimerModal();
    const loadBtn = getLoadFolderButton();
    const textLogo = getTextLogo();

    if (ackBtn && discModal && !document.body.dataset.disclaimerListenerAttached) {
        ackBtn.addEventListener('click', () => {
            console.log("[globalListeners] Disclaimer acknowledged: Triggering dissolve animation loop.");
            
            // Trigger digital text logo glitch animation
            if (textLogo) {
                textLogo.classList.add('logo-glitch-active');
                textLogo.addEventListener('animationend', () => {
                    textLogo.classList.remove('logo-glitch-active');
                }, { once: true });
            }

            // Apply animation classes
            discModal.classList.add('dissolve-mist', 'dissolve-blur-active');
            
            const completeDismissal = () => {
                discModal.classList.remove('visible', 'dissolve-mist', 'dissolve-blur-active');
                discModal.style.display = 'none';
                if (loadBtn) {
                    loadBtn.disabled = false;
                    console.log("[globalListeners] Main layout unlocked: Folder loading enabled.");
                }
            };

            // Failsafe timeout filter in case transition events are missing or blocked by other CSS actions
            const animationFailsafe = setTimeout(completeDismissal, 400);

            discModal.addEventListener('animationend', () => {
                clearTimeout(animationFailsafe);
                completeDismissal();
            }, { once: true });
        });
        document.body.dataset.disclaimerListenerAttached = 'true';
    }

    // Logo Hover Effect
    // Use document.body to store listener flags (textLogo is already declared at the top of the function scope)
    if (textLogo && !document.body.dataset.logoHoverListenerAttached) {
        document.body.addEventListener('mousemove', handleLogoHover);
        document.body.dataset.logoHoverListenerAttached = 'true';
    }

    // Modal Flash on Background Click
    // Corrected: Check dataset on document.body
    if (!document.body.dataset.modalFlashListenerAttached) {
        document.addEventListener('click', handleGlobalClickForModalFlash);
        document.body.dataset.modalFlashListenerAttached = 'true'; // Set flag on body
    }

    // Global Mouse State and Pan End Trigger
    // Corrected: Check dataset on document.body
    if (!document.body.dataset.globalMouseListenersAttached) {
        document.addEventListener('mousedown', handleGlobalMouseDown);
        document.addEventListener('mouseup', handleGlobalMouseUp);
        window.addEventListener('blur', handleWindowBlur); // Stop actions if window loses focus
        document.body.dataset.globalMouseListenersAttached = 'true'; // Set flag on body
    }
}

// --- Event Handlers ---

/** Handles mouse moving over the logo area or collapsed sidebar */
function handleLogoHover(event) {
    const textLogo = getTextLogo();
    const sidebar = getSidebar();
    if (!textLogo || !sidebar) return; // Should not happen if listener is attached

    const logoRect = textLogo.getBoundingClientRect();
    const sidebarRect = sidebar.getBoundingClientRect();
    const isCollapsed = sidebar.classList.contains('collapsed');

    const isOverLogo = event.clientX >= logoRect.left && event.clientX <= logoRect.right &&
                       event.clientY >= logoRect.top && event.clientY <= logoRect.bottom;

    const isOverCollapsedSidebar = isCollapsed &&
                                   event.clientX >= sidebarRect.left && event.clientX <= sidebarRect.right &&
                                   event.clientY >= sidebarRect.top && event.clientY <= sidebarRect.bottom;

    // Add class to body to trigger CSS opacity change
    document.body.classList.toggle('logo-hover', isOverLogo || isOverCollapsedSidebar);
}


/** Global click listener to detect clicks outside the topmost visible modal and trigger flash. */
function handleGlobalClickForModalFlash(event) {
    const visibleModals = document.querySelectorAll('.modal-overlay.visible');
    if (visibleModals.length === 0) return;

    const topModalOverlay = visibleModals[visibleModals.length - 1];

    // Check if the click target is exactly the overlay backdrop
    if (event.target === topModalOverlay) {
        // Call imported function directly
        flashModalBorder(topModalOverlay); // <<< UPDATED CALL
    }
}

/** Tracks global mouse down state */
function handleGlobalMouseDown(e) {
    // Track left mouse button state primarily
    if (e.button === 0) {
        State.setIsMouseButtonDown(true);
    }
}

/** Tracks global mouse up state and potentially ends panning */
function handleGlobalMouseUp(e) {
    // Track left mouse button state primarily
    if (e.button === 0) {
        State.setIsMouseButtonDown(false);
    }
    // If the middle mouse button is released anywhere, ensure panning stops
    if (e.button === 1) {
        // Call imported function directly
         handlePanEnd(e); // <<< UPDATED CALL
    }
}

/** Handles ending actions if the window loses focus */
function handleWindowBlur() {
    console.log("[globalListeners] Window lost focus.");
    // Ensure mouse button state is reset
    State.setIsMouseButtonDown(false);
    // Ensure panning stops if active
    // Call imported function directly
     handlePanEnd(); // <<< UPDATED CALL (Call without event object)
}