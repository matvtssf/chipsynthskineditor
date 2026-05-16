// File: cs/renderers/buttonRenderer.js
import * as DomUtils from '../domUtils.js';
import * as State from '../state.js';

export function renderCS01TextButton(xmlNode, mergedAttributes, currentParams, sourcePath) {
    const htmlElement = document.createElement('button');
    htmlElement.classList.add('gui-text-button', 'gui-control-text-button');
    htmlElement.textContent = mergedAttributes['text'] || 'Button';
    htmlElement.dataset.controlTag = mergedAttributes['controlTag'] || '';

    if (mergedAttributes['tooltip']) {
        htmlElement.setAttribute('aria-label', mergedAttributes['tooltip']);
        htmlElement.title = mergedAttributes['tooltip'];
    } else {
        htmlElement.setAttribute('aria-label', htmlElement.textContent);
    }

    return {
        htmlElement: htmlElement,
        mainElementForAttributes: htmlElement,
        requiresRecursiveRender: false,
        postProcessFunction: null
    };
}

export function renderCS01OnOffButton(xmlNode, mergedAttributes, currentParams, sourcePath) {
    const htmlElement = document.createElement('button');
    htmlElement.classList.add('gui-onoff-button');

    const commandOnOff = mergedAttributes['command'];
    const onValue = mergedAttributes['on_value'] || '1.0';
    const offValue = mergedAttributes['off_value'] || '0.0';
    const vDefaultOnOff = mergedAttributes['vdefault'] || offValue;
    const onOffParamId = DomUtils.getParamValue(xmlNode, currentParams.paramOffset);

    htmlElement.dataset.command = commandOnOff || '';
    htmlElement.dataset.onValue = onValue;
    htmlElement.dataset.offValue = offValue;
    htmlElement.dataset.vdefault = vDefaultOnOff;
    htmlElement.dataset.param = onOffParamId;

    const defaultStateIsOn = vDefaultOnOff === onValue;
    const initialStoredState = State.getElementState(onOffParamId);

    let isActive;
    if (initialStoredState !== null && initialStoredState !== undefined) {
        isActive = String(initialStoredState) === '1' || initialStoredState === 1;
    } else {
        isActive = defaultStateIsOn;
    }

    if (isActive) {
        htmlElement.classList.add('active');
    } else {
        htmlElement.classList.remove('active');
    }

    htmlElement.setAttribute('role', 'switch');
    htmlElement.setAttribute('aria-checked', isActive ? 'true' : 'false');
    htmlElement.setAttribute('aria-label', mergedAttributes['tooltip'] || (commandOnOff ? `Toggle ${commandOnOff.split('|')[1] || 'setting'}` : 'On/Off Button'));
    if (mergedAttributes['text']) {
        htmlElement.textContent = mergedAttributes['text'];
    }

    return {
        htmlElement: htmlElement,
        mainElementForAttributes: htmlElement,
        requiresRecursiveRender: false,
        postProcessFunction: null
    };
}

export function renderImageButton(tagName, xmlNode, mergedAttributes, currentParams, sourcePath) {
    const htmlElement = document.createElement('button');
    htmlElement.classList.add('gui-image-button');
    if (tagName === 'OnOffButton') htmlElement.classList.add('gui-onoff-button');
    
    const paramId = DomUtils.getParamValue(xmlNode, currentParams.paramOffset);
    htmlElement.dataset.param = paramId;
    htmlElement.dataset.command = mergedAttributes['command'] || '';

    const updateImage = (state) => {
        const imgKey = state ? 'image_on' : 'image_off';
        const imgPath = mergedAttributes[imgKey] || mergedAttributes['image'];
        if (imgPath) {
            const blob = State.getAssetBlobUrl(State.normalizePath(imgPath, State.getCurrentSkinRoot()));
            if (blob) {
                htmlElement.style.backgroundImage = `url(${blob})`;
                htmlElement.style.backgroundSize = '100% 100%';
            }
        }
    };

    updateImage(false);

    return {
        htmlElement: htmlElement,
        mainElementForAttributes: htmlElement,
        requiresRecursiveRender: false,
        postProcessFunction: null
    };
}