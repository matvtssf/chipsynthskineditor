// File: cs/sliderInteractions.js
/**
 * sliderInteractions.js
 * Handles user interactions for CS01Slider elements.
 * FIXED: Reverted to the original precise pixel layout calculation matching controlRenderer.js.
 * FIXED: Synchronized with State.setElementState and DomUtils.triggerGenericChangeEvent.
 */
import * as State from '../core/state.js';
import * as DomUtils from '../core/domUtils.js';

const SLIDER_SENSITIVITY = 1.0; // Adjust sensitivity for dragging speed
let activeTextInput = null; // Track the currently active text input globally for now
let isDraggingKnob = false; // Track if a knob drag is currently active
let sliderTrackClickInfo = null; // Store info about a recent track click {container, resetValue}

// Global state for tracking mouse position needed for hover checks after text input blur
let lastClientX = 0;
let lastClientY = 0;
document.addEventListener('mousemove', (e) => {
    lastClientX = e.clientX;
    lastClientY = e.clientY;
}, { capture: true });

/**
 * Updates the slider's visual position and text based on a value.
 * @param {HTMLElement} container - The slider container element.
 * @param {number} value - The new value to set.
 * @param {boolean} [updateState=true] - Whether to update the dataset's currentValue and dispatch event.
 */
function updateSliderVisuals(container, value, updateState = true) {
    if (!container) return;
    const knob = container.querySelector('.gui-slider-knob');
    if (!knob) return;
    const valueTextEl = container.dataset.showText === '1' ? knob.querySelector('.slider-value-text') : null;
    const localVmin = parseFloat(container.dataset.vmin);
    const localVmax = parseFloat(container.dataset.vmax);
    const localKnobH = parseFloat(container.dataset.knobH || 0);
    const containerH = parseFloat(container.dataset.containerH || 0);
    const localTrackH = Math.max(0, containerH - localKnobH);
    const valueRange = localVmax - localVmin;
    const localStepped = parseFloat(container.dataset.xmlAttr_stepped || 0);
    let clampedValue = DomUtils.clamp(value, localVmin, localVmax);
    if (localStepped > 0 && valueRange > 0) {
        clampedValue = DomUtils.quantizeValue(clampedValue, localStepped, localVmin);
        clampedValue = DomUtils.clamp(clampedValue, localVmin, localVmax);
    }
    let normalizedValue = 0;
    if (valueRange !== 0) {
        normalizedValue = (clampedValue - localVmin) / valueRange;
    }
    const knobTop = Math.max(0, Math.min(localTrackH, (1 - normalizedValue) * localTrackH));
    knob.style.top = `${knobTop.toFixed(2)}px`;
    if (updateState) {
        container.dataset.currentValue = clampedValue;
        State.setElementState(container.dataset.param, clampedValue);
        DomUtils.triggerGenericChangeEvent(container, clampedValue);
        container.dispatchEvent(new CustomEvent('sliderValueChanged', { detail: { value: clampedValue, paramId: container.dataset.param }, bubbles: true }));
    }
    if (valueTextEl) {
        valueTextEl.textContent = DomUtils.formatDisplayValue(clampedValue, container.dataset.xmlAttr_valueText_format, localVmin, localVmax);
    }
}

/** Shows the value text if it exists. Ensures content is up-to-date. */
function showValueText(container) {
    if (!container || container.dataset.showText !== '1') return;
    const knob = container.querySelector('.gui-slider-knob');
    const textEl = knob?.querySelector('.slider-value-text');
    if (textEl) {
        const currentValue = parseFloat(container.dataset.currentValue);
        textEl.textContent = DomUtils.formatDisplayValue(currentValue, container.dataset.xmlAttr_valueText_format, parseFloat(container.dataset.vmin), parseFloat(container.dataset.vmax));
        textEl.classList.remove('slider-value-hidden');
    }
}

/** Hides the value text if it exists and text edit is not active. */
function hideValueText(container) {
    if (!container || activeTextInput) return;
    const knob = container.querySelector('.gui-slider-knob');
    const textEl = knob?.querySelector('.slider-value-text');
    if (textEl) {
        textEl.classList.add('slider-value-hidden');
    }
}

/**
 * Handles mouse down event on the slider knob or track. Determines context and acts accordingly.
 * @param {MouseEvent} event
 */
