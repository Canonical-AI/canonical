<template>
  <v-card v-if="invitations.length > 0" class="mb-4">
    <v-card-title>
      <v-icon left>mdi-email</v-icon>
      Pending Invitations
    </v-card-title>
    
    <v-card-text>
      <v-list>
        <v-list-item 
          v-for="invitation in invitations" 
          :key="invitation.id"
          class="mb-2"
        >
          <v-list-item-content>
            <v-list-item-title>{{ invitation.projectName || 'Project Invitation' }}</v-list-item-title>
            <v-list-item-subtitle>
              Role: {{ invitation.role }} • 
              Invited {{ formatDate(invitation.createdDate) }}
            </v-list-item-subtitle>
          </v-list-item-content>
          
          <v-list-item-action>
            <div class="d-flex gap-2">
              <v-btn 
                size="small" 
                color="primary" 
                @click="acceptInvitation(invitation)"
                :loading="accepting === invitation.id"
              >
                Accept
              </v-btn>
              <v-btn 
                size="small" 
                variant="outlined" 
                @click="declineInvitation(invitation)"
              >
                Decline
              </v-btn>
            </div>
          </v-list-item-action>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script>
import { User, Project } from '../../services/firebaseDataService';

export default {
  data() {
    return {
      invitations: [],
      accepting: null
    };
  },
  async mounted() {
    if (this.$store.isUserLoggedIn) {
      await this.loadInvitations();
    }
  },
  watch: {
    '$store.isUserLoggedIn'(isLoggedIn) {
      if (isLoggedIn) {
        this.loadInvitations();
      } else {
        this.invitations = [];
      }
    }
  },
  methods: {
    async loadInvitations() {
      try {
        const invites = await User.getPendingInvitations();
        
        // Load project names for each invitation
        this.invitations = await Promise.all(
          invites.map(async (invite) => {
            try {
              const project = await Project.getById(invite.projectId);
              return {
                ...invite,
                projectName: project.name
              };
            } catch (error) {
              console.error('Error loading project for invitation:', error);
              return invite;
            }
          })
        );
      } catch (error) {
        console.error('Error loading invitations:', error);
      }
    },

    async acceptInvitation(invitation) {
      this.accepting = invitation.id;
      try {
        const projectId = await User.acceptInvitation(invitation.inviteToken);
        
        // Remove from local list
        this.invitations = this.invitations.filter(inv => inv.id !== invitation.id);
        
        // Optionally redirect to the project
        this.$router.push(`/settings/project/${projectId}`);
        
      } catch (error) {
        this.$store.uiAlert({ 
          type: 'error', 
          message: error.message,
          autoClear: true 
        });
      } finally {
        this.accepting = null;
      }
    },

    async declineInvitation(invitation) {
      // TODO: Implement decline invitation functionality
      // For now, just hide it locally
      this.invitations = this.invitations.filter(inv => inv.id !== invitation.id);
      
      this.$store.uiAlert({ 
        type: 'info', 
        message: 'Invitation declined',
        autoClear: true 
      });
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
.gap-2 {
  gap: 8px;
}
</style> 