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
                <div class="comment-content mb-2">{{ comment }}</div>
                <div class="d-flex justify-end">
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
import { removeComment, getComment } from './index';
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
            comment: '',
            commentId: null,
            viewerStyle: {},
        };
    },
    methods: {
        showComment(id, commentText, pos) {
            this.comment = commentText;
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
            this.comment = '';
            this.commentId = null;
        },

        deleteComment() {
            if (this.commentId) {
                removeComment(this.view, this.commentId);
                this.closeViewer();
            }
        },

        handleCommentClick(event) {
            console.log('Comment clicked:', event.detail); // Debug log
            const { id, comment: commentText, pos } = event.detail;
            this.showComment(id, commentText, pos);
        },
    },
    mounted() {
        // Wait for view to be available and add event listeners
        const addEventListeners = () => {
            if (this.view && this.view.dom) {
                console.log('Adding comment-click listener'); // Debug log
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