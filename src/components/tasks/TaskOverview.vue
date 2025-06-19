<template>
    <v-card class="p-10 bg-inherit" flat title="Tasks" >

        <template v-slot:text>
            <v-text-field
                v-model="search"
                label="Search"
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                hide-details
                single-line
                density="compact"
            ></v-text-field>
        </template>

        <v-data-table 
            :search="search"
            :items="tasks" 
            :headers="headers"
            :sort-by="[
                { key: 'checked', order: 'asc' },
                { key: 'priority', order: 'asc' }
            ]"
        >
            
            <template v-slot:item.documentName="{ item }">
                <router-link 
                    :to="`/document/${item.documentId}`"
                    class="text-primary hover:text-primary-dark hover:underline text-truncate d-inline-block max-w-[200px]"
                >
                    {{ item.documentName }}
                </router-link>
            </template>
            <template v-slot:item.createdDate="{ item }">
                {{ formatDate(item.createdDate) }}
            </template>
            <template v-slot:item.checkDate="{ item }">
                {{ item.checkDate ? formatDate(item.checkDate) : '-' }}
            </template>
            <template v-slot:item.checked="{ item }">
                <v-checkbox
                    v-model="item.checked"
                    @change="updateTaskChecked(item, item.checked)"
                    dense
                    hide-details
                ></v-checkbox>
            </template>
            <template v-slot:item.priority="{ item }">
                <v-menu>
                    <template v-slot:activator="{ props }">
                        <v-chip
                            v-bind="props"
                            :color="getPriorityColor(item.priority)"
                            size="small"
                            class="font-weight-medium cursor-pointer"
                        >
                            {{ getPriorityLabel(item.priority) }}
                        </v-chip>
                    </template>
                    
                    <v-list class="rounded-lg border border-surface-light">
                        <v-list-item
                            density="compact"
                            v-for="priority in [1, 2, 3, null]"
                            :key="priority"
                            @click="updateTask(item, {priority: priority})"
                        >
                            <v-list-item-title>
                                <v-chip
                                    :color="getPriorityColor(priority)"
                                    size="small"
                                    class="font-weight-medium"
                                >
                                    {{ getPriorityLabel(priority) }}
                                </v-chip>
                            </v-list-item-title>
                        </v-list-item>
                    </v-list>
                </v-menu>
            </template>
        </v-data-table>
    </v-card>
</template>

<script>
import dayjs from 'dayjs'

export default {
    name: "TaskOverview",
    data() {
        return {
            search: ''
        }
    },
    methods: {
        formatDate(timestamp) {
            return dayjs(timestamp.seconds * 1000).fromNow()
        },

        updateTaskChecked(task, checked ){
            this.updateTask(task, {
                checked: checked,
                checkDate: checked ? { seconds: Math.floor(Date.now() / 1000) } : null
            })
        },

        async updateTask(task, value){
            await this.$store.commit('updateTask', {
                docID: task.documentId,
                identity: task.identity,
                task: {
                    ...task,
                    ...value
                }
            });
        },

        getPriorityColor(priority) {
            switch (priority) {
                case 1: return 'purple';
                case 2: return 'warning';
                case 3: return 'info';
                default: return 'grey';
            }
        },
        getPriorityLabel(priority) {
            switch (priority) {
                case 1: return 'P1';
                case 2: return 'P2';
                case 3: return 'P3';
                default: return 'None';
            }
        },
    },
    computed: {
        tasks() {
            return this.$store.tasks
                .reduce((allTasks, doc) => {
                    const docTasks = doc.tasks.map(task => {
                        const document = this.$store.documents
                            .find(d => d.id === doc.docID);
                        
                        return {
                            ...task,
                            documentId: doc.docID,
                            documentName: document ? document.data.name : 'Unknown Document'
                        };
                    });
                    return [...allTasks, ...docTasks];
                }, []);
        },
        headers() {
            return [
                { title: 'Status', value: 'checked' , sortable: true  },
                { 
                    title: 'Priority', 
                    value: 'priority', 
                    sortable: true, 
                    sortRaw(a, b) {
                        const priorityOrder = {
                            1: 0,  // P1
                            2: 1,  // P2
                            3: 2,  // P3
                            null: 3, // None
                            undefined: 3 // Handle undefined case
                        };
                        
                        const valueA = priorityOrder[a.priority] ?? priorityOrder['null'];
                        const valueB = priorityOrder[b.priority] ?? priorityOrder['null'];
                        
                        return valueA - valueB;
                    }
                },
                { title: 'Task', value: 'src' },
                { title: 'Created', value: 'createdDate' , sortable: true },
                { title: 'Completed', value: 'checkDate' },
                { title: 'Document', value: 'documentName' },
                
            ];
        }
    }
}
</script>