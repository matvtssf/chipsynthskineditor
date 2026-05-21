import * as State from '../core/state.js';
import * as DomUtils from '../core/domUtils.js';
import { getElementReferenceData } from '../core/references.js';
import { renderElement } from '../core/uiRenderer.js';

let isPhantomDropping = false;
let phantomElement = null;
let selectedElementData = null;
let referenceElements = [];
let filteredElements = [];
let activeItemIndex = -1;

export function setupCanvasInsertInteractions() {
    console.log("[canvasInsert] Setting up canvas insert interactions...");
    
    const addBtn = document.getElementById('add-element-canvas-btn');
    const modal = DomUtils.getCanvasInsertElementModal();
    const closeBtn = DomUtils.getCloseCanvasInsertBtn();
    const searchInput = DomUtils.getCanvasInsertSearch();
    const elementList = DomUtils.getCanvasInsertElementList();
    const detailsName = DomUtils.getCanvasInsertDetailsName();
    const detailsDesc = DomUtils.getCanvasInsertDetailsDesc();

    if (!modal || !searchInput || !elementList) {
        console.warn("[canvasInsert] Modal DOM elements not found.");
        return;
    }

    if (addBtn) {
        // We override the old listener or just add this one.
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof State.getDebugEnabled === 'function' && State.getDebugEnabled()) {
                openModal();
            }
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    searchInput.addEventListener('input', () => {
        filterList(searchInput.value);
    });

    searchInput.addEventListener('keydown', handleModalKeydown);
    elementList.addEventListener('keydown', handleModalKeydown);

    // Phantom drop mouse move
    document.addEventListener('mousemove', (e) => {
        if (isPhantomDropping && phantomElement) {
            phantomElement.style.left = `${e.clientX + 5}px`;
            phantomElement.style.top = `${e.clientY + 5}px`;
            
            // Highlight hovered container
            const hitEls = document.elementsFromPoint(e.clientX, e.clientY);
            let validContainer = null;
            for (const el of hitEls) {
                if (el !== phantomElement && (el.classList.contains('gui-element') || el.id === 'skin-container-actual')) {
                    validContainer = el;
                    break;
                }
            }
            
            document.querySelectorAll('.prospective-drop-zone').forEach(el => el.classList.remove('prospective-drop-zone'));
            document.querySelectorAll('.drop-zone-tooltip').forEach(el => el.remove());
            
            if (validContainer) {
                validContainer.classList.add('prospective-drop-zone');
                const tooltip = document.createElement('div');
                tooltip.className = 'drop-zone-tooltip';
                const tag = validContainer.dataset.xmlTagName || (validContainer.id === 'skin-container-actual' ? 'GUI' : validContainer.tagName.toLowerCase());
                const path = (validContainer.dataset.sourcePath || 'main').split('/').pop();
                tooltip.textContent = `<${tag}> in ${path}`;
                validContainer.appendChild(tooltip);
            }
        }
    });

    // Phantom drop click
    document.addEventListener('click', (e) => {
        if (isPhantomDropping) {
            e.preventDefault();
            e.stopPropagation();
            
            if (e.target.closest('#canvas-insert-element-modal')) {
                return; // Clicking inside modal while it's closing?
            }

            const hitEls = document.elementsFromPoint(e.clientX, e.clientY);
            let targetContainer = null;
            for (const el of hitEls) {
                if (el !== phantomElement && (el.classList.contains('gui-element') || el.id === 'skin-container-actual')) {
                    targetContainer = el;
                    break;
                }
            }

            if (targetContainer) {
                performInsertion(targetContainer, selectedElementData, e.clientX, e.clientY);
            } else {
                DomUtils.showToast("Cannot drop element outside of GUI area.", "warn");
            }
            cancelPhantomDrop();
        }
    }, true);
}

export function handleGlobalAKey(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key && e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (typeof State.getDebugEnabled === 'function' && State.getDebugEnabled()) {
            openModal();
        }
    }
}

