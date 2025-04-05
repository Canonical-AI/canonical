<script>
import { useNodeViewContext } from '@prosemirror-adapter/vue'
import { Document } from "../../../services/firebaseDataService";
import { Generate } from "../../../services/vertexAiService";
import { useInstance } from '@milkdown/vue';
import { ref } from 'vue'


export default {
    setup(){
        const { node, view , prevState, selected, getPos} = useNodeViewContext()
        const [loading, get] = useInstance();
        const src = ref(node.value.attrs.src)
        
        return {node, src, view, prevState, loading, get, selected, getPos}
    },
    data() {
        return {
            newDoc: false,
            loading: false,
            isSelected: false
        }
    },
    name: "ReferenceLink",
    computed:{
        documentName() {
            const document = this.$store.state.documents.find(doc => doc.id === this.src); // Fetch document from store
            if (document) {
                this.newDoc = false
                return document.data.name
            } else {
                this.newDoc = true
                return this.src
            }
        }
    },
    mounted(){
        this.attachListeners()
        },
    methods: {
        detachListeners(){
            const editorDOM = this.view.dom
            editorDOM.removeEventListener('click', () => this.checkSelection())
            editorDOM.removeEventListener('keyup', () => this.checkSelection())
        },
        attachListeners(){
            const editorDOM = this.view.dom
            editorDOM.addEventListener('click', () => this.checkSelection())
            editorDOM.addEventListener('keyup', () => this.checkSelection())
               },
        checkSelection(){
            // TODO: check if the selection is on the node
            console.log('selection changed')

        },
        async createDocument() {
            this.loading = true
            const parent = this.$store.state.selected
            let result = await Generate.generateDocumentTemplate({prompt: `create a document template based on the title: ${this.documentName}`})
 
            console.log(result)
            console.log(result.response.text())
            const doc = {
                name: this.documentName,
                content: `Parent: :canonical-ref{src="${parent.id}"} \n ${result.response.text()}`,
                draft: true,
            }
            try {
                console.log(parent.data.content)
              //  const createdDoc = await Document.create(doc);
                const createdDoc = await this.$store.dispatch('createDocument', { data: doc, select : false})
                const updatedText = parent.data.content.replace(`src="${this.documentName}"`, `src="${createdDoc.id}"`); // replace the old link with the new link
                await this.$store.commit('updateSelectedDocument', {id: parent.id, data: {content: updatedText}})
                this.$router.push('/document/' + createdDoc.id)
            } catch (error) {
                console.log(error)
            }
        },
    },
    beforeUnmount(){
        this.detachListeners()
    },
    watch: {
        selected: {
            handler(newVal) {
                this.isSelected = !!newVal;
                console.log(this.isSelected)
            },
            immediate: true
        }
    },
}
</script>

<template>
    <v-chip density="compact" class="m-0" 
        v-if="newDoc === true" 
        label color="success" 
        @click="createDocument()"
        :class="{ 'selected-node': isSelected }">
        <v-progress-linear v-if="this.loading"  indeterminate  style="position: absolute; top: 0; left: 0; right: 0; z-index: 1;" />
        <v-icon icon="mdi-at" />
        {{documentName}}
    </v-chip>
    <v-chip density="compact" class="m-0" 
        v-else 
        label color="primary" 
        @click="$router.push('/document/' + src)"
        :class="{ 'selected-node': isSelected }">
        <v-icon icon="mdi-at" />
        {{documentName}}
    </v-chip>
</template>

<style scoped>
.selected-node {
    outline: 2px solid var(--v-theme-primary);
    box-shadow: 0 0 0 2px rgba(var(--v-theme-primary-rgb), 0.4);
}
</style>