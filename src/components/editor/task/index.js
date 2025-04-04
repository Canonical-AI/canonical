import { $inputRule, $node, $remark, $view , $command} from '@milkdown/kit/utils';
import { InputRule } from '@milkdown/prose/inputrules'
import { expectDomTypeError } from '@milkdown/exception'
import { useNodeViewFactory} from '@prosemirror-adapter/vue';
import { TextSelection } from '@milkdown/kit/prose/state';
import Task from './Task.vue';
import { customAlphabet } from 'nanoid'

const nanoid = customAlphabet('abcdefg', 8)


// 2. Define the Milkdown Node for custVue
export const taskNode = $node('canonical-task', () => ({
    group: 'inline',
    inline: true,
    atom: true,
    marks: '',
    isolating: true,
    selectable: false,
    draggable: false,
    defining: true,
    attrs: {
        src: { default: '' },
        identity: { default: nanoid() },
        checked: { default: 'false' },
    },
    parseDOM: [{
        tag: 'div[data-type="canonical-task"]',
        getAttrs: (dom) => {
            if (!(dom instanceof HTMLElement))
                throw expectDomTypeError(dom)

            return { 
                src: dom.dataset.src || '', 
                identity: dom.dataset.identity || nanoid(), 
                checked: dom.dataset.checked || 'false' 
            }
        },
    }],
    toDOM: node => 
        ['div', {data: {
            type: 'canonical-task', 
            src: node.attrs.src, 
            identity: node.attrs.identity, 
            checked: node.attrs.checked
        }}],
    parseMarkdown: {
        match: node => node.type === 'textDirective' && node.name === 'canonical-task',
        runner: (state, node, type) => {
            state.addNode(type, { 
                src: node.attributes?.src || '', 
                identity: node.attributes?.identity || nanoid(), 
                checked: node.attributes?.checked || 'false' 
            });
        },
    },
    toMarkdown: {
        match: node => node.type.name === 'canonical-task',
        runner: (state, node) => {
            state.addNode('textDirective', undefined, undefined, {
                name: 'canonical-task',
                attributes: { 
                    src: node.attrs.src, 
                    identity: node.attrs.identity, 
                    checked: node.attrs.checked 
                },
            });
        },
    }
}));

function insertTask() {
    return () => {
      return (state, dispatch) => {
        if (dispatch) {
          showPicker().then((fileId) => {
            dispatch(state.tr.replaceSelectionWith(taskNode.type(ctx).create({ src: fileId, identity: getId() })))
          })
        }
        return true
      }
    }
  }

  export const insertTaskInputRule = $inputRule(ctx =>
    new InputRule(/\/\/todo:/i, (state, _match, start) => {
        const nodeType = taskNode.type(ctx)
        const $start = state.doc.resolve(start)
        const newTaskNode = nodeType.create({ 
            src: '', 
            identity: nanoid(), 
            checked: 'false' 
        })

        // Create the transaction
        let tr = state.tr
                .setMeta('task')
                .delete(start, start + 6)
                .replaceRangeWith(start, start, newTaskNode)
                .insertText(' ')
 
        // Move selection to after the task
        const newPos = start + 1;
        tr = tr.setSelection(TextSelection.create(tr.doc, newPos));
 
        return tr.scrollIntoView()
    }))

export const useTask = () => {
    const nodeViewFactory = useNodeViewFactory()

    const view = $view(taskNode,() => nodeViewFactory({
        component: Task
    }))

    return {
        plugins: [
            taskNode,
            insertTaskInputRule,
            view
        ].flat(),
    }
}