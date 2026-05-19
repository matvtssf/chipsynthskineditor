/**
 * historyInteractions.js
 * Handles global undo/redo keyboard shortcuts and canvas control buttons.
 */
import * as State from '../core/state.js';
import { showToast } from '../core/domUtils.js';

export function performUndo() {
    if (!State.canUndo()) return;
    const targetState = State.peekUndoState();
    if (!targetState) return;

    const currentContent = State.getFileContent(targetState.path);
    const restoredState = State.popUndoState(currentContent);
    if (restoredState !== null) {
        State.setIsUndoRedoExecuting(true);
        document.dispatchEvent(new CustomEvent('applyHistoryState', { detail: { path: restoredState.path, content: restoredState.content } }));
        if (typeof showToast === 'function') showToast("Undo applied", "info", 1000);
        State.setIsUndoRedoExecuting(false);
    }
}

export function performRedo() {
    if (!State.canRedo()) return;
    const targetState = State.peekRedoState();
    if (!targetState) return;

    const currentContent = State.getFileContent(targetState.path);
    const restoredState = State.popRedoState(currentContent);
    if (restoredState !== null) {
        State.setIsUndoRedoExecuting(true);
        document.dispatchEvent(new CustomEvent('applyHistoryState', { detail: { path: restoredState.path, content: restoredState.content } }));
        if (typeof showToast === 'function') showToast("Redo applied", "info", 1000);
        State.setIsUndoRedoExecuting(false);
    }
}

export function handleUndoRedoShortcuts(e) {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        performUndo();
    } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        performRedo();
    }
}

export function setupCanvasControlButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const addBtn = document.getElementById('add-element-canvas-btn');
    const topControls = document.getElementById('canvas-controls-top');
    const midControls = document.getElementById('canvas-controls-mid');

    const checkHasProject = () => {
        if (typeof State.getCurrentSkinRoot === 'function') return !!State.getCurrentSkinRoot();
        return State.getFileMap && State.getFileMap().size > 0;
    };

    const updateButtonStates = () => {
        if (undoBtn) undoBtn.classList.toggle('disabled', !State.canUndo());
        if (redoBtn) redoBtn.classList.toggle('disabled', !State.canRedo());
        
        const hasProject = checkHasProject();
        if (topControls) topControls.classList.toggle('controls-hidden', !hasProject);
        if (midControls) midControls.classList.toggle('controls-hidden', !hasProject);
    };
    
    document.addEventListener('historyChanged', updateButtonStates);
    
    let lastMouseX = window.innerWidth;
    document.body.classList.add('controls-retracted');

    document.addEventListener('mousemove', (e) => {
        lastMouseX = e.clientX;
        if (document.body.dataset.showcaseActive === 'true') return;
        
        if (!checkHasProject()) return;

        if (lastMouseX < 160) {
            document.body.classList.remove('controls-retracted');
        } else {
            document.body.classList.add('controls-retracted');
        }
    });

    document.addEventListener('appProjectLoaded', () => {
        updateButtonStates();
        document.body.dataset.showcaseActive = 'true';
        document.body.classList.remove('controls-retracted');
        
        setTimeout(() => {
            document.body.dataset.showcaseActive = 'false';
            if (lastMouseX >= 160) {
                document.body.classList.add('controls-retracted');
            }
        }, 2500); 
    });
    
    setInterval(updateButtonStates, 1000);
    updateButtonStates();

    if (undoBtn) undoBtn.addEventListener('click', performUndo);
    if (redoBtn) redoBtn.addEventListener('click', performRedo);
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            console.log("[globalListeners] Add Element clicked");
            if (typeof showToast === 'function') showToast("Add Element (Stub)", "info", 1000);
        });
    }
}
