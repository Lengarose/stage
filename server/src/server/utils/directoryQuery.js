function directoryOrder(orderBy, columns, fallback, alias = '') {
  const raw = String(orderBy || fallback);
  const descending = raw.startsWith('-');
  const column = descending ? raw.slice(1) : raw;
  if (!columns.includes(column)) {
    const error = new Error('Unsupported directory order_by');
    error.status = 400;
    throw error;
  }
  const prefix = alias ? `${alias}.` : '';
  return `${prefix}\`${column}\` ${descending ? 'DESC' : 'ASC'}, ${prefix}id ASC`;
}

function containsPattern(search) {
  return `%${String(search).trim().toLowerCase().replace(/[!%_]/g, character => `!${character}`)}%`;
}

module.exports = { directoryOrder, containsPattern };
