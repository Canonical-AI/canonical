<template>
    <Transition v-bind="$fadeTransition">
        <div ref="genRef" class="at-mention absolute data-[show='false']:hidden whitespace-nowrap" >
            <Transition v-bind="$fadeTransition">
                <div v-if="show" class="border rounded-sm">
                    <v-combobox
                    v-model:search="search"
                    v-model:open="open"
                    :items="flattenedDocuments"
                    item-title="name"
                    item-value="id"
                    @keyup.enter="insertDocument"
                    @click:clear="insertDocument" 
                    @keyup="handleKeyup"
                    auto-select-first="exact"
                    density="compact"
                    variant="solo-inverted"
                    ref="autocomplete"
                    hide-details
                ></v-combobox>
                </div>
          </Transition>
        </div>
    </Transition>
</template>

<!-- 
@keyup.enter="insertDocument"
@click:clear="insertDocument" 
-->

<script>
import { editorViewCtx} from '@milkdown/core'; // Adjust the import based on your setup
import { SlashProvider } from "@milkdown/kit/plugin/slash";
//import { linkSchema } from '@milkdown/kit/preset/commonmark'
import { useInstance } from '@milkdown/vue';
import { usePluginViewContext } from '@prosemirror-adapter/vue';
import { useMainStore } from '../../../store/index.js';
import { ref } from 'vue';
import { linkSchema } from '@milkdown/kit/preset/commonmark'
import { referenceLinkNode } from './index'
import { nextTick } from 'vue'; // Ensure nextTick is imported


export default {
    setup(){
        const { view, prevState } = usePluginViewContext();
        const [loading, get] = useInstance();
        const genRef = ref(null);
        const tooltipProvider = new SlashProvider({content: genRef})
        const store = useMainStore();
        return {loading,get,view,prevState,genRef,tooltipProvider,store}
    },
    data() {
        return {
            open: false,
            selectedDocument: "",
            keyPressed: null,
            show: false,
            search: null,
            maxlength: 62,
        };
    },
    methods: {

        handleKeyup(event) {
            // Check for delete or backspace key
            this.keyPressed = event.key;
            this.tooltipProvider.update(this.view, this.prevState);
            if (this.keyPressed === 'Escape') {
                this.cancel();
            }
        },

        cancel() {
            this.show = false;
            this.selectedDocument = "";
            
        },

        async insertDocument(){
            // Logic to insert the document link

            if (this.loading) return;

            let val = this.flattenedDocuments.find(item=> item.name==this.search)?.id ?? this.search.slice(0, this.maxlength)

            this.get().action((ctx) => {
                const view = ctx.get(editorViewCtx);
                const { dispatch, state } = view;
                const { tr} = state;
                const { from } = state.selection; // Get current selection

                if (this.search === val) {

                    const customNode = referenceLinkNode.type(ctx).create({ src: val, parent: this.store.selected.id}); 

                    dispatch(tr
                        .replaceSelectionWith(customNode)
                        .deleteRange(from -1, from)
                        .scrollIntoView(),
                    );
                        
                    view.focus();
                    this.open = false;
                    this.selectedDocument = "";
                } else {
                    const customNode = referenceLinkNode.type(ctx).create({ src: val }); 

                    dispatch(tr
                        .replaceSelectionWith(customNode)
                        .deleteRange(from -1, from)
                        .scrollIntoView(),
                    );
                        
                    view.focus();
                    this.open = false;
                    this.selectedDocument = "";
                }
            })
        },

    },
    mounted() {

        this.tooltipProvider = new SlashProvider({
            content: this.genRef,
            trigger: '@',
            shouldShow: (view) => {
                if (this.search === "" && (this.keyPressed === 'Delete' || this.keyPressed === 'Backspace')) {
                    this.keyPressed = null
                    return false; // Do not show if selectedDocument is empty and delete/backspace is pressed
                }

                return true;
            }

        }, );

        //this.tooltipProvider.update(this.view, this.prevState);
    },
    computed: {
        filteredDocuments() {
            return this.store.filteredDocuments;
        },
        flattenedDocuments() {
            return this.filteredDocuments.map(doc => ({
                id: doc.id,
                name: `@doc:${doc.data.name}`, 
            }));
        },
    },
    watch: {
        view: {
            handler() {
                this.tooltipProvider.update(this.view, this.prevState);
                const lastChar = this.view.state.doc.textBetween(this.view.state.selection.from - 1, this.view.state.selection.from, ' ', ' ');
                if (lastChar === '@') {
                    // Show the slash menu
                    this.show = true;
                    nextTick(() => {
                        this.$refs.autocomplete.focus(); // Focus the combobox after the DOM updates
                    });
                } else {
                    this.show = false;
                }
            },
        },
        prevState: {
            handler() {
                this.tooltipProvider.update(this.view, this.prevState);
            },
        },

    },
    beforeUnmount() {
        this.tooltipProvider.destroy();
    },
};
</script>

<style lang="css" scoped>

.milkdown .at-mention {
    /* Styles for dropdown menus within milkdown */
    width: 300px !important;
    border-radius: 4px;
    padding: 4px;
}

</style>