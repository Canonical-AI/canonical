<template>
  <v-sheet class="mx-auto " max-width="400">
    <v-card v-if="isLoggedIn" class="pa-4">
      <v-card-title>Your Account</v-card-title>
      <v-card-text>
        <div class="text-subtitle-1 mb-4">
          <span class="text-grey">Email Address</span>
          <div class="text-h6">{{ userEmail }}</div>
        </div>
        <v-btn color="error" block @click="handleSignOut">Sign Out</v-btn>
      </v-card-text>
    </v-card>

    <v-card v-else class="">
      <v-card-text>
        <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
        
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
    </v-card>
  </v-sheet>
</template>

<script>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useMainStore } from '../store/index.js';
import { 
  getAuth, 
  GoogleAuthProvider, 
  GithubAuthProvider, 
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
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
    
    const isLoggedIn = computed(() => store.isUserLoggedIn);
    const userEmail = computed(() => store.user?.email || '');
    
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
        router.push('/');
      } catch (err) {
        error.value = err.message;
      }
    };
    
    const handleSignOut = async () => {
      try {
        await signOut(auth);
        store.userLogout();
        store.uiAlert({ type: 'info', message: 'Logged out successfully', autoClear: true });
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
            console.log(userCred);
            store.userEnter();
            router.push('/');
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
    
    return {
      email,
      password,
      isSignUp,
      error,
      isLoggedIn,
      userEmail,
      showEmailForm,
      handleAuth,
      handleSignOut,
      handleSocialSignIn
    };
  }
};
</script>

<style scoped>
</style>