export function handleGlobalEscKey(e) {
    if (e.key === 'Escape') {
        const modal = DomUtils.getCanvasInsertElementModal();
        if (modal && modal.style.display === 'flex') {
            closeModal();
            return true; // handled
        }
        if (isPhantomDropping) {
            cancelPhantomDrop();
            return true; // handled
        }
    }
    return false;
}

export function cancelCanvasInsertMode() {
    closeModal();
    cancelPhantomDrop();
}

function openModal() {
    const modal = DomUtils.getCanvasInsertElementModal();
    if (!modal) return;
    
    referenceElements = getElementReferenceData();
    const searchInput = DomUtils.getCanvasInsertSearch();
    if (searchInput) searchInput.value = '';
    
    filterList('');
    
    modal.classList.add('visible');
    modal.style.display = '';
    if (searchInput) {
        setTimeout(() => searchInput.focus(), 50);
    }
}

function closeModal() {
    const modal = DomUtils.getCanvasInsertElementModal();
    if (modal) {
        modal.classList.remove('visible');
    }
}

function filterList(query) {
    const q = (query || '').toLowerCase();
    filteredElements = referenceElements.filter(el => 
        (el.element && el.element.toLowerCase().includes(q)) || 
        (el.description && el.description.toLowerCase().includes(q))
    );
    
    activeItemIndex = filteredElements.length > 0 ? 0 : -1;
    renderList();
}

function renderList() {
    const list = DomUtils.getCanvasInsertElementList();
    if (!list) return;
    
    list.innerHTML = '';
    
    if (filteredElements.length === 0) {
        list.innerHTML = '<li class="p-2 text-gray-500 italic">No elements found.</li>';
        updateDetails(null);
        return;
    }

    filteredElements.forEach((el, index) => {
        const li = document.createElement('li');
        li.className = index === activeItemIndex ? 'selected' : '';
        li.textContent = el.element;
        li.dataset.index = index;
        
        li.addEventListener('click', () => {
            activeItemIndex = index;
            renderList();
            startPhantomDrop(el);
        });
        
        list.appendChild(li);
    });

    if (activeItemIndex >= 0 && activeItemIndex < filteredElements.length) {
        updateDetails(filteredElements[activeItemIndex]);
        const activeLi = list.children[activeItemIndex];
        if (activeLi) activeLi.scrollIntoView({ block: 'nearest' });
    } else {
        updateDetails(null);
    }
}

function updateDetails(elementData) {
    const nameEl = DomUtils.getCanvasInsertDetailsName();
    const descEl = DomUtils.getCanvasInsertDetailsDesc();
    const attrEl = document.getElementById('canvas-insert-details-attributes');
    if (nameEl) nameEl.textContent = elementData ? elementData.element : 'Select an element';
    if (descEl) descEl.textContent = elementData && elementData.description ? elementData.description : '';
    
    if (attrEl) {
        if (elementData && elementData.attributes && Object.keys(elementData.attributes).length > 0) {
            const attrs = Object.keys(elementData.attributes).join(', ');
            attrEl.innerHTML = `<span class="text-gray-500 font-semibold">Attributes:</span> <span class="font-mono break-words">${attrs}</span>`;
        } else {
            attrEl.textContent = '';
        }
    }
}

function handleModalKeydown(e) {
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (activeItemIndex < filteredElements.length - 1) {
            activeItemIndex++;
            renderList();
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (activeItemIndex > 0) {
            activeItemIndex--;
            renderList();
        }
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeItemIndex >= 0 && activeItemIndex < filteredElements.length) {
            startPhantomDrop(filteredElements[activeItemIndex]);
        }
    }
}

