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
            v-if="undoStore.length > 0"
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

export default {
  name: "ReviewPanel",
  data() {
    return {
      isReviewLoading: false,
      generativeFeedback: null,
      undoStore: [],
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
  emits: ["update:isExpanded", "refresh-editor", "update-document-content"],
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
        const maxRetries = 2;
        let results = null;
        
        // Retry loop for better reliability
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            results = await DocumentReview.createInlineComments(documentContent, this.editorRef);
            
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

        this.$emit('refresh-editor');

        // Show appropriate success message
        if (results.commentsCreated > 0) {
          let message = `AI review completed! ${results.commentsCreated} inline comments added.`;
          if (results.failedComments > 0) {
            message += ` (${results.failedComments} comments could not be positioned)`;
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

        await Promise.all(aiComments.map(comment => 
          this.$store.dispatch('deleteComment', comment.id)
        ));

        this.$emit('refresh-editor');
        showAlert(this.$store, 'success', `${aiComments.length} AI comment${aiComments.length > 1 ? 's' : ''} cleared`);
        
      } catch (error) {
        console.error('Error clearing AI comments:', error);
        showAlert(this.$store, 'error', 'Failed to clear AI comments. Please try again.');
      }
    },

    async handleUndoAll() {
      if (this.undoStore.length === 0) {
        console.warn('Nothing to undo');
        return;
      }

      // Find the oldest item (first one added) by timestamp
      const oldestItem = this.undoStore.reduce((oldest, current) => 
        current.timestamp < oldest.timestamp ? current : oldest
      );

      // Emit event to parent to update the document content
            
      for ( const comment of this.undoStore) {
        this.$store.dispatch('updateCommentData', {
          id: comment.commentID,
          data: { resolved: false }
        });
      }
      this.$emit('update-document-content', oldestItem.content);


      this.undoStore = [];
      this.$emit('refresh-editor');
      
      showAlert(this.$store, 'success', 'Document content restored to original state');
    },

    async handleUndoOne() {
      if (this.undoStore.length === 0) {
        console.warn('Nothing to undo');
        return;
      }
      
    },

    async addUndo(commentId, content){
      this.undoStore.push({
        commentID: commentId, 
        content: content, 
        timestamp: Date.now()});
    }, 


    resetState() {
      this.isReviewLoading = false;
      this.generativeFeedback = null;
      this.undoStore = [];
    },


    async handleAcceptSuggestion(suggestionData) {
      try {
        const { commentId, suggestion, editorPosition } = suggestionData;
        const selectedText = editorPosition.selectedText;
        
        if (!selectedText || !suggestion) {
          throw new Error('Missing text or suggestion data');
        }

        // Check if we're viewing a version (not live)
        const isViewingVersion = this.$route.query.v && this.$route.query.v !== 'live';
        
        if (isViewingVersion) {
          // We're viewing a version, need to apply to live version
          return await this.applySuggestionToLiveVersion(suggestionData);
        }

        // We're on live version, proceed normally
        await this.applySuggestionToCurrentDocument(suggestionData);

      } catch (error) {
        console.error('Error accepting suggestion:', error);
        showAlert(this.$store, 'error', 'Failed to apply suggestion. Please try again.');
        return { success: false };
      }
    },

    async applySuggestionToCurrentDocument(suggestionData) {
      const { commentId, suggestion, editorPosition } = suggestionData;
      const selectedText = editorPosition.selectedText;

      // Try to replace text in document with improved logic
      const currentContent = this.document.data.content;
      let updatedContent = this.performTextReplacement(currentContent, selectedText, suggestion);
      
      if (currentContent === updatedContent) {
        showAlert(this.$store, 'warning', 
            'The text to be replaced could not be found. It may have been modified by a previous suggestion. ' +
            'Please check the document and apply the suggestion manually if needed.'
          );
          return { success: false, needsEditorRefresh: true };
      }

      // Update document
      this.addUndo(commentId, this.document.data.content);
      this.$emit('update-document-content', updatedContent);

      // Resolve the comment
      await this.$store.dispatch('updateCommentData', {
        id: commentId,
        data: { resolved: true }
      });

      this.$emit('refresh-editor');
      showAlert(this.$store, 'success', 'AI suggestion accepted and applied');

      return { success: true, needsEditorRefresh: true, shouldRefreshSuggestions: true };
    },
  
    async applySuggestionToLiveVersion(suggestionData) {
      const { commentId, suggestion, editorPosition } = suggestionData;
      const selectedText = editorPosition.selectedText;

      try {
        // Fetch the live version of the document
        const liveDocResult = await this.$store.dispatch("selectDocument", { 
          id: this.document.id, 
          version: null 
        });
        
        if (!liveDocResult || !liveDocResult.data) {
          throw new Error('Could not fetch live version of document');
        }

        const liveDocument = this.$store.state.selected;
        const liveContent = liveDocument.data.content;

        let updatedContent = this.performTextReplacement(liveContent, selectedText, suggestion);
        
        if (liveContent === updatedContent) {
          showAlert(this.$store, 'warning', 
            'The text to be replaced could not be found. It may have been modified by a previous suggestion. ' +
            'Please check the document and apply the suggestion manually if needed.'
          );
          return { success: false, needsEditorRefresh: true };
        }
        
        // Update live document
        this.addUndo(commentId, liveContent);
        liveDocument.data.content = updatedContent;
        this.$emit('update-document-content', updatedContent);

        // Resolve the comment in the live version
        await this.$store.dispatch('updateCommentData', {
          id: commentId,
          data: { resolved: true }
        });

        // Navigate to live version to show the applied change
        await this.$router.push({ 
          path: `/document/${this.document.id}`,
          query: {} // Remove version query to go to live
        });

        showAlert(this.$store, 'success', 
          'AI suggestion applied to live document. You have been redirected to the updated live version.'
        );

        return { 
          success: true, 
          navigatedToLive: true,
          needsEditorRefresh: true 
        };

      } catch (error) {
        console.error('Error applying suggestion to live version:', error);
        
        // If there's an error, still try to navigate to live version
        try {
          await this.$router.push({ 
            path: `/document/${this.document.id}`,
            query: {} 
          });
          showAlert(this.$store, 'error', 
            'Could not automatically apply suggestion. Please apply it manually in the live document.'
          );
        } catch (navError) {
          console.error('Navigation error:', navError);
        }
        
        return { success: false, navigatedToLive: true };
      }
    },

    performTextReplacement(content, originalText, newText) {
      return content.replace(originalText, newText);
    },

    performFuzzyTextReplacement(content, originalText, newText) {
      // Try to find the text with normalized whitespace
      const normalizedOriginal = originalText.replace(/\s+/g, ' ').trim();
      const normalizedContent = content.replace(/\s+/g, ' ');
      
      if (normalizedContent.includes(normalizedOriginal)) {
        return content.replace(new RegExp(originalText.replace(/\s+/g, '\\s+'), 'g'), newText);
      }

      // Try to find a substring match (at least 80% of the original text)
      const minMatchLength = Math.floor(originalText.length * 0.8);
      if (originalText.length > minMatchLength) {
        const substring = originalText.substring(0, minMatchLength);
        if (content.includes(substring)) {
          // Find the full context around the substring
          const startIndex = content.indexOf(substring);
          const endIndex = startIndex + originalText.length;
          const contextText = content.substring(startIndex, Math.min(endIndex, content.length));
          
          // Replace the context with the suggestion
          return content.replace(contextText, newText);
        }
      }

      // Try word-by-word matching for cases where punctuation might have changed
      const originalWords = originalText.split(/\s+/);
      const contentWords = content.split(/\s+/);
      
      if (originalWords.length >= 3) {
        // Look for sequences of at least 3 consecutive words
        for (let i = 0; i <= contentWords.length - originalWords.length; i++) {
          const slice = contentWords.slice(i, i + originalWords.length);
          const matchingWords = slice.filter((word, index) => 
            word.toLowerCase().includes(originalWords[index].toLowerCase()) ||
            originalWords[index].toLowerCase().includes(word.toLowerCase())
          );
          
          if (matchingWords.length >= originalWords.length * 0.8) {
            // Found a potential match, replace this section
            const beforeWords = contentWords.slice(0, i);
            const afterWords = contentWords.slice(i + originalWords.length);
            const newContentWords = [...beforeWords, newText, ...afterWords];
            return newContentWords.join(' ');
          }
        }
      }

      return content; // No replacement if no match found
    },

    async cleanupOutdatedSuggestions(currentContent) {
      try {
        const allComments = this.$store.state.selected?.comments || [];
        const aiComments = allComments.filter(comment => 
          comment.aiGenerated === true && 
          comment.data?.suggestion && 
          comment.data?.editorPosition?.selectedText
        );
        
        let removedCount = 0;
        
        for (const comment of aiComments) {
          const selectedText = comment.data.editorPosition.selectedText;
          
          // Check if the text still exists in the document
          if (!currentContent.includes(selectedText)) {
            // Try fuzzy matching before removing
            const fuzzyMatch = this.performFuzzyTextReplacement(
              currentContent, 
              selectedText, 
              selectedText // Just checking if we can find it
            );
            
            if (fuzzyMatch === currentContent) {
              // Text not found even with fuzzy matching, remove the comment
              await this.$store.dispatch('deleteComment', comment.id);
              removedCount++;
            }
          }
        }
        
        if (removedCount > 0) {
          showAlert(this.$store, 'info', `Removed ${removedCount} outdated AI suggestion${removedCount > 1 ? 's' : ''} that no longer apply`);
        }
        
        return removedCount;
      } catch (error) {
        console.error('Error cleaning up outdated suggestions:', error);
        return 0;
      }
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