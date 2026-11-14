/** O servidor publicado não tem perf_hooks. O relógio do ambiente basta. */
const performance = globalThis.performance;

module.exports = { performance };
module.exports.performance = performance;
