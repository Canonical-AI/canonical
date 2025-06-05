<template>
    <Transition v-bind="$fadeTransition">
        <div ref="tooltipRef" class="comment-tooltip absolute" v-show="show" @mousedown.stop @click.stop>
            <v-card class="pa-2" elevation="2">
                <div v-if="!isAddingComment">
                    <v-btn
                        size="small"
                        variant="text"
                        color="primary"
                        @click="startAddingComment"
                        class="text-none"
                    >
                        Add Comment
                    </v-btn>
                </div>
                <div v-else @mousedown.stop @click.stop>
                    <v-textarea
                        v-model="commentText"
                        placeholder="Enter your comment..."
                        auto-grow
                        rows="2"
                        hide-details
                        density="compact"
                        variant="outlined"
                        class="mb-2"
                        @keydown.esc="cancelComment"
                        @mousedown.stop
                        @click.stop
                        @focus.stop
                        ref="commentInput"
                    ></v-textarea>
                    <div class="d-flex justify-end">
                        <v-btn
                            size="small"
                            variant="text"
                            color="error"
                            @click="cancelComment"
                            class="text-none mr-2"
                        >
                            Cancel
                        </v-btn>
                        <v-btn
                            size="small"
                            variant="text"
                            color="primary"
                            @click="submitComment"
                            class="text-none"
                            :disabled="!commentText.trim()"
                        >
                            Submit
                        </v-btn>
                    </div>
                </div>
            </v-card>
        </div>
    </Transition>
</template>

<script>
import { usePluginViewContext } from '@prosemirror-adapter/vue';
import { SlashProvider } from "@milkdown/kit/plugin/slash";
import { addComment } from './index';
import { ref, nextTick } from 'vue';
import { fadeTransition } from "../../../utils/transitions";

export default {
    setup() {
        const { view, prevState } = usePluginViewContext();
        const tooltipRef = ref(null);
        const tooltipProvider = new SlashProvider({ content: tooltipRef });
        
        return {
            view, 
            prevState, 
            tooltipRef, 
            tooltipProvider,
            $fadeTransition: fadeTransition,
        };
    },
    data() {
        return {
            show: false,
            isAddingComment: false,
            commentText: '',
            currentSelection: null,
        };
    },
    methods: {
        startAddingComment() {
            this.isAddingComment = true;
            this.commentText = '';
            nextTick(() => {
                // Wait a bit more to ensure the textarea is rendered
                setTimeout(() => {
                    if (this.$refs.commentInput) {
                        this.$refs.commentInput.focus();
                    }
                }, 50);
            });
        },

        cancelComment() {
            this.isAddingComment = false;
            this.commentText = '';
            this.show = false;
        },

        submitComment() {
            if (!this.commentText.trim() || !this.currentSelection) return;

            const { from, to } = this.currentSelection;
            addComment(this.view, from, to, this.commentText.trim());
            
            // Reset state
            this.isAddingComment = false;
            this.commentText = '';
            this.show = false;
        },

        checkSelection() {
            if (!this.view) return;
            
            const { from, to } = this.view.state.selection;
            
            // Only show for text selections (not empty selections)
            if (from !== to && !this.isAddingComment) {
                this.currentSelection = { from, to };
                this.show = true;
                this.tooltipProvider.update(this.view, this.prevState);
            } else if (from === to && !this.isAddingComment) {
                this.show = false;
                this.currentSelection = null;
            }
        }
    },
    mounted() {
        this.tooltipProvider = new SlashProvider({
            content: this.tooltipRef,
            shouldShow: () => {
                // Always return true, we handle showing logic in checkSelection
                return this.show;
            }
        });
        this.tooltipProvider.update(this.view, this.prevState);
    },
    watch: {
        view: {
            handler() {
                if (this.view) {
                    this.checkSelection();
                    this.tooltipProvider?.update(this.view, this.prevState);
                }
            },
            immediate: true,
        },
        prevState: {
            handler() {
                if (this.view) {
                    this.checkSelection();
                    this.tooltipProvider?.update(this.view, this.prevState);
                }
            },
            immediate: true,
        },
    },
    beforeUnmount() {
        this.tooltipProvider?.destroy();
    },
};
</script>

<style scoped>
.comment-tooltip {
    z-index: 1000;
    pointer-events: auto;
}

.comment-tooltip .v-card {
    min-width: 200px;
    max-width: 300px;
    pointer-events: auto;
}

/* Ensure all interactive elements in the tooltip capture events */
.comment-tooltip * {
    pointer-events: auto;
}
</style> 