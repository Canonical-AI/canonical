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

        <Transition v-bind="$fadeTransition">
            <DocumentTreeNested 
            :modelValue="filteredItems" 
            @document-tree-change="handleTreeChange" 
            custKey="base" 
            />
        </Transition>

    </div>

</template>

<script>
import DocumentTreeNested from './DocumentTreeNested.vue'

export default {
    components: {
        DocumentTreeNested
    },
    data: () => ({
        filter:''
    }),
    watch: {

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
        
        async addFolder() {
            await this.$store.commit('addFolder', "New Folder");
        },
    }
}

</script>

