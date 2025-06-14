<template>
  <v-navigation-drawer
    v-model="drawer"
    location="right"
    width="400"
    :temporary="!drawer"
    class="h-100 d-flex flex-column"
  >
    <!-- Fixed header section -->
    <div class="drawer-header flex-shrink-0">
      <v-card-actions>
        <v-btn flat icon="mdi-close" @click="drawer = false"></v-btn>
        <v-spacer></v-spacer>
        <div v-if="document.data.updatedDate" class="text-medium-emphasis mr-4">
          last update:
          {{ $dayjs(document.data.updatedDate.seconds * 1000).fromNow() }}
        </div>
        <v-menu v-if="document.id" class="border border-surface-light">
          <template v-slot:activator="{ props }">
            <v-btn :disabled="isDisabled" v-bind="props" icon>
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

      <ReviewPanel
        ref="reviewPanel"
        v-model:isExpanded="isGenPanelExpanded"
        :is-viewing-version="isViewingVersion"
        :disabled="isDisabled"
        :document="document"
        :editor-ref="$refs.milkdownEditor"
        @update-document-content="updateDocumentContent"
        @refresh-editor="_refreshEditor"
      />
    </div>

    <!-- Scrollable comments section -->
    <div class="comments-container flex-grow-1 overflow-y-auto">
      <comment
        v-if="document.id && $store.getters.isUserLoggedIn"
        :doc-id="document.id"
        :doc-type="'document'"
        ref="commentComponent"
        @scroll-to-comment="openDrawerAndScrollToComment"
        @refresh-editor-decorations="_refreshEditor"
        @accept-suggestion="handleAcceptSuggestion"
      />
    </div>
  </v-navigation-drawer>

  <v-app-bar
    class="input-container z-10"
    elevation="0"
    style="padding-bottom: 0"
  >
    <VersionModal
      class="-mr-5"
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
          class="mx-1"
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
          class="mx-1"
          v-bind="props"
          @click="toggleFavorite"
          :icon="isFavorite ? 'mdi-heart' : 'mdi-heart-outline'"
        />
      </template>
    </v-tooltip>
    <v-tooltip 
      v-if="$store.getters.canAccessAi" 
      text="Feedback from your AI coach" 
      location="bottom"
    >
      <template v-slot:activator="{ props }">
        <v-icon
          :disabled="isDisabled"
          class="mx-1 gen-icon"
          v-bind="props"
          @click="triggerFeedbackFromToolbar()"
          icon="mdi-comment-quote"
        />
      </template>
    </v-tooltip>
    <v-tooltip text="Open the sidebar" location="bottom">
      <template v-slot:activator="{ props }">
        <v-icon
          class="mx-1 mr-6"
          v-bind="props"
          @click.stop="drawer = !drawer"
          icon="mdi-file-document"
        />
      </template>
    </v-tooltip>
  </v-app-bar>

  <div
    class="document-create position-relative top-0 left-0 right-0 h-100 ml-6"
    @click="activateEditor"
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
          class="document-title position-relative top-0 left-0 right-0 w-100 whitespace-normal text-3xl font-bold bg-transparent text-gray-900 -mt-2 rounded"
          contenteditable="true"
          :style="{ minHeight: '1em', outline: 'none' }"
          @blur="updateDocumentNameOnBlur"
          @keydown.enter="finishEditingTitle"
          @focus="ensureContent"
          @click.stop
          ref="editableDiv"
        >
          {{ document.data.name }}
        </div>

        <div v-if="!isLoading">
          <MilkdownProvider v-if="showEditor">
            <ProsemirrorAdapterProvider>
              <MilkdownEditor
                :key="editorKey"
                :disabled="isDisabled || !isEditable"
                ref="milkdownEditor"
                v-model="editorContent"
                @comment-clicked="openDrawerAndScrollToComment"
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
import { MilkdownProvider } from "@milkdown/vue";
import MilkdownEditor from "../editor/MilkdownEditor.vue";
import { fadeTransition } from "../../utils/transitions";
import VersionModal from "./VersionModal.vue";
import ReviewPanel from "./ReviewPanel.vue";
import { showAlert, copyToClipboard, activateEditor, placeCursorAtEnd, debounce, getRandomItem } from "../../utils/uiHelpers";

