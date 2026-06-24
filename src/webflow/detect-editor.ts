export function handleEditor(
  onEditorView: ((isEditor: boolean) => void) | null = null
) {
  const checkEditorState = () => {
    const firstChild = document.body.firstElementChild;
    return (
      firstChild instanceof HTMLElement &&
      firstChild.classList.contains("w-editor-publish-node")
    );
  };

  let previousState = checkEditorState();
  const isEditor = previousState;

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "childList") {
        const newIsEditor = checkEditorState();
        if (newIsEditor !== previousState) {
          console.log("Editor state changed to:", newIsEditor);
          if (onEditorView) {
            onEditorView(newIsEditor);
          }
          previousState = newIsEditor;
        }
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: false,
  });

  if (onEditorView) {
    onEditorView(isEditor);
  }

  return isEditor;
}
