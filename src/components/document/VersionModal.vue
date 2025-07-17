<template>
    <div>
        <v-menu 
            v-model="open"
            :close-on-content-click="false">
            <template v-slot:activator="{ props: menu }">
                <div>
                    <v-tooltip 
                        v-if="$store.selected.isVersion"
                        text="toggle released status" 
                        location="bottom">
                        <template v-slot:activator="{ props: tooltip }">
                            <v-btn 
                                v-if="$store.selected.data" 
                                :disabled="disabled" 
                                variant="tonal" 
                                density="compact" 
                                v-bind="tooltip" 
                                :color="!versionReleasedStatus ? 'orange' : undefined" 
                                :text-color="!versionReleasedStatus ? 'white' : undefined" 
                                class="mx-1 mr-0 text-none rounded-s-pill" 
                                @click="toggleDraft()">
                                {{ !versionReleasedStatus ? 'Staged' : 'Released' }}
                            </v-btn>
                        </template>
                    </v-tooltip>
                    <v-tooltip 
                        v-else
                        :text="$store.selected.data?.releasedVersion?.length > 0 ? 'release status' : 'create a version and release it'" 
                        location="bottom">
                        <template v-slot:activator="{ props: tooltip }">
                            <v-btn 
                                :disabled="true" 
                                variant="tonal" 
                                density="compact" 
                                v-bind="tooltip" 
                                :color="$store.selected.data?.releasedVersion?.length > 0 ? undefined : 'orange'" 
                                :text-color="$store.selected.data?.releasedVersion?.length > 0 ? undefined : 'white'" 
                                class="mx-1 mr-0 text-none rounded-s-pill" >
                                {{ $store.selected.data?.releasedVersion?.length > 0 ? 'Released' : 'Staged' }}
                            </v-btn>
                        </template>
                    </v-tooltip>
                    <!-- Show commit input when there are uncommitted changes -->
                    <div v-if="showCommitUI" 
                         class="d-flex align-center rounded-e-pill ml-0 pa-1" 
                         style="background-color: rgb(var(--v-theme-surface-variant)); border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));">
                        <v-tooltip text="uncommitted changes" location="bottom">
                            <template v-slot:activator="{ props: tooltip }">
                                <v-icon 
                                    v-bind="tooltip"
                                    color="warning" 
                                    size="small"
                                    class="ml-2 mr-1"
                                >
                                    mdi-alert
                                </v-icon>
                            </template>
                        </v-tooltip>
                        <input
                            v-model="commitMessage"
                            placeholder="Commit message..."
                            class="commit-input flex-grow-1 mr-2"
                            @keyup.enter="createCommit()"
                        />
                        <v-btn 
                            :disabled="!commitMessage || commitMessage.trim() === '' || disableVersionManagement"
                            color="success" 
                            variant="flat"
                            density="compact"
                            size="small"
                            class="text-none mr-1"
                            @click="createCommit()"
                        >
                            Commit
                        </v-btn>
                        <v-tooltip text="switch version" location="bottom">
                            <template v-slot:activator="{ props: tooltip }">
                                <v-btn 
                                    variant="text" 
                                    density="compact" 
                                    size="small"
                                    icon
                                    @click.stop="open = !open" 
                                    v-bind="mergeProps(menu, tooltip)"
                                >
                                    <v-icon>mdi-chevron-down</v-icon>
                                </v-btn>
                            </template>
                        </v-tooltip>
                    </div>
                    
                    <!-- Normal version display when no uncommitted changes -->
                    <v-tooltip v-else text="switch version" location="bottom">
                        <template v-slot:activator="{ props: tooltip }">
                            <v-btn 
                                variant="tonal" 
                                density="compact" 
                                class="text-none rounded-e-pill ml-0" 
                                @click.stop="open = !open" 
                                v-bind="mergeProps(menu, tooltip)">
                                {{ currentVersion }}
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
                :key="JSON.stringify(versions)"
                label="Select Version"
                @update:modelValue="selectVersion"
                density="compact"
                hide-details="auto"
            >
              <template v-slot:item="{ props, item }">
                <v-list-item v-bind="props">
                  <template v-slot:append>
                    <v-icon 
                      v-if="!(item.raw?.released)" 
                      color="warning" 
                      size="small"
                    >
                    mdi-pencil
                    </v-icon>
                  </template>
                </v-list-item>
              </template>
            </v-select>
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
        },
        currentVersion: {
            type: String,
            default: 'live'
        }
    },
    computed: {
        computedVersions() {
            const versions = this.$store.selected.versions;
            return ['live', ...(Array.isArray(versions) ? versions : [])]
        }, 
        disableVersionManagement() {
            return !this.$store.isUserLoggedIn
        },
        versionData() {
            return this.$store.selected?.versions?.find(version => version.versionNumber === this.currentVersion)
        },
        versionReleasedStatus() {
            return this.versionData?.released ?? false
        },
        showCommitUI() {
            // Show commit UI if user is logged in, on live version, and has uncommitted changes
            return this.$store.isUserLoggedIn && 
                   this.currentVersion === 'live' && 
                   this.$store.hasUncommittedChanges();
        }
    },
    data() {
        return {
            open: false,
            creatingVersion: false,
            newVersion: '',
            selectedVersion: null,
            commitMessage: '',
        }
    },
    created() {
        this.selectedVersion = this.currentVersion;
    },
    watch: {
        currentVersion(newVal) {
            this.selectedVersion = newVal;
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
            if (this.newVersion === 'live') {
                console.warn('cannont name version live');
                this.$store.uiAlert({type: 'error', message: 'Cannot name version live', autoClear: true});
                return;
            }
                
            await this.$store.createVersion(this.newVersion);
            this.$router.push({ query: { v: this.newVersion }});
            this.creatingVersion = false;
            this.newVersion = '';
            this.open = false;
        },

        async deleteVersion() {
            await this.$store.deleteVersion(this.selectedVersion);
            this.creatingVersion = false;
            this.newVersion = '';
            this.open = false;
            this.selectedVersion = null;
            this.$router.replace({'query': null});
        },

        async toggleDraft() {
            await this.$store.toggleVersionReleased({ versionNumber: this.currentVersion, released: !this.versionReleasedStatus });
        },

        async createCommit() {
            if (!this.commitMessage || this.commitMessage.trim() === '') {
                this.$store.uiAlert({type: 'error', message: 'Commit message is required', autoClear: true});
                return;
            }

            try {
                await this.$store.createCommit(this.commitMessage);
                this.commitMessage = '';
                this.open = false;
            } catch (error) {
                console.error('Error creating commit:', error);
            }
        },
    }
}
</script>

<style scoped>

.v-btn--size-default{
  padding: 0px 8px !important;
}

.commit-input {
  background: transparent;
  border: none;
  outline: none;
  font-size: 14px;
  color: rgb(var(--v-theme-on-surface));
  min-width: 120px;
}

.commit-input::placeholder {
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.7;
}

</style>