function handleMouseDown(event) {
    if (event.button !== 0 || activeTextInput) return;

    const container = event.target.closest('.gui-slider-container');
    if (!container) return; // Click wasn't inside a slider

    const knob = container.querySelector('.gui-slider-knob');
    if (!knob) return;

    const isActuallyKnobClick = knob.contains(event.target);
    const clickOnTrackEnabled = container.dataset.clickOnTrack === '1';

    // Read properties specific to this slider instance
    const vmin = parseFloat(container.dataset.vmin);
    const vmax = parseFloat(container.dataset.vmax);
    const vdefault = parseFloat(container.dataset.vdefault);
    const springMode = container.dataset.springMode === '1';

    // --- Reset Logic (Ctrl+Click on Knob OR Track) ---
    if (event.ctrlKey || event.metaKey) {
        let resetValue = vdefault;
        if (springMode && vmin < 0 && vmax > 0) { resetValue = 0; }
        console.log(`[Slider Ctrl+Click] Resetting ${container.dataset.param} to ${resetValue}`);
        updateSliderVisuals(container, resetValue);
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    // --- Track Click Logic ---
    if (!isActuallyKnobClick && clickOnTrackEnabled) {
        const localKnobH = parseFloat(container.dataset.knobH || 0);
        const containerH = parseFloat(container.dataset.containerH || 0);
        const localTrackH = Math.max(0, containerH - localKnobH);
        const valueRange = vmax - vmin;

        if (localTrackH <= 0 || valueRange === 0) return;

        const rect = container.getBoundingClientRect();
        const clickYRelativeToContainer = event.clientY - rect.top;
        const targetKnobCenterY = DomUtils.clamp(clickYRelativeToContainer, localKnobH / 2, containerH - localKnobH / 2);
        const targetKnobTop = targetKnobCenterY - localKnobH / 2;
        const clampedTargetKnobTop = DomUtils.clamp(targetKnobTop, 0, localTrackH);
        const normalizedValue = localTrackH > 0 ? 1 - (clampedTargetKnobTop / localTrackH) : 0;
        let valueAfterClick = vmin + normalizedValue * valueRange;

        console.log(`[Slider Track Click] Jumping ${container.dataset.param} to ${valueAfterClick}`);
        updateSliderVisuals(container, valueAfterClick);

        if (springMode) {
            let resetValue = vdefault;
            if (vmin < 0 && vmax > 0) { resetValue = 0; }
            sliderTrackClickInfo = { container, resetValue };
            console.log(`[Slider Track Click] Spring mode active, setting reset info for mouseup.`);
        }
    } else if (!isActuallyKnobClick && !clickOnTrackEnabled) {
        return;
    }

    // --- Knob Drag Initiation ---
    const currentValue = parseFloat(container.dataset.currentValue);
    isDraggingKnob = true;
    const startY = event.clientY;
    const startValue = currentValue;

    container.classList.add('dragging');
    knob.style.cursor = 'grabbing';
    showValueText(container);

    const handleMouseMove = (moveEvent) => {
        if (!isDraggingKnob) return;
        moveEvent.preventDefault();

        const deltaY = startY - moveEvent.clientY;
        const valueRange = vmax - vmin;
        const valueChange = (deltaY / 150) * (valueRange || 1) * SLIDER_SENSITIVITY;
        let newValue = startValue + valueChange;

        updateSliderVisuals(container, newValue);
        showValueText(container);
    };

    const handleMouseUp = (upEvent) => {
        if (!isDraggingKnob) return;
        isDraggingKnob = false;

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);

        container.classList.remove('dragging');
        knob.style.cursor = 'grab';

        const isOver = container.contains(document.elementFromPoint(upEvent.clientX, upEvent.clientY));

        if (springMode) {
            let resetValue = vdefault;
            if (vmin < 0 && vmax > 0) { resetValue = 0; }
            console.log(`[Slider Knob Up] Springing ${container.dataset.param} back to ${resetValue}`);
            updateSliderVisuals(container, resetValue);
            if (!isOver && !activeTextInput) hideValueText(container);
        } else {
            if (!isOver && !activeTextInput) hideValueText(container);
        }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    event.preventDefault();
    event.stopPropagation();
}

/** Handles double click for text input if enabled. */
function handleDoubleClick(event) {
    if (activeTextInput) return;
    const targetKnob = event.target.closest('.gui-slider-knob');
    if (!targetKnob) return;
    const container = targetKnob.closest('.gui-slider-container');
    if (!container || container.dataset.textEditEnabled !== '1') return;
    event.preventDefault();
    event.stopPropagation();
    const currentValue = parseFloat(container.dataset.currentValue);
    const vmin = parseFloat(container.dataset.vmin);
    const vmax = parseFloat(container.dataset.vmax);
    const stepped = parseFloat(container.dataset.xmlAttr_stepped || 0);
    const valueTextSpan = targetKnob.querySelector('.slider-value-text');
    const input = document.createElement('input');
    input.type = 'text';
    input.classList.add('slider-value-input');
    input.value = DomUtils.formatDisplayValue(currentValue, container.dataset.xmlAttr_valueText_format, vmin, vmax);

    activeTextInput = input;
    if (valueTextSpan) valueTextSpan.style.visibility = 'hidden';
    targetKnob.style.cursor = 'text';
    targetKnob.appendChild(input);
    input.focus();
    input.select();

    const confirmValue = (fromBlur = false) => {
        if (!activeTextInput || input !== activeTextInput) return;
        const rawInput = input.value;
        let parsedValue = DomUtils.parseValueInput(rawInput);
        let finalValue = parseFloat(container.dataset.currentValue);
        if (!isNaN(parsedValue)) {
            finalValue = DomUtils.clamp(parsedValue, vmin, vmax);
            if (stepped > 0) {
                finalValue = DomUtils.quantizeValue(finalValue, stepped, vmin);
                finalValue = DomUtils.clamp(finalValue, vmin, vmax);
            }
            console.log(`[Slider Input] Confirmed value for ${container.dataset.param}: ${finalValue}`);
            updateSliderVisuals(container, finalValue);
        } else if (!fromBlur) {
            DomUtils.showToast(`Invalid number entered: ${rawInput}`, 'error');
            updateSliderVisuals(container, finalValue, false);
        } else {
            updateSliderVisuals(container, finalValue, false);
        }
        cleanupInput(container, targetKnob, valueTextSpan);
    };

    const cancelEdit = () => {
        if (!activeTextInput || input !== activeTextInput) return;
        console.log(`[Slider Input] Cancelled edit for ${container.dataset.param}`);
        updateSliderVisuals(container, parseFloat(container.dataset.currentValue), false);
        cleanupInput(container, targetKnob, valueTextSpan);
    };

    const cleanupInput = (container, knob, textSpan) => {
        if (!activeTextInput || input !== activeTextInput) return;
        input.removeEventListener('blur', handleBlur);
        input.removeEventListener('keydown', handleInputKeydown);
        if (input.parentNode === knob) {
            knob.removeChild(input);
        }
        if (textSpan) textSpan.style.visibility = 'visible';
        targetKnob.style.cursor = 'grab';
        activeTextInput = null;
        const isOver = container.contains(document.elementFromPoint(lastClientX, lastClientY));
        if (container.dataset.showText === '1') {
            if (isOver) {
                showValueText(container);
            } else {
                hideValueText(container);
            }
        }
    };

    const handleInputKeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirmValue();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    };

    const handleBlur = () => {
        setTimeout(() => {
            if (activeTextInput === input) {
                confirmValue(true);
            }
        }, 150);
    };

    input.addEventListener('blur', handleBlur, { once: true });
    input.addEventListener('keydown', handleInputKeydown);
}

