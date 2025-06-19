<template>
  <div class="document-tree-container">
    <!-- Fixed header section -->
    <div class="tree-header">
      <v-list-item :title="$store.project.name" subtitle="project" ></v-list-item>
      
      <v-divider></v-divider>
      <v-list-item>
        <v-btn 
          :disabled="!$store.isUserLoggedIn"
          class="text-none" 
          block 
          @click="$router.push({ path: '/document/create-document' })" 
          color="primary" 
          density="compact">
              Create Doc
          </v-btn>
      </v-list-item>
      <v-divider></v-divider>
      
      <div class="pa-2">
          <v-text-field
            v-model="filter"
            label="Filter Documents"
            append-inner-icon="mdi-magnify"
            single-line
            density="compact"
            hide-details
          />

          <v-btn :disabled="!$store.isUserLoggedIn" 
              class="text-none" @click="addFolder()" 
              variant="text" 
              density="compact" 
              size="small">Add Folder 
              <v-icon icon="mdi-plus"></v-icon>
          </v-btn>
      </div>
    </div>

    <!-- Scrollable content section -->
    <div class="tree-content">

        <div ref="Folders">
            <v-list density="compact">

                <v-list-item
                v-for="el in folders" 
                class="px-1 text-body-2"
                :key="el.id"
                :style="{ minHeight: '0' , paddingTop: '2px', paddingBottom: '2px' }"
                @dragover="handleDragOver(el)"
                @dragleave="handleDragLeave(el)"
                >

                    <div class="d-flex align-center">

                        <v-icon small @click="toggle(el)" class="text-medium-emphasis">{{ el.children.length ? (el.isOpen ? 'mdi-chevron-down' : 'mdi-chevron-right') : '' }}</v-icon>
                        <v-icon small class="text-medium-emphasis pr-1">{{ el.isOpen ? 'mdi-folder-open' :  'mdi-folder'  }}</v-icon>

                        <span v-if="el.renaming">
                            <input 
                                :ref="'renameInput_' + el.id" 
                                :value="el.data?.name" 
                                @keyup.enter="submitRenameFolder(el, $event.target.value)" 
                                @keyup.esc="cancelRenameFolder(el)" 
                                @blur="cancelRenameFolder(el)" 
                                />
                        </span>
                        <v-tooltip v-else location="right" :text="el.data?.name" :open-delay="500">
                          <template v-slot:activator="{ props }">
                            <span 
                              v-bind="props"
                              class="folder-name" 
                              @click="!el.data.folder && handleItemClick(el)"
                            >
                              {{ el.data?.name }}
                            </span>
                          </template>
                        </v-tooltip>

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

                    <VueDraggable 
                        class="text-ellipsis overflow-hidden whitespace-nowrap" 
                        tag="ul" 
                        v-model="el.children" 
                        group="g1" 
                        animation="150"
                        ghostClass="ghost"
                        @update="onUpdate"
                        @add="(e) => onAdd(e,el)"
                        @remove="(e) => remove(e,el)">
                        <li 
                            :class="{'selected-item': isSelected(child)}"
                            v-if="el.isOpen || hasSelectedChild(el)"
                            v-for="child in  el.children" 
                            class=""
                            :key="child.id || `temp-${child.data?.name || 'unnamed'}`"
                            :style="{ paddingLeft: '24px' }"
                            @click="handleItemClick(child)"
                            >

                            <v-icon small class="text-medium-emphasis pr-1">{{ 'mdi-text-box' }}</v-icon>
                            <v-icon class="overlay-icon text-medium-emphasis pr-1" icon="mdi-pencil" v-if="isDraft(child)" color="warning"></v-icon>
                            <v-tooltip location="right" :text="child.data?.name" :open-delay="500">
                              <template v-slot:activator="{ props }">
                                <span v-bind="props" class="document-name">{{ child.data?.name }}</span>
                              </template>
                            </v-tooltip>

                        </li>
                </VueDraggable>


                </v-list-item>
            </v-list>
        </div>

        <div ref="Documents">
            <VueDraggable 
                class="text-ellipsis overflow-hidden whitespace-nowrap" 
                tag="ul" 
                v-model="documents" 
                group="g1" 
                animation="150"
                ghostClass="ghost"
                @update="onUpdate"
                @add="(e) => onAdd(e)"
                @remove="(e) => remove(e)"
                @event="console.log($event)">

                <li 
                    :class="{'selected-item': isSelected(el)}"
                    v-for="el in documents" 
                    class="pr-1 pl-6 list-item text-body-2"
                    :key="el.id || `temp-${el.data?.name || 'unnamed'}`"
                    @click="handleItemClick(el)"
                    >

                    <v-icon small class="text-medium-emphasis pr-1">{{ 'mdi-text-box' }}</v-icon>
                    <v-icon class="overlay-icon text-medium-emphasis pr-1" icon="mdi-pencil" v-if="isDraft(el)" color="warning"></v-icon>
                    
                    <v-tooltip location="right" :text="el.data?.name" :open-delay="500">
                      <template v-slot:activator="{ props }">
                        <span v-bind="props" class="document-name">{{ el.data?.name }}</span>
                      </template>
                    </v-tooltip>
                </li>
            </VueDraggable>
        </div>
      </div>
    </div>
