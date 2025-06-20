<template>
  <v-dialog v-model="showPrompt" max-width="400" persistent>
    <v-card>
      <v-card-title class="text-h5">
        Sign in to Canonical
      </v-card-title>
      <v-card-text>
        <p class="mb-4">Sign in or create an account to save your progress and access all features.</p>
        <div class="d-flex flex-column gap-1">
          <v-btn
            color="white"
            variant="outlined"
            block
            @click="handleSocialSignIn('google')"
            class="mb-1"
          >
            <v-icon start>mdi-google</v-icon>
            Sign In with Google
          </v-btn>
          
          <v-btn
            color="white"
            variant="outlined"
            block
            @click="handleSocialSignIn('github')"
            class="mb-1"
          >
            <v-icon start>mdi-github</v-icon>
            Sign In with GitHub
          </v-btn>

          <v-btn
            color="white"
            variant="outlined"
            block
            @click="showEmailForm = !showEmailForm"
            class="mb-1"
          >
            <v-icon start>mdi-email</v-icon>
            Sign In with Email
          </v-btn>
        </div>

        <v-expand-transition>
          <div v-if="showEmailForm">
            <v-divider class="my-4"></v-divider>
            
            <v-form @submit.prevent="handleAuth">
              <v-text-field
                v-model="email"
                label="Email"
                type="email"
                required
                class="mb-4"
              ></v-text-field>
              
              <v-text-field
                v-model="password"
                label="Password"
                type="password"
                required
                class="mb-4"
              ></v-text-field>
              
              <v-btn color="primary" block type="submit" class="mb-4">
                {{ isSignUp ? 'Sign Up' : 'Sign In' }}
              </v-btn>
              
              <v-btn
                variant="text"
                block
                @click="isSignUp = !isSignUp"
              >
                {{ isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up' }}
              </v-btn>
            </v-form>
          </div>
        </v-expand-transition>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="dismiss">Remind me later</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount, watch} from 'vue';
import { useRouter } from 'vue-router';
import { useMainStore } from '../store/index.js';
import { 
  getAuth, 
  GoogleAuthProvider, 
  GithubAuthProvider, 
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { firebaseApp } from '../firebase';

export default {
  setup() {
    const router = useRouter();
    const store = useMainStore();
    const auth = getAuth(firebaseApp);
    
    const email = ref('');
    const password = ref('');
    const isSignUp = ref(false);
    const error = ref('');
    const showEmailForm = ref(false);
    const showPrompt = ref(false);
    
    const isLoggedIn = computed(() => store.isLoggedIn);
    
    // Timer setup
    let inactivityTimer = null;
    const INACTIVITY_TIMEOUT = 3 * 60 * 1000; // 3 minutes
    const DISMISSED_KEY = 'loginPromptDismissed';
    const DISMISSED_DURATION = 24 * 60 * 60 * 1000; // 24 hours
    
    const resetTimer = () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      
      // Only set timer if user is not logged in and prompt not dismissed
      if (!store.isUserLoggedIn && !isPromptDismissed()) {
        inactivityTimer = setTimeout(() => {
          if (!store.isUserLoggedIn) { // Check again before showing
            showPrompt.value = true;
          }
        }, INACTIVITY_TIMEOUT);
      }
    };
    
    const isPromptDismissed = () => {
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (dismissed) {
        const dismissedTime = parseInt(dismissed, 10);
        if (Date.now() - dismissedTime < DISMISSED_DURATION) {
          return true;
        }
      }
      return false;
    };
    
    const dismiss = () => {
      showPrompt.value = false;
      localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    };
    
    const handleAuth = async () => {
      error.value = '';
      try {
        if (isSignUp.value) {
          await createUserWithEmailAndPassword(auth, email.value, password.value);
        } else {
          await signInWithEmailAndPassword(auth, email.value, password.value);
        }
        await store.userEnter();
        email.value = '';
        password.value = '';
        showPrompt.value = false;
      } catch (err) {
        error.value = err.message;
      }
    };
    
    const handleSocialSignIn = async (provider) => {
      error.value = '';
      try {
        let authProvider;
        switch (provider) {
          case 'google':
            authProvider = new GoogleAuthProvider();
            break;
          case 'github':
            authProvider = new GithubAuthProvider();
            break;
        }
        await signInWithPopup(auth, authProvider).then(
          (userCred) => {
            store.userEnter();
            showPrompt.value = false;
          }
        );
      } catch (err) {
        console.error('Auth error details:', err.code, err);
        if (err.code === 'auth/account-exists-with-different-credential') {
          // Get the email from the error
          const email = err.customData?.email;
          if (email) {
            // Check if we can sign in with Google instead
            error.value = `An account with email ${email} already exists. Try signing in with Google or email instead.`;
          } else {
            error.value = 'An account already exists with the same email address but different sign-in credentials. Try signing in using another method.';
          }
        } else {
          error.value = err.message;
        }
      }
    };
    
    // Watch for auth state changes to hide prompt if user logs in
    const unwatch = watch(
      () => store.isUserLoggedIn, 
      (isLoggedIn) => {
        if (isLoggedIn) {
          showPrompt.value = false;
        }
      }
    );
    
    onMounted(() => {
      // Check if already logged in - don't show prompt in that case
      if (store.isUserLoggedIn) {
        showPrompt.value = false;
        return;
      }
      
      // Set up user activity tracking for login prompt
      const activityEvents = ['mousedown', 'keypress', 'scroll', 'touchstart'];
      activityEvents.forEach(event => {
        window.addEventListener(event, resetTimer);
      });
      
      resetTimer();
    });
    
    onBeforeUnmount(() => {
      const activityEvents = ['mousedown', 'keypress', 'scroll', 'touchstart'];
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
      
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      
      // Remove watcher
      if (unwatch) {
        unwatch();
      }
    });
    
    return {
      email,
      password,
      isSignUp,
      error,
      showEmailForm,
      showPrompt,
      dismiss,
      handleAuth,
      handleSocialSignIn
    };
  }
};
</script>

<style scoped>
</style> 