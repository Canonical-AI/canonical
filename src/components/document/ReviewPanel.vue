<template>
  <v-expansion-panels v-model="expandedModel" variant="accordion">
    <v-expansion-panel>
      <v-expansion-panel-title>
        <v-btn-toggle class="gen-btn" density="compact">
          <v-tooltip text="Get AI feedback on your document's overall quality, clarity, and structure" location="bottom">
            <template v-slot:activator="{ props }">
              <v-btn
                :disabled="disabled"
                class="text-none"
                density="compact"
                v-bind="props"
                @click="handleFeedback"
              >
                <v-icon size="16" class="mr-1">mdi-comment-quote</v-icon>
                {{ hasAiComments ? '' : 'Feedback' }}
              </v-btn>
            </template>
          </v-tooltip>
          
          <v-tooltip 
            :text="isViewingVersion ? 
              'Review this document version with AI - suggestions will be applied to the live version' : 
              'Generate detailed inline comments with specific suggestions for improvement'" 
            location="bottom"
          >
            <template v-slot:activator="{ props }">
              <v-btn
                :disabled="disabled || isReviewLoading"
                class="text-none"
                density="compact"
                v-bind="props"
                @click="handleReview"
              >
                <v-progress-circular
                  v-if="isReviewLoading"
                  indeterminate
                  size="16"
                  width="2"
                  class="mr-1"
                ></v-progress-circular>
                <v-icon v-else size="16" class="mr-1">mdi-file-search</v-icon>
                {{ hasAiComments ? '' : 'Review' }}
              </v-btn>
            </template>
          </v-tooltip>
          
          <v-tooltip v-if="hasAiComments" text="Clear AI comments" location="bottom">
            <template v-slot:activator="{ props }">
              <v-btn
                :disabled="disabled"
                class="text-none"
                density="compact"
                v-bind="props"
                @click="handleClear"
              >
                <v-icon size="16" class="mr-1">mdi-broom</v-icon>
              </v-btn>
            </template>
          </v-tooltip>
          
          <v-tooltip 
            v-if="$store.state.undoStore.length > 0"
            :text="isViewingVersion ? 
              'Undo last AI change (will navigate to live version)' : 
              'Undo last AI change'" 
            location="bottom"
          >
            <template v-slot:activator="{ props }">
              <v-btn
                :disabled="disabled"
                class="text-none"
                density="compact"
                v-bind="props"
                @click="handleUndoAll()"
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
  </v-expansion-panels>
</template>

<script>
import { marked } from "marked";
import { DocumentReview } from "../../services/vertexAiService";
import { showAlert } from "../../utils/uiHelpers";
import { inject } from 'vue';

