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

    },
    emits:['update:modelValue', 'comment-clicked'],
    expose: ['createComment', 'getEditorView', 'forceUpdateContent'],
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
        // Watch both comments and version changes to filter comments by version
        '$store.state.selected.comments': {
            handler(oldVal, newVal) {
                if (oldVal === newVal) return;
                //TODO: RE-IMPLEMENT COMMENT FUNCTIONS to update if comments are resolved or unresolved
            },
            immediate: true,
            deep: true
        },
        '$store.state.selected.currentVersion': {
            handler() {
                //TODO: RE-IMPLEMENT COMMENT FUNCTIONS if version changes
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
