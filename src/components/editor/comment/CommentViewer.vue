<template>
    <Transition v-bind="$fadeTransition">
        <div v-if="show" ref="viewerRef" class="comment-viewer absolute" :style="viewerStyle">
            <v-card class="pa-2" elevation="2">
                <div class="d-flex justify-space-between align-center mb-2">
                    <span class="text-subtitle-2">Comment</span>
                    <v-btn
                        icon="mdi-close"
                        size="small"
                        variant="text"
                        @click="closeViewer"
                    ></v-btn>
                </div>
                <div class="comment-content mb-2">{{ commentData.comment }}</div>
                <div class="text-caption text-medium-emphasis mb-2" v-if="commentData.editorID?.selectedText">
                    "{{ commentData.editorID.selectedText }}"
                </div>
                <div class="d-flex justify-end">
                    <v-btn
                        size="small"
                        variant="text"
                        color="success"
                        @click="resolveComment"
                        class="text-none mr-2"
                    >
                        Resolve
                    </v-btn>
                    <v-btn
                        size="small"
                        variant="text"
                        color="error"
                        @click="deleteComment"
                        class="text-none"
                    >
                        Delete
                    </v-btn>
                </div>
            </v-card>
        </div>
    </Transition>
</template>

<script>
import { usePluginViewContext } from '@prosemirror-adapter/vue';
import { commentFunctions, getComment } from './index';
import { ref } from 'vue';
import { fadeTransition } from "../../../utils/transitions";

export default {
    setup() {
        const { view } = usePluginViewContext();
        const viewerRef = ref(null);
        
        return {
            view,
            viewerRef,
            $fadeTransition: fadeTransition,
        };
    },
    data() {
        return {
            show: false,
            commentData: null,
            commentId: null,
            viewerStyle: {},
        };
    },
    methods: {
        showComment(id, commentData, pos) {
            this.commentData = commentData;
            this.commentId = id;
            
            // Position the viewer near the comment
            const coords = this.view.coordsAtPos(pos);
            if (this.viewerRef) {
                this.viewerStyle = {
                    left: `${coords.left}px`,
                    top: `${coords.bottom + 10}px`,
                };
            }
            
            this.show = true;
        },

        closeViewer() {
            this.show = false;
            this.commentData = null;
            this.commentId = null;
        },

        resolveComment() {
            if (this.commentId && this.commentData) {
                // Update in database to mark as resolved
                this.$store.commit('updateComment', { 
                    id: this.commentId, 
                    updatedComment: { ...this.commentData, resolved: true } 
                });
                
                // Remove from editor display
                commentFunctions.removeComment(this.view, this.commentId);
                this.closeViewer();
            }
        },

        deleteComment() {
            if (this.commentId && this.commentData) {
                // Delete from database
                this.$store.commit('deleteComment', this.commentId);
                
                // Remove from editor display
                commentFunctions.removeComment(this.view, this.commentId);
                this.closeViewer();
            }
        },

        handleCommentClick(event) {
            const { id, commentData, pos } = event.detail;
            this.showComment(id, commentData, pos);
        },
    },
    mounted() {
        // Wait for view to be available and add event listeners
        const addEventListeners = () => {
            if (this.view && this.view.dom) {
                this.view.dom.addEventListener('comment-click', this.handleCommentClick);
            } else {
                // Retry after a short delay if view is not ready
                setTimeout(addEventListeners, 100);
            }
        };
        addEventListeners();
    },
    beforeUnmount() {
        if (this.view && this.view.dom) {
            this.view.dom.removeEventListener('comment-click', this.handleCommentClick);
        }
    },
};
</script>

<style scoped>
.comment-viewer {
    z-index: 100;
    pointer-events: auto;
}

.comment-viewer .v-card {
    min-width: 200px;
    max-width: 300px;
}

.comment-content {
    white-space: pre-wrap;
    word-break: break-word;
}
</style> 