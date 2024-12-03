<template>
    <div 
        ref="slashRef" 
        class="at-mention absolute data-[show='false']:hidden whitespace-nowrap"
        :class="{ 'gen-outline': show }"
        >
       <Transition v-bind="$fadeTransition">
            <div v-if="show">
            <v-combobox
                    :items="['create a list for me','another one']"
                    item-title="name"
                    item-value="id"
                    v-model="generateInput"
                    placeholder="#prompt: "
                    @keyup.enter="handleGenerate"
                    @click:clear="cancel"
                    @keyup="handleKeyup"
                    auto-select-first
                    hide-details
                    return-object
                    density="compact"
                    variant="solo"
                    ref="autocomplete"
                    v-model:open="open"
                    class="custom-combobox"
                    flat
                >
                <template v-slot:append>
                    <v-btn class="text-none" v-if="generateInput && !generatedOutput" @click="handleGenerate()" color="primary" size="small">Generate</v-btn>
                    <v-btn class="text-none" v-else-if="!generateInput" @click="cancel()" variant="text" size="small">Esc to cancel</v-btn>
                </template>
                <template v-slot:prepend>
                    <div v-if="generatedOutput">Prompt:</div>
                </template>
            </v-combobox>
                

                <div v-if="generatedOutput" class="preview">
                    <div class="preview-content"v-html="$marked(generatedOutput)"></div>
                    <div>
                        <v-btn class="text-none" color="primary" size="small" variant="outlined" @click="insertPreviewContent()">Accept</v-btn>
                        <v-btn class="text-none" color="error" size="small" variant="outlined" @click="handleGenerate()">Regenerate</v-btn>
                        <v-btn class="text-none" size="small" variant="outlined" @click="cancel()">Close</v-btn>
                    </div>

                </div>
            </div>
        </Transition>
    </div>
</template>

<script>
import { SlashProvider } from "@milkdown/kit/plugin/slash";
import { editorViewCtx, parserCtx} from '@milkdown/core'; // Adjust the import based on your setup
//import { callCommand } from '@milkdown/kit/utils';

import { useInstance } from '@milkdown/vue';
import { usePluginViewContext } from '@prosemirror-adapter/vue';
import {Generate} from "../../services/vertexAiService"
import {marked} from 'marked'

export default {
    setup(){
        const { view, prevState } = usePluginViewContext();
        const [loading, get] = useInstance();

        return {loading,get,view,prevState}
    },
    data() {
        return {
            slashRef: null,
            tooltipProvider: null,
            generateInput:'',
            generatedOutput: null,
            keyPressed: null,
            open: true,
            show: false,
        };
    },
    methods: {
        handleKeyup(event) {
            // Check for delete or backspace key
            this.keyPressed = event.key;
            if (this.keyPressed === 'Escape') {
                this.cancel();
            }
            this.tooltipProvider.update(this.view, this.prevState);
        },

        async setupPluginViewContext() {
            const { view, prevState } = await usePluginViewContext();
            console.log(view)
            this.view = view;
            this.prevState = prevState;
        },

        async setupInstance() {
            const [loading, get] = await useInstance();
            this.loading = loading;
            this.get = get;
        },

        async handleGenerate() {

            if (this.loading) return;
            if (!this.generateInput) return;

            const genOut = await Generate.generateContent({prompt:this.generateInput})
            console.log(genOut.response)

            let response = ''
            for await (const chunk of genOut.stream) {
                    const chunkText = chunk.text();
                    response += chunkText;
                    console.log(chunkText);
                }

            this.generatedOutput = response
        },

        insertPreviewContent() {
            this.get().action((ctx) => {
                    const view = ctx.get(editorViewCtx);
                    const { dispatch, state } = view;
                    const {tr} = state;
                    const { from } = state.selection; // Get current selection
                    dispatch(tr.deleteRange(from - 4, from) )
                    view.focus();
            })

            this.get().action((ctx) => {
                    const view = ctx.get(editorViewCtx);
                    const parser = ctx.get(parserCtx)
                    const slice = parser( this.generatedOutput)
                    const { dispatch, state } = view;
                    const {tr} = state;
                    const { from } = state.selection; // Get current selection

                    dispatch(tr
                        .insert(from,slice.content)
                    );
                })  

            this.generatedOutput = ''; // Clear the preview content after insertion
        },

        cancel() {
            this.generatedOutput = '';
            this.generateInput = '';
            this.show = false;
        }

    },
    mounted() {
        const YourDropdownUI = this.$refs.slashRef; // Define YourDropdownUI

        this.tooltipProvider = new SlashProvider({
            content: YourDropdownUI,
            shouldShow: (view) => {
                if (!this.$store.getters.canAccessAi) {
                    return false;
                }

                if (view.trackWrites === null || !(view.trackWrites instanceof Text)) {
                    return false;
                }

                if (this.generateInput === "" && (this.keyPressed === 'Delete' || this.keyPressed === 'Backspace')) {
                    this.keyPressed = null
                    return false; // Do not show if selectedDocument is empty and delete/backspace is pressed
                }

                const currentText = view.trackWrites;
                const wordsArray = currentText.data.split(/[\s&]+/); // Split by whitespace and &nbsp;
                const lastWord = wordsArray[wordsArray.length - 1]; // Get the last value
                const lastChar = this.view.state.doc.textBetween(this.view.state.selection.from - 4, this.view.state.selection.from, ' ', ' ');
  

                if (lastChar === '/gen') {
                    this.$nextTick(() => {
                            this.$refs.autocomplete.focus();  
                        });
                    return true;
                }

                if (this.show === false) {
                    return false;
                }

                return false;
            },
        });
        
        this.tooltipProvider.update(this.view, this.prevState);
    },

    watch: {
        view: {
            handler() {
                this.tooltipProvider?.update(this.view, this.prevState);
                const lastChar = this.view.state.doc.textBetween(this.view.state.selection.from - 4, this.view.state.selection.from, ' ', ' ');
                if (lastChar === '/gen') {
                    // Show the slash menu
                    this.show = true;
                } else {
                    this.show = false;
                }
            },
            immediate: true,
        },
        prevState: {
            handler() {
                this.tooltipProvider?.update(this.view, this.prevState);
            },
            immediate: true,
        },
    },
    beforeUnmount() {
        this.tooltipProvider?.destroy();
    },
};
</script>

<style lang="css" scoped>


.milkdown .at-mention {
    margin: 4px;
    border-radius: 4px;
    max-width: 700px !important;
    min-width: 200px !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); /* Subtle shadow */
    background-color: rgb(var(--v-theme-surface));
 
    .v-input {
        padding: 4px;
    }

    :deep(.v-btn) {
        padding: 2px 8px;
    }

}

.preview {
    padding: 4px;
    gap: 4px;

    :deep(ul),
    :deep(ol) {
    padding-left: 1em;
    }
}

.preview-content {
    white-space: normal;
    word-wrap: break-word;
}

.preview :deep(ul),
.preview :deep(ol) {
  padding-left: 1em;
}


</style>