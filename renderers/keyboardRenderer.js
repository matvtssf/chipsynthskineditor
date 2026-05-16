// File: cs/renderers/keyboardRenderer.js
import * as DomUtils from '/cs/domUtils.js';
import * as State from '/cs/state.js';

function renderCS01Keyboard(xmlNode, mergedAttributes, currentParams, sourcePath) {
    const htmlElement = document.createElement('div');
    htmlElement.classList.add('gui-keyboard-container');

    const param = mergedAttributes['param'];
    const startKey = parseInt(mergedAttributes['start_key'] || '24', 10); // This is the first key to process
    const endKey = parseInt(mergedAttributes['end_key'] || '96', 10);
    const keyboardContainerWidth = parseFloat(mergedAttributes['w'] || '878');
    const keyboardHeight = parseFloat(mergedAttributes['h'] || '88');

    const whiteKeyOffPath_relative = mergedAttributes['white_key_off'];
    const whiteKeyOnPath_relative = mergedAttributes['white_key_on'];
    const blackKeyOffPath_relative = mergedAttributes['black_key_off'];
    const blackKeyOnPath_relative = mergedAttributes['black_key_on'];

    const inactiveColor = DomUtils.parseColor(mergedAttributes['inactiveColor'] || '#11111199');
    const currentSkinRoot = State.getCurrentSkinRoot() || '';

    htmlElement.dataset.param = param || '';
    htmlElement.style.width = `${keyboardContainerWidth}px`;
    htmlElement.style.height = `${keyboardHeight}px`;
    htmlElement.style.position = 'relative';

    const getDimPromise = (path_relative, fallbackDims) => {
        if (!path_relative) return Promise.resolve({ loaded: false, ...fallbackDims });
        const fullPath = State.normalizePath(path_relative, currentSkinRoot);
        return DomUtils.getSvgDimensions(fullPath, fallbackDims);
    };

    let numberOfWhiteKeys = 0;
    for (let midiNote = startKey; midiNote <= endKey; midiNote++) {
        if (DomUtils.getNoteInfo(midiNote).isWhite) {
            numberOfWhiteKeys++;
        }
    }
    const calculatedWhiteKeyWidth = numberOfWhiteKeys > 0 ? (keyboardContainerWidth / numberOfWhiteKeys) : 23;

    const NATIVE_WHITE_KEY_WIDTH_FALLBACK = calculatedWhiteKeyWidth;
    const NATIVE_WHITE_KEY_HEIGHT_FALLBACK = keyboardHeight;
    const NATIVE_BLACK_KEY_WIDTH_FALLBACK = Math.max(10, calculatedWhiteKeyWidth * 0.6);
    const NATIVE_BLACK_KEY_HEIGHT_FALLBACK = keyboardHeight * 0.65;

    Promise.all([
        getDimPromise(whiteKeyOffPath_relative, { defaultWidth: NATIVE_WHITE_KEY_WIDTH_FALLBACK, defaultHeight: NATIVE_WHITE_KEY_HEIGHT_FALLBACK }),
        getDimPromise(blackKeyOffPath_relative, { defaultWidth: NATIVE_BLACK_KEY_WIDTH_FALLBACK, defaultHeight: NATIVE_BLACK_KEY_HEIGHT_FALLBACK })
    ]).then(([whiteKeyDim, blackKeyDim]) => {
        let whiteKeyActualRenderWidth = whiteKeyDim.loaded && whiteKeyDim.width > 0 ? whiteKeyDim.width : calculatedWhiteKeyWidth;
        let whiteKeyActualRenderHeight = whiteKeyDim.loaded && whiteKeyDim.height > 0 ? whiteKeyDim.height : keyboardHeight;

        if (whiteKeyDim.loaded && whiteKeyOffPath_relative && (whiteKeyDim.width === NATIVE_WHITE_KEY_WIDTH_FALLBACK && whiteKeyDim.height === NATIVE_WHITE_KEY_HEIGHT_FALLBACK) && (whiteKeyDim.width === 0 || whiteKeyDim.height === 0) ) {
            whiteKeyActualRenderWidth = calculatedWhiteKeyWidth;
            whiteKeyActualRenderHeight = keyboardHeight;
        } else if (!whiteKeyDim.loaded && whiteKeyOffPath_relative) {
             whiteKeyActualRenderWidth = calculatedWhiteKeyWidth;
             whiteKeyActualRenderHeight = keyboardHeight;
        }

        let blackKeyActualRenderWidth = blackKeyDim.loaded && blackKeyDim.width > 0 ? blackKeyDim.width : NATIVE_BLACK_KEY_WIDTH_FALLBACK;
        let blackKeyActualRenderHeight = blackKeyDim.loaded && blackKeyDim.height > 0 ? blackKeyDim.height : NATIVE_BLACK_KEY_HEIGHT_FALLBACK;

        htmlElement.innerHTML = ''; 

        const keyDataList = [];
        let currentWhiteKeyX = 0; 

        for (let midiNote = startKey; midiNote <= endKey; midiNote++) {
            const noteInfo = DomUtils.getNoteInfo(midiNote);
            const keyIsWhite = noteInfo.isWhite;

            const offStatePath_relative_current = keyIsWhite ? whiteKeyOffPath_relative : blackKeyOffPath_relative;
            const onStatePath_relative_current = keyIsWhite ? whiteKeyOnPath_relative : blackKeyOnPath_relative;
            const offStatePath_full = offStatePath_relative_current ? State.normalizePath(offStatePath_relative_current, currentSkinRoot) : '';
            const onStatePath_full = onStatePath_relative_current ? State.normalizePath(onStatePath_relative_current, currentSkinRoot) : '';

            const renderWidth = keyIsWhite ? whiteKeyActualRenderWidth : blackKeyActualRenderWidth;
            const renderHeight = keyIsWhite ? whiteKeyActualRenderHeight : blackKeyActualRenderHeight;

            let keyX;
            if (keyIsWhite) {
                keyX = currentWhiteKeyX;
                currentWhiteKeyX += renderWidth;
            } else {
                let associatedWhiteKeyX = 0;
                if (keyDataList.length > 0) { 
                    for (let i = keyDataList.length - 1; i >= 0; i--) {
                        if (keyDataList[i].isWhite) {
                            associatedWhiteKeyX = keyDataList[i].x;
                            break;
                        }
                    }
                }
                keyX = associatedWhiteKeyX + whiteKeyActualRenderWidth - (renderWidth / 2); 
            }
            keyDataList.push({
                midiNote, noteInfo, isWhite: keyIsWhite,
                x: keyX, y: 0, 
                w: renderWidth, h: renderHeight,
                offStatePath: offStatePath_full,
                onStatePath: onStatePath_full,
                z: keyIsWhite ? 1 : 2,
                isVisuallyHiddenStartKey: false // Initialize flag
            });
        }

        const allKeyElements = []; 

        keyDataList.forEach(keyData => {
            const keyElement = document.createElement('img'); 
            keyElement.classList.add('gui-key', keyData.isWhite ? 'gui-key-white' : 'gui-key-black');
            // Only add 'clickable-key' if not the hidden start key
            
            const offBlobUrl = keyData.offStatePath ? State.getAssetBlobUrl(keyData.offStatePath) : '';
            const onBlobUrl = keyData.onStatePath ? State.getAssetBlobUrl(keyData.onStatePath) : '';

            keyElement.dataset.offSrc = offBlobUrl || '';
            keyElement.dataset.onSrc = onBlobUrl || ''; 
            keyElement.dataset.isPressed = "false";

            if (offBlobUrl) {
                keyElement.src = offBlobUrl;
            } else {
                 keyElement.style.backgroundColor = keyData.isWhite ? '#FFFFFF' : '#333333';
                 keyElement.alt = `No OFF SVG for ${keyData.noteInfo.noteNameWithOctave}`; 
            }

            keyElement.alt = `${keyData.noteInfo.noteNameWithOctave}`;
            keyElement.style.position = 'absolute';
            keyElement.style.left = `${keyData.x}px`;
            keyElement.style.top = `${keyData.y}px`;
            keyElement.style.width = `${keyData.w}px`;
            keyElement.style.height = `${keyData.h}px`;
            keyElement.style.zIndex = keyData.z;
            keyElement.style.padding = '0'; 
            keyElement.dataset.midiNote = keyData.midiNote;
            keyElement.style.cursor = 'pointer';
            keyElement.style.objectFit = 'fill'; 

            // MODIFICATION: Handle hidden 'B' if it's the startKey
            // This assumes the XML start_key is set to this B note.
            if (keyData.midiNote === startKey && keyData.noteInfo.note === 'B' && keyData.isWhite) {
                console.log(`[keyboardRenderer] Hiding startKey B: MIDI ${keyData.midiNote}`);
                keyElement.style.visibility = 'hidden';
                keyElement.style.pointerEvents = 'none'; // Make it non-interactive
                keyData.isVisuallyHiddenStartKey = true; // Flag it
            } else {
                keyElement.classList.add('clickable-key');
                allKeyElements.push(keyElement); // Only add clickable keys to this list
            }


            const pressKey = (targetElement) => { 
                if (targetElement.dataset.isPressed === "false") {
                    if (targetElement.dataset.onSrc) {
                        targetElement.src = targetElement.dataset.onSrc;
                    } else if (targetElement.dataset.offSrc) { 
                        targetElement.src = targetElement.dataset.offSrc;
                        targetElement.style.filter = 'brightness(0.7)'; 
                    } else {
                        targetElement.style.filter = 'brightness(0.7)'; 
                    }
                    targetElement.dataset.isPressed = "true";
                    targetElement.classList.add('key-pressed');
                }
            };
            const releaseKey = (targetElement) => {
               if (targetElement.dataset.isPressed === "true") {
                    if (targetElement.dataset.offSrc) {
                        targetElement.src = targetElement.dataset.offSrc;
                    }
                    targetElement.style.filter = 'brightness(1)'; 
                    targetElement.dataset.isPressed = "false";
                    targetElement.classList.remove('key-pressed');
                }
            };

            if (!keyData.isVisuallyHiddenStartKey) { // Only add listeners to visible/interactive keys
                keyElement.addEventListener('mousedown', (e) => { 
                    e.preventDefault();
                    pressKey(keyElement);
                    const globalMouseUpHandler = () => {
                        allKeyElements.forEach(kEl => releaseKey(kEl));
                        window.removeEventListener('mouseup', globalMouseUpHandler, true);
                    };
                    window.addEventListener('mouseup', globalMouseUpHandler, { once: true, capture: true });
                 });
                keyElement.addEventListener('mouseenter', (e) => { 
                    if (e.buttons === 1) { pressKey(keyElement); }
                });
                keyElement.addEventListener('mouseleave', (e) => { 
                    if (keyElement.dataset.isPressed === "true" && e.buttons === 1) { releaseKey(keyElement); }
                });
            }

            htmlElement.appendChild(keyElement);

            // Inactive Key Overlay Logic
            // Do not add overlay to the visually hidden start key
            if (!keyData.isVisuallyHiddenStartKey) {
                const loKeyParamId = mergedAttributes['loKeyParamId'] || 514; 
                const hiKeyParamId = mergedAttributes['hiKeyParamId'] || 515; 

                let currentLoKey = State.getElementState(String(loKeyParamId), 0); 
                let currentHiKey = State.getElementState(String(hiKeyParamId), 127); 

                currentLoKey = (currentLoKey !== null && !isNaN(parseInt(currentLoKey,10))) ? parseInt(currentLoKey, 10) : 0;
                currentHiKey = (currentHiKey !== null && !isNaN(parseInt(currentHiKey,10))) ? parseInt(currentHiKey, 10) : 127;

                 if (keyData.midiNote < currentLoKey || keyData.midiNote > currentHiKey) {
                    const overlay = document.createElement('div');
                    overlay.classList.add('gui-key-inactive-overlay');
                    overlay.style.position = 'absolute';
                    overlay.style.left = `${keyData.x}px`;
                    overlay.style.top = `${keyData.y}px`;
                    overlay.style.width = `${keyData.w}px`;
                    overlay.style.height = `${keyData.h}px`;
                    overlay.style.backgroundColor = inactiveColor;
                    overlay.style.zIndex = (keyData.z + 1); 
                    overlay.style.pointerEvents = 'none'; 
                    htmlElement.appendChild(overlay);
                }
            }
        });

    }).catch(error => {
        DomUtils.logError(`[keyboardRenderer] Error fetching key image dimensions for keyboard "${param}".`, error);
        htmlElement.innerHTML = ''; 
        const errorPlaceholder = DomUtils.createErrorPlaceholder('Keyboard Render Error');
        htmlElement.appendChild(errorPlaceholder);
        if (!htmlElement.style.width) htmlElement.style.width = `${keyboardContainerWidth}px`;
        if (!htmlElement.style.height) htmlElement.style.height = `${keyboardHeight}px`;
    });

    return {
        htmlElement: htmlElement,
        mainElementForAttributes: htmlElement,
        requiresRecursiveRender: false, 
        postProcessFunction: null       
    };
}

export function render(tagName, xmlNode, parentHtmlElement, currentParams, sourcePath, mergedAttributes) {
    if (tagName === 'CS01Keyboard') {
        return renderCS01Keyboard(xmlNode, mergedAttributes, currentParams, sourcePath);
    } else {
        console.warn(`[keyboardRenderer] Attempted to render unhandled tag: ${tagName}`);
        return { htmlElement: null, mainElementForAttributes: null, requiresRecursiveRender: true, postProcessFunction: null };
    }
}