function startPhantomDrop(elementData) {
    closeModal();
    selectedElementData = elementData;
    isPhantomDropping = true;
    
    phantomElement = document.createElement('div');
    phantomElement.id = 'phantom-drop-element';
    phantomElement.className = 'absolute pointer-events-none z-[9999] opacity-70 drop-shadow-xl scale-[1.0]';
    
    // Render the phantom visually using uiRenderer
    const parser = new DOMParser();
    const mockXml = `<${elementData.element} x="0" y="0" w="64" h="64" />`;
    const tempDoc = parser.parseFromString(mockXml, "application/xml");
    const mockNode = tempDoc.documentElement;
    
    try {
        renderElement(mockNode, phantomElement, {}, 'phantom.xml');
        if (phantomElement.children.length === 0) {
            throw new Error('Unsupported Renderer');
        }
    } catch (e) {
        // Fallback styling for elements without a renderer
        phantomElement.className = 'absolute pointer-events-none bg-blue-500/80 border-2 border-blue-300 rounded shadow-lg text-white font-mono text-xs z-[9999] opacity-80 flex items-center justify-center p-2 text-center break-words';
        phantomElement.style.width = '64px';
        phantomElement.style.height = '64px';
        phantomElement.textContent = elementData.element;
    }
    
    document.body.appendChild(phantomElement);
    
    document.body.style.cursor = 'crosshair';
}

function cancelPhantomDrop() {
    isPhantomDropping = false;
    selectedElementData = null;
    if (phantomElement && phantomElement.parentNode) {
        phantomElement.parentNode.removeChild(phantomElement);
    }
    phantomElement = null;
    document.body.style.cursor = '';
    document.querySelectorAll('.prospective-drop-zone').forEach(el => el.classList.remove('prospective-drop-zone'));
    document.querySelectorAll('.drop-zone-tooltip').forEach(el => el.remove());
}

function performInsertion(containerEl, elementData, clientX, clientY) {
    let sourcePath = containerEl.dataset.sourcePath;
    
    // If clicking on skin-container-actual, fallback to main UI xml
    if (!sourcePath) {
        sourcePath = typeof State.getActiveFilePath === 'function' ? State.getActiveFilePath() : 'ui.xml';
    }
    
    const currentScale = State.getCurrentZoomLevel() || 1;
    const parentRect = containerEl.getBoundingClientRect();
    const localX = Math.round((clientX - parentRect.left) / currentScale);
    const localY = Math.round((clientY - parentRect.top) / currentScale);
    
    const tagName = elementData.element;
    const newXmlStr = `\n\t<${tagName} x="${localX}" y="${localY}" w="64" h="64" />\n`;

    const fileMap = State.getFileMap();
    if (!fileMap) return;

    const normalizedPath = sourcePath.toLowerCase().replace(/\\/g, '/');
    let targetKey = normalizedPath;
    let fileContent = fileMap.get(normalizedPath);

    if (!fileContent) {
        for (const key of fileMap.keys()) {
            if (key.endsWith('/' + normalizedPath) || normalizedPath.endsWith('/' + key)) {
                targetKey = key;
                fileContent = fileMap.get(key);
                break;
            }
        }
    }

    if (!fileContent) {
        DomUtils.showToast("Failed to locate file content for insertion.", "error");
        return;
    }

    const lastCloseIndex = fileContent.lastIndexOf('</GUI>');
    if (lastCloseIndex !== -1) {
        const newContent = fileContent.slice(0, lastCloseIndex) + newXmlStr + fileContent.slice(lastCloseIndex);
        
        if (typeof State.pushHistoryState === 'function') {
            State.pushHistoryState(targetKey, fileContent);
        }
        
        fileMap.set(targetKey, newContent);
        if (typeof State.setXmlEditorDirty === 'function') State.setXmlEditorDirty(true);

        const instance = State.getEditorInstanceByPath(targetKey);
        if (instance) {
            if (typeof State.updateEditorInstance === 'function') State.updateEditorInstance(instance.uniqueId, { currentContent: newContent });
            const textarea = document.getElementById(`xml-editor-textarea-${instance.uniqueId}`);
            if (textarea) {
                textarea.value = newContent;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }

        DomUtils.showToast(`Dropped ${tagName} into ${targetKey}`, 'success');
        if (typeof window.renderMainGui === 'function') {
            window.renderMainGui();
        }
    } else {
        DomUtils.showToast("Failed to find closing </GUI> tag.", "error");
    }
}
