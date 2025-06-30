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
                <v-stepper-window-item value="1" key="1-content">
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

                <v-stepper-window-item value="2" key="2-content" >
                    <v-card-title>Configure your project (you can change this later)</v-card-title>
                    <ProjectConfig v-if="currentStep === 1" :newUserSetup="true" @update:project="updateProject"></ProjectConfig>
                </v-stepper-window-item>

                <v-stepper-window-item value="3" key="3-content">
                    <v-card-title>Review project</v-card-title>
                    <v-list-item-title>Project Name</v-list-item-title>
                    <v-list-item-subtitle>{{ setupProject.name }}</v-list-item-subtitle>
                    <v-list-item-title>Owner</v-list-item-title>
                    <v-list-item-subtitle>{{ $store.user.email }}</v-list-item-subtitle>
                    <v-list-item-title>Folders</v-list-item-title>
                    <v-list-item-subtitle>{{ setupProject.folders.map(folder => folder.name).join(', ') }}</v-list-item-subtitle>
                </v-stepper-window-item>

                <v-stepper-window-item value="4" key="4-content">
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
        setupProject: {
            name: 'My Project',
            folders: [] 
        }
    }),
    watch:{
        '$store.user.uid': {
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
        '$store.tempProject': {
            handler: function(newValue) {
                this.setupProject = newValue
            },
            deep: true
        }
    },
    methods: {
        startTour(){
            this.currentStep = 5
        },
        updateProject(project){
            this.setupProject = project
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
            // Generate a unique UUID for this launch flow
            const launchId = crypto.randomUUID();
            
            try {
                this.$eventStore.emitEvent('loading-modal', { show: true, message: 'Setting up your project', id: launchId });
                
                // Check if user can create projects (though this should rarely be an issue for new users)
                if (!this.$store.canCreateProject.allowed) {
                    this.$store.uiAlert({ 
                        type: 'error', 
                        message: this.$store.canCreateProject.reason,
                        autoClear: true 
                    });
                    this.$eventStore.emitEvent('loading-modal', { show: false, message: '', id: launchId });
                    return;
                }
                
                await this.$store.projectCreate(this.setupProject)
                await this.$store.userSetDefaultProject(this.$store.project.id)
                
                // Ensure project setup is complete and user has access
                await this.$store.projectRefresh(true)
                
                // Explicitly refresh user data to ensure project membership is established
                await this.$store.userEnter()
                
                // Small delay to ensure all project data is properly established
                await new Promise(resolve => setTimeout(resolve, 2000))
                
            } catch (error) {
                console.error('Error setting up project:', error)
                this.$store.uiAlert({ 
                    type: 'error', 
                    message: 'Failed to set up project. Please try again.',
                    autoClear: true 
                })
                this.$eventStore.emitEvent('loading-modal', { show: false, message: '', id: launchId });
                return
            }

            try {
                this.$eventStore.emitEvent('loading-modal', { show: true, message: 'Creating your first document!', id: launchId });
                let prompt = ''
                let documentName = "My first product doc"
                let documentContent = "Welcome to *Canonical!* we've created this document to help you get started. type \"gen\" to start creating!"
                
                if (this.productDescription.length > 0){
                    prompt = `Create a first product document, it should include basic product info like, product value proposition, target customers, key features. use the provided product description to create the document: ${this.productDescription}`
                    // Use the product description to create a more meaningful document name
                    documentName = this.productDescription.split(' ').slice(0, 4).join(' ') + ' - Product Doc'
                } else {
                    prompt = `Create a first product document, it should include basic product info like, product value proposition, target customers, key features`
                }
                
                // Try to generate AI template, but fallback to simple content if it fails
                try {
                    let result = await Generate.generateDocumentTemplate({prompt: `create a document template based on the title: ${documentName}`})
                    documentContent = `Welcome to *Canonical!* we've created this document to help you get started. type "gen" to start creating! \n ${result.response.text()}`
                } catch (aiError) {
                    console.warn('AI template generation failed, using fallback content:', aiError)
                    // Use fallback content - the documentContent is already set to the basic welcome message
                }

                const doc = {
                    name: documentName,
                    content: documentContent,
                    draft: true,
                }
              
                const createdDoc = await this.$store.documentsCreate({ data: doc, select : false})
                this.$store.toggleFavorite( createdDoc.id);
                
                // Small delay before navigation to ensure document is fully created
                await new Promise(resolve => setTimeout(resolve, 500))
                
                this.$router.push('/document/' + createdDoc.id)
                this.$eventStore.emitEvent('loading-modal', { show: false, message: '', id: launchId });
            } catch (error) {
                console.error('Error creating document:', error)
                this.$store.uiAlert({ 
                    type: 'error', 
                    message: 'Failed to create initial document. You can create one manually.',
                    autoClear: true 
                })
                this.$eventStore.emitEvent('loading-modal', { show: false, message: '', id: launchId });
                this.$router.push({ path: `/document/create-document`})
            }
            this.$emit('close')
        }
    }

}


</script>

<style scoped>

</style>

