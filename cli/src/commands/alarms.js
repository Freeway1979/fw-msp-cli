const { getClient, getClientV1, resolveBoxGid } = require('../api/client');

const Alarms = {
  archive: async (aid, options) => {
    const gid = await resolveBoxGid(options.box, options);
    const client = getClientV1(options);
    try {
      // v1 API: soft-archive (moves to archive, does not delete)
      const { data } = await client.post(`/v1/alarm/archive/${gid}/${aid}`, {});
      console.log(JSON.stringify(data ?? { ok: true }, null, 2));
    } catch (err) {
      console.error(JSON.stringify({ error: "Archive failed", status: err.response?.status, details: err.response?.data || err.message }));
    }
  },

  delete: async (aid, options) => {
    const gid = await resolveBoxGid(options.box, options);
    const client = getClient(options);
    try {
      // v2 API: permanently delete alarm
      const { data } = await client.delete(`/alarms/${gid}/${aid}`);
      console.log(JSON.stringify(data ?? { ok: true }, null, 2));
    } catch (err) {
      console.error(JSON.stringify({ error: "Delete failed", status: err.response?.status, details: err.response?.data || err.message }));
    }
  },

  list: async (options) => {
    const gid = await resolveBoxGid(options.box, options);
    const client = getClient(options);
    
    let apiParams = { gid };
    
    // Only pass through supported API parameters
    if (options.params) {
      const parsedParams = JSON.parse(options.params);
      // Filter to only supported parameters (limit, cursor, etc.)
      const supportedParams = ['limit', 'cursor', 'query', 'groupBy', 'sortBy'];
      supportedParams.forEach(param => {
        if (parsedParams[param] !== undefined) {
          apiParams[param] = parsedParams[param];
        }
      });
    }

    try {
      const { data } = await client.get('/alarms', { params: apiParams });
      console.log(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(JSON.stringify({ error: "Fetch failed", details: err.response?.data || err.message }));
    }
  }
};

module.exports = Alarms;
