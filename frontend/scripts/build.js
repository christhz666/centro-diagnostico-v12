const originalEmitWarning = process.emitWarning.bind(process);

process.emitWarning = (warning, ...args) => {
  const message = typeof warning === 'string' ? warning : warning?.message;
  const codeFromWarning = typeof warning === 'object' ? warning?.code : undefined;
  const codeFromArgs = args.find((arg) => typeof arg === 'string' && /^DEP\d+$/.test(arg));

  const isReactScriptsFsDeprecation =
    codeFromWarning === 'DEP0176' ||
    codeFromArgs === 'DEP0176' ||
    String(message || '').includes('fs.F_OK is deprecated');

  if (isReactScriptsFsDeprecation) {
    return;
  }

  return originalEmitWarning(warning, ...args);
};

require('react-scripts/scripts/build');
