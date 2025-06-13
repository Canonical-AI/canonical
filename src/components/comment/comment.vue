<template>
  <div class="">
    <!-- Filter controls -->
    <div class="mx-2 mb-2 d-flex gap-2">
      <v-btn
        @click="toggleFilter"
        variant="plain"
        density="compact"
        class="text-none flex-1"
      >
        {{ showResolved === 'all' ? 'All Comments' : 'Active Only' }}
      </v-btn>
      <v-btn
        @click="toggleSort"
        variant="plain"
        density="compact"
        class="text-none flex-1"
      >
        {{ sortBy === 'date' ? 'By Date' : 'By Position' }}
      </v-btn>
    </div>

    <v-list class="mx-2 w-100">
      <v-list-item
        v-for="event in timeline"
        :key="event.value.id"
        class="px-0"
      >
        <template v-if="event.type === 'comment'">
          <div class="w-100">
            <commentCard 
              :comment="event.value"
              :ref="`comment-${event.value.id}`"
              @comment-resolved="refreshEditorDecorations"
              @comment-unresolved="refreshEditorDecorations"
              @accept-suggestion="$emit('accept-suggestion', $event)"
            />
            <!-- Render child comments with indentation -->
            <div v-if="event.value.children && event.value.children.length > 0" class="ml-4 mt-2">
              <commentCard 
                v-for="child in event.value.children"
                :key="child.id"
                :comment="child"
                :ref="`comment-${child.id}`"
                class="mb-2"
                @comment-resolved="refreshEditorDecorations"
                @comment-unresolved="refreshEditorDecorations"
                @accept-suggestion="$emit('accept-suggestion', $event)"
              />
            </div>
          </div>
        </template>
        
        <template v-if="event.type === 'version'">
          <div class="w-100">
            <div class="text-caption"> {{$dayjs(event?.value?.createDate?.seconds*1000).fromNow() || ''}}  </div>
            <v-chip @click="$router.push({ query: { v: event.value.versionNumber }})">{{ event.value.versionNumber }}</v-chip>
          </div>
        </template>
      </v-list-item>
    </v-list>

    <v-form
      ref="form"
      v-model="valid"
      lazy-validation
      
    >
      <v-textarea
        v-model="newComment"
        :counter="250"
        :rules="[rules.counter]"
        rows="3"
        density="compact"
        label="leave a comment"
        clearable
        v-if="$store.getters.isUserLoggedIn"
      >
      <template v-slot:append-inner>
          <v-btn
            color="success"
            size="small"
            icon="mdi-send"
            @click="addComment"
          >
          </v-btn>
        </template>
      </v-textarea>
    </v-form>
  </div>
</template>

<script>
import commentCard from "./commentCard.vue"
import { inject } from 'vue';

//TODO: 
// - need a way to resolve comments (i.e. stop showing them inline but show in sidebar unless filtered)


