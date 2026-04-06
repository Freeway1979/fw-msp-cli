const { getClient, resolveBoxGid } = require('../api/client');

const Flows = {
  list: async (options) => {
    const gid = await resolveBoxGid(options.box, options);
    const client = getClient(options);
    
    let apiParams = { gid };
    
    // Pass through flow-specific parameters
    if (options.query) {
      apiParams.query = options.query;
    }
    
    if (options.groupBy) {
      apiParams.groupBy = options.groupBy;
    }
    
    if (options.sortBy) {
      apiParams.sortBy = options.sortBy;
    }
    
    if (options.limit) {
      const limit = parseInt(options.limit);
      if (isNaN(limit) || limit <= 0) {
        console.error(JSON.stringify({ error: "Invalid limit value. Must be a positive integer." }));
        process.exit(1);
      }
      if (limit > 500) {
        console.error(JSON.stringify({ error: "Limit exceeds maximum value of 500." }));
        process.exit(1);
      }
      apiParams.limit = limit;
    }
    
    if (options.cursor) {
      apiParams.cursor = options.cursor;
    }
    
    // Support raw params for advanced users
    if (options.params) {
      const parsedParams = JSON.parse(options.params);
      const supportedParams = ['query', 'groupBy', 'sortBy', 'limit', 'cursor'];
      supportedParams.forEach(param => {
        if (parsedParams[param] !== undefined) {
          apiParams[param] = parsedParams[param];
        }
      });
    }

    try {
      const { data } = await client.get('/flows', { params: apiParams });
      console.log(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(JSON.stringify({ error: "Fetch failed", details: err.response?.data || err.message }));
    }
  }
};

module.exports = Flows;