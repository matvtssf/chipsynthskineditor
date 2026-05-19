/**
 * xmlReconciler.js
 * Core AST-like manipulation functions for locating, syncing, and mutating element blocks in the raw XML cache.
 */
import * as State from './state.js';

export function getAttributesFromTagString(tagString) {
    const attrs = {};
    const closingBracketIndex = tagString.indexOf('>');
    const openingTagContent = closingBracketIndex !== -1 ? tagString.slice(0, closingBracketIndex) : tagString;
    
    const regex = /([a-zA-Z0-9_\-:]+)=\s*["']([^"']*)["']/g;
    let match;
    while ((match = regex.exec(openingTagContent)) !== null) {
        const name = match[1];
        const value = match[2];
        if (name !== 'xmlns' && !name.startsWith('xmlns:')) {
            attrs[name] = value;
        }
    }
    return attrs;
}

export function findElementInXmlContent(fileContent, tagName, targetAttrs) {
    let indices = [];
    const regexSearch = new RegExp(`<${tagName}\\b`, 'gi');
    let match;
    while ((match = regexSearch.exec(fileContent)) !== null) {
        indices.push(match.index);
    }
    
    console.log(`[XML Finder] Found ${indices.length} potential case-insensitive occurrences for <${tagName}>`);
    
    let bestMatch = null;
    let maxScore = -1;
    
    for (const index of indices) {
        const closeIndex = fileContent.indexOf('>', index);
        if (closeIndex === -1) continue;
        
        const openingTagText = fileContent.slice(index, closeIndex + 1);
        const fileTagAttrs = getAttributesFromTagString(openingTagText);
        
        let score = 0;
        let isStrictMismatch = false;
        
        if (fileTagAttrs['x'] !== undefined && targetAttrs['x'] !== undefined) {
            if (parseInt(fileTagAttrs['x'], 10) === parseInt(targetAttrs['x'], 10)) {
                score += 100;
            } else {
                isStrictMismatch = true;
            }
        }
        
        if (fileTagAttrs['y'] !== undefined && targetAttrs['y'] !== undefined) {
            if (parseInt(fileTagAttrs['y'], 10) === parseInt(targetAttrs['y'], 10)) {
                score += 100;
            } else {
                isStrictMismatch = true;
            }
        }
        
        if (isStrictMismatch) continue;
        
        const fW = fileTagAttrs['w'] !== undefined ? fileTagAttrs['w'] : fileTagAttrs['width'];
        const tW = targetAttrs['w'] !== undefined ? targetAttrs['w'] : targetAttrs['width'];
        if (fW !== undefined && tW !== undefined) {
            if (parseInt(fW, 10) === parseInt(tW, 10)) {
                score += 50;
            } else {
                score -= 10;
            }
        }
        
        const fH = fileTagAttrs['h'] !== undefined ? fileTagAttrs['h'] : fileTagAttrs['height'];
        const tH = targetAttrs['h'] !== undefined ? targetAttrs['h'] : targetAttrs['height'];
        if (fH !== undefined && tH !== undefined) {
            if (parseInt(fH, 10) === parseInt(tH, 10)) {
                score += 50;
            } else {
                score -= 10;
            }
        }
        
        const otherKeys = ['param', 'identifier', 'name', 'text', 'style', 'alignment', 'font', 'alias', 'start_key', 'end_key'];
        for (const key of otherKeys) {
            if (fileTagAttrs[key] !== undefined && targetAttrs[key] !== undefined) {
                if (String(fileTagAttrs[key]).trim().toLowerCase() === String(targetAttrs[key]).trim().toLowerCase()) {
                    score += 30;
                } else {
                    score -= 20;
                }
            }
        }
        
        if (score > maxScore) {
            maxScore = score;
            
            if (openingTagText.trim().endsWith('/>')) {
                bestMatch = { index: index, length: (closeIndex - index) + 1, exactStr: openingTagText };
                continue;
            }
            
            const closeTagSearch = `</${tagName}>`.toLowerCase();
            let nesting = 1;
            let currentPos = closeIndex + 1;
            const openTagSearch = `<${tagName}`.toLowerCase();
            const lowerContent = fileContent.toLowerCase();
            let matchedLength = openingTagText.length;
            let matchedStr = openingTagText;
            
            while (nesting > 0) {
                const nextOpen = lowerContent.indexOf(openTagSearch, currentPos);
                const nextClose = lowerContent.indexOf(closeTagSearch, currentPos);
                
                if (nextClose === -1) {
                    const simpleClose = lowerContent.indexOf(closeTagSearch, index);
                    if (simpleClose !== -1) {
                        matchedLength = (simpleClose - index) + closeTagSearch.length;
                        matchedStr = fileContent.slice(index, simpleClose + closeTagSearch.length);
                    }
                    break;
                }
                
                if (nextOpen !== -1 && nextOpen < nextClose) {
                    const nc = lowerContent.charAt(nextOpen + openTagSearch.length);
                    if (nc === ' ' || nc === '\t' || nc === '\r' || nc === '\n' || nc === '>' || nc === '/') {
                        const nextOpenClose = lowerContent.indexOf('>', nextOpen);
                        if (nextOpenClose !== -1 && fileContent.slice(nextOpen, nextOpenClose + 1).trim().endsWith('/>')) {
                            currentPos = nextOpenClose + 1;
                        } else {
                            nesting++;
                            currentPos = nextOpen + openTagSearch.length;
                        }
                    } else {
                        currentPos = nextOpen + openTagSearch.length;
                    }
                } else {
                    nesting--;
                    currentPos = nextClose + closeTagSearch.length;
                    if (nesting === 0) {
                        matchedLength = currentPos - index;
                        matchedStr = fileContent.slice(index, currentPos);
                    }
                }
            }
            
            bestMatch = { index: index, length: matchedLength, exactStr: matchedStr };
        }
    }
    
    if (bestMatch) {
        console.log(`[XML Finder] Best verified match at index ${bestMatch.index} with score ${maxScore}`);
        return bestMatch;
    }
    
    console.warn(`[XML Finder] Signature match failed for <${tagName}> with attributes:`, targetAttrs);
    return null;
}

