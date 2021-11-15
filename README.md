# Unarchiver.js
The simple, all-in-one, JavaScript unarchiver that runs in your browser!

Supports .zip, .rar, .tar, .tar.gz, .tar.xz, and .tar.bz2 archive formats. Tested on Chrome, Firefox, and Edge.

## Getting Started

### Include source on page (HTML)
```html
<!-- Local (remember to extract all files) -->
<script src="./unarchiver.min.js"></script>

<!-- or Remote -->
<script src="https://xenova.github.io/unarchiver.js/dist/unarchiver.min.js"></script>
```

### Usage (JavaScript)
```javascript
// Load file (e.g., from URL or input element)
let file = new File(...);

// Open the file archive for reading
Unarchiver.open(file).then(async function (archive) {
	for (let entry of archive.entries) {
		if (entry.is_file) {
			// File object for archive entry
			let entry_file = await entry.read();
		}
	}
});
```

## Demo
Check out https://xenova.github.io/unarchiver.js/#demo for a demonstration of the library's functionality.

## Usage

### Methods
<table>
   <thead>
      <tr>
         <th>Name</th>
         <th>Description</th>
         <th>Example</th>
      </tr>
   </thead>
   <tbody>
      <tr>
         <th><code>Unarchiver.load(formats)</code></th>
         <td>Returns a <a
            href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise">Promise</a> which will be fulfilled when the specified
            formats have been loaded. <code>format</code> is an array of formats to be loaded,
            selected from: <code>zip</code>, <code>rar</code>, <code>tar</code>,
            <code>gz</code>, <code>xz</code>, and <code>bz2</code>. If no formats are provided,
            all supported formats will be loaded.
            <br><br>
            Note: calling this method is optional since, by default, formats are loaded when
            they are needed for the first time. This method is used to speed up processing by
            preloading the necessary files.
         </td>
         <td>
            <pre><code>// Load all supported formats
Unarchiver.load().then(function() {
	console.log('Finished loading all formats');
});

// Load certain formats
Unarchiver.load(['zip', 'tar']).then(function() {
	console.log('Finished loading certain formats');
});
</code></pre>
         </td>
      </tr>
      <tr>
         <th><code>Unarchiver.open(file)</code></th>
         <td>
            Returns a <a
               href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise"
               >Promise</a> which will be fulfilled when the file has been
            opened/unarchived. The fulfilled Promise contains the readable archive and holds the
            following information:<br>
            <pre>{
    "file_name": String,
    "archive_type": String,
    "array_buffer": ArrayBuffer,
    "entries": [object]
}</pre>
            See below for how to read the archive entries.
         </td>
         <td>
            <pre><code>// See below for examples on how to read files
let file = new File(...);
Unarchiver.open(file).then(function(archive) {
	console.log(archive.file_name);
	console.log(archive.archive_type);
	console.log(archive.entries);
});
</code></pre>
         </td>
      </tr>
      <tr>
         <th><code>Unarchiver.close(archive)</code></th>
         <td>Close an opened archive. Usually, this method is unnecessary, but may be useful if
            you wish to save memory.
         </td>
         <td>
            <pre><code>Unarchiver.open(file).then(function(archive) {
	// Close archive
	Unarchiver.close(archive);
});
</code></pre>
         </td>
      </tr>
   </tbody>
</table>

### Archive Entries
Each achive entry object contains the following attributes:
<pre>{
    "name": String,
    "is_file": Boolean,
    "size_compressed": Integer,
    "size_uncompressed": Integer
}</pre>
Additionally, an archive entry object contains a <code>read()</code> method which is used to read its data.

This method returns a <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise">Promise</a> which will be fulfilled when the file has been loaded. The fulfilled Promise contains the File object of the entry. This means that regular File operations can be used to extract its data. For example:

```javascript
Unarchiver.open(file).then(async function (archive) {
	// Archive metadata
	let archive_name = archive.file_name;
	let archive_type = archive.archive_type;

	for (let entry of archive.entries) {
		// Entry's metadata
		let name = entry.name;
		let is_file = entry.is_file;
		let size_compressed = entry.size_compressed;
		let size_uncompressed = entry.size_uncompressed;

		// Entry's data
		if (is_file) {
			// File object for archive entry
			let entry_file = await entry.read();

			// Actual data for archive entry
			let entry_file_data = await entry_file.arrayBuffer();

			// ... do something with entry_file and entry_file_data
			console.log(entry_file, entry_file_data);
		}
	}
});
```

## Examples

### Read remote archive (from URL)
```javascript
let url = 'https://xenova.github.io/unarchiver.js/test_files/file.zip';
fetch(url).then(async function (data) {
	// Load file from URL
	let blob = await data.blob();
	let file = new File([blob], url.split('/').pop(), { type: blob.type });

	// Open the file archive
	let archive = await Unarchiver.open(file);
	for (let entry of archive.entries) {
		if (entry.is_file) {
			// File object for archive entry
			let entry_file = await entry.read();
			console.log(entry_file); // do something
		}
	}
});
```
### Read local archive (from input element)
```html
<input type="file" id="example-file">
<button onclick="readFile()">Read</button><br>
<div id="example-output"></div>

<script>
function readFile() {
	let file = document.getElementById('example-file').files[0]
	if (!file) return;

	let output = document.getElementById('example-output');

	// Open the file archive for reading
	Unarchiver.open(file).then(async function (archive) {
		output.innerHTML = '';
		for (let entry of archive.entries) {
			if (entry.is_file) {
				output.innerHTML += entry.name + '<br>';

				// File object for archive entry
				// let entry_file = await entry.read();
			}
		}
	});
}
</script>
```

## Credits
- Inspired by the [Uncompress](https://github.com/workhorsy/uncompress.js) library by [workhorsy](https://github.com/workhorsy)
- Uses:
  - [JSZip](https://github.com/Stuk/jszip) for unarchiving zip files
  - [libunrar](https://github.com/wcchoi/libunrar-js) for unarchiving rar files
  - [libuntar](https://github.com/workhorsy/uncompress.js/blob/master/js/libuntar.js) for unarchiving tar files
  - [xz-pure-js](https://github.com/yurevich1/xz-pure-js-web-worker) for decompressing xz files
  - [pako](https://github.com/nodeca/pako) for decompressing gz files
  - [bz2](https://github.com/SheetJS/bz2) for decompressing bz2 files
