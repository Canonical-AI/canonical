<template>
    <div class="surface mb-48">

        <v-divider class="my-2 border-opacity-0"></v-divider>

        <v-sheet class="pa-2" color="surface-variant" rounded>
        <div class="d-flex justify-space-between align-center my-2">
            <h2>Manage Users</h2>
            <v-btn 
                color="primary" 
                prepend-icon="mdi-account-plus"
                @click="openInviteDialog"
                :disabled="!isCurrentUserAdmin"
            >
                Invite User
            </v-btn>
        </div>

        <!-- User Search -->
        <v-text-field
            v-if="users.length > 0"
            v-model="userSearchQuery"
            label="Search users..."
            prepend-inner-icon="mdi-magnify"
            variant="solo"
            density="compact"
            clearable
            class="mb-4"
            hide-details
        ></v-text-field>

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
                <tr v-for="user in filteredAndSortedUsers" :key="user.id" :class="{ 'user-removed': user?.status === 'removed' }">
                    <td>{{ user.displayName }}</td>
                    <td>{{ user.email }}</td>
                    <td>{{ user?.status === 'removed'? 'removed': user.role }}</td>
                    <td>
                        <span v-if="user.pending">
                            <v-btn density="compact" class="text-none"  @click="removeUser(user.id)" color="primary">Approve</v-btn>
                            <v-btn density="compact" class="text-none" @click="removeUser(user.id)" color="error">Reject</v-btn>
                        </span>
                        <span v-else-if="user?.status === 'removed'">
                            <v-btn density="compact" class="text-none" color="success" variant="text" @click="confirmReinstateUser(user)">Reinstate</v-btn>
                        </span>
                        <span v-else-if="user.id !== $store.user.uid" density="compact">
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
                            <v-btn density="compact" class="text-none" color="warning" variant="text" v-if="!user.pending && user?.status !== 'removed'" @click="confirmRemoveUser(user)">Remove</v-btn>
                        </span>
                    </td>
                </tr>
            </tbody>
        </v-table>
        </v-sheet>

        <v-divider class="my-2 border-opacity-0"></v-divider>

        <!-- No users found message -->
        <v-alert 
            v-if="users.length > 0 && filteredAndSortedUsers.length === 0" 
            type="info" 
            variant="tonal" 
            class="my-4"
        >
            No users found matching "{{ userSearchQuery }}"
        </v-alert>

        <!-- Invitations Section -->
        <v-sheet class="pa-2" color="surface-variant" rounded>
        <div v-if="filteredInvitations.length > 0 || completeInvitationsCount > 0" class="mt-4">
            <div class="d-flex justify-space-between align-center mb-3">
                <h3>Project Invitations</h3>
                <v-btn 
                    v-if="completeInvitationsCount > 0"
                    @click="showCompleteInvitations = !showCompleteInvitations"
                    variant="text"
                    size="small"
                    :prepend-icon="showCompleteInvitations ? 'mdi-eye-off' : 'mdi-eye'"
                >
                    {{ showCompleteInvitations ? 'Hide' : 'Show' }} Complete ({{ completeInvitationsCount }})
                </v-btn>
            </div>
            <v-table density="compact">
                <thead>
                    <tr>
                        <th class="text-left">Email</th>
                        <th class="text-left">Role</th>
                        <th class="text-left">Status</th>
                        <th class="text-left">Created</th>
                        <th class="text-left">Expires</th>
                        <th class="text-left">Action</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="invite in filteredInvitations" :key="invite.id" :class="{ 'invitation-complete': ['cancelled', 'accepted'].includes(invite?.status) }">
                        <td>{{ invite.email }}</td>
                        <td>{{ invite.role }}</td>
                        <td>
                            <v-chip 
                                :color="getInvitationStatusColor(invite?.status)" 
                                variant="tonal" 
                                size="small"
                            >
                                {{ getInvitationStatusText(invite?.status) }}
                            </v-chip>
                        </td>
                        <td>{{ formatDate(invite.createdDate) }}</td>
                        <td>{{ invite.expiresAt.toDate().toLocaleDateString() }}</td>
                        <td>
                            <span v-if="['cancelled', 'accepted'].includes(invite?.status)" class="text-disabled">
                                {{ invite?.status === 'cancelled' ? 'Cancelled' : 'Accepted' }}
                            </span>
                            <span v-else>
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
                            </span>
                        </td>
                    </tr>
                </tbody>
            </v-table>

            <!-- Show message when no visible invitations but complete ones exist -->
            <v-alert 
                v-if="filteredInvitations.length === 0 && completeInvitationsCount > 0" 
                type="info" 
                variant="tonal" 
                class="mt-4"
            >
                No active invitations. {{ completeInvitationsCount }} complete invitation{{ completeInvitationsCount !== 1 ? 's' : '' }} hidden.
            </v-alert>
        </div>
        </v-sheet>

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
                        :value="fullInvitationUrl"
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

        <!-- Invite User Stepper Dialog -->
        <v-dialog v-model="inviteUserDialog.show" max-width="600" persistent>
            <v-card>
                <v-card-title class="text-h5 pa-6">
                    <v-icon left>mdi-account-plus</v-icon>
                    Invite User to Project
                </v-card-title>
                
                <v-card-text class="pa-6">
                    <v-stepper v-model="inviteUserDialog.step" >
                        <v-stepper-header>
                            <v-stepper-item
                                :complete="inviteUserDialog.step > 1"
                                :value="1"
                                title="User Details"
                                density="compact"
                            ></v-stepper-item>
                            
                            <v-stepper-item
                                :complete="inviteUserDialog.step > 2"
                                :value="2"
                                :title="inviteUserDialog.existingUser ? 'User Added' : 'Share Invitation'"
                                density="compact"
                            ></v-stepper-item>
                        </v-stepper-header>

                        <v-stepper-window>
                            <!-- Step 1: User Details -->
                            <v-stepper-window-item :value="1">
                                <div class="pa-4">
                                    <v-text-field
                                        v-model="inviteUserDialog.email"
                                        label="Email Address"
                                        type="email"
                                        variant="outlined"
                                        :error-messages="emailValidationErrors"
                                        prepend-inner-icon="mdi-email"
                                        @keyup.enter="canCreateInvitation ? sendInvitationFromModal() : null"
                                        required
                                        :success="inviteUserDialog.email && isValidEmail && !emailExistsInProject"
                                        :success-messages="inviteUserDialog.email && isValidEmail && !emailExistsInProject ? ['Email is valid and available'] : []"
                                    ></v-text-field>

                                    <v-select
                                        v-model="inviteUserDialog.role"
                                        :items="[
                                            { title: 'User', value: 'user' },
                                            { title: 'Admin', value: 'admin' }
                                        ]"
                                        label="Role"
                                        variant="outlined"
                                        prepend-inner-icon="mdi-account-cog"
                                    ></v-select>

                                    <div class="d-flex justify-end mt-4">
                                        <v-btn 
                                            @click="closeInviteDialog"
                                            variant="text"
                                            class="mr-2"
                                        >
                                            Cancel
                                        </v-btn>
                                        <v-btn 
                                            @click="sendInvitationFromModal"
                                            color="primary"
                                            :loading="inviteUserDialog.loading"
                                            :disabled="!canCreateInvitation"
                                        >
                                            Create Invitation
                                        </v-btn>
                                    </div>
                                </div>
                            </v-stepper-window-item>

                            <!-- Step 2: Share Invitation or User Added -->
                            <v-stepper-window-item :value="2">
                                <div class="pa-4">
                                    <!-- Existing User Added -->
                                    <div v-if="inviteUserDialog.existingUser">
                                        <v-alert type="success" class="mb-4">
                                            <strong>User Added!</strong> {{ inviteUserDialog.existingUser.displayName || inviteUserDialog.existingUser.email }} has been added to your project.
                                        </v-alert>

                                        <div class="mb-4">
                                            <p><strong>Name:</strong> {{ inviteUserDialog.existingUser.displayName || 'Not set' }}</p>
                                            <p><strong>Email:</strong> {{ inviteUserDialog.existingUser.email }}</p>
                                            <p><strong>Role:</strong> {{ inviteUserDialog.role }}</p>
                                        </div>
                                        
                                        <v-alert type="info" class="mb-4">
                                            This user already had an account and has been directly added to the project. No invitation was needed.
                                        </v-alert>

                                        <div class="d-flex justify-end mt-4">
                                            <v-btn @click="closeInviteDialog" color="primary">
                                                Done
                                            </v-btn>
                                        </div>
                                    </div>

                                    <!-- New Invitation Created -->
                                    <div v-else>
                                        <v-text-field
                                            :value="inviteUserDialog.createdInvitation ? `${currentOrigin}/invite/${inviteUserDialog.createdInvitation.inviteToken}` : ''"
                                            label="Invitation Link"
                                            readonly
                                            variant="outlined"
                                            append-inner-icon="mdi-content-copy"
                                            @click:append-inner="copyInvitationLinkFromModal"
                                        ></v-text-field>

                                        <div class="mb-4">
                                            <p><strong>Email:</strong> {{ inviteUserDialog.createdInvitation?.email }}</p>
                                            <p><strong>Role:</strong> {{ inviteUserDialog.createdInvitation?.role }}</p>
                                        </div>
                                        
                                        <v-alert type="info" class="mb-4">
                                            <strong>Important:</strong> The recipient must sign up with the exact email address 
                                            <strong>{{ inviteUserDialog.createdInvitation?.email }}</strong> for the invitation to work.
                                        </v-alert>

                                        <div class="d-flex justify-space-between mt-4">
                                            <div>
                                                <v-btn 
                                                    @click="closeInviteDialog"
                                                    variant="text"
                                                    class="mr-2"
                                                >
                                                    Close
                                                </v-btn>
                                                <v-btn 
                                                    @click="copyInvitationLinkFromModal"
                                                    color="primary"
                                                    variant="tonal"
                                                    :prepend-icon="inviteUserDialog.copied ? 'mdi-check' : 'mdi-content-copy'"
                                                    class="mr-2"
                                                >
                                                    {{ inviteUserDialog.copied ? 'Copied!' : 'Copy Link' }}
                                                </v-btn>
                                                <v-btn 
                                                    @click="shareViaEmailFromModal"
                                                    color="primary"
                                                    prepend-icon="mdi-email"
                                                >
                                                    Share via Email
                                                </v-btn>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </v-stepper-window-item>
                        </v-stepper-window>
                    </v-stepper>
                </v-card-text>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import { Project } from '../../services/firebaseDataService';

