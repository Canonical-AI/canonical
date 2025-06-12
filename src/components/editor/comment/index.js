import { Plugin, PluginKey } from 'prosemirror-state';
import { DecorationSet, Decoration } from 'prosemirror-view';
import { customAlphabet } from 'nanoid';
import store from '../../../store';


const nanoid = customAlphabet('abcdefg', 8);

// Store comments in memory for quick access
const commentStore = new Map();

// Plugin key for accessing the plugin state
export const commentPluginKey = new PluginKey('commentPlugin');

// Utility function to check if selected text is still present in document
export const isSelectedTextPresent = (view, selectedText, originalFrom, originalTo) => {
    if (!view || !selectedText) return false;
    
    const { state } = view;
    const doc = state.doc;
    const docSize = doc.content.size;
    
    // Get target words (normalized)
    const targetWords = selectedText.trim().toLowerCase().split(/\s+/).filter(word => word.length > 0);
    if (targetWords.length === 0) return false;
    
    const targetLength = selectedText.length;
    
    // Search through the document with different window sizes
    const searchSizes = [
        targetLength,
        targetLength + 10,
        targetLength + 20,
        targetLength - 5
    ];
    
    let bestMatch = { start: -1, end: -1, similarity: 0 };
    
    for (const windowSize of searchSizes) {
        const size = Math.max(5, windowSize);
        
        for (let pos = 1; pos <= docSize - size + 1; pos++) {
            try {
                const textAtPos = state.doc.textBetween(pos, pos + size);
                const currentWords = textAtPos.trim().toLowerCase().split(/\s+/).filter(word => word.length > 0);
                
                if (currentWords.length === 0) continue;
                
                // Calculate word overlap
                const matchingWords = targetWords.filter(word => currentWords.includes(word));
                const similarity = matchingWords.length / targetWords.length;
                
                // If we have the same similarity and position info, prefer the position closest to the original
                if (similarity === bestMatch.similarity && similarity > 0 && originalFrom && originalTo) {
                    const originalCenter = (originalFrom + originalTo) / 2;
                    const currentCenter = pos + size / 2;
                    const bestCenter = bestMatch.start + (bestMatch.end - bestMatch.start) / 2;
                    
                    const currentDistance = Math.abs(currentCenter - originalCenter);
                    const bestDistance = Math.abs(bestCenter - originalCenter);
                    
                    // Choose the position closer to the original
                    if (currentDistance < bestDistance) {
                        bestMatch = { start: pos, end: pos + size, similarity };
                    }
                } else if (similarity > bestMatch.similarity) {
                    bestMatch = { start: pos, end: pos + size, similarity };
                }
                
                // Return true if we find a match with 90%+ similarity
                if (similarity >= 0.9) {
                    return true;
                }
            } catch (error) {
                // Position might be invalid, continue
            }
        }
    }
    
    // Return true if the best match has 90%+ similarity
    return bestMatch.similarity >= 0.9;
};

// Export the decoration creation function for external use
export const createCommentDecoration = (from, to, id) => {
    return Decoration.inline(from, to, {
        'data-comment-id': id,
        class: 'canonical-comment',
        style: 'background-color: rgba(255, 255, 0, 0.15); cursor: pointer; border-radius: 4px; border: 1px solid rgba(255, 255, 0, 0.3);'
    }, {
        // Store the comment ID in the spec for easy access
        commentId: id
    });
};


