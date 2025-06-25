<template>
    <v-container :class="{'px-20': !newUserSetup}" class="overflow-none w-100 pb-0">
        <div v-if="!newUserSetup">
            <v-select
                density="compact"
                v-model="projectData.name"
                :items="this.$store.projects"
                item-title="name"
                item-value="id"
                object
                label="Project"
                variant="solo"
                hide-details
                @update:modelValue="selectProject"

                >
                <template v-slot:append>
                    <v-btn disabled v-if="!isNewProject" @click="setupNewProject" class="float-right"> new project</v-btn>
                </template>
                <!-- todo: block new project if not a pro user -->
            </v-select>

            <h1 class="h1">{{ isNewProject ? 'Project Setup' : 'Project Config' }}
            </h1> 
        </div>


        <v-form @submit.prevent="handleSubmit"> 
            <v-text-field 
                density="compact" 
                v-model="projectData.name" 
                label="Name" 
                required 
                variant="solo"
            ></v-text-field>

            <v-combobox
                density="compact"  
                v-model="selectedFolders"
                :items="folders" 
                label="Folders"
                multiple
                variant="solo"
                hide-details
                >
                <template v-slot:selection="{ item, index }">
                    <span
                        v-if="index === 0"
                        class="text-grey text-caption align-self-center"
                    >
                        ({{ selectedFolders.length }} selected)
                    </span>
                    </template>
            </v-combobox>

            <span class="d-flex flex-wrap my-4">
                <v-chip 
                    class="mx-1 my-1"
                    color="secondary" 
                    variant="tonal"
                    prev-icon="mdi-folder" 
                    density="compact"
                    v-for="folder in selectedFolders" 
                    :key="folder" 
                    :value="folder"
                    closable 
                    @click:close="selectedFolders = selectedFolders.filter(f => f !== folder)">
                        {{ folder }}
                </v-chip>
            </span>


            <div v-if="newUserSetup" class="d-flex justify-end">
                <v-btn class="mx-1" density="compact" @click="reset()">reset</v-btn>
            </div>

            <div v-else class="d-flex justify-end">
                <v-btn class="mx-1" density="compact" @click="reset()">reset</v-btn>
                <v-btn class="mx-1" density="compact" v-if="isNewProject" type="submit" color="primary">Initalize</v-btn>
                <v-btn class="mx-1" density="compact" v-if="!isNewProject" type="submit" color="primary">Update</v-btn>
                <v-menu>
                    <template v-slot:activator="{ props }">
                        <v-btn v-bind="props" class="mx-1" density="compact" >
                            <v-icon density="compact">mdi-dots-vertical</v-icon>
                        </v-btn>
                    </template>
                    <v-list>
                        <v-list-item>
                            <v-list-item-title color="warning">Archive</v-list-item-title>
                            <v-list-item-title color="error">Delete</v-list-item-title>
                        </v-list-item>
                    </v-list>
                </v-menu>


           </div>

            <div>
                <UserManagement 
                    v-if="!newUserSetup && $store.isProjectAdmin"
                    :project-id="$store.project?.id || ''"
                    :users="users"
                    @users-updated="handleUsersUpdated"
                />
            </div>


        </v-form>





    </v-container>

</template>

<script>
import { Project} from '../../services/firebaseDataService';
import UserManagement from './UserManagement.vue';