</template>

<script>
import { VueDraggable } from 'vue-draggable-plus'

export default {
    components: {
        VueDraggable
    },
    data: () => ({
        filter:'',
        folders: [],
        documents: []
    }),
    watch: {
        filteredItems: {
            deep: true,
            immediate: true,
            handler(newItems) {
                this.folders = [...newItems.filter(el => el?.data?.folder === true)];
                this.documents = [...newItems.filter(el => el?.data?.folder !== true)];
            }
        }
    },
    computed:{
        items() {
            return this.store.projectFolderTree; 
        },
        filteredItems() {
        // Filter out items without proper IDs first to prevent dragging issues
        const validItems = this.items.filter(item => item.id);
        
        // If filter is empty, return all valid items
        if (!this.filter) return validItems; 
        
        const search = this.filter.toLowerCase(); // Convert search to lowercase
        return validItems.map(item => {
            const itemString = JSON.stringify(item).toLowerCase(); // Convert item to string and lowercase
            const matchesFilter = itemString.indexOf(search) > -1; // Check if search is in the item string

            const filteredChildren = item.children ? item.children.filter(child => 
                child.id && JSON.stringify(child).toLowerCase().indexOf(search) > -1 // Check children as well, but only if they have IDs
            ) : [];

            // Return item if it matches the filter or if it has matching children
            return {
                ...item,
                children: filteredChildren,
                isOpen: true,
                // Include item even if it has no children but matches the filter
                show: matchesFilter || filteredChildren.length > 0
            };
            }).filter(item => item.show); // Only return items that match or have matching children
        },

    },
    methods: {
        handleTreeChange() {
            // console.log('tree changed', this.items)
        },

        handleItemClick(item) {
            this.$router.push({ path: `/document/${item.id}` }); 
        },
        
        async addFolder() {
            this.$store.folders.add("New Folder");
        },

        isSelected(el) {
            if (this.$route.params.id === el.id) {
                return true; // Select the document if it matches the route ID
            }
        },

        hasSelectedChild(el) {
            if (el.children) {
                return el.children.some(child => this.isSelected(child));
            }
            return false;
        },

        isDraft(el) {
            return !el.data?.releasedVersion || el.data?.releasedVersion?.length === 0;
        },

        toggle(el) {
            el.isOpen = !el.isOpen;
            this.$store.folders.toggleOpen({ 
                FolderName: el.id, 
                isOpen: el.isOpen 
            });
        },

        onUpdate() {
            console.log('update')
        }, 

        handleDragOver(el) {
            // Clear any existing timeout
            if (el._dragTimeout) {
                clearTimeout(el._dragTimeout);
            }
            
            // Set a new timeout to open the folder
            el._dragTimeout = setTimeout(() => {
                el.isOpen = true;
            }, 50);
        },

        handleDragLeave(el) {
            // Clear the timeout if drag leaves before it triggers
            if (el._dragTimeout) {
                clearTimeout(el._dragTimeout);
                delete el._dragTimeout;
            }
            
            // Close the folder after a short delay
            setTimeout(() => {
                el.isOpen = false;
            }, 800); // Slightly longer delay for closing to prevent flickering
        },

        onAdd(event,folder) {
            if(!folder) return;
            // Don't allow moving documents without proper IDs
            if(!event.data || !event.data.id) return;

            this.$store.folders.update({ 
                docId: event.data.id, 
                target: folder.id, 
                action: 'add' 
            });
        },

        remove(event,folder) {
            if(!folder) return;
            // Don't allow moving documents without proper IDs
            if(!event.data || !event.data.id) return;

            this.$store.folders.update({ 
                docId: event.data.id, 
                target: folder.id, 
                action: 'remove' 
            });
        },

        deleteFolder(id){
            this.$store.folders.remove(id)
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
            this.$store.folders.rename({toFolderName: value, fromFolderName: el.data.name})
            el.data.name = value
            el.renaming = false;
        },
        cancelRenameFolder(el){
            el.renaming = false;
        },
    }

}

