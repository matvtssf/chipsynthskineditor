// File: cs/uiRenderer.js
/**
 * uiRenderer.js
 * Main rendering engine for XML-defined UI elements.
 * ADDED: Recursive GUIMacro support.
 * FIXED: Pass renderElementCallback to ControlRenderer.
 * ADDED: Mapping for CS01Knob and DisplayStringOption.
 */
import * as State from './state.js';
import * as DomUtils from './domUtils.js'; // Now DomUtils.sanitizeAttrName will be available
import { registerContainer as registerVisibilityChangeContainer } from './visibilityController.js';

// Import renderer modules
import * as DrawRenderer from '../renderers/drawRenderer.js';
import * as ControlRenderer from '../renderers/controlRenderer.js';
import * as KeyboardRenderer from '../renderers/keyboardRenderer.js';
import * as TextDisplayRenderer from '../renderers/textDisplayRenderer.js';
import * as ContainerRenderer from '../renderers/containerRenderer.js';
import * as DropDownRenderer from '../renderers/dropDownRenderer.js';

const tagToRendererMap = {
    // DrawRenderer tags
    'Rect': DrawRenderer,
    'RoundedRect': DrawRenderer,
    'StaticImage': DrawRenderer,
    'Line': DrawRenderer,
    'Shape': DrawRenderer,

    // ControlRenderer tags
    'CS01Slider': ControlRenderer,
    'CS03Slider': ControlRenderer,
    'CS03Knob': ControlRenderer,
    'CS01Knob': ControlRenderer, 
    'CS01TextButton': ControlRenderer,
    'CS01OnOffButton': ControlRenderer,
    'CS01ExpandViewButton': ControlRenderer,
    'Button': ControlRenderer,
    'OnOffButton': ControlRenderer,
    'CommandButton': ControlRenderer,
    'HoldButton': ControlRenderer,

    // KeyboardRenderer tags
    'CS01Keyboard': KeyboardRenderer,

    // TextDisplayRenderer tags
    'StaticText': TextDisplayRenderer,
    'Label': TextDisplayRenderer,
    'TextEditor': TextDisplayRenderer,
    'DisplayStringOption': TextDisplayRenderer, 

    // ContainerRenderer tags
    'CS01ViewContainer': ContainerRenderer,
    'CS01ViewContainer1': ContainerRenderer,
    'VisibilityContainer': ContainerRenderer,
    'Pane': ContainerRenderer, 
    'TabView': ContainerRenderer,
    'ScrollView': ContainerRenderer,
    'CS01ScrollViewPageController': ContainerRenderer,
    'PopupOverlay': ContainerRenderer,
    'Splash': ContainerRenderer,
    // CS01AssignmentMapTarget will be in ignoredTags

    // DropDownRenderer tags
    'PresetMenu': DropDownRenderer,
    'OptionMenu': DropDownRenderer,
};