export function syncElementChangesToXmlSource(el) {
    const filePath = el.dataset.sourcePath;
    if (!filePath) {
        console.error("[Reconciliation Engine] Element missing valid dataset sourcePath.");
        return;
    }

    const tagName = el.dataset.xmlTagName;
    const oldRawXml = el.dataset.rawXml || "";
    if (!tagName || !oldRawXml) {
        console.error("[Reconciliation Engine] Element missing xmlTagName or rawXml reference.");
        return;
    }

    let attributesStr = "";
    const attributesArray = [];
    const targetAttrs = {};
    for (const key in el.dataset) {
        if (key.startsWith('xmlAttr_')) {
            const attrName = key.slice(8);
            attributesArray.push({ name: attrName, value: el.dataset[key] });
            targetAttrs[attrName] = el.dataset[key];
        }
    }
    
    attributesArray.sort((a, b) => a.name.localeCompare(b.name));
    attributesArray.forEach(attr => {
        attributesStr += ` ${attr.name}="${attr.value}"`;
    });

    let newRawXml = "";
    if (oldRawXml.trim().endsWith('/>')) {
        newRawXml = `<${tagName}${attributesStr} />`;
    } else {
        const closingBracketIndex = oldRawXml.indexOf('>');
        const originalRemainder = oldRawXml.slice(closingBracketIndex);
        newRawXml = `<${tagName}${attributesStr}${originalRemainder.startsWith(' />') ? ' /' : ''}>`;
    }

    const fileMap = State.getFileMap();
    const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');
    
    let targetKey = normalizedPath;
    let fileContent = fileMap.get(normalizedPath);
    
    if (!fileContent) {
        for (const key of fileMap.keys()) {
            if (key.endsWith('/' + normalizedPath)) {
                targetKey = key;
                fileContent = fileMap.get(key);
                break;
            }
        }
    }

    if (!fileContent) {
        console.error(`[Reconciliation Engine] File content not found in map cache for path: ${normalizedPath}`);
        return;
    }

    const matchResult = findElementInXmlContent(fileContent, tagName, targetAttrs);
    
    if (matchResult) {
        if (typeof State.pushHistoryState === 'function') {
            State.pushHistoryState(targetKey, fileContent);
        }
        fileContent = fileContent.slice(0, matchResult.index) + newRawXml + fileContent.slice(matchResult.index + matchResult.length);
        fileMap.set(targetKey, fileContent);
        console.log(`[Reconciliation Engine] Successfully updated <${tagName}> inside file cache content.`);
    } else {
        console.warn(`[Reconciliation Engine] Could not match <${tagName}> in file content for sync.`);
    }

    let instance = State.getEditorInstanceByPath(targetKey);
    if (!instance) {
        instance = State.getEditorInstanceByPath(normalizedPath);
    }
    if (instance) {
        let currentEditorContent = instance.currentContent;
        if (currentEditorContent) {
            const editorMatch = findElementInXmlContent(currentEditorContent, tagName, targetAttrs);
            if (editorMatch) {
                currentEditorContent = currentEditorContent.slice(0, editorMatch.index) + newRawXml + currentEditorContent.slice(editorMatch.index + editorMatch.length);
                State.updateEditorInstance(instance.uniqueId, { currentContent: currentEditorContent });
                
                const textarea = document.getElementById(`xml-editor-textarea-${instance.uniqueId}`);
                if (textarea) {
                    const scrollPos = textarea.scrollTop;
                    textarea.value = currentEditorContent;
                    textarea.scrollTop = scrollPos;
                    textarea.dispatchEvent(new Event('input'));
                }
            }
        }
    }

    el.dataset.rawXml = newRawXml;
}

