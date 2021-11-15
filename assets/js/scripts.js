let dropzone = document.getElementById('dropzone')
let displayFiles = document.getElementById('display-files')

let dropzoneFile = document.getElementById('file')
dropzoneFile.addEventListener('dragenter', () => dropzone.classList.add('dragging'));
dropzoneFile.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
dropzoneFile.addEventListener('drop', () => dropzone.classList.remove('dragging'));
dropzoneFile.oninput = async () => {
	await Promise.all(Array.from(dropzoneFile.files).map(async (file) => {
		let archive = await Unarchiver.open(file);

		for (let entry of archive.entries) {
			if (!entry.is_file) continue;

			let name = entry.name;
			let size = entry.size_uncompressed;
			let elementTemplate = `<div class="archive-item card mb-2">
							<div class="card-body p-2">
								<div class="d-flex align-items-center">
									<div class="ms-2 flex-grow-1">
										<p class="mb-0">${name} (${humanFileSize(size)})</p>
									</div>
									<div>
										<!-- Button trigger modal -->
										<button type="button" class="btn btn-primary btn-sm" onclick=setContent(this)>
											View <i class="bi bi-eye-fill"></i>
										</button>
									</div>
								</div>
							</div>
						</div>`;
			let element = createElementFromHTML(elementTemplate);
			element.data = entry;
			displayFiles.append(element);
		}

	}));
	dropzoneFile.value = null;
};

let modalElement = document.getElementById('content-modal');
let myModal = new bootstrap.Modal(modalElement)
let modalTitle = modalElement.querySelector('.modal-title')
let modalContent = modalElement.querySelector('.modal-body')

function setContent(self) {
	let parent = self.closest('.archive-item')
	let data = parent.data;
	modalTitle.innerHTML = `Viewing "${data.name}"`;
	modalContent.innerHTML = 'Loading...';
	myModal.show();

	data.read().then(async function (file) {
		modalContent.innerHTML = '';

		let ext = getExtension(data.name);
		switch (ext) {
			case 'mp4': // Video
			case 'mp3': // Audio
				let elementType = ext == 'mp4' ? 'video' : 'audio'
				let element = document.createElement(elementType)
				element.src = URL.createObjectURL(file)
				element.controls = true;
				element.style.width = '100%';
				modalContent.append(element)
				break;

			case 'png': // Image
			case 'jpg':
			case 'jpeg':
			case 'svg':
			case 'gif':
			case 'ico':
			case 'apng':
				let image = document.createElement('img')
				image.src = URL.createObjectURL(file)
				image.style.width = '100%';
				modalContent.append(image)
				break;

			case 'csv':
				modalContent.append(createTable(await file.text()))
				break;

			case 'json':
				modalContent.innerHTML = "<pre>" + JSON.stringify(JSON.parse(await file.text()), null, 4) + "</pre>"
				break;

			case 'pdf':
				let embed = document.createElement('embed');
				embed.src = URL.createObjectURL(new Blob([file], { type: 'application/pdf' }));
				embed.height = 600;
				embed.width = '100%';
				modalContent.append(embed)
				break;

			default: // Assume content is text
				modalContent.innerHTML = '<pre>' + await file.text() + '</pre>';
				break;
		}
	})
}

function csvToArray(csv) {
	return csv.split("\n").map(function (row) {
		return row.split(",");
	});
};

function createTable(string) {
	var array = csvToArray(string);
	var content = "";
	let header = array.shift()
	content += "<thead>"
	header.forEach(function (cell) {
		content += "<th>" + cell + "</th>";
	});
	content += "</thead><tbody>"

	array.forEach(function (row) {
		content += "<tr>";
		row.forEach(function (cell) {
			content += "<td>" + cell + "</td>";
		});
		content += "</tr>";
	});
	content += "</tbody>";

	let table = document.createElement('table')
	table.className = 'table';
	table.innerHTML = content;
	return table;
}

/**
 * Format bytes as human-readable text.
 * https://stackoverflow.com/a/14919494
 * 
 */
function humanFileSize(bytes, dp = 1) {
	const thresh = 1024;

	if (Math.abs(bytes) < thresh)
		return bytes + ' B';

	const units = ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
	let u = -1;
	const r = 10 ** dp;

	do {
		bytes /= thresh;
		++u;
	} while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);

	return bytes.toFixed(dp) + ' ' + units[u];
}

function getExtension(name) {
	return name.split('.').pop();
}

function createElementFromHTML(htmlString) {
	let div = document.createElement('div');
	div.innerHTML = htmlString.trim();
	return div.firstChild;
}
