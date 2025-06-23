<template>
  <div class="login-screen-container">
    <!-- WebGL Background -->
    <div ref="backgroundContainer" class="background-container">
      <img ref="backgroundImage" src="/login-background.avif" alt="" class="background-image-hidden" />
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
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';

import { 
  getAuth, 
  GoogleAuthProvider, 
  GithubAuthProvider, 
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { firebaseApp } from '../../firebase.js';
import { useMainStore } from '../../store/index.js';
import { 
  Scene, 
  OrthographicCamera, 
  WebGLRenderer, 
  PlaneGeometry, 
  ShaderMaterial, 
  Mesh, 
  TextureLoader,
  Vector2 
} from 'three';

export default {
  name: 'LoginScreen',
  setup() {
    const router = useRouter();
    const store = useMainStore();
    const auth = getAuth(firebaseApp);
    
    const selectedOption = ref(null);
    const error = ref('');
    const backgroundContainer = ref(null);
    const backgroundImage = ref(null);
    
    // Three.js scene variables
    let scene, camera, renderer, planeMesh;
    let animationId = null;
    
    // Animation state
    let animationTime = 0;
    
    const ANIMATION_CONFIG = {
      waveIntensity: 0.060,
      timeSpeed: 0.008
    };
    
    // Check for signup query parameter
    const route = useRoute();
    if (route.query.signup === 'true') {
      selectedOption.value = 'signup';
    }
    
    // Watch for user authentication changes and redirect when logged in
    watch(
      () => [store.isUserLoggedIn, store.loadingUser],
      ([isLoggedIn, loadingUser]) => {
        // Only redirect when loading is complete and user is logged in
        if (!loadingUser && isLoggedIn) {
          router.push('/');
        }
      },
      { immediate: true }
    );
    
    // Login form data
    const loginEmail = ref('');
    const loginPassword = ref('');
    
    // Signup form data
    const signupEmail = ref('');
    const signupPassword = ref('');
    const confirmPassword = ref('');
    
    // Shaders
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    
    const fragmentShader = `
      uniform float u_time;
      uniform vec2 u_mouse;
      uniform float u_intensity;
      uniform sampler2D u_texture;
      varying vec2 vUv;

      void main() {
        vec2 uv = vUv;
        float wave1 = sin(uv.x * 10.0 + u_time * 0.5 + u_mouse.x * 5.0) * u_intensity;
        float wave2 = sin(uv.y * 12.0 + u_time * 0.8 + u_mouse.y * 4.0) * u_intensity;
        float wave3 = cos(uv.x * 8.0 + u_time * 0.5 + u_mouse.x * 3.0) * u_intensity;
        float wave4 = cos(uv.y * 9.0 + u_time * 0.7 + u_mouse.y * 3.5) * u_intensity;

        uv.y += wave1 + wave2;
        uv.x += wave3 + wave4;
        
        gl_FragColor = texture2D(u_texture, uv);
      }
    `;
    
    const initializeScene = (texture) => {
      const container = backgroundContainer.value;
      if (!container) {
        console.warn('Container not available for Three.js initialization');
        return;
      }
      
      // Ensure container has dimensions
      const width = container.offsetWidth || window.innerWidth;
      const height = container.offsetHeight || window.innerHeight;
      
      if (width === 0 || height === 0) {
        console.warn('Container has no dimensions, retrying...');
        setTimeout(() => initializeScene(texture), 100);
        return;
      }
      
      // Camera setup - use orthographic camera for full coverage
      camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
      camera.position.z = 1;
      
      // Scene creation
      scene = new Scene();
      
      // Uniforms
      const shaderUniforms = {
        u_time: { type: "f", value: 1.0 },
        u_mouse: { type: "v2", value: new Vector2(0.5, 0.5) },
        u_intensity: { type: "f", value: ANIMATION_CONFIG.waveIntensity },
        u_texture: { type: "t", value: texture }
      };
      
      // Create a plane mesh that covers the full viewport
      planeMesh = new Mesh(
        new PlaneGeometry(2, 2),
        new ShaderMaterial({
          uniforms: shaderUniforms,
          vertexShader,
          fragmentShader
        })
      );
      
      // Add mesh to the scene
      scene.add(planeMesh);
      
      // Renderer
      renderer = new WebGLRenderer({ 
        alpha: false, 
        antialias: true,
        preserveDrawingBuffer: false,
        powerPreference: "high-performance"
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      
      // Clear any existing canvas
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      
      // Create canvas
      container.appendChild(renderer.domElement);
      
      // Start animation
      animateScene();
      
    };
    
    const animateScene = () => {
      if (!planeMesh || !renderer) return;
      
      animationId = requestAnimationFrame(animateScene);
      
      // Update animation time
      animationTime += ANIMATION_CONFIG.timeSpeed;
      
      // Create gentle looping movement for the wave center
      const loopX = 0.5 + Math.sin(animationTime * 0.3) * 1.6;
      const loopY = 0.5 + Math.cos(animationTime * 0.2) * 1.2;
      
      // Update uniforms
      const uniforms = planeMesh.material.uniforms;
      uniforms.u_intensity.value = ANIMATION_CONFIG.waveIntensity;
      uniforms.u_time.value = animationTime;
      uniforms.u_mouse.value.set(loopX, loopY);
      
      // Render
      renderer.render(scene, camera);
    };
    

    
    const handleResize = () => {
      if (!camera || !renderer || !backgroundContainer.value) return;
      
      const container = backgroundContainer.value;
      // For orthographic camera, we don't need to update aspect ratio
      // The camera already covers the full viewport with -1 to 1 coordinates
      renderer.setSize(container.offsetWidth, container.offsetHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };
    
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
    
    onMounted(() => {
      // Add resize listener first
      window.addEventListener('resize', handleResize);
      
      // Wait for next tick to ensure DOM is fully rendered
      nextTick(() => {
        // Small delay to ensure container has proper dimensions
        setTimeout(() => {
          const textureLoader = new TextureLoader();
          textureLoader.load('/login-background.avif', (texture) => {
            initializeScene(texture);
            // Force a resize after initialization to ensure proper sizing
            setTimeout(() => {
              handleResize();
            }, 100);
          });
        }, 50);
      });
    });
    
    onUnmounted(() => {
      // Cleanup
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      
      if (renderer) {
        renderer.dispose();
      }
      
      window.removeEventListener('resize', handleResize);
    });
    
    return {
      selectedOption,
      error,
      loginEmail,
      loginPassword,
      signupEmail,
      signupPassword,
      confirmPassword,
      backgroundContainer,
      backgroundImage,
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

/* WebGL Background */
.background-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  overflow: hidden;
  filter: blur(15px);
}

.background-container canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
  object-fit: cover;
  filter: saturate(80%);
}

.background-image-hidden {
  display: none;
}

.login-card {
  width: 100%;
  max-width: 900px;
  min-height: 500px;
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
  transform-origin: center;
  position: relative;
  z-index: 3;
  backdrop-filter: blur(20px);
  background: rgba(var(--v-theme-surface), 0.30) !important; 
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.options-panel {
  background-color: rgba(var(--v-theme-surface-variant), 0.2);
  border-right: 1px solid rgba(var(--v-theme-outline), 0.15);
  transition: all 0.3s ease;
  backdrop-filter: blur(15px);
}

.forms-panel {
  background-color: rgba(var(--v-theme-surface), 0.4);
  transition: all 0.3s ease;
  backdrop-filter: blur(15px);
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
    min-height: 100dvh;
    align-items: flex-start;
    padding: 12px 8px 20px 8px;
    overflow-y: auto;
  }
  
  .background-container canvas {
    filter: saturate(70%);
  }
  
  .login-card {
    max-width: 100%;
    min-height: auto;
    margin-top: auto;
    margin-bottom: auto;
    background: rgba(var(--v-theme-surface), 0.75) !important;
  }
  
  .options-panel {
    border-right: none;
    border-bottom: 1px solid rgba(var(--v-theme-outline), 0.15);
    background-color: rgba(var(--v-theme-surface-variant), 0.3);
  }
  
  .forms-panel {
    background-color: rgba(var(--v-theme-surface), 0.5);
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
  .option-btn:hover {
    transform: none;
  }
}
</style> 