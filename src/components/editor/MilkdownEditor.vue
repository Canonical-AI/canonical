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
            if (!this.get || this.loading) return;

            this.get().action((ctx) => {
                const view = ctx.get(editorViewCtx);      
                commentFunctions.refreshAllDecorations(view);
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
                    
                    if (!comment || !comment.editorID) return;

                    const { from, to } = comment.editorID;
                    
                    // Ensure the position is valid
                    if (from < 0 || from > state.doc.content.size || to < 0 || to > state.doc.content.size) return;

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

            this.get().action((ctx) => {
                const view = ctx.get(editorViewCtx);
                commentFunctions.updateCommentPositions(view);
            });
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
            handler(oldVal, newVal) {
                if (oldVal === newVal) return;
                this.refreshCommentDecorations();
            },
            immediate: true,
            deep: true
        },
        '$store.state.selected.currentVersion': {
            handler() {
                this.refreshCommentDecorations();
            },
            immediate: true
        },
        loading: {
            handler() {
                if (this.loading) return;
                this.refreshCommentDecorations();
            },
            immediate: true
        },

        modelValue: {
            immediate: true,
            handler(newVal, oldVal) {
                if (!newVal) return;
                
                // Process content when it changes
                if (newVal.includes('<br') || newVal.includes('&lt;br')) {
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
        if (this.editorElement && this.commentClickHandler) {
            this.editorElement.removeEventListener('comment-clicked', this.commentClickHandler);
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
</style>
