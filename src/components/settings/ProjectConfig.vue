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
                                        <v-btn density="compact" class="text-none" variant="tonal" color="secondary" v-bind="props">{{ user.role }}</v-btn>
                                    </template>
                                    <v-list>
                                        <v-list-item @click="changeUserRole(user.id, 'admin')" :disabled="user.role === 'admin'">
                                            <v-list-item-title>Admin</v-list-item-title>
                                        </v-list-item>
                                        <v-list-item @click="changeUserRole(user.id, 'user')" :disabled="user.role === 'user'">
                                            <v-list-item-title>User</v-list-item-title>
                                        </v-list-item>
                                    </v-list>
                                </v-menu>
                                <v-btn density="compact" class="text-none" color="warning" variant="text" v-if="!user.pending" @click="confirmRemoveUser(user)">Remove</v-btn>
                            </span>
                    </td>
                    </tr>
                </tbody>
            </v-table>

            <!-- Pending Invitations Section -->
            <div v-if="pendingInvitations.length > 0" class="mt-4">
                <h3>Pending Invitations</h3>
                <v-table density="compact">
                    <thead>
                        <tr>
                            <th class="text-left">Email</th>
                            <th class="text-left">Role</th>
                            <th class="text-left">Sent</th>
                            <th class="text-left">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="invite in pendingInvitations" :key="invite.id">
                            <td>{{ invite.email }}</td>
                            <td>{{ invite.role }}</td>
                            <td>{{ formatDate(invite.createdDate) }}</td>
                            <td>
                                <v-btn 
                                    density="compact" 
                                    class="text-none mr-2" 
                                    color="primary" 
                                    variant="text" 
                                    @click="showExistingInvitationLink(invite)"
                                    prepend-icon="mdi-link"
                                >
                                    Link
                                </v-btn>
                                <v-btn 
                                    density="compact" 
                                    class="text-none" 
                                    color="error" 
                                    variant="text" 
                                    @click="cancelInvitation(invite.id)"
                                >
                                    Cancel
                                </v-btn>
                            </td>
                        </tr>
                    </tbody>
                </v-table>
            </div>

            <v-text-field 
                v-model="newUserEmail" 
                label="Invite new users" 
                required 
                variant="solo"
                :disabled="!isCurrentUserAdmin"
                :error-messages="inviteError"
                @keyup.enter="sendInvitation"
            >
                <template v-slot:append>
                    <v-btn @click="sendInvitation" icon="mdi-email" :disabled="!newUserEmail || !isCurrentUserAdmin"></v-btn> 
                </template>
            </v-text-field>

            <v-select
                v-model="newUserRole"
                :items="['user', 'admin']"
                label="Role for new user"
                variant="solo"
                density="compact"
                class="mt-2"
                :disabled="!isCurrentUserAdmin"
            ></v-select>

            </div>


        </v-form>

        <!-- Confirmation Dialog -->
        <v-dialog v-model="confirmDialog.show" max-width="400">
            <v-card>
                <v-card-title>{{ confirmDialog.title }}</v-card-title>
                <v-card-text>{{ confirmDialog.message }}</v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn @click="confirmDialog.show = false">Cancel</v-btn>
                    <v-btn color="error" @click="confirmDialog.action">Confirm</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Invitation Link Dialog -->
        <v-dialog v-model="invitationDialog.show" max-width="600">
            <v-card>
                <v-card-title class="text-h5">
                    <v-icon left>mdi-email-outline</v-icon>
                    Invitation Link Created
                </v-card-title>
                
                <v-card-text>
                    <div class="mb-4">
                        <p><strong>Email:</strong> {{ invitationDialog.email }}</p>
                        <p><strong>Role:</strong> {{ invitationDialog.role }}</p>
                    </div>
                    
                    <v-alert type="info" class="mb-4">
                        <strong>Important:</strong> The recipient must sign up with the exact email address 
                        <strong>{{ invitationDialog.email }}</strong> for the invitation to work.
                    </v-alert>
                    
                    <v-text-field
                        v-model="invitationDialog.link"
                        label="Invitation Link"
                        readonly
                        append-icon="mdi-content-copy"
                        @click:append="copyInvitationLink"
                        variant="outlined"
                    ></v-text-field>
                </v-card-text>
                
                <v-card-actions>
                    <v-btn @click="invitationDialog.show = false">Close</v-btn>
                    <v-spacer></v-spacer>
                    <v-btn 
                        @click="copyInvitationLink" 
                        color="primary"
                        variant="tonal"
                        :prepend-icon="invitationDialog.copied ? 'mdi-check' : 'mdi-content-copy'"
                    >
                        {{ invitationDialog.copied ? 'Copied!' : 'Copy Link' }}
                    </v-btn>
                    <v-btn 
                        @click="shareViaEmail(invitationDialog)" 
                        color="primary"
                        prepend-icon="mdi-email"
                    >
                        Share via Email
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>



    </v-container>

