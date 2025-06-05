import { Plugin, PluginKey } from 'prosemirror-state';
import { DecorationSet, Decoration } from 'prosemirror-view';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('abcdefg', 8);

// Store comments in memory (we'll move this to a database later)
const commentStore = new Map();

// Plugin key for accessing the plugin state
export const commentPluginKey = new PluginKey('commentPlugin');

// Create a decoration for a comment
const createCommentDecoration = (from, to, id) => {
    return Decoration.inline(from, to, {
        'data-comment-id': id,
        class: 'canonical-comment',
        style: 'background-color: rgba(255, 255, 0, 0.15); cursor: pointer;',
    });
};

// Create the comment plugin
export const createCommentPlugin = () => {
    return new Plugin({
        key: commentPluginKey,
        state: {
            init: () => DecorationSet.empty,
            apply(tr, old) {
                // Map existing decorations through document changes
                let decos = old.map(tr.mapping, tr.doc);

                // Handle adding new comments
                const addCommentMeta = tr.getMeta('addComment');
                if (addCommentMeta) {
                    const { from, to, comment } = addCommentMeta;
                    const id = nanoid();
                    commentStore.set(id, comment);
                    const deco = createCommentDecoration(from, to, id);
                    decos = decos.add(tr.doc, [deco]);
                }

                // Handle removing comments
                const removeCommentMeta = tr.getMeta('removeComment');
                if (removeCommentMeta) {
                    const { id } = removeCommentMeta;
                    commentStore.delete(id);
                    decos = decos.remove(decos.find(null, null, spec => spec['data-comment-id'] === id));
                }

                return decos;
            },
        },
        props: {
            decorations(state) {
                return this.getState(state);
            },
            handleClick(view, pos, event) {
                const target = event.target;
                
                // Check if the clicked element or any parent has the comment class
                let commentElement = target;
                while (commentElement && commentElement !== view.dom) {
                    if (commentElement.classList && commentElement.classList.contains('canonical-comment')) {
                        const id = commentElement.getAttribute('data-comment-id');
                        const comment = commentStore.get(id);
                        if (comment) {
                            // Dispatch an event that our Vue component can listen to
                            const customEvent = new CustomEvent('comment-click', {
                                detail: { id, comment, pos }
                            });
            
                            view.dom.dispatchEvent(customEvent);
                            return true;
                        }
                    }
                    commentElement = commentElement.parentElement;
                }
                return false;
            },
        },
    });
};

// Helper function to add a comment
export const addComment = (view, from, to, comment) => {
    const { state, dispatch } = view;
    dispatch(state.tr.setMeta('addComment', { from, to, comment }));
};

// Helper function to remove a comment
export const removeComment = (view, id) => {
    const { state, dispatch } = view;
    dispatch(state.tr.setMeta('removeComment', { id }));
};

// Helper function to get a comment
export const getComment = (id) => {
    return commentStore.get(id);
};

// Export the store for debugging/development
export const getCommentStore = () => commentStore; 