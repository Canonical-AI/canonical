<template>
  <div class="review-panel">
    <!-- Button toolbar -->
    <div class="d-flex align-center gap-1 my-2 px-4">
      <v-btn-toggle class="gen-btn" density="compact py-0">
        <v-tooltip 
          text="Get AI feedback on your document's overall quality, clarity, and structure" 
          location="bottom"
        >
          <template v-slot:activator="{ props }">
            <v-btn
              :disabled="disabled"
              class="text-none text-sm"
              density="compact"
              v-bind="props"
              @click="handleFeedback"
            >
              <v-icon size="16" class="mr-1">mdi-comment-quote</v-icon>
              Feedback
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
              class="text-none text-sm"
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
      </v-btn-toggle>

      <!-- Show/Hide button for feedback -->
      <v-btn
        v-if="generativeFeedback !== null"
        :disabled="disabled"
        class="text-none"
        density="compact"
        @click="showFeedback = !showFeedback"
        :icon="showFeedback ? 'mdi-eye-off' : 'mdi-eye'"
      >
      </v-btn>
    </div>

    <!-- Feedback content -->
    <div
      v-if="generativeFeedback !== null && showFeedback"
      class="generative-feedback text-sm ma-1 pa-3"
      v-html="renderMarkdown(generativeFeedback)"
    ></div>
  </div>
</template>

<script>
import { marked } from "marked";
import { Feedback } from "../../services/vertexAiService";


