<template>
    <v-container :class="{'px-20': !newUserSetup}" class="overflow-none w-100 pb-0">
        <div v-if="!newUserSetup">
            <v-select
                density="compact"
                v-model="projectData.name"
                :items="this.$store.state.projects"
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
                    class="mx-1"
                    color="secondary" 
                    variant="elevated"
                    prev-icon="mdi-folder" 
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
                <v-btn :disabled="projectData.id === $store.state.user.defaultProject" class="mx-1" density="compact" v-if="!isNewProject" type="submit" color="warning">Archive</v-btn>
                <v-btn :disabled="projectData.id === $store.state.user.defaultProject" class="mx-1" density="compact" v-if="!isNewProject" type="submit" color="error">Delete</v-btn>
            </div>

            <div>
                <hr class="my-5">
                <h2 class="my-2">Manage Users</h2>

                <v-table fixed-header density="compact" v-if="users.length > 0">
                <thead>
                    <tr>
                        <th class="text-left">Display Name</th>
                        <th class="text-left">Email</th>
                        <th class="text-left">Role</th>
                        <th class="text-left">Action</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="user in users" :key="user.id">
                        <td>{{ user.displayName }}</td>
                        <td>{{ user.email }}</td>
                        <td>{{ user.role }}</td>
                        <td>
                            <span v-if="user.pending">
                                <v-btn density="compact" class="text-none"  @click="removeUser(user.id)" color="primary">Approve</v-btn>
                                <v-btn density="compact" class="text-none" @click="removeUser(user.id)" color="error">Reject</v-btn>
                            </span>
                            <span v-else-if="user.id !== $store.state.user.uid" density="compact">
                                <v-menu>
                                    <template v-slot:activator="{ props }">
                                        <v-btn density="compact" class="text-none" variant="tonal" color="secondary" v-bind="props">Select Role</v-btn>
                                    </template>
                                    <v-list>
                                        <v-list-item>
                                            <v-list-item-title>Admin</v-list-item-title>
                                        </v-list-item>
                                        <v-list-item>
                                            <v-list-item-title>User</v-list-item-title>
                                        </v-list-item>
                                    </v-list>
                                </v-menu>
                                <v-btn density="compact" class="text-none" color="warning" variant="text" v-if="!user.pending" @click="removeUser(user.id)">Remove</v-btn>
                            </span>
                    </td>
                    </tr>
                </tbody>
            </v-table>

            <v-text-field disabled v-model="newUserEmail" label="Invite new users" required variant="solo">
                    <template v-slot:append>
                        <v-btn @click="sendEmails" icon="mdi-email"></v-btn> 
                    </template>
            </v-text-field>

            </div>


        </v-form>
    </v-container>

</template>

<script>
import { Project } from '../../services/firebaseDataService';

export default {
    emits: ['update:project'],
    data() {
        return {
            isNewProject: false, // Toggle state
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
            newUserEmail: '',
            users: [],
        };
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
    },
    async mounted() {

        if (this.$route.params.id) {
            this.selectProject(this.$route.params.id)
            this.isNewProject = false
            return
        }

        this.isNewProject = this.$store.state.project === null
        
        if (!this.isNewProject) {
            this.projectData = { ...this.$store.state.project }
            this.selectedFolders = this.projectData.folders.map(folder => folder.name);
        }

        // new user setup
        if(this.newUserSetup){
            this.projectData = {
                name: 'My Project',
                users: [this.$store.state.user.uid],
                folders: this.folders.map(folder => ({ name: folder })), /// setup with default folders
                owner: this.$store.state.user.uid
            }
            
            this.selectedFolders = [...this.folders];
            this.default = { ...this.projectData }
            this.users = [{ ...this.$store.state.user, role: 'admin' }]
            return
        }

        this.users = await Project.getUsersForProject(this.$store.state.project.id, true)
        this.$router.push({ path: `/settings/project/${this.$store.state.project.id}` })

    },
    methods: {

        sendEmails(){
            console.log('sendEmails')
        },

        async selectProject(value){
            console.log('selectProject', value)
            this.$store.commit('setProject', value)
            this.projectData = { ...this.$store.state.project }
            this.selectedFolders = this.projectData.folders.map(folder => folder.name);
            this.default = { ...this.projectData }
            this.users = await Project.getUsersForProject(this.$store.state.project.id, true)
            this.$router.push({ path: `/settings/project/${this.$store.state.project.id}` })
        },

        setupNewProject(){
            this.$router.push({ path: `/settings/project/new` })
            console.log('setupNewProject')
            this.isNewProject = true

            this.projectData =  {
                name: 'New Project',
                users: [this.$store.state.user.uid],
                folders: [],
                owner: ''
            },

            this.selectedFolders = [...this.folders]
            this.users = [{ ...this.$store.state.user, role: 'admin' }]
        },

        setTempProject(){
            const projectCopy = JSON.parse(JSON.stringify(this.projectData));
           // this.$store.commit('setTempProject', projectCopy)
        },

        async handleSubmit() { 
            if (this.isNewProject) {

                console.log('Creating new project:', this.projectData);

                const projectRef = await Project.create(newProjectData)
                this.$store.commit('setProject', projectRef.id )
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
