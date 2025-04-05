<template>
  <v-navigation-drawer
    v-model="drawer"
    location="right"
    width="400"
    :temporary="!drawer"
    class="h-100"
  >
    <v-card-actions>
      <v-btn flat icon="mdi-close" @click="drawer = false"></v-btn>
      <v-spacer></v-spacer>
      <div v-if="document.data.updatedDate" class="text-medium-emphasis mr-4">
        last update:
        {{ $dayjs(document.data.updatedDate.seconds * 1000).fromNow() }}
      </div>
      <v-menu class="border border-surface-light">
        <template v-slot:activator="{ props }">
          <v-btn :disabled="isDisabled" v-if="document.id" v-bind="props" icon>
            <v-icon>mdi-dots-vertical</v-icon>
          </v-btn>
        </template>
        <v-list class="border border-surface-light" density="compact">
          <v-list-item
            @click="toggleDraft()"
            prepend-icon="mdi-file-edit"
            :class="document.data.draft ? 'text-orange' : ''"
          >
            {{ document.data.draft ? "Release doc" : "Stage doc" }}
          </v-list-item>
          <v-list-item @click="archiveDocument" prepend-icon="mdi-archive">
            Archive doc
          </v-list-item>
          <v-list-item
            class="text-error"
            @click="deleteDocument"
            prepend-icon="mdi-trash-can"
          >
            Permanently delete doc
          </v-list-item>
        </v-list>
      </v-menu>
    </v-card-actions>
    <v-divider></v-divider>

    <!-- <v-list-item>
                <v-btn
                :disabled="!$store.getters.isUserLoggedIn"
                class="text-none gen-btn"
                @click="sendPromptToVertexAI()"
                density="compact" >Generate Feedback</v-btn>
            </v-list-item>
            <p class="generative-feedback text-caption border-thin rounded ma-1 pa-1" v-if="generativeFeedback !== null" v-html="renderMarkdown(generativeFeedback)"></p>  -->

    <v-expansion-panels v-model="isGenPanelExpanded" variant="accordion">
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-btn
            :disabled="isDisabled"
            class="text-none gen-btn"
            @click="sendPromptToVertexAI()"
            density="compact"
            >Generate Feedback
          </v-btn>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <p
            class="generative-feedback text-sm ma-1 pa-1"
            v-if="generativeFeedback !== null"
            v-html="renderMarkdown(generativeFeedback)"
          ></p>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <v-spacer />
    <comment
      v-if="document.id && $store.getters.isUserLoggedIn"
      :doc-id="document.id"
      :doc-type="'document'"
    />
  </v-navigation-drawer>

  <v-app-bar
    class="input-container z-10"
    elevation="0"
    style="padding-bottom: 0"
  >
    <VersionModal
      :disabled="isDisabled"
      :key="document.id"
      :versions="document.versions"
      :current-version="$route.query.v || 'live'"
    />
    <v-spacer />

    <div
      v-if="document.data.updatedDate && !$vuetify.display.mobile"
      class="text-medium-emphasis mr-4"
    >
      last update:
      {{ $dayjs(document.data.updatedDate.seconds * 1000).fromNow() }}
    </div>

    <v-tooltip text="Share Link" location="bottom">
      <template v-slot:activator="{ props }">
        <v-icon
          class="mx-2"
          v-bind="props"
          @click="copyToClipboard"
          icon="mdi-share"
        />
      </template>
    </v-tooltip>

    <v-tooltip text="Save as a favorite" location="bottom">
      <template v-slot:activator="{ props }">
        <v-icon
          :disabled="isDisabled"
          class="mx-2"
          v-bind="props"
          @click="toggleFavorite"
          :icon="isFavorite ? 'mdi-heart' : 'mdi-heart-outline'"
        />
      </template>
    </v-tooltip>
    <v-tooltip text="Feedback from your AI coach" location="bottom">
      <template v-slot:activator="{ props }">
        <v-icon
          :disabled="isDisabled"
          v-if="$store.getters.canAccessAi"
          class="mx-2 gen-icon"
          v-bind="props"
          @click="sendPromptToVertexAI()"
          icon="mdi-comment-quote"
        />
      </template>
    </v-tooltip>
    <v-tooltip text="Open the sidebar" location="bottom">
      <template v-slot:activator="{ props }">
        <v-icon
          class="mx-2 mr-6"
          v-bind="props"
          @click.stop="drawer = !drawer"
          icon="mdi-file-document"
        />
      </template>
    </v-tooltip>
  </v-app-bar>

  <div
    class="document-create position-relative top-0 left-0 right-0 h-100 ml-6"
  >
    <Transition v-bind="$fadeTransition">
      <div
        v-if="isLoadingTimeout && isLoading"
        class="skeleton-loader-container position-absolute top-0 left-0 right-0 w-100 h-100 d-flex justify-center align-center"
      >
        <v-progress-circular
          class="mx-auto"
          color="primary"
          indeterminate
          :size="128"
          :width="12"
        ></v-progress-circular>
      </div>
    </Transition>

    <v-fade-transition>
      <div
        class="position-absolute mx-0 w-100"
        v-if="!isLoading"
        :key="editorKey"
      >
        <div
          class="position-relative top-0 left-0 right-0 w-100 whitespace-normal text-3xl font-bold bg-transparent text-gray-900 pl-14 -mt-2 rounded"
          contenteditable="true"
          :style="{ minHeight: '1em', outline: 'none' }"
          @input="updateDocumentName"
          @focus="ensureContent"
          ref="editableDiv"
        >
          {{ document.data.name }}
        </div>

        <div v-if="!isLoading">
          <MilkdownProvider v-if="showEditor">
            <ProsemirrorAdapterProvider>
              <MilkdownEditor
                :disabled="isDisabled || !isEditable"
                v-model="editorContent"
              />
            </ProsemirrorAdapterProvider>
          </MilkdownProvider>
        </div>
      </div>
    </v-fade-transition>
  </div>
