<template>
        <Milkdown 
            ref="milkdown"
            class="canonical-editor editor text-body-2 h-auto"
            style="min-height: 95%;"
            :data-disabled="disabled"
            />

</template>

<script>
import {getCurrentInstance, onMounted, ref} from 'vue';

import { Milkdown, useEditor, useInstance } from '@milkdown/vue';
import { Crepe } from '@milkdown/crepe'
import { nord } from '@milkdown/theme-nord'
import { clipboard } from '@milkdown/plugin-clipboard';
import { usePluginViewFactory , useWidgetViewFactory, useNodeViewFactory } from '@prosemirror-adapter/vue';
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { rootCtx , editorViewOptionsCtx, editorViewCtx , parserCtx, serializerCtx } from '@milkdown/core';
import { schemaCtx } from '@milkdown/core';
import { $view , $prose, $nodeSchema ,} from '@milkdown/utils';
import { Slice } from 'prosemirror-model';
import {commonmark } from '@milkdown/preset-commonmark';
import SlashGenerate from './SlashGenerate.vue'
import {remarkDirective, useReferenceLink, referenceLinkNode} from './reference-link'
import ReferenceLinkTooltip from './reference-link/ReferenceLinkTooltip.vue'
import { useTask, taskNode } from './task'
import { Plugin } from 'prosemirror-state';

import MermaidComponent from './MermaidComponent.vue'
import { diagram , diagramSchema} from '@milkdown/plugin-diagram'
import { commentMark, resolveComment, unresolveComment, deleteComment } from './comment';
import CustomToolbar from './CustomToolbar.vue';
import { useEventWatcher } from '../../composables/useEventWatcher';

