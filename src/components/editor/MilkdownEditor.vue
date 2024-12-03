<template>
        <Milkdown 
            ref="milkdown"
            class="editor text-body-2 h-auto"
            style="min-height: 95%;"
            />

</template>

<script>
import { Milkdown, useEditor } from '@milkdown/vue';
import { Crepe} from '@milkdown/crepe'
import { nord } from '@milkdown/theme-nord'

import { usePluginViewFactory , useWidgetViewFactory, useNodeViewFactory } from '@prosemirror-adapter/vue';
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import ReferenceLinkTooltip from './reference-link/ReferenceLinkTooltip.vue'
import SlashGenerate from './SlashGenerate.vue'
import { rootCtx , editorViewOptionsCtx} from '@milkdown/core';
import { schemaCtx } from '@milkdown/core';
import { $view , $prose, $nodeSchema } from '@milkdown/utils';
import {remarkDirective, useReferenceLink} from './reference-link'
import { useTask } from './task'
import { Plugin } from 'prosemirror-state';
import {getCurrentInstance } from 'vue';

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
    },
    setup(props, {emit}){
        const nodeViewFactory = useNodeViewFactory();
        const pluginViewFactory = usePluginViewFactory();
        const referenceLink = useReferenceLink();
        const task = useTask();

        const editor = useEditor((root) => {
            const crepe = new Crepe({
                defaultValue: props.modelValue
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
                        editable
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
            editor: null,
            placeholder: 'Get your ideas out...',
            placeholders: [
                'Write something...',
                'Start your story...',
                'Share your thoughts...',
                'Compose a message...',
                'Get your ideas out...',
                'What are you thinking about?',
                'What are you doing dave?', 
            ]
        };
    },
    methods: {
        updatePlaceholder() {
            this.placeholder = this.placeholders[Math.floor(Math.random() * this.placeholders.length)];
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
        }
    }
};
</script>
  
  <!-- Add "scoped" attribute to limit CSS to this component only -->
<style>

</style>