export function deleteElementFromXml(el) {
    const filePath = el.dataset.sourcePath;
    if (!filePath) {
        console.error("[Reconciliation Deletion] Element contains no sourcePath reference dataset.");
        return false;
    }

    const tagName = el.dataset.xmlTagName;
    const oldRawXml = el.dataset.rawXml || "";
    if (!tagName || !oldRawXml) {
        console.error("[Reconciliation Deletion] Missing element signature tag descriptors.");
        return false;
    }

    const fileMap = State.getFileMap();
    const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');
    
    let targetKey = normalizedPath;
    let fileContent = fileMap.get(normalizedPath);
    
    if (!fileContent) {
        for (const key of fileMap.keys()) {
            if (key.endsWith('/' + normalizedPath)) {
                targetKey = key;
                fileContent = fileMap.get(key);
                break;
            }
        }
    }

    if (!fileContent) {
        console.error(`[Reconciliation Deletion] File mapping cache text is empty for path: ${normalizedPath}`);
        return false;
    }

    const targetAttrs = {};
    for (const key in el.dataset) {
        if (key.startsWith('xmlAttr_')) {
            const attrName = key.slice(8);
            targetAttrs[attrName] = el.dataset[key];
        }
    }

    const matchResult = findElementInXmlContent(fileContent, tagName, targetAttrs);
    
    if (matchResult) {
        if (typeof State.pushHistoryState === 'function') {
            State.pushHistoryState(targetKey, fileContent);
        }
        fileContent = fileContent.slice(0, matchResult.index) + fileContent.slice(matchResult.index + matchResult.length);
        fileMap.set(targetKey, fileContent);
        console.log(`[Reconciliation Deletion] Successfully removed <${tagName}> from file map.`);
    } else {
        console.error(`[Reconciliation Deletion] Critical match failure: could not find tag in source file text.`);
        return false;
    }

    let instance = State.getEditorInstanceByPath(targetKey);
    if (!instance) {
        instance = State.getEditorInstanceByPath(normalizedPath);
    }
    if (instance) {
        let currentEditorContent = instance.currentContent;
        if (currentEditorContent) {
            const editorMatch = findElementInXmlContent(currentEditorContent, tagName, targetAttrs);
            if (editorMatch) {
                currentEditorContent = currentEditorContent.slice(0, editorMatch.index) + currentEditorContent.slice(editorMatch.index + editorMatch.length);
                State.updateEditorInstance(instance.uniqueId, { currentContent: currentEditorContent });
                
                const textarea = document.getElementById(`xml-editor-textarea-${instance.uniqueId}`);
                if (textarea) {
                    const scrollPos = textarea.scrollTop;
                    textarea.value = currentEditorContent;
                    textarea.scrollTop = scrollPos;
                    textarea.dispatchEvent(new Event('input'));
                }
            }
        }
    }

    State.setXmlEditorDirty(true);
    return true;
}

