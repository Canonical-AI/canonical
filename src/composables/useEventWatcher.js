import { watch, ref } from 'vue'

export const useEventWatcher = (eventStore, eventName, callback) => {
  const lastTimestamp = ref(0)
  
  watch(
    () => eventStore.events.filter(event => event.name === eventName),
    (events) => {
      for (const event of events) {
        if (event.timestamp > lastTimestamp.value) {
          lastTimestamp.value = event.timestamp
          callback(event.payload)
        }
      }
    },
    { deep: true }
  )
}