</template>

<script>
import { ProsemirrorAdapterProvider } from "@prosemirror-adapter/vue";
import { marked } from "marked";
import comment from "../comment/comment.vue";
import { Feedback } from "../../services/vertexAiService";
import { MilkdownProvider } from "@milkdown/vue";
import MilkdownEditor from "../editor/MilkdownEditor.vue";
import { fadeTransition } from "../../utils/transitions";
import VersionModal from "./VersionModal.vue";

export default {
  components: {
    comment,
    MilkdownEditor,
    ProsemirrorAdapterProvider,
    MilkdownProvider,
    VersionModal,
  },
  emits: ["scrollToBottom"],
  props: {
    type: {
      type: String,
      default: null,
    },
    id: {
      type: String,
      default: null,
    },
  },
  data: () => ({
    valid: true,
    isEditorModified: false,
    isLoading: false,
    isLoadingTimeout: false,
    isEditable: true,
    document: {
      id: null,
      data: {
        name: "[DRAFT] - My New Doc..",
        content: "",
        draft: true,
      },
    },
    previousDocumentValue: {
      name: "[DRAFT] New Doc..",
      content: "Hello **World**",
      type: "",
      relationships: [],
      draft: true,
    },
    documentTypes: [
      "product",
      "feature",
      "roadmap",
      "goal",
      "idea",
      "risk",
      "persona",
      "need",
      "journey",
      "job to be done",
      "insight",
      "interview",
    ],
    rules: {
      required: (value) => !!value || "Required.",
    },
    drawer: false,
    generativeFeedback: null,
    previousType: null,
    previousContent: null,
    previousTitle: null,
    previousData: null,
    debounceSave: null,
    isFavorite: false,
    editorKey: 0,
    fadeTransition: fadeTransition,
    placeholders: [
      "Write something...",
      "Start your story...",
      "Share your thoughts...",
      "Compose a message...",
      "Get your ideas out...",
      "What are you thinking about?",
      "What are you doing dave?",
    ],
    currentPlaceholder: "Get your ideas out...",
    isGenPanelExpanded: null,
    editorMounted: false,
    showEditor: true,
  }),
  async created() {
    this.isLoading = true;
    // if (this.$route.query.type){
    //     await this.populateTemplate(this.$route.query.type)
    // }
    if (this.$route.params.id) {
      this.fetchDocument(this.$route.params.id);
    }
    this.isLoading = false;
    this.debounceSave = this.debounce(() => this.saveDocument(), 5000);

    this.getRandomPlaceholder();
  },

  methods: {
    renderMarkdown(text) {
      return marked(text); // Convert Markdown to HTML
    },

    getFormattedDocuments() {
      return this.$store.state.documents.map((doc) => ({
        id: doc.id,
        name: doc.data.name,
      }));
    },

    debounce(func, delay) {
      let timeout;
      return function () {
        clearTimeout(timeout);
        this._savingTimeout = timeout = setTimeout(() => {
          func.apply();
        }, delay);
      };
    },

    async fetchDocument(id, version = null) {
      // Unmount the editor first
      this.showEditor = false;
      await this.$nextTick();
      
      this.isLoading = true;
      await this.$store.dispatch("selectDocument", { id, version });
      const selectedDocument = this.$store.state.selected;
      
      this.previousTitle = selectedDocument.data.name;
      this.previousContent = selectedDocument.data.content;
      this.previousType = selectedDocument.data.type;
      this.document = {
        ...this.document,
        ...selectedDocument,
      };
      
      this.isFavorite = this.$store.getters.isFavorite(this.document.id);
      this.isEditorModified = false;
      
      if (version) {
        this.isEditable = false;
      } else {
        this.isEditable = true;
      }
      
      // Force focus reset after loading
      document.activeElement?.blur();
      
      this.isLoading = false;
      
      // Remount the editor after everything is loaded
      await this.$nextTick();
      // Give the DOM time to update and ensure mermaid diagrams have time to initialize
      setTimeout(() => {
        this.showEditor = true;
        // Force editor refresh through key
        this.editorKey += 1;
      }, 100);
    },

    async createDocument() {
      console.log("create-doc");
      const createdDoc = await this.$store.dispatch("createDocument", {
        data: this.document.data,
      });
      this.document.id = createdDoc.id;
      this.$router.replace({ path: `/document/${this.document.id}` });
    },

    async saveDocument() {
      if (this.isLoading == true || this.isEditorModified === false) {
        return;
      }

      if (this.document.id === null) {
        await this.createDocument();
      } else {
        await this.$store.commit("saveSelectedDocument");
      }

      this.isEditorModified = false;
    },

    async populateTemplate(type) {
      this.isLoading = true;
      await this.$store.dispatch("getTemplates");
      this.documentTemplate = await this.$store.state.templates.find(
        (t) => t.name === type,
      );

      if (this.documentTemplate) {
        const newData = {
          id: null,
          data: {
            content: this.documentTemplate.content,
            name: `[DRAFT] - My New ${this.document.data.type}...`,
            type: type,
            relationships: [],
          },
        };
        // this.document.data = newData
        this.previousType = newData.data.type;
        this.previousTitle = newData.data.name;
        this.previousContent = newData.data.content;
        Object.assign(this.document, newData);
      } else {
        const newData = {
          id: null,
          data: {
            content: "Hello, **World**",
            name: `[DRAFT] - My new doc...`,
            type: type,
            relationships: [],
          },
        };
        // this.document.data = newData
        this.previousType = newData.data.type;
        this.previousTitle = newData.data.name;
        this.previousContent = newData.data.content;
        Object.assign(this.document, newData);
        this.$router.push({ query: { ...this.$route.type, type: type } });
      }
      this.isEditorModified = false;
      await this.$nextTick();
      this.isLoading = false;
    },

    async getDocumentName(name, id) {
      const document = this.$store.state.documents.find((doc) => doc.id === id);
      const newName = document?.data.name || name;
      return newName.length > 30 ? newName.substring(0, 27) + "..." : newName;
    },

    async deleteDocument() {
      await this.$store.dispatch("deleteDocument", { id: this.document.id });
      this.$store.dispatch("getDocuments");
      this.$router.push({ path: `/document/create-document` });
    },

    async archiveDocument() {
      await this.$store.dispatch("archiveDocument", { id: this.document.id });
      this.$store.dispatch("getDocuments");
      this.$router.push({ path: `/document/create-document` });
    },

    async sendPromptToVertexAI() {
      this.drawer = true;

      const prompt = `
            title ${this.document.data.name}
            type of doc ${this.document.data.type}
            ${this.document.data.content}
            `;
      const result = await Feedback.generateFeedback({ prompt: prompt });

      this.generativeFeedback = "";
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        this.generativeFeedback += chunkText;
      }
      return;
    },

    toggleFavorite() {
      this.$store.commit("toggleFavorite", this.document.id);
      this.isFavorite = !this.isFavorite;
    },

    copyToClipboard() {
      const url = window.location.href; // Get the current URL
      navigator.clipboard
        .writeText(url) // Copy the URL to clipboard
        .then(() => {
          this.$store.commit("alert", {
            type: "info",
            message: "URL copied to clipboard!",
            autoClear: true,
          });
        })
        .catch((err) => {
          console.error("Failed to copy: ", err);
        });
    },

    getRandomPlaceholder() {
      const randomIndex = Math.floor(Math.random() * this.placeholders.length);
      this.currentPlaceholder = this.placeholders[randomIndex];
    },

    autoGrow(event) {
      const textarea = event.target;
      textarea.style.height = "auto"; // Reset the height
      textarea.style.height = `${textarea.scrollHeight}px`; // Set it to the scroll height
    },

    updateDocumentName(event) {
      this.document.data.name = event.target.innerText.trim();
    },

    async toggleDraft() {
      await this.$store.dispatch("toggleDraft");
      // Force update of documents list to reflect the change in tree
      await this.$store.dispatch("getDocuments");
    },

    ensureContent() {
      const el = this.$refs.editableDiv;
      if (!el.innerText.trim()) {
        el.innerHTML = "<br>"; // Ensure there's always a line break to maintain focus
      }
    },
  },
  computed: {
    isDisabled() {
      if (
        this.$store.getters.isUserLoggedIn ||
        this.$store.state.project?.id != null
      ) {
        this.isEditable = true;
        return false;
      } else {
        this.isEditable = false;
        return true;
      }
    },
    editorContent: {
      get() {
        return this.document.data.content;
      },
      set(newValue) {
        if (newValue === this.document.data.content) {
          return;
        }
        this.document.data.content = newValue;
        return;
      },
    },
  },
  watch: {
    "document.data": {
      async handler() {
        if (this.isEditable === false) {
          return;
        }

        if (!this.isLoading && this.document.data.name !== this.previousTitle) {
          this.previousTitle = this.document.data.name;
          this.isEditorModified = true;
          // This will make the title change visible in the document tree
          if (this.document.id) {
            this.$store.commit("updateSelectedDocument", this.document);
          }
        }

        // Check if content has changed
        if (
          !this.isLoading &&
          this.document.data.content !== this.previousContent
        ) {
          this.previousContent = this.document.data.content;
          this.isEditorModified = true;
        }

        if (this.isEditorModified) {
          console.log("trying to save....");
          this.$store.commit("updateSelectedDocument", this.document); // alway save current edditor content to store but not to database yet. might even be able to get this with cookies so if you close the browser your data is saved
          
          if (this.debounceSave) {
            await this.debounceSave();
          }
          return;
        }

        if (this.isLoading) {
          // this can probably get cleaned up...
          this.isLoading = false;
          return;
        }
      },
      deep: true,
    },

    $route: {
      async handler(to, from) {
        if (this.isEditorModified) {
          await this.saveDocument();
        }

        if (to === from) {
          return;
        }
        
        // Completely unmount the editor
        this.showEditor = false;
        
        // Wait for the next tick to ensure unmounting is complete
        await this.$nextTick();
        
        if (this.$route.params.id && this.$route.query.v) {
          await this.fetchDocument(this.$route.params.id, this.$route.query.v);
        } else if (this.$route.params.id) {
          await this.fetchDocument(this.$route.params.id);
        } else if (this.$route.path === "/document/create-document") {
          this.isLoading = true;
          this.document = {
            id: null,
            data: {
              name: "My New Doc..",
              content: "Hello **World**",
              draft: true,
            },
          };
          this.editorContent = this.document.data.content;
          this.previousContent = this.document.data.content;
          this.previousTitle = this.document.data.name;
          this.isEditorModified = false;
          this.isLoading = false;
        }
        
        // Allow DOM to update before showing editor
        await this.$nextTick();
        // Force a brief pause to ensure clean mounting
        setTimeout(() => {
          this.showEditor = true;
        }, 50);
      },
      immediate: true,
    },

    isLoading(newValue) {
      // this is only here to hide ugly blinking effect on milkdown editor init
      if (newValue === false && this.isLoadingTimeout === false) {
        this.isLoadingTimeout = false; // Reset timeout when loading is false
      } else if (newValue === true) {
        setTimeout(() => {
          if (this.isLoading) {
            // Check if still loading after 1 second
            this.isLoadingTimeout = true;
          }
        }, 500); // Set timeout to 1 second
      }
    },

    generativeFeedback(newValue) {
      if (newValue !== null) {
        this.isGenPanelExpanded = 0;
      }
    },

    isEditable(newValue) {
      // Force component re-render when editable state changes
      this.editorKey += 1;
    },
  },
  beforeRouteLeave(to, from, next) {
    // Save any pending changes
    if (this.isEditorModified) {
      this.saveDocument();
    }
    
    // Ensure editor is unmounted before navigation
    this.showEditor = false;
    
    // Cancel any pending operations
    if (this.debounceSave) {
      clearTimeout(this._savingTimeout);
    }
    
    // Wait for the DOM to update
    this.$nextTick(() => {
      next();
    });
  },
  beforeUnmount() {
    // Save any pending changes
    if (this.isEditorModified) {
      this.saveDocument();
    }
    
    // Make sure editor is fully unmounted before component is destroyed
    this.showEditor = false;
    
    // Clean up resources before component is destroyed
    if (this.debounceSave) {
      // Cancel any pending debounced save
      clearTimeout(this._savingTimeout);
    }
    
    // Force the editor to be unmounted cleanly
    this.editorKey += 1;
    this.editorMounted = false;
  },
};
</script>

