<template>
  <v-navigation-drawer
    v-model="drawer"
    location="right"
    width="400"
    :temporary="!drawer"
    class="h-100 d-flex flex-column sidepanel-container"
  >
    <!-- Fixed header section -->
    <div class="drawer-header flex-shrink-0">
      <v-card-actions class="py-0" density="compact" style="min-height: 32px;">
        <v-btn flat icon="mdi-close" @click="drawer = false" density="compact"></v-btn>
        <v-spacer></v-spacer>
        <div v-if="document.data.updatedDate" class="text-medium-emphasis mr-4">
          last update:
          {{ $dayjs(document.data.updatedDate.seconds * 1000).fromNow() }}
        </div>
        <v-menu v-if="document.id" class="border border-surface-light" density="compact">
          <template v-slot:activator="{ props }">
            <v-btn :disabled="isDisabled" v-bind="props" icon density="compact">
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

      <!-- Tab Navigation -->
      <v-tabs
        v-model="activeTab"
        density="compact"
        class="sidepanel-tabs"
        color="primary"
      >
        <v-tab value="review" class="text-none">
          <v-icon size="16" class="mr-1">mdi-file-search</v-icon>
          Review
        </v-tab>
        <v-tab 
          v-if="$store.getters.canAccessAi" 
          value="chat" 
          class="text-none"
        >
          <v-icon size="16" class="mr-1">mdi-robot</v-icon>
          Chat
        </v-tab>
      </v-tabs>
    </div>

    <!-- Sidepanel Content -->
    <div class="sidepanel-content flex-grow-1 overflow-hidden">
      <!-- Review Tab Content -->
      <div v-if="activeTab === 'review'" class="review-tab-content h-100">
        <ReviewPanel
          ref="reviewPanel"
          v-model:isExpanded="isGenPanelExpanded"
          :is-viewing-version="isViewingVersion"
          :disabled="isDisabled"
          :document="document"
          :editor-ref="$refs.milkdownEditor"
        />
        
        <!-- Comments Section -->
        <div class="comments-container flex-grow-1 overflow-y-auto">
          <comment
            v-if="document.id && $store.getters.isUserLoggedIn"
            :doc-id="document.id"
            :doc-type="'document'"
            ref="commentComponent"
            @scroll-to-comment="openDrawerAndScrollToComment"
          />
        </div>
      </div>
      
      <!-- Chat Tab Content -->
      <div v-else-if="activeTab === 'chat'" class="chat-tab-content h-100">
        <ChatSidepanel
          :document-id="document.id"
          :document-content="editorContent"
          @close="activeTab = 'review'"
        />
      </div>
    </div>
  </v-navigation-drawer>

  <v-app-bar
    class="input-container z-10"
    elevation="0"
    style="padding-bottom: 0"
  >
    <!-- Show version modal for existing documents -->
    <VersionModal
      v-if="document.id !== null"
      class="-mr-5"
      :disabled="isDisabled"
      :key="document.id"
      :versions="document.versions"
      :current-version="$route.query.v || 'live'"
    />
    
    <!-- Show template button for new documents -->
    <div v-else-if="$store.getters.canAccessAi && !isEditorModified">
      <v-tooltip 
        text="Generate a template to start your document" 
        location="bottom"
      >
        <template v-slot:activator="{ props }">
          <v-btn
            :disabled="isDisabled"
            class="gen-btn text-none m-2 ml-10 animated-border-btn"
            density="compact"
            v-bind="props"
            @click="showTemplateInput = true"
            prepend-icon="mdi-star-four-points-outline"
          >
            Create from template
          </v-btn>
        </template>
      </v-tooltip>
    </div>
    
    <v-spacer />

    <div
      v-if="document.data.updatedDate && !$vuetify.display.mobile"
      class="text-medium-emphasis mr-4 timestamp-div"
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
      v-if="$store.getters.canAccessAi && document.id !== null" 
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
    <v-tooltip 
      v-if="$store.getters.canAccessAi" 
      text="Chat with your product mentor" 
      location="bottom"
    >
      <template v-slot:activator="{ props }">
        <v-icon
          :disabled="isDisabled"
          class="mx-1"
          v-bind="props"
          @click="openChatSidepanel()"
          icon="mdi-robot"
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
          v-if="!showTemplateInput"
          class="document-title position-relative top-0 left-0 right-0 w-100 whitespace-normal text-3xl font-bold bg-transparent text-gray-900 -mt-2 rounded"
          :contenteditable="isEditable"
          :style="{ minHeight: '1em', outline: 'none' }"
          @blur="isEditable && updateDocumentNameOnBlur"
          @keydown.enter="isEditable && finishEditingTitle"
          @focus="isEditable && ensureContent"
          @click.stop
          ref="editableDiv"
        >
          {{ document.data.name }}
        </div>

        <!-- Template Input Section -->
        <div v-if="!isLoading && showTemplateInput" class="template-input-wrapper">
          <div class="template-input-container animated-border-container">
            <div class="template-input-content">
              <h3 class="text-h5 mb-3">Create from template</h3>
              <p class="text-body-2 mb-4 text-medium-emphasis">
                Describe the document type you want to create
              </p>
              
              <v-textarea
                v-model="templatePrompt"
                label="Describe your document"
                placeholder="e.g., Product Requirements Document, Meeting Notes, Project Plan..."
                rows="3"
                variant="outlined"
                :disabled="isGeneratingTemplate"
                class="mb-3"
                density="compact"
                clearable
              ></v-textarea>
              
              <div class="d-flex justify-end gap-2">
                <v-btn 
                  variant="outlined"
                  @click="cancelTemplateInput"
                  :disabled="isGeneratingTemplate"
                  class="text-none"
                  size="small"
                >
                  Cancel
                </v-btn>
                <v-btn 
                  color="primary" 
                  @click="generateTemplate"
                  :loading="isGeneratingTemplate"
                  :disabled="!templatePrompt.trim()"
                  class="text-none"
                  size="small"
                >
                  <v-icon size="14" class="mr-1">mdi-star-four-points-outline</v-icon>
                  Generate
                </v-btn>
              </div>
            </div>
          </div>
        </div>

        <!-- Editor Section -->
        <div v-if="!isLoading && !showTemplateInput">
          <MilkdownProvider v-if="showEditor">
            <ProsemirrorAdapterProvider>
              <MilkdownEditor
                :key="editorKey"
                :disabled="editorDisabled"
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
import comment from "../comment/comment.vue";
import { MilkdownProvider } from "@milkdown/vue";
import MilkdownEditor from "../editor/MilkdownEditor.vue";
import { fadeTransition } from "../../utils/transitions";
import VersionModal from "./VersionModal.vue";
import ReviewPanel from "./ReviewPanel.vue";
import { copyToClipboard, activateEditor, debounce } from "../../utils/uiHelpers";
import { useEventWatcher } from "../../composables/useEventWatcher";
import { useComments } from "../../composables/comments";
import { Generate } from "../../services/vertexAiService";
import ChatSidepanel from "../chat/ChatSidepanel.vue";

