// File: cs/core/uiRenderer.js
/**
 * uiRenderer.js
 * Main rendering engine for XML-defined UI elements.
 * ADDED: Recursive GUIMacro support.
 * FIXED: Pass renderElementCallback to ControlRenderer.
 * ADDED: Mapping for CS01Knob and DisplayStringOption.
 */
import * as State from './state.js';
import * as DomUtils from './domUtils.js';
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

    // DropDownRenderer tags
    'PresetMenu': DropDownRenderer,
    'OptionMenu': DropDownRenderer,
    'CS01OptionMenuPool': DropDownRenderer,
    'CS01AssignmentMapContainer': ContainerRenderer,
    'CS01AssignmentMap': ContainerRenderer,
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

            const localDefs = {};
            xmlNode.querySelectorAll('Define').forEach(def => {
                const name = def.getAttribute('name');
                const value = def.getAttribute('value');
                if (name) localDefs[name] = value || '';
            });

            const newCurrentParams = { 
                ...currentParams, 
                paramOffset: newParamOffset,
                macroDefs: { ...(currentParams.macroDefs || {}), ...localDefs }
            };

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
        'CS01AssignmentMapTarget', 
        'CS01ViewConfigurationSet', 'CSViewConfiguration', 'CS01ViewAssoc' 
    ];

    if (ignoredTags.includes(tagName)) {
        return;
    }

    let htmlElement = null;
    let childAppendElement = null;
    let mainElementForAttributes = null;
    let requiresRecursiveRender = true; 
    let postProcessFunction = null;     

    const mergedAttributes = DomUtils.getMergedAttributes(xmlNode, styleName, State.getStyles());

    if (currentParams && currentParams.macroDefs) {
        for (const key in mergedAttributes) {
            if (typeof mergedAttributes[key] === 'string') {
                let val = mergedAttributes[key];
                for (const defKey in currentParams.macroDefs) {
                    if (val.includes(defKey)) {
                        val = val.replaceAll(defKey, currentParams.macroDefs[defKey]);
                    }
                }
                mergedAttributes[key] = val;
            }
        }
    }

    try {
        const simulateSplash = State.getSimulateSplashOverlay();
        if (!simulateSplash && (tagName === 'PopupOverlay' || tagName === 'Splash')) {
            return;
        }

        let moduleRenderResult = null;

        if ((tagName === 'CS01Knob' || tagName === 'CS03Knob') && (mergedAttributes['showFill'] === '0' || mergedAttributes['showTrack'] === '0' || mergedAttributes['showfill'] === '0' || mergedAttributes['showtrack'] === '0')) {
            const boxElement = document.createElement('div');
            boxElement.classList.add('gui-knob-text-box');
            boxElement.style.position = 'absolute';
            boxElement.style.boxSizing = 'border-box';
            boxElement.style.cursor = 'ns-resize';
            boxElement.style.textAlign = 'center';
            boxElement.style.userSelect = 'none';
            boxElement.style.webkitUserSelect = 'none';
            
            DomUtils.applyCommonAttributes(boxElement, xmlNode, mergedAttributes);
            DomUtils.applyStyles(boxElement, styleName, xmlNode, mergedAttributes);

            let isEditing = false;

            const getCaseAttr = (key) => {
                const lower = key.toLowerCase();
                for (const k in mergedAttributes) {
                    if (k.toLowerCase() === lower) return mergedAttributes[k];
                }
                return null;
            };

            const updateColors = (element, editingMode) => {
                const backColor = getCaseAttr('backColor') || '#54585a';
                const textEditBackColor = getCaseAttr('textEdit_backColor') || getCaseAttr('textedit_backcolor') || '#232323';
                const fontColor = getCaseAttr('fontColor') || '#F7BA0B';
                element.style.backgroundColor = DomUtils.parseColor(editingMode ? textEditBackColor : backColor);
                element.style.color = DomUtils.parseColor(fontColor);
            };

            const heightAttr = getCaseAttr('h');
            if (heightAttr) {
                boxElement.style.lineHeight = heightAttr.endsWith('px') ? heightAttr : heightAttr + 'px';
            }

            const fontAttr = getCaseAttr('font');
            if (fontAttr) {
                DomUtils.applyFont(boxElement, fontAttr);
            }

            const paramId = getCaseAttr('param') || DomUtils.getParamValue(xmlNode, currentParams.paramOffset);
            const vMin = parseFloat(getCaseAttr('vmin') || '0');
            const vMax = parseFloat(getCaseAttr('vmax') || '127');
            const vDefault = parseFloat(getCaseAttr('vdefault') || '0');
            const mouseIncrement = parseFloat(getCaseAttr('mouseincrement') || '1');

            const optionItems = [];
            const macros = typeof State.getXmlMacros === 'function' ? State.getXmlMacros() : null;
            
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
                            optionItems.push(...Array.from(macroDoc.documentElement.children).filter(el => el.tagName === 'OptionItem'));
                        } catch (e) {
                            console.warn(`[uiRenderer:KnobBox] Error parsing macro ${macroName}`, e);
                        }
                    }
                }
            }

            const updateDisplay = (val) => {
                const targetInt = Math.round(val);
                const matched = optionItems.find(item => parseInt(item.getAttribute('value'), 10) === targetInt);
                boxElement.textContent = matched ? matched.getAttribute('name') : targetInt;
            };

            let currentVal = typeof State.getElementState === 'function' ? (State.getElementState(paramId) ?? vDefault) : vDefault;
            updateDisplay(currentVal);

            boxElement.addEventListener('mousedown', (e) => {
                if (e.button !== 0 || isEditing) return;
                e.preventDefault();
                
                let startY = e.clientY;
                let startVal = typeof State.getElementState === 'function' ? (State.getElementState(paramId) ?? vDefault) : vDefault;
                startVal = parseFloat(startVal);

                const onMouseMove = (moveEvent) => {
                    const deltaY = startY - moveEvent.clientY;
                    let nextVal = startVal + (Math.round(deltaY / 4) * mouseIncrement);
                    nextVal = Math.max(vMin, Math.min(vMax, nextVal));
                    
                    if (typeof State.setElementState === 'function' && paramId) {
                        State.setElementState(paramId, nextVal);
                    }
                    updateDisplay(nextVal);

                    if (typeof window.updateControllerVisibilities === 'function') {
                        window.updateControllerVisibilities();
                    }
                };

                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });

            boxElement.addEventListener('dblclick', (e) => {
                if (isEditing) return;
                isEditing = true;
                updateColors(boxElement, true);

                const inputEl = document.createElement('input');
                inputEl.type = 'text';
                inputEl.value = boxElement.textContent.trim();
                inputEl.style.width = '100%';
                inputEl.style.height = '100%';
                inputEl.style.background = 'transparent';
                inputEl.style.border = 'none';
                inputEl.style.color = 'inherit';
                inputEl.style.fontFamily = 'inherit';
                inputEl.style.fontSize = 'inherit';
                inputEl.style.textAlign = 'center';
                inputEl.style.outline = 'none';
                inputEl.style.padding = '0';
                inputEl.style.margin = '0';

                boxElement.textContent = '';
                boxElement.appendChild(inputEl);
                inputEl.focus();
                inputEl.select();

                const commitChange = () => {
                    if (!isEditing) return;
                    isEditing = false;

                    const typedText = inputEl.value.trim();
                    let finalParsedVal = parseFloat(typedText);

                    const matchedOption = optionItems.find(item => 
                        item.getAttribute('name')?.toLowerCase() === typedText.toLowerCase()
                    );

                    if (matchedOption) {
                        finalParsedVal = parseFloat(matchedOption.getAttribute('value'));
                    } else {
                        const matchedValue = optionItems.find(item => 
                            parseInt(item.getAttribute('value'), 10) === parseInt(typedText, 10)
                        );
                        if (matchedValue) {
                            finalParsedVal = parseFloat(matchedValue.getAttribute('value'));
                        }
                    }

                    if (!isNaN(finalParsedVal)) {
                        finalParsedVal = Math.max(vMin, Math.min(vMax, finalParsedVal));
                        if (typeof State.setElementState === 'function' && paramId) {
                            State.setElementState(paramId, finalParsedVal);
                        }
                    }

                    const valToRender = typeof State.getElementState === 'function' ? (State.getElementState(paramId) ?? vDefault) : vDefault;
                    updateDisplay(valToRender);
                    updateColors(boxElement, false);

                    if (typeof window.updateControllerVisibilities === 'function') {
                        window.updateControllerVisibilities();
                    }
                };

                inputEl.addEventListener('keydown', (keyEvent) => {
                    if (keyEvent.key === 'Enter') {
                        commitChange();
                    } else if (keyEvent.key === 'Escape') {
                        isEditing = false;
                        const oldVal = typeof State.getElementState === 'function' ? (State.getElementState(paramId) ?? vDefault) : vDefault;
                        updateDisplay(oldVal);
                        updateColors(boxElement, false);
                    }
                });

                inputEl.addEventListener('blur', commitChange);
            });

            htmlElement = boxElement;
            childAppendElement = boxElement;
            mainElementForAttributes = boxElement;
            requiresRecursiveRender = false;
            
            postProcessFunction = (element, attrs) => {
                updateColors(element, false);
            };
        } else {
            const rendererModule = tagToRendererMap[tagName];
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
            try {
                mainElementForAttributes.dataset.rawXml = new XMLSerializer().serializeToString(xmlNode);
            } catch (e) {
                mainElementForAttributes.dataset.rawXml = `<${tagName}></${tagName}>`;
            }
            
            for (const attr of xmlNode.attributes) {
                 try {
                    mainElementForAttributes.dataset[`xmlAttr_${DomUtils.sanitizeAttrName(attr.name)}`] = attr.value;
                } catch (e) {
                    console.warn(`[uiRenderer] Failed to set dataset attribute for ${attr.name} on <${tagName}>: ${e.message}`);
                }
            }
            if (styleName) {
                mainElementForAttributes.dataset.appliedStyles = styleName;
            }
            
            DomUtils.applyCommonAttributes(mainElementForAttributes, xmlNode, mergedAttributes);
            DomUtils.applyStyles(mainElementForAttributes, styleName, xmlNode, mergedAttributes); 

            if (mergedAttributes['command']) {
                mainElementForAttributes.dataset.command = mergedAttributes['command'];
            }
            if (mergedAttributes['param']) {
                mainElementForAttributes.dataset.param = DomUtils.getParamValue(xmlNode, currentParams.paramOffset);
            }
            if (mergedAttributes['vdefault']) {
                mainElementForAttributes.dataset.vdefault = mergedAttributes['vdefault'];
            }
            if (mergedAttributes['controller']) {
                mainElementForAttributes.dataset.controller = mergedAttributes['controller'];
            }
            if (mergedAttributes['rule_d1']) {
                mainElementForAttributes.dataset.ruleD1 = mergedAttributes['rule_d1'];
            }
            if (mergedAttributes['controller_name']) {
                mainElementForAttributes.dataset.controllerName = mergedAttributes['controller_name'];
            }
            if (mergedAttributes['role']) {
                mainElementForAttributes.dataset.role = mergedAttributes['role'];
            }
            if (mergedAttributes['enabledByOnOff'] || mergedAttributes['enabledbyonoff']) {
                mainElementForAttributes.dataset.enabledByOnOff = mergedAttributes['enabledByOnOff'] || mergedAttributes['enabledbyonoff'];
            }
            
            const disColor = mergedAttributes['disabledColor'] || mergedAttributes['disabledcolor'] || mergedAttributes['disabled_backColor'] || mergedAttributes['disabled_backcolor'] || mergedAttributes['backColor'] || mergedAttributes['backcolor'] || '#3a3a3a';
            mainElementForAttributes.dataset.disabledBackColor = disColor;

            const cRadius = mergedAttributes['cornerRadius'] || mergedAttributes['radius'] || mergedAttributes['corner_radius'];
            if (cRadius) {
                if (cRadius.endsWith('px') || isNaN(parseFloat(cRadius))) {
                    mainElementForAttributes.style.borderRadius = cRadius;
                } else {
                    const rawRadius = parseFloat(cRadius);
                    const containerHeight = parseFloat(mergedAttributes['h'] || mergedAttributes['height'] || '0');
                    // If it's a small factor and we have a container height, emulate Plogue's proportional scaling ratio
                    if (rawRadius > 0 && rawRadius <= 12 && containerHeight > 0) {
                        const scaledRadius = Math.round((rawRadius / 24) * containerHeight);
                        mainElementForAttributes.style.borderRadius = `${scaledRadius}px`;
                    } else {
                        mainElementForAttributes.style.borderRadius = `${rawRadius}px`;
                    }
                }
            }
        }

        if (!window.updateControllerVisibilities) {
            window.updateControllerVisibilities = function() {
                const controllers = {};
                document.querySelectorAll('[data-controller-name]').forEach(el => {
                    const name = el.dataset.controllerName;
                    if (!name) return;
                    let val = null;
                    if (el.dataset.param) {
                        val = State.getElementState(el.dataset.param);
                    }
                    if (val === null || val === undefined) {
                        if (el.tagName?.toLowerCase() === 'select') {
                            val = el.value;
                        } else {
                            val = el.classList.contains('active') ? (el.dataset.onValue || '1') : (el.dataset.offValue || '0');
                        }
                    }
                    controllers[name] = String(val);
                });

                document.querySelectorAll('[data-controller]').forEach(el => {
                    const reqController = el.dataset.controller;
                    const reqValue = el.dataset.ruleD1;
                    if (!reqController) return;
                    const currentVal = controllers[reqController];
                    if (currentVal !== undefined) {
                        if (currentVal === String(reqValue)) {
                            let orig = el.dataset.originalDisplay;
                            if (!orig || orig === 'none') orig = 'block';
                            el.style.display = orig;
                        } else {
                            if (!el.dataset.originalDisplay || el.dataset.originalDisplay === 'none') {
                                let disp = el.style.display;
                                if (!disp || disp === 'none') disp = 'block';
                                el.dataset.originalDisplay = disp;
                            }
                            el.style.display = 'none';
                        }
                    }
                });

                // Manage Style-Tinted Disabled Object Overlays for Containers
                document.querySelectorAll('.gui-view-container, .gui-view-container1').forEach(container => {
                    const onOffBtn = container.querySelector('[data-role="onOff"]');
                    if (!onOffBtn) return;
                    const paramId = onOffBtn.dataset.param;
                    if (!paramId) return;

                    let currentState = typeof State.getElementState === 'function' ? State.getElementState(paramId) : null;
                    
                    if (currentState === null || currentState === undefined) {
                        const defaultState = (parseInt(paramId, 10) === 512) ? '1' : '0';
                        if (typeof State.setElementState === 'function') {
                            State.setElementState(paramId, defaultState);
                        }
                        currentState = defaultState;
                    }

                    const isChannelOn = (currentState !== 0 && currentState !== '0');

                    let overlay = container.querySelector('.gui-disabled-overlay');
                    if (!overlay) {
                        overlay = document.createElement('div');
                        overlay.classList.add('gui-disabled-overlay');
                        overlay.style.position = 'absolute';
                        overlay.style.zIndex = '100';
                        container.appendChild(overlay);
                    }

                    if (!isChannelOn) {
                        const dx = container.dataset.xmlAttr_disabled_x || '0';
                        const dy = container.dataset.xmlAttr_disabled_y || '0';
                        const dw = container.dataset.xmlAttr_disabled_w || '100%';
                        const dh = container.dataset.xmlAttr_disabled_h || '100%';

                        overlay.style.left = dx.endsWith('px') ? dx : dx + 'px';
                        overlay.style.top = dy.endsWith('px') ? dy : dy + 'px';
                        overlay.style.width = dw.endsWith('px') ? dw : dw + 'px';
                        overlay.style.height = dh.endsWith('px') ? dh : dh + 'px';
                        
                        const dColor = container.dataset.disabledBackColor || '#3a3a3a';
                        overlay.style.backgroundColor = DomUtils.parseColor(dColor);
                        overlay.style.borderRadius = container.style.borderRadius || '0px';
                        overlay.style.display = 'block';
                        overlay.style.pointerEvents = 'auto';
                    } else {
                        overlay.style.display = 'none';
                        overlay.style.pointerEvents = 'none';
                    }
                });

                // Row-Level Dimming via enabledByOnOff container properties
                document.querySelectorAll('[data-enabled-by-on-off="1"]').forEach(el => {
                    const container = el.closest('.gui-view-container, .gui-view-container1');
                    if (!container) return;
                    const onOffBtn = container.querySelector('[data-role="onOff"]');
                    if (!onOffBtn) return;
                    const paramId = onOffBtn.dataset.param;
                    if (!paramId) return;

                    const currentState = typeof State.getElementState === 'function' ? State.getElementState(paramId) : null;
                    const isChannelOn = (currentState !== 0 && currentState !== '0');

                    if (!isChannelOn) {
                        el.style.opacity = '0.25';
                        el.style.pointerEvents = 'none';
                    } else {
                        el.style.opacity = '1.0';
                        el.style.pointerEvents = 'auto';
                    }
                });

                // Style CS01OnOffButton elements as solid circle indicators matching original plugin
                document.querySelectorAll('[data-xml-tag-name="CS01OnOffButton"]').forEach(btn => {
                    btn.style.borderRadius = '50%';
                    const paramId = btn.dataset.param;
                    const isActive = btn.classList.contains('active') || 
                        (paramId && typeof State.getElementState === 'function' && (State.getElementState(paramId) === 1 || State.getElementState(paramId) === '1'));
                    
                    if (isActive) {
                        btn.style.backgroundColor = '#F7BA0B';
                        btn.style.border = 'none';
                    } else {
                        btn.style.backgroundColor = '#555555';
                        btn.style.border = 'none';
                    }
                });
            };

            setInterval(() => window.updateControllerVisibilities(), 50);

            document.addEventListener('input', () => window.updateControllerVisibilities());
            document.addEventListener('change', () => window.updateControllerVisibilities());
            document.addEventListener('click', () => window.updateControllerVisibilities());
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