<style scoped>
.input-container {
  background: linear-gradient(
    to bottom,
    rgba(var(--v-theme-background), 1) 0%,
    rgba(var(--v-theme-background), 1) 40%,
    rgba(var(--v-theme-background), 0) 100%
  ) !important;
  padding-bottom: 24px;
  z-index: 100 !important;
}

.document-create {
  margin: 0px 36px;
  height: 100%;
  margin: 0;
}

.skeleton-loader-container {
  position: absolute; /* Position it absolutely */
  height: 100%;
  width: 100%;
  padding-right: 44px;
  z-index: 10; /* Ensure it overlays other content */
  background-color: rgba(var(--v-theme-background), 1);
}

.editor {
  background-color: var(--v-theme-background);
  color: rgba(
    var(--v-theme-on-background),
    var(--v-high-emphasis-opacity)
  ) !important;
  height: 95% !important ;
}

.editor * {
  /* color: inherit; */
  /* background-color: inherit; */
  font-family: inherit !important;
}

:deep(div.milkdown) {
  min-height: 95% !important;
  background-color: inherit !important;
  color: inherit !important;
  font-family: inherit !important;
}

:deep(div.ProseMirror.editor) {
  flex-grow: 1 !important;
  height: 100% !important;
  min-height: 95% !important;
  padding: 16px 60px !important;
  color: inherit !important;
  max-width: none !important;
  margin-bottom: 0px !important;
}

