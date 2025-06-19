import { useMainStore } from '../store/index.js'

export default {
  install(app) {
    // Just make the store available as this.$store - no namespacing bullshit
    app.config.globalProperties.$store = useMainStore()
  }
} 