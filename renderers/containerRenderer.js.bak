// File: cs/renderers/containerRenderer.js
/**
 * containerRenderer.js
 * Handles rendering for layout and structural container elements.
 */
import * as DomUtils from '../core/domUtils.js';
import * as State from '../core/state.js';

function generateSimpleId() {
    return Math.random().toString(36).substring(2, 9);
}

function renderViewContainer(tagName, xmlNode, mergedAttributes, renderElementCallback, currentParams, sourcePath) {
    const htmlElement = document.createElement('div');
    htmlElement.classList.add('gui-view-container');
    if (tagName === 'CS01ViewContainer1') {
        htmlElement.classList.add('gui-view-container1');
    }

    if (mergedAttributes['visibilitychangename']) {
        htmlElement.dataset.visibilityChangeName = mergedAttributes['visibilitychangename'];
        htmlElement.style.display = 'none'; // Default to hidden until VisibilityController updates it
    }

    // Force container dimensions so backgrounds actually have a surface area to render on (fixes invisible root GUIs)
    const w = mergedAttributes['w'] || xmlNode.getAttribute('w');
    const h = mergedAttributes['h'] || xmlNode.getAttribute('h');
    if (w) htmlElement.style.width = w.endsWith('px') || w.endsWith('%') ? w : `${w}px`;
    else if (tagName === 'GUI') htmlElement.style.width = '100%';
    
    if (h) htmlElement.style.height = h.endsWith('px') || h.endsWith('%') ? h : `${h}px`;
    else if (tagName === 'GUI') htmlElement.style.height = '100%';

    // Extract and apply background colors directly from the XML node (case-insensitive)
    const bgColor = mergedAttributes['backgroundColor'] || 
                    mergedAttributes['backgroundcolor'] || 
                    mergedAttributes['backColor'] || 
                    mergedAttributes['backcolor'] || 
                    mergedAttributes['fill_color'] || 
                    xmlNode.getAttribute('backgroundColor') || 
                    xmlNode.getAttribute('backgroundcolor') || 
                    xmlNode.getAttribute('color_back') || 
                    xmlNode.getAttribute('backColor') || 
                    xmlNode.getAttribute('backcolor');
    if (bgColor) {
        htmlElement.style.backgroundColor = DomUtils.parseColor(bgColor);
    }

    // Extract and apply structural borders natively
    const borderColor = mergedAttributes['color_border'] || xmlNode.getAttribute('color_border');
    if (borderColor) {
        htmlElement.style.borderColor = DomUtils.parseColor(borderColor);
        htmlElement.style.borderStyle = 'solid';
        htmlElement.style.borderWidth = '1px';
        htmlElement.style.boxSizing = 'border-box';
    }

    // Handle background image or fill color specifically for containers
    const imgRelPath = mergedAttributes['image'];
    if (imgRelPath) {
        const currentSkinRoot = State.getCurrentSkinRoot() || '';
        const imgFullPath = State.normalizePath(imgRelPath, currentSkinRoot);
        const blobUrl = State.getAssetBlobUrl(imgFullPath);
        if (blobUrl) {
            htmlElement.style.backgroundImage = `url('${blobUrl}')`;
            htmlElement.style.backgroundRepeat = 'no-repeat';
            htmlElement.style.backgroundPosition = 'top left';
            // Do NOT set backgroundSize here; let DomUtils.applyStyles handle 'stretch' or 'tile' if needed, or default to original size.
        }
    }

    // All view containers in chipsynth render on an absolute coordinate canvas to prevent flow stacking displacement
    htmlElement.style.position = 'absolute';

    // If the container references an external sub-view file layout via a path attribute, load and populate it
    const externalPath = xmlNode.getAttribute('path');
    if (externalPath) {
        try {
            const currentRoot = State.getCurrentSkinRoot() || '';
            const fullPath = State.normalizePath(externalPath, currentRoot || sourcePath);
            const externalContent = State.getFileContent(fullPath);
            if (externalContent) {
                const parser = new DOMParser();
                const cleanContent = externalContent.replace(/&(?!([a-zA-Z0-9]+|#[0-9]+|#x[0-9a-fA-F]+);)/g, '&amp;');
                const doc = parser.parseFromString(cleanContent, "application/xml");
                if (!doc.querySelector("parsererror")) {
                    const rootNode = doc.documentElement;
                    
                    // Force the outer container to adopt any explicit size constraints defined at the sub-view file root
                    const extW = rootNode.getAttribute('w') || rootNode.getAttribute('width');
                    const extH = rootNode.getAttribute('h') || rootNode.getAttribute('height');
                    if (extW) {
                        htmlElement.style.width = extW.endsWith('px') ? extW : `${extW}px`;
                    }
                    if (extH) {
                        htmlElement.style.height = extH.endsWith('px') ? extH : `${extH}px`;
                    }

                    // Inherit visual attributes from the external file root layer so the skin graphics display beautifully
                    const extBgColor = rootNode.getAttribute('backgroundColor') || 
                                       rootNode.getAttribute('backgroundcolor') || 
                                       rootNode.getAttribute('color_back') || 
                                       rootNode.getAttribute('backColor') || 
                                       rootNode.getAttribute('backcolor');
                    if (extBgColor) {
                        htmlElement.style.backgroundColor = DomUtils.parseColor(extBgColor);
                    }

                    const extImg = rootNode.getAttribute('image');
                    if (extImg) {
                        const currentSkinRoot = State.getCurrentSkinRoot() || '';
                        const imgFullPath = State.normalizePath(extImg, currentSkinRoot);
                        const blobUrl = State.getAssetBlobUrl(imgFullPath);
                        if (blobUrl) {
                            htmlElement.style.backgroundImage = `url('${blobUrl}')`;
                            htmlElement.style.backgroundRepeat = 'no-repeat';
                            htmlElement.style.backgroundPosition = 'top left';
                        }
                    }

                    const nodesToRender = (rootNode.tagName === 'CS01ViewContainer' || rootNode.tagName === 'Container' || rootNode.tagName === 'root' || rootNode.tagName === 'GUI') 
                        ? Array.from(rootNode.children) 
                        : [rootNode];

                    // Safely queue element expansion to run right after the container mounts into the flyout DOM branch
                    setTimeout(() => {
                        nodesToRender.forEach(child => {
                            if (child.nodeType === Node.ELEMENT_NODE && typeof renderElementCallback === 'function') {
                                renderElementCallback(child, htmlElement, currentParams, fullPath);
                            }
                        });
                    }, 0);
                }
            }
        } catch (err) {
            console.warn(`[containerRenderer] Failed to populate external container path layout: ${externalPath}`, err);
        }
    }

    if (tagName === 'CS01BrowserContainer') {
        htmlElement.classList.add('gui-browser-container');
        htmlElement.style.boxSizing = 'border-box';
    } else if (tagName === 'CS01Browser') {
        htmlElement.classList.add('gui-browser-file-list');
        htmlElement.style.boxSizing = 'border-box';
        htmlElement.style.overflowY = 'auto';
        htmlElement.style.padding = '4px 0px';
        
        const stylesMap = State.getStyles && typeof State.getStyles === 'function' ? State.getStyles() : {};
        const styleName = mergedAttributes['style'] || xmlNode.getAttribute('style');
        const styleData = (styleName && stylesMap[styleName]) ? stylesMap[styleName] : {};

        const bg = mergedAttributes['backgroundcolor'] || mergedAttributes['backgroundColor'] || styleData.backColor || styleData.backcolor || styleData.backgroundColor || styleData.backgroundcolor || 'transparent';
        const indent = parseInt(mergedAttributes['entries_indent'] || '12', 10);
        const itemHeight = parseInt(mergedAttributes['entries_height'] || '13', 10);
        const fontAlias = mergedAttributes['entries_font'] || 'sans-serif';
        
        htmlElement.style.backgroundColor = DomUtils.parseColor(bg);
        
        const mockFolders = {
            name: mergedAttributes['rootName'] || "Files",
            open: true,
            type: "dir",
            children: [
                {
                    name: "Factory",
                    open: true,
                    type: "dir",
                    children: [
                        { name: "01 Kick.brr", type: "file" },
                        { name: "02 Snare.brr", type: "file" },
                        { name: "03 Hihat.brr", type: "file" },
                        { name: "04 Bass Alpha.brr", type: "file" },
                        { name: "05 Poly Lead.brr", type: "file" }
                    ]
                },
                {
                    name: "User",
                    open: false,
                    type: "dir",
                    children: []
                }
            ]
        };

        const renderTree = () => {
            htmlElement.innerHTML = '';
            
            const buildMockTree = (item, depth = 0) => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.height = `${itemHeight}px`;
                row.style.marginBottom = mergedAttributes['entries_heightSpacing'] ? `${mergedAttributes['entries_heightSpacing']}px` : '4px';
                row.style.paddingLeft = `${6 + depth * indent}px`;
                row.style.cursor = 'pointer';
                row.style.whiteSpace = 'nowrap';
                row.style.color = '#ffffff';
                row.style.userSelect = 'none';
                row.style.width = '100%';
                row.style.boxSizing = 'border-box';
                row.classList.add('gui-file-row-item');
                
                if (fontAlias) {
                    DomUtils.applyFont(row, fontAlias);
                } else {
                    row.style.fontFamily = 'monospace';
                    row.style.fontSize = '10px';
                }

                const hoverBg = mergedAttributes['hovered_fontColor'] ? DomUtils.parseColor(mergedAttributes['hovered_fontColor']) : 'rgba(255,255,255,0.15)';

                row.addEventListener('mouseenter', () => {
                    if (!row.classList.contains('selected-file-row')) {
                        row.style.backgroundColor = hoverBg;
                    }
                });
                row.addEventListener('mouseleave', () => {
                    if (!row.classList.contains('selected-file-row')) {
                        row.style.backgroundColor = 'transparent';
                    }
                });
                row.addEventListener('click', (e) => {
                    e.stopPropagation();
                    htmlElement.querySelectorAll('.gui-file-row-item').forEach(r => {
                        r.classList.remove('selected-file-row');
                        r.style.backgroundColor = 'transparent';
                    });
                    row.classList.add('selected-file-row');
                    row.style.backgroundColor = 'rgba(247, 186, 11, 0.35)';
                    
                    if (item.type === 'dir') {
                        item.open = !item.open;
                        renderTree();
                    }
                });

                const labelSpan = document.createElement('span');
                
                if (item.type === 'dir') {
                    const img = document.createElement('img');
                    const iconPath = item.open ? (mergedAttributes['image_opened'] || 'containerOpened.svg') : (mergedAttributes['image_closed'] || 'containerClosed.svg');
                    const blobUrl = State.getAssetBlobUrl(iconPath);
                    
                    if (blobUrl) {
                        img.src = blobUrl;
                        img.style.width = '10px';
                        img.style.height = '10px';
                        img.style.marginRight = '5px';
                        row.appendChild(img);
                    } else {
                        const glyph = document.createElement('span');
                        glyph.textContent = item.open ? '▼ ' : '▶ ';
                        glyph.style.fontSize = '8px';
                        glyph.style.marginRight = '4px';
                        glyph.style.color = '#F7BA0B';
                        row.appendChild(glyph);
                    }
                    
                    labelSpan.textContent = item.name;
                } else {
                    labelSpan.textContent = item.name;
                    labelSpan.style.color = '#e2e8f0';
                    labelSpan.style.marginLeft = '15px';
                }
                
                row.appendChild(labelSpan);
                htmlElement.appendChild(row);
                
                if (item.type === 'dir' && item.open && item.children) {
                    item.children.forEach(child => buildMockTree(child, depth + 1));
                }
            };
            
            buildMockTree(mockFolders);
        };
        
        renderTree();
    } else if (tagName === 'CS01WaveEditorContainer') {
        htmlElement.classList.add('gui-wave-editor-container');
        htmlElement.style.boxSizing = 'border-box';
    } else if (tagName === 'CS01WaveEditor') {
        htmlElement.classList.add('gui-wave-editor-view');
        htmlElement.style.boxSizing = 'border-box';
        htmlElement.style.position = 'absolute';
        
        const bg = mergedAttributes['backgroundcolor'] || mergedAttributes['backgroundColor'] || '#1e222b';
        htmlElement.style.backgroundColor = DomUtils.parseColor(bg);
        htmlElement.style.border = '1px solid #3f4452';
        
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        
        const w = parseFloat(mergedAttributes['w'] || '620');
        const h = parseFloat(mergedAttributes['h'] || '346');
        const midY = h / 2;
        
        // Muted horizontal center baseline axis line
        const hLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        hLine.setAttribute("x1", "0");
        hLine.setAttribute("y1", String(midY));
        hLine.setAttribute("x2", String(w));
        hLine.setAttribute("y2", String(midY));
        
        const axisColorStr = mergedAttributes['xaxiscolor'] || mergedAttributes['xAxisColor'] || '#3f4452';
        hLine.setAttribute("stroke", DomUtils.parseColor(axisColorStr));
        hLine.setAttribute("stroke-width", "1");
        if (mergedAttributes['xAxisLineStyle'] === '1') {
            hLine.setAttribute("stroke-dasharray", "1,1");
        }
        svg.appendChild(hLine);
        
        // Core Waveform Path - Resolves color from stylesheet skin definition
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        let dStr = `M 0 ${midY} `;
        for (let x = 0; x <= w; x += 3) {
            const sampleValue = Math.sin(x * 0.04) * (midY * 0.55) * Math.sin(x * 0.005 + 0.5) + Math.cos(x * 0.14) * 8 * Math.sin(x * 0.01);
            const y = midY + sampleValue;
            dStr += `L ${x} ${y.toFixed(1)} `;
        }
        path.setAttribute("d", dStr);
        
        const stylesMap = State.getStyles();
        const styleName = mergedAttributes['style'];
        const styleData = (styleName && stylesMap[styleName]) ? stylesMap[styleName] : {};
        const waveColor = styleData.curveColor || styleData.curvecolor || mergedAttributes['curveColor'] || mergedAttributes['curvecolor'] || styleData.color_text || styleData.color || mergedAttributes['color_text'] || mergedAttributes['color'] || '#3b82f6';
        
        path.setAttribute("stroke", DomUtils.parseColor(waveColor));
        path.setAttribute("stroke-width", mergedAttributes['curveWidth'] || "1.5");
        path.setAttribute("fill", "none");
        svg.appendChild(path);
        
        const handleColor = mergedAttributes['handleColor'] || "#F7BA0B";
        
        // Start / End Slice Selection Lines with square top handle triggers
        const startX = w * 0.12;
        const endX = w * 0.88;
        const squareSize = parseInt(mergedAttributes['activeIndicator_w'] || '10', 10);
        
        [startX, endX].forEach(pos => {
            const selectLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            selectLine.setAttribute("x1", String(pos));
            selectLine.setAttribute("y1", "0");
            selectLine.setAttribute("x2", String(pos));
            selectLine.setAttribute("y2", String(h));
            selectLine.setAttribute("stroke", "rgba(255,255,255,0.4)");
            selectLine.setAttribute("stroke-width", "1");
            svg.appendChild(selectLine);
            
            const squareHandle = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            squareHandle.setAttribute("x", String(pos - squareSize / 2));
            squareHandle.setAttribute("y", "2");
            squareHandle.setAttribute("width", String(squareSize));
            squareHandle.setAttribute("height", String(squareSize));
            squareHandle.setAttribute("fill", DomUtils.parseColor(handleColor));
            svg.appendChild(squareHandle);
        });
        
        // Looping Boundaries - Clean solid line bounding frames with no arrowheads
        if (mergedAttributes['loopingEnabled'] === '1') {
            const loopStart = w * 0.32;
            const loopEnd = w * 0.68;
            const loopLineColor = mergedAttributes['loopingVerticalLineColor'] || handleColor;
            
            const loopRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            loopRect.setAttribute("x", String(loopStart));
            loopRect.setAttribute("y", "0");
            loopRect.setAttribute("width", String(loopEnd - loopStart));
            loopRect.setAttribute("height", String(h));
            loopRect.setAttribute("fill", DomUtils.parseColor(loopLineColor));
            loopRect.setAttribute("fill-opacity", "0.04");
            svg.appendChild(loopRect);
            
            [loopStart, loopEnd].forEach(pos => {
                const vLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
                vLine.setAttribute("x1", String(pos));
                vLine.setAttribute("y1", "0");
                vLine.setAttribute("x2", String(pos));
                vLine.setAttribute("y2", String(h));
                vLine.setAttribute("stroke", DomUtils.parseColor(loopLineColor));
                vLine.setAttribute("stroke-width", "1");
                svg.appendChild(vLine);
            });
        }
        
        htmlElement.appendChild(svg);
    }

    return {
        htmlElement: htmlElement,
        mainElementForAttributes: htmlElement,
        requiresRecursiveRender: true,
        postProcessFunction: null
    };
}

function renderVisibilityContainer(xmlNode, mergedAttributes, currentParams, sourcePath, renderElementCallback) {
    const htmlElement = document.createElement('div');
    htmlElement.classList.add('gui-visibility-container');
    htmlElement.style.position = 'absolute';
    
    if (mergedAttributes['visibilitychangename']) {
        htmlElement.dataset.visibilityChangeName = mergedAttributes['visibilitychangename'];
        // Note: Initial visibility is handled by visibilityController.js
    }

    return {
        htmlElement: htmlElement,
        mainElementForAttributes: htmlElement,
        requiresRecursiveRender: true,
        postProcessFunction: null
    };
}

function renderStandalonePane(xmlNode, mergedAttributes, sourcePath, renderElementCallback, currentParams) {
    const htmlElement = document.createElement('div');
    htmlElement.classList.add('gui-pane');
    
    // Ensure the pane occupies the full content frame area of its parent tab view content slot
    htmlElement.style.position = 'absolute';
    htmlElement.style.top = '0';
    htmlElement.style.left = '0';
    htmlElement.style.width = '100%';
    htmlElement.style.height = '100%';
    
    // Pass attributes down using explicit multi-case support so the tab view can extract them reliably
    htmlElement.dataset.xmlAttr_name = mergedAttributes['name'] || '';
    htmlElement.dataset.xmlAttr_image = mergedAttributes['image'] || '';
    htmlElement.dataset.xmlAttr_imageb = mergedAttributes['imageb'] || '';
    htmlElement.dataset.xmlAttr_imagehl = mergedAttributes['imageHL'] || mergedAttributes['imagehl'] || '';
    htmlElement.dataset.xmlAttr_imageblank = mergedAttributes['imagebHL'] || mergedAttributes['imagebhl'] || mergedAttributes['imagehlb'] || '';

    // Panes often act as simple groupers or background blocks
    return {
        htmlElement: htmlElement,
        mainElementForAttributes: htmlElement,
        requiresRecursiveRender: true,
        postProcessFunction: null
    };
}

function renderTabView(xmlNode, mergedAttributes, currentParams, sourcePath, renderElementCallback) {
    const container = document.createElement('div');
    container.classList.add('gui-tab-view');
    container.style.position = 'absolute';

    // Rule 7 explicitly allows flex container layout structures for TabView elements
    container.style.display = 'flex';

    // The param attribute usually dictates which tab is active
    const tabParam = DomUtils.getParamValue(xmlNode, currentParams.paramOffset);
    container.dataset.param = tabParam;

    const tabBar = document.createElement('div');
    tabBar.classList.add('gui-tab-bar');
    tabBar.style.zIndex = '10';
    tabBar.style.display = 'flex';
    tabBar.style.boxSizing = 'border-box';
    
    // Position handling via directional flex alignment adjustments
    const pos = mergedAttributes['position'] || 'top';
    if (pos === 'bottom') {
        container.style.flexDirection = 'column';
        tabBar.style.width = '100%';
        tabBar.style.flexDirection = 'row';
    } else if (pos === 'left') {
        container.style.flexDirection = 'row-reverse';
        tabBar.style.height = '100%';
        tabBar.style.flexDirection = 'column';
    } else if (pos === 'right') {
        container.style.flexDirection = 'row';
        tabBar.style.height = '100%';
        tabBar.style.flexDirection = 'column';
    } else { // default 'top'
        container.style.flexDirection = 'column-reverse';
        tabBar.style.width = '100%';
        tabBar.style.flexDirection = 'row';
    }

    // Alignment handling
    const align = mergedAttributes['alignment'] || 'left';
    if (pos === 'left' || pos === 'right') {
        if (align === 'bottom' || align === 'right') {
            tabBar.style.justifyContent = 'flex-end';
        } else if (align === 'center') {
            tabBar.style.justifyContent = 'center';
        } else {
            tabBar.style.justifyContent = 'flex-start';
        }
    } else {
        if (align === 'right') {
            tabBar.style.justifyContent = 'flex-end';
        } else if (align === 'center') {
            tabBar.style.justifyContent = 'center';
        } else {
            tabBar.style.justifyContent = 'flex-start';
        }
    }
    
    // Handle alignment-based margin_x padding interpretation
    const marginX = parseFloat(mergedAttributes['margin_x'] || '0');
    if (!isNaN(marginX) && marginX > 0) {
        if (align === 'right') {
            tabBar.style.paddingRight = marginX + 'px';
        } else if (align === 'left') {
            tabBar.style.paddingLeft = marginX + 'px';
        }
    }

    // Read styling for the tab bar from attributes
    if (mergedAttributes['tabBarHeight']) {
        tabBar.style.height = mergedAttributes['tabBarHeight'] + 'px';
    }
    
    const contentArea = document.createElement('div');
    contentArea.classList.add('gui-tab-content-area');
    contentArea.style.position = 'relative'; // Coordinate anchor for nested absolute child controls
    contentArea.style.flexGrow = '1';
    contentArea.style.zIndex = '1';

    if (pos === 'left' || pos === 'right') {
        contentArea.style.height = '100%';
    } else {
        contentArea.style.width = '100%';
    }

    container.appendChild(contentArea);
    container.appendChild(tabBar);

    // Provide a postProcessFunction to construct the tabs *after* the Panes have been rendered
    const postProcessFunction = (element, attrs, params, sourceXmlNode, styleNameString) => {
        let activePaneIndex = 0; // Default to the first pane
        const panes = Array.from(contentArea.children);
        const tabButtonsList = [];

        // Fetch style definitions for font colors from state
        const stylesMap = State.getStyles();
        const styleName = attrs['style'];
        const styleData = (styleName && stylesMap[styleName]) ? stylesMap[styleName] : {};

        const normalColor = styleData.color_text || styleData.color_deselected || attrs['color_deselected'] || attrs['color_text'] || '#FFFFFFFF';
        const activeColor = styleData.color_textHL || styleData.color_selected || attrs['color_selected'] || attrs['color_textHL'] || '#FFFFFFFF';
        
        panes.forEach((pane, index) => {
            if (pane.classList.contains('gui-pane')) {
                const paneName = pane.dataset.xmlAttr_name || `Tab ${index + 1}`;
                 
                const tabButton = document.createElement('button');
                tabButton.classList.add('gui-tab-button');
                tabButton.textContent = paneName;
                tabButton.dataset.targetIndex = index;
                 
                tabButton.style.backgroundColor = 'transparent';
                tabButton.style.border = 'none';
                tabButton.style.cursor = 'pointer';
                tabButton.style.display = 'inline-flex';
                tabButton.style.alignItems = 'center';
                tabButton.style.justifyContent = 'center';
                tabButton.style.padding = '0';

                if (attrs['font']) {
                    DomUtils.applyFont(tabButton, attrs['font']);
                }

                // Resolve image asset paths with mixed-case and lower-case property lookups safely
                const normalImgRel = pane.dataset.xmlAttr_imageb || pane.dataset.xmlAttr_image || attrs['imageb'] || attrs['image'];
                const hlImgRel = pane.dataset.xmlAttr_imageblank || pane.dataset.xmlAttr_imagehl || attrs['imagebHL'] || attrs['imageHL'] || attrs['imagebhl'] || attrs['imagehl'];
                
                const currentSkinRoot = State.getCurrentSkinRoot() || '';
                const normalBlobUrl = normalImgRel ? State.getAssetBlobUrl(State.normalizePath(normalImgRel, currentSkinRoot)) : null;
                const hlBlobUrl = hlImgRel ? State.getAssetBlobUrl(State.normalizePath(hlImgRel, currentSkinRoot)) : null;

                const itemContext = {
                    button: tabButton,
                    pane: pane,
                    index: index,
                    isHovered: false,
                    normalBlobUrl: normalBlobUrl,
                    hlBlobUrl: hlBlobUrl,
                    normalWidth: 0,
                    normalHeight: 0,
                    hlWidth: 0,
                    hlHeight: 0
                };

                itemContext.updateVisuals = () => {
                    const isActive = itemContext.index === activePaneIndex;
                    const isHovered = itemContext.isHovered;

                    // Text color switching based on state style colors
                    if (isActive) {
                        itemContext.button.style.color = DomUtils.parseColor(activeColor);
                        itemContext.button.classList.add('active');
                    } else {
                        itemContext.button.style.color = DomUtils.parseColor(normalColor);
                        itemContext.button.classList.remove('active');
                    }

                    // Completely swap images between normal and highlight tracks
                    const blobUrl = isHovered ? (itemContext.hlBlobUrl || itemContext.normalBlobUrl) : itemContext.normalBlobUrl;
                    const naturalHeight = isHovered ? (itemContext.hlHeight || itemContext.normalHeight) : itemContext.normalHeight;
                    const naturalWidth = isHovered ? (itemContext.hlWidth || itemContext.normalWidth) : itemContext.normalWidth;

                    if (blobUrl) {
                        itemContext.button.style.backgroundImage = `url('${blobUrl}')`;
                        itemContext.button.style.backgroundRepeat = 'no-repeat';
                        itemContext.button.style.backgroundSize = `${naturalWidth}px ${naturalHeight}px`;
                        
                        if (naturalHeight > 0) {
                            const btnW = naturalWidth;
                            const btnH = naturalHeight / 2;
                            itemContext.button.style.width = btnW + 'px';
                            itemContext.button.style.height = btnH + 'px';
                            
                            if (isActive) {
                                itemContext.button.style.backgroundPosition = `0px -${btnH}px`;
                            } else {
                                itemContext.button.style.backgroundPosition = '0px 0px';
                            }
                        }
                    }
                };

                // Pre-cache dimensions to enable pure synchronous state rendering on action events
                if (normalBlobUrl) {
                    const img = new Image();
                    img.onload = () => {
                        itemContext.normalWidth = img.naturalWidth;
                        itemContext.normalHeight = img.naturalHeight;
                        itemContext.updateVisuals();
                    };
                    img.src = normalBlobUrl;
                }
                if (hlBlobUrl) {
                    const img = new Image();
                    img.onload = () => {
                        itemContext.hlWidth = img.naturalWidth;
                        itemContext.hlHeight = img.naturalHeight;
                        itemContext.updateVisuals();
                    };
                    img.src = hlBlobUrl;
                }

                tabButton.addEventListener('mouseenter', () => {
                    itemContext.isHovered = true;
                    itemContext.updateVisuals();
                });

                tabButton.addEventListener('mouseleave', () => {
                    itemContext.isHovered = false;
                    itemContext.updateVisuals();
                });

                tabButton.addEventListener('mousedown', (e) => {
                    if (e.button === 0) { // Select immediately on left click mouse down
                        activePaneIndex = itemContext.index;
                        refreshTabs();
                        console.log(`[TabView] Selected tab: ${itemContext.button.textContent} (Index: ${itemContext.index})`);
                    }
                });

                tabButtonsList.push(itemContext);
            }
        });

        const refreshTabs = () => {
            tabButtonsList.forEach(item => {
                const isActive = item.index === activePaneIndex;
                if (isActive) {
                    item.pane.style.display = 'block'; 
                } else {
                    item.pane.style.display = 'none';
                }
                item.updateVisuals();
            });
        };

        tabButtonsList.forEach(item => {
            tabBar.appendChild(item.button);
        });

        refreshTabs();
    };

    return {
        htmlElement: container, // Append root container to parent
        childAppendElement: contentArea, // Append inner Panes to contentArea
        mainElementForAttributes: container, // Apply main styles to the outer container
        requiresRecursiveRender: true,
        postProcessFunction: postProcessFunction
    };
}

function renderScrollViewWrapper(xmlNode, mergedAttributes, currentParams, sourcePath, renderElementCallback) {
    const outerContainer = document.createElement('div');
    outerContainer.classList.add('gui-scroll-view-container');
    outerContainer.style.position = 'absolute'; 
    outerContainer.style.overflow = 'hidden'; 

    const innerScrollArea = document.createElement('div');
    innerScrollArea.classList.add('gui-scroll-view');
    innerScrollArea.style.position = 'absolute';
    innerScrollArea.style.top = '0';
    innerScrollArea.style.left = '0';
    innerScrollArea.style.width = '100%';
    innerScrollArea.style.height = '100%';
    innerScrollArea.style.overflow = 'scroll'; 
    innerScrollArea.classList.add('hide-scrollbars'); 

    // Specific dimensions for the scrollable content area
    const contentW = parseFloat(mergedAttributes['content_w']);
    const contentH = parseFloat(mergedAttributes['content_h']);

    const contentHolder = document.createElement('div');
    contentHolder.classList.add('gui-scroll-content-holder');
    contentHolder.style.position = 'relative';

    if (!isNaN(contentW)) {
        contentHolder.style.width = `${contentW}px`;
        innerScrollArea.style.overflowX = 'scroll';
    } else {
        innerScrollArea.style.overflowX = 'hidden';
    }

    if (!isNaN(contentH)) {
        contentHolder.style.height = `${contentH}px`;
        innerScrollArea.style.overflowY = 'scroll';
    } else {
        innerScrollArea.style.overflowY = 'hidden';
    }

    innerScrollArea.appendChild(contentHolder);
    outerContainer.appendChild(innerScrollArea);

    const scrollViewName = mergedAttributes['name'];
    if (scrollViewName) {
        outerContainer.dataset.scrollViewName = scrollViewName;
    }

    return {
        htmlElement: outerContainer, // Root appended to DOM
        childAppendElement: contentHolder, // Children appended to content wrapper
        mainElementForAttributes: outerContainer, // Apply layout to outer boundary
        requiresRecursiveRender: true,
        postProcessFunction: null
    };
}

function renderScrollViewPageController(xmlNode, mergedAttributes, currentParams, sourcePath) {
    const globalDefaults = State.getGlobalGuiDefaults();

    const htmlElement = document.createElement('div');
    htmlElement.classList.add('gui-scrollview-pagecontroller');
    const mainElementForAttributes = htmlElement;

    const controllerType = mergedAttributes['type']; 
    const targetScrollViewName = mergedAttributes['scrollViewName'];
    const img1Path_relative = mergedAttributes['image_1']; 
    const img1HLPath_relative = mergedAttributes['image_1HL'];
    const img2Path_relative = mergedAttributes['image_2']; 
    const img2HLPath_relative = mergedAttributes['image_2HL'];
    const currentSkinRoot = State.getCurrentSkinRoot() || '';

    const img1Path = img1Path_relative ? State.normalizePath(img1Path_relative, currentSkinRoot) : null;
    const img1HLPath = img1HLPath_relative ? State.normalizePath(img1HLPath_relative, currentSkinRoot) : null;
    const img2Path = img2Path_relative ? State.normalizePath(img2Path_relative, currentSkinRoot) : null;
    const img2HLPath = img2HLPath_relative ? State.normalizePath(img2HLPath_relative, currentSkinRoot) : null;
    
    const showPageNameAttr = mergedAttributes['showPageName']; 
    const pageNameFont = mergedAttributes['font'];
    const circleEdit = mergedAttributes['circleEdit'] === '1'; 
    const circleColorStr = mergedAttributes['circleEditColor'] || '#00000000';

    const pageNames = new Map();
    xmlNode.querySelectorAll('PageName').forEach(pnNode => {
        const idx = pnNode.getAttribute('idx');
        const name = pnNode.getAttribute('name');
        if (idx && name) pageNames.set(idx, name);
    });

    htmlElement.dataset.scrollViewName = targetScrollViewName || '';
    htmlElement.dataset.controllerType = controllerType || '1'; 
    htmlElement.dataset.pageNames = JSON.stringify(Object.fromEntries(pageNames)); 
    
    // Explicit non-flex fallback structure as demanded by Rule 7
    if (htmlElement && htmlElement.style) {
        htmlElement.style.display = 'block';
        htmlElement.style.whiteSpace = 'nowrap';
    }
    
    const createButton = (action, imgP, imgHLP, fallbackText) => {
        const button = document.createElement('button');
        button.classList.add('scroll-page-button', `${action}-page-button`);
        button.dataset.action = action;
        let hasImage = false;

        if (imgP) {
            const img = document.createElement('img');
            const blobUrl = State.getAssetBlobUrl(imgP);
            if (blobUrl) {
                img.src = blobUrl;
                img.style.display = 'block'; 
                if (imgHLP) {
                    const hlBlobUrl = State.getAssetBlobUrl(imgHLP);
                    if(hlBlobUrl) img.dataset.hlSrc = hlBlobUrl;
                } else {
                    img.dataset.hlSrc = blobUrl; 
                }
                img.dataset.normalSrc = blobUrl;

                img.onerror = () => { button.textContent = fallbackText; img.remove(); };
                const setSize = () => { 
                    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                        button.style.width = `${img.naturalWidth}px`;
                        button.style.height = `${img.naturalHeight}px`;
                        img.style.width = '100%'; img.style.height = '100%';
                    }
                };
                img.onload = setSize;
                if (img.complete && img.naturalWidth > 0) setSize(); 

                button.appendChild(img);
                hasImage = true;
            }
        }
        if (!hasImage) button.textContent = fallbackText;
        
        button.style.background = 'transparent';
        button.style.border = 'none';
        button.style.padding = '0';
        button.style.cursor = 'pointer';
        
        button.style.display = 'inline-block';
        button.style.verticalAlign = 'middle';
        button.style.lineHeight = '0'; 
        return button;
    };

    let prevButton = null;
    let nextButton = null;
    let pageNameElement = null;
    let circleElement = null; 

    const stylesMap = State.getStyles();
    const styleName = mergedAttributes['style'];
    const styleData = (styleName && stylesMap[styleName]) ? stylesMap[styleName] : {}; 
    
    const derivedFontColor = styleData.fontColor || styleData.color_text || mergedAttributes['color_text'] || globalDefaults.color_text; 
    const derivedFontColorHL = styleData.fontColorHL || mergedAttributes['color_textHL'] || globalDefaults.color_text;

    if (controllerType === '1') { 
        prevButton = createButton('toggle', img1Path, img1HLPath, 'Toggle');
    } else if (controllerType === '0') { 
        prevButton = createButton('prev', img1Path, img1HLPath, '‹');
        if (img2Path) {
            nextButton = createButton('next', img2Path, img2HLPath, '›');
        } else {
            DomUtils.showToast(`WARNING: ScrollViewPageController type='0' for '${targetScrollViewName}' is missing image_2.`, 'warn', 8000);
            State.addConsoleLogEntry(`ScrollViewPageController (ScrollView: '${targetScrollViewName}') type='0' missing 'image_2'.`, 'error');
        }
    }

    if (showPageNameAttr === '0') { 
        pageNameElement = document.createElement('div');
        pageNameElement.classList.add('scroll-page-name-display');
        pageNameElement.style.minWidth = '0'; 
        pageNameElement.style.textAlign = 'center';
        pageNameElement.style.overflow = 'hidden'; pageNameElement.style.whiteSpace = 'nowrap';
        pageNameElement.style.textOverflow = 'ellipsis';
        pageNameElement.style.padding = '0 5px'; 
        pageNameElement.style.lineHeight = '1.2'; 
        pageNameElement.style.height = '100%'; 
        
        pageNameElement.style.display = 'inline-block'; 
        pageNameElement.style.verticalAlign = 'middle';
        
        if (pageNameFont) DomUtils.applyFont(pageNameElement, pageNameFont);
        if (derivedFontColor) pageNameElement.style.color = DomUtils.parseColor(derivedFontColor);
        if (derivedFontColorHL) pageNameElement.dataset.fontColorHl = DomUtils.parseColor(derivedFontColorHL); 
        pageNameElement.textContent = pageNames.get('0') || 'Page 1'; 
        pageNameElement.dataset.currentPageIdx = '0';
    } else if (showPageNameAttr === '1') { 
        pageNameElement = document.createElement('select');
        pageNameElement.classList.add('scroll-page-name-select');
        pageNameElement.style.minWidth = '0';
        pageNameElement.style.textAlign = 'center'; 
        pageNameElement.style.margin = '0 5px';
        pageNameElement.style.cursor = 'pointer';
        
        pageNameElement.style.display = 'inline-block';
        pageNameElement.style.verticalAlign = 'middle';
        
        if (pageNameFont) DomUtils.applyFont(pageNameElement, pageNameFont);
        if (derivedFontColor) pageNameElement.style.color = DomUtils.parseColor(derivedFontColor);
        pageNameElement.style.appearance = 'none'; pageNameElement.style.mozAppearance = 'none'; pageNameElement.style.webkitAppearance = 'none';
        pageNameElement.style.border = 'none'; pageNameElement.style.background = 'transparent';
        pageNameElement.style.padding = '2px 5px';
        if (derivedFontColorHL) pageNameElement.dataset.fontColorHl = DomUtils.parseColor(derivedFontColorHL);

        pageNames.forEach((name, idx) => {
            const option = document.createElement('option');
            option.value = idx;
            option.textContent = name;
            if (idx === '0') option.selected = true;
            pageNameElement.appendChild(option);
        });
    }
    
    if (circleEdit) {
        const parsedCircleColor = DomUtils.parseColor(circleColorStr);
        if (parsedCircleColor !== 'rgba(0,0,0,0)' && parsedCircleColor !== 'none') { 
            circleElement = document.createElementNS("http://www.w3.org/2000/svg", "svg"); 
            circleElement.setAttribute('width', '10'); 
            circleElement.setAttribute('height', '10');
            
            if (circleElement.style) {
                circleElement.style.display = 'inline-block';
                circleElement.style.verticalAlign = 'middle';
                circleElement.style.marginLeft = '5px'; 
                circleElement.style.marginRight = '5px';
            }
            const circle = document.createElementNS("http://www.w3.org/2000/svg", 'circle');
            circle.setAttribute('cx', '5'); circle.setAttribute('cy', '5');
            circle.setAttribute('r', '4'); 
            circle.setAttribute('fill', parsedCircleColor);
            circleElement.appendChild(circle);
        }
    }

    if (prevButton) htmlElement.appendChild(prevButton);
    if (pageNameElement) htmlElement.appendChild(pageNameElement);
    if (circleElement) htmlElement.appendChild(circleElement); 
    if (nextButton) htmlElement.appendChild(nextButton);

    return {
        htmlElement: htmlElement,
        mainElementForAttributes: mainElementForAttributes,
        requiresRecursiveRender: false, 
        postProcessFunction: null
    };
}

function renderPopupOverlay(xmlNode, mergedAttributes, renderElementCallback) {
    const htmlElement = document.createElement('div');
    htmlElement.classList.add('gui-popup-overlay');
    htmlElement.style.position = 'absolute';
    htmlElement.style.top = '0';
    htmlElement.style.left = '0';
    htmlElement.style.width = '100%';
    htmlElement.style.height = '100%';
    htmlElement.style.zIndex = '1000'; 
    htmlElement.style.display = 'none'; // Hidden by default
    htmlElement.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'; // Typical overlay shading

    return {
        htmlElement: htmlElement,
        mainElementForAttributes: htmlElement,
        requiresRecursiveRender: true,
        postProcessFunction: null
    };
}

function renderSplash(xmlNode, mergedAttributes, currentParams, sourcePath, renderElementCallback) {
    const htmlElement = document.createElement('div');
    htmlElement.classList.add('gui-splash');
    htmlElement.style.position = 'absolute';
    htmlElement.style.top = '0';
    htmlElement.style.left = '0';
    htmlElement.style.width = '100%';
    htmlElement.style.height = '100%';
    htmlElement.style.zIndex = '2000';
    htmlElement.style.display = 'none'; // Initially hidden
    
    // Splash screens often define a background image
    const imgRelPath = mergedAttributes['image'];
    if (imgRelPath) {
        const currentSkinRoot = State.getCurrentSkinRoot() || '';
        const imgFullPath = State.normalizePath(imgRelPath, currentSkinRoot);
        const blobUrl = State.getAssetBlobUrl(imgFullPath);
        if (blobUrl) {
            htmlElement.style.backgroundImage = `url('${blobUrl}')`;
            htmlElement.style.backgroundRepeat = 'no-repeat';
            htmlElement.style.backgroundPosition = 'center';
            htmlElement.style.backgroundSize = 'contain';
        }
    }

    return {
        htmlElement: htmlElement,
        mainElementForAttributes: htmlElement,
        requiresRecursiveRender: true,
        postProcessFunction: null
    };
}

function renderCS01AssignmentMap(xmlNode, mergedAttributes, currentParams, sourcePath) {
    const htmlElement = document.createElement('div');
    htmlElement.classList.add('gui-assignment-map');
    htmlElement.style.position = 'absolute';
    htmlElement.style.boxSizing = 'border-box';
    htmlElement.style.background = 'transparent';
    htmlElement.style.border = '1px solid #555';
    htmlElement.style.overflow = 'hidden';

    if (!window.chipsynthSamplePool) {
        window.chipsynthSamplePool = [
            "Marcato 1(Mod)", "Happy Pa_76EF", "", "",
            "", "", "", "",
            "", "", "", "",
            "", "", "", ""
        ];
    }

    const numRows = parseInt(mergedAttributes['numrows'] || '16', 10);
    const startIndexDisplay = parseInt(mergedAttributes['startindexdisplay'] || '65', 10);

    const containerH = parseFloat(mergedAttributes['h'] || '357');
    const col0_w = parseInt(mergedAttributes['col0_w'] || '24', 10);
    
    // Auto-calculate exact line row height to fit perfectly down to "P" without spilling or cutting off
    const calculatedRowH = Math.floor((containerH - 2) / numRows);
    const col0_h = calculatedRowH > 0 ? calculatedRowH : parseInt(mergedAttributes['col0_h'] || '20', 10);

    // Data Rows Loop
    for (let i = 0; i < numRows; i++) {
        const row = document.createElement('div');
        row.classList.add('assignment-map-row');
        row.style.position = 'absolute';
        row.style.left = '0px';
        row.style.top = `${i * col0_h}px`;
        row.style.width = '100%';
        row.style.height = `${col0_h}px`;
        row.style.boxSizing = 'border-box';
        if (i < numRows - 1) {
            row.style.borderBottom = '1px solid #555';
        }

        const cell0 = document.createElement('div');
        cell0.style.position = 'absolute';
        cell0.style.left = '0px';
        cell0.style.top = '0px';
        cell0.style.width = `${col0_w}px`;
        cell0.style.height = '100%';
        cell0.style.lineHeight = `${col0_h}px`;
        cell0.style.textAlign = mergedAttributes['col0_alignment'] || 'left';
        cell0.style.paddingLeft = '4px';
        cell0.style.boxSizing = 'border-box';
        cell0.style.borderRight = '1px solid #555';
        cell0.textContent = String.fromCharCode(startIndexDisplay + i);
        if (mergedAttributes['font']) DomUtils.applyFont(cell0, mergedAttributes['font']);
        row.appendChild(cell0);

        const cell1 = document.createElement('div');
        cell1.style.position = 'absolute';
        cell1.style.left = `${col0_w}px`;
        cell1.style.top = '0px';
        cell1.style.right = '0px';
        cell1.style.height = '100%';
        cell1.style.boxSizing = 'border-box';

        const input = document.createElement('input');
        input.type = 'text';
        input.value = window.chipsynthSamplePool[i] || '';
        input.style.position = 'absolute';
        input.style.left = '0px';
        input.style.top = '0px';
        input.style.width = 'calc(100% - 20px)';
        input.style.height = '100%';
        input.style.background = 'transparent';
        input.style.border = 'none';
        input.style.color = 'inherit';
        if (mergedAttributes['font']) DomUtils.applyFont(input, mergedAttributes['font']);
        input.style.outline = 'none';
        input.style.padding = '0 4px';
        input.style.boxSizing = 'border-box';

        const deleteBtn = document.createElement('span');
        deleteBtn.innerHTML = '&#x2715;';
        deleteBtn.style.position = 'absolute';
        deleteBtn.style.right = '6px';
        deleteBtn.style.top = '50%';
        deleteBtn.style.transform = 'translateY(-50%)';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.fontSize = '10px';
        deleteBtn.style.display = 'none';
        deleteBtn.style.color = 'inherit';
        deleteBtn.style.opacity = '0.6';

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            input.value = '';
            window.chipsynthSamplePool[i] = '';
            document.dispatchEvent(new CustomEvent('samplePoolUpdated'));
        });

        input.addEventListener('input', (e) => {
            window.chipsynthSamplePool[i] = e.target.value;
            document.dispatchEvent(new CustomEvent('samplePoolUpdated'));
        });

        const updateHighlight = (isActive) => {
            if (isActive) {
                row.style.backgroundColor = 'rgba(212, 163, 115, 0.35)';
                deleteBtn.style.display = 'block';
            } else {
                row.style.backgroundColor = 'transparent';
                deleteBtn.style.display = 'none';
            }
        };

        input.addEventListener('focus', () => {
            htmlElement.querySelectorAll('.assignment-map-row').forEach(r => r.style.backgroundColor = 'transparent');
            htmlElement.querySelectorAll('.assignment-map-row span').forEach(s => s.style.display = 'none');
            updateHighlight(true);
        });

        row.addEventListener('click', () => {
            input.focus();
        });

        cell1.appendChild(input);
        cell1.appendChild(deleteBtn);
        row.appendChild(cell1);
        htmlElement.appendChild(row);
    }

    return {
        htmlElement: htmlElement,
        mainElementForAttributes: htmlElement,
        requiresRecursiveRender: false,
        postProcessFunction: null
    };
}

