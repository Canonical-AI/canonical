<template>
    <div class="d-inline-flex align-center version-pill rounded-full mx-2" @click="handlePillClick">
        <!-- Collapsed state: Just S/R indicator -->
        <transition name="app-fade" mode="out-in">
            <div v-if="!isExpanded" key="collapsed" class="d-flex align-center animate-slide-in-left">
                <v-tooltip 
                    text="version controls" 
                    location="bottom">
                    <template v-slot:activator="{ props: tooltip }">               
                             <!-- Status indicator -->
                             <v-btn 
                                 :disabled="disabled || versionReleasedStatus.status"
                                 density="compact"
                                 variant="tonal" 
                                 @click.stop="handleStatusButtonClick"
                                 :color="versionReleasedStatus.color" 
                                 class="px-1 py-1 hover-scale rounded-l-full">
                                 {{ versionReleasedStatus.shortLabel }}
                             </v-btn>
    
                    </template>
                </v-tooltip>
            </div>

            <!-- Expanded state: Full controls -->
            <div v-else key="expanded" class="d-flex align-center animate-slide-in-right" style="gap: 8px; width: 100%;">
                <!-- Status button (expanded) -->
                <v-tooltip 
                    :text="$store.selected.isVersion ? 'toggle released status' : ($store.selected.data?.releasedVersion?.length > 0 ? 'a version of this document has been released to project readers' : 'no versions have been released to project readers')" 
                    location="bottom">
                    <template v-slot:activator="{ props: tooltip }">
                                            <v-btn 
                        variant="tonal" 
                        density="compact"
                        v-bind="tooltip" 
                        :color="versionReleasedStatus.color" 
                        class="text-none hover-scale px-3 py-1 rounnded-l-full" 
                        :class="disabled || versionReleasedStatus.status ? 'disabled' : ''"
                        @click.stop="toggleExpanded()">
                        {{ versionReleasedStatus.label }}
                    </v-btn>
                    </template>
                </v-tooltip>

                <!-- Commit UI when there are uncommitted changes -->
                <div v-if="showCommitUI && uncommittedChanges" class="d-flex align-center bg-surface-variant rounded-lg animate-fade-in-up stagger-1 hover-shadow" @click.stop>
                    <v-tooltip text="uncommitted changes" location="bottom">
                        <template v-slot:activator="{ props: tooltip }">
                            <v-icon 
                                v-bind="tooltip"
                                color="warning" 
                                size="small"
                                class="mx-1"
                            >
                                mdi-circle-medium
                            </v-icon>
                        </template>
                    </v-tooltip>
                    <input
                        v-model="commitMessage"
                        placeholder="Commit message..."
                        class="commit-input"
                        @keyup.enter="createCommit()"
                        @click.stop
                    />
        
                    <v-btn 
                        :disabled="!commitMessage || commitMessage.trim() === '' || disableVersionManagement"
                        color="success" 
                        variant="flat"
                        density="compact"

                        class="text-none hover-scale rounded-none"
                        @click.stop="createCommit()"
                    >
                        Commit
                    </v-btn>
                    <v-btn 
                        :disabled="disableVersionManagement"
                        color="success" 
                        variant="tonal"
                        density="compact"

                        class="text-none hover-scale rounded-none"
                        @click.stop="openCreateVersionDialog"
                    >
                        Version
                    </v-btn>

   
                </div>

                <div v-else="showCommitUI && !uncommittedChanges" class="d-flex align-center bg-surface-variant rounded-lg animate-fade-in-up stagger-1 hover-shadow" @click.stop>
                    <v-btn
                        color="success"
                        density="compact"
                        class="text-none hover-scale px-3 py-1"
                        variant="tonal"
                        @click="openCreateVersionDialog"
                    >Create Version</v-btn>
                </div>

            </div>
        
        </transition>

        <div class="animate-fade-in-up flex-grow-1 d-flex align-center" @click.stop>
                <v-menu :close-on-content-click="false">
                    <template v-slot:activator="{ props: menu }">
                        <v-tooltip text="switch version" location="bottom">
                            <template v-slot:activator="{ props: tooltip }">
                                <v-btn 
                                    variant="tonal" 
                                    density="compact" 
                                    class="text-none font-weight-bold rounded-r-full px-2 py-1" 
                                    color="primary"
                                    style="min-width: 80px;"
                                    v-bind="mergeProps(menu, tooltip)">
                                    <v-icon size="small" class="mr-1">mdi-source-branch</v-icon>
                                    {{ currentVersion }}
                                    <v-icon size="small" class="ml-1">mdi-chevron-down</v-icon>
                                </v-btn>
                            </template>
                        </v-tooltip>
                    </template>

                    <v-card class="pa-2" style="min-width: 200px;">
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
                                <div class="d-flex align-center">
                                  <!-- Tag-based version indicator -->
                                  <v-chip 
                                    v-if="item.raw?.isTagBased"
                                    size="x-small"
                                    color="blue"
                                    variant="outlined"
                                    class="mr-1"
                                  >
                                    <v-icon size="10" class="mr-1">mdi-tag</v-icon>
                                    tag
                                  </v-chip>
                                  <!-- Draft/Released status -->
                                  <v-icon 
                                    v-if="!(item.raw?.released)" 
                                    color="warning" 
                                    size="small"
                                  >
                                  mdi-pencil
                                  </v-icon>
                                </div>
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

                        <v-card-actions v-if="!creatingVersion">
                            <v-btn :disabled="disableVersionManagement" v-if="selectedVersion && selectedVersion != 'live'" color="error" @click="deleteVersion()">Delete</v-btn>      
                            <v-spacer></v-spacer>        
                            <v-btn :disabled="disableVersionManagement" class="text-none" color="primary" @click="creatingVersion = true">New</v-btn>
                       </v-card-actions>
                        <v-card-actions v-if="creatingVersion && !taggingCommit">
                            <v-spacer></v-spacer>        
                            <v-btn :disabled="disableVersionManagement" class="text-none" @click="creatingVersion = false; newVersion = ''">Back</v-btn>
                            <v-btn :disabled="disableVersionManagement" v-if="newVersion" class="text-none" color="success" @click="createVersion()">Create</v-btn>
                            <v-btn :disabled="disableVersionManagement" class="text-none" color="secondary" @click="showCommitTagging()">Tag Commit</v-btn>
                        </v-card-actions>
                    </v-card>
                </v-menu>
        </div>

    </div>

    <!-- Shared Create Version Dialog -->
    <v-dialog v-model="showCreateVersionDialog" max-width="500">
        <v-card title="Create a Version" class="p-4">
            <v-text-field label="Version Number" placeholder="v0.0.1" density="compact" v-model="newVersion"></v-text-field>
            
            <v-text-field 
                            v-if="uncommittedChanges"
                            v-model="commitMessage"
                            label="Commit Message"
                            placeholder="Commit message..."
                            density="compact"
                            hide-details="auto"
                        ></v-text-field>
            
            <v-switch 
                color="success"
                v-model="newVersionRelease"
                density="compact"
            >
                <template v-slot:label>
                    {{ newVersionRelease ? 'Version will release to project readers' : 'Staged, visible only to collaborators' }}
                </template>
            </v-switch>

            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn
                    text="Close"
                    class="text-none"
                    variant="tonal"
                    @click="closeCreateVersionDialog"
                ></v-btn>
                <v-btn
                    text="Create"
                    color="success"
                    class="text-none"
                    variant="elevated"
                    @click="handleCreateVersion"
                ></v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
