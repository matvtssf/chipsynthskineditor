// File: cs/renderers/dropDownRenderer.js
import * as DomUtils from '../core/domUtils.js';
import * as State from '../core/state.js';
import { loadSkin } from '../core/skinManager.js'; 

function renderPresetMenu(xmlNode, mergedAttributes, currentParams, sourcePath) {
    const htmlElement = document.createElement('div');
    htmlElement.classList.add('gui-presetmenu');

    const prevImgPath_relative = mergedAttributes['image_previous'];
    const nextImgPath_relative = mergedAttributes['image_next'];
    const font = mergedAttributes['font'];
    const alignment = mergedAttributes['alignment'] || 'center';
    const btnMargin = mergedAttributes['btn_margin'] || '1'; 

    htmlElement.style.display = 'flex';
    htmlElement.style.alignItems = 'center';
    htmlElement.style.gap = `${btnMargin}px`;

    const currentSkinRoot = State.getCurrentSkinRoot() || '';

    const createButton = (action, imgRelPath, fallbackText) => {
        const button = document.createElement('button');
        button.classList.add('preset-menu-button', action);
        button.setAttribute('aria-label', `${action.charAt(0).toUpperCase() + action.slice(1)} Preset`);
        button.style.flexShrink = '0'; 
        button.style.background = 'transparent'; 
        button.style.border = 'none';
        button.style.padding = '0';
        button.style.cursor = 'pointer';

        const imgFullPath = imgRelPath ? State.normalizePath(imgRelPath, currentSkinRoot) : null;
        if (imgFullPath) {
            const blobUrl = State.getAssetBlobUrl(imgFullPath);
            if (blobUrl) {
                button.style.backgroundImage = `url(${blobUrl})`;
                button.style.backgroundRepeat = 'no-repeat';
                
                DomUtils.getSvgDimensions(imgFullPath, {defaultWidth: 20, defaultHeight: 40}) 
                    .then(dims => {
                         if (dims.loaded && dims.width > 0 && dims.height >= 2) { 
                            const singleStateHeight = dims.height / 2; // Assuming image is a 2-state vertical sprite
                            button.style.width = `${dims.width}px`;
                            button.style.height = `${singleStateHeight}px`; // Button shows one state
                            button.style.backgroundSize = `${dims.width}px ${dims.height}px`; // Full sprite size

                            // MODIFICATION: Always show top half of the sprite
                            button.style.backgroundPosition = '0 0'; 
                            
                            // Optional: Add a subtle hover effect if desired, e.g., filter, if not changing position
                            // button.addEventListener('mouseenter', () => {
                            //     button.style.filter = 'brightness(1.2)'; 
                            // });
                            // button.addEventListener('mouseleave', () => {
                            //     button.style.filter = 'brightness(1)';
                            // });
                         } else {
                            // Fallback if image dimensions are not suitable for sprite or not a 2-state sprite
                            button.textContent = fallbackText; 
                            if (dims.loaded && dims.width > 0 && dims.height > 0) {
                                button.style.width = `${dims.width}px`;
                                button.style.height = `${dims.height}px`; // Use full image height if not treating as sprite
                                button.style.backgroundSize = 'contain'; 
                                button.style.backgroundPosition = 'center';
                            } else {
                                button.style.width = `20px`; 
                                button.style.height = `20px`;
                            }
                         }
                    });
            } else {
                button.textContent = fallbackText;
                console.warn(`[dropDownRenderer:PresetMenu] Image not found: ${imgFullPath}`);
            }
        } else {
            button.textContent = fallbackText;
        }
        return button;
    };

    const prevButton = createButton('prev', prevImgPath_relative, '‹');
    htmlElement.appendChild(prevButton);

    const label = document.createElement('div');
    label.classList.add('preset-menu-label');
    label.textContent = mergedAttributes['default_text'] || "Default Preset"; 
    if (font) DomUtils.applyFont(label, font);
    label.style.textAlign = DomUtils.mapTextAlign(alignment);
    label.style.flexGrow = '1'; 
    label.style.overflow = 'hidden';
    label.style.whiteSpace = 'nowrap';
    label.style.textOverflow = 'ellipsis';
    htmlElement.appendChild(label);

    const nextButton = createButton('next', nextImgPath_relative, '›');
    htmlElement.appendChild(nextButton);

    // Updated signature
    const postProcessFunction = (element, attrs, params, sourceXmlNode, styleNameString) => {
        const labelElement = element.querySelector('.preset-menu-label');
        const textColor = attrs['color_text'] || attrs['fontColor'];
        if (labelElement && textColor) {
            labelElement.style.color = DomUtils.parseColor(textColor);
        }
        const currentAlignment = attrs['alignment'] || 'center';
        if (currentAlignment === 'center') element.style.justifyContent = 'center';
        else if (currentAlignment === 'right') element.style.justifyContent = 'flex-end';
        else element.style.justifyContent = 'flex-start'; 
    };

    return {
        htmlElement: htmlElement,
        mainElementForAttributes: htmlElement,
        requiresRecursiveRender: false,
        postProcessFunction: postProcessFunction
    };
}

