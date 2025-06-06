<template id="">
  <v-card class="comment-card border border-surface-light w-100" density="compact" :class="{ 'comment-resolved': comment.resolved }">
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
          </div>
          <div>
            <v-btn
              density="compact"
              class="text-none"
              variant="text"
              color="teal accent-4"
              size="small"
              @click="startEditing">edit
            </v-btn>
            <v-btn
              v-if="!comment.resolved"
              density="compact"
              class="text-none mr-1"
              variant="text"
              color="success"
              size="small"
              @click="resolveComment">resolve
            </v-btn>
            <v-btn
              density="compact"
              class="text-none mr-1"
              variant="text"
              color="blue"
              size="small"
              @click="showReplyInput = true">reply
            </v-btn>
          </div>
        </v-card-subtitle>

        <!-- Original text display for comments with editorID -->
        <div v-if="comment.editorID?.selectedText" class="text-caption text-medium-emphasis mx-4 mb-2">
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
            <v-btn
              density="compact"
              class="text-none mr-1"
              variant="text"
              color="error"
              size="small"
              @click="deleteComment(comment.id)">delete
            </v-btn>
            <v-btn
              density="compact"
              class="text-none mr-1"
              variant="text"
              color="blue"
              size="small"
              @click="resetForm()">cancel
            </v-btn>
            <v-btn
              density="compact"
              class="text-none"
              variant="text"
              color="teal accent-4"
              size="small"
              @click="updateComment(comment.id,newComment)">submit
            </v-btn>
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
import {Comment} from "../../services/firebaseDataService";

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
      maxOriginalTextLength: 100, // Characters to show before truncation
  }),
  mounted(){
    this.newComment = {...this.comment}.comment
  },
  computed:{
    user() {
      const foundUser = this.$store.state.project.users.find(user => user.id === this.comment.createdBy)
      
      if (foundUser?.id === this.$store.state.user.uid) {
        return { ...foundUser, displayName: 'you' }
      }

      return foundUser || { displayName: 'User not found' }
    },
    originalText() {
      return this.comment?.editorID?.selectedText || '';
    },
    shouldShowExpandButton() {
      return this.originalText.length > this.maxOriginalTextLength;
    },
    displayedOriginalText() {
      if (!this.originalTextExpanded && this.shouldShowExpandButton) {
        return this.originalText.substring(0, this.maxOriginalTextLength) + '...';
      }
      return this.originalText;
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
        await this.unresolveComment();
      }
    },

    async updateComment (id,updatedComment) {
      await this.$store.commit('updateComment',{id,updatedComment})
      this.resetForm()
    },
    
    async deleteComment (id) {
      await this.$store.commit('deleteComment',id)
    },

    async resolveComment() {
      try {
        await this.$store.dispatch('updateCommentData', {
          id: this.comment.id,
          data: { resolved: true }
        });
        
        this.$store.commit('alert', {
          type: 'success',
          message: 'Comment resolved',
          autoClear: true
        });
        
        // Now that the store is properly updated, emit the event
        this.$emit('comment-resolved', this.comment.id);
      } catch (error) {
        console.error('Error resolving comment:', error);
        this.$store.commit('alert', {
          type: 'error',
          message: 'Failed to resolve comment',
          autoClear: true
        });
      }
    },

    async unresolveComment() {
      try {
        await this.$store.dispatch('updateCommentData', {
          id: this.comment.id,
          data: { resolved: false }
        });
        
        // Now that the store is properly updated, emit the event
        this.$emit('comment-unresolved', this.comment.id);
      } catch (error) {
        console.error('Error unresolving comment:', error);
      }
    },

    toggleOriginalTextExpanded() {
      this.originalTextExpanded = !this.originalTextExpanded;
    },

    async submitReply() {
      if (!this.replyText.trim()) return;


      try {
        const replyData = {
          comment: this.replyText.trim(),
          documentVersion: this.comment.documentVersion
        };

        await this.$store.commit('addReply', { 
          parentId: this.comment.parentId || this.comment.id, 
          comment: replyData 
        });

        this.replyText = '';
        this.showReplyInput = false;
      } catch (error) {
        console.error('Error adding reply:', error);
      }
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

.original-text {
  font-style: italic;
  word-break: break-word;
  font-size: 0.85em;
  line-height: 1.3;
}

</style>
