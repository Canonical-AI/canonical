<template>
  <div v-if="$store.pendingInvitations.length > 0">
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
      >
        {{ $store.pendingInvitations.length }} pending
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
          <v-list-item-title>{{ invitation.projectName || 'Project Invitation' }}</v-list-item-title>
          <v-list-item-subtitle>
            <v-chip 
              :color="invitation.role === 'admin' ? 'orange' : 'blue'" 
              variant="tonal" 
              size="x-small"
              class="mr-2"
            >
              {{ invitation.role }}
            </v-chip>
            Invited {{ formatDate(invitation.createdDate) }}
          </v-list-item-subtitle>
        </v-list-item-content>
        
        <v-list-item-action>
          <div class="d-flex">
            <v-btn 
              size="small" 
              color="primary" 
              @click="acceptInvitation(invitation)"
              :loading="accepting === invitation.id"
              class="text-none mr-2"
            >
              Accept
            </v-btn>
            <v-btn 
              size="small" 
              variant="outlined" 
              @click="declineInvitation(invitation)"
              class="text-none"
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
    <v-alert type="info" variant="tonal" class="mt-4">
      You have no pending project invitations.
    </v-alert>
    <v-alert type="info" variant="outlined" class="mt-4" v-if="$store.user?.projects?.length > 0">
      <v-alert-title>Project Management</v-alert-title>
      If you were automatically added to projects during signup and want to leave any of them, 
      you can manage your project memberships in the Project Settings section.
    </v-alert>
  </div>
</template>

<script>
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
      accepting: null
    };
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
        this.$store.uiAlert({ 
          type: 'success', 
          message: `Successfully joined ${invitation.projectName || 'project'}!`, 
          autoClear: true 
        });
        
        // Emit event for parent to handle navigation
        this.$emit('invitation-accepted', { invitation, projectId });
        
      } catch (error) {
        // Error already handled in store method
        console.error('Error accepting invitation:', error);
      } finally {
        this.accepting = null;
      }
    },

    async declineInvitation(invitation) {
      try {
        await this.$store.userDeclineInvitation(invitation.id);
        
        // Show success message
        this.$store.uiAlert({ 
          type: 'info', 
          message: 'Invitation declined', 
          autoClear: true 
        });
      } catch (error) {
        // Error already handled in store method
        console.error('Error declining invitation:', error);
      }
    },

    formatDate(timestamp) {
      if (!timestamp) return '';
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString();
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