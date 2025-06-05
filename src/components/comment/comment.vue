<template>
  <div class="">

    <v-timeline side="end" density="compact" class="mx-2 w-100" line-thickness="1">
      <v-timeline-item
        class="w-100"
        density="compact"
        size="15"
        v-for="event in timeline"
        :key="event.value.id"
        :dot-color="event.value.createdBy === $store.state.user.uid ? 'teal' : 'grey'"
      >

        <commentCard 
          v-if="event.type === 'comment'" 
          :comment="event.value"
          :ref="`comment-${event.value.id}`"
        />
        <v-card v-if="event.type === 'version'">
          <v-card-subtitle class="text-caption"> {{$dayjs(event?.value?.createDate?.seconds*1000).fromNow() || ''}}  </v-card-subtitle>
          <v-chip v-if="event.type === 'version'" @click="$router.push({ query: { v: event.value.versionNumber }})">{{ event.value.versionNumber }}</v-chip>
        </v-card>
      </v-timeline-item>
    </v-timeline>

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
import {Comment} from "../../services/firebaseDataService";
import commentCard from "./commentCard.vue"

//TODO: 
// - need a way to filter comments
// - need a way to "scroll" to comment in the side bar but also scroll to comments in the editor

export default {
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
            sortDate: v.createDate?.seconds || 0
          })) : []; // Default to an empty array if not an array
        
        // Use the filtered comments getter instead of all comments
        const filteredComments = this.$store.getters.filteredCommentsByVersion;
        const comments = filteredComments.map(c => ({
          type: 'comment',
          value: c,
          sortDate: c.createDate?.seconds || 0
        }));
        
        return [...versions, ...comments].sort((a, b) => a.sortDate - b.sortDate);  
      }
    },
    methods: {
      async addComment () {
        await this.$refs.form.validate();
        if (this.valid ){
          const commentData = {
            comment: this.newComment,
            documentVersion: this.currentVersion === 'live' ? null : this.currentVersion
          };
          this.$store.commit('addComment', commentData);
          this.newComment = '';
        }
      },
      async editComment (id,updatedComment) {
        await this.$refs.form.validate();
        this.valid ? await this.$store.commit('updateComment', {id, updatedComment}) : console.log('not valid');
        this.$refs.form.resetValidation();
      },
      async deleteComment (id) {
        await this.$store.commit('deleteComment', id)
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
            
            // Find the scrollable container (comments-container)
            const scrollContainer = commentElement.closest('.comments-container');
            
            if (scrollContainer) {
              // Get the position of the comment relative to the container
              const containerRect = scrollContainer.getBoundingClientRect();
              const commentRect = commentElement.getBoundingClientRect();
              
              // Calculate the scroll position to center the comment in the container
              const scrollTop = scrollContainer.scrollTop + 
                (commentRect.top - containerRect.top) - 
                (containerRect.height / 2) + 
                (commentRect.height / 2);
              
              // Smooth scroll within the container
              scrollContainer.scrollTo({
                top: scrollTop,
                behavior: 'smooth'
              });
            }
            
            // Add a highlight effect
            commentElement.style.transition = 'background-color 0.5s';
            commentElement.style.backgroundColor = 'rgba(var(--v-theme-primary), 0.1)';
            setTimeout(() => {
              commentElement.style.backgroundColor = '';
            }, 2000);
          }
        });
      },
    },
  }
</script>

<style scoped>
/* Prevent horizontal scrolling and ensure proper container behavior */
.v-timeline {
  overflow-x: hidden !important;
  overflow-y: visible;
  width: 100%;
  max-width: 100%;
}

/* Ensure timeline items don't overflow horizontally */
:deep(.v-timeline-item) {
  max-width: 100%;
  overflow-x: hidden;
}

/* Ensure cards within timeline don't cause horizontal overflow */
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
