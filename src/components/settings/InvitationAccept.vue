<template>
  <v-container class="pa-4">
    <v-card max-width="500" class="mx-auto">
      <v-card-title class="text-h5">Project Invitation</v-card-title>
      
      <v-card-text v-if="loading">
        <v-progress-circular indeterminate></v-progress-circular>
        <span class="ml-2">Loading invitation...</span>
      </v-card-text>

      <v-card-text v-else-if="error">
        <v-alert type="error" class="mb-4">{{ error }}</v-alert>
        <p>This invitation may have expired or is no longer valid.</p>
      </v-card-text>

      <v-card-text v-else-if="invitation && !accepted">
        <div class="mb-4">
          <p>You've been invited to join the project:</p>
          <h3 class="my-2">{{ projectName }}</h3>
          <p>Role: <strong>{{ invitation.role }}</strong></p>
          <p class="text-caption">Invited by: {{ inviterName }}</p>
        </div>
        
        <v-alert v-if="!$store.isUserLoggedIn" type="info" class="mb-4">
          Please sign in with the email address <strong>{{ invitation.email }}</strong> to accept this invitation.
        </v-alert>

        <!-- Login Component for non-authenticated users -->
        <div v-if="!$store.isUserLoggedIn" class="mt-4">
          <Login 
            :prefilled-email="invitation.email" 
            :default-to-sign-up="true"
            @auth-success="handleAuthSuccess" 
          />
        </div>
      </v-card-text>

      <v-card-text v-else-if="accepted">
        <v-alert type="success">
          Successfully joined the project! Redirecting...
        </v-alert>
      </v-card-text>

      <v-card-actions v-if="!loading && !error && !accepted && $store.isUserLoggedIn">
        <v-spacer></v-spacer>
        <v-btn @click="declineInvitation" variant="text">Decline</v-btn>
        <v-btn 
          @click="acceptInvitation" 
          color="primary"
          :disabled="accepting"
          :loading="accepting"
        >
          Accept Invitation
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<script>
import Login from '../auth/Login.vue';

export default {
  components: {
    Login
  },
  data() {
    return {
      loading: true,
      error: null,
      invitation: null,
      projectName: '',
      inviterName: '',
      accepted: false,
      accepting: false
    };
  },
  async mounted() {
    const token = this.$route.params.token;
    if (!token) {
      this.error = 'No invitation token provided';
      this.loading = false;
      return;
    }

    // Logout any existing user to ensure clean state for invitation acceptance
    if (this.$store.isUserLoggedIn) {
      await this.$store.userLogoutAction();
      this.$store.userLogout();
      
      this.$store.uiAlert({ 
        type: 'info', 
        message: 'Logged out to ensure clean invitation acceptance. Please sign in with the invited email address.',
        autoClear: true 
      });
    }

    await this.loadInvitation(token);
  },
  methods: {
    async loadInvitation(token) {
      try {
        const invitationDetails = await this.$store.userGetInvitationByToken(token);
        
        this.invitation = invitationDetails;
        this.projectName = invitationDetails.projectName;
        this.inviterName = invitationDetails.inviterName;

      } catch (error) {
        this.error = error.message || 'Failed to load invitation details';
        console.error('Error loading invitation:', error);
      } finally {
        this.loading = false;
      }
    },

    async acceptInvitation() {
      if (!this.$store.isUserLoggedIn) {
        this.$store.uiAlert({ 
          type: 'warning', 
          message: 'Please sign in to accept the invitation',
          autoClear: true 
        });
        return;
      }

      if (this.$store.user.email !== this.invitation.email) {
        this.$store.uiAlert({ 
          type: 'error', 
          message: `This invitation is for ${this.invitation.email}. Please sign in with that email address.`,
          autoClear: true 
        });
        return;
      }

      this.accepting = true;
      try {
        const projectId = await this.$store.userAcceptInvitation(this.$route.params.token);
        this.accepted = true;
        
        // Redirect to project after a brief delay
        setTimeout(() => {
          this.$router.push(`/settings/project/${projectId}`);
        }, 2000);

      } catch (error) {
        // Error already handled in store method
        console.error('Error accepting invitation:', error);
      } finally {
        this.accepting = false;
      }
    },

    async declineInvitation() {
      // Could implement decline functionality if needed
      this.$router.push('/');
    },

    async handleAuthSuccess() {
      // User has successfully signed in, now try to accept the invitation
      await this.$store.userEnter(); // Refresh user state
      
      // Check if the user signed in with the correct email
      if (this.$store.user.email === this.invitation.email) {
        await this.acceptInvitation();
      } else {
        this.$store.uiAlert({ 
          type: 'error', 
          message: `Please sign in with the invited email address: ${this.invitation.email}`,
          autoClear: true 
        });
      }
    }
  }
};
</script> 