<template>
  <div v-if="$store.pendingInvitations.length > 0" class="mt-8">
    <hr class="my-5">
    <div class="d-flex justify-space-between align-center mb-4">
      <h2>Pending Project Invitations</h2>
      <v-chip 
        color="primary" 
        variant="tonal" 
        size="small"
      >
        {{ $store.pendingInvitations.length }} pending
      </v-chip>
    </div>

    <v-table density="compact">
      <thead>
        <tr>
          <th class="text-left">Project</th>
          <th class="text-left">Role</th>
          <th class="text-left">Invited</th>
          <th class="text-left">Action</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="invitation in $store.pendingInvitations" :key="invitation.id">
          <td>{{ invitation.projectName || 'Project Invitation' }}</td>
          <td>
            <v-chip 
              :color="invitation.role === 'admin' ? 'orange' : 'blue'" 
              variant="tonal" 
              size="small"
            >
              {{ invitation.role }}
            </v-chip>
          </td>
          <td>{{ formatDate(invitation.createdDate) }}</td>
          <td>
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
          </td>
        </tr>
      </tbody>
    </v-table>
  </div>

  <!-- Show message when no pending invitations -->
  <div v-else class="mt-8">
    <hr class="my-5">
    <h2>Pending Project Invitations</h2>
    <v-alert type="info" variant="tonal" class="mt-4">
      You have no pending project invitations.
    </v-alert>
  </div>
</template>

<script>
export default {
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
        
        // Optionally redirect to the project
        this.$router.push(`/settings/project/${projectId}`);
        
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
/* Component-specific styles */
</style> 