require('./lte-api-diagnostics.cjs')().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
