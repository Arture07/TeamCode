import { useCallback } from 'react';

/**
 * Universal IDE-grade Syntax & Structure Validator for CrewCode.
 * Covers 35+ programming, markup, configuration, and scripting languages.
 */
export function useSyntaxValidator() {
  const validateSyntax = useCallback((content, fileName) => {
    if (!content || !fileName) return [];

    const problems = [];
    const lowerName = fileName.toLowerCase();
    const ext = lowerName.split('.').pop() || '';
    const lines = content.split('\n');

    const countUnescapedChar = (text, char) => {
      let count = 0;
      for (let i = 0; i < text.length; i += 1) {
        if (text[i] !== char) continue;
        if (i > 0 && text[i - 1] === '\\') continue;
        count += 1;
      }
      return count;
    };

    // =========================================================================
    // 1. HTML / XML / SVG / Vue / Svelte / Astro / PHP / Template Markup
    // =========================================================================
    if (['html', 'htm', 'xhtml', 'xml', 'svg', 'vue', 'svelte', 'astro', 'php', 'ejs', 'jsp', 'erb'].includes(ext)) {
      const VOID_TAGS = new Set([
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype',
        '?xml', '?php', '%', '!--'
      ]);

      const tagStack = [];

      // Check line-by-line for broken tag syntax
      lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        const incompleteCloseMatch = line.match(/<\/([a-zA-Z0-9_\-]+)\s*$/);
        const incompleteOpenMatch = line.match(/<([a-zA-Z0-9_\-!]+)(?:\s+[^>]*?)?$/);

        if (incompleteCloseMatch) {
          const tagName = incompleteCloseMatch[1];
          const col = line.lastIndexOf('</') + 1;
          problems.push({
            message: `Tag de fechamento incompleta: '</${tagName}' precisa de '>'`,
            severity: 'error',
            line: lineNum,
            column: col,
            filePath: fileName
          });
        } else if (incompleteOpenMatch && !line.includes('>') && !incompleteOpenMatch[1].startsWith('!--')) {
          const tagName = incompleteOpenMatch[1];
          const col = line.lastIndexOf('<') + 1;
          problems.push({
            message: `Tag de abertura incompleta: '<${tagName}' precisa de '>'`,
            severity: 'error',
            line: lineNum,
            column: col,
            filePath: fileName
          });
        }
      });

      // Structure & Balance Parser
      let cleanHtml = content
        .replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length))
        .replace(/<script[\s\S]*?<\/script>/gi, (m) => m.replace(/<script[\s\S]*?>([\s\S]*?)<\/script>/i, (all, body) => `<script>${' '.repeat(body.length)}</script>`))
        .replace(/<style[\s\S]*?<\/style>/gi, (m) => m.replace(/<style[\s\S]*?>([\s\S]*?)<\/style>/i, (all, body) => `<style>${' '.repeat(body.length)}</style>`));

      const tagRegex = /<\/?([a-zA-Z0-9_\-]+)(?:\s+[^>]*?)?(\/?)>/g;
      let match;

      while ((match = tagRegex.exec(cleanHtml)) !== null) {
        const fullTag = match[0];
        const rawTagName = match[1];
        const tagName = rawTagName.toLowerCase();
        const isClosing = fullTag.startsWith('</');
        const isSelfClosing = fullTag.endsWith('/>') || VOID_TAGS.has(tagName);

        const textBefore = cleanHtml.substring(0, match.index);
        const lineNum = (textBefore.match(/\n/g) || []).length + 1;
        const lastNewline = textBefore.lastIndexOf('\n');
        const colNum = match.index - (lastNewline === -1 ? 0 : lastNewline + 1) + 1;

        if (isClosing) {
          if (tagStack.length === 0) {
            problems.push({
              message: `Tag de fechamento '</${rawTagName}>' sem abertura correspondente`,
              severity: 'error',
              line: lineNum,
              column: colNum,
              filePath: fileName
            });
          } else {
            const top = tagStack[tagStack.length - 1];
            if (top.tag.toLowerCase() === tagName) {
              tagStack.pop();
            } else {
              const matchingIdx = tagStack.slice().reverse().findIndex(t => t.tag.toLowerCase() === tagName);
              if (matchingIdx !== -1) {
                const unclosed = tagStack.pop();
                problems.push({
                  message: `Tag '<${unclosed.tag}>' aberta na linha ${unclosed.line} não foi fechada antes de '</${rawTagName}>'`,
                  severity: 'error',
                  line: unclosed.line,
                  column: unclosed.col,
                  filePath: fileName
                });
              } else {
                problems.push({
                  message: `Tag incompatível: esperado '</${top.tag}>', mas encontrou '</${rawTagName}>'`,
                  severity: 'error',
                  line: lineNum,
                  column: colNum,
                  filePath: fileName
                });
              }
            }
          }
        } else if (!isSelfClosing) {
          tagStack.push({ tag: rawTagName, line: lineNum, col: colNum });
        }
      }

      tagStack.forEach((t) => {
        problems.push({
          message: `Tag '<${t.tag}>' aberta na linha ${t.line} não foi fechada`,
          severity: 'error',
          line: t.line,
          column: t.col,
          filePath: fileName
        });
      });
    }

    // =========================================================================
    // 2. JSON / JSONC / JSON5
    // =========================================================================
    if (['json', 'jsonc', 'json5'].includes(ext)) {
      try {
        JSON.parse(content);
      } catch (err) {
        let errLine = 1;
        let errCol = 1;
        const lineMatch = err.message.match(/at position (\d+)/i);
        if (lineMatch) {
          const pos = parseInt(lineMatch[1], 10);
          const textBefore = content.substring(0, pos);
          errLine = (textBefore.match(/\n/g) || []).length + 1;
          const lastNewline = textBefore.lastIndexOf('\n');
          errCol = pos - (lastNewline === -1 ? 0 : lastNewline + 1) + 1;
        } else {
          const lineColMatch = err.message.match(/line (\d+) column (\d+)/i);
          if (lineColMatch) {
            errLine = parseInt(lineColMatch[1], 10);
            errCol = parseInt(lineColMatch[2], 10);
          }
        }

        problems.push({
          message: `JSON inválido: ${err.message}`,
          severity: 'error',
          line: errLine,
          column: errCol,
          filePath: fileName
        });
      }
    }

    // =========================================================================
    // 3. YAML / YML
    // =========================================================================
    if (['yaml', 'yml'].includes(ext)) {
      lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        if (line.includes('\t')) {
          problems.push({
            message: 'YAML proíbe o uso de Tabs (use espaços para indentação)',
            severity: 'error',
            line: lineNum,
            column: line.indexOf('\t') + 1,
            filePath: fileName
          });
        }
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes(':')) {
          const parts = trimmed.split(':');
          const key = parts[0];
          if (key.includes(' ') && !key.startsWith('"') && !key.startsWith("'")) {
            // Check if multiple spaces in unquoted key
            if (/^[a-zA-Z0-9_-]+\s+[a-zA-Z0-9_-]+/.test(key)) {
              problems.push({
                message: `Chave YAML com espaço deve estar entre aspas: "${key}"`,
                severity: 'warning',
                line: lineNum,
                column: line.indexOf(key) + 1,
                filePath: fileName
              });
            }
          }
        }
      });
    }

    // =========================================================================
    // 4. TOML / INI / ENV / PROPERTIES
    // =========================================================================
    if (['toml', 'ini', 'env', 'properties'].includes(ext) || lowerName.startsWith('.env')) {
      lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) return;

        // Section header `[section]`
        if (trimmed.startsWith('[') && !trimmed.endsWith(']')) {
          problems.push({
            message: 'Cabeçalho de seção não fechado: falta "]"',
            severity: 'error',
            line: lineNum,
            column: line.indexOf('[') + 1,
            filePath: fileName
          });
        }

        // Key-value pair without `=` or `:`
        if (!trimmed.startsWith('[') && !trimmed.includes('=') && !trimmed.includes(':')) {
          problems.push({
            message: 'Linha de configuração inválida: formato esperado "CHAVE=VALOR"',
            severity: 'warning',
            line: lineNum,
            column: 1,
            filePath: fileName
          });
        }
      });
    }

    // =========================================================================
    // 5. JavaScript / TypeScript / JSX / TSX / Node (MJS, CJS)
    // =========================================================================
    if (['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'mts', 'cts'].includes(ext)) {
      let parenBalance = 0;
      let bracketBalance = 0;
      let braceBalance = 0;

      lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        const clean = line.replace(/\/\/.*$/, '');

        const singleQuotes = countUnescapedChar(clean, "'");
        const doubleQuotes = countUnescapedChar(clean, '"');

        if (singleQuotes % 2 !== 0 && !clean.includes('`')) {
          problems.push({
            message: "String com aspas simples não fechada: falta '",
            severity: 'error',
            line: lineNum,
            column: line.indexOf("'") + 1,
            filePath: fileName
          });
        }
        if (doubleQuotes % 2 !== 0 && !clean.includes('`')) {
          problems.push({
            message: 'String com aspas duplas não fechada: falta "',
            severity: 'error',
            line: lineNum,
            column: line.indexOf('"') + 1,
            filePath: fileName
          });
        }

        parenBalance += (clean.match(/\(/g) || []).length - (clean.match(/\)/g) || []).length;
        bracketBalance += (clean.match(/\[/g) || []).length - (clean.match(/\]/g) || []).length;
        braceBalance += (clean.match(/\{/g) || []).length - (clean.match(/\}/g) || []).length;

        if (parenBalance < 0) {
          problems.push({ message: 'Parêntese de fechamento ")" sem abertura', severity: 'error', line: lineNum, column: Math.max(1, line.indexOf(')') + 1), filePath: fileName });
          parenBalance = 0;
        }
        if (bracketBalance < 0) {
          problems.push({ message: 'Colchete de fechamento "]" sem abertura', severity: 'error', line: lineNum, column: Math.max(1, line.indexOf(']') + 1), filePath: fileName });
          bracketBalance = 0;
        }
        if (braceBalance < 0) {
          problems.push({ message: 'Chave de fechamento "}" sem abertura', severity: 'error', line: lineNum, column: Math.max(1, line.indexOf('}') + 1), filePath: fileName });
          braceBalance = 0;
        }
      });

      if (parenBalance > 0) problems.push({ message: 'Parêntese "(" não foi fechado', severity: 'error', line: lines.length, column: 1, filePath: fileName });
      if (bracketBalance > 0) problems.push({ message: 'Colchete "[" não foi fechado', severity: 'error', line: lines.length, column: 1, filePath: fileName });
      if (braceBalance > 0) problems.push({ message: 'Chave "{" não foi fechada', severity: 'error', line: lines.length, column: 1, filePath: fileName });
    }

    // =========================================================================
    // 6. CSS / SCSS / SASS / LESS / STYLUS
    // =========================================================================
    if (['css', 'scss', 'sass', 'less', 'styl'].includes(ext)) {
      let braceBalance = 0;
      lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        const clean = line.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/, '');
        braceBalance += (clean.match(/\{/g) || []).length - (clean.match(/\}/g) || []).length;
        if (braceBalance < 0) {
          problems.push({ message: 'Chave de fechamento "}" sem regra CSS correspondente', severity: 'error', line: lineNum, column: Math.max(1, line.indexOf('}') + 1), filePath: fileName });
          braceBalance = 0;
        }
      });
      if (braceBalance > 0) problems.push({ message: 'Bloco de regras CSS "{" não foi fechado', severity: 'error', line: lines.length, column: 1, filePath: fileName });
    }

    // =========================================================================
    // 7. Python (PY, PYW)
    // =========================================================================
    if (['py', 'pyw'].includes(ext)) {
      let textToAnalyze = content
        .replace(/'''[\s\S]*?'''/g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/"""[\s\S]*?"""/g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/#.*/g, (m) => ' '.repeat(m.length));

      const analysisLines = textToAnalyze.split('\n');
      let parenBalance = 0;
      let bracketBalance = 0;
      let braceBalance = 0;

      analysisLines.forEach((cleanLine, idx) => {
        const line = lines[idx];
        const lineNum = idx + 1;
        const trimmed = cleanLine.trim();

        const singleQuotes = countUnescapedChar(cleanLine, "'");
        const doubleQuotes = countUnescapedChar(cleanLine, '"');
        if (singleQuotes % 2 !== 0)
          problems.push({ message: "String Python não fechada: falta '", severity: 'error', line: lineNum, column: line.indexOf("'") + 1, filePath: fileName });
        if (doubleQuotes % 2 !== 0)
          problems.push({ message: 'String Python não fechada: falta "', severity: 'error', line: lineNum, column: line.indexOf('"') + 1, filePath: fileName });

        // Missing colon check on def, class, if, for, while, etc.
        const needsColon = /^(def|class|if|elif|else|for|while|try|except|finally|with)\b/i.test(trimmed);
        if (needsColon && !trimmed.endsWith(':') && !trimmed.endsWith('\\') && parenBalance === 0) {
          problems.push({
            message: `Estrutura Python incompleta: falta ':' no final da instrução "${trimmed.split(' ')[0]}"`,
            severity: 'error',
            line: lineNum,
            column: line.length + 1,
            filePath: fileName
          });
        }

        parenBalance += (cleanLine.match(/\(/g) || []).length - (cleanLine.match(/\)/g) || []).length;
        bracketBalance += (cleanLine.match(/\[/g) || []).length - (cleanLine.match(/\]/g) || []).length;
        braceBalance += (cleanLine.match(/\{/g) || []).length - (cleanLine.match(/\}/g) || []).length;

        if (parenBalance < 0) { problems.push({ message: 'Parêntese de fechamento ")" sem abertura', severity: 'error', line: lineNum, column: Math.max(1, line.indexOf(')') + 1), filePath: fileName }); parenBalance = 0; }
        if (bracketBalance < 0) { problems.push({ message: 'Colchete de fechamento "]" sem abertura', severity: 'error', line: lineNum, column: Math.max(1, line.indexOf(']') + 1), filePath: fileName }); bracketBalance = 0; }
        if (braceBalance < 0) { problems.push({ message: 'Chave de fechamento "}" sem abertura', severity: 'error', line: lineNum, column: Math.max(1, line.indexOf('}') + 1), filePath: fileName }); braceBalance = 0; }
      });

      if (parenBalance > 0) problems.push({ message: 'Parêntese "(" não foi fechado', severity: 'error', line: lines.length, column: 1, filePath: fileName });
      if (bracketBalance > 0) problems.push({ message: 'Colchete "[" não foi fechado', severity: 'error', line: lines.length, column: 1, filePath: fileName });
      if (braceBalance > 0) problems.push({ message: 'Chave "{" não foi fechada', severity: 'error', line: lines.length, column: 1, filePath: fileName });
    }

    // =========================================================================
    // 8. C / C++ / C# / Java / Go / Rust / Kotlin / Swift / Dart / Scala
    // =========================================================================
    if (['c', 'cpp', 'cc', 'cxx', 'h', 'hpp', 'cs', 'java', 'go', 'rs', 'kt', 'kts', 'swift', 'dart', 'scala'].includes(ext)) {
      let parenBalance = 0;
      let bracketBalance = 0;
      let braceBalance = 0;

      lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        const clean = line.replace(/\/\/.*$/, '');
        const doubleQuotes = countUnescapedChar(clean, '"');

        if (doubleQuotes % 2 !== 0 && !clean.includes('`') && !clean.includes('r#"')) {
          problems.push({
            message: 'String não fechada: falta aspas duplas (")',
            severity: 'error',
            line: lineNum,
            column: line.indexOf('"') + 1,
            filePath: fileName
          });
        }

        parenBalance += (clean.match(/\(/g) || []).length - (clean.match(/\)/g) || []).length;
        bracketBalance += (clean.match(/\[/g) || []).length - (clean.match(/\]/g) || []).length;
        braceBalance += (clean.match(/\{/g) || []).length - (clean.match(/\}/g) || []).length;

        if (parenBalance < 0) { problems.push({ message: 'Parêntese de fechamento ")" sem abertura', severity: 'error', line: lineNum, column: Math.max(1, line.indexOf(')') + 1), filePath: fileName }); parenBalance = 0; }
        if (bracketBalance < 0) { problems.push({ message: 'Colchete de fechamento "]" sem abertura', severity: 'error', line: lineNum, column: Math.max(1, line.indexOf(']') + 1), filePath: fileName }); bracketBalance = 0; }
        if (braceBalance < 0) { problems.push({ message: 'Chave de fechamento "}" sem abertura', severity: 'error', line: lineNum, column: Math.max(1, line.indexOf('}') + 1), filePath: fileName }); braceBalance = 0; }
      });

      if (parenBalance > 0) problems.push({ message: 'Parêntese "(" não foi fechado', severity: 'error', line: lines.length, column: 1, filePath: fileName });
      if (bracketBalance > 0) problems.push({ message: 'Colchete "[" não foi fechado', severity: 'error', line: lines.length, column: 1, filePath: fileName });
      if (braceBalance > 0) problems.push({ message: 'Chave "{" não foi fechada', severity: 'error', line: lines.length, column: 1, filePath: fileName });
    }

    // =========================================================================
    // 9. Shell / Bash / Zsh / PowerShell (SH, BASH, ZSH, PS1, PSM1)
    // =========================================================================
    if (['sh', 'bash', 'zsh', 'fish', 'ps1', 'psm1'].includes(ext)) {
      lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        const clean = line.replace(/#.*$/, '');
        const singleQuotes = countUnescapedChar(clean, "'");
        const doubleQuotes = countUnescapedChar(clean, '"');

        if (singleQuotes % 2 !== 0) {
          problems.push({ message: "String Shell não fechada: falta '", severity: 'error', line: lineNum, column: line.indexOf("'") + 1, filePath: fileName });
        }
        if (doubleQuotes % 2 !== 0) {
          problems.push({ message: 'String Shell não fechada: falta "', severity: 'error', line: lineNum, column: line.indexOf('"') + 1, filePath: fileName });
        }
      });
    }

    // =========================================================================
    // 10. SQL (SQL, DDL, DML)
    // =========================================================================
    if (['sql', 'psql', 'mysql'].includes(ext)) {
      let parenBalance = 0;
      lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        const clean = line.replace(/--.*$/, '');
        const singleQuotes = countUnescapedChar(clean, "'");

        if (singleQuotes % 2 !== 0) {
          problems.push({ message: "String SQL literal não fechada: falta '", severity: 'error', line: lineNum, column: line.indexOf("'") + 1, filePath: fileName });
        }
        parenBalance += (clean.match(/\(/g) || []).length - (clean.match(/\)/g) || []).length;
        if (parenBalance < 0) {
          problems.push({ message: 'Parêntese de fechamento ")" sem abertura em subconsulta/cláusula SQL', severity: 'error', line: lineNum, column: Math.max(1, line.indexOf(')') + 1), filePath: fileName });
          parenBalance = 0;
        }
      });
      if (parenBalance > 0) problems.push({ message: 'Parêntese "(" não foi fechado na instrução SQL', severity: 'error', line: lines.length, column: 1, filePath: fileName });
    }

    // =========================================================================
    // 11. Ruby & Lua
    // =========================================================================
    if (['rb', 'lua'].includes(ext)) {
      lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        const clean = line.replace(/#.*$/, '').replace(/--.*$/, '');
        const singleQuotes = countUnescapedChar(clean, "'");
        const doubleQuotes = countUnescapedChar(clean, '"');

        if (singleQuotes % 2 !== 0) problems.push({ message: "String não fechada: falta '", severity: 'error', line: lineNum, column: line.indexOf("'") + 1, filePath: fileName });
        if (doubleQuotes % 2 !== 0) problems.push({ message: 'String não fechada: falta "', severity: 'error', line: lineNum, column: line.indexOf('"') + 1, filePath: fileName });
      });
    }

    // =========================================================================
    // 12. Markdown (MD, MARKDOWN)
    // =========================================================================
    if (['md', 'markdown'].includes(ext)) {
      let codeBlockOpen = false;
      let codeBlockLine = 1;
      lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        if (line.trim().startsWith('```')) {
          if (!codeBlockOpen) {
            codeBlockOpen = true;
            codeBlockLine = lineNum;
          } else {
            codeBlockOpen = false;
          }
        }
      });
      if (codeBlockOpen) {
        problems.push({
          message: `Bloco de código Markdown aberto na linha ${codeBlockLine} (com \`\`\`) não foi fechado`,
          severity: 'warning',
          line: codeBlockLine,
          column: 1,
          filePath: fileName
        });
      }
    }

    return problems;
  }, []);

  return { validateSyntax };
}
