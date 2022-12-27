// set title
const setButton = document.getElementById('btn')
const titleInput = document.getElementById('title')


setButton.addEventListener('click', () => {
    const title = titleInput.value
    window.electronAPI.setTitle(title)
});

// file upload
const csvInput = document.getElementById('csv')
csvInput.addEventListener('change', async(e) => {
    const file = e.target.files.item(0)
    const text = await file.text();
    window.electronAPI.setCSV(text);
    
    
});