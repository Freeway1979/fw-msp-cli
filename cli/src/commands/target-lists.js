const { getClient } = require('../api/client');

const TargetLists = {
  list: async (options) => {
    const client = getClient(options);

    try {
      const { data } = await client.get('/target-lists');
      let results = Array.isArray(data) ? data : (data.results || []);

      if (options.owner) {
        const o = options.owner.toLowerCase();
        results = results.filter(tl => tl.owner?.toLowerCase() === o);
      }

      if (options.query) {
        const q = options.query.toLowerCase();
        results = results.filter(tl =>
          tl.name?.toLowerCase().includes(q) ||
          tl.id?.toLowerCase().includes(q) ||
          tl.notes?.toLowerCase().includes(q)
        );
      }

      console.log(JSON.stringify({ results, count: results.length }, null, 2));
    } catch (err) {
      console.error(JSON.stringify({ error: 'Fetch failed', details: err.response?.data || err.message }));
    }
  },

  get: async (id, options) => {
    const client = getClient(options);

    try {
      const { data: all } = await client.get('/target-lists');
      const list = Array.isArray(all) ? all : (all.results || []);

      const tl =
        list.find(t => t.id === id) ||
        list.find(t => t.name?.toLowerCase() === id.toLowerCase()) ||
        list.find(t => t.name?.toLowerCase().includes(id.toLowerCase()));

      if (!tl) {
        console.error(JSON.stringify({ error: `Target list "${id}" not found.`, hint: 'Use fw target-lists list to see all target lists.' }));
        process.exit(1);
      }

      // Fetch full detail (includes targets array)
      const { data } = await client.get(`/target-lists/${tl.id}`);
      console.log(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(JSON.stringify({ error: 'Fetch failed', details: err.response?.data || err.message }));
    }
  },

  create: async (options) => {
    const client = getClient(options);

    const body = { name: options.name, type: 'list' };
    if (options.targets) {
      try {
        body.targets = JSON.parse(options.targets);
      } catch {
        // treat as comma-separated
        body.targets = options.targets.split(',').map(t => t.trim()).filter(Boolean);
      }
    }
    if (options.blockMode) body.blockMode = options.blockMode;
    if (options.notes) body.notes = options.notes;

    try {
      const { data } = await client.post('/target-lists', body);
      console.log(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(JSON.stringify({ error: 'Create failed', details: err.response?.data || err.message }));
    }
  },

  update: async (id, options) => {
    const client = getClient(options);

    try {
      const { data: all } = await client.get('/target-lists');
      const list = Array.isArray(all) ? all : (all.results || []);

      const tl =
        list.find(t => t.id === id) ||
        list.find(t => t.name?.toLowerCase() === id.toLowerCase()) ||
        list.find(t => t.name?.toLowerCase().includes(id.toLowerCase()));

      if (!tl) {
        console.error(JSON.stringify({ error: `Target list "${id}" not found.`, hint: 'Use fw target-lists list to see all target lists.' }));
        process.exit(1);
      }

      const body = {};
      if (options.name) body.name = options.name;
      if (options.notes !== undefined) body.notes = options.notes;
      if (options.blockMode) body.blockMode = options.blockMode;
      if (options.targets) {
        try {
          body.targets = JSON.parse(options.targets);
        } catch {
          body.targets = options.targets.split(',').map(t => t.trim()).filter(Boolean);
        }
      }
      if (options.add) {
        const toAdd = options.add.split(',').map(t => t.trim()).filter(Boolean);
        const { data: current } = await client.get(`/target-lists/${tl.id}`);
        const existing = current.targets || [];
        body.targets = [...new Set([...existing, ...toAdd])];
      }
      if (options.remove) {
        const toRemove = new Set(options.remove.split(',').map(t => t.trim()));
        const { data: current } = await client.get(`/target-lists/${tl.id}`);
        const existing = current.targets || [];
        body.targets = existing.filter(t => !toRemove.has(t));
      }

      if (Object.keys(body).length === 0) {
        console.error(JSON.stringify({ error: 'Nothing to update. Provide --name, --notes, --targets, --add, --remove, or --block-mode.' }));
        process.exit(1);
      }

      const { data } = await client.patch(`/target-lists/${tl.id}`, body);
      console.log(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(JSON.stringify({ error: 'Update failed', details: err.response?.data || err.message }));
    }
  },

  delete: async (id, options) => {
    const client = getClient(options);

    try {
      const { data: all } = await client.get('/target-lists');
      const list = Array.isArray(all) ? all : (all.results || []);

      const tl =
        list.find(t => t.id === id) ||
        list.find(t => t.name?.toLowerCase() === id.toLowerCase()) ||
        list.find(t => t.name?.toLowerCase().includes(id.toLowerCase()));

      if (!tl) {
        console.error(JSON.stringify({ error: `Target list "${id}" not found.`, hint: 'Use fw target-lists list to see all target lists.' }));
        process.exit(1);
      }

      if (tl.owner === 'firewalla') {
        console.error(JSON.stringify({ error: 'Cannot delete built-in Firewalla target lists.' }));
        process.exit(1);
      }

      const { data } = await client.delete(`/target-lists/${tl.id}`);
      console.log(JSON.stringify(data ?? { ok: true }, null, 2));
    } catch (err) {
      console.error(JSON.stringify({ error: 'Delete failed', details: err.response?.data || err.message }));
    }
  },
};

module.exports = TargetLists;
