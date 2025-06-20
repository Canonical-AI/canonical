import { useMainStore } from '../store/index.js'

export default {
  install(app) {
    // Make the store available as this.$store with proper context
    app.config.globalProperties.$store = null
    
    // Override beforeCreate to inject store
    app.mixin({
      beforeCreate() {
        if (!this.$store) {
          this.$store = useMainStore()
        }
      }
    })
  }
} 