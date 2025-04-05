<template>
  <div class="w-full flex justify-center items-center">
    <v-hover>
      <template v-slot:default="{ isHovering, props }">
        <v-card class="border-surface-light border-2 elevation-1 rounded-lg min-w-[75%] inline-block" v-bind="props">
          
          <v-window v-model="tab" class="">
            <v-window-item value="one" class="p-0 m-0" >
              <div contenteditable="false" class="w-full h-full flex justify-center items-center p-2 bg-background" v-html="renderedDiagram"></div>
            </v-window-item>
            <v-window-item value="two" class="p-0 m-0" >
            
              <textarea
                :rows="calculateRows()"
                class="p-2 m-0 rounded-md h-full w-100 font-mono text-sm bg-background outline-none resize-nonetext-monospace code"
                v-model="editorContent"
                spellcheck="false"
              ></textarea>
              <div contenteditable="false" class="flex justify-center items-center p-2">
                <p  class="text-medium-emphasis">Diagram code</p>
                <v-spacer></v-spacer>
                <v-btn class="text-none" variant="plain" size="small" color="primary" @click="openMermaidDoc">Docs</v-btn>
                <v-btn class="text-none" variant="plain" size="small" color="secondary" @click="tab='one'">Update </v-btn>
              </div>
            </v-window-item>
          </v-window>

          <v-expand-transition>
            <div v-if="isHovering" ref="hoverDiv" @transitionend="scrollToView">
              <v-tabs v-model="tab" grow density="compact">
                <v-spacer></v-spacer>
                <v-tab class="text-none" value="one">Preview</v-tab>
                <v-tab class="text-none" value="two">Editor</v-tab>
                <v-spacer></v-spacer>
              </v-tabs>
            </div>
          </v-expand-transition>
        </v-card>
      </template>
    </v-hover>
  </div>
</template>

<script>
import mermaid from 'mermaid';
import { useNodeViewContext } from '@prosemirror-adapter/vue'
import { useTheme } from 'vuetify'


export default {
  setup() {
    const { node, setAttrs } = useNodeViewContext()
    const theme = useTheme()
    
    const uniqueId = 'mermaid-' + Math.random().toString(36).substr(2, 9)
    mermaid.initialize({ 
      startOnLoad: false,
      theme: theme?.global?.current?.value?.dark ? 'dark' : 'default',
      securityLevel: 'loose',
      fontFamily: "'Roboto', sans-serif",
      logLevel: 5,
      maxTextSize: 100000
     });
    
    // Return setAttrs so it's available in the component
    return { 
      node, 
      setAttrs, 
      nodeViewContent: () => null,
      uniqueId,
      theme
    }
  },
  props: {
    node: {
      type: Object,
      required: false
    }
  },
  data() {
    return {
      tab: 'two', // Initialize with the first tab value
      editorContent: '',
      renderedDiagram: '',
    };
  },
  watch: {
    editorContent: {
      handler() {
        // Debounce the updates to prevent rapid firing
        if (this.updateTimeout) {
          clearTimeout(this.updateTimeout);
        }
        this.updateTimeout = setTimeout(() => {
          this.updateNodeAttrs();
          this.renderDiagram();
        }, 300);
      },
      immediate: true
    },
    tab(newTab) {
      if (newTab === 'two') {
        this.$nextTick(() => {
          this.$refs.hoverDiv?.scrollIntoView({ behavior: 'instant', block: 'nearest' });
        });
      }
    },
    'theme.global.current.value.dark'(newVal) {
      // Re-initialize mermaid when theme changes
      mermaid.initialize({
        startOnLoad: false,
        theme: newVal ? 'dark' : 'default',
        securityLevel: 'loose',
        fontFamily: "'Roboto', sans-serif",
        logLevel: 5,
        maxTextSize: 100000
      });
      // Re-render diagram with new theme
      this.renderDiagram();
    }
  },
  methods: {
    async renderDiagram() {
      try {
        // Clear previous rendered content
        this.renderedDiagram = '';
        
        // Only attempt to render if we have content
        if (this.editorContent.trim()) {
          mermaid.parse(this.editorContent);
          const {svg} = await mermaid.render(this.uniqueId, this.editorContent);
          this.renderedDiagram = svg;
        }
      } catch (error) {
        console.error("Mermaid rendering error:", error);
        if (this.editorContent.trim() !== '') {
          this.renderedDiagram = `<p class="text-error">Error: ${error.message || error}</p>`;
        }
      }
    },
    updateNodeAttrs() {
      // Add safety check
      if (this.setAttrs && this.node) {
        this.setAttrs({
          value: this.editorContent
        });
      }
    },
    calculateRows() {
      const lineCount = (this.editorContent.match(/\n/g) || []).length + 1;
      return Math.max(1, Math.min(lineCount, 20)); // Min 7 rows, max 20 rows
    },
    openMermaidDoc() {
      window.open('https://mermaid-js.github.io/mermaid/#/');
    },
    scrollToView() {
      this.$refs.hoverDiv?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
  },
  mounted() {
    this.editorContent = this.node?.attrs?.value || ""
    this.renderDiagram()
    if (this.editorContent != ''){
      this.tab = 'one'
    }
  },
};
</script>

<style scoped>
/* Add any necessary styles here */


.v-window-item textarea.code {
  font-family: 'Menlo', 'Monaco', 'Consolas', 'Courier New', monospace !important;
  font-weight: 800 !important;
}

:deep(svg) {
  height: auto !important;
  width: 100% !important;
  max-width: 100% !important;
  overflow: visible !important;
}

:deep(svg.mermaid) {
  height: auto !important;
  display: block !important;
  margin: 0 auto !important;
}

:deep(.text-error) {
  color: rgb(var(--v-theme-error));
  padding: 8px;
  border-radius: 4px;
  background-color: rgba(var(--v-theme-error), 0.1);
  margin: 8px 0;
}
</style>