export function updateXmlCoords(rawXml, newX, newY) {
    let updated = rawXml;
    const firstTagEnd = updated.indexOf('>');
    if (firstTagEnd === -1) return rawXml;
    let openingTag = updated.substring(0, firstTagEnd);
    const remainder = updated.substring(firstTagEnd);
    
    if (/(\s+x=)["'][^"']*["']/.test(openingTag)) {
        openingTag = openingTag.replace(/(\s+x=)["'][^"']*["']/, `$1"${newX}"`);
    } else {
        if (openingTag.endsWith('/')) {
            openingTag = openingTag.substring(0, openingTag.length - 1) + ` x="${newX}"/`;
        } else {
            openingTag = openingTag + ` x="${newX}"`;
        }
    }
    
    if (/(\s+y=)["'][^"']*["']/.test(openingTag)) {
        openingTag = openingTag.replace(/(\s+y=)["'][^"']*["']/, `$1"${newY}"`);
    } else {
        if (openingTag.endsWith('/')) {
            openingTag = openingTag.substring(0, openingTag.length - 1) + ` y="${newY}"/`;
        } else {
            openingTag = openingTag + ` y="${newY}"`;
        }
    }
    return openingTag + remainder;
}

export function toggleElementCommentState(el) {
    const filePath = el.dataset.sourcePath;
    const tagName = el.dataset.xmlTagName;
    if (!filePath || !tagName) return false;

    const fileMap = State.getFileMap();
    const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');
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
    if (!fileContent) return false;

    const targetAttrs = {};
    for (const key in el.dataset) {
        if (key.startsWith('xmlAttr_')) {
            targetAttrs[key.slice(8)] = el.dataset[key];
        }
    }

    const matchResult = findElementInXmlContent(fileContent, tagName, targetAttrs);
    if (!matchResult) return false;

    if (typeof State.pushHistoryState === 'function') {
        State.pushHistoryState(targetKey, fileContent);
    }

    const isCommented = el.dataset.isCommented === 'true';
    let startIndex = matchResult.index;
    let endIndex = matchResult.index + matchResult.length;
    let newElementStr = matchResult.exactStr;

    if (isCommented) {
        // Turning ON (Removing comments)
        const textBefore = fileContent.slice(0, startIndex);
        const lastCommentOpen = textBefore.lastIndexOf('');

        if (lastCommentOpen !== -1 && firstCommentClose !== -1) {
            const betweenBefore = textBefore.slice(lastCommentOpen + 4);
            const betweenAfter = textAfter.slice(0, firstCommentClose);
            
            // Only unwrap if there are no other tags caught in the crossfire
            if (!betweenBefore.includes('>') && !betweenAfter.includes('<')) {
                startIndex = lastCommentOpen;
                endIndex = endIndex + firstCommentClose + 3;
            }
        }
        el.dataset.isCommented = 'false';
        el.classList.remove('is-commented-element');
    } else {
        // Turning OFF (Wrapping in comments)
        newElementStr = ``;
        el.dataset.isCommented = 'true';
        el.classList.add('is-commented-element');
    }

    el.dataset.rawXml = newElementStr;
    fileContent = fileContent.slice(0, startIndex) + newElementStr + fileContent.slice(endIndex);
    fileMap.set(targetKey, fileContent);

    const instance = State.getEditorInstanceByPath(targetKey);
    if (instance) {
        if (typeof State.updateEditorInstance === 'function') State.updateEditorInstance(instance.uniqueId, { currentContent: fileContent });
        const textarea = document.getElementById(`xml-editor-textarea-${instance.uniqueId}`);
        if (textarea) {
            const scrollPos = textarea.scrollTop;
            textarea.value = fileContent;
            textarea.scrollTop = scrollPos;
            textarea.dispatchEvent(new Event('input'));
        }
    }
    
    if (typeof State.setXmlEditorDirty === 'function') State.setXmlEditorDirty(true);
    return true;
}