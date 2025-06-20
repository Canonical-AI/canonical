<template>
  <div class="login-screen-container">
    <!-- Animated Background -->
    <div class="animated-background">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
      <div class="blob blob-3"></div>
      <div class="blob blob-4"></div>
      <div class="blob blob-5"></div>
      <div class="blur-overlay"></div>
    </div>
    
    <v-container class="d-flex align-center justify-center pa-0 position-relative">
      <v-card 
        class="login-card" 
        elevation="8"
      >
        <v-row no-gutters class="fill-height">
          <!-- Left Side - Options -->
          <v-col cols="12" md="5" class="options-panel">
            <div class="pa-6 pa-md-8 d-flex flex-column justify-center fill-height">
              <div class="text-center mb-6 mb-md-8">
                <v-img src="/canonical-logo.svg" alt="Canonical" max-width="60" class="mx-auto mb-4"></v-img>
                <h1 class="text-h5 text-md-h4 font-weight-light mb-2">Welcome to Canonical</h1>
                <p class="text-body-2 text-md-body-1 text-grey">Choose how you'd like to get started</p>
              </div>

              <div class="d-flex flex-column gap-3 gap-md-4">
                <v-btn
                  :variant="selectedOption === 'login' ? 'flat' : 'outlined'"
                  :color="selectedOption === 'login' ? 'primary' : ''"
                  :size="$vuetify.display.mobile ? 'default' : 'large'"
                  block
                  @click="selectedOption = 'login'"
                  class="option-btn"
                >
                  <v-icon start>mdi-login</v-icon>
                  Sign In
                </v-btn>

                <v-btn
                  :variant="selectedOption === 'signup' ? 'flat' : 'outlined'"
                  :color="selectedOption === 'signup' ? 'success' : ''"
                  :size="$vuetify.display.mobile ? 'default' : 'large'"
                  block
                  @click="selectedOption = 'signup'"
                  class="option-btn"
                >
                  <v-icon start>mdi-account-plus</v-icon>
                  Create Account
                </v-btn>

                <v-btn
                  :variant="selectedOption === 'demo' ? 'flat' : 'outlined'"
                  :color="selectedOption === 'demo' ? 'info' : ''"
                  :size="$vuetify.display.mobile ? 'default' : 'large'"
                  block
                  @click="selectedOption = 'demo'"
                  class="option-btn"
                >
                  <v-icon start>mdi-play-circle</v-icon>
                  Try Demo
                </v-btn>
              </div>
            </div>
          </v-col>

          <!-- Right Side - Forms -->
          <v-col cols="12" md="7" class="forms-panel">
            <div class="pa-6 pa-md-8 d-flex flex-column justify-center fill-height">
              <Transition name="slide-fade" mode="out-in">
                <!-- Sign In Form -->
                <div v-if="selectedOption === 'login'" key="login">
                  <h2 class="text-h6 text-md-h5 mb-2">Sign In</h2>
                  <p class="text-body-2 text-grey mb-4 mb-md-6">Access your existing account</p>
                  
                  <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
                  
                  <div class="d-flex flex-column gap-2 gap-md-3 mb-4">
                    <v-btn
                      color="primary"
                      variant="flat"
                      block
                      :size="$vuetify.display.mobile ? 'default' : 'large'"
                      @click="handleSocialSignIn('google')"
                    >
                      <v-icon start>mdi-google</v-icon>
                      Continue with Google
                    </v-btn>
                    
                    <v-btn
                      color="primary"
                      variant="flat"
                      block
                      :size="$vuetify.display.mobile ? 'default' : 'large'"
                      @click="handleSocialSignIn('github')"
                    >
                      <v-icon start>mdi-github</v-icon>
                      Continue with GitHub
                    </v-btn>
                  </div>

                  <v-divider class="my-4">
                    <span class="text-caption text-grey px-2">OR</span>
                  </v-divider>

                  <v-form @submit.prevent="handleSignIn">
                    <v-text-field
                      v-model="loginEmail"
                      label="Email"
                      type="email"
                      variant="outlined"
                      density="compact"
                      required
                      class="mb-3"
                    ></v-text-field>
                    
                    <v-text-field
                      v-model="loginPassword"
                      label="Password"
                      type="password"
                      variant="outlined"
                      density="compact"
                      required
                      class="mb-4"
                    ></v-text-field>
                    
                    <v-btn 
                      color="primary" 
                      variant="tonal"
                      block 
                      :size="$vuetify.display.mobile ? 'default' : 'large'"
                      type="submit"
                    >
                      Sign In
                    </v-btn>
                  </v-form>
                </div>

                <!-- Sign Up Form -->
                <div v-else-if="selectedOption === 'signup'" key="signup">
                  <h2 class="text-h6 text-md-h5 mb-2">Create Account</h2>
                  <p class="text-body-2 text-grey mb-4 mb-md-6">Start your documentation journey</p>
                  
                  <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>
                  
                  <div class="d-flex flex-column gap-2 gap-md-3 mb-4">
                    <v-btn
                      color="primary"
                      variant="flat"
                      block
                      :size="$vuetify.display.mobile ? 'default' : 'large'"
                      @click="handleSocialSignIn('google')"
                    >
                      <v-icon start>mdi-google</v-icon>
                      Sign up with Google
                    </v-btn>
                    
                    <v-btn
                      color="primary"
                      variant="flat"
                      block
                      :size="$vuetify.display.mobile ? 'default' : 'large'"
                      @click="handleSocialSignIn('github')"
                    >
                      <v-icon start>mdi-github</v-icon>
                      Sign up with GitHub
                    </v-btn>
                  </div>

                  <v-divider class="my-4">
                    <span class="text-caption text-grey px-2">OR</span>
                  </v-divider>

                  <v-form @submit.prevent="handleSignUp">
                    <v-text-field
                      v-model="signupEmail"
                      label="Email"
                      type="email"
                      variant="outlined"
                      density="compact"
                      required
                      class="mb-3"
                    ></v-text-field>
                    
                    <v-text-field
                      v-model="signupPassword"
                      label="Password"
                      type="password"
                      variant="outlined"
                      density="compact"
                      required
                      class="mb-3"
                    ></v-text-field>

                    <v-text-field
                      v-model="confirmPassword"
                      label="Confirm Password"
                      type="password"
                      variant="outlined"
                      density="compact"
                      required
                      class="mb-4"
                    ></v-text-field>
                    
                    <v-btn 
                      color="success" 
                      variant="flat"
                      block 
                      :size="$vuetify.display.mobile ? 'default' : 'large'"
                      type="submit"
                    >
                      Create Account
                    </v-btn>
                  </v-form>
                </div>

                <!-- Try Demo -->
                <div v-else-if="selectedOption === 'demo'" key="demo">
                  <h2 class="text-h6 text-md-h5 mb-2">Try Demo</h2>
                  <p class="text-body-2 text-grey mb-4 mb-md-6">Explore without creating an account</p>
                  
                  <v-alert type="info" class="mb-4 mb-md-6">
                    <v-alert-title>Demo Mode</v-alert-title>
                    Experience Canonical with sample documents and limited features. 
                    No registration required!
                  </v-alert>
                  
                  <v-btn 
                    color="info" 
                    variant="flat"
                    block 
                    :size="$vuetify.display.mobile ? 'default' : 'large'"
                    @click="handleDemo"
                  >
                    <v-icon start>mdi-rocket-launch</v-icon>
                    Start Demo
                  </v-btn>
                </div>

                <!-- Default state -->
                <div v-else key="default" class="text-center">
                  <v-icon 
                    :size="$vuetify.display.mobile ? '60' : '80'" 
                    color="grey-lighten-2" 
                    class="mb-3 mb-md-4"
                  >
                    mdi-arrow-left
                  </v-icon>
                  <p class="text-body-1 text-md-h6 text-grey">Select an option to get started</p>
                </div>
              </Transition>
            </div>
          </v-col>
        </v-row>
      </v-card>
    </v-container>
  </div>
