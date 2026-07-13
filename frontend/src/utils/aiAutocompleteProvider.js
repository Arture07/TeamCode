let typingTimer = null;
const TYPING_DELAY = 500; // 500ms delay to prevent too many requests

export function registerAiAutocomplete(monaco) {
  return monaco.languages.registerInlineCompletionsProvider('*', {
    provideInlineCompletions: async (model, position, context, token) => {
      // Basic check: do not trigger on every single keystroke instantly
      // We'll wrap the actual fetch in a Promise that resolves after a debounce

      return new Promise((resolve) => {
        if (typingTimer) clearTimeout(typingTimer);

        typingTimer = setTimeout(async () => {
          if (token.isCancellationRequested) {
            resolve({ items: [] });
            return;
          }

          const textBeforeCursor = model.getValueInRange({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          });

          const textAfterCursor = model.getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: model.getLineCount(),
            endColumn: model.getLineMaxColumn(model.getLineCount())
          });

          const fileContext = `[PREFIX]\n${textBeforeCursor}\n[CURSOR]\n[SUFFIX]\n${textAfterCursor}`;
          
          try {
            const response = await fetch(`/api/ai/autocomplete`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
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

            // Remove markdown formatting if the AI ignored the prompt
            if (suggestion.startsWith('```')) {
              const lines = suggestion.split('\n');
              lines.shift(); // remove first line ```lang
              if (lines[lines.length - 1] && lines[lines.length - 1].startsWith('```')) {
                lines.pop(); // remove last line ```
              }
              suggestion = lines.join('\n');
            }

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
            console.error("AI Autocomplete error", e);
            resolve({ items: [] });
          }
        }, TYPING_DELAY);
      });
    },
    freeInlineCompletions: () => {}
  });
}
