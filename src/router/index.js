import { createRouter, createWebHistory} from 'vue-router'
import Home from '../components/Home.vue'
import Login from '../components/auth/Login.vue'
import LoginScreen from '../components/auth/LoginScreen.vue'
import Chat from '../components/chat/Chat.vue'
import Help from '../components/info/Help.vue'
import About from '../components/info/About.vue'
// import DocumentDetail from '../components/DocumentDetail.vue';
import DocumentCreate from '../components/document/DocumentCreate.vue';
import ProjectConfig from '../components/settings/ProjectConfig.vue';
import UsersSettings from '../components/settings/UsersSettings.vue';
import InvitationAccept from '../components/settings/InvitationAccept.vue';
import {User} from "../services/firebaseDataService";
import { useMainStore } from '../store/index.js';
import TaskOverview from '../components/tasks/TaskOverview.vue';


async function checkAuth(to, from, next) {
  const store = useMainStore();

  if(!store.isUserLoggedIn){
    await store.userEnter()
  }

  if (store.isUserLoggedIn) {
    next();
  } else {
    next('/login');
  }
}

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/document/:id', // Route for viewing a document
    name: 'DocumentDetail',
    component: DocumentCreate,
    props: (route) => ({ id: route.params.id})
  },
  {
    path: '/document/create-document', // Route for creating a new document
    name: 'DocumentCreate',
    component: DocumentCreate,
    props: (route) => ({ type: route.query.type}), // Pass query parameter as prop

  },
  {
    path: '/chat/:id?', // Route for viewing a document
    name: 'Chat',
    component: Chat,
    props: (route) => ({ id: route.params.id}),
    beforeEnter: checkAuth
  },
  {
    path: '/tasks',
    name: 'Tasks',
    component: TaskOverview
  },
  {
    path: '/about',
    name: 'About',
    component: About
  },
  {
    path: '/help',
    name: 'Help',
    component: Help
  },
  {
    path: '/login',
    name: 'login',
    component: LoginScreen
  },
  {
    path: '/register',
    name: 'Register',
    component: Home
  },
  {
    path: '/new-user',
    name: 'new-user',
    component: Home
  },
  {
    path: '/demo',
    name: 'demo',
    component: Home
  },
  {
    path: '/settings/project/:id?',
    name: 'ProjectSetup',
    component: ProjectConfig,
    props: (route) => ({ id: route.params.id}),
    beforeEnter: checkAuth
  },
  {
    path: '/settings/user',
    name: 'UsersSettings',
    component: UsersSettings,
    beforeEnter: checkAuth
  },
  {
    path: '/invite/:token',
    name: 'InvitationAccept',
    component: InvitationAccept,
    props: (route) => ({ token: route.params.token})
  },
  {
    path: '/logout',
    name: 'logout',
    component: () => {
      const store = useMainStore();
      User.logout();
      store.user.logout();
      // Navigation will be handled by the component
    }
  },
]


const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