export function render(tagName, xmlNode, parentHtmlElement, currentParams, sourcePath, mergedAttributes, renderElementCallback) {
    switch (tagName) {
        case 'GUI':
        case 'CS01ViewContainer':
        case 'CS01ViewContainer1':
        case 'CS01AssignmentMapContainer':
        case 'CS01BrowserContainer':
        case 'CS01Browser':
        case 'CS01WaveEditorContainer':
        case 'CS01WaveEditor':
            return renderViewContainer(tagName, xmlNode, mergedAttributes, renderElementCallback, currentParams, sourcePath);
        case 'CS01AssignmentMap':
            return renderCS01AssignmentMap(xmlNode, mergedAttributes, currentParams, sourcePath);
        case 'VisibilityContainer':
            return renderVisibilityContainer(xmlNode, mergedAttributes, currentParams, sourcePath, renderElementCallback);
        case 'Pane': 
            return renderStandalonePane(xmlNode, mergedAttributes, sourcePath, renderElementCallback, currentParams);
        case 'TabView':
            return renderTabView(xmlNode, mergedAttributes, currentParams, sourcePath, renderElementCallback);
        case 'ScrollView':
            return renderScrollViewWrapper(xmlNode, mergedAttributes, currentParams, sourcePath, renderElementCallback);
        case 'CS01ScrollViewPageController':
            return renderScrollViewPageController(xmlNode, mergedAttributes, currentParams, sourcePath); 
        case 'PopupOverlay':
            return renderPopupOverlay(xmlNode, mergedAttributes, renderElementCallback); 
        case 'Splash':
            return renderSplash(xmlNode, mergedAttributes, currentParams, sourcePath, renderElementCallback);
        default:
            console.warn(`[containerRenderer] Attempted to render unhandled tag: ${tagName} from ${sourcePath}`);
            return { htmlElement: null, mainElementForAttributes: null, requiresRecursiveRender: true, postProcessFunction: null };
    }
}