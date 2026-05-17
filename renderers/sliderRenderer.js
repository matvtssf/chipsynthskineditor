// File: cs/renderers/sliderRenderer.js
import * as DomUtils from '../core/domUtils.js';

export function renderCS01Slider(xmlNode, mergedAttributes, currentParams, sourcePath) {
    const htmlElement = document.createElement('div');
    htmlElement.classList.add('gui-slider-container');

    // Case-insensitive attribute extraction
    const parsedBoxColor = DomUtils.parseColor(mergedAttributes['boxColor'] || mergedAttributes['boxcolor'] || '#23232300');
    htmlElement.style.backgroundColor = parsedBoxColor;

    const paramId = DomUtils.getParamValue(xmlNode, currentParams.paramOffset);
    const vmin = parseFloat(mergedAttributes['vmin'] || 0);
    const vmax = parseFloat(mergedAttributes['vmax'] || 1);
    let vdefault_from_xml = parseFloat(mergedAttributes['vdefault'] || vmin);

    const springMode = mergedAttributes['spring_mode'] === '1';
    const spring_default_to_center = mergedAttributes['spring_default_to_center'] === '1';

    let vdefault_for_display_and_ctrl_click = DomUtils.clamp(vdefault_from_xml, vmin, vmax);
    if (springMode && spring_default_to_center && vmin < 0 && vmax > 0) {
        vdefault_for_display_and_ctrl_click = 0;
    }
    vdefault_for_display_and_ctrl_click = DomUtils.clamp(vdefault_for_display_and_ctrl_click, vmin, vmax);

    const alwaysShowText = mergedAttributes['show_text'] === '1' || mergedAttributes['showtext'] === '1';
    const textEditEnabled = mergedAttributes['textEdit_enabled'] === '1';
    const clickOnTrack = mergedAttributes['clickOnTrack'] === '1';

    const containerW = parseFloat(mergedAttributes['w'] || 0);
    const containerH = parseFloat(mergedAttributes['h'] || 0);

    const knobWValueFromAttrs = mergedAttributes['knob_w'];
    const knobW = parseFloat(knobWValueFromAttrs || containerW);

    let knobX;
    const knobXValueFromAttrs = mergedAttributes['knob_x'];
    if (knobXValueFromAttrs && String(knobXValueFromAttrs).toLowerCase() === 'center') {
        knobX = (containerW - knobW) / 2;
    } else {
        knobX = parseFloat(knobXValueFromAttrs || 0);
    }

    const knobY = parseFloat(mergedAttributes['knob_y'] || 0);
    const knobH = parseFloat(mergedAttributes['knob_h'] || 4);
    
    // Robust color extraction ignoring case
    const knobColor = DomUtils.parseColor(mergedAttributes['knobColor'] || mergedAttributes['knobcolor'] || '#696969FF');
    const fillColor = DomUtils.parseColor(mergedAttributes['fillColor'] || mergedAttributes['fillcolor'] || 'transparent');

    htmlElement.dataset.param = paramId || '';
    htmlElement.dataset.vmin = vmin;
    htmlElement.dataset.vmax = vmax;
    htmlElement.dataset.vdefault = vdefault_for_display_and_ctrl_click;
    htmlElement.dataset.trueXmlVdefault = DomUtils.clamp(vdefault_from_xml, vmin, vmax);
    htmlElement.dataset.springMode = springMode ? '1' : '0';
    htmlElement.dataset.springDefaultToCenter = spring_default_to_center ? '1' : '0';
    htmlElement.dataset.showText = alwaysShowText ? '1' : '0';
    htmlElement.dataset.textEditEnabled = textEditEnabled ? '1' : '0';
    htmlElement.dataset.clickOnTrack = clickOnTrack ? '1' : '0';
    htmlElement.dataset.currentValue = vdefault_for_display_and_ctrl_click;
    htmlElement.dataset.xmlAttr_stepped = mergedAttributes['stepped'] || '0';
    htmlElement.dataset.xmlAttr_valueText_format = mergedAttributes['valueText_format'] || '';
    htmlElement.dataset.containerH = containerH;
    htmlElement.dataset.knobH = knobH;
    htmlElement.dataset.knobY = knobY;

    // 1. Create the dynamic active fill element (drawn behind the knob)
    const fill = document.createElement('div');
    fill.classList.add('gui-slider-fill');
    fill.style.position = 'absolute';
    fill.style.left = '0px';
    fill.style.bottom = '0px';
    fill.style.width = '100%';
    fill.style.backgroundColor = fillColor;
    fill.style.pointerEvents = 'none'; // Clicks must pass through to the main track area
    htmlElement.appendChild(fill);

    // 2. Create the draggable knob element
    const knob = document.createElement('div');
    knob.classList.add('gui-slider-knob');
    knob.style.position = 'absolute';
    knob.style.left = `${knobX}px`;
    knob.style.width = `${knobW}px`;
    knob.style.height = `${knobH}px`;
    knob.style.backgroundColor = knobColor;
    knob.style.cursor = 'grab';
    knob.style.zIndex = '2'; // Ensures the knob stays on top of the fill layer

    // 3. Create the Value Tooltip
    // By appending the tooltip directly inside the knob, it automatically moves with it!
    const valueText = document.createElement('span');
    valueText.classList.add('slider-value-text');
    valueText.textContent = DomUtils.formatDisplayValue(vdefault_for_display_and_ctrl_click, mergedAttributes['valueText_format'], vmin, vmax);
    
    // Center the text perfectly over the knob's bounding box
    valueText.style.position = 'absolute';
    valueText.style.top = '50%';
    valueText.style.left = '50%';
    valueText.style.transform = 'translate(-50%, -50%)';
    valueText.style.pointerEvents = 'none';
    valueText.style.transition = 'opacity 0.15s ease-in-out';
    valueText.style.backgroundColor = 'rgba(25, 27, 33, 0.85)';
    valueText.style.border = '1px solid #444';
    valueText.style.padding = '2px 6px';
    valueText.style.borderRadius = '3px';
    valueText.style.whiteSpace = 'nowrap';
    valueText.style.zIndex = '10';

    if (alwaysShowText) {
        valueText.style.opacity = '1';
    } else {
        valueText.style.opacity = '0';
        knob.addEventListener('mouseenter', () => valueText.style.opacity = '1');
        knob.addEventListener('mouseleave', () => valueText.style.opacity = '0');
    }

    knob.appendChild(valueText);
    htmlElement.appendChild(knob);

    // 4. Visual Synchronization Engine
    const syncSliderVisuals = () => {
        let val = parseFloat(htmlElement.dataset.currentValue);
        if (isNaN(val)) val = vdefault_for_display_and_ctrl_click;

        const valueRange = vmax - vmin;
        let normalizedValue = valueRange !== 0 ? (val - vmin) / valueRange : 0;
        const safeTrackHeight = Math.max(0, containerH - knobH);
        
        let calculatedKnobTop = DomUtils.clamp((1 - normalizedValue) * safeTrackHeight, 0, safeTrackHeight);
        let finalKnobPosition = DomUtils.clamp(calculatedKnobTop + knobY, 0, Math.max(0, containerH - knobH));
        
        // Update knob top if it was triggered by a programmatic data change
        const currentKnobTop = parseFloat(knob.style.top) || 0;
        if (Math.abs(currentKnobTop - finalKnobPosition) > 0.5) {
            knob.style.top = `${finalKnobPosition}px`;
        }

        // Always recalculate the fill directly from the physical knob position
        const realKnobTop = parseFloat(knob.style.top) || finalKnobPosition;
        const fillHeight = containerH - realKnobTop - (knobH / 2);
        fill.style.height = `${Math.max(0, fillHeight)}px`;
        
        // Update the active text string
        valueText.textContent = DomUtils.formatDisplayValue(val, htmlElement.dataset.xmlAttr_valueText_format, vmin, vmax);
    };

    // Make the sync function externally accessible for your state manager
    htmlElement.updateVisualState = syncSliderVisuals;
    syncSliderVisuals(); // Execute once to draw initial state

    // Attach an observer so external drag scripts automatically update the fill and text 
    // seamlessly whether they change knob.style.top OR data-current-value directly
    const observer = new MutationObserver(syncSliderVisuals);
    observer.observe(knob, { attributes: true, attributeFilter: ['style'] });
    observer.observe(htmlElement, { attributes: true, attributeFilter: ['data-current-value'] });

    const postProcessFunction = (element, attrs, params, sourceXmlNode, styleNameString) => {
        const knobElement = element.querySelector('.gui-slider-knob');
        const valueTextElement = knobElement?.querySelector('.slider-value-text');
        if (valueTextElement) {
            const fontAlias = attrs['font'];
            if (fontAlias) DomUtils.applyFont(valueTextElement, fontAlias);

            const textColor = attrs['color_text'] || attrs['fontColor'];
            if (textColor) valueTextElement.style.color = DomUtils.parseColor(textColor);
        }
    };

    return {
        htmlElement: htmlElement,
        mainElementForAttributes: htmlElement,
        requiresRecursiveRender: false,
        postProcessFunction: postProcessFunction
    };
}

export function renderCS03Slider(xmlNode, mergedAttributes, currentParams, sourcePath) {
    console.warn("[sliderRenderer] CS03Slider requested but not fully implemented.");
    return {
        htmlElement: null,
        mainElementForAttributes: null,
        requiresRecursiveRender: true,
        postProcessFunction: null
    };
}