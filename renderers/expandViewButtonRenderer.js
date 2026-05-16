// File: cs/renderers/expandViewButtonRenderer.js
import * as DomUtils from '../core/domUtils.js';
import * as State from '../core/state.js';

function generateSimpleId(length = 5) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export function renderCS01ExpandViewButton(xmlNode, mergedAttributes, currentParams, sourcePath, parentHtmlElement) {
    const wrapper = document.createElement('div');
    wrapper.classList.add('gui-expand-view-button-wrapper');

    const button = document.createElement('button');
    button.classList.add('gui-expand-view-button');
    button.textContent = mergedAttributes['text'] || 'Open';

    const closeButtonTag = mergedAttributes['close_button_tag'] || '';
    button.dataset.closeButtonTag = closeButtonTag;
    button.dataset.expandedViewCloser = mergedAttributes['expandedViewCloser'] || '0';

    wrapper.appendChild(button);

    const nestedContainerNode = xmlNode.querySelector('CS01ViewContainer');
    if (nestedContainerNode) {
        const containerElement = document.createElement('div');
        containerElement.classList.add('gui-expandable-content-container');
        containerElement.style.position = 'absolute';
        containerElement.style.display = 'none';
        containerElement.dataset.loadPath = nestedContainerNode.getAttribute('path') || '';
        containerElement.dataset.originalDisplay = 'block';

        const modalId = `modal-for-${closeButtonTag || generateSimpleId(5)}`;
        containerElement.id = modalId;
        button.dataset.modalContainerId = modalId;

        const xoffset = parseFloat(nestedContainerNode.getAttribute('xoffset') || 0);
        const yoffset = parseFloat(nestedContainerNode.getAttribute('yoffset') || 0);
        containerElement.style.left = `${xoffset}px`;
        containerElement.style.top = `${yoffset}px`;

        const nestedStyleName = nestedContainerNode.getAttribute('style');
        DomUtils.applyCommonAttributes(containerElement, nestedContainerNode, nestedStyleName);
        DomUtils.applyStyles(containerElement, nestedStyleName, nestedContainerNode);

        if (!containerElement.style.width || containerElement.style.width === '0px') { containerElement.style.width = '700px'; }
        if (!containerElement.style.height || containerElement.style.height === '0px') { containerElement.style.height = '500px'; }

        let currentZIndex = containerElement.style.zIndex ? parseInt(containerElement.style.zIndex, 10) : NaN;
        if (isNaN(currentZIndex) || currentZIndex < 5000) {
            containerElement.style.zIndex = '5500';
        }

        const guiContentWrapper = DomUtils.getGuiContentWrapper();
        if (guiContentWrapper) {
            guiContentWrapper.appendChild(containerElement);
        } else {
            console.warn(`[controlRenderer:CS01ExpandViewButton] guiContentWrapper not found. Modal might not behave as expected.`);
            document.body.appendChild(containerElement);
        }

    } else {
        console.warn(`[controlRenderer:CS01ExpandViewButton] (tag: ${closeButtonTag}) in ${sourcePath} is missing a nested CS01ViewContainer. Pop-up content will be empty.`);
    }

    const postProcessFunction = (wrapperElement, mergedButtonAttrs, currentParams, sourceXmlNode, styleNameString) => {
        const actualButton = wrapperElement.querySelector('.gui-expand-view-button');
        if (actualButton && sourceXmlNode) {
            DomUtils.applyCommonAttributes(actualButton, sourceXmlNode, styleNameString);
            DomUtils.applyStyles(actualButton, styleNameString, sourceXmlNode);

            if (mergedButtonAttrs['text'] && actualButton.textContent !== mergedButtonAttrs['text']) {
                 actualButton.textContent = mergedButtonAttrs['text'];
            }
            if (!actualButton.textContent && (mergedButtonAttrs['text'] || 'Open')) {
                 actualButton.textContent = mergedButtonAttrs['text'] || 'Open';
            }
        } else {
            if (actualButton && mergedButtonAttrs) {
                if (mergedButtonAttrs['font']) DomUtils.applyFont(actualButton, mergedButtonAttrs['font']);
                let textColor = mergedButtonAttrs['color'] || mergedButtonAttrs['color_text'] || mergedButtonAttrs['fontColor'];
                if (textColor) actualButton.style.color = DomUtils.parseColor(textColor);
                if (mergedButtonAttrs['text'] && !actualButton.textContent) actualButton.textContent = mergedButtonAttrs['text'];

                let bgImageStyle = mergedButtonAttrs['background-image'] || mergedButtonAttrs['image'];
                if (bgImageStyle) {
                    if (typeof bgImageStyle === 'string' && bgImageStyle.toLowerCase().startsWith('url(')) {
                        const match = bgImageStyle.match(/url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/i);
                        if (match && match[1]) {
                            const path = match[1];
                            const blobUrl = State.getAssetBlobUrl(path);
                            if (blobUrl) actualButton.style.backgroundImage = `url(${blobUrl})`;
                            else actualButton.style.backgroundImage = bgImageStyle;
                        } else actualButton.style.backgroundImage = bgImageStyle;
                    } else {
                        const blobUrl = State.getAssetBlobUrl(bgImageStyle);
                        if (blobUrl) actualButton.style.backgroundImage = `url(${blobUrl})`;
                    }
                }
                let bgColor = mergedButtonAttrs['background-color'] || mergedButtonAttrs['backgroundColor'] || mergedButtonAttrs['color_back'];
                if (bgColor) actualButton.style.backgroundColor = DomUtils.parseColor(bgColor);
            }
        }
    };

    return {
        htmlElement: wrapper,
        mainElementForAttributes: wrapper,
        requiresRecursiveRender: false,
        postProcessFunction: postProcessFunction
    };
}