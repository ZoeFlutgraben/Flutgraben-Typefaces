document.addEventListener('DOMContentLoaded', function(){

    function syncToScene() {
        const apercu = document.getElementById('textapercu');
        const textContent = apercu.innerText || apercu.textContent;
        document.getElementById('txt').innerText = textContent;
    }

    const observer = new MutationObserver(syncToScene);

    const config = {
        childList: true,
        subtree: true,
        characterData: true
    };

    observer.observe(document.getElementById('textapercu'), config);

    syncToScene();
});
