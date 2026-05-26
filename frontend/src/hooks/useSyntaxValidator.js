import { useCallback } from 'react';

export function useSyntaxValidator() {
  const validateSyntax = useCallback((content, fileName) => {
    if (!content || !fileName) return [];

    const countUnescapedChar = (text, char) => {
      let count = 0;
      for (let i = 0; i < text.length; i += 1) {
        if (text[i] !== char) continue;
        if (i > 0 && text[i - 1] === '\\') continue;
        count += 1;
      }
      return count;
    };

    const problems = [];
    const ext = fileName.split('.').pop()?.toLowerCase();
    const lines = content.split('\n');

    // --- Python validation ---
    if (ext === 'py') {
      let textToAnalyze = content;
      textToAnalyze = textToAnalyze.replace(/'''[\s\S]*?'''/g, (m) => m.replace(/[^\n]/g, ' '));
      textToAnalyze = textToAnalyze.replace(/"""[\s\S]*?"""/g, (m) => m.replace(/[^\n]/g, ' '));
      textToAnalyze = textToAnalyze.replace(/#.*/g, (m) => ' '.repeat(m.length));

      const analysisLines = textToAnalyze.split('\n');
      let parenBalance = 0;
      let bracketBalance = 0;
      let braceBalance = 0;

      analysisLines.forEach((cleanLine, idx) => {
        const line = lines[idx];
        const lineNum = idx + 1;

        const singleQuotes = countUnescapedChar(cleanLine, "'");
        const doubleQuotes = countUnescapedChar(cleanLine, '"');
        if (singleQuotes % 2 !== 0)
          problems.push({ message: "String não fechada: falta '", severity: 'error', line: lineNum, column: line.indexOf("'") + 1, filePath: fileName });
        if (doubleQuotes % 2 !== 0)
          problems.push({ message: 'String não fechada: falta "', severity: 'error', line: lineNum, column: line.indexOf('"') + 1, filePath: fileName });

        parenBalance += (cleanLine.match(/\(/g) || []).length - (cleanLine.match(/\)/g) || []).length;
        bracketBalance += (cleanLine.match(/\[/g) || []).length - (cleanLine.match(/\]/g) || []).length;
        braceBalance += (cleanLine.match(/\{/g) || []).length - (cleanLine.match(/\}/g) || []).length;

        if (parenBalance < 0) { problems.push({ message: 'Parêntese de fechamento sem abertura', severity: 'error', line: lineNum, column: Math.max(1, line.indexOf(')') + 1), filePath: fileName }); parenBalance = 0; }
        if (bracketBalance < 0) { problems.push({ message: 'Colchete de fechamento sem abertura', severity: 'error', line: lineNum, column: Math.max(1, line.indexOf(']') + 1), filePath: fileName }); bracketBalance = 0; }
        if (braceBalance < 0) { problems.push({ message: 'Chave de fechamento sem abertura', severity: 'error', line: lineNum, column: Math.max(1, line.indexOf('}') + 1), filePath: fileName }); braceBalance = 0; }
      });

      if (parenBalance > 0) problems.push({ message: 'Parêntese não fechado', severity: 'error', line: lines.length, column: 1, filePath: fileName });
      if (bracketBalance > 0) problems.push({ message: 'Colchete não fechado', severity: 'error', line: lines.length, column: 1, filePath: fileName });
      if (braceBalance > 0) problems.push({ message: 'Chave não fechada', severity: 'error', line: lines.length, column: 1, filePath: fileName });
    }

    // --- Java validation (basic) ---
    if (ext === 'java') {
      let parenBalance = 0;
      let braceBalance = 0;
      lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        const doubleQuotes = countUnescapedChar(line, '"');
        if (doubleQuotes % 2 !== 0)
          problems.push({ message: 'String não fechada', severity: 'error', line: lineNum, column: line.indexOf('"') + 1, filePath: fileName });

        parenBalance += (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
        braceBalance += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;

        if (parenBalance < 0) { problems.push({ message: 'Parêntese de fechamento sem abertura', severity: 'error', line: lineNum, column: Math.max(1, line.indexOf(')') + 1), filePath: fileName }); parenBalance = 0; }
        if (braceBalance < 0) { problems.push({ message: 'Chave de fechamento sem abertura', severity: 'error', line: lineNum, column: Math.max(1, line.indexOf('}') + 1), filePath: fileName }); braceBalance = 0; }
      });
      if (parenBalance > 0) problems.push({ message: 'Parêntese não fechado', severity: 'error', line: lines.length, column: 1, filePath: fileName });
      if (braceBalance > 0) problems.push({ message: 'Chave não fechada', severity: 'error', line: lines.length, column: 1, filePath: fileName });
    }

    return problems;
  }, []);

  return { validateSyntax };
}
