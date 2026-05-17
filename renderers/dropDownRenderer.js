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
    const containerH = mergedAttributes['h'] || '20';

    htmlElement.style.position = 'absolute';
    htmlElement.style.boxSizing = 'border-box';

    const currentSkinRoot = State.getCurrentSkinRoot() || '';

    const updateLabelBounds = () => {
        const prevWidth = prevButton.style.width ? parseInt(prevButton.style.width, 10) : 20;
        const nextWidth = nextButton.style.width ? parseInt(nextButton.style.width, 10) : 20;
        label.style.left = `${prevWidth + parseFloat(btnMargin)}px`;
        label.style.right = `${nextWidth + parseFloat(btnMargin)}px`;
    };

    const createButton = (action, imgRelPath, fallbackText) => {
        const button = document.createElement('button');
        button.classList.add('preset-menu-button', action);
        button.setAttribute('aria-label', `${action.charAt(0).toUpperCase() + action.slice(1)} Preset`);
        button.style.position = 'absolute';
        button.style.top = '50%';
        button.style.transform = 'translateY(-50%)';
        button.style.background = 'transparent'; 
        button.style.border = 'none';
        button.style.padding = '0';
        button.style.cursor = 'pointer';
        button.style.width = '20px';
        button.style.height = '20px';

        if (action === 'prev') {
            button.style.left = '0px';
        } else {
            button.style.right = '0px';
        }

        const imgFullPath = imgRelPath ? State.normalizePath(imgRelPath, currentSkinRoot) : null;
        if (imgFullPath) {
            const blobUrl = State.getAssetBlobUrl(imgFullPath);
            if (blobUrl) {
                button.style.backgroundImage = `url(${blobUrl})`;
                button.style.backgroundRepeat = 'no-repeat';
                
                DomUtils.getSvgDimensions(imgFullPath, {defaultWidth: 20, defaultHeight: 40}) 
                    .then(dims => {
                         if (dims.loaded && dims.width > 0 && dims.height >= 2) { 
                            const singleStateHeight = dims.height / 2;
                            button.style.width = `${dims.width}px`;
                            button.style.height = `${singleStateHeight}px`;
                            button.style.backgroundSize = `${dims.width}px ${dims.height}px`;
                            button.style.backgroundPosition = '0 0'; 
                         } else {
                            button.textContent = fallbackText; 
                            if (dims.loaded && dims.width > 0 && dims.height > 0) {
                                button.style.width = `${dims.width}px`;
                                button.style.height = `${dims.height}px`;
                                button.style.backgroundSize = 'contain'; 
                                button.style.backgroundPosition = 'center';
                            }
                         }
                         updateLabelBounds();
                    });
            } else {
                button.textContent = fallbackText;
                console.warn(`[dropDownRenderer:PresetMenu] Image not found: ${imgFullPath}`);
                updateLabelBounds();
            }
        } else {
            button.textContent = fallbackText;
            updateLabelBounds();
        }
        return button;
    };

    const prevButton = createButton('prev', prevImgPath_relative, '‹');
    htmlElement.appendChild(prevButton);

    const label = document.createElement('div');
    label.classList.add('preset-menu-label');
    label.textContent = mergedAttributes['default_text'] || "Default Preset"; 
    if (font) DomUtils.applyFont(label, font);
    label.style.position = 'absolute';
    label.style.top = '0px';
    label.style.bottom = '0px';
    label.style.lineHeight = `${containerH}px`;
    label.style.textAlign = DomUtils.mapTextAlign(alignment);
    label.style.overflow = 'hidden';
    label.style.whiteSpace = 'nowrap';
    label.style.textOverflow = 'ellipsis';
    htmlElement.appendChild(label);

    const nextButton = createButton('next', nextImgPath_relative, '›');
    htmlElement.appendChild(nextButton);

    updateLabelBounds();

    const postProcessFunction = (element, attrs, params, sourceXmlNode, styleNameString) => {
        const labelElement = element.querySelector('.preset-menu-label');
        const textColor = attrs['color_text'] || attrs['fontColor'];
        if (labelElement && textColor) {
            labelElement.style.color = DomUtils.parseColor(textColor);
        }
        const currentH = attrs['h'] || containerH;
        if (labelElement) {
            labelElement.style.lineHeight = `${currentH}px`;
        }
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
    htmlElement.style.boxSizing = 'border-box';
    htmlElement.style.margin = '0';
    htmlElement.style.padding = '0';
    htmlElement.style.appearance = 'none';
    htmlElement.style.webkitAppearance = 'none';
    htmlElement.style.mozAppearance = 'none';
    htmlElement.style.background = 'transparent';
    htmlElement.style.border = 'none';

    const alignment = mergedAttributes['alignment'] || 'center';
    htmlElement.style.textAlign = DomUtils.mapTextAlign(alignment);
    htmlElement.style.textAlignLast = DomUtils.mapTextAlign(alignment);

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

function renderOptionMenuPool(xmlNode, mergedAttributes, currentParams, sourcePath) {
    const htmlElement = document.createElement('select');
    htmlElement.classList.add('gui-optionmenupool');
    htmlElement.style.position = 'absolute';
    htmlElement.style.boxSizing = 'border-box';
    htmlElement.style.appearance = 'none';
    htmlElement.style.webkitAppearance = 'none';
    htmlElement.style.mozAppearance = 'none';
    htmlElement.style.border = 'none';
    htmlElement.style.paddingLeft = '6px';

    const backColor = mergedAttributes['backgroundColor'] || mergedAttributes['backgroundcolor'] || mergedAttributes['textEdit_backColor'] || mergedAttributes['textedit_backcolor'] || mergedAttributes['backColor'] || mergedAttributes['backcolor'] || '#232323';
    const fontColor = mergedAttributes['textColor'] || mergedAttributes['textcolor'] || mergedAttributes['fontColor'] || mergedAttributes['fontcolor'] || mergedAttributes['color_text'] || '#F7BA0B';
    htmlElement.style.backgroundColor = DomUtils.parseColor(backColor);
    htmlElement.style.color = DomUtils.parseColor(fontColor);

    if (!window.chipsynthSamplePool) {
        window.chipsynthSamplePool = [
            "strings.brr", "trumpet.brr", "piano.brr", "kick.brr",
            "snare.brr", "hihat.brr", "bass.brr", "lead.brr",
            "Nothing loaded", "Nothing loaded", "Nothing loaded", "Nothing loaded",
            "Nothing loaded", "Nothing loaded", "Nothing loaded", "Nothing loaded"
        ];
    }

    const rebuildOptions = () => {
        htmlElement.innerHTML = '';
        for (let i = 0; i < 16; i++) {
            const opt = document.createElement('option');
            opt.value = String(i);
            const prefix = String.fromCharCode(65 + i);
            const sampleName = window.chipsynthSamplePool[i] || 'Nothing loaded';
            opt.textContent = `${prefix}: ${sampleName}`;
            opt.style.backgroundColor = DomUtils.parseColor(backColor);
            opt.style.color = DomUtils.parseColor(fontColor);
            htmlElement.appendChild(opt);
        }

        const noneOpt = document.createElement('option');
        noneOpt.value = '16';
        noneOpt.textContent = 'None';
        noneOpt.style.backgroundColor = DomUtils.parseColor(backColor);
        noneOpt.style.color = DomUtils.parseColor(fontColor);
        htmlElement.appendChild(noneOpt);

        htmlElement.value = mergedAttributes['vdefault'] || '0';
    };

    rebuildOptions();
    document.addEventListener('samplePoolUpdated', rebuildOptions);

    const postProcessFunction = (element, attrs) => {
        const bColor = attrs['backgroundColor'] || attrs['backgroundcolor'] || attrs['textEdit_backColor'] || attrs['textedit_backcolor'] || attrs['backColor'] || attrs['backcolor'] || '#232323';
        const fColor = attrs['textColor'] || attrs['textcolor'] || attrs['fontColor'] || attrs['fontcolor'] || attrs['color_text'] || '#F7BA0B';
        
        element.style.appearance = 'none';
        element.style.webkitAppearance = 'none';
        element.style.mozAppearance = 'none';
        element.style.backgroundColor = DomUtils.parseColor(bColor);
        element.style.color = DomUtils.parseColor(fColor);
        element.style.border = 'none';
        
        element.querySelectorAll('option').forEach(opt => {
            opt.style.backgroundColor = DomUtils.parseColor(bColor);
            opt.style.color = DomUtils.parseColor(fColor);
        });
    };

    return {
        htmlElement: htmlElement,
        mainElementForAttributes: htmlElement,
        requiresRecursiveRender: false,
        postProcessFunction: postProcessFunction
    };
}

export function render(tagName, xmlNode, parentHtmlElement, currentParams, sourcePath, mergedAttributes) {
    switch (tagName) {
        case 'PresetMenu':
            return renderPresetMenu(xmlNode, mergedAttributes, currentParams, sourcePath);
        case 'OptionMenu':
            return renderOptionMenu(xmlNode, mergedAttributes, currentParams, sourcePath);
        case 'CS01OptionMenuPool':
            return renderOptionMenuPool(xmlNode, mergedAttributes, currentParams, sourcePath);
        default:
            console.warn(`[dropDownRenderer] Attempted to render unhandled tag: ${tagName}`);
            return { htmlElement: null, mainElementForAttributes: null, requiresRecursiveRender: true, postProcessFunction: null };
    }
}