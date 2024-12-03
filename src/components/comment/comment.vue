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

        <commentCard v-if="event.type === 'comment'" :comment="event.value"/>
        <v-card v-if="event.type === 'version'">
          <v-card-subtitle class="text-caption"> {{$dayjs(event.value.createDate.seconds*1000).fromNow()}}  </v-card-subtitle>
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
      timeline() {
        const versions = Array.isArray(this.$store.state.selected.versions) ? 
          this.$store.state.selected.versions.map(v => ({
            type: 'version',
            value: v,
            sortDate: v.createDate?.seconds || 0
          })) : []; // Default to an empty array if not an array
        
        const comments = Array.isArray(this.$store.state.selected.comments) ? 
          this.$store.state.selected.comments.map(c => ({
            type: 'comment',
            value: c,
            sortDate: c.createDate.seconds
          })) : []; // Default to an empty array if not an array
        
        return [...versions, ...comments].sort((a, b) => a.sortDate - b.sortDate);  
      }
    },
    methods: {
      async addComment () {
        await this.$refs.form.validate();
        if (this.valid ){
          this.$store.commit('addComment', {comment: this.newComment})
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
    },
  }
</script>

<style scoped>

</style>