function renderOptionMenu(xmlNode, mergedAttributes, currentParams, sourcePath) {
    const htmlElement = document.createElement('select');
    htmlElement.classList.add('gui-optionmenu');
    htmlElement.style.zIndex = mergedAttributes['zindex'] || '20'; 

    const optionParam = DomUtils.getParamValue(xmlNode, currentParams.paramOffset);
    const vDefault = mergedAttributes['vdefault'];
    const command = mergedAttributes['command'];

    htmlElement.dataset.param = optionParam || '';
    htmlElement.dataset.vdefault = vDefault || '';
    htmlElement.dataset.command = command || '';

    const optionItems = [];
    const macros = State.getXmlMacros();

    for (const child of xmlNode.children) {
        if (child.tagName === 'OptionItem') {
            optionItems.push(child);
        } else if (child.tagName === 'XMLMacroTextUse') {
            const macroName = child.getAttribute('name');
            if (macroName && macros && macros.has(macroName)) {
                try {
                    const macroContent = macros.get(macroName);
                    const macroParser = new DOMParser();
                    const macroDoc = macroParser.parseFromString(`<root>${macroContent}</root>`, "application/xml");
                    const parseError = macroDoc.querySelector("parsererror");
                    if (parseError) { throw new Error(`Macro parse error for "${macroName}": ${parseError.textContent}`); }
                    optionItems.push(...Array.from(macroDoc.documentElement.children).filter(el => el.tagName === 'OptionItem'));
                } catch (e) {
                    DomUtils.logError(`[dropDownRenderer:OptionMenu] Error processing XMLMacroTextUse "${macroName}" from ${sourcePath}`, e);
                }
            } else {
                console.warn(`[dropDownRenderer:OptionMenu] XMLMacroTextUse: Macro named "${macroName}" not found or macros not loaded.`);
            }
        }
    }

    optionItems.forEach(itemNode => {
        const option = document.createElement('option');
        const name = itemNode.getAttribute('name');
        const value = itemNode.getAttribute('value');
        option.value = value;
        if (name && name.startsWith('-G')) { 
            option.disabled = true;
            option.textContent = name.substring(2).trim(); 
            option.classList.add('gui-option-disabled', 'gui-option-group-separator');
        } else {
            option.textContent = name || (value ? `Value ${value}`: 'Unnamed Option');
        }
        if (value === vDefault) {
            option.selected = true;
        }
        htmlElement.appendChild(option);
    });

    if (optionParam === 'DID_PRODUCT_DISPLAYSKINVARIANT') {
        htmlElement.addEventListener('change', (e) => {
            const select = e.target;
            const skinIdToLoad = `_${select.value}`; 
            const detectedSkins = State.getDetectedSkinInfo(); 
            if (detectedSkins && typeof loadSkin === 'function') {
                const skinToLoad = detectedSkins.find(s => s.id === skinIdToLoad);
                if (skinToLoad) {
                    loadSkin(skinToLoad.root);
                } else {
                    DomUtils.logError(`[dropDownRenderer:OptionMenu] Skin with ID "${skinIdToLoad}" not found for selection.`, null);
                }
            } else {
                console.warn('[dropDownRenderer:OptionMenu] State.getDetectedSkinInfo or loadSkin not available for DID_PRODUCT_DISPLAYSKINVARIANT.');
            }
        });
    } else if (command) {
        htmlElement.addEventListener('change', (e) => {
            console.log(`[dropDownRenderer:OptionMenu] Param: ${optionParam}, Command: ${command}, New Value: ${e.target.value}`);
        });
    }

    return {
        htmlElement: htmlElement,
        mainElementForAttributes: htmlElement,
        requiresRecursiveRender: false, 
        postProcessFunction: null 
    };
}

export function render(tagName, xmlNode, parentHtmlElement, currentParams, sourcePath, mergedAttributes) {
    switch (tagName) {
        case 'PresetMenu':
            return renderPresetMenu(xmlNode, mergedAttributes, currentParams, sourcePath);
        case 'OptionMenu':
            return renderOptionMenu(xmlNode, mergedAttributes, currentParams, sourcePath);
        default:
            console.warn(`[dropDownRenderer] Attempted to render unhandled tag: ${tagName}`);
            return { htmlElement: null, mainElementForAttributes: null, requiresRecursiveRender: true, postProcessFunction: null };
    }
}