export default {
    name: "MilkdownEditor",
    components:{
        Milkdown,
        CustomToolbar,
    },
    props: {
        modelValue: String,
        disabled: {
            type: Boolean,
            default: false
        },
        placeholder: {
            type: String,
            default: 'Get your ideas out...'
        }
    },
    setup(props, {emit}){
        const nodeViewFactory = useNodeViewFactory();
        const pluginViewFactory = usePluginViewFactory();
        const referenceLink = useReferenceLink();
        const task = useTask();
        const [loading, get] = useInstance();
        
        const placeholders = [
            'Write something...',
            'Jot some thoughts...',
            'Compose an idea...',
            'write it down....',
            'Whats on your mind?...',
            'What are you doing dave?...',
            'Type /gen to generate a new idea',
            'Type //todo: to create a todo item',
        ];
        
        const placeholderText = ref(placeholders[Math.floor(Math.random() * placeholders.length)]);
        
        onMounted(() => {
            placeholderText.value = placeholders[Math.floor(Math.random() * placeholders.length)];
        });

        const isMobile = () => window.innerWidth <= 600;

        // Get reference to current component instance for use in plugins
        const currentInstance = getCurrentInstance();
        
        const editor = useEditor((root) => {
            const isEditable = () => !props.disabled;
            
            const crepe = new Crepe({
                defaultValue: props.modelValue,
                featureConfigs: {
                    [Crepe.Feature.Placeholder]: {
                            text: placeholderText.value
                    },
                    //[Crepe.Feature.Toolbar]: false // Explicitly disable toolbar
                }
            });

            // Configure the editor through the editor property
            crepe.editor.config((ctx) => {
                ctx.set(rootCtx, root);
                ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => {
                    if (markdown !== props.modelValue) {
                        emit("update:modelValue", markdown);
                    }
                });
            });

            // Add plugins to the editor
            crepe.editor
                .use(taskNode)
                .use(referenceLinkNode)
                .use(clipboard)
                .use(listener)
                .use(commonmark)
                .use($prose((ctx) => new Plugin({
                        view: pluginViewFactory({component: SlashGenerate, key: 'pound-generate'}),
                    })))
                .use($prose((ctx) => new Plugin({
                        view: pluginViewFactory({component: ReferenceLinkTooltip, key: 'reference-link-tooltip'}),
                    })))
                .use($prose((ctx) => new Plugin({
                        view: pluginViewFactory({component: CustomToolbar, key: 'custom-toolbar'}),
                    })))
                .use($prose((ctx) => new Plugin({
                        props: {
                            handleDOMEvents: {
                                click: (view, event) => {
                                    // Check if the clicked element is a comment mark
                                    const target = event.target;
                                    if (target && target.classList.contains('comment-mark')) {
                                        const commentId = target.getAttribute('data-comment-id');
                                        if (commentId) {
                                            // Emit the comment-clicked event
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
                    })))
                .use(remarkDirective)
                .use(referenceLink.plugins) 
                .use(task.plugins)
                .use(diagram)
                .use(commentMark)
                .use($view(diagramSchema.node, () => nodeViewFactory({
                    component: MermaidComponent,
                    key: 'mermaid-component',
                    stopEvent: () => true,
                })))
                .use(nord)
                .config((ctx) => {
                    // Configure editor view options after all plugins are loaded
                    try {
                        ctx.update(editorViewOptionsCtx, (prev) => ({
                            ...prev,
                            editable: isEditable,
                            handlePaste: (view, event) => {
                                try {
                                    if (!view || !view.state) {
                                        console.warn('View not ready for paste operation');
                                        return false;
                                    }
                                    
                                    const parser = ctx.get(parserCtx);
                                    let text = event.clipboardData.getData('text/plain')
                                    text = text.replace(/<br\s*\/?>/gi, '')

                                    const slice = parser(text);
                                    if (!slice || typeof slice === 'string') return false;

                                    const contentSlice = view.state.selection.content();
                                    view.dispatch(
                                        view.state.tr.replaceSelection(
                                            new Slice(slice.content, contentSlice.openStart, contentSlice.openEnd),
                                        ),
                                    );

                                    return true;
                                } catch (error) {
                                    console.warn('Paste handler error:', error);
                                    return false;
                                }
                            },
                            // Fix cursor position issue on mobile
                            handleDOMEvents: {
                                touchstart: (view, event) => {
                                    // Prevent cursor from jumping to beginning
                                    if (!view) return false;
                                    event.stopPropagation();
                                    return false;
                                }
                            }
                        }));
                    } catch (error) {
                        console.warn('Editor view options configuration error:', error);
                    }
                });

            return crepe;
        })
    
        return { 
            editor,
            get,
            loading
        }
    },
    data() {
        return {
            editorElement: null,
            commentClickHandler: null,
        };
    },
    methods: {
        updatePlaceholder() {
            this.placeholder = this.placeholders[Math.floor(Math.random() * this.placeholders.length)];
        },
        processContentBeforeRender(content) {
            if (!content) return;
            
            let cleanedContent = content.replace(/<br\s*\/?>/gi, '');
            // Only update if changed
            if (cleanedContent !== content) {
                this.$emit('update:modelValue', cleanedContent);
            }
        },


        // Method to scroll to a specific comment position in the editor
        scrollToComment(commentId) {
            if (!this.get || this.loading) {
                return;
            }

            this.get().action((ctx) => {
                const view = ctx.get(editorViewCtx);
                
                // Find the comment mark element by data-comment-id
                const commentElement = view.dom.querySelector(`[data-comment-id="${commentId}"]`);
                
                if (commentElement) {
                    // Find the scrollable container - the main content area
                    const scrollContainer = document.querySelector('main[style*="overflow-y: auto"]') || 
                                          document.querySelector('.v-main') ||
                                          commentElement.closest('.ProseMirror') ||
                                          view.dom;
                    
                    if (scrollContainer && scrollContainer !== document.body) {
                        // Calculate scroll position to center the comment element
                        const containerRect = scrollContainer.getBoundingClientRect();
                        const commentRect = commentElement.getBoundingClientRect();
                        
                        const scrollTop = scrollContainer.scrollTop + 
                            (commentRect.top - containerRect.top) - 
                            (containerRect.height / 2) + 
                            (commentRect.height / 2);
                        
                        // Scroll within the container
                        scrollContainer.scrollTo({
                            top: scrollTop,
                            behavior: 'smooth'
                        });
                    } else {
                        // Fallback to scrollIntoView if no suitable container found
                        commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                    
                    // Add a visual highlight effect
                    commentElement.classList.add('comment-highlight');
                    
                    // Remove the highlight after a delay
                    setTimeout(() => {
                        commentElement.classList.remove('comment-highlight');
                    }, 2000);
                }
            });
        },


        // Method to set up comment click handler
        setupCommentClickHandler() {
            // Wait for editor to be fully initialized
            setTimeout(() => {
                if (!this.get || this.loading) {
                    // Retry if editor is not ready yet
                    this.setupCommentClickHandler();
                    return;
                }
                
                const editorElement = this.$el?.querySelector('.ProseMirror');
                if (editorElement) {
                    this.editorElement = editorElement;
                    this.commentClickHandler = this.handleCommentClick.bind(this);
                    editorElement.addEventListener('comment-clicked', this.commentClickHandler);
                }
            }, 1000);
        },

        // Handle comment clicks
        handleCommentClick(event) {
            const commentId = event.detail?.commentId;
            if (commentId) {
                this.$emit('comment-clicked', commentId);
            }
        },


        // Method to get the editor view for external use (e.g., AI comment creation)
        getEditorView() {
            if (!this.get || this.loading) {
                console.warn('Editor not ready, cannot get editor view');
                return null;
            }

            try {
                let editorView = null;
                this.get().action((ctx) => {
                    editorView = ctx.get(editorViewCtx);
                });
                return editorView;
            } catch (error) {
                console.warn('Error getting editor view:', error);
                return null;
            }
        },

        // Method to force update editor content without re-mounting
        forceUpdateContent(content) {
            if (!this.get || this.loading) return;
            
            this.get().action((ctx) => {
                const view = ctx.get(editorViewCtx);
                const parser = ctx.get(parserCtx);
                const schema = ctx.get(schemaCtx);
                
                const slice = parser(content);
                if (!slice || typeof slice === 'string') return;
                
                const tr = view.state.tr;
                tr.replaceWith(0, view.state.doc.content.size, slice);
                view.dispatch(tr);
            });
        },

        // Method to sync comment marks to reflect current comment states
        syncCommentMarks() {
            if (!this.get || this.loading) {
                return;
            }
            
            // Don't sync comment marks if user is not logged in
            if (!this.isUserLoggedIn) {
                return;
            }

            this.get().action((ctx) => {
                try {
                    const view = ctx.get(editorViewCtx);
                    if (!view) return;

                    const allComments = this.$store.selected.comments || [];
                    const currentVersion = this.$store.selected.currentVersion;
                    
                    // Filter comments based on current version
                    let relevantComments;
                    if (!currentVersion || currentVersion === 'live') {
                        // If viewing 'live' version, show ALL comments (from all versions)
                        relevantComments = allComments;
                    } else {
                        // If viewing a specific version, show only comments for that version
                        relevantComments = allComments.filter(comment => comment.documentVersion === currentVersion);
                    }
                    
                    // Create a set of valid comment IDs for the current version
                    const validCommentIds = new Set(relevantComments.map(comment => comment.id));
                    
                    // Map existing marks by comment ID with their current state
                    const existingMarks = new Map();
                    view.state.doc.descendants((node, pos) => {
                        if (node.isText) {
                            node.marks.forEach(mark => {
                                if (mark.type.name === 'comment' && mark.attrs.id) {
                                    existingMarks.set(mark.attrs.id, {
                                        from: pos,
                                        to: pos + node.nodeSize,
                                        resolved: mark.attrs.resolved,
                                        mark: mark
                                    });
                                }
                            });
                        }
                    });

                    let marksUpdated = false;

                    // First, remove marks for deleted comments
                    existingMarks.forEach((markData, commentId) => {
                        if (!validCommentIds.has(commentId)) {
                            // Comment has been deleted, remove its mark
                            this.removeCommentMark(view, markData.from, markData.to, commentId);
                            marksUpdated = true;
                        }
                    });

                    // Then process each comment that has text
                    const commentsWithText = relevantComments.filter(comment => 
                        comment.selectedText && 
                        comment.selectedText.trim().length > 0
                    );

                    commentsWithText.forEach(comment => {
                        const existingMark = existingMarks.get(comment.id);

                        if (existingMark) {
                            // Check if resolved state needs updating
                            if (existingMark.resolved !== comment.resolved) {
                                this.updateCommentMarkResolved(view, existingMark.from, existingMark.to, comment.id, comment.resolved);
                                marksUpdated = true;
                            }
                        } else {
                            // Comment mark doesn't exist, try to add it
                            const searchText = comment.selectedText.trim();
                            const found = this.findTextInDocument(view.state, searchText);
                            
                            if (found) {
                                this.addCommentMarkToFoundText(view, found.from, found.to, comment.id, comment.resolved);
                                marksUpdated = true;
                            }
                        }
                    });

                    // If viewing a version and marks were updated, save the markedUpContent
                    if (marksUpdated && this.$store.selected.currentVersion !== 'live') {
                        this.$nextTick(() => {
                            this.saveMarkedUpContent();
                        });
                    }
                } catch (error) {
                    console.warn('Error syncing comment marks:', error);
                }
            });
        },

        // Method to remove a comment mark from the editor
        removeCommentMark(view, from, to, commentId) {
            try {
                const { state, dispatch } = view;
                const { schema } = state;
                const commentMarkType = schema.marks.comment;

                if (!commentMarkType) return false;

                // Remove the mark
                const tr = state.tr.removeMark(from, to, commentMarkType);
                dispatch(tr);
                return true;
            } catch (error) {
                console.warn('Error removing comment mark:', error);
                return false;
            }
        },

        // Method to remove all comment marks from the editor
        removeAllCommentMarks() {
            if (!this.get || this.loading) {
                return;
            }
            
            this.get().action((ctx) => {
                try {
                    const view = ctx.get(editorViewCtx);
                    if (!view) return;

                    const { state, dispatch } = view;
                    const { schema } = state;
                    const commentMarkType = schema.marks.comment;

                    if (!commentMarkType) return;

                    // Collect all ranges that contain comment marks
                    const ranges = [];
                    state.doc.descendants((node, pos) => {
                        if (!node.isText) return;
                        node.marks.forEach(mark => {
                            if (mark.type === commentMarkType) {
                                ranges.push({ from: pos, to: pos + node.nodeSize });
                            }
                        });
                    });

                    // Remove marks using mapping so every subsequent range is remapped
                    if (ranges.length > 0) {
                        let tr = state.tr;
                        ranges.forEach(({ from, to }) => {
                            const mappedFrom = tr.mapping.map(from);
                            const mappedTo = tr.mapping.map(to);
                            tr = tr.removeMark(mappedFrom, mappedTo, commentMarkType);
                        });
                        dispatch(tr);

                        // Force content update by getting the current markdown
                        setTimeout(() => {
                            const serializer = ctx.get(serializerCtx);
                            const updatedMarkdown = serializer(view.state.doc);
                            this.$emit('update:modelValue', updatedMarkdown);
                        }, 100);
                    } else {
                        console.log('No comment marks found to remove');
                    }
                } catch (error) {
                    console.warn('Error removing all comment marks:', error);
                }
            });
        },

        // Method to save marked up content when viewing a version
        saveMarkedUpContent() {
            if (!this.get || this.loading || this.$store.selected.currentVersion === 'live') {
                return;
            }

            try {
                this.get().action((ctx) => {
                    const view = ctx.get(editorViewCtx);
                    const parser = ctx.get(parserCtx);
                    
                    // Get the current markdown content including comment marks
                    const currentMarkdown = this.getCurrentMarkdown();
                    
                    if (currentMarkdown) {
                        this.$store.updateMarkedUpContent({
                            docID: this.$store.selected.id,
                            versionContent: currentMarkdown,
                            versionNumber: this.$store.selected.currentVersion
                        });
                    }
                });
            } catch (error) {
                console.warn('Error saving marked up content:', error);
            }
        },

        // Method to get current markdown content
        getCurrentMarkdown() {
            if (!this.get || this.loading) return null;
            
            try {
                let markdown = null;
                this.get().action((ctx) => {
                    const serializer = ctx.get(serializerCtx);
                    const view = ctx.get(editorViewCtx);
                    markdown = serializer(view.state.doc);
                });
                return markdown;
            } catch (error) {
                console.warn('Error getting current markdown:', error);
                return null;
            }
        },

        // Method to update an existing comment mark's resolved state
        updateCommentMarkResolved(view, from, to, commentId, resolved) {
            try {
                const { state, dispatch } = view;
                const { schema } = state;
                const commentMarkType = schema.marks.comment;

                if (!commentMarkType) return false;

                // Remove the old mark
                let tr = state.tr.removeMark(from, to, commentMarkType);
                
                // Add the new mark with updated resolved state
                const newCommentMark = commentMarkType.create({ id: commentId, resolved });
                tr = tr.addMark(from, to, newCommentMark);
                
                dispatch(tr);
                return true;
            } catch (error) {
                console.warn('Error updating comment mark resolved state:', error);
                return false;
            }
        },

        // Helper method to find text in the document
        findTextInDocument(state, searchText) {
            if (!searchText || !searchText.trim()) {
                return null;
            }

            const normalizedSearchText = this.normalizeText(searchText);
            let bestMatch = null;
            let bestDistance = Infinity;
            const maxEditDistance = Math.ceil(normalizedSearchText.length * 0.2); // 20% edit distance

            state.doc.descendants((node, pos) => {
                if (node.isText) {
                    const nodeText = this.normalizeText(node.text);
                    
                    // First try exact match
                    const exactIndex = nodeText.indexOf(normalizedSearchText);
                    if (exactIndex !== -1) {
                        bestMatch = {
                            from: pos + exactIndex,
                            to: pos + exactIndex + searchText.length // Use original length
                        };
                        bestDistance = 0;
                        return false; // Stop searching
                    }
                    
                    // If no exact match and text is long enough, try fuzzy matching
                    if (normalizedSearchText.length >= 10) {
                        const distance = this.levenshteinDistance(nodeText, normalizedSearchText);
                        if (distance <= maxEditDistance && distance < bestDistance) {
                            bestMatch = {
                                from: pos,
                                to: pos + node.nodeSize
                            };
                            bestDistance = distance;
                        }
                    }
                }
            });

            return bestMatch;
        },

        // Helper method to add comment mark to found text
        addCommentMarkToFoundText(view, from, to, commentId, resolved = false) {
            try {
                const { state, dispatch } = view;
                const { schema } = state;
                const commentMarkType = schema.marks.comment;

                if (!commentMarkType) {
                    console.warn('Comment mark type not found in schema');
                    return false;
                }

                // Validate positions
                if (from < 0 || to > state.doc.content.size || from >= to) {
                    console.warn(`Invalid position range ${from}-${to} for document size ${state.doc.content.size}`);
                    return false;
                }

                // Check if there's already a comment mark in this range
                if (state.doc.rangeHasMark(from, to, commentMarkType)) {
                    return false;
                }

                const commentMark = commentMarkType.create({ id: commentId, resolved });
                const transaction = state.tr.addMark(from, to, commentMark);
                dispatch(transaction);
                return true;
            } catch (error) {
                console.warn('Error adding comment mark:', error);
                return false;
            }
        },

        // Helper method to normalize text for searching
        normalizeText(text) {
            return text
                .replace(/\s+/g, ' ')
                .replace(/[^\w\s]/g, '')
                .toLowerCase()
                .trim();
        },

        // Helper method to calculate edit distance for fuzzy matching
        levenshteinDistance(a, b) {
            if (a.length === 0) return b.length;
            if (b.length === 0) return a.length;

            const matrix = Array(b.length + 1).fill().map(() => Array(a.length + 1).fill(0));

            for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
            for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

            for (let j = 1; j <= b.length; j++) {
                for (let i = 1; i <= a.length; i++) {
                    const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
                    matrix[j][i] = Math.min(
                        matrix[j][i - 1] + 1,
                        matrix[j - 1][i] + 1,
                        matrix[j - 1][i - 1] + substitutionCost
                    );
                }
            }

            return matrix[b.length][a.length];
        },

    },
    emits:['update:modelValue', 'comment-clicked'],
    expose: ['createComment', 'getEditorView', 'forceUpdateContent'],
    computed: {
        isUserLoggedIn() {
            return this.$store.isUserLoggedIn;
        },
        isDarkTheme() {
            return this.$vuetify.theme.global.current.dark
        }
    },
    watch: {
        isDarkTheme(newVal) {
            if (!this.get || this.loading) {
                return; // Don't try to modify editor if it's not ready
            }
            
            try {
                if (newVal) {
                    this.editor.get().remove(nord)
                } else {
                    this.editor.get()
                }
            } catch (error) {
                console.warn('Theme switching error:', error);
            }
        },
        // Watch login status to remove comment marks when user logs out
        isUserLoggedIn: {
            handler(newVal, oldVal) {
                if (newVal === false && oldVal === true) {
                    // User logged out, remove all comment marks
                    this.removeAllCommentMarks();
                }
            },
            immediate: false
        },

        // Watch both comments and version changes to filter comments by version
        '$store.selected.comments': {
            handler(oldVal, newVal) {
                if (oldVal === newVal && this.loading) return;
                // Sync comment marks when comments change (only if user is logged in)
                if (this.isUserLoggedIn) {
                    this.syncCommentMarks();
                }
            },
            immediate: true,
            deep: true
        },

        modelValue: {
            immediate: true,
            handler(newVal, oldVal) {
                if (!newVal) return;
                
                // Process content when it changes
                if (newVal.includes('<br') || newVal.includes('&lt;br')) {
                    this.processContentBeforeRender(newVal);
                }

                if (this.$store.selected.currentVersion !== 'live' && !this.loading) {
                    this.$store.updateMarkedUpContent({
                        docID: this.$store.selected.id, 
                        versionContent: this.$store.selected.data.content, 
                        versionNumber: this.$store.selected.currentVersion});
                    }

                // Sync comment marks when document content changes (only if user is logged in)
                if (!this.loading && this.isUserLoggedIn) {
                    this.$nextTick(() => {
                        this.syncCommentMarks();
                    });
                }
            }
        }
    },
    created() {
        if (this.modelValue) {
            this.processContentBeforeRender(this.modelValue);
        }

        // Set up event watcher for resolve-comment events
        this.resolveCommentWatcher = useEventWatcher(this.$eventStore, 'resolve-comment', (payload) => {
            if (!this.get || this.loading) return;
            
            this.get().action((ctx) => {
                    const view = ctx.get(editorViewCtx);
                    resolveComment(view, payload.commentId);
                });
        });

        // Set up event watcher for add events
        this.unresolveCommentWatcher = useEventWatcher(this.$eventStore, 'un-resolve-comment', (payload) => {
            if (!this.get || this.loading) return;
            
            this.get().action((ctx) => {
                    const view = ctx.get(editorViewCtx);
                    unresolveComment(view, payload.commentId);
                });
        });

        // Set up event watcher for un-resolve-comment events
        this.deleteCommentWatcher = useEventWatcher(this.$eventStore, 'delete-comment', (payload) => {
            if (!this.get || this.loading) return;
            
            this.get().action((ctx) => {
                    const view = ctx.get(editorViewCtx);
                    deleteComment(view, payload.commentId);
                });
        });

        this.scrollToCommentWatcher = useEventWatcher(this.$eventStore, 'scroll-to-comment', (payload) => {
            this.scrollToComment(payload.commentId);
        });

    },
    mounted() {
        this.$nextTick(() => {
            this.setupCommentClickHandler();
            // Initial sync of comment marks after component is mounted
            setTimeout(() => {
                // If user is not logged in on first load, remove comment marks
                if (!this.isUserLoggedIn) {
                    this.removeAllCommentMarks();
                } else {
                    this.syncCommentMarks();
                }
            }, 1000);
        });
    },
    beforeUnmount() {
        if (this.editorElement && this.commentClickHandler) {
            this.editorElement.removeEventListener('comment-clicked', this.commentClickHandler);
        }

        if (this.resolveCommentWatcher) {
            this.resolveCommentWatcher.stop();
        }
        if (this.unresolveCommentWatcher) {
            this.unresolveCommentWatcher.stop();
        }
        if (this.deleteCommentWatcher) {    
            this.deleteCommentWatcher.stop();
        }
        if (this.scrollToCommentWatcher) {
            this.scrollToCommentWatcher.stop();
        }
    }
};
</script>
  

<style>

div.milkdown-toolbar {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
}

.milkdown .milkdown-toolbar {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
}

@media (max-width: 600px) {
    .canonical-editor {
        font-size: 0.7rem !important;
    }
    
    .canonical-editor .ProseMirror p,
    .canonical-editor .ProseMirror ul,
    .canonical-editor .ProseMirror ol {
        font-size: 0.85rem !important; /* Slightly larger to prevent zoom */
    }
    
    .canonical-editor .ProseMirror h1 {
        font-size: 2.5rem !important;
    }
    
    .canonical-editor .ProseMirror h2 {
        font-size: 1.3rem !important;
    }
    
    .canonical-editor .ProseMirror h3 {
        font-size: 1.0rem !important;
    }
    
    /* Add touch-action to prevent browser gestures from interfering */
    .canonical-editor .ProseMirror {
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
    }

    .canonical-editor .ProseMirror-focused {
        outline: none;
    }
}

/* Comment highlight effect */
.comment-highlight {
    background-color: rgba(255, 255, 0, 0.3) !important;
    transition: background-color 0.3s ease;
    animation: comment-pulse 2s ease-in-out;
}

@keyframes comment-pulse {
    0% { background-color: rgba(255, 255, 0, 0.3); }
    50% { background-color: rgba(255, 255, 0, 0.6); }
    100% { background-color: rgba(255, 255, 0, 0.3); }
}
</style>