export default {
    name: 'UserManagement',
    props: {
        projectId: {
            type: String,
            required: true
        },
        users: {
            type: Array,
            default: () => []
        }
    },
    emits: ['users-updated'],
    data() {
        return {
            pendingInvitations: [],
            inviteError: '',
            userSearchQuery: '',
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
                token: '',
                copied: false
            },
            inviteUserDialog: {
                show: false,
                step: 1,
                email: '',
                role: 'user',
                loading: false,
                createdInvitation: null,
                existingUser: null,
                copied: false
            },
            refreshInterval: null,
            showCompleteInvitations: false
        };
    },
    computed: {
        isCurrentUserAdmin() {
            const currentUser = this.users.find(u => u.id === this.$store.user.uid);
            const isAdmin = currentUser?.role === 'admin';
            
            // Also check if user is the project creator
            const isCreator = this.$store.project?.createdBy === this.$store.user.uid;
            
            return isAdmin || isCreator;
        },
        fullInvitationUrl() {
            return this.invitationDialog.token ? `${this.currentOrigin}/invite/${this.invitationDialog.token}` : '';
        },
        filteredAndSortedUsers() {
            if (!this.users || this.users.length === 0) return [];
            
            // First filter by search query
            let filtered = this.users;
            if (this.userSearchQuery.trim()) {
                const query = this.userSearchQuery.toLowerCase().trim();
                filtered = this.users.filter(user => 
                    (user.displayName && user.displayName.toLowerCase().includes(query)) ||
                    (user.email && user.email.toLowerCase().includes(query))
                );
            }
            
            // Then sort: active users alphabetically first, then removed users alphabetically
            return filtered.sort((a, b) => {
                // First sort by status (active users first, removed users last)
                const aStatus = a?.status === 'removed' ? 1 : 0;
                const bStatus = b?.status === 'removed' ? 1 : 0;
                
                if (aStatus !== bStatus) {
                    return aStatus - bStatus;
                }
                
                // Within the same status group, sort alphabetically by display name
                const aName = (a.displayName || a.email || '').toLowerCase();
                const bName = (b.displayName || b.email || '').toLowerCase();
                
                return aName.localeCompare(bName);
            });
        },
        // Email validation computed properties
        isValidEmail() {
            if (!this.inviteUserDialog.email) return true; // Don't show error for empty field
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(this.inviteUserDialog.email);
        },
        emailExistsInProject() {
            if (!this.inviteUserDialog.email) return false;
            const email = this.inviteUserDialog.email.toLowerCase().trim();
            
            // Check existing users
            const existsInUsers = this.users && this.users.some(user => 
                user.email && user.email.toLowerCase() === email
            );
            
            // Check pending invitations
            const existsInInvitations = this.pendingInvitations && this.pendingInvitations.some(invite => 
                invite.email && invite.email.toLowerCase() === email
            );
            
            return existsInUsers || existsInInvitations;
        },
        emailValidationErrors() {
            const errors = [];
            
            if (this.inviteUserDialog.email && !this.isValidEmail) {
                errors.push('Please enter a valid email address');
            }
            
            if (this.inviteUserDialog.email && this.emailExistsInProject) {
                const email = this.inviteUserDialog.email.toLowerCase().trim();
                
                // Check if it's an existing user
                const existsInUsers = this.users && this.users.some(user => 
                    user.email && user.email.toLowerCase() === email
                );
                
                if (existsInUsers) {
                    errors.push('This email is already a member of the project');
                } else {
                    errors.push('This email already has a pending invitation');
                }
            }
            
            if (this.inviteError) {
                errors.push(this.inviteError);
            }
            
            return errors;
        },
        canCreateInvitation() {
            return this.inviteUserDialog.email && 
                   this.isValidEmail && 
                   !this.emailExistsInProject && 
                   this.isCurrentUserAdmin;
        },
        currentOrigin() {
            return typeof window !== 'undefined' ? window.location.origin : '';
        },
        filteredInvitations() {
            if (!this.pendingInvitations || this.pendingInvitations.length === 0) return [];
            
            if (this.showCompleteInvitations) {
                // Show all invitations
                return this.pendingInvitations;
            } else {
                // Only show pending invitations (hide cancelled and accepted ones)
                return this.pendingInvitations.filter(invite => !['cancelled', 'accepted'].includes(invite?.status));
            }
        },
        completeInvitationsCount() {
            if (!this.pendingInvitations || this.pendingInvitations.length === 0) return 0;
            return this.pendingInvitations.filter(invite => ['cancelled', 'accepted'].includes(invite?.status)).length;
        }
    },
    watch: {
        // Watch for changes in project users (to refresh invitations when someone accepts)
        'users.length': {
            handler() {
                if (this.isCurrentUserAdmin && this.projectId) {
                    this.loadPendingInvitations();
                }
            }
        }
    },
    async mounted() {
        if (this.isCurrentUserAdmin && this.projectId) {
            await this.loadPendingInvitations();
            this.setupPeriodicRefresh();
        }
    },
    beforeUnmount() {
        // Clean up the refresh interval
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    },
    methods: {
        showInvitationDialog(invitation) {
            this.invitationDialog = {
                show: true,
                email: invitation.email,
                role: invitation.role,
                token: invitation.inviteToken,
                copied: false
            };
        },

        showExistingInvitationLink(invite) {
            this.invitationDialog = {
                show: true,
                email: invite.email,
                role: invite.role,
                token: invite.inviteToken,
                copied: false
            };
        },

        copyInvitationLink() {
            navigator.clipboard.writeText(`${this.currentOrigin}/invite/${this.invitationDialog.token}`).then(() => {
                this.invitationDialog.copied = true;
                this.$store.uiAlert({ 
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
                this.$store.uiAlert({ 
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

Click this link to join: ${this.currentOrigin}/invite/${invitation.token}

Important: You must sign up with the exact email address (${invitation.email}) for the invitation to work.

Thanks!`);
            
            const mailtoUrl = `mailto:${invitation.email}?subject=${subject}&body=${body}`;
            window.open(mailtoUrl);
        },

        async changeUserRole(userId, newRole) {
            try {
                await Project.updateUserRole(userId, this.projectId, newRole);
                this.$emit('users-updated');
            } catch (error) {
                this.$store.uiAlert({ 
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

        confirmReinstateUser(user) {
            this.confirmDialog = {
                show: true,
                title: 'Reinstate User',
                message: `Are you sure you want to reinstate ${user.displayName || user.email} to this project?`,
                action: () => this.reinstateUser(user.id)
            };
        },

        async removeUser(userId) {
            await this.$store.projectRemoveUserFromProject({userId, projectId: this.projectId});
            this.confirmDialog.show = false;
            this.$emit('users-updated');
        },

        async reinstateUser(userId) {
            try {
                await this.$store.projectReinstateUser({userId, projectId: this.projectId});
                this.confirmDialog.show = false;
                this.$emit('users-updated');
            } catch (error) {
                this.$store.uiAlert({ 
                    type: 'error', 
                    message: `Error reinstating user: ${error.message}`, 
                    autoClear: true 
                });
                this.confirmDialog.show = false;
            }
        },

        async loadPendingInvitations() {
            try {
                // Only try to load invitations if user is admin
                if (this.isCurrentUserAdmin) {
                    this.pendingInvitations = await Project.getProjectInvitations(this.projectId);
                } else {
                    // If not admin, just set empty array
                    this.pendingInvitations = [];
                }
            } catch (error) {
                console.error('Error loading invitations:', error);
                // Don't show error alert for permission issues, just log it
                if (!error.message.includes('Only project admins')) {
                    this.$store.uiAlert({ 
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
                await this.$store.projectUpdateInvitation({
                    id: inviteId,
                    status: 'cancelled'
                });
                
                // Update local state immediately
                const inviteIndex = this.pendingInvitations.findIndex(invite => invite.id === inviteId);
                if (inviteIndex !== -1) {
                    this.pendingInvitations[inviteIndex] = {
                        ...this.pendingInvitations[inviteIndex],
                        status: 'cancelled'
                    };
                }
                
                // Also refresh from server to ensure consistency
                await this.loadPendingInvitations();
            } catch (error) {
                this.$store.uiAlert({ 
                    type: 'error', 
                    message: error.message, 
                    autoClear: true 
                });
            }
        },

        getInvitationStatusColor(status) {
            switch (status) {
                case 'cancelled':
                    return 'error';
                case 'accepted':
                    return 'success';
                case 'pending':
                default:
                    return 'warning';
            }
        },

        getInvitationStatusText(status) {
            switch (status) {
                case 'cancelled':
                    return 'Cancelled';
                case 'accepted':
                    return 'Accepted';
                case 'pending':
                default:
                    return 'Pending';
            }
        },

        setupPeriodicRefresh() {
            // Clear existing interval if any
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
            }
            
            // Refresh user list and invitations every 10 seconds to catch accepted invitations
            this.refreshInterval = setInterval(async () => {
                if (this.projectId && this.isCurrentUserAdmin) {
                    await this.loadPendingInvitations();
                }
            }, 10000);
        },

        formatDate(timestamp) {
            if (!timestamp) return '';
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return date.toLocaleDateString();
        },

        // New invite user modal methods
        openInviteDialog() {
            // Reset dialog state before opening
            this.inviteUserDialog.step = 1;
            this.inviteUserDialog.email = '';
            this.inviteUserDialog.role = 'user';
            this.inviteUserDialog.createdInvitation = null;
            this.inviteUserDialog.copied = false;
            this.inviteError = '';
            this.inviteUserDialog.show = true;
        },

        async sendInvitationFromModal() {
            if (!this.inviteUserDialog.email || !this.isCurrentUserAdmin) return;

            this.inviteUserDialog.loading = true;
            this.inviteError = '';

            try {
                const result = await this.$store.projectCreateInvitation({
                    projectId: this.projectId,
                    email: this.inviteUserDialog.email,
                    role: this.inviteUserDialog.role
                });
                
                if (result.success) {
                    this.inviteUserDialog.createdInvitation = result;
                    this.inviteUserDialog.step = 2; // Auto-advance to step 2
                    await this.loadPendingInvitations();
                    this.$emit('users-updated');
                }
            } catch (error) {
                this.inviteError = error.message;
            } finally {
                this.inviteUserDialog.loading = false;
            }
        },

        closeInviteDialog() {
            this.inviteUserDialog.show = false;
            // Reset dialog state after animation completes
            setTimeout(() => {
                this.inviteUserDialog.step = 1;
                this.inviteUserDialog.email = '';
                this.inviteUserDialog.role = 'user';
                this.inviteUserDialog.createdInvitation = null;
                this.inviteUserDialog.copied = false;
                this.inviteError = '';
            }, 300);
        },

        copyInvitationLinkFromModal() {
            if (!this.inviteUserDialog.createdInvitation) return;
            
            const link = `${this.currentOrigin}/invite/${this.inviteUserDialog.createdInvitation.inviteToken}`;
            navigator.clipboard.writeText(link).then(() => {
                this.inviteUserDialog.copied = true;
                this.$store.uiAlert({ 
                    type: 'success', 
                    message: 'Link copied to clipboard!', 
                    autoClear: true 
                });
                
                // Reset copied status after 3 seconds
                setTimeout(() => {
                    if (this.inviteUserDialog) {
                        this.inviteUserDialog.copied = false;
                    }
                }, 3000);
            }).catch(() => {
                this.$store.uiAlert({ 
                    type: 'error', 
                    message: 'Failed to copy link', 
                    autoClear: true 
                });
            });

            this.closeInviteDialog();
        },

        shareViaEmailFromModal() {
            if (!this.inviteUserDialog.createdInvitation) return;
            
            const invitation = this.inviteUserDialog.createdInvitation;
            const subject = encodeURIComponent(`You're invited to join our project`);
            const body = encodeURIComponent(`Hi!

You've been invited to join our project with ${invitation.role} access.

Please sign up using the email address: ${invitation.email}

Click this link to join: ${this.currentOrigin}/invite/${invitation.inviteToken}

Important: You must sign up with the exact email address (${invitation.email}) for the invitation to work.

Thanks!`);
            
            const mailtoUrl = `mailto:${invitation.email}?subject=${subject}&body=${body}`;
            window.open(mailtoUrl);
            this.closeInviteDialog();
        }
    }
}
</script>

<style scoped>
.user-removed {
    opacity: 0.5;
    color: rgba(var(--v-theme-on-surface), 0.6) !important;
}

.user-removed td {
    color: rgba(var(--v-theme-on-surface), 0.6) !important;
}

.invitation-complete {
    opacity: 0.5;
    color: rgba(var(--v-theme-on-surface), 0.6) !important;
}

.invitation-complete td {
    color: rgba(var(--v-theme-on-surface), 0.6) !important;
}
</style> 