export const commentFunctions =  {
   createComment: async (view, from, to, comment, originalText) => {

        const documentId = store?.state?.selected?.id || 'unknown';
        const currentVersion = store?.state?.selected?.currentVersion || 'live';
        const documentVersion = currentVersion === 'live' ? null : currentVersion;

        const commentData = {
            comment,
            documentId,
            documentVersion,
            createdAt: new Date().toISOString(),
            resolved: false,
            editorID: {
                from,
                to,
                selectedText: originalText
            }
        };

        const commentObject = await store.dispatch('addComment', commentData);

        // Store comment data
        commentStore.set(commentObject.id, commentObject);

        // Create transaction to add decoration
        const tr = view.state.tr;
        tr.setMeta(commentPluginKey, {
            type: 'ADD_DECORATION',
            id: commentObject.id,
            from,
            to
        });

        view.dispatch(tr);
        return ;
    },

    addDecoration: (view, from, to, commentData) => {
        // Store comment data if not already stored
        if (!commentStore.has(commentData.id)) {
            commentStore.set(commentData.id, commentData);
        }

        // Create transaction to add decoration
        const tr = view.state.tr;
        tr.setMeta(commentPluginKey, {
            type: 'ADD_DECORATION',
            id: commentData.id,
            from,
            to
        });

        view.dispatch(tr);
    },

    removeComment: (view, id) => {
        // Remove from store
        commentStore.delete(id);

        // Create transaction to remove decoration
        const tr = view.state.tr;
        tr.setMeta(commentPluginKey, {
            type: 'REMOVE_DECORATION',
            id
        });

        view.dispatch(tr);
    },


    
    findBestTextMatch: function(view, targetText, originalFrom, originalTo) {
        if (!view || !targetText) return { start: -1, end: -1, similarity: 0 };
        
        const { state } = view;
        const doc = state.doc;
        const docSize = doc.content.size;
        
        // Get target words (normalized)
        const targetWords = targetText.trim().toLowerCase().split(/\s+/).filter(word => word.length > 0);
        if (targetWords.length === 0) return { start: -1, end: -1, similarity: 0 };
        
        let bestMatch = { start: -1, end: -1, similarity: 0 };
        const targetLength = targetText.length;
        
        // Search through the document with different window sizes
        const searchSizes = [
            targetLength,
            targetLength + 10,
            targetLength + 20,
            targetLength - 5
        ];
        
        for (const windowSize of searchSizes) {
            const size = Math.max(5, windowSize);
            
            for (let pos = 1; pos <= docSize - size + 1; pos++) {
                try {
                    const textAtPos = state.doc.textBetween(pos, pos + size);
                    const currentWords = textAtPos.trim().toLowerCase().split(/\s+/).filter(word => word.length > 0);
                    
                    if (currentWords.length === 0) continue;
                    
                    // Calculate word overlap
                    const matchingWords = targetWords.filter(word => currentWords.includes(word));
                    const similarity = matchingWords.length / targetWords.length;
                    
                    // If we have the same similarity, prefer the position closest to the original
                    if (similarity === bestMatch.similarity && similarity > 0) {
                        const originalCenter = originalFrom && originalTo ? (originalFrom + originalTo) / 2 : 0;
                        const currentCenter = pos + size / 2;
                        const bestCenter = bestMatch.start + (bestMatch.end - bestMatch.start) / 2;
                        
                        const currentDistance = Math.abs(currentCenter - originalCenter);
                        const bestDistance = Math.abs(bestCenter - originalCenter);
                        
                        // Choose the position closer to the original
                        if (currentDistance < bestDistance) {
                            bestMatch = { start: pos, end: pos + size, similarity };
                        }
                    } else if (similarity > bestMatch.similarity) {
                        bestMatch = { start: pos, end: pos + size, similarity };
                    }
                    
                    // If we find a very good match (90%+), use it
                    if (similarity >= 0.9) {
                        return bestMatch;
                    }
                } catch (error) {
                    // Position might be invalid, continue
                }
            }
        }
        
        return bestMatch;
    },

    refreshAllDecorations: function(view) {
        // Get fresh data from store
        const allComments = store.state.selected.comments;
        const activeComments = allComments.filter(comment => 
            comment.editorID && 
            comment.resolved !== true &&
            comment.editorID.selectedText // Ensure we have text to search for
        );
        
        // Clear the in-memory store
        commentStore.clear();
        
        // Find new positions for each comment using fuzzy matching
        const updatedComments = activeComments.map(comment => {
            const { selectedText} = comment.editorID;
            
            // Find best match for the text
            const match = this.findBestTextMatch(view, selectedText, comment.editorID.from, comment.editorID.to);
            
            if (match.similarity >= 0.7) { // Only use matches with 70%+ similarity
                return {
                    ...comment,
                    editorID: {
                        ...comment.editorID,
                        from: match.start,
                        to: match.end,
                        matchSimilarity: match.similarity
                    }
                };
            } else {
                // If no good match found, keep original position but mark as potentially stale
                return {
                    ...comment,
                    editorID: {
                        ...comment.editorID,
                        matchSimilarity: match.similarity
                    }
                };
            }
        });
        
        // Store updated comments data
        updatedComments.forEach(comment => {
            commentStore.set(comment.id, comment);
        });
        
        // Create transaction to refresh decorations
        const tr = view.state.tr;
        tr.setMeta(commentPluginKey, {
            type: 'REFRESH_DECORATIONS',
            activeComments: updatedComments
        });

        view.dispatch(tr);
    },


    scrollToComment: (view, commentId, vueNextTick, storeState) => {
        if (!view) return;

        try {
            const { state } = view;
            
            // Find the comment in store data
            const comment = storeState.selected.comments?.find(c => c.id === commentId);
            
            if (!comment || !comment.editorID) return;

            const { from, to } = comment.editorID;
            
            // Ensure the position is valid
            if (from < 0 || from > state.doc.content.size || to < 0 || to > state.doc.content.size) return;

            // Find the comment element in the DOM and scroll to it
            vueNextTick(() => {
                const editorDom = view.dom;
                const commentElement = editorDom.querySelector(`[data-comment-id="${commentId}"]`);
                
                if (commentElement) {
                    commentElement.scrollIntoView({ 
                        behavior: 'smooth',
                        block: 'nearest',
                        inline: 'nearest'
                    });
                }
            });

            // Add visual highlight effect
            vueNextTick(() => {
                const editorDom = view.dom;
                const commentElements = editorDom.querySelectorAll(`[data-comment-id="${commentId}"]`);
                
                commentElements.forEach(element => {
                    // Add highlight effect
                    element.style.transition = 'background-color 0.5s ease';
                    element.style.backgroundColor = 'rgba(var(--v-theme-primary), 0.3)';
                    
                    // Remove highlight after animation
                    setTimeout(() => {
                        element.style.backgroundColor = '';
                    }, 2000);
                });
            });
        } catch (error) {
            console.error('Failed to scroll to comment:', error);
        }
    }
};

