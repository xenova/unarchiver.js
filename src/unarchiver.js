"use strict";
const DIST = false;
const EXT = DIST ? '.min.js' : '.js';

function loadScript(path, name) {
	return loadScriptFromPath(path + 'lib/' + name + EXT)
}

function loadScriptFromPath(url) {
	return new Promise((resolve, reject) => {
		if (typeof window === 'object') { // Window
			let script = document.createElement('script');
			script.type = 'text/javascript';
			script.src = url;
			script.onload = resolve;
			document.head.appendChild(script);

		} else if (typeof importScripts === 'function') { // Web Worker
			importScripts(url);
			resolve();
		} else {
			reject();
		}
	})
}

function currentScriptPath() {
	// NOTE: document.currentScript does not work in a Web Worker
	// So we have to parse a stack trace maually
	try {
		throw new Error('');
	} catch (e) {
		let stack = e.stack;
		let line = (stack.indexOf('@') !== -1)
			? stack.split('@')[1].split('\n')[0] // Chrome and IE
			: stack.split('(')[1].split(')')[0]; // Firefox
		return line.substring(0, line.lastIndexOf('/')) + '/';
	}
}

// Used by libunrar.js to load libunrar.js.mem
let unrarMemoryFileLocation = null;
let g_on_loaded_cb = null;
let unrarReady = new Promise((resolve, reject) => {
	g_on_loaded_cb = resolve;
});

class Unarchiver {

	static async load(formats = null) {
		formats = formats || ['zip', 'rar', 'tar', 'gz', 'xz', 'bz2']
		return Promise.all(formats.map(Unarchiver._load_format));
	}

	static async _load_format(format) {
		if (format in Unarchiver.loadedFormats) {
			// Already loaded or loading
			await Unarchiver.loadedFormats[format]
			return;
		}

		let path = currentScriptPath();

		return Unarchiver.loadedFormats[format] = new Promise(async (resolve, reject) => {
			switch (format) {
				case 'zip':
					await loadScript(path, 'jszip');
					break;

				case 'rar':
					unrarMemoryFileLocation = path + 'lib/libunrar.js.mem';
					await loadScript(path, 'libunrar');
					await unrarReady;
					break;

				case 'tar':
					await loadScript(path, 'libuntar');
					break;

				case 'gz':
					await loadScript(path, 'pako_inflate');
					break;

				case 'xz':
					await loadScript(path, 'xz');
					break;

				case 'bz2':
					await loadScript(path, 'bz2');
					break;

				default:
					throw new Error("Unknown archive format '" + format + "'.");
			}
			resolve()
		})
	}

	static open(file, password = null) {
		return new Promise((resolve, reject) => {
			let file_name = file.name;
			password = password || null;

			let reader = new FileReader();
			reader.onload = async () => {
				let array_buffer = reader.result;

				// Decompress
				if (Unarchiver.isGzip(array_buffer)) {
					await Unarchiver._load_format('gz');
					array_buffer = pako.inflate(array_buffer).buffer

				} else if (Unarchiver.isXZ(array_buffer)) {
					await Unarchiver._load_format('xz');
					array_buffer = toXZ(new Uint8Array(array_buffer), 0, 0, 0, 2 ** 28).buffer;

				} else if (Unarchiver.isBZ2(array_buffer)) {
					await Unarchiver._load_format('bz2');
					array_buffer = bz2.decompress(new Uint8Array(array_buffer)).buffer;
				}

				let handle = null;
				let entries = [];

				// Unarchive
				let archive_type = null;
				if (Unarchiver.isRarFile(array_buffer)) {
					archive_type = 'rar';
					await Unarchiver._load_format(archive_type);
					handle = Unarchiver._rarOpen(file_name, password, array_buffer);
					entries = Unarchiver._rarGetEntries(handle);

				} else if (Unarchiver.isZipFile(array_buffer)) {
					archive_type = 'zip';
					await Unarchiver._load_format(archive_type);
					handle = await Unarchiver._zipOpen(file_name, password, array_buffer);
					entries = Unarchiver._zipGetEntries(handle);

				} else if (Unarchiver.isTarFile(array_buffer)) {
					archive_type = 'tar';
					await Unarchiver._load_format(archive_type);
					handle = Unarchiver._tarOpen(file_name, password, array_buffer);
					entries = Unarchiver._tarGetEntries(handle);

				} else {
					throw new Error('The archive type is unknown');
				}

				// Sort the entries by name
				entries.sort((a, b) => {
					return a.name.localeCompare(b.name);
				});

				// Return the archive object
				resolve({
					file_name: file_name,
					archive_type: archive_type,
					array_buffer: array_buffer,
					entries: entries,
					handle: handle
				})
			}
			reader.readAsArrayBuffer(file);
		});
	}

