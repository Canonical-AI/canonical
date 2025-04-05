import { $inputRule, $node, $remark, $view , $command} from '@milkdown/kit/utils';
import directive from 'remark-directive';
import { expectDomTypeError } from '@milkdown/exception'
import { useNodeViewFactory} from '@prosemirror-adapter/vue';
import ReferenceLink from './ReferenceLink.vue';


// 1. Remark Directive to Parse :canonical-ref{src="someString"}
export const remarkDirective = $remark('remarkDirective', () => directive);


// 2. Define the Milkdown Node for custVue
export const referenceLinkNode = $node('canonical-ref', () => ({
    group: 'inline',
    inline: true,
    atom: true,
    marks: '',
    isolating: true,
    selectable: false,
    draggable: false,
    attrs: {
        src: { default: '' },  // Attribute for src
    },
    parseDOM: [{
        tag: 'div[data-type="canonical-ref"]',  // Use span to render inline content
        getAttrs: (dom) => {
            if (!(dom instanceof HTMLElement))
                throw expectDomTypeError(dom)

            return { src: dom.dataset.src }
        },
    }],
    toDOM: node => 
        ['div', {data: {type: 'canonical-ref', src: node.attrs.src}}],
    parseMarkdown: {
        match: node => node.type === 'textDirective' && node.name === 'canonical-ref',
        runner: (state, node, type) => {
            state.addNode(type, { src: node.attributes.src });
        },
    },
    toMarkdown: {
        match: node => node.type.name === 'canonical-ref',
        runner: (state, node) => {
            state.addNode('textDirective', undefined, undefined, {
                name: 'canonical-ref',
                attributes: { src: node.attrs.src },
            });
        },
    }
}));

function insertReferenceLink() {
    return () => {
      return (state, dispatch) => {
        if (dispatch) {
          showPicker().then((fileId) => {
            dispatch(state.tr.replaceSelectionWith(referenceLinkNode.type(ctx).create({ src: fileId })))
          })
        }
        return true
      }
    }
  }


export const useReferenceLink = () => {
    const nodeViewFactory = useNodeViewFactory()

    const view = $view(referenceLinkNode,() => nodeViewFactory({
        component: ReferenceLink
    }))

    return {
        plugins: [
            referenceLinkNode,
            insertReferenceLink,
            view
        ].flat(),
    }
}