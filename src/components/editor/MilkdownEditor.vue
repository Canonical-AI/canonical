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
import { rootCtx , editorViewOptionsCtx, editorViewCtx , parserCtx } from '@milkdown/core';
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
import { createCommentPlugin, commentFunctions, commentPluginKey } from './comment';
import CustomToolbar from './CustomToolbar.vue';

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
            // Update the placeholder text when mounted
            placeholderText.value = placeholders[Math.floor(Math.random() * placeholders.length)];
        });

        const isMobile = () => window.innerWidth <= 600;

        const editor = useEditor((root) => {
            const isEditable = () => !props.disabled;
            
            const crepe = new Crepe({
                defaultValue: props.modelValue,
                featureConfigs: {
                    [Crepe.Feature.Placeholder]: {
                            text: placeholderText.value
                    }
                    // Completely remove Toolbar feature config to disable it
                }
            });

            crepe.editor.config((ctx)=>{
                    ctx.set(rootCtx, root)
                    ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => {
                        if (markdown !== props.modelValue) {
                            emit("update:modelValue", markdown);
                        }
                    });
                    
                    ctx.update(editorViewOptionsCtx, (prev) => ({
                        ...prev,
                        editable: isEditable,
                        handlePaste: (view, event) => {
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
                        },
                        // Fix cursor position issue on mobile
                        handleDOMEvents: {
                            touchstart: (view, event) => {
                                // Prevent cursor from jumping to beginning
                                event.stopPropagation();
                                return false;
                            }
                        }
                    }))
                }) 
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
                .use($prose(() => createCommentPlugin()))
                .use($prose(() => new Plugin({
                    appendTransaction: (transactions, oldState, newState) => {
                        // Track comment position changes for transactions that modify content
                        transactions.forEach(tr => {
                            if (tr.docChanged && this.trackCommentPositionChanges) {
                                this.trackCommentPositionChanges(tr);
                            }
                        });
                        return null;
                    }
                })))
                .use(remarkDirective)
                .use(referenceLink.plugins) 
                .use(task.plugins)
                .use(diagram)
                .use( $view(diagramSchema.node, () => nodeViewFactory({
                    component: MermaidComponent,
                    key: 'mermaid-component',
                    stopEvent: () => true,
                })))
                .use(nord)

                
            return crepe
        })
        
        return { 
            editor,
            get,
            loading
        }
    },
    data() {
        return {
            editorInstance: null,
            lastSelection: null,
            editorReady: false,
            editorElement: null,
            commentClickHandler: null
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

        // Method to create comment decoration that can be called externally
        createCommentDecoration(from, to, commentData) {
            if (!this.get || this.loading) {
                console.error('Editor is not ready yet');
                return;
            }

            try {
                this.get().action((ctx) => {
                    const view = ctx.get(editorViewCtx);
                    
                    // Use the comment functions to add the decoration
                    commentFunctions.addDecoration(view, from, to, commentData);
                });
            } catch (error) {
                console.error('Failed to create comment decoration:', error);
            }
        },

        // Method to create a new comment with decoration
        createComment(from, to, text, documentId, documentVersion) {
            if (!this.get || this.loading) {
                console.error('Editor is not ready yet');
                return null;
            }

            try {
                let commentData = null;
                this.get().action((ctx) => {
                    const view = ctx.get(editorViewCtx);
                    
                    // Use the comment functions to create the comment
                    commentData = commentFunctions.createComment(view, from, to, text, documentId, documentVersion);
                });
                return commentData;
            } catch (error) {
                console.error('Failed to create comment:', error);
                return null;
            }
        },

        // Method to remove a comment decoration
        removeComment(commentId) {
            if (!this.get || this.loading) {
                console.error('Editor is not ready yet');
                return;
            }

            try {
                this.get().action((ctx) => {
                    const view = ctx.get(editorViewCtx);
                    
                    // Use the comment functions to remove the comment
                    commentFunctions.removeComment(view, commentId);
                });
            } catch (error) {
                console.error('Failed to remove comment:', error);
            }
        },

        // Method to clear all comment decorations
        clearAllComments() {
            if (!this.get || this.loading) {
                console.log('Editor not ready, cannot clear comments');
                return;
            }

            try {
                this.get().action((ctx) => {
                    const view = ctx.get(editorViewCtx);
                    
                    // Get all existing comment decorations
                    const { state } = view;
                    const commentPluginState = commentPluginKey.getState(state);
                    
                    if (commentPluginState) {
                        // Find all comment decorations and remove them
                        commentPluginState.find().forEach(decoration => {
                            const commentId = decoration.spec['data-comment-id'];
                            if (commentId) {
                                commentFunctions.removeComment(view, commentId);
                            }
                        });
                    }
                });
            } catch (error) {
                console.error('Failed to clear comments:', error);
            }
        },

        // Method to apply comments from store data
        applyCommentsFromStore(comments) {
            if (!comments || !Array.isArray(comments) || comments.length === 0) {
                console.log('No comments to apply');
                return;
            }

            if (!this.get || this.loading) {
                console.log('Editor not ready, cannot apply comments');
                return;
            }

            console.log('Applying comments from store:', comments);

            comments.forEach(comment => {
                // Check if comment has the required position data
                if (comment.editorID && 
                    typeof comment.editorID.from === 'number' && 
                    typeof comment.editorID.to === 'number') {
                    
                    try {
                        this.createCommentDecoration(
                            comment.editorID.from, 
                            comment.editorID.to, 
                            comment
                        );
                        console.log('Applied comment decoration:', comment.id);
                    } catch (error) {
                        console.error('Failed to apply comment decoration:', comment.id, error);
                    }
                } else {
                    console.warn('Comment missing position data:', comment.id, comment);
                }
            });
        },

        // Method to track comment position changes when document content changes
        trackCommentPositionChanges(tr) {
            if (!tr.docChanged || !this.$store.state.selected.comments) return;

            const positionUpdates = [];
            // Use all comments for position tracking, not just filtered ones
            const allComments = this.$store.state.selected.comments;
            
            allComments.forEach(comment => {
                if (comment.editorID && typeof comment.editorID.from === 'number' && typeof comment.editorID.to === 'number') {
                    // Map the old positions through the transaction changes
                    const newFrom = tr.mapping.map(comment.editorID.from);
                    const newTo = tr.mapping.map(comment.editorID.to);
                    
                    // If positions changed, record the update
                    if (newFrom !== comment.editorID.from || newTo !== comment.editorID.to) {
                        console.log(`Comment ${comment.id} position changed from [${comment.editorID.from}, ${comment.editorID.to}] to [${newFrom}, ${newTo}]`);
                        
                        positionUpdates.push({
                            commentId: comment.id,
                            newFrom,
                            newTo
                        });
                    }
                }
            });

            // Update positions in store and database if any changed
            if (positionUpdates.length > 0) {
                this.$store.commit('updateCommentPositions', positionUpdates);
            }
        },

        // Method to set up comment click handler
        setupCommentClickHandler() {
            // Wait for editor to be ready
            setTimeout(() => {
                const editorElement = this.$el?.querySelector('.ProseMirror');
                if (editorElement) {
                    this.editorElement = editorElement;
                    this.commentClickHandler = this.handleCommentClick.bind(this);
                    editorElement.addEventListener('comment-clicked', this.commentClickHandler);
                }
            }, 1000);
        },

        // Method to remove comment click handler
        removeCommentClickHandler() {
            if (this.editorElement && this.commentClickHandler) {
                this.editorElement.removeEventListener('comment-clicked', this.commentClickHandler);
            }
        },

        // Handle comment clicks
        handleCommentClick(event) {
            const commentId = event.detail?.commentId;
            if (commentId) {
                console.log('Comment clicked:', commentId);
                // Emit event to parent component to open drawer and scroll to comment
                this.$emit('comment-clicked', commentId);
            }
        },

        // Method to update comments based on current version
        updateCommentsForCurrentVersion() {
            const currentVersion = this.$store.state.selected.currentVersion;
            console.log('Updating comments for version:', currentVersion);

            // Check if editor is ready
            if (!this.get || this.loading) {
                console.log('Editor not ready, deferring comment application');
                
                // Retry after a short delay if editor is not ready
                setTimeout(() => {
                    if (!this.loading && this.get) {
                        console.log('Retrying comment application after delay');
                        this.updateCommentsForCurrentVersion();
                    }
                }, 500);
                return;
            }

            // Clear existing comment decorations first
            this.clearAllComments();

            // Get filtered comments for current version
            const filteredComments = this.$store.getters.filteredCommentsByVersion;
            console.log('Filtered comments for version', currentVersion, ':', filteredComments);

            // Apply filtered comments if any exist
            if (filteredComments && Array.isArray(filteredComments) && filteredComments.length > 0) {
                // Filter out resolved comments
                const activeComments = filteredComments.filter(comment => !comment.resolved);
                
                if (activeComments.length > 0) {
                    console.log('Applying', activeComments.length, 'active comments for version', currentVersion);
                    this.applyCommentsFromStore(activeComments);
                } else {
                    console.log('All comments are resolved for version', currentVersion, ', no decorations to show');
                }
            } else {
                console.log('No comments to display for version', currentVersion);
            }
        },

    },
    emits:['update:modelValue', 'comment-clicked'],
    computed: {
        isUserLoggedIn() {
            return this.$store.getters.isUserLoggedIn;
        },
        isDarkTheme() {
            return this.$vuetify.theme.global.current.dark
        }
    },
    watch: {
        isDarkTheme(newVal) {
            if (newVal) {
                console.log(this.editor.get().remove(nord))
            } else {
                console.log(this.editor.get())
            }
        },
        // Watch both comments and version changes to filter comments by version
        '$store.state.selected.comments': {
            handler() {
                this.updateCommentsForCurrentVersion();
            },
            immediate: true,
            deep: true
        },
        '$store.state.selected.currentVersion': {
            handler() {
                this.updateCommentsForCurrentVersion();
            },
            immediate: true
        },
        modelValue: {
            immediate: true,
            handler(newVal, oldVal) {
                if (!newVal) return;
                
                // Process content when it changes
                if (newVal.includes('<br') || newVal.includes('&lt;br') ) {
                    this.processContentBeforeRender(newVal);
                }
                
                // If this is a significant content change (new document), clear existing comments first
                if (oldVal && newVal !== oldVal && this.editorReady) {
                    console.log('Document content changed, clearing existing comments');
                    this.clearAllComments();
                }

            }
        }
    },
    created() {
        if (this.modelValue) {
            this.processContentBeforeRender(this.modelValue);
        }
    },
    mounted() {
        this.$nextTick(() => {
            console.log('MilkdownEditor mounted, editor will be ready shortly');
            
            // The comments watcher will handle applying comment decorations
            // when the editor is ready and comments are available
            
            // Add event listener for comment clicks
            this.setupCommentClickHandler();
        });
    },
    
    beforeUnmount() {
        // Clean up event listener
        this.removeCommentClickHandler();
    }
};
</script>
  
  <!-- Add "scoped" attribute to limit CSS to this component only -->
<style>
/* Make editor text smaller on mobile devices */
/* Disabled state for Crepe toolbar when editing is disabled */
.canonical-editor[data-disabled="true"] milkdown-toolbar {
    pointer-events: none;
    opacity: 0.5;
}

.canonical-editor[data-disabled="true"] milkdown-toolbar button {
    opacity: 0.5;
    cursor: not-allowed;
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
</style>
