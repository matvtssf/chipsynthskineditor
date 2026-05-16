// File: cs/renderers/controlRenderer.js
import { renderCS01Slider, renderCS03Slider } from './sliderRenderer.js?v=2';
import { renderCS03Knob } from './knobRenderer.js?v=2';
import { renderCS01TextButton, renderCS01OnOffButton, renderImageButton } from './buttonRenderer.js?v=2';
import { renderCS01ExpandViewButton } from './expandViewButtonRenderer.js?v=2';

export function render(tagName, xmlNode, parentHtmlElement, currentParams, sourcePath, mergedAttributes) {
    switch (tagName) {
        case 'CS01Slider':
            return renderCS01Slider(xmlNode, mergedAttributes, currentParams, sourcePath);
        case 'CS03Slider':
            return renderCS03Slider(xmlNode, mergedAttributes, currentParams, sourcePath);
        case 'CS03Knob':
            return renderCS03Knob(xmlNode, mergedAttributes, currentParams, sourcePath);
        case 'CS01TextButton':
            return renderCS01TextButton(xmlNode, mergedAttributes, currentParams, sourcePath);
        case 'CS01OnOffButton':
            return renderCS01OnOffButton(xmlNode, mergedAttributes, currentParams, sourcePath);
        case 'CS01ExpandViewButton':
            return renderCS01ExpandViewButton(xmlNode, mergedAttributes, currentParams, sourcePath, parentHtmlElement);
        case 'Button':
        case 'OnOffButton':
        case 'CommandButton':
        case 'HoldButton':
            return renderImageButton(tagName, xmlNode, mergedAttributes, currentParams, sourcePath);
        default:
            console.warn(`[controlRenderer] Attempted to render unhandled tag: ${tagName}`);
            return { htmlElement: null, mainElementForAttributes: null, requiresRecursiveRender: true, postProcessFunction: null };
    }
}