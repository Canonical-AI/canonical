<template>
    <Teleport to="body">
        <div class="custom-toolbar border border-surface-light" v-if="show" ref="toolbar" :class="{ 'comment-only': !isEditable }">
        <div class="toolbar-content">
            <!-- Text Formatting (only when editable) -->
            <template v-if="isEditable">
                <div class="button-group">
                    <v-btn
                        icon="mdi-format-bold"
                        size="small"
                        variant="text"
                        :disabled="disabled"
                        @click="toggleBold"
                        :class="{ active: isActive.bold }"
                    ></v-btn>
                    <v-btn
                        icon="mdi-format-italic"
                        size="small"
                        variant="text"
                        :disabled="disabled"
                        @click="toggleItalic"
                        :class="{ active: isActive.italic }"
                    ></v-btn>
                    <v-btn
                        icon="mdi-format-strikethrough"
                        size="small"
                        variant="text"
                        :disabled="disabled"
                        @click="toggleStrike"
                        :class="{ active: isActive.strike }"
                    ></v-btn>
                    <v-btn
                        icon="mdi-link"
                        size="small"
                        variant="text"
                        :disabled="disabled"
                        @click="toggleLink"
                        :class="{ active: isActive.link }"
                    ></v-btn>
                </div>

                <v-divider vertical class="mx-1"></v-divider>

                <!-- Lists -->
                <div class="button-group">
                    <v-btn
                        icon="mdi-format-list-bulleted"
                        size="small"
                        variant="text"
                        :disabled="disabled"
                        @click="toggleBulletList"
                        :class="{ active: isActive.bulletList }"
                    ></v-btn>
                    <v-btn
                        icon="mdi-format-list-numbered"
                        size="small"
                        variant="text"
                        :disabled="disabled"
                        @click="toggleOrderedList"
                        :class="{ active: isActive.orderedList }"
                    ></v-btn>
                </div>

                <v-divider vertical class="mx-1"></v-divider>

                <!-- Blocks -->
                <div class="button-group">
                    <v-btn
                        icon="mdi-format-quote-close"
                        size="small"
                        variant="text"
                        :disabled="disabled"
                        @click="toggleBlockquote"
                        :class="{ active: isActive.blockquote }"
                    ></v-btn>
                    <v-btn
                        icon="mdi-code-tags"
                        size="small"
                        variant="text"
                        :disabled="disabled"
                        @click="toggleCodeBlock"
                        :class="{ active: isActive.codeBlock }"
                    ></v-btn>
                </div>

                <v-divider vertical class="mx-1"></v-divider>
            </template>

            <!-- Comment Button (always visible) -->
            <div class="button-group">
                <v-btn
                    icon="mdi-comment-plus"
                    size="small"
                    variant="text"
                    :disabled="disabled || !hasSelection"
                    @click="startAddingComment"
                    @contextmenu.prevent="removeComment"
                    class="comment-btn"
                    :class="{ active: isActive.comment || isAddingComment }"
                ></v-btn>
            </div>
        </div>

        <!-- Comment Input (appears below toolbar when adding comment) -->
        <v-expand-transition>
            <div v-if="isAddingComment" class="comment-input-section">
                <v-textarea
                    v-model="commentText"
                    placeholder="Enter your comment..."
                    auto-grow
                    rows="2"
                    hide-details
                    density="compact"
                    variant="outlined"
                    class="mb-2"
                    @keydown.esc="cancelComment"
                    ref="commentInput"
                ></v-textarea>
                <div class="d-flex justify-end">
                    <v-btn
                        size="small"
                        variant="text"
                        color="error"
                        @click="cancelComment"
                        class="text-none mr-2"
                    >
                        Cancel
                    </v-btn>
                    <v-btn
                        size="small"
                        variant="text"
                        color="primary"
                        @click="submitComment"
                        class="text-none"
                        :disabled="!commentText.trim()"
                    >
                        Submit
                    </v-btn>
                </div>
            </div>
        </v-expand-transition>

        <!-- Link Input (appears below toolbar when adding link) -->
        <v-expand-transition>
            <div v-if="isAddingLink && isEditable" class="link-input-section">
                <v-text-field
                    v-model="linkUrl"
                    placeholder="Enter URL (e.g., https://example.com)"
                    hide-details
                    density="compact"
                    variant="outlined"
                    class="mb-2"
                    @keydown.esc="cancelLink"
                    @keydown.enter="submitLink"
                    ref="linkInput"
                ></v-text-field>
                <div class="d-flex justify-end">
                    <v-btn
                        size="small"
                        variant="text"
                        color="error"
                        @click="cancelLink"
                        class="text-none mr-2"
                    >
                        Cancel
                    </v-btn>
                    <v-btn
                        size="small"
                        variant="text"
                        color="primary"
                        @click="submitLink"
                        class="text-none"
                        :disabled="!linkUrl.trim()"
                    >
                        Add Link
                    </v-btn>
                </div>
            </div>
        </v-expand-transition>
         </div>
     </Teleport>