export default {
  components: {
    comment,
    MilkdownEditor,
    ProsemirrorAdapterProvider,
    MilkdownProvider,
    VersionModal,
    ReviewPanel,
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
    isCreatingDocument: false,
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
  provide() {
    return {
      resolveComment: this.resolveComment.bind(this),
      unresolveComment: this.unresolveComment.bind(this),
      deleteComment: this.deleteComment.bind(this),
      scrollToCommentInEditor: this.scrollToCommentInEditor.bind(this),
    };
  },
  async created() {
    this.isLoading = true;
    // if (this.$route.query.type){
    //     await this.populateTemplate(this.$route.query.type)
    // }
    if (this.$route.params.id) {
      this.fetchDocument(this.$route.params.id);
    }
    this.isLoading = false;
    this.debounceSave = debounce(() => this.saveDocument(), 5000);

    this.getRandomPlaceholder();
  },
  
  mounted() {
    // Ensure the editor gets activated after mounting
    setTimeout(() => {
      this.activateEditor();
    }, 500);
  },

  methods: {
    getFormattedDocuments() {
      return this.$store.state.documents.map((doc) => ({
        id: doc.id,
        name: doc.data.name,
      }));
    },

    async fetchDocument(id, version = null) {
      // Completely unmount the editor first to prevent state issues
      this.showEditor = false;
      this.isLoading = true;

      while (this.$store.state.loadingUser) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      try {
        const result = await this.$store.dispatch("selectDocument", { id, version });
        if (result === null) {
          this.isLoading = false;
          return;
        }
        
        const selectedDocument = this.$store.state.selected;
        
        if (!selectedDocument || !selectedDocument.data) {
          console.error("Failed to load document or document data is missing");
          this.isLoading = false;
          this.$store.commit("alert", { 
            type: "error", 
            message: "Unable to load document. It may have been deleted or you don't have permission." 
          });
          this.$router.push('/');
          return;
        }
        
        this.previousTitle = selectedDocument.data.name || "";
        this.previousContent = selectedDocument.data.content || "";
        this.previousType = selectedDocument.data.type || "";
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
        

      } catch (error) {
        console.error("Error fetching document:", error);
        this.$store.commit("alert", { 
          type: "error", 
          message: "An error occurred while loading the document. Please try again." 
        });
        this.$router.push('/');
      } finally {
        this.isLoading = false;
        
        // Check if document was successfully loaded before mounting editor
        if (this.document && this.document.data) {
          // Force a complete component reset before remounting
          await this.$nextTick();
          
          // Set a longer timeout to ensure proper initialization
          setTimeout(() => {
            this.showEditor = true;
            // Don't increment editorKey on mobile as it causes cursor position issues
            if (!this.$vuetify.display.mobile) {
              this.editorKey++;
            }
          }, 200);
        }
      }
    },

    async createDocument() {
      console.log("create-doc");
      this.isCreatingDocument = true;
      const createdDoc = await this.$store.dispatch("createDocument", {
        data: this.document.data,
      });
      this.document.id = createdDoc.id;
      this.document.data.id = createdDoc.id;
      this.$store.commit("setSelectedDocument", this.document);
      
      await this.$router.replace({ path: `/document/${this.document.id}` });
      this.isCreatingDocument = false;
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
        this.$router.push({ query: { ...this.$route.query, type: type } });
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

    async triggerFeedbackFromToolbar() {
      // Open the drawer and trigger feedback through the ReviewPanel
      this.drawer = true;
      
      // Wait for the drawer to open and component to be available
      await this.$nextTick();
      
      if (this.$refs.reviewPanel) {
        await this.$refs.reviewPanel.handleFeedback();
      }
    },

    async handleAcceptSuggestion(suggestionData) {
      if (this.$refs.reviewPanel) {
        const result = await this.$refs.reviewPanel.handleAcceptSuggestion(suggestionData);
        
        // Handle editor refresh if needed (only if we didn't navigate away)
        if (result?.needsEditorRefresh && !result?.navigatedToLive && !this.$vuetify.display.mobile) {
          this.editorKey++;
        }
        
        // Refresh suggestions after successful application to prevent stale references
        if (result?.shouldRefreshSuggestions && result?.success) {
          this.$nextTick(async () => {
            this._refreshEditor();
            
            // Clean up any outdated suggestions that might reference old text
            if (this.$refs.reviewPanel) {
              await this.$refs.reviewPanel.cleanupOutdatedSuggestions(this.document.data.content);
            }
            
          });
        }
      }
    },

    _refreshEditor() {
      this.$nextTick(() => {
        if (this.$refs.milkdownEditor) {
          this.$refs.milkdownEditor.refreshCommentDecorations();
        }
      });
    },

    toggleFavorite() {
      this.$store.commit("toggleFavorite", this.document.id);
      this.isFavorite = !this.isFavorite;
    },

    copyToClipboard() {
      const url = window.location.href;
      copyToClipboard(url, this.$store, "URL copied to clipboard!");
    },

    getRandomPlaceholder() {
      this.currentPlaceholder = getRandomItem(this.placeholders);
    },

    autoGrow(event) {
      const textarea = event.target;
      textarea.style.height = "auto"; // Reset the height
      textarea.style.height = `${textarea.scrollHeight}px`; // Set it to the scroll height
    },

    updateDocumentNameOnBlur(event) {
      const newName = event.target.innerText.trim();
      if (newName !== this.document.data.name) {
        this.document.data.name = newName;
      }
    },

    finishEditingTitle(event) {
      event.preventDefault(); // Prevent adding a new line
      const newName = event.target.innerText.trim();
      if (newName !== this.document.data.name) {
        this.document.data.name = newName;
      }
      event.target.blur(); // Remove focus from the title
    },

    placeCursorAtEnd(element) {
      placeCursorAtEnd(element);
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

    activateEditor() {
      activateEditor({
        isMobile: this.$vuetify.display.mobile,
        isLoading: this.isLoading,
        showEditor: this.showEditor
      });
    },

    // Method to open drawer and scroll to specific comment
    openDrawerAndScrollToComment(commentId) {
      this.drawer = true;

      this.$nextTick(() => {
        setTimeout(() => {
          if (this.$refs.commentComponent) {
            this.$refs.commentComponent.scrollToComment(commentId);
          }
        }, 300); 
      });
    },

    // Method to scroll to a comment position in the editor when clicked from sidebar
    scrollToCommentInEditor(commentId) {
      this.$nextTick(() => {
        if (this.$refs.milkdownEditor) {
          this.$refs.milkdownEditor.scrollToComment(commentId);
        }
      });
    },

    // Method to resolve a comment and remove its mark from the editor
    async resolveComment(commentId) {
      await this.$refs.milkdownEditor.resolveComment(commentId);
    },

    async unresolveComment(commentId) {
      await this.$refs.milkdownEditor.unresolveComment(commentId);
    },

    // Method to delete a comment and remove its mark from the editor
    async deleteComment(commentId) {
      try {
        // Use the MilkdownEditor's deleteComment method
        if (this.$refs.milkdownEditor) {
          await this.$refs.milkdownEditor.deleteComment(commentId);
        } else {
          console.warn('deleteComment: MilkdownEditor not available');
        }
      } catch (error) {
        console.error('Error deleting comment:', error);
        this.$store.commit('alert', {
          type: 'error',
          message: 'Failed to delete comment',
          autoClear: true
        });
      }
    },

    updateDocumentContent(content) {
      this.document.data.content = content;
      this.editorContent = content;
      this.isEditorModified = true;
      this.editorKey++;
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
    isViewingVersion() {
      return this.$route.query.v && this.$route.query.v !== 'live';
    },

    editorContent: {
      get() {
        return this.document.data.content;
      },
      set(newValue) {
        if (newValue === this.document.data.content) return;
        this.document.data.content = newValue;
        this.isEditorModified = true;
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
            const documentUpdateData = {
              id: this.document.id,
              data: this.document.data
            };
            this.$store.commit("updateSelectedDocument", documentUpdateData);
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
          // Only pass document data, not comments, to avoid overwriting store's comment state
          const documentUpdateData = {
            id: this.document.id,
            data: this.document.data
          };
          this.$store.commit("updateSelectedDocument", documentUpdateData); // alway save current edditor content to store but not to database yet. might even be able to get this with cookies so if you close the browser your data is saved
          
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
        if (this.isCreatingDocument) return;
        
        try {
          // Skip heavy operations if only query params changed (internal update)
          if (from && to.path === from.path && to.params.id === from.params.id) {
            console.log('Query-only route change, skipping reload');
            return;
          }

          // Skip if navigating to the same document we already have loaded
          if (this.$route.params.id && this.document.id === this.$route.params.id && !this.$route.query.v) {
            console.log('Navigating to same document, skipping reload');
            return;
          }

          if (this.isEditorModified) {
            await this.saveDocument();
          }
  
          if (to === from) {
            return;
          }
          
          if (this.$route.params.id && this.$route.query.v) {
            // Viewing a specific version - always fetch
            this.showEditor = false;
            this.isEditorModified = false;
            await this.$nextTick();
            await this.fetchDocument(this.$route.params.id, this.$route.query.v);
          } else if (this.$route.params.id && this.document.id !== this.$route.params.id) {
            // Only fetch if it's a different document
            this.showEditor = false;
            this.isEditorModified = false;
            await this.$nextTick();
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
              comments: [],
            };
            this.editorContent = this.document.data.content;
            this.previousContent = this.document.data.content;
            this.previousTitle = this.document.data.name;
            this.isEditorModified = false;
            this.isLoading = false;
            this.$store.commit('setSelectedDocument', this.document);
            
            // Ensure DOM is updated
            await this.$nextTick();
            
            // Delay showing editor to ensure clean mount
            setTimeout(() => {
              this.showEditor = true;
              // Don't increment editorKey on mobile as it causes cursor position issues
              if (!this.$vuetify.display.mobile) {
                this.editorKey++;
              }
            }, 200);
          }
        } catch (error) {
          console.error("Error during route navigation:", error);
          this.isLoading = false;
          this.showEditor = true;
        }
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

    isEditable(newValue) {
      // Force component re-render when editable state changes
      // Don't increment editorKey on mobile as it causes cursor position issues
      if (!this.$vuetify.display.mobile) {
        this.editorKey += 1;
      }
    },
  },
  beforeRouteLeave(to, from, next) {
    // Save any pending changes
    if (this.isEditorModified) {
      this.saveDocument();
    }
    
    // Only unmount editor if we're not creating a document
    if (!this.isCreatingDocument) {
      this.showEditor = false;
    }
    
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
    
    // Reset review panel state
    if (this.$refs.reviewPanel) {
      this.$refs.reviewPanel.resetState();
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
  padding: 24px !important;
  color: inherit !important;
  max-width: none !important;
  margin-bottom: 0px !important;
}

/* More specific selector to override Nord theme padding */
:deep(.milkdown .ProseMirror) {
  padding: 24px !important;
}

:deep(.milkdown .ProseMirror.editor) {
  padding: 24px !important;
}

.document-title{
  padding-left: 1.5rem !important;
}

@media (max-width: 640px) {
  /* Tailwind's sm breakpoint */

  .document-title{
    padding-left: 0px !important;
  }

  :deep(div.ProseMirror.editor) {
    padding: 8px !important;
  }
  
  /* More specific selectors for mobile to override Nord theme */
  :deep(.milkdown .ProseMirror) {
    padding: 8px !important;
  }
  
  :deep(.milkdown .ProseMirror.editor) {
    padding: 8px !important;
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

@media (max-width: 640px) {
  :deep(milkdown-block-handle) {
    display: none !important;
  }
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

/* Navigation drawer layout styles */
.drawer-header {
  border-bottom: 1px solid rgba(var(--v-theme-outline), 0.12);
  overflow-x: hidden; /* Prevent horizontal overflow in header */
}

/* Ensure the entire drawer doesn't overflow horizontally */
:deep(.v-navigation-drawer__content) {
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.comments-container {
  min-height: 0; /* Allow flexbox to shrink this container */
  overflow-x: hidden; /* Prevent horizontal scrolling */
  overflow-y: auto; /* Allow vertical scrolling */
  width: 100%;
  padding-right: 8px; /* Add some padding to prevent content from touching scrollbar */
  box-sizing: border-box;
}

/* Custom scrollbar styling for better UX */
.comments-container::-webkit-scrollbar {
  width: 6px;
}

.comments-container::-webkit-scrollbar-track {
  background: rgba(var(--v-theme-outline), 0.1);
  border-radius: 3px;
}

.comments-container::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-outline), 0.3);
  border-radius: 3px;
}

.comments-container::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--v-theme-outline), 0.5);
}

/* AI Review loading animation */
.rotating {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

</style>
