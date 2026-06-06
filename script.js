(function() {
    let filesArray = [];
    let convertedFiles = [];
    let convertedZipBlob = null;

    const dropzone = document.getElementById('dropzone');
    const browseBtn = document.getElementById('browseBtn');
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('fileList');
    const convertBtn = document.getElementById('convertBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const successMsg = document.getElementById('successMsg');
    const errorMsg = document.getElementById('errorMsg');
    const formatHint = document.getElementById('formatHint');
    const bgOptions = document.getElementById('bgOptions');
    const bgColor = document.getElementById('bgColor');
    const modeBtns = document.querySelectorAll('.mode-btn');

    let currentMode = 'to-jpg';

    function setMode(newMode) {
        currentMode = newMode;

        modeBtns.forEach(btn => {
            const isActive = btn.dataset.mode === newMode;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive);
        });

        if (newMode === 'to-png') {
            fileInput.accept = '.jpg,.jpeg';
            formatHint.textContent = 'Supports .jpg and .jpeg files';
            bgOptions.classList.remove('show');
        } else {
            fileInput.accept = '.png';
            formatHint.textContent = 'Supports .png files';
            bgOptions.classList.add('show');
        }

        clearSelection();
    }

    function getAcceptedExtensions() {
        return currentMode === 'to-png' ? ['.jpg', '.jpeg'] : ['.png'];
    }

    function getExtensionFromFilename(name) {
        const dot = name.lastIndexOf('.');
        if (dot === -1) return '';
        return name.substring(dot).toLowerCase();
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    const MAX_IMAGE_DIMENSION = 10000;

    function validateFile(file) {
        const ext = getExtensionFromFilename(file.name);
        const accepted = getAcceptedExtensions();
        if (!accepted.includes(ext)) return false;
        if (file.size > MAX_FILE_SIZE) return false;
        if (file.size === 0) return false;
        return true;
    }

    function handleFiles(files) {
        errorMsg.classList.remove('show');
        dropzone.classList.remove('has-error');

        let validFiles = Array.from(files).filter(validateFile);
        let rejected = Array.from(files).filter(f => !validateFile(f));
        
        if (rejected.length > 0) {
            const expected = currentMode === 'to-png' ? 'JPG' : 'PNG';
            const reasons = rejected.map(f => {
                if (f.size === 0) return `"${f.name}" is empty`;
                if (f.size > MAX_FILE_SIZE) return `"${f.name}" exceeds 50 MB limit`;
                return `"${f.name}" is not a valid ${expected} file`;
            }).join('. ');
            errorMsg.textContent = 'Some files were ignored: ' + reasons;
            errorMsg.classList.add('show');
            dropzone.classList.add('has-error');
        }

        validFiles.forEach(file => {
            if (!filesArray.some(f => f.name === file.name && f.size === file.size)) {
                filesArray.push(file);
                addFileCard(file);
            }
        });

        updateUIState();
    }

    function addFileCard(file) {
        const card = document.createElement('div');
        card.className = 'file-card';

        const iconDiv = document.createElement('div');
        iconDiv.className = 'file-icon-small';
        iconDiv.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';

        const infoDiv = document.createElement('div');
        infoDiv.className = 'file-info';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'file-name';
        nameDiv.textContent = file.name;

        const sizeDiv = document.createElement('div');
        sizeDiv.className = 'file-size';
        sizeDiv.textContent = formatFileSize(file.size);

        infoDiv.appendChild(nameDiv);
        infoDiv.appendChild(sizeDiv);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'file-remove';
        removeBtn.setAttribute('aria-label', 'Remove file');
        removeBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

        removeBtn.addEventListener('click', () => {
            filesArray = filesArray.filter(f => f !== file);
            card.remove();
            updateUIState();
        });

        card.appendChild(iconDiv);
        card.appendChild(infoDiv);
        card.appendChild(removeBtn);
        fileList.appendChild(card);
    }

    function updateUIState() {
        convertBtn.disabled = filesArray.length === 0;
        downloadBtn.disabled = true;
        successMsg.classList.remove('show');
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    function clearSelection() {
        filesArray = [];
        convertedFiles = [];
        fileList.innerHTML = '';
        updateUIState();
        loadingOverlay.classList.remove('show');
        errorMsg.classList.remove('show');
        dropzone.classList.remove('has-error');
        convertedZipBlob = null;
    }

    function getOutputFileName(originalName) {
        const dot = originalName.lastIndexOf('.');
        const base = dot === -1 ? originalName : originalName.substring(0, dot);
        const ext = currentMode === 'to-png' ? '.png' : '.jpg';
        return base + ext;
    }

    async function convertAllImages() {
        if (filesArray.length === 0) return;

        convertBtn.style.display = 'none';
        loadingOverlay.classList.add('show');
        successMsg.classList.remove('show');
        convertedFiles = [];

        try {
            for (const file of filesArray) {
                const converted = await convertSingleImage(file);
                convertedFiles.push(converted);
            }

            if (convertedFiles.length > 1) {
                const zip = new JSZip();
                convertedFiles.forEach(cf => {
                    zip.file(cf.name, cf.blob);
                });
                convertedZipBlob = await zip.generateAsync({type: 'blob'});
                successMsg.textContent = `Successfully converted ${convertedFiles.length} files. ZIP ready.`;
            } else if (convertedFiles.length === 1) {
                successMsg.textContent = `${convertedFiles[0].name} ready to download.`;
            }

            successMsg.classList.add('show');
            downloadBtn.disabled = false;
        } catch (err) {
            errorMsg.textContent = err.message || 'An error occurred during conversion.';
            errorMsg.classList.add('show');
        } finally {
            loadingOverlay.classList.remove('show');
            convertBtn.style.display = '';
        }
    }

    function convertSingleImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    const w = img.naturalWidth;
                    const h = img.naturalHeight;

                    if (w > MAX_IMAGE_DIMENSION || h > MAX_IMAGE_DIMENSION) {
                        reject(new Error(`Image dimensions (${w}x${h}) exceed the maximum allowed (${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION})`));
                        return;
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');

                    if (currentMode === 'to-jpg') {
                        ctx.fillStyle = bgColor.value;
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }

                    ctx.drawImage(img, 0, 0);

                    const mimeType = currentMode === 'to-png' ? 'image/png' : 'image/jpeg';
                    const quality = currentMode === 'to-jpg' ? 0.92 : undefined;
                    
                    canvas.toBlob(blob => {
                        if (!blob) {
                            reject(new Error('Failed to generate image blob'));
                            return;
                        }
                        resolve({
                            name: getOutputFileName(file.name),
                            blob: blob
                        });
                    }, mimeType, quality);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    modeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            setMode(this.dataset.mode);
        });
    });

    dropzone.addEventListener('click', function(e) {
        if (e.target === browseBtn) return;
        fileInput.click();
    });

    browseBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        fileInput.click();
    });

    dropzone.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        this.classList.remove('drag-over');
    });

    dropzone.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', function() {
        handleFiles(this.files);
        this.value = '';
    });

    convertBtn.addEventListener('click', convertAllImages);

    downloadBtn.addEventListener('click', function() {
        if (this.disabled) return;

        if (convertedFiles.length > 1 && convertedZipBlob) {
            saveAs(convertedZipBlob, 'converted_images.zip');
        } else if (convertedFiles.length === 1) {
            saveAs(convertedFiles[0].blob, convertedFiles[0].name);
        }
    });

    function saveAs(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    setMode('to-jpg');
})();