</template>

<script>
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useMainStore } from '../store/index.js';
import { 
  getAuth, 
  GoogleAuthProvider, 
  GithubAuthProvider, 
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { firebaseApp } from '../firebase';

export default {
  name: 'LoginScreen',
  setup() {
    const router = useRouter();
    const store = useMainStore();
    const auth = getAuth(firebaseApp);
    
    const selectedOption = ref(null);
    const error = ref('');
    
    // Check for signup query parameter
    const route = useRoute();
    if (route.query.signup === 'true') {
      selectedOption.value = 'signup';
    }
    
    // Login form data
    const loginEmail = ref('');
    const loginPassword = ref('');
    
    // Signup form data
    const signupEmail = ref('');
    const signupPassword = ref('');
    const confirmPassword = ref('');
    
    const handleSignIn = async () => {
      error.value = '';
      try {
        await signInWithEmailAndPassword(auth, loginEmail.value, loginPassword.value);
        await store.userEnter();
        router.push('/');
      } catch (err) {
        error.value = err.message;
      }
    };
    
    const handleSignUp = async () => {
      error.value = '';
      
      if (signupPassword.value !== confirmPassword.value) {
        error.value = 'Passwords do not match';
        return;
      }
      
      try {
        await createUserWithEmailAndPassword(auth, signupEmail.value, signupPassword.value);
        await store.userEnter();
        router.push('/new-user');
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
        await signInWithPopup(auth, authProvider);
        await store.userEnter();
        router.push('/');
      } catch (err) {
        console.error('Auth error details:', err.code, err);
        if (err.code === 'auth/account-exists-with-different-credential') {
          const email = err.customData?.email;
          if (email) {
            error.value = `An account with email ${email} already exists. Try signing in with Google or email instead.`;
          } else {
            error.value = 'An account already exists with the same email address but different sign-in credentials. Try signing in using another method.';
          }
        } else {
          error.value = err.message;
        }
      }
    };
    
    const handleDemo = async () => {
      try {
        await store.projectSet(import.meta.env.VITE_DEFAULT_PROJECT_ID);
        await store.documentsGetAll();
        router.push('/');
      } catch (err) {
        error.value = 'Failed to start demo. Please try again.';
      }
    };
    
    return {
      selectedOption,
      error,
      loginEmail,
      loginPassword,
      signupEmail,
      signupPassword,
      confirmPassword,
      handleSignIn,
      handleSignUp,
      handleSocialSignIn,
      handleDemo
    };
  }
};
</script>

<style scoped>
.login-screen-container {
  height: 100%;
  min-height: calc(100vh - 64px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  position: relative;
  overflow: hidden;
}

/* Animated Background */
.animated-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}

.blob {
  position: absolute;
  border-radius: 50%;
  animation: float 20s infinite linear;
  filter: none; /* Remove individual blur, we'll blur everything together */
}

.blob-1 {
  width: 350px;
  height: 350px;
  background: radial-gradient(circle, rgba(var(--v-theme-primary), 0.9), rgba(var(--v-theme-secondary), 0.4));
  top: -175px;
  left: -175px;
  animation-duration: 25s;
  animation-delay: 0s;
}

.blob-2 {
  width: 280px;
  height: 280px;
  background: radial-gradient(circle, rgba(var(--v-theme-success), 0.8), rgba(var(--v-theme-info), 0.7));
  top: 20%;
  right: -140px;
  animation-duration: 30s;
  animation-delay: -5s;
}

.blob-3 {
  width: 320px;
  height: 320px;
  background: radial-gradient(circle, rgba(var(--v-theme-secondary), 0.7), rgba(var(--v-theme-primary), 0.3));
  bottom: -160px;
  left: 10%;
  animation-duration: 35s;
  animation-delay: -10s;
}

.blob-4 {
  width: 240px;
  height: 240px;
  background: radial-gradient(circle, rgba(var(--v-theme-info), 0.9), rgba(var(--v-theme-success), 0.4));
  top: 60%;
  right: 15%;
  animation-duration: 28s;
  animation-delay: -15s;
}

.blob-5 {
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(var(--v-theme-primary), 0.9), rgba(var(--v-theme-secondary), 0.4));
  top: 15%;
  left: 25%;
  animation-duration: 22s;
  animation-delay: -8s;
}

