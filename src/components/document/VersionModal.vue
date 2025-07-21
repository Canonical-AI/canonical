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
                    :text="currentCommitId && currentCommitData ? 
                        (currentCommitData.versionNumber ? 'Toggle this version release status' : 'This commit has no version number') :
                        (documentHasReleasedVersions ? 'This document has released versions available to project readers' : 'This document has no released versions - all versions are drafts')" 
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
                    <v-tooltip 
                        v-if="canTagCurrentCommit" 
                        text="Tag current commit as version" 
                        location="bottom"
                    >
                        <template v-slot:activator="{ props }">
                            <v-btn
                                v-bind="props"
                                color="success"
                                density="compact"
                                class="text-none hover-scale px-3 py-1"
                                variant="tonal"
                                @click="openCreateVersionDialog"
                            >
                                <v-icon size="small" class="mr-1">mdi-tag-plus</v-icon>
                                Tag Version
                            </v-btn>
                        </template>
                    </v-tooltip>
                    <v-btn
                        v-else
                        color="success"
                        density="compact"
                        class="text-none hover-scale px-3 py-1"
                        variant="tonal"
                        @click="openCreateVersionDialog"
                    >Create Version</v-btn>
                </div>

            </div>
        
        </transition>

        <!-- Return to Live button when viewing a commit -->
        <div v-if="currentCommitId" class="d-flex align-center mx-2" @click.stop>
            <v-btn
                color="primary"
                variant="outlined"
                density="compact"
                class="text-none return-to-live-btn"
                @click="returnToLive"
            >
                <v-icon size="small" class="mr-1">mdi-home</v-icon>
                Return to Live
            </v-btn>
        </div>

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
                        <v-select v-if="computedVersions.length > 1 && !creatingVersion"
                            v-model="selectedVersion"
                            :items="computedVersions"
                            :item-title="item => item.displayName || item.versionNumber || item"
                            :item-value="item => item.value || item.versionNumber || item"
                            :key="JSON.stringify(computedVersions)"
                            label="Select Version/Commit"
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
                        <v-text-field v-if="computedVersions.filter(v => v.type === 'version').length === 0 || creatingVersion === true"
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
            
            <v-alert 
                v-if="!uncommittedChanges && canTagCurrentCommit"
                type="info"
                variant="tonal"
                density="compact"
                class="my-2"
            >
                Current commit will be tagged as this version
            </v-alert>
            
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
import { useVersionCreation } from './composables/useVersionCreation'

