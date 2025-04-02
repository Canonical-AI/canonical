import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import store from './store/index';
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

app.mount('#app')

