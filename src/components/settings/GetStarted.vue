<template>
        <v-card>
          <v-card-title>Welcome to Canonical</v-card-title>

          <v-stepper editable v-model="currentStep" alt-labels>
            <v-stepper-header>
                 <v-stepper-item
                    title="Account"
                    value="1"
                    :complete="currentStep > 0"
                />
                <v-divider/>
                <v-stepper-item
                    title="Project config"
                    value="2"
                />
                <v-divider/>
                <v-stepper-item
                    title="Review"
                    value="3"
                />
                <v-divider/>
                <v-stepper-item
                    title="Description"
                    value="4"
                    subtitle="Optional"
                    />
                <v-divider/>
                <v-stepper-item
                    title="Tour"
                    value="5"
                    subtitle="Optional"
                />
                <v-divider/>
                <v-stepper-item
                    title="Go"
                    value="6"
                ></v-stepper-item>
            </v-stepper-header>

            <v-stepper-actions class="mt-4"
                @click:next="currentStep++"
                @click:prev="currentStep--"
            >
            </v-stepper-actions>

            <v-stepper-window style="max-height: 370px;" :class="{ 'overflow-y-auto': currentStep === 1 }">
                <v-stepper-window-item value="1" key="1">
                    <v-card-title>Setting up your account</v-card-title>
                    <div class="flex justify-center my-6">
                        <v-progress-circular v-if="settingUpAccount" color="primary" indeterminate :size="128" :width="11"></v-progress-circular>
                        <v-icon v-if="!settingUpAccount"
                            class="mb-6"
                            color="success"
                            icon="mdi-check-circle-outline"
                            size="128"
                        ></v-icon>
                    </div>
                </v-stepper-window-item>

                <v-stepper-window-item value="2" key="2" >
                        <v-card-title>Configure your project (you can change this later)</v-card-title>
                        <ProjectConfig v-if="currentStep === 1" :newUserSetup="true"></ProjectConfig>
                </v-stepper-window-item>

                <v-stepper-window-item value="3" key="3">
                    <v-card-title>Review project</v-card-title>
                    <v-list-item-title>Project Name</v-list-item-title>
                    <v-list-item-subtitle>{{ tempProject.name }}</v-list-item-subtitle>
                    <v-list-item-title>Owner</v-list-item-title>
                    <v-list-item-subtitle>{{ $store.state.user.email }}</v-list-item-subtitle>
                    <v-list-item-title>Folders</v-list-item-title>
                    <v-list-item-subtitle>{{ tempProject.folders.map(folder => folder.name).join(', ') }}</v-list-item-subtitle>
                </v-stepper-window-item>

                <v-stepper-window-item value="4" key="4">
                    <v-card-subtitle>Tell us about your product [optional]</v-card-subtitle>
                    <v-textarea v-model="productDescription">
                    </v-textarea>
                </v-stepper-window-item>

                <v-stepper-window-item value="5" key="5">
                    <v-card-subtitle>Tour Canonical [optional]</v-card-subtitle>
                    <div class="flex justify-center my-6">
                        <v-btn disabled color="primary">Start Tour [Coming Soon]</v-btn>
                    </div>
                </v-stepper-window-item>

                <v-stepper-window-item value="6" key="6">
                    <!-- Content for step 6 -->
                    <div class="flex justify-center my-6">
                        <v-btn color="primary" @click="launch">Lets Go!</v-btn>
                    </div>
                </v-stepper-window-item>
            </v-stepper-window>

          </v-stepper>

          
        </v-card>
</template>

<script>
import ProjectConfig from './ProjectConfig.vue';
import {Project} from '../../services/firebaseDataService'
import { Generate } from "../../services/vertexAiService";


export default {
    components: {
        ProjectConfig
    },
    name: 'GetStarted',
    emits: ['close'],
    data: () => ({
        steps: ['setup account', 'configure project', 'review project', 'product description', 'tour canonical', 'done'],
        productDescription: '',
        settingUpAccount: true,
        currentStep: 0,
        tempProject: null
    }),
    watch:{
        '$store.state.user.uid': {
            handler: function(newValue) {
                if (newValue !== null) {
                    this.settingUpAccount = false;
                    setTimeout(() => {
                        this.currentStep = 1
                    }, 1000)
                }
            },
            immediate: true
        },
        '$store.state.tempProject': {
            handler: function(newValue) {
                this.tempProject = newValue
            },
            deep: true
        }
    },
    methods: {
        startTour(){
            this.currentStep = 5
        },
        initiateFirstDocument(){
            if(this.productDescription.length > 0){
                console.log("call vertex ai to generate first document")
            }

            console.log("create first doc")

            this.$router.push('/')
            console.log("redirect to new doc")
        },
        async launch(){
            const projectRef = await Project.create(this.tempProject)
            await this.$store.commit('setProject', projectRef.id )
            await this.$store.commit('setDefaultProject', projectRef.id)

            try {
                if (this.productDescription.length > 0){
                    prompt = `Create a first product document, it should include basic product info like, product value proposition, target customers, key features. use the provided product description to create the document: ${this.productDescription}`
                } else {
                    prompt = `Create a first product document, it should include basic product info like, product value proposition, target customers, key features`
                }
                
                let result = await Generate.generateDocumentTemplate({prompt: `create a document template based on the title: ${this.documentName}`})

                const doc = {
                    name: "My first product doc",
                    content: `Welcome to *Canonical!* we've created this document to help you get started. type "gen" to start creating! \n ${result.response.text()}`,
                    draft: true,
                }
              //  const createdDoc = await Document.create(doc);
                const createdDoc = await this.$store.dispatch('createDocument', { data: doc, select : false})
                this.$store.commit('toggleFavorite', createdDoc.id);
                this.$router.push('/document/' + createdDoc.id)
            } catch (error) {
                console.error(error)
                this.$router.push({ path: `/document/create-document`})
            }
            this.$emit('close')
        }
    }

}


</script>

<style scoped>

</style>