	static archiveClose(archive) {
		archive.file_name = null;
		archive.archive_type = null;
		archive.array_buffer = null;
		archive.entries = null;
		archive.handle = null;
	}

	static _rarOpen(file_name, password, array_buffer) {
		return {
			file_name: file_name,
			array_buffer: array_buffer,
			password: password,
			rar_files: [{
				name: file_name,
				size: array_buffer.byteLength,
				type: '',
				content: new Uint8Array(array_buffer)
			}]
		};
	}

	static async _zipOpen(file_name, password, array_buffer) {
		return {
			file_name: file_name,
			array_buffer: array_buffer,
			password: password,
			zip: await JSZip.loadAsync(array_buffer)
		};
	}

	static _tarOpen(file_name, password, array_buffer) {
		return {
			file_name: file_name,
			array_buffer: array_buffer,
			password: password
		};
	}

	static _rarGetEntries(rar_handle) {
		return Object.entries(readRARFile(rar_handle.rar_files, rar_handle.password)).map(([_, item]) => {
			let name = item.name;
			let is_file = item.is_file;
			return {
				name: name,
				is_file: item.is_file,
				size_compressed: item.size_compressed,
				size_uncompressed: item.size_uncompressed,
				read: () => {
					return new Promise((resolve, reject) => {
						if (is_file) {
							try {
								readRARContent(rar_handle.rar_files, rar_handle.password, name, (c) => {
									resolve(new File([c], name))
								});
							} catch (e) {
								reject(e);
							}
						} else {
							resolve(null);
						}
					})
				}
			}
		})
	}

	static _zipGetEntries(zip_handle) {
		return Object.entries(zip_handle.zip.files).map(([_, item]) => {
			let name = item.name;
			let is_file = !item.dir;
			let size_compressed = item._data ? item._data.compressedSize : 0;
			let size_uncompressed = item._data ? item._data.uncompressedSize : 0;

			return {
				name: name,
				is_file: is_file,
				size_compressed: size_compressed,
				size_uncompressed: size_uncompressed,
				read: () => {
					return new Promise(async (resolve, reject) => {
						resolve(is_file ? new File([await item.async('blob')], name) : null)
					})
				}
			};
		});
	}

	static _tarGetEntries(tar_handle) {
		// Get all the entries
		return tarGetEntries(tar_handle.file_name, tar_handle.array_buffer).map((entry) => {
			let name = entry.name;
			let is_file = entry.is_file;
			let size = entry.size;
			return {
				name: name,
				is_file: is_file,
				size_compressed: size,
				size_uncompressed: size,
				read: () => {
					return new Promise((resolve, reject) => {
						if (is_file) {
							let data = tarGetEntryData(entry, tar_handle.array_buffer)
							resolve(new File([data.buffer], name));
						} else {
							resolve(null);
						}
					})
				}
			};
		});


	}

	static isRarFile(array_buffer) {
		// Just return false if the file is smaller than the header
		if (array_buffer.byteLength < 8)
			return false;

		let header = new Uint8Array(array_buffer, 0, 8);

		// Return true if the header matches one of the styles of RAR headers
		return (header[0] == 0x52) // Always this first
			&&
			(
				(header[1] == 0x45 && header[2] == 0x7E && header[3] == 0x5E) ||
				(header[1] == 0x61 && header[2] == 0x72 && header[3] == 0x21 && header[4] == 0x1A && header[5] == 0x07 && ((header[6] == 0x00) || (header[6] == 0x01 && header[7] == 0x00)))
			);
	}

	static isZipFile(array_buffer) {
		return Unarchiver.checkHeader([0x50, 0x4b, 0x03, 0x04], array_buffer)
	}

	static isTarFile(array_buffer) {
		return Unarchiver.checkHeader([0x75, 0x73, 0x74, 0x61, 0x72], array_buffer, 257, 512)
	}

	static isGzip(array_buffer) {
		return Unarchiver.checkHeader([0x1F, 0x8B, 0x08], array_buffer)
	}

	static isBZ2(array_buffer) {
		return Unarchiver.checkHeader([0x42, 0x5A, 0x68], array_buffer)
	}

	static isXZ(array_buffer) {
		return Unarchiver.checkHeader([0xFD, 0x37, 0x7A, 0x58, 0x5A, 0x00], array_buffer)
	}

	static checkHeader(expectedHeader, array_buffer, offset = 0, minBytes = null) {
		let m = offset + expectedHeader.length;
		if (array_buffer.byteLength < (minBytes || m))
			return false;

		let header = new Uint8Array(array_buffer, offset, m);
		for (let i = 0; i < expectedHeader.length; ++i) {
			if (header[i] != expectedHeader[i])
				return false;
		}
		return true;
	}
}
// Set static class variables
// Stores a dictionary of promises, allowing for multiple blocking calls to load
Unarchiver.loadedFormats = {};
