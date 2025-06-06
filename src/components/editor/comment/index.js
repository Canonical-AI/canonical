import { Plugin, PluginKey } from 'prosemirror-state';
import { DecorationSet, Decoration } from 'prosemirror-view';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('abcdefg', 8);

// Store comments in memory for quick access
const commentStore = new Map();


// Plugin key for accessing the plugin state
export const commentPluginKey = new PluginKey('commentPlugin');

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

// Comment functions that will be accessible via the plugin key
export const commentFunctions = {
    createComment: (view, from, to, comment, documentId, documentVersion) => {
        const id = nanoid();
        const commentData = {
            id,
            comment,
            from,
            to,
            documentId,
            documentVersion,
            createdAt: new Date().toISOString(),
            resolved: false
        };

        // Store comment data
        commentStore.set(id, commentData);

        // Create transaction to add decoration
        const tr = view.state.tr;
        tr.setMeta(commentPluginKey, {
            type: 'ADD_DECORATION',
            id,
            from,
            to
        });

        view.dispatch(tr);
        return commentData;
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

    // Clear all decorations and rebuild from store data
    refreshAllDecorations: (view, storeGetterFn) => {
        // Get fresh data from store
        const allComments = storeGetterFn ? storeGetterFn() : [];
        const activeComments = allComments.filter(comment => 
            comment.editorID && 
            comment.resolved !== true &&
            comment.editorID.from !== comment.editorID.to
        );
        
        // Clear the in-memory store
        commentStore.clear();
        
        // Store active comments data
        activeComments.forEach(comment => {
            commentStore.set(comment.id, comment);
        });
        
        // Create transaction to refresh decorations
        const tr = view.state.tr;
        tr.setMeta(commentPluginKey, {
            type: 'REFRESH_DECORATIONS',
            activeComments: activeComments
        });

        view.dispatch(tr);
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
                            // Find decorations that match the comment ID (check both spec fields)
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
                            // Clear all decorations and rebuild with active comments
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