import { Document } from "../../services/firebaseDataService";
import { mergeProps } from 'vue'
import { injectAnimations, ANIMATION_TIMING, ANIMATION_PRESETS } from '../../utils/transitions'

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
        uncommittedChanges() {
            return this.$store.uncommittedChanges;
        },
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
            return { 
                status: this.versionData?.released ?? false,
                label: this.versionData?.released ? 'Released' : 'Staged',
                shortLabel: this.versionData?.released ? 'R' : 'S',
                color: this.versionData?.released ? 'success' : 'warning'
            }
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
            creatingVersion: false,
            newVersion: '',
            newVersionRelease: false,
            selectedVersion: null,
            commitMessage: '',
            isExpanded: false,
            showCreateVersionDialog: false,
            // Phase 2: Tag-based versions
            taggingCommit: false,
            newVersionTag: '',
            selectedCommitId: null,
            availableCommits: [],
        }
    },
    created() {
        this.selectedVersion = this.currentVersion;
        // Inject global animations
        injectAnimations();
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
            this.isExpanded = false;
        },

        // Shared dialog methods
        openCreateVersionDialog() {
            this.showCreateVersionDialog = true;
        },

        closeCreateVersionDialog() {
            this.showCreateVersionDialog = false;
            this.newVersion = '';
            this.newVersionRelease = false;
        },

        async handleCreateVersion() {
            await this.createVersion();
            this.closeCreateVersionDialog();
        },

        async deleteVersion() {
            await this.$store.deleteVersion(this.selectedVersion);
            this.creatingVersion = false;
            this.newVersion = '';
            this.isExpanded = false;
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
                this.isExpanded = false;
            } catch (error) {
                console.error('Error creating commit:', error);
            }
        },

        // New methods for expanded/collapsed state
        toggleExpanded() {
            this.isExpanded = !this.isExpanded;
        },
        handlePillClick() {
            // Only expand when collapsed, don't interfere with expanded state interactions
            if (!this.isExpanded) {
                this.isExpanded = true;
            }
        },
        handleStatusButtonClick() {
            // Always expand to show more options
            this.isExpanded = true;
            
            // If it's a version, also toggle the draft status
            if (this.$store.selected.isVersion) {
                this.toggleDraft();
            }
        },

        // Phase 2: Tag-based version methods
        async showCommitTagging() {
            this.taggingCommit = true;
            this.creatingVersion = false;
            this.availableCommits = await this.$store.getAvailableCommitsForTagging();
        },

        cancelCommitTagging() {
            this.taggingCommit = false;
            this.newVersionTag = '';
            this.selectedCommitId = null;
            this.availableCommits = [];
            this.creatingVersion = true;
        },

        async createVersionTag() {
            if (this.newVersionTag === 'live') {
                console.warn('cannot name version live');
                this.$store.uiAlert({type: 'error', message: 'Cannot name version live', autoClear: true});
                return;
            }

            try {
                await this.$store.createVersionTag(this.newVersionTag, this.selectedCommitId);
                this.$router.push({ query: { v: this.newVersionTag }});
                this.taggingCommit = false;
                this.newVersionTag = '';
                this.selectedCommitId = null;
                this.availableCommits = [];
                this.isExpanded = false;
            } catch (error) {
                console.error('Error creating version tag:', error);
            }
        }
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

/* Minimal custom styles - use Tailwind/Vuetify classes where possible */
.version-pill {
    background-color: rgb(var(--v-theme-surface-variant));
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

</style>
