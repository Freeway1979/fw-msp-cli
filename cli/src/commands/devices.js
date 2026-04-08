const { getClient, resolveBoxGid } = require('../api/client');

/**
 * Fetch all devices for a box (API returns a flat array, no pagination).
 */
async function fetchAll(client, gid) {
  const { data } = await client.get('/devices', { params: { gid } });
  return Array.isArray(data) ? data : (data.results || []);
}

/**
 * Client-side filtering applied to the full device list.
 */
function applyFilters(devices, options) {
  let results = devices;

  if (options.online) {
    results = results.filter(d => d.online === true);
  }

  if (options.offline) {
    results = results.filter(d => d.online === false);
  }

  if (options.group) {
    const g = options.group.toLowerCase();
    results = results.filter(d => d.group?.name?.toLowerCase().includes(g));
  }

  if (options.network) {
    const n = options.network.toLowerCase();
    results = results.filter(d => d.network?.name?.toLowerCase().includes(n));
  }

  if (options.type) {
    const t = options.type.toLowerCase();
    results = results.filter(d => d.deviceType?.toLowerCase().includes(t));
  }

  if (options.query) {
    const q = options.query.toLowerCase();
    results = results.filter(d =>
      d.name?.toLowerCase().includes(q) ||
      d.macVendor?.toLowerCase().includes(q) ||
      d.ip?.includes(q) ||
      d.mac?.toLowerCase().includes(q)
    );
  }

  return results;
}

const Devices = {
  rename: async (id, name, options) => {
    const gid = await resolveBoxGid(options.box, options);
    const client = getClient(options);

    try {
      const all = await fetchAll(client, gid);
      const q = id.toLowerCase();

      const device =
        all.find(d => d.mac?.toLowerCase() === q) ||
        all.find(d => d.ip === id) ||
        all.find(d => d.name?.toLowerCase() === q) ||
        all.find(d => d.name?.toLowerCase().includes(q));

      if (!device) {
        console.error(JSON.stringify({ error: `Device "${id}" not found.`, hint: 'Try fw devices list to see all devices.' }));
        process.exit(1);
      }

      const mac = encodeURIComponent(device.mac);
      const { data } = await client.patch(`/boxes/${gid}/devices/${mac}`, { name });
      console.log(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(JSON.stringify({ error: 'Rename failed', details: err.response?.data || err.message }));
    }
  },

  list: async (options) => {
    const gid = await resolveBoxGid(options.box, options);
    const client = getClient(options);

    try {
      const all = await fetchAll(client, gid);
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
      const q = id.toLowerCase();

      // Match by MAC (exact), IP (exact), or name (case-insensitive substring)
      const device =
        all.find(d => d.mac?.toLowerCase() === q) ||
        all.find(d => d.ip === id) ||
        all.find(d => d.name?.toLowerCase() === q) ||
        all.find(d => d.name?.toLowerCase().includes(q));

      if (!device) {
        console.error(JSON.stringify({ error: `Device "${id}" not found.`, hint: 'Try fw devices list to see all devices.' }));
        process.exit(1);
      }

      console.log(JSON.stringify(device, null, 2));
    } catch (err) {
      console.error(JSON.stringify({ error: 'Fetch failed', details: err.response?.data || err.message }));
    }
  },
};

module.exports = Devices;