/** Handles hover enter event for sliders. */
function handleMouseEnter(event) {
    const container = event.target.closest('.gui-slider-container');
    if (container && container.dataset.showText === '1' && !isDraggingKnob && !activeTextInput) {
        showValueText(container);
    }
}

/** Handles hover leave event for sliders. */
function handleMouseLeave(event) {
    const container = event.target.closest('.gui-slider-container');
    if (container && !isDraggingKnob && !activeTextInput) {
        hideValueText(container);
    }
}

/** Global mouseup listener specifically for handling track click spring-back */
function handleGlobalMouseUp(event) {
    if (event.button !== 0) return;

    if (!isDraggingKnob && sliderTrackClickInfo) {
        const { container, resetValue } = sliderTrackClickInfo;
        console.log(`[Slider Global Up] Track click detected for ${container.dataset.param}. Springing back to ${resetValue}.`);
        updateSliderVisuals(container, resetValue);
        const isOver = container.contains(document.elementFromPoint(event.clientX, event.clientY));
        if (!isOver && !activeTextInput) {
            hideValueText(container);
        } else if (isOver && !activeTextInput && container.dataset.showText === '1') {
            showValueText(container);
        }
    }
    sliderTrackClickInfo = null;
}

/** Sets up event listeners for sliders using event delegation. */
export function setupSliderListeners() {
    console.log("[sliderInteractions] Setting up slider listeners (Original Structure)...");
    const guiWrapper = DomUtils.getGuiContentWrapper() || DomUtils.getSkinContainerActual();
    if (!guiWrapper) {
        console.error("[sliderInteractions] Cannot setup listeners: wrapper not found.");
        return;
    }

    if (!guiWrapper.dataset.sliderListenersAttached) {
        guiWrapper.addEventListener('mousedown', handleMouseDown);
        guiWrapper.addEventListener('dblclick', handleDoubleClick);
        guiWrapper.addEventListener('mouseover', handleMouseEnter);
        guiWrapper.addEventListener('mouseout', handleMouseLeave);

        if (!document.body.dataset.globalSliderMouseupListenerAttached) {
            document.body.addEventListener('mouseup', handleGlobalMouseUp);
            document.body.dataset.globalSliderMouseupListenerAttached = 'true';
            console.log("[sliderInteractions] Global mouseup listener for track click spring attached.");
        }

        guiWrapper.dataset.sliderListenersAttached = 'true';
        console.log("[sliderInteractions] Slider listeners attached to wrapper.");
    }
}