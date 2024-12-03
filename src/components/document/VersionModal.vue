<template>
    <div>
        <v-menu 
            v-model="open"
            :close-on-content-click="false">
            <template v-slot:activator="{ props: menu }">
                <div>
                    <v-tooltip text="toggle draft mode" location="bottom">
                        <template v-slot:activator="{ props: tooltip }">
                            <v-btn 
                                v-if="$store.state.selected.data" 
                                :disabled="disabled" 
                                variant="tonal" 
                                density="compact" 
                                v-bind="tooltip" 
                                :color="$store.state.selected.data.draft ? 'orange' : undefined" 
                                :text-color="$store.state.selected.data.draft ? 'white' : undefined" 
                                class="mx-3 mr-0 text-none rounded-s-pill" 
                                @click="toggleDraft()">
                                {{ $store.state.selected.data.draft ? 'Staged' : 'Released' }}
                            </v-btn>
                        </template>
                    </v-tooltip>
                    <v-tooltip text="switch version" location="bottom">
                        <template v-slot:activator="{ props: tooltip }">
                            <v-btn 
                                variant="tonal" 
                                density="compact" 
                                class="text-none rounded-e-pill ml-0" 
                                @click.stop="open = !open" 
                                v-bind="mergeProps(menu, tooltip)">
                                {{ selectedVersion ? selectedVersion : 'live' }}
                            </v-btn>
                        </template>
                    </v-tooltip>
                </div>
            </template>

        <v-card class="pa-2 ma-2" style="min-width: 200px;">

            <v-select v-if="versions.length > 0 && !creatingVersion"
                v-model="selectedVersion"
                :items="computedVersions"
                :item-title="item => item.versionNumber"
                :item-value="item => item.versionNumber"
                label="Select Version"
                @update:modelValue="selectVersion"
                density="compact"
                hide-details="auto"
            ></v-select>
            <v-text-field v-if="versions.length === 0 || creatingVersion === true"
                v-model="newVersion"
                label="New Version"
                placeholder="v0.0.1"
                density="compact"
                hide-details="auto"
            ></v-text-field>

            <v-card-actions v-if=" !creatingVersion">
                <v-btn :disabled="disableVersionManagement" v-if="selectedVersion && selectedVersion != 'live'" color="error" @click="deleteVersion()">Delete</v-btn>      
                <v-spacer></v-spacer>        
                <!-- <v-btn class="text-none" @click="creatingVersion = true">Fork</v-btn>       -->
                <v-btn :disabled="disableVersionManagement" class="text-none" color="primary" @click="creatingVersion = true">New</v-btn>
           </v-card-actions>
            <v-card-actions v-if="creatingVersion">
                <v-spacer></v-spacer>        
                <v-btn :disabled="disableVersionManagement" class="text-none" @click="creatingVersion = false; newVersion = ''">Back</v-btn>
                <v-btn :disabled="disableVersionManagement" v-if="newVersion" class="text-none" color="success" @click="createVersion()">Create</v-btn>
            </v-card-actions>
        </v-card>
    </v-menu>
    </div>

</template>

<script>
import { Document } from "../../services/firebaseDataService";
import { mergeProps } from 'vue'

export default {
    name: 'VersionModal',
    props: {
        versions: {
            type: Array,
            default: () => []
        },
        disabled: {
            type: Boolean,
            default: false
        }
    },
    computed: {
        computedVersions() {
            return ['live', ...this.versions]
        }, 

        disableVersionManagement() {
            return !this.$store.getters.isUserLoggedIn
        }

    },
    data() {
        return {
            open: false,
            creatingVersion: false,
            newVersion: '',
            selectedVersion: null,
        }
    },
    methods: {
        //TODO: need to prevent duplicate version numbers should be kinda easy

        mergeProps,
        
        selectVersion() {
            if (this.selectedVersion === 'live') {
                this.$router.replace({'query': null});
            } else {
                this.$router.push({ query: { v: this.selectedVersion }})
            }
        },

        async createVersion() {
            await this.$store.dispatch('createVersion', this.newVersion);
            this.$router.push({ query: { v: this.newVersion }});
            this.creatingVersion = false;
            this.newVersion = '';
            this.open = false;
        },

        async deleteVersion() {
            await this.$store.dispatch('deleteVersion', this.selectedVersion);
            this.creatingVersion = false;
            this.newVersion = '';
            this.open = false;
            this.selectedVersion = null;
            this.$router.replace({'query': null});
        },

        async toggleDraft() {
            await this.$store.dispatch('toggleDraft');
        },
    }
}
</script>

<style scoped>

</style>
