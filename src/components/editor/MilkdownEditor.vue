<template>
        <Milkdown 
            ref="milkdown"
            class="canonical-editor editor text-body-2 h-auto"
            style="min-height: 95%;"
            />

</template>

<script>
import {getCurrentInstance, onMounted, ref} from 'vue';

import { Milkdown, useEditor } from '@milkdown/vue';
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

export default {
    name: "MilkdownEditor",
    components:{
        Milkdown,
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

        const editor = useEditor((root) => {
            const crepe = new Crepe({
                defaultValue: props.modelValue,
                featureConfigs: {
                    [Crepe.Feature.Placeholder]: {
                            text: placeholderText.value
                    }
                }
            });

            const editable = () => !props.disabled;

            crepe.editor.config((ctx)=>{
                    ctx.set(rootCtx, root)
                    ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => {
                        if (markdown !== props.modelValue) {
                            emit("update:modelValue", markdown);
                        }
                    });
                    ctx.update(editorViewOptionsCtx, (prev) => ({
                        ...prev,
                        editable,
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
                                // Don't stop propagation completely, but prevent default cursor behavior
                                if (event.target.closest('.ProseMirror')) {
                                    // Only prevent default if we're actually in the editor
                                    event.preventDefault();
                                    return false; // Let ProseMirror handle the event
                                }
                                return false;
                            },
                            touchend: (view, event) => {
                                // Ensure cursor position is maintained after touch
                                if (event.target.closest('.ProseMirror')) {
                                    return false; // Let ProseMirror handle the event
                                }
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
        return { editor}
    },
    data() {
        return {
            editor: null
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


    },
    emits:['update:modelValue'],
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
        modelValue: {
            immediate: true,
            handler(newVal) {
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
    }
};
</script>
  
  <!-- Add "scoped" attribute to limit CSS to this component only -->
<style>
/* Make editor text smaller on mobile devices */
@media (max-width: 600px) {
    .canonical-editor {
        font-size: 0.7rem !important;
    }
    
    .canonical-editor .ProseMirror p,
    .canonical-editor .ProseMirror h1,
    .canonical-editor .ProseMirror h2,
    .canonical-editor .ProseMirror h3,
    .canonical-editor .ProseMirror ul,
    .canonical-editor .ProseMirror ol {
        font-size: 0.7rem !important;
    }
    
    .canonical-editor .ProseMirror h1 {
        font-size: 1.0rem !important;
    }
    
    .canonical-editor .ProseMirror h2 {
        font-size: 0.9rem !important;
    }
    
    .canonical-editor .ProseMirror h3 {
        font-size: 0.8rem !important;
    }
}
</style>
