<template>
   <v-list 
    density="compact">
      <v-list-item>
        <v-btn class="text-none" block @click="$router.push('/chat')" color="primary" density="compact">New Chat</v-btn>
      </v-list-item>
      <v-list-item 
        density="compact"
        v-for="group in chats" 
        :key="group.date">
        <h5 class="text-subtitle-2 text-medium-emphasis">{{ group.date }}</h5>
        <v-list density="compact" class="compact p-0">
            <v-list-item 
            class="text-body-2 overflow-hidden whitespace-nowrap text-ellipsis py-1"
            height="19"
            density="compact" 
            v-for="chat in group.chats" 
            :key="chat.id" 
            @click="chat.renaming ? null : openChat(chat.id)"
            :ripple="!chat.renaming"
            :disabled="chat.renaming"
            slim
            >
            <span v-if="chat.renaming">
              <input 
                  class="text-body v-opacity-100"
                  :ref="'renameInput_' + chat.id" 
                  :value="chat.data.name" 
                  @keyup.enter="renameChat(chat, $event.target.value)" 
                  @keyup.esc="cancelRename(chat)" 
                  @blur="cancelRename(chat)" 
                  @click.stop
                  />
            </span>
            <span v-else>
                {{ chat.data.name }}
            </span>


            <template v-slot:append>
                <v-menu offset-y>
                    <template v-slot:activator="{ props }">
                        <v-btn icon="mdi-dots-horizontal" v-bind="props" variant="plain" :ripple="false" class="hover-menu">
                        </v-btn>
                    </template>
                <v-list class="border border-surface-light" density="compact">
                  <v-list-item prepend-icon="mdi-pencil" @click="startRenameChat(chat)">Rename</v-list-item>
                   <v-list-item prepend-icon="mdi-archive"@click="archiveChat(chat.id)">Archive</v-list-item>
                   <v-list-item prepend-icon="mdi-trash-can" class="text-error" @click="deleteChat(chat.id)">Delete</v-list-item>
                </v-list>
                </v-menu>
            </template>
            </v-list-item>
        </v-list>
      </v-list-item>
    </v-list>
</template>

<script>
export default {
  name: 'ChatNav',
  data: () => ({
    chatDrawer: false,
  }),
  computed: {
    chats() {
      const sortedChats = this.$store.chats.sort((a, b) => {
        return b.data.updatedDate.seconds - a.data.updatedDate.seconds;
      });

      const groupedChats = sortedChats.reduce((acc, chat) => {
        const date = new Date(chat.data.updatedDate.seconds * 1000).toDateString();
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(chat);
        return acc;
      }, {});

      return Object.entries(groupedChats)
        .sort(([dateA], [dateB]) => new Date(dateB) - new Date(dateA))
        .map(([date, chats]) => ({ date, chats }));
    },
  },
  methods: {
    openChat(chatId) {
      this.$router.push({ path: `/chat/${chatId}` });
    },
    deleteChat(id) {
      this.$store.deleteChat(id);
    },
    archiveChat(id) {
      this.$store.archiveChat(id);
    },
    startRenameChat(chat){
      chat.renaming = true;
      this.$nextTick(() => {
        const inputRef = this.$refs['renameInput_' + chat.id];
        if (inputRef) {
          inputRef[0].focus(); // Set focus on the input
        }
      });
    },
    async renameChat(chat, newName){
      await this.$store.renameChat({id:chat.id, newName:newName})
      chat.renaming = false
      return
    },
    cancelRename(chat){
      chat.renaming=false
    },
    onDrawerUpdate(value) {
      this.$emit('update:chatDrawer', value);
    },
  },
}
</script>

<style scoped>
/* Add any specific styles for ChatNav here */

.v-list-item {
  padding: 0px;
  margin: 0px;
  overflow: hidden; /* Ensure text doesn't overflow */
  white-space: nowrap; /* Prevent text wrapping */
  text-overflow: ellipsis; /* Add ellipsis for overflowed text */

}

.hover-menu {
  position: absolute;
  right: 0px;
  visibility: hidden;
  transition: opacity 0.3s ease;
}

.v-list-item:hover .hover-menu{
  visibility: visible;
}

.v-list-item:hover {
  color: linear-gradient(to right, transparent, var(--v-theme-on-surface) 70%); /* Adjust color as needed */
}

</style>
