<template>
    <VueDraggable 
        class="drag-area" 
        tag="ul" 
        v-model="list" 
        group="g1" 
        @end="change()" 
        @add="added" 
        @remove="removed">
      <li 
        v-for="el in list" 
        :class="{'selected-item': isSelected(el)}"
        class="px-1 list-item"
        :key="el.id"
        :style="{ paddingLeft: `${depth * 20}px` }">
            <div class="text-body-2 d-flex justify-space-between"> 
                <v-icon small @click="toggle(el)" class="text-medium-emphasis">
                    {{ el.children && el.children.length ? (el.isOpen ? 'mdi-chevron-down' : 'mdi-chevron-right') : '' }}
                </v-icon>
                <v-icon small class="text-medium-emphasis pr-1">
                    {{ el.isOpen ? 'mdi-folder-open' : (el.data.folder ? 'mdi-folder' : 'mdi-text-box') }}
                </v-icon>

                <v-icon class="overlay-icon text-medium-emphasis pr-1" icon="mdi-pencil" v-if="el.data.draft" color="warning"></v-icon>

                <span v-if="el.renaming">
                    <input 
                        :ref="'renameInput_' + el.id" 
                        :value="el.data.name" 
                        @keyup.enter="submitRenameFolder(el, $event.target.value)" 
                        @keyup.esc="cancelRenameFolder(el)" 
                        @blur="cancelRenameFolder(el)" 
                        />
                </span>
                <span v-else class="text-ellipsis overflow-hidden whitespace-nowrap" @click="!el.data.folder && handleItemClick(el)">
                    {{ el.data.name }}
                </span>

                <v-spacer/>

                <v-menu v-if="el.data.folder" offset-y>
                        <template v-slot:activator="{ props }">
                            <v-btn variant="plain" v-bind="props" density="compact">
                                <v-icon >mdi-dots-horizontal</v-icon>
                            </v-btn>
                        </template>
                    <v-list density="compact" class="border border-surface-light">
                        <v-list-item @click="renameFolder(el)">Rename</v-list-item>
                        <v-list-item @click="deleteFolder(el.id)">Delete</v-list-item>
                    </v-list>
                </v-menu>
                
            </div>
            <DocumentTreeNested 
                @document-tree-change="change()"
                v-if="el.children && el.isOpen"
                :cust-key="el.id"
                v-model="el.children" 
                :depth="depth + 1"
                :selected-item="selectedItem"
            /> 
      </li>
    </VueDraggable>
  </template>
  
  <script>
  import { VueDraggable } from 'vue-draggable-plus'
  import { defineComponent } from 'vue'
  
  export default defineComponent({
    name: 'DocumentTreeNested',
    components: {
      VueDraggable,
    },
    props: {
      modelValue: {
        type: Array,
        required: true,
        default:() => []
      },
      custKey:{
        type: String,
        required: false,
      },
      isFolder:{
        type:Boolean,
        required: false,
        default: false,
      },
      depth: {
            type: Number,
            default: 0 // Default depth is 0
        },
      selectedItem: {
        type: Object,
        required: false,
        default: null,
      },
    },
    data() {
      return {
        list: this.modelValue, // Initialize isOpen for each node
      }
    },
    watch: {
        modelValue: {
            handler(newValue) {
                this.list = newValue
            },
        immediate: true
        },
            list: {
            handler(newValue) {
                this.$emit('update:modelValue', newValue)
            }
        }
    },

    methods: {
        toggle(el) {
            el.isOpen = !el.isOpen;
            this.$store.commit('toggleFolderOpen', { 
                FolderName: el.id, 
                isOpen: el.isOpen 
            });
        },
        change(){
            this.$emit('document-tree-change', this.list)
        },
        added(e){
            this.$store.commit('updateFolder', { 
                docId: e.data.id, 
                target: this.custKey, 
                action: 'add' 
            });
        },
        removed(e){
            this.$store.commit('updateFolder', { 
                docId: e.data.id, 
                target: this.custKey, 
                action: 'remove' 
            });
        },
        handleItemClick(item) {
            this.$router.push({ path: `/document/${item.id}` }); 
        },
        isSelected(el) {
            if (this.$route.params.id === el.id) {
                return true; // Select the document if it matches the route ID
            }
            if (el.children) {
                for (let child of el.children) {
                    if (this.isSelected(child)) {
                        el.isOpen = true; // Open the folder if a child is selected
                        return false; // Do not select the folder itself
                    }
                }
            }
            return false;
        }, 
        deleteFolder(id){
            this.$store.commit('removeFolder', id)
        },
        renameFolder(el) {
            el.renaming = true;
            this.$nextTick(() => {
                const inputRef = this.$refs['renameInput_' + el.id];
                if (inputRef) {
                    inputRef[0].focus(); // Directly focus the input element
                }
            });
        },
        submitRenameFolder(el,value){
            this.$store.commit('renameFolder',{toFolderName: value, fromFolderName: el.data.name})
            el.data.name = value
            el.renaming = false;
        },
        cancelRenameFolder(el){
            el.renaming = false;
        }

    },
})
</script>

<style scoped>
.list-item{
    padding-top: 2px !important;
    padding-bottom: 2px !important;
}


.drag-area {
  min-height: 10px;
}

.selected-item {
  background-color: rgb(var(--v-theme-surface-light)); /* Add your desired style for selected item */
}


.overlay-icon{
    left: -15px;
    margin-right:-15px;
    scale: 75%;
}


</style>
