// File: cs/configModalInteractions.js
/**
 * configModalInteractions.js
 * Handles interactions within the configuration modal.
 * ADDED: Handling for Simulate Splash/Overlay toggle.
 * FIXED: Pass the actual modal element to toggleModalVisibility, not its ID.
 * FIXED: Correctly import and use getGuiZoomCanvas from domUtils.
 * MODIFIED: Ensure setupConfigModalListeners is called from handleConfigToggle.
 * ADDED: Logging for close button and grid toggle clicks.
 */
import * as State from '../core/state.js';
import { applyCurrentBackgroundColor, showToast, logError } from '../core/domUtils.js';
import { toggleModalVisibility } from '../managers/modalManager.js';

import {
    getConfigModal, getCloseConfigBtn, getGridToggle, getGridToggleCheckbox,
    getMainContentArea, getBgColorInput, getBgColorValue,
    getBgModeToggle, getBgModeCheckbox,
    getGuiZoomCanvas, getConfigButton
} from '../core/domUtils.js';

let configListenersSetup = false;

/** Sets up event listeners for the config modal */
export function setupConfigModalListeners() {
    if (configListenersSetup) {
        // console.log("[configModal] Listeners already set up.");
        return;
    }

    console.log("[configModal] Attempting to set up Config Modal listeners...");
    const modal = getConfigModal();
    const closeBtn = getCloseConfigBtn();
    const gridToggle = getGridToggle();
    const gridCheckbox = getGridToggleCheckbox();
    const bgColorInput = getBgColorInput();
    const bgColorValueSpan = getBgColorValue();
    const bgModeToggle = getBgModeToggle();
    const bgModeCheckbox = getBgModeCheckbox();
    const splashToggle = document.getElementById('simulate-splash-toggle');
    const splashCheckbox = document.getElementById('simulate-splash-checkbox');
    const themeToggle = document.getElementById('theme-toggle');
    const themeCheckbox = document.getElementById('theme-toggle-checkbox');

    const gridSizeSlider = document.getElementById('grid-size-slider');
    const gridSizeValueSpan = document.getElementById('grid-size-value');
    const snapToggle = document.getElementById('snap-toggle');
    const snapCheckbox = document.getElementById('snap-toggle-checkbox');
    const snapSensitivitySlider = document.getElementById('snap-sensitivity-slider');
    const snapSensitivityValueSpan = document.getElementById('snap-sensitivity-value');
    const snapTypeSelect = document.getElementById('snap-type-select');

    if (!modal || !closeBtn || !gridToggle || !gridCheckbox || !bgColorInput || !bgColorValueSpan || !bgModeToggle || !bgModeCheckbox || !splashToggle || !splashCheckbox || !themeToggle || !themeCheckbox || !gridSizeSlider || !gridSizeValueSpan || !snapToggle || !snapCheckbox || !snapSensitivitySlider || !snapSensitivityValueSpan || !snapTypeSelect) {
        logError("[configModal setup] CRITICAL: One or more config modal elements not found during listener setup! Listeners NOT attached.", null, true);
        configListenersSetup = false; // Explicitly keep false if setup fails
        return;
    }

    gridSizeSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10) || 8;
        if (gridSizeValueSpan) gridSizeValueSpan.textContent = `${val}px`;
        State.setSnappingGrid(val);
        const viewport = document.getElementById('canvas-viewport');
        if (viewport) {
            viewport.style.setProperty('--grid-background-size', `${val}px`);
        }
    });

    snapToggle.addEventListener('click', () => {
        const newState = !snapToggle.getAttribute('aria-checked') || snapToggle.getAttribute('aria-checked') === 'false';
        snapToggle.setAttribute('aria-checked', String(newState));
        snapCheckbox.checked = newState;
        State.setSnappingEnabled(newState);
        updateGridSnapGlow();
    });

    snapSensitivitySlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10) || 8;
        if (snapSensitivityValueSpan) snapSensitivityValueSpan.textContent = `${val}px`;
        State.setSnappingSensitivity(val);
    });

    snapTypeSelect.addEventListener('change', (e) => {
        State.setSnappingMode(e.target.value);
        updateGridSnapGlow();
    });

    // Theme toggle
    themeToggle.addEventListener('click', () => {
        console.log("[configModal] themeToggle clicked!");
        const isDark = !themeToggle.getAttribute('aria-checked') || themeToggle.getAttribute('aria-checked') === 'false';
        themeToggle.setAttribute('aria-checked', String(isDark));
        themeCheckbox.checked = isDark;
        const themeValue = isDark ? 'dark' : 'light';
        document.body.setAttribute('data-app-theme', themeValue);
        localStorage.setItem('chipsynth-editor-theme', themeValue);
    });

    // Close button
    closeBtn.addEventListener('click', (event) => {
        console.log("[configModal] 'X' (closeBtn) clicked!", event.target); // ADDED LOG
        handleConfigToggle(); // This will call toggleModalVisibility to hide
    });

    // Grid toggle
    gridToggle.addEventListener('click', () => {
        console.log("[configModal] gridToggle clicked!"); // ADDED LOG
        const newState = !gridToggle.getAttribute('aria-checked') || gridToggle.getAttribute('aria-checked') === 'false';
        console.log("[configModal] gridToggle new state determined as:", newState); // ADDED LOG
        gridToggle.setAttribute('aria-checked', String(newState));
        gridCheckbox.checked = newState;
        State.setShowGridLines(newState);
        
        const mainContentArea = getMainContentArea();
        const guiZoomCanvas = getGuiZoomCanvas();

        if (mainContentArea) {
            mainContentArea.classList.toggle('grid-visible', newState);
        }
        if (guiZoomCanvas) {
             guiZoomCanvas.classList.toggle('grid-active', newState);
        }
        console.log("[configModal] gridToggle action completed."); // ADDED LOG
    });

    // Background Color Picker
    bgColorInput.addEventListener('input', (e) => {
        console.log("[configModal] bgColorInput 'input' event"); // ADDED LOG
        const newColor = e.target.value;
        if (bgColorValueSpan) bgColorValueSpan.textContent = newColor;
        State.setCustomBackgroundColor(newColor);
        if (!State.getUseDefaultBackgroundColor()) {
            applyCurrentBackgroundColor();
        }
    });
     bgColorInput.addEventListener('change', (e) => {
         console.log("[configModal] bgColorInput 'change' event"); // ADDED LOG
         const newColor = e.target.value;
         State.setCustomBackgroundColor(newColor);
         if (!State.getUseDefaultBackgroundColor()) {
             applyCurrentBackgroundColor();
         }
     });

    // Background Mode Toggle (Use Skin Default vs Custom)
    bgModeToggle.addEventListener('click', () => {
        console.log("[configModal] bgModeToggle clicked!"); // ADDED LOG
        const useDefault = !bgModeToggle.getAttribute('aria-checked') || bgModeToggle.getAttribute('aria-checked') === 'false';
        bgModeToggle.setAttribute('aria-checked', String(useDefault));
        bgModeCheckbox.checked = useDefault;
        State.setUseDefaultBackgroundColor(useDefault);
        applyCurrentBackgroundColor();
    });

    // Simulate Splash/Overlay Toggle Listener
    splashToggle.addEventListener('click', () => {
        console.log("[configModal] splashToggle clicked!"); // ADDED LOG
        const newState = !splashToggle.getAttribute('aria-checked') || splashToggle.getAttribute('aria-checked') === 'false';
        splashToggle.setAttribute('aria-checked', String(newState));
        splashCheckbox.checked = newState;
        State.setSimulateSplashOverlay(newState);
        console.log(`[configModal] Simulate Splash/Overlay toggled to: ${newState}.`);
        showToast(`Simulate Splash/Overlay: ${newState ? 'ON' : 'OFF'}. (Re-render GUI to apply)`, 'info', 3000);
    });

    configListenersSetup = true;
    console.log("[configModal] Config Modal listeners successfully attached.");
}

