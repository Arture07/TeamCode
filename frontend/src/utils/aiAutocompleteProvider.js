let typingTimer = null;
let currentAbortController = null;
const TYPING_DELAY = 750; // 750ms debounce to prevent spamming requests on every keystroke

export function registerAiAutocomplete(monaco) {
  return monaco.languages.registerInlineCompletionsProvider('*', {
    provideInlineCompletions: async (model, position, context, token) => {
      // Check if user disabled AI autocomplete in settings/localStorage or if user is guest
      const isGuest = !localStorage.getItem('jwtToken');
      if (isGuest && localStorage.getItem('guest_ai_autocomplete_enabled') !== 'true') {
        return { items: [] };
      }
      if (localStorage.getItem('ai_autocomplete_disabled') === 'true') {
        return { items: [] };
      }

      return new Promise((resolve) => {
        if (typingTimer) clearTimeout(typingTimer);
        if (currentAbortController) {
          try { currentAbortController.abort(); } catch (_) {}
        }

        typingTimer = setTimeout(async () => {
          if (token.isCancellationRequested) {
            resolve({ items: [] });
            return;
          }

          // Check current line prefix before cursor
          const currentLineContent = model.getLineContent(position.lineNumber) || '';
          const linePrefix = currentLineContent.substring(0, position.column - 1);

          // Skip autocomplete if the line is blank/only whitespace and cursor has no context
          if (!linePrefix.trim()) {
            resolve({ items: [] });
            return;
          }

          // Limit context window to max 30 lines before and 15 lines after to save tokens drastically
          const maxLinesBefore = 30;
          const maxLinesAfter = 15;
          const startLine = Math.max(1, position.lineNumber - maxLinesBefore);
          const endLine = Math.min(model.getLineCount(), position.lineNumber + maxLinesAfter);

          const textBeforeCursor = model.getValueInRange({
            startLineNumber: startLine,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          });

          const textAfterCursor = model.getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: endLine,
            endColumn: model.getLineMaxColumn(endLine)
          });

          const fileContext = `[PREFIX]\n${textBeforeCursor}\n[CURSOR]\n[SUFFIX]\n${textAfterCursor}`;
          
          currentAbortController = new AbortController();

          try {
            const response = await fetch(`/api/ai/autocomplete`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': localStorage.getItem('jwtToken') ? `Bearer ${localStorage.getItem('jwtToken')}` : ''
              },
              signal: currentAbortController.signal,
              body: JSON.stringify({
                message: "autocomplete",
                context: fileContext,
                sessionId: new URLSearchParams(window.location.search).get("sessionId")
              })
            });

            if (!response.ok) {
              resolve({ items: [] });
              return;
            }

            const data = await response.json();
            let suggestion = data.response;

            if (!suggestion || typeof suggestion !== 'string') {
              resolve({ items: [] });
              return;
            }

            // Discard any error message or tool_request text if returned
            if (
              suggestion.includes('Não recebi') ||
              suggestion.includes('Não foi possível') ||
              suggestion.includes('Erro ao') ||
              suggestion.includes('Limite da API') ||
              suggestion.includes('tool_request')
            ) {
              resolve({ items: [] });
              return;
            }

            // Remove markdown code fences if model enclosed response in ```
            if (suggestion.startsWith('```')) {
              const lines = suggestion.split('\n');
              lines.shift(); // remove first line ```lang
              if (lines[lines.length - 1] && lines[lines.length - 1].startsWith('```')) {
                lines.pop(); // remove last line ```
              }
              suggestion = lines.join('\n');
            }

            suggestion = suggestion.trimEnd();

            if (suggestion && !token.isCancellationRequested) {
              resolve({
                items: [{
                  insertText: suggestion
                }]
              });
            } else {
              resolve({ items: [] });
            }
          } catch (e) {
            if (e.name !== 'AbortError') {
              console.debug("AI Autocomplete skipped or error:", e);
            }
            resolve({ items: [] });
          }
        }, TYPING_DELAY);
      });
    },
    freeInlineCompletions: () => {},
    disposeInlineCompletions: () => {},
    handleItemDidShow: () => {}
  });
}