/* Blur overlay that blends all blobs together */
.blur-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  backdrop-filter: blur(70px);
  z-index: 2;
  pointer-events: none;
}

@keyframes float {
  0%, 100% {
    transform: translate(0, 0) rotate(0deg) scale(1);
  }
  25% {
    transform: translate(40px, -60px) rotate(90deg) scale(1.1);
  }
  50% {
    transform: translate(-30px, 30px) rotate(180deg) scale(0.9);
  }
  75% {
    transform: translate(60px, 40px) rotate(270deg) scale(1.05);
  }
}

.login-card {
  width: 100%;
  max-width: 900px;
  min-height: 500px;
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
  transform-origin: center;
  position: relative;
  z-index: 3;
  backdrop-filter: blur(10px);
  background: rgba(var(--v-theme-surface), 0.95);
}

.options-panel {
  background-color: rgba(var(--v-theme-surface-variant), 0.4);
  border-right: 1px solid rgba(var(--v-theme-outline), 0.12);
  transition: all 0.3s ease;
  backdrop-filter: blur(5px);
}

.forms-panel {
  background-color: rgba(var(--v-theme-surface), 0.8);
  transition: all 0.3s ease;
  backdrop-filter: blur(5px);
}

.option-btn {
  height: 48px !important;
  text-transform: none !important;
  font-size: 0.95rem !important;
  justify-content: flex-start !important;
  transition: all 0.25s ease !important;
}

