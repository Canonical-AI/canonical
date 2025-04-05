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
                            if (event.clipboardData) {
                                const content = event.clipboardData.getData('text/plain');
                                const splitRegex = /(:canonical-(?:task|ref){[^}]*})/g;
                                const parts = content.split(splitRegex).filter(Boolean);

                                let tr = view.state.tr;
                                let currentPos = view.state.selection.from;
                                let lastMatchEnd = 0;

                                const nodes = []
                                for (const part of parts) {
                                    if (part.match(splitRegex)) {
                                        if (part.includes('canonical-task')) {
                                            const srcMatch = chunk.match(/src="([^"]*)"/)
                                            const identityMatch = chunk.match(/identity="([^"]*)"/)
                                            const checkedMatch = chunk.match(/checked="([^"]*)"/)
                                            
                                            const src = srcMatch ? srcMatch[1] : '';
                                            const identity = identityMatch ? identityMatch[1] : '';
                                            const checked = checkedMatch ? checkedMatch[1] : 'false';
                                            
                                            const customNode = taskNode.type(ctx).create({ 
                                                src, 
                                                identity, 
                                                checked 
                                            });

                                            nodes.push(customNode)
                                        } else if (part.includes('canonical-ref')) {
                                            const srcMatch = chunk.match(/src="([^"]*)"/)
                                            const src = srcMatch ? srcMatch[1] : '';
                                            
                                            const customNode = referenceLinkNode.type(ctx).create({ 
                                                src,
                                                parent: this.$store.state.selected.id 
                                            });
                                                // tr = tr.insertNode(customNode, view);
                                            nodes.push(customNode)
                                        }
                                    } else {
                                        nodes.push(part)
                                    }
                                }
                                
                                console.log(nodes)
                                tr.replaceSelection(nodes.join(''));
                                view.dispatch(tr);

                                return true;
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

</style>
