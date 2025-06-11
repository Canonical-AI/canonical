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

      <v-expansion-panels v-model="isGenPanelExpanded" variant="accordion">
        <v-expansion-panel>
          <v-expansion-panel-title>
            <v-btn-toggle class="gen-btn" density="compact">
              <v-tooltip text="Get AI feedback on your document's overall quality, clarity, and structure" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn
                    :disabled="isDisabled"
                    class="text-none"
                    density="compact"
                    v-bind="props"
                    @click="sendPromptToVertexAI()"
                  >Feedback
                  </v-btn>
                </template>
              </v-tooltip>
              <v-tooltip text="Generate detailed inline comments with specific suggestions for improvement" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn
                    :disabled="isDisabled || isReviewLoading"
                    class="text-none"
                    density="compact"
                    v-bind="props"
                    @click="startAiReview()"
                  >
                    <v-progress-circular
                      v-if="isReviewLoading"
                      indeterminate
                      size="16"
                      width="2"
                      class="mr-1"
                    ></v-progress-circular>
                    Review
                  </v-btn>
                </template>
              </v-tooltip>
              <v-tooltip 
                v-if="hasAiComments" 
                text="Clear AI comments" 
                location="bottom"
              >
                <template v-slot:activator="{ props }">
                  <v-btn
                    :disabled="isDisabled"
                    class="text-none"
                    density="compact"
                    v-bind="props"
                    @click="clearAiComments"
                  >
                    <v-icon size="16" class="mr-1">mdi-broom</v-icon>
                    Clear
                  </v-btn>
                </template>
              </v-tooltip>
              <v-tooltip 
                v-if="canUndo" 
                text="Undo last AI change" 
                location="bottom"
              >
                <template v-slot:activator="{ props }">
                  <v-btn
                    :disabled="isDisabled"
                    class="text-none"
                    density="compact"
                    v-bind="props"
                    @click="undoLastChange"
                  >
                    <v-icon size="16" class="mr-1">mdi-undo</v-icon>
                    Undo
                  </v-btn>
                </template>
              </v-tooltip>
            </v-btn-toggle>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <p
              class="generative-feedback text-sm ma-1 pa-1"
              v-if="generativeFeedback !== null"
              v-html="renderMarkdown(generativeFeedback)"
            ></p>
          </v-expansion-panel-text>
        </v-expansion-panel>
        
        <!-- AI Document Review Panel -->

      </v-expansion-panels>
    </div>

    <!-- Scrollable comments section -->
    <div class="comments-container flex-grow-1 overflow-y-auto">
      <comment
        v-if="document.id && $store.getters.isUserLoggedIn"
        :doc-id="document.id"
        :doc-type="'document'"
        ref="commentComponent"
        @scroll-to-comment="openDrawerAndScrollToComment"
        @refresh-editor-decorations="refreshEditorDecorations"
        @scroll-to-editor="scrollToCommentInEditor"
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
          @click="sendPromptToVertexAI()"
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
import { Feedback, DocumentReview } from "../../services/vertexAiService";
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
    undoStack: [], // Track document states for undo
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
    isReviewLoading: false,
    reviewResults: null,
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
  
  mounted() {
    // Ensure the editor gets activated after mounting
    setTimeout(() => {
      this.activateEditor();
    }, 500);
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
        this.$refs?.milkdownEditor?.updateCommentPositionsOnSave();
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

    async startAiReview() {
      this.sendPromptToVertexAI()

      if (!this.document.data.content || !this.$refs.milkdownEditor) {
        this.$store.commit('alert', { 
          type: 'warning', 
          message: 'No content to review or editor not ready', 
          autoClear: true 
        });
        return;
      }

      this.isReviewLoading = true;
      this.reviewResults = null;

      const editorRef = this.$refs.milkdownEditor;
      const documentContent = this.document.data.content;
      const maxRetries = 2;
      let attempt = 0;
      let results = null;

      try {
        // Retry loop - attempt up to maxRetries times
        while (attempt < maxRetries) {
          attempt++;
          
          try {
            results = await DocumentReview.createInlineComments(documentContent, editorRef);
            
            // If we got comments or the document is very short, break out of retry loop
            if (results.success && (results.commentsCreated > 0 || documentContent.trim().length < 100)) {
              break;
            }
            
            // If no comments were generated and we have more attempts, retry
            if (results.success && results.commentsCreated === 0 && attempt < maxRetries) {
              console.log(`AI review attempt ${attempt} generated no comments, retrying...`);
              continue;
            }
            
            // If we reach here, either we got comments or we're out of retries
            break;
            
          } catch (attemptError) {
            // If this was our last attempt, let the error bubble up
            if (attempt === maxRetries) { throw attemptError; }
            console.log(`AI review attempt ${attempt} failed, retrying...`, attemptError);
          }
        }

        if (!results || !results.success) {
          throw new Error(results?.error || 'AI review failed to generate results');
        }

        this.reviewResults = results;

        // Refresh editor decorations to show new comments
        this.$nextTick(() => {
          if (this.$refs.milkdownEditor) {
            this.$refs.milkdownEditor.refreshCommentDecorations();
          }
        });

        // Show appropriate success message
        if (results.commentsCreated > 0) {
          let message = `AI review completed! ${results.commentsCreated} inline comments added.`;
          if (results.failedComments > 0) {
            message += ` (${results.failedComments} comments could not be positioned)`;
          }
          this.$store.commit('alert', { 
            type: 'success', 
            message: message, 
            autoClear: true 
          });
        } else {
          // Only show "no issues" if document is actually short
          const message = documentContent.trim().length < 100 
            ? 'Document is too short for meaningful review.' 
            : 'Great! No issues found in your document.';
          this.$store.commit('alert', { 
            type: 'info', 
            message: message, 
            autoClear: true 
          });
        }

      } catch (error) {
        console.error('AI review failed after all attempts:', error);
        this.reviewResults = {
          success: false,
          error: error.message || 'An unexpected error occurred'
        };
        
        this.$store.commit('alert', { 
          type: 'error', 
          message: `AI review failed: ${error.message || 'Please try again'}`, 
          autoClear: true 
        });
      } finally {
        this.isReviewLoading = false;
      }
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
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false); // false means collapse to end
        selection.removeAllRanges();
        selection.addRange(range);
      } catch (error) {
        console.warn('Could not place cursor at end:', error);
      }
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
      if (this.isLoading || !this.showEditor) return;
      
      try {
        setTimeout(() => {
          const editorElement = document.querySelector('.ProseMirror.editor');
          if (editorElement) {

            if (this.$vuetify.display.mobile) {
              if (document.activeElement !== editorElement) {
                editorElement.focus();
              }
            } else {
              // Desktop behavior: clear focus, then set focus with cursor
              document.activeElement?.blur();
              editorElement.focus();
              
              // Only set cursor position if there's no existing selection
              const selection = window.getSelection();
              if (selection.rangeCount === 0) {
                // Find a text node to place cursor in rather than at element position 0
                const textNode = this.findFirstTextNode(editorElement);
                if (textNode) {
                  const range = document.createRange();
                  // Place cursor at end of text rather than beginning
                  range.setStart(textNode, textNode.textContent.length);
                  range.collapse(true);
                  selection.removeAllRanges();
                  selection.addRange(range);
                }
              }
            }
          }
        }, 50);
      } catch (error) {
        console.error("Error focusing editor:", error);
      }
    },
    
    // Helper function to find the first text node in the editor
    findFirstTextNode(element) {
      // If this is a text node, return it
      if (element.nodeType === Node.TEXT_NODE && element.textContent.trim()) {
        return element;
      }

      for (let i = 0; i < element.childNodes.length; i++) {
        const textNode = this.findFirstTextNode(element.childNodes[i]);
        if (textNode) {
          return textNode;
        }
      }
      
      return null;
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


    // Method to refresh editor decorations when comments are resolved/unresolved
    refreshEditorDecorations() {
      this.$nextTick(() => {
        if (this.$refs.milkdownEditor) {
          this.$refs.milkdownEditor.refreshCommentDecorations();
        }
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

    // Method to clear all AI-generated comments
    async clearAiComments() {
      try {
        // Get all AI comments from the store
        const allComments = this.$store.state.selected?.comments || [];
        const aiComments = allComments.filter(comment => comment.aiGenerated === true);
        
        if (aiComments.length === 0) {
          this.$store.commit('alert', { 
            type: 'info', 
            message: 'No AI comments found to clear', 
            autoClear: true 
          });
          return;
        }

        // Delete each AI comment
        const deletePromises = aiComments.map(comment => 
          this.$store.dispatch('deleteComment', comment.id)
        );

        await Promise.all(deletePromises);

        // Refresh editor decorations to remove visual indicators
        this.$nextTick(() => {
          if (this.$refs.milkdownEditor) {
            this.$refs.milkdownEditor.refreshCommentDecorations();
          }
        });

        this.$store.commit('alert', { 
          type: 'success', 
          message: `${aiComments.length} AI comment${aiComments.length > 1 ? 's' : ''} cleared`, 
          autoClear: true 
        });

      } catch (error) {
        console.error('Error clearing AI comments:', error);
        this.$store.commit('alert', { 
          type: 'error', 
          message: 'Failed to clear AI comments. Please try again.', 
          autoClear: true 
        });
      }
    },

    // Method to handle accepting AI suggestions
    async handleAcceptSuggestion(suggestionData) {
      try {
        const { commentId, suggestion, editorPosition } = suggestionData;
        const selectedText = editorPosition.selectedText;
        
        if (!selectedText || !suggestion) {
          throw new Error('Missing text or suggestion data');
        }

        // Save current state to undo stack before making changes
        this.saveUndoState({
          content: this.document.data.content,
          commentId: commentId,
          action: 'accept-suggestion',
          originalText: selectedText,
          newText: suggestion
        });

        // Replace the text in the document content
        // We're using just the first instance of text to replace because we're getting responses from an LLM which doesnt have a way to get the exact location, instead we've asked it to be very specific in the pompt
        let currentContent = this.document.data.content;
        const updatedContent = currentContent.replace(selectedText, suggestion);
        
        if (currentContent === updatedContent) {
          throw new Error('Text not found in document content');
        }

        // Update the document data
        this.document.data.content = updatedContent;
        
        // Update the store - only pass document data, not comments
        const documentUpdateData = {
          id: this.document.id,
          data: this.document.data
        };
        this.$store.commit("updateSelectedDocument", documentUpdateData);

        // Force editor refresh by incrementing the key (but not on mobile to avoid cursor issues)
        if (!this.$vuetify.display.mobile) {
          this.editorKey++;
        }

        // Resolve the comment after successful replacement
        await this.$store.dispatch('updateCommentData', {
          id: commentId,
          data: { resolved: true }
        });

        // Refresh editor decorations
        this.$nextTick(() => {
          if (this.$refs.milkdownEditor) {
            this.$refs.milkdownEditor.refreshCommentDecorations();
          }
        });

        this.$store.commit('alert', { 
          type: 'success', 
          message: 'AI suggestion accepted and applied', 
          autoClear: true 
        });

      } catch (error) {
        console.error('Error accepting suggestion:', error);
        this.$store.commit('alert', { 
          type: 'error', 
          message: 'Failed to apply suggestion. Please try again.', 
          autoClear: true 
        });
      }
    },

    // Method to save current state for undo functionality
    saveUndoState(undoData) {
      // Limit undo stack to last 10 operations to prevent memory issues
      if (this.undoStack.length >= 10) {
        this.undoStack.shift(); // Remove oldest entry
      }
      
      this.undoStack.push({
        ...undoData,
        timestamp: Date.now()
      });
    },

    // Method to undo the last change
    async undoLastChange() {
      if (this.undoStack.length === 0) {
          this.$store.commit('alert', { 
            type: 'info', 
            message: 'Nothing to undo', 
            autoClear: true 
          });
          return;
      }

      const lastChange = this.undoStack.pop();
      if (!lastChange) return;

      this.document.data.content = lastChange.content;
      
      // Update the store - only pass document data, not comments
      const documentUpdateData = {
        id: this.document.id,
        data: this.document.data
      };
      this.$store.commit("updateSelectedDocument", documentUpdateData);

      // If this was an accepted suggestion, unresolve the comment
      if (lastChange.action === 'accept-suggestion' && lastChange.commentId) {
        await this.$store.dispatch('updateCommentData', {
          id: lastChange.commentId,
          data: { resolved: false }
        });
      }

      // Refresh editor decorations
      this.$nextTick(() => {
        if (this.$refs.milkdownEditor) {
          this.$refs.milkdownEditor.refreshCommentDecorations();
        }
      });

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
    hasAiComments() {
      const comments = this.$store.state.selected?.comments || [];
      return comments.some(comment => comment.aiGenerated === true);
    },
    canUndo() {
      return this.undoStack.length > 0;
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

    generativeFeedback(newValue) {
      if (newValue !== null) {
        this.isGenPanelExpanded = 0;
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

.generative-feedback :deep(ul),
.generative-feedback :deep(ol) {
  padding-left: 1em;
}

.generative-feedback :deep(p) {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
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
