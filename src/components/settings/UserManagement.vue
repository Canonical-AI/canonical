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
                :aria-label="BUTTON_LABELS.INVITE_USER"
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
            :aria-label="BUTTON_LABELS.SEARCH_USERS"
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
                <tr v-for="user in filteredAndSortedUsers" :key="user.id" :class="{ 'user-removed': isUserRemoved(user) }">
                    <td>{{ user.displayName }}</td>
                    <td>{{ user.email }}</td>
                    <td>{{ getUserRoleDisplay(user) }}</td>
                    <td>
                        <span v-if="user.pending">
                            <v-btn 
                                density="compact" 
                                class="text-none"  
                                @click="removeUser(user.id)" 
                                color="primary"
                                :aria-label="`${BUTTON_LABELS.APPROVE_USER} ${user.displayName || user.email}`"
                            >
                                Approve
                            </v-btn>
                            <v-btn 
                                density="compact" 
                                class="text-none" 
                                @click="removeUser(user.id)" 
                                color="error"
                                :aria-label="`${BUTTON_LABELS.REJECT_USER} ${user.displayName || user.email}`"
                            >
                                Reject
                            </v-btn>
                        </span>
                        <span v-else-if="isUserRemoved(user)">
                            <v-btn 
                                density="compact" 
                                class="text-none" 
                                color="success" 
                                variant="text" 
                                @click="confirmReinstateUser(user)"
                                :aria-label="`${BUTTON_LABELS.REINSTATE_USER} ${user.displayName || user.email}`"
                            >
                                Reinstate
                            </v-btn>
                        </span>
                        <span v-else-if="user.id !== $store.user.uid" density="compact">
                            <v-menu>
                                <template v-slot:activator="{ props }">
                                    <v-btn 
                                        density="compact" 
                                        class="text-none" 
                                        variant="tonal" 
                                        color="secondary" 
                                        v-bind="props"
                                        :aria-label="`Change role for ${user.displayName || user.email}. Current role: ${user.role}`"
                                    >
                                        {{ user.role }}
                                    </v-btn>
                                </template>
                                <v-list>
                                    <v-list-item @click="changeUserRole(user.id, USER_ROLES.ADMIN)" :disabled="user.role === USER_ROLES.ADMIN">
                                        <v-list-item-title>Admin</v-list-item-title>
                                    </v-list-item>
                                    <v-list-item @click="changeUserRole(user.id, USER_ROLES.USER)" :disabled="user.role === USER_ROLES.USER">
                                        <v-list-item-title>User</v-list-item-title>
                                    </v-list-item>
                                </v-list>
                            </v-menu>
                            <v-btn 
                                density="compact" 
                                class="text-none" 
                                color="warning" 
                                variant="text" 
                                v-if="!user.pending && !isUserRemoved(user)" 
                                @click="confirmRemoveUser(user)"
                                :aria-label="`${BUTTON_LABELS.REMOVE_USER} ${user.displayName || user.email}`"
                            >
                                Remove
                            </v-btn>
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
                    :aria-label="showCompleteInvitations ? BUTTON_LABELS.HIDE_COMPLETE : BUTTON_LABELS.SHOW_COMPLETE"
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
                    <tr v-for="invite in filteredInvitations" :key="invite.id" :class="{ 'invitation-complete': isInvitationComplete(invite) }">
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
                        <td>{{ formatDate(invite.expiresAt) }}</td>
                        <td>
                            <span v-if="isInvitationComplete(invite)" class="text-disabled">
                                {{ getInvitationCompletionText(invite) }}
                            </span>
                            <span v-else>
                                <v-btn 
                                    density="compact" 
                                    class="text-none mr-2" 
                                    color="primary" 
                                    variant="text" 
                                    @click="showExistingInvitationLink(invite)"
                                    prepend-icon="mdi-link"
                                    :aria-label="`Show invitation link for ${invite.email}`"
                                >
                                    Link
                                </v-btn>
                                <v-btn 
                                    density="compact" 
                                    class="text-none" 
                                    color="error" 
                                    variant="text" 
                                    @click="cancelInvitation(invite.id)"
                                    :aria-label="`Cancel invitation for ${invite.email}`"
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
                        :value="buildInvitationUrl(invitationDialog.token)"
                        label="Invitation Link"
                        readonly
                        append-icon="mdi-content-copy"
                        @click:append="copyInvitationLinkToClipboard(invitationDialog.token)"
                        variant="outlined"
                    ></v-text-field>
                </v-card-text>
                
                <v-card-actions>
                    <v-btn @click="invitationDialog.show = false">Close</v-btn>
                    <v-spacer></v-spacer>
                    <v-btn 
                        @click="copyInvitationLinkToClipboard(invitationDialog.token)" 
                        color="primary"
                        variant="tonal"
                        :prepend-icon="invitationDialog.copied ? 'mdi-check' : 'mdi-content-copy'"
                    >
                        {{ invitationDialog.copied ? 'Copied!' : 'Copy Link' }}
                    </v-btn>
                    <v-btn 
                        @click="openEmailClient(invitationDialog)" 
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
                                        :success="isEmailValidAndAvailable"
                                        :success-messages="isEmailValidAndAvailable ? ['Email is valid and available'] : []"
                                    ></v-text-field>

                                    <v-select
                                        v-model="inviteUserDialog.role"
                                        :items="roleSelectItems"
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
                                            <strong>User Added!</strong> {{ getUserDisplayName(inviteUserDialog.existingUser) }} has been added to your project.
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
                                            :value="buildInvitationUrl(inviteUserDialog.createdInvitation?.inviteToken)"
                                            label="Invitation Link"
                                            readonly
                                            variant="outlined"
                                            append-inner-icon="mdi-content-copy"
                                            @click:append-inner="copyInvitationLinkToClipboard(inviteUserDialog.createdInvitation?.inviteToken, 'modal')"
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
                                                    @click="copyInvitationLinkToClipboard(inviteUserDialog.createdInvitation?.inviteToken, 'modal')"
                                                    color="primary"
                                                    variant="tonal"
                                                    :prepend-icon="inviteUserDialog.copied ? 'mdi-check' : 'mdi-content-copy'"
                                                    class="mr-2"
                                                >
                                                    {{ inviteUserDialog.copied ? 'Copied!' : 'Copy Link' }}
                                                </v-btn>
                                                <v-btn 
                                                    @click="openEmailClient(inviteUserDialog.createdInvitation)"
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
import { debounce } from 'lodash-es';
import { 
    ALERT_TYPES,
    USER_ROLES, 
    INVITATION_STATUS,
    formatTimestamp,
    normalizeEmail,
    isValidEmail
} from '../../utils/index.js';

