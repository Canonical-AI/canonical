import { $mark, $inputRule } from '@milkdown/utils';
import { InputRule } from 'prosemirror-inputrules';

export const commentMark = $mark('comment', (ctx) => {
  return {
    inclusive: false,
    attrs: { 
      id: { default: null }
    },
    parseDOM: [
      {
        tag: 'span[data-comment-id]',
        getAttrs: (dom) => ({
          id: dom.getAttribute('data-comment-id'),
        }),
      },
    ],
    toDOM: (mark) => [
      'span',
      {
        class: 'comment-mark',
        'data-comment-id': mark.attrs.id,
      },
      0,
    ],
    parseMarkdown: {
      match: (node) => {
        // Match text nodes that contain the comment pattern
        return node.type === 'textDirective' && node.name === 'comment';
      },
      runner: (state, node, markType) => {
        const id = node.attributes?.id || '';
        state.openMark(markType, {id});
        state.next(node.children[0]); // recurse into text inside
        state.closeMark(markType);
      },
    },
    toMarkdown: {
      match: (mark) => mark.type.name === 'comment',
      runner: (state, mark, node) => {
        state.withMark(mark, 'textDirective', undefined, { 
          name: 'comment', 
          attributes: { 
            id: mark.attrs.id 
          } });
      },
    },
  };
});

// Input rule for typing "=={123} foo==" to create comments
export const commentInputRule = $inputRule((ctx) => {
  return new InputRule(/==\{([\w-]+)}\s([^=]+)==$/, (state, match, start, end) => {
    const [, id] = match;
    const text = match[2];
    const markType = state.schema.marks.comment;
    if (!markType) return null;
    
    return state.tr
      .insertText(text, start, end)
      .addMark(start, start + text.length, markType.create({ id }));
  });
});

// Add CSS styles for comment marks
const style = document.createElement('style');
style.textContent = `
  .comment-mark {
    background-color: rgba(255, 255, 0, 0.25) !important;
    border: 1px solid rgba(255, 255, 0, 0.75) !important;
    border-radius: 2px !important;
    padding: 1px 2px !important;
    cursor: pointer !important;
    transition: background-color 0.2s ease !important;
  }
  
  .comment-mark:hover {
    background-color: rgba(255, 255, 0, 0.35) !important;
  }
`;
document.head.appendChild(style);