</template>

<script>
import { Project, User } from '../../services/firebaseDataService';

export default {
    emits: ['update:project'],
    data() {
        return {
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
            newUserEmail: '',
            newUserRole: 'user',
            users: [],
            pendingInvitations: [],
            inviteError: '',
            confirmDialog: {
                show: false,
                title: '',
                message: '',
                action: null
            },
            invitationDialog: {
                show: false,
                email: '',
                role: '',
                link: '',
                copied: false
            },
            refreshInterval: null
        };
    },
    beforeUnmount() {
        // Clean up the refresh interval
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    },
    computed: {
        isCurrentUserAdmin() {
            const currentUser = this.users.find(u => u.id === this.$store.state.user.uid);
            const isAdmin = currentUser?.role === 'admin';
            
            // Also check if user is the project creator
            const isCreator = this.$store.state.project?.createdBy === this.$store.state.user.uid;
            
            return isAdmin || isCreator;
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
        // Watch for changes in project users (to refresh invitations when someone accepts)
        'users.length': {
            handler() {
                if (this.isCurrentUserAdmin && this.$store.state.project?.id) {
                    this.loadPendingInvitations();
                }
            }
        }
    },
    async mounted() {
        // Wait for user auth to complete (similar to DocumentCreate.vue)
        while (this.$store.state.loadingUser) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (this.$route.params.id) {
            await this.selectProject(this.$route.params.id)
            this.isNewProject = false
            return
        }

        this.isNewProject = this.$store.state.project === null
        
        if (!this.isNewProject) {
            this.projectData = { ...this.$store.state.project }
            this.selectedFolders = this.projectData.folders.map(folder => folder.name);
            
            // Update the URL to reflect the current project ID
            if (this.$store.state.project?.id) {
                this.$router.replace({ path: `/settings/project/${this.$store.state.project.id}` })
            }
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

        if (!this.isNewProject && this.$store.state.project?.id) {
            this.users = await Project.getUsersForProject(this.$store.state.project.id, true);
            await this.loadPendingInvitations();
            
            // Set up periodic refresh to catch when invitations are accepted
            this.setupPeriodicRefresh();
        }

    },
    methods: {

        sendEmails(){
            console.log('sendEmails')
        },

        async selectProject(value){
            try {
                // Use commit for the store mutation (even though it's async)
                await this.$store.commit('setProject', value)
                
                // Now that project is loaded, set up the component data
                this.projectData = { ...this.$store.state.project }
                this.selectedFolders = this.projectData.folders.map(folder => folder.name);
                this.default = { ...this.projectData }
                
                // Load users for this project FIRST
                this.users = await Project.getUsersForProject(this.$store.state.project.id, true)
                
                // Then load invitations (which requires admin permissions)
                await this.loadPendingInvitations();
                
                // Set up periodic refresh
                this.setupPeriodicRefresh();
                
                // Update the route to reflect the selected project
                if (this.$route.params.id !== this.$store.state.project.id) {
                    this.$router.push({ path: `/settings/project/${this.$store.state.project.id}` })
                }
            } catch (error) {
                console.error('Error in selectProject:', error);
                this.$store.commit('alert', { 
                    type: 'error', 
                    message: `Error loading project: ${error.message}`, 
                    autoClear: true 
                });
            }
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
        },

        async sendInvitation() {
            if (!this.newUserEmail || !this.isCurrentUserAdmin) return;

            try {
                this.inviteError = '';
                
                // First check if user already exists
                const existingUser = await User.getUserByEmail(this.newUserEmail);
                
                if (existingUser) {
                    // User exists, add them directly to the project
                    await Project.addUserToProject(existingUser.id, this.$store.state.project.id, this.newUserRole);
                    
                    this.$store.commit('alert', { 
                        type: 'success', 
                        message: `${this.newUserEmail} has been added to the project!`, 
                        autoClear: true 
                    });
                    
                    // Refresh user list
                    await this.refreshUserList();
                } else {
                    // User doesn't exist, create invitation
                    const invitation = await User.inviteUserToProject(
                        this.newUserEmail, 
                        this.$store.state.project.id, 
                        this.newUserRole
                    );
                    
                    // Show the invitation link dialog
                    this.showInvitationDialog(invitation);
                    
                    await this.loadPendingInvitations(); // Refresh invitations
                }
                
                this.newUserEmail = '';
                this.newUserRole = 'user';
                
            } catch (error) {
                this.inviteError = error.message;
                console.error('Error sending invitation:', error);
            }
        },

        showInvitationDialog(invitation) {
            this.invitationDialog = {
                show: true,
                email: invitation.email,
                role: invitation.role,
                link: invitation.inviteLink,
                copied: false
            };
        },

        showExistingInvitationLink(invite) {
            // Reconstruct the invitation link from the stored token
            const inviteLink = `${window.location.origin}/invite/${invite.inviteToken}`;
            
            this.invitationDialog = {
                show: true,
                email: invite.email,
                role: invite.role,
                link: inviteLink,
                copied: false
            };
        },

        copyInvitationLink() {
            navigator.clipboard.writeText(this.invitationDialog.link).then(() => {
                this.invitationDialog.copied = true;
                this.$store.commit('alert', { 
                    type: 'success', 
                    message: 'Link copied to clipboard!', 
                    autoClear: true 
                });
                
                // Reset copied status after 3 seconds
                setTimeout(() => {
                    if (this.invitationDialog) {
                        this.invitationDialog.copied = false;
                    }
                }, 3000);
            }).catch(() => {
                this.$store.commit('alert', { 
                    type: 'error', 
                    message: 'Failed to copy link', 
                    autoClear: true 
                });
            });
        },

        shareViaEmail(invitation) {
            const subject = encodeURIComponent(`You're invited to join our project`);
            const body = encodeURIComponent(`Hi!

You've been invited to join our project with ${invitation.role} access.

Please sign up using the email address: ${invitation.email}

Click this link to join: ${invitation.link}

Important: You must sign up with the exact email address (${invitation.email}) for the invitation to work.

Thanks!`);
            
            const mailtoUrl = `mailto:${invitation.email}?subject=${subject}&body=${body}`;
            window.open(mailtoUrl);
        },

        async changeUserRole(userId, newRole) {
            try {
                await Project.updateUserRole(userId, this.$store.state.project.id, newRole);
                await this.refreshUserList();
            } catch (error) {
                this.$store.commit('alert', { 
                    type: 'error', 
                    message: error.message, 
                    autoClear: true 
                });
            }
        },

        confirmRemoveUser(user) {
            this.confirmDialog = {
                show: true,
                title: 'Remove User',
                message: `Are you sure you want to remove ${user.displayName || user.email} from this project?`,
                action: () => this.removeUser(user.id)
            };
        },

        async removeUser(userId) {
            try {
                await Project.removeUserFromProject(userId, this.$store.state.project.id);
                await this.refreshUserList();
                this.confirmDialog.show = false;
            } catch (error) {
                this.$store.commit('alert', { 
                    type: 'error', 
                    message: error.message, 
                    autoClear: true 
                });
            }
        },

        async loadPendingInvitations() {
            try {
                // Only try to load invitations if user is admin
                if (this.isCurrentUserAdmin) {
                    this.pendingInvitations = await Project.getProjectInvitations(this.$store.state.project.id);
                } else {
                    // If not admin, just set empty array
                    this.pendingInvitations = [];
                }
            } catch (error) {
                console.error('Error loading invitations:', error);
                // Don't show error alert for permission issues, just log it
                if (!error.message.includes('Only project admins')) {
                    this.$store.commit('alert', { 
                        type: 'error', 
                        message: `Error loading invitations: ${error.message}`, 
                        autoClear: true 
                    });
                }
                this.pendingInvitations = [];
            }
        },

        async cancelInvitation(inviteId) {
            try {
                await User.cancelInvitation(inviteId);
                await this.loadPendingInvitations();
            } catch (error) {
                this.$store.commit('alert', { 
                    type: 'error', 
                    message: error.message, 
                    autoClear: true 
                });
            }
        },

        async refreshUserList() {
            if (this.$store.state.project?.id) {
                this.users = await Project.getUsersForProject(this.$store.state.project.id, true);
            }
        },

        setupPeriodicRefresh() {
            // Clear existing interval if any
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
            }
            
            // Refresh user list and invitations every 10 seconds to catch accepted invitations
            this.refreshInterval = setInterval(async () => {
                if (this.$store.state.project?.id && this.isCurrentUserAdmin) {
                    await this.refreshUserList();
                    await this.loadPendingInvitations();
                }
            }, 10000);
        },

        formatDate(timestamp) {
            if (!timestamp) return '';
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return date.toLocaleDateString();
        },
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
