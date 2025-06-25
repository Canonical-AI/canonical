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
          <p>Role: <strong>{{ getRoleDisplayText(invitation.role) }}</strong></p>
          <p class="text-caption">Invited by: {{ inviterName }}</p>
        </div>
        
        <v-alert v-if="!isUserLoggedIn" :type="ALERT_TYPES.INFO" class="mb-4">
          Please sign in with the email address <strong>{{ invitation.email }}</strong> to accept this invitation.
        </v-alert>

        <!-- Login Component for non-authenticated users -->
        <div v-if="!isUserLoggedIn" class="mt-4">
          <Login 
            :prefilled-email="invitation.email" 
            :default-to-sign-up="true"
            @auth-success="handleAuthSuccess" 
          />
        </div>
      </v-card-text>

      <v-card-text v-else-if="accepted">
        <v-alert :type="ALERT_TYPES.SUCCESS">
          {{ SUCCESS_MESSAGES.REDIRECTING }}
        </v-alert>
      </v-card-text>

      <v-card-actions v-if="shouldShowActionButtons">
        <v-spacer></v-spacer>
        <v-btn 
          @click="declineInvitation" 
          variant="text"
          :aria-label="BUTTON_LABELS.DECLINE_INVITATION"
        >
          Decline
        </v-btn>
        <v-btn 
          @click="acceptInvitation" 
          color="primary"
          :disabled="accepting"
          :loading="accepting"
          :aria-label="BUTTON_LABELS.ACCEPT_INVITATION"
        >
          Accept Invitation
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<script>
import Login from '../auth/Login.vue';
import { 
  ALERT_TYPES, 
  USER_ROLES, 
  BUTTON_LABELS, 
  ERROR_MESSAGES, 
  SUCCESS_MESSAGES,
  compareEmails,
  getRoleDisplayName
} from '../../utils/index.js';

const REDIRECT_DELAY_MS = 2000;

export default {
  components: {
    Login
  },
  data() {
    return {
      // Constants for template access
      ALERT_TYPES,
      USER_ROLES,
      BUTTON_LABELS,
      ERROR_MESSAGES,
      SUCCESS_MESSAGES,
      
      // Component state
      loading: true,
      error: null,
      invitation: null,
      projectName: '',
      inviterName: '',
      accepted: false,
      accepting: false
    };
  },
  computed: {
    isUserLoggedIn() {
      return this.$store.isUserLoggedIn;
    },
    
    shouldShowActionButtons() {
      return !this.loading && 
             !this.error && 
             !this.accepted && 
             this.isUserLoggedIn;
    },
    
    isCorrectEmail() {
      if (!this.invitation || !this.$store.user) return false;
      return compareEmails(this.$store.user.email, this.invitation.email);
    }
  },
  async mounted() {
    await this.initializeInvitation();
  },
  methods: {
    async initializeInvitation() {
      const token = this.$route.params.token;
      if (!token) {
        this.error = ERROR_MESSAGES.INVALID_TOKEN;
        this.loading = false;
        return;
      }

      // Logout any existing user to ensure clean state
      if (this.isUserLoggedIn) {
        await this.logoutCurrentUser();
      }

      await this.loadInvitation(token);
    },

    async logoutCurrentUser() {
      await this.$store.userLogoutAction();
      this.$store.userLogout();
      
      this.showAlert(
        ALERT_TYPES.INFO, 
        'Logged out to ensure clean invitation acceptance. Please sign in with the invited email address.'
      );
    },

    async loadInvitation(token) {
      try {
        const invitationDetails = await this.$store.userGetInvitationByToken(token);
        
        this.invitation = invitationDetails;
        this.projectName = invitationDetails.projectName;
        this.inviterName = invitationDetails.inviterName;

      } catch (error) {
        this.error = error.message || ERROR_MESSAGES.FAILED_LOAD;
        console.error('Error loading invitation:', error);
      } finally {
        this.loading = false;
      }
    },

    async acceptInvitation() {
      if (!this.isUserLoggedIn) {
        this.showAlert(ALERT_TYPES.WARNING, ERROR_MESSAGES.SIGN_IN_REQUIRED);
        return;
      }

      if (!this.isCorrectEmail) {
        this.showAlert(
          ALERT_TYPES.ERROR, 
          `This invitation is for ${this.invitation.email}. Please sign in with that email address.`
        );
        return;
      }

      this.accepting = true;
      try {
        const projectId = await this.$store.userAcceptInvitation(this.$route.params.token);
        
        this.accepted = true;
        
        // Redirect to home page after delay
        setTimeout(() => {
          this.$router.push('/');
        }, REDIRECT_DELAY_MS);

      } catch (error) {
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
      // Refresh user state after successful authentication
      await this.$store.userEnter();
      
      // Check if the user signed in with the correct email and auto-accept
      if (this.isCorrectEmail) {
        await this.acceptInvitation();
      } else {
        this.showAlert(
          ALERT_TYPES.ERROR, 
          `Please sign in with the invited email address: ${this.invitation.email}`
        );
      }
    },

    getRoleDisplayText(role) {
      return getRoleDisplayName(role);
    },

    showAlert(type, message) {
      this.$store.uiAlert({ 
        type, 
        message, 
        autoClear: true 
      });
    }
  }
};
</script> 