export default {
  emits: ['refresh-editor-decorations', 'accept-suggestion'],
  components: {
    commentCard
  },
    props: {
      docId: String,
      docType: String
    },
    data: () => ({
      valid: true,
      newComment: "",
      showResolved: 'all', // 'all' or 'active'
      sortBy: 'date', // 'date' or 'position'
      rules:{
        required: value => !!value || 'Required.',
        counter: value => value.length <= 250 || 'Max 250 characters',
        url: value => {
          // eslint-disable-next-line
          const pattern = /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?/
          return (pattern.test(value) || value.length == 0) || 'Invalid url.'
        }
      }
    }),
    computed: {
      currentVersion() {
        return this.$store.state.selected.currentVersion;
      },
      
      timeline() {
        const versions = Array.isArray(this.$store.state.selected.versions) ? 
          this.$store.state.selected.versions.map(v => ({
            type: 'version',
            value: v,
            sortDate: v.createDate?.seconds || 0,
            position: null // versions don't have positions
          })) : []; // Default to an empty array if not an array
        
        // Use the threaded comments getter for organized display
        let threadedComments = this.$store.getters.threadedCommentsByVersion;
        
        // Filter comments based on showResolved setting
        if (this.showResolved === 'active') {
          threadedComments = threadedComments.filter(comment => !comment.resolved);
        }
        
        // Sort child comments within each parent by date (oldest to newest)
        threadedComments = threadedComments.map(comment => {
          if (comment.children && comment.children.length > 0) {
            const sortedChildren = [...comment.children].sort((a, b) => {
              const aDate = a.createDate?.seconds || 0;
              const bDate = b.createDate?.seconds || 0;
              return aDate - bDate;
            });
            return { ...comment, children: sortedChildren };
          }
          return comment;
        });
        
        const comments = threadedComments.map(c => ({
          type: 'comment',
          value: c,
          sortDate: c.createDate?.seconds || 0,
          position: c.editorID?.from || null
        }));
        
        const allItems = [...versions, ...comments];
        
        if (this.sortBy === 'position') {
          return allItems.sort((a, b) => {
            if (a.type === 'version' && b.type === 'version') {
              return a.sortDate - b.sortDate;
            }
            
            const aHasPosition = a.position !== null && a.position !== undefined;
            const bHasPosition = b.position !== null && b.position !== undefined;
            
            if (!aHasPosition && !bHasPosition) {
              return a.sortDate - b.sortDate;
            }
            
            if (!aHasPosition && bHasPosition) return -1;
            if (aHasPosition && !bHasPosition) return 1;
            
            return a.position - b.position;
          });
        } else {
          return allItems.sort((a, b) => a.sortDate - b.sortDate);
        }
      }
    },
    setup() {
      const scrollToCommentInEditor = inject('scrollToCommentInEditor');
      return {
        scrollToCommentInEditor
      };
    },
    methods: {
      async addComment () {
        await this.$refs.form.validate();
        if (this.valid ){
          const commentData = {
            comment: this.newComment,
            documentVersion: this.currentVersion === 'live' ? null : this.currentVersion
          };
          this.$store.dispatch('addComment', commentData);
          this.newComment = '';
        }
      },
      async editComment (id,updatedComment) {
        await this.$refs.form.validate();
        if (this.valid) {
          await this.$store.dispatch('updateComment', {id, updatedComment});
        }
        this.$refs.form.resetValidation();
      },
      async deleteComment (id) {
        await this.$store.dispatch('deleteComment', id)
        this.$refs.form.resetValidation();
      },
      resetForm () {
        this.$refs.form.reset()
      },
      resetCommentEdit () {
        this.$refs['commentItem'].reset()
      },
      
      scrollToComment(commentId) {
        // Find the comment element and scroll to it within the container
        this.$nextTick(() => {
          const commentRef = this.$refs[`comment-${commentId}`];
          if (commentRef && commentRef[0]) {
            const commentElement = commentRef[0].$el;
            const scrollContainer = commentElement.closest('.comments-container');
            
            if (scrollContainer) {

              const containerRect = scrollContainer.getBoundingClientRect();
              const commentRect = commentElement.getBoundingClientRect();
              

              const scrollTop = scrollContainer.scrollTop + 
                (commentRect.top - containerRect.top) - 
                (containerRect.height / 2) + 
                (commentRect.height / 2);
              
 
              scrollContainer.scrollTo({
                top: scrollTop,
                behavior: 'smooth'
              });
            }
     
            commentElement.style.transition = 'background-color 0.5s';
            commentElement.style.backgroundColor = 'rgba(var(--v-theme-primary), 0.1)';
            setTimeout(() => {
              commentElement.style.backgroundColor = '';
            }, 2000);
          }
        });
      },

      refreshEditorDecorations() {
        this.$emit('refresh-editor-decorations');
      },

      toggleFilter() {
        this.showResolved = this.showResolved === 'all' ? 'active' : 'all';
      },

      toggleSort() {
        this.sortBy = this.sortBy === 'date' ? 'position' : 'date';
      },
    },
  }
</script>

<style scoped>
/* Prevent horizontal scrolling and ensure proper container behavior */
.v-list {
  overflow-x: hidden !important;
  overflow-y: visible;
  width: 100%;
  max-width: 100%;
}

/* Ensure list items don't overflow horizontally */
:deep(.v-list-item) {
  max-width: 100%;
  overflow-x: hidden;
}

:deep(.v-list-item__content) {
  padding: 0.5rem !important;
}

/* Ensure cards within list don't cause horizontal overflow */
:deep(.v-card) {
  max-width: 100%;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* Ensure form elements don't cause horizontal overflow */
:deep(.v-form) {
  max-width: 100%;
}

:deep(.v-textarea) {
  max-width: 100%;
}
</style>
