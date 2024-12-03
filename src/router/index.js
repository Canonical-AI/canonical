import { createRouter, createWebHistory} from 'vue-router'
import Home from '../components/Home.vue'
import Login from '../components/Login.vue'
import Chat from '../components/chat/Chat.vue'
import Help from '../components/info/Help.vue'
import About from '../components/info/About.vue'
// import DocumentDetail from '../components/DocumentDetail.vue';
import DocumentCreate from '../components/document/DocumentCreate.vue';
import ProjectConfig from '../components/settings/ProjectConfig.vue';
import UsersSettings from '../components/settings/UsersSettings.vue';
import {User} from "../services/firebaseDataService";
import store from '../store';
import TaskOverview from '../components/tasks/TaskOverview.vue';


async function checkAuth(to, from, next) {

  if(!store.getters.isUserLoggedIn){
    await store.dispatch('enter')
  }

  if (store.getters.isUserLoggedIn) {
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
    component: Login
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
    path: '/settings/project/:id?',
    name: 'ProjectSetup',
    component: ProjectConfig,
    props: (route) => ({ id: route.params.id}),
    beforeEnter: checkAuth
  },
  {
    path: '/settings/user',
    name: 'UsersSettings',
    component: UsersSettings
  },
  {
    path: '/logout',
    name: 'logout',
    component: () => {
      User.logout();
      this.$store.commit('logout')
      this.$router.push('/')
    }
  },
]


const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