export default {
  name: "ReviewPanel",
  data() {
    return {
      isReviewLoading: false,
      generativeFeedback: null,
    };
  },
  props: {
    isExpanded: {
      type: Number,
      default: null,
    },
    isViewingVersion: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    document: {
      type: Object,
      required: true,
    },
    editorRef: {
      type: Object,
      default: null,
    },
  },
  emits: ["update:isExpanded", "update-document-content"],
  computed: {
    expandedModel: {
      get() {
        return this.isExpanded;
      },
      set(value) {
        this.$emit('update:isExpanded', value);
      },
    },
    hasAiComments() {
      const comments = this.$store.state.selected?.comments || [];
      return comments.some(comment => comment.aiGenerated === true);
    },
    undoStore() {
      return this.getUndoStore ? this.getUndoStore() : [];
    },
  },

  methods: {
    renderMarkdown(text) {
      return marked(text);
    },

    async handleFeedback() {
      try {
        const result = await DocumentReview.generateFeedback(this.document);
        this.generativeFeedback = "";
        
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          this.generativeFeedback += chunkText;
        }
        
        // Expand panel to show feedback
        this.expandedModel = 0;
      } catch (error) {
        console.error('Error generating feedback:', error);
        showAlert(this.$store, 'error', 'Failed to generate feedback. Please try again.');
      }
    },

    async handleReview() {
      if (!this.document?.data?.content || !this.editorRef) {
        showAlert(this.$store, 'warning', 'No content to review or editor not ready');
        return;
      }

      this.isReviewLoading = true;

      try {
        const documentContent = this.document.data.content;
        
        // Get the actual editor view from the MilkdownEditor component
        let editorView = null;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!editorView && attempts < maxAttempts) {
          editorView = this.editorRef.getEditorView();
          if (!editorView) {
            attempts++;
            if (attempts < maxAttempts) {
              console.log(`Editor not ready, attempt ${attempts}/${maxAttempts}, waiting...`);
              await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
            }
          }
        }
        
        if (!editorView) {
          throw new Error('Editor view not available after multiple attempts. Please try again.');
        }
        
        const maxRetries = 2;
        let results = null;
        
        // Retry loop for better reliability
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            results = await DocumentReview.createInlineComments(documentContent, editorView);
            
            if (results.success && (results.commentsCreated > 0 || documentContent.trim().length < 100)) {
              break;
            }
            
            if (results.success && results.commentsCreated === 0 && attempt < maxRetries) {
              console.log(`AI review attempt ${attempt} generated no comments, retrying...`);
              continue;
            }
            break;
            
          } catch (attemptError) {
            if (attempt === maxRetries) throw attemptError;
            console.log(`AI review attempt ${attempt} failed, retrying...`, attemptError);
          }
        }

        if (!results || !results.success) {
          throw new Error(results?.error || 'AI review failed to generate results');
        }


        // Show detailed success message with mark information
        if (results.commentsCreated > 0) {
          let message = `AI review completed! ${results.commentsCreated} comments created.`;
          
          if (results.marksAdded > 0) {
            message += ` ${results.marksAdded} visual marks added to the editor.`;
          }
          
          if (results.marksFailed > 0) {
            message += ` ${results.marksFailed} comments couldn't be visually marked (text may have changed).`;
          }
          
          showAlert(this.$store, 'success', message);
        } else {
          const message = documentContent.trim().length < 100 
            ? 'Document is too short for meaningful review.' 
            : 'Great! No issues found in your document.';
          showAlert(this.$store, 'info', message);
        }

      } catch (error) {
        console.error('AI review failed:', error);
        showAlert(this.$store, 'error', `AI review failed: ${error.message || 'Please try again'}`);
      } finally {
        this.isReviewLoading = false;
      }
    },

    async handleClear() {
      try {
        const allComments = this.$store.state.selected?.comments || [];
        const aiComments = allComments.filter(comment => comment.aiGenerated === true);
        
        if (aiComments.length === 0) {
          showAlert(this.$store, 'info', 'No AI comments found to clear');
          return;
        }

        // Clear all AI comments and wait for each deletion to complete
        const deletionPromises = aiComments.map(async (comment) => {
          try {
            // Delete from store and database
            await this.$store.dispatch('deleteComment', comment.id);
            
            // Remove visual marks from editor
            if (this.editorRef) {
              const editorView = this.editorRef.getEditorView();
              if (editorView) {
                const { removeCommentMarkById } = await import('../../components/editor/comment/index.js');
                removeCommentMarkById(editorView, comment.id);
              }
            }
            
            return { success: true, commentId: comment.id };
          } catch (error) {
            console.error(`Failed to delete comment ${comment.id}:`, error);
            return { success: false, commentId: comment.id, error: error.message };
          }
        });

        // Wait for all deletions to complete
        const results = await Promise.all(deletionPromises);
        
        // Count successes and failures
        const successfulDeletions = results.filter(r => r.success).length;
        const failedDeletions = results.filter(r => !r.success);
        

        // Show appropriate message
        if (failedDeletions.length === 0) {
          showAlert(this.$store, 'success', `${successfulDeletions} AI comment${successfulDeletions > 1 ? 's' : ''} cleared successfully`);
        } else if (successfulDeletions === 0) {
          showAlert(this.$store, 'error', `Failed to clear any AI comments. Please try again.`);
        } else {
          showAlert(this.$store, 'warning', `${successfulDeletions} comment${successfulDeletions > 1 ? 's' : ''} cleared, ${failedDeletions.length} failed`);
        }
        
      } catch (error) {
        console.error('Error clearing AI comments:', error);
        showAlert(this.$store, 'error', 'Failed to clear AI comments. Please try again.');
      }
    },

    resetState() {
      this.isReviewLoading = false;
      this.generativeFeedback = null;
    },

  },

  watch: {
    generativeFeedback(newValue) {
      if (newValue !== null) {
        this.expandedModel = 0;
      }
    },
  },
};
</script>

<style scoped>
.generative-feedback :deep(ul),
.generative-feedback :deep(ol) {
  padding-left: 1em;
}

.generative-feedback :deep(p) {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

/* Make buttons more compact */
.gen-btn .v-btn {
  min-width: auto !important;
  width: auto !important;
  padding: 0 8px !important;
}

.gen-btn .v-btn__content {
  justify-content: center;
}

/* Ensure icons are properly sized */
.gen-btn .v-icon {
  margin-right: 0 !important;
}
</style> 