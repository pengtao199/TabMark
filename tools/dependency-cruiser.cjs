/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'warn',
      comment: 'Avoid circular dependencies when splitting large files.',
      from: {},
      to: { circular: true }
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'Detect dead extracted modules (entry files are ignored).',
      from: {
        orphan: true,
        path: '^src/.+/(modules|handlers|services|utils)/',
        pathNot: '^src/vendor/'
      },
      to: {}
    }
  ],
  options: {
    includeOnly: '^src',
    doNotFollow: { path: '^src/vendor/' },
    tsPreCompilationDeps: false,
    enhancedResolveOptions: {
      extensions: ['.js']
    }
  }
};
