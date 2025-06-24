import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import piniaPlugin from './plugins/piniaPlugin'
import { eventStore } from './store/eventStore'
import { useMainStore } from './store/index.js';
import VueGtag from "vue-gtag";
import dayjs from "dayjs";
import relativeTime from 'dayjs/plugin/relativeTime';
import 'vuetify/dist/vuetify.min.css'
import 'vuetify/styles'
import './main.css'
import { formatServerTimeStamp } from './utils';
import { fadeTransition, slideFadeTransition } from './utils/transitions';
import { marked } from 'marked';

document.documentElement.classList.toggle('dark');

// Global error handler for Milkdown private field errors
const originalConsoleError = console.error;
console.error = function(...args) {
  // Suppress the specific private field access error from Milkdown
  const errorString = args.join(' ');
  if (errorString.includes('Cannot read from private field') && 
      (errorString.includes('destroy') || errorString.includes('milkdown'))) {
    // Suppress this specific error
    return;
  }
  // Pass through other errors to the original console.error
  originalConsoleError.apply(console, args);
};

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', function(event) {
  if (event.reason && 
      (event.reason.message || '').includes('Cannot read from private field') && 
      event.reason.stack && 
      (event.reason.stack.includes('destroy') || event.reason.stack.includes('milkdown'))) {
    // Prevent the error from being logged to console
    event.preventDefault();
  }
  
  // Handle null promise rejections (from auth failures)
  if (event.reason === null) {
    console.warn('Caught null promise rejection (likely from auth check failure)');
    event.preventDefault();
  }
  
  // Handle AppCheck related promise rejections
  if (event.reason && typeof event.reason === 'object' && 
      (event.reason.code === 'appCheck/recaptcha-error' || 
       event.reason.message?.includes('appCheck'))) {
    console.warn('Caught AppCheck promise rejection:', event.reason.message || event.reason);
    event.preventDefault();
  }
});

const pinia = createPinia()

const app = createApp(App)
  .use(router)
  .use(vuetify)
  .use(pinia)
  .use(piniaPlugin)
  .use(dayjs)
  .use(VueGtag, {
    config: { id: "G-C3BP9PBDB0" },
    params: { anonymize_ip: true },
    router
  })

dayjs.extend(relativeTime);
app.config.globalProperties.$dayjs = dayjs
app.config.globalProperties.$formatDate = formatServerTimeStamp
app.config.globalProperties.$fadeTransition = fadeTransition
app.config.globalProperties.$slideFadeTransition = slideFadeTransition
app.config.globalProperties.$marked = marked
app.config.globalProperties.$eventStore = eventStore

// Mount the app first
app.mount('#app')

// Initialize user session after app is mounted - WAIT for it to complete
const store = useMainStore()
console.log('Starting user initialization...')
store.userEnter().then(() => {
  console.log('User initialization complete')
}).catch(error => {
  console.error('User initialization failed:', error)
})

