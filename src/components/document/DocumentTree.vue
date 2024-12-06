<template>
    <v-list-item :title="$store.state.project.name" subtitle="project" ></v-list-item>
    
    <v-divider></v-divider>
    <v-list-item>
      <v-btn 
        :disabled="!$store.getters.isUserLoggedIn"
        class="text-none" 
        block 
        @click="$router.push({ path: '/document/create-document' })" 
        color="primary" 
        density="compact">
            Create Doc
        </v-btn>
    </v-list-item>
    <v-divider></v-divider>
    <div>
        <v-text-field
          v-model="filter"
          label="Filter Documents"
          append-inner-icon="mdi-magnify"
          single-line
          density="compact"
          hide-details
        />

        <v-btn :disabled="!$store.getters.isUserLoggedIn" 
            class="text-none" @click="addFolder()" 
            variant="text" 
            density="compact" 
            size="small">Add Folder 
            <v-icon icon="mdi-plus"></v-icon>
        </v-btn>

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
                            :key="el.id"
                            :style="{ paddingLeft: '24px' }"
                            @click="handleItemClick(child)"
                            >

                            <v-icon small class="text-medium-emphasis pr-1">{{ 'mdi-text-box' }}</v-icon>
                            <v-icon class="overlay-icon text-medium-emphasis pr-1" icon="mdi-pencil" v-if="child.data.draft" color="warning"></v-icon>
                            <span class="" > {{ child.data.name }} </span>

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
                    :key="el.id"
                    @click="handleItemClick(el)"
                    >

                    <v-icon small class="text-medium-emphasis pr-1">{{ 'mdi-text-box' }}</v-icon>
                    <v-icon class="overlay-icon text-medium-emphasis pr-1" icon="mdi-pencil" v-if="el.data.draft" color="warning"></v-icon>
                    
                    <span class="" >{{ el.data.name }}</span>
                </li>
            </VueDraggable>
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
            immediate: true,
            handler(newItems) {
                this.folders = [...newItems.filter(el => el?.data?.folder === true)];
                this.documents = [...newItems.filter(el => el?.data?.folder !== true)];
            }
        }
    },
    computed:{
        items() {
            return this.$store.getters.projectFolderTree; 
        },
        filteredItems() {
        // If filter is empty, return all items
        if (!this.filter) return this.items; 
        
        const search = this.filter.toLowerCase(); // Convert search to lowercase
        return this.items.map(item => {
            const itemString = JSON.stringify(item).toLowerCase(); // Convert item to string and lowercase
            const matchesFilter = itemString.indexOf(search) > -1; // Check if search is in the item string

            const filteredChildren = item.children ? item.children.filter(child => 
                JSON.stringify(child).toLowerCase().indexOf(search) > -1 // Check children as well
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
            await this.$store.commit('addFolder', "New Folder");
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

        toggle(el) {
            el.isOpen = !el.isOpen;
            this.$store.commit('toggleFolderOpen', { 
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

            this.$store.commit('updateFolder', { 
                docId: event.data.id, 
                target: folder.id, 
                action: 'add' 
            });
        },

        remove(event,folder) {
            if(!folder) return;

            this.$store.commit('updateFolder', { 
                docId: event.data.id, 
                target: folder.id, 
                action: 'remove' 
            });
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
        },
    }

}

</script>


<style scoped>




.selected-item {
  background-color: rgb(var(--v-theme-surface-light)); /* Add your desired style for selected item */
}


.overlay-icon{
    left: -15px;
    margin-right:-15px;
    scale: 75%;
}


</style>