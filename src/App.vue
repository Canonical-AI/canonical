<template>
  <v-app :class="{ 'dark' : $vuetify.theme.dark}">
    <v-layout style="overflow: hidden;">
      <v-app-bar
      class="main-app-bar"
      density="compact"
      dark
      elevate-on-scroll
      >
      
      <!-- App Bar Background Elements -->
      <div class="canonical-background canonical-background--app-bar" :style="appBarBackgroundStyle"></div>
      <div class="canonical-grain canonical-grain--app-bar" :style="appBarGrainStyle"></div>

      <img src="/canonical-logo.svg" alt="Canonical Logo" width="50" height="50" class="ml-3" />
       
      <v-btn
          icon
          @click="isNavOpen = !isNavOpen"
          v-if="$vuetify.display.mobile"
        >
          <v-icon>mdi-menu</v-icon>
      </v-btn>
      
      
        <v-app-bar-title>
          <v-btn variant="text" to="/"> Canonical </v-btn>
        </v-app-bar-title>
        <v-spacer v-if="!$vuetify.display.mobile"></v-spacer>

        <!-- might use a speeddial component here later -->

        <v-btn-toggle v-model="toggle_exclusive">
          <v-menu 
            class="user-menu"
            offset-y>
            <template v-slot:activator="{ props }">
              <v-btn variant ="plain" icon="mdi-image-filter-hdr" v-bind="props"></v-btn>
            </template>
             <v-list>
                <v-list-item>
                  <p class="text-medium-emphasis">Switch Theme</p>
                </v-list-item>
                <v-list-item
                  v-for="theme in themes"
                  :key="theme"
                  @click="switchTheme(theme)"
                  density="compact"
                >
                  <v-list-item-title>{{theme}}</v-list-item-title>
                </v-list-item>
            </v-list>
          </v-menu>
        </v-btn-toggle>
          

        <v-menu
          v-if='$store.isUserLoggedIn === false'
          :close-on-content-click = "false"
          v-model="loginMenuOpen"
          offset-y>
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props">
              Enter
          </v-btn>
          </template>
          <Login @login-success="loginMenuOpen=false"></Login>
        </v-menu>

        <v-menu
        v-if='$store.isUserLoggedIn === true && $store.user.email'
        class="user-menu w-auto"
        offset-overflow
        left
        close-on-content-click>
            <template v-slot:activator="{ props }">
              <v-avatar
                  size="32"
                  color="black"
                  v-bind="props">
                <span
                  class="white--text text-h5">
                  {{$store.user.email[0].toUpperCase()}}</span>
                </v-avatar>
            </template>
            <v-list density="compact" variant="plain">
              <v-list-item>
                <p class="text-medium-emphasis">Signed in as</p>
              </v-list-item>
              <v-list-item>
                <p v-if="$store.user.email">{{$store.user.email.split("@")[0]}}</p>
                <p v-else>No Email</p>
              </v-list-item>
              <v-list-item
                v-for="(item, index) in ['logout']"
                :key="index"
                variant="plain"
              >
                <v-list-item-title variant="contained-text" v-if='$store.isUserLoggedIn === true' @click="logout">
                    Logout
                </v-list-item-title>
              </v-list-item>
            </v-list>
        </v-menu>

      </v-app-bar>

      <v-navigation-drawer 
        rail
        :permanent = "!$vuetify.display.mobile || isNavOpen"
        app
        v-model="isNavOpen"
        >
        <v-list
          density="compact"
          nav>
          <v-list-item @click.stop="toggleDrawer('document')" prepend-icon="mdi-folder-multiple" value="dashboard"></v-list-item>
          <v-list-item @click.stop="toggleDrawer('chat')" v-if="$store.canAccessAi" :disabled="!$store.isUserLoggedIn">
            <template v-slot:prepend>
              <v-badge dot color="success">
                <v-icon icon="mdi-forum"/>
              </v-badge>
            </template>
        </v-list-item>
        <v-list-item prepend-icon="mdi-checkbox-multiple-marked" value="tasks" @click.stop="$router.push('/tasks')"></v-list-item>
        <v-spacer/>
       </v-list>

       <template v-slot:append>
        <v-list-item @click.stop="helpDialog = true" prepend-icon="mdi-help-circle"></v-list-item>
        <v-list-item @click.stop="toggleDrawer('settings')" prepend-icon="mdi-cog"></v-list-item>
       </template>

      </v-navigation-drawer>

      <v-navigation-drawer 
        v-model="isDrawerOpen" 
        :temporary="drawer !== null" 
        :permanent = "!$vuetify.display.mobile"
        app 
        >

        <v-window v-model="drawer">
          <v-window-item transition="slide-x-reverse-transition" value="document">
            <DocumentTree/>
          </v-window-item>
          <v-window-item transition="slide-x-reverse-transition" value="chat">
            <ChatNav/>
          </v-window-item>
          <v-window-item transition="slide-x-reverse-transition" value="settings">
            <SettingsNav/>
          </v-window-item>
        </v-window>
      </v-navigation-drawer>

      <v-main ref="mainContent" style="overflow-y: auto; max-height: 100vh;">
        <router-view v-if="$route.name === 'Chat'" ref="routerView" @scrollToBottom="scrollToBottom" />
        <router-view v-else ref="routerView"  />
        <div ref="bottomElement"></div>
      </v-main>

            <v-snackbar 
        v-for="alert in infoAlerts"
        class="text-center transition-opacity duration-300 ease-in-out"
        :key="alert.time || alert.timestamp"
        v-model="alert.show"
        timeout="5000"
        :color='alert.color ? alert.color : "success"' 
        elevation="24"
        >
        {{alert.message }}
      </v-snackbar>

      <div
        v-for="alert in nonInfoAlerts"
        :key="alert.time || alert.timestamp"
        >
        <v-snackbar
          class="text-center transition-opacity duration-300 ease-in-out snackbar-solid"
          :key="`snackbar-${alert.time || alert.timestamp}`"
          v-model="alert.show"
          density="compact"
          :color="alert.type || 'error'"
            > 
          <div class="text-subtitle-1 pb-2">{{ alert.message }}</div>
          <p class="text-xs">
            {{ new Date(alert.time).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' }) }}
          </p>

          <template v-slot:actions>
            <v-btn
              variant="text"
              @click="dismissAlert(alert)"
              icon="mdi-close"
            >
            </v-btn>
          </template>

        </v-snackbar> 
      </div>

      <!-- Pending Invitations Dialog (only for existing users with manual invitations) -->
      <v-dialog 
        v-model="showPendingInvitationsDialog" 
        max-width="600" 
        persistent
        v-if="$store.pendingInvitations.length > 0 && !$store.pendingInvitationsDismissed && $store.isUserLoggedIn && !isNewUserSession"
      >
        <v-card>
          <v-card-title class="d-flex justify-space-between align-center">
            <div>
              <v-icon left>mdi-email</v-icon>
              Pending Project Invitations
            </div>
            <v-btn 
              icon="mdi-close" 
              variant="text" 
              size="small"
              @click="dismissPendingInvitations"
            ></v-btn>
          </v-card-title>
          
          <v-card-text>
            <v-alert type="info" class="mb-4">
              You have {{ $store.pendingInvitations.length }} pending project invitation{{ $store.pendingInvitations.length !== 1 ? 's' : '' }}.
            </v-alert>
            
            <PendingInvitations 
              :compact="true" 
              :show-when-empty="false"
              :show-count="false"
              @invitation-accepted="handleInvitationAccepted"
            />
          </v-card-text>
          
          <v-card-actions class="justify-space-between">
            <v-btn 
              variant="text" 
              @click="dismissPendingInvitations"
            >
              Dismiss for now
            </v-btn>
            <v-btn 
              color="primary"
              variant="text"
              @click="goToUserSettings"
            >
              View in Settings
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="isRegisterDialogOpen" max-width="500">
        <v-card>
          <v-card-title>Login</v-card-title>
          <Login @login-success="isRegisterDialogOpen = false"/>
          <!-- todo: add a Welcome message when succesfully logged in -->
          <v-card-actions>
            <v-btn color="primary" @click="tryDemo()">Try Demo</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="isNewUser" max-width="75%">
        <GetStarted @close="isNewUser = false"/>
      </v-dialog>

      <v-dialog v-model="helpDialog" max-width="400">
        <v-card>
          <v-card-title>Help</v-card-title>
          <v-card-text>
            Contact at <a class="text-blue-500 underline hover:text-blue-700" href="https://github.com/Canonical-AI/.github" target="_blank">GitHub <v-icon>mdi-arrow-right</v-icon> </a>
          </v-card-text>
          <v-card-actions>
            <v-btn @click="helpDialog = false">Close</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="welcomeDialog" max-width="500">
        <v-card>
          <v-card-title>Welcome to Canonical 👋</v-card-title>
          <v-card-text>
            <p>We're glad to have you onboard!</p>
            <p>Check out the demo or <span class="text-orange cursor-pointer underline" @click="$router.push('/login?signup=true'); welcomeDialog = false">register for free</span> to get started</p>
            <v-btn 
              class="text-none"
              prepend-icon="mdi-rocket-launch"
              color="primary" 
              @click="$router.push('/document/wv2PNNrm32mTVbtZexcs'); welcomeDialog = false">
                Demo - Canonical Product Vision
              </v-btn>
          </v-card-text>
          <v-card-actions>
            <v-btn class="text-none" variant="text" href="https://github.com/Canonical-AI/.github">Documentation <v-icon>mdi-arrow-right</v-icon></v-btn>
            <v-btn class="text-none" variant="elevated" color="primary" @click="$router.push('/login?signup=true'); welcomeDialog = false"> Register for free</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- Loading Modal -->
      <v-dialog 
        v-model="loadingModal.show" 
        max-width="400"
        persistent
        no-click-animation
      >
        <v-card class="text-center pa-6">
          <v-card-text>
            <v-progress-circular
              indeterminate
              size="64"
              color="primary"
              class="mb-4"
            ></v-progress-circular>
            <div class="text-h6 mb-2">Loading...</div>
            <div class="text-body-2 text-medium-emphasis">
              {{ loadingModal.message }}
            </div>
          </v-card-text>
        </v-card>
      </v-dialog>

    </v-layout>
  </v-app>
</template>

<script>
import {User} from "./services/firebaseDataService";
import { useBackgroundEffects } from './composables/useBackgroundEffects.js';
import ChatNav from './components/chat/ChatNav.vue'
import DocumentTree from "./components/document/DocumentTree.vue";
import Login from "./components/auth/Login.vue";
import SettingsNav from "./components/settings/SettingsNav.vue";
import GetStarted from "./components/settings/GetStarted.vue";
import PendingInvitations from "./components/settings/PendingInvitations.vue";
import { logEvent } from "firebase/analytics";
import { analytics } from "./firebase";
import { useEventWatcher } from './composables/useEventWatcher';

export default {
  components: {
    DocumentTree,
    ChatNav,
    SettingsNav,
    Login,
    GetStarted,
    PendingInvitations
  }, 
  name: 'App',
  data: () => ({
    toggle_exclusive: 0,
    selection:[],
    items:[],
    filter: '',
    drawer: null,
    loginMenuOpen: false,
    isRegisterDialogOpen: false,
    isNewUser: false,
    helpDialog: false,
    welcomeDialog: false,
    isNavOpen: true,
    showPendingInvitationsDialog: true,
    isNewUserSession: false,
    loadingModal: {
      show: false,
      message: '',
      currentId: null
    }

  }),
  setup(){
    const { theme, backgroundStyle: appBarBackgroundStyle, grainStyle: appBarGrainStyle } = useBackgroundEffects({
      backgroundBlur: 8,
      backgroundBrightness: 0.7,
      backgroundContrast: 1.1,
      grainOpacity: 0.0 // User set this to 0 in their changes
    });
    
    return { theme, appBarBackgroundStyle, appBarGrainStyle };
  },
  async mounted() {

    this.isNavOpen = !this.$vuetify.display.mobile

  },
  watch: {

    '$store.isUserLoggedIn': {
      handler(newValue) {
        if (newValue === true) {
          this.loginMenuOpen = false;
          // Check if this is a new user session (user created in last 5 minutes)
          const userCreatedDate = this.$store.user?.createdDate;
          if (userCreatedDate) {
            const createdAt = userCreatedDate.toDate ? userCreatedDate.toDate() : new Date(userCreatedDate);
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            this.isNewUserSession = createdAt > fiveMinutesAgo;
          }
        } else {
          this.loginMenuOpen = true;
          this.isNewUserSession = false;
        }
      },
      immediate: true
    },
    '$store.pendingInvitations.length': {
      handler(newCount, oldCount) {
        // Show dialog again if new invitations come in
        if (newCount > oldCount && newCount > 0) {
          this.showPendingInvitationsDialog = true;
          this.$store.userShowPendingInvitations();
        }
      }
    },
    '$store.user.defaultProject': {
      handler(newDefaultProject) {
        // If user gets a default project and the GetStarted modal is open, close it
        if (newDefaultProject && this.isNewUser) {
          this.isNewUser = false;
          this.$store.uiAlert({ 
            type: 'success', 
            message: 'Project setup complete! Welcome to your project.', 
            autoClear: true 
          });
          
          // Redirect to home page to show the project
          if (this.$route.path === '/new-user') {
            this.$router.push('/');
          }
        } else if (newDefaultProject === null && this.$store.loading.user === false && this.$store.isUserLoggedIn === true) {
          this.isNewUser = true;
          this.$router.push('/new-user');
        }
      },
      immediate: true
    },
    $route: {
      handler(to) {
        if (to.path.includes('document')) {
          this.drawer = 'document';
        }
        if (to.path.includes('chat')) {
          this.drawer = 'chat';
        }
        // Close drawer when on login screen
        if (to.path === '/login') {
          this.drawer = null;
          this.loginMenuOpen = false;
        }
        // Open dialog when route is /register
        if (to.path === '/register') {
          this.isRegisterDialogOpen = true;
        }
        if (to.path === '/new-user') {
          this.isNewUser = true;
        }
        if (to.path === '/demo') {
          this.welcomeDialog = true;
          this.tryDemo()
        }
        if (analytics) {
          // Track page views
          logEvent(analytics, 'page_view', {
            page_path: to.path,
            page_title: document.title || to.name,
            page_location: window.location.href
          });
        }
      },
      immediate: true,
    },


  },
  computed:{
    nonInfoAlerts(){
      return this.$store.globalAlerts
        .filter(a => a.show === true && a.type !== 'info')
        .sort((a, b) => a.time - b.time);
    },
    infoAlerts(){
      return this.$store.globalAlerts.filter(a => a.show === true && a.type === 'info');
    },
    project(){
      return this.$store.project.id;
    },
    themes(){
      return Object.keys(this.$vuetify.theme.themes).filter(theme => theme !== 'light' && theme !== 'dark');
    },
    isDrawerOpen: {
      get() {
        return this.drawer !== null && this.isNavOpen; // Check if navOpen is true
      },
      set(value) {
        this.drawer = value ? 'document' : null; // or 'chat' based on your logic
      }
    },
  },
  methods: {
    logout(){
      this.$store.userLogoutAction()
    },
    switchTheme(themeName) {
      const darkMode = this.$vuetify.theme.themes[themeName].dark;
      this.theme.global.name.value = themeName; 
      
      document.documentElement.setAttribute(
        "data-theme",
        darkMode ? "dark" : "light"
      );
      document.documentElement.classList.toggle("dark", darkMode);
      localStorage.setItem('selectedTheme', themeName);
    },
    toggleDrawer(drawerType) {
      if (this.drawer === drawerType){
        this.drawer = null
        return
      }
      this.drawer = drawerType;
    },
    scrollToBottom() {
      this.$nextTick(() => {
        // console.log('scrollToBottom')

        const lastElement = this.$refs.bottomElement
        lastElement?.scrollIntoView({ behavior: 'instant' });

      });
    },
    async tryDemo(){
      this.isRegisterDialogOpen = false;
      await this.$store.projectSet(import.meta.env.VITE_DEFAULT_PROJECT_ID)
  
      await this.$store.documentsGetAll();

    },
    dismissAlert(alert) {
      alert.show = false;
    },
    dismissPendingInvitations() {
      this.showPendingInvitationsDialog = false;
      this.$store.userDismissPendingInvitations();
    },
    handleInvitationAccepted({ invitation, projectId }) {
      // Close dialog if no more invitations
      if (this.$store.pendingInvitations.length === 0) {
        this.showPendingInvitationsDialog = false;
      }
      
      // Redirect to home page for consistency
      this.$router.push('/');
    },
    goToUserSettings() {
      this.dismissPendingInvitations();
      this.$router.push('/settings/user');
    }
    
  },
  created() {
    // Retrieve the theme choice from localStorage
    const savedTheme = localStorage.getItem('selectedTheme');
    if (savedTheme) {
      this.switchTheme(savedTheme);
    }
    // Initialize analytics tracking
    if (analytics) {
      // Log app_open event
      logEvent(analytics, 'app_open');
    }

    this.loadingModalWatcher = useEventWatcher(this.$eventStore, 'loading-modal', (payload) => {
      if (payload.show === true) {
        // Show modal and store the UUID
        this.loadingModal = {
          show: true,
          message: payload.message || '',
          currentId: payload.id || null
        };
      } else if (payload.show === false) {
        // Only close if UUID matches existing or if existing is null (backward compatibility)
        if (payload.id === this.loadingModal.currentId || this.loadingModal.currentId === null) {
          this.loadingModal = {
            show: false,
            message: '',
            currentId: null
          };
        }
      }
    });
  }
}
</script>

<style lang="scss">


.v-app{
  background-color: rgb(var(--v-theme-background));
}

.main-app-bar{
  position: relative;
  overflow: hidden;
  background: rgba(var(--v-theme-surface), 0.8) !important;
  backdrop-filter: blur(10px);
}

.user-menu{
   .v-overlay__content{
    right: 0px !important;
    left: auto !important;
    border: solid thin lightgrey;
  }
}

.v-avatar{
  margin:4px;
}

.badge{
  left:-10px;
}


.full-width-container {
  width: 100%;
}

.input-container {
  display: flex;
  justify-content: flex-end; /* Aligns items to the right */
  gap: 16px; /* Space between items */
}

.document-item {
  max-width: 200px; /* Set a fixed width for the selects */
}

/* width */
::-webkit-scrollbar {
  width: 4px;
  height: 8px;
  border-radius: 4px;
}

/* Track */
::-webkit-scrollbar-track {
  background: var(--v-theme-background);
}

/* Handle */
::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 10px;
}

/* Handle on hover */
::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
