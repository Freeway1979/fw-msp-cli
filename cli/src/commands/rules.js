const { getClient, resolveBoxGid } = require('../api/client');

/**
 * Fetch all rules for a box.
 */
async function fetchAll(client, gid, apiParams = {}) {
  const { data } = await client.get('/rules', { params: { gid, ...apiParams } });
  return Array.isArray(data) ? data : (data.results || []);
}

/**
 * Client-side filtering applied after server fetch.
 */
function applyFilters(rules, options) {
  let results = rules;

  if (options.action) {
    const a = options.action.toLowerCase();
    results = results.filter(r => r.action?.toLowerCase() === a);
  }

  if (options.status) {
    const s = options.status.toLowerCase();
    results = results.filter(r => r.status?.toLowerCase() === s);
  }

  if (options.targetType) {
    const t = options.targetType.toLowerCase();
    results = results.filter(r => r.target?.type?.toLowerCase() === t);
  }

  if (options.scopeType) {
    const s = options.scopeType.toLowerCase();
    results = results.filter(r => r.scope?.type?.toLowerCase() === s);
  }

  if (options.hits) {
    results = results.filter(r => (r.hit?.count || 0) > 0);
  }

  if (options.query) {
    const q = options.query.toLowerCase();
    results = results.filter(r =>
      r.target?.value?.toLowerCase().includes(q) ||
      r.notes?.toLowerCase().includes(q) ||
      r.action?.toLowerCase().includes(q)
    );
  }

  return results;
}

const Rules = {
  list: async (options) => {
    const gid = await resolveBoxGid(options.box, options);
    const client = getClient(options);

    const apiParams = {};
    if (options.params) {
      try {
        Object.assign(apiParams, JSON.parse(options.params));
      } catch {
        console.error(JSON.stringify({ error: 'Invalid --params JSON' }));
        process.exit(1);
      }
    }

    try {
      const all = await fetchAll(client, gid, apiParams);
      const filtered = applyFilters(all, options);
      console.log(JSON.stringify({ results: filtered, count: filtered.length }, null, 2));
    } catch (err) {
      console.error(JSON.stringify({ error: 'Fetch failed', details: err.response?.data || err.message }));
    }
  },

  get: async (id, options) => {
    const gid = await resolveBoxGid(options.box, options);
    const client = getClient(options);

    try {
      const all = await fetchAll(client, gid);
      const numId = String(id);

      // Match by numeric rule ID (last segment of composite id "gid:num")
      const rule =
        all.find(r => r.id === `${gid}:${numId}`) ||
        all.find(r => r.id?.split(':').pop() === numId);

      if (!rule) {
        console.error(JSON.stringify({ error: `Rule "${id}" not found.`, hint: 'Use fw rules list to see all rule IDs.' }));
        process.exit(1);
      }

      console.log(JSON.stringify(rule, null, 2));
    } catch (err) {
      console.error(JSON.stringify({ error: 'Fetch failed', details: err.response?.data || err.message }));
    }
  },

  pause: async (id, options) => {
    console.error(JSON.stringify({
      error: 'Not supported',
      details: 'The Firewalla MSP REST API does not expose a pause endpoint for rules.',
      hint: 'Use the Firewalla app or web dashboard to pause rule ' + id + '.',
    }));
    process.exit(1);
  },

  resume: async (id, options) => {
    console.error(JSON.stringify({
      error: 'Not supported',
      details: 'The Firewalla MSP REST API does not expose a resume endpoint for rules.',
      hint: 'Use the Firewalla app or web dashboard to resume rule ' + id + '.',
    }));
    process.exit(1);
  },
};

module.exports = Rules;
