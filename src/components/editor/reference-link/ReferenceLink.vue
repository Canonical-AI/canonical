<script>
import { useNodeViewContext } from '@prosemirror-adapter/vue'
import { Document } from "../../../services/firebaseDataService";
import { Generate } from "../../../services/vertexAiService";

export default {
    setup(){
        const { node } = useNodeViewContext()
        const src = node.value.attrs.src

        return {node, src}
    },
    data() {
        return {
            newDoc: false,
            loading: false
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
    methods: {
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
        }
    }
}
</script>

<template>
    <v-chip density="compact" class="m-0" v-if="newDoc === true" label color="success" @click="createDocument()">
        <v-progress-linear v-if="this.loading"  indeterminate  style="position: absolute; top: 0; left: 0; right: 0; z-index: 1;" />
        <v-icon icon="mdi-at" />
        {{documentName}}
    </v-chip>
    <v-chip density="compact" class="m-0" v-else label color="primary" @click="$router.push('/document/' + src)">
        <v-icon icon="mdi-at" />
        {{documentName}}
    </v-chip>
</template>

<style scoped>

</style>