@media (max-width: 640px) {
  /* Tailwind's sm breakpoint */
  :deep(div.ProseMirror.editor) {
    padding-right: 4px !important;
  }
}

:deep(.milkdown a) {
  color: rgb(var(--v-theme-on-background)) !important;
  background-color: rgb(var(--v-theme-background)) !important;
}

:deep(.milkdown p.crepe-placeholder) {
  color: rgb(var(--v-theme-on-background)) !important;
}

:deep(milkdown-slash-menu) {
  background-color: rgb(var(--v-theme-surface)) !important;
  color: rgb(var(--v-theme-on-background)) !important;
  border: 1px solid rgb(var(--v-theme-surface-light)) !important;
  border-radius: 4px !important;
  z-index: 100 !important;
}

:deep(milkdown-slash-menu h6) {
  color: white !important;
}

:deep(milkdown-slash-menu *) {
  font-size: 0.95em !important;
}

:deep(milkdown-slash-menu li) {
  padding: 2px !important;
}

:deep(milkdown-toolbar) {
  background-color: rgb(var(--v-theme-surface)) !important;
  color: rgb(var(--v-theme-on-background)) !important;
  border: 1px solid rgb(var(--v-theme-surface-light)) !important;
  border-radius: 4px !important;
  z-index: 100 !important;
}

:deep(milkdown-toolbar *) {
  font-size: 0.95em !important;
}

.editor-container {
  display: flex; /* Use flexbox for layout */
  height: calc(100% - 64px);
}

.line-numbers-container {
  width: 40px; /* Fixed width for line numbers */
  border-right: 1px solid #ddd; /* Optional border */
  padding: 12px 0px !important;
}

.line-numbers {
  padding: 16px 0px !important;
  position: relative; /* Position relative for line numbers */
  height: 100%; /* Full height */
}

.line-number {
  font-size: 13px;
  line-height: 1.42;
  text-align: right; /* Align text to the right */
  padding-right: 5px; /* Space between number and edge */
  color: #999; /* Adjust color as needed */
}

input.h1 {
  font-size: 3rem;
  font-family: "Roboto", sans-serif;
  font-weight: bold;
  background-color: inherit;
  color: rgba(var(--v-theme-on-background), 1) !important;
  padding-left: 55px;
  font-weight: 400;
}

.generative-feedback :deep(ul),
.generative-feedback :deep(ol) {
  padding-left: 1em;
}

.generative-feedback :deep(p) {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}
</style>