</template>

<script>
import { usePluginViewContext } from '@prosemirror-adapter/vue';
import { nextTick } from 'vue';
import { addComment } from './comment/index.js';

export default {
    setup() {
        const { view } = usePluginViewContext();
        return { view };
    },
    props: {
        disabled: {
            type: Boolean,
            default: false
        }
    },
    data() {
        return {
            show: false,
            hasSelection: false,
            isAddingComment: false,
            commentText: '',
            isAddingLink: false,
            linkUrl: '',
            currentSelection: null,
            isActive: {
                bold: false,
                italic: false,
                strike: false,
                link: false,
                bulletList: false,
                orderedList: false,
                blockquote: false,
                codeBlock: false,
                comment: false,
            }
        };
    },
    computed: {
        isEditable() {
            // Directly check the editor's actual editable state
            if (!this.view) return true;
            
            // Check if the editor view is editable
            return this.view.editable;
        }
    },

    methods: {
        toggleBold() {
            this.runCommand('ToggleStrong');
        },
        toggleItalic() {
            this.runCommand('ToggleEmphasis');
        },
        toggleStrike() {
            this.runCommand('ToggleStrikeThrough');
        },
        toggleLink() {
            if (!this.hasSelection || this.disabled) return;
            
            // Check if current selection already has a link
            const { state } = this.view;
            const { from, to } = state.selection;
            const linkMark = state.schema.marks.link;
            const hasLink = state.doc.rangeHasMark(from, to, linkMark);
            
            if (hasLink) {
                // Remove existing link
                this.runCommand('RemoveLink');
            } else {
                // Show link input
                this.startAddingLink();
            }
        },
        toggleBulletList() {
            this.runCommand('WrapInBulletList');
        },
        toggleOrderedList() {
            this.runCommand('WrapInOrderedList');
        },
        toggleBlockquote() {
            this.runCommand('WrapInBlockquote');
        },
        toggleCodeBlock() {
            this.runCommand('TurnIntoCodeBlock');
        },

        runCommand(commandName, payload) {
            if (!this.view || this.disabled) return;
            
            try {
                // Use ProseMirror commands directly
                const { state, dispatch } = this.view;
                const command = this.getCommandByName(commandName);
                
                if (command) {
                    command(state, dispatch, this.view, payload);
                }
            } catch (error) {
                console.warn(`Command ${commandName} not available:`, error);
            }
        },

        getCommandByName(commandName) {
            const { state } = this.view;
            const { schema } = state;
            
            switch(commandName) {
                case 'ToggleStrong':
                    return this.toggleMark(schema.marks.strong);
                case 'ToggleEmphasis':
                    return this.toggleMark(schema.marks.emphasis);
                case 'ToggleStrikeThrough':
                    return this.toggleMark(schema.marks.strike_through);
                case 'AddLink':
                    return this.addLinkMark(schema.marks.link);
                case 'RemoveLink':
                    return this.removeLinkMark(schema.marks.link);
                case 'AddComment':
                    return this.addCommentMark(schema.marks.comment);
                case 'RemoveComment':
                    return this.removeCommentMark(schema.marks.comment);
                case 'WrapInBulletList':
                    return this.wrapInList(schema.nodes.bullet_list, schema.nodes.list_item);
                case 'WrapInOrderedList':
                    return this.wrapInList(schema.nodes.ordered_list, schema.nodes.list_item);
                case 'WrapInBlockquote':
                    return this.wrapInNode(schema.nodes.blockquote);
                case 'TurnIntoCodeBlock':
                    return this.setBlockType(schema.nodes.code_block);
                default:
                    return null;
            }
        },

        toggleMark(markType) {
            return (state, dispatch) => {
                if (!markType) return false;
                const { from, to } = state.selection;
                const hasMark = state.doc.rangeHasMark(from, to, markType);
                
                if (hasMark) {
                    dispatch(state.tr.removeMark(from, to, markType));
                } else {
                    dispatch(state.tr.addMark(from, to, markType.create()));
                }
                return true;
            };
        },

        addLinkMark(markType) {
            return (state, dispatch, view, url) => {
                if (!markType || !url) return false;
                const { from, to } = state.selection;
                const linkMark = markType.create({ href: url });
                dispatch(state.tr.addMark(from, to, linkMark));
                return true;
            };
        },

        removeLinkMark(markType) {
            return (state, dispatch) => {
                if (!markType) return false;
                const { from, to } = state.selection;
                dispatch(state.tr.removeMark(from, to, markType));
                return true;
            };
        },

        addCommentMark(markType) {
            return (state, dispatch, view, commentId) => {
                if (!markType) return false;
                const { from, to } = state.selection;
                const commentMark = markType.create({ id: commentId });
                dispatch(state.tr.addMark(from, to, commentMark));
                return true;
            };
        },

        removeCommentMark(markType) {
            return (state, dispatch) => {
                if (!markType) return false;
                const { from, to } = state.selection;
                dispatch(state.tr.removeMark(from, to, markType));
                return true;
            };
        },

        wrapInList(listType, itemType) {
            return (state, dispatch) => {
                if (!listType || !itemType) return false;
                
                const { $from, $to } = state.selection;
                const range = $from.blockRange($to);
                if (!range) return false;
                
                // Check if we're already in the same type of list
                let inList = false;
                for (let d = range.depth; d >= 0; d--) {
                    const node = range.$from.node(d);
                    if (node.type === listType) {
                        inList = true;
                        break;
                    }
                }
                
                if (inList) {
                    // If already in this list type, don't do anything
                    return false;
                }
                
                // Use ProseMirror's built-in wrap functionality
                const wrapping = [{ type: listType }, { type: itemType }];
                
                // Check if wrapping is possible
                const canWrap = state.doc.resolve(range.start).blockRange(state.doc.resolve(range.end));
                if (!canWrap) return false;
                
                const tr = state.tr.wrap(canWrap, wrapping);
                dispatch(tr);
                return true;
            };
        },

        wrapInNode(nodeType) {
            return (state, dispatch) => {
                if (!nodeType) return false;
                const { $from, $to } = state.selection;
                const range = $from.blockRange($to);
                if (!range) return false;
                
                const tr = state.tr.wrap(range, [{ type: nodeType }]);
                dispatch(tr);
                return true;
            };
        },

        setBlockType(nodeType) {
            return (state, dispatch) => {
                if (!nodeType) return false;
                const { $from, $to } = state.selection;
                const tr = state.tr.setBlockType($from.pos, $to.pos, nodeType);
                dispatch(tr);
                return true;
            };
        },

        startAddingComment() {
            if (!this.hasSelection || this.disabled) return;
            this.isAddingComment = true;
            this.commentText = '';
            nextTick(() => {
                this.$refs.commentInput?.focus();
            });
        },

        cancelComment() {
            this.isAddingComment = false;
            this.commentText = '';
        },

        removeComment() {
            if (!this.hasSelection || this.disabled) return;
            
            // Check if current selection has a comment mark
            const { state } = this.view;
            const { from, to } = state.selection;
            const commentMark = state.schema.marks.comment;
            
            if (commentMark && state.doc.rangeHasMark(from, to, commentMark)) {
                // Remove existing comment
                this.runCommand('RemoveComment');
            }
        },

        async submitComment() {
            if (!this.commentText.trim() || !this.currentSelection) return;

            const { from, to } = this.currentSelection;
            const selectedText = this.view.state.doc.textBetween(from, to);

            // Add the comment mark to the selected text using the utility function
            const success = await addComment(this.view, selectedText, this.commentText.trim(), from);
            
            if (!success) {
                console.error('Failed to add comment mark to text');
            }

            this.isAddingComment = false;
            this.commentText = '';
        },

        startAddingLink() {
            if (!this.hasSelection || this.disabled) return;
            this.isAddingLink = true;
            this.linkUrl = '';
            nextTick(() => {
                this.$refs.linkInput?.focus();
            });
        },

        cancelLink() {
            this.isAddingLink = false;
            this.linkUrl = '';
        },

        submitLink() {
            if (!this.linkUrl.trim() || !this.currentSelection) return;

            const { from, to } = this.currentSelection;
            this.runCommand('AddLink', this.linkUrl.trim());
            
            // Reset state
            this.isAddingLink = false;
            this.linkUrl = '';
        },

        updateState() {
            if (!this.view) return;

            const { state } = this.view;
            const { from, to } = state.selection;
            
            // Update selection state
            this.hasSelection = from !== to;
            this.currentSelection = this.hasSelection ? { from, to } : null;
            
            // Update active states for formatting buttons
            this.isActive.bold = this.isMarkActive('strong');
            this.isActive.italic = this.isMarkActive('emphasis');
            this.isActive.strike = this.isMarkActive('strike_through');
            this.isActive.link = this.isMarkActive('link');
            this.isActive.comment = this.isMarkActive('comment');
            
            // Check if we're in specific node types
            const { $from } = state.selection;
            this.isActive.bulletList = this.isInNodeType('bullet_list');
            this.isActive.orderedList = this.isInNodeType('ordered_list');
            this.isActive.blockquote = this.isInNodeType('blockquote');
            this.isActive.codeBlock = this.isInNodeType('code_block');

            // Show toolbar when there's a selection or when adding comment/link
            this.show = this.hasSelection || this.isAddingComment || this.isAddingLink;
        },

        isMarkActive(markType) {
            if (!this.view) return false;
            const { state } = this.view;
            const type = state.schema.marks[markType];
            if (!type) return false;
            const { from, $from, to, empty } = state.selection;
            if (empty) return !!type.isInSet(state.storedMarks || $from.marks());
            return state.doc.rangeHasMark(from, to, type);
        },

        isInNodeType(nodeType) {
            if (!this.view) return false;
            const { state } = this.view;
            const { $from } = state.selection;
            return $from.parent.type.name === nodeType;
        },

        positionToolbar() {
            if (!this.view || !this.hasSelection) return;
            
            try {
                const { from, to } = this.view.state.selection;
                
                // Check if the view is properly initialized and has a DOM
                if (!this.view.dom || !this.view.state || !this.view.state.doc) {
                    return;
                }
                
                // Check if the selection positions are valid
                if (from < 0 || to < 0 || from > this.view.state.doc.content.size || to > this.view.state.doc.content.size) {
                    return;
                }
                
                const startCoords = this.view.coordsAtPos(from);
                const endCoords = this.view.coordsAtPos(to);
                
                // Check if coordinates are valid
                if (!startCoords || !endCoords) {
                    return;
                }
                
                const toolbar = this.$refs.toolbar;
                if (!toolbar) return;

                // Get current toolbar dimensions
                const toolbarRect = toolbar.getBoundingClientRect();
                const toolbarWidth = toolbarRect.width || 300; // fallback
                const toolbarHeight = toolbarRect.height || 60; // fallback
                
                // Calculate selection center
                const selectionCenterX = (startCoords.left + endCoords.right) / 2;
                const selectionTop = Math.min(startCoords.top, endCoords.top);
                const selectionBottom = Math.max(startCoords.bottom, endCoords.bottom);
                
                // Calculate desired position (centered horizontally under selection)
                let left = selectionCenterX - (toolbarWidth / 2);
                let top = selectionBottom + 8; // 8px gap below selection
                
                // Viewport bounds checking
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const margin = 16; // Minimum margin from viewport edges
                
                // Adjust horizontal position to stay within viewport
                const minLeft = margin;
                const maxLeft = viewportWidth - toolbarWidth - margin;
                
                if (left < minLeft) {
                    left = minLeft;
                } else if (left > maxLeft) {
                    left = maxLeft;
                }
                
                // Vertical position adjustment
                if (top + toolbarHeight > viewportHeight - margin) {
                    // Position above selection instead
                    top = selectionTop - toolbarHeight - 8;
                    
                    // If still overflowing top, position it in the visible area
                    if (top < margin) {
                        top = Math.max(margin, selectionBottom + 8);
                        // If selection is too close to bottom, position at the top
                        if (top + toolbarHeight > viewportHeight - margin) {
                            top = margin;
                        }
                    }
                }
                
                // Apply positioning directly since we're using Teleport
                toolbar.style.position = 'fixed';
                toolbar.style.left = `${left}px`;
                toolbar.style.top = `${top}px`;
                toolbar.style.zIndex = '1000';
            } catch (error) {
                console.warn('Error positioning toolbar:', error);
            }
        }
    },
    watch: {
        view: {
            handler() {
                this.updateState();
                this.$nextTick(() => {
                    this.positionToolbar();
                });
            },
            immediate: true,
        },
    },
    mounted() {
        // Listen for selection changes and editor updates
        if (this.view) {
            const updateHandler = () => {
                this.updateState();
                this.$nextTick(() => {
                    this.positionToolbar();
                });
            };
            
            // Listen to selection changes
            this.view.dom.addEventListener('mouseup', updateHandler);
            this.view.dom.addEventListener('keyup', updateHandler);
            
            // Store for cleanup
            this.updateHandler = updateHandler;
        }
    },
    beforeUnmount() {
        if (this.view && this.updateHandler) {
            this.view.dom.removeEventListener('mouseup', this.updateHandler);
            this.view.dom.removeEventListener('keyup', this.updateHandler);
        }
    },
};
</script>

