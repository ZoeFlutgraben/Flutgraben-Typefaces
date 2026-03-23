// EXPORT IMAGE
document.getElementById('downloadBtn').addEventListener('click', () => {
    const element = document.getElementById('scene');

    domtoimage.toPng(element)
        .then(dataURL => {
            const a = document.createElement('a');
            a.href = dataURL;
            a.download = 'ma_composition.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
});