export default {
  components: {
    comment,
    MilkdownEditor,
    ProsemirrorAdapterProvider,
    MilkdownProvider,
    VersionModal,
    ReviewPanel,
    ChatSidepanel,
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
  data() {
    return {
      valid: true,
      isEditorModified: false,
      isLoading: false,
      isLoadingTimeout: false,
      isCreatingDocument: false,
      isEditable: true,
      isSwitchingVersion: false,
      document: {
        id: null,
        data: {
          name: "[DRAFT] - My New Doc..",
          content: "",
          draft: true,
        },
        comments: [],
      },
      drawer: false,
      previousType: null,
      previousContent: null,
      previousTitle: null,
      debounceSave: null,
      isFavorite: false,
      editorKey: 0,
      fadeTransition: fadeTransition,
      isGenPanelExpanded: null,
      showEditor: true,
      eventWatcher: null,
      previousVersion: null,
      showTemplateInput: false,
      templatePrompt: '',
      isGeneratingTemplate: false,
      documentTemplate: null,
      documentContentWatcher: null,
      activeTab: 'review',
    };
  },
  async created() {
    this.isLoading = true;
    
    // Set initial editable state based on route
    const isViewingVersion = this.$route.query.v && this.$route.query.v !== 'live';
    this.isEditable = !isViewingVersion;
    
    if (this.$route.params.id) {
      // Check if there's a version query parameter
      const version = this.$route.query.v;
      await this.fetchDocument(this.$route.params.id, version);
    }
    this.isLoading = false;
    this.debounceSave = debounce(() => this.saveDocument(), 5000);

    // Set up comments composable
    const { handleAcceptSuggestion, handleUndo } = useComments(this.$store, this.$eventStore);
    
    this.documentContentWatcher = useEventWatcher(this.$eventStore, 'replace-document-content', (payload) => {
      
      // If we're switching from version to no version or vice versa, skip the replacement
      if (this.$route.query.v && this.$route.query.v !== 'live') {
        console.log('Skipping content replacement due to version change, TODO FIX THIS LATER');
        return;
      }
      
      const content = this.document.data.content;
      const newContent = content.replace(payload.contentfrom, payload.contentto);
      this.document.data.content = newContent;
      this.editorContent = newContent;
      this.isEditorModified = true;
      this.$refs.milkdownEditor.forceUpdateContent(newContent);
    });

    // Set up event watcher for accept-suggestion events
    this.eventWatcher = useEventWatcher(this.$eventStore, 'accept-suggestion', (payload) => {
      handleAcceptSuggestion(payload, {
        editorContent: this.editorContent,
      });
    });

    this.eventWatcher = useEventWatcher(this.$eventStore, 'undo-comment', (payload) => {
      handleUndo(payload, {
        editorContent: this.editorContent,
        documentData: this.document.data.content,
        isEditorModified: this.isEditorModified,
        refreshEditor: this.$refs.milkdownEditor.forceUpdateContent,
      });
    });

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
        
        // Reset modification tracking BEFORE updating document data to prevent false modification detection
        this.isEditorModified = false;
        
        this.previousTitle = selectedDocument.data.name || "";
        this.previousContent = selectedDocument.data.content || "";
        this.previousType = selectedDocument.data.type || "";
        this.document = {
          ...this.document,
          ...selectedDocument,
        };
        
        this.isFavorite = this.$store.getters.isFavorite(this.document.id);
        
        // Set editable state based on whether we're viewing a version
        if (version) {
          this.isEditable = false;
        } else {
          this.isEditable = true;
        }
        this.editorKey++;

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

    openChatSidepanel() {
      // Open the drawer and switch to chat sidepanel
      this.drawer = true;
      this.activeTab = 'chat';
    },

    toggleFavorite() {
      this.$store.commit("toggleFavorite", this.document.id);
      this.isFavorite = !this.isFavorite;
    },

    copyToClipboard() {
      const url = window.location.href;
      copyToClipboard(url, this.$store, "URL copied to clipboard!");
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
      this.activeTab = 'review';

      this.$nextTick(() => {
        setTimeout(() => {
          if (this.$refs.commentComponent) {
            this.$refs.commentComponent.scrollToComment(commentId);
          }
        }, 300); 
      });
    },

    // Template generation methods
    cancelTemplateInput() {
      this.showTemplateInput = false;
      this.templatePrompt = '';
      this.isGeneratingTemplate = false;
    },

    async generateTemplate() {
      if (!this.templatePrompt.trim()) return;
      
      this.isGeneratingTemplate = true;
      
      try {
        const result = await Generate.generateDocumentTemplate({
          prompt: this.templatePrompt
        });
        
        const templateContent = result.response.text();
        
        // Update the document with the generated template
        this.document.data.content = templateContent;
        this.document.data.name = `[DRAFT] - ${this.templatePrompt.trim()}...`;
        this.isEditorModified = true;
        
        // Force the editor to update with the new content
        this.editorContent = templateContent;
        if (this.$refs.milkdownEditor) {
          this.$refs.milkdownEditor.forceUpdateContent(templateContent);
        }
        
        this.showTemplateInput = false;
        
        this.$store.commit('alert', { 
          type: 'success', 
          message: 'Template generated successfully!', 
          autoClear: true 
        });
        
      } catch (error) {
        console.error('Error generating template:', error);
        this.$store.commit('alert', { 
          type: 'error', 
          message: 'Failed to generate template. Please try again.', 
          autoClear: true 
        });
      } finally {
        this.isGeneratingTemplate = false;
      }
    },

  },
  computed: {
    isDisabled() {
      // Don't override isEditable state - it's managed by version viewing logic
      if (
        this.$store.getters.isUserLoggedIn ||
        this.$store.state.project?.id != null 
      ) {
        return false;
      } else {
        return true;
      }
    },
    isViewingVersion() {
      return this.$route.query.v && this.$route.query.v !== 'live';
    },
    
    editorDisabled() {
      return this.isDisabled || !this.isEditable;
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

        // Skip modification detection if we're switching versions
        if (this.isSwitchingVersion) {
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
          // Check if we're switching between versions or from version to live
          const isVersionChange = to?.query?.v !== from?.query?.v;
          const isSameDocument = to?.params?.id === from?.params?.id && to?.path === from?.path;
          
          // If same document and no version change, skip reload
          if (isSameDocument && !isVersionChange) {
            console.log('Same document, no version change - skipping reload');
            return;
          }

          // Set version switching flag to prevent false modification detection
          // Only set flag if we're switching between versions, not on initial load
          if (isVersionChange && from?.query?.v !== undefined) {
            this.isSwitchingVersion = true;
          }

          // If switching from version to live (or vice versa), don't save
          if (isVersionChange && this.isEditorModified) {
            console.log('Version change detected - not saving, will reload');
            this.isEditorModified = false; // Reset to prevent saving
          } else if (this.isEditorModified && !isVersionChange) {
            // Only save if we're not changing versions
            console.log('saving document before navigation');
            await this.saveDocument();
          }
          
          // Track the previous version before making changes
          this.previousVersion = this.$route.query.v;
          
          if (to.params.id && to.query.v) {
            // Load Version
            this.showEditor = false;
            this.isEditorModified = false;
            await this.$nextTick();
            await this.fetchDocument(this.$route.params.id, this.$route.query.v);
          } else if (to.params.id) {
            // Loading live version
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

          // Clear version switching flag after a short delay to allow document.data watcher to settle
          if (isVersionChange && from?.query?.v !== undefined) {
            setTimeout(() => {
              this.isSwitchingVersion = false;
            }, 100);
          }
        } catch (error) {
          console.error("Error during route navigation:", error);
          this.isLoading = false;
          this.showEditor = true;
          this.isSwitchingVersion = false; // Ensure flag is cleared on error
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
    
    isViewingVersion(newValue, oldValue) {
      // Don't run during initial component creation
      if (this.isLoading) {
        return;
      }
      
      // Update isEditable when version viewing state changes
      if (newValue !== oldValue) {
        this.isEditable = !newValue; // If viewing version, not editable; if viewing live, editable
      }
    },
  },
  beforeRouteLeave(to, from, next) {
    // Check if we're switching versions - don't save in that case
    const isVersionChange = to.query?.v !== from.query?.v;
    const isSameDocument = to.params.id === from.params.id && to.path === from.path;
    
    // Set version switching flag if this is a version change (not initial load)
    if (isVersionChange && from.query?.v !== undefined) {
      this.isSwitchingVersion = true;
    }
    
    // Only save if we're not switching versions and have modifications
    if (this.isEditorModified && !isVersionChange) {
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
    // Check if we're in the middle of a version change - don't save in that case
    const isViewingVersion = this.$route.query.v && this.$route.query.v !== 'live';
    
    // Only save if we're not viewing a version and have modifications
    if (this.isEditorModified && !isViewingVersion && !this.isSwitchingVersion) {
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
    
    // Clean up event watcher
    if (this.eventWatcher) {
      this.eventWatcher = null;
    }
    
    // Force the editor to be unmounted cleanly
    this.editorKey += 1;
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
  container-type: inline-size;
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


:deep(.milkdown .ProseMirror.editor) {
  padding: 24px !important;
  padding-bottom: 0px !important;
  padding-top: 0px !important;
}

/* Custom heading styles for Milkdown editor */
:deep(.milkdown h1) {
  font-size: 2rem !important;
  font-weight: 700 !important;
  line-height: 1.2 !important;
  margin: 1.5rem 0 1rem 0 !important;
}

:deep(.milkdown h2) {
  font-size: 1.5rem !important;
  font-weight: 600 !important;
  line-height: 1.3 !important;
  margin: 1.25rem 0 0.75rem 0 !important;
}

:deep(.milkdown h3) {
  font-size: 1.25rem !important;
  font-weight: 600 !important;
  font-style: italic !important;
  line-height: 1.4 !important;
  margin: 1rem 0 0.5rem 0 !important;
}

:deep(.milkdown h4) {
  font-size: 1.1rem !important;
  font-weight: 500 !important;
  font-style: italic !important;
  line-height: 1.4 !important;
  margin: 0.875rem 0 0.5rem 0 !important;
}

:deep(.milkdown h5) {
  font-size: 1rem !important;
  font-weight: 500 !important;
  font-style: italic !important;
  line-height: 1.4 !important;
  margin: 0.75rem 0 0.5rem 0 !important;
}

:deep(.milkdown h6) {
  font-size: 0.9rem !important;
  font-weight: 500 !important;
  font-style: italic !important;
  line-height: 1.4 !important;
  margin: 0.75rem 0 0.5rem 0 !important;
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

.sidepanel-container {
  padding-bottom: 48px!important;
}

/* Sidepanel tabs */
.sidepanel-tabs {
  background-color: rgb(var(--v-theme-surface));
}

.sidepanel-tabs .v-tab {
  text-transform: none;
  font-weight: 500;
}

/* Sidepanel content container */
.sidepanel-content {
  display: flex;
  flex-direction: column;
  min-height: 0; /* Allow flexbox to shrink this container */
}

/* Review tab content */
.review-tab-content {
  display: flex;
  flex-direction: column;
}

/* Chat tab content */
.chat-tab-content {
  display: flex;
  flex-direction: column;
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

/* Template input wrapper and container */
.template-input-wrapper {
  width: 100%;
  height: 100vh;
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
  padding: 2rem;
  padding-top: 1rem;
}

.template-input-container {
  width: 400px;
  max-width: 90vw;
}



.template-input-content {
  background-color: rgb(var(--v-theme-surface));
  border-radius: 12px;
  padding: 1.5rem;
  position: relative;
  z-index: 1;
  width: 100%;
  border: 1px solid rgba(var(--v-theme-outline), 0.2);
}

@media (max-width: 768px) {
  .template-input-wrapper {
    padding: 1rem;
    justify-content: center;
    align-items: flex-start;
  }
  
  .template-input-container {
    width: 100%;
    max-width: none;
  }
  
  .template-input-content {
    padding: 1rem;
  }
}

/* Hide timestamp when input-container width is less than 600px */
@container (max-width: 600px) {
  .input-container .timestamp-div,
  .drawer-header .timestamp-div {
    display: none !important;
  }
}

</style>