<style scoped>
.custom-toolbar {
    background: rgba(var(--v-theme-surface), 0.95);
    border: 1px solid rgba(var(--v-theme-outline), 0.2);
    border-radius: 8px;
    padding: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    backdrop-filter: blur(8px);
    pointer-events: auto;
    width: max-content;
    max-width: calc(100vw - 32px);
}

/* Adjust width when only comment button is visible */
.custom-toolbar:has(.toolbar-content > .button-group:only-child) {
    min-width: auto;
}

/* Fallback for browsers that don't support :has() */
.custom-toolbar.comment-only {
    min-width: auto;
}

.toolbar-content {
    display: flex;
    align-items: center;
    gap: 4px;
}

.button-group {
    display: flex;
    align-items: center;
    gap: 2px;
}

.custom-toolbar .v-btn {
    min-width: 36px;
    height: 36px;
}

.custom-toolbar .v-btn.active {
    background-color: rgba(var(--v-theme-primary), 0.2);
    color: rgb(var(--v-theme-primary));
}

.custom-toolbar .v-btn:hover:not(:disabled) {
    background-color: rgba(var(--v-theme-primary), 0.1);
}

.custom-toolbar .v-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.comment-input-section,
.link-input-section {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(var(--v-theme-outline), 0.1);
}

.comment-btn.active {
    background-color: rgba(var(--v-theme-secondary), 0.2) !important;
    color: rgb(var(--v-theme-secondary)) !important;
}

/* Hide built-in Crepe toolbar completely */
:global(milkdown-toolbar) {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
}

/* Mobile responsive adjustments */
@media (max-width: 600px) {
    .custom-toolbar {
        min-width: 280px;
        padding: 6px;
    }
    
    .custom-toolbar .v-btn {
        min-width: 32px;
        height: 32px;
    }
    
    .toolbar-content {
        gap: 2px;
    }
    
    .button-group {
        gap: 1px;
    }
}
</style> 