'use strict';
module.exports = ast => {
  const stack = [[ast, 0]];
  const seen = new Set();
  let visited = 0;
  while (stack.length) {
    if (++visited > 65536) throw new SyntaxError('Brace AST complexity limit exceeded');
    const [node, depth] = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (depth >= 64 || seen.has(node) || seen.size >= 65536) throw new SyntaxError('Brace AST complexity limit exceeded');
    seen.add(node);
    if (Array.isArray(node.nodes)) {
      if (stack.length + node.nodes.length > 65536) throw new SyntaxError('Brace AST complexity limit exceeded');
      for (const child of node.nodes) stack.push([child, depth + 1]);
    }
  }
};
