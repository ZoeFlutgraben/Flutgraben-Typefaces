document.addEventListener('DOMContentLoaded', function(){

    // Copies the text from the editable preview field into the scene text block.
    // innerText is used (not textContent) to match the browser's rendered text,
    // which excludes hidden elements and respects CSS visibility.
    function syncToScene() {
        const apercu = document.getElementById('textapercu');
        document.getElementById('txt').innerText = apercu.innerText;
    }

    // MutationObserver fires on any content change inside the editable div,
    // including typing, paste, and programmatic edits.
    const observer = new MutationObserver(syncToScene);

    observer.observe(document.getElementById('textapercu'), {
        childList: true,
        subtree: true,
        characterData: true
    });

    syncToScene();
});