export default {
  name: "ReviewPanel",
  data() {
    return {
      isReviewLoading: false,
      generativeFeedback: null,
      showFeedback: true,
    };
  },
  props: {
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
  emits: ["update-document-content"],
  computed: {
    hasAiComments() {
      const comments = this.$store.selected?.comments || [];
      return comments.some(comment => comment.aiGenerated === true);
    },
  },

  methods: {
    renderMarkdown(text) {
      return marked(text);
    },

    async handleFeedback() {
      try {
        const result = await Feedback.generateDocumentFeedback(this.document);
        this.generativeFeedback = "";
        
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          this.generativeFeedback += chunkText;
        }
      } catch (error) {
        console.error('Error generating feedback:', error);
        this.$store.uiAlert({type: 'error', message: 'Failed to generate feedback. Please try again.'});
      }
    },

    async handleReview() {
      if (!this.document?.data?.content || !this.editorRef) {
        this.$store.uiAlert({type: 'warning', message: 'No content to review or editor not ready'});
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

        // Run both overall feedback and inline comments in parallel
        const [feedbackResult, inlineResult] = await Promise.allSettled([
          // Generate overall feedback
          (async () => {
            try {
              const result = await Feedback.generateDocumentFeedback(this.document);
              let newFeedback = "";
              
              for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                newFeedback += chunkText;
                // Only update the UI after we start getting content
                if (newFeedback.trim()) {
                  this.generativeFeedback = newFeedback;
                }
              }
              
              // Ensure final content is set
              this.generativeFeedback = newFeedback;
              return { success: true };
            } catch (error) {
              console.error('Error generating overall feedback:', error);
              return { success: false, error };
            }
          })(),
          
          // Generate inline comments with retry logic
          (async () => {
            const maxRetries = 2;
            let results = null;
            
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              try {
                results = await Feedback.createInlineComments(documentContent, editorView);
                
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

            return results;
          })()
        ]);

        // Handle feedback result
        const feedbackSuccess = feedbackResult.status === 'fulfilled' && feedbackResult.value.success;
        
        // Handle inline comments result
        let inlineSuccess = false;
        let inlineResults = null;
        
        if (inlineResult.status === 'fulfilled') {
          inlineResults = inlineResult.value;
          inlineSuccess = true;
        }

        // Show success messages
        let messages = [];
        
        if (feedbackSuccess) {
          messages.push('Overall feedback generated');
        }
        
        if (inlineSuccess && inlineResults) {
          if (inlineResults.commentsCreated > 0) {
            let inlineMessage = `${inlineResults.commentsCreated} inline comments created`;
            
            if (inlineResults.marksAdded > 0) {
              inlineMessage += ` (${inlineResults.marksAdded} visual marks added)`;
            }
            
            if (inlineResults.marksFailed > 0) {
              inlineMessage += ` (${inlineResults.marksFailed} marks failed)`;
            }
            
            messages.push(inlineMessage);
          } else {
            const noCommentsMessage = documentContent.trim().length < 100 
              ? 'Document too short for inline review' 
              : 'No inline issues found';
            messages.push(noCommentsMessage);
          }
        }

        // Show combined success message
        if (messages.length > 0) {
          this.$store.uiAlert({type: 'success', message: `AI review completed! ${messages.join('. ')}.`});
        }

        // Handle any errors
        if (!feedbackSuccess && !inlineSuccess) {
          throw new Error('Both feedback generation and inline review failed');
        } else if (!feedbackSuccess) {
          console.error('Feedback generation failed:', feedbackResult.reason);
          this.$store.uiAlert({type: 'warning', message: 'Inline review completed, but overall feedback failed'});
        } else if (!inlineSuccess) {
          console.error('Inline review failed:', inlineResult.reason);
          this.$store.uiAlert({type: 'warning', message: 'Overall feedback generated, but inline review failed'});
        }

      } catch (error) {
        console.error('AI review failed:', error);
        this.$store.uiAlert({type: 'error', message: `AI review failed: ${error.message || 'Please try again'}`});
      } finally {
        this.isReviewLoading = false;
      }
    },

    async handleClear() {
      try {
        const allComments = this.$store.selected?.comments || [];
        const aiComments = allComments.filter(comment => comment.aiGenerated === true);
        
        if (aiComments.length === 0) {
          this.$store.uiAlert({type: 'info', message: 'No AI comments found to clear'});
          return;
        }

        // Clear all AI comments and wait for each deletion to complete
        const deletionPromises = aiComments.map(async (comment) => {
          try {
            // Delete from store and database
            await this.$store.commentsDelete(comment.id);
            
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
            this.$store.uiAlert({type: 'success', message: `${successfulDeletions} AI comment${successfulDeletions > 1 ? 's' : ''} cleared successfully`});
        } else if (successfulDeletions === 0) {
          this.$store.uiAlert({type: 'error', message: `Failed to clear any AI comments. Please try again.`});
        } else {
          this.$store.uiAlert({type: 'warning', message: `${successfulDeletions} comment${successfulDeletions > 1 ? 's' : ''} cleared, ${failedDeletions.length} failed`}); 
        }
        
      } catch (error) {
        console.error('Error clearing AI comments:', error);
        this.$store.uiAlert({type: 'error', message: 'Failed to clear AI comments. Please try again.'});
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
        this.showFeedback = true;
      }
    },
    
    // Clear feedback when document changes
    '$route': {
      handler(to, from) {
        // Clear feedback if document ID changes (from params, not query)
        if (from?.params?.id !== to?.params?.id) {
          this.generativeFeedback = null;
        }
      },
      deep: true
    },

    
    // Clear feedback when switching to/from version view
    isViewingVersion() {
      this.generativeFeedback = null;
    },

    // Clear feedback when document changes (additional safety measure)
    'document.id': {
      handler(newId, oldId) {
        if (newId !== oldId && oldId !== undefined) {
          this.generativeFeedback = null;
        }
      }
    },
  },

  beforeUnmount() {
    // Force close any open tooltips when component is unmounted
    const tooltips = document.querySelectorAll('.v-overlay--active');
    tooltips.forEach(tooltip => {
      if (tooltip.classList.contains('v-overlay--tooltip')) {
        tooltip.remove();
      }
    });
  },
};
</script>

<style scoped>
.generative-feedback {
  max-height: 40vh;
  overflow-y: auto;
}

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