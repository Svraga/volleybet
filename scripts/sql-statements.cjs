// Split fixed repository SQL, preserving quoted strings and PL/pgSQL dollar blocks.
module.exports = function splitSql(source) {
  const sql = source.replace(/^\s*--.*$/gm, '');
  const statements = []; let start = 0, quote = null, dollar = null;
  for (let i = 0; i < sql.length; i++) {
    if (dollar) { if (sql.startsWith(dollar, i)) { i += dollar.length - 1; dollar = null; } continue; }
    if (quote) { if (sql[i] === quote) { if (sql[i + 1] === quote) i++; else quote = null; } continue; }
    if (sql[i] === "'" || sql[i] === '"') { quote = sql[i]; continue; }
    const tag = sql[i] === '$' && /^\$[a-zA-Z0-9_]*\$/.exec(sql.slice(i));
    if (tag) { dollar = tag[0]; i += dollar.length - 1; continue; }
    if (sql[i] === ';') { const part = sql.slice(start, i).trim(); if (part) statements.push(part); start = i + 1; }
  }
  const last = sql.slice(start).trim(); if (last) statements.push(last);
  if (quote || dollar) throw new Error('Unclosed SQL quote');
  return statements;
};