export default {
    components: {
        UserManagement
    },
    emits: ['update:project'],
    data() {
        return {
            isLoading: false,
            isNewProject: false,
            projectData: {
                name: '',
                description: '',
                users: [],
                folders: [],
                owner: ''
            },
            default: null,
            userEmails: '', 
            selectedFolders: [],
            folders: ['Product', 'Features', 'Personas', 'Notes', 'Decisions', 'User Interviews'], 
            users: []
        };
    },
    computed: {
    },
    props: {
        id: {
            type: String,
            required: false
        },
        newUserSetup: {
            type: Boolean,
            required: false,
            default: false
        }
    },
    watch: {
        selectedFolders: {
            handler(newVal) {
                this.projectData.folders = newVal.map(folder => ({ name: folder, children: [] }))
            },
            deep: true,
        },
        projectData: {
            handler(newVal) {
                this.$emit('update:project', JSON.parse(JSON.stringify(newVal)));
            },
            deep: true
        },
        '$route.params.id': {
            handler(newId, oldId) {
                // Handle route parameter changes (manual URL changes)
                if (newId && newId !== oldId && newId !== 'new') {
                    this.selectProject(newId);
                }
            },
            immediate: true
        },

    },
    async mounted() {
        // Wait for user auth to complete (similar to DocumentCreate.vue)
        let tries = 0
        while (this.$store.loading.user) {
            await new Promise(resolve => setTimeout(resolve, 100));
            tries++
            if (tries > 20) {
                this.$store.uiAlert({ 
                    type: 'error', 
                    message: 'Error loading project', 
                    autoClear: true 
                });
                return
            }
        }

        await this.$store.projectRefresh(true)

        if (this.$route.params.id) {
            await this.selectProject(this.$route.params.id)
            this.isNewProject = false
            return
        }

        this.isNewProject = this.$store.project === null
        
        if (!this.isNewProject) {
            this.projectData = { ...this.$store.project }
            this.selectedFolders = this.projectData.folders.map(folder => folder.name);
            
            // Update the URL to reflect the current project ID
            if (this.$store.project?.id) {
                this.$router.replace({ path: `/settings/project/${this.$store.project.id}` })
            }
        }

        // new user setup
        if(this.newUserSetup){
            this.projectData = {
                name: 'My Project',
                users: [this.$store.user.uid],
                folders: this.folders.map(folder => ({ name: folder })), /// setup with default folders
                owner: this.$store.user.uid
            }
            
            this.selectedFolders = [...this.folders];
            this.default = { ...this.projectData }
            this.users = [{ ...this.$store.user, role: 'admin' }]
            return
        }

        if (!this.isNewProject && this.$store.project?.id) {
            this.users = this.$store.project.users
        }

    },
    methods: {

        async selectProject(value){
            if (this.isLoading) return
            this.isLoading = true
            
            try {
                const result = await this.$store.projectSet(value, true)
                if (!result) return;
                
                // Now that project is loaded, set up the component data
                this.projectData = { ...this.$store.project }
                this.selectedFolders = this.projectData.folders.map(folder => folder.name);
                this.default = { ...this.projectData }
                
                // Load users for this project
                this.users = this.$store.project.users
                
                // Update the route to reflect the selected project
                if (this.$route.params.id !== this.$store.project.id) {
                    this.$router.push({ path: `/settings/project/${this.$store.project.id}` })
                }
            } catch (error) {
                console.error('Error in selectProject:', error);
                this.$store.uiAlert({ 
                    type: 'error', 
                    message: `Error loading project: ${error.message}`, 
                    autoClear: true 
                });
            }
            this.isLoading = false
        },

        setupNewProject(){
            this.$router.push({ path: `/settings/project/new` })
            console.log('setupNewProject')
            this.isNewProject = true

            this.projectData =  {
                name: 'New Project',
                users: [this.$store.user.uid],
                folders: [],
                owner: ''
            },

            this.selectedFolders = [...this.folders]
            this.users = [{ ...this.$store.user, role: 'admin' }]
        },

        setTempProject(){
            const projectCopy = JSON.parse(JSON.stringify(this.projectData));
        },

        async handleSubmit() { 
            if (this.isNewProject) {

                console.log('Creating new project:', this.projectData);

                const projectRef = await Project.create(newProjectData)
                this.$store.projectSet(projectRef.id , true)
                this.$router.push({ path: `/document/create-document`})
 
            } else {
                // Logic for joining an existing project
                console.log("we'll figure this out later");
                // ... Add your API call here ...
            }
        },
        reset(){
            console.log('reset')
            this.projectData = { ...this.default }
            this.selectedFolders = this.projectData.folders.map(folder => folder.name)
            //todo users
        },

        handleUsersUpdated() {
            // Refresh project data when users are updated from the UserManagement component
            this.$store.projectRefresh(true).then(() => {
                this.users = this.$store.project.users;
            });
        }
    }
}
</script>

<style scoped>

.h1 {
    font-size: 2rem;
    font-family: 'Roboto', sans-serif;
    font-weight: bold;
    background-color: inherit;
    color: rgba(var(--v-theme-on-background),1) !important;
    font-weight: 400;
}



</style>
