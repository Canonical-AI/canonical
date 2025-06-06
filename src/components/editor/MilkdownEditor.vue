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

        // Method to create comment decoration that can be called externally
        createCommentDecoration(from, to, commentData) {
            if (!this.get || this.loading) return;

            try {
                this.get().action((ctx) => {
                    const view = ctx.get(editorViewCtx);
                    commentFunctions.addDecoration(view, from, to, commentData);
                });
            } catch (error) {
                console.error('Failed to create comment decoration:', error);
            }
        },

        // Method to create a new comment with decoration
        createComment(from, to, text, documentId, documentVersion) {
            if (!this.get || this.loading) return null;

            try {
                let commentData = null;
                this.get().action((ctx) => {
                    const view = ctx.get(editorViewCtx);
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

        // Method to refresh comment decorations (useful after plugin changes)
        refreshCommentDecorations() {
            if (!this.get || this.loading) {
                return;
            }

            // Use $nextTick twice to ensure all updates have propagated
            this.$nextTick(() => {
                this.$nextTick(() => {
                    try {
                        this.get().action((ctx) => {
                            const view = ctx.get(editorViewCtx);
                        
                            const getFreshComments = () => {
                                return this.$store.state.selected.comments || [];
                            };
                            
                            commentFunctions.refreshAllDecorations(view, getFreshComments);
                        });
                    } catch (error) {
                        console.error('Failed to refresh comment decorations:', error);
                    }
                });
            });
        },

        // Method to scroll to a specific comment position in the editor
        scrollToComment(commentId) {
            if (!this.get || this.loading) {
                return;
            }

            try {
                this.get().action((ctx) => {
                    const view = ctx.get(editorViewCtx);
                    const { state } = view;
                    
                    // Find the comment in store data
                    const comment = this.$store.state.selected.comments?.find(c => c.id === commentId);
                    
                    if (!comment || !comment.editorID) {
                        return;
                    }

                    const { from, to } = comment.editorID;
                    
                    // Ensure the position is valid
                    if (from < 0 || from > state.doc.content.size || to < 0 || to > state.doc.content.size) {
                        return;
                    }

                    // Find the comment element in the DOM and scroll to it
                    this.$nextTick(() => {
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
                    this.$nextTick(() => {
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
                });
            } catch (error) {
                console.error('Failed to scroll to comment:', error);
            }
        },

        // Method to update comments based on current version
        updateCommentsForCurrentVersion() {

            if (this.commentsApplied)  return;
            
            const currentVersion = this.$store.state.selected.currentVersion;
            if (!this.get || this.loading) {
                setTimeout(() => this.updateCommentsForCurrentVersion(), 500);
                return;
            }

            // Get filtered comments for current version
            const filteredComments = this.$store.getters.filteredCommentsByVersion;
            if (!filteredComments?.length)  return;

            // Filter out resolved comments and apply active ones
            const activeComments = filteredComments.filter(comment => 
                !comment.resolved && 
                comment.editorID?.from >= 0 && 
                comment.editorID?.to >= 0
            );
            
            if (!activeComments.length) {return}
 
            // Apply each comment decoration
            activeComments.forEach(comment => {
                if (comment.editorID.from === comment.editorID.to) return;
                
                try {
                    this.createCommentDecoration(
                        comment.editorID.from, 
                        comment.editorID.to, 
                        comment
                    );
                } catch (error) {
                    console.error('Failed to apply comment decoration:', comment.id, error);
                }
            });

            this.commentsApplied = true;
        },

        // Method to set up comment click handler
        setupCommentClickHandler() {
            setTimeout(() => {
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

        updateCommentPositionsOnSave() {
            if (!this.get || this.loading) return;

            try {
                const comments = this.$store.state.selected.comments;
                
                if (!comments?.length) {
                    return;
                }

                // Get actual current positions from comment plugin decorations
                this.get().action((ctx) => {
                    const view = ctx.get(editorViewCtx);
                    const { state } = view;
                    const commentPluginState = commentPluginKey.getState(state);
                    
                    if (!commentPluginState) return;
                    
                    const positionUpdates = [];

                    // Try different ways to access decorations
                    if (commentPluginState.find) {
                        const decorations = commentPluginState.find();
                        
                        decorations.forEach((decoration, index) => {
                            
                            // Get the comment ID from the spec (now properly stored there)
                            const commentId = decoration.spec.commentId || 
                                            decoration.spec['data-comment-id'] || 
                                            decoration.attrs?.['data-comment-id'];                       
 
                            if (commentId) {
                                const comment = comments.find(c => c.id === commentId);
   
                                if (comment && comment.editorID) {
                                    const currentFrom = decoration.from;
                                    const currentTo = decoration.to;
                                    
                                    // Always add to updates for now to test saving
                                    positionUpdates.push({
                                        commentId: commentId,
                                        newFrom: currentFrom,
                                        newTo: currentTo
                                    });
                                }
                            } 
                        });
                    } 

                    if (positionUpdates.length > 0) {
                        const uniqueUpdates = [];
                        const seenIds = new Set();
                        
                        positionUpdates.forEach(update => {
                            if (!seenIds.has(update.commentId)) {
                                seenIds.add(update.commentId);
                                uniqueUpdates.push(update);
                            }
                        });

                        this.$store.commit('updateCommentPositions', uniqueUpdates);
                    } 
                });
            } catch (error) {
                console.error('Failed to save comment positions:', error);
            }
        },

    },
    emits:['update:modelValue', 'comment-clicked'],
    expose: ['updateCommentPositionsOnSave', 'createComment', 'removeComment', 'refreshCommentDecorations', 'scrollToComment'],
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
                this.editor.get().remove(nord)
            } else {
                this.editor.get()
            }
        },
        // Watch both comments and version changes to filter comments by version
        '$store.state.selected.comments': {
            handler(newComments, oldComments) {
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
            this.setupCommentClickHandler();
        });
    },
    
    beforeUnmount() {
        // Clean up event listener
        if (this.editorElement && this.commentClickHandler) {
            this.editorElement.removeEventListener('comment-clicked', this.commentClickHandler);
        }
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

.mildown .milkdown-toolbar {
    display: none;
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
