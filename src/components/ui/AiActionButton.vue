<template>
  <v-tooltip :text="tooltip" location="bottom">
    <template v-slot:activator="{ props }">
      <v-btn
        :disabled="disabled"
        class="text-none"
        density="compact"
        v-bind="props"
        @click="onClick"
      >
        <v-progress-circular
          v-if="loading"
          indeterminate
          size="16"
          width="2"
          class="mr-1"
        ></v-progress-circular>
        <v-icon 
          v-else-if="icon" 
          size="16" 
          class="mr-1"
        >
          {{ icon }}
        </v-icon>
        {{ label }}
      </v-btn>
    </template>
  </v-tooltip>
</template>

<script>
export default {
  name: 'AiActionButton',
  props: {
    tooltip: {
      type: String,
      required: true
    },
    label: {
      type: String,
      required: true
    },
    disabled: {
      type: Boolean,
      default: false
    },
    loading: {
      type: Boolean,
      default: false
    },
    icon: {
      type: String,
      default: null
    }
  },
  emits: ['click'],
  methods: {
    onClick() {
      if (!this.disabled && !this.loading) {
        this.$emit('click')
      }
    }
  }
}
</script> 