<template>
    <div class="d-inline-flex align-center version-pill rounded-full mx-2">
        <!-- Version Controls - different UI based on context -->
        <div v-if="$store.versionControlsContext === 'live_document'" @click="handlePillClick">
            <!-- Commit UI -->
            <transition name="app-fade" mode="out-in">
                <!-- Collapsed state: Just S/R indicator -->
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
                        :text="currentCommitId && $store.currentCommitData ? 
                            ($store.currentCommitData.versionNumber ? 'Toggle this version release status' : 'This commit has no version number') :
                            ($store.documentHasReleasedVersions ? 'This document has released versions available to project readers' : 'This document has no released versions - all versions are drafts')" 
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
        </div>

        <!-- Controls when viewing a commit -->
        <div v-else-if="$store.versionControlsContext === 'viewing_commit'" class="d-flex align-center">
            <!-- Status indicator for commit -->
            <v-btn 
                density="compact"
                variant="tonal" 
                :color="versionReleasedStatus.color" 
                class="px-2 py-1 hover-scale rounded-l-full">
                {{ versionReleasedStatus.shortLabel }}
            </v-btn>
            
            <!-- Create version from commit button -->
            <v-tooltip text="Create version from this commit" location="bottom">
                <template v-slot:activator="{ props }">
                    <v-btn
                        v-bind="props"
                        :disabled="disableVersionManagement"
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
        </div>

        <!-- Controls when viewing a version -->
        <div v-else-if="$store.versionControlsContext === 'viewing_version'" class="d-flex align-center">
            <!-- Status indicator for version -->
            <v-btn 
                density="compact"
                variant="tonal" 
                :color="versionReleasedStatus.color" 
                class="px-2 py-1 hover-scale rounded-l-full">
                {{ versionReleasedStatus.shortLabel }}
            </v-btn>
            
            <!-- Version info -->
            <v-chip 
                color="primary" 
                variant="outlined" 
                size="small"
                class="mx-2">
                {{ currentVersion }}
            </v-chip>
        </div>

        <!-- Return to Live button when viewing a commit -->
            <div v-if="currentCommitId" class="d-flex align-center mx-2" @click.stop>
                
                <v-btn
                    color="warning"
                    variant="tonal"
                    density="compact"
                    class="text-none"
                    @click="returnToLive"
                >
                                    <v-icon size="small" class="mr-1">mdi-home</v-icon>
                To Live
                <v-icon size="small" class="animate-ping">mdi-circle-medium</v-icon>
                </v-btn>
            </div>

            <!-- Version Switcher -->
            <div class="animate-fade-in-up flex-grow-1 d-flex align-center" @click.stop>
                    <v-menu :close-on-content-click="false">
                        <template v-slot:activator="{ props: menu }">
                            <v-tooltip text="switch version" location="bottom">
                                <template v-slot:activator="{ props: tooltip }">
                                    <v-btn 
                                        variant="tonal" 
                                        density="compact" 
                                        class="text-none font-weight-bold rounded-r-full px-2 py- 1" 
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

                            <v-card-title class="text-sm opacity-70">
                                View Commit
                            </v-card-title>


                            <v-list density="compact">
                                <v-list-item
                                    density="compact"
                                    @click="selectVersion({type: 'live', displayName: 'live', value: 'live'})"
                                >
                                    <v-icon size="small" class="mr-1">mdi-home</v-icon>
                                    To Live
                                </v-list-item>
                                <v-list-item 
                                    density="compact"
                                    v-for="version in sortedCommits" :key="version.id"
                                    @click="selectVersion(version)"
                                    >

                                    {{ version.versionNumber? version.versionNumber : `${version.message || 'Untitled'} (${version.id.substring(0, 8)})`  }}
                                    <!-- Version icon if it has a version number -->
                                    <template v-slot:append>
                                        <v-icon 
                                            v-if="version.versionNumber" 
                                            color="primary" 
                                            size="small"
                                            class="mr-1"
                                        >
                                            mdi-tag
                                        </v-icon>

                                        <!-- Draft/Released status icon -->
                                        <v-icon 
                                            v-if="version.type !== 'live' && !version.released" 
                                            color="warning" 
                                            size="small"
                                        >
                                            mdi-pencil
                                        </v-icon>
                                    </template>
                                </v-list-item>
                            </v-list>

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
import { storeKey } from "vuex";
// Consolidated status definitions for VersionModal (Option B refactor)
const VERSION_STATUS_MAP = {
    commit_no_version: { status: false, label: 'No Version', shortLabel: 'C', color: 'secondary' },
    commit_staged:     { status: false, label: 'Staged',     shortLabel: 'S', color: 'warning'   },
    commit_released:   { status: true,  label: 'Released',   shortLabel: 'R', color: 'success'   },
    live_has_released: { status: true,  label: 'Has Released', shortLabel: 'P', color: 'success' },
    live_draft:        { status: false, label: 'Draft',      shortLabel: 'D', color: 'warning'   },
};

