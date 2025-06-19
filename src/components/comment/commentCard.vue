<template id="">
  <v-card 
    class="comment-card border border-surface-light w-100" 
    density="compact" 
    :class="{ 'comment-resolved': comment.resolved, 'comment-clickable': hasEditorPosition }"
    @click="handleCardClick"
  >
    <div v-if="editing === false" class="w-full">
        <v-card-subtitle class="text-caption d-flex justify-space-between align-center">
          <div class="d-flex align-center">
            <span>{{user?.displayName}} {{$dayjs(comment.createDate.seconds*1000).fromNow()}}</span>

            <v-chip 
              v-if="comment.documentVersion" 
              size="x-small" 
              color="orange" 
              variant="outlined"
              class="ml-2"
            >
              {{ comment.documentVersion }}
            </v-chip>
            <v-chip
              v-if="comment.resolved"
              size="x-small"
              color="success"
              variant="outlined"
              class="ml-2"
            >
              resolved
            </v-chip>

            <v-chip
              v-if="comment.aiGenerated"
              size="x-small"
              color="purple"
              variant="outlined"
              class="ml-2"
            >
              <v-icon size="12" class="mr-1">mdi-robot</v-icon>
              AI
            </v-chip>
  
          </div>
          <div>
            <v-chip
              v-if="canUndo"
              variant="flat"
              size="x-small"
              color="purple"
              class="ml-2"
              @click="$eventStore.emitEvent('undo-comment', comment)"
            >
              <v-icon size="12" class="mr-1">mdi-undo</v-icon>
              undo
            </v-chip>
            <v-tooltip text="Edit this comment" location="bottom">
              <template v-slot:activator="{ props }">
                <v-btn
                  density="compact"
                  variant="text"
                  color="teal accent-4"
                  size="small"
                  icon="mdi-pencil"
                  v-bind="props"
                  @click="startEditing">
                </v-btn>
              </template>
            </v-tooltip>
            <v-tooltip 
              v-if="!comment.resolved" 
              text="Mark as resolved" 
              location="bottom"
            >
              <template v-slot:activator="{ props }">
                <v-btn
                  density="compact"
                  class="mr-1"
                  variant="text"
                  color="success"
                  size="small"
                  icon="mdi-check"
                  v-bind="props"
                  @click="$eventStore.emitEvent('resolve-comment', {commentId: comment.id})">
                </v-btn>
              </template>
            </v-tooltip>
            <v-tooltip 
              v-if="!comment.resolved" 
              text="Reply to this comment" 
              location="bottom"
            >
              <template v-slot:activator="{ props }">
                <v-btn
                  density="compact"
                  class="mr-1"
                  variant="text"
                  color="blue"
                  size="small"
                  icon="mdi-reply"
                  v-bind="props"
                  @click="showReplyInput = true">
                </v-btn>
              </template>
            </v-tooltip>
            <v-tooltip 
              v-if="comment.aiGenerated && comment.suggestion && !comment.resolved && canShowSuggestion" 
              text="Accept AI suggestion" 
              location="bottom"
            >
              <template v-slot:activator="{ props }">
                <v-btn
                  density="compact"
                  class="mr-1"
                  variant="text"
                  color="success"
                  size="small"
                  icon="mdi-check-circle"
                  v-bind="props"
                  @click="acceptSuggestion">
                </v-btn>
              </template>
            </v-tooltip>
            
          </div>
        </v-card-subtitle>

        <!-- Original text display for comments with editorID -->
        <div v-if="comment.selectedText" class="text-caption text-medium-emphasis mx-4 mb-2">
          <div class="original-text pa-2 bg-surface-variant rounded d-flex align-center">
            <span class="flex-grow-1">"{{ displayedOriginalText }}"</span>
            <v-btn 
              v-if="shouldShowExpandButton"
              icon
              size="x-small"
              variant="text"
              @click="toggleOriginalTextExpanded"
              class="ml-1 flex-shrink-0"
            >
              <v-icon size="12">{{ originalTextExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
            </v-btn>
          </div>
          
          <!-- Show suggestion button for AI comments -->
          <div v-if="comment.aiGenerated && comment.suggestion && canShowSuggestion" class="mt-2">
            <v-btn
              size="x-small"
              variant="text"
              color="success"
              @click="toggleSuggestionVisible"
              class="text-none"
            >
              <v-icon size="12" class="mr-1">{{ suggestionVisible ? 'mdi-eye-off' : 'mdi-eye' }}</v-icon>
              {{ suggestionVisible ? 'Hide' : 'Show' }} suggestion
            </v-btn>
          </div>
          
          <!-- AI suggestion display -->
          <div v-if="comment.aiGenerated && comment.suggestion && suggestionVisible && canShowSuggestion" class="mt-2">
            <div class="suggestion-text pa-2 bg-success-lighten rounded text-success-darken">
              <span class="font-weight-medium">"{{ comment.suggestion }}"</span>
            </div>
          </div>
        </div>

        <v-card-text
          class="text-body-2"
          style="margin:-8px 0px"
          >{{comment.comment}}
        </v-card-text>

        <!-- Reply input -->
        <v-card-text v-if="showReplyInput" class="pt-1">
          <v-textarea
            v-model="replyText"
            label="Reply to comment"
            rows="2"
            density="compact"
            hide-details
          ></v-textarea>
          <v-card-actions class="px-0 pt-2">
            <v-spacer></v-spacer>
            <v-btn 
              size="small" 
              variant="text" 
              @click="showReplyInput = false; replyText = ''"
            >
              Cancel
            </v-btn>
            <v-btn 
              size="small" 
              color="primary" 
              variant="text"
              @click="submitReply"
              :disabled="!replyText.trim()"
            >
              Reply
            </v-btn>
          </v-card-actions>
        </v-card-text>
    </div>
    <div v-if="editing === true">
      <v-card-subtitle class="text-caption d-flex justify-space-between align-center">
          <div class="d-flex align-center">
            <span>{{user?.displayName}} {{$dayjs(comment.createDate.seconds*1000).fromNow()}}</span>
            <v-chip 
              v-if="comment.documentVersion" 
              size="x-small" 
              color="orange" 
              variant="outlined"
              class="ml-2"
            >
              {{ comment.documentVersion }}
            </v-chip>
          </div>
          <div>
            <v-tooltip text="Delete this comment" location="bottom">
              <template v-slot:activator="{ props }">
                <v-btn
                  density="compact"
                  class="mr-1"
                  variant="text"
                  color="error"
                  size="small"
                  icon="mdi-delete"
                  v-bind="props"
                  @click="$eventStore.emitEvent('delete-comment', {commentId: comment.id})">
                </v-btn>
              </template>
            </v-tooltip>
            <v-tooltip text="Cancel editing" location="bottom">
              <template v-slot:activator="{ props }">
                <v-btn
                  density="compact"
                  class="mr-1"
                  variant="text"
                  color="blue"
                  size="small"
                  icon="mdi-close"
                  v-bind="props"
                  @click="resetForm()">
                </v-btn>
              </template>
            </v-tooltip>
            <v-tooltip text="Save changes" location="bottom">
              <template v-slot:activator="{ props }">
                <v-btn
                  density="compact"
                  variant="text"
                  color="teal accent-4"
                  size="small"
                  icon="mdi-check"
                  v-bind="props"
                  @click="updateComment(comment.id,newComment)">
                </v-btn>
              </template>
            </v-tooltip>
          </div>
        </v-card-subtitle>

      <v-textarea
              type="text"
              v-model="newComment"
          />

    </div>
  </v-card>
</template>

<script type="text/javascript">
import { inject } from 'vue';


export default {
  props: {
    comment: {
      type: Object,
      required: true
    }
  },
  data:() => ({
      newComment: "",
      editing: false,
      showReplyInput: false,
      replyText: "",
      originalTextExpanded: false,
      suggestionVisible: false,
      maxOriginalTextLength: 100, // Characters to show before truncation
  }),
  mounted(){
    this.newComment = {...this.comment}.comment
  },
  computed:{
    user() {
      const foundUser = this.$store.project.users.find(user => user.id === this.comment.createdBy)
      
      if (foundUser?.id === this.$store.user.uid) {
        return { ...foundUser, displayName: 'you' }
      }

      return foundUser || { displayName: 'User not found' }
    },
    originalText() {
      return this.comment?.selectedText || '';
    },
    shouldShowExpandButton() {
      return this.originalText.length > this.maxOriginalTextLength;
    },
    displayedOriginalText() {
      if (!this.originalTextExpanded && this.shouldShowExpandButton) {
        return this.originalText.substring(0, this.maxOriginalTextLength) + '...';
      }
      return this.originalText;
    },
    hasEditorPosition() {
      return this.comment?.editorID?.from !== undefined && this.comment?.editorID?.to !== undefined;
    },
    canShowSuggestion() {
      // Only show suggestion if the original text can be found in the current document content
      if (!this.originalText || !this.$store.selected?.data?.content) {
        return false;
      }
      
      const canShow = this.$store.selected.data.content.includes(this.originalText);
      return canShow;
    },
    canUndo() {
      if( this.$store.selected.data.content.includes(this.comment.suggestion) && this.comment.resolved){
        return true;
      } else {
        return false;
      }
    }
  },
  methods:{
    resetForm () {
      this.newComment = {...this.comment}.comment
      this.editing = false
    },

    async startEditing() {
      this.editing = true;
      // Unresolve comment when user starts editing
      if (this.comment.resolved) {
        this.$eventStore.emitEvent('un-resolve-comment', {commentId: this.comment.id})
      }
    },

    async updateComment (id,updatedComment) {
      await this.$store.dispatch('updateComment',{id,updatedComment})
      this.resetForm()
    },

    toggleOriginalTextExpanded() {
      this.originalTextExpanded = !this.originalTextExpanded;
    },

    toggleSuggestionVisible() {
      this.suggestionVisible = !this.suggestionVisible;
    },

    async submitReply() {
      if (!this.replyText.trim()) return;


      try {
        const replyData = {
          comment: this.replyText.trim(),
          documentVersion: this.comment.documentVersion
        };

        await this.$store.dispatch('addReply', { 
          parentId: this.comment.parentId || this.comment.id, 
          comment: replyData 
        });

        this.replyText = '';
        this.showReplyInput = false;
      } catch (error) {
        console.error('Error adding reply:', error);
      }
    },

    handleCardClick() {
      this.$eventStore.emitEvent('scroll-to-comment', {commentId: this.comment.id})
    },

    getSeverityColor(severity) {
      switch (severity) {
        case 'high':
          return 'error';
        case 'medium':
          return 'warning';
        case 'low':
          return 'info';
        default:
          return 'grey';
      }
    },

    async acceptSuggestion() {
      // Emit event to event store for processing by DocumentCreate component
      this.$eventStore.emitEvent('accept-suggestion', {
        commentId: this.comment.id,
        selectedText: this.comment?.selectedText || this.originalText || '',
        suggestion: this.comment.suggestion,
      });
    },
  }
}
</script>

<style lang="scss">

.comment-card{
  .v-field{
      font-size: 14px !important;
  }
}

.comment-resolved {
  opacity: 0.7;
  background-color: rgba(var(--v-theme-success), 0.05);
}

.comment-resolved .v-card-subtitle {
  opacity: 1;
  background-color: transparent;
}

.original-text {
  font-style: italic;
  word-break: break-word;
  font-size: 0.85em;
  line-height: 1.3;
}

.comment-clickable {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.comment-clickable:hover {
  background-color: rgba(var(--v-theme-primary), 0.05);
}

.suggestion-text {
  border-left: 3px solid rgb(var(--v-theme-success));
  background-color: rgba(var(--v-theme-success), 0.1) !important;
  color: rgb(var(--v-theme-success)) !important;
  font-style: italic;
  word-break: break-word;
  font-size: 0.85em;
  line-height: 1.3;
}

</style>
