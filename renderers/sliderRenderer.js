// File: cs/renderers/sliderRenderer.js
import * as DomUtils from '../core/domUtils.js';

export function renderCS01Slider(xmlNode, mergedAttributes, currentParams, sourcePath) {
    const htmlElement = document.createElement('div');
    htmlElement.classList.add('gui-slider-container');

    const parsedBoxColor = DomUtils.parseColor(mergedAttributes['boxColor'] || '#23232300');
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

    const showText = mergedAttributes['show_text'] === '1';
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
    const knobColor = DomUtils.parseColor(mergedAttributes['knobColor'] || '#696969FF');

    htmlElement.dataset.param = paramId || '';
    htmlElement.dataset.vmin = vmin;
    htmlElement.dataset.vmax = vmax;
    htmlElement.dataset.vdefault = vdefault_for_display_and_ctrl_click;
    htmlElement.dataset.trueXmlVdefault = DomUtils.clamp(vdefault_from_xml, vmin, vmax);
    htmlElement.dataset.springMode = springMode ? '1' : '0';
    htmlElement.dataset.springDefaultToCenter = spring_default_to_center ? '1' : '0';
    htmlElement.dataset.showText = showText ? '1' : '0';
    htmlElement.dataset.textEditEnabled = textEditEnabled ? '1' : '0';
    htmlElement.dataset.clickOnTrack = clickOnTrack ? '1' : '0';
    htmlElement.dataset.currentValue = vdefault_for_display_and_ctrl_click;
    htmlElement.dataset.xmlAttr_stepped = mergedAttributes['stepped'] || '0';
    htmlElement.dataset.xmlAttr_valueText_format = mergedAttributes['valueText_format'] || '';
    htmlElement.dataset.containerH = containerH;
    htmlElement.dataset.knobH = knobH;
    htmlElement.dataset.knobY = knobY;

    const knob = document.createElement('div');
    knob.classList.add('gui-slider-knob');
    knob.style.position = 'absolute';
    knob.style.left = `${knobX}px`;
    knob.style.width = `${knobW}px`;
    knob.style.height = `${knobH}px`;
    knob.style.backgroundColor = knobColor;
    knob.style.cursor = 'grab';

    const trackHeight = containerH - knobH;
    const valueRange = vmax - vmin;
    let normalizedValue = 0;
    if (valueRange !== 0) {
        normalizedValue = (vdefault_for_display_and_ctrl_click - vmin) / valueRange;
    }

    const safeTrackHeight = Math.max(0, trackHeight);
    const calculatedKnobTop = DomUtils.clamp((1 - normalizedValue) * safeTrackHeight, 0, safeTrackHeight);
    let finalKnobPosition = calculatedKnobTop + knobY;

    const minKnobTopAllowed = 0;
    const maxKnobTopAllowed = Math.max(0, containerH - knobH);
    finalKnobPosition = DomUtils.clamp(finalKnobPosition, minKnobTopAllowed, maxKnobTopAllowed);
    knob.style.top = `${finalKnobPosition}px`;

    if (showText) {
        const valueText = document.createElement('span');
        valueText.classList.add('slider-value-text', 'slider-value-hidden');
        valueText.textContent = DomUtils.formatDisplayValue(vdefault_for_display_and_ctrl_click, mergedAttributes['valueText_format'], vmin, vmax);
        knob.appendChild(valueText);
        knob.style.display = 'flex';
        knob.style.alignItems = 'center';
        knob.style.justifyContent = 'center';
        knob.style.overflow = 'visible';
    }
    htmlElement.appendChild(knob);

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