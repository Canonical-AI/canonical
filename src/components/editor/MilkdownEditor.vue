<template>
        <Milkdown 
            ref="milkdown"
            class="canonical-editor editor text-body-2 h-auto"
            style="min-height: 95%;"
            />

</template>

<script>
import { Milkdown, useEditor } from '@milkdown/vue';
import { Crepe } from '@milkdown/crepe'
import { nord } from '@milkdown/theme-nord'

import { usePluginViewFactory , useWidgetViewFactory, useNodeViewFactory } from '@prosemirror-adapter/vue';
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import ReferenceLinkTooltip from './reference-link/ReferenceLinkTooltip.vue'
import SlashGenerate from './SlashGenerate.vue'
import { rootCtx , editorViewOptionsCtx, editorViewCtx } from '@milkdown/core';
import { schemaCtx } from '@milkdown/core';
import { $view , $prose, $nodeSchema } from '@milkdown/utils';
import {remarkDirective, useReferenceLink} from './reference-link'
import { useTask } from './task'
import { Plugin } from 'prosemirror-state';
import {getCurrentInstance, onMounted, ref} from 'vue';

import {commonmark } from '@milkdown/preset-commonmark';
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
                            // Only intercept if HTML br tags are present
                            if (event.clipboardData) {
                                const text = event.clipboardData.getData('text/plain');
                                
                                if (text.includes('<br')) {
                                    event.preventDefault();
                                    
                                    // Clean up HTML tags only
                                    const cleanText = text.replace(/<br\s*\/?>/gi, '\n');
                                    
                                    // Let Milkdown handle the markdown content normally
                                    view.dispatch(view.state.tr.insertText(cleanText));
                                    return true;
                                }
                            }
                            return false; // Let Milkdown handle other paste events naturally
                        }
                    }))
                }) 
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
        processTasks(content) {
            if (!content) return content;
            
            // Clean up any HTML tags
            let processedContent = content.replace(/<br\s*\/?>/gi, '\n');
            
            // Remove duplicate lines
            const lines = processedContent.split('\n').filter(line => line.trim() !== '');
            const uniqueLines = [...new Set(lines)];
            processedContent = uniqueLines.join('\n\n');
            
            return processedContent;
        },
        processContentBeforeRender(content) {
            if (!content) return;
            
            // Clean up any HTML tags and normalize content
            const cleanedContent = this.processTasks(content);
            
            // Only update if changed
            if (cleanedContent !== content) {
                this.$emit('update:modelValue', cleanedContent);
            }
        },
        insertMarkdown(markdown) {
            // Get the current editor instance
            if (this.editor && this.editor.get) {
                const editor = this.editor.get();
                
                // Get the editor view
                const view = editor.ctx.get(editorViewCtx);
                if (view) {
                    const { from, to } = view.state.selection;
                    const tr = view.state.tr;
                    
                    // Insert the markdown text at cursor position
                    tr.insertText(markdown, from, to);
                    view.dispatch(tr);
                }
            }
        }
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
                if (newVal.includes('<br') || newVal.includes('&lt;br') || newVal.includes(':canonical-task{')) {
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

</style>
