

<template id="">
  <v-card class="comment-card border border-surface-light w-100" density="compact">
    <div v-if="editing === false" class="w-full">
        <v-card-subtitle class="text-caption">
          {{user?.displayName}} {{$dayjs(comment.createDate.seconds*1000).fromNow()}}           <v-btn
            density="compact"
            class="text-none"
            variant="text"
            color="teal accent-4"
            @click="editing = true">edit
          </v-btn>
        </v-card-subtitle>
        <v-card-text
          class="text-body-2"
          style="margin:-8px 0px"
          >{{comment.comment}}
        </v-card-text>
    </div>
    <div v-if="editing === true">
      <v-card-subtitle class="text-caption">
        {{user?.displayName}} {{$dayjs(comment.createDate.seconds*1000).fromNow()}}
      </v-card-subtitle>
      <v-textarea
              type="text"
              v-model="newComment"
          />

      <v-card-actions>
        <v-btn class="m-2 text-none" color="error"@click="deleteComment(comment.id)">delete</v-btn>
        <v-spacer/>
        <v-btn class="m-2 text-none" @click="resetForm()">cancel</v-btn>
        <v-btn class="m-2 text-none" color="primary"@click="updateComment(comment.id,newComment)">submit</v-btn>
        </v-card-actions>
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
      editing: false
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
    }
  },
  methods:{
    resetForm () {
      this.newComment = {...this.comment}.comment
      this.editing = false
    },

    async updateComment (id,updatedComment) {
      await this.$store.commit('updateComment',{id,updatedComment})
      this.resetForm()
    },
    async deleteComment (id) {
      await this.$store.commit('deleteComment',id)
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

</style>
