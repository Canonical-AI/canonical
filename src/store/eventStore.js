import { reactive } from 'vue'

export const eventStore = reactive({
  events: [],

  emitEvent(name, payload){
    eventStore.events.push({
        name, 
        payload, 
        timestamp: Date.now()})
  },

  clearEvents(){
    eventStore.events = []
  }

});