export default {
    name: 'VersionModal',
    props: {
        disabled: {
            type: Boolean,
            default: false
        },
        currentVersion: {
            type: String,
            default: 'live'
        },
        currentCommitId: {
            type: String,
            default: null
        }
    },
    setup() {
        const { 
            createVersion: createVersionFromComposable, 
            getSuggestedVersionNumber, 
            canTagCurrentCommit 
        } = useVersionCreation()
        
        return {
            createVersionFromComposable,
            getSuggestedVersionNumber,
            canTagCurrentCommit
        }
    },
    computed: {
        uncommittedChanges() {
            return this.$store.uncommittedChanges;
        },
        computedVersions() {
            const commits = this.$store.selected.commits || [];
            
            // Create items for commits with version numbers (versions) and regular commits
            const versionItems = commits
              .filter(c => c.versionNumber)
              .map(c => ({
                ...c,
                type: 'version',
                displayName: `${c.versionNumber} - ${c.message || 'Untitled'}`,
                value: c.versionNumber,
                versionNumber: c.versionNumber
              }));
            
            const commitItems = commits
              .filter(c => !c.versionNumber)
              .map(c => ({
                ...c,
                type: 'commit',
                displayName: `${c.message || 'Untitled'} (${c.id.substring(0, 8)})`,
                value: c.id
              }));
            
            // Combine with live option and sort versions first
            return [
                { type: 'live', displayName: 'live', value: 'live' },
                ...versionItems,
                ...commitItems
            ];
        }, 
        disableVersionManagement() {
            return !this.$store.isUserLoggedIn
        },
        
        // Simplified: Current commit data when viewing a specific commit
        currentCommitData() {
            if (!this.currentCommitId) return null;
            return this.$store.selected?.commits?.find(commit => commit.id === this.currentCommitId) || null;
        },
        
        // Simplified: Document released status
        documentHasReleasedVersions() {
            const releasedVersions = this.$store.selected?.data?.releasedVersion || [];
            return releasedVersions.length > 0;
        },
        
        // Simplified: Version status for display
        versionReleasedStatus() {
            // Case 1: Viewing a specific commit - show that commit's release status
            if (this.currentCommitId && this.currentCommitData) {
                const isReleased = this.currentCommitData.released || false;
                const hasVersion = this.currentCommitData.versionNumber || false;
                
                // If commit has no version number, show different status
                if (!hasVersion) {
                    return {
                        status: false,
                        label: 'No Version',
                        shortLabel: 'C',
                        color: 'secondary'
                    };
                }
                
                return {
                    status: isReleased,
                    label: isReleased ? 'Released' : 'Staged',
                    shortLabel: isReleased ? 'R' : 'S',
                    color: isReleased ? 'success' : 'warning'
                };
            }
            
            // Case 2: Viewing live document - show if document has any released versions
            const hasReleased = this.documentHasReleasedVersions;
            return {
                status: hasReleased,
                label: hasReleased ? 'Has Released' : 'Draft',
                shortLabel: hasReleased ? 'P' : 'D', // P = Published, D = Draft
                color: hasReleased ? 'success' : 'warning'
            };
        },
        
        showCommitUI() {
            // Show commit UI if user is logged in, on live version (not viewing commit/version), and has uncommitted changes
            return this.$store.isUserLoggedIn && 
                   this.currentVersion === 'live' && 
                   !this.currentCommitId &&
                   this.uncommittedChanges;
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
        // Set initial selected version based on current state
        this.selectedVersion = this.currentCommitId || this.currentVersion;
        // Inject global animations
        injectAnimations();
    },

    watch: {
        currentVersion(newVal) {
            if (!this.currentCommitId) {
                this.selectedVersion = newVal;
            }
        },
        currentCommitId(newVal) {
            this.selectedVersion = newVal || this.currentVersion;
        }
    },
    methods: {
        //TODO: need to prevent duplicate version numbers should be kinda easy

        mergeProps,
        
        selectVersion() {
            if (this.selectedVersion === 'live') {
                this.$router.replace({'query': null});
            } else {
                // Check if selected item is a commit ID or version number
                const selectedItem = this.computedVersions.find(item => 
                    item.value === this.selectedVersion || item.versionNumber === this.selectedVersion
                );
                
                if (selectedItem && selectedItem.type === 'commit') {
                    // Navigate to commit
                    this.$router.push({ query: { c: this.selectedVersion }});
                } else if (selectedItem && selectedItem.type === 'version') {
                    // For versions, find the commit that has this version number and navigate to it
                    const commits = this.$store.selected.commits || [];
                    
                    const associatedCommit = commits.find(commit => 
                        commit.versionNumber === selectedItem.versionNumber
                    );
                    
                    if (associatedCommit) {
                        // Navigate to the commit that has this version number
                        this.$router.push({ query: { c: associatedCommit.id }});
                    } else {
                        // Fallback to version navigation if no associated commit found
                        this.$router.push({ query: { v: this.selectedVersion }});
                    }
                } else {
                    // Fallback for unknown types
                    this.$router.push({ query: { v: this.selectedVersion }});
                }
            }
        },



        // Shared dialog methods
        openCreateVersionDialog() {
            // Pre-fill with suggested version number if none exists
            if (!this.newVersion) {
                this.newVersion = this.getSuggestedVersionNumber();
            }
            this.showCreateVersionDialog = true;
        },

        closeCreateVersionDialog() {
            this.showCreateVersionDialog = false;
            this.newVersion = '';
            this.newVersionRelease = false;
        },

        async handleCreateVersion() {
            try {
                await this.createVersionFromComposable({
                    versionNumber: this.newVersion,
                    released: this.newVersionRelease,
                    commitMessage: this.commitMessage
                });
                this.closeCreateVersionDialog();
            } catch (error) {
                console.error('Error creating version:', error);
            }
        },

        async deleteVersion() {
            // Find the commit with this version number and remove its version tagging
            const commitWithVersion = this.$store.selected.commits?.find(c => c.versionNumber === this.selectedVersion);
            if (commitWithVersion) {
                try {
                    await this.$store.removeCommitVersionTag({
                        commitId: commitWithVersion.id,
                        versionNumber: this.selectedVersion
                    });
                } catch (error) {
                    console.error('Error removing version tag:', error);
                }
            }
            
            this.creatingVersion = false;
            this.newVersion = '';
            this.isExpanded = false;
            this.selectedVersion = null;
            this.$router.replace({'query': null});
        },

        async toggleDraft() {
            // Case 1: Viewing a specific commit with a version - toggle that commit's release status
            if (this.currentCommitId && this.currentCommitData && this.currentCommitData.versionNumber) {
                try {
                    await this.$store.toggleCommitVersionRelease({
                        commitId: this.currentCommitData.id,
                        released: !this.currentCommitData.released
                    });
                } catch (error) {
                    console.error('Error toggling commit version release:', error);
                }
                return;
            }
            
            // Case 2: Viewing live document or commit without version - no toggle action available
            // This could be expanded in the future if needed
            console.log('Toggle not available for current view');
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
            
            // If viewing a commit with a version, also toggle the release status
            if (this.currentCommitId && this.currentCommitData && this.currentCommitData.versionNumber) {
                this.toggleDraft();
            }
        },

        // Return to live document method
        returnToLive() {
            this.$router.replace({'query': null});
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

/* Pulse animation for return to live button */
.return-to-live-btn {
    animation: pulse-glow 2s infinite;
}

@keyframes pulse-glow {
    0% {
        box-shadow: 0 0 0 0 rgba(var(--v-theme-primary), 0.4);
    }
    70% {
        box-shadow: 0 0 0 6px rgba(var(--v-theme-primary), 0);
    }
    100% {
        box-shadow: 0 0 0 0 rgba(var(--v-theme-primary), 0);
    }
}

</style>
