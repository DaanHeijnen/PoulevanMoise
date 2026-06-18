const { json, withDb, ensureRankingsTable } = require('./_shared');

function sortRankingEntries(entries = []) {
  return entries
    .map((entry, index) => ({ ...entry, originalIndex: index }))
    .sort((a, b) => a.position - b.position || a.originalIndex - b.originalIndex)
    .map(({ originalIndex, ...entry }) => entry);
}

function normalizeRankingEntries(value) {
  if (!Array.isArray(value)) return [];

  return sortRankingEntries(value.map((entry, index) => {
    if (entry && typeof entry === 'object') {
      return {
        position: Number(entry.position || entry.rank || index + 1),
        name: String(entry.name || '').trim()
      };
    }

    return {
      position: index + 1,
      name: String(entry || '').trim()
    };
  }).filter((entry) => Number.isInteger(entry.position) && entry.position > 0 && entry.name));
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Methode niet toegestaan.' });
  try {
    const ranking = await withDb(async (client) => {
      await ensureRankingsTable(client);
      const result = await client.query('SELECT names, updated_at FROM rankings WHERE id = 1');
      if (!result.rows.length) return { entries: [], names: [], updatedAt: null };
      const entries = normalizeRankingEntries(result.rows[0].names);
      return {
        entries,
        names: entries.map((entry) => entry.name),
        updatedAt: result.rows[0].updated_at
      };
    });
    return json(200, { ranking });
  } catch (error) {
    return json(500, { error: error.message });
  }
};
