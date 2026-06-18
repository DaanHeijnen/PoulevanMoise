const { json, withDb, parseBody, requireAdmin, ensureRankingsTable } = require('./_shared');

function normalizeRankingEntries(value) {
  const rawEntries = Array.isArray(value)
    ? value
    : String(value || '').split(/\r?\n/);

  return rawEntries.map((entry, index) => {
    if (entry && typeof entry === 'object') {
      const position = Number(entry.position || entry.rank || index + 1);
      const name = String(entry.name || '').trim();
      return { position, name };
    }

    const line = String(entry || '').trim();
    const match = line.match(/^\s*(\d+)\s*[.)-]?\s+(.+)$/);
    if (match) {
      return {
        position: Number(match[1]),
        name: match[2].trim()
      };
    }

    return {
      position: index + 1,
      name: line.replace(/^\s*(?:\d+[.)-]?\s*|[-*•]\s*)/, '').trim()
    };
  }).filter((entry) => entry.name);
}

function sortRankingEntries(entries = []) {
  return entries
    .map((entry, index) => ({ ...entry, originalIndex: index }))
    .sort((a, b) => a.position - b.position || a.originalIndex - b.originalIndex)
    .map(({ originalIndex, ...entry }) => entry);
}

function validateRankingEntries(entries) {
  if (!entries.length) return 'Vul minimaal 1 naam in.';

  const invalidEntry = entries.find((entry) => (
    !Number.isInteger(entry.position) ||
    entry.position < 1 ||
    !entry.name
  ));

  if (invalidEntry) {
    return 'Vul iedere regel in als rankingnummer plus naam. Ieder positief nummer mag gebruikt worden en gedeelde plekken mogen vaker voorkomen.';
  }

  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Methode niet toegestaan.' });
  try {
    requireAdmin(event);
    const body = parseBody(event);
    const source = body.entries || body.names || body.rankingText;
    const entries = sortRankingEntries(normalizeRankingEntries(source));
    const validationError = validateRankingEntries(entries);

    if (validationError) {
      return json(422, { error: validationError });
    }

    const ranking = await withDb(async (client) => {
      await ensureRankingsTable(client);
      const result = await client.query(
        `INSERT INTO rankings (id, names, updated_at)
         VALUES (1, $1::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET names = EXCLUDED.names, updated_at = NOW()
         RETURNING names, updated_at`,
        [JSON.stringify(entries)]
      );
      return {
        entries: result.rows[0].names,
        names: result.rows[0].names.map((entry) => entry.name),
        updatedAt: result.rows[0].updated_at
      };
    });

    return json(200, { message: 'Ranking is bijgewerkt.', ranking });
  } catch (error) {
    return json(500, { error: error.message });
  }
};
