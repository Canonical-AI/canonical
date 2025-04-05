<script>
import { useNodeViewContext } from '@prosemirror-adapter/vue'
import {  TextSelection} from '@milkdown/kit/prose/state'
import { ref } from 'vue'

export default {
    setup(){
        const { node, getPos,setAttrs, view, prevState, selected } = useNodeViewContext()
        const src = ref(node.value.attrs.src)
        const identity = ref(node.value.attrs.identity)
        const checked = ref(node.value.attrs.checked)

        return {node, src, view, prevState, identity, checked, setAttrs, getPos, selected}
    },
    data() {
        return {
            newTask: true,
            task: '',
            loading: false,
            priority: null,
            previousFocus: null
        }
    },
    name: "Task",
    async mounted(){
        this.task = this.src

        if (this.task.length === 0 ) {
            this.newTask = true
            this.task = ' '
            this.focusTask()
            return
        } 

        this.newTask = false

        document.addEventListener('keydown', this.handleKeyDown);
        
    },
    computed: {
        taskInput(){
            return this.task
        }
    },
    watch: {
        '$store.state.tasks': {
            handler(){
                if (this.$store.state.tasks.length === 0) return 

                requestAnimationFrame(() => {
                    this.updateTaskFromRemote()
                })
            },
            deep: true,
            immediate: true
        },
        view(){
            console.log(view.value)
        },
        prevState: {
            handler(){
                console.log(prevState.value)
            },
            deep: true,
        }
    },
    methods: {
        submitTask(event){

            event.preventDefault()
            console.log('submitTask')
            
            this.newTask = false
            this.$refs.taskInput.blur()
            this.task = this.$refs.taskInput.innerText
            if (this.task === this.src ) {return}
            this.src = this.task
            this.setAttrs({src: this.src})
            
            if (this.previousFocus) {
                this.previousFocus.focus()
                this.previousFocus = null
            }

        },
        toggleChecked(){
            const currentChecked = this.checked === 'true'
            this.setAttrs({
                src: this.src,
                checked: (!currentChecked).toString()
            })
        },

        updateTaskFromRemote(){
            const existingTask = this.$store.state.tasks
                    .filter(task => task.docID === this.$store.state.selected.id)[0]
                    ?.tasks.find(task => task.identity === this.identity)

            if (existingTask && (existingTask.src !== this.src || existingTask.checked.toString() !== this.checked)) {
                this.priority = existingTask.priority || null
                this.checked = existingTask.checked.toString()
                this.src = existingTask.src
                this.task = existingTask.src
                this.setAttrs({
                    src: existingTask.src,
                    checked: existingTask.checked.toString(),
                    identity: existingTask.identity
                })
            }
        },
        focusTask() {
            this.previousFocus = document.activeElement
            this.newTask = true

            //set selection to just after the //TODO: this makes sure that backspace handles correctly
            const { dispatch, state } = this.view;
            const start = state.selection.from
            dispatch(state.tr
                .setSelection(TextSelection.create(state.tr.doc, this.getPos() + 2))
            )

            document.activeElement.blur(); 

            this.$nextTick(() => {
                this.$refs.taskInput.focus()
            })
        },

    }
}
</script>

<template>
    <v-chip label color="purple" class="max-w-full w-fit border border-background pl-0 m-0" density="compact">
        <div class="text-high-emphasis text-base">
            <v-checkbox 
            :model-value="checked === 'true'" 
            hide-details 
            @change="toggleChecked"/> 
        </div>
        <strong @click="focusTask()" >//TODO:</strong> &nbsp; 

        <div v-if="newTask === true" 
            class="flex-1 min-w-0 text-high-emphasis text-base grow bg-transparent border-none outline-none"
            contenteditable="true"
            ref="taskInput"
            @blur="submitTask"
            @keydown.enter="submitTask" 
            >
            {{ task }}
        </div>
        <div v-else
            @click="focusTask()"
            class="text-high-emphasis text-base inline-block w-full flex-1 min-w-1"
            contenteditable="false"
            > 
            {{ task || '  ' }}
        </div>

    </v-chip>
</template>

<style scoped>

</style>