<template>

    <v-row class="w-100">
            <v-col cols="12" md="10" lg="10" class="px-20 w-100 overflow-none">
                <v-container class="px-20 overflow-none">

                    <h1 class="h1">User Config
                    </h1> 

                    <v-select
                        density="compact"
                        v-model="user.defaultProject"
                        :items="this.$store.projects"
                        item-title="name"
                        item-value="id"
                        object
                        label="Defaul Project"
                        variant="solo"
                        hide-details
                        @update:modelValue="setDefaultProject"
                        >
                    </v-select>

                    <v-list two-line class="mt-2">
                        <v-list-item>
                            <v-list-item-subtitle> Display Name</v-list-item-subtitle>
                            <v-list-item-title>{{ user.displayName }}</v-list-item-title>
                        </v-list-item>
                        <v-list-item>
                            <v-list-item-subtitle> Email</v-list-item-subtitle>
                            <v-list-item-title>{{ user.email }}</v-list-item-title>
                        </v-list-item>
                        <v-list-item>
                            <v-list-item-subtitle> Subcription Tier</v-list-item-subtitle>
                            <v-list-item-title>{{ user.tier }}</v-list-item-title>
                        </v-list-item>
                        <v-list-item>    
                            <v-list-item-subtitle> Date Joined</v-list-item-subtitle>
                            <v-list-item-title>{{ user.createDate }}</v-list-item-title>                
                        </v-list-item>
                    </v-list>

                    <v-btn class="m-2 text-none" color="primary">Update</v-btn>
                    <v-btn disabled class="m-2 text-none" color="warning">Unsubscribe</v-btn> 
                    <!-- todo: add confirmation dialog -->
                    <v-btn disabled class="m-2 text-none" color="error">Delete User Data</v-btn>
                    <!-- todo: add confirmation dialog -->

                    </v-container>
            </v-col>
    </v-row>


    

</template>

<script>
import {User} from '../../services/firebaseDataService'

export default {
    data() {
        return {
            user: {}
        }
    },
    beforeMount() {
        this.user = this.$store.user
    },
    methods: {
        updateUser() {
            console.log('updateUser')
        },
        setDefaultProject(projectId) {
            this.$store.userSetDefaultProject(this.user.defaultProject)
        }
    }
}


</script>