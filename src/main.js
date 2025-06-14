import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import store from './store/index';
import { eventStore } from './store/eventStore';
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
});

store.dispatch('enter')

const app = createApp(App)
  .use(router)
  .use(vuetify)
  .use(store)
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

app.mount('#app')

