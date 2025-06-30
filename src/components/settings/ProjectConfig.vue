<template>
    <v-container :class="{'px-20': !newUserSetup}" class="overflow-none w-100 pb-0">
        <div v-if="!newUserSetup">
            <v-select
                v-if="!isNewProject"
                density="compact"
                v-model="projectData.name"
                :items="allProjectsForDropdown"
                item-title="name"
                item-value="id"
                object
                label="Project"
                variant="solo"
                hide-details
                @update:modelValue="selectProject"
                >
                <template v-slot:append>
                    <v-btn 
                        :disabled="!$store.isProjectAdmin || !$store.canCreateProject.allowed" 
                        @click="handleNewProject" 
                        class="float-right"
                    > 
                        new project
                    </v-btn>
                </template>
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
                :readonly="$store.isProjectReadOnly"
                ref="projectNameInput"
                :class="{ 'new-project-highlight': isNewProject && !projectData.name }"
                placeholder="Enter your project name..."
            ></v-text-field>

            <v-combobox
                density="compact"  
                v-model="selectedFolders"
                :items="folders" 
                label="Folders"
                multiple
                variant="solo"
                hide-details
                :readonly="$store.isProjectReadOnly"
                ref="folderCombobox"
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
                    :disabled="$store.isProjectReadOnly"
                    @click:close="selectedFolders = selectedFolders.filter(f => f !== folder)">
                        {{ folder }}
                </v-chip>
            </span>

            <div v-if="newUserSetup" class="d-flex justify-end">
                <v-btn class="mx-1" density="compact" @click="reset()">reset</v-btn>
            </div>

            <!-- Project Limit Warning -->
            <v-alert 
                v-if="!$store.canCreateProject.allowed && !newUserSetup"
                type="warning" 
                class="mt-4"
                density="compact"
            >
                <div class="d-flex justify-space-between align-center">
                    <div>
                        <strong>Project Limit Reached</strong><br>
                        {{ $store.canCreateProject.reason }}
                    </div>
                    <v-btn 
                        color="primary" 
                        variant="outlined" 
                        size="small"
                        @click="$router.push('/settings/user')"
                    >
                        Upgrade to Pro
                    </v-btn>
                </div>
            </v-alert>

            <div v-else class="d-flex justify-end">
                <v-btn class="mx-1" density="compact" @click="reset()" :disabled="$store.isProjectReadOnly">reset</v-btn>
                <v-btn class="mx-1" density="compact" v-if="isNewProject" type="submit" color="primary">Initialize</v-btn>
                <v-btn class="mx-1" density="compact" v-if="!isNewProject && !$store.isProjectReadOnly" type="submit" color="primary">Update</v-btn>
                <v-btn class="mx-1" density="compact" v-if="$store.isProjectArchived && $store.isProjectAdmin" @click="confirmUnarchive" color="success">Restore Project</v-btn>
                
                <v-menu v-if="$store.isProjectAdmin && !isNewProject">
                    <template v-slot:activator="{ props }">
                        <v-btn v-bind="props" class="mx-1" density="compact">
                            <v-icon density="compact">mdi-dots-vertical</v-icon>
                        </v-btn>
                    </template>
                    <v-list>
                        <v-list-item v-if="!$store.isProjectArchived" @click="confirmArchive" prepend-icon="mdi-archive">
                            <v-list-item-title class="text-warning">Archive Project</v-list-item-title>
                        </v-list-item>
                        <v-list-item @click="confirmDelete" prepend-icon="mdi-trash-can">
                            <v-list-item-title class="text-error">Permanently Delete</v-list-item-title>
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

        <!-- Archive Confirmation Dialog -->
        <v-dialog v-model="archiveDialog.show" max-width="500">
            <v-card>
                <v-card-title class="text-warning">
                    <v-icon class="mr-2">mdi-archive</v-icon>
                    Archive Project
                </v-card-title>
                <v-card-text>
                    <p>Are you sure you want to archive "{{ projectData.name }}"?</p>
                    <v-alert type="info" class="mt-3">
                        <strong>This will:</strong>
                        <ul class="mt-2">
                            <li>Hide the project from the main project list</li>
                            <li>Make all documents and content read-only</li>
                            <li>Prevent new content creation</li>
                            <li>Allow restoration later if needed</li>
                        </ul>
                    </v-alert>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="archiveDialog.show = false">Cancel</v-btn>
                    <v-btn color="warning" :loading="archiveDialog.loading" @click="archiveProject">Archive Project</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Delete Confirmation Dialog -->
        <v-dialog v-model="deleteDialog.show" max-width="600">
            <v-card>
                <v-card-title class="text-error">
                    <v-icon class="mr-2">mdi-alert-circle</v-icon>
                    Permanently Delete Project
                </v-card-title>
                <v-card-text>
                    <v-alert type="error" class="mb-4">
                        <strong>⚠️ DANGER: This action cannot be undone!</strong>
                    </v-alert>
                    
                    <p>You are about to permanently delete "{{ projectData.name }}" and <strong>ALL</strong> associated data:</p>
                    
                    <ul class="mt-3 mb-4">
                        <li>All documents and their versions</li>
                        <li>All chat history</li>
                        <li>All comments and feedback</li>
                        <li>All user permissions and invitations</li>
                        <li>The project itself</li>
                    </ul>
                    
                    <p>Type <strong>"{{ projectData.name }}"</strong> below to confirm:</p>
                    <v-text-field
                        v-model="deleteDialog.confirmText"
                        variant="outlined"
                        density="compact"
                        :placeholder="`Type '${projectData.name}' to confirm`"
                        class="mt-2"
                    ></v-text-field>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="deleteDialog.show = false">Cancel</v-btn>
                    <v-btn 
                        color="error" 
                        :loading="deleteDialog.loading"
                        :disabled="deleteDialog.confirmText !== projectData.name"
                        @click="deleteProject"
                    >
                        Permanently Delete
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Tour Tooltip for Folders -->
        <v-tooltip
            v-model="showTourTooltip"
            activator=".v-combobox"
            location="top"
            :open-on-hover="false"
        >
            <div class="pa-2">
                <div class="text-subtitle-2 mb-1">💡 Pro Tip: Organize Your Content</div>
                <div class="text-body-2">
                    You can edit, add, or remove folders here to organize your documents!
                    <br>Just click and start typing.
                </div>
                <div class="text-right mt-2">
                    <v-btn size="small" color="primary" @click="closeTour">Got it!</v-btn>
                </div>
            </div>
        </v-tooltip>
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
            users: [],
            archiveDialog: {
                show: false,
                loading: false
            },
            deleteDialog: {
                show: false,
                loading: false,
                confirmText: ''
            },
            showTourTooltip: false,
            tourShown: false
        };
    },
    computed: {
        allProjectsForDropdown() {
            return this.$store.projects.map(project => ({
                id: project.id,
                name: project.archived ? `${project.name} (Archived)` : project.name,
                archived: project.archived
            }));
        }
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
                if (!this.$store.isProjectReadOnly) {
                    this.projectData.folders = newVal.map(folder => ({ name: folder, children: [] }))
                }
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

        // Show tour for new projects or first-time users
        this.checkShowTour();
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

        async setupNewProject(){
            this.$router.push({ path: `/settings/project/new` })
            this.isNewProject = true

            // Reset project state in store
            this.$store.project = {
                id: null,
                folders: [],
                name: null,
                createdBy: null,
                users: [],
                invitation: [],
                projectRole: null,
            }

            this.projectData =  {
                name: '',
                users: [this.$store.user.uid],
                folders: [],
                owner: this.$store.user.uid
            }

            this.selectedFolders = [...this.folders]
            this.users = [{ ...this.$store.user, role: 'admin' }]
            this.default = { ...this.projectData }
            
            // Focus the name input and highlight it
            this.$nextTick(() => {
                if (this.$refs.projectNameInput) {
                    this.$refs.projectNameInput.focus();
                }
            })
        },

        async handleSubmit() { 
            if (this.isNewProject) {
                // Validate project name
                if (!this.projectData.name.trim()) {
                    this.$store.uiAlert({
                        type: 'error',
                        message: 'Please enter a project name',
                        autoClear: true
                    });
                    return;
                }

                console.log('Creating new project:', this.projectData);

                try {
                    const createdProject = await this.$store.projectCreate(this.projectData);
                    if (createdProject) {
                        // Set as default project first
                        await this.$store.userSetDefaultProject(createdProject.id);
                        
                        // Refresh user data to ensure project membership is updated
                        await this.$store.userEnter();
                        
                        // Force set the project to the newly created one (in case userEnter changed it)
                        await this.$store.projectSet(createdProject.id, true);
                        
                        this.$router.push({ path: `/document/create-document`});
                    }
                } catch (error) {
                    console.error('Error creating project:', error);
                }
            } else {
                // Update existing project
                console.log('Updating project:', this.projectData);
                try {
                    const result = await Project.update(this.projectData.id, {
                        name: this.projectData.name,
                        folders: this.projectData.folders
                    });
                    
                    if (result.success) {
                        await this.$store.projectRefresh(true);
                        this.$store.uiAlert({
                            type: 'success',
                            message: 'Project updated successfully',
                            autoClear: true
                        });
                    } else {
                        this.$store.uiAlert({
                            type: 'error',
                            message: result.message || 'Failed to update project',
                            autoClear: true
                        });
                    }
                } catch (error) {
                    console.error('Error updating project:', error);
                    this.$store.uiAlert({
                        type: 'error',
                        message: 'Failed to update project',
                        autoClear: true
                    });
                }
            }
        },

        reset(){
            console.log('reset')
            this.projectData = { ...this.default }
            this.selectedFolders = this.projectData.folders.map(folder => folder.name)
        },

        handleUsersUpdated() {
            // Refresh project data when users are updated from the UserManagement component
            this.$store.projectRefresh(true).then(() => {
                this.users = this.$store.project.users;
            });
        },

        confirmArchive() {
            this.archiveDialog.show = true;
        },

        confirmDelete() {
            this.deleteDialog.show = true;
            this.deleteDialog.confirmText = '';
        },

        confirmUnarchive() {
            this.$store.projectUnarchive(this.$store.project.id).then((success) => {
                if (success) {
                    // Refresh the project data
                    this.$store.projectRefresh(true);
                }
            });
        },

        async archiveProject() {
            this.archiveDialog.loading = true;
            try {
                const success = await this.$store.projectArchive(this.$store.project.id);
                if (success) {
                    this.archiveDialog.show = false;
                    // Refresh the project data to reflect archived status
                    await this.$store.projectRefresh(true);
                }
            } catch (error) {
                console.error('Error archiving project:', error);
            } finally {
                this.archiveDialog.loading = false;
            }
        },

        async deleteProject() {
            this.deleteDialog.loading = true;
            try {
                const success = await this.$store.projectDelete(this.$store.project.id);
                if (success) {
                    this.deleteDialog.show = false;
                    // Navigation will be handled by the store method
                }
            } catch (error) {
                console.error('Error deleting project:', error);
            } finally {
                this.deleteDialog.loading = false;
            }
        },

        checkShowTour() {
            // Show tour if user is new or hasn't seen it before
            const tourShown = localStorage.getItem('project-config-tour-shown');
            if (!tourShown && !this.newUserSetup) {
                setTimeout(() => {
                    this.showTourTooltip = true;
                }, 1000);
            }
        },

        closeTour() {
            this.showTourTooltip = false;
            localStorage.setItem('project-config-tour-shown', 'true');
        },

        handleNewProject() {
            if (!this.$store.canCreateProject.allowed) {
                this.$store.uiAlert({
                    type: 'warning',
                    message: this.$store.canCreateProject.reason,
                    autoClear: true
                });
                return;
            }
            this.setupNewProject();
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

.new-project-highlight .v-input__control {
    animation: pulse-border 2s ease-in-out infinite;
}

@keyframes pulse-border {
    0% {
        box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.4);
    }
    50% {
        box-shadow: 0 0 0 4px rgba(var(--v-theme-primary), 0.6);
    }
    100% {
        box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.4);
    }
}
</style>