// Constants specific to UserManagement
const USER_STATUS = {
    ACTIVE: 'active',
    REMOVED: 'removed',
    PENDING: 'pending'
};

const BUTTON_LABELS = {
    INVITE_USER: 'Invite a new user to the project',
    SEARCH_USERS: 'Search for users by name or email',
    APPROVE_USER: 'Approve user',
    REJECT_USER: 'Reject user',
    REINSTATE_USER: 'Reinstate user',
    REMOVE_USER: 'Remove user',
    HIDE_COMPLETE: 'Hide completed invitations',
    SHOW_COMPLETE: 'Show completed invitations'
};

const REFRESH_INTERVAL_MS = 10000;
const COPY_FEEDBACK_TIMEOUT_MS = 3000;

// Utility functions specific to UserManagement
const buildInvitationUrl = (token, origin) => {
    if (!token) return '';
    const baseOrigin = origin || (typeof window !== 'undefined' ? window.location.origin : '');
    return `${baseOrigin}/invite/${token}`;
};

const createEmailSubject = () => {
    return encodeURIComponent(`You're invited to join our project`);
};

const createEmailBody = (invitation, invitationUrl) => {
    return encodeURIComponent(`Hi!

You've been invited to join our project with ${invitation.role} access.

Please sign up using the email address: ${invitation.email}

Click this link to join: ${invitationUrl}

Important: You must sign up with the exact email address (${invitation.email}) for the invitation to work.

Thanks!`);
};

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
            // Constants for template access
            USER_STATUS,
            INVITATION_STATUS,
            USER_ROLES,
            BUTTON_LABELS,
            ALERT_TYPES,
            
            // Component state
            pendingInvitations: [],
            inviteError: '',
            userSearchQuery: '',
            debouncedSearchQuery: '',
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
                role: USER_ROLES.USER,
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
            const isAdmin = currentUser?.role === USER_ROLES.ADMIN;
            const isCreator = this.$store.project?.createdBy === this.$store.user.uid;
            return isAdmin || isCreator;
        },

        filteredAndSortedUsers() {
            if (!this.users || this.users.length === 0) return [];
            
            // Filter by search query (debounced)
            let filtered = this.users;
            if (this.debouncedSearchQuery.trim()) {
                const query = this.debouncedSearchQuery.toLowerCase();
                filtered = this.users.filter(user => 
                    this.getUserDisplayName(user).toLowerCase().includes(query) ||
                    normalizeEmail(user.email).includes(query)
                );
            }
            
            // Sort: active users first, then removed users, alphabetically within each group
            return filtered.sort((a, b) => {
                const aStatus = this.isUserRemoved(a) ? 1 : 0;
                const bStatus = this.isUserRemoved(b) ? 1 : 0;
                
                if (aStatus !== bStatus) {
                    return aStatus - bStatus;
                }
                
                const aName = this.getUserDisplayName(a).toLowerCase();
                const bName = this.getUserDisplayName(b).toLowerCase();
                
                return aName.localeCompare(bName);
            });
        },

        // Email validation computed properties
        isEmailValidAndAvailable() {
            return this.inviteUserDialog.email && 
                   this.isValidEmailFormat(this.inviteUserDialog.email) && 
                   !this.emailExistsInProject(this.inviteUserDialog.email);
        },

        emailValidationErrors() {
            const errors = [];
            const email = this.inviteUserDialog.email;
            
            if (email && !this.isValidEmailFormat(email)) {
                errors.push('Please enter a valid email address');
            }
            
            if (email && this.emailExistsInProject(email)) {
                const normalizedEmail = normalizeEmail(email);
                const existsInUsers = this.users?.some(user => 
                    normalizeEmail(user.email) === normalizedEmail
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
                   this.isValidEmailFormat(this.inviteUserDialog.email) && 
                   !this.emailExistsInProject(this.inviteUserDialog.email) && 
                   this.isCurrentUserAdmin;
        },

        roleSelectItems() {
            return [
                { title: 'User', value: USER_ROLES.USER },
                { title: 'Admin', value: USER_ROLES.ADMIN }
            ];
        },

        filteredInvitations() {
            if (!this.pendingInvitations || this.pendingInvitations.length === 0) return [];
            
            if (this.showCompleteInvitations) {
                return this.pendingInvitations;
            } else {
                return this.pendingInvitations.filter(invite => 
                    !this.isInvitationComplete(invite)
                );
            }
        },

        completeInvitationsCount() {
            if (!this.pendingInvitations || this.pendingInvitations.length === 0) return 0;
            return this.pendingInvitations.filter(invite => 
                this.isInvitationComplete(invite)
            ).length;
        }
    },
    watch: {
        // Debounced search query
        userSearchQuery: {
            handler: debounce(function(newQuery) {
                this.debouncedSearchQuery = newQuery;
            }, 300),
            immediate: true
        },

        // Watch for changes in project users
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
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    },
    methods: {
        // Utility methods
        isUserRemoved(user) {
            return user?.status === USER_STATUS.REMOVED;
        },

        isInvitationComplete(invite) {
            return [INVITATION_STATUS.CANCELLED, INVITATION_STATUS.ACCEPTED].includes(invite?.status);
        },

        getUserDisplayName(user) {
            return user?.displayName || user?.email || 'Unknown User';
        },

        getUserRoleDisplay(user) {
            return this.isUserRemoved(user) ? 'removed' : user.role;
        },

        getInvitationCompletionText(invite) {
            return invite?.status === INVITATION_STATUS.CANCELLED ? 'Cancelled' : 'Accepted';
        },

        isValidEmailFormat(email) {
            return isValidEmail(email);
        },

        emailExistsInProject(email) {
            if (!email) return false;
            const normalizedEmail = normalizeEmail(email);
            
            const existsInUsers = this.users?.some(user => 
                normalizeEmail(user.email) === normalizedEmail
            );
            
            const existsInInvitations = this.pendingInvitations?.some(invite => 
                normalizeEmail(invite.email) === normalizedEmail
            );
            
            return existsInUsers || existsInInvitations;
        },

        buildInvitationUrl(token) {
            return buildInvitationUrl(token);
        },

        formatDate(timestamp) {
            return formatTimestamp(timestamp);
        },

        // Invitation link and email sharing methods
        async copyInvitationLinkToClipboard(token, context = 'dialog') {
            if (!token) return;
            
            const url = this.buildInvitationUrl(token);
            
            try {
                await navigator.clipboard.writeText(url);
                
                // Update copied state based on context
                if (context === 'modal') {
                    this.inviteUserDialog.copied = true;
                    setTimeout(() => {
                        if (this.inviteUserDialog) {
                            this.inviteUserDialog.copied = false;
                        }
                    }, COPY_FEEDBACK_TIMEOUT_MS);
                } else {
                    this.invitationDialog.copied = true;
                    setTimeout(() => {
                        if (this.invitationDialog) {
                            this.invitationDialog.copied = false;
                        }
                    }, COPY_FEEDBACK_TIMEOUT_MS);
                }
                
                this.$store.uiAlert({ 
                    type: 'success', 
                    message: 'Link copied to clipboard!', 
                    autoClear: true 
                });
                
                // Close modal after copying if in modal context
                if (context === 'modal') {
                    this.closeInviteDialog();
                }
            } catch (error) {
                this.$store.uiAlert({ 
                    type: 'error', 
                    message: 'Failed to copy link', 
                    autoClear: true 
                });
            }
        },

        openEmailClient(invitation) {
            if (!invitation) return;
            
            const invitationUrl = this.buildInvitationUrl(invitation.inviteToken);
            const subject = createEmailSubject();
            const body = createEmailBody(invitation, invitationUrl);
            const mailtoUrl = `mailto:${invitation.email}?subject=${subject}&body=${body}`;
            
            window.open(mailtoUrl);
            
            // Close dialog after opening email client
            if (this.inviteUserDialog.show) {
                this.closeInviteDialog();
            }
        },

        // User management methods
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
                message: `Are you sure you want to remove ${this.getUserDisplayName(user)} from this project?`,
                action: () => this.removeUser(user.id)
            };
        },

        confirmReinstateUser(user) {
            this.confirmDialog = {
                show: true,
                title: 'Reinstate User',
                message: `Are you sure you want to reinstate ${this.getUserDisplayName(user)} to this project?`,
                action: () => this.reinstateUser(user.id)
            };
        },

        async removeUser(userId) {
            try {
                await this.$store.projectRemoveUserFromProject({userId, projectId: this.projectId});
                this.confirmDialog.show = false;
                this.$emit('users-updated');
            } catch (error) {
                this.$store.uiAlert({ 
                    type: 'error', 
                    message: `Error removing user: ${error.message}`, 
                    autoClear: true 
                });
                this.confirmDialog.show = false;
            }
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

        // Invitation management methods
        async loadPendingInvitations() {
            try {
                if (this.isCurrentUserAdmin) {
                    this.pendingInvitations = await Project.getProjectInvitations(this.projectId);
                } else {
                    this.pendingInvitations = [];
                }
            } catch (error) {
                console.error('Error loading invitations:', error);
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
                    status: INVITATION_STATUS.CANCELLED
                });
                
                // Update local state immediately
                const inviteIndex = this.pendingInvitations.findIndex(invite => invite.id === inviteId);
                if (inviteIndex !== -1) {
                    this.pendingInvitations[inviteIndex] = {
                        ...this.pendingInvitations[inviteIndex],
                        status: INVITATION_STATUS.CANCELLED
                    };
                }
                
                // Refresh from server to ensure consistency
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
                case INVITATION_STATUS.CANCELLED:
                    return 'error';
                case INVITATION_STATUS.ACCEPTED:
                    return 'success';
                case INVITATION_STATUS.PENDING:
                default:
                    return 'warning';
            }
        },

        getInvitationStatusText(status) {
            switch (status) {
                case INVITATION_STATUS.CANCELLED:
                    return 'Cancelled';
                case INVITATION_STATUS.ACCEPTED:
                    return 'Accepted';
                case INVITATION_STATUS.PENDING:
                default:
                    return 'Pending';
            }
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

        // Invite user dialog methods
        openInviteDialog() {
            this.resetInviteDialog();
            this.inviteUserDialog.show = true;
        },

        resetInviteDialog() {
            this.inviteUserDialog.step = 1;
            this.inviteUserDialog.email = '';
            this.inviteUserDialog.role = USER_ROLES.USER;
            this.inviteUserDialog.createdInvitation = null;
            this.inviteUserDialog.existingUser = null;
            this.inviteUserDialog.copied = false;
            this.inviteError = '';
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
                    this.inviteUserDialog.step = 2;
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
            setTimeout(() => {
                this.resetInviteDialog();
            }, 300);
        },

        // Periodic refresh
        setupPeriodicRefresh() {
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
            }
            
            this.refreshInterval = setInterval(async () => {
                if (this.projectId && this.isCurrentUserAdmin) {
                    await this.loadPendingInvitations();
                }
            }, REFRESH_INTERVAL_MS);
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