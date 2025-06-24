<template>
  <div v-if="hasPendingInvitations">
    <div v-if="!compact" class="mt-8">
      <hr class="my-5">
    </div>
    
    <div class="d-flex justify-space-between align-center mb-4">
      <h2 v-if="!compact">Pending Project Invitations</h2>
      <v-chip 
        v-if="showCount"
        color="primary" 
        variant="tonal" 
        size="small"
        :aria-label="`${pendingInvitationsCount} pending invitations`"
      >
        {{ pendingInvitationsCount }} pending
      </v-chip>
    </div>

    <v-list>
      <v-list-item 
        v-for="invitation in $store.pendingInvitations" 
        :key="invitation.id"
        class="mb-2"
        :class="{ 'border': compact }"
      >
        <v-list-item-content>
          <v-list-item-title>{{ getProjectDisplayName(invitation) }}</v-list-item-title>
          <v-list-item-subtitle>
            <v-chip 
              :color="getRoleChipColor(invitation.role)" 
              variant="tonal" 
              size="x-small"
              class="mr-2"
            >
              {{ getRoleDisplayText(invitation.role) }}
            </v-chip>
            Invited {{ formatInvitationDate(invitation.createdDate) }}
          </v-list-item-subtitle>
        </v-list-item-content>
        
        <v-list-item-action>
          <div class="d-flex">
            <v-btn 
              size="small" 
              color="primary" 
              @click="acceptInvitation(invitation)"
              :loading="isAccepting(invitation.id)"
              class="text-none mr-2"
              :aria-label="`${BUTTON_LABELS.ACCEPT_INVITATION} for ${getProjectDisplayName(invitation)}`"
            >
              Accept
            </v-btn>
            <v-btn 
              size="small" 
              variant="outlined" 
              @click="declineInvitation(invitation)"
              class="text-none"
              :aria-label="`${BUTTON_LABELS.DECLINE_INVITATION} for ${getProjectDisplayName(invitation)}`"
            >
              Decline
            </v-btn>
          </div>
        </v-list-item-action>
      </v-list-item>
    </v-list>
  </div>

  <!-- Show message when no pending invitations -->
  <div v-else-if="showWhenEmpty">
    <div v-if="!compact" class="mt-8">
      <hr class="my-5">
      <h2>Pending Project Invitations</h2>
    </div>
    <v-alert :type="ALERT_TYPES.INFO" variant="tonal" class="mt-4">
      You have no pending project invitations.
    </v-alert>
    <v-alert 
      :type="ALERT_TYPES.INFO" 
      variant="outlined" 
      class="mt-4" 
      v-if="hasExistingProjects"
    >
      <v-alert-title>Project Management</v-alert-title>
      If you were automatically added to projects during signup and want to leave any of them, 
      you can manage your project memberships in the Project Settings section.
    </v-alert>
  </div>
</template>

<script>
import { 
  ALERT_TYPES, 
  USER_ROLES, 
  BUTTON_LABELS, 
  SUCCESS_MESSAGES,
  formatTimestamp,
  getRoleColor,
  getRoleDisplayName
} from '../../utils/index.js';

export default {
  props: {
    compact: {
      type: Boolean,
      default: false
    },
    showWhenEmpty: {
      type: Boolean,
      default: true
    },
    showCount: {
      type: Boolean,
      default: true
    }
  },
  emits: ['invitation-accepted', 'dismiss'],
  data() {
    return {
      // Constants for template access
      ALERT_TYPES,
      USER_ROLES,
      BUTTON_LABELS,
      SUCCESS_MESSAGES,
      
      // Component state
      accepting: null
    };
  },
  computed: {
    hasPendingInvitations() {
      return this.$store.pendingInvitations.length > 0;
    },
    
    pendingInvitationsCount() {
      return this.$store.pendingInvitations.length;
    },
    
    hasExistingProjects() {
      return this.$store.user?.projects?.length > 0;
    }
  },
  async mounted() {
    if (this.$store.isUserLoggedIn) {
      await this.$store.userGetPendingInvitations();
    }
  },
  watch: {
    '$store.isUserLoggedIn'(isLoggedIn) {
      if (isLoggedIn) {
        this.$store.userGetPendingInvitations();
      }
    }
  },
  methods: {
    async acceptInvitation(invitation) {
      this.accepting = invitation.id;
      try {
        const projectId = await this.$store.userAcceptInvitation(invitation.inviteToken);
        
        // Show success message
        this.showSuccessAlert(`Successfully joined ${this.getProjectDisplayName(invitation)}!`);
        
        // Emit event for parent to handle navigation
        this.$emit('invitation-accepted', { invitation, projectId });
        
      } catch (error) {
        console.error('Error accepting invitation:', error);
      } finally {
        this.accepting = null;
      }
    },

    async declineInvitation(invitation) {
      try {
        await this.$store.userDeclineInvitation(invitation.id);
        
        // Show success message
        this.showInfoAlert(SUCCESS_MESSAGES.INVITATION_DECLINED);
      } catch (error) {
        console.error('Error declining invitation:', error);
      }
    },

    // Utility methods
    isAccepting(invitationId) {
      return this.accepting === invitationId;
    },

    getProjectDisplayName(invitation) {
      return invitation.projectName || 'Project Invitation';
    },

    getRoleChipColor(role) {
      return getRoleColor(role);
    },

    getRoleDisplayText(role) {
      return getRoleDisplayName(role);
    },

    formatInvitationDate(timestamp) {
      return formatTimestamp(timestamp);
    },

    showSuccessAlert(message) {
      this.$store.uiAlert({ 
        type: ALERT_TYPES.SUCCESS, 
        message, 
        autoClear: true 
      });
    },

    showInfoAlert(message) {
      this.$store.uiAlert({ 
        type: ALERT_TYPES.INFO, 
        message, 
        autoClear: true 
      });
    }
  }
};
</script>

<style scoped>
.border {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 4px;
}
</style> 