.option-btn:hover {
  transform: translateX(4px);
}

/* Slide transition */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.35s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.slide-fade-enter-from {
  transform: translateX(30px);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateX(-30px);
  opacity: 0;
}

/* Mobile optimizations */
@media (max-width: 959px) {
  .login-screen-container {
    min-height: 100vh;
    min-height: 100dvh; /* Use dynamic viewport height when supported */
    align-items: flex-start;
    padding: 12px 8px 20px 8px;
    overflow-y: auto;
  }
  
  .login-card {
    max-width: 100%;
    min-height: auto;
    margin-top: auto;
    margin-bottom: auto;
    background: rgba(var(--v-theme-surface), 0.98);
  }
  
  .options-panel {
    border-right: none;
    border-bottom: 1px solid rgba(var(--v-theme-outline), 0.12);
    background-color: rgba(var(--v-theme-surface-variant), 0.5);
  }
  
  .forms-panel {
    background-color: rgba(var(--v-theme-surface), 0.9);
  }
  
  .option-btn {
    height: 44px !important;
    font-size: 0.9rem !important;
  }
  
  .option-btn:hover {
    transform: none;
  }
  
  /* Faster transitions on mobile */
  .slide-fade-enter-active,
  .slide-fade-leave-active {
    transition: all 0.25s ease;
  }
}

/* Tablet breakpoint */
@media (max-width: 1264px) and (min-width: 960px) {
  .login-card {
    max-width: 800px;
  }
}

/* Large screen optimizations */
@media (min-width: 1265px) {
  .login-card {
    max-width: 950px;
    min-height: 550px;
  }
  
  .option-btn {
    height: 52px !important;
    font-size: 1rem !important;
  }
}

/* Additional mobile viewport fixes */
@media (max-width: 599px) {
  .login-screen-container {
    padding: 8px 4px 16px 4px;
  }
}

/* Reduce motion for users who prefer it */
@media (prefers-reduced-motion: reduce) {
  .blob-1, .blob-2, .blob-3, .blob-4, .blob-5 {
    animation: none;
  }
  
  .option-btn:hover {
    transform: none;
  }
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .blob-1 {
    width: 250px;
    height: 250px;
    top: -125px;
    left: -125px;
  }
  
  .blob-2 {
    width: 200px;
    height: 200px;
    right: -100px;
  }
  
  .blob-3 {
    width: 220px;
    height: 220px;
    bottom: -110px;
  }
  
  .blob-4 {
    width: 180px;
    height: 180px;
  }
  
  .blob-5 {
    width: 150px;
    height: 150px;
  }
  
  .blur-overlay {
    backdrop-filter: blur(20px);
  }
}
</style> 