export function renderElement(xmlNode, parentHtmlElement, currentParams = {}, sourcePath = 'unknown.xml') {
    if (!xmlNode || xmlNode.nodeType !== Node.ELEMENT_NODE || !parentHtmlElement) {
        return;
    }

    const tagName = xmlNode.tagName;
    const styleName = xmlNode.getAttribute('style'); 

    if (tagName === 'GUIMacro') {
        const macroPath_relative = xmlNode.getAttribute('path');
        const xoffset = xmlNode.getAttribute('xoffset');
        const yoffset = xmlNode.getAttribute('yoffset');
        const macroParamOffsetStr = xmlNode.getAttribute('param_offset');

        if (!macroPath_relative) {
            DomUtils.logError(`[uiRenderer] GUIMacro in ${sourcePath} is missing 'path' attribute.`, xmlNode);
            const errPlaceholderNoPath = DomUtils.createErrorPlaceholder(`Macro Path Missing`);
            if (parentHtmlElement && typeof parentHtmlElement.appendChild === 'function') parentHtmlElement.appendChild(errPlaceholderNoPath);
            return;
        }

        const currentRoot = State.getCurrentSkinRoot();
        const fullMacroPath = State.normalizePath(macroPath_relative, currentRoot || sourcePath); 
        const macroContent = State.getFileContent(fullMacroPath);

        if (!macroContent) {
            DomUtils.logError(`[uiRenderer] GUIMacro content not found for path: ${fullMacroPath} (referenced in ${sourcePath})`, xmlNode);
            const errPlaceholderNotFound = DomUtils.createErrorPlaceholder(`Macro N/F: ${macroPath_relative.split('/').pop()}`);
            if (parentHtmlElement && typeof parentHtmlElement.appendChild === 'function') parentHtmlElement.appendChild(errPlaceholderNotFound);
            return;
        }

        try {
            const parser = new DOMParser();
            const macroDoc = parser.parseFromString(macroContent, "application/xml");
            const parseErrorNode = macroDoc.querySelector("parsererror");
            if (parseErrorNode && parseErrorNode.textContent.trim() !== "") {
                let errorDetails = parseErrorNode.textContent;
                const srcTextNode = Array.from(parseErrorNode.childNodes).find(node => node.nodeName === 'sourcetext');
                if (srcTextNode) {
                    errorDetails += `\nSource Text: ${srcTextNode.textContent.substring(0, 200)}...`;
                }
                throw new Error(`GUIMacro "${fullMacroPath}" parse error: ${errorDetails}`);
            }
            
            const macroRootNode = macroDoc.documentElement;
            if (!macroRootNode || !macroRootNode.tagName) { 
                throw new Error(`GUIMacro "${fullMacroPath}" content is empty or has invalid root XML structure.`);
            }

            const macroHostDiv = document.createElement('div');
            macroHostDiv.classList.add('gui-macro-instance-content');
            macroHostDiv.dataset.macroPath = fullMacroPath;
            macroHostDiv.dataset.sourceXml = sourcePath; 

            if (xoffset || yoffset) {
                macroHostDiv.style.position = 'absolute'; 
                if (xoffset) macroHostDiv.style.left = xoffset.endsWith('px') ? xoffset : xoffset + 'px';
                if (yoffset) macroHostDiv.style.top = yoffset.endsWith('px') ? yoffset : yoffset + 'px';
            }
            
            const macroRootW = macroRootNode.getAttribute('w');
            const macroRootH = macroRootNode.getAttribute('h');
            if (macroRootW) macroHostDiv.style.width = macroRootW.endsWith('px') ? macroRootW : macroRootW + 'px';
            if (macroRootH) macroHostDiv.style.height = macroRootH.endsWith('px') ? macroRootH : macroRootH + 'px';
            
            DomUtils.applyCommonAttributes(macroHostDiv, xmlNode, DomUtils.getMergedAttributes(xmlNode, styleName, State.getStyles())); 
            DomUtils.applyStyles(macroHostDiv, styleName, xmlNode, DomUtils.getMergedAttributes(xmlNode, styleName, State.getStyles())); 

            parentHtmlElement.appendChild(macroHostDiv);

            let newParamOffset = currentParams.paramOffset || 0;
            if (macroParamOffsetStr) {
                const offset = parseInt(macroParamOffsetStr, 10);
                if (!isNaN(offset)) {
                    newParamOffset += offset;
                }
            }
            const newCurrentParams = { ...currentParams, paramOffset: newParamOffset };

            for (const elNode of macroRootNode.children) {
                if (elNode.nodeType === Node.ELEMENT_NODE) {
                    renderElement(elNode, macroHostDiv, newCurrentParams, fullMacroPath);
                }
            }
            State.addUsedFile('xml', fullMacroPath); 
        } catch (e) {
            DomUtils.logError(`[uiRenderer] Error processing GUIMacro "${fullMacroPath}" (from ${sourcePath})`, e, xmlNode);
            const errPlaceholderParse = DomUtils.createErrorPlaceholder(`MacroErr: ${macroPath_relative.split('/').pop()}`);
            if (parentHtmlElement && typeof parentHtmlElement.appendChild === 'function') parentHtmlElement.appendChild(errPlaceholderParse);
        }
        return; 
    }

    const ignoredTags = [
        'Font', 'Styles', 'Property', 'Define', 'XMLMacroText', 
        'Style', 'StyleMacro', 'OptionItem', 'DisplayStringOptionItem', 
        'Point', 'PageName',
        'CS01AssignmentMapTarget', // Ensured this is here
        'CS01ViewConfigurationSet', 'CSViewConfiguration', 'CS01ViewAssoc' 
    ];

    if (ignoredTags.includes(tagName)) {
        if (!['Point', 'OptionItem', 'DisplayStringOptionItem', 'CSViewConfiguration', 'CS01ViewAssoc'].includes(tagName)) { 
            // console.log(`[uiRenderer] Ignoring tag: <${tagName}> in ${sourcePath}.`);
        }
        return; // Exit early for ignored tags
    }

    let htmlElement = null;
    let childAppendElement = null;
    let mainElementForAttributes = null;
    let requiresRecursiveRender = true; 
    let postProcessFunction = null;     

    // Use DomUtils.getMergedAttributes to ensure consistency
    const mergedAttributes = DomUtils.getMergedAttributes(xmlNode, styleName, State.getStyles());

    try {
        const simulateSplash = State.getSimulateSplashOverlay();
        if (!simulateSplash && (tagName === 'PopupOverlay' || tagName === 'Splash')) {
            return;
        }

        const rendererModule = tagToRendererMap[tagName];
        let moduleRenderResult = null;

        if (rendererModule) {
            const moduleArgs = [
                tagName, xmlNode, parentHtmlElement, 
                currentParams, sourcePath, mergedAttributes 
            ];
            if (rendererModule === ContainerRenderer || rendererModule === ControlRenderer) {
                 moduleArgs.push(renderElement);
            }
            moduleRenderResult = rendererModule.render(...moduleArgs);

            if (moduleRenderResult) {
                htmlElement = moduleRenderResult.htmlElement;
                childAppendElement = moduleRenderResult.childAppendElement || htmlElement;
                mainElementForAttributes = moduleRenderResult.mainElementForAttributes || htmlElement;
                requiresRecursiveRender = moduleRenderResult.requiresRecursiveRender !== undefined ? moduleRenderResult.requiresRecursiveRender : true; 
                postProcessFunction = moduleRenderResult.postProcessFunction;
            }
        }
        
        if (!htmlElement) {
            const placeholder = DomUtils.createErrorPlaceholder(`NoRenderer: ${tagName}`);
            mainElementForAttributes = htmlElement = childAppendElement = placeholder; 
            requiresRecursiveRender = false; 
        }
        
        mainElementForAttributes = mainElementForAttributes || htmlElement;

        if (mainElementForAttributes) {
            if (!mainElementForAttributes.classList.contains('gui-element')) {
                 mainElementForAttributes.classList.add('gui-element');
            }
            mainElementForAttributes.dataset.xmlTagName = tagName;
            mainElementForAttributes.dataset.sourcePath = sourcePath;
            
            // This is where DomUtils.sanitizeAttrName would be called.
            // Storing original XML attributes
            for (const attr of xmlNode.attributes) {
                 try {
                    // Sanitize key for dataset to avoid issues with invalid characters
                    mainElementForAttributes.dataset[`xmlAttr_${DomUtils.sanitizeAttrName(attr.name)}`] = attr.value;
                } catch (e) {
                    console.warn(`[uiRenderer] Failed to set dataset attribute for ${attr.name} on <${tagName}>: ${e.message}`);
                }
            }
            // Storing merged style attributes (simplified)
             if (styleName) {
                mainElementForAttributes.dataset.appliedStyles = styleName;
             }
            
            DomUtils.applyCommonAttributes(mainElementForAttributes, xmlNode, mergedAttributes);
            DomUtils.applyStyles(mainElementForAttributes, styleName, xmlNode, mergedAttributes); 
        }

        if (htmlElement && parentHtmlElement !== htmlElement) { 
            if (parentHtmlElement && typeof parentHtmlElement.appendChild === 'function') {
                parentHtmlElement.appendChild(htmlElement);
            } else {
                console.warn(`[uiRenderer] Invalid parentHtmlElement for <${tagName}>. Cannot append. Parent:`, parentHtmlElement);
                return; 
            }
        } else if (!htmlElement) { 
            return; 
        }

        if (tagName === 'CS01ViewContainer' && mainElementForAttributes && mainElementForAttributes.dataset.visibilityChangeName) {
            if (typeof registerVisibilityChangeContainer === 'function') {
                registerVisibilityChangeContainer(mainElementForAttributes);
            } else {
                console.warn(`[uiRenderer] registerVisibilityChangeContainer function not available for CS01ViewContainer.`);
            }
        }

        if (requiresRecursiveRender && childAppendElement && xmlNode.children.length > 0) {
            const parentForChildren = childAppendElement; 
            for (const childNode of xmlNode.children) {
                if (childNode.nodeType === Node.ELEMENT_NODE) {
                    renderElement(childNode, parentForChildren, currentParams, sourcePath);
                }
            }
        }

        // Post-processing is executed AFTER children are fully rendered and appended
        if (postProcessFunction && typeof postProcessFunction === 'function') {
            postProcessFunction(mainElementForAttributes, mergedAttributes, currentParams, xmlNode, styleName);
        }
        
    } catch (error) {
        DomUtils.logError(`[uiRenderer] Critical error rendering element <${tagName}> from ${sourcePath}`, error, xmlNode);
        try {
            const errorDiv = DomUtils.createErrorPlaceholder(`RenderError: ${tagName}`);
            if (mergedAttributes['x']) errorDiv.style.left = mergedAttributes['x'].endsWith('px') ? mergedAttributes['x'] : mergedAttributes['x'] + 'px';
            if (mergedAttributes['y']) errorDiv.style.top = mergedAttributes['y'].endsWith('px') ? mergedAttributes['y'] : mergedAttributes['y'] + 'px';
            if (mergedAttributes['w']) errorDiv.style.width = mergedAttributes['w'].endsWith('px') ? mergedAttributes['w'] : mergedAttributes['w'] + 'px';
            if (mergedAttributes['h']) errorDiv.style.height = mergedAttributes['h'].endsWith('px') ? mergedAttributes['h'] : mergedAttributes['h'] + 'px';
            if (!errorDiv.style.width) errorDiv.style.width = '50px'; 
            if (!errorDiv.style.height) errorDiv.style.height = '20px';

            if (parentHtmlElement && typeof parentHtmlElement.appendChild === 'function') {
                parentHtmlElement.appendChild(errorDiv);
            }
        } catch (e_placeholder) {
            console.error(`[uiRenderer] FATAL: Could not append error placeholder for <${tagName}>. Placeholder error:`, e_placeholder);
        }
    }
}