</script>


<style scoped>

.document-tree-container {
  display: flex;
  flex-direction: column;
  height: 100%; /* Fill the navigation drawer */
  max-height: calc(100vh - 64px); /* Account for app bar */
}

.tree-header {
  flex-shrink: 0; /* Don't shrink the header */
  border-bottom: 1px solid rgba(var(--v-theme-outline), 0.12);
}

.tree-content {
  flex: 1; /* Take up remaining space */
  overflow-y: auto; /* Enable scrolling */
  overflow-x: hidden; /* Prevent horizontal scroll */
  min-height: 0; /* Important for flexbox scrolling */
}

/* Custom scrollbar styling - make it more visible */
.tree-content::-webkit-scrollbar {
  width: 8px;
}

.tree-content::-webkit-scrollbar-track {
  background: rgba(var(--v-theme-outline), 0.2);
  border-radius: 4px;
  margin: 4px 0;
}

.tree-content::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-outline), 0.5);
  border-radius: 4px;
  border: 1px solid rgba(var(--v-theme-outline), 0.1);
}

.tree-content::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--v-theme-outline), 0.7);
}

/* Ensure scrollbar is always visible when content overflows */
.tree-content {
  scrollbar-width: thin; /* Firefox */
  scrollbar-color: rgba(var(--v-theme-outline), 0.5) rgba(var(--v-theme-outline), 0.1); /* Firefox */
}

.selected-item {
  background-color: rgb(var(--v-theme-surface-light)); /* Add your desired style for selected item */
}

.overlay-icon{
    left: -15px;
    margin-right:-15px;
    scale: 75%;
}

/* Text truncation with custom dash ellipsis */
.folder-name,
.document-name {
  max-width: 180px; /* Adjust based on sidebar width */
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  display: inline-block;
  vertical-align: middle; /* Ensure proper alignment with icons */
}

/* Ensure tooltip wrappers don't break inline alignment */
:deep(.v-tooltip) {
  display: inline-block;
  vertical-align: middle;
}

:deep(.v-tooltip .v-overlay__content) {
  display: inline-block;
  vertical-align: middle;
}

/* Subtle pulse animation for dragging items (less intrusive) */
@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
}

/* Apply subtle animation when item is being dragged */
.sortable-chosen {
  animation: pulse 0.6s ease-in-out infinite;
  background-color: rgba(var(--v-theme-primary), 0.1) !important;
  border-radius: 4px;
  transition: all 0.2s ease;
}

/* Style for the ghost element (placeholder) */
.ghost {
  opacity: 0.4;
  background-color: rgba(var(--v-theme-primary), 0.1);
  border: 2px dashed rgba(var(--v-theme-primary), 0.3);
  border-radius: 4px;
}

/* Override default ellipsis with dash */
.folder-name {
  text-overflow: '-';
}

.document-name {
  text-overflow: '-';
}

/* Fallback for browsers that don't support custom text-overflow */
@supports not (text-overflow: '-') {
  .folder-name,
  .document-name {
    text-overflow: ellipsis;
  }
  
  .folder-name::after,
  .document-name::after {
    content: '';
  }
}

</style>