export default {
    name: 'VersionModal',
    props: {
        disabled: {
            type: Boolean,
            default: false
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
        // new computed values replacing removed props
        currentVersion() {
            return this.$store?.selected?.currentVersion || 'live';
        },
        currentCommitId() {
            return this.$route?.query?.c || null;
        },
        uncommittedChanges() {
            return this.$store.uncommittedChanges;
        },
        sortedCommits() {
            const commits = this.$store.selected.commits || [];
            
            // Sort commits by date (newest first)
            const sortedByDate = [...commits].sort((a, b) => {
                const dateA = new Date(a.timestamp || a.createdAt || 0);
                const dateB = new Date(b.timestamp || b.createdAt || 0);
                return dateB - dateA; // Newest first
            });
           
            // Combine with live option and sort versions first
            return sortedByDate 
        }, 
        disableVersionManagement() {
            return !this.$store.isUserLoggedIn
        },
        
        // Use centralized store getters
        versionReleasedStatus() {
            const statusKey = this.$store.versionStatus;
            return VERSION_STATUS_MAP[statusKey];
        },
        
        showCommitUI() {
            // Show commit UI only when on live document and there are uncommitted changes
            return this.$store.isUserLoggedIn && 
                                       this.$store.versionControlsContext === 'live_document' &&
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
        
        selectVersion(version) {
            if (version.type === 'live') {
                this.$router.replace({'query': null});
            } else if (version.versionNumber) {
                // For versions, find the commit that has this version number and navigate to it
                const commits = this.$store.selected.commits || [];
                
                const associatedCommit = commits.find(commit => 
                    commit.versionNumber === version.versionNumber
                );
                
                if (associatedCommit) {
                    // Navigate to the commit that has this version number
                    this.$router.push({ query: { c: associatedCommit.id }});
                } else {
                    // Fallback to version navigation if no associated commit found
                    this.$router.push({ query: { v: version.versionNumber }});
                }
            } else {
                // Navigate to commit
                this.$router.push({ query: { c: version.id }});
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
            if (this.currentCommitId && this.$store.currentCommitData && this.$store.currentCommitData.versionNumber) {
                try {
                    await this.$store.toggleCommitVersionRelease({
                        commitId: this.$store.currentCommitData.id,
                        released: !this.$store.currentCommitData.released
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
            if (this.currentCommitId && this.$store.currentCommitData && this.$store.currentCommitData.versionNumber) {
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

        async commitVersionTag() {
            if (!this.newVersionTag || !this.selectedCommitId) {
                return;
            }
            
            try {
                await this.$store.createVersion(this.newVersionTag, {
                    fromCommitId: this.selectedCommitId,
                    released: this.newVersionRelease
                });
                
                this.cancelCommitTagging();
                this.closeCreateVersionDialog();
            } catch (error) {
                console.error('Error creating version from commit:', error);
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
