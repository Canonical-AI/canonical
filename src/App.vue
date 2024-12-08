<template>
  <v-app :class="{ 'dark' : $vuetify.theme.dark}">
    <v-layout style="overflow: hidden;">
      <v-app-bar
      class="main-app-bar"
      density="compact"
      dark
      elevate-on-scroll
      >

      <img src="/canonical-logo.svg" alt="Canonical Logo" width="50" height="50" class="ml-3" />
        <v-app-bar-title>
          <v-btn variant="text" to="/"> Canonical <strong>[BETA]</strong></v-btn>
        </v-app-bar-title>
        <v-spacer></v-spacer>

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
          class="w-auto user-menu"
          :close-on-content-click = "false"
          v-model="loginMenuOpen"
          offset-y>
          <template v-slot:activator="{ props }">
            <v-btn v-if='$store.getters.isUserLoggedIn === false' v-bind="props">
              Login
          </v-btn>
          </template>
          <Login @login-success="loginMenuOpen=false"></Login>
        </v-menu>


        <v-menu
        class="user-menu w-auto"
        offset-overflow
        left
        close-on-content-click>
            <template v-slot:activator="{ props }">
              <v-avatar
                  size="32"
                  color="black"
                  v-if='$store.getters.isUserLoggedIn === true && $store.state.user.email'
                  v-bind="props">
                <span
                  class="white--text text-h5">
                  {{$store.state.user.email[0].toUpperCase()}}</span>
                </v-avatar>
            </template>
            <v-list density="compact" variant="plain">
              <v-list-item>
                <p class="text-medium-emphasis">Signed in as</p>
              </v-list-item>
              <v-list-item>
                <p v-if="$store.state.user.email">{{$store.state.user.email.split("@")[0]}}</p>
                <p v-else>No Email</p>
              </v-list-item>
              <v-list-item
                v-for="(item, index) in ['logout']"
                :key="index"
                variant="plain"
              >
                <v-list-item-title variant="contained-text" v-if='$store.getters.isUserLoggedIn === true' @click="logout">
                    Logout
                </v-list-item-title>
              </v-list-item>
            </v-list>
        </v-menu>

      </v-app-bar>

      <v-navigation-drawer 
        rail
        permanent
        app
        >
        <v-list
          density="compact"
          nav>
          <v-list-item @click.stop="toggleDrawer('document')" prepend-icon="mdi-folder-multiple" value="dashboard"></v-list-item>
          <v-list-item @click.stop="toggleDrawer('chat')" v-if="$store.getters.canAccessAi" :disabled="!$store.getters.isUserLoggedIn">
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

      <v-navigation-drawer v-model="isDrawerOpen" :temporary="drawer !== null" app permanent>
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
        v-for="alert in alerts.filter(a => a.show === true && a.type === 'info')"
        class="text-center transition-opacity duration-300 ease-in-out"
        :key="alert"
        v-model="alert.show"
        timeout="5000"
        :color='alert.color ? alert.color : "success"' 
        elevation="24"
        >
        {{alert.message }}
      </v-snackbar>

      <div
        v-for="alert in alerts.filter(a => a.show === true && a.type != 'info').sort((a, b) => a.time - b.time)"
        >
        <v-snackbar
          class="text-center transition-opacity duration-300 ease-in-out snackbar-solid"
          :key="alert"
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
              @click="alert.show = false"
              icon="mdi-close"
            >
            </v-btn>
          </template>

        </v-snackbar> 
      </div>

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

    </v-layout>
  </v-app>
</template>

<script>
import {User} from "./services/firebaseDataService";
import { useTheme } from 'vuetify'
import ChatNav from './components/chat/ChatNav.vue'
import DocumentTree from "./components/document/DocumentTree.vue";
import Login from "./components/Login.vue";
import SettingsNav from "./components/settings/SettingsNav.vue";
import GetStarted from "./components/settings/GetStarted.vue";

export default {
  components: {
    DocumentTree,
    ChatNav,
    SettingsNav,
    Login,
    GetStarted
  }, 
  name: 'App',
  data: () => ({
    toggle_exclusive: 0,
    alerts:[],
    selection:[],
    items:[],
    filter: '',
    drawer: null,
    loginMenuOpen: false,
    isRegisterDialogOpen: false,
    isNewUser: false,
    helpDialog: false
  }),
  setup(){
    const theme = useTheme()
    return theme
  },
  async beforeCreate() {
    //await this.$store.commit('enter')
  },
  watch: {
    alerts_: {
      handler() {
        this.alerts = this.alerts_;
      },
      deep: true,
    },
    $route: {
      handler(to) {
        if (to.path.includes('document')) {
          this.drawer = 'document';
        }
        if (to.path.includes('chat')) {
          this.drawer = 'chat';
        }
        // Open dialog when route is /register
        if (to.path === '/register') {
          this.isRegisterDialogOpen = true;
        }
        if (to.path === '/new-user') {
          this.isNewUser = true;
        }
      },
      immediate: true,
    }
  },
  computed:{
    alerts_(){
      return this.$store.state.globalAlerts
    },
    project(){
      return this.$store.state.project.id;
    },
    themes(){
      return Object.keys(this.$vuetify.theme.themes).filter(theme => theme !== 'light' && theme !== 'dark');
    },
    isDrawerOpen: {
      get() {
        return this.drawer !== null;
      },
      set(value) {
        this.drawer = value ? 'document' : null; // or 'chat' based on your logic
      }
    },
  },
  methods: {
    logout(){
      User.logout()
    },
    switchTheme(themeName) {
      const darkMode = this.$vuetify.theme.themes[themeName].dark;
      this.global.name.value = themeName; 
      
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
    tryDemo(){
      this.isRegisterDialogOpen = false;
      this.$store.commit('setProject', import.meta.env.VITE_DEFAULT_PROJECT_ID)
      this.$store.dispatch('getDocuments')

    }
  },
  created() {
    // Retrieve the theme choice from localStorage
    const savedTheme = localStorage.getItem('selectedTheme');
    if (savedTheme) {
      this.switchTheme(savedTheme);
    }
  }
}
</script>

<style lang="scss">


.v-app{
  background-color: rgb(var(--v-theme-background));
}

.main-app-bar{
  //background: linear-gradient(42deg, #2C4560 0%, #4B7D6F 25%, #3A6054 50%, #3A5A7D 75%, #2D1F30 100%) !important;
  background: linear-gradient(42deg, 
  rgba(var(--v-theme-surface),1) 0%, 
  rgba(var(--v-theme-success),1) 45%, 
  rgba(var(--v-theme-secondary-darken-1),1) 56%, 
  rgba(var(--v-theme-primary),1) 78%, 
  rgba(var(--v-theme-surface),1) 100%) !important;

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