// Create the comment plugin
export const createCommentPlugin = () => {
    return new Plugin({
        key: commentPluginKey,
        
        state: {
            init() {
                return DecorationSet.empty;
            },
            
            apply(tr, decorationSet, oldState, newState) {
                // Map decorations through document changes
                decorationSet = decorationSet.map(tr.mapping, tr.doc);
                
                // Handle plugin-specific actions
                const meta = tr.getMeta(commentPluginKey);
                if (meta) {
                    switch (meta.type) {
                        case 'ADD_DECORATION':
                            const decoration = createCommentDecoration(meta.from, meta.to, meta.id);
                            decorationSet = decorationSet.add(tr.doc, [decoration]);
                            break;
                            
                        case 'REMOVE_DECORATION':
                            const decorationsToRemove = decorationSet.find(null, null, spec => 
                                spec.commentId === meta.id || spec['data-comment-id'] === meta.id
                            );
                            if (decorationsToRemove.length > 0) {
                                decorationSet = decorationSet.remove(decorationsToRemove);
                            }
                            break;
                            
                        case 'CLEAR_ALL_DECORATIONS':
                            decorationSet = DecorationSet.empty;
                            break;
                            
                        case 'REFRESH_DECORATIONS':
                            decorationSet = DecorationSet.empty;
                            const activeComments = meta.activeComments || [];
                            const newDecorations = activeComments.map(comment => 
                                createCommentDecoration(comment.editorID.from, comment.editorID.to, comment.id)
                            );
                            if (newDecorations.length > 0) {
                                decorationSet = decorationSet.add(tr.doc, newDecorations);
                            }
                            break;
                    }
                }
                return decorationSet;
            }
        },
        
        props: {
            decorations(state) {
                return this.getState(state);
            },
            
            handleDOMEvents: {
                click: (view, event) => {
                    const target = event.target;
                    // Check if the clicked element or its parent has the comment class
                    const commentElement = target.closest('.canonical-comment');
                    if (commentElement) {
                        const commentId = commentElement.getAttribute('data-comment-id');
                        if (commentId) {
                            // Dispatch custom event
                            const customEvent = new CustomEvent('comment-clicked', {
                                detail: { commentId },
                                bubbles: true
                            });
                            view.dom.dispatchEvent(customEvent);
                            return true; // Prevent default handling
                        }
                    }
                    return false;
                }
            }
        }
    });
};