/** Opens or closes the config modal */
export function handleConfigToggle() {
    console.log("[configModal] handleConfigToggle called.");
    const modal = getConfigModal();
    if (!modal) {
        logError("[configModal] Config modal element not found in handleConfigToggle.", null, true);
        return;
    }

    // Ensure listeners are set up if they haven't been already.
    // This is idempotent due to the configListenersSetup flag.
    setupConfigModalListeners(); // <<< ENSURE LISTENERS ARE SET UP

    const shouldShow = !modal.classList.contains('visible');
    console.log(`[configModal] Modal is currently visible: ${!shouldShow}. Action: ${shouldShow ? 'Show' : 'Hide'}`);

    if (shouldShow) {
        initConfigModalValues();
    }
    
    const visibilityChanged = toggleModalVisibility(modal, shouldShow);
    if(visibilityChanged){
        console.log(`[configModal] Visibility toggle successful. Modal is now ${shouldShow ? 'visible' : 'hidden'}.`);
        const btn = getConfigButton();
        if (btn) {
            btn.classList.toggle('active', shouldShow);
        }
    } else {
        console.log(`[configModal] Visibility toggle did not result in a change (already in desired state or cancelled). Current visible state: ${modal.classList.contains('visible')}`);
    }
}

/** Initializes the values in the config modal based on current state */
function initConfigModalValues() {
    try {
        console.log("[configModal] Initializing modal values...");
        const gridToggle = getGridToggle();
        const gridCheckbox = getGridToggleCheckbox();
        const bgColorInput = getBgColorInput();
        const bgColorValueSpan = getBgColorValue();
        const bgModeToggle = getBgModeToggle();
        const bgModeCheckbox = getBgModeCheckbox();
        const splashToggle = document.getElementById('simulate-splash-toggle');
        const splashCheckbox = document.getElementById('simulate-splash-checkbox');
        const mainContentArea = getMainContentArea();
        const guiZoomCanvas = getGuiZoomCanvas();

        if (!gridToggle || !gridCheckbox || !bgColorInput || !bgColorValueSpan || !bgModeToggle || !bgModeCheckbox || !splashToggle || !splashCheckbox || !mainContentArea ) {
             logError("[configModal init] CRITICAL: One or more config modal elements not found for initialization!", null, true);
             return;
        }

        // Init Grid Toggle
        const showGrid = State.getShowGridLines();
        gridToggle.setAttribute('aria-checked', String(showGrid));
        gridCheckbox.checked = showGrid;
        mainContentArea.classList.toggle('grid-visible', showGrid);
        if (guiZoomCanvas) {
             guiZoomCanvas.classList.toggle('grid-active', showGrid);
        }

        // Init Grid Size
        const gridSize = State.getSnappingGrid ? State.getSnappingGrid() : 8;
        const gridSizeSlider = document.getElementById('grid-size-slider');
        const gridSizeValueSpan = document.getElementById('grid-size-value');
        if (gridSizeSlider) gridSizeSlider.value = gridSize;
        if (gridSizeValueSpan) gridSizeValueSpan.textContent = `${gridSize}px`;
        if (guiZoomCanvas && guiZoomCanvas.parentElement) {
            guiZoomCanvas.parentElement.style.setProperty('--grid-background-size', `${gridSize}px`);
        }

        // Init Snap Enablement
        const snapActive = State.getSnappingEnabled ? State.getSnappingEnabled() : false;
        const snapToggle = document.getElementById('snap-toggle');
        const snapCheckbox = document.getElementById('snap-toggle-checkbox');
        if (snapToggle && snapCheckbox) {
            snapToggle.setAttribute('aria-checked', String(snapActive));
            snapCheckbox.checked = snapActive;
        }

        // Init Snap Sensitivity
        const sensitivity = State.getSnappingSensitivity ? State.getSnappingSensitivity() : 8;
        const snapSensitivitySlider = document.getElementById('snap-sensitivity-slider');
        const snapSensitivityValueSpan = document.getElementById('snap-sensitivity-value');
        if (snapSensitivitySlider) snapSensitivitySlider.value = sensitivity;
        if (snapSensitivityValueSpan) snapSensitivityValueSpan.textContent = `${sensitivity}px`;

        // Init Snap Type
        const snapType = State.getSnappingMode ? State.getSnappingMode() : 'gridlines';
        const snapTypeSelect = document.getElementById('snap-type-select');
        if (snapTypeSelect) snapTypeSelect.value = snapType;

        // Init Background Color
        const customBgColor = State.getCustomBackgroundColor();
        bgColorInput.value = customBgColor;
        bgColorValueSpan.textContent = customBgColor;

        // Init Background Mode
        const useDefaultBg = State.getUseDefaultBackgroundColor();
        bgModeToggle.setAttribute('aria-checked', String(useDefaultBg));
        bgModeCheckbox.checked = useDefaultBg;

        // Init Theme Toggle
        const savedTheme = localStorage.getItem('chipsynth-editor-theme') || 'dark';
        const isThemeDark = (savedTheme === 'dark');
        const themeToggle = document.getElementById('theme-toggle');
        const themeCheckbox = document.getElementById('theme-toggle-checkbox');
        if (themeToggle && themeCheckbox) {
            themeToggle.setAttribute('aria-checked', String(isThemeDark));
            themeCheckbox.checked = isThemeDark;
            document.body.setAttribute('data-app-theme', savedTheme);
        }

        // Init Simulate Splash/Overlay Toggle
        const simulateSplash = State.getSimulateSplashOverlay();
        splashToggle.setAttribute('aria-checked', String(simulateSplash));
        splashCheckbox.checked = simulateSplash;

        updateGridSnapGlow();

        console.log("[configModal] Modal values initialized successfully.");
    } catch (error) {
        logError("[configModal init] Error initializing config modal values", error, true);
    }
}

export function updateGridSnapGlow() {
    const mainContentArea = getMainContentArea();
    if (!mainContentArea) return;
    const snapActive = State.getSnappingEnabled ? State.getSnappingEnabled() : false;
    const snapType = State.getSnappingMode ? State.getSnappingMode() : 'gridlines';
    if (snapActive && snapType === 'gridlines') {
        mainContentArea.classList.add('snap-grid-glow');
    } else {
        mainContentArea.classList.remove('snap-grid-glow');
    }
}